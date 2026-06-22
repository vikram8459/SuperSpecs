import { describe, it, expect } from 'vitest';
import type { ErrorObject } from 'ajv';
import { pathToCode, ajvToCliErrors, formatError, UNMAPPED_CODE } from '../../src/schema/errors.js';

/**
 * Build a minimal ajv ErrorObject for the fields `pathToCode` reads.
 * The other ErrorObject fields are irrelevant to the mapping.
 */
function err(partial: Partial<ErrorObject>): ErrorObject {
  return {
    instancePath: '',
    schemaPath: '#',
    keyword: 'type',
    params: {},
    message: 'invalid',
    ...partial,
  } as ErrorObject;
}

describe('pathToCode mapping', () => {
  // Every (input ajv error -> expected SDD code) pair the registry promises.
  const cases: Array<{ name: string; e: ErrorObject; code: string }> = [
    // Spec-delta family
    { name: 'SDD001 empty scenarios', e: err({ instancePath: '/deltas/added/0/scenarios', keyword: 'minItems' }), code: 'SDD001' },
    { name: 'SDD002 empty then', e: err({ instancePath: '/deltas/added/0/scenarios/0/then', keyword: 'minLength' }), code: 'SDD002' },
    { name: 'SDD003 empty given', e: err({ instancePath: '/deltas/added/0/scenarios/0/given', keyword: 'minLength' }), code: 'SDD003' },
    { name: 'SDD004 empty when', e: err({ instancePath: '/deltas/added/0/scenarios/0/when', keyword: 'minLength' }), code: 'SDD004' },
    // Tasks family
    { name: 'SDD010 empty specRefs', e: err({ instancePath: '/tasks/0/specRefs', keyword: 'minItems' }), code: 'SDD010' },
    { name: 'SDD011 empty files', e: err({ instancePath: '/tasks/0/files', keyword: 'minItems' }), code: 'SDD011' },
    { name: 'SDD012 no tasks', e: err({ instancePath: '/tasks', keyword: 'minItems' }), code: 'SDD012' },
    // Proposal family
    { name: 'SDD100 missing why', e: err({ instancePath: '/sections', keyword: 'required', params: { missingProperty: 'why' } }), code: 'SDD100' },
    { name: 'SDD102 missing impact', e: err({ instancePath: '/sections', keyword: 'required', params: { missingProperty: 'impact' } }), code: 'SDD102' },
    { name: 'SDD103 missing title', e: err({ instancePath: '', keyword: 'required', params: { missingProperty: 'title' } }), code: 'SDD103' },
    { name: 'SDD101 empty whatChanges', e: err({ instancePath: '/sections/whatChanges', keyword: 'minItems' }), code: 'SDD101' },
    { name: 'SDD103 empty title', e: err({ instancePath: '/title', keyword: 'minLength' }), code: 'SDD103' },
  ];

  for (const c of cases) {
    it(`scenario: ${c.name} -> ${c.code}`, () => {
      expect(pathToCode(c.e)).toBe(c.code);
    });
  }

  it('scenario: an unmapped error falls back to the catch-all code', () => {
    expect(pathToCode(err({ instancePath: '/something/unknown', keyword: 'type' }))).toBe(UNMAPPED_CODE);
    expect(UNMAPPED_CODE).toBe('SDD999');
  });

  it('scenario: a required-error keyword without a matching missingProperty does not mis-map', () => {
    // `required` for an unmapped property must not collapse onto SDD100/102/103.
    expect(pathToCode(err({ keyword: 'required', params: { missingProperty: 'whatChanges' } }))).toBe(UNMAPPED_CODE);
  });
});

describe('ajvToCliErrors + formatError', () => {
  it('scenario: maps errors and annotates missing-required properties', () => {
    const out = ajvToCliErrors(
      [err({ instancePath: '/tasks/0/specRefs', keyword: 'minItems' })],
      'openspec/changes/x/tasks.md',
      3,
      1,
    );
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ code: 'SDD010', line: 3, col: 1 });
  });

  it('scenario: formatError emits posix-separated file:line:col with the code', () => {
    const line = formatError({
      file: 'openspec\\changes\\x\\tasks.md',
      line: 3,
      col: 1,
      code: 'SDD010',
      message: '/tasks/0/specRefs must NOT have fewer than 1 items',
    });
    expect(line).toBe(
      'openspec/changes/x/tasks.md:3:1: SDD010 /tasks/0/specRefs must NOT have fewer than 1 items',
    );
  });

  it('scenario: null/empty ajv errors yield no cli errors', () => {
    expect(ajvToCliErrors(null, 'f', 1, 1)).toEqual([]);
    expect(ajvToCliErrors([], 'f', 1, 1)).toEqual([]);
  });
});
