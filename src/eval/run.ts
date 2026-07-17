import type { Assertion, SkillEval, Adapter } from './types.js';
import { toMessage } from '../util/errors.js';

/**
 * Evaluate one assertion. A `matches` assertion whose value is not a valid
 * regex throws a descriptive Error (rather than letting `new RegExp` throw a
 * bare `SyntaxError`), so the caller can turn it into a per-eval failure
 * instead of aborting the whole batch.
 */
export function checkAssertion(a: Assertion, transcript: string): boolean {
  switch (a.kind) {
    case 'contains':
      return transcript.includes(a.value);
    case 'not-contains':
      return !transcript.includes(a.value);
    case 'matches': {
      let re: RegExp;
      try {
        re = new RegExp(a.value);
      } catch (err) {
        throw new Error(`invalid regex ${JSON.stringify(a.value)}: ${toMessage(err)}`, {
          cause: err,
        });
      }
      return re.test(transcript);
    }
  }
}

export interface EvalResult {
  skill: string;
  file: string;
  passed: boolean;
  failures: string[];
}

export async function runOneEval(
  evalObj: SkillEval,
  file: string,
  adapter: Adapter,
): Promise<EvalResult> {
  const resolved = await adapter.resolve(evalObj, file);
  if ('error' in resolved) {
    return { skill: evalObj.skill, file, passed: false, failures: [resolved.error] };
  }
  const failures: string[] = [];
  for (const a of evalObj.assertions) {
    try {
      if (!checkAssertion(a, resolved.transcript)) {
        failures.push(`${a.kind} "${a.value}"`);
      }
    } catch (err) {
      // A malformed assertion (e.g. an invalid `matches` regex) fails only
      // this eval; the batch continues instead of aborting on a raw throw.
      failures.push(toMessage(err));
    }
  }
  return { skill: evalObj.skill, file, passed: failures.length === 0, failures };
}
