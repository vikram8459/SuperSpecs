# SuperSpecs workspace

This is SuperSpecs' workspace — the framework dogfoods the
Spec-Driven Development workflow it teaches.

- `specs/<capability>/spec.md` — the active spec set describing the CLI's
  current, shipped behavior (validate, archive, init, hooks).
- `changes/<change-id>/` — in-flight changes (proposal, spec deltas, design,
  tasks). See `add-spec-linkage-validation/` for a worked example.
- `changes/archive/` — changes whose deltas have been folded into the active
  spec set after merge.

CI validates this workspace with the project's own CLI: it always runs
`superspecs validate --active` on the active spec set, and runs
`superspecs validate` over the in-flight change folders on ready (non-draft)
PRs and on pushes to `main`. So the framework must pass the workflow it
teaches. See `CONTRIBUTING.md` and `docs/openspec-walkthrough.md`.
