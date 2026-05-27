# OpenSpec JSON Schemas

These schemas validate the parsed-AST shape of OpenSpec markdown
artefacts. They are produced and consumed by the `superspecs` CLI
(see `bin/superspecs validate`) and by IDE tooling via `$schema`
references.

## Files

| Schema | Validates AST of | Error code prefix |
|--------|------------------|-------------------|
| `proposal.schema.json` | `openspec/changes/<id>/proposal.md` | SDD100–SDD199 |
| `spec-delta.schema.json` | `openspec/changes/<id>/specs/<cap>/spec.md` | SDD001–SDD099 |
| `tasks.schema.json` | `openspec/changes/<id>/tasks.md` | SDD010–SDD019 |

## Error code registry (Phase B1)

| Code | Schema | Meaning |
|------|--------|---------|
| SDD001 | spec-delta | Requirement with empty `scenarios` array |
| SDD002 | spec-delta | Scenario with empty `then` |
| SDD003 | spec-delta | Scenario with empty `given` |
| SDD004 | spec-delta | Scenario with empty `when` |
| SDD010 | tasks | Task with empty `specRefs` |
| SDD011 | tasks | Task with empty `files` |
| SDD012 | tasks | Top-level `tasks` array is empty |
| SDD050 | parser | Duplicate requirement name within a delta section |
| SDD100 | proposal | Missing `## Why` section |
| SDD101 | proposal | Empty `## What Changes` bullet list |
| SDD102 | proposal | Missing `## Impact` section |
| SDD103 | proposal | Missing or empty `# <Title>` heading |

The registry grows as new failure modes are formalized. Codes are
namespaced by prefix so future phases can add safely.

## Usage

### From the CLI

The `superspecs validate` command loads these schemas automatically;
no `$schema` declaration is needed in the markdown source. See
`docs/openspec-walkthrough.md` for the full lifecycle.

### From an IDE (advanced)

When inspecting a parsed-AST JSON file directly (rare), reference
the schema with `$schema`:

```json
{
  "$schema": "https://raw.githubusercontent.com/vikram8459/SuperSpecs/main/schemas/proposal.schema.json",
  "title": "Example",
  "sections": { "why": "...", "whatChanges": ["..."], "outOfScope": [], "impact": "..." }
}
```

## Expected `tasks.md` format (Phase B1)

The Phase B1 parser recognises one task format:

```markdown
- [ ] **<N>. <Task name>**
  - Spec: ADDED/MODIFIED/REMOVED `<Requirement>` in `<capability>`
  - Files: path/to/a.ts, path/to/b.ts
```

The `Spec:` and `Files:` sub-bullets must use inline comma-separated
values (not nested bullets). Variants like `- Create: <path>` and
`- Modify: <path>` are NOT recognised by the parser today; tasks
authored that way will report SDD010 / SDD011.

Widening the parser to accept richer markup is tracked as a
follow-up (Phase B2 / Phase E carry-forward; see TODO.md). Until
then, prefer the strict format for tasks.md files you want
`superspecs validate` to accept.

## Schema-version policy

The schemas are versioned as a set with the `superspecs` package.
Backward-incompatible changes (renames, type tightening, new
`required` fields) require a major version bump and a migration
note in `CHANGELOG.md`. Backward-compatible additions (new optional
fields, new error codes) bump only the minor version.
