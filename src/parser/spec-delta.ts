import { parseMarkdown, headingText, flattenPhrasing, pos, type ParserError } from './shared.js';
import type { Root, Heading, Paragraph, List, ListItem } from 'mdast';

export interface ScenarioAst {
  name: string;
  given: string;
  when: string;
  then: string;
  position: { line: number; col: number };
}

export interface RequirementAst {
  name: string;
  body: string;
  scenarios: ScenarioAst[];
  position: { line: number; col: number };
}

export interface SpecDeltaAst {
  capability: string;
  deltas: {
    added: RequirementAst[];
    modified: RequirementAst[];
    removed: RequirementAst[];
  };
}

export interface SpecDeltaParseResult {
  ast: SpecDeltaAst;
  errors: ParserError[];
}

type DeltaSection = 'added' | 'modified' | 'removed' | null;

function gwtFromList(list: List): { given: string; when: string; then: string } {
  const out = { given: '', when: '', then: '' };
  for (const item of list.children as ListItem[]) {
    const para = item.children[0];
    if (!para || para.type !== 'paragraph') continue;
    const raw = flattenPhrasing((para as Paragraph).children);
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

  // # <capability> — delta for <change-id>
  const top = root.children.find((c): c is Heading => c.type === 'heading' && c.depth === 1);
  if (top) {
    const t = headingText(top);
    const m = t.match(/^([A-Za-z0-9._-]+)\s*[—-]/);
    ast.capability = m ? m[1] : t.split(/\s+/)[0] || '';
  }

  let currentSection: DeltaSection = null;
  let currentReq: RequirementAst | null = null;
  const reqBodyBuf: string[] = [];

  const flushReq = () => {
    if (currentReq && currentSection) {
      currentReq.body = reqBodyBuf.join('\n').trim();
      ast.deltas[currentSection].push(currentReq);
    }
    currentReq = null;
    reqBodyBuf.length = 0;
  };

  for (let i = 0; i < root.children.length; i++) {
    const node = root.children[i];

    if (node.type === 'heading') {
      const h = node as Heading;
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
          position: pos(h),
        };
        continue;
      }

      if (h.depth === 4 && currentReq && /^Scenario:\s*/i.test(text)) {
        const name = text.replace(/^Scenario:\s*/i, '').trim();
        const next = root.children[i + 1];
        const gwt =
          next && next.type === 'list'
            ? gwtFromList(next as List)
            : { given: '', when: '', then: '' };
        currentReq.scenarios.push({
          name,
          ...gwt,
          position: pos(h),
        });
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
      const s = flattenPhrasing((node as Paragraph).children).trim();
      if (s) reqBodyBuf.push(s);
    }
  }
  flushReq();

  // Detect duplicate requirement names within the same delta section.
  for (const sec of ['added', 'modified', 'removed'] as const) {
    const seen = new Map<string, RequirementAst>();
    for (const r of ast.deltas[sec]) {
      const prior = seen.get(r.name);
      if (prior) {
        errors.push({
          file,
          line: r.position.line,
          col: r.position.col,
          code: 'SDD050',
          message: `duplicate requirement name "${r.name}" (also at ${file}:${prior.position.line}:${prior.position.col})`,
        });
      } else {
        seen.set(r.name, r);
      }
    }
  }

  return { ast, errors };
}
