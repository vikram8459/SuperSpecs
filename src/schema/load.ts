import * as AjvNs from 'ajv';
import type { ValidateFunction } from 'ajv';

// ajv (8.x) ships as CommonJS without an `exports` map; under
// `module: nodenext` the namespace object is what `import * as`
// yields, and the constructor is on `.default`. Cast through
// `unknown` to keep strict mode happy. Revisit if ajv adopts an
// ESM-native publish (see ajv-validator/ajv#1872) or we switch to
// ajv-formats / a different validator.
const AjvCtor = (AjvNs as unknown as {
  default: new (opts?: Record<string, unknown>) => {
    compile: (schema: unknown) => ValidateFunction;
  };
}).default;
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ajv = new AjvCtor({ allErrors: true, allowUnionTypes: true });

/**
 * Resolve a schema path. Schemas ship under `schemas/` relative to the
 * compiled module, so resolution is module-relative (independent of the
 * process cwd):
 *   - Installed via npm / package root: `dist/schema/load.js` ->
 *     `<here>/../../schemas/*` is the package's `schemas/`. (The package
 *     also publishes `schemas/` alongside `dist/`.)
 *   - From the package root via `dist/superspecs.js`-style layouts:
 *     `<here>/../schemas/*` covers a flatter `dist/` arrangement.
 * Both candidates are derived from `import.meta.url`, so running the dev
 * build from any subdirectory still finds the schemas. The `cwd`-relative
 * path is kept only as a last-resort fallback.
 */
function schemaPath(name: string): string {
  const here = dirname(fileURLToPath(import.meta.url));
  const candidates = [
    resolve(here, '..', '..', 'schemas', name), // dist/schema/load.js -> repo/package root
    resolve(here, '..', 'schemas', name), // flatter dist/ layouts
    resolve(process.cwd(), 'schemas', name), // last-resort cwd fallback
  ];
  for (const candidate of candidates) {
    try {
      readFileSync(candidate, 'utf8');
      return candidate;
    } catch {
      // Try the next candidate.
    }
  }
  // Nothing matched; return the cwd path so the caller's readFileSync
  // throws a clear ENOENT against a predictable location.
  return candidates[candidates.length - 1];
}

function load(name: string): ValidateFunction {
  const raw = readFileSync(schemaPath(name), 'utf8');
  return ajv.compile(JSON.parse(raw));
}

export const validators = {
  proposal: load('proposal.schema.json'),
  specDelta: load('spec-delta.schema.json'),
  tasks: load('tasks.schema.json'),
  skillEval: load('skill-eval.schema.json'),
};
