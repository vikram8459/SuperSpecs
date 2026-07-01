import { parseMarkdown, headingText, flattenPhrasing, pos, type Diagnostic, type Position } from './shared.js';
import type { Heading } from 'mdast';

export interface ProposalAst {
  title: string;
  sections: {
    why: string;
    whatChanges: string[];
    outOfScope: string[];
    impact: string;
  };
}

/**
 * Source positions for each part of the proposal, kept on the side
 * (parallel to ProposalAst) so the validator can map an ajv error back
 * to the offending heading instead of falling back to (1, 1). Mirrors
 * the `TasksPositions` side-channel in parser/tasks.ts.
 *
 * Each position points at the relevant `## Section` heading (or the
 * `# Title` heading). When a section heading is absent entirely, its
 * position falls back to (1, 1) — the error is "section missing", so
 * there is no better source location than the file start.
 */
export interface ProposalPositions {
  title: Position;
  why: Position;
  whatChanges: Position;
  outOfScope: Position;
  impact: Position;
}

const ORIGIN: Position = { line: 1, col: 1 };

export function parseProposal(
  text: string,
  _file: string,
): { ast: ProposalAst; positions: ProposalPositions; errors: Diagnostic[] } {
  const root = parseMarkdown(text);
  const errors: Diagnostic[] = [];

  const top = root.children.find((c): c is Heading => c.type === 'heading' && c.depth === 1);
  const title = top ? headingText(top) : '';

  const sections: ProposalAst['sections'] = {
    why: '',
    whatChanges: [],
    outOfScope: [],
    impact: '',
  };
  const positions: ProposalPositions = {
    title: top ? pos(top) : { ...ORIGIN },
    why: { ...ORIGIN },
    whatChanges: { ...ORIGIN },
    outOfScope: { ...ORIGIN },
    impact: { ...ORIGIN },
  };
  let current: keyof ProposalAst['sections'] | null = null;
  const proseBuf: string[] = [];

  const flushProse = () => {
    if (current === 'why' || current === 'impact') {
      const joined = proseBuf.join('\n').trim();
      if (joined) sections[current] = joined;
    }
    proseBuf.length = 0;
  };

  for (const node of root.children) {
    if (node.type === 'heading') {
      const h = node;
      if (h.depth === 2) {
        flushProse();
        const t = headingText(h).toLowerCase();
        if (t === 'why') current = 'why';
        else if (t === 'what changes') current = 'whatChanges';
        else if (t === 'out of scope') current = 'outOfScope';
        else if (t === 'impact') current = 'impact';
        else current = null;
        // Record the heading position so a schema error on this section
        // points here rather than at the file start.
        if (current) positions[current] = pos(h);
      }
      continue;
    }
    if (!current) continue;

    if (node.type === 'paragraph') {
      const s = flattenPhrasing((node).children).trim();
      if (s) proseBuf.push(s);
    } else if (node.type === 'list') {
      if (current === 'whatChanges' || current === 'outOfScope') {
        for (const item of (node).children) {
          const para = item.children[0];
          if (!para || para.type !== 'paragraph') continue;
          const s = flattenPhrasing((para).children).trim();
          if (s) sections[current].push(s);
        }
      } else if (current === 'why' || current === 'impact') {
        // Prose sections may be authored as bullets; concatenate the
        // bullet bodies into the prose buffer so the resulting string
        // is non-empty for the schema's minLength check.
        for (const item of (node).children) {
          const para = item.children[0];
          if (!para || para.type !== 'paragraph') continue;
          const s = flattenPhrasing((para).children).trim();
          if (s) proseBuf.push(`- ${s}`);
        }
      }
    }
  }
  flushProse();

  return { ast: { title, sections }, positions, errors };
}
