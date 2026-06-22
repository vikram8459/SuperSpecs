import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import {
  mkdirpSafe,
  writeIfAbsent,
  existsAndNonEmpty,
  existsAndNonEmptyExcept,
  readJsonFile,
} from '../util/fs.js';
import { findRootUp } from '../util/install.js';

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
  harness?: string;
}

/**
 * Find the SuperSpecs install root by walking up from this module file
 * until we hit a directory containing both docs/harnesses.json and
 * .cursor-plugin/. Returns null if not found (e.g. installed from a
 * tarball without docs/, which shouldn't happen post-Phase D but we
 * fail gracefully).
 */
function findInstallRoot(): string | null {
  const here = dirname(fileURLToPath(import.meta.url));
  return findRootUp(here, [join('docs', 'harnesses.json'), '.cursor-plugin']);
}

interface HarnessEntry {
  name: string;
  displayName: string;
  manifest: string | null;
  hook: { type: string; config: string; envelope: string } | null;
  agentsMd: boolean;
}

function loadHarnessIndex(installRoot: string): HarnessEntry[] {
  const idxPath = join(installRoot, 'docs', 'harnesses.json');
  const idx = readJsonFile<{ harnesses: HarnessEntry[] }>(idxPath);
  return idx.harnesses;
}

/**
 * Write the manifest file(s) the named harness expects, copied from
 * the SuperSpecs install. The user can then point their harness at
 * the file we just wrote.
 *
 * Returns the list of files we created (relative to projectRoot), or
 * an error string. Manifest-only by design: we do NOT copy skills/ or
 * commands/. Users reference the SuperSpecs install for those (the
 * harness will auto-discover them once it's pointed at the manifest).
 */
function writeHarnessManifest(
  installRoot: string,
  projectRoot: string,
  harness: HarnessEntry,
  force: boolean,
): { ok: true; written: string[] } | { ok: false; error: string } {
  const written: string[] = [];

  // Manifest file (if the harness has one).
  if (harness.manifest) {
    const src = join(installRoot, harness.manifest);
    const dst = join(projectRoot, harness.manifest);
    if (!existsSync(src)) {
      return { ok: false, error: `manifest source missing in SuperSpecs install: ${src}` };
    }
    if (existsSync(dst) && !force) {
      return {
        ok: false,
        error: `${harness.manifest} already exists. Re-run with --force to overwrite.`,
      };
    }
    mkdirpSafe(dirname(dst));
    const contents = readFileSync(src, 'utf8');
    if (force || !existsSync(dst)) {
      // Raw write (not writeIfAbsent) so --force can clobber.
      writeFileSync(dst, contents, 'utf8');
      written.push(harness.manifest);
    }
  }

  // Hook config (if the harness has a SessionStart hook).
  if (harness.hook?.config) {
    const src = join(installRoot, harness.hook.config);
    const dst = join(projectRoot, harness.hook.config);
    if (existsSync(src)) {
      if (existsSync(dst) && !force) {
        return {
          ok: false,
          error: `${harness.hook.config} already exists. Re-run with --force to overwrite.`,
        };
      }
      mkdirpSafe(dirname(dst));
      const contents = readFileSync(src, 'utf8');
      writeFileSync(dst, contents, 'utf8');
      written.push(harness.hook.config);
    }
  }

  // For AGENTS.md harnesses, copy the canonical AGENTS.md.
  if (harness.agentsMd) {
    const src = join(installRoot, 'AGENTS.md');
    const dst = join(projectRoot, 'AGENTS.md');
    if (existsSync(src) && (force || !existsSync(dst))) {
      const contents = readFileSync(src, 'utf8');
      writeFileSync(dst, contents, 'utf8');
      written.push('AGENTS.md');
    }
  }

  return { ok: true, written };
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

  // --harness=<name>: also write the harness's manifest file(s).
  if (opts.harness) {
    const installRoot = findInstallRoot();
    if (!installRoot) {
      process.stderr.write(
        `init: --harness=${opts.harness} could not locate the SuperSpecs install ` +
        `(expected docs/harnesses.json beside .cursor-plugin/). The openspec/ scaffold ` +
        `was created successfully; harness manifest was NOT written.\n`,
      );
      return 1;
    }

    const harnesses = loadHarnessIndex(installRoot);
    const harness = harnesses.find((h) => h.name === opts.harness);
    if (!harness) {
      const known = harnesses.map((h) => h.name).join(', ');
      process.stderr.write(
        `init: unknown harness '${opts.harness}'. Known harnesses: ${known}.\n`,
      );
      return 1;
    }

    const result = writeHarnessManifest(installRoot, root, harness, opts.force ?? false);
    if (!result.ok) {
      process.stderr.write(`init: ${result.error}\n`);
      return 1;
    }
    if (result.written.length === 0) {
      process.stdout.write(
        `init: harness ${harness.name} (${harness.displayName}) is auto-discovered ` +
        `via AGENTS.md or has no manifest; nothing to write.\n`,
      );
    } else {
      process.stdout.write(
        `init: wired ${harness.displayName} via ${result.written.join(', ')}\n`,
      );
    }
  }

  return 0;
}
