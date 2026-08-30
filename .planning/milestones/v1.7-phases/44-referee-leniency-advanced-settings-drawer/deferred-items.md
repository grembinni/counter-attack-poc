# Deferred Items — Phase 44

## 44-01: whole-workspace `pnpm lint` fails on pre-existing `packages/shared` typescript-eslint config issue

**Observed during:** 44-01 Task 2 verification (`pnpm lint` step of the plan's overall `<verification>` list).

**Symptom:** `pnpm lint` (root `eslint .`) fails with `Parsing error: Too many files (>8) have matched the default project` across ~16 `packages/shared/src/*.test.ts` files and `packages/shared/scripts/seed-rosters.ts`.

**Scope determination:** Out of scope for 44-01. Neither file this plan touches (`packages/server/src/gameEngine.ts`, `packages/server/src/__tests__/gameEngine.refereeLeniency.test.ts`) is implicated — both files lint clean when checked directly (`npx eslint packages/server/src/gameEngine.ts packages/server/src/__tests__/gameEngine.refereeLeniency.test.ts` produces zero errors). The failure is confined entirely to `packages/shared`'s typescript-eslint `projectService` file-count cap, a known pre-existing issue documented since Phase 32/33 close (see `.planning/PROJECT.md` "Known tech debt entering Phase 33": "the whole-workspace `pnpm lint` OOMs on a pre-existing `packages/shared` typescript-eslint file-count-cap config issue (unrelated to Phase 32's changes, doesn't gate CI)").

**Action taken:** None (per Scope Boundary rule — only auto-fix issues directly caused by the current task's changes). Logged here for visibility; not fixed.

**Status:** pending, carried forward unchanged from Phase 32/33.
