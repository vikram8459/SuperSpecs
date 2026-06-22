import { cpSync, existsSync, rmSync } from 'node:fs';
import { openspecPaths, snapshotPath } from './openspec.js';

export function snapshotDir(repoRoot: string, changeId: string): string {
  return snapshotPath(repoRoot, changeId);
}

/** Copy openspec/specs/ to openspec/.snapshots/<id>/ (replacing any prior). */
export function takeSnapshot(repoRoot: string, changeId: string): string {
  const specs = openspecPaths(repoRoot).specs;
  const dest = snapshotDir(repoRoot, changeId);
  if (existsSync(dest)) rmSync(dest, { recursive: true, force: true });
  if (existsSync(specs)) cpSync(specs, dest, { recursive: true });
  return dest;
}
