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
/**
 * Strip the leading `# <title>` heading (and anything before it, such as
 * blank lines or YAML front-matter) so the remaining body can be wrapped
 * under a synthetic `## ADDED Requirements` heading. Anchors on the first
 * top-level `#` heading rather than literal line 1, so a title preceded
 * by blank lines or front-matter does not leak into the wrapped body. If
 * there is no top-level heading, the content is returned unchanged.
 */
function stripLeadingTitle(content: string): string {
  const lines = content.split('\n');
  // The top-level title is the first `# <text>` line (exactly one `#`),
  // skipping any leading blank lines or front-matter. Stop scanning at the
  // first `##`+ heading so a spec without a `# ` title is left untouched
  // (rather than swallowing its first `### Requirement:` into the title).
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^#\s/.test(line) || /^#$/.test(line)) {
      return lines.slice(i + 1).join('\n');
    }
    if (/^#{2,}\s/.test(line)) break;
  }
  return content;
}

export function validateActiveContent(capability: string, content: string): ActiveError[] {
  const errors: ActiveError[] = [];
  const bodyWithoutTitle = stripLeadingTitle(content);
  const wrapped = `# ${capability} — active\n\n## ADDED Requirements\n\n${bodyWithoutTitle}`;
  const { ast, positions } = parseSpecDelta(wrapped, `${capability}/spec.md`);

  const seen = new Map<string, number>();
  ast.deltas.added.forEach((req, idx) => {
    const reqPos = positions.added[idx].position;
    const prior = seen.get(req.name);
    if (prior !== undefined) {
      errors.push({
        capability,
        line: reqPos.line,
        col: reqPos.col,
        code: 'SDD050',
        message: `duplicate requirement name "${req.name}"`,
      });
    } else {
      seen.set(req.name, reqPos.line);
    }
    if (req.scenarios.length === 0) {
      errors.push({
        capability,
        line: reqPos.line,
        col: reqPos.col,
        code: 'SDD001',
        message: `requirement "${req.name}" has no scenarios`,
      });
    }
  });
  return errors;
}
