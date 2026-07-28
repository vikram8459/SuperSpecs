# validate

### Requirement: Change Artifact Validation

`superspecs validate [<change-id>]` SHALL parse each change's `proposal.md`, spec deltas, `tasks.md`, and (when present) `design.md`, and report every violation as `file:line:col: SDD<NNN> <message>`.

#### Scenario: a well-formed change passes

- **GIVEN** a change folder whose artifacts satisfy the schemas
- **WHEN** `superspecs validate <change-id>` runs
- **THEN** it exits 0 and prints a no-errors summary

#### Scenario: a malformed change reports a coded diagnostic

- **GIVEN** a change with a requirement that has no scenarios
- **WHEN** `superspecs validate <change-id>` runs
- **THEN** it exits non-zero and prints an `SDD001` diagnostic carrying a source position

### Requirement: Active Spec Set Validation

`superspecs validate --active` SHALL validate every capability under `openspec/specs/`, rejecting duplicate requirement names within a capability and any requirement that has no scenarios.

#### Scenario: a clean active set passes

- **GIVEN** an `openspec/specs/` tree where every requirement has at least one scenario
- **WHEN** `superspecs validate --active` runs
- **THEN** it exits 0 and reports the number of capabilities checked

### Requirement: Machine-Readable Output

`superspecs validate` SHALL support a `--json` flag that emits an object with `ok`, a count field, and an `errors` array to stdout, leaving exit codes unchanged.

#### Scenario: json output on a clean change

- **GIVEN** a well-formed change
- **WHEN** `superspecs validate <change-id> --json` runs
- **THEN** stdout is JSON with `ok` true and an empty `errors` array
