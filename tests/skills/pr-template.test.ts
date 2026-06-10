import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';

const TPL = '.github/pull_request_template.md';

describe('PR template', () => {
  it('reminds contributors to run skill evals when touching skills', () => {
    expect(existsSync(TPL)).toBe(true);
    const tpl = readFileSync(TPL, 'utf8');
    expect(tpl).toMatch(/skills\/\*\*/);
    expect(tpl).toContain('npm run eval');
  });
});
