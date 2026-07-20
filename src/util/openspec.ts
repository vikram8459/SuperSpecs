import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve, sep } from 'node:path';
import fg from 'fast-glob';

/**
 * A change-id must be a single, safe path segment: letters, digits, dot,
 * underscore, and hyphen only — and never the traversal names `.`/`..`.
 * Every command that accepts a change-id validates it against this before
 * the id is joined into a filesystem path, so a value like `../../foo`
 * can never escape the `openspec/` tree in a rename/copy/recursive-delete.
 */
const CHANGE_ID_RE = /^[A-Za-z0-9._-]+$/;

/** True if `id` is a safe single-segment change-id (see {@link CHANGE_ID_RE}). */
export function isValidChangeId(id: string): boolean {
  return id.length > 0 && id !== '.' && id !== '..' && CHANGE_ID_RE.test(id);
}

/**
 * Join `segment` under `base` and assert the result stays inside `base`.
 * Defense-in-depth backstop for the path builders below: even if a caller
 * skips {@link isValidChangeId}, a traversal segment throws here rather
 * than resolving to a path outside the intended tree.
 */
function joinWithin(base: string, segment: string): string {
  const baseResolved = resolve(base);
  const target = resolve(baseResolved, segment);
  if (target !== baseResolved && !target.startsWith(baseResolved + sep)) {
    throw new Error(`refusing to resolve a path outside ${baseResolved}: "${segment}"`);
  }
  return target;
}

/**
 * Canonical locations within an OpenSpec workspace, derived once from a
 * repo root. Centralizing these keeps the `openspec/...` path layout in a
 * single place instead of being re-`join`-ed ad hoc across commands.
 */
export interface OpenSpecPaths {
  root: string;
  openspec: string;
  changes: string;
  archive: string;
  specs: string;
}

export function openspecPaths(cwd: string): OpenSpecPaths {
  const root = resolve(cwd);
  const openspec = join(root, 'openspec');
  const changes = join(openspec, 'changes');
  return {
    root,
    openspec,
    changes,
    archive: join(changes, 'archive'),
    specs: join(openspec, 'specs'),
  };
}

/** Path to an in-flight change folder: openspec/changes/<changeId>. */
export function changeDir(cwd: string, changeId: string): string {
  return joinWithin(openspecPaths(cwd).changes, changeId);
}

/** Path to a capability's active spec under openspec/specs/<capability>/. */
export function capabilitySpecPath(cwd: string, capability: string): string {
  return join(openspecPaths(cwd).specs, capability, 'spec.md');
}

/** Path to the snapshot dir for a change: openspec/.snapshots/<changeId>. */
export function snapshotPath(cwd: string, changeId: string): string {
  return joinWithin(join(openspecPaths(cwd).openspec, '.snapshots'), changeId);
}

/** A spec-delta file under `specs/<capability>/` plus its raw source. */
export interface SpecDeltaFile {
  /** Capability name (the `<capability>` path segment). */
  capability: string;
  /** Absolute path to the delta file. */
  absPath: string;
  /** Raw file contents. */
  text: string;
}

/**
 * Discover and read every per-capability `spec.md` delta file under a
 * change folder (glob `specs/[capability]/spec.md`). Single source for the
 * "glob + read + derive capability" pattern shared by `validate` and
 * `archive`.
 */
export function loadSpecDeltas(changeDirPath: string): SpecDeltaFile[] {
  return fg
    .sync('specs/*/spec.md', { cwd: changeDirPath, absolute: false })
    .map((rel) => ({
      // The glob guarantees a `specs/<capability>/spec.md` shape, so the
      // second path segment is always present.
      capability: rel.split(/[\\/]/)[1] ?? '',
      absPath: join(changeDirPath, rel),
      text: readFileSync(join(changeDirPath, rel), 'utf8'),
    }));
}

/**
 * Return the immediate child directory names of `p`, sorted. Missing
 * directories yield `[]`, and entries that cannot be `stat`-ed (e.g. a
 * race with concurrent removal) are skipped rather than throwing.
 * Single source of truth for the "read dirs, skip non-dirs, sort" pattern
 * that was previously re-implemented in list/status/validate.
 */
export function listChildDirs(p: string): string[] {
  if (!existsSync(p)) return [];
  return readdirSync(p)
    .filter((n) => {
      try {
        return statSync(join(p, n)).isDirectory();
      } catch {
        return false;
      }
    })
    .sort();
}

/** In-flight change ids (child dirs of openspec/changes, excluding archive). */
export function listInFlightChanges(cwd: string): string[] {
  return listChildDirs(openspecPaths(cwd).changes).filter((n) => n !== 'archive');
}

/** Archived change folder names (child dirs of openspec/changes/archive). */
export function listArchived(cwd: string): string[] {
  return listChildDirs(openspecPaths(cwd).archive);
}

/** Active capability names (child dirs of openspec/specs). */
export function listCapabilities(cwd: string): string[] {
  return listChildDirs(openspecPaths(cwd).specs);
}
