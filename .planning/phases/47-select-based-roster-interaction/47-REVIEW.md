---
phase: 47-select-based-roster-interaction
reviewed: 2026-08-30T00:00:00Z
depth: standard
files_reviewed: 10
files_reviewed_list:
  - docs/HIGHLIGHT-REFERENCE.md
  - packages/client/src/components/BenchCarousel.test.tsx
  - packages/client/src/components/BenchCarousel.tsx
  - packages/client/src/components/CardInjuryBadge.crossSurface.test.tsx
  - packages/client/src/components/DraftPackCarousel.test.tsx
  - packages/client/src/components/DraftPackCarousel.tsx
  - packages/client/src/components/GameBoard.test.tsx
  - packages/client/src/components/LineupAssignmentScreen.module.css
  - packages/client/src/components/LineupAssignmentScreen.test.tsx
  - packages/client/src/components/LineupAssignmentScreen.tsx
findings:
  critical: 0
  warning: 4
  info: 3
  total: 7
status: issues_found
---

# Phase 47: Code Review Report

**Reviewed:** 2026-08-30T00:00:00Z
**Depth:** standard
**Files Reviewed:** 10
**Status:** issues_found

## Summary

Phase 47 replaces native HTML5 drag-and-drop across the roster/draft/bench
surfaces with a click-to-select model. The click-select state machines
(pregame swap, draft pick/rearrange, mid-match reposition, mid-match
substitute) are each implemented as structurally separate handler functions
as the code comments require, and the extensive test suites exercise the
documented selection/deselect/eligible/complete contract thoroughly for each
surface. No security issues, hardcoded secrets, injection vectors, or
crash-causing null-dereferences were found, and no debug artifacts
(`console.log`, `TODO`, empty catch blocks, etc.) are present in the reviewed
files.

The issues found are all correctness-adjacent code-quality gaps rather than
live, easily-triggered bugs: an index-alignment landmine in the draft bench
click handler that only misbehaves if upstream card-resolution ever silently
drops an entry, a keyboard-accessibility gap on the one interactive element
in the file that doesn't follow the codebase's own `role="button"`/
`tabIndex`/`onKeyDown` convention, an unenforced "selected wins over
eligible" invariant in one of three near-identical branches, and a factual
inaccuracy repeated in both the CSS comment and the design doc it mirrors.
`LineupAssignmentScreen.tsx` itself is also flagged as a maintainability
concern given its size (1466 lines, three fully-duplicated interaction
state machines).

## Warnings

### WR-01: Draft-mode bench click index can silently misalign with the clicked card

**File:** `packages/client/src/components/LineupAssignmentScreen.tsx:501-515` (bench card derivation) and `:966-975` (click handler)
**Issue:** `benchCards` (passed to `<BenchCarousel cards={benchCards} .../>` at line 1349) is built by mapping `draftView.benchIds` through `resolveTieredCard` and then **filtering out any `null` result**:
```ts
const benchCards: TieredPoolPlayer[] = useMemo(() => {
  if (!draftView) return [];
  return draftView.benchIds
    .map(resolveTieredCard)
    .filter((c): c is TieredPoolPlayer => c !== null);
}, [draftView, resolveTieredCard]);
```
`BenchCarousel` reports clicks back as a plain positional `benchIndex` (its own `cards.map((card, benchIndex) => ...)` index — see `BenchCarousel.tsx:239-260`). `handleDraftBenchCardClick` then re-indexes into the **unfiltered** source array to recover the card id:
```ts
function handleDraftBenchCardClick(benchIndex: number) {
  const cardId = draftView?.benchIds[benchIndex];
  ...
```
If `resolveTieredCard` ever returns `null` for one bench entry (any `benchIds` id not present in `PLAYER_MAP`, e.g. a data desync), `benchCards.length < draftView.benchIds.length` and every index after the dropped entry is off by one — a click on bench card *N* as rendered would resolve to and act on `draftView.benchIds[N]`, a different card than the one the user actually clicked, and `onDraftRearrange`/`onDraftPick` would fire with a wrong `cardId`. This is a real index-integrity gap introduced by the Phase 47 index-based click contract (the retired pointer-carry implementation carried the card id directly, not a positional index). It requires an already-inconsistent data state to trigger, which is why this is a Warning rather than a Blocker, but nothing here defends against it or even logs a discrepancy.
**Fix:** Either derive `cardId` from the same filtered `benchCards` array (`benchCards[benchIndex]?.id`) instead of re-indexing `draftView.benchIds`, or make `resolveTieredCard` never return `null` for a genuinely-drafted id (i.e., treat an unresolvable bench id as a hard invariant violation rather than silently filtering it out).

### WR-02: SENT OFF placeholder is a mouse-only, mis-labeled interactive target

**File:** `packages/client/src/components/LineupAssignmentScreen.tsx:711-728`
**Issue:** When a dismissed (red-carded) mid-match piece's slot is an eligible reposition target, the placeholder only gets an `onClick` handler:
```tsx
<div
  key={piece.id}
  className={...}
  aria-label="Sent off — slot empty"
  role="img"
  data-roster-card
  {...(sentOffEligible
    ? { onClick: () => handleRepositionCardClick(piece.id) }
    : {})}
>
```
Unlike every other interactive card in this file and in `DraftCardBody`/`BenchCarousel` (which all attach `role="button"`, `tabIndex={0}`, and an `onKeyDown` Enter/Space handler whenever they're clickable — see the empty-slot placeholder in `renderDraftColumn` at lines 1021-1046 for the correct pattern used elsewhere in this exact file), this element keeps `role="img"` and never becomes keyboard-focusable even when it is a legitimate click-to-complete target. A keyboard-only user cannot complete a reposition onto a sent-off slot, and assistive technology will announce it as a static image rather than an actionable control.
**Fix:** Mirror the empty-slot pattern already used in `renderDraftColumn`: when `sentOffEligible`, also spread `role: 'button', tabIndex: 0, onKeyDown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleRepositionCardClick(piece.id); } }`, and switch `role="img"` to `role="button"` in that branch (keep `role="img"` only for the non-eligible, purely-informational state).

### WR-03: "selected wins over eligible" is not structurally enforced in one of three parallel branches

**File:** `packages/client/src/components/LineupAssignmentScreen.tsx:271-279`
**Issue:** `LineupStatCard`'s `StatCardProps.isSelected` doc comment states the invariant "selected wins over eligible" (mirrored verbatim in `DraftCardBody`'s own doc comment), and both the mid-match branch of this same function (lines 262-266) and `DraftCardBody` (`DraftPackCarousel.tsx:138-142`) enforce it with `if (isSelected) {...} else if (isEligibleTarget) {...}`. The Standard/pregame branch of the same function does not:
```ts
} else {
  cardClass = styles.statCard;
  if (isSelected) {
    cardClass = `${cardClass} ${styles.statCardSelected}`;
  }
  if (isEligibleTarget) {
    cardClass = `${cardClass} ${styles.statCardEligible}`;
  }
}
```
Today this never visibly manifests because the only caller (`renderColumn`) computes `isEligibleTarget` via `isPregameSwapEligible`, which itself requires `sourceIdx !== targetIdx` — structurally guaranteeing `isSelected` and `isEligibleTarget` can never both be true for the same card. That guarantee lives entirely in the caller, though, not in `LineupStatCard` itself, so the component's own invariant is only accidentally true. A future caller/edit that computes eligibility differently (as the mid-match and draft branches already do, independently, in this same file) could silently apply both `.statCardSelected` (green) and `.statCardEligible` (blue) classes to one card, producing an undefined/inconsistent highlight (whichever CSS rule is declared later in the module wins the conflicting `border`/`box-shadow` properties, per the file's own cascade-order comment at line 713).
**Fix:** Change the two `if` statements to `if (isSelected) {...} else if (isEligibleTarget) {...}`, matching the other two branches in this same function and in `DraftCardBody`.

### WR-04: `LineupAssignmentScreen.tsx` is an oversized, triple-duplicated component

**File:** `packages/client/src/components/LineupAssignmentScreen.tsx` (whole file, 1466 lines)
**Issue:** The component internally branches into three almost-fully-independent render/interaction trees (pregame Standard-mode swap, draft-mode pick/rearrange, mid-match reposition/substitute), each with its own selection state, its own "is this an eligible target" predicate, its own click handler triad (select/deselect/complete), and its own card-class composition logic. The doc comments explicitly justify keeping these "structurally separate" (Pitfall 5 HARD CONSTRAINT) to avoid guard-body sharing bugs, which is a reasonable per-mode rule, but nothing forces the three modes to live in one file/component — the size and duplicated shape materially raises the cost of any future change that must be applied identically across all three (as WR-03 above demonstrates: the same fix needed to land in three near-identical places, and only landed correctly in two of them).
**Fix:** Consider extracting each mode's render branch (`renderColumn`+pregame handlers, `renderDraftColumn`+draft handlers, `renderMidmatchColumn`+midmatch handlers) into three separate components/hooks sharing only `LineupStatCard`/`DraftCardBody`, so a shared invariant like WR-03 can be encoded once instead of three times. Non-blocking for this phase but worth tracking before a future phase adds a fourth mode.

## Info

### IN-01: Doc and CSS comment both misdescribe `.benchCarousel` as a "border-declaring" class

**File:** `docs/HIGHLIGHT-REFERENCE.md:252`, `packages/client/src/components/LineupAssignmentScreen.module.css:713-723`
**Issue:** Both the design doc ("composed onto `.statCardSentOff`, `.benchSlot`, `.benchCarousel`, and the `.cardTier*` rules, all of which also declare `border`") and the matching CSS comment ("Every other border-declaring card class in this file (`.statCardSentOff`, `.benchSlot`, `.benchCarousel`, `.cardTierChase`/...)") list `.benchCarousel` among border-declaring classes that motivate the cascade-order placement of `.statCardSelected`/`.statCardEligible`. `.benchCarousel` (module.css:451-455) declares only `display`, `flex-direction`, and `width` — no `border` at all. The claim is factually wrong, though harmless in practice since no cascade conflict actually exists for that class.
**Fix:** Drop `.benchCarousel` from both lists, or correct the claim to describe why it's still listed (e.g., composition consistency) rather than a border conflict that doesn't exist.

### IN-02: `benchAreaEligible` styling isn't gated by the same conditions as `benchAreaEligible`-driven interactivity

**File:** `packages/client/src/components/BenchCarousel.tsx:152, 189-200`
**Issue:** `containerClassName` applies `.statCardEligible` purely from `benchAreaEligible === true`, independent of `disabled`:
```ts
const containerClassName =
  benchAreaEligible === true
    ? `${styles.benchCarousel} ${styles.statCardEligible}`
    : styles.benchCarousel;
```
while `isBenchAreaClickable` additionally requires `disabled !== true`. No current call site (mid-match, draft, pregame) ever passes both `disabled` and `benchAreaEligible` truthy simultaneously, so this doesn't manifest today, but nothing in the component prevents a future caller from doing so — the container would then show the blue "you can click this" ring while being completely inert (no `onClick`/`role`/`tabIndex` attached).
**Fix:** Gate the eligible-styling class on `isBenchAreaClickable` (or equivalently `benchAreaEligible === true && disabled !== true`) instead of `benchAreaEligible` alone, so the visual state can never lie about interactivity.

### IN-03: `SCROLL_STEP_PX` magic number duplicated verbatim across two files

**File:** `packages/client/src/components/BenchCarousel.tsx:87`, `packages/client/src/components/DraftPackCarousel.tsx:250`
**Issue:** `const SCROLL_STEP_PX = 328;` is defined independently in both files with a comment noting it must mirror the other file's value ("mirrors DraftPackCarousel's SCROLL_STEP_PX exactly"). This is a plain DRY violation — the two constants can drift silently if one file's card min-width/gap changes without the other being updated in lockstep.
**Fix:** Export `SCROLL_STEP_PX` from one of the two carousel files (or a shared constants module) and import it in the other, so a single edit keeps both carousels in sync.

---

_Reviewed: 2026-08-30T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
