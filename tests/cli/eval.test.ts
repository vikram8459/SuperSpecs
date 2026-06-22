import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { cpSync, mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const CLI = resolve('dist/superspecs.js');
const SCHEMAS = resolve('schemas');

function corpus(): string {
  const dir = mkdtempSync(join(tmpdir(), 'spx-eval-'));
  cpSync(SCHEMAS, join(dir, 'schemas'), { recursive: true });
  mkdirSync(join(dir, 'tests', 'skills', 's'), { recursive: true });
  writeFileSync(
    join(dir, 'tests', 'skills', 's', 'ok.transcript.md'),
    'the spec is the source of truth\n',
  );
  return dir;
}

function writeEval(dir: string, name: string, obj: unknown): void {
  writeFileSync(join(dir, 'tests', 'skills', 's', name), JSON.stringify(obj));
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

const good = {
  skill: 's',
  scenario: 'x',
  expected: 'y',
  assertions: [{ kind: 'contains', value: 'source of truth' }],
  transcript: 'tests/skills/s/ok.transcript.md',
};

describe('eval subcommand', () => {
  it('scenario: eval command passes on a healthy corpus', () => {
    const dir = corpus();
    writeEval(dir, 'a.eval.json', good);
    const r = run(dir, ['eval']);
    expect(r.status).toBe(0);
    expect(r.stdout).toMatch(/\[PASS\]/);
  });

  it('scenario: eval command fails on a broken transcript', () => {
    const dir = corpus();
    writeEval(dir, 'a.eval.json', {
      ...good,
      assertions: [{ kind: 'not-contains', value: 'source of truth' }],
    });
    const r = run(dir, ['eval']);
    expect(r.status).not.toBe(0);
    expect(r.stderr).toMatch(/\[FAIL\]/);
  });

  it('scenario: eval command rejects a malformed eval file', () => {
    const dir = corpus();
    writeEval(dir, 'a.eval.json', { ...good, assertions: [] });
    const r = run(dir, ['eval']);
    expect(r.status).not.toBe(0);
    expect(r.stderr).toMatch(/\[INVALID\].*a\.eval\.json/);
  });

  it('scenario: syntactically broken JSON yields a clean file-attributed error, not a stack trace', () => {
    // GIVEN an eval file that is not valid JSON at all
    const dir = corpus();
    writeFileSync(join(dir, 'tests', 'skills', 's', 'a.eval.json'), '{ not json,, }');

    // WHEN eval runs
    const r = run(dir, ['eval']);

    // THEN it exits non-zero with a single [INVALID] line naming the file and
    //      "invalid JSON" — and never prints a raw Node stack trace.
    expect(r.status).not.toBe(0);
    expect(r.stderr).toMatch(/\[INVALID\].*a\.eval\.json: invalid JSON/);
    expect(r.stderr).not.toMatch(/at Object\.|node:internal|SyntaxError:.*\n\s+at /);
  });
});
