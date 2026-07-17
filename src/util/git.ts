import { execFileSync, type ExecFileSyncOptions } from 'node:child_process';
import { toMessage } from './errors.js';
import { toPosix } from './fs.js';

/**
 * Upper bound on captured git output. `execFileSync` defaults to 1 MiB and
 * throws ENOBUFS past it; `git status --porcelain` in a very large/dirty
 * tree can exceed that, so we raise the ceiling to 64 MiB.
 */
const GIT_MAX_BUFFER = 64 * 1024 * 1024;

/**
 * Wall-clock limit for a single git invocation. Without it, a git command
 * that blocks on an interactive prompt (credential/GPG helper) or a held
 * index lock would hang the CLI forever — worst on the data-mutating
 * archive/`--undo` paths. On timeout, Node kills the child and throws.
 */
const GIT_TIMEOUT_MS = 30_000;

function git(args: string[], opts?: ExecFileSyncOptions): string {
  try {
    return execFileSync('git', args, {
      encoding: 'utf8',
      maxBuffer: GIT_MAX_BUFFER,
      timeout: GIT_TIMEOUT_MS,
      ...(opts ?? {}),
    }).toString();
  } catch (err) {
    // A timeout surfaces as an error carrying `killed: true` and/or
    // `signal: 'SIGTERM'`; rewrite it into an actionable message instead of
    // a raw child_process dump. Other git failures propagate unchanged so
    // callers that inspect stderr (e.g. headIsArchiveOf) still work.
    const e = err as NodeJS.ErrnoException & { killed?: boolean; signal?: string };
    if (e?.killed && (e.signal === 'SIGTERM' || e.code === 'ETIMEDOUT')) {
      throw new Error(
        `git ${args[0] ?? ''} timed out after ${GIT_TIMEOUT_MS} ms ` +
          `(a credential/GPG prompt or a held index lock can cause this): ${toMessage(err)}`,
        { cause: err },
      );
    }
    throw err;
  }
}

export function gitIsClean(cwd: string): boolean {
  const status = git(['status', '--porcelain'], { cwd });
  return status.trim() === '';
}

/**
 * Return true if the working tree has any uncommitted change to a path
 * OUTSIDE the `openspec/` tree. Used by `archive --undo` to tell apart a
 * recoverable half-archive (only `openspec/` paths are dirty) from
 * unrelated work that undo must not clobber. `git status --porcelain`
 * lines look like `XY <path>` (with a possible `orig -> new` for renames);
 * we read the post-rename path after the status code.
 */
export function hasDirtyChangesOutside(cwd: string, prefix: string): boolean {
  const status = git(['status', '--porcelain'], { cwd });
  const norm = toPosix(prefix).replace(/\/+$/, '') + '/';
  return status
    .split('\n')
    .map((l) => l.trimEnd())
    .filter(Boolean)
    .some((line) => {
      const rest = line.slice(3);
      const path = toPosix(
        (rest.includes(' -> ') ? (rest.split(' -> ')[1] ?? rest) : rest).replace(/^"|"$/g, ''),
      );
      return !path.startsWith(norm);
    });
}

export function gitAddAll(cwd: string): void {
  git(['add', '-A'], { cwd });
}

export function gitCommit(
  cwd: string,
  subject: string,
  trailers: Record<string, string>,
): void {
  const lines = [subject];
  const trailerEntries = Object.entries(trailers);
  if (trailerEntries.length > 0) {
    lines.push('');
    for (const [k, v] of trailerEntries) lines.push(`${k}: ${v}`);
  }
  git(['commit', '-m', lines.join('\n')], { cwd });
}

/**
 * Return true if the HEAD commit archives `changeId` (i.e. its message body
 * carries the `Archive-Of: <changeId>` trailer written by `gitCommit`).
 *
 * Returns false for the EXPECTED "no HEAD" cases (empty repo / not a git
 * repo / unborn branch) so callers can treat a fresh repo as simply "not an
 * archive". Any OTHER git failure is rethrown rather than silently swallowed,
 * so a genuine fault (e.g. a corrupt object store) is not misreported as a
 * clean "not an archive".
 */
export function headIsArchiveOf(cwd: string, changeId: string): boolean {
  try {
    const body = git(['log', '-1', '--format=%B'], { cwd });
    return new RegExp(`^Archive-Of:\\s*${escapeRegExp(changeId)}\\s*$`, 'm').test(body);
  } catch (err) {
    if (isNoHeadError(err)) return false;
    throw err;
  }
}

/**
 * Recognize the family of git errors that mean "there is no commit to read"
 * (empty repository, unborn HEAD, or not a repository) as opposed to a real
 * failure.
 */
function isNoHeadError(err: unknown): boolean {
  const text = [
    err instanceof Error ? err.message : String(err),
    // execFileSync attaches captured stderr on the thrown error.
    (err as { stderr?: Buffer | string } | null)?.stderr?.toString() ?? '',
  ]
    .join('\n')
    .toLowerCase();
  return (
    text.includes('does not have any commits yet') ||
    text.includes('unknown revision') ||
    text.includes('ambiguous argument') ||
    text.includes('not a git repository') ||
    text.includes('bad default revision')
  );
}

/** Soft-reset HEAD by one commit, keeping the working tree changes staged-out. */
export function gitResetSoftHead1(cwd: string): void {
  git(['reset', '--soft', 'HEAD~1'], { cwd });
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
