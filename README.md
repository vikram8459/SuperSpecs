# SuperSpecs

**Spec-Driven Development skills framework for Cursor**, adapted from [obra/superpowers](https://github.com/obra/superpowers) and built around the [OpenSpec](https://github.com/Fission-AI/OpenSpec) workflow.

Instead of jumping straight into code, your Cursor agent steps back, asks what you're really trying to build, captures the answer as an **OpenSpec change** (proposal, spec deltas, design, tasks), then implements task-by-task with each scenario verified against the spec.

The spec — not a failing test — is the source of truth.

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

Because the skills trigger automatically via the SessionStart hook, you don't need to do anything special. Your Cursor agent just has SuperSpecs.

## Installation (Cursor)

This is currently a **local plugin** — clone or copy this repo into a directory Cursor can pick up.

### Option A: As a workspace plugin

```bash
git clone <this-repo-url> .superspecs
```

Then point Cursor at `.superspecs/.cursor-plugin/plugin.json`.

### Option B: As a global Cursor plugin

Copy or symlink the repo contents into your Cursor plugins directory and reference `plugin.json` from there. Refer to Cursor's plugin documentation for the current path on your platform.

### OpenSpec CLI (optional but recommended)

The skills work without it, but the [OpenSpec CLI](https://github.com/Fission-AI/OpenSpec) gives you `openspec init`, `openspec change add`, and `openspec validate`:

```bash
npm install -g @fission-ai/openspec
cd your-project
openspec init
```

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

**The agent checks for relevant skills before any task.** Mandatory workflows, not suggestions.

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
- **`using-superspecs`** — Bootstrap skill auto-loaded by the SessionStart hook

## Philosophy

- **Spec-Driven Development** — The spec is the contract. Every line of production code closes a spec delta.
- **Systematic over ad-hoc** — Process beats guessing
- **Complexity reduction** — Simplicity as the primary goal
- **Evidence over claims** — Verify every scenario, every time

## Credits

SuperSpecs is maintained by Vikram Patel as a Cursor- and OpenSpec-focused fork of [Superpowers](https://github.com/obra/superpowers), originally created by [Jesse Vincent](https://blog.fsck.com) and Prime Radiant. The upstream framework's skill structure, prompt engineering, and SessionStart hook architecture are preserved here; the central workflow has been swapped from TDD to OpenSpec SDD ([Fission-AI/OpenSpec](https://github.com/Fission-AI/OpenSpec)).

If you find this useful, please consider [sponsoring Jesse's open-source work](https://github.com/sponsors/obra) — none of this exists without his original framework.

## License

MIT — see `LICENSE`.
