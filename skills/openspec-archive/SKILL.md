---
name: openspec-archive
description: Use after an OpenSpec change has been implemented, reviewed, and merged. Folds the change's spec deltas into the active spec set and archives the change folder so the active specs always reflect reality.
---

# OpenSpec: Archive

## Overview

After a change is merged, its spec deltas (`ADDED`, `MODIFIED`, `REMOVED` requirements) must be **applied to the active spec set** at `openspec/specs/`. Otherwise the active specs drift from reality and future proposals build on a lie.

This skill is the implementation behind the `/archive` slash command.

**Announce at start:** "I'm using the openspec-archive skill to archive <change-id>."

## When to Use

You have:
- An OpenSpec change at `openspec/changes/<change-id>/` whose tasks are all complete
- The implementation has been code-reviewed and merged to the main development branch
- All scenarios in the deltas have demonstrable verification

Do NOT archive a change whose code hasn't merged. Archive = "this is now reality."

## The Iron Law

```
ARCHIVING = APPLYING DELTAS TO THE ACTIVE SPEC SET, FAITHFULLY
```

If any delta in the change is *not* yet reflected in code, do not archive — go back to `openspec-apply` and finish the work.

## Checklist

Create a TodoWrite item for each step:

1. **Verify merge state** — change branch merged into main; CI green
2. **Diff active specs vs. change deltas** — for each capability touched, list which requirements are ADDED, MODIFIED, REMOVED
3. **Apply ADDED requirements** — append into `openspec/specs/<capability>/spec.md` (keep ordering sensible; alphabetical or grouped by area)
4. **Apply MODIFIED requirements** — replace the matching requirement block in the active spec; preserve any unchanged scenarios from the active spec only if the delta did not redefine them
5. **Apply REMOVED requirements** — delete the matching requirement block from the active spec; if other requirements referenced it, update those references
6. **Move the change folder to archive** — `openspec/changes/archive/YYYY-MM-DD-<change-id>/` (date prefix = merge date)
7. **Run validation** — manual scan: every requirement in active specs has at least one scenario; no orphan references (see Validation Pass below)
8. **Commit** — `chore(openspec): archive <change-id>` with the spec set diff and the moved folder
9. **Announce completion** to the user with a summary of which capabilities changed

## How to Apply Each Delta Type

### ADDED Requirements

Append the requirement block (with all its scenarios) into `openspec/specs/<capability>/spec.md`. If the file doesn't exist yet, create it with a top-level heading `# <capability>`.

### MODIFIED Requirements

Find the requirement with the same name in `openspec/specs/<capability>/spec.md`. Replace the entire block (heading + scenarios) with the version from the delta. The delta is intended to be the **new full text**, not a patch.

If the active spec had scenarios that the delta dropped, that is intentional — the delta is the new truth. (If you suspect dropping was an accident, stop and confirm with the user before archiving.)

### REMOVED Requirements

Delete the matching requirement block from the active spec. Then grep the rest of the active spec set for references to that requirement name and either update or remove them. If any other requirement depended on the removed one, that's a spec gap — flag it before archiving.

## Folder Move

```
# before
openspec/changes/<change-id>/
    proposal.md
    design.md
    tasks.md
    specs/<capability>/spec.md

# after
openspec/changes/archive/2026-04-26-<change-id>/
    proposal.md
    design.md
    tasks.md
    specs/<capability>/spec.md
```

Keep the archived folder intact — it's the historical record of *why* the active spec looks the way it does. Never edit archived change folders.

## Validation Pass

Manually verify:

- [ ] Every requirement in `openspec/specs/**` has at least one scenario
- [ ] No two requirements share the same name within a capability
- [ ] No requirement references another requirement that no longer exists
- [ ] All scenarios in the merged change are present in the active spec set (for ADDED/MODIFIED) or absent (for REMOVED)
- [ ] The archived change folder contains everything it had before the move

Resolve any issues before committing.

## Commit & Announce

Single commit, conventional message:

```
chore(openspec): archive <change-id>

- ADDED: <list>
- MODIFIED: <list>
- REMOVED: <list>
```

Then tell the user:

> "Archived `<change-id>`. Active spec set now reflects:
> - ADDED `<requirement>` in `<capability>` (× N)
> - MODIFIED `<requirement>` in `<capability>` (× N)
> - REMOVED `<requirement>` in `<capability>` (× N)
>
> Archive at `openspec/changes/archive/<dated-folder>/`."

## Red Flags — STOP

- A delta was never implemented but you're about to archive it → go back to `openspec-apply`
- A `MODIFIED` requirement's new text doesn't match what the code actually does → the implementation drifted; fix the code or fix the delta, then re-review
- The active spec already had a requirement with the same name as an `ADDED` delta → the proposal author treated a modification as an addition; reconcile before archiving
- You're tempted to "tidy up" unrelated requirements while you're in there → don't. That's a separate proposal.
- The change branch isn't merged yet → archiving is premature

## Integration

**Required predecessors:**
- `superspecs:openspec-apply` — all tasks complete and verified
- `superspecs:requesting-code-review` — change has been reviewed
- `superspecs:finishing-a-development-branch` — change has been merged

**Successor:**
- Next proposal can now build on the updated active spec set
