import { describe, it, expect } from 'vitest';
import {
  checkLinkage,
  LINKAGE_UNREFERENCED_CODE,
  type LinkageRequirement,
} from '../../src/commands/linkage.js';

function req(
  name: string,
  capability: string,
  section: LinkageRequirement['section'] = 'added',
  line = 5,
  col = 1,
): LinkageRequirement {
  return { name, capability, section, line, col };
}

describe('checkLinkage', () => {
  it('scenario: a requirement referenced by a task passes', () => {
    // GIVEN a requirement Foo in x and a task that references it
    const errors = checkLinkage([req('Foo', 'x')], ['ADDED Foo in x']);
    // THEN no linkage error is produced
    expect(errors).toEqual([]);
  });

  it('scenario: a requirement with no matching task fails with SDD060', () => {
    // GIVEN a requirement Foo in x and a task that references a different req
    const errors = checkLinkage([req('Foo', 'x', 'added', 5, 1)], ['ADDED Bar in x']);
    // THEN SDD060 is reported at the requirement heading position
    expect(errors).toHaveLength(1);
    expect(errors[0]?.code).toBe(LINKAGE_UNREFERENCED_CODE);
    expect(errors[0]?.line).toBe(5);
    expect(errors[0]?.col).toBe(1);
    expect(errors[0]?.message).toContain('Foo');
    expect(errors[0]?.message).toContain('x');
  });

  it('scenario: matching is case-insensitive and tolerates backticks', () => {
    // GIVEN a task ref with backticks and different casing
    const errors = checkLinkage([req('Version Flag', 'cli')], ['modified `version flag` in `CLI`']);
    // THEN it still counts as covered
    expect(errors).toEqual([]);
  });

  it('scenario: the verb prefix is optional in a task ref', () => {
    // GIVEN a task ref that omits ADDED/MODIFIED/REMOVED
    const errors = checkLinkage([req('Foo', 'x')], ['Foo in x']);
    // THEN it still counts as covered
    expect(errors).toEqual([]);
  });

  it('scenario: capability must match, not just the requirement name', () => {
    // GIVEN a requirement Foo in x but a task referencing Foo in a DIFFERENT cap
    const errors = checkLinkage([req('Foo', 'x')], ['ADDED Foo in y']);
    // THEN the requirement is still unreferenced (cross-capability name reuse
    // must not accidentally satisfy linkage)
    expect(errors).toHaveLength(1);
    expect(errors[0]?.code).toBe(LINKAGE_UNREFERENCED_CODE);
  });

  it('scenario: no tasks at all means every requirement is unreferenced', () => {
    // GIVEN two requirements and zero task refs
    const errors = checkLinkage([req('Foo', 'x'), req('Baz', 'x')], []);
    // THEN both are flagged
    expect(errors).toHaveLength(2);
  });

  it('scenario: MODIFIED requirements also need a task', () => {
    // GIVEN an ADDED and a MODIFIED requirement with no covering tasks
    // (REMOVED is exempt and is filtered out before reaching this checker)
    const errors = checkLinkage(
      [req('A', 'x', 'added'), req('B', 'x', 'modified')],
      ['ADDED C in x'],
    );
    // THEN both remaining sections are subject to the linkage rule
    expect(errors.map((e) => e.code)).toEqual([
      LINKAGE_UNREFERENCED_CODE,
      LINKAGE_UNREFERENCED_CODE,
    ]);
  });

  it('scenario: a requirement name containing " in " matches on the last " in "', () => {
    // GIVEN a requirement whose own name contains the word "in"
    const errors = checkLinkage(
      [req('Log in flow', 'auth')],
      ['ADDED Log in flow in auth'],
    );
    // THEN the ref splits on the LAST " in " (name="Log in flow", cap="auth")
    // and the requirement is covered
    expect(errors).toEqual([]);
  });

  it('scenario: a malformed task ref covers nothing', () => {
    // GIVEN a task ref that does not fit "<name> in <capability>"
    const errors = checkLinkage([req('Foo', 'x')], ['not a real reference']);
    // THEN the requirement remains unreferenced
    expect(errors).toHaveLength(1);
  });
});
