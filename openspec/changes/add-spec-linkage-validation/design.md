# Design — add-spec-linkage-validation

## Context

`superspecs validate` composes four per-artifact validators in `src/commands/validate.ts`. Linkage is the first rule that spans two artifacts (spec deltas plus `tasks.md`), so it reads both before deciding.

## Decisions

- **Match by name + capability:** each task `Spec:` reference is parsed as `<verb> <name> in <capability>`; a requirement is covered when some reference matches both its name and capability, case-insensitively and ignoring backticks. This is precise against the canonical propose format and avoids cross-capability name collisions.
- **Pure core in `src/commands/linkage.ts`:** the matching logic is dependency-free so it stays inside the coverage gate; `validate.ts` supplies the parsed requirements and the flattened task references.

## Alternatives Considered

- Substring match on the requirement name alone. Rejected: two same-named requirements in different capabilities would satisfy each other's linkage.
