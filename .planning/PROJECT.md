# Counter Attack POC

## What This Is

A 2-player real-time web implementation of Counter Attack, the hex-grid football strategy board game by Webstar Games. Two players connect via a shared room code and play a complete match through a browser — no installation required. The game models the physical board faithfully: hex movement, dice rolls, pass accuracy checks, Zone of Influence, and shooting duels, with a chess-like click-to-move interface. v1.2 adds four named teams (Cozmos, Xolos, City, Crew) with badge PNGs and jersey patterns, CSV-seeded player rosters with a pre-match team-selection lobby, offside detection, 28 bug fixes, and 8 UX enhancements including game-speed selection, end-turn confirmation, final-third markers, and a transient EventBanner. v1.3 expands to 12 real-league teams across MLS/International with dynamic formation selection and stat-driven auto-assignment. v1.4 adds an optional pre-game **Draft Mode**: a configurable settings pre-step (speed, Standard/Draft toggle, player pool selection across Original/MLS/International/Legends/Icons), a 4-tier player classification and 6-round pack-draft engine, and a real-time pick-and-swap draft carousel that hands off into the existing lineup/bench screen. v1.4 also fixed 6 known gameplay bugs, though its other stated goal — reworking response-move (header/deflect/dive) activation into a consistent single-selection model — was not delivered and remains open for a future milestone. v1.5 replaces the deep-blue chrome with a broadcast-sports charcoal/graphite theme built on a single design-token layer, standardizes the hex-highlight and ring color system into one source of truth, unifies ActionPanel/ActionLog formatting and interaction behavior, pays down accumulated code debt (dead code, duplicated lookups, Zustand/hook inefficiencies), and closes 8 known bugs.

## Core Value

Two friends can open a browser, share a room code, and play a complete match of Counter Attack against each other in real time.

## Current State

**Phase 37 (Out-of-Bounds Detection, Throw-In & Goal Kick) complete 2026-08-07** — the first phase of v1.6. 19 plans, 15/15 requirements SATISFIED. Delivered: continuous `ball.lastTouchedBy` tracking independent of possession; a pure out-of-bounds classification module (`packages/shared/src/outOfBounds.ts`) hooked into the `LOOSE_BALL` scatter clamp; a staged throw-in flow (place thrower, choose 1/2 Movement Phases, Low/High throw up to 6 hexes on the existing Standard-Pass/High-Pass-to-Header mechanics, self-reclassification on an overthrown throw); a dedicated 5-phase goal-kick flow (sequential 6-hex GK-then-opponent reposition, GK's Kick-vs-Standard-Pass choice, teammate-head target selection, 1-player-per-team 3-hex travel window, accurate-Kick-forces-header resolution); and an independent, server-enforced "Out-of-Bounds/Restarts" game-creation toggle. Three gap-closure rounds followed initial execution (plans 37-11 through 37-13): 37-11 fixed a stale throw-in-tracking-state BLOCKER (CR-01, could resurrect and corrupt `ELIGIBLE_NEXT_ACTIONS` after an unrelated later Movement Phase), 37-12 closed two WARNING-level anti-patterns, and 37-13 closed a final BLOCKER — `applyGoalKickReposition` and its socket handler had no `isPitchHex` bounds check, so a hand-crafted `game:move` payload could walk a boundary piece permanently off the 37×26 grid. A live-playtest UAT pass then surfaced six further client-side gaps, closed by plans 37-14 through 37-19: `HexGrid.tsx`'s `pitch-clip` clipPath geometry mismatching `axialToPixel`'s ODD-Q stagger (dropping whole in-bounds rows from render/hit-test); ball/keeper placement at the correct byline hex before the 6-space reposition prompt; three restart-setup-screen client findings (error messaging, panel state); a client-flow regression in `ActionPanel`; a missing `HeaderTargetRing` bullseye on the goal-kick header target; and, finally, generalizing the white header-contest radius preview (`headerContestZoneSet`, formerly `highPassContestZoneSet`) from `HIGH_PASS_MOVE` to also cover `GOAL_KICK_MOVE`, so both managers see the same eligible-contest hexes during a goal-kick header response as they do during a high pass. Code review across the phase found 0 critical issues throughout, with only cosmetic/deferred warnings (e.g. the header-contest radius `2` is duplicated across three call sites with no shared constant — flagged as a follow-up, not a defect). Test suite: shared 650 / server 799 (1 skipped, 1 todo) / client 640 (2,089 total), all green; full monorepo build and typecheck clean.

**v1.5 shipped 2026-08-03.** 6 phases (35 plans, 25/25 requirements satisfied). Delivered: a broadcast-sports charcoal/graphite visual theme replacing the deep-blue chrome app-wide, built on a new `tokens.css` design-token layer with a single runtime `--team-accent` CSS variable; a single source-of-truth hex-highlight/ring color table (`HIGHLIGHT_STYLES`/`RING_STYLES` in `HexCell.tsx`, documented in `docs/HIGHLIGHT-REFERENCE.md`) resolving the prior red/red conflict between offside and the goal-line shot target; a borderless, terminology-consistent ActionPanel/ActionLog system with a shared grey/green CTA color pattern across every game phase; a `knip`-enforced dead-code gate plus consolidated color/team-slot lookups (`useTeamColors`/`useMyTeam`) and `eslint-plugin-react-hooks` at error severity; and 8 bug fixes spanning replay reconstruction, End Turn/eligibility-message timing, GK deflection eligibility, a Game Settings Back-button room-teardown gap, draft-pack duplicate/cascade correctness, loose-ball path origin on a blocked shot, and an undo boundary past a resolved dice roll. Test suite grew to shared 613 / server 642 (1 skipped, 1 todo) / client 483 (1,738 total), all green. Full detail: [milestones/v1.5-ROADMAP.md](milestones/v1.5-ROADMAP.md) · [Requirements](milestones/v1.5-REQUIREMENTS.md) · [Audit](milestones/v1.5-MILESTONE-AUDIT.md).

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

## Current Milestone: v1.6 Fouls, Cards & Restarts

**Goal:** Bring the match engine to full rulebook fidelity for stoppages — fouls, bookings, injuries, substitutions, and the complete out-of-bounds restart set (throw-in, corner kick, goal kick, penalty kick) — each independently toggleable at game creation.

**Target features:**

- Fouls — a tackle/nutmeg/steal dice roll of 1 calls a foul; attacker chooses continue-play or take the restart; injury and booking are always rolled regardless of that choice; a new GK-dive-at-feet duel (defensive adjacent-hex and attacking 3-hex-parallel variants) that fouls into a penalty on a roll of 1; Professional (Last Man) Foul straight-red check
- Booking — yellow card on a die roll ≥ the referee's Leniency attribute; second yellow becomes a red card and immediate dismissal
- Injury — die roll ≥ the player's Resilience attribute injures them (-1 all attributes for the rest of the match); a second injury forces an immediate substitution
- Substitutions — up to 3 per team, at any stoppage, substitute inherits the departing player's number, each sub adds 1 minute to added time
- Penalty kick — attacker-vs-GK duel with a -2 GK dice penalty; both teams reposition; tie goes to Loose Ball
- Foul-triggered free kick — reuses the existing FREE_KICK_SETUP flow (built in v1.3 for offside) with a new foul trigger
- Goal kick, corner kick, throw-in — three new restart types with their own repositioning/accuracy/header rules, per the physical rulebook
- Out-of-bounds detection — the ball leaving the pitch is classified as sideline (throw-in), attacking byline (corner kick), or defending byline (goal kick)
- Three independent game-creation toggles: Fouls, Booking, Out-of-Bounds/Restarts — any combination can be enabled

**Explicitly deferred (raised during v1.5/v1.6 scoping, not in v1.6):** RESP-01..09 response-move activation model (still the top backlog item after this); game-stats overlay; reconnection grace-period bug; rematch flow; chat; draft history/replay.

## Completed Milestone: v1.5 UX Refresh & Code Cleanup

**Goal:** Overhaul the visual system to a professional broadcast-sports look, standardize hex-highlight colors and the ActionPanel, pay down accumulated code debt, and close known bugs.

**Delivered:**

- Visual theme (4/4) — THEME-01..04: broadcast-sports charcoal/graphite palette on a single CSS custom-property token layer, one runtime `--team-accent` variable per view, WCAG AA contrast-verified
- Hex highlight & ring standardization (5/5) — HILITE-01..05: single source-of-truth `HIGHLIGHT_STYLES`/`RING_STYLES` table, red reserved for offside only (goal-target tint moved off red), distinct selected/already-acted rings, always-on-top ball-location marker, documented reference (`docs/HIGHLIGHT-REFERENCE.md`)
- ActionPanel & log standardization (4/4) — PANEL-01..04: consistent help-text format/tone, no framing borders, consistent button sizing/color-state/interaction, consistent terminology across every phase
- Code cleanup (4/4) — CLEANUP-01..04: `knip`-enforced dead-code gate, consolidated color/team-slot lookups (`useTeamColors`/`useMyTeam`), Zustand selector/derived-state review, `eslint-plugin-react-hooks` at error severity
- Bug fixes (8/8) — BUG-30..37: replay kickoff reconstruction, End Turn/eligibility-message timing on move start (undo-aware), GK deflection ineligibility, Game Settings Back-button immediate room teardown, match-wide draft-pack uniqueness, tier-cascade pool restriction, blocked-shot loose-ball path origin (`gkEffectivePos`), undo boundary clamp at a resolved dice roll

**Grew mid-milestone:** Phase 36 was added 2026-07-27 (after the original 5-phase scope) to close 5 additional defects (BUG-33..37) surfaced during Phase 35's UAT pass, expanding the requirement count from 20 to 25.

**Not delivered / carried forward:** RESP-01..09 response-move activation model — explicitly deferred again during v1.5 scoping (see Deferred below); still the top backlog item. 3 Phase 34 code-review findings (lineup-grid overflow on draft-mode filled cards, an invalid 5-char hex fallback in jersey-toggle inline style, an unanchored regex in `check-contrast.ts`) were carried forward without re-verification this cycle.

Full detail: [milestones/v1.5-ROADMAP.md](milestones/v1.5-ROADMAP.md) · [Requirements](milestones/v1.5-REQUIREMENTS.md) · [Audit](milestones/v1.5-MILESTONE-AUDIT.md)

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

### Validated (v1.5 — complete)

- ✓ **THEME-01..04** — Broadcast-sports charcoal/graphite theme on a single design-token layer, WCAG AA contrast-verified — Phases 33-34
- ✓ **HILITE-01..05** — Single source-of-truth highlight/ring color table, red reserved for offside only, documented reference — Phase 33
- ✓ **PANEL-01..04** — ActionPanel/ActionLog format, borderless framing, button consistency, terminology — Phase 35
- ✓ **CLEANUP-01..04** — Dead-code gate (`knip`), consolidated color/team-slot lookups, Zustand selector review, hook-dependency lint — Phase 32
- ✓ **BUG-30..32** — Replay kickoff reconstruction, End Turn/eligibility timing, GK deflection ineligibility — Phase 31
- ✓ **BUG-33..37** — Game Settings Back-button teardown, draft-pack uniqueness/cascade restriction, blocked-shot loose-ball origin, undo-past-dice-roll clamp — Phase 36

### Validated (v1.6 — in progress)

- ✓ **OOB-01, OOB-02, OOB-04, OOB-05** — Continuous last-toucher tracking; sideline exit → throw-in; byline exit → goal kick; independent game-creation toggle preserving the pre-v1.6 boundary-clamp behavior when disabled — Phase 37
- ✓ **THROWIN-01..05** — Throw-in awarded on any pass/loose-ball sideline exit; staged thrower placement; 1/2 Movement Phase choice; 6-hex-capped Low/High throw; overthrow self-reclassification — Phase 37
- ✓ **GOALKICK-01..06** — Dedicated 5-phase goal-kick flow; sequential 6-hex GK-then-opponent reposition (on-pitch bounds guard closed in gap-closure plan 37-13); Kick-vs-Standard-Pass choice; teammate-head target + inaccurate-Kick Loose Ball; 3-hex travel windows + mandatory header on accurate Kick; independent game-creation toggle — Phase 37

### Deferred (carried forward from v1.4 — not scheduled for v1.5, still open)

- [ ] **RESP-01..09** — Response-move (header/deflect/final-third/dive/keeper-ball-in-box) single-selection activation model with eligibility gating, range-hex highlighting, and auto-skip. Not delivered in v1.4 despite being half of that milestone's stated goal; explicitly deferred again during v1.5 scoping — see Current State and `.planning/v1.4-MILESTONE-AUDIT.md`. Top candidate for whatever comes after v1.5.

### Deferred (v2 candidates)

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
- Test suite (v1.5 close): 613 shared + 642 server (1 skipped, 1 todo) + 483 client = 1,738 tests total, all green
- Known tech debt entering next milestone: RESP-01..09 (response-move activation, still top priority); 3 unverified Phase 34 code-review findings (lineup-grid overflow, invalid-hex jersey-toggle fallback, unanchored `check-contrast.ts` regex); `buildTierPoolsForRound` over-claims unclaimed primary-tier population beyond `need` (non-correctness-impacting, Phase 36 WR-02); `createServer.ts:99-167` reconnect handler-registration bug (pre-existing since Phase 07, flagged repeatedly, unremediated); KICK_OFF_SETUP shot-path shading persists on some SNAPSHOT_DEFLECT-goal paths (root cause still unknown, `.planning/todos/pending/`); `.planning/todos/pending/csv-consolidation-player-pool.md` (low-priority idea)

## Constraints

- **Tech — Backend**: Node.js + Socket.io; keeps the WebSocket layer portable to AWS (EC2, Elastic Beanstalk, ECS)
- **Tech — Frontend**: React (Vite); served as static files, can be hosted on S3+CloudFront later
- **Deployment target**: Render (v1.0 POC); AWS EB-compatible with no code changes required
- **Scope**: Core rules only in v1; full rulebook fidelity deferred to future milestones
- **Multiplayer**: Real-time only (no async/turn-timer mode); requires active WebSocket connection

## Key Decisions

| Decision                                                                                                              | Rationale                                                                                                                                    | Outcome                                                                                                                   |
| --------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Server-authoritative game state                                                                                       | Prevents cheating, simplifies sync, maps cleanly to AWS stateful containers                                                                  | Implemented — full snapshot broadcast after every action; `isProcessing` mutex                                            |
| Socket.io over raw WebSockets                                                                                         | Handles reconnection and room management out of the box; negligible overhead                                                                 | Implemented — typed events via generics; `transports: ['websocket']` only (no polling)                                    |
| React + Vite frontend                                                                                                 | Fast dev loop, static build output suitable for S3+CloudFront                                                                                | Implemented — `vite build` → `dist/`; served by Express in production                                                     |
| Hardcoded teams for v1                                                                                                | Eliminates card editor scope; lets us validate gameplay loop first                                                                           | Validated — two tier-balanced squads ship in v1.0                                                                         |
| Core rules only for v1                                                                                                | Fouls/injuries add significant state complexity; validate core loop before adding edge cases                                                 | Validated — all 65 core-rule requirements satisfied                                                                       |
| Render deployment over AWS EB                                                                                         | Simpler first deploy; no Elastic Beanstalk config overhead; Render Blueprint IaC                                                             | Validated — single web service, `render.yaml`, CI gate on push; AWS EB path preserved                                     |
| SVG over Canvas for rendering                                                                                         | ≤600 hexes well within SVG performance range; DevTools-inspectable; CSS transitions free                                                     | Validated — 37×26 grid renders performantly; no Canvas needed                                                             |
| Zustand over Redux for client state                                                                                   | Zero boilerplate; per-slice selectors prevent full re-renders; socket handlers call setState                                                 | Validated — per-slice selectors throughout; no render-all issues observed                                                 |
| MM:00 clock format over MM:SS                                                                                         | Event-driven actionCount is precise; real-time wall clock would drift from server state                                                      | Validated (v1.1) — D-08 override accepted; CLOCK-01 spec updated in spirit                                                |
| HALF_TIME/FULL_TIME as pitch overlays                                                                                 | Keeps top band + clock always visible; eliminates separate Screen routing paths                                                              | Validated (v1.1) — D-12; 6 dead component files deleted; Screen type trimmed to 6 members                                 |
| SelectionState enum over boolean bag                                                                                  | 4 booleans → 1 enum; single ternary for ring color; cleaner prop contract                                                                    | Validated (v1.1) — PieceOverlay selectionState: none/selectable/active/activated                                          |
| HexHighlightType union + priority ternary                                                                             | Eliminates prop drilling of colors; single source of truth in HIGHLIGHT_STYLES table                                                         | Validated (v1.1) — risk > goal > shot-path > kickoff > safe; 5 tint types distinct                                        |
| badgeFile as filename key only                                                                                        | Static Vite import in TeamBadge gives content-hashed URLs; no runtime resolution needed                                                      | Validated (v1.2) — PNG badge renders correctly in scoreboard and player card at build time                                |
| TEAM_CONFIGS color source of truth                                                                                    | Eliminates positional home/away color strings; single lookup per team across all surfaces                                                    | Validated (v1.2) — GameBoard, ActionLog, PlayerStatsPanel all use TEAM_CONFIGS[teamId]                                    |
| firstTimePassCarrierId in GameState                                                                                   | Prevents self-pass reclaim exploit; mirrors highPassCarrierId lifecycle                                                                      | Validated (v1.2) — passer excluded from FTP repositioning target and delivery occupant                                    |
| computeLooseBall cube-coordinate vectors                                                                              | Eliminates systematic NE/SW overshoot caused by fixed ODD-Q offset deltas on axial grid                                                      | Validated (v1.2) — 72-case regression test; clamp walk per-step from gameEngine.ts                                        |
| FTP_MOVE_ENABLED=false feature flag                                                                                   | Disables FIRST_TIME_PASS_MOVE sub-phase by default; code kept for future toggle                                                              | Validated (v1.2) — direct delivery path mirrors STANDARD_PASS behavior                                                    |
| checkHalfEndOnTackle exported helper                                                                                  | Gates half-end correctly on tackle/steal paths; reads addedTime without re-rolling                                                           | Validated (v1.2) — called at 3 tackle/steal success sites; 9 regression tests                                             |
| UniformSelectionScreen replaces tabbed TeamSelectionScreen                                                            | Single screen with flat 6×2 team grid + 2×9 style tile grid; no tabs; home picks first, away locked until home confirms                      | Validated (v1.3/Ph22) — UNIFORM-02/03/04; UAT 11/11 passed                                                                |
| awayLocked gate on UNIFORM_CONFIRM ordering                                                                           | Server rejects away UNIFORM_CONFIRM before home confirms (WRONG_TURN); client shows locked state until homeConfirmedStyle set                | Validated (v1.3/Ph22) — Nyquist G2/G3 integration tests                                                                   |
| mix-blend-mode: multiply on team badges                                                                               | Removes white PNG backgrounds on colored card backgrounds without modifying source PNG files                                                 | Validated (v1.3/Ph22) — UAT Test 3                                                                                        |
| tileRenderPalette for away style tiles                                                                                | Away player sees their team's away colors (awayPrime/awayAlt) on style tiles, not home palette                                               | Validated (v1.3/Ph22) — UNIFORM-02; UAT Test 9                                                                            |
| draftEngine.ts/draftSession.ts as pure, socket-independent modules                                                    | Mirrors gameEngine.ts's separation from the socket layer; keeps draft logic server-authoritative and independently testable                  | Validated (v1.4/Ph28-29) — zero io/socket dependencies in either module                                                   |
| Draft carousel + lineup/bench merged into one screen                                                                  | Dragging a card off the pack carousel directly onto a lineup slot or bench drafts and places in one motion — no separate pick/lineup screens | Validated (v1.4/Ph29/D-05) — deliberate scope interpretation, documented in 29-CONTEXT.md                                 |
| Phase 30 draft recalibration (5-tier/7-card/keeper-safety-net → 4-tier/6-round/dedicated-GK-round)                    | Live-playtest feedback showed the original model needed rebalancing before ship, not a defect                                                | Validated (v1.4/Ph30) — DRAFT-04/05/08 marked "superseded design" in requirements archive, not silently overwritten       |
| Single `tokens.css` chrome layer + one runtime `--team-accent` CSS variable                                           | Eliminates per-component `TEAM_CONFIGS` color lookups; one place to retheme the entire app                                                   | Validated (v1.5/Ph33) — every chrome-color CSS Module migrated to `var(--token)`                                          |
| `HIGHLIGHT_STYLES`/`RING_STYLES` as the single hex-color source of truth, documented in `docs/HIGHLIGHT-REFERENCE.md` | Prior ad-hoc inline literals caused a real UX conflict (red = both offside and a positive shot target)                                       | Validated (v1.5/Ph33) — goal-target moved off red, `safe` moved off gold; reference doc keeps future additions consistent |
| "Already-acted" piece marker unified into the existing orange-ring-+-red-X `activated` state (grey mechanism removed) | A separate grey ring tried during Ph33-05 didn't hold up under human-verify iteration; one state for one meaning was simpler and clearer     | Validated (v1.5/Ph33) — HILITE-03 closed after 2 rounds of human-verify iteration                                         |
| `gkEffectivePos` (not the shooter's hex) seeds the LOOSE_BALL scatter walk on a shooter/GK duel tie                   | Mirrors the sibling SAVE branches' existing dive-adjusted-position pattern — one rule for "where does the ball go after a GK-involved shot"  | Validated (v1.5/Ph36) — BUG-36; regression tests cover no-dive, 2-hex-dive, and replay-frame consistency                  |
| Undo-boundary floor extended via the `isBoundary` disjunction, not the separate slot-wide `DICE_ROLL` lockout check   | A resolved tackle/steal must clamp Undo (block earlier steps) without disabling Undo for the rest of the slot                                | Validated (v1.5/Ph36) — BUG-37; client `canUndo` mirrors server `applyUndo` term-for-term                                 |

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

_Last updated: 2026-08-07 after Phase 37 completion_
