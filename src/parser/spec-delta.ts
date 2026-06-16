import { parseMarkdown, headingText, flattenPhrasing, pos, type ParserError, type Position } from './shared.js';
import type { Root, Heading, List } from 'mdast';

export interface ScenarioAst {
  name: string;
  given: string;
  when: string;
  then: string;
}

export interface RequirementAst {
  name: string;
  body: string;
  scenarios: ScenarioAst[];
}

export interface SpecDeltaAst {
  capability: string;
  deltas: {
    added: RequirementAst[];
    modified: RequirementAst[];
    removed: RequirementAst[];
  };
}

/**
 * Source positions for each requirement and scenario, kept on the side
 * (parallel to SpecDeltaAst) so the AST itself stays schema-clean
 * (spec-delta.schema.json uses additionalProperties: false). Mirrors the
 * `ProposalPositions` / `TasksPositions` side-channels in the sibling
 * parsers, so the validator never has to strip metadata before ajv runs.
 *
 * The shape mirrors `deltas`: `positions.added[reqIdx]` is the
 * requirement heading position; `positions.added[reqIdx].scenarios[sIdx]`
 * is the scenario heading position.
 */
export interface RequirementPositions {
  position: Position;
  scenarios: Position[];
}

export interface SpecDeltaPositions {
  added: RequirementPositions[];
  modified: RequirementPositions[];
  removed: RequirementPositions[];
}

export interface SpecDeltaParseResult {
  ast: SpecDeltaAst;
  positions: SpecDeltaPositions;
  errors: ParserError[];
}

type DeltaSection = 'added' | 'modified' | 'removed' | null;

function gwtFromList(list: List): { given: string; when: string; then: string } {
  const out = { given: '', when: '', then: '' };
  for (const item of list.children) {
    const para = item.children[0];
    if (!para || para.type !== 'paragraph') continue;
    const raw = flattenPhrasing((para).children);
    const m = raw.match(/^\s*\*\*(GIVEN|WHEN|THEN)\*\*\s*(.*)$/s);
    if (!m) continue;
    const key = m[1] as 'GIVEN' | 'WHEN' | 'THEN';
    const value = m[2].trim();
    if (key === 'GIVEN') out.given = value;
    else if (key === 'WHEN') out.when = value;
    else out.then = value;
  }
  return out;
}

export function parseSpecDelta(text: string, file: string): SpecDeltaParseResult {
  const root: Root = parseMarkdown(text);
  const errors: ParserError[] = [];
  const ast: SpecDeltaAst = {
    capability: '',
    deltas: { added: [], modified: [], removed: [] },
  };
  const positions: SpecDeltaPositions = { added: [], modified: [], removed: [] };

  // # <capability> — delta for <change-id>
  const top = root.children.find((c): c is Heading => c.type === 'heading' && c.depth === 1);
  if (top) {
    const t = headingText(top);
    const m = t.match(/^([A-Za-z0-9._-]+)\s*[—-]/);
    ast.capability = m ? m[1] : t.split(/\s+/)[0] || '';
  }

  let currentSection: DeltaSection = null;
  let currentReq: RequirementAst | null = null;
  let currentReqPos: RequirementPositions | null = null;
  const reqBodyBuf: string[] = [];

  const flushReq = () => {
    if (currentReq && currentReqPos && currentSection) {
      currentReq.body = reqBodyBuf.join('\n').trim();
      ast.deltas[currentSection].push(currentReq);
      positions[currentSection].push(currentReqPos);
    }
    currentReq = null;
    currentReqPos = null;
    reqBodyBuf.length = 0;
  };

  for (let i = 0; i < root.children.length; i++) {
    const node = root.children[i];

    if (node.type === 'heading') {
      const h = node;
      const text = headingText(h);

      if (h.depth === 2) {
        flushReq();
        if (/^ADDED Requirements$/i.test(text)) currentSection = 'added';
        else if (/^MODIFIED Requirements$/i.test(text)) currentSection = 'modified';
        else if (/^REMOVED Requirements$/i.test(text)) currentSection = 'removed';
        else currentSection = null;
        continue;
      }

      if (h.depth === 3 && currentSection && /^Requirement:\s*/i.test(text)) {
        flushReq();
        const name = text.replace(/^Requirement:\s*/i, '').trim();
        currentReq = {
          name,
          body: '',
          scenarios: [],
        };
        currentReqPos = { position: pos(h), scenarios: [] };
        continue;
      }

      if (h.depth === 4 && currentReq && currentReqPos && /^Scenario:\s*/i.test(text)) {
        const name = text.replace(/^Scenario:\s*/i, '').trim();
        const next = root.children[i + 1];
        const gwt =
          next && next.type === 'list'
            ? gwtFromList(next)
            : { given: '', when: '', then: '' };
        currentReq.scenarios.push({
          name,
          ...gwt,
        });
        currentReqPos.scenarios.push(pos(h));
        continue;
      }

      // Any other heading inside a section without an active requirement
      // (e.g. depth 4+ noise) is ignored.
      continue;
    }

    // Non-heading nodes contribute to the requirement body up until the
    // first scenario heading. Once a scenario has been recorded, further
    // paragraph content is treated as additional scenario context (kept
    // out of body for now — the body is the normative SHALL statement
    // immediately under the requirement heading).
    if (currentReq && currentReq.scenarios.length === 0 && node.type === 'paragraph') {
      const s = flattenPhrasing((node).children).trim();
      if (s) reqBodyBuf.push(s);
    }
  }
  flushReq();

  // Detect duplicate requirement names within the same delta section.
  // Positions come from the parallel side-channel (same index as the AST).
  // Normalize the path embedded in the message to posix separators so the
  // `file:line:col` reference stays clickable on Windows (mirrors
  // `formatError` in schema/errors.ts).
  const filePosix = file.replace(/\\/g, '/');
  for (const sec of ['added', 'modified', 'removed'] as const) {
    const seen = new Map<string, Position>();
    ast.deltas[sec].forEach((r, idx) => {
      const reqPos = positions[sec][idx].position;
      const prior = seen.get(r.name);
      if (prior) {
        errors.push({
          file,
          line: reqPos.line,
          col: reqPos.col,
          code: 'SDD050',
          message: `duplicate requirement name "${r.name}" (also at ${filePosix}:${prior.line}:${prior.col})`,
        });
      } else {
        seen.set(r.name, reqPos);
      }
    });
  }

  return { ast, positions, errors };
}
