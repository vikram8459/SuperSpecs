import { describe, it, expect, beforeEach } from 'vitest';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, writeFileSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const isWin = process.platform === 'win32';
const PS_HOOK = resolve('hooks/session-start.ps1');
const SH_HOOK = resolve('hooks/session-start');

function runHook(tempDir: string): void {
  // Point the hook's temp dir at our sandbox so we control the log file.
  const env = { ...process.env, TMPDIR: tempDir, TEMP: tempDir, TMP: tempDir };
  if (isWin) {
    execFileSync(
      'powershell',
      ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', PS_HOOK],
      { encoding: 'utf8', env },
    );
  } else {
    execFileSync('bash', [SH_HOOK], { encoding: 'utf8', env });
  }
}

describe('Hook log rotation', () => {
  let dir: string;
  let logPath: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'spx-hooklog-'));
    logPath = join(dir, 'superspecs-hook.log');
  });

  it('scenario: oversized log rotates', () => {
    // GIVEN a log already >= 1 MB
    writeFileSync(logPath, 'x'.repeat(1048576 + 10));
    // WHEN the hook runs and writes an entry
    runHook(dir);
    // THEN previous content is in .log.1 and the active log is small
    expect(existsSync(`${logPath}.1`)).toBe(true);
    expect(statSync(logPath).size).toBeLessThan(1048576);
  });

  it('scenario: small log does not rotate', () => {
    // GIVEN a small log
    writeFileSync(logPath, 'small');
    // WHEN the hook runs
    runHook(dir);
    // THEN no backup was created by this run
    expect(existsSync(`${logPath}.1`)).toBe(false);
  });
});

describe('POSIX hook logging parity', () => {
  it('scenario: POSIX hook writes a log entry', () => {
    if (isWin) return; // native-only; this scenario is exercised on POSIX CI
    const dir = mkdtempSync(join(tmpdir(), 'spx-posixlog-'));
    runHook(dir);
    expect(existsSync(join(dir, 'superspecs-hook.log'))).toBe(true);
  });

  it('scenario: POSIX hook survives unwritable log dir', () => {
    if (isWin) return;
    // Point TMPDIR at a path that cannot be written.
    const env = { ...process.env, TMPDIR: '/proc/nonexistent-spx' };
    const stdout = execFileSync('bash', [SH_HOOK], { encoding: 'utf8', env });
    expect(stdout).toContain('additional_context');
  });
});
