import { existsSync, readFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';

function pluginRoot(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  // dist/commands/doctor.js -> repo root is two levels up from dist/commands.
  const candidate = resolve(here, '..', '..');
  if (existsSync(join(candidate, 'package.json'))) return candidate;
  return process.cwd();
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
  return ['hook log (last 20 lines):', ...lines.slice(-20)].join('\n');
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

  const checks: Check[] = [
    { label: 'CLI version', ok: version !== 'unknown', detail: version, required: false },
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

  for (const name of ['proposal.schema.json', 'spec-delta.schema.json', 'tasks.schema.json']) {
    const p = join(base, 'schemas', name);
    const ok = existsSync(p);
    checks.push({
      label: `schema: ${name}`,
      ok,
      detail: ok ? schemaDraft(p) : 'missing',
      required: true,
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
