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
      // The suite clears this comfortably (measured branches ~78%,
      // statements/lines/functions >90%).
      //
      // `branches` was temporarily lowered to 60 when Vitest 4's V8 provider
      // switched to AST-based remapping (more accurate than the prior
      // v8-to-istanbul mapping), which recomputed branch coverage down to
      // ~64%. Added branch coverage (incl. the extracted pure modules such as
      // commands/linkage.ts) has since restored headroom, so the floor is
      // ratcheted back to the original 75 target — matching the other three.
      thresholds: {
        lines: 75,
        functions: 75,
        branches: 75,
        statements: 75,
      },
    },
  },
});
