import type { Assertion, SkillEval, Adapter } from './types.js';

export function checkAssertion(a: Assertion, transcript: string): boolean {
  switch (a.kind) {
    case 'contains':
      return transcript.includes(a.value);
    case 'not-contains':
      return !transcript.includes(a.value);
    case 'matches':
      return new RegExp(a.value).test(transcript);
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
    if (!checkAssertion(a, resolved.transcript)) {
      failures.push(`${a.kind} "${a.value}"`);
    }
  }
  return { skill: evalObj.skill, file, passed: failures.length === 0, failures };
}
