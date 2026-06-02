---
description: "Expand an approved OpenSpec change into a bite-sized implementation plan"
---

**Usage:** `/write-plan <change-id>`

**Preflight:** Confirm `openspec/changes/<change-id>/` exists with an approved `proposal.md` and `tasks.md` before expanding the plan.

Use the `spx:writing-plans` skill to expand the `tasks.md` of the current OpenSpec change folder (`openspec/changes/<change-id>/`) into an executable plan. Each task must cite the spec delta(s) and scenario(s) it closes.
