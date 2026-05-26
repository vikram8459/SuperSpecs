# OpenSpec Walkthrough

A worked example: adding a `--version` flag to a tiny CLI called
`hello`. Every artefact the SDD flow produces is shown inline. All
content is illustrative — you can reproduce the flow with any tiny
project.

## 0. Repo state before SuperSpecs

```
hello/
  bin/hello.js     # prints "hello, world"
  package.json
```

## 1. `/brainstorm`

User: *"I want `hello --version` to print the package version."*

Agent invokes `spx:brainstorming`. After 2–3 clarifying questions
(one at a time), the design is written to
`openspec/changes/add-version-flag/design-notes.md`:

```markdown
# Design Notes — add-version-flag

- Read version from package.json at startup.
- When --version (or -v) is the first arg, print version and exit 0.
- Other args / no args still print "hello, world".
- No other flags affected; no new dependencies.
```

The brainstorming skill commits this file, then invokes
`spx:openspec-propose`.

## 2. `/propose`

`spx:openspec-propose` reads the design notes and produces:

```
openspec/changes/add-version-flag/
  proposal.md
  design.md
  tasks.md
  specs/cli/spec.md
```

### `proposal.md`

```markdown
# Add `--version` flag to hello

## Why
Users currently have no way to inspect the installed version of the CLI.

## What Changes
- Read version from `package.json` at startup.
- Recognise `--version` and `-v` as the first argument.
- Print the version string and exit 0 when set.
- Preserve the existing "hello, world" behaviour for all other inputs.

## Out of Scope
- Other flags (`--help`, etc.) — separate proposal.
- Locale-aware version formatting.

## Impact
Single file (`bin/hello.js`); new test file; no new deps.
```

### `design.md`

```markdown
# Design — add-version-flag

## Decisions
- Read `package.json` synchronously at startup (CLI is short-lived;
  no measurable cost; avoids async edge cases).
- Accept `--version` and `-v`; not the bare word `version` (matches
  POSIX convention).

## Alternatives Considered
- Pre-compile version into the bundle. Rejected: requires a build step.
- Read from environment variable. Rejected: source of truth must be
  package.json.
```

### `tasks.md`

```markdown
# Tasks — add-version-flag

- [ ] T1: Add version lookup in bin/hello.js
  - Closes ADDED `Version flag` in `cli`
- [ ] T2: Add scenario verification
  - Closes scenarios `version-flag-long`, `version-flag-short`,
    `default-greeting-preserved`
```

### `specs/cli/spec.md` (the delta)

```markdown
# cli — change deltas

## ADDED Requirements

### Requirement: Version flag

When invoked with `--version` or `-v`, the CLI prints the package
version (from `package.json`) and exits with code 0.

#### Scenario: version-flag-long
- GIVEN the CLI binary
- WHEN invoked as `hello --version`
- THEN stdout is the version string, stderr is empty, exit code is 0

#### Scenario: version-flag-short
- GIVEN the CLI binary
- WHEN invoked as `hello -v`
- THEN stdout is the version string, stderr is empty, exit code is 0

#### Scenario: default-greeting-preserved
- GIVEN the CLI binary
- WHEN invoked with no args
- THEN stdout is "hello, world\n", exit code is 0
```

The skill asks for explicit user approval before handing off.

## 3. `/write-plan`

`spx:writing-plans` produces
`openspec/changes/add-version-flag/plan.md`:

```markdown
# add-version-flag Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> spx:openspec-apply to drive each task. Use
> spx:subagent-driven-development (recommended) or
> spx:executing-plans for the dispatch model. Steps use
> checkbox (- [ ]) syntax for tracking.

**Change ID:** `add-version-flag`
**Goal:** Add `--version`/`-v` to the hello CLI.
**Architecture:** Synchronous read of package.json at startup; arg
match before the default greeting branch.
**Tech Stack:** Node 20+, vanilla.
**Spec Capabilities Affected:** `cli`

### Task 1: Version flag in bin/hello.js

**Closes spec deltas:**
- ADDED `Version flag` in `cli` — scenarios:
  `version-flag-long`, `version-flag-short`,
  `default-greeting-preserved`

**Files:**
- Modify: `bin/hello.js`
- Test: `tests/hello.test.js`

- [ ] **Step 1: Scenario verification for `version-flag-long`**

  This verification asserts the scenario's THEN clause. Not TDD's
  "write a failing test first"; see Verification vs. TDD sidebar.

  ```js
  import { execFileSync } from "node:child_process";
  test("hello --version prints version", () => {
    const out = execFileSync("node", ["bin/hello.js", "--version"]);
    expect(out.toString()).toBe(require("../package.json").version + "\n");
  });
  ```

- [ ] **Step 2: Run verification, confirm it is wired up**

  `node --test tests/hello.test.js`
  Expected: errors out cleanly because the `--version` branch doesn't
  exist yet. That's the wiring check.

- [ ] **Step 3: Minimal implementation**

  ```js
  #!/usr/bin/env node
  const pkg = require("../package.json");
  const arg = process.argv[2];
  if (arg === "--version" || arg === "-v") {
    process.stdout.write(pkg.version + "\n");
    process.exit(0);
  }
  process.stdout.write("hello, world\n");
  ```

- [ ] **Step 4: Run verification, confirm scenarios pass**

  `node --test tests/hello.test.js`
  Expected: 3/3 pass.

- [ ] **Step 5: Commit & tick task**

  ```bash
  git add bin/hello.js tests/hello.test.js \
          openspec/changes/add-version-flag/tasks.md
  git commit -m "feat(add-version-flag): implement --version flag"
  ```
```

## 4. `/execute-plan`

`spx:openspec-apply` drives Task 1 end-to-end. The final
verification run prints `3/3 passing`. Commits land:

```
feat(add-version-flag): implement --version flag
```

`tasks.md` is updated with `[x] T1` and `[x] T2`.

## 5. `/archive`

`spx:openspec-archive` reads the change folder and folds the
`ADDED` requirement into the active spec set:

Before archive:
```
openspec/specs/cli/spec.md   # may not exist yet
openspec/changes/add-version-flag/specs/cli/spec.md   # the delta
```

After archive:
```
openspec/specs/cli/spec.md
  # Now contains the "Version flag" requirement + its three scenarios.
openspec/changes/archive/2026-05-26-add-version-flag/
  proposal.md  design.md  tasks.md  plan.md  specs/cli/spec.md
```

The change folder is moved under `openspec/changes/archive/` with the
ISO date prefix, and a structured commit lands:

```
chore(archive): fold add-version-flag deltas into active specs
```

The active spec set now reflects reality. The next brainstorm starts
from this updated baseline.
