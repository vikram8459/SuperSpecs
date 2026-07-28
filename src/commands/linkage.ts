import type { Position } from '../util/diagnostics.js';

/**
 * A requirement declared in a change's spec deltas, located for diagnostics.
 * `section` is the delta section it appeared under. Only ADDED/MODIFIED are
 * representable: REMOVED requirements are exempt from linkage and are filtered
 * out by the caller before reaching this checker.
 */
export interface LinkageRequirement extends Position {
  capability: string;
  name: string;
  // REMOVED requirements are intentionally not subject to linkage (see
  // validate.ts), so only the sections that require an implementing task
  // are representable here.
  section: 'added' | 'modified';
}

/** A linkage diagnostic (delta requirement not covered by any task). */
export interface LinkageError extends Position {
  code: string;
  message: string;
}

/** Code for "a spec delta requirement is not referenced by any task". */
export const LINKAGE_UNREFERENCED_CODE = 'SDD060';

interface ParsedRef {
  name: string;
  capability: string;
}

/**
 * Parse a task's `Spec:` reference into `{ name, capability }`. The canonical
 * form taught by spx:openspec-propose is:
 *
 *   Spec: ADDED <Requirement Name> in <capability>
 *
 * The leading `ADDED|MODIFIED|REMOVED` verb is optional here (the linkage
 * check only needs which requirement/capability a task claims to implement),
 * backticks around the names are tolerated, and matching is case-insensitive.
 * A reference that does not fit the `... in <capability>` shape yields `null`
 * and simply covers nothing.
 *
 * The name group is greedy so the split anchors on the LAST ` in ` — a
 * requirement whose own name contains " in " (e.g. "Log in flow") referenced
 * as "ADDED Log in flow in auth" parses as name="Log in flow", cap="auth"
 * rather than name="Log", cap="flow in auth".
 */
function parseSpecRef(ref: string): ParsedRef | null {
  const cleaned = ref.replace(/`/g, '').trim();
  const m = cleaned.match(/^(?:ADDED|MODIFIED|REMOVED)?\s*(.+)\s+in\s+(.+?)$/i);
  if (!m) return null;
  // `cleaned` is already trimmed and both capture groups require >= 1
  // character, with the name starting and the capability ending on a
  // non-whitespace char, so neither is empty after normalization.
  const name = (m[1] ?? '').trim().toLowerCase();
  const capability = (m[2] ?? '').trim().toLowerCase();
  return { name, capability };
}

/**
 * Cross-check spec-delta requirements against task references: every
 * requirement declared in a change's spec deltas MUST be referenced by at
 * least one task's `Spec:` line (matched by requirement name + capability).
 *
 * This moves the "every delta has a task" coverage rule out of the
 * spx:openspec-propose skill's manual self-review and into the CLI, so a
 * change that adds a requirement no task implements fails `superspecs
 * validate` rather than passing structural checks silently.
 *
 * Pure and dependency-free so it stays inside the coverage gate; the caller
 * (`validate.ts`) supplies parsed requirements + the flattened task refs.
 */
export function checkLinkage(
  requirements: readonly LinkageRequirement[],
  specRefs: readonly string[],
): LinkageError[] {
  const refs = specRefs
    .map(parseSpecRef)
    .filter((r): r is ParsedRef => r !== null);

  const errors: LinkageError[] = [];
  for (const req of requirements) {
    const reqName = req.name.trim().toLowerCase();
    const reqCap = req.capability.trim().toLowerCase();
    const covered = refs.some((r) => r.name === reqName && r.capability === reqCap);
    if (!covered) {
      errors.push({
        line: req.line,
        col: req.col,
        code: LINKAGE_UNREFERENCED_CODE,
        message:
          `requirement "${req.name}" in ${req.capability} (${req.section.toUpperCase()}) ` +
          `is not referenced by any task in tasks.md — add a task with ` +
          `"Spec: ${req.section.toUpperCase()} ${req.name} in ${req.capability}"`,
      });
    }
  }
  return errors;
}
