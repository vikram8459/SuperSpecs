import { describe, it, expect } from 'vitest';
import * as AjvNs from 'ajv';
import { readFileSync } from 'node:fs';

const AjvCtor = (
  AjvNs as unknown as {
    default: new (o?: Record<string, unknown>) => {
      compile: (s: unknown) => ((d: unknown) => boolean) & {
        errors?: { keyword: string; instancePath: string }[] | null;
      };
    };
  }
).default;

const ajv = new AjvCtor({ allErrors: true });
const validate = ajv.compile(JSON.parse(readFileSync('schemas/skill-eval.schema.json', 'utf8')));

describe('Eval file format', () => {
  it('scenario: well-formed eval validates', () => {
    const ast = JSON.parse(readFileSync('tests/fixtures/skill-eval-good.json', 'utf8'));
    expect(validate(ast)).toBe(true);
  });

  it('scenario: eval with no assertions fails', () => {
    const ast = JSON.parse(readFileSync('tests/fixtures/skill-eval-no-assertions.json', 'utf8'));
    expect(validate(ast)).toBe(false);
    expect(
      validate.errors!.some(
        (e) => e.keyword === 'minItems' && e.instancePath.endsWith('/assertions'),
      ),
    ).toBe(true);
  });
});
