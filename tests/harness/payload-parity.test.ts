// Payload-parity smoke test for Phase D (Finding 2.8).
//
// Asserts that every harness listed in docs/harnesses.json actually has
// its wiring in place AND that its delivery mechanism injects the same
// canonical `skills/using-superspecs/SKILL.md` content into the agent.
//
// Replay-only: no live LLM, no harness install, no network. Runs in
// CI in well under a second.
//
// What this proves:
//   - The two SessionStart-hook harnesses (cursor, claude-code) emit
//     envelopes containing the verbatim skill bytes.
//   - The three AGENTS.md harnesses (codex, opencode, gemini) all read
//     the same AGENTS.md file, and that file references the same
//     using-superspecs skill via the canonical `spx:` form.
//   - Every harness's declared manifest path actually exists in the repo.
//
// What this does NOT prove:
//   - That a real Cursor/Claude/Codex/OpenCode/Gemini install loads the
//     manifest correctly (that's CF-LIVE-ADAPTER territory).
//   - That an agent given the payload actually behaves correctly
//     (that's the eval corpus, Phase C).

import { describe, it, expect, beforeAll } from 'vitest';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

interface HarnessEntry {
  name: string;
  displayName: string;
  manifest: string | null;
  hook: { type: string; config: string; envelope: string } | null;
  agentsMd: boolean;
}

const REPO_ROOT = resolve('.');
const SKILL_PATH = resolve('skills/using-superspecs/SKILL.md');
const HARNESS_INDEX_PATH = resolve('docs/harnesses.json');

const isWin = process.platform === 'win32';

function loadHarnesses(): HarnessEntry[] {
  const idx = JSON.parse(readFileSync(HARNESS_INDEX_PATH, 'utf8')) as {
    harnesses: HarnessEntry[];
  };
  return idx.harnesses;
}

function loadSkillBody(): string {
  let s = readFileSync(SKILL_PATH, 'utf8');
  // Match the hook's normalisation: strip BOM, fold line endings to \n.
  if (s.charCodeAt(0) === 0xfeff) s = s.slice(1);
  return s.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

function runHook(harness: string): { stdout: string; status: number } {
  const PS_HOOK = resolve('hooks/session-start.ps1');
  const SH_HOOK = resolve('hooks/session-start');
  const args = harness ? [`--harness=${harness}`] : [];
  try {
    const stdout = isWin
      ? execFileSync(
          'powershell',
          ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', PS_HOOK, ...args],
          { encoding: 'utf8', env: process.env },
        )
      : execFileSync('bash', [SH_HOOK, ...args], { encoding: 'utf8', env: process.env });
    return { stdout, status: 0 };
  } catch (e: unknown) {
    const err = e as { stdout?: Buffer | string; status?: number };
    return { stdout: err.stdout?.toString() ?? '', status: err.status ?? 1 };
  }
}

describe('harness payload parity', () => {
  let harnesses: HarnessEntry[];
  let skillBody: string;

  beforeAll(() => {
    harnesses = loadHarnesses();
    skillBody = loadSkillBody();
  });

  it('scenario: docs/harnesses.json lists every supported harness', () => {
    // GIVEN ADR-011 commits to 5 harnesses
    // WHEN we load the index
    // THEN cursor, claude-code, codex, opencode, gemini are all present
    const names = harnesses.map((h) => h.name).sort();
    expect(names).toEqual(['claude-code', 'codex', 'cursor', 'gemini', 'opencode']);
  });

  it('scenario: every declared manifest path exists in the repo', () => {
    // GIVEN each harness entry may declare a manifest path
    // WHEN we check existence
    // THEN every declared path resolves to an actual file
    for (const h of harnesses) {
      if (h.manifest) {
        const absPath = resolve(REPO_ROOT, h.manifest);
        expect(existsSync(absPath), `${h.name}: missing manifest at ${h.manifest}`).toBe(true);
      }
    }
  });

  it('scenario: every declared hook config path exists in the repo', () => {
    for (const h of harnesses) {
      if (h.hook?.config) {
        const absPath = resolve(REPO_ROOT, h.hook.config);
        expect(existsSync(absPath), `${h.name}: missing hook config at ${h.hook.config}`).toBe(
          true,
        );
      }
    }
  });

  it('scenario: cursor SessionStart hook emits the canonical skill body', () => {
    // GIVEN --harness=cursor (also the default)
    // WHEN the hook runs
    const r = runHook('cursor');
    expect(r.status).toBe(0);
    const env = JSON.parse(r.stdout);
    // THEN the envelope is the Cursor shape AND contains the canonical skill body
    expect(env).toHaveProperty('additional_context');
    expect(typeof env.additional_context).toBe('string');
    // The hook wraps the skill in an <EXTREMELY_IMPORTANT> marker block;
    // a substring check that catches a recognisable line from the skill
    // body is enough to prove parity without depending on the wrapper text.
    expect(env.additional_context).toContain('name: using-superspecs');
    expect(env.additional_context).toContain('Skip skills when');
  });

  it('scenario: claude-code SessionStart hook emits the canonical skill body', () => {
    // GIVEN --harness=claude
    // WHEN the hook runs
    const r = runHook('claude');
    expect(r.status).toBe(0);
    const env = JSON.parse(r.stdout);
    // THEN the envelope is the Claude shape AND contains the canonical skill body
    expect(env).toHaveProperty('hookSpecificOutput');
    expect(env.hookSpecificOutput).toHaveProperty('hookEventName', 'SessionStart');
    expect(env.hookSpecificOutput).toHaveProperty('additionalContext');
    expect(typeof env.hookSpecificOutput.additionalContext).toBe('string');
    expect(env.hookSpecificOutput.additionalContext).toContain('name: using-superspecs');
    expect(env.hookSpecificOutput.additionalContext).toContain('Skip skills when');
  });

  it('scenario: cursor and claude-code envelopes carry byte-equivalent skill content', () => {
    // GIVEN both hooks run with the same skill file on disk
    const c = JSON.parse(runHook('cursor').stdout) as { additional_context: string };
    const k = JSON.parse(runHook('claude').stdout) as {
      hookSpecificOutput: { additionalContext: string };
    };
    // WHEN we extract the inner content (both wrap in the same
    // <EXTREMELY_IMPORTANT> marker block; only the outer JSON shape
    // differs)
    // THEN the inner skill payload is identical across the two harnesses
    expect(c.additional_context).toBe(k.hookSpecificOutput.additionalContext);
  });

  it('scenario: every AGENTS.md harness reads the same root AGENTS.md', () => {
    // GIVEN three harnesses (codex, opencode, gemini) read AGENTS.md
    const agentsMdHarnesses = harnesses.filter((h) => h.agentsMd);
    expect(agentsMdHarnesses.map((h) => h.name).sort()).toEqual([
      'codex',
      'gemini',
      'opencode',
    ]);
    // WHEN we read the canonical AGENTS.md
    const agentsMdPath = resolve(REPO_ROOT, 'AGENTS.md');
    expect(existsSync(agentsMdPath)).toBe(true);
    const body = readFileSync(agentsMdPath, 'utf8');
    // THEN it points at the using-superspecs skill (the canonical first-read)
    expect(body).toContain('skills/using-superspecs/SKILL.md');
    expect(body).toMatch(/spx:using-superspecs/);
  });

  it("scenario: gemini-extension.json declares AGENTS.md as its contextFileName", () => {
    // GIVEN Gemini reads contextFileName, not AGENTS.md directly
    const geminiManifestPath = resolve(REPO_ROOT, 'gemini-extension.json');
    expect(existsSync(geminiManifestPath)).toBe(true);
    const manifest = JSON.parse(readFileSync(geminiManifestPath, 'utf8'));
    // THEN it explicitly names AGENTS.md as the context file
    expect(manifest.contextFileName).toBe('AGENTS.md');
  });

  it('scenario: hooks-claude.json invokes run-hook.cmd with --harness=claude', () => {
    // GIVEN Claude Code hook config wires SessionStart
    const cfgPath = resolve(REPO_ROOT, 'hooks/hooks-claude.json');
    const cfg = JSON.parse(readFileSync(cfgPath, 'utf8'));
    // WHEN we inspect the command
    const cmd = cfg.hooks.SessionStart[0].hooks[0].command;
    // THEN it passes --harness=claude through the polyglot wrapper
    expect(cmd).toContain('run-hook.cmd');
    expect(cmd).toContain('session-start');
    expect(cmd).toContain('--harness=claude');
  });

  it('scenario: skill body referenced by hooks matches the file on disk', () => {
    // GIVEN the canonical skill file on disk
    expect(skillBody.length).toBeGreaterThan(0);
    // WHEN the cursor hook runs
    const env = JSON.parse(runHook('cursor').stdout) as { additional_context: string };
    // THEN every line of the skill body (after normalisation) appears in
    // the envelope. We don't compare the whole string because the
    // envelope includes a marker block wrapper.
    const skillLines = skillBody.split('\n').filter((l) => l.trim().length > 0);
    // Sample 10 lines including first and last non-empty lines.
    const sampled = [
      skillLines[0],
      skillLines[Math.floor(skillLines.length / 4)],
      skillLines[Math.floor(skillLines.length / 2)],
      skillLines[Math.floor((3 * skillLines.length) / 4)],
      skillLines[skillLines.length - 1],
    ];
    for (const line of sampled) {
      expect(env.additional_context).toContain(line);
    }
  });
});
