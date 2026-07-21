# Roadmap — Counter Attack Web

## Milestones

- ✅ **v1.0 MVP** — Phases 1–10 (shipped 2026-06-11)
- ✅ **v1.1 UX Tuning & Bug Cleanup** — Phases 11–14 (shipped 2026-06-12)
- ✅ **v1.2 Team Identity & Core Fixes** — Phases 15–18 (shipped 2026-07-03)
- ✅ **v1.3 Team Customization & Formation System** — Phases 19–25 (shipped 2026-07-11)
- 🚧 **v1.4 Response Polish + Draft Mode** — Phases 26–30 (in progress)

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

| Phase | Name                               | Plans | Completed  |
| ----- | ---------------------------------- | ----- | ---------- |
| 15    | Team Identity                      | 3/3   | 2026-06-13 |
| 16    | Player Roster & Team Selection     | 4/4   | 2026-06-14 |
| 17    | Rule Bugs                          | 6/6   | 2026-06-21 |
| 17.1  | Action Flow Cleanup (INSERTED)     | 16/16 | 2026-06-20 |
| 18    | Messaging & Logging Consistency    | 3/3   | 2026-07-02 |
| 18.1  | Replay Review (INSERTED)           | 2/2   | 2026-06-21 |
| 18.2  | Code Cleanup & Dup-Bugs (INSERTED) | 6/6   | 2026-06-22 |
| 18.3  | Bug-Bash: Rule Correctness         | 5/5   | 2026-07-02 |
| 18.4  | UX Enhancements (INSERTED)         | 7/7   | 2026-07-02 |

Full archive: [milestones/v1.2-ROADMAP.md](milestones/v1.2-ROADMAP.md) · [Requirements](milestones/v1.2-REQUIREMENTS.md)

</details>

<details>
<summary>✅ v1.3 Team Customization & Formation System (Phases 19–25) — SHIPPED 2026-07-11</summary>

| Phase | Name                            | Plans | Completed  |
| ----- | ------------------------------- | ----- | ---------- |
| 19    | Data Model & Team Palette       | 3/3   | 2026-07-03 |
| 20    | Uniform Style System            | 3/3   | 2026-07-04 |
| 21    | New Teams (MLS + International) | 2/2   | 2026-07-04 |
| 22    | Uniform Selection Screen        | 3/3   | 2026-07-05 |
| 23    | Formation System                | 3/3   | 2026-07-05 |
| 24    | Auto-Assignment & Lineup        | 4/4   | 2026-07-10 |
| 25    | Bug & UAT Closure               | 9/9   | 2026-07-11 |

Full archive: [milestones/v1.3-ROADMAP.md](milestones/v1.3-ROADMAP.md) · [Requirements](milestones/v1.3-REQUIREMENTS.md) · [Audit](milestones/v1.3-MILESTONE-AUDIT.md)

</details>

---

### 🚧 v1.4 Response Polish + Draft Mode (Phases 26–30)

**Milestone Goal:** Rework all response-move activations into a consistent single-selection model with proper eligibility gating, fix 6 known gameplay bugs, and add a configurable pack-draft system as an optional pre-game mode.

- [x] **Phase 26: Bug Fixes** - Fix 6 known gameplay defects (undo scope, button color, opponent stats, deflection log, header targeting, shot range) (completed 2026-07-12)
- [x] **Phase 27: Game Creation Settings** - Pre-step settings screen (speed + team type + draft pool) before team selection (completed 2026-07-21)
- [x] **Phase 28: Draft Data Model** - Player tier classification and configurable pack generation engine (completed 2026-07-21)
- [x] **Phase 29: Draft UI + Pick-and-Swap Flow** - Draft carousel, 4-cycle pick-and-swap protocol, keeper safety, dynamic bench, post-draft lineup (gaps found in human verification 2026-07-21; gap-closure plans 29-07/29-08/29-09 queued — see 29-VERIFICATION.md) (completed 2026-07-21)

---

## Phase Details

### Phase 26: Bug Fixes

**Goal**: Known gameplay defects are corrected — undo is scoped to the current phase, button color logic matches move-slot state, opponent stats are accessible on click, deflection logs use the correct format, header targeting lands on a valid goal-side hex, and shot range validation uses the correct distance calculation.
**Depends on**: Phase 25
**Requirements**: BUG-24, BUG-25, BUG-26, BUG-27, BUG-28, BUG-29
**Success Criteria** (what must be TRUE):

1. Player cannot undo moves from a previous turn or phase; the undo button is disabled when no moves have been made in the current phase or all current-phase moves are already undone
2. The End Turn button is yellow while move options remain and turns green only when all movement options for the current slot are exhausted
3. Clicking an opponent's activated player opens that player's stats panel
4. Deflection log entries appear as `failed to deflect — [reason]` consistently
5. Winning a header duel results in a valid goal-side target hex being assigned; no invalid or unreachable hex is used
6. Standard shot range validation correctly rejects shots from outside valid distance using the correct distance calculation
   **Plans**: 3 plans
   Plans:
   **Wave 1**

- [x] 26-01-PLAN.md — BUG-24: scope Undo to current phase/FREE_KICK_SETUP stage (server regression + client canUndo guard)

**Wave 2** _(blocked on Wave 1 completion)_

- [x] 26-02-PLAN.md — BUG-28 + BUG-29: header-duel target range + standard shot range validation
- [x] 26-03-PLAN.md — BUG-25 + BUG-26 + BUG-27: End Turn color, opponent stats click, deflection log format

### Phase 27: Game Creation Settings

**Goal**: Game creation has a pre-step settings screen where speed, team type (Standard or Draft), and draft pool are configured before team selection; the speed selector moves off the team-selection page in Standard mode; Draft mode shows a settings summary on the team-selection screen.
**Depends on**: Phase 26
**Requirements**: DRAFT-01, DRAFT-02, DRAFT-03
**Success Criteria** (what must be TRUE):

1. Creating a game shows a settings pre-step screen with a speed selector, team type toggle (Standard / Draft), and — when Draft is selected — player pool checkboxes (Original, MLS, International; at least one required)
2. In Standard mode, speed is configured on the settings screen (not on team-selection); the existing team-selection flow is otherwise unchanged
3. In Draft mode, the team-selection screen shows a settings summary line (Speed | Team type | Draft pool) replacing the speed picker; the rest of the team-selection flow is unchanged
   **Plans**: 5 plans
   **UI hint**: yes

Plans:

**Wave 1**

- [x] 27-01-PLAN.md — Shared vocabulary: TeamType/DraftPoolId/SELECTABLE_DRAFT_POOLS types + ROOM_SETTINGS_CONFIRM/ROOM_SETTINGS_CONFIRMED event pair

**Wave 2** _(blocked on Wave 1)_

- [x] 27-02-PLAN.md — Server: host-only ROOM_SETTINGS_CONFIRM handler, Room settings fields, and the settings-confirmed/joiner-present race gate (test-first)
- [x] 27-03-PLAN.md — Client: GameSettingsScreen (speed + team type + draft pools), GAME_SETTINGS routing, shared SPEED_OPTIONS extraction

**Wave 3** _(blocked on 27-03)_

- [x] 27-04-PLAN.md — Read-only speed subheader (DRAFT-02) + Draft settings summary line (DRAFT-03) on both pre-game screens

**Wave 4** _(final)_

- [x] 27-05-PLAN.md — D-08 scoreboard speed reminder + phase-level human verification checkpoint

### Phase 28: Draft Data Model

**Goal**: The player pool is classified into configurable rarity tiers by total stat count, and the pack generation engine produces correctly-composed 7-card packs from the selected pool using configurable constants.
**Depends on**: Phase 27
**Requirements**: DRAFT-04, DRAFT-05
**Success Criteria** (what must be TRUE):

1. Every player in the pool is assigned a tier (Keeper / Chase / Rare / Uncommon / Common) based on total stat count using configurable percentage thresholds
2. A 7-card pack generated from the selected player pool contains the correct per-rarity composition (default: 1 Chase, 1 Rare, 1 Uncommon, 3 Common, 1 Keeper)
3. All tier-boundary percentages and pack composition counts are exported configurable constants — changing a constant alone adjusts tier assignment or pack composition without additional code changes
   **Plans**: 4 plans

Plans:

**Wave 1**

- [x] 28-01-PLAN.md — Data foundation: thread `poolTag` through CSV→seed→teams.ts; add `DraftTier` / `TIER_PERCENTILE_BOUNDS` / `PACKS_PER_MATCH` / `PACK_COMPOSITION` to types.ts

**Wave 2** _(blocked on 28-01)_

- [x] 28-02-PLAN.md — draftEngine.ts: pool derivation + total-stat + rank-based tier classification (DRAFT-04)

**Wave 3** _(blocked on 28-02)_

- [x] 28-03-PLAN.md — draftEngine.ts: batch pack generation + pool-shortage backfill + injected RNG (DRAFT-05)

**Wave 4** _(blocked on 28-03)_

- [x] 28-04-PLAN.md — Server-authoritative `generateMatchPacks` binding `crypto.randomInt` + end-to-end integration test

### Phase 29: Draft UI + Pick-and-Swap Flow

**Goal**: Players can complete a full draft session in real time — a 7-card carousel screen appears between team selection and lineup; 4 pick-and-swap cycles deliver 16 cards per player; keeper safety triggers automatically on the 4th cycle if needed; overflow drafted players appear on a dynamic bench carousel; post-draft, players are NOT auto-repositioned (the lineup/bench arrangement made during the draft stands, D-15) — jersey numbers are applied automatically (starters keep their role-appropriate slot numbers; bench players receive a random unused number in the 15-99 range, D-15/D-16) and team colors are applied.
**Depends on**: Phase 28
**Requirements**: DRAFT-06, DRAFT-07, DRAFT-08, DRAFT-09, DRAFT-10
**Success Criteria** (what must be TRUE):

1. A draft screen appears between formation selection and lineup, displaying a 7-card carousel above the lineup grid
2. Players complete 4 draft cycles following the pick-and-swap pattern (pick 1 → swap packs; pick 2 → swap packs; pick 1 → open new pack; repeat ×4 = 16 cards per player) via real-time WebSocket coordination
3. On the 4th cycle, if a player has not yet picked a keeper after their first pick, a keeper is automatically selected as their second pick; that player selects 1 card (not 2) in the following pick phase
4. All drafted players not placed in the starting 11 appear on a dynamically-sized bench carousel using the same card display as the draft stage
5. After the draft completes, players are NOT auto-repositioned — the lineup/bench arrangement made during the draft stands (D-15); jersey numbers are applied automatically (starters keep their role-appropriate slot numbers; bench players receive a random unused number in the 15-99 range, not sequential, D-15/D-16); team badge and colors are applied to all player cards
   **Plans**: 6 plans
   **UI hint**: yes

Plans:

**Wave 1**

- [x] 29-01-PLAN.md — Shared draft contract: DraftSession/DraftClientView/DraftDestination types + DRAFT_PICK/DRAFT_REARRANGE/DRAFT_STATE_UPDATED events + Room.draftSession field
- [x] 29-02-PLAN.md — Server pure state machine (draftSession.ts): pack→player assignment, pick application, 1+2+1 cycle machine, keeper safety, bench numbering (+ unit tests) [Wave 2, blocked on 29-01]
- [x] 29-03-PLAN.md — Client carousels: DraftPackCarousel + BenchCarousel + tier-border/carousel CSS (+ component tests) [Wave 2, blocked on 29-01]
- [x] 29-04-PLAN.md — Server wiring: settings pack-gen, UNIFORM_CONFIRM draft gate, DRAFT_PICK/DRAFT_REARRANGE handlers, reconnect resume (+ integration tests) [Wave 3, blocked on 29-02]
- [x] 29-05-PLAN.md — Client screen: LineupAssignmentScreen draftMode + App routing + DRAFT_STATE_UPDATED wiring (+ component tests) [Wave 3, blocked on 29-03]
- [x] 29-06-PLAN.md — Full-suite gate + two-browser human-verify checkpoint [Wave 4, blocked on 29-04/29-05]

**Gap Closure (from 29-06 human verification — see 29-VERIFICATION.md)**

- [x] 29-07-PLAN.md — Server draft→game lifecycle fixes: allow post-draft DRAFT_REARRANGE before Confirm + resolve drafted roster (draftSession.\*LineupSlots) into LINEUP_CONFIRM/game start (+ integration tests) [Wave 1]
- [x] 29-08-PLAN.md — Client bench carousel chrome + wider legible cards + drag-state robustness + Confirm-gating on full lineup (+ component tests) [Wave 1]
- [x] 29-09-PLAN.md — Re-verification: full automated gate + two-browser walkthrough (post-draft rearrange, bench carousel, hand-off stats, DRAFT-08 keeper-safety re-test, D-13 reconnect) [Wave 2, blocked on 29-07/29-08]

**Gap Closure (from 29-09 re-verification — see 29-VERIFICATION.md Gap 1)**

- [x] 29-10-PLAN.md — Fix lineup slot↔slot rearrangement to be a true two-way swap (applyRearrange), preserve D-07 bench-displacement for draft/bench-origin moves; narrow D-07 + add D-24; unit + integration tests [Wave 1]

**Gap Closure (from 29-10 re-verification — see 29-VERIFICATION.md Critical Gaps #1 / 29-REVIEW.md CR-01/CR-02/CR-03)**

- [x] 29-11-PLAN.md — Draft→game lifecycle guards: reject premature LINEUP_CONFIRM (CR-01, new DRAFT_NOT_COMPLETE), reject post-start DRAFT_PICK (CR-02, mirror DRAFT_REARRANGE guard), widen reconnect re-sync to the post-complete/pre-confirm window (CR-03); + regression tests (WR-02) [Wave 1]

**Gap Closure (from 29-11 re-verification — see 29-VERIFICATION.md Critical Gaps #1 / 29-REVIEW.md CR-02: bench carousel scroll instability)**

- [ ] 29-12-PLAN.md — Bench carousel scroll stability (DRAFT-09): memoize `benchCards` in LineupAssignmentScreen (stable reference) + re-key BenchCarousel's scroll-reset effect on a content-derived `benchKey` (not `cards` identity) so drag-over/rejection-timeout re-renders no longer snap scroll to leftmost; + regression test [Wave 1]

---

## Progress

| Phase                          | Milestone | Plans Complete | Status   | Completed  |
| ------------------------------ | --------- | -------------- | -------- | ---------- |
| 1. Monorepo Scaffold           | v1.0      | 3/3            | Complete | 2026-05-28 |
| 2. Move Validator              | v1.0      | 4/4            | Complete | 2026-05-29 |
| 3. Server Room Manager         | v1.0      | 3/3            | Complete | 2026-05-29 |
| 4. Game Engine + FSM           | v1.0      | 3/3            | Complete | 2026-05-30 |
| 5. Dice Resolver               | v1.0      | 4/4            | Complete | 2026-05-30 |
| 6. React Hex Grid              | v1.0      | 3/3            | Complete | 2026-05-31 |
| 7. Client-Server Integration   | v1.0      | 4/4            | Complete | 2026-06-03 |
| 7.1. UI Cleanup                | v1.0      | 3/3            | Complete | 2026-06-04 |
| 8. Match Lifecycle             | v1.0      | 8/8            | Complete | 2026-06-05 |
| 8.1. Cleanup                   | v1.0      | 3/3            | Complete | 2026-06-05 |
| 8.2. Passing Cleanup           | v1.0      | 6/6            | Complete | 2026-06-07 |
| 9. Render Deployment           | v1.0      | 2/2            | Complete | 2026-06-08 |
| 10. Remaining Flows            | v1.0      | 5/5            | Complete | 2026-06-11 |
| 11. Rule Correctness           | v1.1      | 4/4            | Complete | 2026-06-12 |
| 12. Visual Token & Hex Layer   | v1.1      | 4/4            | Complete | 2026-06-12 |
| 13. Layout & Clock             | v1.1      | 3/3            | Complete | 2026-06-12 |
| 14. Kick Off Rules & Replay    | v1.1      | 3/3            | Complete | 2026-06-12 |
| 15. Team Identity              | v1.2      | 3/3            | Complete | 2026-06-13 |
| 16. Player Roster & Selection  | v1.2      | 4/4            | Complete | 2026-06-14 |
| 17. Rule Bugs                  | v1.2      | 6/6            | Complete | 2026-06-21 |
| 17.1. Action Flow Cleanup      | v1.2      | 16/16          | Complete | 2026-06-20 |
| 18. Messaging & Logging Cons.  | v1.2      | 3/3            | Complete | 2026-07-02 |
| 18.1. Replay Review            | v1.2      | 2/2            | Complete | 2026-06-21 |
| 18.2. Code Cleanup & Dup-Bugs  | v1.2      | 6/6            | Complete | 2026-06-22 |
| 18.3. Bug-Bash (Rule Correct.) | v1.2      | 5/5            | Complete | 2026-07-02 |
| 18.4. UX Enhancements          | v1.2      | 7/7            | Complete | 2026-07-02 |
| 19. Data Model & Team Palette  | v1.3      | 3/3            | Complete | 2026-07-03 |
| 20. Uniform Style System       | v1.3      | 3/3            | Complete | 2026-07-04 |
| 21. New Teams (MLS + Intl)     | v1.3      | 2/2            | Complete | 2026-07-04 |
| 22. Uniform Selection Screen   | v1.3      | 3/3            | Complete | 2026-07-05 |
| 23. Formation System           | v1.3      | 3/3            | Complete | 2026-07-05 |
| 24. Auto-Assignment & Lineup   | v1.3      | 4/4            | Complete | 2026-07-10 |
| 25. Bug & UAT Closure          | v1.3      | 9/9            | Complete | 2026-07-11 |
| 26. Bug Fixes                  | v1.4      | 3/3            | Complete | 2026-07-12 |
| 27. Game Creation Settings     | v1.4      | 5/5            | Complete | 2026-07-21 |
| 28. Draft Data Model           | v1.4      | 4/4            | Complete | 2026-07-21 |
| 29. Draft UI + Pick-and-Swap   | v1.4      | 11/11          | Complete | 2026-07-21 |
