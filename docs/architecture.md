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
| `/validate`      | `spx:openspec-validate`    |
| `/write-plan`    | `spx:writing-plans`        |
| `/execute-plan`  | `spx:openspec-apply` (+ dispatch model) |
| `/archive`       | `spx:openspec-archive`     |

Command files now carry a `**Usage:**` line documenting the argument
shape and a `**Preflight:**` line reminding the agent to confirm the
expected `openspec/` structure before acting. `/propose` additionally
instructs running `superspecs init` when the workspace is missing.

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
- **`SUPERSPECS_DISABLE`** — when set to `1`, both SessionStart hooks
  emit `{"additional_context": ""}` and exit 0 without loading the
  skill. Any other value (or unset) loads normally. The check runs
  before any file I/O in both `session-start.ps1` and `session-start`.
- **`SUPERSPECS_TELEMETRY`** — reserved but inert. SuperSpecs collects no
  telemetry; no code reads this variable and setting it has no effect. See
  ADR-009 (no telemetry).

### Hook logging

Both SessionStart hooks append tab-separated diagnostics
(`timestamp \t code \t session-start \t details`) to
`superspecs-hook.log` in the system temp directory, and rotate it to
`superspecs-hook.log.1` once it reaches 1 MB. The POSIX hook
(`session-start`) logs the same format as the PowerShell hook
(`session-start.ps1`); logging is best-effort and never blocks the
stdout envelope. Run `superspecs doctor` to see the last 20 lines
plus a health report of the install.

### `superspecs doctor`

`superspecs doctor` prints a cross-platform health report: CLI
version, presence of both hook scripts, the Cursor plugin manifest,
and the three JSON schemas (these are required and affect the exit
code), plus the hook-log tail and — on Windows only — the PowerShell
version (informational; never affect the exit code). It exits
non-zero when a required component is missing.

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

### ADR-005 — CLI runtime: Node 20.x LTS + TypeScript

**Date:** 2026-05-27 · **Status:** Accepted

#### Decision

The `superspecs` CLI is implemented in TypeScript (target es2022,
module nodenext, strict mode) targeting Node.js 20.x LTS. Built
output lives in `dist/`. Entry point at `bin/superspecs` resolves
to `dist/superspecs.js`. Dependencies: `commander`, `ajv`,
`ajv-errors`, `better-ajv-errors`, `gray-matter`, `fast-glob`,
`remark`, `remark-parse`, `unist-util-visit`. Dev deps: `typescript`,
`vitest`, `tsx`, `@types/node`, `json-schema-to-typescript`.

#### Consequences

- Contributors need Node 20.x on `PATH` to run `npm install`,
  `npm run build`, `npm test`.
- Mirrors OpenSpec's `bin/`, `src/`, `schemas/`, `vitest.config.ts`
  layout, so patterns transfer 1:1.
- `npm publish` as `@superspecs/cli` (Finding 1.7) is one
  command. Package name fallback `superspecs-cli` if scoped name
  unavailable (decision recorded in ADR-007 if needed).
- TypeScript types are co-generated from the JSON Schemas via
  `json-schema-to-typescript` (see ADR-006), giving compile-time
  alignment between schemas and parser ASTs.

#### Alternatives Considered

- Node + plain JS — rejected for type-safety on a validator
  codebase. Build step is cheap; type guarantees are not.
- Python 3.12 — rejected for OpenSpec parity and Windows install
  friction (existing hook stack is PowerShell; Python would add a
  third runtime).
- PowerShell — rejected: no serious JSON Schema story; not a
  publishable CLI language.

### ADR-006 — JSON Schema for OpenSpec artefact grammar

**Date:** 2026-05-27 · **Status:** Accepted

#### Decision

OpenSpec artefacts (proposal, spec-delta, tasks, skill-eval) are
validated against draft-07 JSON Schemas under `schemas/`, compiled
with `ajv`. A `remark`-based parser converts markdown to the AST the
schemas validate; errors surface as `file:line:col: SDD<NNN>`.

#### Consequences

- One machine-checkable grammar per artefact; IDEs and CI can both use it.
- Parser AST shape and schema shape are kept aligned by tests.

### ADR-007 — CLI package name

**Date:** 2026-05-27 · **Status:** Accepted

#### Decision

The CLI publishes as `@superspecs/cli`. The scoped name was available;
no fallback to `superspecs-cli` was needed.

### ADR-008 — Archive safety

**Date:** 2026-06-10 · **Status:** Accepted

#### Decision

`superspecs archive` is made reversible and non-corrupting:

- A pure `ArchivePlan` computes the resulting active content without
  writing; `--dry-run` prints the plan and stops.
- Before writing, the resulting active set is validated in-memory
  (`validate --active` rules: no duplicate requirement names per
  capability; every requirement has ≥1 scenario). Archive refuses
  (non-zero, no write) if the result would be invalid.
- The current `openspec/specs/` is copied to
  `openspec/.snapshots/<change-id>/` (gitignored) before any write.
- The archive commit carries `Archive-Of:` and `Snapshot-At:` trailers.
- `archive --undo <change-id>` restores `openspec/specs/` from the
  snapshot byte-for-byte and moves the change folder back. It refuses
  on a dirty working tree or a missing snapshot.

#### Consequences

- Archiving is safe to run: previewable, snapshotted, validated, and
  reversible.
- `openspec/.snapshots/` accumulates local recovery state; it is
  gitignored and not auto-pruned (a future `--prune` could address this).

#### Limitation

`--undo` restores from the snapshot byte-for-byte. If the user committed
further edits to `openspec/specs/` after archiving, undo reverts those
too. The dirty-tree guard catches uncommitted edits; committed downstream
edits are out of scope for the deterministic restore.

### ADR-009 — No telemetry

**Date:** 2026-06-11 · **Status:** Accepted

#### Decision

SuperSpecs collects no telemetry. The CLI and hooks make no network
phone-home of any kind, opt-in or otherwise. The `SUPERSPECS_TELEMETRY`
environment variable is reserved but inert — no code reads it.

#### Consequences

- The tool never talks to the network as a side effect of normal use; a
  privacy-first posture is the default and a feature for an alpha dev tool.
- No collector, endpoint, or data-retention policy to build or maintain.

#### Revisiting

If concrete demand for usage data appears, telemetry can be added later as
its own deliberate proposal: opt-in only, minimal payload
(`{command, version, platform, exit_code}`), disabled in CI, documented
consent. This ADR records that the current, intentional state is "none".
