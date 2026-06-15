import { describe, it, expect, beforeAll } from 'vitest';
import { execFileSync } from 'node:child_process';
import { cpSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const CLI = resolve('dist/superspecs.js');
const SCHEMAS_SRC = resolve('schemas');

function setup(fixtureSubdir: string): string {
  const dir = mkdtempSync(join(tmpdir(), 'spx-validate-'));
  // Copy the fixture's openspec/ tree into the temp workdir.
  cpSync(resolve('tests/fixtures', fixtureSubdir), dir, { recursive: true });
  // Copy schemas/ alongside so the CLI's path resolver finds them via
  // process.cwd() fallback (the installed-path branch in src/schema/load.ts
  // resolves to <dist>/../schemas, which lives in the SuperSpecs repo root;
  // we are running the dist from the repo root so this happens to work,
  // but copying makes the test self-contained regardless).
  cpSync(SCHEMAS_SRC, join(dir, 'schemas'), { recursive: true });
  return dir;
}

function run(cwd: string, args: string[]): { stdout: string; stderr: string; status: number } {
  try {
    const stdout = execFileSync('node', [CLI, ...args], { encoding: 'utf8', cwd });
    return { stdout, stderr: '', status: 0 };
  } catch (e: unknown) {
    const err = e as { stdout?: Buffer | string; stderr?: Buffer | string; status?: number };
    return {
      stdout: err.stdout?.toString() ?? '',
      stderr: err.stderr?.toString() ?? '',
      status: err.status ?? 1,
    };
  }
}

describe('validate subcommand', () => {
  beforeAll(() => {
    execFileSync('npm', ['run', 'build'], { stdio: 'inherit', shell: true });
  });

  it('scenario: clean change passes', () => {
    // GIVEN a well-formed change folder
    const dir = setup('validate-good');
    // WHEN superspecs validate is run on it
    const r = run(dir, ['validate', 'good-x']);
    // THEN exit 0 and "valid" report on stdout
    expect(r.status).toBe(0);
    expect(r.stdout).toMatch(/no errors/i);
  });

  it('scenario: missing scenario fails', () => {
    // GIVEN a change with a Requirement that has zero Scenario blocks
    const dir = setup('validate-missing-scenario');
    // WHEN superspecs validate is run
    const r = run(dir, ['validate', 'good-x']);
    // THEN exit non-zero and stderr matches openspec/.../spec.md:<line>:<col>: SDD001
    expect(r.status).not.toBe(0);
    expect(r.stderr).toMatch(/openspec\/changes\/good-x\/specs\/x\/spec\.md:\d+:\d+: SDD001/);
  });

  it('scenario: task without delta reference fails', () => {
    // GIVEN a tasks.md whose task bullet lacks a Spec: line
    const dir = setup('validate-task-no-ref');
    // WHEN superspecs validate is run
    const r = run(dir, ['validate', 'good-x']);
    // THEN exit non-zero and stderr matches openspec/.../tasks.md:<line>:<col>: SDD010
    expect(r.status).not.toBe(0);
    expect(r.stderr).toMatch(/openspec\/changes\/good-x\/tasks\.md:\d+:\d+: SDD010/);
  });

  it('scenario: proposal error points at the section heading line (CF-E-2)', () => {
    // GIVEN a proposal whose `## What Changes` heading (line 7) has no bullets
    const dir = setup('validate-proposal-empty-section');
    // WHEN superspecs validate is run
    const r = run(dir, ['validate', 'good-x']);
    // THEN exit non-zero AND the SDD101 error reports the heading's real
    // line (7), not the old (1,1) file-start fallback.
    expect(r.status).not.toBe(0);
    expect(r.stderr).toMatch(/openspec\/changes\/good-x\/proposal\.md:7:\d+: SDD101/);
    // Guard against regression to the (1,1) fallback for this case.
    expect(r.stderr).not.toMatch(/proposal\.md:1:1: SDD101/);
  });

  it('scenario: validate-all walks every change', () => {
    // GIVEN two change folders, one well-formed and one with a missing scenario
    const dir = setup('validate-good');
    // Copy the broken change in under a different id (bad-x).
    cpSync(
      resolve('tests/fixtures/validate-missing-scenario/openspec/changes/good-x'),
      join(dir, 'openspec', 'changes', 'bad-x'),
      { recursive: true },
    );
    // WHEN superspecs validate is run with no argument
    const r = run(dir, ['validate']);
    // THEN exit non-zero, stderr reports only the broken change's error
    expect(r.status).not.toBe(0);
    expect(r.stderr).toMatch(/bad-x/);
    // good-x must not appear on a line that also contains SDD<NNN>
    const goodXErrorLines = r.stderr
      .split('\n')
      .filter((line) => line.includes('good-x') && /SDD\d{3}/.test(line));
    expect(goodXErrorLines).toEqual([]);
  });
});
