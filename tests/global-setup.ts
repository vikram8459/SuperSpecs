import { execFileSync } from 'node:child_process';

/**
 * Vitest globalSetup: build `dist/` exactly once, in the main process,
 * before any test file is scheduled.
 *
 * The CLI tests spawn `node dist/superspecs.js`, so `dist/` must exist
 * and be current. Previously each CLI test file ran `npm run build` in
 * its own `beforeAll`; under vitest's default file-level parallelism
 * those `tsc` invocations raced — concurrently deleting and rewriting
 * the same `dist/*.js` files while sibling suites imported from them,
 * producing flaky, order-dependent failures. A single globalSetup build
 * removes the race: it runs once, to completion, before any worker
 * starts, so `dist/` is stable for the whole run.
 */
export default function setup(): void {
  execFileSync('npm', ['run', 'build'], { stdio: 'inherit', shell: true });
}
