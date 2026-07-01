import { describe, it, expect } from 'vitest';
import type { Root, Heading, Paragraph } from 'mdast';
import {
  parseMarkdown,
  headingText,
  flattenPhrasing,
  pos,
} from '../../src/parser/shared.js';

/** Find the first heading node in a parsed markdown root. */
function firstHeading(root: Root): Heading {
  const h = root.children.find((c): c is Heading => c.type === 'heading');
  if (!h) throw new Error('no heading found');
  return h;
}

/** Find the first paragraph node in a parsed markdown root. */
function firstParagraph(root: Root): Paragraph {
  const p = root.children.find((c): c is Paragraph => c.type === 'paragraph');
  if (!p) throw new Error('no paragraph found');
  return p;
}

describe('parser/shared — parseMarkdown', () => {
  it('scenario: returns an mdast root with parsed children', () => {
    const root = parseMarkdown('# Title\n\nbody text\n');
    expect(root.type).toBe('root');
    expect(root.children.length).toBeGreaterThan(0);
    expect(root.children[0]?.type).toBe('heading');
  });

  it('scenario: parses fenced code as a code node, not a heading', () => {
    // The block extractor relies on this: a `### Requirement:` inside a fence
    // must be a `code` node so it is never treated as a real heading.
    const root = parseMarkdown('```\n### Requirement: Not Real\n```\n');
    const types = root.children.map((c) => c.type);
    expect(types).toContain('code');
    expect(types).not.toContain('heading');
  });
});

describe('parser/shared — headingText', () => {
  it('scenario: concatenates the text content of a heading', () => {
    const root = parseMarkdown('# Hello World\n');
    expect(headingText(firstHeading(root))).toBe('Hello World');
  });

  it('scenario: keeps emphasis/strong text but drops inline-code content, and trims', () => {
    const root = parseMarkdown('#  **Bold** and `code` and *em* \n');
    // headingText visits `text` nodes only: emphasis/strong wrap text nodes
    // (kept), but `inlineCode` is its own node type with no child text node,
    // so its content is omitted entirely. Surrounding whitespace is trimmed.
    expect(headingText(firstHeading(root))).toBe('Bold and  and em');
  });
});

describe('parser/shared — flattenPhrasing', () => {
  it('scenario: preserves strong markup as **...** for GIVEN/WHEN/THEN matching', () => {
    const root = parseMarkdown('**GIVEN** a user is logged in\n');
    const out = flattenPhrasing(firstParagraph(root).children);
    expect(out).toBe('**GIVEN** a user is logged in');
  });

  it('scenario: preserves emphasis and inline code wrappers', () => {
    const root = parseMarkdown('plain *em* and `code` here\n');
    const out = flattenPhrasing(firstParagraph(root).children);
    expect(out).toBe('plain *em* and `code` here');
  });

  it('scenario: nested strong inside emphasis is preserved', () => {
    const root = parseMarkdown('*outer **inner** outer*\n');
    const out = flattenPhrasing(firstParagraph(root).children);
    expect(out).toBe('*outer **inner** outer*');
  });
});

describe('parser/shared — pos', () => {
  it('scenario: returns 1-based line/col from a node position', () => {
    const root = parseMarkdown('\n\n# Heading at line 3\n');
    expect(pos(firstHeading(root))).toEqual({ line: 3, col: 1 });
  });

  it('scenario: falls back to (0, 0) when a node has no position', () => {
    expect(pos({})).toEqual({ line: 0, col: 0 });
  });
});
