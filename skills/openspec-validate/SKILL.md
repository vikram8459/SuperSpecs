---
name: openspec-validate
description: Use when an OpenSpec change folder exists and the agent has just written or edited proposal.md, spec-delta files, or tasks.md. Runs `superspecs validate` and fixes the reported errors before handing off to spx:openspec-apply or spx:openspec-archive.
---

# OpenSpec: Validate

## Overview

This skill is the implementation behind the `/validate` slash
command. It runs the `superspecs validate` CLI against the current
change folder (or all in-flight changes) and resolves every reported
error before the agent hands off to `spx:openspec-apply` or
`spx:openspec-archive`.

**Announce at start:** "I'm using the openspec-validate skill to run `superspecs validate` and fix what it reports."

## When to Use

- After `spx:openspec-propose` writes a change folder, before the
  user approval gate.
- After `spx:writing-plans` edits `tasks.md`.
- Before `spx:openspec-archive`, as a precondition gate.

## The Iron Law

```
NO HANDOFF WITH OUTSTANDING VALIDATE ERRORS
```

If `superspecs validate` exits non-zero, the change is not ready.
Fix the artefacts, re-run, repeat until exit 0.

## Checklist

1. **Run validate.** From the repo root:

   ```bash
   superspecs validate <change-id>
   ```

   Omit `<change-id>` to validate every in-flight change at once.

2. **If exit 0:** announce "validate passed" and return control to
   the calling skill.

3. **If exit non-zero:** for each `file:line:col: SDD<NNN> <message>`
   line, open the file at the reported position and fix the issue.
   Common codes:

   | Code | Meaning | Fix |
   |------|---------|-----|
   | SDD001 | Requirement without scenarios | Add at least one `#### Scenario:` block with GIVEN/WHEN/THEN |
   | SDD002 | Scenario with empty THEN | Fill in the THEN clause |
   | SDD003 | Scenario with empty GIVEN | Fill in the GIVEN clause |
   | SDD004 | Scenario with empty WHEN | Fill in the WHEN clause |
   | SDD010 | Task without spec-delta reference | Add `Spec:` sub-bullet pointing to the delta requirement |
   | SDD011 | Task without files | Add `Files:` sub-bullet listing touched paths |
   | SDD012 | Empty top-level `tasks` array | Add at least one task |
   | SDD050 | Duplicate requirement name in one section | Rename one of the duplicates |
   | SDD100 | Proposal missing `## Why` | Add the section with a non-empty body |
   | SDD101 | Empty `## What Changes` | Add at least one bullet |
   | SDD102 | Proposal missing `## Impact` | Add the section with a non-empty body |
   | SDD103 | Empty `# <Title>` | Add the top-level heading |

   The authoritative registry lives in `schemas/README.md`.

4. **Re-run validate.** Repeat until clean.

5. **Commit the fixes.** Use a conventional commit prefix:

   ```bash
   git commit -m "fix(<change-id>): resolve validate errors"
   ```

## Red Flags — STOP

- "I'll suppress the error" — there is no suppression. Fix the
  artefact.
- "The validator is wrong" — file an issue against
  `spx:openspec-propose` or `superspecs` itself. Do NOT work
  around the error in your spec.
- "I'll ignore SDD999 for now" — SDD999 means the schema saw an
  unmapped failure mode. Investigate; it usually means the schema
  has tightened and your spec needs to catch up.

## Integration

**Required predecessor:**
- `spx:openspec-propose` or `spx:writing-plans` — something that
  produces or modifies the artefacts being validated.

**Required successor:**
- The calling skill (typically `spx:openspec-apply` or
  `spx:openspec-archive`).
