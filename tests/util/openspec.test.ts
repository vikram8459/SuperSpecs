import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  openspecPaths,
  changeDir,
  capabilitySpecPath,
  snapshotPath,
  listChildDirs,
  listInFlightChanges,
  listArchived,
  listCapabilities,
  loadSpecDeltas,
} from '../../src/util/openspec.js';

let root: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'spx-openspec-'));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe('openspec path helpers', () => {
  it('scenario: openspecPaths derives the canonical layout from a root', () => {
    const p = openspecPaths(root);
    expect(p.openspec).toBe(join(root, 'openspec'));
    expect(p.changes).toBe(join(root, 'openspec', 'changes'));
    expect(p.archive).toBe(join(root, 'openspec', 'changes', 'archive'));
    expect(p.specs).toBe(join(root, 'openspec', 'specs'));
  });

  it('scenario: per-entity helpers build the expected paths', () => {
    expect(changeDir(root, 'add-x')).toBe(join(root, 'openspec', 'changes', 'add-x'));
    expect(capabilitySpecPath(root, 'cap')).toBe(
      join(root, 'openspec', 'specs', 'cap', 'spec.md'),
    );
    expect(snapshotPath(root, 'add-x')).toBe(join(root, 'openspec', '.snapshots', 'add-x'));
  });
});

describe('directory listing helpers', () => {
  it('scenario: a missing directory yields an empty list', () => {
    expect(listChildDirs(join(root, 'nope'))).toEqual([]);
  });

  it('scenario: only child directories are returned, sorted, files skipped', () => {
    const dir = join(root, 'd');
    mkdirSync(join(dir, 'b'), { recursive: true });
    mkdirSync(join(dir, 'a'), { recursive: true });
    writeFileSync(join(dir, 'file.txt'), 'x');
    expect(listChildDirs(dir)).toEqual(['a', 'b']);
  });

  it('scenario: in-flight changes exclude the archive folder', () => {
    const changes = openspecPaths(root).changes;
    mkdirSync(join(changes, 'add-x'), { recursive: true });
    mkdirSync(join(changes, 'archive'), { recursive: true });
    expect(listInFlightChanges(root)).toEqual(['add-x']);
    expect(listArchived(root)).toEqual([]);
  });

  it('scenario: archived and capability listings read their folders', () => {
    mkdirSync(join(openspecPaths(root).archive, '2026-01-01-add-x'), { recursive: true });
    mkdirSync(join(openspecPaths(root).specs, 'cap'), { recursive: true });
    expect(listArchived(root)).toEqual(['2026-01-01-add-x']);
    expect(listCapabilities(root)).toEqual(['cap']);
  });
});

describe('loadSpecDeltas', () => {
  it('scenario: reads each specs/<cap>/spec.md with capability + text', () => {
    const cd = changeDir(root, 'add-x');
    mkdirSync(join(cd, 'specs', 'cap'), { recursive: true });
    writeFileSync(join(cd, 'specs', 'cap', 'spec.md'), '# cap delta\n');
    const deltas = loadSpecDeltas(cd);
    expect(deltas).toHaveLength(1);
    expect(deltas[0].capability).toBe('cap');
    expect(deltas[0].text).toContain('# cap delta');
  });

  it('scenario: a change with no delta files yields an empty list', () => {
    const cd = changeDir(root, 'empty');
    mkdirSync(cd, { recursive: true });
    expect(loadSpecDeltas(cd)).toEqual([]);
  });
});
