import { parseMarkdown, headingText, flattenPhrasing, pos, type Diagnostic, type Position } from './shared.js';
import type { Heading } from 'mdast';

/**
 * Parsed AST of an `openspec/changes/<id>/design.md` file. The design doc is
 * intentionally lightweight (see the design.md template in
 * spx:openspec-propose) so only the load-bearing parts are modelled: a title
 * and the list of decisions. `## Context` and `## Alternatives Considered`
 * are recommended but optional, so they are captured for completeness but
 * never required by the schema.
 */
export interface DesignAst {
  title: string;
  sections: {
    context: string;
    decisions: string[];
    alternatives: string[];
  };
}

/**
 * Source positions parallel to DesignAst, kept on the side so the validator
 * can map an ajv error back to the offending heading (mirrors
 * ProposalPositions in parser/proposal.ts).
 */
export interface DesignPositions {
  title: Position;
  context: Position;
  decisions: Position;
  alternatives: Position;
}

const ORIGIN: Position = { line: 1, col: 1 };

type DesignSection = 'context' | 'decisions' | 'alternatives' | null;

/** Classify a `## <text>` design heading. Case-insensitive. */
function classifyDesignSection(text: string): DesignSection {
  const t = text.toLowerCase();
  if (t === 'context') return 'context';
  if (t === 'decisions') return 'decisions';
  if (t === 'alternatives considered' || t === 'alternatives') return 'alternatives';
  return null;
}

export function parseDesign(
  text: string,
  _file: string,
): { ast: DesignAst; positions: DesignPositions; errors: Diagnostic[] } {
  const root = parseMarkdown(text);
  const errors: Diagnostic[] = [];

  const top = root.children.find((c): c is Heading => c.type === 'heading' && c.depth === 1);
  const title = top ? headingText(top) : '';

  const sections: DesignAst['sections'] = {
    context: '',
    decisions: [],
    alternatives: [],
  };
  const positions: DesignPositions = {
    title: top ? pos(top) : { ...ORIGIN },
    context: { ...ORIGIN },
    decisions: { ...ORIGIN },
    alternatives: { ...ORIGIN },
  };

  let current: DesignSection = null;
  const contextBuf: string[] = [];

  const flushContext = () => {
    if (current === 'context') {
      const joined = contextBuf.join('\n').trim();
      if (joined) sections.context = joined;
    }
    contextBuf.length = 0;
  };

  for (const node of root.children) {
    if (node.type === 'heading') {
      if (node.depth === 2) {
        flushContext();
        current = classifyDesignSection(headingText(node));
        if (current) positions[current] = pos(node);
      }
      continue;
    }
    if (!current) continue;

    if (node.type === 'paragraph') {
      if (current === 'context') {
        const s = flattenPhrasing(node.children).trim();
        if (s) contextBuf.push(s);
      }
    } else if (node.type === 'list') {
      if (current === 'decisions' || current === 'alternatives') {
        for (const item of node.children) {
          const para = item.children[0];
          if (!para || para.type !== 'paragraph') continue;
          const s = flattenPhrasing(para.children).trim();
          if (s) sections[current].push(s);
        }
      } else if (current === 'context') {
        for (const item of node.children) {
          const para = item.children[0];
          if (!para || para.type !== 'paragraph') continue;
          const s = flattenPhrasing(para.children).trim();
          if (s) contextBuf.push(`- ${s}`);
        }
      }
    }
  }
  flushContext();

  return { ast: { title, sections }, positions, errors };
}
