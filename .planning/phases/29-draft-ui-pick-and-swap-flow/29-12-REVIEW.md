---
phase: 29-draft-ui-pick-and-swap-flow
reviewed: 2026-07-22T00:18:00Z
depth: standard
files_reviewed: 3
files_reviewed_list:
  - packages/client/src/components/LineupAssignmentScreen.tsx
  - packages/client/src/components/BenchCarousel.tsx
  - packages/client/src/components/BenchCarousel.test.tsx
findings:
  critical: 0
  warning: 1
  info: 1
  total: 2
status: issues_found
---

# Phase 29-12: Code Review Report (gap-closure — bench carousel scroll-reset stability)

**Reviewed:** 2026-07-22T00:18:00Z
**Depth:** standard
**Files Reviewed:** 3
**Status:** issues_found

## Summary

This is a scoped re-review of the 29-12 gap-closure diff only (`git diff dee8ce3..HEAD` on the three listed files), not the full phase. The diff does three things: (1) hoists `benchCards` in `LineupAssignmentScreen.tsx` out of the `draftMode` render branch into a top-level `useMemo` keyed on `[draftView?.benchIds, cardCache]`, (2) changes `BenchCarousel`'s scroll-reset `useEffect` to key on a content-derived `benchKey` (`cards.map(c => c.id).join('|')`) instead of the `cards` array reference, and (3) adds two new regression tests plus a `installControllableScrollLeft` jsdom test helper.

I traced the hook ordering, dependency arrays, and closure captures across both files and did not find a correctness defect. Specifically:

- The `useMemo` is called unconditionally before the component's first early return (`if (!formation) return null`), so Rules of Hooks are respected regardless of `draftMode`/`draftView` state.
- `resolveTieredCard` (a hoisted function declaration) is fully determined by `cardCache` and the stable module-level `PLAYER_MAP`, both of which are accounted for by the memo's dependency array (no react-hooks/exhaustive-deps lint is configured in this repo — `eslint.config.js` has no `eslint-plugin-react-hooks` — so this isn't a build-breaking gap either).
- The child-side `benchKey` correctly guards against residual reference churn even if the parent-side memo's `cardCache` dependency updates more often than the actual bench composition changes (documented in-code as "belt-and-suspenders"), which is the right defensive layering given `cardCache`'s own update effect (unchanged, pre-existing) can produce new object references without a real content change.
- `pnpm --filter @counter-attack/client test -- --run BenchCarousel` (8/8 passing) and a client-package `tsc --noEmit` both pass cleanly against the current tree.

The one real gap is in test coverage completeness relative to the behavioral contract the fix's own comments assert (order-significance of `benchKey`), and one very-low-probability robustness note on the join delimiter. Neither is a functional defect today.

## Warnings

### WR-01: New regression tests don't cover the "order changed, same id set" and "card removed" cases the fix's own comments claim to handle

**File:** `packages/client/src/components/BenchCarousel.test.tsx:155-234`
**Issue:** The `benchKey` comment in `BenchCarousel.tsx:61-65` explicitly states "card ids are unique and order-significant, so benchKey changes only when the benched card set or its order genuinely changes." The two new tests only cover (a) identical id set/order with a new array reference (no reset expected) and (b) an id appended (3rd card added, reset expected). There is no test asserting that a pure reorder of the same ids (e.g. `[b1,b2] -> [b2,b1]`, no add/remove) still resets the scroll, nor one covering removal (e.g. `[b1,b2,b3] -> [b1,b2]`). Both are asymmetric-but-plausible real events (dragging a bench card into a lineup slot removes it from the bench; the server can also echo bench cards in a new order after a rearrange). If a future refactor changed `benchKey` to something order-insensitive (e.g. a sorted join, or a `Set`-based comparison) to "simplify" it, none of the current tests would catch the regression against the explicitly documented contract.
**Fix:** Add two more cases to the `DRAFT-09 scroll stability` describe block:

```tsx
it('DOES reset scroll when the same ids are reordered', () => {
  // render with [b1, b2] cards, set scrollLeft = 150
  // rerender with [b2, b1] (same ids, swapped order)
  // expect scrollLeft.get() === 0
});

it('DOES reset scroll when a benched card is removed', () => {
  // render with [b1, b2, b3], set scrollLeft = 150
  // rerender with [b1, b2] (b3 removed)
  // expect scrollLeft.get() === 0
});
```

## Info

### IN-01: `benchKey`'s `'|'`-joined id string has no delimiter-collision guard

**File:** `packages/client/src/components/BenchCarousel.tsx:66`
**Issue:** `cards.map((c) => c.id).join('|')` can theoretically produce identical keys for two different id partitions if any card id ever contained the `|` character (e.g. `['a|b', 'c']` and `['a', 'b|c']` both join to `"a|b|c"`), silently suppressing an expected scroll reset. Today this is not exploitable — `PoolPlayer.id` values are internally generated (`p001`, `p002`, ... per `packages/shared/src/teams.ts`) and never contain `|` — so this is a defense-in-depth note rather than a live bug.
**Fix:** If card ids ever become less tightly controlled (e.g. free-form import), prefer an unambiguous encoding such as `JSON.stringify(cards.map((c) => c.id))` or a length-prefixed join to eliminate the theoretical collision class outright.

---

_Reviewed: 2026-07-22T00:18:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
