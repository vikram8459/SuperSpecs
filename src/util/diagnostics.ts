/**
 * Shared diagnostic shapes used across the parser, schema, and command
 * layers. Before this module, `ParserError` (parser/shared.ts), `CliError`
 * (schema/errors.ts), and an inline `SourcePos` (commands/validate.ts) were
 * three byte-identical declarations copied field-by-field between layers.
 * Centralizing them removes that duplication and the manual copies.
 *
 * `ActiveError` (commands/validate-active.ts) is intentionally NOT unified
 * here: it is keyed by `capability` (not `file`) because its findings are
 * consumed by the archive command (`planIsSafe` reads `e.capability`) before
 * a concrete file path is known.
 */

/** A source position (1-based line/column). */
export interface Position {
  line: number;
  col: number;
}

/**
 * A file-attributed diagnostic: an `SDDnnn`-coded message anchored to a
 * `file:line:col` location. Emitted by parsers (semantic errors like
 * SDD050/SDD013) and by the schema layer (ajv errors mapped to SDD codes),
 * and rendered by `formatError`.
 */
export interface Diagnostic extends Position {
  file: string;
  code: string;
  message: string;
}
