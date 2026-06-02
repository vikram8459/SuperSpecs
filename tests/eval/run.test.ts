import { describe, it, expect } from 'vitest';
import { checkAssertion, runOneEval } from '../../src/eval/run.js';
import type { Adapter, SkillEval } from '../../src/eval/types.js';

function fixedAdapter(transcript: string): Adapter {
  return { name: 'fixed', resolve: async () => ({ transcript }) };
}

describe('Assertion evaluation', () => {
  it('scenario: all assertions pass', async () => {
    const e: SkillEval = {
      skill: 's',
      scenario: 'x',
      expected: 'y',
      assertions: [
        { kind: 'contains', value: 'spec' },
        { kind: 'not-contains', value: 'failing test first' },
        { kind: 'matches', value: 'source of (truth|record)' },
      ],
    };
    const r = await runOneEval(e, 'e.json', fixedAdapter('the spec is the source of truth'));
    expect(r.passed).toBe(true);
  });

  it('scenario: a failing not-contains assertion fails the eval', async () => {
    const e: SkillEval = {
      skill: 's',
      scenario: 'x',
      expected: 'y',
      assertions: [{ kind: 'not-contains', value: 'failing test first' }],
    };
    const r = await runOneEval(e, 'e.json', fixedAdapter('write a failing test first, then code'));
    expect(r.passed).toBe(false);
    expect(r.failures.length).toBeGreaterThan(0);
  });

  it('unit: checkAssertion matches regex', () => {
    expect(checkAssertion({ kind: 'matches', value: '^a.*z$' }, 'abcz')).toBe(true);
  });
});
