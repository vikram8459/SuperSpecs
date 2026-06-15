import fg from 'fast-glob';
import { readFileSync, existsSync } from 'node:fs';
import { join, resolve, relative } from 'node:path';
import type { ErrorObject } from 'ajv';
import { parseProposal, type ProposalPositions } from '../parser/proposal.js';
import { parseSpecDelta, type SpecDeltaAst } from '../parser/spec-delta.js';
import { parseTasks, type TasksAst, type TasksPositions } from '../parser/tasks.js';
import { validators } from '../schema/load.js';
import { ajvToCliErrors, formatError, type CliError } from '../schema/errors.js';
import { validateActiveContent } from './validate-active.js';

/**
 * Strip the parser's position metadata from a spec-delta AST so the
 * schema (which has additionalProperties: false) accepts it.
 */
function stripSpecDeltaPositions(ast: SpecDeltaAst): SpecDeltaAst {
  const strip = (req: SpecDeltaAst['deltas']['added'][number]) => ({
    name: req.name,
    body: req.body,
    scenarios: req.scenarios.map((s) => ({
      name: s.name,
      given: s.given,
      when: s.when,
      then: s.then,
    })),
  });
  return {
    capability: ast.capability,
    deltas: {
      added: ast.deltas.added.map(strip) as SpecDeltaAst['deltas']['added'],
      modified: ast.deltas.modified.map(strip) as SpecDeltaAst['deltas']['modified'],
      removed: ast.deltas.removed.map(strip) as SpecDeltaAst['deltas']['removed'],
    },
  };
}

/**
 * Resolve an ajv error's instancePath back to a (line, col) using the
 * original AST's preserved positions. Falls back to (1, 1) if no match.
 */
function specDeltaErrorPosition(
  ast: SpecDeltaAst,
  e: ErrorObject,
): { line: number; col: number } {
  // Expected paths: /deltas/<section>/<idx>(/scenarios/<sidx>(/then|/given|/when))?
  const m = e.instancePath.match(/^\/deltas\/(added|modified|removed)\/(\d+)(?:\/scenarios\/(\d+))?/);
  if (!m) return { line: 1, col: 1 };
  const section = m[1] as 'added' | 'modified' | 'removed';
  const reqIdx = Number(m[2]);
  const scenIdx = m[3] !== undefined ? Number(m[3]) : undefined;
  const req = ast.deltas[section][reqIdx];
  if (!req) return { line: 1, col: 1 };
  if (scenIdx !== undefined) {
    const sc = req.scenarios[scenIdx];
    if (sc) return sc.position;
  }
  return req.position;
}

function tasksErrorPosition(
  positions: TasksPositions,
  e: ErrorObject,
): { line: number; col: number } {
  // Expected paths: /tasks/<idx>(/specRefs|/files)
  const m = e.instancePath.match(/^\/tasks\/(\d+)/);
  if (!m) return { line: 1, col: 1 };
  const idx = Number(m[1]);
  const p = positions.tasks[idx];
  if (!p) return { line: 1, col: 1 };
  return p;
}

/**
 * Map an ajv error on the proposal AST back to the source position of
 * the offending heading. Paths: /title (SDD103), /sections/why (SDD100),
 * /sections/whatChanges (SDD101), /sections/impact (SDD102), and
 * /sections/outOfScope. A missing-section error resolves to the section's
 * recorded position, which falls back to (1, 1) when the heading is
 * absent entirely. ajv reports a missing required property on the PARENT
 * path (e.g. instancePath "/sections" with params.missingProperty
 * "impact"), so we consult missingProperty too.
 */
function proposalErrorPosition(
  positions: ProposalPositions,
  e: ErrorObject,
): { line: number; col: number } {
  // Direct hits on a named property.
  if (e.instancePath === '/title') return positions.title;
  const secMatch = e.instancePath.match(/^\/sections\/(why|whatChanges|outOfScope|impact)/);
  if (secMatch) return positions[secMatch[1] as keyof ProposalPositions];

  // required-property errors report the parent path + missingProperty.
  if (e.keyword === 'required' && typeof e.params?.missingProperty === 'string') {
    const mp = e.params.missingProperty;
    if (mp === 'title') return positions.title;
    if (mp in positions) return positions[mp as keyof ProposalPositions];
  }
  return { line: 1, col: 1 };
}

function validateChange(repoRoot: string, changeId: string): CliError[] {
  const changeDir = resolve(repoRoot, 'openspec', 'changes', changeId);
  const errors: CliError[] = [];

  // proposal.md
  //
  // Proposal errors map to the offending section heading via the
  // `positions` side-channel (mirrors parseTasks). SDD100 (missing Why),
  // SDD101 (empty What Changes), SDD102 (missing Impact), and SDD103
  // (empty/missing title) now point at the relevant heading, or at
  // (1, 1) when the section heading is absent entirely (CF-E-2 closed).
  const proposalPath = join(changeDir, 'proposal.md');
  if (existsSync(proposalPath)) {
    const text = readFileSync(proposalPath, 'utf8');
    const { ast, positions } = parseProposal(text, proposalPath);
    if (!validators.proposal(ast)) {
      const relPath = relative(repoRoot, proposalPath);
      const ajvErrs = validators.proposal.errors ?? [];
      for (const e of ajvErrs) {
        const p = proposalErrorPosition(positions, e);
        errors.push(...ajvToCliErrors([e], relPath, p.line, p.col));
      }
    }
  }

  // delta spec files under specs/<cap>/spec.md
  const deltaFiles = fg.sync('specs/*/spec.md', { cwd: changeDir, absolute: true });
  for (const f of deltaFiles) {
    const text = readFileSync(f, 'utf8');
    const { ast, errors: parserErrs } = parseSpecDelta(text, relative(repoRoot, f));
    for (const pe of parserErrs) {
      errors.push({
        file: pe.file,
        line: pe.line,
        col: pe.col,
        code: pe.code,
        message: pe.message,
      });
    }
    const validatable = stripSpecDeltaPositions(ast);
    if (!validators.specDelta(validatable)) {
      const relPath = relative(repoRoot, f);
      const ajvErrs = validators.specDelta.errors ?? [];
      for (const e of ajvErrs) {
        const pos = specDeltaErrorPosition(ast, e);
        const mapped = ajvToCliErrors([e], relPath, pos.line, pos.col);
        errors.push(...mapped);
      }
    }
  }

  // tasks.md
  const tasksPath = join(changeDir, 'tasks.md');
  if (existsSync(tasksPath)) {
    const text = readFileSync(tasksPath, 'utf8');
    const { ast, positions, errors: parserErrs } = parseTasks(text, relative(repoRoot, tasksPath));

    // Surface parser-emitted hints (e.g. SDD013: unsupported file-bullet
    // markup) and remember which task indices already have a targeted
    // hint so we can suppress the generic, less-helpful schema error for
    // the same task (CF-B2-1).
    const hintedFilesTaskIdx = new Set<number>();
    for (const pe of parserErrs) {
      errors.push({ file: pe.file, line: pe.line, col: pe.col, code: pe.code, message: pe.message });
      if (pe.code === 'SDD013') {
        const idx = positions.tasks.findIndex((p) => p.line === pe.line && p.col === pe.col);
        if (idx >= 0) hintedFilesTaskIdx.add(idx);
      }
    }

    const safeAst: TasksAst = ast;
    if (!validators.tasks(safeAst)) {
      const relPath = relative(repoRoot, tasksPath);
      const ajvErrs = validators.tasks.errors ?? [];
      for (const e of ajvErrs) {
        // Drop the bare SDD011 (empty files) for a task that already got
        // the more actionable SDD013 hint.
        const filesMatch = e.instancePath.match(/^\/tasks\/(\d+)\/files$/);
        if (filesMatch && e.keyword === 'minItems' && hintedFilesTaskIdx.has(Number(filesMatch[1]))) {
          continue;
        }
        const pos = tasksErrorPosition(positions, e);
        const mapped = ajvToCliErrors([e], relPath, pos.line, pos.col);
        errors.push(...mapped);
      }
    }
  }

  return errors;
}

function listInFlightChanges(repoRoot: string): string[] {
  const changesDir = resolve(repoRoot, 'openspec', 'changes');
  if (!existsSync(changesDir)) return [];
  return fg
    .sync('*/', { cwd: changesDir, onlyDirectories: true })
    .map((p) => p.replace(/\/$/, ''))
    .filter((n) => n !== 'archive');
}

export function runValidate(cwd: string, changeId?: string): number {
  const repoRoot = resolve(cwd);
  const ids = changeId ? [changeId] : listInFlightChanges(repoRoot);

  const allErrors: CliError[] = [];
  for (const id of ids) {
    allErrors.push(...validateChange(repoRoot, id));
  }

  allErrors.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line || a.col - b.col);
  for (const e of allErrors) process.stderr.write(formatError(e) + '\n');

  if (allErrors.length === 0) {
    process.stdout.write(`Validated ${ids.length} change(s); no errors.\n`);
    return 0;
  }
  return 1;
}

/** Validate the active spec set in openspec/specs/ against structural rules. */
export function runValidateActive(cwd: string): number {
  const repoRoot = resolve(cwd);
  const files = fg.sync('openspec/specs/*/spec.md', { cwd: repoRoot, absolute: false });
  let failed = false;
  for (const rel of files) {
    const capability = rel.split('/')[2];
    const errs = validateActiveContent(capability, readFileSync(resolve(repoRoot, rel), 'utf8'));
    for (const e of errs) {
      failed = true;
      process.stderr.write(`${rel}:${e.line}:${e.col}: ${e.code} ${e.message}\n`);
    }
  }
  if (!failed) {
    process.stdout.write(`Active spec set valid (${files.length} capabilities).\n`);
  }
  return failed ? 1 : 0;
}
