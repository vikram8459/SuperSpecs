import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Adapter } from './types.js';

/** Reads a committed transcript file named by the eval's `transcript` field. */
export const transcriptAdapter: Adapter = {
  name: 'transcript',
  async resolve(evalObj) {
    if (!evalObj.transcript) {
      return { error: 'eval has no transcript field; transcript adapter requires one' };
    }
    const p = resolve(process.cwd(), evalObj.transcript);
    if (!existsSync(p)) {
      return { error: `transcript file not found: ${evalObj.transcript}` };
    }
    return { transcript: readFileSync(p, 'utf8') };
  },
};

/**
 * Prints the scenario for a human/agent to answer, then defers to the
 * recorded transcript. The live-LLM adapter (a future deliverable)
 * implements the same interface and replaces this deferral with a real
 * model call.
 */
export const manualAdapter: Adapter = {
  name: 'manual',
  async resolve(evalObj, evalFilePath) {
    process.stderr.write(
      `\n[manual] Skill: ${evalObj.skill}\n[manual] Scenario (${evalFilePath}):\n${evalObj.scenario}\n`,
    );
    return transcriptAdapter.resolve(evalObj, evalFilePath);
  },
};
