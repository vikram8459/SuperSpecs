import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { openspecPaths, listInFlightChanges, listArchived } from '../util/openspec.js';

/**
 * Count GitHub-style task checkboxes in a tasks.md body. Returns the number
 * of open (`- [ ]`) and done (`- [x]`/`- [X]`) items. This counts checkbox
 * state, which is intentionally distinct from `parseTasks` (which models
 * fully-specified tasks with Spec:/Files: lines and carries no done/open
 * state), so the two are not interchangeable.
 */
export function countCheckboxes(body: string): { open: number; done: number } {
  return {
    open: (body.match(/^- \[ \]/gm) ?? []).length,
    done: (body.match(/^- \[[xX]\]/gm) ?? []).length,
  };
}

/**
 * mtime in ms for `p`, or 0 if it can't be stat-ed. Mirrors the defensive
 * pattern in `listChildDirs`: a change folder removed between the directory
 * listing and this stat (a concurrency race) must not crash `status`.
 */
function safeMtimeMs(p: string): number {
  try {
    return statSync(p).mtimeMs;
  } catch {
    return 0;
  }
}

export interface StatusOptions {
  json?: boolean;
}

export function runStatus(cwd: string, opts: StatusOptions = {}): number {
  const paths = openspecPaths(cwd);

  const inFlight = listInFlightChanges(cwd)
    .map((name) => ({ name, mtime: safeMtimeMs(join(paths.changes, name)) }))
    .sort((a, b) => b.mtime - a.mtime);

  const first = inFlight[0];
  const top = first?.name ?? null;
  let tasks: { done: number; open: number } | null = null;
  if (top) {
    const tasksPath = join(paths.changes, top, 'tasks.md');
    if (existsSync(tasksPath)) {
      tasks = countCheckboxes(readFileSync(tasksPath, 'utf8'));
    }
  }

  const archived = listArchived(cwd);
  const last = archived[archived.length - 1] ?? null;

  if (opts.json) {
    process.stdout.write(
      JSON.stringify({ current: top, tasks, lastArchive: last }, null, 2) + '\n',
    );
    return 0;
  }

  if (!top) {
    process.stdout.write('No in-flight change.\n');
  } else {
    process.stdout.write(`Current change: ${top}\n`);
    if (tasks) {
      process.stdout.write(`Tasks: ${tasks.done} done, ${tasks.open} open\n`);
    }
  }
  if (last) process.stdout.write(`Last archive: ${last}\n`);
  return 0;
}
