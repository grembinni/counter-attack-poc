import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

export default tseslint.config(
  ...tseslint.configs.recommendedTypeChecked,
  prettier,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
      },
    },
  },
  {
    ignores: ['**/dist/**', '**/node_modules/**', '**/*.config.js', '**/*.config.ts', '.husky/**'],
  },
);
