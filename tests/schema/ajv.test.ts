import { describe, it, expect } from 'vitest';
import { AjvCtor, createAjv } from '../../src/schema/ajv.js';

describe('ajv interop adapter', () => {
  it('scenario: the ajv constructor is resolved from the CommonJS namespace', () => {
    // If ajv changes its publish shape (e.g. drops `.default`), this is the
    // single place that breaks — loudly, here, instead of silently in schema
    // loading.
    expect(typeof AjvCtor).toBe('function');
  });

  it('scenario: a created instance exposes a working compile()', () => {
    const ajv = createAjv();
    expect(typeof ajv.compile).toBe('function');

    const validate = ajv.compile({ type: 'object', required: ['x'], properties: { x: { type: 'number' } } });
    expect(validate({ x: 1 })).toBe(true);
    expect(validate({})).toBe(false);
  });

  it('scenario: allErrors is enabled so multiple violations are collected', () => {
    const ajv = createAjv();
    const validate = ajv.compile({
      type: 'object',
      required: ['a', 'b'],
      properties: { a: { type: 'string' }, b: { type: 'string' } },
    });
    expect(validate({})).toBe(false);
    // With allErrors, both missing-required errors are reported, not just one.
    expect((validate.errors ?? []).length).toBeGreaterThanOrEqual(2);
  });
});
