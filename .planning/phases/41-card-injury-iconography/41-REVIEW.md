---
phase: 41-card-injury-iconography
reviewed: 2026-08-21T18:23:29Z
depth: standard
files_reviewed: 17
files_reviewed_list:
  - packages/client/src/components/BenchCarousel.test.tsx
  - packages/client/src/components/BenchCarousel.tsx
  - packages/client/src/components/CardInjuryBadge.audit.test.ts
  - packages/client/src/components/CardInjuryBadge.crossSurface.test.tsx
  - packages/client/src/components/CardInjuryBadge.test.tsx
  - packages/client/src/components/CardInjuryBadge.tsx
  - packages/client/src/components/DraftPackCarousel.tsx
  - packages/client/src/components/LineupAssignmentScreen.module.css
  - packages/client/src/components/LineupAssignmentScreen.test.tsx
  - packages/client/src/components/LineupAssignmentScreen.tsx
  - packages/client/src/components/PieceOverlay.tsx
  - packages/client/src/components/PlayerStatsPanel.module.css
  - packages/client/src/components/PlayerStatsPanel.test.tsx
  - packages/client/src/components/PlayerStatsPanel.tsx
  - packages/server/src/__tests__/gameEngine.substitution.test.ts
  - packages/server/src/gameEngine.ts
  - packages/shared/src/types.ts
findings:
  critical: 0
  warning: 2
  info: 1
  total: 3
status: issues_found
---

# Phase 41: Code Review Report

**Reviewed:** 2026-08-21T18:23:29Z
**Depth:** standard
**Files Reviewed:** 17
**Status:** issues_found

## Summary

This phase extracts card/injury badge rendering into a single shared module
(`CardInjuryBadge.tsx`) and wires it into all four consuming surfaces (pitch token,
scoreboard card, roster/lineup card, bench card), plus a small server-side change that
carries `yellowCards`/`injuryCount` forward onto `BenchEntry` at substitution/red-card
time. I traced every diff hunk against `588eb9d^..HEAD`, cross-checked geometry math
(non-overlapping side-by-side layout, layered pitch-token treatment), verified the
red-wins-over-yellow precedence rule end-to-end (client derivation + server mutation
sites), and confirmed the `applySubstitution`/`relocateRedCardedToBench` bench-entry
carry-forward logic against `gameEngine.substitution.test.ts`. The implementation is
well-factored and the geometry/precedence logic checks out correctly against the design
doc (D-01..D-05) in every surface I traced.

I did not find any BLOCKER-level correctness or security defects. I did find two
quality-level issues worth fixing: a nested/duplicated ARIA `role="img"` labeling
pattern in the shared badge component, and a self-referential audit test whose "exactly
once" guard is satisfied by matching the file's own doc-comment prose rather than any
real code path (the actual `cardColorFor` implementation is an `if`-statement, not the
ternary the audit regex is written to detect).

## Warnings

### WR-01: Nested `role="img"` elements produce duplicate/conflicting screen-reader announcements

**File:** `packages/client/src/components/CardInjuryBadge.tsx:117-166` and `packages/client/src/components/CardInjuryBadge.tsx:200-219`

**Issue:** `CardInjuryBadgeGroup` puts `role="img"` + `aria-label={cardInjuryLabel(...)}` on
both the card `<rect>` (line 130-131) and the injury `<g>` (line 142-143). `CardInjuryBadge`
then wraps two instances of `CardInjuryBadgeGroup` inside an outer `<svg role="img"
aria-label={label}>` (line 201-204) that already carries the _combined_ label (e.g.
`"Yellow card, Injured"`). The result, for every DOM surface that uses `CardInjuryBadge`
(scoreboard card, roster card, bench card), is an `img`-role element nested inside another
`img`-role element, each with its own (partial) label:

- outer svg: `aria-label="Yellow card, Injured"`
- inner rect: `aria-label="Yellow card"`
- inner g: `aria-label="Injured"`

Screen readers commonly either announce all three (duplicated/confusing) or only
traverse to the outermost `img` (making the inner labels dead code depending on the AT).
Nested `role="img"` is also non-idiomatic ARIA — an `img` role is meant to represent a
single atomic image, not a container of further labeled images.

Additionally, in `PieceOverlay.tsx` (`CardInjuryBadgeGroup` used directly, unwrapped by
any outer labeled element), the card and injury each announce a _separate, uncombined_
label (`"Yellow card"` and `"Injured"` independently) rather than the single combined
`"Yellow card, Injured"` string `cardInjuryLabel` was written to produce — inconsistent
with the DOM-surface behavior and with the accessible-label contract documented in the
module's own header comment.

**Fix:** Make `CardInjuryBadgeGroup`'s inner `role`/`aria-label` conditional on whether it
is being composed inside an already-labeled wrapper, e.g. add a `standalone?: boolean`
prop (or hoist labeling entirely into the two call sites):

```tsx
export function CardInjuryBadgeGroup({
  cx, cy, r, cardColor, injuryCount,
  labelled = true, // false when composed inside CardInjuryBadge's already-labeled <svg>
}: CardInjuryBadgeGroupProps & { labelled?: boolean }) {
  ...
  {cardColor && (
    <rect
      data-testid="piece-card-badge"
      data-card={cardColor}
      {...(labelled ? { role: 'img', 'aria-label': cardInjuryLabel(cardColor, 0) } : {})}
      ...
    />
  )}
```

and pass `labelled={false}` from both calls inside `CardInjuryBadge` (leaving the outer
`<svg>`'s combined label as the sole accessible name), while leaving `labelled` at its
default `true` for `PieceOverlay`'s direct usage — or better, wrap `PieceOverlay`'s call
site in its own `<g role="img" aria-label={cardInjuryLabel(cardColor, injuryCount)}>` and
set `labelled={false}` unconditionally inside `CardInjuryBadgeGroup`, so every consumer
gets exactly one combined accessible name.

### WR-02: Self-referential audit test validates its "exactly once" guard against doc-comment prose, not real code

**File:** `packages/client/src/components/CardInjuryBadge.audit.test.ts:66-85`

**Issue:** `CardInjuryBadge.tsx`'s module header doc comment (lines 6-9 of that file)
contains, as prose describing the pattern being guarded against, the literal text:
`` `redCarded === true ? 'red' : (yellowCards ?? 0) > 0 ? 'yellow' : null` ``. The
audit's `derivationRegex` (`/redCarded\s*===\s*true\s*\?\s*['"]red['"]/`) matches this
prose. Meanwhile, the _actual_ implementation of `cardColorFor` in the same file is an
`if`-statement (`if (piece.redCarded === true) return 'red';`), which does **not** match
the ternary-shaped regex at all (no `?` follows `true`). This means the test at line
81-85 ("CardInjuryBadge.tsx contains the derivation exactly once ... guards against a
second copy sprouting inside it") is passing by coincidentally matching the doc comment,
not by verifying anything about the real `cardColorFor` implementation. Two consequences:

1. If a future editor rewords or removes that doc-comment sentence (e.g. during an
   unrelated docs cleanup), this test would go from 1 match to 0 matches and fail for a
   reason completely disconnected from any actual regression.
2. If a second doc comment anywhere in the file ever quotes the same ternary pattern
   (e.g. in a future TSDoc example), the "exactly once" assertion would fail even though
   no code duplication occurred.

The regex-based approach is otherwise sound for its stated purpose (catching a
_re-introduced_ ternary in a sibling surface file), but the self-check inside
`CardInjuryBadge.tsx` itself is fragile because it can't distinguish comment prose from
code.

**Fix:** Either (a) strip comments before matching, mirroring the `readCss` helper's
existing `.replace(/\/\*[\s\S]*?\*\//g, '')` block-comment stripping (note: it would also
need to strip `//` line comments, which the current `read()` helper does not do), or (b)
scope the "exactly once" self-check to skip the module doc comment specifically, or (c)
rephrase the doc comment to avoid embedding the literal banned substring (e.g. describe
it in prose without the exact `?  'red' :` punctuation), so the assertion is actually
exercising the real `cardColorFor` code path rather than incidental doc text.

## Info

### IN-01: `CardInjuryBadgeGroup`'s outer `<svg>` wrapper in `CardInjuryBadge` has no `pointerEvents` guard

**File:** `packages/client/src/components/CardInjuryBadge.tsx:200-209`

**Issue:** Every inner glyph primitive (`<rect>`/`<g>`) explicitly sets
`pointerEvents="none"`, but the wrapping `<svg data-testid="card-injury-badge">` itself
does not. This is consumed as a normal (non-draggable-by-itself) child inside
`draggable` card containers (`DraftCardBody` in `DraftPackCarousel.tsx`/
`BenchCarousel.tsx`) and inside `LineupStatCard`'s draggable row. In practice HTML5
drag events bubble from a `mousedown`/`dragstart` target up through ancestors
regardless of this, so this is unlikely to cause an observable defect, but for
consistency with the "layer never intercepts pointer interaction" intent documented
on the inner primitives, consider adding `pointerEvents="none"` (or `style={{
pointerEvents: 'none' }}`) to the outer `<svg>` as well, so the whole badge — not just
its children — is guaranteed inert to pointer/drag targeting.

**Fix:**

```tsx
<svg
  data-testid="card-injury-badge"
  role="img"
  aria-label={label}
  viewBox={`0 0 ${viewW} ${size}`}
  width={viewW}
  height={size}
  style={{ flexShrink: 0, pointerEvents: 'none' }}
>
```

---

_Reviewed: 2026-08-21T18:23:29Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
