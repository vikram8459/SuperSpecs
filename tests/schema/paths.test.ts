import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';

const SCHEMA_PATHS = [
  'schemas/proposal.schema.json',
  'schemas/spec-delta.schema.json',
  'schemas/tasks.schema.json',
];

describe('IDE schema reference path', () => {
  it('scenario: schemas resolve at expected paths', () => {
    // GIVEN the repository at any commit on the default branch
    // WHEN a tool reads each schema file
    // THEN all three exist, parse as valid JSON, and declare $schema of draft-07+
    for (const p of SCHEMA_PATHS) {
      expect(existsSync(p), `${p} must exist`).toBe(true);

      const raw = readFileSync(p, 'utf8');
      let parsed: { $schema?: string };
      expect(() => {
        parsed = JSON.parse(raw);
      }, `${p} must parse as JSON`).not.toThrow();

      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      expect(parsed!.$schema, `${p} must declare $schema`).toBeTruthy();
      expect(parsed!.$schema, `${p} must use draft-07 or later (json-schema.org)`).toMatch(
        /json-schema\.org/,
      );
    }
  });
});
