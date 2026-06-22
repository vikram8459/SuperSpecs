import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { toMessage } from './errors.js';

/**
 * Read and parse a JSON file, turning a parse failure into a clean,
 * file-attributed Error instead of a bare `SyntaxError: Unexpected token`
 * with no path. Callers that read user-controlled JSON should use this so
 * the top-level error boundary can print an actionable single-line message.
 */
export function readJsonFile<T = unknown>(path: string): T {
  const raw = readFileSync(path, 'utf8');
  try {
    return JSON.parse(raw) as T;
  } catch (err) {
    const reason = toMessage(err);
    const posix = path.replace(/\\/g, '/');
    throw new Error(`${posix}: invalid JSON: ${reason}`);
  }
}

export function mkdirpSafe(p: string): void {
  if (!existsSync(p)) {
    mkdirSync(p, { recursive: true });
  }
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
