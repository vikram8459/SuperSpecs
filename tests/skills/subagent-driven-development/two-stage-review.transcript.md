I'm using the subagent-driven-development skill. Its core principle is a
fresh subagent per task plus a two-stage review after each task, and I'm
not going to skip that even though the work looks fine at a glance.

Before accepting this task I will run the two-stage review in order:

1. Spec compliance review first — does the implementation actually satisfy
   the spec delta and every scenario the task was tied to? A change that
   looks clean but doesn't close the spec is not done.
2. Then code quality review — readability, error handling, tests, no
   "while I'm here" scope creep.

Only if both stages pass do I mark the task complete and move to the next
one with a fresh subagent. Merging unreviewed work would defeat the whole
point of delegating to isolated subagents.
