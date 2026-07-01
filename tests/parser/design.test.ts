import { describe, it, expect } from 'vitest';
import { parseDesign } from '../../src/parser/design.js';
import { validators } from '../../src/schema/load.js';

const FULL = [
  '# Design — add-x',
  '',
  '## Context',
  '',
  'The system has no foo yet.',
  '',
  '## Decisions',
  '',
  '- **Storage:** in-memory; data is ephemeral.',
  '- **No new dep:** use the standard library.',
  '',
  '## Alternatives Considered',
  '',
  '- Persist to disk. Rejected: needless I/O.',
  '',
].join('\n');

describe('parser/design — happy path', () => {
  it('scenario: extracts title, context, decisions, alternatives', () => {
    const { ast, errors } = parseDesign(FULL, 'design.md');
    expect(errors).toEqual([]);
    expect(ast.title).toBe('Design — add-x');
    expect(ast.sections.context).toBe('The system has no foo yet.');
    expect(ast.sections.decisions).toEqual([
      '**Storage:** in-memory; data is ephemeral.',
      '**No new dep:** use the standard library.',
    ]);
    expect(ast.sections.alternatives).toEqual(['Persist to disk. Rejected: needless I/O.']);
  });

  it('scenario: records the heading position for each section', () => {
    const { positions } = parseDesign(FULL, 'design.md');
    expect(positions.title).toEqual({ line: 1, col: 1 });
    expect(positions.context).toEqual({ line: 3, col: 1 });
    expect(positions.decisions).toEqual({ line: 7, col: 1 });
    expect(positions.alternatives).toEqual({ line: 12, col: 1 });
  });

  it('scenario: a minimal design (title + one decision) passes the schema', () => {
    const text = '# Design — m\n\n## Decisions\n\n- Only one decision.\n';
    const { ast } = parseDesign(text, 'design.md');
    expect(validators.design(ast)).toBe(true);
  });
});

describe('parser/design — schema failures', () => {
  it('scenario: empty ## Decisions fails the schema (SDD201 path)', () => {
    const text = '# Design — m\n\n## Context\n\nsome context\n\n## Decisions\n';
    const { ast } = parseDesign(text, 'design.md');
    expect(validators.design(ast)).toBe(false);
    const paths = (validators.design.errors ?? []).map((e) => e.instancePath);
    expect(paths).toContain('/sections/decisions');
  });

  it('scenario: missing title fails the schema (SDD200 path)', () => {
    const text = '## Decisions\n\n- a decision\n';
    const { ast } = parseDesign(text, 'design.md');
    expect(ast.title).toBe('');
    expect(validators.design(ast)).toBe(false);
  });
});

describe('parser/design — optional pieces', () => {
  it('scenario: context is optional; decisions-only design is valid', () => {
    const text = '# Design — m\n\n## Decisions\n\n- a decision\n';
    const { ast } = parseDesign(text, 'design.md');
    expect(ast.sections.context).toBe('');
    expect(validators.design(ast)).toBe(true);
  });

  it('scenario: section heading matching is case-insensitive', () => {
    const text = '# Design — m\n\n## decisions\n\n- lower-case heading still works\n';
    const { ast } = parseDesign(text, 'design.md');
    expect(ast.sections.decisions).toEqual(['lower-case heading still works']);
  });
});
