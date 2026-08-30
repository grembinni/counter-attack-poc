# Phase 41: Card & Injury Iconography - Context

**Gathered:** 2026-08-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Card and injury status render through one shared badge component, in the same visual language and the same relative position, across every player-showing surface: the on-pitch piece overlay (SVG hex token), the scoreboard player-stats card, the mid-match/pre-match roster (lineup) card, and the bench card — which currently shows neither status at all. This phase does not touch game logic; `piece.redCarded`, `piece.yellowCards`, and `piece.injuryCount` already exist and are already correctly populated by the Phase 39 fouls/cards/injury engine. This is a rendering-consolidation phase only.

</domain>

<decisions>
## Implementation Decisions

### Icon visual style

- **D-01:** Adopt the pitch token's existing glyph language everywhere: a colored rectangle (yellow/red) for card status, a plain white cross for injury status. This replaces the text-chip treatments currently used on the scoreboard player-stats card (`"YELLOW"`/`"RED"` span) and the roster/lineup card (`cardChip`/`injuryChip` spans showing the same text), and adds the glyph treatment to the bench card, which shows neither today.
- User explicitly rejected the "keep text, restyle for consistency" alternative — the pitch token's shape+color glyph set is the one source of truth to extend outward, not a text-based system to unify separately.

### Badge position

- **D-02:** The "position between name and flag, or after flag" rule from REQUIREMENTS.md (ICON-02) governs only the three name-row card surfaces — scoreboard player-stats card, roster/lineup card, and bench card — each of which already renders a `name · flag · role · #number` header row (see Code Context below for the existing roster-card ordering).
- **D-03:** The on-pitch piece-overlay SVG token is explicitly exempt from the name/flag position rule. It has no name/flag row at all — it is a floating badge anchored to a corner of the hex token (opposite the ball-possession dot), and this corner-anchor treatment is unchanged by this phase. It remains the source-of-truth glyph shape/color, just not the position rule.

### Simultaneous card + injury

- **D-04:** When a player is both booked and injured, both badges render simultaneously, side by side, on all three name-row card surfaces — mirroring the pitch token's existing behavior (same corner, distinguished by shape: rectangle vs. cross). Card and injury are independent statuses; neither takes visual precedence over the other. No new "combined" glyph is needed.

### Claude's Discretion

- Whether the shared component is implemented as a single React component parameterized by rendering context (DOM span-based vs. inline SVG), or two thin wrappers around one shared glyph-drawing core, is left to the planner/implementer — ARCHITECTURE.md research already found that half the target surfaces (`PlayerStatsPanel.tsx`, the roster/lineup card) are not inside an `<svg>` element at all, so a single cross-context `<symbol>`/`<defs>` approach (the pattern used for on-pitch SVG defs per the Phase 12 decision) will not work unmodified — the researcher/planner should resolve the concrete component shape.
- Exact pixel sizing/spacing of the badge on each of the three name-row surfaces (which may differ from each other due to different card widths) is an implementation detail, not a vision decision.

</decisions>

<canonical_refs>

## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & Roadmap

- `.planning/REQUIREMENTS.md` §"Card & Injury Iconography" — ICON-01, ICON-02, ICON-03 (the three requirements this phase satisfies)
- `.planning/ROADMAP.md` §"Phase 41: Card & Injury Iconography" — goal, success criteria, dependency note (first phase of v1.7)

### Research (all four files ground this phase's specific components/lines)

- `.planning/research/ARCHITECTURE.md` — Feature 2 integration analysis: confirms `PieceOverlay.tsx`'s SVG badge is the source-of-truth shape language; confirms a shared component (not a shared SVG `<symbol>`) is needed because `PlayerStatsPanel.tsx` and the roster/lineup card render outside any `<svg>` context
- `.planning/research/PITFALLS.md` — Pitfall on card/injury iconography already triplicated across 3 surfaces with the bench (4th) surface currently showing neither; risk of missing one surface during consolidation
- `.planning/research/SUMMARY.md` §"Phase 2: Unified Card/Injury Iconography" — sequencing rationale (ships first so Phase 42's bench red-card marker has a real shared component to consume)
- `.planning/research/FEATURES.md` §"2. Unified Card/Injury Iconography" — confirms shape+color glyph (not text abbreviation) is the industry-standard minimal set at small sizes

### Prior design precedent (informs implementation approach, not a hard requirement)

- `docs/HIGHLIGHT-REFERENCE.md` — the project's existing "single source of truth" pattern for a previously-duplicated visual system (hex highlight colors, Phase 33); the same single-source-of-truth approach applies here for card/injury badges, though this phase does not need its own reference doc unless the planner judges one useful

</canonical_refs>

<code_context>

## Existing Code Insights

### Reusable Assets

- `packages/client/src/components/PieceOverlay.tsx` (~lines 227-270) — the existing SVG card badge (colored rect) + injury badge (white cross), anchored at the negated ball-dot offset. This is the glyph shape/color source of truth per D-01.
- `piece.redCarded`, `piece.yellowCards`, `piece.injuryCount` on `PlayerPiece` (packages/shared/src/types.ts) — already correctly populated; this phase is pure rendering, no new engine fields needed.
- The existing `cardColor` derivation (`piece.redCarded === true ? 'red' : (piece.yellowCards ?? 0) > 0 ? 'yellow' : null`) is duplicated verbatim in `PieceOverlay.tsx` and `LineupAssignmentScreen.tsx` (~line 454) — a shared derivation function is a natural companion extraction alongside the shared render component.

### Established Patterns

- Roster/lineup card header row order (`LineupAssignmentScreen.tsx` ~line 232-256): `[TeamBadge] name · flag(NationFlag) · role · #number`, with the existing text-based `cardChip`/`injuryChip` spans rendered immediately after that header row — this is the existing "after flag" anchor point for D-02.
- Bench card (`BenchCarousel.tsx`) currently renders only a text "RED CARD" badge (via `redCardedPlayerIds` prop) and has no injury display at all — confirms ICON-03's "first time" framing.
- `PlayerStatsPanel.tsx` (~lines 159-170) — scoreboard card's `cardColor`/`injuryCount` text-chip rendering, structurally identical to the roster card's but implemented independently (comment in source explicitly notes "identical classes/copy" between the two — confirms the triplication).

### Integration Points

- Four call sites to migrate/extend: `PieceOverlay.tsx` (convert existing SVG badge to use the shared component, or treat as the reference implementation the shared component wraps), `PlayerStatsPanel.tsx`, `LineupAssignmentScreen.tsx`'s card-row component, `BenchCarousel.tsx`'s bench card component (new).
- Phase 42 (Substitution UX Overhaul) depends on this phase's shared component for its new bench red-card marker — do not defer or partially implement bench-card support.

</code_context>

<specifics>
## Specific Ideas

- User's original request explicitly allowed positional flexibility ("between name and flag — after flag is fine if easier"), which the discussion resolved to "after flag" as the de facto answer since that's where the existing roster card already renders its text chips (D-02).
- No specific visual mockup/reference image was provided for this phase (unlike the Game Summary popup in Phase 45, which the user said reference images would be provided for).

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

### Reviewed Todos (not folded)

- `2026-07-02-bug-kickoff-setup-persistent-light-shading-on-shot-path-hexes.md` — reviewed via todo.match-phase (weak keyword match on generic terms), confirmed out of scope for iconography; remains tagged to Phase 46 (Final Cleanup).
- `2026-08-09-bug-offside-ring-after-goal.md` — reviewed via todo.match-phase (weak keyword match), confirmed out of scope for iconography; remains tagged to Phase 46 (Final Cleanup).
- `csv-consolidation-player-pool.md` — reviewed via todo.match-phase (weak keyword match on "player"/"phase"); user confirmed this work is already complete (verified: `packages/shared/src/data/player-pool.csv` is now the single consolidated file, no per-team CSVs remain). Moved to `.planning/todos/completed/` during this discussion, not folded into any phase.

</deferred>

---

_Phase: 41-card-injury-iconography_
_Context gathered: 2026-08-21_
