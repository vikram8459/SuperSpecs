#!/usr/bin/env node
import { Command } from 'commander';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

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
  .action(async (opts: { force?: boolean }) => {
    const { runInit } = await import('./commands/init.js');
    process.exit(runInit(process.cwd(), opts));
  });

program
  .command('validate [change-id]')
  .description('validate proposal/spec-delta/tasks against schemas')
  .option('--active', 'validate the active spec set in openspec/specs/')
  .action(async (changeId: string | undefined, opts: { active?: boolean }) => {
    if (opts.active) {
      const { runValidateActive } = await import('./commands/validate.js');
      process.exit(runValidateActive(process.cwd()));
    }
    const { runValidate } = await import('./commands/validate.js');
    process.exit(runValidate(process.cwd(), changeId));
  });

program
  .command('list')
  .description('list in-flight changes, archived changes, and capabilities')
  .action(async () => {
    const { runList } = await import('./commands/list.js');
    process.exit(runList(process.cwd()));
  });

program
  .command('status')
  .description('print the most recent in-flight change and task counts')
  .action(async () => {
    const { runStatus } = await import('./commands/status.js');
    process.exit(runStatus(process.cwd()));
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

await program.parseAsync(process.argv);
