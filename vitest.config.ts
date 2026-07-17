import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    // CLI/hook/archive tests spawn real `node`/`git`/PowerShell subprocesses;
    // 15s was tight enough to flake on slower CI runners and busy machines
    // when the suite runs fully parallel. 30s keeps fast tests fast while
    // giving the subprocess-heavy ones headroom.
    testTimeout: 30000,
    // Build dist/ once before any test file runs. CLI tests spawn
    // `node dist/superspecs.js`; doing the build here (instead of in a
    // per-file beforeAll) avoids concurrent `tsc` runs racing on dist/.
    globalSetup: ['tests/global-setup.ts'],
    coverage: {
      provider: 'v8',
      // Measure the TypeScript source, not the compiled dist/ output.
      include: ['src/**/*.ts'],
      // Several modules are exercised ONLY through spawned-binary
      // integration tests (`execFileSync('node', [CLI, ...])`). v8 cannot
      // attribute that out-of-process coverage back to source, so including
      // them in the gate would read as 0% despite being well-tested. They
      // are excluded from the THRESHOLD only; behaviour is still covered by
      // the CLI/archive/init/eval test suites. The entry point, ajv interop
      // shim, and pure type module have nothing meaningful to measure.
      //
      // The risky *pure* logic that used to live inside these spawn-only
      // shells has been extracted into measured modules so the gate now
      // protects it: `src/commands/archive-splice.ts` (the MODIFIED/REMOVED/
      // ADDED splice) and `src/commands/validate-positions.ts` (the ajv
      // error → source-position resolvers). Those files are NOT excluded and
      // are unit-tested in-process; only the true I/O shells stay excluded.
      exclude: [
        'src/superspecs.ts',
        'src/schema/ajv.ts',
        'src/eval/types.ts',
        // Spawn-only command modules + their git/snapshot collaborators.
        'src/commands/archive.ts',
        'src/commands/init.ts',
        'src/commands/list.ts',
        'src/commands/status.ts',
        'src/commands/validate.ts',
        'src/commands/validate-active.ts',
        'src/commands/eval.ts',
        'src/util/git.ts',
        'src/util/snapshot.ts',
      ],
      reporter: ['text', 'lcov'],
      // Floor for the IN-PROCESS-tested core (parser, schema, util helpers).
      // The suite currently clears this comfortably; ratchet upward over
      // time rather than starting unattainably high.
      //
      // `branches` is set lower than the others because Vitest 4's V8
      // provider switched to AST-based remapping (more accurate than the
      // prior v8-to-istanbul mapping), which recomputed branch coverage
      // from ~75% down to ~64% with no change to the tests themselves.
      // 60 is a floor below the current measured value; ratchet it back up
      // as branch coverage is added, with the goal of returning to 75.
      thresholds: {
        lines: 75,
        functions: 75,
        branches: 60,
        statements: 75,
      },
    },
  },
});
