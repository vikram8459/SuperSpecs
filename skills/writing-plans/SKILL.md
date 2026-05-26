---
name: writing-plans
description: Use after spx:openspec-propose, when you have an approved OpenSpec change folder. Expands tasks.md into bite-sized executable steps tied to spec deltas.
---

# Writing Plans

## Overview

Write comprehensive implementation plans assuming the engineer has zero context for our codebase and questionable taste. Document everything they need to know: which files to touch for each task, the code, the spec delta(s) the task closes, how to verify the scenarios pass, and which docs to consult. Give them the whole plan as bite-sized tasks. DRY. YAGNI. **Spec-driven.** Frequent commits.

Assume they are a skilled developer who knows almost nothing about our toolset or problem domain.

**Announce at start:** "I'm using the writing-plans skill to expand the OpenSpec change into an implementation plan."

**Context:** This runs after `spx:openspec-propose` has produced an approved change folder, inside a dedicated worktree (from `spx:using-git-worktrees`). The plan elaborates `openspec/changes/<change-id>/tasks.md` — it does not replace it.

**Save plans to:** `openspec/changes/<change-id>/plan.md`
- (User preferences for plan location override this default)

## Scope Check

If the OpenSpec change covers multiple independent subsystems, it should have been split into separate proposals. If it wasn't, suggest splitting now — one proposal & plan per subsystem. Each plan should produce working, spec-compliant software on its own.

## File Structure

Before defining tasks, map out which files will be created or modified and what each one is responsible for. This is where decomposition decisions get locked in.

- Design units with clear boundaries and well-defined interfaces. Each file should have one clear responsibility.
- You reason best about code you can hold in context at once, and your edits are more reliable when files are focused. Prefer smaller, focused files over large ones that do too much.
- Files that change together should live together. Split by responsibility, not by technical layer.
- In existing codebases, follow established patterns. If the codebase uses large files, don't unilaterally restructure - but if a file you're modifying has grown unwieldy, including a split in the plan is reasonable.

This structure informs the task decomposition. Each task should produce self-contained changes that make sense independently.

## Bite-Sized Task Granularity

**Each step is one action (2-5 minutes):**
- "Read the spec delta and copy scenarios into a TodoWrite checklist" - step
- "Write the verification (test, runnable example, or assertion) that mirrors a scenario" - step
- "Implement the minimal code so the verification passes" - step
- "Run verification & full test suite, confirm pristine output" - step
- "Commit" - step

## Plan Document Header

**Every plan MUST start with this header:**

```markdown
# [Feature Name] Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use spx:openspec-apply to drive each task. Use spx:subagent-driven-development (recommended) or spx:executing-plans for the dispatch model. Steps use checkbox (`- [ ]`) syntax for tracking.

**Change ID:** `<change-id>` (folder: `openspec/changes/<change-id>/`)

**Goal:** [One sentence describing what this builds]

**Architecture:** [2-3 sentences about approach — must align with `design.md`]

**Tech Stack:** [Key technologies/libraries]

**Spec Capabilities Affected:** `<capability-a>`, `<capability-b>`

---
```

## Task Structure

````markdown
### Task N: [Component Name]

**Closes spec deltas:**
- ADDED `<Requirement Name>` in `<capability>` — scenarios: `<scenario-1>`, `<scenario-2>`
- MODIFIED `<Requirement Name>` in `<capability>` — scenarios: `<scenario-3>`

**Files:**
- Create: `exact/path/to/file.py`
- Modify: `exact/path/to/existing.py:123-145`
- Test: `tests/exact/path/to/test.py`

- [ ] **Step 1: Scenario verification for `<scenario-1>`**

This verification asserts the **scenario's THEN clause** — not "the code's behaviour." It expresses the GIVEN/WHEN/THEN from the spec delta. This is not TDD's "write a failing test first"; it's a check that the scenario is satisfied (see the **Verification vs. TDD** sidebar below).

```python
def test_specific_behavior():
    # GIVEN <precondition>
    # WHEN  <action>
    # THEN  <observable outcome>
    result = function(input)
    assert result == expected
```

- [ ] **Step 2: Run verification, confirm it is wired up**

Run: `pytest tests/path/test.py::test_name -v`
Expected: the verification runs and produces a deterministic result against the current code. If the function does not yet exist, the run will error out — that's fine and confirms the verification reaches the code under spec. This is a wiring check, **not** the RED step in TDD.

- [ ] **Step 3: Minimal implementation**

```python
def function(input):
    return expected
```

- [ ] **Step 4: Run verification, confirm scenario is satisfied**

Run: `pytest tests/path/test.py::test_name -v`
Expected: PASS. Then run the full suite and confirm pristine output.

- [ ] **Step 5: Commit & tick task**

```bash
git add tests/path/test.py src/path/file.py openspec/changes/<change-id>/tasks.md
git commit -m "feat(<change-id>): implement <task summary>"
```
````

## No Placeholders

Every step must contain the actual content an engineer needs. These are **plan failures** — never write them:
- "TBD", "TODO", "implement later", "fill in details"
- "Add appropriate error handling" / "add validation" / "handle edge cases"
- "Write tests for the above" (without actual test code)
- "Similar to Task N" (repeat the code — the engineer may be reading tasks out of order)
- Steps that describe what to do without showing how (code blocks required for code steps)
- References to types, functions, or methods not defined in any task

## Remember
- Exact file paths always
- Complete code in every step — if a step changes code, show the code
- Exact commands with expected output
- Every task names the spec delta(s) and scenario(s) it closes
- DRY, YAGNI, spec-driven, frequent commits

## Self-Review

After writing the complete plan, look at the spec with fresh eyes and check the plan against it. This is a checklist you run yourself — not a subagent dispatch.

**1. Spec coverage:** For every ADDED/MODIFIED/REMOVED requirement in the change folder, can you point to a task that closes it? List any gaps.

**2. Scenario coverage:** For every scenario inside those requirements, is there a step that verifies it? List any gaps.

**3. Placeholder scan:** Search your plan for red flags — any of the patterns from the "No Placeholders" section above. Fix them.

**4. Type consistency:** Do the types, method signatures, and property names used in later tasks match what was defined in earlier tasks? A function called `clearLayers()` in Task 3 but `clearFullLayers()` in Task 7 is a bug.

If you find issues, fix them inline. If you find a spec requirement with no task, add the task. If you find a scenario with no verification step, add it. No need to re-review — just fix and move on.

## Verification vs. TDD

SuperSpecs is **spec-driven, not test-driven.** The verification step in every task exists to prove a scenario from the spec is satisfied — it does **not** dictate when the test is written, nor does it require an initial failing run.

- The **spec** is the source of truth (not a failing test).
- The **scenario's GIVEN/WHEN/THEN** is what the verification expresses.
- A passing verification means the scenario is satisfied; nothing else.
- You may write the verification before, alongside, or after the implementation — whichever produces the strongest evidence the scenario is met.

The "Step 2: confirm it is wired up" run is a *wiring check* (proves the verification actually reaches the code under spec), not the RED step of Red-Green-Refactor. Calling it RED conflates SDD with TDD.

See also: `spx:openspec-apply` → "Verification vs. TDD" (lines 88–92).

## Execution Handoff

After saving the plan, offer execution choice:

**"Plan complete and saved to `openspec/changes/<change-id>/plan.md`. Two execution options:**

**1. Subagent-Driven (recommended)** — fresh subagent per task with two-stage review (spec compliance, then code quality)

**2. Inline Execution** — execute tasks in this session, batch with human checkpoints

**Which approach?"**

**Either way, the implementation skill is `spx:openspec-apply`** — it enforces the spec→verify→commit cycle. The choice above only changes the dispatch model:

**If Subagent-Driven chosen:**
- **REQUIRED SUB-SKILLS:** `spx:openspec-apply` + `spx:subagent-driven-development`

**If Inline Execution chosen:**
- **REQUIRED SUB-SKILLS:** `spx:openspec-apply` + `spx:executing-plans`
