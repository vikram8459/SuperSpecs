---
description: "Execute an OpenSpec change plan inline (with human checkpoints)"
---

Use the `superspecs:executing-plans` skill to execute the plan at `openspec/changes/<change-id>/plan.md`. Apply `superspecs:openspec-apply` discipline per task: read the spec delta, implement minimally, verify every scenario, commit. After all tasks complete, run `superspecs:finishing-a-development-branch` and then `superspecs:openspec-archive` once merged.

If subagent dispatch is available, prefer `superspecs:subagent-driven-development` over inline execution.
