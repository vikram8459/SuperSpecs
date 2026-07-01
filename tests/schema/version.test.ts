import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

// Every shipped schema records its version in a `$comment` annotation of
// the form "schema-version: <semver> ...". `$comment` is used (rather than
// a custom top-level `version` keyword) because ajv strict mode rejects
// unknown keywords, and we want to keep strict mode on. Schemas are
// versioned as a SET with the superspecs package (see schemas/README.md §
// Schema-version policy). Guards the CF-E-4 carry-forward: the policy was
// documented but no version was embedded in the files.
const SCHEMA_PATHS = [
  'schemas/proposal.schema.json',
  'schemas/spec-delta.schema.json',
  'schemas/tasks.schema.json',
  'schemas/design.schema.json',
  'schemas/skill-eval.schema.json',
];

const pkgVersion = (JSON.parse(readFileSync('package.json', 'utf8')) as { version: string })
  .version;

function schemaVersion(path: string): string | undefined {
  const parsed = JSON.parse(readFileSync(path, 'utf8')) as { $comment?: string };
  const match = parsed.$comment?.match(/schema-version:\s*(\d+\.\d+\.\d+[^\s)]*)/);
  return match?.[1];
}

describe('schema versioning', () => {
  it('scenario: every schema records a version in $comment', () => {
    // GIVEN the shipped schema set
    // WHEN a tool reads each schema's $comment version annotation
    // THEN every schema declares a non-empty semver-shaped version
    for (const p of SCHEMA_PATHS) {
      const v = schemaVersion(p);
      expect(v, `${p} must record a schema-version in $comment`).toBeTruthy();
      expect(v, `${p} schema-version must be semver-shaped`).toMatch(/^\d+\.\d+\.\d+/);
    }
  });

  it('scenario: schema versions match the package version (versioned as a set)', () => {
    // GIVEN schemas/README.md states schemas are versioned with the package
    // WHEN we compare each schema version to package.json
    // THEN they are identical, so a package bump forces a deliberate schema review
    for (const p of SCHEMA_PATHS) {
      expect(
        schemaVersion(p),
        `${p} schema-version must equal package.json version (${pkgVersion})`,
      ).toBe(pkgVersion);
    }
  });
});
