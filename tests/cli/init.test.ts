import { describe, it, expect, beforeAll } from 'vitest';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const CLI = resolve('dist/superspecs.js');

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

describe('init subcommand', () => {
  beforeAll(() => {
    execFileSync('npm', ['run', 'build'], { stdio: 'inherit', shell: true });
  });

  it('scenario: init in an empty directory', () => {
    // GIVEN the current directory contains no openspec/ folder
    const dir = mkdtempSync(join(tmpdir(), 'spx-init-empty-'));
    // WHEN the user runs `superspecs init`
    const r = run(dir, ['init']);
    // THEN the four artefacts exist and the process exits 0
    expect(r.status).toBe(0);
    expect(existsSync(join(dir, 'openspec', 'specs'))).toBe(true);
    expect(existsSync(join(dir, 'openspec', 'changes'))).toBe(true);
    expect(existsSync(join(dir, 'openspec', 'changes', 'archive'))).toBe(true);
    expect(existsSync(join(dir, 'openspec', 'README.md'))).toBe(true);
  });

  it('scenario: init is idempotent', () => {
    // GIVEN init has already been run successfully and the folders are empty
    const dir = mkdtempSync(join(tmpdir(), 'spx-init-idem-'));
    expect(run(dir, ['init']).status).toBe(0);
    // WHEN the user runs init a second time
    const r2 = run(dir, ['init']);
    // THEN no error and exit 0
    expect(r2.status).toBe(0);
  });

  it('scenario: init refuses to clobber', () => {
    // GIVEN openspec/changes/ exists and contains a non-empty change folder
    const dir = mkdtempSync(join(tmpdir(), 'spx-init-clobber-'));
    mkdirSync(join(dir, 'openspec', 'changes', 'my-change'), { recursive: true });
    writeFileSync(join(dir, 'openspec', 'changes', 'my-change', 'proposal.md'), '# x\n');
    // WHEN the user runs init without --force
    const r = run(dir, ['init']);
    // THEN exit non-zero with a message naming the existing folder and --force
    expect(r.status).not.toBe(0);
    expect(r.stderr).toMatch(/--force/);
  });
});
