# AGENTS.md

> This file mirrors the SessionStart hook payload so harnesses that load
> `AGENTS.md` (Codex, Gemini, OpenCode, Claude Code) get the same
> instructions Cursor receives via `hooks/session-start.ps1` /
> `hooks/session-start`.

## You are using SuperSpecs

SuperSpecs is a **Spec-Driven Development (SDD)** skills framework. Instead
of jumping straight into code, you:

1. **Brainstorm** the idea into a clear design.
2. **Propose** an OpenSpec change (`proposal.md`, `specs/`, `design.md`,
   `tasks.md`).
3. **Plan** the work as bite-sized tasks linked to spec deltas.
4. **Apply** the change task-by-task, with each task verified against
   the spec.
5. **Archive** the completed change so the active spec set stays current.

The spec — not a failing test — is the source of truth.

## Required first read

Before responding to any request (including clarifying questions), read:

```
skills/using-superspecs/SKILL.md
```

That skill explains the triggering rules, the **Skip skills when** bypass
clause (read-only inspection, formatting, single-line typo fixes,
exploratory shell, direct questions), and the `SUPERSPECS_MODE` knob.

If a skill plausibly applies to the current task (even at 1%
likelihood), read its `SKILL.md` with the Read tool before acting.

## Cross-skill reference convention

Always use the canonical form:

    spx:<skill-name>

Bare references are reserved for the skill's own frontmatter `name:`
field, filenames, code blocks, and verbatim slug quotes. See
`docs/skill-authoring.md`.

## Skill index

- `spx:using-superspecs` — entry point; explains how all the
  other skills plug together.
- `spx:brainstorming` — turn ideas into designs through Socratic
  dialogue; outputs `openspec/changes/<change-id>/design-notes.md`.
- `spx:openspec-propose` — formalize the design into a change
  folder (proposal, spec deltas, design, tasks).
- `spx:writing-plans` — expand `tasks.md` into bite-sized steps;
  each step is tied to the spec delta and scenarios it closes.
- `spx:openspec-apply` — drive each task: spec → verify → commit.
- `spx:subagent-driven-development` — dispatch model (fresh
  subagent per task with two-stage review).
- `spx:executing-plans` — inline execution model (in-session,
  batched, human checkpoints).
- `spx:openspec-archive` — fold completed change into the active
  spec set at `openspec/specs/`.
- `spx:verification-before-completion` — no success claim
  without a fresh run.
- `spx:systematic-debugging` — root-cause discipline.
- `spx:using-git-worktrees` — isolated branch per change.
- `spx:requesting-code-review` — request review against spec
  deltas.
- `spx:receiving-code-review` — handle review feedback.
- `spx:finishing-a-development-branch` — merge / PR / cleanup.
- `spx:dispatching-parallel-agents` — pattern for parallel work.
- `spx:writing-skills` — meta-skill for authoring skills
  (uses a Red-Green-Refactor metaphor scoped to skill-authoring only,
  *not* to production code).

## Configuration

- **`SUPERSPECS_MODE`** — `strict` | `auto` (default) | `manual`.
  Controls how aggressively skills self-trigger. See
  `skills/using-superspecs/SKILL.md`.

## Repository layout

See `docs/architecture.md` for hook contract, OpenSpec folder layout,
and ADRs. See `docs/openspec-walkthrough.md` for a worked example. See
`CONTRIBUTING.md` for how to propose changes.
