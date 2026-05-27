import { describe, it, expect } from 'vitest';
import Ajv from 'ajv';
import { readFileSync } from 'node:fs';

const ajv = new Ajv({ allErrors: true });
const schema = JSON.parse(readFileSync('schemas/proposal.schema.json', 'utf8'));
const validate = ajv.compile(schema);

describe('Proposal schema', () => {
  it('scenario: well-formed proposal validates', () => {
    // GIVEN AST from a proposal.md with all five required sections
    const ast = JSON.parse(readFileSync('tests/fixtures/proposal-good.json', 'utf8'));
    // WHEN validated against schemas/proposal.schema.json
    const ok = validate(ast);
    // THEN validation succeeds with zero errors
    expect(ok).toBe(true);
    expect(validate.errors).toBeNull();
  });

  it('scenario: missing Why section fails', () => {
    // GIVEN AST missing sections.why
    const ast = JSON.parse(readFileSync('tests/fixtures/proposal-missing-why.json', 'utf8'));
    // WHEN validated against schemas/proposal.schema.json
    const ok = validate(ast);
    // THEN at least one required-error referencing the missing section
    expect(ok).toBe(false);
    expect(
      validate.errors!.some(
        (e) => e.keyword === 'required' && e.params.missingProperty === 'why',
      ),
    ).toBe(true);
  });
});
