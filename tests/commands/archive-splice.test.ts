import { describe, it, expect } from 'vitest';
import {
  endWithSingleNewline,
  appendBlock,
  normalizeBlock,
  applyEdits,
  computeCapabilityAfter,
} from '../../src/commands/archive-splice.js';
import { parseSpecDelta } from '../../src/parser/spec-delta.js';

function delta(sections: string): string {
  return `# auth — delta for demo\n\n${sections}`;
}

function ast(deltaText: string) {
  return parseSpecDelta(deltaText, 'delta.md').ast;
}

const LOGIN_ADDED = `## ADDED Requirements
### Requirement: Login
Users SHALL log in.

#### Scenario: valid creds
- **GIVEN** valid credentials
- **WHEN** the user submits
- **THEN** a session is created
`;

describe('endWithSingleNewline', () => {
  it('trims trailing whitespace and adds exactly one newline', () => {
    expect(endWithSingleNewline('a\n\n\n')).toBe('a\n');
    expect(endWithSingleNewline('a   ')).toBe('a\n');
    expect(endWithSingleNewline('a')).toBe('a\n');
  });
});

describe('appendBlock', () => {
  it('separates body and block with exactly one blank line', () => {
    expect(appendBlock('a\n\n', 'b\n')).toBe('a\n\nb\n');
  });
});

describe('normalizeBlock', () => {
  it('is endWithSingleNewline applied to source text', () => {
    expect(normalizeBlock('### Requirement: X\n\n\n')).toBe('### Requirement: X\n');
  });
});

describe('applyEdits', () => {
  it('applies non-overlapping edits right-to-left without offset drift', () => {
    // "0123456789" -> replace [0,1)="0" with "A" and [5,6)="5" with "BB"
    // => "A" + "1234" + "BB" + "6789" = "A1234BB6789"
    const out = applyEdits('0123456789', [
      { start: 0, end: 1, text: 'A' },
      { start: 5, end: 6, text: 'BB' },
    ]);
    expect(out).toBe('A1234BB6789');
  });

  it('treats empty text as a deletion', () => {
    expect(applyEdits('abcdef', [{ start: 2, end: 4, text: '' }])).toBe('abef');
  });
});

describe('computeCapabilityAfter', () => {
  it('synthesizes a heading and appends ADDED requirements when no active body exists', () => {
    const d = delta(LOGIN_ADDED);
    const { after, warnings } = computeCapabilityAfter(null, ast(d), d);
    expect(after.startsWith('# auth\n')).toBe(true);
    expect(after).toContain('### Requirement: Login');
    expect(after).toContain('a session is created');
    expect(after.endsWith('\n')).toBe(true);
    expect(warnings).toEqual([]);
  });

  it('replaces a MODIFIED requirement in place, preserving surrounding content', () => {
    const active = `# auth

### Requirement: Login
Old body.

#### Scenario: old
- **GIVEN** a
- **WHEN** b
- **THEN** c

### Requirement: Logout
Users SHALL log out.

#### Scenario: ok
- **GIVEN** a session
- **WHEN** the user logs out
- **THEN** it ends
`;
    const d = delta(`## MODIFIED Requirements
### Requirement: Login
Users SHALL log in with MFA.

#### Scenario: mfa
- **GIVEN** valid credentials and a device
- **WHEN** the user submits
- **THEN** a session is created
`);
    const { after, warnings } = computeCapabilityAfter(active, ast(d), d);
    expect(after).toContain('with MFA');
    expect(after).not.toContain('Old body.');
    // Untouched requirement survives.
    expect(after).toContain('### Requirement: Logout');
    expect(warnings).toEqual([]);
  });

  it('warns and appends when MODIFIED names a requirement absent from the active set', () => {
    const active = `# auth

### Requirement: Login
Users SHALL log in.

#### Scenario: ok
- **GIVEN** a
- **WHEN** b
- **THEN** c
`;
    const d = delta(`## MODIFIED Requirements
### Requirement: Ghost
Users SHALL vanish.

#### Scenario: poof
- **GIVEN** a
- **WHEN** b
- **THEN** c
`);
    const { after, warnings } = computeCapabilityAfter(active, ast(d), d);
    expect(after).toContain('### Requirement: Ghost');
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('MODIFIED requirement "Ghost" was not found');
  });

  it('removes a REMOVED requirement that exists', () => {
    const active = `# auth

### Requirement: Login
Users SHALL log in.

#### Scenario: ok
- **GIVEN** a
- **WHEN** b
- **THEN** c

### Requirement: Logout
Users SHALL log out.

#### Scenario: ok
- **GIVEN** a
- **WHEN** b
- **THEN** c
`;
    const d = delta(`## REMOVED Requirements
### Requirement: Logout
Users SHALL log out.
`);
    const { after, warnings } = computeCapabilityAfter(active, ast(d), d);
    expect(after).not.toContain('### Requirement: Logout');
    expect(after).toContain('### Requirement: Login');
    expect(warnings).toEqual([]);
  });

  it('warns when REMOVED names a requirement absent from the active set', () => {
    const active = `# auth

### Requirement: Login
Users SHALL log in.

#### Scenario: ok
- **GIVEN** a
- **WHEN** b
- **THEN** c
`;
    const d = delta(`## REMOVED Requirements
### Requirement: Nonexistent
gone
`);
    const { after, warnings } = computeCapabilityAfter(active, ast(d), d);
    expect(after).toContain('### Requirement: Login');
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('REMOVED requirement "Nonexistent" was not found');
  });
});
