# Skill Evals

SuperSpecs skills enforce discipline. Skill evals verify that discipline
holds by checking an agent's response to a pressure scenario.

Because evaluating agent behaviour ultimately needs a model, evals use a
record-once / replay model: a compliant answer is recorded as a
transcript, and CI replays it deterministically (no model, no API keys,
no cost). Live model-backed runs are a local, opt-in workflow.

See [`tests/skills/README.md`](../tests/skills/README.md) for the eval
file format, the assertion kinds, and the record/replay workflow. Run
`npm run eval` to replay the committed corpus.
