# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added (Phase E3 — 2026-06-11)
- `skills/brainstorming/scripts/package.json` — declares `ws@^8.18.0` and `vitest`; marks the brainstorm-companion as a private sub-package.
- `skills/brainstorming/scripts/vitest.config.mjs` — picks up `tests/**/*.test.mjs`.
- `skills/brainstorming/scripts/tests/server.test.mjs` — 5 behaviour tests (connect/disconnect, JSON round-trip, fragment handling, oversize-payload rejection with close code 1009, HTTP waiting-page sanity).
- `docs/architecture.md` ADR-010 — records the decision to use the `ws` package over hand-rolled RFC-6455 framing; documents the preserved external contract and rejected alternatives (separate package, Node 22+ built-in, drop entirely).

### Changed (Phase E3 — 2026-06-11)
- `skills/brainstorming/scripts/server.cjs` — rewritten to use `WebSocketServer` from `ws`. External contract preserved: same env vars (`BRAINSTORM_PORT`, `BRAINSTORM_HOST`, `BRAINSTORM_URL_HOST`, `BRAINSTORM_DIR`, `BRAINSTORM_OWNER_PID`), same stdout JSON event types, same HTTP routes, same `helper.js` injection. `start-server.sh` and `stop-server.sh` need no changes. The `server-started` event now reports the actually-bound port (correct when `BRAINSTORM_PORT=0` and the OS picks).
- `skills/brainstorming/SKILL.md` Visual Companion section — added a "Setup note" pointing at the new `npm install --prefix skills/brainstorming/scripts/` step and ADR-010.
- `.gitignore` — anchored the root `scripts/` rule to `/scripts/` (was incorrectly matching nested `skills/brainstorming/scripts/`). Added an explicit ignore for `skills/brainstorming/scripts/node_modules/`.

### Added
- `docs/architecture.md` — hook contract, skill discovery, OpenSpec layout, ADR section.
- `docs/skill-authoring.md` — cross-reference and design-notes conventions.
- `docs/openspec-walkthrough.md` — end-to-end worked example of the SDD flow.
- `AGENTS.md` — harness-agnostic entry point mirroring the SessionStart hook payload.
- `CONTRIBUTING.md` — how to author skills, run evals, and submit changes.
- `CHANGELOG.md` (this file).
- "Skip skills when" bypass section in `skills/using-superspecs/SKILL.md` listing concrete cases (read-only inspection, formatting, single-line typo fixes, exploratory shell commands, direct questions).
- `SUPERSPECS_MODE` configuration knob (`strict` | `auto` | `manual`, default `auto`) — documented; not yet enforced.
- "Verification vs. TDD" sidebar in `skills/writing-plans/SKILL.md`.
- Scope note in `skills/writing-skills/SKILL.md` and `skills/writing-skills/testing-skills-with-subagents.md` clarifying that Red-Green-Refactor applies only to skill-authoring meta-process.
- `openspec/changes/phase-a-foundational-hygiene/proposal.md` — eats own dogfood for the Phase A change.

### Changed
- Brainstorming flowchart terminal node and prose now agree: terminal state is `spx:openspec-propose`.
- Brainstorming design output canonical path is `openspec/changes/<change-id>/design-notes.md`; the legacy `docs/specs/...` fork is removed.
- `skills/openspec-propose/SKILL.md` declares its input file (the design-notes path).
- **Command prefix renamed from `superspecs:<name>` to `spx:<name>`** across every skill, command file, doc, hook envelope text, and the open Phase A change proposal. All cross-skill references now use the canonical `spx:<name>` form. Environment variables (`SUPERSPECS_MODE`, `SUPERSPECS_DISABLE`, `SUPERSPECS_TELEMETRY`) are unchanged. Stderr log-prefix tags in hook scripts (`"superspecs: ..."`) are unchanged.
- `skills/writing-plans/SKILL.md` plan-template "Verification stub" steps renamed to "Scenario verification"; Step 2 reframed as a wiring check, not a TDD RED step.
- `package.json` populated with `author`, `repository`, `bugs`, `homepage`.
- README documents the `SUPERSPECS_MODE` knob and links to the new docs folder.

### Removed
- The "either `docs/specs/` or `design-notes.md` is acceptable" fork in `skills/brainstorming/SKILL.md`.

## [0.1.0] — 2026-XX-XX

Initial public release of SuperSpecs.

### Added
- 15 skills under `skills/<name>/SKILL.md` covering brainstorming, OpenSpec propose/apply/archive, planning, execution (subagent or inline), code review, debugging, worktrees, branch finishing, parallel dispatch, verification before completion, and meta-skill authoring.
- Cursor plugin manifest at `.cursor-plugin/plugin.json`.
- SessionStart hook (`hooks/session-start.ps1` and POSIX `hooks/session-start`) that injects `skills/using-superspecs/SKILL.md` into the session.
- Slash commands `commands/{brainstorm,propose,write-plan,execute-plan,archive}.md`.
- Brainstorming visual companion (vanilla Node WebSocket server) for mockup/diagram questions.
- v0.1.0 release archives (zip and tar.gz).
- Local release script (PowerShell) and GitHub Actions workflow stub.
- MIT License.
- Initial README with badges, table of contents, Quick Start, Slash Commands section, and brownfield philosophy.

[Unreleased]: https://github.com/vikram8459/SuperSpecs/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/vikram8459/SuperSpecs/releases/tag/v0.1.0
