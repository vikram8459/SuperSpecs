import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { findRootUp } from '../../src/util/install.js';

let root: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'spx-install-'));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe('findRootUp', () => {
  it('scenario: finds the nearest ancestor containing all markers', () => {
    writeFileSync(join(root, 'package.json'), '{}');
    const deep = join(root, 'a', 'b', 'c');
    mkdirSync(deep, { recursive: true });
    expect(findRootUp(deep, ['package.json'])).toBe(root);
  });

  it('scenario: requires every marker to be present', () => {
    writeFileSync(join(root, 'package.json'), '{}');
    const start = join(root, 'sub');
    mkdirSync(start);
    // Only one of the two markers exists -> no match.
    expect(findRootUp(start, ['package.json', 'docs'])).toBeNull();
    mkdirSync(join(root, 'docs'));
    expect(findRootUp(start, ['package.json', 'docs'])).toBe(root);
  });

  it('scenario: returns null when no ancestor matches', () => {
    const start = join(root, 'x', 'y');
    mkdirSync(start, { recursive: true });
    expect(findRootUp(start, ['definitely-not-here.marker'])).toBeNull();
  });
});
