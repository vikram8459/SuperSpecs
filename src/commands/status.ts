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

export function runStatus(cwd: string): number {
  const paths = openspecPaths(cwd);

  const inFlight = listInFlightChanges(cwd)
    .map((name) => ({ name, mtime: statSync(join(paths.changes, name)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime);

  const first = inFlight[0];
  if (!first) {
    process.stdout.write('No in-flight change.\n');
  } else {
    const top = first.name;
    process.stdout.write(`Current change: ${top}\n`);
    const tasksPath = join(paths.changes, top, 'tasks.md');
    if (existsSync(tasksPath)) {
      const { open, done } = countCheckboxes(readFileSync(tasksPath, 'utf8'));
      process.stdout.write(`Tasks: ${done} done, ${open} open\n`);
    }
  }

  const archived = listArchived(cwd);
  const last = archived[archived.length - 1];
  if (last) process.stdout.write(`Last archive: ${last}\n`);
  return 0;
}
