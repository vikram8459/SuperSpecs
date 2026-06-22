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
  skillEval: 'skill-eval.schema.json',
} as const;

/** Schemas that core `validate` depends on (must be present). */
export const REQUIRED_SCHEMA_FILES: readonly string[] = [
  SCHEMA_FILES.proposal,
  SCHEMA_FILES.specDelta,
  SCHEMA_FILES.tasks,
];

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
    } catch (err) {
      // A missing candidate is expected; try the next location. Any OTHER
      // error (e.g. EACCES permission denied) is a real fault that would be
      // masked by silently continuing, so surface it immediately.
      if ((err as NodeJS.ErrnoException)?.code !== 'ENOENT') throw err;
    }
  }
  // Nothing matched; return the cwd path so the caller's readFileSync
  // throws a clear ENOENT against a predictable location.
  return candidates[candidates.length - 1] ?? resolve(process.cwd(), 'schemas', name);
}

function load(name: string): ValidateFunction {
  const raw = readFileSync(schemaPath(name), 'utf8');
  return ajv.compile(JSON.parse(raw));
}

export const validators = {
  proposal: load(SCHEMA_FILES.proposal),
  specDelta: load(SCHEMA_FILES.specDelta),
  tasks: load(SCHEMA_FILES.tasks),
  skillEval: load(SCHEMA_FILES.skillEval),
};
