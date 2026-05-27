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

    // Strip the position field which is parser-only metadata not in the schema.
    const stripPos = (req: { position?: unknown; scenarios: { position?: unknown }[] } & Record<string, unknown>) => {
      const { position: _p, scenarios, ...rest } = req;
      void _p;
      return {
        ...rest,
        scenarios: scenarios.map((s) => {
          const { position: _sp, ...sRest } = s;
          void _sp;
          return sRest;
        }),
      };
    };
    const validatable = {
      capability: ast.capability,
      deltas: {
        added: ast.deltas.added.map(stripPos),
        modified: ast.deltas.modified.map(stripPos),
        removed: ast.deltas.removed.map(stripPos),
      },
    };
    const ok = validateSpecDelta(validatable);
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
});
