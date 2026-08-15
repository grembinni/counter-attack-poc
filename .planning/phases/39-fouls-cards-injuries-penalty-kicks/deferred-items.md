# Deferred Items — Phase 39

Items discovered during execution that are out of scope for the current plan (scope
boundary rule — pre-existing issues in unrelated files/infra, not fixed here).

## 39-18: `pnpm lint` fails on pre-existing `packages/shared` ESLint infra ceiling

- **Found during:** Plan 39-18, Task 2 verification (`pnpm lint`)
- **Symptom:** `Parsing error: Too many files (>8) have matched the default project`
  for every `packages/shared/src/*.test.ts` file and `packages/shared/scripts/seed-rosters.ts`.
- **Root cause:** `eslint.config.js`'s `allowDefaultProject: ['packages/shared/src/*.test.ts', 'packages/shared/scripts/*.ts']`
  glob now matches 14 test files in `packages/shared/src/`, exceeding typescript-eslint's
  default `maximumDefaultProjectFileMatchCount` of 8. This ceiling was crossed by prior
  phases adding shared test files over time — confirmed via `git stash` that the failure
  is present identically on the pre-39-18 commit (`0fb210d`), before any of this plan's
  changes.
- **Scope:** None of plan 39-18's files live in `packages/shared/src/*.test.ts` or
  `packages/shared/scripts/`; the failure is orthogonal to this plan's Task 1/2/3 changes.
- **Verification workaround used:** ran `npx eslint <touched-files>` directly against the
  files this plan modified (all clean) instead of the repo-wide `pnpm lint`.
- **Suggested fix (not applied here):** either raise
  `parserOptions.projectService.maximumDefaultProjectFileMatchCount_THIS_WILL_SLOW_DOWN_LINTING`
  in `eslint.config.js`, or add `packages/shared/src/**/tsconfig*.json` project coverage for
  test files so they no longer fall through to the default project. Needs its own
  small cleanup plan/quick-task.
