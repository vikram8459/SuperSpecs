import { describe, it, expect } from 'vitest';
import { parseProposal } from '../../src/parser/proposal.js';

const FULL = [
  '# My Change',
  '',
  '## Why',
  '',
  'Because we need it.',
  '',
  '## What Changes',
  '',
  '- Add a thing',
  '- Update another thing',
  '',
  '## Out of Scope',
  '',
  '- Deferred work',
  '',
  '## Impact',
  '',
  'Affects the cli capability.',
  '',
].join('\n');

describe('parser/proposal — happy path', () => {
  it('scenario: extracts title and all four sections', () => {
    const { ast, errors } = parseProposal(FULL, 'proposal.md');
    expect(errors).toHaveLength(0);
    expect(ast.title).toBe('My Change');
    expect(ast.sections.why).toBe('Because we need it.');
    expect(ast.sections.whatChanges).toEqual(['Add a thing', 'Update another thing']);
    expect(ast.sections.outOfScope).toEqual(['Deferred work']);
    expect(ast.sections.impact).toBe('Affects the cli capability.');
  });

  it('scenario: records the heading position for each section', () => {
    const { positions } = parseProposal(FULL, 'proposal.md');
    expect(positions.title).toEqual({ line: 1, col: 1 });
    expect(positions.why).toEqual({ line: 3, col: 1 });
    expect(positions.whatChanges).toEqual({ line: 7, col: 1 });
    expect(positions.outOfScope).toEqual({ line: 12, col: 1 });
    expect(positions.impact).toEqual({ line: 16, col: 1 });
  });
});

describe('parser/proposal — prose authored as bullets', () => {
  it('scenario: bullet bodies in Why/Impact are concatenated into prose', () => {
    const text = [
      '# T',
      '',
      '## Why',
      '',
      '- first reason',
      '- second reason',
      '',
      '## Impact',
      '',
      '- some impact',
      '',
    ].join('\n');
    const { ast } = parseProposal(text, 'proposal.md');
    // why/impact are prose sections; bullet bodies are joined (prefixed `- `)
    // so the schema's minLength check sees a non-empty string.
    expect(ast.sections.why).toContain('first reason');
    expect(ast.sections.why).toContain('second reason');
    expect(ast.sections.impact).toContain('some impact');
  });
});

describe('parser/proposal — missing pieces', () => {
  it('scenario: missing title yields empty string and ORIGIN position', () => {
    const text = '## Why\n\nreason\n';
    const { ast, positions } = parseProposal(text, 'proposal.md');
    expect(ast.title).toBe('');
    expect(positions.title).toEqual({ line: 1, col: 1 });
  });

  it('scenario: absent sections stay empty with ORIGIN positions', () => {
    const text = '# Only Title\n';
    const { ast, positions } = parseProposal(text, 'proposal.md');
    expect(ast.sections.why).toBe('');
    expect(ast.sections.whatChanges).toEqual([]);
    expect(ast.sections.outOfScope).toEqual([]);
    expect(ast.sections.impact).toBe('');
    // Missing sections fall back to the file origin (1,1).
    expect(positions.why).toEqual({ line: 1, col: 1 });
    expect(positions.impact).toEqual({ line: 1, col: 1 });
  });

  it('scenario: unknown section headings are ignored', () => {
    const text = '# T\n\n## Notes\n\nignored content\n\n## Why\n\nkept\n';
    const { ast } = parseProposal(text, 'proposal.md');
    expect(ast.sections.why).toBe('kept');
  });

  it('scenario: parser emits no semantic errors (schema enforces required)', () => {
    const { errors } = parseProposal('# T\n', 'proposal.md');
    expect(errors).toEqual([]);
  });
});

describe('parser/proposal — section heading matching', () => {
  it('scenario: section heading match is case-insensitive', () => {
    const text = '# T\n\n## why\n\nlowercase heading still matches\n';
    const { ast } = parseProposal(text, 'proposal.md');
    expect(ast.sections.why).toBe('lowercase heading still matches');
  });
});
