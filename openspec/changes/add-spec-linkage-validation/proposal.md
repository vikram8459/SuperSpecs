# Add spec-to-task linkage validation

## Why

SuperSpecs teaches that the spec is the source of truth, but `superspecs validate` only checked each artifact's internal structure. A requirement that no task implements (an orphan delta) passed validation, leaving the "every delta has a task" rule to manual self-review in spx:openspec-propose. This change makes that rule machine-checkable.

## What Changes

- Add cross-artifact linkage validation to `superspecs validate`: every ADDED or MODIFIED requirement in a change's spec deltas must be referenced by at least one task's `Spec:` line, reported as `SDD060`.

## Out of Scope

- Enforcing linkage for REMOVED requirements (deleting a requirement can be pure cleanup with no implementation task).
- Validating that a task's `Spec:` reference points at a requirement that actually exists (the reverse direction).
- Any change to the active-spec archive flow.

## Impact

- **Affected capabilities:** validate
- **Breaking changes:** none. Changes that already pair every requirement with a task are unaffected.
