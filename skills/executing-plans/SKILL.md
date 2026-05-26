---
name: executing-plans
description: Use when you have an OpenSpec change folder + plan and want to execute tasks inline (in this session) with human checkpoints. Pairs with spx:openspec-apply for spec-driven discipline.
---

# Executing Plans

## Overview

Load the plan, sanity-check it against the OpenSpec change folder, execute tasks in batches with human checkpoints between them.

**Announce at start:** "I'm using the executing-plans skill to implement this plan."

**Note:** SuperSpecs works much better with subagent support. If your platform supports `Task`-style subagent dispatch, prefer `spx:subagent-driven-development` over this skill.

**Required companion skill:** `spx:openspec-apply` — it defines the per-task discipline (read spec → implement → verify scenarios → commit). This skill defines the **dispatch model** (inline, batched, with human checkpoints).

## The Process

### Step 1: Load and Review

1. Read `openspec/changes/<change-id>/plan.md` and the change folder (proposal, spec deltas, design, tasks).
2. Review critically — does the plan cover every spec delta? Does every task cite the scenarios it closes?
3. If concerns: raise them with your human partner before starting.
4. If no concerns: create a TodoWrite with one item per task and proceed.

### Step 2: Execute Tasks

For each task, follow `spx:openspec-apply`:

1. Mark task as in_progress
2. Read spec delta and copy scenarios into a sub-todo
3. Implement the minimal code
4. Verify every scenario (preferably with automated tests)
5. Run the full project suite — confirm pristine output
6. Commit (message references the change-id)
7. Tick the task in `tasks.md`
8. Mark as completed

### Step 3: Human Checkpoints

After every batch of N tasks (default N=3, or at any natural breakpoint), pause and report to the user:

- Tasks completed
- Scenarios verified
- Any deviations from the plan or spec
- Anything that surprised you

Wait for the user's go-ahead before continuing. This is the main difference from `spx:subagent-driven-development`: the human stays in the loop.

### Step 4: Finish

After all tasks complete and verified:
- Announce: "I'm using the finishing-a-development-branch skill."
- **REQUIRED SUB-SKILL:** `spx:finishing-a-development-branch`
- After merge: **REQUIRED SUB-SKILL:** `spx:openspec-archive`

## When to Stop and Ask

**STOP executing immediately when:**
- Hit a blocker (missing dependency, scenario fails, instruction unclear)
- The spec turns out to be incomplete or contradictory once you start coding
- A scenario can't be verified as written
- Verification fails repeatedly

**Ask for clarification rather than guessing.** If the spec needs to change, follow the "When the Spec Is Wrong" guidance in `spx:openspec-apply`.

## When to Revisit Earlier Steps

**Return to Step 1 when:**
- The user updates the plan or spec deltas based on your feedback
- The fundamental approach needs rethinking — escalate to `spx:brainstorming` / `spx:openspec-propose`

**Don't force through blockers** — stop and ask.

## Remember

- Review plan and change folder critically first
- Follow `spx:openspec-apply` exactly per task
- Don't skip scenario verification
- Stop when blocked, don't guess
- Never start implementation on main/master branch without explicit user consent
- Spec is the source of truth — if reality and spec disagree, fix the spec deliberately

## Integration

**Required workflow skills:**
- **spx:openspec-propose** — produces the change folder
- **spx:writing-plans** — produces the plan this skill executes
- **spx:openspec-apply** — drives each task
- **spx:using-git-worktrees** — REQUIRED: isolated workspace before starting
- **spx:finishing-a-development-branch** — complete development after all tasks
- **spx:openspec-archive** — fold deltas into active spec set after merge
