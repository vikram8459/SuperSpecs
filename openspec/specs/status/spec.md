# status

### Requirement: Current Change Summary

`superspecs status` SHALL report the most-recently-modified in-flight change, its task checkbox counts (done and open), and the last archived change; `--json` SHALL emit the same as `{ current, tasks, lastArchive }`.

#### Scenario: status with an in-flight change

- **GIVEN** a workspace with at least one in-flight change whose `tasks.md` has checkboxes
- **WHEN** `superspecs status` runs
- **THEN** it prints the current change and its done/open task counts

#### Scenario: status with no in-flight change

- **GIVEN** a workspace with no in-flight changes
- **WHEN** `superspecs status` runs
- **THEN** it reports that there is no in-flight change
