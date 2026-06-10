import { parseSpecDelta } from '../parser/spec-delta.js';

export interface ActiveError {
  capability: string;
  line: number;
  col: number;
  code: string;
  message: string;
}

/**
 * Validate the active content for one capability against the structural
 * rules: no duplicate requirement names, and every requirement has at
 * least one scenario.
 *
 * Active spec files use the same `### Requirement:` / `#### Scenario:`
 * grammar as a delta's `## ADDED Requirements` section. We wrap the body
 * under an ADDED heading and reuse `parseSpecDelta` so requirement and
 * scenario nodes (with positions) are produced.
 */
export function validateActiveContent(capability: string, content: string): ActiveError[] {
  const errors: ActiveError[] = [];
  const bodyWithoutTitle = content.replace(/^#[^\n]*\n/, '');
  const wrapped = `# ${capability} — active\n\n## ADDED Requirements\n\n${bodyWithoutTitle}`;
  const { ast } = parseSpecDelta(wrapped, `${capability}/spec.md`);

  const seen = new Map<string, number>();
  for (const req of ast.deltas.added) {
    const prior = seen.get(req.name);
    if (prior !== undefined) {
      errors.push({
        capability,
        line: req.position.line,
        col: req.position.col,
        code: 'SDD050',
        message: `duplicate requirement name "${req.name}"`,
      });
    } else {
      seen.set(req.name, req.position.line);
    }
    if (req.scenarios.length === 0) {
      errors.push({
        capability,
        line: req.position.line,
        col: req.position.col,
        code: 'SDD001',
        message: `requirement "${req.name}" has no scenarios`,
      });
    }
  }
  return errors;
}
