import type { ErrorObject } from 'ajv';
import type { ProposalPositions } from '../parser/proposal.js';
import type { SpecDeltaPositions } from '../parser/spec-delta.js';
import type { TasksPositions } from '../parser/tasks.js';
import type { DesignPositions } from '../parser/design.js';
import type { Position } from '../util/diagnostics.js';

/**
 * Pure ajv-error → source-position resolvers, extracted from the I/O shell
 * in `validate.ts` so they are unit-testable in-process (and covered by the
 * coverage gate). Each maps an ajv {@link ErrorObject} instancePath back to
 * a `(line, col)` using the parser's parallel `positions` side-channel.
 */

/**
 * Default source position used when an ajv error's instancePath cannot be
 * mapped back to a recorded heading/list position.
 */
export const FALLBACK_POS: Position = { line: 1, col: 1 };

/**
 * Resolve a spec-delta ajv error to a position. Expected instancePaths:
 * `/deltas/<section>/<idx>(/scenarios/<sidx>(/then|/given|/when))?`.
 */
export function specDeltaErrorPosition(positions: SpecDeltaPositions, e: ErrorObject): Position {
  const m = e.instancePath.match(/^\/deltas\/(added|modified|removed)\/(\d+)(?:\/scenarios\/(\d+))?/);
  if (!m) return FALLBACK_POS;
  const section = m[1] as 'added' | 'modified' | 'removed';
  const reqIdx = Number(m[2]);
  const scenIdx = m[3] !== undefined ? Number(m[3]) : undefined;
  const reqPos = positions[section][reqIdx];
  if (!reqPos) return FALLBACK_POS;
  if (scenIdx !== undefined) {
    const sc = reqPos.scenarios[scenIdx];
    if (sc) return sc;
  }
  return reqPos.position;
}

/** Resolve a tasks ajv error to a position. Expected paths: `/tasks/<idx>(/specRefs|/files)`. */
export function tasksErrorPosition(positions: TasksPositions, e: ErrorObject): Position {
  const m = e.instancePath.match(/^\/tasks\/(\d+)/);
  if (!m) return FALLBACK_POS;
  const idx = Number(m[1]);
  return positions.tasks[idx] ?? FALLBACK_POS;
}

/**
 * Map an ajv error on the proposal AST back to the source position of the
 * offending heading. Paths: `/title` (SDD103), `/sections/why` (SDD100),
 * `/sections/whatChanges` (SDD101), `/sections/impact` (SDD102), and
 * `/sections/outOfScope`. A missing-section error resolves to the section's
 * recorded position, which falls back to (1, 1) when the heading is absent
 * entirely. ajv reports a missing required property on the PARENT path (e.g.
 * instancePath `/sections` with params.missingProperty `impact`), so we
 * consult missingProperty too.
 */
export function proposalErrorPosition(positions: ProposalPositions, e: ErrorObject): Position {
  // Direct hits on a named property.
  if (e.instancePath === '/title') return positions.title;
  const secMatch = e.instancePath.match(/^\/sections\/(why|whatChanges|outOfScope|impact)/);
  if (secMatch) return positions[secMatch[1] as keyof ProposalPositions];

  // required-property errors report the parent path + missingProperty.
  if (e.keyword === 'required' && typeof e.params?.missingProperty === 'string') {
    const mp = e.params.missingProperty;
    if (mp === 'title') return positions.title;
    if (mp in positions) return positions[mp as keyof ProposalPositions];
  }
  return FALLBACK_POS;
}

/**
 * Resolve an ajv error on the design AST back to the offending heading.
 * Paths: `/title` (SDD200), `/sections/decisions` (SDD201). Missing-section
 * errors report the parent path + missingProperty.
 */
export function designErrorPosition(positions: DesignPositions, e: ErrorObject): Position {
  if (e.instancePath === '/title') return positions.title;
  if (e.instancePath.startsWith('/sections/decisions')) return positions.decisions;
  if (e.keyword === 'required' && typeof e.params?.missingProperty === 'string') {
    if (e.params.missingProperty === 'title') return positions.title;
  }
  return FALLBACK_POS;
}

/**
 * Design-specific code resolver for instancePaths that collide with another
 * schema's rule in the shared table. The design `/title` (minLength or a
 * missing `title` property) is SDD200; everything else falls through to the
 * shared `pathToCode` (e.g. /sections/decisions → SDD201).
 */
export function designErrorCode(e: ErrorObject): string | undefined {
  const missing = (e.params as { missingProperty?: string } | undefined)?.missingProperty;
  if (e.instancePath === '/title' && e.keyword === 'minLength') return 'SDD200';
  if (e.keyword === 'required' && missing === 'title') return 'SDD200';
  return undefined;
}
