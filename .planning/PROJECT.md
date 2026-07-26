# Counter Attack POC

## What This Is

A 2-player real-time web implementation of Counter Attack, the hex-grid football strategy board game by Webstar Games. Two players connect via a shared room code and play a complete match through a browser — no installation required. The game models the physical board faithfully: hex movement, dice rolls, pass accuracy checks, Zone of Influence, and shooting duels, with a chess-like click-to-move interface. v1.2 adds four named teams (Cozmos, Xolos, City, Crew) with badge PNGs and jersey patterns, CSV-seeded player rosters with a pre-match team-selection lobby, offside detection, 28 bug fixes, and 8 UX enhancements including game-speed selection, end-turn confirmation, final-third markers, and a transient EventBanner. v1.3 expands to 12 real-league teams across MLS/International with dynamic formation selection and stat-driven auto-assignment. v1.4 adds an optional pre-game **Draft Mode**: a configurable settings pre-step (speed, Standard/Draft toggle, player pool selection across Original/MLS/International/Legends/Icons), a 4-tier player classification and 6-round pack-draft engine, and a real-time pick-and-swap draft carousel that hands off into the existing lineup/bench screen. v1.4 also fixed 6 known gameplay bugs, though its other stated goal — reworking response-move (header/deflect/dive) activation into a consistent single-selection model — was not delivered and remains open for a future milestone.

## Core Value

Two friends can open a browser, share a room code, and play a complete match of Counter Attack against each other in real time.

## Current State

**v1.4 shipped 2026-07-22 (with one known gap).** 5 phases (30 plans, 66 tasks). Draft Mode delivered in full: game-creation settings pre-step (speed/team-type/pool selection), a configurable 4-tier player classification + 6-round position/GK-constrained pack-draft engine, a real-time pick-and-swap draft carousel, dynamic bench, and post-draft lineup hand-off with auto-numbering and team colors — recalibrated mid-milestone (Phase 30) from an initial 5-tier/7-card/keeper-safety-net design based on live-playtest feedback. 6 known gameplay bugs also fixed (undo scoping, End Turn button color, opponent stats click, deflection log format, header duel target hex, shot range validation).

**Known gap: the milestone's other stated goal — reworking response-move (header/deflect/final-third/dive/keeper-ball-in-box) activation into a consistent single-selection model with eligibility gating (RESP-01..09) — was never implemented.** The original roadmap had a Phase 27 titled "Response Activation Model"; it was replaced by "Game Creation Settings" during planning and RESP-01..09 were never picked up by phases 28-30 either. Confirmed via `.planning/v1.4-MILESTONE-AUDIT.md`: the old, pre-v1.4, per-move-type activation logic in `gameEngine.ts` is unchanged. This is the first item to consider for the next milestone.

A code-review pass on Phase 30 found and fixed one critical bug: `DRAFT_PICK`/`DRAFT_REARRANGE` could crash the entire single-instance server if sent before a formation was picked (unguarded `FORMATIONS[undefined]` dereference) — now guarded with a regression test (commit 2f9dadc).

**v1.3 shipped 2026-07-11.** 7 phases (32 plans). Expanded from 4 fictional teams to 12 real-league teams (6 MLS + 6 International) with full visual identities; 18-style uniform selection screen; 4 dynamic formations (4-4-2, 5-3-2, 4-3-3, 3-4-3) with stat-driven auto-assignment and player swap; OFFSIDE-01/02 human UAT formally closed; FREE_KICK_SETUP 6-step sequence (kicker select + stage repositioning); GK_KICK and LOOSE_BALL_LAND replay visibility fixed; jersey centering and Style 12 SVG pattern fixed.

**Test suite (as of v1.4 close):** shared 583 tests, server 614 tests (1 skipped, 1 todo), client 371 tests — 1,568 tests total, all green; full workspace typecheck clean.

**Known tech debt entering the next milestone:**

- **RESP-01 through RESP-09** — response-move single-selection activation model, entirely undelivered (see above). Highest-priority carry-forward item.
- `createServer.ts:99-167` reconnect handler-registration bug (misplaced `return`, pre-existing since Phase 07): a reconnecting socket whose room isn't currently `'playing'` never gets handlers registered — silently dead connection. Flagged twice now (Phase 29, and again at v1.4 close) without remediation.
- Phase 29's DRAFT-10 live two-browser lineup-slot-swap human verification was never actually performed (protocol-layer tests pass; no UAT artifact exists).
- Phase 28 has no Nyquist `VALIDATION.md` (compliance never scored for that phase).
- KICK_OFF_SETUP shot-path hex shading persists after SNAPSHOT_DEFLECT goal (BUG-23 — root cause unresolved, escalated; `.planning/todos/pending/`)
- FREE_KICK_SETUP Undo not implemented (undo within/across stages; `.planning/todos/pending/free-kick-setup-undo-not-implemented.md`)
- Draft-mode cosmetic debt (Phase 29/30): `DRAFT_REARRANGE` bench-index bounds validation gap (not exploitable), bench jersey numbers not assigned on post-complete rearrange, client tier-color cache doesn't survive reconnect/reload, several stale code comments describing the pre-Phase-30 pack/tier model.

**Phase 32 (Code Cleanup) complete 2026-07-25.** Validated in Phase 32: CLEANUP-01 through CLEANUP-04 (see below). Delivered: `knip` installed as a permanent CI-enforced dead-code gate (`shootTargetHex` and the unwired `ConnectionStatus` component + 3 unused mock files removed); team-accent-color and team-slot derivation consolidated into `useTeamColors`/`useMyTeam` (pure-function-core + hook-wrapper pattern, 8 call sites migrated); a full selector/derived-state review of the 952-line `useGameStore.ts` (`SELECTOR-REVIEW.md`) that found and fixed a genuine staleness bug (KICK_OFF_SETUP/FREE_KICK_SETUP highlights silently collapsing to `[]` on same-phase broadcasts) plus two duplicated-logic sites; `eslint-plugin-react-hooks` enabled at `error` for the client package with zero suppressions needed. Test suite grew to shared 583 / server 627 / client 391 (1,601 total), all green.

**Known tech debt entering Phase 33:** the whole-workspace `pnpm lint` OOMs on a pre-existing `packages/shared` typescript-eslint file-count-cap config issue (unrelated to Phase 32's changes, doesn't gate CI, documented in `.planning/phases/32-code-cleanup/deferred-items.md`).

**Phase 33 (Design Tokens & Highlight Standardization) complete 2026-07-26.** Validated in Phase 33: THEME-03, HILITE-01 through HILITE-05 (see below). Delivered: a chrome design-token layer (`packages/client/src/styles/tokens.css`) with a single runtime `--team-accent` CSS variable replacing per-component `TEAM_CONFIGS` lookups; every chrome-color CSS Module across in-game panels, lobby, settings, and team/draft selection migrated to `var(--token)`; `HexCell.tsx`'s `HIGHLIGHT_STYLES`/`RING_STYLES` extended to a single source of truth covering all 10 hex-tint types plus the compound gold ring; the goal-target tint recolored red→purple and `safe` recolored gold→green so red means offside only, app-wide within the highlight system; a standalone always-on-top white `BallLocationRing` ball-location marker added, gated to 11 response phases (including `KICK_OFF_SETUP`, added mid-phase for consistency); and `docs/HIGHLIGHT-REFERENCE.md` written as the permanent single-source-of-truth reference (HILITE-05). The plan 33-07 phase-gate checkpoint went through several rounds of human-verify iteration on the "already-moved" piece marker (HILITE-03) — a grey-ring mechanism from Plan 33-05 was tried as an app-wide unification, then contrast-tweaked, then ultimately removed entirely in favor of the pre-existing orange-ring-+-red-X `activated` state, now used consistently everywhere a piece has already acted. BUG-23 (KICK_OFF_SETUP stale shot-path shading) was included in the final approved visual checklist with no issue reported. Test suite: shared 583 / server 627 / client 407 (1,617 total), all green; code review found 0 blockers (1 warning + 2 info, both addressed).

## Current Milestone: v1.5 UX Refresh & Code Cleanup

**Goal:** Overhaul the visual system to a professional broadcast-sports look, standardize hex-highlight colors and the ActionPanel, pay down accumulated code debt, and close 3 known bugs.

**Target features:**

- Visual system overhaul (everywhere) — replace the deep-blue theme with a broadcast-sports palette (dark charcoal/graphite base, crisp white text, single team-color accent) across lobby, settings, team/draft selection, and the game board
- Hex-highlight audit & standardization — review all 10 current highlight types (free-move/blue, valid-step/yellow, pass-threat/orange, automove-target/white, header-contest-range/white, goal-line-target/red, ball-location flag/missing, eligible-target circle/blue, selected circle/green, offside/red) against UX best practices; flag conflicts (e.g. red used for both a positive shot opportunity and a negative offside warning), add the missing ball-location highlight, and standardize the resulting system
- ActionPanel & action-log standardization — consistent help-text format, no borders, consistent button display/behavior, consistent language across all states
- Code cleanup — remove dead code, refactor duplicated logic into shared functions, address inefficient code, review Zustand state-management structure
- Bug fixes (3) — replay doesn't restore all player positions at kickoff after a goal reset; eligible-players-remaining message / End Turn button should flip on move START not full activation (must also respect undo); goalkeeper is currently selectable for deflection (shouldn't be)

**Explicitly deferred (raised during scoping, not in v1.5):** RESP-01..09 response-move activation model (still the top backlog item for whatever comes after v1.5); out-of-bounds/restarts (throw-in, corner, goal kick); fouls/cards/bookings/subs; game-stats overlay (possession, tackles, shots, goals, xG, interceptions, saves).

## Completed Milestone: v1.4 Response Polish + Draft Mode

**Goal:** Rework all response-move activations into a consistent single-selection model with proper eligibility gating, fix 6 known gameplay bugs, and add a configurable pack-draft system as an optional pre-game mode.

**Delivered:**

- Bug fixes (6/6) — BUG-24 undo restricted to current phase, BUG-25 end-turn button color logic, BUG-26 opponent activated player stats, BUG-27 deflection log format, BUG-28 header targeting goal, BUG-29 standard shot range validation
- Draft mode (11/11 requirements) — game-creation settings pre-step (speed + team type + player pool across 5 pools); 4-tier fixed-threshold player classification; 6-round, position/GK-constrained pack-draft engine (17 cards/player, recalibrated from an initial 5-tier/7-card/keeper-safety-net design in Phase 30); real-time pick-and-swap draft carousel; dynamic bench carousel; post-draft lineup hand-off with auto-numbering and team colors

**Not delivered:**

- Response activation cleanup (RESP-01..09) — single-selection model for all response moves (header, deflect, final third, dive, keeper ball in box) was never implemented in any phase. Deferred to a future milestone — see Current State above and `.planning/v1.4-MILESTONE-AUDIT.md`.

Full detail: [milestones/v1.4-ROADMAP.md](milestones/v1.4-ROADMAP.md) · [Requirements](milestones/v1.4-REQUIREMENTS.md) · [Audit](milestones/v1.4-MILESTONE-AUDIT.md)

## Completed Milestone: v1.3 Team Customization & Formation System

**Goal:** Expand from 4 fictional teams to 12 real-league teams grouped by league, add dynamic formation selection at kickoff with stat-driven auto-assignment, decouple team/player data to support v1.4 draft mode, and close all known v1.2 backlog bugs.

**Target features:**

- Team library — 12 selectable teams across MLS (City, Crew + 4 new) and International (6 new); Xolos/Cozmos retired as color schemes + player pool contributors; color scheme entity decoupled from team identity
- Formation selection — 4-4-2, 5-3-2, 4-3-3, 3-4-3 chosen at each kickoff; hex starting positions placed dynamically per formation
- Auto-assign with override — System assigns 11 players to roles by stat weight (anchor: CB/CM/CF; flex: FB, winger, flex-mid), player can swap before confirming lineup
- v1.4 data foundations — Player pool as global entity; color scheme as reusable visual identity; architecture supports random draft next milestone
- Bug & UX block — OFFSIDE-01/02 UAT closure, GK_KICK/LOOSE_BALL_LAND replay gaps, HIGH_PASS_MOVE carrier exclusion, plus any v1.3 regressions

## Requirements

### Validated (v1.0)

All 65 satisfied requirements are archived in [.planning/milestones/v1.0-REQUIREMENTS.md](milestones/v1.0-REQUIREMENTS.md).

Key groups:

- **ARCH-01..07**: Server-authoritative pnpm monorepo; pure shared validation; axial coordinates; full-snapshot broadcast; Render deployment (AWS EB-compatible)
- **CONN-01..04**: Room create/join, session middleware, reconnect with 90s grace timer
- **MOVE-01..05, MOVE-07**: 4-5-2 movement sequence, Pace caps, occupancy rules, ZoI steal, snapshot in box
- **PASS-01..05, HEAD-01..05**: All four pass types, heading duels, header-at-goal, HEAD-05 exclusion
- **SHOT-01..06, SNAP-01..03**: Shot/save duels, GK_DIVING, handling check, SNAP_DEFLECT path-deflection
- **MATCH-01..05, REPLAY-01..03**: Two-half match with added time, kick off procedure, post-game replay
- **DICE-01..05, UNDO-01..04, UX-01..04, TEAM-01..03, PITCH-01..05**: Full rules, UX, player attributes

### Validated (v1.1)

All v1.1 requirements are archived in [.planning/milestones/v1.1-REQUIREMENTS.md](milestones/v1.1-REQUIREMENTS.md).

- ✓ **VIS-01, VIS-02** — Token stripe design (home vertical, away horizontal) in all contexts — v1.1
- ✓ **UX-05, UX-06** — Selection state outlines (blue/green/orange) + 5-type hex tint system — v1.1
- ✓ **LAYOUT-01, LAYOUT-02** — Persistent top-band scoreboard + action/log panel — v1.1
- ✓ **CLOCK-01, CLOCK-02** — MM:00 event-driven clock visible in all phases — v1.1
- ✓ **RULE-01..05** — Header sequencing, snapshot cleanup, deflection pace, post-deflect Movement Phase — v1.1
- ✓ **MATCH-07** — KICKOFF_STANDARD_PASS_ONLY guard server + client — v1.1 (wired; req unchecked)
- ✓ **REPLAY-04, REPLAY-05** — 500ms cadence, simultaneous step-frames — v1.1 (wired; req unchecked)
- ✗ **REPLAY-06** — Ball tracking live-session bugs deferred to v1.2 — v1.1 partial

### Validated (v1.2)

All v1.2 requirements are archived in [.planning/milestones/v1.2-REQUIREMENTS.md](milestones/v1.2-REQUIREMENTS.md).

- ✓ **TEAM-01..06** — Four named teams with badge PNGs, jersey patterns, and color system — Phase 15
- ✓ **PLAY-01..03, SELECT-01** — CSV-seeded rosters, player card redesign, team-selection lobby — Phase 16
- ✓ **BUG-01..05, MOVE-06, PASS-02** — Seven rule-correctness defects fixed and verified — Phase 17 / 17.1
- ✓ **DESIGN-01, MATCH-06** — Messaging/logging convention sweep + MATCH-06 text fix — Phase 18
- ✓ **DESIGN-02, REPLAY-06** — Replay frame visibility + post-game playback optimization — Phase 18.1
- ✓ **DESIGN-03, DESIGN-04** — Duplicate-logic consolidation + dead-code removal — Phase 18.2
- ✓ **BUG-06..21** — 16 bug-bash fixes (rule correctness, client UX, movement state machine) — Phases 18.2/18.3
- ✓ **UX-07..14** — 8 UX enhancements (game speed, end-turn dialog, final-third lines, tooltips, EventBanner) — Phase 18.4
- ✓ **OFFSIDE-01, OFFSIDE-02** — Human UAT formally closed (Phase 25 two-tab session)

### Validated (v1.3 — complete)

- ✓ **UNIFORM-02** — Away player sees style tiles in their team's away colors (awayPrime/awayAlt) — Phase 22
- ✓ **UNIFORM-03** — 18 style tiles in 2×9 grid; defaultUniformStyle pre-selected on team pick — Phase 22
- ✓ **UNIFORM-04** — Full selection flow: home picks first → away unlocks → both confirm → game starts with chosen styles on pieces — Phase 22
- ✓ **LEAGUE-01..03** — League categorization, MLS 6-team + International 6-team sets — Phases 19–21
- ✓ **TEAM-07..10, INTL-01..06** — 10 new teams with full visual identity (badge, jersey, color) — Phase 21
- ✓ **DATA-01..03** — ColorScheme entity, global player pool, team/player decoupling — Phase 19
- ✓ **FORM-01..04** — Four formations with dynamic hex placement — Phase 23
- ✓ **ASSIGN-01..04** — Stat-weight auto-assignment + player swap override + lineup confirm gate — Phase 24
- ✓ **REPLAY-07, REPLAY-08** — GK_KICK and LOOSE_BALL_LAND delivery visible in replay — Phase 25
- ✓ **BUG-22** — HIGH_PASS_MOVE carrier exclusion documented/applied — Phase 25
- ✓ **UX-15** — Jersey number centering, Style 12 symmetric quarters, EventBanner, uniform-selection race fix — Phase 25
- ✓ **OFFSIDE-01, OFFSIDE-02** — Free-kick step sequence (kicker select + 6 stages) implemented and UAT-closed — Phases 25

### Validated (v1.4 — complete)

- ✓ **BUG-24..29** — 6 known gameplay defects fixed and verified (undo scoping, End Turn button color, opponent stats click, deflection log format, header duel target hex, shot range validation) — Phase 26
- ✓ **DRAFT-01..03** — Game-creation pre-step settings screen (speed + team type + draft pool), Standard-mode speed moved off team-selection, Draft-mode settings summary line — Phase 27
- ✓ **DRAFT-04, DRAFT-05, DRAFT-08** — Player tier classification and pack-draft engine — delivered in Phase 28/29 as a 5-tier/7-card/keeper-safety-net model, then intentionally superseded in Phase 30 by a 4-tier fixed-threshold/6-round/dedicated-GK-round model based on live-playtest feedback
- ✓ **DRAFT-06, DRAFT-07, DRAFT-09, DRAFT-10** — Draft carousel, pick-and-swap protocol, dynamic bench, post-draft lineup hand-off — Phase 29 (DRAFT-10's live two-browser human-verification step remains unperformed — see Current State)
- ✓ **DRAFT-11** — Legends and Icons pools selectable, client + server allow-listed — Phase 30

### Deferred (carried forward from v1.4 — not scheduled for v1.5)

- [ ] **RESP-01..09** — Response-move (header/deflect/final-third/dive/keeper-ball-in-box) single-selection activation model with eligibility gating, range-hex highlighting, and auto-skip. Not delivered in v1.4 despite being half of that milestone's stated goal; explicitly deferred again during v1.5 scoping — see Current State and `.planning/v1.4-MILESTONE-AUDIT.md`. Top candidate for whatever comes after v1.5.

### Deferred (v2 candidates)

- [ ] Fouls, yellow/red cards, booking checks — feature-flagged toggle at game creation (raised during v1.5 scoping as priority #4)
- [ ] Injuries and resilience checks
- [ ] Corner kicks, throw-ins, free kicks, penalty kicks — feature-flagged toggle at game creation (raised during v1.5 scoping as priority #3)
- [ ] Nutmeg, reckless tackle, last-man foul, professional foul
- [ ] Substitutions — bundled with priority #4 (fouls/cards) above
- [ ] Offside enforcement
- [ ] Game-stats overlay — possession, tackles, shots, goals, xG, interceptions, saves (raised during v1.5 scoping as priority #5)
- [ ] Reconnection grace period (server holds room state for disconnected player) — note: a related bug exists today (`createServer.ts` misplaced `return`) that leaves some reconnecting sockets with no handlers at all; see Current State
- [ ] Rematch flow
- [ ] Chat
- [ ] Draft history/replay (DRAFT-12), async draft mode (DRAFT-13)

### Out of Scope

- AI / single-player mode — not planned
- Animations (piece movement between hexes) — static state updates only
- Mobile layout — desktop-first (responsive-aware but not mobile-first)
- Sound effects / audio
- Custom team / card editor — hardcoded teams only
- Spectator mode — not planned

## Context

- Rules reference: Counter Attack Rules Reference Rulebook v1.4.1 (Giannis Tilias)
- Physical board: 37×26 axial hex grid, flat-top orientation, HEX_SIZE=20px
- Kick-off hex: `{q:18, r:13}` (board centre)
- Difficult-angle hexes: 16 corner-kick zone hexes (4 per corner)
- Hardcoded squads: two tier-balanced teams, attributes on 1–6 scale
- Deployment: Render web service (Express + Socket.io + static client from single process)
- Test suite (v1.4 close): 583 shared + 614 server (1 skipped, 1 todo) + 371 client = 1,568 tests total

## Constraints

- **Tech — Backend**: Node.js + Socket.io; keeps the WebSocket layer portable to AWS (EC2, Elastic Beanstalk, ECS)
- **Tech — Frontend**: React (Vite); served as static files, can be hosted on S3+CloudFront later
- **Deployment target**: Render (v1.0 POC); AWS EB-compatible with no code changes required
- **Scope**: Core rules only in v1; full rulebook fidelity deferred to future milestones
- **Multiplayer**: Real-time only (no async/turn-timer mode); requires active WebSocket connection

## Key Decisions

| Decision                                                                                           | Rationale                                                                                                                                    | Outcome                                                                                                             |
| -------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Server-authoritative game state                                                                    | Prevents cheating, simplifies sync, maps cleanly to AWS stateful containers                                                                  | Implemented — full snapshot broadcast after every action; `isProcessing` mutex                                      |
| Socket.io over raw WebSockets                                                                      | Handles reconnection and room management out of the box; negligible overhead                                                                 | Implemented — typed events via generics; `transports: ['websocket']` only (no polling)                              |
| React + Vite frontend                                                                              | Fast dev loop, static build output suitable for S3+CloudFront                                                                                | Implemented — `vite build` → `dist/`; served by Express in production                                               |
| Hardcoded teams for v1                                                                             | Eliminates card editor scope; lets us validate gameplay loop first                                                                           | Validated — two tier-balanced squads ship in v1.0                                                                   |
| Core rules only for v1                                                                             | Fouls/injuries add significant state complexity; validate core loop before adding edge cases                                                 | Validated — all 65 core-rule requirements satisfied                                                                 |
| Render deployment over AWS EB                                                                      | Simpler first deploy; no Elastic Beanstalk config overhead; Render Blueprint IaC                                                             | Validated — single web service, `render.yaml`, CI gate on push; AWS EB path preserved                               |
| SVG over Canvas for rendering                                                                      | ≤600 hexes well within SVG performance range; DevTools-inspectable; CSS transitions free                                                     | Validated — 37×26 grid renders performantly; no Canvas needed                                                       |
| Zustand over Redux for client state                                                                | Zero boilerplate; per-slice selectors prevent full re-renders; socket handlers call setState                                                 | Validated — per-slice selectors throughout; no render-all issues observed                                           |
| MM:00 clock format over MM:SS                                                                      | Event-driven actionCount is precise; real-time wall clock would drift from server state                                                      | Validated (v1.1) — D-08 override accepted; CLOCK-01 spec updated in spirit                                          |
| HALF_TIME/FULL_TIME as pitch overlays                                                              | Keeps top band + clock always visible; eliminates separate Screen routing paths                                                              | Validated (v1.1) — D-12; 6 dead component files deleted; Screen type trimmed to 6 members                           |
| SelectionState enum over boolean bag                                                               | 4 booleans → 1 enum; single ternary for ring color; cleaner prop contract                                                                    | Validated (v1.1) — PieceOverlay selectionState: none/selectable/active/activated                                    |
| HexHighlightType union + priority ternary                                                          | Eliminates prop drilling of colors; single source of truth in HIGHLIGHT_STYLES table                                                         | Validated (v1.1) — risk > goal > shot-path > kickoff > safe; 5 tint types distinct                                  |
| badgeFile as filename key only                                                                     | Static Vite import in TeamBadge gives content-hashed URLs; no runtime resolution needed                                                      | Validated (v1.2) — PNG badge renders correctly in scoreboard and player card at build time                          |
| TEAM_CONFIGS color source of truth                                                                 | Eliminates positional home/away color strings; single lookup per team across all surfaces                                                    | Validated (v1.2) — GameBoard, ActionLog, PlayerStatsPanel all use TEAM_CONFIGS[teamId]                              |
| firstTimePassCarrierId in GameState                                                                | Prevents self-pass reclaim exploit; mirrors highPassCarrierId lifecycle                                                                      | Validated (v1.2) — passer excluded from FTP repositioning target and delivery occupant                              |
| computeLooseBall cube-coordinate vectors                                                           | Eliminates systematic NE/SW overshoot caused by fixed ODD-Q offset deltas on axial grid                                                      | Validated (v1.2) — 72-case regression test; clamp walk per-step from gameEngine.ts                                  |
| FTP_MOVE_ENABLED=false feature flag                                                                | Disables FIRST_TIME_PASS_MOVE sub-phase by default; code kept for future toggle                                                              | Validated (v1.2) — direct delivery path mirrors STANDARD_PASS behavior                                              |
| checkHalfEndOnTackle exported helper                                                               | Gates half-end correctly on tackle/steal paths; reads addedTime without re-rolling                                                           | Validated (v1.2) — called at 3 tackle/steal success sites; 9 regression tests                                       |
| UniformSelectionScreen replaces tabbed TeamSelectionScreen                                         | Single screen with flat 6×2 team grid + 2×9 style tile grid; no tabs; home picks first, away locked until home confirms                      | Validated (v1.3/Ph22) — UNIFORM-02/03/04; UAT 11/11 passed                                                          |
| awayLocked gate on UNIFORM_CONFIRM ordering                                                        | Server rejects away UNIFORM_CONFIRM before home confirms (WRONG_TURN); client shows locked state until homeConfirmedStyle set                | Validated (v1.3/Ph22) — Nyquist G2/G3 integration tests                                                             |
| mix-blend-mode: multiply on team badges                                                            | Removes white PNG backgrounds on colored card backgrounds without modifying source PNG files                                                 | Validated (v1.3/Ph22) — UAT Test 3                                                                                  |
| tileRenderPalette for away style tiles                                                             | Away player sees their team's away colors (awayPrime/awayAlt) on style tiles, not home palette                                               | Validated (v1.3/Ph22) — UNIFORM-02; UAT Test 9                                                                      |
| draftEngine.ts/draftSession.ts as pure, socket-independent modules                                 | Mirrors gameEngine.ts's separation from the socket layer; keeps draft logic server-authoritative and independently testable                  | Validated (v1.4/Ph28-29) — zero io/socket dependencies in either module                                             |
| Draft carousel + lineup/bench merged into one screen                                               | Dragging a card off the pack carousel directly onto a lineup slot or bench drafts and places in one motion — no separate pick/lineup screens | Validated (v1.4/Ph29/D-05) — deliberate scope interpretation, documented in 29-CONTEXT.md                           |
| Phase 30 draft recalibration (5-tier/7-card/keeper-safety-net → 4-tier/6-round/dedicated-GK-round) | Live-playtest feedback showed the original model needed rebalancing before ship, not a defect                                                | Validated (v1.4/Ph30) — DRAFT-04/05/08 marked "superseded design" in requirements archive, not silently overwritten |

## Evolution

This document is updated at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):

1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):

1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---

_Last updated: 2026-07-26 — Phase 33 (Design Tokens & Highlight Standardization) complete_
