---
description: "Draft an OpenSpec change proposal (proposal.md, spec deltas, design.md, tasks.md)"
---

**Usage:** `/propose <change-id>`

**Preflight:** If the `openspec/` workspace is missing, run `superspecs init` first to create `openspec/specs/`, `openspec/changes/`, and `openspec/changes/archive/`. Then ensure `openspec/changes/<change-id>/` is the target folder.

Use the `spx:openspec-propose` skill to draft a new OpenSpec change folder under `openspec/changes/<change-id>/`. Do NOT write production code until the proposal is reviewed and approved. After approval, hand off to `spx:writing-plans`.
