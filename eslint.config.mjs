// ESLint 9 flat config for SuperSpecs (CF-B2-2).
//
// Scope: the TypeScript CLI/source (src/), its tests (tests/), and the
// root TS/MJS config files. The brainstorm-companion sub-package
// (skills/brainstorming/scripts/) has its own toolchain and is excluded.
//
// The production source (src/) is linted with the TYPE-CHECKED ruleset
// (`recommendedTypeChecked`) using the project's tsconfig.json (which
// already includes src/). Tests and root config files keep the fast,
// non-type-checked ruleset so we do not need a separate tsconfig that
// includes tests/ — the type-checked rules add little value over the
// test runner there and would require extra parser plumbing.

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

  // TypeScript recommendations (non-type-checked) as the baseline for all
  // TS/MJS files (tests, root config files).
  ...tseslint.configs.recommended,

  // Production source: layer the type-checked ruleset on top, wired to
  // tsconfig.json via the project service.
  {
    files: ['src/**/*.ts'],
    extends: [...tseslint.configs.recommendedTypeChecked],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },

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
