import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

const isWin = process.platform === 'win32';
const PS_HOOK = resolve('hooks/session-start.ps1');
const SH_HOOK = resolve('hooks/session-start');

function runNativeHook(env: NodeJS.ProcessEnv): { stdout: string; status: number } {
  try {
    const stdout = isWin
      ? execFileSync(
          'powershell',
          ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', PS_HOOK],
          { encoding: 'utf8', env },
        )
      : execFileSync('bash', [SH_HOOK], { encoding: 'utf8', env });
    return { stdout, status: 0 };
  } catch (e: unknown) {
    const err = e as { stdout?: Buffer | string; status?: number };
    return { stdout: err.stdout?.toString() ?? '', status: err.status ?? 1 };
  }
}

describe('Session disable switch', () => {
  it('scenario: disable set to 1 emits empty envelope', () => {
    // GIVEN SUPERSPECS_DISABLE=1
    const r = runNativeHook({ ...process.env, SUPERSPECS_DISABLE: '1' });
    // WHEN the hook runs
    // THEN stdout is {"additional_context": ""} and exit 0
    expect(r.status).toBe(0);
    expect(JSON.parse(r.stdout)).toEqual({ additional_context: '' });
  });

  it('scenario: disable unset loads the skill', () => {
    // GIVEN SUPERSPECS_DISABLE unset
    const env = { ...process.env };
    delete env.SUPERSPECS_DISABLE;
    // WHEN the hook runs
    const r = runNativeHook(env);
    // THEN the wrapped skill is emitted
    expect(r.status).toBe(0);
    expect(r.stdout).toContain('EXTREMELY_IMPORTANT');
  });

  it('scenario: disable set to other value loads the skill', () => {
    // GIVEN SUPERSPECS_DISABLE=0 (not the disabling value)
    const r = runNativeHook({ ...process.env, SUPERSPECS_DISABLE: '0' });
    // WHEN the hook runs
    // THEN the skill loads normally
    expect(r.status).toBe(0);
    expect(r.stdout).toContain('EXTREMELY_IMPORTANT');
  });
});
