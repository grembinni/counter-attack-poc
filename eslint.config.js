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
