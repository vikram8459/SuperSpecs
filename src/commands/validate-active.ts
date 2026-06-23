import { parseSpecDelta } from '../parser/spec-delta.js';

export interface ActiveError {
  capability: string;
  line: number;
  col: number;
  code: string;
  message: string;
}

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
    const line = lines[i] ?? '';
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
  const { ast, positions, errors: parserErrors } = parseSpecDelta(wrapped, `${capability}/spec.md`);

  // Duplicate-name detection (SDD050) is owned by the parser; reuse its
  // findings rather than re-implementing the rule here.
  for (const pe of parserErrors) {
    if (pe.code === 'SDD050') {
      errors.push({
        capability,
        line: pe.line,
        col: pe.col,
        code: pe.code,
        message: pe.message,
      });
    }
  }

  // SDD001 (requirement with no scenarios) is not a parser-level error, so
  // it is enforced here against the parsed AST.
  ast.deltas.added.forEach((req, idx) => {
    const reqPos = positions.added[idx]?.position;
    if (req.scenarios.length === 0 && reqPos) {
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
