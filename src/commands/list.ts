import { listInFlightChanges, listArchived, listCapabilities } from '../util/openspec.js';

/** Single-character row prefixes emitted by `superspecs list`. */
const PREFIX_CHANGE = 'C';
const PREFIX_ARCHIVE = 'A';
const PREFIX_CAPABILITY = 'S';

export interface ListOptions {
  json?: boolean;
}

export function runList(cwd: string, opts: ListOptions = {}): number {
  const changes = listInFlightChanges(cwd);
  const archived = listArchived(cwd);
  const capabilities = listCapabilities(cwd);

  if (opts.json) {
    process.stdout.write(JSON.stringify({ changes, archived, capabilities }, null, 2) + '\n');
    return 0;
  }

  for (const n of changes) process.stdout.write(`${PREFIX_CHANGE} ${n}\n`);
  for (const n of archived) process.stdout.write(`${PREFIX_ARCHIVE} ${n}\n`);
  for (const n of capabilities) process.stdout.write(`${PREFIX_CAPABILITY} ${n}\n`);
  return 0;
}
