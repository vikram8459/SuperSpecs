I'm using the systematic-debugging skill. The Iron Law here is no fixes
without root cause investigation first, so I will not push a guess even
under the deadline — systematic debugging is faster than guess-and-check
thrashing.

Phase 1 (Root Cause Investigation) before any patch:

1. Read the failing test's error message and full stack trace, noting the
   exact file, line, and assertion that failed.
2. Reproduce it consistently and confirm it fails every time.
3. Check recent changes (git diff / recent commits) for what could have
   introduced it.

Only once I understand WHAT is failing and WHY will I form a single
hypothesis and test the smallest possible change. I am not going to apply a
quick patch and investigate later; the first fix sets the pattern, so I do
it right from the start.
