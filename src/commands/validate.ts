import { readFileSync, existsSync } from 'node:fs';
import { join, resolve, relative } from 'node:path';
import type { ErrorObject, ValidateFunction } from 'ajv';
import { parseProposal } from '../parser/proposal.js';
import { parseSpecDelta } from '../parser/spec-delta.js';
import { parseTasks, type TasksAst } from '../parser/tasks.js';
import { parseDesign } from '../parser/design.js';
import { validators } from '../schema/load.js';
import { ajvToCliErrors, formatError } from '../schema/errors.js';
import type { Diagnostic, Position } from '../util/diagnostics.js';
import { validateActiveContent } from './validate-active.js';
import {
  specDeltaErrorPosition,
  tasksErrorPosition,
  proposalErrorPosition,
  designErrorPosition,
  designErrorCode,
} from './validate-positions.js';
import {
  listInFlightChanges,
  changeDir as changeDirPath,
  capabilitySpecPath,
  listCapabilities,
  loadSpecDeltas,
  isValidChangeId,
} from '../util/openspec.js';

/**
 * Run an ajv `validate` over `ast` and, on failure, map each error to a
 * diagnostic via `resolvePos` (an optional `codeOverride` handles schemas
 * whose instancePath collides in the shared code table). Centralizes the
 * "validate → for each error resolve position → ajvToCliErrors" loop that
 * each `validate*File` repeated.
 */
function collectAjvErrors(
  validate: ValidateFunction,
  ast: unknown,
  relPath: string,
  resolvePos: (e: ErrorObject) => Position,
  codeOverride?: (e: ErrorObject) => string | undefined,
): Diagnostic[] {
  if (validate(ast)) return [];
  const out: Diagnostic[] = [];
  for (const e of validate.errors ?? []) {
    const p = resolvePos(e);
    out.push(...ajvToCliErrors([e], relPath, p.line, p.col, codeOverride));
  }
  return out;
}

/**
 * Single writer for both validate entry points: emits `--json` to stdout or
 * human-readable diagnostics to stderr, and returns the process exit code.
 * `jsonExtra` supplies the command-specific count field (`changes` or
 * `capabilities`) in the documented key order (`ok`, <count>, `errors`).
 */
function emitValidationResult(
  errors: Diagnostic[],
  opts: ValidateOptions,
  jsonExtra: Record<string, unknown>,
  successMessage: string,
): number {
  const ok = errors.length === 0;
  if (opts.json) {
    process.stdout.write(JSON.stringify({ ok, ...jsonExtra, errors }, null, 2) + '\n');
    return ok ? 0 : 1;
  }
  for (const e of errors) process.stderr.write(formatError(e) + '\n');
  if (ok) process.stdout.write(successMessage + '\n');
  return ok ? 0 : 1;
}

/**
 * Validate `proposal.md` for a change. Proposal errors map to the offending
 * section heading via the `positions` side-channel (mirrors parseTasks).
 * SDD100 (missing Why), SDD101 (empty What Changes), SDD102 (missing
 * Impact), and SDD103 (empty/missing title) point at the relevant heading,
 * or at (1, 1) when the section heading is absent entirely (CF-E-2 closed).
 */
function validateProposalFile(repoRoot: string, changeDir: string): Diagnostic[] {
  const proposalPath = join(changeDir, 'proposal.md');
  if (!existsSync(proposalPath)) return [];
  const text = readFileSync(proposalPath, 'utf8');
  const { ast, positions } = parseProposal(text, proposalPath);
  const relPath = relative(repoRoot, proposalPath);
  return collectAjvErrors(validators.proposal, ast, relPath, (e) =>
    proposalErrorPosition(positions, e),
  );
}

/** Validate every `specs/<cap>/spec.md` delta file for a change. */
function validateSpecDeltaFiles(repoRoot: string, changeDir: string): Diagnostic[] {
  const errors: Diagnostic[] = [];
  for (const delta of loadSpecDeltas(changeDir)) {
    const relPath = relative(repoRoot, delta.absPath);
    const { ast, positions, errors: parserErrs } = parseSpecDelta(delta.text, relPath);
    // Parser errors are already Diagnostics; forward them directly.
    errors.push(...parserErrs);
    // The AST is schema-clean (positions live in the side-channel), so it
    // can be validated directly with no stripping.
    errors.push(
      ...collectAjvErrors(validators.specDelta, ast, relPath, (e) =>
        specDeltaErrorPosition(positions, e),
      ),
    );
  }
  return errors;
}

/** Validate `tasks.md` for a change. */
function validateTasksFile(repoRoot: string, changeDir: string): Diagnostic[] {
  const tasksPath = join(changeDir, 'tasks.md');
  if (!existsSync(tasksPath)) return [];
  const errors: Diagnostic[] = [];
  const text = readFileSync(tasksPath, 'utf8');
  const { ast, positions, errors: parserErrs } = parseTasks(text, relative(repoRoot, tasksPath));

  // Surface parser-emitted hints (e.g. SDD013: unsupported file-bullet
  // markup) and remember which task indices already have a targeted hint
  // so we can suppress the generic, less-helpful schema error for the same
  // task (CF-B2-1). Parser errors are already Diagnostics; forward directly.
  const hintedFilesTaskIdx = new Set<number>();
  for (const pe of parserErrs) {
    errors.push(pe);
    if (pe.code === 'SDD013') {
      const idx = positions.tasks.findIndex((p) => p.line === pe.line && p.col === pe.col);
      if (idx >= 0) hintedFilesTaskIdx.add(idx);
    }
  }

  const safeAst: TasksAst = ast;
  if (!validators.tasks(safeAst)) {
    const relPath = relative(repoRoot, tasksPath);
    for (const e of validators.tasks.errors ?? []) {
      // Drop the bare SDD011 (empty files) for a task that already got the
      // more actionable SDD013 hint.
      const filesMatch = e.instancePath.match(/^\/tasks\/(\d+)\/files$/);
      if (filesMatch && e.keyword === 'minItems' && hintedFilesTaskIdx.has(Number(filesMatch[1]))) {
        continue;
      }
      const pos = tasksErrorPosition(positions, e);
      errors.push(...ajvToCliErrors([e], relPath, pos.line, pos.col));
    }
  }
  return errors;
}

/**
 * Validate `design.md` for a change — but only when the file is present.
 * The design doc is optional (see the design.md template in
 * spx:openspec-propose); an absent design.md is not an error. When present,
 * it must have a non-empty title (SDD200) and at least one decision (SDD201).
 */
function validateDesignFile(repoRoot: string, changeDir: string): Diagnostic[] {
  const designPath = join(changeDir, 'design.md');
  if (!existsSync(designPath)) return [];
  const text = readFileSync(designPath, 'utf8');
  const relPath = relative(repoRoot, designPath);
  const { ast, positions } = parseDesign(text, relPath);
  return collectAjvErrors(
    validators.design,
    ast,
    relPath,
    (e) => designErrorPosition(positions, e),
    designErrorCode,
  );
}

function validateChange(repoRoot: string, changeId: string): Diagnostic[] {
  const changeDir = changeDirPath(repoRoot, changeId);
  return [
    ...validateProposalFile(repoRoot, changeDir),
    ...validateSpecDeltaFiles(repoRoot, changeDir),
    ...validateTasksFile(repoRoot, changeDir),
    ...validateDesignFile(repoRoot, changeDir),
  ];
}

export interface ValidateOptions {
  active?: boolean;
  json?: boolean;
}

export function runValidate(cwd: string, changeId?: string, opts: ValidateOptions = {}): number {
  const repoRoot = resolve(cwd);
  if (changeId !== undefined && !isValidChangeId(changeId)) {
    process.stderr.write(
      `validate: invalid change-id "${changeId}". Use letters, digits, '.', '_', or '-' ` +
        `(a single path segment; no separators or '..').\n`,
    );
    return 1;
  }
  const ids = changeId ? [changeId] : listInFlightChanges(repoRoot);

  const allErrors: Diagnostic[] = [];
  for (const id of ids) {
    allErrors.push(...validateChange(repoRoot, id));
  }

  allErrors.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line || a.col - b.col);

  return emitValidationResult(
    allErrors,
    opts,
    { changes: ids.length },
    `Validated ${ids.length} change(s); no errors.`,
  );
}

/** Validate the active spec set in openspec/specs/ against structural rules. */
export function runValidateActive(cwd: string, opts: ValidateOptions = {}): number {
  const repoRoot = resolve(cwd);
  const capabilities = listCapabilities(repoRoot);
  const errors: Diagnostic[] = [];
  for (const capability of capabilities) {
    const absPath = capabilitySpecPath(repoRoot, capability);
    if (!existsSync(absPath)) continue;
    const relPath = relative(repoRoot, absPath);
    for (const e of validateActiveContent(capability, readFileSync(absPath, 'utf8'))) {
      errors.push({ file: relPath, line: e.line, col: e.col, code: e.code, message: e.message });
    }
  }

  return emitValidationResult(
    errors,
    opts,
    { capabilities: capabilities.length },
    `Active spec set valid (${capabilities.length} capabilities).`,
  );
}
