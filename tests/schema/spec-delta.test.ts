import { describe, it, expect } from 'vitest';
import Ajv from 'ajv';
import { readFileSync } from 'node:fs';

const ajv = new Ajv({ allErrors: true });
const schema = JSON.parse(readFileSync('schemas/spec-delta.schema.json', 'utf8'));
const validate = ajv.compile(schema);

describe('Spec-delta schema', () => {
  it('scenario: requirement with one full scenario validates', () => {
    // GIVEN AST with one requirement whose scenario has all of given/when/then non-empty
    const ast = JSON.parse(readFileSync('tests/fixtures/spec-delta-good.json', 'utf8'));
    // WHEN validated
    const ok = validate(ast);
    // THEN zero errors
    expect(ok).toBe(true);
    expect(validate.errors).toBeNull();
  });

  it('scenario: requirement without scenario fails', () => {
    // GIVEN AST with one requirement whose scenarios array is empty
    const ast = JSON.parse(readFileSync('tests/fixtures/spec-delta-no-scenario.json', 'utf8'));
    // WHEN validated
    const ok = validate(ast);
    // THEN at least one error with keyword=minItems referencing the empty scenarios array
    expect(ok).toBe(false);
    expect(
      validate.errors!.some(
        (e) => e.keyword === 'minItems' && e.instancePath.endsWith('/scenarios'),
      ),
    ).toBe(true);
  });

  it('scenario: scenario with empty THEN fails', () => {
    // GIVEN AST with a scenario whose then is the empty string
    const ast = JSON.parse(readFileSync('tests/fixtures/spec-delta-empty-then.json', 'utf8'));
    // WHEN validated
    const ok = validate(ast);
    // THEN at least one error with keyword=minLength on /then
    expect(ok).toBe(false);
    expect(
      validate.errors!.some(
        (e) => e.keyword === 'minLength' && e.instancePath.endsWith('/then'),
      ),
    ).toBe(true);
  });
});
