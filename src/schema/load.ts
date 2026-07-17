import type { ValidateFunction } from 'ajv';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createAjv } from './ajv.js';

const ajv = createAjv();

/**
 * Canonical schema filenames, single-sourced here so other modules
 * (e.g. `doctor`) reference the same list instead of re-hardcoding it.
 */
export const SCHEMA_FILES = {
  proposal: 'proposal.schema.json',
  specDelta: 'spec-delta.schema.json',
  tasks: 'tasks.schema.json',
  design: 'design.schema.json',
  skillEval: 'skill-eval.schema.json',
} as const;

/** Schemas that core `validate` depends on (must be present). */
export const REQUIRED_SCHEMA_FILES: readonly string[] = [
  SCHEMA_FILES.proposal,
  SCHEMA_FILES.specDelta,
  SCHEMA_FILES.tasks,
  SCHEMA_FILES.design,
];

/**
 * Resolve a schema path. Schemas ship under `schemas/` relative to the
 * compiled module, so resolution is strictly module-relative (independent
 * of the process cwd):
 *   - Installed via npm / package root: `dist/schema/load.js` ->
 *     `<here>/../../schemas/*` is the package's `schemas/`. (The package
 *     also publishes `schemas/` alongside `dist/`.)
 *   - From the package root via `dist/superspecs.js`-style layouts:
 *     `<here>/../schemas/*` covers a flatter `dist/` arrangement.
 * Both candidates are derived from `import.meta.url`, so running the dev
 * build from any subdirectory still finds the schemas. The former
 * `process.cwd()` fallback was removed so an unrelated `schemas/` folder in
 * the current directory can never influence validation.
 */
function schemaPath(name: string): string {
  const here = dirname(fileURLToPath(import.meta.url));
  const candidates = [
    resolve(here, '..', '..', 'schemas', name), // dist/schema/load.js -> repo/package root
    resolve(here, '..', 'schemas', name), // flatter dist/ layouts
  ];
  for (const candidate of candidates) {
    try {
      readFileSync(candidate, 'utf8');
      return candidate;
    } catch (err) {
      // A missing candidate is expected; try the next location. Any OTHER
      // error (e.g. EACCES permission denied) is a real fault that would be
      // masked by silently continuing, so surface it immediately.
      if ((err as NodeJS.ErrnoException)?.code !== 'ENOENT') throw err;
    }
  }
  // Nothing matched; return the primary module-relative path so the
  // caller's readFileSync throws a clear ENOENT against a predictable
  // location rather than against a cwd-dependent one.
  return candidates[0] ?? resolve(here, '..', '..', 'schemas', name);
}

function load(name: string): ValidateFunction {
  const raw = readFileSync(schemaPath(name), 'utf8');
  return ajv.compile(JSON.parse(raw));
}

/**
 * Compile-on-first-use cache. Schemas are compiled lazily (and memoized)
 * so importing this module is cheap and a command only pays for the schemas
 * it actually uses — e.g. `validate` never compiles the eval-only
 * `skill-eval.schema.json`, so a missing/invalid eval schema can't break
 * unrelated commands.
 */
const compiled = new Map<string, ValidateFunction>();

function getValidator(name: string): ValidateFunction {
  let v = compiled.get(name);
  if (!v) {
    v = load(name);
    compiled.set(name, v);
  }
  return v;
}

/**
 * Lazily-compiled validators. The getters preserve the previous call shape
 * (`validators.proposal(ast)` then `validators.proposal.errors`): each getter
 * returns the same memoized `ValidateFunction` instance, so `.errors` after a
 * call still reflects that call.
 */
export const validators = {
  get proposal(): ValidateFunction {
    return getValidator(SCHEMA_FILES.proposal);
  },
  get specDelta(): ValidateFunction {
    return getValidator(SCHEMA_FILES.specDelta);
  },
  get tasks(): ValidateFunction {
    return getValidator(SCHEMA_FILES.tasks);
  },
  get design(): ValidateFunction {
    return getValidator(SCHEMA_FILES.design);
  },
  get skillEval(): ValidateFunction {
    return getValidator(SCHEMA_FILES.skillEval);
  },
};
