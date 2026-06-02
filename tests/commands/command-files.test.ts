import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function read(name: string): string {
  return readFileSync(resolve('commands', name), 'utf8');
}

describe('Propose command initializes workspace', () => {
  it('scenario: propose command documents init preflight', () => {
    const body = read('propose.md');
    expect(body).toMatch(/superspecs init/);
    // init instruction appears before the openspec-propose handoff
    expect(body.indexOf('superspecs init')).toBeLessThan(body.indexOf('openspec-propose'));
  });
});

describe('Command argument formats', () => {
  it('scenario: propose documents its argument', () => {
    expect(read('propose.md')).toMatch(/\/propose <change-id>/);
  });

  it('scenario: validate documents its optional argument', () => {
    expect(read('validate.md')).toMatch(/\/validate \[<change-id>\]/);
  });
});

describe('Command preflight notes', () => {
  it('scenario: every command file has a preflight note', () => {
    const files = [
      'brainstorm.md',
      'propose.md',
      'write-plan.md',
      'execute-plan.md',
      'archive.md',
      'validate.md',
    ];
    for (const f of files) {
      expect(read(f), `${f} must have a Preflight line`).toMatch(/\*\*Preflight:\*\*/);
      expect(read(f), `${f} preflight references openspec/`).toMatch(/openspec\//);
    }
  });
});
