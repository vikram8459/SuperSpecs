import * as AjvNs from 'ajv';
import type { ValidateFunction } from 'ajv';

/**
 * ajv (8.x) ships as CommonJS without an `exports` map. Under
 * `module: nodenext`, `import * as AjvNs` yields the namespace object and the
 * constructor lives on `.default`. We isolate that fragile interop here (cast
 * through `unknown` to satisfy strict mode) so the rest of the codebase can
 * depend on a clean, typed factory. If ajv adopts an ESM-native publish (see
 * ajv-validator/ajv#1872) or we switch validators, only this file changes.
 *
 * The companion test (tests/schema/ajv.test.ts) asserts the constructor and
 * its `.compile` method are actually present, so a publish-shape change fails
 * loudly in one place instead of silently breaking schema loading.
 */
interface AjvInstance {
  compile: (schema: unknown) => ValidateFunction;
}

type AjvConstructor = new (opts?: Record<string, unknown>) => AjvInstance;

export const AjvCtor = (AjvNs as unknown as { default: AjvConstructor }).default;

/** Create a configured ajv instance used across the schema layer. */
export function createAjv(): AjvInstance {
  return new AjvCtor({ allErrors: true, allowUnionTypes: true });
}
