# Code Quality Reviewer Prompt Template

Use this template when dispatching a code quality reviewer subagent.

**Purpose:** Verify implementation is well-built (clean, tested, maintainable)

**Only dispatch after spec compliance review passes.**

```
Task tool (general-purpose, role = code-reviewer):
  Use template at skills/requesting-code-review/code-reviewer.md
  (skill: spx:requesting-code-review)

  WHAT_WAS_IMPLEMENTED: [from implementer's report]
  SPEC_DELTAS: [paste the relevant blocks from openspec/changes/<change-id>/specs/...]
  PLAN_OR_REQUIREMENTS: Task N from openspec/changes/<change-id>/plan.md
  BASE_SHA: [commit before task]
  HEAD_SHA: [current commit]
  DESCRIPTION: [task summary]
```

**In addition to standard code quality concerns, the reviewer should check:**
- Does each file have one clear responsibility with a well-defined interface?
- Are units decomposed so they can be understood and tested independently?
- Is the implementation following the file structure from the plan?
- Did this implementation create new files that are already large, or significantly grow existing files? (Don't flag pre-existing file sizes — focus on what this change contributed.)

**Code reviewer returns:** Strengths, Issues (Critical/Important/Minor), Assessment
