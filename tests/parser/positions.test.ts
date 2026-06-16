import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { parseSpecDelta } from '../../src/parser/spec-delta.js';

describe('Markdown-to-AST parser — positions', () => {
  it('scenario: parser preserves line numbers', () => {
    // GIVEN a spec.md whose `### Requirement: Version Flag` appears at line 5 col 1
    const text = readFileSync('tests/fixtures/parser/simple-delta.md', 'utf8');
    // WHEN the parser produces the AST + positions side-channel
    const { ast, positions, errors } = parseSpecDelta(text, 'tests/fixtures/parser/simple-delta.md');
    // THEN the requirement's position (parallel to the AST) is { line: 5, col: 1 }
    expect(errors).toHaveLength(0);
    expect(ast.deltas.added).toHaveLength(1);
    expect(ast.deltas.added[0].name).toBe('Version Flag');
    expect(positions.added).toHaveLength(1);
    expect(positions.added[0].position).toEqual({ line: 5, col: 1 });
  });
});
