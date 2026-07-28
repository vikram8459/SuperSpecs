# validate — delta for add-spec-linkage-validation

## ADDED Requirements

### Requirement: Spec-to-Task Linkage

`superspecs validate` SHALL report `SDD060` for any ADDED or MODIFIED requirement declared in a change's spec deltas that is not referenced by at least one task's `Spec:` line, matched by requirement name and capability. REMOVED requirements are exempt.

#### Scenario: an orphan requirement is rejected

- **GIVEN** a change whose spec delta adds a requirement that no task references
- **WHEN** `superspecs validate <change-id>` runs
- **THEN** it exits non-zero and prints an `SDD060` diagnostic at the requirement heading

#### Scenario: a fully-linked change passes

- **GIVEN** a change where every ADDED and MODIFIED requirement is referenced by at least one task's `Spec:` line
- **WHEN** `superspecs validate <change-id>` runs
- **THEN** no `SDD060` diagnostic is produced

#### Scenario: a removed requirement needs no task

- **GIVEN** a change whose only delta REMOVES a requirement, with no task referencing it
- **WHEN** `superspecs validate <change-id>` runs
- **THEN** no `SDD060` diagnostic is produced for the removed requirement
