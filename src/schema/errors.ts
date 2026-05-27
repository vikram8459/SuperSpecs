import type { ErrorObject } from 'ajv';

export interface CliError {
  file: string;
  line: number;
  col: number;
  code: string;
  message: string;
}

/**
 * Map an ajv ErrorObject onto an SDD<NNN> code. See
 * `schemas/README.md` for the full registry.
 */
function pathToCode(e: ErrorObject): string {
  // Spec-delta family (SDD001-099)
  if (e.instancePath.endsWith('/scenarios') && e.keyword === 'minItems') return 'SDD001';
  if (e.instancePath.endsWith('/then') && e.keyword === 'minLength') return 'SDD002';
  if (e.instancePath.endsWith('/given') && e.keyword === 'minLength') return 'SDD003';
  if (e.instancePath.endsWith('/when') && e.keyword === 'minLength') return 'SDD004';

  // Tasks family (SDD010-019)
  if (e.instancePath.endsWith('/specRefs') && e.keyword === 'minItems') return 'SDD010';
  if (e.instancePath.endsWith('/files') && e.keyword === 'minItems') return 'SDD011';
  if (e.instancePath === '/tasks' && e.keyword === 'minItems') return 'SDD012';

  // Proposal family (SDD100-199)
  if (e.keyword === 'required') {
    const missing = (e.params as { missingProperty?: string }).missingProperty;
    if (missing === 'why') return 'SDD100';
    if (missing === 'impact') return 'SDD102';
    if (missing === 'title') return 'SDD103';
  }
  if (e.instancePath === '/sections/whatChanges' && e.keyword === 'minItems') return 'SDD101';
  if (e.instancePath === '/title' && e.keyword === 'minLength') return 'SDD103';

  // Catch-all for unmapped failure modes.
  return 'SDD999';
}

export function ajvToCliErrors(
  ajvErrs: ErrorObject[] | null | undefined,
  file: string,
  fallbackLine: number,
  fallbackCol: number,
): CliError[] {
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
      code: pathToCode(e),
      message: `${path} ${e.message ?? 'invalid'}${params}`,
    };
  });
}

export function formatError(e: CliError): string {
  // Posix-style separators so editors that parse `file:line:col` get
  // a clickable path on every platform.
  const f = e.file.replace(/\\/g, '/');
  return `${f}:${e.line}:${e.col}: ${e.code} ${e.message}`;
}
