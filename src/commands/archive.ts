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

function applyDeltaToCapability(activePath: string, ast: SpecDeltaAst): void {
  const capability = ast.capability;
  let body = existsSync(activePath)
    ? readFileSync(activePath, 'utf8')
    : `# ${capability}\n`;

  // MODIFIED: replace existing block with the new one.
  for (const req of ast.deltas.modified) {
    const range = findRequirementBlock(body, req.name);
    const rendered = renderRequirement(req);
    if (range) {
      body = body.slice(0, range.start) + rendered + body.slice(range.end);
    } else {
      // No prior requirement to modify; append it so the change is still
      // applied. Archive safety (Phase E / F13) will turn this into a
      // hard error with `validate --active`.
      body = body.replace(/\s+$/, '') + '\n\n' + rendered;
    }
  }

  // REMOVED: drop the block entirely.
  for (const req of ast.deltas.removed) {
    const range = findRequirementBlock(body, req.name);
    if (range) {
      body = body.slice(0, range.start) + body.slice(range.end);
    }
  }

  // ADDED: append after the existing content.
  for (const req of ast.deltas.added) {
    body = body.replace(/\s+$/, '') + '\n\n' + renderRequirement(req);
  }

  body = body.replace(/\s+$/, '') + '\n';
  mkdirSync(dirname(activePath), { recursive: true });
  writeFileSync(activePath, body, 'utf8');
}

/**
 * The current archive implementation lacks --dry-run, --undo,
 * snapshot creation, and active-spec validation. Until those land,
 * a mistake during archive can silently corrupt the active spec
 * set with no recovery path beyond `git revert`. The notice below
 * is emitted on every run so users always see the limitation
 * before the irreversible step proceeds. Internal tracking lives
 * in the project's audit checklist.
 */
const ARCHIVE_LIMITATIONS_NOTICE =
  'archive: this command does not yet support --dry-run, --undo,\n' +
  '  or active-spec validation. Review the proposed deltas before\n' +
  '  running and use `git revert` to roll back if needed.\n';

export function runArchive(cwd: string, changeId: string): number {
  const repoRoot = resolve(cwd);

  if (!gitIsClean(repoRoot)) {
    process.stderr.write(
      'archive: working tree is dirty. Commit or stash your changes first.\n',
    );
    return 1;
  }

  process.stderr.write(ARCHIVE_LIMITATIONS_NOTICE);

  const changeDir = join(repoRoot, 'openspec', 'changes', changeId);
  if (!existsSync(changeDir)) {
    process.stderr.write(`archive: ${changeDir} not found.\n`);
    return 1;
  }

  // Apply every delta file under the change.
  const deltaFiles = fg.sync('specs/*/spec.md', { cwd: changeDir, absolute: false });
  for (const rel of deltaFiles) {
    const deltaPath = join(changeDir, rel);
    const text = readFileSync(deltaPath, 'utf8');
    const { ast } = parseSpecDelta(text, deltaPath);
    const capability = rel.split(/[\\/]/)[1];
    const activePath = join(repoRoot, 'openspec', 'specs', capability, 'spec.md');
    applyDeltaToCapability(activePath, ast);
  }

  // Move the change folder under archive/<YYYY-MM-DD>-<change-id>/.
  const archiveBase = join(repoRoot, 'openspec', 'changes', 'archive');
  mkdirSync(archiveBase, { recursive: true });
  const archivedDir = join(archiveBase, `${todayIso()}-${changeId}`);
  renameSync(changeDir, archivedDir);

  // Stage everything and commit with the structured trailer.
  gitAddAll(repoRoot);
  gitCommit(repoRoot, `archive: ${changeId}`, { 'Archive-Of': changeId });

  process.stdout.write(`Archived ${changeId} -> ${archivedDir}\n`);
  return 0;
}
