import { parseMarkdown, headingText, flattenPhrasing, pos, type Diagnostic, type Position } from './shared.js';
import { toPosix } from '../util/fs.js';
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
  errors: Diagnostic[];
}

type DeltaSection = 'added' | 'modified' | 'removed' | null;

/** Matches a `### Requirement:` heading; capture-free prefix test + strip. */
const REQUIREMENT_HEADING_RE = /^Requirement:\s*/i;
/** Matches a `#### Scenario:` heading. */
const SCENARIO_HEADING_RE = /^Scenario:\s*/i;

/**
 * Classify a `## <text>` delta-section heading into its `DeltaSection`.
 * Shared by `extractRequirementBlocks` and `parseSpecDelta` so the section
 * heading vocabulary lives in exactly one place.
 */
function classifyDeltaSection(headingTextValue: string): DeltaSection {
  if (/^ADDED Requirements$/i.test(headingTextValue)) return 'added';
  if (/^MODIFIED Requirements$/i.test(headingTextValue)) return 'modified';
  if (/^REMOVED Requirements$/i.test(headingTextValue)) return 'removed';
  return null;
}

/** True if a depth-3 heading text is a `Requirement:` heading. */
function isRequirementHeading(headingTextValue: string): boolean {
  return REQUIREMENT_HEADING_RE.test(headingTextValue);
}

/** Strip the `Requirement:` prefix and surrounding whitespace from a heading. */
function requirementName(headingTextValue: string): string {
  return headingTextValue.replace(REQUIREMENT_HEADING_RE, '').trim();
}

/**
 * A `### Requirement:` block located by source offset, with its verbatim
 * source text. Used by the archive command to splice requirements between
 * documents without re-rendering them through the lossy `RequirementAst`
 * (which only models name + a single body paragraph + GIVEN/WHEN/THEN per
 * scenario, and would silently drop multi-paragraph bodies, prose between
 * scenarios, extra bullets, and non-canonical formatting).
 *
 * `start`/`end` are character offsets into the source string such that
 * `source.slice(start, end)` is `sourceText`. `end` is the start of the
 * next `### Requirement:` (or `##`+) heading, or the end of source.
 */
export interface RequirementBlock {
  name: string;
  section: DeltaSection;
  start: number;
  end: number;
  sourceText: string;
}

function headingStartOffset(h: Heading): number | undefined {
  return h.position?.start.offset;
}

/**
 * Locate every `### Requirement:` block in `source` by source offset,
 * preserving verbatim text. Requirement headings inside fenced code blocks
 * are never matched because remark parses fences as `code` nodes, not
 * headings — so this is structurally immune to the fence ambiguity the
 * previous regex scanner had to special-case.
 *
 * Each block runs from its `###` heading offset up to (but not including)
 * the next `### Requirement:` heading, the next `##`+ section heading, or
 * the end of source — whichever comes first. The `section` field reflects
 * the most recent `## ADDED|MODIFIED|REMOVED Requirements` heading seen
 * (null for active spec files, which have no section wrapper).
 */
export function extractRequirementBlocks(source: string): RequirementBlock[] {
  const root: Root = parseMarkdown(source);
  const headings = root.children.filter(
    (c): c is Heading => c.type === 'heading',
  );

  // Boundary offsets: any `### Requirement:` or any `##`+ heading ends the
  // preceding requirement block.
  const boundaries: number[] = [];
  for (const h of headings) {
    const off = headingStartOffset(h);
    if (off === undefined) continue;
    const text = headingText(h);
    if (h.depth <= 2) {
      boundaries.push(off);
    } else if (h.depth === 3 && isRequirementHeading(text)) {
      boundaries.push(off);
    }
  }
  boundaries.sort((a, b) => a - b);

  const nextBoundary = (after: number): number => {
    for (const b of boundaries) {
      if (b > after) return b;
    }
    return source.length;
  };

  const blocks: RequirementBlock[] = [];
  let section: DeltaSection = null;
  for (const h of headings) {
    const off = headingStartOffset(h);
    if (off === undefined) continue;
    const text = headingText(h);

    if (h.depth === 2) {
      section = classifyDeltaSection(text);
      continue;
    }

    if (h.depth === 3 && isRequirementHeading(text)) {
      const name = requirementName(text);
      const end = nextBoundary(off);
      blocks.push({
        name,
        section,
        start: off,
        end,
        sourceText: source.slice(off, end),
      });
    }
  }
  return blocks;
}

function gwtFromList(list: List): { given: string; when: string; then: string } {
  const out = { given: '', when: '', then: '' };
  for (const item of list.children) {
    const para = item.children[0];
    if (!para || para.type !== 'paragraph') continue;
    const raw = flattenPhrasing((para).children);
    const m = raw.match(/^\s*\*\*(GIVEN|WHEN|THEN)\*\*\s*(.*)$/s);
    if (!m) continue;
    const key = m[1] as 'GIVEN' | 'WHEN' | 'THEN';
    const value = (m[2] ?? '').trim();
    if (key === 'GIVEN') out.given = value;
    else if (key === 'WHEN') out.when = value;
    else out.then = value;
  }
  return out;
}

export function parseSpecDelta(text: string, file: string): SpecDeltaParseResult {
  const root: Root = parseMarkdown(text);
  const errors: Diagnostic[] = [];
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
    ast.capability = (m ? m[1] : t.split(/\s+/)[0]) ?? '';
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
    if (!node) continue;

    if (node.type === 'heading') {
      const h = node;
      const text = headingText(h);

      if (h.depth === 2) {
        flushReq();
        currentSection = classifyDeltaSection(text);
        continue;
      }

      if (h.depth === 3 && currentSection && isRequirementHeading(text)) {
        flushReq();
        const name = requirementName(text);
        currentReq = {
          name,
          body: '',
          scenarios: [],
        };
        currentReqPos = { position: pos(h), scenarios: [] };
        continue;
      }

      if (h.depth === 4 && currentReq && currentReqPos && SCENARIO_HEADING_RE.test(text)) {
        const name = text.replace(SCENARIO_HEADING_RE, '').trim();
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
  const filePosix = toPosix(file);
  for (const sec of ['added', 'modified', 'removed'] as const) {
    const seen = new Map<string, Position>();
    ast.deltas[sec].forEach((r, idx) => {
      const reqPos = positions[sec][idx]?.position;
      if (!reqPos) return;
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
