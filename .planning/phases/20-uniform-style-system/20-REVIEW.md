---
phase: 20-uniform-style-system
reviewed: 2026-07-04T00:00:00Z
depth: standard
files_reviewed: 8
files_reviewed_list:
  - packages/shared/src/uniformStyles.ts
  - packages/shared/src/teamConfig.ts
  - packages/shared/src/index.ts
  - packages/client/src/styles/uniformStyles.tsx
  - packages/client/src/styles/uniformStyles.test.tsx
  - packages/client/src/components/PieceOverlay.tsx
  - packages/client/src/components/PieceOverlay.test.tsx
  - packages/client/src/components/HexGrid.tsx
findings:
  critical: 2
  warning: 6
  info: 4
  total: 12
status: issues_found
---

# Phase 20: Code Review Report

**Reviewed:** 2026-07-04
**Depth:** standard
**Files Reviewed:** 8
**Status:** issues_found

---

## Summary

Phase 20 delivers a clean architectural goal — a parameterized 12-style renderer registry that replaces hardcoded per-team SVG blocks — and largely executes it correctly. The TypeScript compile is clean, the barrel export is correct, the `Record<UniformStyleId, UniformStyleRenderer>` registry gives compile-time exhaustiveness, and the GK palette-swap logic in `PieceOverlay` correctly inverts all four colour roles before the renderer is called.

Two issues require attention before this ships: a renderer that bleeds visually beyond the piece circle boundary (`tree-rings`, BLOCKER), and a spec contradiction in the `diagonal` renderer's colour role selection (BLOCKER). Six warnings surface across dead code, missing test coverage, and magic-number violations of the `R` parameterisation contract. Four informational notes cover cosmetic and structural quality concerns.

---

## Critical Issues

### CR-01: `tree-rings` outer ring bleeds beyond piece circle boundary — no clip applied

**File:** `packages/client/src/styles/uniformStyles.tsx:304-330`

**Issue:** The `treeRings` renderer draws the outermost ring at `r=12` with `strokeWidth=3`. Since PIECE_RADIUS is also 12, the stroke spans from r=10.5 to r=13.5 — 1.5px of it extends past the piece circle edge. No `clipPath` is applied to the overlay circles. The base circle also has a 1.5px stroke (PieceOverlay line 139), so the outer tree-ring strokes merge with and bleed over the edge stroke and into adjacent elements. Every adjacent hex or piece will partially occlude or be occluded by the bleeding ring.

The UI-SPEC (20-UI-SPEC.md line 272) specifies r=12 but does not mandate a clip. The spec is silent on bleed — this is a spec omission that produces a rendering defect.

**Fix:** Add a `clipPath` scoped to the piece circle and apply it to the overlay Fragment, or reduce the outer ring radius to `R - strokeWidth/2` (i.e., `10.5` or `Math.round(R - 1.5)`) so the full stroke stays inside the boundary:

```tsx
// Option A — clip the overlay
export const treeRings: UniformStyleRenderer = ({ cx, cy, R, palette, pieceId }) => ({
  patternDef: (
    <clipPath id={`clip-tree-rings-${pieceId}`}>
      <circle cx={cx} cy={cy} r={R} />
    </clipPath>
  ),
  fill: palette.primary,
  overlay: (
    <g clipPath={`url(#clip-tree-rings-${pieceId})`}>
      <circle cx={cx} cy={cy} r={R}      fill="none" stroke={palette.primary}      strokeWidth={3} pointerEvents="none" />
      <circle cx={cx} cy={cy} r={R - 4}  fill="none" stroke={palette.primaryLight} strokeWidth={3} pointerEvents="none" />
      <circle cx={cx} cy={cy} r={R - 8}  fill={palette.primary}                                     pointerEvents="none" />
    </g>
  ),
});

// Option B — inset the outer ring so its full stroke stays inside R
// outermost: r = R - 1.5 = 10.5 (no bleed), middle: r = R - 5.5, inner: r = R - 9.5
```

Option A preserves the spec geometry and eliminates bleed. Option B avoids a new clipPath but changes the visual radii — update the spec accordingly.

---

### CR-02: `diagonal` renderer uses `palette.secondary1` but UI-SPEC mandates `palette.secondary2`

**File:** `packages/client/src/styles/uniformStyles.tsx:83-115`

**Issue:** The UI-SPEC at `20-UI-SPEC.md:118` explicitly states the diagonal stripe colour is `secondary2`. The inline comment at lines 77-80 documents that the renderer intentionally deviates to use `palette.secondary1` instead, arguing it matches v1.2's hardcoded `#111111` (which happens to be Crew's `secondary1`).

The argument holds for Crew today (Crew.secondary1 = '#111111' ≈ near-black diagonal), but the deviation is team-specific reasoning embedded into a team-agnostic renderer. For any future team where `secondary1 ≠ secondary2`, the renderer will silently produce the wrong colour for the diagonal stripe. The spec defines the contract; the renderer breaks it. Either the spec must be corrected (changing `secondary2` to `secondary1` for `diagonal`) or the renderer must be corrected (use `palette.secondary2`).

**Fix — preferred: correct the spec, keep the renderer as-is (matches v1.2)**

Update `20-UI-SPEC.md` line 118 to read `secondary1` instead of `secondary2` for the diagonal stripe colour. Add a data note in `teamConfig.ts` explaining that Crew's diagonal stripe uses `secondary1` (near-black) rather than `secondary2` (forest green). This removes the latent defect for future teams.

**Fix — alternative: correct the renderer to match the spec**

```tsx
// Change palette.secondary1 to palette.secondary2:
overlay: (
  <line
    ...
    stroke={palette.secondary2}   // was palette.secondary1
    ...
  />
),
```

For Crew this changes the diagonal from '#111111' (near-black) to '#14532d' (forest green) — a visual regression from v1.2. Visually wrong for the current team set. Only acceptable if the spec is the authoritative contract and v1.2 visual fidelity is abandoned.

The code comment acknowledges this conflict but leaves both sources of truth unresolved. That ambiguity must be closed.

---

## Warnings

### WR-01: `corners` and `tree-rings` use hardcoded `12` instead of `R` parameter

**File:** `packages/client/src/styles/uniformStyles.tsx:348,368 (corners polygon coords); 304 (treeRings ring radii)`

**Issue:** The `corners` renderer triangle coordinates use the literal `12` (e.g., `${cx - 12},${cy - 12}`) throughout its four polygons, and `treeRings` uses literal `12` for the outer ring radius. These values happen to equal PIECE_RADIUS today, but if `R` is ever passed as a different value (or PIECE_RADIUS changes), both renderers silently produce wrong geometry.

The `R` parameter exists precisely to make renderers geometry-independent. Hardcoding `12` defeats the parameterisation contract.

**Fix:**
```tsx
// corners — replace each 12 with R:
points={`${cx - R},${cy - R} ${cx},${cy - R} ${cx - R},${cy}`}
// etc. for all four triangles

// treeRings — replace 12/8/4 with R-relative values:
<circle cx={cx} cy={cy} r={R}     fill="none" stroke={palette.primary}      strokeWidth={3} pointerEvents="none" />
<circle cx={cx} cy={cy} r={R - 4} fill="none" stroke={palette.primaryLight} strokeWidth={3} pointerEvents="none" />
<circle cx={cx} cy={cy} r={R - 8} fill={palette.primary}                                     pointerEvents="none" />
```

---

### WR-02: `plus` renderer destructures `pieceId` but never uses it

**File:** `packages/client/src/styles/uniformStyles.tsx:171`

**Issue:** The `plus` renderer signature is `({ cx, cy, palette, pieceId }) => ...`. Since `plus` returns `patternDef: null` and renders only plain `<rect>` elements with no SVG ID, `pieceId` is a dead binding. With `noUnusedLocals` enabled this would be a compile error. As-is it adds noise and signals that the renderer may have been intended to define a clip or gradient that was never added.

**Fix:** Remove `pieceId` from the destructuring:
```tsx
export const plus: UniformStyleRenderer = ({ cx, cy, palette }) => ({
```

---

### WR-03: Test file header claims "GK-swap neutrality" coverage — no such test exists

**File:** `packages/client/src/styles/uniformStyles.test.tsx:2`

**Issue:** The file-level doc comment reads: `Covers: 12-style completeness, return-shape, id uniqueness, GK-swap neutrality, fade gradient.` There is no test that passes `isGK: true` or that verifies renderer output changes when `isGK` is set. The GK palette-swap tests live in `PieceOverlay.test.tsx`, which tests the swap via the component, not the renderers. The doc comment is misleading — it causes a reader to believe the renderer-level swap behaviour is tested when it is not.

GK swap is applied by the caller (`PieceOverlay`) before invoking the renderer, so renderer-level `isGK` tests would be testing the wrong layer. But the file comment should be corrected.

**Fix:** Remove "GK-swap neutrality" from the file comment; replace with `"(GK-swap tested via PieceOverlay.test.tsx D-13)"` to direct readers to the right test file.

---

### WR-04: `corners` overlay `pointerEvents="none"` not tested

**File:** `packages/client/src/styles/uniformStyles.test.tsx:175-206`

**Issue:** The pointer-events test suite covers `diagonal`, `plus`, and `tree-rings`. The `corners` renderer returns an overlay with four `<polygon>` elements each carrying `pointerEvents="none"`, but this is never asserted. If a future refactor accidentally drops the attribute from any polygon, no test catches it.

**Fix:** Add a test:
```tsx
it('corners overlay polygons all have pointerEvents="none"', () => {
  const result = UNIFORM_STYLES.corners(BASE_PARAMS);
  expect(result.overlay).not.toBeNull();
  const { container } = render(<svg>{result.overlay}</svg>);
  const polygons = Array.from(container.querySelectorAll('polygon'));
  expect(polygons.length).toBe(4);
  for (const poly of polygons) {
    expect(poly.getAttribute('pointer-events')).toBe('none');
  }
});
```

---

### WR-05: `diagonal` renderer includes an unnecessary `<pattern>` element for a solid fill

**File:** `packages/client/src/styles/uniformStyles.tsx:86-95`

**Issue:** The `diagonal` pattern tile contains only a single `<rect>` filled with `palette.primary`. This produces the same visual result as specifying `fill={palette.primary}` directly, yet it:

1. Adds a `<pattern>` element to the SVG `<defs>` for every diagonal-style piece (11 outfield + 1 GK per team = up to 22 extra DOM elements)
2. Causes the fill to be `url(#diagonal-${pieceId})` — an indirection through a no-op pattern

The `diagonal` style's pattern element is purely cosmetic infrastructure left over from the port. The actual diagonal comes from the overlay `<line>`.

**Fix:** Use `fill: palette.primary` directly and set `patternDef: null`:
```tsx
export const diagonal: UniformStyleRenderer = ({ cx, cy, R, palette, pieceId }) => ({
  patternDef: (
    <clipPath id={`clip-diagonal-${pieceId}`}>
      <circle cx={cx} cy={cy} r={R} />
    </clipPath>
  ),
  fill: palette.primary,
  overlay: (
    <line ... />
  ),
});
```
This removes the no-op pattern and reduces the `patternDef` Fragment to a single `<clipPath>` element.

---

### WR-06: `isGK` is declared in `UniformRenderParams` but read by zero renderers

**File:** `packages/client/src/styles/uniformStyles.tsx:24`

**Issue:** `isGK: boolean` is part of the public `UniformRenderParams` interface and is passed by `PieceOverlay` to every renderer call. No renderer reads it — they consume the already-swapped `palette` instead. The comment at line 23 acknowledges this: "renderers should use the already-swapped palette — not branch on isGK directly."

While the design intent is sound (GK colour semantics handled by the caller), retaining `isGK` in the interface adds dead API surface. Every future renderer author must understand that `isGK` is present but forbidden to use directly. This is an active trap.

**Fix (long-term):** Remove `isGK` from `UniformRenderParams`. The palette passed to the renderer is already the effective palette — no renderer needs to know whether the piece is a GK. If a future renderer needs GK-specific geometry (not just colour), revisit then.

```tsx
export interface UniformRenderParams {
  cx: number;
  cy: number;
  R: number;
  palette: TeamPalette;
  pieceId: string;
  // isGK removed — GK swap applied by PieceOverlay before renderer call
}
```

Update `PieceOverlay` to omit `isGK` from the renderer call.

---

## Info

### IN-01: GK-specific SVG ID suffix omitted — spec deviation (no collision risk today)

**File:** `packages/client/src/styles/uniformStyles.tsx` (all pattern renderers)

**Issue:** The UI-SPEC at `20-UI-SPEC.md:193` defines the GK ID convention as `id={`${uniformStyle}-gk-${piece.id}`}`. The implementation uses the same ID for both GK and outfield pieces (e.g., `checker-home-0` for both). No collision occurs today because GK piece IDs (`home-0`, `away-0`) are globally unique within the game. But the spec contract is not implemented and could cause ID collisions if the ID scheme changes (e.g., if GK and outfield pieces ever share IDs in a different context).

**Recommendation:** Either update the spec to remove the `-gk-` suffix (since piece IDs already guarantee uniqueness), or implement the suffix in the GK code path in `PieceOverlay` by augmenting the `pieceId` passed to the renderer when `isGK` is true.

---

### IN-02: `attackingTeam` prop in `PieceOverlay` is permanently discarded

**File:** `packages/client/src/components/PieceOverlay.tsx:123`

**Issue:** `void attackingTeam;` at line 123 explicitly discards the prop value. The comment acknowledges direction is derived from `piece.teamId` instead. The prop exists in `Props`, is passed from HexGrid, and participates in the TypeScript interface — but produces no effect on any output path.

**Recommendation:** Remove `attackingTeam` from `Props` until it is needed. If retained for future overrides (per the comment), document its placeholder status explicitly and suppress lint warnings with a directed comment.

---

### IN-03: `v-stripe` tile bottom half produces a 12px background-only gap between V-rows

**File:** `packages/client/src/styles/uniformStyles.tsx:201-218`

**Issue:** The 24×24 `v-stripe` tile places V-polygons only in the top 12px (y=0 to y=12). The bottom half (y=12 to y=24) contains only the `secondary1` background rect. When the tile repeats vertically, each row of V-shapes is separated by a 12px `secondary1` band. This produces separated V-shapes rather than continuous chevrons.

This matches the polygon coordinates specified in the UI-SPEC at `20-UI-SPEC.md:306-308`, so the implementation is spec-compliant. However, the visual output is a "spaced V" pattern, not seamless chevrons. If seamless chevrons are the intended design, the tile should cover y=12 to y=24 with two inverted V polygons that form the apex of the next row.

**Recommendation:** Confirm the intended visual with the product owner. If seamless chevrons are needed, add bottom-half polygons:
```svg
<polygon points="0,12 4,12 0,24" fill={palette.primary} />
<polygon points="20,12 24,12 24,24" fill={palette.primary} />
<!-- and adjust to form full connected chevrons -->
```

---

### IN-04: `fade` mid-stop uses `stopOpacity` creating a transparency blend, not a colour blend

**File:** `packages/client/src/styles/uniformStyles.tsx:288`

**Issue:** The fade gradient middle stop at line 288 is:
```tsx
<stop offset="50%" stopColor={palette.primary} stopOpacity={0.5} />
```
This renders 50% transparent `primary` over the SVG background, not a 50% interpolation between `primary` and `secondary1`. The visual result depends on what is behind the piece — against the green pitch background, the mid-stop will be a washed-out primary blend rather than a true colour blend. The description "Gradient fade from primary to secondary colour" implies a direct colour transition.

This matches the UI-SPEC geometry at `20-UI-SPEC.md:258-264`, so the implementation is spec-compliant.

**Recommendation:** If a true primary→secondary1 colour blend is desired, remove the middle stop and let SVG interpolate linearly:
```tsx
<stop offset="0%"   stopColor={palette.primary} />
<stop offset="100%" stopColor={palette.secondary1} />
```
Alternatively, keep the mid-stop but use a colour value interpolated between primary and secondary1 rather than opacity-mixing.

---

## Structural Findings (fallow)

No structural pre-pass was provided for this phase.

---

_Reviewed: 2026-07-04_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
