---
name: openspec-propose
description: Use when starting any feature, bugfix, or behavior change before writing code. Creates an OpenSpec change folder (proposal, spec deltas, design, tasks) so humans and the agent agree on WHAT to build before HOW.
---

# OpenSpec: Propose

## Overview

In Spec-Driven Development, the **spec is the source of truth**. Before any production code is written, you draft a *change proposal* that captures:

- **proposal.md** — why this change, what's in/out of scope
- **specs/** — spec deltas (`ADDED`, `MODIFIED`, `REMOVED` requirements) for each affected capability
- **design.md** — technical decisions, alternatives considered, trade-offs
- **tasks.md** — implementation checklist (each task ties back to a spec delta)

This skill is the implementation behind the `/propose` slash command. After this skill, you hand off to `writing-plans` (for richer per-task detail) and then `openspec-apply` to implement.

**Announce at start:** "I'm using the openspec-propose skill to draft an OpenSpec change."

<HARD-GATE>
Do NOT write production code, scaffold modules, or run implementation skills until the proposal has been written AND the user has approved it. The spec is the gate.
</HARD-GATE>

## When to Use

**Always, before implementation:**
- New features
- Bug fixes that change observable behavior
- Refactors that change interfaces or contracts
- Configuration changes that affect users

**Exceptions (ask first):**
- Pure formatting/typo fixes
- Throwaway prototypes that will be deleted
- Internal-only refactors with zero behavior change (still recommended, but optional)

Thinking "the spec is overkill for this one"? Stop. That's rationalization. A 3-line spec is still a spec.

## The Iron Law

```
NO PRODUCTION CODE WITHOUT AN APPROVED SPEC DELTA
```

Wrote code first? Set it aside. Write the spec. Then verify the code actually matches the spec — if it doesn't, the code is wrong, not the spec.

## Folder Layout

OpenSpec changes live under `openspec/changes/<change-id>/` where `<change-id>` is a short kebab-case slug (e.g. `add-retry-logic`, `fix-empty-email-validation`).

```
openspec/
├── specs/                     # active spec set (source of truth)
│   └── <capability>/spec.md
└── changes/
    └── <change-id>/
        ├── proposal.md
        ├── design.md
        ├── tasks.md
        └── specs/
            └── <capability>/spec.md   # delta only
```

If `openspec/` doesn't exist yet in the repo, create the folders directly: `openspec/specs/` for the active spec set and `openspec/changes/` for in-flight proposals.

## Checklist

Create a TodoWrite item for each step and complete in order:

1. **Pick a change-id** — short, kebab-case, action-oriented (verb-noun)
2. **Create the change folder** — `openspec/changes/<change-id>/`
3. **Write proposal.md** — Why / What / Scope (in & out) / Impact
4. **Write spec deltas** under `openspec/changes/<change-id>/specs/<capability>/spec.md` using `## ADDED Requirements`, `## MODIFIED Requirements`, `## REMOVED Requirements` sections
5. **Write design.md** — key technical decisions, alternatives, trade-offs (only the non-obvious ones)
6. **Write tasks.md** — checklist of implementation tasks, each tied to a spec delta
7. **Self-review** — placeholder scan, internal consistency, scope check, ambiguity check
8. **Get user approval** — show the proposal, wait for explicit go-ahead before invoking `writing-plans` or `openspec-apply`

## proposal.md Template

```markdown
# <Change Title>

## Why
<1–3 sentences: the problem this change solves, evidence it's worth solving>

## What Changes
- <bullet>: short description, references spec delta(s)
- <bullet>: ...

## Out of Scope
- <bullet>: things the user might reasonably expect but we're explicitly NOT doing here

## Impact
- **Affected capabilities:** <capability-a>, <capability-b>
- **Breaking changes:** <yes/no — and what>
- **Migration:** <only if needed>
```

## Spec Delta Template

A delta file lives at `openspec/changes/<change-id>/specs/<capability>/spec.md`. It contains only the *differences* relative to the active spec at `openspec/specs/<capability>/spec.md`.

```markdown
# <capability> — delta for <change-id>

## ADDED Requirements

### Requirement: <Name>
<Normative statement using SHALL/MUST.>

#### Scenario: <name>
- **GIVEN** <precondition>
- **WHEN** <action>
- **THEN** <observable outcome>

## MODIFIED Requirements

### Requirement: <Name>
<New full text of the requirement; the archive step will replace the old one.>

## REMOVED Requirements

### Requirement: <Name>
<Reason for removal.>
```

Every requirement MUST have at least one scenario. Scenarios are how `openspec-apply` and reviewers verify implementation.

## design.md Template

Keep this short. Only document decisions that aren't obvious from the spec.

```markdown
# Design — <change-id>

## Context
<2–4 sentences on the relevant existing system>

## Decisions
- **<Decision>:** <choice and 1-line reason>
- **<Decision>:** ...

## Alternatives Considered
- **<Alternative>:** rejected because <reason>

## Risks / Open Questions
- <bullet>
```

## tasks.md Template

```markdown
# Tasks — <change-id>

- [ ] 1. <task name>
  - Spec: ADDED `<Requirement Name>` in `<capability>`
  - Files: `path/to/file.ts`, `path/to/test.ts`
- [ ] 2. <task name>
  - Spec: MODIFIED `<Requirement Name>` in `<capability>`
  - Files: ...
```

Tasks may be coarse here; `writing-plans` will expand each into bite-sized steps.

## No Placeholders

Every section must contain real content. These are **proposal failures** — never write them:
- "TBD", "TODO", "fill in details"
- "Add appropriate validation" (which validation? specify it)
- "Handle edge cases" (which edge cases? list them as scenarios)
- A requirement with zero scenarios
- A task that doesn't reference any spec delta

## Self-Review

Before showing the proposal to the user, with fresh eyes:

1. **Spec coverage:** Every bullet in `## What Changes` corresponds to at least one spec delta. Every spec delta has at least one task.
2. **Placeholder scan:** Search for the failure patterns above. Fix inline.
3. **Internal consistency:** Does design.md contradict any spec delta? Do task file paths match the design's component layout?
4. **Scope check:** Is this one focused change, or two changes hiding in a trenchcoat? If two, split into separate proposals.
5. **Ambiguity check:** Could any requirement be implemented two different ways and both satisfy the words? Pick one and tighten the wording.

## User Approval Gate

Once the proposal passes self-review, present it:

> "OpenSpec proposal drafted at `openspec/changes/<change-id>/`. Highlights:
> - **Why:** <1 line>
> - **What:** <bulleted list>
> - **Affected capabilities:** <list>
>
> Please review the files and let me know if anything needs to change before I move to `writing-plans`."

**Wait for explicit approval.** Do NOT invoke `writing-plans`, `openspec-apply`, or any implementation skill until the user says go.

## Red Flags — STOP and Restart

- Wrote code before the proposal exists → set code aside, write proposal, then verify
- Requirement with no scenario → not a requirement, it's a wish
- Task with no spec delta reference → out of scope or spec is incomplete
- Design.md describing implementation details that don't appear in any spec delta → either move them to a delta or delete them
- "We'll figure out the details during implementation" → that's the proposal failing
- Multiple unrelated changes in one proposal → split

## Integration

**Required predecessor:**
- `superspecs:brainstorming` — the proposal builds on the approved design

**Required successor:**
- `superspecs:writing-plans` — expand `tasks.md` into bite-sized executable steps

**Then:**
- `superspecs:openspec-apply` — implement the tasks against the spec
- `superspecs:openspec-archive` — after merge, fold deltas into the active spec set
