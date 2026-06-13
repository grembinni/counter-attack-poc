# Phase 15: Team Identity - Context

**Gathered:** 2026-06-13
**Status:** Ready for planning

<domain>
## Phase Boundary

Define 4 named teams (Cosmos, Xolos, City, Crew) with distinct visual identities — a shared TeamConfig type, PNG badge assets, jersey SVG patterns, and GK jersey updates — and wire team badges into the scoreboard top band using hardcoded home/away defaults. No team selection UI (that's Phase 16).

**Requirements in scope:** TEAM-01, TEAM-02, TEAM-03, TEAM-04, TEAM-05, TEAM-06

</domain>

<decisions>
## Implementation Decisions

### Badge Assets

- **D-01:** Badge images are provided as PNG files by the user. Store at `packages/client/src/assets/badges/{teamid}.png` (e.g., `cosmos.png`, `xolos.png`, `city.png`, `crew.png`). Display via `<img>` tags in scoreboard and player card contexts — no inline SVG recreation needed.

- **D-02:** Team name confirmed: **Cosmos** (not "Cozmos"). `TeamId` uses `'cosmos'`. Badge files confirmed present at `packages/client/src/assets/badges/` (cosmos.png, xolos.png, city.png, crew.png).

### TeamConfig Data Shape

- **D-03:** New file `packages/shared/src/teamConfig.ts`. Exports:
  - `TeamId` union type: `'cosmos' | 'xolos' | 'city' | 'crew'`
  - `TeamConfig` interface with fields: `id: TeamId`, `name: string`, `primaryColor: string`, `secondaryColor: string`, `badgeFile: string`
  - `TEAM_CONFIGS: Record<TeamId, TeamConfig>` static lookup

- **D-04:** Color values per team (approximate — planner should verify against badge images):
  - Cosmos: primaryColor `#1e3a8a` (navy blue), secondaryColor `#c8a84b` (gold)
  - Xolos: primaryColor `#ea580c` (orange), secondaryColor `#6b7280` (grey)
  - City: primaryColor `#dc143c` (crimson red), secondaryColor `#f5c518` (gold)
  - Crew: primaryColor `#f5c518` (gold/yellow), secondaryColor `#111111` (black)

### Phase 15 Scoreboard Wiring (No GameState changes)

- **D-05:** Add a `TEAM_DEFAULTS` client-side constant (in `packages/client/src/`) mapping positional role to team id:

  ```ts
  const TEAM_DEFAULTS: Record<'home' | 'away', TeamId> = { home: 'cosmos', away: 'xolos' };
  ```

  Phase 16 replaces this constant with a dynamic value from the team selection flow. No changes to `GameState`, `buildInitialGameState`, or any Socket.io events in Phase 15.

- **D-06:** Replace all hardcoded team colors (`#1a56b0`, `#c0392b`) throughout client code with lookups via `TEAM_CONFIGS[TEAM_DEFAULTS[piece.teamId]]`. Files affected: `PieceOverlay.tsx`, `GameBoard.tsx`, `ActionLog.tsx`. One source of truth; no magic hex literals remaining.

- **D-07:** Replace `TeamShieldIcon` (generic colored shield in `GameBoard.tsx:45`) with a `TeamBadge` component that renders `<img src={badgePath} />` using the team's `badgeFile`. Size: 28px × 28px in the scoreboard top band.

### Jersey Patterns

- **D-08:** 4 SVG `<pattern>` defs in `PieceOverlay.tsx` keyed by team id, extending the current inline-`<defs>` approach. Pattern ids: `cosmos-jersey-{pieceId}`, `xolos-jersey-{pieceId}`, `city-jersey-{pieceId}`, `crew-jersey-{pieceId}`. Outfield piece fill references the appropriate `url(#...)`.

- **D-09:** Jersey patterns per team (outfield):
  - **Cosmos:** Navy base (`#1e3a8a`) with a single horizontal white stripe — 3× the width of the current home stripe (current stripe is ~4px wide; Cosmos stripe should be ~12px). This replaces the current home vertical stripe.
  - **Xolos:** Orange base (`#ea580c`) with grey checker squares (`#6b7280`). Checker tile size to match the existing away horizontal band scale (~8–10px tiles).
  - **City:** Crimson base (`#dc143c`) with fine gold vertical stripes (thin lines, ~1px every 4px) and a gold arch line across the lower third of the token circle.
  - **Crew:** Gold base (`#f5c518`) with diagonal black stripes across the upper shoulder region of the token (45°, concentrated in the top ~30% of the circle).

- **D-10:** GK jersey updates (home/away positional, not team-specific — GK special colors preserved from physical board convention):
  - **Home GK:** Purple/dark-purple checker pattern (`#7c3aed` / `#4c1d95` checker tiles). Replaces current solid purple fill.
  - **Away GK:** Amber/yellow base (`#f59e0b`) with 2 narrow orange vertical stripes on the left and right edges of the circle (`#ea580c`, ~3px wide at x≈4 and x≈20 within the 24px tile). Replaces current solid amber fill.

</decisions>

<canonical_refs>

## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements

- `.planning/REQUIREMENTS.md` — TEAM-01..06 requirements (team definitions, badge, jersey patterns, scoreboard badge display)
- `.planning/ROADMAP.md` — Phase 15 success criteria (4 teams with badge, distinct jersey, badge in scoreboard top band)

### Existing Shared Types

- `packages/shared/src/types.ts` — `PlayerPiece.teamId: 'home' | 'away'` (positional, not team-name based); `GameState` (no changes in Phase 15)
- `packages/shared/src/teams.ts` — `HOME_SQUAD`, `AWAY_SQUAD` static arrays (unchanged in Phase 15)

### Client Components to Modify

- `packages/client/src/components/PieceOverlay.tsx` — inline SVG `<defs>` for stripe patterns (lines 66–98); jersey colors (lines 41–46); GK colors (lines 38–43). Primary modification target for D-08, D-09, D-10, D-06.
- `packages/client/src/components/GameBoard.tsx` — `TeamShieldIcon` component (line 45, replace with `TeamBadge`); hardcoded team colors (lines 139, 156, 162, 178, 215, 248, 251, 288, 294, 332, 338). Primary modification target for D-06, D-07.
- `packages/client/src/components/ActionLog.tsx` — team color references (D-06 cleanup)

### New Files to Create

- `packages/shared/src/teamConfig.ts` — TeamConfig type + TEAM_CONFIGS record (D-03)
- `packages/client/src/assets/badges/cosmos.png` — badge PNG (user-provided)
- `packages/client/src/assets/badges/xolos.png` — badge PNG (user-provided)
- `packages/client/src/assets/badges/city.png` — badge PNG (user-provided)
- `packages/client/src/assets/badges/crew.png` — badge PNG (user-provided)

</canonical_refs>

<code_context>

## Existing Code Insights

### Reusable Assets

- `TeamShieldIcon` (`GameBoard.tsx:45`): generic colored shield SVG — replace with `TeamBadge` component that renders `<img>` from badge asset. Prop contract changes from `{ color: string }` to `{ teamId: TeamId }`.
- Current SVG `<defs>` pattern in `PieceOverlay.tsx` (lines 66–98): inline `<pattern>` defs per piece id. Extend with 4 team patterns. Same structure, 4 entries instead of 2.

### Established Patterns

- `piece.teamId` is `'home' | 'away'` (positional). Team identity is derived via `TEAM_DEFAULTS[piece.teamId]` → `TeamId`. The planner must ensure this mapping is consistently applied and not mixed up.
- GK detection: `piece.role === 'GK'` gate already in `PieceOverlay.tsx`. GK jersey patterns (D-10) are applied in this branch.
- `PieceOverlay.tsx` uses per-piece SVG def ids (`home-stripe-${piece.id}`) to avoid SVG id collisions on the same page. Same pattern applies for 4 new team jersey patterns.

### Integration Points

- `PlayerStatsPanel.tsx` — references home/away colors for the team badge icon in the stats panel header (`#1a56b0` / `#c0392b` at line ~178). Also needs D-06 color refactor + D-07 badge component.
- `packages/shared/src/index.ts` — must re-export `TeamConfig`, `TeamId`, and `TEAM_CONFIGS` from the new `teamConfig.ts` so client and server can import from `@counter-attack/shared`.

</code_context>

<specifics>
## Specific Ideas

- **Badge sizing in scoreboard:** `TeamBadge` renders at 28×28px in the top-band scoreboard. Phase 16 (player card) may use a larger size — the component should accept a `size` prop for reuse.
- **GK checker tile size:** Purple/dark-purple checker on home GK — tile size ~6px within the 24px token to keep it legible at HEX_SIZE=20px.
- **Crew jersey:** Diagonal black stripes in the upper shoulder region only (top ~30% of the token circle), not full diagonal coverage. This matches the "45-degree black stripes across the shoulders" description in REQUIREMENTS.md.
- **City jersey arch:** Gold arch line in the lower third of the token circle — a simple curved `<path>` element, not a filled region. Thin stroke (~1.5px).

</specifics>

<deferred>
## Deferred Ideas

- Dynamic team color propagation based on player selection — deferred to Phase 16, which wires `TEAM_DEFAULTS` to actual player-chosen teams.
- `selectedTeams: { home: TeamId, away: TeamId }` in `GameState` — deferred to Phase 16.
- `gkColor` field in `TeamConfig` for team-specific GK styling — not added; GK convention (purple/amber) is board-standard.
- Badge display on player cards — deferred to Phase 16 (PLAY-02 requirement).
- Team selection screen — deferred to Phase 16 (SELECT-01 requirement).

</deferred>

---

_Phase: 15-team-identity_
_Context gathered: 2026-06-13_
