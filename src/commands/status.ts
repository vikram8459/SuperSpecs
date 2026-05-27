import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

export function runStatus(cwd: string): number {
  const root = resolve(cwd);
  const changesDir = join(root, 'openspec', 'changes');
  const archiveDir = join(changesDir, 'archive');

  let inFlight: { name: string; mtime: number }[] = [];
  if (existsSync(changesDir)) {
    inFlight = readdirSync(changesDir)
      .filter((n) => n !== 'archive')
      .filter((n) => {
        try {
          return statSync(join(changesDir, n)).isDirectory();
        } catch {
          return false;
        }
      })
      .map((n) => ({ name: n, mtime: statSync(join(changesDir, n)).mtimeMs }))
      .sort((a, b) => b.mtime - a.mtime);
  }

  if (inFlight.length === 0) {
    process.stdout.write('No in-flight change.\n');
  } else {
    const top = inFlight[0].name;
    process.stdout.write(`Current change: ${top}\n`);
    const tasksPath = join(changesDir, top, 'tasks.md');
    if (existsSync(tasksPath)) {
      const t = readFileSync(tasksPath, 'utf8');
      const open = (t.match(/^- \[ \]/gm) ?? []).length;
      const done = (t.match(/^- \[x\]/gm) ?? []).length;
      process.stdout.write(`Tasks: ${done} done, ${open} open\n`);
    }
  }

  if (existsSync(archiveDir)) {
    const archived = readdirSync(archiveDir)
      .filter((n) => {
        try {
          return statSync(join(archiveDir, n)).isDirectory();
        } catch {
          return false;
        }
      })
      .sort()
      .reverse();
    if (archived[0]) process.stdout.write(`Last archive: ${archived[0]}\n`);
  }
  return 0;
}
