import { describe, it, expect, beforeAll } from 'vitest';
import { execFileSync } from 'node:child_process';
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const CLI = resolve('dist/superspecs.js');
const SCHEMAS = resolve('schemas');

function initRepo(): string {
  const dir = mkdtempSync(join(tmpdir(), 'spx-arch-'));
  execFileSync('git', ['init', '-q', '-b', 'main'], { cwd: dir });
  execFileSync('git', ['config', 'user.email', 't@e.com'], { cwd: dir });
  execFileSync('git', ['config', 'user.name', 'T'], { cwd: dir });
  cpSync(SCHEMAS, join(dir, 'schemas'), { recursive: true });
  return dir;
}

function commitAll(dir: string, msg: string): void {
  execFileSync('git', ['add', '-A'], { cwd: dir });
  execFileSync('git', ['commit', '-q', '-m', msg], { cwd: dir });
}

function seedChange(dir: string, id: string, cap: string, reqName: string): void {
  mkdirSync(join(dir, 'openspec', 'specs', cap), { recursive: true });
  writeFileSync(join(dir, 'openspec', 'specs', cap, 'spec.md'), `# ${cap}\n`);
  const cdir = join(dir, 'openspec', 'changes', id, 'specs', cap);
  mkdirSync(cdir, { recursive: true });
  writeFileSync(
    join(cdir, 'spec.md'),
    `# ${cap} — delta for ${id}\n\n## ADDED Requirements\n\n### Requirement: ${reqName}\nBody.\n\n#### Scenario: s\n- **GIVEN** g\n- **WHEN** w\n- **THEN** t\n`,
  );
}

function run(cwd: string, args: string[]): { stdout: string; stderr: string; status: number } {
  try {
    return { stdout: execFileSync('node', [CLI, ...args], { encoding: 'utf8', cwd }), stderr: '', status: 0 };
  } catch (e: unknown) {
    const x = e as { stdout?: Buffer | string; stderr?: Buffer | string; status?: number };
    return { stdout: x.stdout?.toString() ?? '', stderr: x.stderr?.toString() ?? '', status: x.status ?? 1 };
  }
}

// Exported helpers reused by later-task describe blocks in this file.
export { initRepo, commitAll, seedChange, run };

describe('archive dry-run', () => {
  beforeAll(() => execFileSync('npm', ['run', 'build'], { stdio: 'inherit', shell: true }));

  it('scenario: dry-run previews without writing', () => {
    const dir = initRepo();
    seedChange(dir, 'add-x', 'cli', 'New Thing');
    commitAll(dir, 'seed');
    const before = readFileSync(join(dir, 'openspec', 'specs', 'cli', 'spec.md'), 'utf8');
    const r = run(dir, ['archive', 'add-x', '--dry-run']);
    expect(r.status).toBe(0);
    expect(r.stdout).toMatch(/ADDED New Thing/);
    expect(readFileSync(join(dir, 'openspec', 'specs', 'cli', 'spec.md'), 'utf8')).toBe(before);
    expect(existsSync(join(dir, 'openspec', 'changes', 'add-x'))).toBe(true);
    const log = execFileSync('git', ['log', '--oneline'], { cwd: dir, encoding: 'utf8' });
    expect(log).not.toMatch(/archive: add-x/);
  });
});

describe('archive snapshot before write', () => {
  it('scenario: snapshot captured before modification', () => {
    const dir = initRepo();
    seedChange(dir, 'add-x', 'cli', 'New Thing');
    commitAll(dir, 'seed');
    const before = readFileSync(join(dir, 'openspec', 'specs', 'cli', 'spec.md'), 'utf8');
    const r = run(dir, ['archive', 'add-x']);
    expect(r.status).toBe(0);
    const snap = join(dir, 'openspec', '.snapshots', 'add-x', 'cli', 'spec.md');
    expect(existsSync(snap)).toBe(true);
    expect(readFileSync(snap, 'utf8')).toBe(before);
  });

  it('scenario: snapshots directory is gitignored', () => {
    const gi = readFileSync(resolve('.gitignore'), 'utf8');
    expect(gi).toMatch(/openspec\/\.snapshots\//);
  });
});

describe('active spec validation', () => {
  it('scenario: clean active set validates', () => {
    const dir = initRepo();
    seedChange(dir, 'add-x', 'cli', 'New Thing');
    commitAll(dir, 'seed');
    expect(run(dir, ['validate', '--active']).status).toBe(0);
  });

  it('scenario: duplicate requirement name fails active validation', () => {
    const dir = initRepo();
    mkdirSync(join(dir, 'openspec', 'specs', 'cli'), { recursive: true });
    writeFileSync(
      join(dir, 'openspec', 'specs', 'cli', 'spec.md'),
      `# cli\n\n### Requirement: Dup\nb\n\n#### Scenario: s\n- **GIVEN** g\n- **WHEN** w\n- **THEN** t\n\n### Requirement: Dup\nb2\n\n#### Scenario: s2\n- **GIVEN** g\n- **WHEN** w\n- **THEN** t\n`,
    );
    const r = run(dir, ['validate', '--active']);
    expect(r.status).not.toBe(0);
    expect(r.stderr).toMatch(/duplicate requirement name "Dup"/);
  });

  it('scenario: archive refuses to corrupt the active set', () => {
    const dir = initRepo();
    mkdirSync(join(dir, 'openspec', 'specs', 'cli'), { recursive: true });
    writeFileSync(
      join(dir, 'openspec', 'specs', 'cli', 'spec.md'),
      `# cli\n\n### Requirement: New Thing\nb\n\n#### Scenario: s\n- **GIVEN** g\n- **WHEN** w\n- **THEN** t\n`,
    );
    const cdir = join(dir, 'openspec', 'changes', 'add-x', 'specs', 'cli');
    mkdirSync(cdir, { recursive: true });
    writeFileSync(
      join(cdir, 'spec.md'),
      `# cli — delta for add-x\n\n## ADDED Requirements\n\n### Requirement: New Thing\nb\n\n#### Scenario: s\n- **GIVEN** g\n- **WHEN** w\n- **THEN** t\n`,
    );
    commitAll(dir, 'seed');
    const before = readFileSync(join(dir, 'openspec', 'specs', 'cli', 'spec.md'), 'utf8');
    const r = run(dir, ['archive', 'add-x']);
    expect(r.status).not.toBe(0);
    expect(readFileSync(join(dir, 'openspec', 'specs', 'cli', 'spec.md'), 'utf8')).toBe(before);
    expect(existsSync(join(dir, 'openspec', 'changes', 'add-x'))).toBe(true);
  });
});
