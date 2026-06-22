import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';

/** Max parent directories to walk when locating an install/repo root. */
const MAX_WALK_DEPTH = 8;

/**
 * Walk up from `startDir` (inclusive) looking for the first ancestor that
 * contains every entry in `markers` (each relative to the candidate dir).
 * Returns that directory, or `null` if none matched within
 * {@link MAX_WALK_DEPTH} levels.
 *
 * Centralizes the `import.meta.url` -> walk-to-root pattern that was
 * previously reimplemented in `init`, `doctor`, and `schema/load`.
 */
export function findRootUp(startDir: string, markers: string[]): string | null {
  let dir = startDir;
  for (let i = 0; i < MAX_WALK_DEPTH; i++) {
    if (markers.every((m) => existsSync(join(dir, m)))) return dir;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}
