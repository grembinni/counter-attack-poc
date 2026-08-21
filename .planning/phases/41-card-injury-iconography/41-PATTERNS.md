# Phase 41: Card & Injury Iconography - Pattern Map

**Mapped:** 2026-08-21
**Files analyzed:** 7 (1 new component + 1 new test file + 5 modified)
**Analogs found:** 7 / 7 (all patterns already exist in-codebase; this is a pure extraction/consolidation phase, not new-design work)

## File Classification

| New/Modified File                                                                                                                                          | Role                                                        | Data Flow                                                       | Closest Analog                                                                                                                                                | Match Quality                                                                                                             |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- | --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `packages/client/src/components/CardInjuryBadge.tsx` (NEW)                                                                                                 | component (presentational glyph)                            | transform (derive glyph from `PlayerPiece`/`BenchEntry` fields) | `packages/client/src/components/PieceOverlay.tsx` (badge IIFE, lines 233-292) + `PlayerStatsPanel.tsx` (`MiniTokenBadge`, lines 40-106)                       | exact — geometry extracted verbatim from PieceOverlay, standalone-SVG-in-DOM shape extracted verbatim from MiniTokenBadge |
| `packages/client/src/components/CardInjuryBadge.test.tsx` (NEW)                                                                                            | test                                                        | unit                                                            | `packages/client/src/components/PieceOverlay.test.tsx` (badge assertions ~lines 274-345)                                                                      | exact — same `data-testid`/`data-card` assertion style                                                                    |
| `packages/client/src/components/PieceOverlay.tsx` (MODIFIED)                                                                                               | component (SVG token overlay)                               | request-response (renders from live `GameState.pieces`)         | itself (refactor target)                                                                                                                                      | exact — swap inline IIFE for `<CardInjuryBadgeGroup>` import, same output                                                 |
| `packages/client/src/components/PlayerStatsPanel.tsx` (MODIFIED)                                                                                           | component (scoreboard card)                                 | request-response                                                | itself (refactor target); shares header-row shape with `LineupAssignmentScreen.tsx`                                                                           | exact                                                                                                                     |
| `packages/client/src/components/LineupAssignmentScreen.tsx` (MODIFIED — `LineupStatCard`, ~lines 232-260, cardColor derivation ~line 455)                  | component (roster/lineup card)                              | request-response                                                | `PlayerStatsPanel.tsx` (identical header-row/chip shape, explicitly noted in source comment)                                                                  | exact                                                                                                                     |
| `packages/client/src/components/DraftPackCarousel.tsx` (MODIFIED — `DraftCardBody`, lines 77-127)                                                          | component (bench/draft card, shared by `BenchCarousel.tsx`) | request-response                                                | `LineupAssignmentScreen.tsx`'s `LineupStatCard` (near-identical cardHeader/cardMeta markup, per source comment "identical to LineupStatCard")                 | exact (markup) / role-match (new prop plumbing)                                                                           |
| `packages/client/src/components/BenchCarousel.tsx` (MODIFIED — thread `cardColor`/`injuryCount` props through to `DraftCardBody`)                          | component (bench carousel, prop-threading only)             | request-response                                                | itself — existing `redCardedPlayerIds`/`unavailablePlayerIds` prop-threading pattern (lines 39, 62, 111, 176-183) is the template for the new props           | exact                                                                                                                     |
| `packages/shared/src/types.ts` (MODIFIED — extend `BenchEntry`, lines 105-117)                                                                             | model (shared type)                                         | CRUD (data model extension)                                     | `PlayerPiece`'s existing `yellowCards?`/`injuryCount?` optional-field convention (same file, lines ~14-87)                                                    | exact — same file, same optional-field idiom                                                                              |
| `packages/server/src/gameEngine.ts` (MODIFIED — 2 call sites: `relocateRedCardedToBench` ~line 784-788, `applySubstitution` bench-rewrite ~line 3130-3136) | service (game engine, bench-entry construction)             | event-driven (booking/injury/substitution resolution)           | itself — the two existing `BenchEntry` object-literal construction sites are their own analog; both already have the source `PlayerPiece`/`outPiece` in scope | exact                                                                                                                     |

## Pattern Assignments

### `packages/client/src/components/CardInjuryBadge.tsx` (NEW component)

**Primary analog:** `packages/client/src/components/PieceOverlay.tsx` lines 233-292 (glyph geometry, verbatim source of truth per D-01) + `packages/client/src/components/PlayerStatsPanel.tsx` lines 40-106 (`MiniTokenBadge`, standalone-svg-in-DOM shape)

**Glyph geometry to extract verbatim** (`PieceOverlay.tsx:237-289`):

```typescript
const cardColor: 'yellow' | 'red' | null =
  piece.redCarded === true ? 'red' : (piece.yellowCards ?? 0) > 0 ? 'yellow' : null;
const hasInjury = (piece.injuryCount ?? 0) > 0;
const cardWidth = badgeR * 1.5;
const cardHeight = badgeR * 2;
const barLength = badgeR * 1.8;
const barThickness = badgeR * 0.6;
// card rect:
<rect data-testid="piece-card-badge" data-card={cardColor}
  x={badgeCx - cardWidth / 2} y={badgeCy - cardHeight / 2} width={cardWidth} height={cardHeight}
  rx={1.5} fill={cardColor === 'red' ? 'var(--color-card-red)' : 'var(--color-card-yellow)'}
  stroke="rgba(0,0,0,0.5)" strokeWidth={1} pointerEvents="none" />
// injury cross (two overlapping rects):
<g data-testid="piece-injury-badge" pointerEvents="none">
  <rect x={badgeCx - barLength / 2} y={badgeCy - barThickness / 2} width={barLength} height={barThickness}
    rx={1} fill="var(--color-text-inverse)" stroke="rgba(0,0,0,0.5)" strokeWidth={0.75} />
  <rect x={badgeCx - barThickness / 2} y={badgeCy - barLength / 2} width={barThickness} height={barLength}
    rx={1} fill="var(--color-text-inverse)" stroke="rgba(0,0,0,0.5)" strokeWidth={0.75} />
</g>
```

**Standalone-SVG-in-DOM wrapper shape to mirror** (`PlayerStatsPanel.tsx:51`):

```typescript
return (
  <svg width={20} height={20} viewBox="0 0 20 20" className={styles.tokenBadge}>
    {/* own coordinate space, no dependency on a parent <svg> root */}
  </svg>
);
```

**Component shape (locked by UI-SPEC.md):** one module, two named exports — `CardInjuryBadgeGroup` (raw `<g>`/`<rect>` primitives composing into a parent `<svg>`, used by `PieceOverlay.tsx`) and `CardInjuryBadge` (self-contained `<svg viewBox>` wrapper, used by the 3 DOM-context surfaces) — plus co-located, exported `cardColorFor(piece)`. D-04: on the standalone variant, card and injury badges render **side by side** (two x-offset anchor points within one viewBox), not overlapping like the pitch token.

**Accessibility requirement (UI-SPEC.md, not optional):** every badge needs a `title`/`aria-label`: `"Yellow card"` / `"Red card"` / `"Injured"` / `"Injured ×2"` (label only — the visual glyph itself stays binary per Injury count rule below).

**Injury count rule:** binary glyph (present/absent) — do not visually distinguish `injuryCount === 1` from `>= 2`; recover the distinction only in the `aria-label` text.

**Color tokens to reuse (no new hex values):** `var(--color-card-yellow)` (`tokens.css:130`), `var(--color-card-red)` (`tokens.css:131`), `var(--color-text-inverse)` (`tokens.css:36`), border `rgba(0,0,0,0.5)`.

---

### `packages/client/src/components/PieceOverlay.tsx` (MODIFIED)

**Analog:** itself — replace the inline IIFE at lines 233-292 with an import of `CardInjuryBadgeGroup` from `./CardInjuryBadge.js`, passing `cx={cx - dotOffsetX}`, `cy={cy - dotOffsetY}`, `r={PIECE_RADIUS * 0.59}`, `cardColor={cardColorFor(piece)}`, `injuryCount={piece.injuryCount ?? 0}`. D-03: this surface keeps its existing corner-anchor position (negated ball-dot offset) — position logic is untouched, only the glyph-drawing internals move to the shared module.

**Import pattern already in file:**

```typescript
// existing imports at top of PieceOverlay.tsx — add:
import { CardInjuryBadgeGroup, cardColorFor } from './CardInjuryBadge.js';
```

---

### `packages/client/src/components/PlayerStatsPanel.tsx` (MODIFIED)

**Analog:** itself, lines 142-171 (`playerMeta` div — the "after flag/role/jersey#" anchor point per D-02)

**Existing anchor point to replace in place:**

```typescript
<div className={styles.playerMeta}>
  <NationFlag nationality={piece.nationality} size={20} />
  <span className={styles.roleChip}>{piece.role}</span>
  <span className={styles.jerseyNum}>#{piece.number}</span>
  {/* REPLACE the two IIFE-derived cardChip/injuryChip <span> blocks (lines 149-170)
      with <CardInjuryBadge cardColor={cardColorFor(piece)} injuryCount={piece.injuryCount ?? 0} /> */}
</div>
```

**Dead code to remove after swap:** `cardChip`/`injuryChip` CSS classes in `PlayerStatsPanel.module.css` (verify via `knip`/grep post-implementation per RESEARCH.md).

**Test rewrite needed (Pitfall 1):** `PlayerStatsPanel.test.tsx:161,168` assert literal `.textContent` `'INJ'`/`'INJ ×2'` — these must be replaced with glyph-presence/`aria-label` assertions, not left passing unchanged. The `data-card="yellow"|"red"` attribute assertions ARE preservable if the new component keeps the same `data-testid`/`data-card` contract.

---

### `packages/client/src/components/LineupAssignmentScreen.tsx` (MODIFIED — `LineupStatCard`)

**Analog:** `PlayerStatsPanel.tsx` (source comment at line 246-248 explicitly states "identical classes/copy" between the two surfaces — this is the closest possible analog, same codebase, same pattern already duplicated on purpose)

**Existing header row to replace in place** (lines 236-260):

```typescript
<div className={styles.cardHeader}>
  <span className={styles.cardName}>{player.firstName} {player.lastName}</span>
  <div className={styles.cardMeta}>
    <NationFlag nationality={player.nationality} size={14} />
    <span className={styles.cardRole}>{player.role}</span>
    <span className={styles.cardNum}>#{displayNumber}</span>
    {isGK && !allowGKDrag && <span className={styles.lockedBadge}>LOCK</span>}
    {/* REPLACE cardColor/injuryCount <span> blocks (lines 249-258) with
        <CardInjuryBadge cardColor={cardColor} injuryCount={injuryCount ?? 0} /> */}
  </div>
</div>
```

**cardColor derivation to replace with shared import** (line 455):

```typescript
// existing (to be removed, replaced by import { cardColorFor } from './CardInjuryBadge.js'):
piece.redCarded === true ? 'red' : (piece.yellowCards ?? 0) > 0 ? 'yellow' : null;
```

**Test rewrite needed (Pitfall 1):** `LineupAssignmentScreen.test.tsx:742,746` — same `'INJ'`/`'INJ ×2'` `.textContent` assertions to rewrite.

---

### `packages/client/src/components/DraftPackCarousel.tsx` (MODIFIED — `DraftCardBody`, lines 77-127)

**Analog:** `LineupAssignmentScreen.tsx`'s `LineupStatCard` (source comment at line 71-72 explicitly: "mirrors LineupStatCard's ... markup exactly")

**Existing header row (lines 105-127) — new glyph badge inserts after `#{jerseyNumber}`, before the existing status badge:**

```typescript
<div className={styles.cardMeta}>
  <NationFlag nationality={card.nationality} size={14} />
  <span className={styles.cardRole}>{card.role}</span>
  {jerseyNumber !== undefined && <span className={styles.cardNum}>#{jerseyNumber}</span>}
  {/* NEW: <CardInjuryBadge cardColor={cardColor} injuryCount={injuryCount ?? 0} /> goes HERE */}
  {redCarded === true ? (
    <span className={styles.redCardBadge} data-testid="bench-red-card-badge">RED CARD</span>
  ) : (
    unavailable === true && <span className={styles.outBadge} data-testid="bench-out-badge">OUT</span>
  )}
</div>
```

**New props needed on `DraftCardBodyProps`** (mirror existing `unavailable?`/`redCarded?: boolean` prop style at lines 63-67):

```typescript
cardColor?: 'yellow' | 'red' | null;
injuryCount?: number;
```

**Coexistence rule (UI-SPEC.md, locked):** the new glyph badge does NOT replace the existing `RED CARD`/`OUT` text badge — both render, glyph first (in the shared anchor position), status text trailing.

---

### `packages/client/src/components/BenchCarousel.tsx` (MODIFIED — prop threading)

**Analog:** itself — existing `redCardedPlayerIds`/`unavailablePlayerIds` threading pattern is the template

**Existing pattern to mirror** (lines 39, 62, 111, 176-183):

```typescript
// prop declaration:
redCardedPlayerIds?: readonly string[];
// destructure:
redCardedPlayerIds,
// usage guard:
if (unavailablePlayerIds?.includes(cardId) || redCardedPlayerIds?.includes(cardId)) return;
// passed through to DraftCardBody:
<DraftCardBody
  ...
  redCarded={redCardedPlayerIds?.includes(card.id) ?? false}
/>
```

New work: thread a `benchEntries: readonly BenchEntry[]` (or a derived `cardColor`/`injuryCount` lookup map keyed by playerId) through in the same style, deriving `cardColor`/`injuryCount` per card from the (extended) `BenchEntry` fields — `status === 'redCarded'` implies `cardColor: 'red'` with zero new data; `yellowCards`/`injuryCount` come from the new optional `BenchEntry` fields below.

---

### `packages/shared/src/types.ts` (MODIFIED — extend `BenchEntry`, lines 105-117)

**Analog:** `PlayerPiece`'s existing optional-field convention (same file) — e.g. `yellowCards?: 0 | 1 | 2`, `injuryCount?: number` already exist on `PlayerPiece`; extend `BenchEntry` the same way.

**Current type (lines 105-117):**

```typescript
export type BenchEntryStatus = 'available' | 'subbedOut' | 'redCarded';

export type BenchEntry = {
  playerId: string;
  jerseyNumber: number;
  status: BenchEntryStatus;
};
```

**Extension (additive, per UI-SPEC.md's locked Option 1 decision):**

```typescript
export type BenchEntry = {
  playerId: string;
  jerseyNumber: number;
  status: BenchEntryStatus;
  /** Phase 41 (ICON-03): carried forward from the departing PlayerPiece's live
   * yellowCards/injuryCount at the moment they left the pitch (red-carded or
   * subbed off), so the bench card can show the same glyph as every other surface. */
  yellowCards?: 0 | 1 | 2;
  injuryCount?: number;
};
```

---

### `packages/server/src/gameEngine.ts` (MODIFIED — 2 `BenchEntry` construction sites)

**Analog:** itself — both call sites already have the source `PlayerPiece` in scope; this is a copy-through, not new logic.

**Site 1 — `relocateRedCardedToBench` (lines 784-788):**

```typescript
// current:
const newEntry: BenchEntry = {
  playerId: piece.playerId,
  jerseyNumber: piece.number,
  status: 'redCarded',
};
// extend to:
const newEntry: BenchEntry = {
  playerId: piece.playerId,
  jerseyNumber: piece.number,
  status: 'redCarded',
  yellowCards: piece.yellowCards,
  injuryCount: piece.injuryCount,
};
```

**Site 2 — `applySubstitution` bench-entry rewrite (lines 3130-3136):**

```typescript
// current:
const newTeamBench: BenchEntry[] = benchEntries.map((e) =>
  e.playerId === inPlayerId
    ? {
        playerId: outPiece.playerId!,
        jerseyNumber: benchEntry.jerseyNumber,
        status: 'subbedOut' as const,
      }
    : e
);
// extend the object literal with:
        yellowCards: outPiece.yellowCards,
        injuryCount: outPiece.injuryCount,
```

**Note:** flag this file as its own explicit plan task per UI-SPEC.md — it is a `packages/server` change, not client-only, even though it's small and additive.

## Shared Patterns

### `cardColorFor` derivation (co-located, re-exported)

**Source pattern (existing precedent for co-located-then-reused constants):** `packages/client/src/components/PlayerStatsPanel.tsx:17` (`STAT_LABELS`, re-imported at `LineupAssignmentScreen.tsx:34` via `import { STAT_LABELS } from './PlayerStatsPanel.js';`)
**Apply to:** put `cardColorFor(piece)` in the new `CardInjuryBadge.tsx` module itself (not `PlayerStatsPanel.tsx`) and have all 4 consumers (`PieceOverlay.tsx`, `PlayerStatsPanel.tsx`, `LineupAssignmentScreen.tsx`, `DraftPackCarousel.tsx`/`BenchCarousel.tsx`) import it from there.

```typescript
export type CardColor = 'yellow' | 'red' | null;
export function cardColorFor(piece: Pick<PlayerPiece, 'redCarded' | 'yellowCards'>): CardColor {
  return piece.redCarded === true ? 'red' : (piece.yellowCards ?? 0) > 0 ? 'yellow' : null;
}
```

### "After jersey number" header-row anchor point (D-02)

**Source:** `PlayerStatsPanel.tsx:142-171` (`playerMeta` div) — `NationFlag` → role chip → `#{number}` → [badge inserts here]. Same relative anchor point in `LineupAssignmentScreen.tsx` (`cardMeta`, lines 236-260) and `DraftPackCarousel.tsx` (`cardMeta`, lines 109-126).
**Apply to:** `PlayerStatsPanel.tsx`, `LineupAssignmentScreen.tsx`'s `LineupStatCard`, `DraftPackCarousel.tsx`'s `DraftCardBody`.

### Color tokens (no new values)

**Source:** `packages/client/src/styles/tokens.css` lines 36 (`--color-text-inverse`), 130 (`--color-card-yellow`), 131 (`--color-card-red`), 139 (`--color-card-badge-border`).
**Apply to:** all badge fills/strokes in `CardInjuryBadge.tsx`.

## No Analog Found

None. Every target file has a strong, verified in-codebase analog — this phase is a pure extraction/consolidation of already-shipped patterns (per RESEARCH.md's framing), not new-design work requiring external reference.

## Metadata

**Analog search scope:** `packages/client/src/components/`, `packages/shared/src/types.ts`, `packages/server/src/gameEngine.ts` (targeted grep + direct reads, no broader search needed — all analogs were already identified and verified by RESEARCH.md and confirmed by direct reads this session)
**Files scanned:** 7 target files + `PieceOverlay.tsx` (badge source), `PlayerStatsPanel.tsx` (MiniTokenBadge/header pattern), `LineupAssignmentScreen.tsx` (header/derivation), `DraftPackCarousel.tsx` (DraftCardBody), `BenchCarousel.tsx` (prop-threading pattern), `types.ts` (BenchEntry), `gameEngine.ts` (2 construction sites)
**Pattern extraction date:** 2026-08-21
