---
description: "Run `superspecs validate` against an in-flight change and fix every reported error"
---

**Usage:** `/validate [<change-id>]` (the change-id is optional; omit it to validate every in-flight change)

**Preflight:** Confirm `openspec/changes/<change-id>/` exists (or omit the id to validate all in-flight changes).

Use the `spx:openspec-validate` skill to run `superspecs validate [<change-id>]` against the named in-flight change (or all of them) and resolve every reported `file:line:col: SDD<NNN>` error before handing off to `spx:openspec-apply` or `spx:openspec-archive`. The Iron Law: no handoff with outstanding validate errors.
