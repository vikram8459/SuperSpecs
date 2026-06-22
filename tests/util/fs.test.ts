import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  readJsonFile,
  mkdirpSafe,
  writeIfAbsent,
  existsAndNonEmpty,
  existsAndNonEmptyExcept,
} from '../../src/util/fs.js';
import { toMessage } from '../../src/util/errors.js';

let root: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'spx-fs-'));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe('readJsonFile', () => {
  it('scenario: parses valid JSON', () => {
    const p = join(root, 'ok.json');
    writeFileSync(p, '{"a":1}');
    expect(readJsonFile<{ a: number }>(p)).toEqual({ a: 1 });
  });

  it('scenario: a parse failure becomes a file-attributed posix-path error', () => {
    const p = join(root, 'bad.json');
    writeFileSync(p, '{not json');
    expect(() => readJsonFile(p)).toThrow(/bad\.json: invalid JSON:/);
  });
});

describe('mkdirpSafe / writeIfAbsent', () => {
  it('scenario: mkdirpSafe is idempotent', () => {
    const p = join(root, 'a', 'b');
    mkdirpSafe(p);
    mkdirpSafe(p);
    expect(existsAndNonEmpty(join(root, 'a'))).toBe(true);
  });

  it('scenario: writeIfAbsent writes only when the file is missing', () => {
    const p = join(root, 'f.txt');
    expect(writeIfAbsent(p, 'first')).toBe(true);
    expect(writeIfAbsent(p, 'second')).toBe(false);
    expect(readFileSync(p, 'utf8')).toBe('first');
  });
});

describe('existsAndNonEmpty(Except)', () => {
  it('scenario: empty / missing dirs are reported non-populated', () => {
    expect(existsAndNonEmpty(join(root, 'missing'))).toBe(false);
    mkdirSync(join(root, 'empty'));
    expect(existsAndNonEmpty(join(root, 'empty'))).toBe(false);
  });

  it('scenario: ignored child names do not count as user content', () => {
    const dir = join(root, 'changes');
    mkdirSync(join(dir, 'archive'), { recursive: true });
    // Only the ignored `archive/` child exists.
    expect(existsAndNonEmptyExcept(dir, ['archive'])).toBe(false);
    // A real user folder makes it populated.
    mkdirSync(join(dir, 'add-x'));
    expect(existsAndNonEmptyExcept(dir, ['archive'])).toBe(true);
  });
});

describe('toMessage', () => {
  it('scenario: Error -> message, non-Error -> String()', () => {
    expect(toMessage(new Error('boom'))).toBe('boom');
    expect(toMessage('plain')).toBe('plain');
    expect(toMessage(42)).toBe('42');
  });
});
