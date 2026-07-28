# hooks

### Requirement: SessionStart Skill Injection

The SessionStart hook SHALL emit a JSON envelope whose additional context is the contents of `skills/using-superspecs/SKILL.md`, on both the PowerShell and POSIX implementations, producing byte-equivalent content after newline normalization.

#### Scenario: the hook injects the entry skill

- **GIVEN** a session start on a harness that runs the hook
- **WHEN** the hook script runs
- **THEN** the emitted additional context contains the `using-superspecs` skill body

### Requirement: Hook Disable Switch

When `SUPERSPECS_DISABLE=1` is set, the hook SHALL emit an empty additional-context envelope and exit 0 before performing any file I/O.

#### Scenario: a disabled hook emits nothing

- **GIVEN** `SUPERSPECS_DISABLE=1` in the environment
- **WHEN** the hook script runs
- **THEN** it emits an empty additional-context envelope and exits 0
