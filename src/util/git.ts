import { execFileSync, type ExecFileSyncOptions } from 'node:child_process';

function git(args: string[], opts?: ExecFileSyncOptions): string {
  return execFileSync('git', args, { encoding: 'utf8', ...(opts ?? {}) }).toString();
}

export function gitIsClean(cwd: string): boolean {
  const status = git(['status', '--porcelain'], { cwd });
  return status.trim() === '';
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
