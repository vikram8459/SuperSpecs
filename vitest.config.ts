import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    testTimeout: 15000,
    // Build dist/ once before any test file runs. CLI tests spawn
    // `node dist/superspecs.js`; doing the build here (instead of in a
    // per-file beforeAll) avoids concurrent `tsc` runs racing on dist/.
    globalSetup: ['tests/global-setup.ts'],
  },
});
