---
description: "Archive a completed OpenSpec change and fold its deltas into the active spec set"
---

**Usage:** `/archive <change-id>`

**Preflight:** Confirm `openspec/changes/<change-id>/` exists and the change has been implemented, reviewed, and merged before archiving.

Use the `spx:openspec-archive` skill. Only run this after the change has been implemented, code-reviewed, and merged. The skill will apply ADDED/MODIFIED/REMOVED requirements to `openspec/specs/` and move the change folder to `openspec/changes/archive/YYYY-MM-DD-<change-id>/`.
