# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed (dev tooling — 2026-06-22)
- Bumped the dev-tooling dependency group (ESLint 9→10, `@eslint/js` 9→10, `typescript` 5→6, `@types/node` 20→26, `vitest`/`@vitest/coverage-v8` 3→4, `json-schema-to-typescript` 14→15, `typescript-eslint` 8.61→8.62, `tsx` 4.22.3→4.22.4) via Dependabot (#18).
- `src/util/fs.ts`: `readJsonFile` now attaches the original error as `cause` when re-throwing the file-attributed JSON parse error, satisfying ESLint 10's new `preserve-caught-error` rule and preserving the underlying error chain.
- `engines.node` raised from `>=20.0.0` to `>=20.19.0` to match the floor required by Vitest 4 / Vite 8 (the older 20.x line cannot load the rolldown native binding).

### Added (tooling — 2026-06-16)
- `.github/workflows/ci.yml` gains a `changelog` job (pull-request only) that fails any PR touching `src/` or `schemas/` without an accompanying `CHANGELOG.md` update, enforcing the existing Keep a Changelog discipline. Docs/skills-only PRs are exempt. Asserted by `tests/cli/ci-gate.test.ts`; documented in `CONTRIBUTING.md` and the PR template.

### Added (tooling — 2026-06-15)
- ESLint 9 flat config (`eslint.config.mjs`) + `typescript-eslint` recommended rules, scoped to `src/`, `tests/`, and root config files. `npm run lint` / `npm run lint:fix` added; documented in `CONTRIBUTING.md`. The brainstorm-companion sub-package is excluded (own toolchain). Closes carry-forward CF-B2-2. (Type-checked ruleset is a deliberate follow-up.)

### Changed (pre-Phase-F cleanup — 2026-06-15)
- `superspecs validate` now emits **SDD013**, a targeted hint, when a `tasks.md` task lists files via unsupported bullet markup (`Create:`/`Modify:`/`Test:`/…) instead of the inline `Files:` line — naming the task and the offending bullet — and suppresses the misleading bare SDD011 for that task. The strict inline form remains the single canonical format. Also fixed `cleanTaskName` to strip a leading GitHub task-list checkbox from task names. (Carry-forward CF-B2-1.)
- `superspecs validate` proposal errors (SDD100–SDD103) now point at the offending `## Section` heading instead of the file start. `parseProposal` returns a `positions` side-channel; a missing section still falls back to `1:1`. (Carry-forward CF-E-2.)
- All four JSON schemas now record `schema-version: 0.1.0` in their `$comment` annotation (used over a custom keyword to keep ajv strict mode on); `tests/schema/version.test.ts` enforces that each schema's version equals the package version. (Carry-forward CF-E-4.)
- `CHANGELOG.md` `[0.1.0]` entry date backfilled from the `v0.1.0` tag (2026-05-20). (Carry-forward CF-B2-3.)

### Added (Phase D — 2026-06-11, multi-tool generalization, Finding 2)
- `.claude-plugin/plugin.json` — Claude Code plugin manifest. Minimal because Claude auto-discovers the standard `skills/`, `commands/`, and `hooks/` directories at the plugin root.
- `hooks/hooks-claude.json` — Claude Code SessionStart wiring. Invokes `${CLAUDE_PLUGIN_ROOT}/hooks/run-hook.cmd session-start --harness=claude`.
- `gemini-extension.json` at repo root — Gemini CLI extension manifest; declares `contextFileName: "AGENTS.md"` so Gemini, Codex, and OpenCode all share one context file.
- `docs/harnesses.json` + `docs/harnesses.schema.json` — single source of truth for the supported harness list (5: cursor, claude-code, codex, opencode, gemini). Consumed by `superspecs init --harness=`, README install section, and `tests/harness/payload-parity.test.ts`.
- `tests/harness/payload-parity.test.ts` — 10 replay-only smoke scenarios proving the multi-tool wiring is real: every declared manifest exists; cursor/claude SessionStart hooks emit the canonical skill body in the right envelope shapes (byte-equivalent inner payload); all three AGENTS.md harnesses share the same root AGENTS.md.
- `superspecs init --harness=<name>` — extends the existing CLI to (additionally) copy the named harness's manifest file(s) and AGENTS.md into the target project. Manifest-only by design; skills/ and commands/ are not duplicated.
- `docs/architecture.md` ADR-011 — records the path A (multi-tool) decision and rejects the audit's original `harnesses/<name>/` move in favour of per-harness canonical paths. Documents the rejected alternatives (path B Cursor-only rebrand; `harnesses/<name>/` layout; single Node hook entrypoint).
- AGENTS.md gains a "Key Commands" section per the agents.md spec convention (build/test/eval + the CLI subcommands) so Codex/OpenCode users can answer "how do I build this?" from the file alone.

### Changed (Phase D — 2026-06-11)
- `hooks/session-start` (bash) and `hooks/session-start.ps1` (PowerShell) — both accept `--harness=cursor|claude` (default `cursor`, back-compat). Single envelope-formatter dispatch; the inner skill text is identical across harnesses (single source of truth) and only the outer JSON shape differs. Zero behaviour change for existing Cursor users.
- `hooks/session-start.ps1` — forces `[Console]::OutputEncoding = UTF8` so non-ASCII chars in the skill (e.g. U+2192) survive piped stdout on default-locale Windows. Without this, captured output was corrupting bytes > 0x7F to 0x1A (SUB).
- `commands/archive.md` — slash command now instructs the agent to run `superspecs archive <id> --dry-run` as a preflight before invoking `spx:openspec-archive`. Closes F11.1; F11 fully complete except optional 11.4 (`/superspecs` parent command).
- README — Installation section split into per-harness blocks (cursor, claude-code, codex, opencode, gemini); Quick Start gains a table mapping each harness to its entry file; "Your Cursor agent" language generalized to mention SessionStart-hook AND AGENTS.md auto-loading paths.

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

## [0.1.0] — 2026-05-20

Initial public release of SuperSpecs (tagged `v0.1.0`).

### Added
- 16 skills under `skills/<name>/SKILL.md` covering brainstorming, OpenSpec propose/validate/apply/archive, planning, execution (subagent or inline), code review, debugging, worktrees, branch finishing, parallel dispatch, verification before completion, and meta-skill authoring.
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
