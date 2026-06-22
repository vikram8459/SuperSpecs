import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const CLI = resolve('dist/superspecs.js');
const SCHEMAS_SRC = resolve('schemas');

function initRepo(): string {
  const dir = mkdtempSync(join(tmpdir(), 'spx-archive-'));
  execFileSync('git', ['init', '-q', '-b', 'main'], { cwd: dir });
  execFileSync('git', ['config', 'user.email', 'test@example.com'], { cwd: dir });
  execFileSync('git', ['config', 'user.name', 'Test User'], { cwd: dir });
  // Pin line-ending handling locally so the repo's clean/dirty state does not
  // depend on the developer's global git config. With core.autocrlf=true
  // (the Windows default), LF-authored fixtures get reported as modified by
  // `git status --porcelain`, which made `gitIsClean` flip to "dirty" under
  // parallel load — a classic racy-index + autocrlf interaction.
  execFileSync('git', ['config', 'core.autocrlf', 'false'], { cwd: dir });
  execFileSync('git', ['config', 'core.safecrlf', 'false'], { cwd: dir });
  // The CLI loads schemas via schemaPath; copy them in so the
  // process.cwd() fallback resolves correctly inside the temp repo.
  cpSync(SCHEMAS_SRC, join(dir, 'schemas'), { recursive: true });
  execFileSync('git', ['add', '-A'], { cwd: dir });
  execFileSync('git', ['commit', '-q', '-m', 'seed'], { cwd: dir });
  return dir;
}

function writeDeltaTree(repo: string, changeId: string, capability: string, addedName: string): void {
  const specsDir = join(repo, 'openspec', 'specs', capability);
  mkdirSync(specsDir, { recursive: true });
  writeFileSync(join(specsDir, 'spec.md'), `# ${capability}\n`);

  const changeDir = join(repo, 'openspec', 'changes', changeId, 'specs', capability);
  mkdirSync(changeDir, { recursive: true });
  writeFileSync(
    join(changeDir, 'spec.md'),
    `# ${capability} — delta for ${changeId}\n\n## ADDED Requirements\n\n### Requirement: ${addedName}\n\nBody text.\n\n#### Scenario: works\n\n- **GIVEN** a precondition\n- **WHEN** the action runs\n- **THEN** the outcome holds\n`,
  );
}

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

describe('archive subcommand (mechanical)', () => {
  it('scenario: ADDED requirement appends to capability file', () => {
    // GIVEN a change `add-x` whose delta adds Requirement "New Thing"
    //       and the active spec exists without that requirement
    const repo = initRepo();
    writeDeltaTree(repo, 'add-x', 'cli', 'New Thing');
    execFileSync('git', ['add', '-A'], { cwd: repo });
    execFileSync('git', ['commit', '-q', '-m', 'add change'], { cwd: repo });

    // WHEN superspecs archive add-x runs
    const r = run(repo, ['archive', 'add-x']);

    // THEN exit 0; active spec contains the requirement; folder moved; commit message has trailer
    expect(r.status).toBe(0);
    const active = readFileSync(join(repo, 'openspec', 'specs', 'cli', 'spec.md'), 'utf8');
    expect(active).toMatch(/### Requirement: New Thing/);
    expect(existsSync(join(repo, 'openspec', 'changes', 'add-x'))).toBe(false);

    const log = execFileSync('git', ['log', '-1', '--format=%B'], { cwd: repo, encoding: 'utf8' });
    expect(log).toMatch(/^archive: add-x/m);
    expect(log).toMatch(/Archive-Of: add-x/);
  });

  it('scenario: archive on dirty tree fails safely', () => {
    // GIVEN a repo with the change committed AND an uncommitted untracked file
    const repo = initRepo();
    writeDeltaTree(repo, 'add-x', 'cli', 'New Thing');
    execFileSync('git', ['add', '-A'], { cwd: repo });
    execFileSync('git', ['commit', '-q', '-m', 'add change'], { cwd: repo });

    // Dirty the working tree (untracked file outside the change folder)
    writeFileSync(join(repo, 'dirty.txt'), 'uncommitted\n');

    // WHEN archive runs
    const r = run(repo, ['archive', 'add-x']);

    // THEN exit non-zero; the change folder is NOT moved
    expect(r.status).not.toBe(0);
    expect(existsSync(join(repo, 'openspec', 'changes', 'add-x'))).toBe(true);
    expect(existsSync(join(repo, 'openspec', 'changes', 'archive'))).toBe(false);
  });
});
