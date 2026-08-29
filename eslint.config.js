import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';
import reactHooks from 'eslint-plugin-react-hooks';

export default tseslint.config(
  ...tseslint.configs.recommendedTypeChecked,
  prettier,
  {
    languageOptions: {
      parserOptions: {
        projectService: {
          allowDefaultProject: [
            // Only packages/shared excludes *.test.ts from its tsconfig project;
            // client/server test files are already covered by the project service.
            'packages/shared/src/*.test.ts',
            // packages/shared/scripts is not part of packages/shared/tsconfig.json's
            // include ("src/**/*" only). packages/client/scripts IS covered by
            // packages/client/tsconfig.json's include (34-03: needed full
            // type-aware resolution for cross-package imports in check-contrast.ts).
            'packages/shared/scripts/*.ts',
          ],
          // Phase 46 / CLEANUP-13: the two globs above legitimately match 19 files
          // (18 packages/shared/src/*.test.ts + 1 packages/shared/scripts/*.ts as of
          // this count) — over typescript-eslint's default 8-file default-project cap.
          // This is the tool's own documented escape hatch (see the "Too many files"
          // parsing-error message), not a suppression: every one of these 19 files is
          // deliberately allow-listed above, not accidentally caught. Raising the cap
          // to 30 gives headroom for near-term new *.test.ts files in packages/shared
          // without needing another edit here. This was a pre-existing, previously
          // deferred issue (see 32/33/34/43-06 deferred-items.md) blocking a clean
          // whole-workspace `pnpm -w lint` run — CLEANUP-13 requires that command to
          // exit 0, so it is fixed here rather than deferred again.
          maximumDefaultProjectFileMatchCount_THIS_WILL_SLOW_DOWN_LINTING: 30,
        },
      },
    },
  },
  {
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
    },
  },
  {
    files: ['**/*.test.ts', '**/*.test.tsx'],
    rules: {
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
    },
  },
  {
    // Client-only (D-07): shared/server are non-React. NOTE: as of
    // eslint-plugin-react-hooks 7.1.1, both `recommended` and `recommended-latest`
    // bundle the newer React-Compiler-readiness rules (set-state-in-effect, refs,
    // immutability, purity, etc.) at `error` — the `recommended`-vs-`recommended-latest`
    // split no longer isolates just rules-of-hooks/exhaustive-deps the way RESEARCH.md
    // assumed. Declaring only the two intended rules explicitly (instead of spreading
    // `reactHooks.configs.recommended.rules`) keeps this phase scoped to CLEANUP-04's
    // stated bar (D-07: rules-of-hooks + exhaustive-deps only) and avoids pulling in
    // ~10 unrelated Compiler-readiness rules this plan never audited or budgeted fixes for.
    files: ['packages/client/src/**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'error',
    },
  },
  {
    ignores: ['**/dist/**', '**/node_modules/**', '**/*.config.js', '**/*.config.ts', '.husky/**'],
  },
);
