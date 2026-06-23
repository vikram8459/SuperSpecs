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
`<EXTREMELY_IMPORTANT>` block. The PowerShell and POSIX scripts are
distinct implementations (PowerShell uses `ConvertTo-Json`; the POSIX
hook hand-escapes and emits via `printf '%s'`) but produce
byte-equivalent envelope *content* after LF normalization, and both
emit a structured failure envelope (code `F4`) when the skill file
cannot be read. See the in-script contract comment at the top of
`hooks/session-start.ps1`.

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
  how aggressively skills self-trigger. The mode is honoured by the agent
  (there is no tool-layer enforcement that can stop the agent), but
  `superspecs doctor` reports the effective value and flags an
  unrecognized one (e.g. a typo) as an informational check that never
  changes the exit code. See `skills/using-superspecs/SKILL.md`.
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
version, the effective `SUPERSPECS_MODE`, presence of both hook
scripts, the Cursor plugin manifest, and the three JSON schemas (the
hooks, manifest, and schemas are required and affect the exit code),
plus the hook-log tail and — on Windows only — the PowerShell version.
The CLI-version, `SUPERSPECS_MODE`, hook-log, and PowerShell lines are
informational and never affect the exit code (an unrecognized
`SUPERSPECS_MODE` is flagged but does not fail). It exits non-zero when
a required component is missing.

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
output lives in `dist/`. The published `bin` entry (`superspecs`) maps
to `dist/superspecs.js`. Dependencies: `commander`, `ajv`,
`fast-glob`, `unified`, `remark-parse`, `unist-util-visit`. Dev deps:
`typescript`, `vitest`, `@types/node`.

#### Consequences

- Contributors need Node 20.x on `PATH` to run `npm install`,
  `npm run build`, `npm test`.
- Mirrors OpenSpec's `src/`, `schemas/`, `vitest.config.ts`
  layout, so patterns transfer 1:1.
- `npm publish` as `@superspecs/cli` (Finding 1.7) is one
  command. Package name fallback `superspecs-cli` if scoped name
  unavailable (decision recorded in ADR-007 if needed).
- Parser AST types (`ProposalAst`, `SpecDeltaAst`, etc.) are
  hand-written and kept aligned with the JSON Schemas by tests (see
  ADR-006), rather than code-generated.

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

### ADR-010 — Brainstorm-companion WebSocket: `ws` package, not hand-rolled

**Date:** 2026-06-11 · **Status:** Accepted

#### Decision

The `brainstorming` skill's visual companion (`skills/brainstorming/scripts/server.cjs`)
uses the [`ws`](https://www.npmjs.com/package/ws) npm package for WebSocket
framing, masking, ping/pong, close codes, and continuation frames.
The prior hand-rolled RFC-6455 implementation is replaced.

`skills/brainstorming/scripts/` is now a small Node sub-package with its
own `package.json` declaring `ws` as a runtime dependency and `vitest`
as a dev dependency. Tests at `skills/brainstorming/scripts/tests/`
cover the four cases the audit called out: connect/disconnect, JSON
message round-trip, fragment handling, and oversize-payload rejection
(close code 1009).

The sub-package is `"private": true` and intentionally not published —
it lives inside the SuperSpecs repo as a local-only helper.

#### Consequences

- Battle-tested framing replaces 100+ lines of bespoke RFC-6455 code; the
  attack surface drops to "whatever `ws` ships with".
- The visual companion gains a real test suite (`npm test` inside
  `skills/brainstorming/scripts/`), which gates regressions.
- A single new runtime dependency (`ws`) is introduced, but only for
  users who actually run the visual companion. The CLI (`superspecs`)
  is unaffected and keeps its current dependency set.
- The external contract is preserved: same env vars (`BRAINSTORM_PORT`,
  `BRAINSTORM_HOST`, `BRAINSTORM_URL_HOST`, `BRAINSTORM_DIR`,
  `BRAINSTORM_OWNER_PID`), same stdout JSON event types
  (`server-started`, `screen-added`, `screen-updated`, `user-event`,
  `owner-pid-invalid`, `server-stopped`), same HTTP routes, same
  `helper.js` injection. `start-server.sh` and `stop-server.sh` need no
  changes.

#### Alternatives considered

- **Deprecate to a separate `@superspecs/brainstorm-visual` package.**
  Rejected: the visual companion is currently one feature inside one
  skill; a separate published package is overhead without payoff. If
  the companion becomes a maintained surface area with its own users,
  revisit this decision.
- **Drop the visual companion entirely.** Rejected: it's a working,
  used capability referenced from the brainstorming skill's offer
  flow. Removing it would be a behaviour regression.
- **Node 22+ built-in `WebSocket`.** Rejected for now because the CLI
  declares `engines.node >= 20.0.0`; tying the visual companion to a
  newer baseline than the CLI would create install surprises. Revisit
  when the project bumps to Node 22+.

### ADR-011 — Multi-tool generalization via per-harness canonical paths

**Date:** 2026-06-11 · **Status:** Accepted

#### Context

The audit's Finding 2 demanded a choice between path A (multi-tool
generalization, mirroring Superpowers / OpenSpec) and path B (Cursor-only
rebrand). The audit's task list assumed path A would consolidate every
harness's wiring under `harnesses/<name>/` — for example, move
`.cursor-plugin/` to `harnesses/cursor/`, add `harnesses/claude-code/`,
`harnesses/codex/`, `harnesses/opencode/`, `gemini-extension.json` at root.

Research of each target harness's actual plugin/loader convention
(2026-06-11) showed that this organizational move conflicts with how
each harness discovers configuration:

| Harness | Where it looks |
|---------|----------------|
| Cursor | `.cursor-plugin/plugin.json` at workspace root |
| Claude Code | `.claude-plugin/plugin.json` (auto-discovers standard `skills/`, `commands/`, `hooks/`) |
| Codex CLI | `AGENTS.md` at repo root (no manifest; auto-loaded) |
| OpenCode | `AGENTS.md` at repo root (no manifest; auto-loaded) |
| Gemini CLI | `gemini-extension.json` at extension root (with `contextFileName`) |

Each harness expects its own canonical location. A `harnesses/<name>/`
folder would fight every harness's auto-discovery and require users to
re-point every tool's config — a much worse outcome than co-existing
canonical paths.

Phase A also shipped `AGENTS.md` at root (Finding 10), which without
realizing it provided a working Codex + OpenCode + agents.md-spec
integration on day one.

#### Decision

Choose **path A (multi-tool)**, but reject the audit's `harnesses/<name>/`
move. Co-locate each harness's manifest at its canonical path. The skill
content, command files, and OpenSpec layout stay shared at repo root
across every harness.

Concretely:

- `.cursor-plugin/plugin.json` — Cursor (existing; unchanged).
- `.claude-plugin/plugin.json` + `hooks/hooks-claude.json` — Claude Code.
- `gemini-extension.json` at root, `contextFileName: AGENTS.md` — Gemini.
- `AGENTS.md` at root — Codex + OpenCode + agents.md spec.
- Shared `skills/`, `commands/`, `hooks/`, `superspecs` CLI — same content
  serves every harness.

Hooks: only Cursor and Claude Code invoke a SessionStart hook. The
existing `hooks/session-start` and `hooks/session-start.ps1` scripts
gain a `--harness=cursor|claude` flag (default `cursor` for back-compat)
and a single envelope-formatter dispatch. No new wrapper scripts; no
duplication across harnesses for shared concepts.

Source of truth for the harness list: `docs/harnesses.json`. The CLI
(`superspecs init --harness=<name>`), the README install section, and
`tests/harness/payload-parity.test.ts` all read from this index. Adding
a sixth harness = one entry in the JSON + one manifest file + (if it
uses SessionStart hooks) one branch in the envelope dispatch.

#### Consequences

- Zero file moves; zero breakage for existing Cursor users.
- Codex and OpenCode users are already supported as of Phase A
  (`AGENTS.md` shipped) — Phase D acknowledges and documents this.
- Claude Code support is real, not aspirational: a working manifest
  and a SessionStart hook that delivers the same skill content.
- Gemini support is real (manifest + `contextFileName: AGENTS.md`).
- Hook scripts gain a single new option (`--harness=`) and stay native
  per-OS (bash + PowerShell). No `node` requirement at session-start
  time; no new runtime dependency in the hook critical path.
- One source of truth (`docs/harnesses.json`) for the harness list;
  consumers (CLI, README, tests) read from it rather than duplicating.
- F11.1 (`/archive --dry-run` slash-command wiring) gets unblocked as
  a free side effect: `commands/archive.md` lives at root and is shared
  by Cursor and Claude Code.

#### Alternatives considered

- **Path B (Cursor-only rebrand).** Rejected: the README tagline and
  skill content are already tool-agnostic; the only Cursor-specific
  surface area was the manifest and hook envelope. With four other
  harnesses needing 1–3 small files each, the rebrand is more work
  than the multi-tool wiring it would replace.
- **`harnesses/<name>/` folder layout (audit's original).** Rejected:
  fights every harness's auto-discovery convention. The audit's task
  list pre-dated the harness research.
- **Single Node hook entrypoint (Reading B of "no duplication").**
  Rejected for this PR: adds a hard `node`-on-PATH requirement at
  SessionStart time and ~200 ms cold-start overhead. The existing
  bash + PowerShell pair already passes its tests (Phase B2 / F8) and
  the `--harness=` flag is the minimal change. The Node-hook
  refactor can land later if/when maintenance pain emerges; the
  `--harness=` flag in this ADR doesn't paint that into a corner.

#### Migration

None required. All five harnesses work in the same repo simultaneously
once this ADR is implemented. Cursor users see no change.
