# Phase 41: Card & Injury Iconography - Research

**Researched:** 2026-08-21
**Domain:** React/SVG component consolidation in an existing client-only rendering layer (no server/engine changes expected, with one flagged exception — see Critical Finding below)
**Confidence:** HIGH

## Summary

This is a rendering-consolidation phase with a well-scoped, low-risk technical shape: extract one shared presentational component (`CardInjuryBadge.tsx`) from the already-correct, already-tested SVG glyph logic in `PieceOverlay.tsx`, and use it to replace two duplicated text-chip implementations (`PlayerStatsPanel.tsx`, `LineupAssignmentScreen.tsx`'s `LineupStatCard`) plus add net-new iconography to a fourth surface (`BenchCarousel.tsx`/`DraftPackCarousel.tsx`'s `DraftCardBody`). No new npm packages, no new game logic, no new `GameState` fields on the pitch/scoreboard/roster path.

The one piece of this phase's scope CONTEXT.md's phase boundary did not fully anticipate: the bench's underlying `BenchEntry` data model (`packages/shared/src/types.ts`) does not carry `yellowCards`/`injuryCount` at all — only a `status: 'available' | 'subbedOut' | 'redCarded'` enum. A `redCarded` bench entry can derive a red-card glyph trivially from `status` alone (zero new plumbing). But a `subbedOut` player's yellow-card/injury history at the moment they left the pitch is **not currently captured anywhere** — the two existing `BenchEntry` construction sites in `gameEngine.ts` have the departing `PlayerPiece`'s `yellowCards`/`injuryCount` in scope but never copy them. This is a small, well-contained, additive gap (2 optional fields on `BenchEntry`, populated at 2 already-identified call sites) — not a blocker, but the planner must explicitly decide whether to close it in this phase or descope bench iconography to red-card-only. See Critical Finding below.

**Primary recommendation:** Extract `PieceOverlay.tsx`'s existing card-rect/injury-cross SVG primitives into `packages/client/src/components/CardInjuryBadge.tsx`, export both a "raw group" version (for composing into an existing `<svg>`, used by `PieceOverlay`) and a "standalone" version (self-contained `<svg viewBox>` wrapper, used by the three DOM-context surfaces) — mirroring the already-proven `MiniTokenBadge` self-contained-`<svg>`-in-DOM pattern already shipped in `PlayerStatsPanel.tsx`. Co-locate the shared `cardColorFor()` derivation function in the same module and export it, mirroring the existing `STAT_LABELS` co-located-then-reused precedent between `PlayerStatsPanel.tsx` and `LineupAssignmentScreen.tsx`.

## Architectural Responsibility Map

| Capability                                                                            | Primary Tier     | Secondary Tier   | Rationale                                                                                                                                                                                                      |
| ------------------------------------------------------------------------------------- | ---------------- | ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Card/injury visual glyph rendering                                                    | Browser / Client | —                | Pure presentational SVG; no server round-trip, no new client state                                                                                                                                             |
| `cardColor`/`injuryCount` derivation from `PlayerPiece`                               | Browser / Client | —                | Already a pure function of already-broadcast `GameState.pieces` fields; stays client-side exactly as today (triplicated today, unified by this phase)                                                          |
| Bench `yellowCards`/`injuryCount` capture at substitution/red-card time (if in scope) | API / Backend    | —                | `BenchEntry` construction happens in `packages/server/src/gameEngine.ts` (`relocateRedCardedToBench`, `applySubstitution`'s bench-entry-rewrite) — a server-side field addition, not a client rendering change |
| Card/injury data delivery to client                                                   | API / Backend    | Browser / Client | Already fully solved — `GameState` broadcasts `pieces[].redCarded/yellowCards/injuryCount` in full on every action (no delta patching); only the bench's separate `BenchEntry` type is the gap                 |

## Standard Stack

No new packages. This phase operates entirely within the already-installed stack (React 18.3.1, TypeScript, inline SVG, CSS Modules) confirmed by `packages/client/package.json` and every sibling component in `packages/client/src/components/`.

### Core

| Library                         | Version                                      | Purpose                         | Why Standard                                                                                                                                                                                                                            |
| ------------------------------- | -------------------------------------------- | ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| React                           | 18.3.1 (pinned, `STATE.md` Decisions Locked) | Component composition           | Already the project's exclusive UI framework                                                                                                                                                                                            |
| Inline SVG (native, no library) | —                                            | Card rect / injury cross glyphs | Project convention — `CLAUDE.md` "What NOT to Use" explicitly excludes Canvas/Phaser/PixiJS/Three.js; every existing badge in this codebase (`PieceOverlay.tsx`, `MiniTokenBadge` in `PlayerStatsPanel.tsx`) is hand-written inline SVG |

### Supporting

None — this phase introduces no new supporting libraries.

### Alternatives Considered

| Instead of                                             | Could Use                                           | Tradeoff                                                                                                                                                                                                                                                                                                                                                                                              |
| ------------------------------------------------------ | --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Extracted React component (`CardInjuryBadge.tsx`)      | Shared SVG `<defs>`/`<symbol>`/`<use>` block        | Rejected — `ARCHITECTURE.md`'s Feature 2 finding, confirmed by direct code read: half the target surfaces (`PlayerStatsPanel.tsx`, `LineupStatCard`, `DraftCardBody`) are not inside an `<svg>` document at all; `url(#id)` cross-document references don't resolve reliably per the project's own Phase 12 decision (cited in `CLAUDE.md`) that `<defs>` must be self-contained per `<svg>` document |
| Two thin wrappers around one shared glyph-drawing core | A single component with an internal `context: 'svg' | 'dom'` prop branch                                                                                                                                                                                                                                                                                                                                                                                    | Either works; this research recommends the "two named exports from one module" shape (see Component Shape below) because it keeps each export's prop surface honest (the SVG-embedded version genuinely needs `cx`/`cy` in parent coordinate space; the standalone version genuinely needs its own `size`) rather than one component silently ignoring props depending on a mode flag |

**Installation:** None required.

**Version verification:** N/A — no new packages. `npm view` / registry checks not applicable to this phase.

## Package Legitimacy Audit

**Not applicable.** This phase installs no external packages. No `package-legitimacy check` run was needed.

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Critical Finding: Bench Card/Injury Data Gap (not fully captured by CONTEXT.md's "rendering-only" framing)

`[VERIFIED: direct code read, packages/shared/src/types.ts:108-117, packages/server/src/gameEngine.ts:773-793,3126-3138]`

CONTEXT.md's phase boundary states: _"`piece.redCarded`, `piece.yellowCards`, and `piece.injuryCount` already exist and are already correctly populated by the Phase 39 fouls/cards/injury engine. This is a rendering-consolidation phase only."_ This is **true for the pitch, scoreboard, and roster/lineup surfaces** (they all read live `PlayerPiece` objects out of `GameState.pieces`, which already carries all three fields correctly). It is **only partially true for the bench surface**:

- `BenchEntry` (`packages/shared/src/types.ts:108-117`) has exactly three fields: `playerId`, `jerseyNumber`, `status: 'available' | 'subbedOut' | 'redCarded'`. It has **no** `yellowCards`/`injuryCount` field.
- A `'redCarded'` bench entry's card-color IS fully derivable without any new plumbing: `status === 'redCarded'` implies `cardColor === 'red'`, by definition (a piece cannot reach `BenchEntry.status='redCarded'` without `PlayerPiece.redCarded === true`). Zero engine changes needed for this case.
- A `'subbedOut'` bench entry has **no backing data at all** for a yellow-card or injury glyph. Confirmed at the two exact construction sites:
  - `relocateRedCardedToBench` (`gameEngine.ts:773-793`) receives the full `piece: PlayerPiece` (which has `yellowCards`/`injuryCount` in scope) but the `newEntry: BenchEntry` object built at line 784-788 only copies `playerId`/`jerseyNumber`/`status: 'redCarded'` — a red-carded player's _injury_ history is silently dropped even though the red-card status itself is preserved.
  - The substitution handler's bench-entry rewrite (`gameEngine.ts:3126-3138`, inside `applySubstitution`) has `outPiece: PlayerPiece` (the departing player, with their live `yellowCards`/`injuryCount`) in scope but the new bench entry at line 3132-3136 only copies `playerId`/`jerseyNumber`/`status: 'subbedOut'` — any yellow card or injury the departing player accumulated before being subbed off is not carried onto their bench card.
- An `'available'` (never-yet-played) bench entry trivially has `cardColor: null, injuryCount: 0` always — a bench player who has never taken the pitch cannot have accumulated either.

**Recommendation for the planner:** Two viable paths, both legitimate — this needs an explicit decision (not left implicit), since it changes whether a server-side task is in scope:

1. **(Recommended, minimal-scope) Extend `BenchEntry` with two new optional fields** — `yellowCards?: 0 | 1 | 2` and `injuryCount?: number` — populated at the two exact call sites identified above by copying `piece.yellowCards`/`piece.injuryCount` (in `relocateRedCardedToBench`) and `outPiece.yellowCards`/`outPiece.injuryCount` (in the substitution bench-rewrite). This is additive (no existing `BenchEntry` construction site breaks, matches the project's `?:` optional-field convention used throughout `types.ts`), touches exactly 2 known call sites in `gameEngine.ts`, and is a "carry forward an already-computed value into a display record" change — closer in kind to "rendering support" than "new game logic," but it IS a `packages/server` change and should be an explicit task in the plan, not silently bundled into the client-only work.
2. **(Fallback, zero-engine-change) Scope bench card iconography to `redCarded`-only** for v1.7 — derive `cardColor: status === 'redCarded' ? 'red' : null` client-side with no new fields, and treat bench injury/yellow-card display as out of scope this phase (documented explicitly, not silently dropped). This still satisfies ICON-03's "first time" framing (the bench genuinely gains iconography it never had) and keeps the phase 100% client-only as CONTEXT.md's boundary describes.

Either path is defensible; this research flags it as a **required planning-time decision**, not a silent default. Given the "no game logic" framing in CONTEXT.md's phase boundary was explicit and deliberate, and the bench is explicitly the newest/least-tested surface, **Option 2 is the lower-risk default recommendation** unless the user/planner confirms Option 1's small server-side addition is acceptable within this phase's scope.

## Architecture Patterns

### System Architecture Diagram

```
GameState.pieces[] (server-broadcast, full snapshot every action)
        │
        │  redCarded / yellowCards / injuryCount fields
        ▼
 ┌─────────────────────────────────────────────────────────────┐
 │  cardColorFor(piece) → 'yellow' | 'red' | null               │
 │  (single shared derivation — replaces 3 duplicated ternaries) │
 └─────────────────────────────────────────────────────────────┘
        │
        ├──────────────┬───────────────────┬─────────────────────┐
        ▼              ▼                   ▼                     ▼
  PieceOverlay    PlayerStatsPanel   LineupAssignmentScreen  BenchCarousel /
  (inside HexGrid  (standalone DOM    LineupStatCard          DraftPackCarousel
  <svg> root)      card, scoreboard)  (standalone DOM card,   DraftCardBody
                                       roster/mid-match)       (standalone DOM card)
        │              │                   │                     │
        ▼              ▼                   ▼                     ▼
  <CardInjuryBadgeGroup   <CardInjuryBadge standalone>  <CardInjuryBadge standalone>  <CardInjuryBadge standalone>
  cx cy r cardColor        size cardColor injuryCount    size cardColor injuryCount    size cardColor injuryCount
  injuryCount>              (own <svg viewBox> wrapper)   (own <svg viewBox> wrapper)   (own <svg viewBox> wrapper,
  (composes directly                                                                     alongside existing RED CARD/
  into parent <svg>,                                                                     OUT status text badge —
  same corner-anchor                                                                     see Open Questions)
  geometry as today)
```

A reader tracing "how does a red card show up" follows: server sets `piece.redCarded = true` in `BOOKING_CHECK` resolution → full-state broadcast → client Zustand store replaces `gameState` wholesale → every one of the 4 consuming components independently re-derives `cardColorFor(piece)` from the same broadcast `piece` object (or, for the bench, from `BenchEntry.status`/new optional fields per the Critical Finding above) → renders through the one shared `CardInjuryBadge` component.

### Recommended Project Structure

No new directories. `packages/client/src/components/` is confirmed flat (no `shared/` subdirectory exists today — verified via directory listing: 39 sibling `.tsx` files, all direct children). The new component belongs at the same level as `PieceOverlay.tsx`:

```
packages/client/src/components/
├── CardInjuryBadge.tsx        # NEW — shared glyph component + cardColorFor()
├── CardInjuryBadge.test.tsx   # NEW
├── PieceOverlay.tsx           # MODIFIED — imports CardInjuryBadgeGroup, removes inline IIFE
├── PlayerStatsPanel.tsx       # MODIFIED — imports CardInjuryBadge (standalone), removes cardChip/injuryChip spans
├── LineupAssignmentScreen.tsx # MODIFIED — LineupStatCard imports CardInjuryBadge (standalone)
├── BenchCarousel.tsx          # MODIFIED — threads cardColor/injuryCount props through to DraftCardBody
└── DraftPackCarousel.tsx      # MODIFIED — DraftCardBody imports CardInjuryBadge (standalone), renders alongside existing RED CARD/OUT text badge
```

### Pattern 1: Dual-export shared glyph component (SVG-embedded + standalone)

**What:** One module exports (a) a raw fragment/group for composing directly into an existing `<svg>` document's coordinate space, and (b) a small self-contained `<svg viewBox>`-wrapped version for use in plain DOM contexts.

**When to use:** Any visual element (like this badge) that must render identically both inside and outside an existing `<svg>` root, in a codebase where cross-document SVG `<defs>`/`<use>` is already established as unreliable (Phase 12 decision).

**Precedent already in this codebase** — `MiniTokenBadge` in `packages/client/src/components/PlayerStatsPanel.tsx:40-106` is a directly analogous, already-shipped, already-tested example: a small self-contained `<svg width={20} height={20} viewBox="0 0 20 20">` with its own `<defs>`/`<pattern>`, rendered standalone inside a plain DOM `<div className={styles.cardHeader}>`. This is the exact shape to replicate for `CardInjuryBadge`'s standalone export — not a novel pattern, an established one.

**Example:**

```typescript
// Source: extracted verbatim from packages/client/src/components/PieceOverlay.tsx:233-292
// (existing, already-tested badge geometry — NOT a redesign, a relocation + parameterization)

export type CardColor = 'yellow' | 'red' | null;

/** Single shared derivation — replaces the identical ternary duplicated in
 * PieceOverlay.tsx:238, PlayerStatsPanel.tsx:151, LineupAssignmentScreen.tsx:455. */
export function cardColorFor(piece: Pick<PlayerPiece, 'redCarded' | 'yellowCards'>): CardColor {
  return piece.redCarded === true ? 'red' : (piece.yellowCards ?? 0) > 0 ? 'yellow' : null;
}

/** Raw <g>/primitives — composes into a PARENT <svg>'s coordinate space.
 * Used by PieceOverlay, which already has cx/cy/r in its own local geometry.
 * Preserves the EXACT existing pitch-token visual output (card rect and
 * injury cross layered/overlapping at the same cx/cy — D-03: unchanged). */
export function CardInjuryBadgeGroup({
  cx, cy, r, cardColor, injuryCount,
}: { cx: number; cy: number; r: number; cardColor: CardColor; injuryCount: number }) {
  const hasInjury = injuryCount > 0;
  const cardWidth = r * 1.5, cardHeight = r * 2;
  const barLength = r * 1.8, barThickness = r * 0.6;
  return (
    <>
      {cardColor && (
        <rect data-testid="piece-card-badge" data-card={cardColor}
          x={cx - cardWidth / 2} y={cy - cardHeight / 2} width={cardWidth} height={cardHeight}
          rx={1.5} fill={cardColor === 'red' ? 'var(--color-card-red)' : 'var(--color-card-yellow)'}
          stroke="rgba(0,0,0,0.5)" strokeWidth={1} pointerEvents="none" />
      )}
      {hasInjury && (
        <g data-testid="piece-injury-badge" pointerEvents="none">
          <rect x={cx - barLength / 2} y={cy - barThickness / 2} width={barLength} height={barThickness}
            rx={1} fill="var(--color-text-inverse)" stroke="rgba(0,0,0,0.5)" strokeWidth={0.75} />
          <rect x={cx - barThickness / 2} y={cy - barLength / 2} width={barThickness} height={barLength}
            rx={1} fill="var(--color-text-inverse)" stroke="rgba(0,0,0,0.5)" strokeWidth={0.75} />
        </g>
      )}
    </>
  );
}

/** Standalone, self-contained <svg> — used in the three DOM-context surfaces
 * (PlayerStatsPanel, LineupStatCard, DraftCardBody). Mirrors MiniTokenBadge's
 * pattern (PlayerStatsPanel.tsx:40-106): own viewBox, own coordinate space,
 * no dependency on a parent <svg> root.
 * D-04: card and injury badges render SIDE BY SIDE here (not overlapping,
 * unlike the pitch token's single-corner layering) — two adjacent anchor
 * points within one small viewBox rather than one shared cx/cy. */
export function CardInjuryBadge({
  cardColor, injuryCount, size = 16,
}: { cardColor: CardColor; injuryCount: number; size?: number }) {
  const hasInjury = injuryCount > 0;
  if (!cardColor && !hasInjury) return null;
  const r = size * 0.4;
  const bothPresent = cardColor !== null && hasInjury;
  const cardCx = bothPresent ? size * 0.28 : size * 0.5;
  const injuryCx = bothPresent ? size * 0.72 : size * 0.5;
  const viewW = bothPresent ? size * 1.5 : size;
  return (
    <svg width={viewW} height={size} viewBox={`0 0 ${viewW} ${size}`} style={{ flexShrink: 0 }}>
      {cardColor && <CardInjuryBadgeGroup cx={cardCx} cy={size / 2} r={r} cardColor={cardColor} injuryCount={0} />}
      {hasInjury && <CardInjuryBadgeGroup cx={injuryCx} cy={size / 2} r={r} cardColor={null} injuryCount={injuryCount} />}
    </svg>
  );
}
```

This example is illustrative of the shape (dual export, extracted glyph geometry, side-by-side vs. overlapping layout modes) — exact sizing constants are implementation detail per CONTEXT.md's Claude's Discretion note, not prescribed here.

### Pattern 2: Co-located derivation function, re-exported (existing project precedent)

**What:** A small pure derivation/constant lives in the module most central to its use, and sibling components import it rather than re-deriving it locally.
**When to use:** Exactly this phase's `cardColorFor` extraction.
**Example (existing precedent, not hypothetical):**

```typescript
// Source: packages/client/src/components/PlayerStatsPanel.tsx:17 (STAT_LABELS)
// re-imported at packages/client/src/components/LineupAssignmentScreen.tsx:34
export const STAT_LABELS: Array<[keyof PlayerPiece, string, string]> = [
  /* ... */
];
// LineupAssignmentScreen.tsx: import { STAT_LABELS } from './PlayerStatsPanel.js';
```

Recommendation: put `cardColorFor` in `CardInjuryBadge.tsx` itself (not `PlayerStatsPanel.tsx`, since the badge component is the more natural single owner of "everything about how card/injury status is computed and drawn") and have all 4 consumers import it from there.

### Anti-Patterns to Avoid

- **Re-deriving `cardColor` locally in each of the 4 consumers:** This is the exact bug (Pitfall 3 in `PITFALLS.md`) that created the current triplication. The shared component's module must be the ONLY place the ternary exists after this phase — verify via a post-implementation grep for `redCarded === true ?` returning zero matches outside `CardInjuryBadge.tsx`.
- **A single component with an internal `context: 'svg' | 'dom'` string prop branch:** Works, but two named exports (`CardInjuryBadgeGroup` for SVG-embedded, `CardInjuryBadge` for standalone) keeps each one's actual required props honest and is easier to typecheck/test in isolation — no prop is ever silently ignored based on a mode flag.
- **Inventing a "combined" glyph for simultaneous card+injury:** D-04 explicitly rejects this — both badges always render as two distinct, independently visible glyphs (side by side on name-row surfaces, layered-but-shape-distinguished on the pitch token), never merged into one icon.

## Don't Hand-Roll

| Problem                             | Don't Build                                 | Use Instead                                                | Why                                                                                                                                                                                 |
| ----------------------------------- | ------------------------------------------- | ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cross-`<svg>`-document icon sharing | A shared `<defs>`/`<symbol>`/`<use>` block  | The dual-export component pattern above                    | Project's own Phase 12 decision already established `<defs>` must be self-contained per document in this codebase's rendering setup — this is settled, not open for reconsideration |
| Card-color precedence logic         | A new/different red-vs-yellow priority rule | The existing `cardColorFor` ternary (red wins over yellow) | Already correct, already tested at 3 sites (`PieceOverlay.test.tsx:286-298`, `PlayerStatsPanel.test.tsx:149`, `LineupAssignmentScreen.test.tsx:732-734`) — extraction, not redesign |

**Key insight:** Every piece of visual logic this phase needs already exists, correctly, in `PieceOverlay.tsx`. The entire phase is extraction + parameterization + replacement, not new design work — treat any deviation from the existing pitch-token glyph shapes as a red flag requiring justification.

## Common Pitfalls

### Pitfall 1: Existing tests assert literal chip TEXT ("INJ", "INJ ×2", "YELLOW", "RED") that D-01 explicitly eliminates

**What goes wrong:** `[VERIFIED: direct test-file read]` Three existing test assertions check `.textContent` for literal strings that a shape+color glyph has no equivalent for:

- `PlayerStatsPanel.test.tsx:161`: `expect(screen.getByTestId('stats-injury-chip').textContent).toBe('INJ')`
- `PlayerStatsPanel.test.tsx:168`: `.toBe('INJ ×2')`
- `LineupAssignmentScreen.test.tsx:742,746`: same `'INJ'`/`'INJ ×2'` assertions on the roster card
- (The `data-card="yellow"`/`data-card="red"` attribute assertions, by contrast, ARE preservable unchanged if the new component keeps the same `data-testid`/`data-card` attribute contract — see Pitfall 3 in `PITFALLS.md`.)

**Why it happens:** These tests were written when the visual treatment WAS literal text; D-01 is an explicit visual-language change (text chip → shape+color glyph), not a pure refactor, so some existing assertions are testing a design that D-01 deliberately replaces.

**How to avoid:** These specific `.textContent` assertions must be REWRITTEN (not "kept passing unchanged" the way `data-card` attribute tests can be) — replace with an `injuryCount` numeric prop/attribute assertion on the new glyph component (e.g., a `data-injury-count` attribute, or simply asserting the glyph element count matches expected badge count, mirroring `PieceOverlay.test.tsx:300-312`'s existing pattern of counting `piece-injury-badge` elements rather than reading text). The `stats-card-chip`/`stats-injury-chip` `data-testid` names can be retained on the new glyph wrapper elements for continuity, but the underlying assertions checking `.textContent` need updating in the same commit as the component swap.

**Warning signs:** A plan that claims "zero test changes needed" for `PlayerStatsPanel.test.tsx`/`LineupAssignmentScreen.test.tsx` — this is provably false per the line numbers above.

### Pitfall 2: Bench iconography has no backing data for non-red-card statuses (see Critical Finding above)

Already covered in detail above — repeated here per the pitfall-catalogue convention. **Phase to address:** this phase (Feature 2). **Verification:** if Option 1 (extend `BenchEntry`) is chosen, a new server-side test asserting a subbed-off player's `yellowCards`/`injuryCount` survive onto their bench entry; if Option 2 (redCarded-only) is chosen, an explicit code comment/doc note (not silent omission) stating bench yellow/injury display is descoped for non-red-card statuses this phase.

### Pitfall 3: `DraftCardBody`'s existing RED CARD / OUT text badge and the new glyph badge encode different, overlapping semantics

**What goes wrong:** `[VERIFIED: DraftPackCarousel.tsx:113-125]` The bench card already renders a `RED CARD`/`OUT` text badge sourced from `BenchEntryStatus` (a roster-availability concept: subbed out vs. sent off), which is semantically distinct from `cardColor`/`injuryCount` (a disciplinary/fitness concept). For a `redCarded` bench entry, BOTH will be simultaneously true (`status === 'redCarded'` AND `cardColor === 'red'`) — rendering both the existing "RED CARD" text badge AND a new red rect glyph in the same small card risks visual redundancy/clutter on the bench's already-compact header row (`NationFlag · role · #num · [status badge] · [card/injury glyph]`).

**Why it happens:** These two badge systems were designed independently (`BenchEntryStatus` in Phase 40, the card/injury glyph language in Phase 39/pre-existing) and this phase is the first time they need to coexist on the same small card.

**How to avoid:** This is a genuine design decision the planner should make explicit (see Open Questions) — e.g., keep both (they answer different questions: "why is this player unavailable" vs. "what's their disciplinary/fitness status"), or let the new glyph badge fully replace the "RED CARD" text badge specifically (since `status === 'redCarded'` already implies `cardColor === 'red'`, the glyph alone communicates it) while keeping "OUT" text for `subbedOut` (which has no glyph equivalent). Do not silently decide this without documenting the choice — CONTEXT.md did not resolve it.

**Phase to address:** this phase. **Verification:** a `BenchCarousel`/`DraftPackCarousel` test asserting the exact badge set rendered for each of the 3 `BenchEntryStatus` values crossed with card/injury presence.

## Code Examples

Verified patterns from the existing (this-session-read) codebase — not external sources, since this phase's entire technical surface is internal extraction/consolidation:

### Existing self-contained standalone-SVG-in-DOM precedent (the pattern to replicate)

```typescript
// Source: packages/client/src/components/PlayerStatsPanel.tsx:50-51 (MiniTokenBadge)
return (
  <svg width={20} height={20} viewBox="0 0 20 20" className={styles.tokenBadge}>
    {/* own <defs>, own coordinate space, rendered directly inside a plain <div> */}
  </svg>
);
```

### Existing "after flag" badge anchor point (the position to replicate, per D-02)

```typescript
// Source: packages/client/src/components/PlayerStatsPanel.tsx:142-171 (cardHeader → playerMeta)
<div className={styles.playerMeta}>
  <NationFlag nationality={piece.nationality} size={20} />
  <span className={styles.roleChip}>{piece.role}</span>
  <span className={styles.jerseyNum}>#{piece.number}</span>
  {/* existing cardChip/injuryChip spans render HERE — replace in place with <CardInjuryBadge /> */}
</div>
```

### Existing co-located-then-reused derivation precedent (the pattern for `cardColorFor`)

```typescript
// Source: packages/client/src/components/PlayerStatsPanel.tsx:17 + LineupAssignmentScreen.tsx:34
export const STAT_LABELS: Array<[keyof PlayerPiece, string, string]> = [
  /* ... */
];
// import { STAT_LABELS } from './PlayerStatsPanel.js';
```

## State of the Art

| Old Approach                                                                    | Current Approach                                                         | When Changed         | Impact                                                                                                                                                                                                                                                                                                                                                                           |
| ------------------------------------------------------------------------------- | ------------------------------------------------------------------------ | -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Text chips (`"YELLOW"`/`"RED"`/`"INJ"`/`"INJ ×2"`) on scoreboard + roster cards | Shape+color glyph (colored rect + white cross), matching the pitch token | This phase (D-01)    | 2 existing components lose their text-chip CSS classes (`cardChip`/`injuryChip` in `PlayerStatsPanel.module.css`, `LineupAssignmentScreen.module.css`); those class definitions become dead code candidates once no consumer references them — verify via `knip` post-implementation, matching the project's existing knip-clean convention (`STATE.md` Quick Tasks, 260816-bn5) |
| Bench shows only a text "RED CARD" badge, nothing else                          | Bench shows shared glyph badge (scope per Critical Finding decision)     | This phase (ICON-03) | First-ever card/injury display on this surface                                                                                                                                                                                                                                                                                                                                   |

**Deprecated/outdated:**

- `cardChip`/`injuryChip` CSS classes in `PlayerStatsPanel.module.css` and `LineupAssignmentScreen.module.css`: superseded by the shared glyph component's own styling; do not leave orphaned after the swap (a `knip`/grep audit is warranted, per `PITFALLS.md`'s "Warning signs" language for this exact pitfall).

## Assumptions Log

| #   | Claim                                                                                                                                                                                                                                                | Section                           | Risk if Wrong                                                                                                                                                                                                                                                                                                        |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A1  | Recommending `CardInjuryBadge.tsx` (not `CardBadge.tsx`+`InjuryBadge.tsx` as two files) as the single module name/location                                                                                                                           | Recommended Project Structure     | Low — purely a naming/file-count choice, trivially renamed at plan time with no logic impact                                                                                                                                                                                                                         |
| A2  | Recommending Option 2 (redCarded-only bench scope) as the lower-risk default over Option 1 (extend `BenchEntry`)                                                                                                                                     | Critical Finding                  | Medium — if the user actually wants full bench injury/yellow-card display (matching ICON-02's "identical iconography... on the player card, pitch card, roster card, and bench card" literally), Option 2 under-delivers on that literal reading; this must be confirmed with the user/planner, not silently assumed |
| A3  | `injuryCount >= 2` should render identically to `injuryCount === 1` on the new glyph (no "×2" visual distinction), matching the pitch token's existing binary treatment, rather than preserving the roster/stats cards' current "INJ ×2" distinction | Common Pitfalls / Component Shape | Low-Medium — cosmetic only; if wrong, the fix is a small addition to `CardInjuryBadgeGroup` (e.g., a second offset cross, or a small numeric overlay) with no data-model impact, since `injuryCount` is already available everywhere except the bench (per A2)                                                       |

**None of these are compliance/security-relevant** — all are cosmetic/scope-boundary questions appropriate for planner or `/gsd-discuss-phase` follow-up, not blocking research gaps.

## Open Questions

1. **Bench data-model gap: extend `BenchEntry` or scope bench iconography to `redCarded`-only?**
   - What we know: `redCarded` bench entries can show a red-card glyph with zero engine changes; `subbedOut`/`available` entries currently have no yellow-card/injury data available at all (see Critical Finding).
   - What's unclear: whether ICON-02's "identical iconography... on... the bench card" is meant literally (implying Option 1, extend `BenchEntry`) or is satisfied by the redCarded case alone for v1.7 (Option 2).
   - Recommendation: default to Option 2 (redCarded-only, zero engine changes) unless the planner/user explicitly opts into the small `BenchEntry` extension described in Option 1. Either way, document the choice explicitly in the plan — do not leave it implicit.

2. **Does the new glyph badge replace or coexist with the bench's existing "RED CARD"/"OUT" text badge?**
   - What we know: both badge systems can be simultaneously true for a `redCarded` bench entry; they encode different semantics (roster availability vs. disciplinary/fitness status).
   - What's unclear: whether showing both is cluttered/redundant on the bench's compact card, or whether they're complementary enough to coexist.
   - Recommendation: coexist by default (they're not literally duplicative — "RED CARD" explains unavailability, the glyph is the same visual language as every other card), but flag this as a design call the planner should make explicitly, potentially worth a discuss-phase follow-up if not resolved before implementation.

3. **Does `injuryCount >= 2` need a distinct visual on the new glyph, or does it match the pitch token's existing binary (present/absent) treatment?**
   - What we know: the pitch token has never distinguished injury count visually (a single cross, or nothing); the roster/stats text chips currently DO distinguish ("INJ" vs "INJ ×2").
   - What's unclear: whether losing this distinction under the new glyph system is an acceptable regression, given D-01's explicit "shape+color glyph, not text" mandate makes a literal "×2" hard to render cleanly.
   - Recommendation: match the pitch token's binary treatment (present/absent only) as the default, since it's D-01's stated source of truth and the simplest option; flag as low-risk if wrong (cosmetic-only fix later).

## Environment Availability

Not applicable — this phase has no external tool/service/runtime dependencies beyond the already-verified project stack (Node 24.15.0, pnpm 9.15.9, already running in this environment). No new environment probing needed.

## Validation Architecture

### Test Framework

| Property           | Value                                                                                                                                                                                              |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Framework          | Vitest (already configured per every sibling `*.test.tsx` in `packages/client/src/components/`)                                                                                                    |
| Config file        | `packages/client/vitest.config.ts` (existing, not read this session — assumed present per universal `*.test.tsx` convention; verify path at Wave 0 if a new test file's config resolution differs) |
| Quick run command  | `pnpm --filter @counter-attack/client test -- CardInjuryBadge` (single new file, or `-- PieceOverlay` / `-- PlayerStatsPanel` / `-- LineupAssignmentScreen` / `-- BenchCarousel` per touched file) |
| Full suite command | `pnpm --filter @counter-attack/client test`                                                                                                                                                        |

### Phase Requirements → Test Map

| Req ID                                                   | Behavior                                                                                                                           | Test Type         | Automated Command                                                                                                                                                                                                                                                                                              | File Exists?                                                                                                                                                                                                                                    |
| -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ICON-01                                                  | Single shared component backs all 3 replaced surfaces (pitch, stats, roster)                                                       | unit              | `pnpm --filter @counter-attack/client test -- CardInjuryBadge`                                                                                                                                                                                                                                                 | ❌ Wave 0 (new file)                                                                                                                                                                                                                            |
| ICON-01                                                  | Post-implementation: zero remaining occurrences of the old inline `redCarded === true ?` ternary outside `CardInjuryBadge.tsx`     | static/grep audit | `grep -rn "redCarded === true ?" packages/client/src/components --include="*.tsx" \| grep -v CardInjuryBadge.tsx` (expect empty)                                                                                                                                                                               | N/A — audit step, not a test file                                                                                                                                                                                                               |
| ICON-02                                                  | Identical glyph shape/color across all 4 surfaces at the same relative position (after flag)                                       | unit + visual     | Existing `data-testid="piece-card-badge"`/`piece-injury-badge"` assertions (`PieceOverlay.test.tsx:274-345`, already ✅) extended with equivalent assertions on `PlayerStatsPanel.test.tsx`, `LineupAssignmentScreen.test.tsx`, and a new `BenchCarousel.test.tsx`/`DraftPackCarousel.test.tsx` coverage block | ✅ Pitch (existing) / ❌ Wave 0 needed for the 3 DOM surfaces to assert glyph (not text) presence                                                                                                                                               |
| ICON-02                                                  | Simultaneous card+injury renders both, side by side, on name-row surfaces (D-04)                                                   | unit              | New assertion: both `piece-card-badge`-equivalent and `piece-injury-badge`-equivalent elements present with non-overlapping x-coordinates, mirroring `PieceOverlay.test.tsx:315-320`'s existing "both badges present simultaneously" pattern                                                                   | ❌ Wave 0 (new side-by-side geometry assertion)                                                                                                                                                                                                 |
| ICON-03                                                  | Bench shows card/injury status "for the first time"                                                                                | unit              | New `BenchCarousel.test.tsx`/`DraftPackCarousel.test.tsx` test asserting a `redCarded` bench card renders the glyph (currently: zero existing coverage of `redCarded`/`unavailable` badge rendering in either test file — confirmed by grep, both return no matches)                                           | ❌ Wave 0 — genuine test gap, not just new-feature coverage                                                                                                                                                                                     |
| Mid-match update consistency (phase success criterion 3) | A live card/injury status change (booking/injury resolution mid-match) reflects identically on all surfaces simultaneously visible | integration       | Existing full-state-broadcast architecture makes this "free" if `cardColorFor` reads live `GameState.pieces` on every surface — a regression test asserting all 4 render functions called with the SAME derived `cardColor`/`injuryCount` for the same `piece` object would catch a stale-derivation bug       | ❌ Wave 0 — recommend one integration-style test in `LineupAssignmentScreen.test.tsx` (already has live `GameState` mid-match fixtures) asserting the roster card's glyph updates after a simulated `BOOKING_CHECK`/`INJURY_CHECK` state change |

### Sampling Rate

- **Per task commit:** `pnpm --filter @counter-attack/client test -- <touched-file-name>`
- **Per wave merge:** `pnpm --filter @counter-attack/client test` (full client suite — this phase touches 5 files with existing test coverage plus 1-2 new test files; regression risk is concentrated in `LineupAssignmentScreen.test.tsx`'s large existing suite, which must stay green)
- **Phase gate:** Full suite green before `/gsd-verify-work`, plus the grep audit (ICON-01 row above) returning zero matches.

### Wave 0 Gaps

- [ ] `CardInjuryBadge.test.tsx` — new file, covers ICON-01/02 (component-level: cardColorFor precedence, standalone-vs-group rendering, side-by-side vs. overlapping layout)
- [ ] `BenchCarousel.test.tsx` / `DraftPackCarousel.test.tsx` extension — covers ICON-03 (currently zero coverage of `redCarded`/`unavailable` badge rendering at all — confirmed via grep, not merely "new feature, no test yet" but "existing gap in an existing surface")
- [ ] `PlayerStatsPanel.test.tsx` / `LineupAssignmentScreen.test.tsx` updates — rewrite the `.textContent`-based `'INJ'`/`'INJ ×2'` assertions (Pitfall 1) to glyph-presence assertions
- [ ] Framework install: none — Vitest already configured project-wide.

## Security Domain

### Applicable ASVS Categories

| ASVS Category         | Applies                                                                                                                                                                                       | Standard Control                                                                                                                                                                                                                                                |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| V2 Authentication     | No                                                                                                                                                                                            | No auth surface touched — pure rendering                                                                                                                                                                                                                        |
| V3 Session Management | No                                                                                                                                                                                            | No session/socket handling touched                                                                                                                                                                                                                              |
| V4 Access Control     | No                                                                                                                                                                                            | No new server endpoint, no new client-trust boundary                                                                                                                                                                                                            |
| V5 Input Validation   | No (client-only rendering of already-server-validated fields) — **conditional Yes** if Option 1 (Critical Finding) is chosen, since it adds a small server-side `BenchEntry` field population | If Option 1 chosen: the new `yellowCards`/`injuryCount` fields are copied server-side from already-validated `PlayerPiece` fields (never client-supplied), so no new input-validation surface is introduced — this is data propagation, not new untrusted input |
| V6 Cryptography       | No                                                                                                                                                                                            | Not applicable                                                                                                                                                                                                                                                  |

### Known Threat Patterns for this stack

Not applicable — this phase introduces no new attack surface. It reads already-server-validated `GameState.pieces` fields (or, in Option 1's case, copies them into a new display-only field, still server-side and still sourced from already-trusted data) and renders them client-side. No new client-to-server round trip, no new user-controllable input, no new persistence.

## Sources

### Primary (HIGH confidence — direct code reads this session)

- `packages/client/src/components/PieceOverlay.tsx` — full read, badge geometry source of truth (lines 227-292)
- `packages/client/src/components/PlayerStatsPanel.tsx` — full read, text-chip implementation + `MiniTokenBadge` standalone-SVG-in-DOM precedent
- `packages/client/src/components/LineupAssignmentScreen.tsx` — full read, `LineupStatCard` header row, mid-match bench-list construction (`redCardedPlayerIds`/`unavailablePlayerIds`, lines 776-781)
- `packages/client/src/components/BenchCarousel.tsx` — full read, prop surface confirming no card/injury data threaded today
- `packages/client/src/components/DraftPackCarousel.tsx` — targeted read (`DraftCardBody`, lines 56-126), existing RED CARD/OUT text badge
- `packages/client/src/components/NationFlag.tsx` — full read, standalone-DOM-element precedent (non-SVG variant)
- `packages/shared/src/types.ts` — targeted read, `PlayerPiece` (lines 14-87), `BenchEntry`/`BenchEntryStatus` (lines 89-117)
- `packages/server/src/gameEngine.ts` — targeted read, `relocateRedCardedToBench` (lines 773-793) and `applySubstitution`'s bench-entry rewrite (lines 3050-3138) — the two `BenchEntry` construction sites grounding the Critical Finding
- `packages/client/src/components/PieceOverlay.test.tsx`, `PlayerStatsPanel.test.tsx`, `LineupAssignmentScreen.test.tsx`, `BenchCarousel.test.tsx`, `DraftPackCarousel.test.tsx` — targeted greps confirming existing test assertion shapes and the bench-badge test gap
- `packages/client/src/styles/tokens.css` — targeted grep, confirmed `--color-card-yellow`/`--color-card-red`/`--color-text-inverse` already defined and already the correct tokens to reuse (lines 36, 130-131)
- `.planning/phases/41-card-injury-iconography/41-CONTEXT.md`, `.planning/REQUIREMENTS.md`, `.planning/STATE.md`, `.planning/research/{ARCHITECTURE,PITFALLS,SUMMARY,FEATURES}.md` — milestone-level research and locked decisions

### Secondary (MEDIUM confidence)

- None — this phase required no external/web research; the entire technical surface is internal to the already-read codebase.

### Tertiary (LOW confidence)

- None.

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — no new packages, extraction of already-shipped code
- Architecture: HIGH — component shape grounded in an already-shipped precedent (`MiniTokenBadge`) in this exact codebase
- Pitfalls: HIGH — all three pitfalls grounded in direct file:line reads (test assertions, `BenchEntry` construction sites, `DraftCardBody` badge coexistence)
- Bench data-model gap (Critical Finding): HIGH confidence the gap exists (verified via 2 exact code reads); MEDIUM confidence on which resolution option the user prefers (flagged as Open Question, not decided here)

**Research date:** 2026-08-21
**Valid until:** No external dependency — valid until the underlying files change (effectively indefinite for planning purposes, since this is an internal-only extraction with no external API surface to go stale)
