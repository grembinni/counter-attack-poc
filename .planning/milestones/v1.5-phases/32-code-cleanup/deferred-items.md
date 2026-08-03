# Deferred Items — Phase 32 Code Cleanup

## From Plan 32-01 (Task 3)

### `pnpm lint` fails on `packages/shared` test files — pre-existing, out of scope

**Discovered during:** Task 3 verification (`pnpm lint` run as part of the sampling-rate check for client-file changes).

**Symptom:** `pnpm lint` reports 6 `Parsing error: Too many files (>8) have matched the default project` errors, all in `packages/shared/src/*.test.ts` (e.g. `snapshotValidator.test.ts`, `teamConfig.test.ts`, `teams.test.ts`). The `eslint.config.js` `allowDefaultProject` exclusion for `packages/shared/src/*.test.ts` matches 12 files, past typescript-eslint's default 8-file ceiling for the default (non-tsconfig-attached) project.

**Why out of scope:** Confirmed via `git diff --stat` that Plan 32-01 makes zero changes inside `packages/shared/`. Confirmed via targeted `eslint` runs that every file this plan actually touched (`DraftPackCarousel.tsx`, `mock/index.ts`, `useGameStore.ts`, `uniformStyles.tsx`, `gameEngine.ts`) lints clean with zero errors/warnings. This is a pre-existing repo-wide config limitation, not something Plan 32-01's dead-code removal caused. Additionally, `.github/workflows/ci.yml` does not run `pnpm lint` at all today, so this was already a latent, undetected issue before this plan started.

**Recommendation:** A future plan (or a Rule-2 fix in whichever plan next touches `eslint.config.js`, e.g. 32-06 which adds `eslint-plugin-react-hooks`) should raise `maximumDefaultProjectFileMatchCount` for the `packages/shared/src/*.test.ts` exclusion, or restructure the exclusion to reduce the match count below 8.
