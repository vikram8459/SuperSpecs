import fg from 'fast-glob';
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import {
  gitAddAll,
  gitCommit,
  gitIsClean,
  headIsArchiveOf,
  gitResetSoftHead1,
  hasDirtyChangesOutside,
} from '../util/git.js';
import { takeSnapshot, snapshotDir } from '../util/snapshot.js';
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
 * Compute, for every character offset in `source`, whether it lies inside a
 * fenced code block (``` or ~~~). Used so that a `### Requirement:` line that
 * appears inside a code fence is not mistaken for a real requirement heading.
 */
function fencedRegions(source: string): Array<{ start: number; end: number }> {
  const regions: Array<{ start: number; end: number }> = [];
  const fence = /^([ \t]*)(`{3,}|~{3,})/gm;
  let m: RegExpExecArray | null;
  let openStart: number | null = null;
  let openMarker = '';
  while ((m = fence.exec(source)) !== null) {
    const marker = m[2][0].repeat(3); // normalize to the fence char
    if (openStart === null) {
      openStart = m.index;
      openMarker = marker;
    } else if (marker === openMarker) {
      const lineEnd = source.indexOf('\n', m.index);
      regions.push({ start: openStart, end: lineEnd === -1 ? source.length : lineEnd + 1 });
      openStart = null;
      openMarker = '';
    }
  }
  if (openStart !== null) regions.push({ start: openStart, end: source.length });
  return regions;
}

function isInsideFence(
  offset: number,
  regions: Array<{ start: number; end: number }>,
): boolean {
  return regions.some((r) => offset >= r.start && offset < r.end);
}

/**
 * Find the byte range of an existing `### Requirement: <name>` block in
 * the active spec markdown. The block extends from its `###` line up to
 * (but not including) the next `### Requirement: ` heading or EOF.
 * `### Requirement:` lines inside fenced code blocks are ignored.
 * Returns null if not found.
 */
function findRequirementBlock(
  source: string,
  name: string,
): { start: number; end: number } | null {
  const fences = fencedRegions(source);
  const re = /^### Requirement:\s*(.+?)\s*$/gm;
  let match: RegExpExecArray | null;
  while ((match = re.exec(source)) !== null) {
    if (isInsideFence(match.index, fences)) continue;
    if (match[1].trim() !== name) continue;
    const start = match.index;
    // Find the start of the next ### Requirement: heading (also skipping
    // any that fall inside a code fence).
    re.lastIndex = match.index + match[0].length;
    let next = re.exec(source);
    while (next && isInsideFence(next.index, fences)) next = re.exec(source);
    const end = next ? next.index : source.length;
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
  warnings: string[];
}

export interface ArchivePlan {
  changeId: string;
  changes: CapabilityChange[];
}

/** Pure: compute the resulting active content for one capability (no write). */
function computeCapabilityAfter(
  activePath: string,
  ast: SpecDeltaAst,
): { after: string; warnings: string[] } {
  const warnings: string[] = [];
  let body = existsSync(activePath)
    ? readFileSync(activePath, 'utf8')
    : `# ${ast.capability}\n`;

  for (const req of ast.deltas.modified) {
    const range = findRequirementBlock(body, req.name);
    const rendered = renderRequirement(req);
    if (range) {
      body = body.slice(0, range.start) + rendered + body.slice(range.end);
    } else {
      // MODIFIED names a requirement that does not exist in the active set.
      // This is almost always an authoring mistake (wrong name, or it
      // should have been ADDED). We still apply it (append) so the delta is
      // not silently dropped, but we surface a warning so the author can
      // catch the mismatch.
      warnings.push(
        `MODIFIED requirement "${req.name}" was not found in the active set ` +
          `for ${ast.capability}; appending it as if ADDED. Did you mean to ` +
          `ADD it, or is the name misspelled?`,
      );
      body = body.replace(/\s+$/, '') + '\n\n' + rendered;
    }
  }
  for (const req of ast.deltas.removed) {
    const range = findRequirementBlock(body, req.name);
    if (range) {
      body = body.slice(0, range.start) + body.slice(range.end);
    } else {
      warnings.push(
        `REMOVED requirement "${req.name}" was not found in the active set ` +
          `for ${ast.capability}; nothing to remove.`,
      );
    }
  }
  for (const req of ast.deltas.added) {
    body = body.replace(/\s+$/, '') + '\n\n' + renderRequirement(req);
  }
  return { after: body.replace(/\s+$/, '') + '\n', warnings };
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
    const { after, warnings } = computeCapabilityAfter(activePath, ast);
    changes.push({
      capability,
      activePath,
      before,
      after,
      added: ast.deltas.added.map((r) => r.name),
      modified: ast.deltas.modified.map((r) => r.name),
      removed: ast.deltas.removed.map((r) => r.name),
      warnings,
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
    for (const w of c.warnings) process.stderr.write(`  ! WARNING ${w}\n`);
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

function runUndo(repoRoot: string, changeId: string): number {
  const snap = snapshotDir(repoRoot, changeId);
  if (!existsSync(snap)) {
    process.stderr.write(
      `archive --undo: snapshot not found: openspec/.snapshots/${changeId}\n`,
    );
    return 1;
  }

  // Undo serves two cases that the previous clean-tree gate could not
  // both satisfy:
  //   1. A successful archive (HEAD is the `archive: <id>` commit, tree
  //      clean). Soft-reset that commit so undo also rewinds history.
  //   2. A half-archived tree after a failed commit (files written, folder
  //      moved, tree dirty under openspec/, no archive commit). The error
  //      message printed by runArchive points here, so undo must NOT
  //      refuse on a dirty tree in this case.
  // Both cases only touch the `openspec/` tree, so the guard refuses only
  // when there are uncommitted changes OUTSIDE openspec/ — unrelated work
  // that the snapshot restore could clobber.
  if (hasDirtyChangesOutside(repoRoot, 'openspec')) {
    process.stderr.write(
      'archive --undo: working tree has uncommitted changes outside openspec/. ' +
        'Commit or stash them first.\n',
    );
    return 1;
  }
  const headIsArchive = headIsArchiveOf(repoRoot, changeId);

  // If the archive was committed, rewind that commit first so history and
  // the working tree both reflect the pre-archive state.
  if (headIsArchive) {
    gitResetSoftHead1(repoRoot);
  }

  // Restore openspec/specs/ from the snapshot, byte-for-byte.
  const specs = join(repoRoot, 'openspec', 'specs');
  if (existsSync(specs)) rmSync(specs, { recursive: true, force: true });
  cpSync(snap, specs, { recursive: true });

  // Move the archived folder back to changes/<id>/ (find the dated dir).
  const archiveBase = join(repoRoot, 'openspec', 'changes', 'archive');
  const match = existsSync(archiveBase)
    ? readdirSync(archiveBase).find((n) => n.endsWith(`-${changeId}`))
    : undefined;
  if (match) {
    renameSync(join(archiveBase, match), join(repoRoot, 'openspec', 'changes', changeId));
  }

  process.stdout.write(
    `Undid archive of ${changeId}; restored openspec/specs/ from snapshot.\n`,
  );
  return 0;
}

export function runArchive(cwd: string, changeId: string, opts: ArchiveOptions = {}): number {
  const repoRoot = resolve(cwd);

  if (opts.undo) return runUndo(repoRoot, changeId);

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

  // Surface non-fatal authoring warnings (e.g. MODIFIED naming a
  // requirement that does not exist in the active set) before writing.
  for (const c of plan.changes) {
    for (const w of c.warnings) process.stderr.write(`archive: warning: ${w}\n`);
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

  // Stage everything and commit with the structured trailers. The
  // working-tree mutations above (writePlan + renameSync) are already
  // done, so a git failure here would otherwise leave a half-archived
  // tree with a raw exception. Catch it and point the user at the
  // snapshot-backed recovery path instead.
  try {
    gitAddAll(repoRoot);
    gitCommit(repoRoot, `archive: ${changeId}`, {
      'Archive-Of': changeId,
      'Snapshot-At': `openspec/.snapshots/${changeId}`,
    });
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    process.stderr.write(
      `archive: files were moved and written, but the git commit failed: ${reason}\n` +
        `archive: the pre-archive state was snapshotted to openspec/.snapshots/${changeId}.\n` +
        `archive: run \`superspecs archive ${changeId} --undo\` to restore it, then retry.\n`,
    );
    return 1;
  }

  process.stdout.write(`Archived ${changeId} -> ${archivedDir}\n`);
  return 0;
}
