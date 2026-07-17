import { describe, it, expect } from 'vitest';
import type { ErrorObject } from 'ajv';
import {
  FALLBACK_POS,
  specDeltaErrorPosition,
  tasksErrorPosition,
  proposalErrorPosition,
  designErrorPosition,
  designErrorCode,
} from '../../src/commands/validate-positions.js';
import type { SpecDeltaPositions } from '../../src/parser/spec-delta.js';
import type { TasksPositions } from '../../src/parser/tasks.js';
import type { ProposalPositions } from '../../src/parser/proposal.js';
import type { DesignPositions } from '../../src/parser/design.js';

/** Build a minimal ajv-like error object for the fields the resolvers read. */
function err(partial: Partial<ErrorObject>): ErrorObject {
  return { instancePath: '', keyword: '', params: {}, ...partial } as ErrorObject;
}

describe('specDeltaErrorPosition', () => {
  const positions: SpecDeltaPositions = {
    added: [{ position: { line: 10, col: 1 }, scenarios: [{ line: 12, col: 3 }] }],
    modified: [],
    removed: [],
  };

  it('resolves a requirement-level path to the requirement heading', () => {
    expect(specDeltaErrorPosition(positions, err({ instancePath: '/deltas/added/0/then' }))).toEqual(
      { line: 10, col: 1 },
    );
  });

  it('resolves a scenario-level path to the scenario heading', () => {
    expect(
      specDeltaErrorPosition(positions, err({ instancePath: '/deltas/added/0/scenarios/0/then' })),
    ).toEqual({ line: 12, col: 3 });
  });

  it('falls back for an unmatched path or missing index', () => {
    expect(specDeltaErrorPosition(positions, err({ instancePath: '/nope' }))).toEqual(FALLBACK_POS);
    expect(
      specDeltaErrorPosition(positions, err({ instancePath: '/deltas/added/9' })),
    ).toEqual(FALLBACK_POS);
  });
});

describe('tasksErrorPosition', () => {
  const positions: TasksPositions = { tasks: [{ line: 5, col: 1 }, { line: 8, col: 1 }] };

  it('resolves /tasks/<idx> to the recorded task position', () => {
    expect(tasksErrorPosition(positions, err({ instancePath: '/tasks/1/files' }))).toEqual({
      line: 8,
      col: 1,
    });
  });

  it('falls back for a non-task path or out-of-range index', () => {
    expect(tasksErrorPosition(positions, err({ instancePath: '/other' }))).toEqual(FALLBACK_POS);
    expect(tasksErrorPosition(positions, err({ instancePath: '/tasks/9' }))).toEqual(FALLBACK_POS);
  });
});

describe('proposalErrorPosition', () => {
  const positions: ProposalPositions = {
    title: { line: 1, col: 1 },
    why: { line: 3, col: 1 },
    whatChanges: { line: 6, col: 1 },
    outOfScope: { line: 9, col: 1 },
    impact: { line: 12, col: 1 },
  };

  it('resolves a direct /title hit', () => {
    expect(proposalErrorPosition(positions, err({ instancePath: '/title' }))).toEqual({
      line: 1,
      col: 1,
    });
  });

  it('resolves a /sections/<name> hit', () => {
    expect(
      proposalErrorPosition(positions, err({ instancePath: '/sections/whatChanges' })),
    ).toEqual({ line: 6, col: 1 });
  });

  it('resolves a required-property error via missingProperty', () => {
    expect(
      proposalErrorPosition(
        positions,
        err({ instancePath: '/sections', keyword: 'required', params: { missingProperty: 'impact' } }),
      ),
    ).toEqual({ line: 12, col: 1 });
  });

  it('falls back when nothing matches', () => {
    expect(proposalErrorPosition(positions, err({ instancePath: '/unknown' }))).toEqual(
      FALLBACK_POS,
    );
  });
});

describe('designErrorPosition', () => {
  const positions: DesignPositions = {
    title: { line: 1, col: 1 },
    context: { line: 2, col: 1 },
    decisions: { line: 4, col: 1 },
    alternatives: { line: 6, col: 1 },
  };

  it('resolves /title and /sections/decisions', () => {
    expect(designErrorPosition(positions, err({ instancePath: '/title' }))).toEqual({
      line: 1,
      col: 1,
    });
    expect(designErrorPosition(positions, err({ instancePath: '/sections/decisions' }))).toEqual({
      line: 4,
      col: 1,
    });
  });

  it('resolves a required title via missingProperty and otherwise falls back', () => {
    expect(
      designErrorPosition(
        positions,
        err({ keyword: 'required', params: { missingProperty: 'title' } }),
      ),
    ).toEqual({ line: 1, col: 1 });
    expect(designErrorPosition(positions, err({ instancePath: '/other' }))).toEqual(FALLBACK_POS);
  });
});

describe('designErrorCode', () => {
  it('maps design title errors to SDD200', () => {
    expect(designErrorCode(err({ instancePath: '/title', keyword: 'minLength' }))).toBe('SDD200');
    expect(
      designErrorCode(err({ keyword: 'required', params: { missingProperty: 'title' } })),
    ).toBe('SDD200');
  });

  it('returns undefined for non-title errors (falls through to the shared table)', () => {
    expect(designErrorCode(err({ instancePath: '/sections/decisions', keyword: 'minItems' }))).toBe(
      undefined,
    );
  });
});
