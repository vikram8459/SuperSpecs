import { existsSync, readFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { REQUIRED_SCHEMA_FILES, SCHEMA_FILES } from '../schema/load.js';
import { findRootUp } from '../util/install.js';

/** Number of trailing hook-log lines surfaced by `doctor`. */
const HOOK_LOG_TAIL_LINES = 20;
/** Accepted values for the SUPERSPECS_MODE knob. */
const VALID_MODES = ['strict', 'auto', 'manual'];

function pluginRoot(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  // dist/commands/doctor.js -> repo root is the nearest ancestor with a
  // package.json (two levels up in the normal layout).
  return findRootUp(here, ['package.json']) ?? process.cwd();
}

interface Check {
  label: string;
  ok: boolean;
  detail: string;
  required: boolean;
}

function schemaDraft(path: string): string {
  try {
    const j = JSON.parse(readFileSync(path, 'utf8')) as { $schema?: string };
    return j.$schema ?? 'no $schema';
  } catch {
    return 'unreadable';
  }
}

function hookLogTail(): string {
  const logPath = join(tmpdir(), 'superspecs-hook.log');
  if (!existsSync(logPath)) return 'hook log: absent';
  const lines = readFileSync(logPath, 'utf8').split(/\r?\n/).filter(Boolean);
  return [`hook log (last ${HOOK_LOG_TAIL_LINES} lines):`, ...lines.slice(-HOOK_LOG_TAIL_LINES)].join('\n');
}

function powershellVersion(): string | null {
  if (process.platform !== 'win32') return null;
  try {
    const out = execFileSync(
      'powershell',
      ['-NoProfile', '-Command', '$PSVersionTable.PSVersion.ToString()'],
      { encoding: 'utf8' },
    ).trim();
    return `PowerShell version: ${out}`;
  } catch {
    return 'PowerShell version: unavailable';
  }
}

export function runDoctor(root?: string): number {
  const base = root ? resolve(root) : pluginRoot();

  const pkgPath = join(base, 'package.json');
  const version = existsSync(pkgPath)
    ? (JSON.parse(readFileSync(pkgPath, 'utf8')) as { version?: string }).version ?? 'unknown'
    : 'unknown';

  // SUPERSPECS_MODE: report the effective triggering posture and flag an
  // unrecognized value. Informational only (required: false) — it never
  // changes the exit code, but it surfaces typos like SUPERSPECS_MODE=stict
  // that would otherwise silently fall back to auto.
  const rawMode = process.env.SUPERSPECS_MODE;
  const modeKnown = rawMode === undefined || VALID_MODES.includes(rawMode);
  const modeDetail =
    rawMode === undefined
      ? 'auto (default; SUPERSPECS_MODE unset)'
      : modeKnown
        ? rawMode
        : `unrecognized "${rawMode}" (expected strict|auto|manual; falling back to auto)`;

  const checks: Check[] = [
    { label: 'CLI version', ok: version !== 'unknown', detail: version, required: false },
    { label: 'SUPERSPECS_MODE', ok: modeKnown, detail: modeDetail, required: false },
    {
      label: 'hook: session-start.ps1',
      ok: existsSync(join(base, 'hooks', 'session-start.ps1')),
      detail: 'hooks/session-start.ps1',
      required: true,
    },
    {
      label: 'hook: session-start',
      ok: existsSync(join(base, 'hooks', 'session-start')),
      detail: 'hooks/session-start',
      required: true,
    },
    {
      label: 'plugin manifest',
      ok: existsSync(join(base, '.cursor-plugin', 'plugin.json')),
      detail: '.cursor-plugin/plugin.json',
      required: true,
    },
  ];

  // The core schemas are required (validate depends on them).
  for (const name of REQUIRED_SCHEMA_FILES) {
    const p = join(base, 'schemas', name);
    const ok = existsSync(p);
    checks.push({
      label: `schema: ${name}`,
      ok,
      detail: ok ? schemaDraft(p) : 'missing',
      required: true,
    });
  }

  // skill-eval.schema.json is only needed by `superspecs eval`, not by
  // core validate, so it is reported but does not fail the exit code.
  // Surfacing it here means a missing eval schema is visible in `doctor`
  // rather than only blowing up at eval time (schema/load.ts requires it).
  {
    const p = join(base, 'schemas', SCHEMA_FILES.skillEval);
    const ok = existsSync(p);
    checks.push({
      label: `schema: ${SCHEMA_FILES.skillEval}`,
      ok,
      detail: ok ? schemaDraft(p) : 'missing (needed by `superspecs eval`)',
      required: false,
    });
  }

  for (const c of checks) {
    const mark = c.ok ? 'OK ' : 'MISSING';
    process.stdout.write(`[${mark}] ${c.label}: ${c.detail}\n`);
  }

  const ps = powershellVersion();
  if (ps) process.stdout.write(ps + '\n');

  process.stdout.write(hookLogTail() + '\n');

  const missingRequired = checks.some((c) => c.required && !c.ok);
  return missingRequired ? 1 : 0;
}
