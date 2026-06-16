import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const CLI = resolve('dist/superspecs.js');
const PKG = JSON.parse(readFileSync('package.json', 'utf8')) as { version: string };

function run(args: string[]): { stdout: string; stderr: string; status: number } {
  try {
    const stdout = execFileSync('node', [CLI, ...args], { encoding: 'utf8' });
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

describe('Runtime and Entry Point', () => {
  it('version flag scenario: prints version from package.json and exits 0', () => {
    // GIVEN the package is built and installed
    // WHEN  the user runs `superspecs --version`
    // THEN  stdout contains the exact version from package.json and exit 0
    const r = run(['--version']);
    expect(r.status).toBe(0);
    expect(r.stdout).toContain(PKG.version);
    expect(r.stdout.endsWith('\n')).toBe(true);
  });

  it('help flag scenario: lists the five subcommands and exits 0', () => {
    // GIVEN the package is built and installed
    // WHEN  the user runs `superspecs --help`
    // THEN  stdout lists init/validate/list/status/archive with descriptions
    const r = run(['--help']);
    expect(r.status).toBe(0);
    for (const cmd of ['init', 'validate', 'list', 'status', 'archive']) {
      expect(r.stdout).toContain(cmd);
    }
  });
});
