import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Adapter } from './types.js';

/** Reads a committed transcript file named by the eval's `transcript` field. */
export const transcriptAdapter: Adapter = {
  name: 'transcript',
  // Synchronous in body, but the Adapter interface returns a Promise (the
  // future live-LLM adapter is genuinely async), so resolve to a Promise.
  resolve(evalObj) {
    if (!evalObj.transcript) {
      return Promise.resolve({
        error: 'eval has no transcript field; transcript adapter requires one',
      });
    }
    const p = resolve(process.cwd(), evalObj.transcript);
    if (!existsSync(p)) {
      return Promise.resolve({ error: `transcript file not found: ${evalObj.transcript}` });
    }
    return Promise.resolve({ transcript: readFileSync(p, 'utf8') });
  },
};
