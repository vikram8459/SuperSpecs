# list

### Requirement: Change Inventory

`superspecs list` SHALL print the workspace's in-flight changes, archived changes, and active capabilities, one entry per line with a single-character type prefix (`C` change, `A` archive, `S` capability), and SHALL support a `--json` flag that emits the same data as `{ changes, archived, capabilities }`.

#### Scenario: listing a populated workspace

- **GIVEN** a workspace with in-flight changes, archived changes, and capabilities
- **WHEN** `superspecs list` runs
- **THEN** each entry is printed on its own line under its type prefix

#### Scenario: json output mirrors the text listing

- **GIVEN** the same workspace
- **WHEN** `superspecs list --json` runs
- **THEN** stdout is JSON carrying the `changes`, `archived`, and `capabilities` arrays
