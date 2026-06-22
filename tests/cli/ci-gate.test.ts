import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';

const WF = '.github/workflows/ci.yml';

describe('Full source CI gate', () => {
  const wf = existsSync(WF) ? readFileSync(WF, 'utf8') : '';

  it('scenario: ci workflow exists', () => {
    expect(existsSync(WF)).toBe(true);
  });

  it('scenario: ci runs build, lint, and test', () => {
    expect(wf).toContain('npm run build');
    expect(wf).toContain('npm run lint');
    expect(wf).toContain('npm test');
  });

  it('scenario: ci is not path-scoped, so pure src/ changes are gated', () => {
    // A bare `pull_request:` trigger (no `paths:` filter) means every PR runs
    // the gate, including ones that touch only src/. This is the gap the
    // skill-evals workflow leaves open.
    expect(wf).toMatch(/on:\s*[\s\S]*pull_request:\s*(\n\s+push:|\n\s*$|\n[a-z])/);
    expect(wf).toContain('push:');
    expect(wf).toContain('branches: [main]');
  });
});

describe('Changelog enforcement gate', () => {
  const wf = existsSync(WF) ? readFileSync(WF, 'utf8') : '';

  it('scenario: ci has a pull_request-only changelog job', () => {
    expect(wf).toMatch(/changelog:/);
    // The job must be guarded to pull_request events only (never on push).
    expect(wf).toContain("if: github.event_name == 'pull_request'");
  });

  it('scenario: the gate keys off src/schemas changes and requires CHANGELOG.md', () => {
    expect(wf).toContain('CHANGELOG.md');
    expect(wf).toMatch(/\^\(src\|schemas\)\//);
  });
});
