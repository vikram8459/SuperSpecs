# Design — good-x

## Context

The system currently has no foo capability.

## Decisions

- **Foo storage:** keep it in-memory; the data is ephemeral.
- **No new dependency:** implement with the standard library.

## Alternatives Considered

- Persist foo to disk. Rejected: adds I/O for no current benefit.
