#!/usr/bin/env node
import { Command } from 'commander';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { toMessage } from './util/errors.js';

const here = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(
  readFileSync(join(here, '..', 'package.json'), 'utf8'),
) as { version: string };

const program = new Command();

program
  .name('superspecs')
  .description('Spec-Driven Development CLI for OpenSpec change folders.')
  .version(pkg.version, '-v, --version', 'print the package version');

program
  .command('init')
  .description('initialize openspec/ folder layout in the current directory')
  .option('-f, --force', 'overwrite non-empty content')
  .option(
    '--harness <name>',
    'also wire the named harness (cursor|claude-code|codex|opencode|gemini); see docs/harnesses.json',
  )
  .action(async (opts: { force?: boolean; harness?: string }) => {
    const { runInit } = await import('./commands/init.js');
    process.exit(runInit(process.cwd(), opts));
  });

program
  .command('validate [change-id]')
  .description('validate proposal/spec-delta/tasks against schemas')
  .option('--active', 'validate the active spec set in openspec/specs/')
  .option('--json', 'emit machine-readable JSON to stdout instead of text')
  .action(async (changeId: string | undefined, opts: { active?: boolean; json?: boolean }) => {
    const { runValidate, runValidateActive } = await import('./commands/validate.js');
    process.exit(
      opts.active
        ? runValidateActive(process.cwd(), { json: opts.json })
        : runValidate(process.cwd(), changeId, { json: opts.json }),
    );
  });

program
  .command('list')
  .description('list in-flight changes, archived changes, and capabilities')
  .option('--json', 'emit machine-readable JSON to stdout instead of text')
  .action(async (opts: { json?: boolean }) => {
    const { runList } = await import('./commands/list.js');
    process.exit(runList(process.cwd(), { json: opts.json }));
  });

program
  .command('status')
  .description('print the most recent in-flight change and task counts')
  .option('--json', 'emit machine-readable JSON to stdout instead of text')
  .action(async (opts: { json?: boolean }) => {
    const { runStatus } = await import('./commands/status.js');
    process.exit(runStatus(process.cwd(), { json: opts.json }));
  });

program
  .command('archive <change-id>')
  .description('apply spec deltas to the active spec set and archive the change')
  .option('--dry-run', 'preview the changes without writing, moving, or committing')
  .option('--undo', 'restore the active spec set from the change snapshot and un-archive')
  .action(async (changeId: string, opts: { dryRun?: boolean; undo?: boolean }) => {
    const { runArchive } = await import('./commands/archive.js');
    process.exit(runArchive(process.cwd(), changeId, opts));
  });

program
  .command('doctor')
  .description('print a health report for the local SuperSpecs install')
  .action(async () => {
    const { runDoctor } = await import('./commands/doctor.js');
    process.exit(runDoctor());
  });

program
  .command('eval [glob]')
  .description('run skill evals (replay recorded transcripts; default tests/skills/**/*.eval.json)')
  .action(async (glob?: string) => {
    const { runEval } = await import('./commands/eval.js');
    process.exit(await runEval(process.cwd(), glob));
  });

// Top-level error boundary: a command action that throws (e.g. a malformed
// user file, an unexpected fs error) should surface a single clean line and
// a non-zero exit code, not a raw Node stack trace. Commands that succeed or
// fail normally call process.exit() inside their action and never reach here.
try {
  await program.parseAsync(process.argv);
} catch (err) {
  process.stderr.write(`superspecs: ${toMessage(err)}\n`);
  process.exit(1);
}
