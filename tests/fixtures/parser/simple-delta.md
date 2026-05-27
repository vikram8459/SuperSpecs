# cli — delta for example-change

## ADDED Requirements

### Requirement: Version Flag

The CLI SHALL print version when invoked with --version.

#### Scenario: prints version

- **GIVEN** the package is built
- **WHEN** the user runs `superspecs --version`
- **THEN** stdout contains the version
