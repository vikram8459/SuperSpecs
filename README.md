# SuperSpecs

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![Cursor](https://img.shields.io/badge/Cursor-Plugin-000?logo=cursor)](https://cursor.com)
[![Status: Alpha](https://img.shields.io/badge/status-alpha-orange)](#status)

> **Spec-Driven Development skills framework for Cursor.** Built around the OpenSpec workflow.

Instead of jumping straight into code, your Cursor agent steps back, asks what you're really trying to build, captures the answer as an **OpenSpec change** (proposal, spec deltas, design, tasks), then implements task-by-task with each scenario verified against the spec.

**The spec — not a failing test — is the source of truth.**

---

## Table of Contents

- [Why SuperSpecs?](#why-superspecs)
- [How It Works](#how-it-works)
- [Quick Start](#quick-start)
- [Installation](#installation-cursor)
- [The Basic Workflow](#the-basic-workflow)
- [Slash Commands](#slash-commands)
- [What's Inside](#whats-inside)
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

Because the skills trigger automatically via the `SessionStart` hook, you don't need to do anything special. Your Cursor agent just has SuperSpecs.

## Quick Start

```bash
git clone https://github.com/vikram8459/SuperSpecs.git .superspecs
```

Point Cursor at `.superspecs/.cursor-plugin/plugin.json`, restart your Cursor session, and start a new chat with:

> *"I want to add user authentication to my app."*

The agent will activate `brainstorming` automatically and walk you through the spec-driven flow.

## Installation (Cursor)

This is currently a **local plugin** — clone or copy this repo into a directory Cursor can pick up.

### Option A: As a workspace plugin

```bash
git clone https://github.com/vikram8459/SuperSpecs.git .superspecs
```

Then point Cursor at `.superspecs/.cursor-plugin/plugin.json`.

### Option B: As a global Cursor plugin

Copy or symlink the repo contents into your Cursor plugins directory:

- **macOS / Linux**: `~/.cursor/plugins/superspecs/`
- **Windows**: `%USERPROFILE%\.cursor\plugins\superspecs\`

Reference `plugin.json` from there. See [Cursor's plugin documentation](https://docs.cursor.com) for the current canonical path on your platform.

## The Basic Workflow

1. **`brainstorming`** — Activates before writing code. Refines rough ideas through questions, explores alternatives, presents design in sections for validation.
2. **`openspec-propose`** — Activates after design approval. Drafts the OpenSpec change folder (proposal, spec deltas, design, tasks). Hard gate: no production code until approved.
3. **`using-git-worktrees`** — Activates after proposal approval. Creates an isolated branch, runs project setup, verifies clean baseline.
4. **`writing-plans`** — Expands `tasks.md` into bite-sized executable steps. Every step references the spec delta and scenarios it closes.
5. **`subagent-driven-development`** *or* **`executing-plans`** — Dispatches fresh subagent per task with two-stage review (spec compliance, then code quality), or executes inline with human checkpoints.
6. **`openspec-apply`** — Drives each task: read spec delta → implement minimally → verify every scenario → commit. The companion skill to whichever execution mode you chose.
7. **`requesting-code-review`** — Between tasks. Reviews against spec deltas, reports issues by severity. Critical issues block progress.
8. **`finishing-a-development-branch`** — When tasks complete. Verifies suite, presents merge/PR/keep/discard options, cleans up worktree.
9. **`openspec-archive`** — After merge. Folds ADDED/MODIFIED/REMOVED deltas into the active `openspec/specs/` set so the active spec always reflects reality.

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

**Skills without a slash command** activate automatically when their trigger conditions are met (e.g. `using-git-worktrees` after proposal approval, `requesting-code-review` between tasks, `systematic-debugging` on failure, `verification-before-completion` before any "done" claim). See [The Basic Workflow](#the-basic-workflow) for the full auto-triggered chain.

## What's Inside

### OpenSpec Workflow Skills
- **`openspec-propose`** — Draft proposal, spec deltas, design, tasks
- **`openspec-apply`** — Per-task: spec → implement → verify → commit
- **`openspec-archive`** — Fold completed deltas into active specs

### Collaboration Skills
- **`brainstorming`** — Socratic design refinement
- **`writing-plans`** — Detailed implementation plans tied to spec deltas
- **`executing-plans`** — Inline batch execution with human checkpoints
- **`subagent-driven-development`** — Fresh subagent per task with two-stage review
- **`dispatching-parallel-agents`** — Concurrent subagent workflows
- **`requesting-code-review`** — Pre-merge review with spec-aware checklist
- **`receiving-code-review`** — Responding to feedback
- **`using-git-worktrees`** — Parallel development branches
- **`finishing-a-development-branch`** — Merge / PR / cleanup workflow

### Quality / Debugging Skills
- **`systematic-debugging`** — 4-phase root cause process
- **`verification-before-completion`** — Evidence before claims, every scenario

### Meta
- **`writing-skills`** — Author new skills using a Red-Green-Refactor methodology
- **`using-superspecs`** — Bootstrap skill auto-loaded by the `SessionStart` hook

## Philosophy

- **Spec-Driven Development** — The spec is the contract. Every line of production code closes a spec delta.
- **Systematic over ad-hoc** — Process beats guessing.
- **Complexity reduction** — Simplicity as the primary goal.
- **Evidence over claims** — Verify every scenario, every time.
- **Built for brownfield, not just greenfield** — Works on existing codebases with legacy decisions, partial specs, and in-flight migrations.

## Status

**Alpha.** Actively used and refined. Skill names, hook contracts, and folder layouts may change before a 1.0 tag. Issues and PRs welcome — open an [issue](https://github.com/vikram8459/SuperSpecs/issues) if a skill misfires or a workflow needs sharpening.

## License

MIT — see [`LICENSE`](./LICENSE).
