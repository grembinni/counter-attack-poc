# Phase 21: New Teams (MLS + International) - Context

**Gathered:** 2026-07-04
**Status:** Ready for planning

<domain>
## Phase Boundary

Data model extension + UI refactor. This phase delivers:

1. **`TeamId` extended to 12 members** — 10 new MLS/international team IDs added to the selectable union
2. **10 new `TEAM_CONFIGS` entries** — each with correct `playerIds` (from PLAYER_POOL), `league`, `defaultUniformStyle`, `palette` (via COLOR_SCHEME_REGISTRY), and `badgeFile`
3. **`TeamSelectionScreen` refactored to a two-tab layout** — MLS tab and International tab; league tabs replace the flat grid
4. **Server `VALID_TEAM_IDS` extended to 12** — server-side allow-list updated
5. **Tests updated** — `teamConfig.test.ts` count assertions; `TeamSelectionScreen.test.tsx` card-count and tab-behavior tests

No new socket events, no new shared types beyond TeamId, no new screens. Phase 20's uniform style system and Phase 19's player pool are the foundation.

</domain>

<decisions>
## Implementation Decisions

### Uniform Style Assignments (one unique style per team)

Phase 20 defined 12 styles and deferred per-team assignment to Phase 21. With `city=pinstripe` and `crew=diagonal` already locked, the 10 remaining styles are assigned as follows:

- **D-01:** `miami` → `fade` — gradient suits the modern coastal aesthetic and pink-to-black palette
- **D-02:** `la` (LAFC) → `checker` — bold black-and-gold checker; distinctive geometric look
- **D-03:** `nashville` → `corners` — corner triangles match Nashville's angular geometric aesthetic
- **D-04:** `seattle` → `v-stripe` — V-shape stripes with green/blue palette; Pacific Northwest feel
- **D-05:** `canada` → `cosmos` — horizontal band mirrors Canada's traditional red-stripe kit pattern
- **D-06:** `england` → `solid` — England's traditional kit is unfussy solid white; most appropriate
- **D-07:** `france` → `quarters` — quadrant split in blue/white recalls the French tricolore division
- **D-08:** `mexico` → `tree-rings` — concentric alternating circles suit Mexico's rich multi-tone green palette
- **D-09:** `spain` → `plus` — cross/plus shape in red and gold is on-brand for España
- **D-10:** `us` (USMNT) → `polka-dots` — stars-and-stripes inspiration with stars as dots in red/white/blue

Each team gets a unique style. No two teams share the same `defaultUniformStyle`.

### Team Card Ordering Within Tabs

- **D-11:** MLS tab order: `['city', 'crew', 'la', 'miami', 'nashville', 'seattle']` — originals first, then alphabetical
- **D-12:** International tab order: `['canada', 'england', 'france', 'mexico', 'spain', 'us']` — alphabetical

### Tab UX (LEAGUE-01 / LEAGUE-02)

- **D-13:** Default tab on mount is MLS (LEAGUE-01, per FEATURES.md)
- **D-14:** Tab state is local React `useState` in `TeamSelectionScreen` — NOT Zustand (UI-only, not game state)
- **D-15:** Auto-switch fires only for away player when `homePickedTeam` changes — guarded by `!iAmActive`. Home player's tab stays wherever they left it after picking.
- **D-16:** No tab badge indicator ("MLS (1 taken)") — Option A auto-switch only. Evaluate after playtesting.

### Player IDs (verified, hardcode directly)

- **D-17:** Player ID ranges verified against `PLAYER_POOL` directly (see RESEARCH.md Pattern 3):
  - miami (inter-miami): p069–p079 (11 players)
  - la (lafc): p080–p090 (11 players)
  - seattle: p091–p101 (11 players)
  - nashville: p102–p112 (11 players)
  - us (usmnt): p113–p123 (11 players)
  - england: p124–p134 (11 players)
  - mexico: p135–p145 (11 players)
  - canada: p146–p156 (11 players)
  - spain: p157–p167 (11 players)
  - france: p168–p178 (11 players)
  - Three TeamId-to-sourceTeamId mismatches: miami→inter-miami, la→lafc, us→usmnt

### Claude's Discretion

- Exact TypeScript layout of the 10 new `TEAM_CONFIGS` entries (follow the `city` entry pattern exactly)
- Whether to structure `MLS_TEAMS` and `INTL_TEAMS` as module-level constants or inline in JSX
- Exact file order for the 10 new Vite badge imports
- CSS transition timing for tab active/inactive state (UI-SPEC has exact values — follow them)

</decisions>

<canonical_refs>

## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 21 Design Contracts (primary)

- `.planning/phases/21-new-teams-mls-international/21-RESEARCH.md` — comprehensive codebase inspection; verified playerIds ranges, existing infrastructure, pitfalls, code examples for all patterns
- `.planning/phases/21-new-teams-mls-international/21-UI-SPEC.md` — UI design contract; exact CSS values, interaction specs, accessibility (role/aria-selected), badge dimensions, typography, spacing, color tokens
- `.planning/phases/21-new-teams-mls-international/21-VALIDATION.md` — validation architecture; test framework, req-to-test map, sampling rate

### Data Model (files being modified)

- `packages/shared/src/teamConfig.ts` — `TeamId` union (extend from 2 to 12); `TEAM_CONFIGS` record (add 10 entries); `COLOR_SCHEME_REGISTRY` (already populated for all 10 — read-only reference)
- `packages/shared/src/teams.ts` — `PLAYER_POOL` (read-only; player ID ranges verified here)
- `packages/shared/src/uniformStyles.ts` — `UniformStyleId` union and `UNIFORM_STYLE_META` (the 12 defined styles; Phase 21 references these for `defaultUniformStyle` values)

### Server (file being modified)

- `packages/server/src/roomHandlers.ts` — `VALID_TEAM_IDS` allow-list (extend to 12 members)

### Frontend (files being modified)

- `packages/client/src/components/TeamSelectionScreen.tsx` — add tab bar, per-league arrays, 10 new Vite badge imports, auto-switch logic
- `packages/client/src/components/TeamSelectionScreen.module.css` — add `.tabs`, `.tab`, `.tabActive` classes; update `.grid` from 2-col to 3-col; reduce badge size to 80×80

### Tests (files needing updates)

- `packages/shared/src/teamConfig.test.ts` — count assertions updating from 2→12 (TEAM_CONFIGS), 4→14 (COLOR_SCHEME_REGISTRY); extend test arrays to 12 teams
- `packages/client/src/components/TeamSelectionScreen.test.tsx` — per-tab card counts; new tab-switching and cross-tab struck-out behavior tests

### Prior Phase Context (locked decisions)

- `.planning/phases/20-uniform-style-system/20-CONTEXT.md` — D-01..12 (12 uniform style definitions); D-13 (GK palette swap); D-15/D-16/D-17 (PieceOverlay prop shape)
- `.planning/phases/19-data-model-team-palette/19-CONTEXT.md` — D-03 (playerIds reference pattern), D-06 (COLOR_SCHEME_REGISTRY), D-08/D-09 (palette shape), D-14 (league field)

### Requirements

- `.planning/REQUIREMENTS.md` — TEAM-08..11, INTL-01..06, LEAGUE-01..02, DATA-02

</canonical_refs>

<code_context>

## Existing Code Insights

### Reusable Assets (already in place — no changes needed)

- `COLOR_SCHEME_REGISTRY` — all 10 new team entries already populated with 4-color palettes and `badgeFile` references (Phase 19/20 work, uncommitted)
- `PLAYER_POOL` — 178 players with stable IDs p001–p178, all new team players included with correct `sourceTeamId` slugs
- All 10 badge PNG files (`{team}.png` and `{team}-full.png`) — present in `packages/client/src/assets/badges/`; seattle spelling corrected to `seattle.png`
- `getSquadPlayers(teamId: TeamId)` — works unchanged once new TEAM_CONFIGS entries exist; no modifications needed
- `homePickedTeam` prop flow — App.tsx → TeamSelectionScreen; already wired from Phase 16; no server changes needed for LEAGUE-02

### Established Patterns

- `TEAM_CONFIGS` entry shape: `{ id, name, colorSchemeId, palette: COLOR_SCHEME_REGISTRY[x].palette, playerIds: [...], league, badgeFile, defaultUniformStyle }` — follow the `city` entry exactly
- Static Vite badge imports: `import laFullBadge from '../assets/badges/la-full.png'` — all badge files must use static imports (Phase 15 D-03 pattern; gives content-hashed URLs and build-time existence checks)
- Tab state pattern: local `useState` in the component (same as `homePickedTeam` local state in App.tsx, not Zustand)
- `isStruckOut` check: `teamId === homePickedTeam` — must span ALL teams regardless of which tab is active

### Integration Points

- `VALID_TEAM_IDS` in `roomHandlers.ts` — TypeScript's `readonly TeamId[]` will fail to compile if any value is not a valid `TeamId` member; TypeScript acts as a correctness gate here
- TypeScript compilation gate: `TEAM_CONFIGS: Record<TeamId, TeamConfig>` will fail until all 12 keys are present
- Three TeamId/sourceTeamId mismatches to handle when populating playerIds: miami→inter-miami, la→lafc, us→usmnt

</code_context>

<specifics>
## Specific Ideas

- Phase 20 created exactly 12 styles so each of the 12 selectable teams gets a unique visual default. The assignments in D-01..D-10 complete this design intent.
- The `seatle.png` typo has already been corrected to `seattle.png` in the badge assets and `teamConfig.ts`. Use the correct spelling in all Vite imports.
- Team tab ordering confirmed: originals (city, crew) first in the MLS tab, then alphabetical. International tab is purely alphabetical.
- No tab-label "taken" indicator (Option B) — auto-switch to the correct tab is sufficient for LEAGUE-02.

</specifics>

<deferred>
## Deferred Ideas

- CSV consolidation (merge all 7 CSV files into single player-pool.csv) — player IDs are already stable; consolidation would require re-running seed script and risks ID reassignment. Defer to Phase 24+ as noted in the pending todo.
- Animated uniform patterns — out of scope for v1.3 entirely
- Uniform style selection UI for new teams — Phase 22 (UNIFORM-02..04)
- Tab badge indicator ("MLS (1 taken)") for away player view — evaluate after playtesting Phase 21

### Reviewed Todos (not folded)

- `2026-07-02-bug-kickoff-setup-persistent-light-shading-on-shot-path-hexes.md` — Phase 25 (BUG-23), not Phase 21 scope
- `2026-06-21-bug-gk-kick-ball-delivery-invisible-during-replay.md` — Phase 25 (REPLAY-07), not Phase 21 scope
- `csv-consolidation-player-pool.md` — Phase 24+; stable IDs make this safe to defer

</deferred>

---

_Phase: 21-new-teams-mls-international_
_Context gathered: 2026-07-04_
