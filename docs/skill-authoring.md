# Skill Authoring

This is the human-readable companion to `skills/writing-skills/SKILL.md`.
Read both: the SKILL.md is for the agent; this document is for you.

## What a skill is and isn't

A skill is a **reference guide for a proven technique, pattern, or tool**
that future agent instances can find and apply. Skills are:

- Reusable techniques, patterns, tools, reference guides.

Skills are **not**:

- Narratives about how you solved a problem once.
- Documentation of one-off project decisions (those live in
  `docs/architecture.md` ADRs).
- Tutorials (those go in `docs/`).

## Cross-skill references

All cross-skill references use the canonical form:

    spx:<skill-name>

Bare references (e.g. `openspec-propose` without the `spx:`
prefix) are reserved for:

- The skill's own SKILL.md frontmatter `name:` field
- Code blocks and shell examples
- Filenames and folder paths (`skills/openspec-propose/SKILL.md`)
- Verbatim quotes of the skill slug as a string

Apply this convention in every cross-reference, including prose in
`SKILL.md` files, reviewer/implementer prompts, and documentation
under `docs/`.

See also: `docs/architecture.md` (ADR-002 records this decision).

## Design-notes vs design.md

The validated brainstorming output lives at:

    openspec/changes/<change-id>/design-notes.md

There is no `docs/specs/` path. `spx:openspec-propose` reads
these notes and produces the formal `design.md` inside the same change
folder.

See also: `docs/architecture.md` (ADR-003).

## Red-Green-Refactor scope

`spx:writing-skills` uses a Red-Green-Refactor metaphor — that
applies **only** to the meta-process of authoring skills (you watch an
agent fail without the skill and succeed with it).

It does **not** generalize to production code workflows. Production
code follows `spx:openspec-apply` and the scenario-verification
model documented in `spx:writing-plans` — the spec, not a
failing test, is the source of truth.

## Frontmatter conventions

Every `SKILL.md` starts with YAML frontmatter:

```yaml
---
name: <skill-slug>
description: <one-paragraph "use this when" line that the agent reads at session start>
---
```

- `name` matches the folder name: `skills/<name>/SKILL.md`.
- `description` is loaded by the harness without reading the body, so
  it must be self-contained enough for the agent to decide whether to
  open the full skill.

## File layout

- `skills/<skill-name>/SKILL.md` is mandatory.
- Helper files (reviewer prompts, examples, references) live alongside
  it in the same folder.
- Bundle aggressively only when the helper is the skill's primary
  deliverable; otherwise keep helpers small and link from SKILL.md.

## Eval requirements

Skill changes that affect behaviour must come with an eval. The eval
runner and corpus now ship: write a `*.eval.json` (validated by
`schemas/skill-eval.schema.json`) plus its recorded `*.transcript.md`
under `tests/skills/<skill>/`, then run `npm run eval` to replay it. The
replay model (no model calls or secrets, deterministic in CI) is
documented in [`skill-evals.md`](./skill-evals.md) and
`tests/skills/README.md`. For authoring the pressure scenarios behind an
eval, follow `skills/writing-skills/testing-skills-with-subagents.md`.

## Pre-merge checklist

- [ ] Frontmatter `name` matches the folder name.
- [ ] All cross-skill references use `spx:<name>`.
- [ ] No references to `docs/specs/` (the design-notes path is
      `openspec/changes/<change-id>/design-notes.md`).
- [ ] If the skill describes a process for production code, the
      Red-Green-Refactor metaphor is NOT used as a primary frame.
- [ ] If the skill has a flowchart, the terminal node text matches the
      prose immediately before/after it.
