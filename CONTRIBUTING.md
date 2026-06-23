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

Skill changes that affect behaviour must come with an eval. The eval
runner ships as `superspecs eval` and the corpus lives under
`tests/skills/` (see the Running Evals section below). For interactive,
subagent-driven testing while developing a skill, also see
`skills/writing-skills/testing-skills-with-subagents.md`.

## Building, testing, and linting

```bash
npm install      # install dependencies
npm run build    # compile TypeScript to dist/
npm test         # run the vitest suite
npm run lint     # run ESLint over src/, tests/, and root config
npm run lint:fix # auto-fix what ESLint can
```

Linting uses ESLint 9 (flat config in `eslint.config.mjs`) with
`typescript-eslint` recommended rules. The brainstorm-companion
sub-package (`skills/brainstorming/scripts/`) is excluded — it has its
own toolchain. `npm run lint` must exit clean before opening a PR.

## Running Evals

The eval runner ships as the `superspecs eval` CLI subcommand:

```bash
npm run eval     # replay-based skill evals; exits non-zero on any failure
```

Eval scenarios live under `tests/skills/`; see `tests/skills/README.md`
and `docs/skill-evals.md` for the format and the record/replay workflow.

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
- [ ] `npm run lint` and `npm test` both pass.
- [ ] `CHANGELOG.md` updated under `## [Unreleased]`. **CI enforces this**
      for any PR that touches `src/` or `schemas/` (the `changelog` job in
      `.github/workflows/ci.yml`); docs/skills-only PRs are exempt.
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
