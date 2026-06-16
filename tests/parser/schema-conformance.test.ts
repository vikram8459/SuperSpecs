import { describe, it, expect } from 'vitest';
import Ajv from 'ajv';
import { readFileSync } from 'node:fs';
import { parseSpecDelta } from '../../src/parser/spec-delta.js';
import { parseProposal } from '../../src/parser/proposal.js';
import { parseTasks } from '../../src/parser/tasks.js';

const ajv = new Ajv({ allErrors: true });
const validateProposal = ajv.compile(
  JSON.parse(readFileSync('schemas/proposal.schema.json', 'utf8')),
);
const validateSpecDelta = ajv.compile(
  JSON.parse(readFileSync('schemas/spec-delta.schema.json', 'utf8')),
);
const validateTasks = ajv.compile(
  JSON.parse(readFileSync('schemas/tasks.schema.json', 'utf8')),
);

describe('Parser output conforms to JSON Schemas', () => {
  it('parseSpecDelta(simple-delta.md) produces an AST that validates', () => {
    const text = readFileSync('tests/fixtures/parser/simple-delta.md', 'utf8');
    const { ast, errors } = parseSpecDelta(text, 'simple-delta.md');
    expect(errors).toHaveLength(0);

    // Positions now live in a parallel side-channel, so the AST is already
    // schema-clean and needs no stripping before validation.
    const ok = validateSpecDelta(ast);
    if (!ok) {
      // Surface the validator errors so a failure here is actionable.
      throw new Error('spec-delta schema rejected parser output:\n' + JSON.stringify(validateSpecDelta.errors, null, 2));
    }
    expect(ok).toBe(true);
  });

  it('parseProposal of a minimal proposal validates against proposal.schema.json', () => {
    const md = `# Sample Proposal

## Why

We need it.

## What Changes

- One thing
- Another

## Out of Scope

- Nothing

## Impact

A real impact statement.
`;
    const { ast, errors } = parseProposal(md, 'sample.md');
    expect(errors).toHaveLength(0);
    const ok = validateProposal(ast);
    if (!ok) {
      throw new Error('proposal schema rejected parser output:\n' + JSON.stringify(validateProposal.errors, null, 2));
    }
    expect(ok).toBe(true);
  });

  it('parseTasks of a minimal tasks.md validates against tasks.schema.json', () => {
    const md = `# Tasks — sample

- [ ] **1. Do thing**
  - Spec: ADDED Foo in cli
  - Files: src/foo.ts, tests/foo.test.ts
`;
    const { ast, errors } = parseTasks(md, 'sample-tasks.md');
    expect(errors).toHaveLength(0);
    const ok = validateTasks(ast);
    if (!ok) {
      throw new Error('tasks schema rejected parser output:\n' + JSON.stringify(validateTasks.errors, null, 2));
    }
    expect(ok).toBe(true);
  });

  it('parseTasks emits SDD013 when a task uses unsupported file-bullet markup (CF-B2-1)', () => {
    const md = `# Tasks — sample

- [ ] **1. Do thing**
  - Spec: ADDED Foo in cli
  - Create: src/foo.ts
  - Test: tests/foo.test.ts
`;
    const { ast, errors } = parseTasks(md, 'sample-tasks.md');
    // The Create:/Test: bullets are not consumed into files...
    expect(ast.tasks[0].files).toEqual([]);
    // ...but a targeted SDD013 hint is emitted naming the task and bullet.
    const hint = errors.find((e) => e.code === 'SDD013');
    expect(hint).toBeDefined();
    expect(hint?.message).toContain('Do thing');
    expect(hint?.message).toMatch(/Create:/);
  });
});
