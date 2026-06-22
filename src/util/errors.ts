/**
 * Normalize an unknown thrown value into a human-readable string. Replaces
 * the `err instanceof Error ? err.message : String(err)` idiom that was
 * duplicated across the CLI entry point, archive, eval, and fs helpers.
 */
export function toMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
