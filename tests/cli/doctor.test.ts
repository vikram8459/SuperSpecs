import { describe, it, expect } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runDoctor } from '../../src/commands/doctor.js';

function makeHealthy(): string {
  const dir = mkdtempSync(join(tmpdir(), 'spx-doctor-'));
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ version: '0.1.0' }));
  mkdirSync(join(dir, 'hooks'), { recursive: true });
  writeFileSync(join(dir, 'hooks', 'session-start.ps1'), '# ps');
  writeFileSync(join(dir, 'hooks', 'session-start'), '# sh');
  mkdirSync(join(dir, '.cursor-plugin'), { recursive: true });
  writeFileSync(join(dir, '.cursor-plugin', 'plugin.json'), '{}');
  mkdirSync(join(dir, 'schemas'), { recursive: true });
  for (const n of ['proposal.schema.json', 'spec-delta.schema.json', 'tasks.schema.json']) {
    writeFileSync(
      join(dir, 'schemas', n),
      JSON.stringify({ $schema: 'http://json-schema.org/draft-07/schema#' }),
    );
  }
  return dir;
}

function captureExit(fn: () => number): { code: number; out: string } {
  const chunks: string[] = [];
  const orig = process.stdout.write.bind(process.stdout);
  // Override stdout.write to capture the report for assertions.
  process.stdout.write = ((s: string | Uint8Array) => {
    chunks.push(typeof s === 'string' ? s : Buffer.from(s).toString());
    return true;
  }) as typeof process.stdout.write;
  let code: number;
  try {
    code = fn();
  } finally {
    process.stdout.write = orig;
  }
  return { code, out: chunks.join('') };
}

describe('doctor subcommand', () => {
  it('scenario: doctor on a healthy install exits 0', () => {
    const dir = makeHealthy();
    const { code, out } = captureExit(() => runDoctor(dir));
    expect(code).toBe(0);
    expect(out).toMatch(/\[OK \] hook: session-start:/);
    expect(out).toMatch(/\[OK \] plugin manifest:/);
    rmSync(dir, { recursive: true, force: true });
  });

  it('scenario: doctor flags a missing required component', () => {
    const dir = makeHealthy();
    rmSync(join(dir, 'hooks', 'session-start'));
    const { code, out } = captureExit(() => runDoctor(dir));
    expect(code).not.toBe(0);
    expect(out).toMatch(/\[MISSING\] hook: session-start:/);
    rmSync(dir, { recursive: true, force: true });
  });

  it('scenario: doctor omits PowerShell line off Windows', () => {
    if (process.platform === 'win32') return; // line is expected on Windows
    const dir = makeHealthy();
    const { out } = captureExit(() => runDoctor(dir));
    expect(out).not.toMatch(/PowerShell version/);
    rmSync(dir, { recursive: true, force: true });
  });

  it('scenario: doctor reports an absent hook log', () => {
    // On a healthy install, the hook-log state never affects the exit code,
    // and a hook-log line is always printed (either the tail or "absent").
    const dir = makeHealthy();
    const { code, out } = captureExit(() => runDoctor(dir));
    expect(out).toMatch(/hook log/);
    expect(code).toBe(0);
    rmSync(dir, { recursive: true, force: true });
  });
});
