# Contributing to SuperSpecs

SuperSpecs eats its own dogfood: contributions go through the SDD workflow
the framework teaches.

## Before You Code

1. Read `skills/using-superspecs/SKILL.md` and the **Skip skills when**
   bypass list. Trivial fixes (typo, formatter run, read-only
   inspection) don't need the full machinery.
2. For anything beyond a bypass-case fix:
   - Run `spx:brainstorming` (or the `/brainstorm` slash command
     in Cursor) to surface intent and trade-offs.
   - Open an OpenSpec change folder under
     `openspec/changes/<change-id>/` with at minimum `proposal.md`,
     `design.md` (if non-obvious decisions), `specs/` deltas, and
     `tasks.md`. See `docs/openspec-walkthrough.md`.
   - Get the proposal approved (in PR comments or the chat) **before**
     writing implementation code.

## Authoring a Skill

See `docs/skill-authoring.md` for the conventions:

- Cross-reference notation: `spx:<name>`.
- Frontmatter required (`name`, `description`).
- File layout: `skills/<skill-name>/SKILL.md` plus helper files in the
  same folder.
- Red-Green-Refactor is a **skill-authoring meta-process only** — do
  not generalize it to production code workflows.

Skill changes that affect behaviour must come with an eval. The full
eval runner and corpus land in Phase C / Finding 4; until then, follow
`skills/writing-skills/testing-skills-with-subagents.md`.

## Running Evals

The eval runner is a Phase C / Finding 4 deliverable. Once it lands:

```powershell
pwsh ./scripts/run-skill-evals.ps1
# or, on macOS / Linux
./scripts/run-skill-evals.sh
```

Until then, manually run the pressure scenarios documented in each
relevant skill's `testing-*` companion files.

## Commit Message Conventions

Use [Conventional Commits](https://www.conventionalcommits.org/), scoped
by area:

- `feat(<change-id>): add <thing>` — implementation behind a proposal.
- `fix(<skill-name>): <what>` — skill or behaviour fix.
- `docs(<area>): <what>` — documentation only.
- `chore(<area>): <what>` — repo hygiene.
- `test(<change-id>): <what>` — verification artifacts.

When a commit closes one of the numbered audit findings, tag it:
`fix(skills): ... (F7)`.

## Pull Request Checklist

- [ ] Change folder opened under `openspec/changes/<change-id>/` (skip
      for bypass-case fixes).
- [ ] Skill evals (if the change touched `skills/**`) updated and
      passing.
- [ ] `CHANGELOG.md` updated under `## [Unreleased]`.
- [ ] Any local `scripts/` tooling (not tracked) reads from
      `git config --get remote.origin.url`; no hard-coded user/repo
      strings.
- [ ] `Grep` for `docs/specs` in `skills/` returns no actionable hits
      (the only allowed reference is the negation sentence in
      `skills/brainstorming/SKILL.md`).
- [ ] All cross-skill references use the canonical `spx:<name>`
      form (see `docs/skill-authoring.md`).
- [ ] If the change touched a flowchart in a SKILL.md, the terminal
      node text matches the prose that introduces and follows it.

## Code of Conduct

Be excellent. We're here to make agents better, not to score points.
