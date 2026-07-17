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
import { takeSnapshot, snapshotPath } from '../util/snapshot.js';
import { toMessage } from '../util/errors.js';
import {
  openspecPaths,
  changeDir as changeDirPath,
  capabilitySpecPath,
  loadSpecDeltas,
  isValidChangeId,
} from '../util/openspec.js';
import { validateActiveContent } from './validate-active.js';
import { parseSpecDelta } from '../parser/spec-delta.js';
import { computeCapabilityAfter } from './archive-splice.js';

/**
 * UTC-date `YYYY-MM-DD` used for the archive folder prefix. UTC (not local
 * time) so the prefix is deterministic and reproducible regardless of the
 * contributor's timezone or a CI runner's, and orders consistently against
 * the commit timestamp.
 */
function todayIso(): string {
  const d = new Date();
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
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

export function buildArchivePlan(repoRoot: string, changeId: string): ArchivePlan {
  const changeDir = changeDirPath(repoRoot, changeId);
  const changes: CapabilityChange[] = [];
  for (const delta of loadSpecDeltas(changeDir)) {
    const { ast } = parseSpecDelta(delta.text, delta.absPath);
    const capability = delta.capability;
    const activePath = capabilitySpecPath(repoRoot, capability);
    const currentBody = existsSync(activePath) ? readFileSync(activePath, 'utf8') : null;
    const before = currentBody ?? '';
    const { after, warnings } = computeCapabilityAfter(currentBody, ast, delta.text);
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
  const snap = snapshotPath(repoRoot, changeId);
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
  const { specs, archive: archiveBase } = openspecPaths(repoRoot);
  if (existsSync(specs)) rmSync(specs, { recursive: true, force: true });
  cpSync(snap, specs, { recursive: true });

  // Move the archived folder back to changes/<id>/ (find the dated dir).
  const match = existsSync(archiveBase)
    ? readdirSync(archiveBase).find((n) => n.endsWith(`-${changeId}`))
    : undefined;
  if (match) {
    renameSync(join(archiveBase, match), changeDirPath(repoRoot, changeId));
  }

  process.stdout.write(
    `Undid archive of ${changeId}; restored openspec/specs/ from snapshot.\n`,
  );
  return 0;
}

/** Read-only `--dry-run`: preview the plan; never requires a clean tree. */
function runDryRun(repoRoot: string, changeDir: string, changeId: string): number {
  if (!existsSync(changeDir)) {
    process.stderr.write(`archive: ${changeDir} not found.\n`);
    return 1;
  }
  printPlan(buildArchivePlan(repoRoot, changeId));
  process.stdout.write('(dry-run) no files written, nothing moved, no commit.\n');
  return 0;
}

/**
 * Pre-write guards: the tree must be clean (so a failed commit is the only
 * way to leave a dirty tree, and undo's reasoning holds) and the change
 * folder must exist. Returns an exit code on failure, or null to proceed.
 */
function checkPreconditions(repoRoot: string, changeDir: string): number | null {
  if (!gitIsClean(repoRoot)) {
    process.stderr.write('archive: working tree is dirty. Commit or stash your changes first.\n');
    return 1;
  }
  if (!existsSync(changeDir)) {
    process.stderr.write(`archive: ${changeDir} not found.\n`);
    return 1;
  }
  return null;
}

/**
 * Refuse to write if the resulting active set would be structurally invalid
 * (duplicate requirement names, requirements with no scenario). Returns true
 * if the plan is safe to apply.
 */
function planIsSafe(plan: ArchivePlan): boolean {
  const planErrors = plan.changes.flatMap((c) => validateActiveContent(c.capability, c.after));
  for (const e of planErrors) {
    process.stderr.write(
      `archive: would corrupt active set: ${e.capability}: ${e.code} ${e.message}\n`,
    );
  }
  return planErrors.length === 0;
}

/**
 * Apply the plan to the working tree: snapshot the active set (for undo),
 * write the new active content, and move the change folder under
 * archive/<YYYY-MM-DD>-<change-id>/. Returns the archived folder path.
 */
function persistPlan(repoRoot: string, changeDir: string, changeId: string, plan: ArchivePlan): string {
  takeSnapshot(repoRoot, changeId);
  writePlan(plan);
  const archiveBase = openspecPaths(repoRoot).archive;
  mkdirSync(archiveBase, { recursive: true });
  const archivedDir = join(archiveBase, `${todayIso()}-${changeId}`);
  renameSync(changeDir, archivedDir);
  return archivedDir;
}

/**
 * Stage everything and commit with the structured trailers. The working-tree
 * mutations in persistPlan are already done, so a git failure here would
 * otherwise leave a half-archived tree with a raw exception. Catch it and
 * point the user at the snapshot-backed recovery path. Returns an exit code.
 */
function commitArchive(repoRoot: string, changeId: string): number {
  try {
    gitAddAll(repoRoot);
    gitCommit(repoRoot, `archive: ${changeId}`, {
      'Archive-Of': changeId,
      'Snapshot-At': `openspec/.snapshots/${changeId}`,
    });
    return 0;
  } catch (err) {
    const reason = toMessage(err);
    process.stderr.write(
      `archive: files were moved and written, but the git commit failed: ${reason}\n` +
        `archive: the pre-archive state was snapshotted to openspec/.snapshots/${changeId}.\n` +
        `archive: run \`superspecs archive ${changeId} --undo\` to restore it, then retry.\n`,
    );
    return 1;
  }
}

export function runArchive(cwd: string, changeId: string, opts: ArchiveOptions = {}): number {
  const repoRoot = resolve(cwd);
  if (!isValidChangeId(changeId)) {
    process.stderr.write(
      `archive: invalid change-id "${changeId}". Use letters, digits, '.', '_', or '-' ` +
        `(a single path segment; no separators or '..').\n`,
    );
    return 1;
  }
  if (opts.undo) return runUndo(repoRoot, changeId);

  const changeDir = changeDirPath(repoRoot, changeId);
  if (opts.dryRun) return runDryRun(repoRoot, changeDir, changeId);

  const precondition = checkPreconditions(repoRoot, changeDir);
  if (precondition !== null) return precondition;

  const plan = buildArchivePlan(repoRoot, changeId);
  if (!planIsSafe(plan)) return 1;

  // Surface non-fatal authoring warnings (e.g. MODIFIED naming a
  // requirement that does not exist in the active set) before writing.
  for (const c of plan.changes) {
    for (const w of c.warnings) process.stderr.write(`archive: warning: ${w}\n`);
  }

  const archivedDir = persistPlan(repoRoot, changeDir, changeId, plan);
  const commitCode = commitArchive(repoRoot, changeId);
  if (commitCode !== 0) return commitCode;

  process.stdout.write(`Archived ${changeId} -> ${archivedDir}\n`);
  return 0;
}
