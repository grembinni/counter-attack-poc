# Deferred Items — Phase 43 (Tackle/Steal Prompt & Decline)

## Whole-workspace `pnpm lint` (root `eslint .`) OOMs — pre-existing, out of scope

**Found during:** 43-06 Task 3 (whole-repo quality gate).

**Status:** Pre-existing tech debt, first documented at v1.5/Phase 32-33 close
("the whole-workspace `pnpm lint` OOMs on a pre-existing `packages/shared`
typescript-eslint file-count-cap config issue"). Confirmed still present and
unchanged by this plan.

**Evidence it is unrelated to this plan's changes:**

- Reproduced with `NODE_OPTIONS=--max-old-space-size=8192 pnpm run lint` —
  still OOMs (`FATAL ERROR: Ineffective mark-compacts near heap limit`),
  confirming this is a structural eslint/typescript-eslint memory-scaling
  issue on the whole workspace, not something this plan's small test-only
  diff could trigger.
- `.github/workflows/ci.yml` does NOT run `pnpm lint` (root `eslint .`) at
  all — CI runs `pnpm knip`, `pnpm -r typecheck`, `pnpm -r test`, `pnpm -r
build`, `pnpm stylelint`, `pnpm check-contrast`. This confirms "doesn't
  gate CI" from the original PROJECT.md note.
- Scoped `eslint` run against only this plan's 3 changed/created files
  (`HexGrid.test.tsx`, `useGameStore.test.ts`,
  `tackleStealPrompt.integration.test.ts`) passes clean with zero findings.

**Action taken:** Not fixed (out of scope per the executor's Scope Boundary
rule — a pre-existing, unrelated, already-tracked issue). Logged here per
protocol rather than re-run repeatedly hoping it resolves.

**Recommendation:** Carry forward to the next dedicated code-cleanup phase
(mirrors the Phase 32/33 handling) — likely needs either a `max-old-space-size`
bump wired into the `lint` script itself, or splitting the root `eslint .`
invocation per-package (`pnpm -r lint`) to avoid loading the whole workspace's
type-aware lint graph in one process.
