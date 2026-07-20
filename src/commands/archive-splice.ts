import {
  extractRequirementBlocks,
  type SpecDeltaAst,
  type RequirementBlock,
} from '../parser/spec-delta.js';

/**
 * Pure spec-delta splice logic for `archive`, extracted from the I/O shell
 * in `archive.ts` so the risky MODIFIED/REMOVED/ADDED edge cases are
 * unit-testable in-process (and therefore covered by the coverage gate,
 * unlike the spawn-only command module).
 */

/** Strip trailing whitespace and terminate `text` with exactly one newline. */
export function endWithSingleNewline(text: string): string {
  return text.replace(/\s+$/, '') + '\n';
}

/**
 * Append a verbatim block to `body`, separated by exactly one blank line:
 * trim `body`'s trailing whitespace, then add `\n\n` and the block. Used
 * when splicing an ADDED requirement (or an absent MODIFIED one) onto the
 * end of the active body.
 */
export function appendBlock(body: string, block: string): string {
  return body.replace(/\s+$/, '') + '\n\n' + block;
}

/**
 * Normalize a verbatim requirement block lifted from a delta file so it can
 * be spliced into the active spec set: trim trailing whitespace and ensure
 * it ends with exactly one newline. The block's interior (body paragraphs,
 * prose between scenarios, bullet shape, etc.) is preserved byte-for-byte —
 * this is the whole point of the source-preserving splice.
 */
export function normalizeBlock(sourceText: string): string {
  return endWithSingleNewline(sourceText);
}

/**
 * An in-place edit against the ORIGINAL body offsets: replace
 * `[start, end)` with `text`. A deletion is just `text === ''`.
 */
export interface SpliceEdit {
  start: number;
  end: number;
  text: string;
}

/**
 * Apply a set of edits expressed against the original body offsets in one
 * right-to-left sweep, so each splice does not invalidate the offsets of
 * the edits still to be applied. Edits must not overlap (callers key edits
 * by a block's original start offset, so at most one edit targets a given
 * requirement block).
 */
export function applyEdits(body: string, edits: SpliceEdit[]): string {
  let out = body;
  for (const e of [...edits].sort((a, b) => b.start - a.start)) {
    out = out.slice(0, e.start) + e.text + out.slice(e.end);
  }
  return out;
}

/**
 * Pure: compute the resulting active content for one capability (no write).
 *
 * `currentBody` is the existing active spec body, or `null` when the
 * capability has no active spec yet (a fresh `# <capability>` heading is
 * synthesized). Requirements are spliced from the delta's VERBATIM source
 * text rather than re-rendered from `RequirementAst`, so multi-paragraph
 * bodies, prose between scenarios, extra bullets, and non-canonical
 * formatting all survive the round-trip. `deltaText` is the raw delta-file
 * source for this capability; `ast` provides the ordered set of
 * added/modified/removed names per section.
 */
export function computeCapabilityAfter(
  currentBody: string | null,
  ast: SpecDeltaAst,
  deltaText: string,
): { after: string; warnings: string[] } {
  const warnings: string[] = [];
  let body = currentBody ?? `# ${ast.capability}\n`;

  // Verbatim source blocks from the delta, looked up by section + name.
  const deltaBlocks = extractRequirementBlocks(deltaText);
  const deltaSource = (section: 'added' | 'modified' | 'removed', name: string): string => {
    const block = deltaBlocks.find((b) => b.section === section && b.name === name);
    // The AST and the block extractor walk the same headings, so a name
    // present in the AST is always present in the blocks; fall back to a
    // minimal heading only as an impossible-case guard.
    return block ? normalizeBlock(block.sourceText) : `### Requirement: ${name}\n`;
  };

  // Parse the active body ONCE and resolve every in-place MODIFIED/REMOVED
  // edit against those original offsets, instead of re-parsing the whole
  // body for each requirement (previously O(reqs x parse)). Edits are keyed
  // by a block's original start offset so at most one edit targets a given
  // block; because REMOVED runs after MODIFIED, a name present in both
  // sections resolves to a deletion (the prior replace is overwritten),
  // exactly reproducing the old "replace in place, then delete" behaviour.
  // Matching consumes blocks in document order so repeated names map to
  // successive occurrences, mirroring the old `.find()`-then-mutate loop.
  const activeBlocks = extractRequirementBlocks(body);
  const unconsumedByName = new Map<string, RequirementBlock[]>();
  for (const b of activeBlocks) {
    const list = unconsumedByName.get(b.name);
    if (list) list.push(b);
    else unconsumedByName.set(b.name, [b]);
  }
  const takeBlock = (name: string): RequirementBlock | null => {
    const list = unconsumedByName.get(name);
    if (!list || list.length === 0) return null;
    return list.shift() ?? null;
  };

  const editByStart = new Map<number, SpliceEdit>();
  const appended: string[] = [];

  for (const req of ast.deltas.modified) {
    const block = takeBlock(req.name);
    const rendered = deltaSource('modified', req.name);
    if (block) {
      editByStart.set(block.start, { start: block.start, end: block.end, text: rendered });
    } else {
      // MODIFIED names a requirement that does not exist in the active set.
      // This is almost always an authoring mistake (wrong name, or it
      // should have been ADDED). We still apply it (append) so the delta is
      // not silently dropped, but we surface a warning so the author can
      // catch the mismatch.
      warnings.push(
        `MODIFIED requirement "${req.name}" was not found in the active set ` +
          `for ${ast.capability}; appending it as if ADDED. Did you mean to ` +
          `ADD it, or is the name misspelled?`,
      );
      appended.push(rendered);
    }
  }
  for (const req of ast.deltas.removed) {
    const block = takeBlock(req.name);
    if (block) {
      // Overwrites any MODIFIED edit at the same offset: replace-then-delete
      // is a delete.
      editByStart.set(block.start, { start: block.start, end: block.end, text: '' });
    } else {
      warnings.push(
        `REMOVED requirement "${req.name}" was not found in the active set ` +
          `for ${ast.capability}; nothing to remove.`,
      );
    }
  }

  body = applyEdits(body, [...editByStart.values()]);
  // Absent-MODIFIED appends happen before ADDED appends, preserving the old
  // ordering (MODIFIED loop ran before the ADDED loop).
  for (const rendered of appended) body = appendBlock(body, rendered);
  for (const req of ast.deltas.added) {
    body = appendBlock(body, deltaSource('added', req.name));
  }
  return { after: endWithSingleNewline(body), warnings };
}
