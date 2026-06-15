// ESLint 9 flat config for SuperSpecs (CF-B2-2).
//
// Scope: the TypeScript CLI/source (src/), its tests (tests/), and the
// root TS/MJS config files. The brainstorm-companion sub-package
// (skills/brainstorming/scripts/) has its own toolchain and is excluded.
//
// This is the `recommended` (non-type-checked) rule set — fast, no
// tsconfig-for-tests requirement, and it still catches unused vars,
// no-explicit-any, and the common footguns. Upgrading to the
// type-checked ruleset (`recommendedTypeChecked`) is a deliberate
// follow-up: it needs a tsconfig that includes tests/ and adds
// linter runtime, so it is intentionally out of scope here.

import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  // Global ignores (must be its own object with only `ignores`).
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      'coverage/**',
      '**/*.tsbuildinfo',
      // Private sub-package with its own package.json + toolchain.
      'skills/brainstorming/scripts/**',
      // Generated / vendored skill helper JS.
      'skills/**/*.js',
      'skills/**/*.cjs',
    ],
  },

  // Base JS recommendations.
  js.configs.recommended,

  // TypeScript recommendations (non-type-checked).
  ...tseslint.configs.recommended,

  // Project-specific tweaks.
  {
    files: ['src/**/*.ts', 'tests/**/*.ts', '*.ts', '*.mjs'],
    rules: {
      // Allow intentionally-unused args/vars when prefixed with `_`
      // (the parsers use `_file` params by convention).
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
);
