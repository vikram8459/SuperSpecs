import { execFileSync, type ExecFileSyncOptions } from 'node:child_process';

function git(args: string[], opts?: ExecFileSyncOptions): string {
  return execFileSync('git', args, { encoding: 'utf8', ...(opts ?? {}) }).toString();
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
  const norm = prefix.replace(/\\/g, '/').replace(/\/+$/, '') + '/';
  return status
    .split('\n')
    .map((l) => l.trimEnd())
    .filter(Boolean)
    .some((line) => {
      const rest = line.slice(3);
      const path = (rest.includes(' -> ') ? rest.split(' -> ')[1] : rest)
        .replace(/^"|"$/g, '')
        .replace(/\\/g, '/');
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
 * Returns false on any git failure (no commits yet, not a repo, etc.).
 */
export function headIsArchiveOf(cwd: string, changeId: string): boolean {
  try {
    const body = git(['log', '-1', '--format=%B'], { cwd });
    return new RegExp(`^Archive-Of:\\s*${escapeRegExp(changeId)}\\s*$`, 'm').test(body);
  } catch {
    return false;
  }
}

/** Soft-reset HEAD by one commit, keeping the working tree changes staged-out. */
export function gitResetSoftHead1(cwd: string): void {
  git(['reset', '--soft', 'HEAD~1'], { cwd });
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
