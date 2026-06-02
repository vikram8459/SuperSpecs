import { describe, it, expect } from 'vitest';
import { transcriptAdapter } from '../../src/eval/adapters.js';
import type { SkillEval } from '../../src/eval/types.js';

const base: SkillEval = {
  skill: 's',
  scenario: 'x',
  expected: 'y',
  assertions: [{ kind: 'contains', value: 'z' }],
};

describe('Transcript adapter', () => {
  it('scenario: transcript adapter reads a recorded file', async () => {
    const r = await transcriptAdapter.resolve(
      { ...base, transcript: 'tests/fixtures/eval/sample.transcript.md' },
      'x.eval.json',
    );
    expect('transcript' in r).toBe(true);
    if ('transcript' in r) expect(r.transcript).toMatch(/source of truth/);
  });

  it('scenario: missing transcript file fails the eval', async () => {
    const r = await transcriptAdapter.resolve(
      { ...base, transcript: 'tests/fixtures/eval/nope.md' },
      'x.eval.json',
    );
    expect('error' in r).toBe(true);
    if ('error' in r) expect(r.error).toMatch(/nope\.md/);
  });
});
