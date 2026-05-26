# SuperSpecs Architecture

## Overview

SuperSpecs is a Cursor plugin (today; multi-tool in scope per Finding 2
of the 2026-05-26 audit) that injects **Spec-Driven Development (SDD)**
discipline into an agent session via a `SessionStart` hook and a set of
`SKILL.md` files the agent loads on demand.

The spec — not a failing test — is the source of truth. Every task
either implements a delta in the spec, or it shouldn't be in the plan.

## Hook contract

`hooks/session-start.ps1` (Windows) and `hooks/session-start` (POSIX)
emit a JSON envelope on stdout of the shape:

```json
{ "additional_context": "<envelope>" }
```

The `<envelope>` body is the literal contents of
`skills/using-superspecs/SKILL.md`, wrapped in an
`<EXTREMELY_IMPORTANT>` block. The two scripts are kept byte-for-byte
identical after LF normalization. See the in-script contract comment
at the top of `hooks/session-start.ps1`.

`AGENTS.md` mirrors the same payload so non-Cursor harnesses (Codex,
Gemini, OpenCode, Claude Code) that don't run the hook still get the
same instructions on session start.

## Skill discovery

- Skills live at `skills/<skill-name>/SKILL.md`.
- The Cursor plugin loader reads each skill's frontmatter `name` and
  `description` at session start.
- Agents invoke a skill by reading its `SKILL.md` with the Read tool
  before acting. See `spx:using-superspecs` for the triggering
  rules and the **Skip skills when** bypass clause.

## Slash-command lifecycle

`commands/<name>.md` files map a slash command to a skill invocation:

| Command          | Hands off to skill                |
|------------------|-----------------------------------|
| `/brainstorm`    | `spx:brainstorming`        |
| `/propose`       | `spx:openspec-propose`     |
| `/write-plan`    | `spx:writing-plans`        |
| `/execute-plan`  | `spx:openspec-apply` (+ dispatch model) |
| `/archive`       | `spx:openspec-archive`     |

Current commands are 1–2-sentence wrappers. Finding 11 (Phase B) turns
them into thin orchestrators over the planned CLI from Finding 1.

## OpenSpec folder layout

```
openspec/
  specs/                          # active spec set (post-archive)
    <capability>/spec.md
  changes/                        # in-flight changes
    <change-id>/
      proposal.md                 # why & what
      design.md                   # non-obvious decisions
      design-notes.md             # brainstorming output (input to openspec-propose)
      tasks.md                    # checklist linked to deltas
      plan.md                     # bite-sized steps (from writing-plans)
      specs/<capability>/spec.md  # ADDED / MODIFIED / REMOVED deltas
    archive/                      # archived changes
      YYYY-MM-DD-<change-id>/
```

## Configuration knobs

- **`SUPERSPECS_MODE`** — `strict` | `auto` (default) | `manual`. Controls
  how aggressively skills self-trigger. Documented but not yet enforced
  at runtime. See `skills/using-superspecs/SKILL.md`.
- **`SUPERSPECS_DISABLE`** — planned (Finding 8.1, Phase B). When set to
  `1`, the SessionStart hook emits an empty envelope and exits 0.
- **`SUPERSPECS_TELEMETRY`** — planned (Finding 8.3, Phase E). Opt-in;
  disabled by default and in CI.

## Architecture Decision Records (ADRs)

### ADR-001 — `releases/` and `scripts/` policy

**Date:** 2026-05-26 · **Status:** Accepted

#### Decision

- **`releases/`** — Option B (recommended). Releases ship via GitHub
  Release attachments, not committed binaries. The `.gitignore` line
  stays. The folder is not tracked.
- **`scripts/`** — Kept local. Build/release scripts live in the
  working tree but are NOT tracked; the `.gitignore` line stays in
  place. The script is still parameterized (ADR-004) so any maintainer
  who creates a local `scripts/release.ps1` against a fork's remote
  works without script edits.

#### Consequences

- The existing `scripts/release.ps1` is intentionally not committed.
- Maintainers create or share the release tooling out-of-band.
- Binary release archives are not in git history.

### ADR-002 — Cross-reference notation

**Date:** 2026-05-26 · **Status:** Accepted

#### Decision

All cross-skill references use `spx:<skill-name>`. Bare references
are reserved for the skill's own frontmatter `name:`, filenames, code
blocks, and verbatim slug quotes. See `docs/skill-authoring.md`.

#### Consequences

- Future tooling that auto-resolves references only has to handle one form.
- Human readers can spot a skill reference at a glance.

### ADR-003 — Design-notes canonical path

**Date:** 2026-05-26 · **Status:** Accepted

#### Decision

Brainstorming output lives at
`openspec/changes/<change-id>/design-notes.md`. The legacy
`docs/specs/...` path is removed.

#### Consequences

- One source of truth for design notes; `spx:openspec-propose`
  reads from a predictable path.
- The change folder is self-contained from brainstorm through archive.

### ADR-004 — Release script remote parameterization

**Date:** 2026-05-26 · **Status:** Accepted

#### Decision

When `scripts/release.ps1` exists in a working tree (it is not
tracked; see ADR-001), it derives the GitHub release URL from
`git config --get remote.origin.url`. No hard-coded `<owner>/<repo>`
strings.

#### Consequences

- The local script works for forks without script edits.
- A non-GitHub remote produces a clear warning instead of a silent
  wrong URL.
