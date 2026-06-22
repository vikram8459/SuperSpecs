import { describe, it, expect } from 'vitest';
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
  // Pin line-ending handling locally so the repo's clean/dirty state does not
  // depend on the developer's global git config (e.g. core.autocrlf=true on
  // Windows would report LF-authored fixtures as modified, flaking the
  // clean-tree gate under parallel load).
  execFileSync('git', ['config', 'core.autocrlf', 'false'], { cwd: dir });
  execFileSync('git', ['config', 'core.safecrlf', 'false'], { cwd: dir });
  cpSync(SCHEMAS, join(dir, 'schemas'), { recursive: true });
  // Mirror the real repo: snapshots are local recovery state, gitignored.
  writeFileSync(join(dir, '.gitignore'), 'openspec/.snapshots/\n');
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

  it('scenario: title preceded by a blank line still strips correctly', () => {
    const dir = initRepo();
    mkdirSync(join(dir, 'openspec', 'specs', 'cli'), { recursive: true });
    // A leading blank line before the `# cli` title used to leak the title
    // into the wrapped body and mis-anchor the parser. The single valid
    // requirement should still validate cleanly.
    writeFileSync(
      join(dir, 'openspec', 'specs', 'cli', 'spec.md'),
      `\n# cli\n\n### Requirement: Only One\nb\n\n#### Scenario: s\n- **GIVEN** g\n- **WHEN** w\n- **THEN** t\n`,
    );
    const r = run(dir, ['validate', '--active']);
    expect(r.status).toBe(0);
    expect(r.stderr).not.toMatch(/SDD/);
  });

  it('scenario: a leading blank line does not mask a real duplicate', () => {
    const dir = initRepo();
    mkdirSync(join(dir, 'openspec', 'specs', 'cli'), { recursive: true });
    writeFileSync(
      join(dir, 'openspec', 'specs', 'cli', 'spec.md'),
      `\n# cli\n\n### Requirement: Dup\nb\n\n#### Scenario: s\n- **GIVEN** g\n- **WHEN** w\n- **THEN** t\n\n### Requirement: Dup\nb2\n\n#### Scenario: s2\n- **GIVEN** g\n- **WHEN** w\n- **THEN** t\n`,
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

describe('archive commit trailers', () => {
  it('scenario: commit records archive-of and snapshot-at', () => {
    const dir = initRepo();
    seedChange(dir, 'add-x', 'cli', 'New Thing');
    commitAll(dir, 'seed');
    expect(run(dir, ['archive', 'add-x']).status).toBe(0);
    const body = execFileSync('git', ['log', '-1', '--format=%B'], { cwd: dir, encoding: 'utf8' });
    expect(body).toMatch(/Archive-Of: add-x/);
    expect(body).toMatch(/Snapshot-At: openspec\/\.snapshots\/add-x/);
  });
});

describe('archive commit failure recovery', () => {
  it('scenario: a failing commit reports the snapshot-backed undo path', () => {
    const dir = initRepo();
    seedChange(dir, 'add-x', 'cli', 'New Thing');

    // Install a pre-commit hook that always fails, so `git add` succeeds
    // (files already written + folder renamed) but the commit step throws.
    // Commit it as part of the seed so the working tree is clean when
    // archive runs its clean-tree gate.
    const hooksDir = join(dir, '.githooks');
    mkdirSync(hooksDir, { recursive: true });
    const preCommit = join(hooksDir, 'pre-commit');
    writeFileSync(preCommit, '#!/bin/sh\nexit 1\n', { mode: 0o755 });
    commitAll(dir, 'seed');
    // Activate the failing hook only after the seed commit is recorded.
    execFileSync('git', ['config', 'core.hooksPath', '.githooks'], { cwd: dir });

    const r = run(dir, ['archive', 'add-x']);
    expect(r.status).not.toBe(0);
    expect(r.stderr).toMatch(/the git commit failed/);
    expect(r.stderr).toMatch(/superspecs archive add-x --undo/);

    // The snapshot exists, so the documented recovery path is real.
    const snap = join(dir, 'openspec', '.snapshots', 'add-x', 'cli', 'spec.md');
    expect(existsSync(snap)).toBe(true);
  });
});

describe('archive undo', () => {
  it('scenario: undo restores the pre-archive state', () => {
    const dir = initRepo();
    seedChange(dir, 'add-x', 'cli', 'New Thing');
    commitAll(dir, 'seed');
    const before = readFileSync(join(dir, 'openspec', 'specs', 'cli', 'spec.md'), 'utf8');
    expect(run(dir, ['archive', 'add-x']).status).toBe(0);
    // archive already commits and leaves a clean tree, so undo can proceed.
    const r = run(dir, ['archive', 'add-x', '--undo']);
    expect(r.status).toBe(0);
    expect(readFileSync(join(dir, 'openspec', 'specs', 'cli', 'spec.md'), 'utf8')).toBe(before);
    expect(existsSync(join(dir, 'openspec', 'changes', 'add-x'))).toBe(true);
  });

  it('scenario: undo refuses on a dirty tree', () => {
    const dir = initRepo();
    seedChange(dir, 'add-x', 'cli', 'New Thing');
    commitAll(dir, 'seed');
    run(dir, ['archive', 'add-x']);
    writeFileSync(join(dir, 'dirty.txt'), 'x\n'); // dirty (untracked) after a clean archive
    const r = run(dir, ['archive', 'add-x', '--undo']);
    expect(r.status).not.toBe(0);
  });

  it('scenario: undo refuses when snapshot is missing', () => {
    const dir = initRepo();
    seedChange(dir, 'add-x', 'cli', 'New Thing');
    commitAll(dir, 'seed');
    run(dir, ['archive', 'add-x']);
    rmSync(join(dir, 'openspec', '.snapshots', 'add-x'), { recursive: true, force: true });
    const r = run(dir, ['archive', 'add-x', '--undo']);
    expect(r.status).not.toBe(0);
    expect(r.stderr).toMatch(/snapshot not found/);
  });
});
