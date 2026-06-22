import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const CLI = resolve('dist/superspecs.js');
const SCHEMAS = resolve('schemas');

function initRepo(): string {
  const dir = mkdtempSync(join(tmpdir(), 'spx-arch-rt-'));
  execFileSync('git', ['init', '-q', '-b', 'main'], { cwd: dir });
  execFileSync('git', ['config', 'user.email', 't@e.com'], { cwd: dir });
  execFileSync('git', ['config', 'user.name', 'T'], { cwd: dir });
  // Pin line-ending handling locally so the repo's clean/dirty state does not
  // depend on the developer's global git config (core.autocrlf=true would
  // report LF-authored fixtures as modified and flake the clean-tree gate).
  execFileSync('git', ['config', 'core.autocrlf', 'false'], { cwd: dir });
  execFileSync('git', ['config', 'core.safecrlf', 'false'], { cwd: dir });
  cpSync(SCHEMAS, join(dir, 'schemas'), { recursive: true });
  writeFileSync(join(dir, '.gitignore'), 'openspec/.snapshots/\n');
  return dir;
}

function commitAll(dir: string, msg: string): void {
  execFileSync('git', ['add', '-A'], { cwd: dir });
  execFileSync('git', ['commit', '-q', '-m', msg], { cwd: dir });
}

function writeActive(dir: string, cap: string, content: string): void {
  mkdirSync(join(dir, 'openspec', 'specs', cap), { recursive: true });
  writeFileSync(join(dir, 'openspec', 'specs', cap, 'spec.md'), content);
}

function writeDelta(dir: string, id: string, cap: string, content: string): void {
  const cdir = join(dir, 'openspec', 'changes', id, 'specs', cap);
  mkdirSync(cdir, { recursive: true });
  writeFileSync(join(cdir, 'spec.md'), content);
}

function run(cwd: string, args: string[]): { stdout: string; stderr: string; status: number } {
  try {
    return { stdout: execFileSync('node', [CLI, ...args], { encoding: 'utf8', cwd }), stderr: '', status: 0 };
  } catch (e: unknown) {
    const x = e as { stdout?: Buffer | string; stderr?: Buffer | string; status?: number };
    return { stdout: x.stdout?.toString() ?? '', stderr: x.stderr?.toString() ?? '', status: x.status ?? 1 };
  }
}

function active(dir: string, cap: string): string {
  return readFileSync(join(dir, 'openspec', 'specs', cap, 'spec.md'), 'utf8');
}

describe('archive source-preserving round-trip', () => {
  it('scenario: ADDED requirement with a multi-paragraph body survives verbatim', () => {
    // GIVEN an active spec missing the requirement and a delta whose ADDED
    //       requirement body spans two paragraphs (the old re-render kept
    //       only the first body paragraph)
    const dir = initRepo();
    writeActive(dir, 'cli', '# cli\n');
    const reqBlock =
      '### Requirement: Rich Add\n\n' +
      'First normative paragraph SHALL hold.\n\n' +
      'Second clarifying paragraph with more detail.\n\n' +
      '#### Scenario: works\n\n' +
      '- **GIVEN** a precondition\n- **WHEN** the action runs\n- **THEN** the outcome holds\n';
    writeDelta(
      dir,
      'add-x',
      'cli',
      `# cli — delta for add-x\n\n## ADDED Requirements\n\n${reqBlock}`,
    );
    commitAll(dir, 'seed');

    // WHEN archive runs
    expect(run(dir, ['archive', 'add-x']).status).toBe(0);

    // THEN the second paragraph (dropped by the old renderer) is present
    const out = active(dir, 'cli');
    expect(out).toContain('First normative paragraph SHALL hold.');
    expect(out).toContain('Second clarifying paragraph with more detail.');
  });

  it('scenario: MODIFIED requirement preserves prose between scenarios and extra bullets', () => {
    // GIVEN an active spec with a plain version of "Login" and a delta that
    //       MODIFIES it to include prose between scenarios plus extra bullets
    //       inside the GIVEN/WHEN/THEN list
    const dir = initRepo();
    writeActive(
      dir,
      'auth',
      '# auth\n\n### Requirement: Login\n\nUsers SHALL log in.\n\n' +
        '#### Scenario: basic\n\n- **GIVEN** a user\n- **WHEN** they submit creds\n- **THEN** a session starts\n',
    );
    const modified =
      '### Requirement: Login\n\n' +
      'Users SHALL log in with valid credentials.\n\n' +
      '#### Scenario: basic\n\n' +
      '- **GIVEN** a registered user\n- **WHEN** they submit valid creds\n- **THEN** a session starts\n- and an audit log entry is written\n\n' +
      'The following scenario covers lockout, an important security control.\n\n' +
      '#### Scenario: lockout\n\n' +
      '- **GIVEN** five failed attempts\n- **WHEN** a sixth is tried\n- **THEN** the account is locked\n';
    writeDelta(
      dir,
      'mod-login',
      'auth',
      `# auth — delta for mod-login\n\n## MODIFIED Requirements\n\n${modified}`,
    );
    commitAll(dir, 'seed');

    // WHEN archive runs
    expect(run(dir, ['archive', 'mod-login']).status).toBe(0);

    // THEN the prose-between-scenarios and the extra bullet both survive
    const out = active(dir, 'auth');
    expect(out).toContain('The following scenario covers lockout, an important security control.');
    expect(out).toContain('- and an audit log entry is written');
    expect(out).toContain('#### Scenario: lockout');
    // AND the stale body text from the active version is gone (replaced)
    expect(out).not.toContain('Users SHALL log in.\n');
  });

  it('scenario: a fenced literal "### Requirement:" in the active spec is not corrupted', () => {
    // GIVEN an active spec whose first requirement body contains a code fence
    //       with a literal `### Requirement:` line (must NOT be treated as a
    //       real heading/boundary), plus a real second requirement to MODIFY
    const dir = initRepo();
    writeActive(
      dir,
      'cli',
      '# cli\n\n### Requirement: Has Fence\n\n' +
        'Documents the format:\n\n' +
        '```\n### Requirement: Not Real\n#### Scenario: nope\n```\n\n' +
        '#### Scenario: real\n\n- **GIVEN** g\n- **WHEN** w\n- **THEN** t\n\n' +
        '### Requirement: Second\n\nb\n\n' +
        '#### Scenario: s\n\n- **GIVEN** g\n- **WHEN** w\n- **THEN** t\n',
    );
    writeDelta(
      dir,
      'mod-second',
      'cli',
      '# cli — delta for mod-second\n\n## MODIFIED Requirements\n\n' +
        '### Requirement: Second\n\nupdated body.\n\n' +
        '#### Scenario: s\n\n- **GIVEN** g\n- **WHEN** w\n- **THEN** t\n',
    );
    commitAll(dir, 'seed');

    // WHEN archive runs
    expect(run(dir, ['archive', 'mod-second']).status).toBe(0);

    // THEN the fenced literal heading is untouched, the fenced block is intact,
    //      and only the real "Second" requirement body was modified
    const out = active(dir, 'cli');
    expect(out).toContain('```\n### Requirement: Not Real\n#### Scenario: nope\n```');
    expect(out).toContain('### Requirement: Has Fence');
    expect(out).toContain('updated body.');
    // The fenced "Not Real" must not have become its own active requirement:
    // it appears exactly once (inside the fence) and never as a real heading.
    const notRealOccurrences = out.split('### Requirement: Not Real').length - 1;
    expect(notRealOccurrences).toBe(1);
    // The real requirement headings (those NOT inside the single code fence)
    // are exactly the two authored ones.
    const fenceStart = out.indexOf('```');
    const fenceEnd = out.indexOf('```', fenceStart + 3) + 3;
    const outsideFence = out.slice(0, fenceStart) + out.slice(fenceEnd);
    const realHeadings = outsideFence
      .split('\n')
      .filter((l) => /^### Requirement:/.test(l));
    expect(realHeadings).toEqual(['### Requirement: Has Fence', '### Requirement: Second']);
  });
});
