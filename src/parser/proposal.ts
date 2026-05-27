import { parseMarkdown, headingText, flattenPhrasing, type ParserError } from './shared.js';
import type { Heading, Paragraph, List, ListItem } from 'mdast';

export interface ProposalAst {
  title: string;
  sections: {
    why: string;
    whatChanges: string[];
    outOfScope: string[];
    impact: string;
  };
}

export function parseProposal(text: string, _file: string): { ast: ProposalAst; errors: ParserError[] } {
  const root = parseMarkdown(text);
  const errors: ParserError[] = [];

  const top = root.children.find((c): c is Heading => c.type === 'heading' && c.depth === 1);
  const title = top ? headingText(top) : '';

  const sections: ProposalAst['sections'] = {
    why: '',
    whatChanges: [],
    outOfScope: [],
    impact: '',
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
      const h = node as Heading;
      if (h.depth === 2) {
        flushProse();
        const t = headingText(h).toLowerCase();
        if (t === 'why') current = 'why';
        else if (t === 'what changes') current = 'whatChanges';
        else if (t === 'out of scope') current = 'outOfScope';
        else if (t === 'impact') current = 'impact';
        else current = null;
      }
      continue;
    }
    if (!current) continue;

    if (node.type === 'paragraph') {
      const s = flattenPhrasing((node as Paragraph).children).trim();
      if (s) proseBuf.push(s);
    } else if (node.type === 'list') {
      if (current === 'whatChanges' || current === 'outOfScope') {
        for (const item of (node as List).children as ListItem[]) {
          const para = item.children[0];
          if (!para || para.type !== 'paragraph') continue;
          const s = flattenPhrasing((para as Paragraph).children).trim();
          if (s) sections[current].push(s);
        }
      } else if (current === 'why' || current === 'impact') {
        // Prose sections may be authored as bullets; concatenate the
        // bullet bodies into the prose buffer so the resulting string
        // is non-empty for the schema's minLength check.
        for (const item of (node as List).children as ListItem[]) {
          const para = item.children[0];
          if (!para || para.type !== 'paragraph') continue;
          const s = flattenPhrasing((para as Paragraph).children).trim();
          if (s) proseBuf.push(`- ${s}`);
        }
      }
    }
  }
  flushProse();

  return { ast: { title, sections }, errors };
}
