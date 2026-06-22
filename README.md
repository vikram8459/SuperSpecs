# SuperSpecs

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![Cursor](https://img.shields.io/badge/Cursor-Plugin-000?logo=cursor)](https://cursor.com)
[![Status: Alpha](https://img.shields.io/badge/status-alpha-orange)](#status)

> **A Spec-Driven Development (SDD) skills framework.** Built around the OpenSpec workflow. The methodology and skill set are tool-agnostic; today the framework ships as a Cursor plugin.

Instead of jumping straight into code, your Cursor agent steps back, asks what you're really trying to build, captures the answer as an **OpenSpec change** (proposal, spec deltas, design, tasks), then implements task-by-task with each scenario verified against the spec.

**The spec — not a failing test — is the source of truth.**

---

## Table of Contents

- [Why SuperSpecs?](#why-superspecs)
- [How It Works](#how-it-works)
- [Quick Start](#quick-start)
- [CLI Quickstart](#cli-quickstart)
- [Installation](#installation)
- [The Basic Workflow](#the-basic-workflow)
- [Slash Commands](#slash-commands)
- [What's Inside](#whats-inside)
- [Configuration](#configuration)
- [Documentation](#documentation)
- [Philosophy](#philosophy)
- [Status](#status)
- [License](#license)

---

## Why SuperSpecs?

| Without SuperSpecs | With SuperSpecs |
| --- | --- |
| Agent dives into code on a vague prompt | Agent brainstorms intent first |
| Requirements drift across the chat | Requirements pinned in `openspec/changes/` |
| "Done" means "it compiles" | "Done" means every scenario verified |
| Reviews are vibes | Reviews check code against spec deltas |
| History is messy commits | History is task-by-task spec closures |

## How It Works

From the moment you start a task, the agent:

1. **Brainstorms** the idea into a clear design (Socratic, one question at a time)
2. **Proposes** an OpenSpec change folder (`openspec/changes/<change-id>/`) containing:
   - `proposal.md` — why & what
   - `specs/<capability>/spec.md` — ADDED / MODIFIED / REMOVED requirements with scenarios
   - `design.md` — non-obvious technical decisions
   - `tasks.md` — implementation checklist linked to spec deltas
3. **Plans** the work as bite-sized executable tasks (each task names the scenarios it closes)
4. **Applies** the change task-by-task — read spec → implement minimally → verify every scenario → commit
5. **Reviews** with two-stage subagent review (spec compliance, then code quality)
6. **Archives** completed changes — folds deltas into the active spec set at `openspec/specs/`

Because the skills trigger automatically — via the `SessionStart` hook
(Cursor, Claude Code) or via `AGENTS.md` auto-loading (Codex, OpenCode,
Gemini) — your agent just has SuperSpecs. See [Installation](#installation)
for the supported harnesses.

## Quick Start

```bash
git clone https://github.com/vikram8459/SuperSpecs.git .superspecs
```

Then point your harness at the right entry file:

| Harness     | Entry |
|-------------|-------|
| Cursor      | `.superspecs/.cursor-plugin/plugin.json` |
| Claude Code | `.superspecs/.claude-plugin/plugin.json` (auto-discovers `skills/`, `commands/`) |
| Codex CLI   | `.superspecs/AGENTS.md` (auto-loaded) |
| OpenCode    | `.superspecs/AGENTS.md` (auto-loaded) |
| Gemini CLI  | `.superspecs/gemini-extension.json` |

Restart your session, then ask:

> *"I want to add user authentication to my app."*

The agent will activate `spx:brainstorming` automatically and walk you
through the spec-driven flow. See [Installation](#installation) for
per-harness setup details.

## CLI Quickstart

SuperSpecs also ships a CLI (`@superspecs/cli`) that mechanically
validates and manages your OpenSpec change folders. Use it on its
own or alongside the Cursor plugin.

### Install

```bash
npm install -g @superspecs/cli
superspecs --version
```

### Common commands

```bash
# Initialize openspec/ in the current directory.
superspecs init

# Validate every in-flight change against the JSON Schemas.
superspecs validate

# Validate a specific change.
superspecs validate add-retry-logic

# List in-flight changes, archived changes, and capabilities.
superspecs list

# Show the most-recent change and task counts.
superspecs status

# Preview what an archive would do (writes nothing):
superspecs archive add-retry-logic --dry-run

# Archive an approved change: validates the resulting active spec set,
# snapshots openspec/specs/ to openspec/.snapshots/<id>/, applies the
# ADDED/MODIFIED/REMOVED deltas, moves the change folder under
# openspec/changes/archive/YYYY-MM-DD-<id>/, and commits (with
# Archive-Of and Snapshot-At trailers). Refuses if the result would
# duplicate a requirement name or leave a requirement with no scenario.
superspecs archive add-retry-logic

# Undo the most recent archive of a change (restores from the snapshot;
# requires a clean working tree):
superspecs archive add-retry-logic --undo

# Validate the active spec set on its own:
superspecs validate --active
```

### Error format

Errors come out as `file:line:col: SDD<NNN> <message>` — the same
format `tsc`, `eslint`, and `ruff` use, so IDEs make them clickable.
The full code registry lives in [`schemas/README.md`](./schemas/README.md).

### Build from source

```bash
git clone https://github.com/vikram8459/SuperSpecs.git
cd SuperSpecs
npm install
npm run build
npm test
node dist/superspecs.js --help
```

Requires Node.js 20 LTS or newer (see [ADR-005](./docs/architecture.md#adr-005--cli-runtime-nodejs-20x-lts--typescript)).

## Installation

SuperSpecs ships as a single repo that drops into your project (or your
global agent-tools directory). Five harnesses are supported today — see
[`docs/architecture.md` ADR-011](./docs/architecture.md#adr-011--multi-tool-generalization-via-per-harness-canonical-paths)
for the design and [`docs/harnesses.json`](./docs/harnesses.json) for the
canonical list.

Easiest path: clone the repo, then run `superspecs init --harness=<name>`
in your project. That writes the right manifest file(s) into your
project; you keep the SuperSpecs install for the skill content.

```bash
# 1. Get SuperSpecs
git clone https://github.com/vikram8459/SuperSpecs.git ~/.superspecs
cd ~/.superspecs && npm install && npm run build && npm link
# 2. Wire it into your project
cd ~/my-project
superspecs init --harness=cursor   # or claude-code | codex | opencode | gemini
```

The per-harness blocks below cover what each harness expects, in case
you'd rather write the manifest by hand or place SuperSpecs somewhere
non-standard.

### Cursor

Point Cursor at `.cursor-plugin/plugin.json` inside the SuperSpecs install.
Two layouts work:

```bash
# Workspace plugin (per-project)
git clone https://github.com/vikram8459/SuperSpecs.git .superspecs
# Then in Cursor: load .superspecs/.cursor-plugin/plugin.json

# Global plugin
# macOS / Linux: ~/.cursor/plugins/superspecs/
# Windows:       %USERPROFILE%\.cursor\plugins\superspecs\
```

See [Cursor's plugin documentation](https://docs.cursor.com) for the
current canonical paths on your platform.

### Claude Code

Claude Code auto-discovers the plugin from `.claude-plugin/plugin.json`.
The manifest points at `hooks/hooks-claude.json`, which wires the
SessionStart hook to inject `skills/using-superspecs/SKILL.md` into
every new conversation.

```bash
# Per-project (recommended):
git clone https://github.com/vikram8459/SuperSpecs.git .superspecs
# Then in your Claude Code config, add the plugin path:
#   ~/.claude.json -> "plugins": ["/abs/path/to/.superspecs"]
```

See [Claude Code plugin docs](https://code.claude.com/docs/en/agent-sdk/plugins).

### Codex CLI

Codex auto-loads `AGENTS.md` at repo root. Nothing else to wire —
once `AGENTS.md` is present (and `skills/` is reachable as a sibling),
the agent gets the SuperSpecs instructions on every session start.

```bash
# Copy AGENTS.md (and optionally skills/) into your project root:
superspecs init --harness=codex
# Or symlink:
ln -s ~/.superspecs/AGENTS.md AGENTS.md
ln -s ~/.superspecs/skills    skills
```

See [Codex AGENTS.md docs](https://developers.openai.com/codex/guides/agents-md).

### OpenCode

Same `AGENTS.md` mechanism as Codex (OpenCode reads the same file convention):

```bash
superspecs init --harness=opencode
# Or:
ln -s ~/.superspecs/AGENTS.md AGENTS.md
```

See [OpenCode rules docs](https://opencode.ai/docs/rules/).

### Gemini CLI

Gemini reads `gemini-extension.json` and follows `contextFileName`.
SuperSpecs ships an extension that points at `AGENTS.md`:

```bash
# Treat the SuperSpecs install as a Gemini extension:
ln -s ~/.superspecs ~/.gemini/extensions/superspecs
# Or copy the manifest + AGENTS.md into your project:
superspecs init --harness=gemini
```

See [Gemini extension reference](https://geminicli.com/docs/extensions/reference/).

## The Basic Workflow

1. **`spx:brainstorming`** — Activates before writing code. Refines rough ideas through questions, explores alternatives, presents design in sections for validation.
2. **`spx:openspec-propose`** — Activates after design approval. Drafts the OpenSpec change folder (proposal, spec deltas, design, tasks). Hard gate: no production code until approved.
3. **`spx:using-git-worktrees`** — Activates after proposal approval. Creates an isolated branch, runs project setup, verifies clean baseline.
4. **`spx:writing-plans`** — Expands `tasks.md` into bite-sized executable steps. Every step references the spec delta and scenarios it closes.
5. **`spx:subagent-driven-development`** *or* **`spx:executing-plans`** — Dispatches fresh subagent per task with two-stage review (spec compliance, then code quality), or executes inline with human checkpoints.
6. **`spx:openspec-apply`** — Drives each task: read spec delta → implement minimally → verify every scenario → commit. The companion skill to whichever execution mode you chose.
7. **`spx:requesting-code-review`** — Between tasks. Reviews against spec deltas, reports issues by severity. Critical issues block progress.
8. **`spx:finishing-a-development-branch`** — When tasks complete. Verifies suite, presents merge/PR/keep/discard options, cleans up worktree.
9. **`spx:openspec-archive`** — After merge. Folds ADDED/MODIFIED/REMOVED deltas into the active `openspec/specs/` set so the active spec always reflects reality.

> **The agent checks for relevant skills before any task.** Mandatory workflows, not suggestions.

## Slash Commands

SuperSpecs exposes **5 slash commands**, one per major phase of the end-to-end OpenSpec workflow. The agent will reach these skills automatically as the workflow progresses; the slash commands are convenience entry points when you want to jump into a specific phase explicitly.

| # | Command | Phase | Purpose | Notes |
|---|---|---|---|---|
| 1 | `/brainstorm` | Discovery | Refine a rough idea into an approved design via Socratic questioning, one question at a time. | Start here for any new feature or change. |
| 2 | `/propose` | Proposal | Draft the OpenSpec change folder at `openspec/changes/<change-id>/` — `proposal.md`, spec deltas, `design.md`, `tasks.md`. | **Hard gate**: no production code until the proposal is reviewed and approved. |
| 3 | `/write-plan` | Planning | Expand the approved change's `tasks.md` into a bite-sized executable plan where every step cites the spec delta and scenarios it closes. | Run after `/propose` is approved. Plan lives at `openspec/changes/<change-id>/plan.md`. |
| 4 | `/execute-plan` | Implementation | Execute the plan task-by-task with OpenSpec-apply discipline: read spec → implement minimally → verify every scenario → commit. | Triggers two-stage review (spec compliance, then code quality) between tasks via `requesting-code-review`. |
| 5 | `/archive` | Closeout | Fold ADDED / MODIFIED / REMOVED requirements into the active spec set at `openspec/specs/` and move the change folder to `openspec/changes/archive/YYYY-MM-DD-<change-id>/`. | Only run **after** implementation, code review, and merge. |

**Canonical lifecycle:**

```
/brainstorm  →  /propose  →  /write-plan  →  /execute-plan  →  /archive
  (idea)       (proposal)      (plan)        (implement)       (close)
```

**Skills without a slash command** activate automatically when their trigger conditions are met (e.g. `spx:using-git-worktrees` after proposal approval, `spx:requesting-code-review` between tasks, `spx:systematic-debugging` on failure, `spx:verification-before-completion` before any "done" claim). See [The Basic Workflow](#the-basic-workflow) for the full auto-triggered chain.

## What's Inside

### OpenSpec Workflow Skills
- **`spx:openspec-propose`** — Draft proposal, spec deltas, design, tasks
- **`spx:openspec-validate`** — Validate an in-flight change with `superspecs validate`
- **`spx:openspec-apply`** — Per-task: spec → implement → verify → commit
- **`spx:openspec-archive`** — Fold completed deltas into active specs

### Collaboration Skills
- **`spx:brainstorming`** — Socratic design refinement
- **`spx:writing-plans`** — Detailed implementation plans tied to spec deltas
- **`spx:executing-plans`** — Inline batch execution with human checkpoints
- **`spx:subagent-driven-development`** — Fresh subagent per task with two-stage review
- **`spx:dispatching-parallel-agents`** — Concurrent subagent workflows
- **`spx:requesting-code-review`** — Pre-merge review with spec-aware checklist
- **`spx:receiving-code-review`** — Responding to feedback
- **`spx:using-git-worktrees`** — Parallel development branches
- **`spx:finishing-a-development-branch`** — Merge / PR / cleanup workflow

### Quality / Debugging Skills
- **`spx:systematic-debugging`** — 4-phase root cause process
- **`spx:verification-before-completion`** — Evidence before claims, every scenario

### Meta
- **`spx:writing-skills`** — Author new skills using a Red-Green-Refactor methodology
- **`spx:using-superspecs`** — Bootstrap skill auto-loaded by the `SessionStart` hook

## Philosophy

- **Spec-Driven Development** — The spec is the contract. Every line of production code closes a spec delta.
- **Systematic over ad-hoc** — Process beats guessing.
- **Complexity reduction** — Simplicity as the primary goal.
- **Evidence over claims** — Verify every scenario, every time.
- **Built for brownfield, not just greenfield** — Works on existing codebases with legacy decisions, partial specs, and in-flight migrations.

## Configuration

- **`SUPERSPECS_MODE`** — `strict` | `auto` (default) | `manual`. Controls
  how aggressively skills self-trigger. See
  [`skills/using-superspecs/SKILL.md`](./skills/using-superspecs/SKILL.md)
  for the behaviour per mode and the **Skip skills when** bypass list.

## Documentation

- [`AGENTS.md`](./AGENTS.md) — harness-agnostic agent instructions (mirrors the SessionStart hook payload).
- [`CONTRIBUTING.md`](./CONTRIBUTING.md) — how to author skills, run evals, and submit changes.
- [`CHANGELOG.md`](./CHANGELOG.md) — versioned change log (Keep a Changelog format).
- [`docs/architecture.md`](./docs/architecture.md) — hook contract, skill discovery, slash-command lifecycle, OpenSpec folder layout, ADRs.
- [`docs/openspec-walkthrough.md`](./docs/openspec-walkthrough.md) — end-to-end worked example.
- [`docs/skill-authoring.md`](./docs/skill-authoring.md) — conventions for writing skills.

## Status

**Alpha.** Actively used and refined. Skill names, hook contracts, and folder layouts may change before a 1.0 tag. Issues and PRs welcome — open an [issue](https://github.com/vikram8459/SuperSpecs/issues) if a skill misfires or a workflow needs sharpening.

## License

MIT — see [`LICENSE`](./LICENSE).
