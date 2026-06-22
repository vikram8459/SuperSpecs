import { listInFlightChanges, listArchived, listCapabilities } from '../util/openspec.js';

/** Single-character row prefixes emitted by `superspecs list`. */
const PREFIX_CHANGE = 'C';
const PREFIX_ARCHIVE = 'A';
const PREFIX_CAPABILITY = 'S';

export function runList(cwd: string): number {
  for (const n of listInFlightChanges(cwd)) process.stdout.write(`${PREFIX_CHANGE} ${n}\n`);
  for (const n of listArchived(cwd)) process.stdout.write(`${PREFIX_ARCHIVE} ${n}\n`);
  for (const n of listCapabilities(cwd)) process.stdout.write(`${PREFIX_CAPABILITY} ${n}\n`);
  return 0;
}
