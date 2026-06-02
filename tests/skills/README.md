# Skill Evals

A skill eval checks that an agent follows a skill's discipline under
pressure. Evals are JSON files matching `schemas/skill-eval.schema.json`.

## Format

```json
{
  "skill": "<skill-slug>",
  "scenario": "<pressure scenario shown to the agent>",
  "pressures": ["time", "sunk-cost"],
  "expected": "<what a compliant agent does>",
  "assertions": [
    { "kind": "contains | not-contains | matches", "value": "<string or regex>" }
  ],
  "transcript": "tests/skills/<skill>/<name>.transcript.md"
}
```

- `contains` — passes when the transcript includes the value as a substring.
- `not-contains` — passes when the transcript does NOT include the value.
- `matches` — passes when the value, treated as a regular expression, matches.

An eval passes only when every assertion passes.

## Adapters (how the agent answer is obtained)

- **transcript** (default, used by CI): reads the committed `transcript`
  file. Deterministic, no model, no cost.
- **manual**: prints the scenario for a human/agent to answer, then reads
  the recorded transcript.
- **live-LLM**: calls a real model — planned, not in this release.

## Running

```bash
npm run eval                  # replay all committed evals (deterministic)
node dist/superspecs.js eval "tests/skills/<skill>/**/*.eval.json"
```

## Record / re-record workflow

CI replays committed transcripts. When you change a skill, the eval
workflow runs; if a recorded transcript no longer reflects the intended
behaviour, re-record it (run the scenario against an agent, save its
answer to the `.transcript.md` file) and commit the updated transcript
together with the skill change so the guardrail stays honest.

## Assertion design tips

- Forbid the *non-compliant* phrasing, not a phrase the compliant answer
  also contains. A `not-contains` over a string the compliant transcript
  negates (e.g. "I will not do X") will falsely fail — assert the bare
  non-compliant phrase instead.
- Pair a positive `matches`/`contains` (the behaviour you want) with a
  negative `not-contains` (the behaviour you forbid) for a tight check.
