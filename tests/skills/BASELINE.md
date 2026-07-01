# Skill Eval Baseline

Regenerate after adding or changing evals. Replay pass rate is over the
committed transcripts (deterministic; `npm run eval`).

| Eval file | Skill | Adapter | Replay |
|-----------|-------|---------|--------|
| tests/skills/writing-plans/no-tdd-framing.eval.json | writing-plans | transcript | PASS |
| tests/skills/openspec-propose/no-code-before-spec.eval.json | openspec-propose | transcript | PASS |
| tests/skills/openspec-propose/no-placeholders.eval.json | openspec-propose | transcript | PASS |
| tests/skills/openspec-apply/task-closed-when-verified.eval.json | openspec-apply | transcript | PASS |
| tests/skills/verification-before-completion/no-claim-without-run.eval.json | verification-before-completion | transcript | PASS |
| tests/skills/using-superspecs/direct-answer.eval.json | using-superspecs | transcript | PASS |
| tests/skills/brainstorming/design-before-build.eval.json | brainstorming | transcript | PASS |
| tests/skills/systematic-debugging/root-cause-before-fix.eval.json | systematic-debugging | transcript | PASS |
| tests/skills/openspec-archive/no-archive-before-merge.eval.json | openspec-archive | transcript | PASS |
| tests/skills/subagent-driven-development/two-stage-review.eval.json | subagent-driven-development | transcript | PASS |

Pass rate: 10 / 10.
