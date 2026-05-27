import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';

export function mkdirpSafe(p: string): void {
  if (!existsSync(p)) {
    mkdirSync(p, { recursive: true });
  }
}

export function isEmptyDir(p: string): boolean {
  if (!existsSync(p)) return true;
  return readdirSync(p).length === 0;
}

export function writeIfAbsent(p: string, body: string): boolean {
  if (existsSync(p)) return false;
  writeFileSync(p, body, 'utf8');
  return true;
}

export function existsAndNonEmpty(p: string): boolean {
  return existsSync(p) && readdirSync(p).length > 0;
}

/**
 * Like {@link existsAndNonEmpty}, but treats a set of "known-managed"
 * child names as if they weren't there. Used by `superspecs init` so
 * that the `archive/` subfolder it creates on a prior run doesn't make
 * `changes/` look "user-populated" on the next idempotent run.
 */
export function existsAndNonEmptyExcept(p: string, ignored: string[]): boolean {
  if (!existsSync(p)) return false;
  const filter = new Set(ignored);
  return readdirSync(p).some((n) => !filter.has(n));
}
