import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';

const WF = '.github/workflows/skill-evals.yml';

describe('Skill-evals CI gate', () => {
  const wf = existsSync(WF) ? readFileSync(WF, 'utf8') : '';

  it('scenario: workflow is replay-only and secret-free', () => {
    expect(wf).toContain('npm run eval');
    expect(wf).not.toMatch(/secrets\./);
    expect(wf).not.toMatch(/--live/);
  });

  it('scenario: workflow triggers on skill and eval paths', () => {
    expect(wf).toContain('skills/**');
    expect(wf).toContain('tests/skills/**');
    expect(wf).toContain('src/eval/**');
  });
});
