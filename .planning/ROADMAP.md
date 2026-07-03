# Roadmap — Counter Attack Web

## Milestones

- ✅ **v1.0 MVP** — Phases 1–10 (shipped 2026-06-11)
- ✅ **v1.1 UX Tuning & Bug Cleanup** — Phases 11–14 (shipped 2026-06-12)
- ✅ **v1.2 Team Identity & Core Fixes** — Phases 15–18 (shipped 2026-07-03)
- 🔄 **v1.3 Team Customization & Formation System** — Phases 19–25 (active)

## Phases

<details>
<summary>✅ v1.0 MVP (Phases 1–10) — SHIPPED 2026-06-11</summary>

| Phase | Name                                                  | Plans | Completed  |
| ----- | ----------------------------------------------------- | ----- | ---------- |
| 1     | Monorepo Scaffold + Shared Types                      | 3/3   | 2026-05-28 |
| 2     | Move Validator + Unit Tests                           | 4/4   | 2026-05-29 |
| 3     | Server Room Manager + Socket.io Scaffold              | 3/3   | 2026-05-29 |
| 4     | Game Engine + Phase FSM                               | 3/3   | 2026-05-30 |
| 5     | Dice Resolver + All Resolution Branches               | 4/4   | 2026-05-30 |
| 6     | React Hex Grid Renderer                               | 3/3   | 2026-05-31 |
| 7     | Client-Server Integration                             | 4/4   | 2026-06-03 |
| 7.1   | UI Cleanup (INSERTED)                                 | 3/3   | 2026-06-04 |
| 8     | Match Lifecycle + Post-Game Replay                    | 8/8   | 2026-06-05 |
| 8.1   | Cleanup — Player Stats, Movement, Tackling (INSERTED) | 3/3   | 2026-06-05 |
| 8.2   | Passing Cleanup (INSERTED)                            | 6/6   | 2026-06-07 |
| 9     | Render Deployment                                     | 2/2   | 2026-06-08 |
| 10    | Remaining Action Flows + Tech Debt                    | 5/5   | 2026-06-11 |

Full archive: [milestones/v1.0-ROADMAP.md](milestones/v1.0-ROADMAP.md) · [Requirements](milestones/v1.0-REQUIREMENTS.md)

</details>

<details>
<summary>✅ v1.1 UX Tuning & Bug Cleanup (Phases 11–14) — SHIPPED 2026-06-12</summary>

| Phase | Name                     | Plans | Completed  |
| ----- | ------------------------ | ----- | ---------- |
| 11    | Rule Correctness         | 4/4   | 2026-06-12 |
| 12    | Visual Token & Hex Layer | 4/4   | 2026-06-12 |
| 13    | Layout & Clock           | 3/3   | 2026-06-12 |
| 14    | Kick Off Rules & Replay  | 3/3   | 2026-06-12 |

Full archive: [milestones/v1.1-ROADMAP.md](milestones/v1.1-ROADMAP.md) · [Requirements](milestones/v1.1-REQUIREMENTS.md) · [Audit](milestones/v1.1-MILESTONE-AUDIT.md)

</details>

<details>
<summary>✅ v1.2 Team Identity & Core Fixes (Phases 15–18.4) — SHIPPED 2026-07-03</summary>

| Phase | Name                                  | Plans | Completed  |
| ----- | ------------------------------------- | ----- | ---------- |
| 15    | Team Identity                         | 3/3   | 2026-06-13 |
| 16    | Player Roster & Team Selection        | 4/4   | 2026-06-14 |
| 17    | Rule Bugs                             | 6/6   | 2026-06-21 |
| 17.1  | Action Flow Cleanup (INSERTED)        | 16/16 | 2026-06-20 |
| 18    | Messaging & Logging Consistency       | 3/3   | 2026-07-02 |
| 18.1  | Replay Review (INSERTED)              | 2/2   | 2026-06-21 |
| 18.2  | Code Cleanup & Dup-Bugs (INSERTED)    | 6/6   | 2026-06-22 |
| 18.3  | Bug-Bash: Rule Correctness (INSERTED) | 5/5   | 2026-07-02 |
| 18.4  | UX Enhancements (INSERTED)            | 7/7   | 2026-07-02 |

Full archive: [milestones/v1.2-ROADMAP.md](milestones/v1.2-ROADMAP.md) · [Requirements](milestones/v1.2-REQUIREMENTS.md)

</details>

---

## v1.3 — Team Customization & Formation System

| Phase | Name                            | Requirements                                     | Status      |
| ----- | ------------------------------- | ------------------------------------------------ | ----------- |
| 19    | Data Model & Team Palette       | PALETTE-01..03, TEAM-07, DATA-01..03, LEAGUE-03  | Not started |
| 20    | Uniform Style System            | UNIFORM-01, UNIFORM-05                           | Not started |
| 21    | New Teams (MLS + International) | TEAM-08..11, INTL-01..06, LEAGUE-01..02          | Not started |
| 22    | Uniform Selection Screen        | UNIFORM-02..04                                   | Not started |
| 23    | Formation System                | FORM-01..04                                      | Not started |
| 24    | Auto-Assignment & Lineup        | ASSIGN-01..05                                    | Not started |
| 25    | Bug & UAT Closure               | OFFSIDE-01..02, REPLAY-07..08, BUG-22..23, UX-15 | Not started |

---

## Phase Details

### Phase 19: Data Model & Team Palette

**Goal**: The foundational data layer is stable — 4-color palette model adopted, player pool established, Xolos/Cozmos retired from selectable teams, league field on TeamConfig
**Depends on**: Phase 18.4 (v1.2 complete)
**Requirements**: PALETTE-01, PALETTE-02, PALETTE-03, TEAM-07, DATA-01, DATA-02, DATA-03, LEAGUE-03
**Success Criteria** (what must be TRUE):

1. `TeamConfig` has exactly 4 palette values (`primary`, `primaryLight`, `secondary1`, `secondary2`) and `league` field; old `primaryColor`/`secondaryColor` fields are gone from all consumers
2. Xolos and Cozmos do not appear as selectable teams; their players exist in `PLAYER_POOL` with `sourceTeamId` annotation
3. All players (all prior squad members + new pool contributors) are retrievable from a single `PLAYER_POOL` export; team configs reference player IDs rather than embedding inline player objects
4. Color scheme registry retains Xolos/Cozmos palette entries as named records; TypeScript compiles clean across all packages
   **Plans**: 3 plans

Plans:

- [ ] 19-01-PLAN.md — Shared data foundation: 4-color palette, TeamId/ColorSchemeId split, COLOR_SCHEME_REGISTRY, PLAYER_POOL + seed rewrite, CSV typo fix
- [ ] 19-02-PLAN.md — Server: buildSquadPieces via getSquadPlayers; VALID_TEAM_IDS shrink to city/crew
- [ ] 19-03-PLAN.md — Client: primaryColor→palette.primary swaps, TeamId-keyed map shrink, mock + test updates
      **UI hint**: no

### Phase 20: Uniform Style System

**Goal**: A parameterized uniform rendering system exists; PieceOverlay draws jerseys from `{ uniformStyle, palette, isGK }` parameters rather than hardcoded per-team SVG patterns; City and Crew updated to new palette shape with default styles assigned
**Depends on**: Phase 19
**Requirements**: UNIFORM-01, UNIFORM-05
**Success Criteria** (what must be TRUE):

1. A `UNIFORM_STYLES` library in `packages/shared` lists at least 3 named styles, each defining an outfield rendering and a visually distinct GK variant using the same 4-color palette
2. `PieceOverlay` accepts `uniformStyle` and `palette` props; the old hardcoded per-team pattern branches are removed
3. City and Crew pieces render correctly in-game using the new parameterized system; no visual regression from v1.2 appearance
4. TypeScript compiles clean; existing tests pass without modification
   **Plans**: TBD
   **UI hint**: yes

### Phase 21: New Teams (MLS + International)

**Goal**: 12 teams are selectable across two league tabs; all 10 new teams have palettes, badges, default uniform styles, and seeded squads; the team selection screen groups teams by league with real-time cross-player struck-out feedback
**Depends on**: Phase 20
**Requirements**: TEAM-08, TEAM-09, TEAM-10, TEAM-11, INTL-01, INTL-02, INTL-03, INTL-04, INTL-05, INTL-06, LEAGUE-01, LEAGUE-02
**Success Criteria** (what must be TRUE):

1. Team selection screen has two tabs (MLS, International); clicking a tab shows that league's team cards; MLS tab is the default
2. All 10 new teams appear on their respective league tab with badge, name, and 4-color palette applied to their piece rendering
3. When home player picks a team, that team's card appears struck out simultaneously in away player's view on any tab; away player cannot select the same team
4. Each new team's squad is seeded from `PLAYER_POOL` (player IDs, not inline objects); all 12 teams have complete 11-player squads queryable at game start
   **Plans**: TBD
   **UI hint**: yes

### Phase 22: Uniform Selection Screen

**Goal**: After selecting a team, each player chooses a uniform style from the style library rendered against their team's palette; the confirmed choice persists through the match and applies to piece rendering
**Depends on**: Phase 21
**Requirements**: UNIFORM-02, UNIFORM-03, UNIFORM-04
**Success Criteria** (what must be TRUE):

1. After team selection, each player sees a uniform selection screen showing all available styles rendered against their chosen team's 4-color palette
2. The team's `defaultUniformStyle` is pre-selected when the player arrives at the screen; they may change it before confirming
3. Confirmed uniform choice is stored in game state and applied to that team's piece rendering for the duration of the match; the other player's pieces are unaffected
4. Both players must confirm their uniform choice before the flow advances; each sees "waiting for opponent" after confirming
   **Plans**: TBD
   **UI hint**: yes

### Phase 23: Formation System

**Goal**: Each player independently selects one of four formations after uniform selection; a shared `FORMATIONS` data table drives dynamic hex placement; both-player confirmation gates the transition to auto-assignment
**Depends on**: Phase 22
**Requirements**: FORM-01, FORM-02, FORM-03, FORM-04
**Success Criteria** (what must be TRUE):

1. After uniform selection, each player sees a formation selection screen with four options (4-4-2, 5-3-2, 4-3-3, 3-4-3); each option shows a mini pitch diagram and a one-line tactical description
2. A player who has confirmed their formation sees "waiting for opponent" and cannot change their selection; the game does not advance until both players have confirmed
3. Piece starting positions in `KICK_OFF_SETUP` are placed from the `FORMATIONS` lookup table keyed by `FormationId`; away positions are the symmetric mirror (`q = 36 − home_q`)
4. `GameState.selectedFormation` contains both teams' confirmed `FormationId` values after both players confirm
   **Plans**: TBD
   **UI hint**: yes

### Phase 24: Auto-Assignment & Lineup

**Goal**: After both formations are confirmed, the server auto-assigns all 11 players to formation slots; each player sees their lineup and may swap outfield players before confirming; confirmed assignment positions pieces at formation hex coordinates for KICK_OFF_SETUP
**Depends on**: Phase 23
**Requirements**: ASSIGN-01, ASSIGN-02, ASSIGN-03, ASSIGN-04, ASSIGN-05
**Success Criteria** (what must be TRUE):

1. After both formations confirm, each player immediately sees a lineup display showing every formation slot mapped to an assigned player name; GK is always in the GK slot; no slot is empty
2. Player can click any two outfield slots to swap their assigned players; the server validates and broadcasts the updated assignment; multiple swaps before confirming are permitted
3. Server rejects any swap that would move the GK player out of the GK slot; the client reflects the rejection without advancing state
4. After a player confirms their lineup, pieces are positioned at the corresponding formation hex coordinates and KICK_OFF_SETUP begins; the assigned positions persist through the setup phase
   **Plans**: TBD
   **UI hint**: yes

### Phase 25: Bug & UAT Closure

**Goal**: All known v1.2 backlog items are resolved — OFFSIDE-01/02 human UAT formally closed, GK_KICK and LOOSE_BALL_LAND replay gaps fixed, HIGH_PASS_MOVE carrier exclusion applied, KICK_OFF_SETUP shading bug eliminated, and any v1.3 playtesting issues addressed
**Depends on**: Phase 24
**Requirements**: OFFSIDE-01, OFFSIDE-02, REPLAY-07, REPLAY-08, BUG-22, BUG-23, UX-15
**Success Criteria** (what must be TRUE):

1. Two-tab live session confirms offside detection flags the correct pieces, persists correctly across non-moving turns, and clears on valid clear-path plays (OFFSIDE-01 UAT checkpoint formally closed)
2. Two-tab live session confirms the free-kick restart flow triggers on possession gain and deflect, placement rules are correct, and the restricted action set is enforced (OFFSIDE-02 UAT checkpoint formally closed)
3. GK_KICK and LOOSE_BALL_LAND delivery moves are visible in post-game replay; the ball marker updates correctly at the frames where these events occur
4. HIGH_PASS_MOVE no longer allows the original high-pass carrier to reposition onto the pass target hex; behavior matches the FIRST_TIME_PASS_MOVE fix from Phase 17.1
5. KICK_OFF_SETUP shot-path hex shading clears correctly after a SNAPSHOT_DEFLECT goal; no stale highlights remain at kickoff
   **Plans**: TBD
   **UI hint**: no

---

## Progress

| Phase                          | Milestone | Plans Complete | Status      | Completed  |
| ------------------------------ | --------- | -------------- | ----------- | ---------- |
| 1. Monorepo Scaffold           | v1.0      | 3/3            | Complete    | 2026-05-28 |
| 2. Move Validator              | v1.0      | 4/4            | Complete    | 2026-05-29 |
| 3. Server Room Manager         | v1.0      | 3/3            | Complete    | 2026-05-29 |
| 4. Game Engine + FSM           | v1.0      | 3/3            | Complete    | 2026-05-30 |
| 5. Dice Resolver               | v1.0      | 4/4            | Complete    | 2026-05-30 |
| 6. React Hex Grid              | v1.0      | 3/3            | Complete    | 2026-05-31 |
| 7. Client-Server Integration   | v1.0      | 4/4            | Complete    | 2026-06-03 |
| 7.1. UI Cleanup                | v1.0      | 3/3            | Complete    | 2026-06-04 |
| 8. Match Lifecycle             | v1.0      | 8/8            | Complete    | 2026-06-05 |
| 8.1. Cleanup                   | v1.0      | 3/3            | Complete    | 2026-06-05 |
| 8.2. Passing Cleanup           | v1.0      | 6/6            | Complete    | 2026-06-07 |
| 9. Render Deployment           | v1.0      | 2/2            | Complete    | 2026-06-08 |
| 10. Remaining Flows            | v1.0      | 5/5            | Complete    | 2026-06-11 |
| 11. Rule Correctness           | v1.1      | 4/4            | Complete    | 2026-06-12 |
| 12. Visual Token & Hex Layer   | v1.1      | 4/4            | Complete    | 2026-06-12 |
| 13. Layout & Clock             | v1.1      | 3/3            | Complete    | 2026-06-12 |
| 14. Kick Off Rules & Replay    | v1.1      | 3/3            | Complete    | 2026-06-12 |
| 15. Team Identity              | v1.2      | 3/3            | Complete    | 2026-06-13 |
| 16. Player Roster & Selection  | v1.2      | 4/4            | Complete    | 2026-06-14 |
| 17. Rule Bugs                  | v1.2      | 6/6            | Complete    | 2026-06-21 |
| 17.1. Action Flow Cleanup      | v1.2      | 16/16          | Complete    | 2026-06-20 |
| 18. Messaging & Logging Cons.  | v1.2      | 3/3            | Complete    | 2026-07-02 |
| 18.1. Replay Review            | v1.2      | 2/2            | Complete    | 2026-06-21 |
| 18.2. Code Cleanup & Dup-Bugs  | v1.2      | 6/6            | Complete    | 2026-06-22 |
| 18.3. Bug-Bash (Rule Correct.) | v1.2      | 5/5            | Complete    | 2026-07-02 |
| 18.4. UX Enhancements          | v1.2      | 7/7            | Complete    | 2026-07-02 |
| 19. Data Model & Team Palette  | v1.3      | 0/3            | Not started | —          |
| 20. Uniform Style System       | v1.3      | 0/?            | Not started | —          |
| 21. New Teams (MLS + Intl)     | v1.3      | 0/?            | Not started | —          |
| 22. Uniform Selection Screen   | v1.3      | 0/?            | Not started | —          |
| 23. Formation System           | v1.3      | 0/?            | Not started | —          |
| 24. Auto-Assignment & Lineup   | v1.3      | 0/?            | Not started | —          |
| 25. Bug & UAT Closure          | v1.3      | 0/?            | Not started | —          |
