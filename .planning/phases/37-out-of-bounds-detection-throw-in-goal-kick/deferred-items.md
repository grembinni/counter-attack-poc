# Deferred Items — Phase 37

## 37-17 Task 2: `pnpm lint` fails on pre-existing, out-of-scope `packages/shared` config

**Found during:** Task 2 verification (`pnpm lint`).

**Symptom:** `pnpm lint` (root `eslint .`) exits 1 with 7 `Parsing error: Too many files (>8) have matched the default project` errors, all in `packages/shared/src/*.test.ts` and `packages/shared/scripts/*.ts`.

**Root cause:** `eslint.config.js`'s `allowDefaultProject` glob (`packages/shared/src/*.test.ts`, `packages/shared/scripts/*.ts`) correctly opts these files into the default TypeScript project, but `typescript-eslint`'s `maximumDefaultProjectFileMatchCount` safety threshold defaults to 8. `packages/shared/src` now has more than 8 matching `*.test.ts` files (grown across prior phases), so the glob itself trips the safety limit it was meant to satisfy. This is a `packages/shared`-wide config issue, not specific to any file this plan touches.

**Scope determination:** Out of scope for 37-17. This plan's `files_modified` is `packages/client/src/store/useGameStore.ts`, `packages/client/src/components/ActionPanel.tsx`, `packages/client/src/components/ActionPanel.test.tsx` — no `packages/shared` file is read or written by either task. Confirmed the failure is unrelated to this plan's diff: `npx eslint packages/client/src/components/ActionPanel.tsx packages/client/src/components/ActionPanel.test.tsx` (the only files this plan's Task 2 touches) exits clean with zero output/errors.

**Not fixed here.** Raising `maximumDefaultProjectFileMatchCount` (or restructuring the `packages/shared` tsconfig so `*.test.ts` is included natively instead of via `allowDefaultProject`) is a repo-wide lint-config change, not a Task 2 concern. Flagging for a future phase/plan to bump the threshold or split the glob.

**Verification performed instead:** `pnpm --filter @counter-attack/client typecheck` exits 0. `pnpm --filter @counter-attack/client test` exits 0 (591/591). Scoped `eslint` run against the two files this plan's Task 2 modifies exits clean.
