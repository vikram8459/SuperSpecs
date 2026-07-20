import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';

/**
 * Walk up from `startDir` (inclusive) looking for the first ancestor that
 * contains every entry in `markers` (each relative to the candidate dir).
 * Returns that directory, or `null` if no ancestor up to the filesystem
 * root matched.
 *
 * The walk continues to the filesystem root (stopping when `dirname(dir)`
 * no longer changes) rather than a fixed depth, so deeply nested installs
 * (e.g. some pnpm layouts more than eight levels down) still resolve.
 *
 * Centralizes the `import.meta.url` -> walk-to-root pattern that was
 * previously reimplemented in `init`, `doctor`, and `schema/load`.
 */
export function findRootUp(startDir: string, markers: string[]): string | null {
  let dir = startDir;
  for (;;) {
    if (markers.every((m) => existsSync(join(dir, m)))) return dir;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}
