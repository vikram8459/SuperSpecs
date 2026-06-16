import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync } from 'node:fs';
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

describe('list and status subcommands', () => {
  it('scenario: list output format', () => {
    // GIVEN one in-flight change `add-foo`, one archived `2026-05-26-bar`,
    //       and one capability `cli`
    const dir = mkdtempSync(join(tmpdir(), 'spx-list-'));
    mkdirSync(join(dir, 'openspec', 'changes', 'add-foo'), { recursive: true });
    mkdirSync(join(dir, 'openspec', 'changes', 'archive', '2026-05-26-bar'), { recursive: true });
    mkdirSync(join(dir, 'openspec', 'specs', 'cli'), { recursive: true });

    // WHEN `superspecs list` runs
    const r = run(dir, ['list']);

    // THEN stdout contains exactly three lines in the expected order
    expect(r.status).toBe(0);
    expect(r.stdout).toBe('C add-foo\nA 2026-05-26-bar\nS cli\n');
  });

  it('scenario: status with no in-flight change', () => {
    // GIVEN openspec/changes/ contains only the archive/ subfolder
    const dir = mkdtempSync(join(tmpdir(), 'spx-status-empty-'));
    mkdirSync(join(dir, 'openspec', 'changes', 'archive'), { recursive: true });

    // WHEN `superspecs status` runs
    const r = run(dir, ['status']);

    // THEN stdout includes the line `No in-flight change.` and exit 0
    expect(r.status).toBe(0);
    expect(r.stdout).toContain('No in-flight change.');
  });
});
