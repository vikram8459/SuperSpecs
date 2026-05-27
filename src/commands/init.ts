import { join, resolve } from 'node:path';
import {
  mkdirpSafe,
  writeIfAbsent,
  existsAndNonEmpty,
  existsAndNonEmptyExcept,
} from '../util/fs.js';

const README_BODY = `# OpenSpec workspace

This folder is managed by the \`superspecs\` CLI. It contains:

- \`specs/\` — the active spec set (source of truth post-archive).
- \`changes/\` — in-flight OpenSpec change folders.
- \`changes/archive/\` — archived changes (date-prefixed).

See \`docs/architecture.md\` and \`docs/openspec-walkthrough.md\` for
the full lifecycle. The \`superspecs\` CLI verbs that operate on this
folder: \`init\`, \`validate\`, \`list\`, \`status\`, \`archive\`.
`;

export interface InitOptions {
  force?: boolean;
}

export function runInit(cwd: string, opts: InitOptions): number {
  const root = resolve(cwd);
  const specs = join(root, 'openspec', 'specs');
  const changes = join(root, 'openspec', 'changes');
  const archive = join(root, 'openspec', 'changes', 'archive');
  const readme = join(root, 'openspec', 'README.md');

  if (!opts.force) {
    // `changes/` is allowed to contain the `archive/` subfolder we
    // create ourselves; only user-authored siblings count as clobber.
    if (existsAndNonEmptyExcept(changes, ['archive'])) {
      process.stderr.write(
        `init: ${changes} exists and is not empty. Re-run with --force to overwrite.\n`,
      );
      return 1;
    }
    if (existsAndNonEmpty(specs)) {
      process.stderr.write(
        `init: ${specs} exists and is not empty. Re-run with --force to overwrite.\n`,
      );
      return 1;
    }
  }

  mkdirpSafe(specs);
  mkdirpSafe(changes);
  mkdirpSafe(archive);
  writeIfAbsent(readme, README_BODY);

  process.stdout.write(`Initialized openspec/ at ${root}\n`);
  return 0;
}
