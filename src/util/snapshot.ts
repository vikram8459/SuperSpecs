import { cpSync, existsSync, rmSync } from 'node:fs';
import { openspecPaths, snapshotPath } from './openspec.js';

// Re-export so snapshot consumers (e.g. archive) get the snapshot path from
// the same module as `takeSnapshot` without a redundant wrapper function.
export { snapshotPath } from './openspec.js';

/** Copy openspec/specs/ to openspec/.snapshots/<id>/ (replacing any prior). */
export function takeSnapshot(repoRoot: string, changeId: string): string {
  const specs = openspecPaths(repoRoot).specs;
  const dest = snapshotPath(repoRoot, changeId);
  if (existsSync(dest)) rmSync(dest, { recursive: true, force: true });
  if (existsSync(specs)) cpSync(specs, dest, { recursive: true });
  return dest;
}
