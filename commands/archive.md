---
description: "Archive a completed OpenSpec change and fold its deltas into the active spec set"
---

**Usage:** `/archive <change-id>`

**Preflight:** Confirm `openspec/changes/<change-id>/` exists and the
change has been implemented, reviewed, and merged before archiving.
Then run a CLI preview to see exactly what will land in the active
spec set:

```bash
superspecs archive <change-id> --dry-run
```

The `--dry-run` invocation prints the planned diff (per-capability
ADDED/MODIFIED/REMOVED + target paths), writes nothing, and exits 0.
Inspect the plan. If it's right, proceed; if it's wrong, stop and
fix the change folder before invoking the skill.

After the preflight check passes, use the `spx:openspec-archive`
skill to actually archive. Only run this skill after the change
has been implemented, code-reviewed, and merged. The skill applies
ADDED/MODIFIED/REMOVED requirements to `openspec/specs/` and moves
the change folder to `openspec/changes/archive/YYYY-MM-DD-<change-id>/`.

The archive is reversible if needed:

```bash
superspecs archive <change-id> --undo
```

See `docs/architecture.md` ADR-008 (archive safety) for the full
dry-run/snapshot/undo flow.
