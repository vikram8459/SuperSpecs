import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { parseSpecDelta } from '../../src/parser/spec-delta.js';

describe('Markdown-to-AST parser — duplicates', () => {
  it('scenario: parser fails fast on duplicate requirement names', () => {
    // GIVEN a spec.md containing two `### Requirement: Same Name` headings in one section
    const text = readFileSync('tests/fixtures/parser/duplicate-req.md', 'utf8');
    // WHEN the parser is invoked
    const { errors } = parseSpecDelta(text, 'dup.md');
    // THEN at least one error references both source positions and the duplicate name
    expect(
      errors.some((e) => e.code === 'SDD050' && /Same Name/.test(e.message) && /dup\.md:\d+:\d+/.test(e.message)),
    ).toBe(true);
  });
});
