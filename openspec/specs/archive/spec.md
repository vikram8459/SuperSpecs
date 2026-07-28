# archive

### Requirement: Delta Folding

`superspecs archive <change-id>` SHALL fold the change's ADDED, MODIFIED, and REMOVED spec deltas into the active spec set under `openspec/specs/` and move the change folder under `openspec/changes/archive/` with a date prefix.

#### Scenario: an ADDED requirement is folded into the active spec

- **GIVEN** a change with an ADDED requirement not yet in the active spec
- **WHEN** `superspecs archive <change-id>` runs
- **THEN** the requirement appears in the capability's active spec and the change folder is archived

### Requirement: Archive Safety

Archive SHALL support `--dry-run` (compute the plan without writing) and `--undo` (reverse a prior archive), and SHALL refuse a change-id that is not a single safe path segment.

#### Scenario: a traversal change-id is rejected

- **GIVEN** a change-id that contains path separators or `..`
- **WHEN** `superspecs archive` runs with that id
- **THEN** it exits non-zero without modifying the tree

### Requirement: Source-Preserving Round-Trip

Folding a requirement into the active spec SHALL preserve its verbatim source, including multi-paragraph bodies and prose between scenarios.

#### Scenario: a multi-paragraph body survives

- **GIVEN** a delta whose ADDED requirement body spans two paragraphs
- **WHEN** `superspecs archive` runs
- **THEN** both paragraphs are present in the resulting active spec
