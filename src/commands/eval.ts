import fg from 'fast-glob';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { validators } from '../schema/load.js';
import { transcriptAdapter } from '../eval/adapters.js';
import { runOneEval } from '../eval/run.js';
import type { SkillEval } from '../eval/types.js';

export async function runEval(cwd: string, glob?: string): Promise<number> {
  const pattern = glob ?? 'tests/skills/**/*.eval.json';
  const files = fg.sync(pattern, { cwd: resolve(cwd), absolute: false });

  if (files.length === 0) {
    process.stdout.write(`No eval files matched ${pattern}\n`);
    return 0;
  }

  let anyFailed = false;
  for (const file of files.sort()) {
    const raw = JSON.parse(readFileSync(resolve(cwd, file), 'utf8')) as SkillEval;
    if (!validators.skillEval(raw)) {
      anyFailed = true;
      process.stderr.write(`[INVALID] ${file}: does not match skill-eval schema\n`);
      continue;
    }
    const result = await runOneEval(raw, file, transcriptAdapter);
    if (result.passed) {
      process.stdout.write(`[PASS] ${file} (${raw.skill})\n`);
    } else {
      anyFailed = true;
      process.stderr.write(`[FAIL] ${file} (${raw.skill}): ${result.failures.join('; ')}\n`);
    }
  }
  return anyFailed ? 1 : 0;
}
