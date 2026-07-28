# doctor

### Requirement: Installation Health Report

`superspecs doctor` SHALL report the presence of both SessionStart hook scripts, the Cursor plugin manifest, and the required schemas — these determine the exit code — and SHALL additionally surface the effective `SUPERSPECS_MODE` and recent hook-log lines as informational (non-failing) checks.

#### Scenario: a healthy install exits 0

- **GIVEN** an installation with both hook scripts, the plugin manifest, and all required schemas present
- **WHEN** `superspecs doctor` runs
- **THEN** it prints an OK line for each required check and exits 0

#### Scenario: a missing required artifact fails

- **GIVEN** an installation missing a required schema
- **WHEN** `superspecs doctor` runs
- **THEN** it marks that check MISSING and exits non-zero

### Requirement: Mode Diagnostics

`superspecs doctor` SHALL report the effective `SUPERSPECS_MODE` and flag an unrecognized value without changing the exit code.

#### Scenario: an unrecognized mode is flagged

- **GIVEN** `SUPERSPECS_MODE` set to a value other than `strict`, `auto`, or `manual`
- **WHEN** `superspecs doctor` runs
- **THEN** it reports the value as unrecognized and still exits based only on required checks
