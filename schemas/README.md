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

## Error code registry

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
the schema with `$schema` using a path relative to the file you are
editing (point it at the schema in this `schemas/` directory):

```json
{
  "$schema": "../schemas/proposal.schema.json",
  "title": "Example",
  "sections": { "why": "...", "whatChanges": ["..."], "outOfScope": [], "impact": "..." }
}
```

## Expected `tasks.md` format

The current parser recognises one task format:

```markdown
- [ ] **<N>. <Task name>**
  - Spec: ADDED/MODIFIED/REMOVED `<Requirement>` in `<capability>`
  - Files: path/to/a.ts, path/to/b.ts
```

The `Spec:` and `Files:` sub-bullets must use inline comma-separated
values (not nested bullets). Variants like `- Create: <path>` and
`- Modify: <path>` are NOT recognised today; tasks authored that
way will report SDD010 / SDD011. Widening the parser to accept
richer markup is on the roadmap. Until then, prefer the strict
format for tasks.md files you want `superspecs validate` to accept.

## Schema-version policy

Each schema records its version in a `$comment` annotation of the form
`"schema-version: <semver> ..."` (a sibling of `$schema` and `title`).
We use `$comment` rather than a custom top-level `version` keyword
because ajv runs in strict mode and rejects unknown keywords; `$comment`
is a reserved JSON Schema annotation that ajv always ignores during
validation. The schemas are versioned **as a set** with the `superspecs`
package, so every schema's recorded version equals the `package.json`
version. A test (`tests/schema/version.test.ts`) enforces this — bumping
the package version without reviewing the schemas fails CI.

Backward-incompatible changes (renames, type tightening, new
`required` fields) require a major version bump and a migration
note in `CHANGELOG.md`. Backward-compatible additions (new optional
fields, new error codes) bump only the minor version.
