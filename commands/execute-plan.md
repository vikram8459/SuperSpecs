---
description: "Execute an OpenSpec change plan inline (with human checkpoints)"
---

Use the `spx:executing-plans` skill to execute the plan at `openspec/changes/<change-id>/plan.md`. Apply `spx:openspec-apply` discipline per task: read the spec delta, implement minimally, verify every scenario, commit. After all tasks complete, run `spx:finishing-a-development-branch` and then `spx:openspec-archive` once merged.

If subagent dispatch is available, prefer `spx:subagent-driven-development` over inline execution.
