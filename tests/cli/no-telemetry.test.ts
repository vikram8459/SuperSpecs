import { describe, it, expect } from 'vitest';
import fg from 'fast-glob';
import { readFileSync } from 'node:fs';

describe('no telemetry', () => {
  it('no source file under src/ references SUPERSPECS_TELEMETRY', () => {
    const files = fg.sync('src/**/*.ts');
    const offenders = files.filter((f) => readFileSync(f, 'utf8').includes('SUPERSPECS_TELEMETRY'));
    expect(offenders).toEqual([]);
  });

  it('architecture doc records the no-telemetry decision', () => {
    const doc = readFileSync('docs/architecture.md', 'utf8');
    expect(doc).toMatch(/ADR-009 — No telemetry/);
    expect(doc).toMatch(/collects no telemetry/);
  });
});
