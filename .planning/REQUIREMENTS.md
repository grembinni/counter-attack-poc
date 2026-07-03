# Requirements — Counter Attack Web v1.3

**Milestone:** Team Customization & Formation System
**Status:** 🔄 Active
**Started:** 2026-07-03

---

## League Structure

- [ ] **LEAGUE-01**: Team selection screen shows two tabs — MLS and International — defaulting to MLS; each tab displays its league's teams as a card grid
- [ ] **LEAGUE-02**: Team picked by home player shows as taken (struck-out card) on all tabs in both players' views simultaneously
- [ ] **LEAGUE-03**: `TeamConfig` gains `league: 'mls' | 'international'`; client groups team cards by league tab; team selection logic is otherwise unchanged

## Team Palette

- [ ] **PALETTE-01**: Each team's color definition has exactly 4 values: `primary` (main team color), `primaryLight` (primary color lightened 3 shades), `secondary1`, `secondary2`
- [ ] **PALETTE-02**: All teams (City, Crew, and all new teams) adopt the 4-value palette model; existing 2-field `primaryColor`/`secondaryColor` removed from `TeamConfig`; all client consumers updated
- [ ] **PALETTE-03**: `primaryLight` is explicitly authored per team at data-definition time, not computed at render time

## MLS Teams

- [ ] **TEAM-07**: Xolos and Cozmos removed from selectable teams; their players merge into the shared player pool; their palettes and badge identities preserved in the color-scheme registry as reusable entries
- [ ] **TEAM-08**: New MLS team #1 — name, 4-color palette, badge concept, and default uniform style defined; squad seeded from player pool
- [ ] **TEAM-09**: New MLS team #2 — name, 4-color palette, badge concept, and default uniform style defined; squad seeded from player pool
- [ ] **TEAM-10**: New MLS team #3 — name, 4-color palette, badge concept, and default uniform style defined; squad seeded from player pool
- [ ] **TEAM-11**: New MLS team #4 — name, 4-color palette, badge concept, and default uniform style defined; squad seeded from player pool

## International Teams

- [ ] **INTL-01**: International team #1 — name, 4-color palette, badge concept, and default uniform style defined; squad seeded from player pool
- [ ] **INTL-02**: International team #2 — name, 4-color palette, badge concept, and default uniform style defined; squad seeded from player pool
- [ ] **INTL-03**: International team #3 — name, 4-color palette, badge concept, and default uniform style defined; squad seeded from player pool
- [ ] **INTL-04**: International team #4 — name, 4-color palette, badge concept, and default uniform style defined; squad seeded from player pool
- [ ] **INTL-05**: International team #5 — name, 4-color palette, badge concept, and default uniform style defined; squad seeded from player pool
- [ ] **INTL-06**: International team #6 — name, 4-color palette, badge concept, and default uniform style defined; squad seeded from player pool

## Uniform Style Library

- [ ] **UNIFORM-01**: A uniform style library is defined in `packages/shared`; each style is a named SVG pattern template parameterized by a `TeamPalette`; each style defines both an outfield rendering and a GK variant (same palette, different color emphasis so GK is visually distinct)
- [ ] **UNIFORM-02**: After selecting a team, the player sees a uniform selection screen displaying all styles rendered against that team's 4-color palette; all styles are visible and selectable
- [ ] **UNIFORM-03**: Each team has a `defaultUniformStyle: UniformStyleId`; this style is pre-selected on the uniform screen when the player arrives
- [ ] **UNIFORM-04**: Player may select any style from the library; confirmed choice is stored in game state and applied to piece rendering throughout the match for that team
- [ ] **UNIFORM-05**: `PieceOverlay` renders using `{ uniformStyle, palette, isGK }` — parameterized pattern system replaces the existing hardcoded per-team SVG patterns

## Data Model (v1.4 Prep)

- [ ] **DATA-01**: All players (including retired Xolos/Cozmos squads) stored in a unified `PLAYER_POOL` export with `sourceTeamId` annotation; pool is queryable independently of any team assignment
- [ ] **DATA-02**: Standard team squads assembled from `PLAYER_POOL` by player ID; players are not embedded inline in team definitions — team config references player IDs
- [ ] **DATA-03**: Color scheme registry retains all team palettes (including retired teams) as named entries; future dynamic teams can reference any existing palette entry

## Formation Selection

- [ ] **FORM-01**: A formation selection screen appears after uniform selection and before KICK_OFF_SETUP; each player independently chooses one of: 4-4-2, 5-3-2, 4-3-3, 3-4-3
- [ ] **FORM-02**: Each formation option displays a mini pitch diagram showing approximate piece positions and a one-line tactical description
- [ ] **FORM-03**: Both players must confirm their formation choice before the game advances; each player sees "waiting for opponent" after confirming
- [ ] **FORM-04**: Piece starting positions are placed dynamically from a `FORMATIONS` definition table keyed by `FormationId`; away positions are the symmetric mirror (q = 36 − home_q)

## Auto-Assignment with Override

- [ ] **ASSIGN-01**: After both formations confirmed, the server auto-assigns all 11 players to formation slots using weighted stat scoring: GK locked to GK slot first; anchor roles (CB/CM/CF) filled by highest weighted score next; flex roles (FB/winger/flex-mid) filled from remaining players
- [ ] **ASSIGN-02**: Assignment result is displayed to the player (slot label → player name) before the player confirms; both players work independently in parallel
- [ ] **ASSIGN-03**: Player can swap any two outfield players between position slots; server validates the swap and broadcasts the updated assignment; multiple swaps are permitted before confirming
- [ ] **ASSIGN-04**: GK slot is locked — only a player with `role='GK'` may occupy it; server rejects any swap that would move the GK out of the GK slot
- [ ] **ASSIGN-05**: Player confirms the assignment to proceed to KICK_OFF_SETUP; confirmed assignment positions each piece at the corresponding formation hex coordinate

## Bug & UAT Closure (v1.2 Backlog)

- [ ] **OFFSIDE-01**: Two-tab live UAT closure — offside detection: sticky `offsidePieceIds`, team-relative detection, D-22 clear paths, D-24 defender flagging (code implemented in Phase 17; human UAT checkpoint never closed)
- [ ] **OFFSIDE-02**: Two-tab live UAT closure — free-kick restart: foul trigger on possession gain and deflect, D-30/D-31 placement rules, restricted action set, D-41 deflection addendum (code implemented in Phase 17; human UAT checkpoint never closed)
- [ ] **REPLAY-07**: GK_KICK ball delivery visible during post-game replay — add GK_KICK to `REPLAY_ELIGIBLE_TYPES`; add `ballAfter` field to GK_KICK `ActionEvent`
- [ ] **REPLAY-08**: LOOSE_BALL_LAND ball delivery visible during post-game replay — same class as GK_KICK; add to `REPLAY_ELIGIBLE_TYPES` with `ballAfter`
- [ ] **BUG-22**: HIGH_PASS_MOVE excludes `highPassCarrierId` from repositioning target — `highPassCarrierId` is set in `GameState` but not consumed as an exclusion in the `GAME_MOVE` handler; parallel defect to Plan 17.1-16 FIRST_TIME_PASS_MOVE fix
- [ ] **BUG-23**: KICK_OFF_SETUP shot-path hex shading clears correctly after a SNAPSHOT_DEFLECT goal — root cause investigation required; fix applied
- [ ] **UX-15**: UX streamlining — any new issues identified during v1.3 playtesting addressed before milestone close

---

## Future Requirements (v1.4 Candidates)

- Random draft team building — player picks from PLAYER_POOL one-by-one (foundation laid by DATA-01/02/03)
- Color scheme selection for custom teams — player picks any registered palette entry for their drafted squad
- Additional uniform styles added to library
- Substitutions mid-match

## Out of Scope (v1.3)

- Custom color picker (hex input) — use preset palettes only
- Per-player uniform customization — uniform choice is per-team, not per-player
- Animated formation transitions on pitch
- AI / single-player mode
- Mobile layout
- Sound effects

---

## Traceability

| REQ-ID     | Phase | Status  | Notes                                           |
| ---------- | ----- | ------- | ----------------------------------------------- |
| LEAGUE-01  | —     | Pending |                                                 |
| LEAGUE-02  | —     | Pending |                                                 |
| LEAGUE-03  | —     | Pending |                                                 |
| PALETTE-01 | —     | Pending |                                                 |
| PALETTE-02 | —     | Pending |                                                 |
| PALETTE-03 | —     | Pending |                                                 |
| TEAM-07    | —     | Pending |                                                 |
| TEAM-08    | —     | Pending |                                                 |
| TEAM-09    | —     | Pending |                                                 |
| TEAM-10    | —     | Pending |                                                 |
| TEAM-11    | —     | Pending |                                                 |
| INTL-01    | —     | Pending |                                                 |
| INTL-02    | —     | Pending |                                                 |
| INTL-03    | —     | Pending |                                                 |
| INTL-04    | —     | Pending |                                                 |
| INTL-05    | —     | Pending |                                                 |
| INTL-06    | —     | Pending |                                                 |
| UNIFORM-01 | —     | Pending |                                                 |
| UNIFORM-02 | —     | Pending |                                                 |
| UNIFORM-03 | —     | Pending |                                                 |
| UNIFORM-04 | —     | Pending |                                                 |
| UNIFORM-05 | —     | Pending |                                                 |
| DATA-01    | —     | Pending |                                                 |
| DATA-02    | —     | Pending |                                                 |
| DATA-03    | —     | Pending |                                                 |
| FORM-01    | —     | Pending |                                                 |
| FORM-02    | —     | Pending |                                                 |
| FORM-03    | —     | Pending |                                                 |
| FORM-04    | —     | Pending |                                                 |
| ASSIGN-01  | —     | Pending |                                                 |
| ASSIGN-02  | —     | Pending |                                                 |
| ASSIGN-03  | —     | Pending |                                                 |
| ASSIGN-04  | —     | Pending |                                                 |
| ASSIGN-05  | —     | Pending |                                                 |
| OFFSIDE-01 | —     | Pending | Carried from v1.2; code implemented in Phase 17 |
| OFFSIDE-02 | —     | Pending | Carried from v1.2; code implemented in Phase 17 |
| REPLAY-07  | —     | Pending |                                                 |
| REPLAY-08  | —     | Pending |                                                 |
| BUG-22     | —     | Pending |                                                 |
| BUG-23     | —     | Pending |                                                 |
| UX-15      | —     | Pending |                                                 |
