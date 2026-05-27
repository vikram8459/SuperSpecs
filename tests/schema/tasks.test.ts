import { describe, it, expect } from 'vitest';
import Ajv from 'ajv';
import { readFileSync } from 'node:fs';

const ajv = new Ajv({ allErrors: true });
const schema = JSON.parse(readFileSync('schemas/tasks.schema.json', 'utf8'));
const validate = ajv.compile(schema);

describe('Tasks schema', () => {
  it('scenario: task with one spec ref and one file validates', () => {
    // GIVEN AST with one task whose specRefs has one entry and files has one entry
    const ast = JSON.parse(readFileSync('tests/fixtures/tasks-good.json', 'utf8'));
    // WHEN validated
    const ok = validate(ast);
    // THEN zero errors
    expect(ok).toBe(true);
    expect(validate.errors).toBeNull();
  });

  it('scenario: task with no files fails', () => {
    // GIVEN AST with one task whose files array is empty
    const ast = JSON.parse(readFileSync('tests/fixtures/tasks-no-files.json', 'utf8'));
    // WHEN validated
    const ok = validate(ast);
    // THEN at least one error with keyword=minItems on /files
    expect(ok).toBe(false);
    expect(
      validate.errors!.some(
        (e) => e.keyword === 'minItems' && e.instancePath.endsWith('/files'),
      ),
    ).toBe(true);
  });
});
