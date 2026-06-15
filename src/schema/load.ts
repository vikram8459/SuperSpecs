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
 * Resolve a schema path. Schemas ship under `schemas/` in the repo
 * root (when running from source) or under `schemas/` in the package
 * root (when installed via npm). The compiled bin lives at
 * `dist/superspecs.js`, so `<here>/../schemas/*.schema.json` works
 * for the installed case; the from-source case relies on
 * `process.cwd()` being the repo root, which tests guarantee.
 */
function schemaPath(name: string): string {
  const here = dirname(fileURLToPath(import.meta.url));
  const installedPath = resolve(here, '..', 'schemas', name);
  // Prefer the path next to the compiled bin if it exists; otherwise
  // fall back to CWD-relative resolution (dev environment).
  try {
    readFileSync(installedPath, 'utf8');
    return installedPath;
  } catch {
    return resolve(process.cwd(), 'schemas', name);
  }
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
