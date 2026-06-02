export interface Assertion {
  kind: 'contains' | 'not-contains' | 'matches';
  value: string;
}

export interface SkillEval {
  skill: string;
  scenario: string;
  pressures?: string[];
  expected: string;
  assertions: Assertion[];
  transcript?: string;
}

export type AdapterResult = { transcript: string } | { error: string };

export interface Adapter {
  name: string;
  resolve(evalObj: SkillEval, evalFilePath: string): Promise<AdapterResult>;
}
