# Milestones — Counter Attack Web

## v1.0 MVP — Complete (2026-06-11)

**Tagline:** Two friends can open a browser, share a room code, and play a complete match of Counter Attack against each other in real time.

**Scope:** 13 phases, 51 plans, 330 files changed, 77k+ lines added. 2026-05-27 → 2026-06-11 (15 days).

**Requirements:** 65/66 v1 requirements satisfied. Known deferred: MOVE-06 (free 6-hex move — scaffolded in `gameEngine.ts:517`, handler not implemented; deferred to v1.1).

**Known deferred items at close:** 1 (see STATE.md Deferred Items — `undo-kickoff-ball-bugs` quick task with no formal artifact directory; work captured in git log only).

### Key Accomplishments

1. **Complete playable Counter Attack match** — All core rules implemented end-to-end: 4-5-2 movement sequence, four pass types, heading duels, shot/save duels with GK_DIVING (3-hex dive), SNAP_DEFLECT path-deflection, GK restart (kick/throw/move), Loose Ball, Zone of Influence. Two halves of 45 actions + added time. 10/10 human UAT tests passed.

2. **Deployed to Render** — Single web service serving built React SPA + Socket.io from the same Express process and port. `render.yaml` Blueprint IaC; GitHub Actions CI gate (typecheck → test → build on push). Same-origin WebSocket; no polling fallback.

3. **Full shot resolution pipeline** — Shot declared with two-step Shoot UI (click Shoot → click goal hex); GK_DIVING phase with piece reposition; automatic 1 handling die; SNAP_DEFLECT path-deflection for snapshots; header-at-goal auto-resolved through contestant duel then shot duel.

4. **Server-authoritative pnpm monorepo** — Three packages (`shared`, `server`, `client`) with shared TypeScript types. All dice via `crypto.randomInt`; full state snapshot broadcast after every action; `isProcessing` mutex preventing race conditions. 222+ server integration tests.

5. **SVG hex-grid renderer** — 37×26 flat-top axial grid rendered in React SVG; pitch markings, goal nets, ZoI highlighting, possession dot, valid-move highlights (green/amber). Per-slice Zustand selectors; honeycomb-grid 4.x for hex math.

6. **Post-game replay** — After full time, server streams event log at 1 frame/second; both clients render each state in sequence automatically.

### Archives

- [Roadmap archive](v1.0-ROADMAP.md) — full phase details and plan checklists
- [Requirements archive](v1.0-REQUIREMENTS.md) — all 66 requirements with final status and deferred notes

---

---

## v1.1 UX Tuning & Bug Cleanup — Complete (2026-06-12)

**Tagline:** Visual overhaul with persistent top-band layout, stripe token design, unified hex highlight system, MM:00 clock, kick off enforcement, and 5 rule-correctness bug fixes.

**Scope:** 4 phases, 14 plans, 108 files changed, +16,372 / -995 lines. 2026-06-11 → 2026-06-12 (2 days).

**Requirements:** 13/18 v1.1 requirements fully validated. 3 wired (admin gap — MATCH-07, REPLAY-04, REPLAY-05). 1 spec conflict (MATCH-06 — symmetric formation correct, req text ambiguous). 1 deferred (REPLAY-06 — live-session ball tracking bugs; severity: minor).

**Known deferred items at close:** 6 (see STATE.md Deferred Items — Phase 13 browser UAT (3 items), 5 quick tasks with missing/unknown status; all work committed).

### Key Accomplishments

1. **Rule correctness (Phase 11)** — Fixed 5 gameplay sequencing bugs: header accuracy gate (RULE-01), duel-target ordering (RULE-02), snapshot path cleanup (RULE-03), deflection pace suppression (RULE-04), post-deflect both-teams Movement Phase entry (RULE-05). 35 new server + client tests.

2. **Team token visual redesign (Phase 12)** — Home tokens: vertical black stripe; away tokens: two horizontal dark stripes — distinguishable without labels. Stripe renders identically across on-pitch overlays, stats panel, and replay. Unified hex highlight system: 5 distinct tint types (risk/goal/safe/kickoff/shot-path) with priority resolution. 22 new tests.

3. **Persistent top-band layout + MM:00 clock (Phase 13)** — 80px CSS-Grid top band (scoreboard + player card + action section + log) always visible in all game phases. MM:00 event-driven clock; no PLAY_PHASES gating. HALF_TIME/FULL_TIME as position:absolute pitch overlays; routing simplified; 6 dead component files deleted. 15 new tests (Wave 0 scaffold pattern).

4. **Kick off enforcement + replay overhaul (Phase 14)** — Server-authoritative symmetric DEF/MID formation; KICKOFF_STANDARD_PASS_ONLY guard rejects non-standard passes from kick off hex. Universal `ballAfter` field on 13 ActionEvent union members (TypeScript-enforced). 500ms replay cadence (was 1000ms). Simultaneous K step-frames for movement replay. 5 new tests.

### Archives

- [Roadmap archive](v1.1-ROADMAP.md) — full phase details and plan checklists
- [Requirements archive](v1.1-REQUIREMENTS.md) — all 18 requirements with final status
- [Milestone audit](v1.1-MILESTONE-AUDIT.md) — cross-phase integration check, gap analysis

---

## v1.2 Team Identity & Core Fixes — Complete (2026-07-03)

**Tagline:** Four named teams with badge PNGs and jersey patterns, CSV-seeded rosters with team-selection lobby, 28 rule/bug fixes, and 8 UX enhancements including game speed, end-turn dialog, EventBanner, and final-third markers.

**Scope:** 9 sub-phases (15–18.4), 52 plans, 326 files changed, +60,174 / -2,235 lines. 2026-06-13 → 2026-07-03 (20 days).

**Requirements:** 48/50 v1.2 requirements satisfied. Known deferred at close: OFFSIDE-01/02 (human UAT checkpoints not closed — deferred to Phase 25).

**Known deferred items at close:** 19 (see STATE.md Deferred Items — quick tasks with missing/unknown artifact status, Phase 13 browser UAT items, OFFSIDE-01/02 UAT, GK_KICK replay, KO shading, HP exclusion).

### Key Accomplishments

1. **Four named teams (Phase 15)** — Cozmos, Xolos, City, Crew with badge PNGs, outfield + GK jersey patterns (SVG), TEAM_CONFIGS color system as single source of truth across board, scoreboard, action log, and stats panel. 15 new tests.

2. **CSV-seeded rosters + team-selection lobby (Phase 16)** — CSV → `seed-rosters.ts` generates `HOME_SQUAD`/`AWAY_SQUAD` with 9 attributes per player; player card redesign with compact stats grid; full pre-match team-selection lobby (home picks first, away locked until home confirms). 13 new tests.

3. **Rule correctness sweep + offside detection (Phase 17)** — 7 rule-correctness defects fixed (BUG-01..05, MOVE-06, PASS-02); offside detection with sticky `offsidePieceIds`, team-relative boundary, D-22 clear-path clearing; FREE_MOVE phase after GK kick; 22 new server + client tests.

4. **v1.4.1 action model alignment (Phase 17.1)** — 16 plans across 5 verification cycles: GamePhase rename (PASS→ACTION), aerial stat rename (heading→aerialAbility), ZoI steal/tackle exclusion unification, FIRST_TIME_PASS_MOVE sub-phase, computeLooseBall cube-coordinate rewrite, GK restart FREE_MOVE, self-pass exclusion (`firstTimePassCarrierId`). 72-case regression matrix.

5. **Messaging + logging convention sweep (Phases 18/18.1/18.2)** — ActionLog format unification (TACKLE/STEAL/SHOT/SAVE parity), HEADED_PASS/GK_PUNT events + replay frames, duplicate-logic consolidation, dead-code removal. DESIGN-01..04 satisfied.

6. **Bug-bash + UX overhaul (Phases 18.3/18.4)** — 16 bug-bash fixes (BUG-06..21) across movement state machine, client UX, and rule correctness; 8 UX enhancements (game speed selector, end-turn confirmation dialog, final-third boundary markers, stat tooltips, transient EventBanner with CSS fade, KICK_OFF_SETUP helper copy).

### Archives

- [Roadmap archive](v1.2-ROADMAP.md) — full phase details and plan checklists
- [Requirements archive](v1.2-REQUIREMENTS.md) — all requirements with final status

---

## v1.3 Team Customization & Formation System — Complete (2026-07-11)

**Tagline:** 12 real-league teams (6 MLS + 6 International) with full visual identities; 18-style uniform selection; 4 dynamic formations with stat-driven auto-assignment and player swap; OFFSIDE-01/02 UAT formally closed; FREE_KICK_SETUP redesigned.

**Scope:** 7 phases (19–25), 27 plans, 156 files changed, +11,602 / -2,375 lines. 2026-07-03 → 2026-07-11 (9 days).

**Requirements:** 40/41 v1.3 requirements satisfied.

**Known Gaps at close:**

- BUG-23: KICK_OFF_SETUP shot-path hex shading persists after SNAPSHOT_DEFLECT goal — root cause unresolved; escalated to Phase 26 (v1.4 tech debt)

**Known deferred items at close:** None beyond BUG-23 (acknowledged as v1.4 tech debt in PROJECT.md).

### Key Accomplishments

1. **12-team library — MLS + International (Phases 19–21)** — 6 MLS + 6 International selectable teams; all 10 new teams have 4-color palettes, badge files, default uniform styles, and seeded 11-player squads from PLAYER_POOL; Xolos/Cozmos retired to color-scheme registry; global PLAYER_POOL (178 players) decoupled from team definitions; two-tab TeamSelectionScreen with auto-switch and struck-out cross-player feedback.

2. **18-style parameterized uniform system (Phases 20, 22)** — PieceOverlay rewritten to accept `{ uniformStyle, palette, isGK }` (all hardcoded per-team SVG patterns removed); 18 named styles in UNIFORM_STYLES registry; UniformSelectionScreen with 2×9 tile grid; home-first confirmation gate (away locked with WRONG_TURN until home confirms); away sees awayPrime/awayAlt on tiles; mix-blend-mode:multiply removes white PNG backgrounds.

3. **4 dynamic formations + selection screen (Phase 23)** — 4-4-2, 5-3-2, 4-3-3, 3-4-3 in FORMATIONS table; FormationSelectionScreen on UniformSelectionScreen with mini pitch diagrams; both-player confirmation gate emitting BOTH_FORMATIONS_CONFIRMED; pieces placed at formation hex coordinates with symmetric away mirror (q = 36 − home_q).

4. **Stat-driven auto-assignment + lineup swap (Phase 24)** — computeAutoAssignment 3-pass greedy (GK-lock→anchors→flex) using D-04 stat weights; LineupAssignmentScreen with 4-column stat-card grid and HTML5 drag-swap; GK slot locked server-side; parallel both-confirm gate; pieces positioned at confirmed formation coordinates at KICK_OFF_SETUP.

5. **OFFSIDE-01/02 UAT closure + FREE_KICK_SETUP redesign (Phase 25)** — OFFSIDE-01 formally closed (all three scenarios + stickiness + clear confirmed); FREE_KICK_SETUP 6-step sequence redesigned (kicker-select → 4 repositioning stages → confirm) enabling OFFSIDE-02 UAT closure; GK_KICK + LOOSE_BALL_LAND ball delivery visible in post-game replay (REPLAY-07/08); jersey number vertical centering fixed; Style 12 SVG pattern origin corrected.

6. **Bug & regression closure (Phase 25)** — selectedIsMoving decrement-on-selection regression reverted (Plan 25-07); EventBanner pass-result popup added (Plan 25-03); uniform-selection race condition fixed (Plan 25-04); HIGH_PASS_MOVE carrier exclusion confirmed applied (BUG-22 doc closure).

### Archives

- [Roadmap archive](v1.3-ROADMAP.md) — full phase details and plan checklists
- [Requirements archive](v1.3-REQUIREMENTS.md) — all 41 requirements with final status (40/41 satisfied)
- [Milestone audit](v1.3-MILESTONE-AUDIT.md) — audit run at phases 3/7 (passed)
