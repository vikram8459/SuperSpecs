import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import fg from 'fast-glob';
import { runOneEval } from '../../src/eval/run.js';
import { transcriptAdapter } from '../../src/eval/adapters.js';
import type { SkillEval } from '../../src/eval/types.js';

describe('Finding 7 guardrail eval', () => {
  it('scenario: the guardrail eval passes in replay', async () => {
    const file = 'tests/skills/writing-plans/no-tdd-framing.eval.json';
    const obj = JSON.parse(readFileSync(file, 'utf8')) as SkillEval;
    const r = await runOneEval(obj, file, transcriptAdapter);
    expect(r.passed, r.failures.join('; ')).toBe(true);
  });

  it('every committed eval passes in replay', async () => {
    const files = fg.sync('tests/skills/**/*.eval.json');
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      const obj = JSON.parse(readFileSync(file, 'utf8')) as SkillEval;
      const r = await runOneEval(obj, file, transcriptAdapter);
      expect(r.passed, `${file}: ${r.failures.join('; ')}`).toBe(true);
    }
  });
});
