import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import fg from 'fast-glob';

describe('Baseline record', () => {
  it('scenario: baseline lists every committed eval', () => {
    const baseline = readFileSync('tests/skills/BASELINE.md', 'utf8');
    const files = fg.sync('tests/skills/**/*.eval.json');
    expect(files.length).toBeGreaterThan(0);
    for (const f of files) {
      expect(baseline, `BASELINE.md must name ${f}`).toContain(f);
    }
  });
});
