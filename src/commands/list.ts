import { existsSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

function dirChildren(p: string): string[] {
  if (!existsSync(p)) return [];
  return readdirSync(p)
    .filter((n) => {
      try {
        return statSync(join(p, n)).isDirectory();
      } catch {
        return false;
      }
    })
    .sort();
}

export function runList(cwd: string): number {
  const root = resolve(cwd);
  const changesDir = join(root, 'openspec', 'changes');
  const archiveDir = join(changesDir, 'archive');
  const specsDir = join(root, 'openspec', 'specs');

  const inFlight = dirChildren(changesDir).filter((n) => n !== 'archive');
  const archived = dirChildren(archiveDir);
  const capabilities = dirChildren(specsDir);

  for (const n of inFlight) process.stdout.write(`C ${n}\n`);
  for (const n of archived) process.stdout.write(`A ${n}\n`);
  for (const n of capabilities) process.stdout.write(`S ${n}\n`);
  return 0;
}
