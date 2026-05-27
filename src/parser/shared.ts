import { unified } from 'unified';
import remarkParse from 'remark-parse';
import { visit } from 'unist-util-visit';
import type { Root, Heading, Text, PhrasingContent } from 'mdast';

export interface Position {
  line: number;
  col: number;
}

export interface ParserError {
  file: string;
  line: number;
  col: number;
  code: string;
  message: string;
}

const processor = unified().use(remarkParse);

export function parseMarkdown(text: string): Root {
  return processor.parse(text) as Root;
}

export function headingText(node: Heading): string {
  let out = '';
  visit(node, 'text', (n: Text) => {
    out += n.value;
  });
  return out.trim();
}

/**
 * Flatten a list of phrasing-content nodes into plain text. Used to
 * reconstruct the visible body of a paragraph or list item, preserving
 * **strong** content as bare text wrapped in `**…**` so downstream code
 * can pattern-match on `**GIVEN**` etc.
 */
export function flattenPhrasing(nodes: PhrasingContent[]): string {
  let out = '';
  for (const c of nodes) {
    if (c.type === 'text') {
      out += c.value;
    } else if (c.type === 'strong') {
      out += '**' + flattenPhrasing(c.children) + '**';
    } else if (c.type === 'emphasis') {
      out += '*' + flattenPhrasing(c.children) + '*';
    } else if (c.type === 'inlineCode') {
      out += '`' + c.value + '`';
    } else if (c.type === 'break') {
      out += '\n';
    } else if ('value' in c && typeof (c as { value: unknown }).value === 'string') {
      out += (c as { value: string }).value;
    }
  }
  return out;
}

export function pos(node: { position?: { start: { line: number; column: number } } }): Position {
  return {
    line: node.position?.start.line ?? 0,
    col: node.position?.start.column ?? 0,
  };
}
