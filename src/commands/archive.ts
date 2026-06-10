import fg from 'fast-glob';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { gitAddAll, gitCommit, gitIsClean } from '../util/git.js';
import { takeSnapshot } from '../util/snapshot.js';
import { validateActiveContent } from './validate-active.js';
import {
  parseSpecDelta,
  type RequirementAst,
  type SpecDeltaAst,
} from '../parser/spec-delta.js';

function todayIso(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Render a Requirement back into markdown for the active spec set.
 * Symmetric with the parser in `src/parser/spec-delta.ts`.
 */
function renderRequirement(req: RequirementAst): string {
  let out = `### Requirement: ${req.name}\n\n${req.body}\n`;
  for (const s of req.scenarios) {
    out += `\n#### Scenario: ${s.name}\n\n- **GIVEN** ${s.given}\n- **WHEN** ${s.when}\n- **THEN** ${s.then}\n`;
  }
  return out;
}

/**
 * Find the byte range of an existing `### Requirement: <name>` block in
 * the active spec markdown. The block extends from its `###` line up to
 * (but not including) the next `### Requirement: ` heading or EOF.
 * Returns null if not found.
 */
function findRequirementBlock(
  source: string,
  name: string,
): { start: number; end: number } | null {
  const re = /^### Requirement:\s*(.+?)\s*$/gm;
  let match: RegExpExecArray | null;
  while ((match = re.exec(source)) !== null) {
    if (match[1].trim() !== name) continue;
    const start = match.index;
    // Find the start of the next ### Requirement: heading.
    re.lastIndex = match.index + match[0].length;
    const next = re.exec(source);
    const end = next ? next.index : source.length;
    // Reset for caller; we only needed the next-match position.
    return { start, end };
  }
  return null;
}

export interface CapabilityChange {
  capability: string;
  activePath: string;
  before: string;
  after: string;
  added: string[];
  modified: string[];
  removed: string[];
}

export interface ArchivePlan {
  changeId: string;
  changes: CapabilityChange[];
}

/** Pure: compute the resulting active content for one capability (no write). */
function computeCapabilityAfter(activePath: string, ast: SpecDeltaAst): string {
  let body = existsSync(activePath)
    ? readFileSync(activePath, 'utf8')
    : `# ${ast.capability}\n`;

  for (const req of ast.deltas.modified) {
    const range = findRequirementBlock(body, req.name);
    const rendered = renderRequirement(req);
    body = range
      ? body.slice(0, range.start) + rendered + body.slice(range.end)
      : body.replace(/\s+$/, '') + '\n\n' + rendered;
  }
  for (const req of ast.deltas.removed) {
    const range = findRequirementBlock(body, req.name);
    if (range) body = body.slice(0, range.start) + body.slice(range.end);
  }
  for (const req of ast.deltas.added) {
    body = body.replace(/\s+$/, '') + '\n\n' + renderRequirement(req);
  }
  return body.replace(/\s+$/, '') + '\n';
}

export function buildArchivePlan(repoRoot: string, changeId: string): ArchivePlan {
  const changeDir = join(repoRoot, 'openspec', 'changes', changeId);
  const deltaFiles = fg.sync('specs/*/spec.md', { cwd: changeDir, absolute: false });
  const changes: CapabilityChange[] = [];
  for (const rel of deltaFiles) {
    const text = readFileSync(join(changeDir, rel), 'utf8');
    const { ast } = parseSpecDelta(text, join(changeDir, rel));
    const capability = rel.split(/[\\/]/)[1];
    const activePath = join(repoRoot, 'openspec', 'specs', capability, 'spec.md');
    const before = existsSync(activePath) ? readFileSync(activePath, 'utf8') : '';
    changes.push({
      capability,
      activePath,
      before,
      after: computeCapabilityAfter(activePath, ast),
      added: ast.deltas.added.map((r) => r.name),
      modified: ast.deltas.modified.map((r) => r.name),
      removed: ast.deltas.removed.map((r) => r.name),
    });
  }
  return { changeId, changes };
}

function printPlan(plan: ArchivePlan): void {
  for (const c of plan.changes) {
    process.stdout.write(`capability ${c.capability} -> ${c.activePath}\n`);
    for (const n of c.added) process.stdout.write(`  + ADDED ${n}\n`);
    for (const n of c.modified) process.stdout.write(`  ~ MODIFIED ${n}\n`);
    for (const n of c.removed) process.stdout.write(`  - REMOVED ${n}\n`);
  }
}

function writePlan(plan: ArchivePlan): void {
  for (const c of plan.changes) {
    mkdirSync(dirname(c.activePath), { recursive: true });
    writeFileSync(c.activePath, c.after, 'utf8');
  }
}

export interface ArchiveOptions {
  dryRun?: boolean;
  undo?: boolean;
}

export function runArchive(cwd: string, changeId: string, opts: ArchiveOptions = {}): number {
  const repoRoot = resolve(cwd);

  const changeDir = join(repoRoot, 'openspec', 'changes', changeId);

  // --dry-run: preview only. Read-only, so it does not require a clean tree.
  if (opts.dryRun) {
    if (!existsSync(changeDir)) {
      process.stderr.write(`archive: ${changeDir} not found.\n`);
      return 1;
    }
    printPlan(buildArchivePlan(repoRoot, changeId));
    process.stdout.write('(dry-run) no files written, nothing moved, no commit.\n');
    return 0;
  }

  if (!gitIsClean(repoRoot)) {
    process.stderr.write(
      'archive: working tree is dirty. Commit or stash your changes first.\n',
    );
    return 1;
  }

  if (!existsSync(changeDir)) {
    process.stderr.write(`archive: ${changeDir} not found.\n`);
    return 1;
  }

  const plan = buildArchivePlan(repoRoot, changeId);

  // Refuse to write if the resulting active set would be structurally
  // invalid (duplicate requirement names, requirements with no scenario).
  const planErrors = plan.changes.flatMap((c) => validateActiveContent(c.capability, c.after));
  if (planErrors.length > 0) {
    for (const e of planErrors) {
      process.stderr.write(
        `archive: would corrupt active set: ${e.capability}: ${e.code} ${e.message}\n`,
      );
    }
    return 1;
  }

  // Snapshot the current active spec set before any modification, so
  // `archive --undo` can restore it byte-for-byte.
  takeSnapshot(repoRoot, changeId);

  writePlan(plan);

  // Move the change folder under archive/<YYYY-MM-DD>-<change-id>/.
  const archiveBase = join(repoRoot, 'openspec', 'changes', 'archive');
  mkdirSync(archiveBase, { recursive: true });
  const archivedDir = join(archiveBase, `${todayIso()}-${changeId}`);
  renameSync(changeDir, archivedDir);

  // Stage everything and commit with the structured trailers.
  gitAddAll(repoRoot);
  gitCommit(repoRoot, `archive: ${changeId}`, {
    'Archive-Of': changeId,
    'Snapshot-At': `openspec/.snapshots/${changeId}`,
  });

  process.stdout.write(`Archived ${changeId} -> ${archivedDir}\n`);
  return 0;
}
