import type { ErrorObject } from 'ajv';
import type { Diagnostic } from '../util/diagnostics.js';
import { toPosix } from '../util/fs.js';

export type { Diagnostic } from '../util/diagnostics.js';

/** Code used when no rule in the table matches an ajv error. */
export const UNMAPPED_CODE = 'SDD999';

/**
 * Declarative rules mapping an ajv {@link ErrorObject} to an SDD<NNN> code.
 * Each rule matches on the `keyword` plus EITHER an exact `instancePath`,
 * a path `suffix`, or (for `required` errors, which report the parent path)
 * the `missingProperty`. Rules are evaluated in order; the first match wins.
 * A table is easier to audit and unit-test exhaustively than the previous
 * if-ladder. See `schemas/README.md` for the full registry.
 */
interface CodeRule {
  code: string;
  keyword: string;
  path?: string;
  suffix?: string;
  missingProperty?: string;
}

const CODE_RULES: readonly CodeRule[] = [
  // Spec-delta family (SDD001-099)
  { code: 'SDD001', keyword: 'minItems', suffix: '/scenarios' },
  { code: 'SDD002', keyword: 'minLength', suffix: '/then' },
  { code: 'SDD003', keyword: 'minLength', suffix: '/given' },
  { code: 'SDD004', keyword: 'minLength', suffix: '/when' },

  // Tasks family (SDD010-019)
  { code: 'SDD010', keyword: 'minItems', suffix: '/specRefs' },
  { code: 'SDD011', keyword: 'minItems', suffix: '/files' },
  { code: 'SDD012', keyword: 'minItems', path: '/tasks' },

  // Proposal family (SDD100-199)
  { code: 'SDD100', keyword: 'required', missingProperty: 'why' },
  { code: 'SDD102', keyword: 'required', missingProperty: 'impact' },
  { code: 'SDD103', keyword: 'required', missingProperty: 'title' },
  { code: 'SDD101', keyword: 'minItems', path: '/sections/whatChanges' },
  { code: 'SDD103', keyword: 'minLength', path: '/title' },

  // Design family (SDD200-299). The `/sections/decisions` path is unique to
  // the design schema, so it is safe in the shared table. Title errors
  // (`/title`) collide with the proposal's SDD103 rule above, so design
  // title codes are resolved separately by the design validator (see
  // designErrorCode in commands/validate.ts) rather than added here.
  { code: 'SDD201', keyword: 'minItems', path: '/sections/decisions' },
];

/**
 * Map an ajv ErrorObject onto an SDD<NNN> code via {@link CODE_RULES}.
 */
export function pathToCode(e: ErrorObject): string {
  const missing = (e.params as { missingProperty?: string } | undefined)?.missingProperty;
  for (const r of CODE_RULES) {
    if (r.keyword !== e.keyword) continue;
    if (r.path !== undefined && e.instancePath !== r.path) continue;
    if (r.suffix !== undefined && !e.instancePath.endsWith(r.suffix)) continue;
    if (r.missingProperty !== undefined && missing !== r.missingProperty) continue;
    return r.code;
  }
  return UNMAPPED_CODE;
}

/**
 * Map ajv errors to CLI diagnostics. `codeOverride` lets an artifact whose
 * instancePath collides with another schema's rule in the shared
 * {@link CODE_RULES} table (e.g. design.md's `/title` vs proposal's SDD103)
 * resolve its own code; returning undefined falls back to `pathToCode`.
 */
export function ajvToCliErrors(
  ajvErrs: ErrorObject[] | null | undefined,
  file: string,
  fallbackLine: number,
  fallbackCol: number,
  codeOverride?: (e: ErrorObject) => string | undefined,
): Diagnostic[] {
  if (!ajvErrs) return [];
  return ajvErrs.map((e) => {
    const path = e.instancePath || '/';
    const params = e.keyword === 'required'
      ? ` (missing: ${(e.params as { missingProperty?: string }).missingProperty})`
      : '';
    return {
      file,
      line: fallbackLine,
      col: fallbackCol,
      code: codeOverride?.(e) ?? pathToCode(e),
      message: `${path} ${e.message ?? 'invalid'}${params}`,
    };
  });
}

export function formatError(e: Diagnostic): string {
  // Posix-style separators so editors that parse `file:line:col` get
  // a clickable path on every platform.
  return `${toPosix(e.file)}:${e.line}:${e.col}: ${e.code} ${e.message}`;
}
