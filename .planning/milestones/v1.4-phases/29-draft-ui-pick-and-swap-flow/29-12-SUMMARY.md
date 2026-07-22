---
phase: 29-draft-ui-pick-and-swap-flow
plan: 12
subsystem: client-draft-ui
tags: [draft-mode, bench-carousel, react-render-stability, gap-closure]
dependency-graph:
  requires:
    - LineupAssignmentScreen.tsx (draftView.benchIds, cardCache, resolveTieredCard)
    - BenchCarousel.tsx (D-21 carousel chrome)
  provides:
    - Stable benchCards useMemo (LineupAssignmentScreen.tsx)
    - Content-derived benchKey scroll-reset gating (BenchCarousel.tsx)
  affects:
    - Draft-mode bench carousel UX (DRAFT-09 / roadmap Phase 29 Success Criteria #4)
tech-stack:
  added: []
  patterns:
    - 'useMemo keyed on server-state identity (draftView?.benchIds) plus derived-cache identity (cardCache), not on per-render recomputation'
    - 'Content-derived effect key (joined-ids string) instead of array-identity dependency, for resilience to upstream reference churn'
key-files:
  created: []
  modified:
    - packages/client/src/components/LineupAssignmentScreen.tsx
    - packages/client/src/components/BenchCarousel.tsx
    - packages/client/src/components/BenchCarousel.test.tsx
decisions:
  - 'benchCards hoisted to a top-level useMemo above the `if (!formation) return null;` early return (rules-of-hooks compliance) — memo dep array is [draftView?.benchIds, cardCache], not [draftView] wholesale, since draftView also carries currentPack/waitingForOpponent/etc. that change on unrelated events'
  - "BenchCarousel's benchKey is computed unconditionally on every render (cheap string join over <=16 ids) rather than memoized itself — deriving it fresh each render is simpler and the useEffect dependency comparison (string equality) is what actually gates the reset, not benchKey's own referential identity"
metrics:
  duration: ~35min
  completed: 2026-07-22T00:08:48Z
---

# Phase 29 Plan 12: Bench Carousel Scroll-Reset Gap Closure Summary

Fixed the bench carousel's mid-drag scroll snap-back by memoizing `benchCards` in `LineupAssignmentScreen.tsx` (stable reference across drag-over/rejection-timeout re-renders) and re-keying `BenchCarousel`'s scroll-reset `useEffect` from the `cards` array identity to a content-derived `benchKey` (joined card ids) — closing the last CRITICAL gap on Phase 29 (29-VERIFICATION.md, verified 2026-07-21T23:10:00Z).

## What Was Built

**Task 1 — Stabilize `benchCards` reference and re-key `BenchCarousel`'s scroll-reset effect on content:**

- `LineupAssignmentScreen.tsx`:
  - Added `useMemo` to the React import.
  - Hoisted the inline `draftView.benchIds.map(resolveTieredCard).filter(...)` computation (previously recomputed on every render inside the `if (draftMode)` branch) into a top-level `useMemo` placed after `resolveTieredCard`'s definition and before the `if (!formation) return null;` early return (satisfying React's rules-of-hooks — the hook must run unconditionally on every render).
  - Dependency array: `[draftView?.benchIds, cardCache]`. `draftView.benchIds` only gets a new reference on a genuine `DRAFT_STATE_UPDATED`; `cardCache` only changes when a new pack card populates the tier-color cache. Neither changes on `setDraftDropTargetIndex` (fired on every native `dragover` tick while dragging a card over any lineup slot) or `setRejectionMessage` (fired by the rejection-message timeout) re-renders, so the memoized `benchCards` array keeps a stable reference across both.
  - Removed the now-duplicate inline `benchCards` declaration — exactly one `benchCards` binding remains in the file.

- `BenchCarousel.tsx`:
  - Added `const benchKey = cards.map((c) => c.id).join('|');` — a content-derived key (card ids are unique and order-significant; `|` cannot appear inside an id).
  - Changed the scroll-reset `useEffect`'s dependency array from `[cards]` to `[benchKey]`. The effect body (`el.scrollLeft = 0; updateScrollState();`) and the `if (!el) return;` guard are unchanged.
  - This is the belt-and-suspenders half: even if some future caller re-introduces reference churn, the carousel itself only resets on genuine content change.

**Task 2 — Add `BenchCarousel` regression test — scroll preserved on identity churn, reset on content change:**

- Added a new `describe('BenchCarousel — DRAFT-09 scroll stability (gap-closure 29-12)', ...)` block to `BenchCarousel.test.tsx` with a local `installControllableScrollLeft(track)` helper (installs a `scrollLeft` accessor backed by a local variable, since jsdom performs no layout and native `scrollLeft` does not persist meaningfully).
  - Test A — "does NOT reset scroll on an unrelated re-render (new array reference, identical ids)": renders with `['b1','b2']`, sets `scrollLeft = 150`, rerenders with a brand-new array of the same ids, asserts `scrollLeft` is still `150`.
  - Test B — "DOES reset scroll when benched content actually changes": same setup, rerenders with `['b1','b2','b3']` (ids changed), asserts `scrollLeft` resets to `0`.

## Regression Test Verified Genuine

Per the plan's acceptance criteria, I temporarily reverted the effect's dependency array from `[benchKey]` back to `[cards]` and reran the suite: Test A failed as expected (`expected +0 to be 150`), confirming the test is a genuine regression guard tied to the `benchKey` fix and not a tautology. The fix was then restored and the full suite re-verified green before committing.

## Verification

- `pnpm --filter @counter-attack/client exec vitest run BenchCarousel LineupAssignmentScreen` → 16/16 green (post-Task-1, pre-Task-2 baseline).
- `pnpm --filter @counter-attack/client exec vitest run BenchCarousel` → 8/8 green (post-Task-2: 6 pre-existing + 2 new).
- `pnpm --filter @counter-attack/client test -- --run` → full client suite 370/370 passing (was 368/368; +2 new tests, matching the plan's expectation exactly).
- `pnpm --filter @counter-attack/client typecheck` → exit 0.
- `grep -c "useMemo" packages/client/src/components/LineupAssignmentScreen.tsx` → 2 (import + usage).
- `grep -n "benchKey" packages/client/src/components/BenchCarousel.tsx` → const definition + effect dependency use, both present.
- `grep -n "\[cards\]" packages/client/src/components/BenchCarousel.tsx` → no match (identity dependency removed).

## Environment Note (worktree setup, not a plan deviation)

This worktree had no `node_modules` anywhere in its tree (fresh worktree checkout) and `packages/shared` had no built `dist/` output, so `vitest`/`tsc` were unresolvable at first invocation. Ran `pnpm install --frozen-lockfile` (reused the shared pnpm store — no downloads, no junction workarounds) and `pnpm --filter @counter-attack/shared build` before the plan's verification commands would execute. This is standard per-worktree environment bootstrapping, not a code change, and is not tracked as a deviation.

## Deviations from Plan

None — plan executed exactly as written. Both tasks matched their `<action>` and `<acceptance_criteria>` blocks precisely; no Rule 1/2/3 auto-fixes or Rule 4 architectural questions arose.

## Known Stubs

None introduced by this plan.

## Threat Flags

None — this plan is client-only render-stability (a `useMemo` and a re-keyed `useEffect`) plus a component test, per the plan's own threat model (`T-29.12-01`: accept, no new trust boundary).

## Self-Check: PASSED

- `packages/client/src/components/LineupAssignmentScreen.tsx` — FOUND, modified as described.
- `packages/client/src/components/BenchCarousel.tsx` — FOUND, modified as described.
- `packages/client/src/components/BenchCarousel.test.tsx` — FOUND, modified as described.
- Commit `792acf4` (fix: stabilize benchCards / re-key scroll-reset) — FOUND in `git log`.
- Commit `3323fa9` (test: add scroll-stability regression tests) — FOUND in `git log`.
