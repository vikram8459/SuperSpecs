# init

### Requirement: Workspace Scaffolding

`superspecs init` SHALL create `openspec/specs/`, `openspec/changes/`, and `openspec/changes/archive/`, and SHALL refuse to overwrite a non-empty target unless `--force` is given.

#### Scenario: init on an empty workspace

- **GIVEN** a directory with no `openspec/` tree
- **WHEN** `superspecs init` runs
- **THEN** the `openspec/` folders are created and the command exits 0

### Requirement: Multi-Harness Manifests

`superspecs init --harness=<name>` SHALL install the manifest, hook configuration, and/or `AGENTS.md` for a harness listed in `docs/harnesses.json`, without copying the shared `skills/` and `commands/` directories.

#### Scenario: init for a known harness

- **GIVEN** a harness name present in `docs/harnesses.json`
- **WHEN** `superspecs init --harness=<name>` runs
- **THEN** that harness's manifest files are written to their canonical paths
