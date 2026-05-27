---
description: "Run `superspecs validate` against an in-flight change and fix every reported error"
---

Use the `spx:openspec-validate` skill to run `superspecs validate [<change-id>]` against the named in-flight change (or all of them) and resolve every reported `file:line:col: SDD<NNN>` error before handing off to `spx:openspec-apply` or `spx:openspec-archive`. The Iron Law: no handoff with outstanding validate errors.
