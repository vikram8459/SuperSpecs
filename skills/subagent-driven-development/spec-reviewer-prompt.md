# Spec Compliance Reviewer Prompt Template

Use this template when dispatching a spec compliance reviewer subagent.

**Purpose:** Verify implementer built what was requested (nothing more, nothing less)

```
Task tool (general-purpose):
  description: "Review spec compliance for Task N"
  prompt: |
    You are reviewing whether an implementation matches its specification.

    ## What Was Requested

    [FULL TEXT of task requirements]

    ## Spec Deltas This Task Closes

    [Paste the relevant ADDED/MODIFIED/REMOVED requirement blocks from
     `openspec/changes/<change-id>/specs/<capability>/spec.md`, including
     every scenario. These are the acceptance criteria.]

    ## What Implementer Claims They Built

    [From implementer's report]

    ## CRITICAL: Do Not Trust the Report

    The implementer finished suspiciously quickly. Their report may be incomplete,
    inaccurate, or optimistic. You MUST verify everything independently.

    **DO NOT:**
    - Take their word for what they implemented
    - Trust their claims about completeness
    - Accept their interpretation of requirements

    **DO:**
    - Read the actual code they wrote
    - Compare actual implementation to requirements line by line
    - Check for missing pieces they claimed to implement
    - Look for extra features they didn't mention

    ## Your Job

    Read the implementation code AND the verification artifacts (tests, scripts).
    For every scenario in the spec delta(s), confirm:

    **Scenario coverage:**
    - Is there a verification artifact (test, runnable check, etc.) that exercises
      this exact GIVEN/WHEN/THEN?
    - Does the artifact actually run? Does it pass?
    - Does it test the real behavior, or just a mock that re-states the assertion?

    **Missing requirements:**
    - Are there requirements (or scenarios) in the delta with no implementation?
    - Did they claim something works but didn't actually implement it?

    **Extra/unneeded work:**
    - Did they build behavior that isn't required by any delta in this change?
    - Did they over-engineer or add "nice to haves"?

    **Misunderstandings:**
    - Did they interpret a requirement differently than the scenarios specify?
    - Did they solve the wrong problem?
    - Did they implement the right feature but wrong way (passes a weaker test than the scenario requires)?

    **Tasks.md hygiene:**
    - Are checkbox states honest? Anything ticked that isn't actually done?

    **Verify by reading code and running verification, not by trusting the report.**

    Report:
    - ✅ Spec compliant (every scenario has passing verification, nothing extra)
    - ❌ Issues found: [list specifically what's missing/extra/wrong, with file:line references and which scenario is affected]
```
