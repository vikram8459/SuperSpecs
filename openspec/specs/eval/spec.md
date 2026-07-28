# eval

### Requirement: Replay-Based Skill Evals

`superspecs eval [<glob>]` SHALL validate each matched `*.eval.json` against the skill-eval schema and replay it deterministically against its recorded transcript, exiting non-zero if any file is invalid or any eval fails.

#### Scenario: a passing corpus exits 0

- **GIVEN** a set of eval files that satisfy the schema and pass their assertions
- **WHEN** `superspecs eval` runs
- **THEN** it prints a PASS line for each and exits 0

#### Scenario: an invalid eval file fails the run

- **GIVEN** an eval file that does not match the skill-eval schema
- **WHEN** `superspecs eval` runs
- **THEN** it reports the file as invalid and exits non-zero

### Requirement: Deterministic And Secret-Free

`superspecs eval` SHALL run without network access, model calls, or secrets — replaying recorded transcripts only.

#### Scenario: no eval files match

- **GIVEN** a glob that matches no eval files
- **WHEN** `superspecs eval <glob>` runs
- **THEN** it reports that no files matched and exits 0
