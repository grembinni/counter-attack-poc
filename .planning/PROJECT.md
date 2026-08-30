# Counter Attack POC

## What This Is

A 2-player real-time web implementation of Counter Attack, the hex-grid football strategy board game by Webstar Games. Two players connect via a shared room code and play a complete match through a browser — no installation required. The game models the physical board faithfully: hex movement, dice rolls, pass accuracy checks, Zone of Influence, and shooting duels, with a chess-like click-to-move interface. v1.2 adds four named teams (Cozmos, Xolos, City, Crew) with badge PNGs and jersey patterns, CSV-seeded player rosters with a pre-match team-selection lobby, offside detection, 28 bug fixes, and 8 UX enhancements including game-speed selection, end-turn confirmation, final-third markers, and a transient EventBanner. v1.3 expands to 12 real-league teams across MLS/International with dynamic formation selection and stat-driven auto-assignment. v1.4 adds an optional pre-game **Draft Mode**: a configurable settings pre-step (speed, Standard/Draft toggle, player pool selection across Original/MLS/International/Legends/Icons), a 4-tier player classification and 6-round pack-draft engine, and a real-time pick-and-swap draft carousel that hands off into the existing lineup/bench screen. v1.4 also fixed 6 known gameplay bugs, though its other stated goal — reworking response-move (header/deflect/dive) activation into a consistent single-selection model — was not delivered and remains open for a future milestone. v1.5 replaces the deep-blue chrome with a broadcast-sports charcoal/graphite theme built on a single design-token layer, standardizes the hex-highlight and ring color system into one source of truth, unifies ActionPanel/ActionLog formatting and interaction behavior, pays down accumulated code debt (dead code, duplicated lookups, Zustand/hook inefficiencies), and closes 8 known bugs. v1.6 brings the match engine to full rulebook fidelity for stoppages: out-of-bounds detection routes a ball exit to a throw-in, goal kick, or corner kick with their own staged repositioning and header/pass mechanics; fouls, cards, injuries, GK-dive-at-feet, and penalty kicks are fully modeled with independently toggleable Fouls/Booking/Injury/Out-of-Bounds rules; and a substitutions system lets managers sub at any stoppage under a 3-per-match cap. v1.7 unifies card/injury iconography across every player-showing surface (including the bench, for the first time); reworks the mid-match roster screen into a default drag-and-drop positioning mode plus an explicit stage-and-confirm substitution flow, alongside a fix ensuring a red-carded player is fully removed from every gameplay computation, not just hidden from view; adds a Tackle/Steal decline mechanic and a manual Referee Leniency override, both surfaced through a consolidated Advanced Settings drawer; and adds an on-demand Game Summary popup with live soccer-style match stats (possession, passes, tackles/steals, shots, xG) reachable at any point in the match.

## Core Value

Two friends can open a browser, share a room code, and play a complete match of Counter Attack against each other in real time.

## Current Milestone: v1.8 Roster Interaction Overhaul & Rules Audit

**Goal:** Replace drag-and-drop with a select-based swap flow for roster positioning and substitutions, fix known GK/final-third/banner-sequencing bugs, lock jersey numbers permanently at kickoff, and run a rulebook-vs-implementation gap analysis to scope the next cleanup milestone.

**Target features:**
- Select-based player swap/substitution (click = select green, eligible targets = blue, click again = deselect; replaces drag-and-drop in both the default positioning mode and stage-and-confirm substitution mode from Phase 42)
- Final-third confirm/warning fix: green confirm button + no "not all players moved" warning when the only unmoved player is the goalkeeper
- GK box-entry reposition offer resequenced to fire before (not after) the shot-blocking dive on an outside-the-box shot on goal
- Permanent jersey numbers generated once at game start, fixed for the rest of the match regardless of position changes or substitutions (replaces today's position-inherited numbering)
- Resume and close the paused foul→injury→booking banner-sequencing bug (open since v1.6 close)
- Rulebook-vs-implementation gap analysis — an audit deliverable (findings doc), not fixes in this milestone; scopes a future cleanup milestone

RESP-01..09 (response-move activation model) stays explicitly deferred — 6th consecutive milestone.

## Current State

**v1.7 shipped 2026-08-30.** 6 phases (47 plans, 116 tasks, 44/44 requirements satisfied). Delivered: a single shared `CardInjuryBadge` component replacing three independently-implemented card/injury treatments and giving the bench its first-ever card/injury display (Phase 41); a mid-match roster screen rework into a default drag-and-drop positioning mode plus an explicit stage-and-confirm substitution mode capped at 3/team, alongside BUG-38's shared `isActivePiece` predicate applied across every occupancy/ZoI/interceptor site so a red-carded player is genuinely removed from every gameplay computation, not just hidden from view (Phase 42 — the largest and highest-regression-risk phase of the milestone, 17 plans across 12 waves including 5 gap-closure rounds); a server-authoritative Tackle/Steal decline mechanic with sequential multi-defender prompting and a persistent risk ring (Phase 43); a manual 2–5 Referee Leniency override coupled to both booking threshold and added time, plus a collapsed-by-default two-column Advanced Settings drawer for all match-rule toggles (Phase 44); an on-demand Game Summary popup with live per-team stats (possession, passes, tackles/steals, shots, xG via a pure formula instrumented at all 7 shot-resolution sites, fouls/cards) that persist across half-time, reachable via a scoreboard (i) icon at any point in the match (Phase 45); and a milestone-closing consistency audit extending dead-ball hex highlighting, clarifying response-move trigger language, consolidating duplicate movement/kicker-selection logic, aligning pitch/roster/bench card layout, and fixing a 3-phase-deferred `pnpm -w lint` config cap (Phase 46). Test suite grew to shared 907 / server 1635 (1 skipped, 1 todo) / client 1239 = 3,781 tests, all green.

**Known deferred items at v1.7 close:** a foul→injury→booking EventBanner sequencing bug (root cause still unconfirmed, investigation paused by the user since v1.6 close — see Context); RESP-01..09 (response-move activation model), now deferred across five consecutive milestones. Two items surfaced during Phase 46 close were resolved directly at milestone-close time rather than left open: a knip-fix quick task's `status` frontmatter gap was backfilled (work itself already independently verified complete), and the pre-existing Advanced-Settings-drawer todo — which Phase 46 plan 46-03 actually resolved — was moved to `.planning/todos/completed/` with a resolution note after being missed by auto-close due to a missing `resolves_phase` field.

**v1.6 shipped 2026-08-17.** 4 phases (83 plans, 206 tasks, 55/55 requirements satisfied). Delivered full rulebook fidelity for match stoppages: continuous `ball.lastTouchedBy` tracking feeding a pure out-of-bounds classification module that routes a sideline exit to a staged throw-in (1/2 Movement Phase choice, Low/High throw up to 6 hexes), a byline exit after an attacking/no touch to a dedicated 5-phase goal kick (sequential 6-hex reposition, Kick-vs-Standard-Pass choice, teammate-head targeting), and a byline exit after a defending touch to a corner kick (two goalkeeper repositions, a 6-stage alternating reposition window, a second pre-kick 3-hex window, High/Low kick resolution) — all gated behind one independent "Out-of-Bounds/Restarts" toggle; a full fouls/cards/injury/penalty-kick engine (a tackle/steal/GK-dive-at-feet die of 1 calls a foul, rolls injury then booking in that order before the attacker's continue-or-restart choice, with a Professional/Last-Man Foul routing to a straight-red-vs-yellow check and a GK-dive-at-feet foul always awarding a penalty), each of Fouls/Booking/Injury independently toggleable; and a substitutions system (any stoppage, drag-and-drop, jersey-number/slot inheritance, a whole-match 3-sub cap that never resets at half-time, +1 added-time minute per sub, red-carded/subbed-out players permanently unavailable) that ignores every other toggle. Corner Kick (Phase 38) went through four full gap-closure rounds driven by live two-browser walkthroughs — the largest single-phase iteration count in the project's history — converging from an interactive clear-out step to an automatic one and from an unbounded reposition walk to a free-kick-style bounded placement, with a final round fixing an Undo-enablement regression the third round's own fix had introduced. Fouls & Penalty Kicks (Phase 39) closed 9 live-UAT defects plus 1 Critical code-review finding (a missing server-side occupancy check on free-kick kicker placement) in a single gap-closure round. Cross-phase integration was independently audited before close (`.planning/milestones/v1.6-MILESTONE-AUDIT.md`): all 55 requirements traced with zero orphans, restart-type routing exhaustive and mutually exclusive, the whole-milestone Undo/Replay event-type registry consistent across all four phases with no recurrence of the project's historical "new event type invisible to Undo" bug class, and toggle independence holding end-to-end. One known open item carried forward: a foul→injury→booking EventBanner sequencing bug (a same-commit React state race was found and fixed but does not resolve the live-reported symptom; root cause still open, investigation explicitly paused by the user pending this close). Test suite: shared 839 / server 1439 (1 skipped, 1 todo) / client 998 (3,276 total), all green; full monorepo build and typecheck clean. Full detail: [milestones/v1.6-ROADMAP.md](milestones/v1.6-ROADMAP.md) · [Requirements](milestones/v1.6-REQUIREMENTS.md) · [Audit](milestones/v1.6-MILESTONE-AUDIT.md).

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

## Completed Milestone: v1.7 UI Consistency, Substitution Rework & Match Summary

**Goal:** Polish and unify the UI (card/injury iconography, advanced toggle drawer), rework the substitution flow around a default player-positioning roster screen, add referee-leniency and tackle/steal-decline toggles, build an on-demand match summary popup with soccer-style stats/xG, and close out a final consistency/dead-code cleanup pass.

**Delivered:**

- Card & injury iconography (3/3) — ICON-01..03: single shared `CardInjuryBadge` component replacing three duplicated treatments, identical iconography/position on player/pitch/roster/bench cards, bench's first-ever card/injury display
- Substitution UX overhaul (11/11 + BUG-38) — SUB-08..18: default drag-and-drop positioning mode, stage-and-confirm substitution mode capped at 3/team, green Resume/editable-banner chrome, red-card bench marker; BUG-38: a shared `isActivePiece` predicate now gates every occupancy/ZoI/interceptor/deflection site so a red-carded player is fully removed from play, not just hidden
- Tackle/Steal prompt & decline (4/4) — TACKLE-01..04: server-authoritative decline mechanic, sequential multi-defender prompting, persistent risk ring on decline, zero behavior change with the toggle off
- Referee Leniency & Advanced Settings Drawer (7/7) — REFEREE-01..04, SETTINGS-05..07: manual 2–5 Leniency override coupled to booking threshold and added time, collapsed-by-default two-column Advanced drawer for all match-rule toggles
- Game Summary popup (9/9) — STATS-01..09: on-demand (i)-icon modal plus HALF_TIME/FULL_TIME embedding, live per-team stats including a pure xG formula instrumented at all 7 shot-resolution sites, all counters persisting across half-time
- Final cleanup (9/9) — CLEANUP-05..13: gameplay consistency audit, dead-ball hex highlighting extended, response-move trigger language clarified, duplicate movement/kicker-selection logic consolidated, pitch/roster/bench card layout aligned, dead code removed

**Not delivered / carried forward:** RESP-01..09 (response-move activation model) — explicitly deferred again during v1.7 scoping; now deferred across five consecutive milestones, still the top backlog item for whatever comes next.

Full detail: [milestones/v1.7-ROADMAP.md](milestones/v1.7-ROADMAP.md) · [Requirements](milestones/v1.7-REQUIREMENTS.md)

## Completed Milestone: v1.6 Fouls, Cards & Restarts

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

### Validated (v1.6 — complete)

- ✓ **OOB-01, OOB-02, OOB-04, OOB-05** — Continuous last-toucher tracking; sideline exit → throw-in; byline exit → goal kick; independent game-creation toggle preserving the pre-v1.6 boundary-clamp behavior when disabled — Phase 37
- ✓ **THROWIN-01..05** — Throw-in awarded on any pass/loose-ball sideline exit; staged thrower placement; 1/2 Movement Phase choice; 6-hex-capped Low/High throw; overthrow self-reclassification — Phase 37
- ✓ **GOALKICK-01..06** — Dedicated 5-phase goal-kick flow; sequential 6-hex GK-then-opponent reposition (on-pitch bounds guard closed in gap-closure plan 37-13); Kick-vs-Standard-Pass choice; teammate-head target + inaccurate-Kick Loose Ball; 3-hex travel windows + mandatory header on accurate Kick; independent game-creation toggle — Phase 37
- ✓ **OOB-03, CORNER-01..06** — Byline exit after a defending touch → corner kick; both GKs reposition first; corner-taker placed at a fixed arc hex; 6-stage alternating reposition (attacker first); High Pass (unlimited in-box / 15-hex cap elsewhere, header required) or Low Pass (no header) on the existing 8+ accuracy check; separate pre-kick 3-hex window — Phase 38 (4 gap-closure rounds; largest single-phase iteration count in the project's history)
- ✓ **FOUL-01..05, CARD-01..04, INJURY-01..04** — Defender die of 1 calls a foul; injury then booking roll in that order before the continue-or-restart choice; Professional/Last-Man Foul routes to straight-red-vs-yellow; yellow on die ≥ Leniency, second yellow → red; injury on die ≥ Resilience degrades all attributes by 1; Fouls/Booking/Injury each independently toggleable (Booking/Injury inert without Fouls) — Phase 39
- ✓ **GKDIVE-01..05, PEN-01..03, FK-01** — GK-dive-at-feet interrupt within 3 hexes parallel to goal line (-1 die from the 3rd hex, once per movement cycle, displacement on success); a GK roll of 1 always fouls into a penalty; penalty kick is a -2 GK-dice-penalty duel with box repositioning restricted to taker + GK, tie → Loose Ball at the spot; tackle/steal fouls reuse the existing FREE_KICK_SETUP flow unmodified — Phase 39
- ✓ **SUB-01..07, SETTINGS-01..04** — Substitution at any stoppage via roster-screen drag-and-drop, regardless of other toggles; number/slot inheritance; whole-match 3-sub cap that never resets at half-time; +1 added-time minute per sub; red-carded players unreplaceable; subbed-out players permanently unavailable with a clear indicator; 4 independent game-creation toggles (Fouls/Booking/Injury/Out-of-Bounds) — Phases 39-40

### Validated (v1.7 — complete)

- ✓ **ICON-01..03** — Single shared `CardInjuryBadge` component replacing three duplicated card/injury treatments; identical iconography and position on player/pitch/roster/bench cards; bench's first-ever card/injury display — Phase 41
- ✓ **SUB-08..18** — Default drag-and-drop player-positioning mode on the mid-match roster screen; stage-and-confirm substitution mode capped at 3/team; green Resume control and editable-state banner; red-carded player shown as a bench marker, repositionable but never substitutable or pitch-rendered — Phase 42
- ✓ **BUG-38** — Shared `isActivePiece` predicate applied to every occupancy/ZoI/interceptor/deflection-eligibility site across `packages/shared`, `gameEngine.ts`, and `gameHandlers.ts`; a red-carded player's vacated hex no longer blocks movement, targeting, or deflection anywhere in the game — Phase 42
- ✓ **TACKLE-01..04** — Server-authoritative tackle/steal decline toggle (default on); sequential multi-defender Attempt/Decline prompting in tackling-descending order; declined opportunity's risk ring stays live until the ball carrier leaves range or the movement phase ends; toggle-off duels resolve exactly as before (proven by zero modified pre-existing tackle/steal/foul test files) — Phase 43
- ✓ **REFEREE-01..04** — Manual Referee Leniency override, default off, range 2–5 via up/down stepper; when off, Leniency is randomly assigned 2–5 as before; the override drives both booking threshold and added-time calculation identically to the random roll, by explicit coupled-by-design decision — Phase 44
- ✓ **SETTINGS-05..07** — All match-rule toggles (Fouls, Booking, Injury, Out-of-Bounds, Referee Leniency, Tackle/Steal Decline) grouped under a collapsed-by-default Advanced section in a two-column grid; Fouls-dependency grey-out behavior preserved via one shared derivation — Phase 44
- ✓ **STATS-01..09** — Scoreboard (i) icon opens an on-demand match summary at any point in the match, also reachable at half-time/full-time; settings/toggle recap plus per-team possession, passes, tackle/steal success, shots, accumulated xG (pure formula instrumented at all 7 shot-resolution sites), fouls, and cards; all stats persist across half-time (never reset), mirroring the existing `subsUsed` pattern — Phase 45
- ✓ **CLEANUP-05..13** — Gameplay consistency audit; dead-ball hex highlighting extended to `FREE_KICK_SETUP`/`FREE_MOVE_ATTACK`/`FREE_MOVE_DEFENSE`; phase help text and response-move trigger language clarified; duplicate movement-pattern and kicker/thrower-selection logic consolidated; pitch/roster/bench card layout aligned; dead code removed — Phase 46

### Deferred (carried forward from v1.4 — not scheduled for v1.5, v1.6, v1.7, or the next milestone, still open)

- [ ] **RESP-01..09** — Response-move (header/deflect/final-third/dive/keeper-ball-in-box) single-selection activation model with eligibility gating, range-hex highlighting, and auto-skip. Not delivered in v1.4 despite being half of that milestone's stated goal; explicitly deferred again during v1.5, v1.6, and v1.7 scoping — see `.planning/v1.4-MILESTONE-AUDIT.md`. Now deferred across five consecutive milestones; top candidate for the next milestone.

### Deferred (raised during v1.6 scoping)

- [ ] **NUTMEG-01+** — Nutmeg as its own distinct move, confirmed by the user during v1.6 requirements definition to be a separate mechanic from the existing steal-attempt action (not yet designed). FOUL-01 explicitly excludes nutmeg as a v1.6 foul trigger pending this design.

### Deferred (v2 candidates)

- [ ] Reconnection grace period (server holds room state for disconnected player) — note: a related bug exists today (`createServer.ts` misplaced `return`) that leaves some reconnecting sockets with no handlers at all; see Context
- [ ] Rematch flow
- [ ] Chat
- [ ] Draft history/replay (DRAFT-12), async draft mode (DRAFT-13)
- [ ] Substitution roster limit beyond 3 — no Extra Time/overtime period exists in this implementation for the rulebook's +1-sub allowance to attach to (confirmed out of scope for v1.6, see `.planning/milestones/v1.6-REQUIREMENTS.md`)

**Note:** the game-stats overlay item previously listed here (possession, tackles, shots, xG, etc.) was delivered as v1.7's Game Summary popup — see Completed Milestone: v1.7 above.

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
- Test suite (v1.7 close): 907 shared + 1635 server (1 skipped, 1 todo) + 1239 client = 3,781 tests total, all green
- Known tech debt entering the next milestone: RESP-01..09 (response-move activation, still top priority, now deferred across five consecutive milestones); an open, user-paused foul→injury→booking EventBanner sequencing bug (a real same-commit React state race was found and fixed but does not resolve the live-reported symptom — root cause still unconfirmed, see `.planning/debug/foul-banner-sequence-not-pausing.md`); `createServer.ts:99-167` reconnect handler-registration bug (pre-existing since Phase 07, flagged repeatedly across multiple milestone closes, still unremediated); 3 non-blocking Phase 46 code-review warnings (duplicated end-turn-confirm dialog logic, dead CSV-parsing branch in `seed-rosters.ts`, a silent invalid-jerseyType coercion); Nyquist VALIDATION.md staleness on Phases 38/39/40 (pre-execution planning docs never refreshed post-execution — documentation-currency gap only, actual test coverage independently confirmed extensive)

## Constraints

- **Tech — Backend**: Node.js + Socket.io; keeps the WebSocket layer portable to AWS (EC2, Elastic Beanstalk, ECS)
- **Tech — Frontend**: React (Vite); served as static files, can be hosted on S3+CloudFront later
- **Deployment target**: Render (v1.0 POC); AWS EB-compatible with no code changes required
- **Scope**: Core rules only in v1; full rulebook fidelity deferred to future milestones
- **Multiplayer**: Real-time only (no async/turn-timer mode); requires active WebSocket connection

## Key Decisions

| Decision                                                                                                                                                     | Rationale                                                                                                                                          | Outcome                                                                                                                              |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Server-authoritative game state                                                                                                                              | Prevents cheating, simplifies sync, maps cleanly to AWS stateful containers                                                                        | Implemented — full snapshot broadcast after every action; `isProcessing` mutex                                                       |
| Socket.io over raw WebSockets                                                                                                                                | Handles reconnection and room management out of the box; negligible overhead                                                                       | Implemented — typed events via generics; `transports: ['websocket']` only (no polling)                                               |
| React + Vite frontend                                                                                                                                        | Fast dev loop, static build output suitable for S3+CloudFront                                                                                      | Implemented — `vite build` → `dist/`; served by Express in production                                                                |
| Hardcoded teams for v1                                                                                                                                       | Eliminates card editor scope; lets us validate gameplay loop first                                                                                 | Validated — two tier-balanced squads ship in v1.0                                                                                    |
| Core rules only for v1                                                                                                                                       | Fouls/injuries add significant state complexity; validate core loop before adding edge cases                                                       | Validated — all 65 core-rule requirements satisfied                                                                                  |
| Render deployment over AWS EB                                                                                                                                | Simpler first deploy; no Elastic Beanstalk config overhead; Render Blueprint IaC                                                                   | Validated — single web service, `render.yaml`, CI gate on push; AWS EB path preserved                                                |
| SVG over Canvas for rendering                                                                                                                                | ≤600 hexes well within SVG performance range; DevTools-inspectable; CSS transitions free                                                           | Validated — 37×26 grid renders performantly; no Canvas needed                                                                        |
| Zustand over Redux for client state                                                                                                                          | Zero boilerplate; per-slice selectors prevent full re-renders; socket handlers call setState                                                       | Validated — per-slice selectors throughout; no render-all issues observed                                                            |
| MM:00 clock format over MM:SS                                                                                                                                | Event-driven actionCount is precise; real-time wall clock would drift from server state                                                            | Validated (v1.1) — D-08 override accepted; CLOCK-01 spec updated in spirit                                                           |
| HALF_TIME/FULL_TIME as pitch overlays                                                                                                                        | Keeps top band + clock always visible; eliminates separate Screen routing paths                                                                    | Validated (v1.1) — D-12; 6 dead component files deleted; Screen type trimmed to 6 members                                            |
| SelectionState enum over boolean bag                                                                                                                         | 4 booleans → 1 enum; single ternary for ring color; cleaner prop contract                                                                          | Validated (v1.1) — PieceOverlay selectionState: none/selectable/active/activated                                                     |
| HexHighlightType union + priority ternary                                                                                                                    | Eliminates prop drilling of colors; single source of truth in HIGHLIGHT_STYLES table                                                               | Validated (v1.1) — risk > goal > shot-path > kickoff > safe; 5 tint types distinct                                                   |
| badgeFile as filename key only                                                                                                                               | Static Vite import in TeamBadge gives content-hashed URLs; no runtime resolution needed                                                            | Validated (v1.2) — PNG badge renders correctly in scoreboard and player card at build time                                           |
| TEAM_CONFIGS color source of truth                                                                                                                           | Eliminates positional home/away color strings; single lookup per team across all surfaces                                                          | Validated (v1.2) — GameBoard, ActionLog, PlayerStatsPanel all use TEAM_CONFIGS[teamId]                                               |
| firstTimePassCarrierId in GameState                                                                                                                          | Prevents self-pass reclaim exploit; mirrors highPassCarrierId lifecycle                                                                            | Validated (v1.2) — passer excluded from FTP repositioning target and delivery occupant                                               |
| computeLooseBall cube-coordinate vectors                                                                                                                     | Eliminates systematic NE/SW overshoot caused by fixed ODD-Q offset deltas on axial grid                                                            | Validated (v1.2) — 72-case regression test; clamp walk per-step from gameEngine.ts                                                   |
| FTP_MOVE_ENABLED=false feature flag                                                                                                                          | Disables FIRST_TIME_PASS_MOVE sub-phase by default; code kept for future toggle                                                                    | Validated (v1.2) — direct delivery path mirrors STANDARD_PASS behavior                                                               |
| checkHalfEndOnTackle exported helper                                                                                                                         | Gates half-end correctly on tackle/steal paths; reads addedTime without re-rolling                                                                 | Validated (v1.2) — called at 3 tackle/steal success sites; 9 regression tests                                                        |
| UniformSelectionScreen replaces tabbed TeamSelectionScreen                                                                                                   | Single screen with flat 6×2 team grid + 2×9 style tile grid; no tabs; home picks first, away locked until home confirms                            | Validated (v1.3/Ph22) — UNIFORM-02/03/04; UAT 11/11 passed                                                                           |
| awayLocked gate on UNIFORM_CONFIRM ordering                                                                                                                  | Server rejects away UNIFORM_CONFIRM before home confirms (WRONG_TURN); client shows locked state until homeConfirmedStyle set                      | Validated (v1.3/Ph22) — Nyquist G2/G3 integration tests                                                                              |
| mix-blend-mode: multiply on team badges                                                                                                                      | Removes white PNG backgrounds on colored card backgrounds without modifying source PNG files                                                       | Validated (v1.3/Ph22) — UAT Test 3                                                                                                   |
| tileRenderPalette for away style tiles                                                                                                                       | Away player sees their team's away colors (awayPrime/awayAlt) on style tiles, not home palette                                                     | Validated (v1.3/Ph22) — UNIFORM-02; UAT Test 9                                                                                       |
| draftEngine.ts/draftSession.ts as pure, socket-independent modules                                                                                           | Mirrors gameEngine.ts's separation from the socket layer; keeps draft logic server-authoritative and independently testable                        | Validated (v1.4/Ph28-29) — zero io/socket dependencies in either module                                                              |
| Draft carousel + lineup/bench merged into one screen                                                                                                         | Dragging a card off the pack carousel directly onto a lineup slot or bench drafts and places in one motion — no separate pick/lineup screens       | Validated (v1.4/Ph29/D-05) — deliberate scope interpretation, documented in 29-CONTEXT.md                                            |
| Phase 30 draft recalibration (5-tier/7-card/keeper-safety-net → 4-tier/6-round/dedicated-GK-round)                                                           | Live-playtest feedback showed the original model needed rebalancing before ship, not a defect                                                      | Validated (v1.4/Ph30) — DRAFT-04/05/08 marked "superseded design" in requirements archive, not silently overwritten                  |
| Single `tokens.css` chrome layer + one runtime `--team-accent` CSS variable                                                                                  | Eliminates per-component `TEAM_CONFIGS` color lookups; one place to retheme the entire app                                                         | Validated (v1.5/Ph33) — every chrome-color CSS Module migrated to `var(--token)`                                                     |
| `HIGHLIGHT_STYLES`/`RING_STYLES` as the single hex-color source of truth, documented in `docs/HIGHLIGHT-REFERENCE.md`                                        | Prior ad-hoc inline literals caused a real UX conflict (red = both offside and a positive shot target)                                             | Validated (v1.5/Ph33) — goal-target moved off red, `safe` moved off gold; reference doc keeps future additions consistent            |
| "Already-acted" piece marker unified into the existing orange-ring-+-red-X `activated` state (grey mechanism removed)                                        | A separate grey ring tried during Ph33-05 didn't hold up under human-verify iteration; one state for one meaning was simpler and clearer           | Validated (v1.5/Ph33) — HILITE-03 closed after 2 rounds of human-verify iteration                                                    |
| `gkEffectivePos` (not the shooter's hex) seeds the LOOSE_BALL scatter walk on a shooter/GK duel tie                                                          | Mirrors the sibling SAVE branches' existing dive-adjusted-position pattern — one rule for "where does the ball go after a GK-involved shot"        | Validated (v1.5/Ph36) — BUG-36; regression tests cover no-dive, 2-hex-dive, and replay-frame consistency                             |
| Undo-boundary floor extended via the `isBoundary` disjunction, not the separate slot-wide `DICE_ROLL` lockout check                                          | A resolved tackle/steal must clamp Undo (block earlier steps) without disabling Undo for the rest of the slot                                      | Validated (v1.5/Ph36) — BUG-37; client `canUndo` mirrors server `applyUndo` term-for-term                                            |
| Goal Kick built as its own dedicated 5-phase flow, not a reuse of the existing GK_RESTART chain                                                              | Explicit user override of the research recommendation during requirements definition — GOALKICK-01 requires the flow to read as genuinely distinct | Validated (v1.6/Ph37) — non-reuse confirmed by grep at verification time                                                             |
| `ball.lastTouchedBy` as the single source of truth for out-of-bounds classification, not a retroactive `eventLog` scan                                       | One authoritative field is simpler to reason about and test than re-deriving possession history on every exit                                      | Validated (v1.6/Ph37) — `classifyExit`/`classifyOutOfBounds` exhaustive and mutually exclusive across throw-in/goal-kick/corner-kick |
| Injury/booking rolled inline inside the TACKLE/STEAL/GK-dive duel-resolution branches, never inside a restart-setup phase                                    | "Continue play" fouls must always roll injury/booking regardless of the attacker's later choice                                                    | Validated (v1.6/Ph39) — `resolveFoulChain` fires unconditionally on a defender die of 1                                              |
| Corner Kick's clear-out step converged from interactive (click-to-select) to fully automatic straight-line relocation                                        | Three gap-closure rounds of live two-browser walkthroughs showed the interactive version added friction without adding a real decision             | Validated (v1.6/Ph38) — the single biggest per-phase iteration count in the project (4 gap-closure rounds, 33 total plans)           |
| Substitutions use an independent `STOPPAGE_PHASES` allow-list (mirroring the existing `validUndoPhases` idiom), not threaded through `ELIGIBLE_NEXT_ACTIONS` | Keeps the substitution eligibility check decoupled from the primary turn-sequencing state machine                                                  | Validated (v1.6/Ph40) — single shared list imported by both server and client, confirmed in sync by cross-phase audit                |
| `applyRosterContinuity` overlays live substitution/red-card identity onto every reset site (goal, half-time), rather than re-deriving from `eventLog`        | A goal or half-time reset must never resurrect a subbed-out or red-carded player                                                                   | Validated (v1.6/Ph40) — 4 in-engine reset sites + 3 handler-side goal resets covered                                                 |
| `CardInjuryBadge.tsx` as the single shared component backing card/injury display on pitch/player-stats/roster/bench cards                                    | Three independently-implemented treatments had drifted and the bench (a 4th surface) had never gotten card/injury display at all                    | Validated (v1.7/Ph41) — source-scanning audit test + four-surface consistency test close the loop against regression                 |
| BUG-38's red-card field-removal fix scoped inside the Substitution UX Overhaul phase (Ph42), not a standalone phase                                          | REQUIREMENTS.md listed it as a sub-item of that category, and it is prerequisite engine work the phase's own new UI needed to be tested against once fixed | Validated (v1.7/Ph42) — shared `isActivePiece` predicate converged onto every occupancy/ZoI/interceptor site across 3 files          |
| Referee Leniency and Advanced Settings Drawer combined into one phase (Ph44), sequenced after Tackle/Steal Prompt & Decline (Ph43)                            | Lets the Advanced drawer lay out the final settings-toggle count (4 existing + Referee Leniency + Tackle/Steal Decline) once, not twice              | Validated (v1.7/Ph44) — two-column grid built directly against the final 6-toggle set                                                |
| Referee Leniency kept as a dual-consumer field (booking threshold AND added-time bonus) rather than decoupled                                                | REFEREE-04 explicitly requires the coupling; an override touching only booking would silently leave added time on the old random-roll value          | Validated (v1.7/Ph44) — UI copy notes the coupling; 9-test regression suite pins both the override and the random-fallback behavior   |
| Tackle/Steal declined state given its own sibling field with an explicit reset policy, not overloaded onto `stealAttemptedByIds`/`tackleAttemptedByIds`       | Those arrays reset at ~30 independent call sites with a different semantic that a declined-but-still-live ring must not inherit                     | Validated (v1.7/Ph43) — TACKLE-03's risk ring persists correctly across a later move step, proven by client + socket-level tests      |
| Match-summary stat counters (possession, passes, tackle/steal, fouls/cards) follow the `subsUsed` never-reset-at-half-time pattern, not `addedTimeBonus`'s reset-per-half pattern | STATS-04 requires whole-match totals; resetting at half-time would silently under-report the second-half numbers                                    | Validated (v1.7/Ph45) — proven end-to-end by a real two-client socket integration test crossing a MOVE→HALF_TIME boundary            |

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

_Last updated: 2026-08-30 after starting v1.8 milestone_
