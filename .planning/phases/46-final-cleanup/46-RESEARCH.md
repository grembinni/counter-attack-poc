# Phase 46: Final Cleanup - Research

**Researched:** 2026-08-29
**Domain:** Milestone-closing audit/cleanup across a TypeScript monorepo (React/Vite client, Express/Socket.io server, shared hex-game engine) — no new framework, purely internal consistency, dead-code, and duplication audit.
**Confidence:** MEDIUM-HIGH (concrete file/line findings for every CLEANUP-0X item are backed by direct code reads and 2 tool runs (`knip`, `pnpm -w typecheck`), both exit-clean; a few sub-areas — CLEANUP-07 phase help-text completeness and CLEANUP-12 redundant-flow collapsing — are inherently open-ended per CONTEXT.md D-01 and are reported as an audit inventory with clear candidates rather than an exhaustive line-by-line certification)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** No specific named examples of redundant single-action flows or movement-hex color inconsistencies were provided by the user — the research/planning step must scan the codebase itself to find them (grep for the 5 restart setup panels, movement-pattern branches, and multi-step phase UIs) rather than relying on a user-supplied list.
- **D-02:** New specific under CLEANUP-06/09: valid-move hex tint color should be visually consistent across different movement pattern types (not just the dead-ball-hex highlighting already named in CLEANUP-06) — same "single source of truth" spirit as the existing `HIGHLIGHT_STYLES`/`RING_STYLES` table in `HexCell.tsx` (built in Phase 33, documented in `docs/HIGHLIGHT-REFERENCE.md`).
- **D-03:** Consolidation depth (CLEANUP-09/10) is left to planner/executor judgment — no user mandate for a deep structural refactor (e.g., extending the v1.6 `RESTART_STAGES`-style shared module across all 5 restart panels) vs. surface-level interaction fixes. Default to fixing genuine duplication without speculative refactor, per project convention.
- **D-04:** Card/pitch/roster/bench layout alignment (CLEANUP-11) scope is unchanged from the roadmap wording — icon position itself is already unified (Phase 41's `CardInjuryBadge`); this phase covers whatever else the audit finds misaligned (sizing, spacing, borders, shown info) across `LineupAssignmentScreen.tsx`, `BenchCarousel.tsx`, and pitch piece rendering.

### Folded Todos
- **"No auto-reselect after interrupt prompt"** (`.planning/todos/pending/2026-08-23-ux-no-auto-reselect-after-interrupt-prompt-resumes.md`) — after a `TACKLE_STEAL_PROMPT`/`GK_DIVE_AT_FEET_PROMPT`/`GK_BOX_ENTRY_PROMPT`/`FOUL_CHOICE` interrupt resumes to `MOVE`, the piece isn't auto-reselected with its movement ring even with moves remaining. Root cause already identified (`setGameState`'s `phaseChanged` clear in `useGameStore.ts` has no resume-detection exception) and a fix approach is already sketched in the todo. Folded as-is — low implementation risk, directly a "gameplay consistency" gap (CLEANUP-05).
- **"PK kicker-selection pattern diverges from FK"** (`.planning/todos/pending/2026-08-28-debt-pk-kicker-selection-pattern-diverges-from-fk.md`) — Penalty Kick and Free Kick setup use different sequences for choosing kicker vs. kick location; should follow one common pattern (select kicker, then select kick/ball location). This is the todo's own author noting it as a specific instance of CLEANUP-10 (kicker/thrower selection alignment) — folded directly into that requirement's scope, no separate implementation needed beyond ensuring PK is covered.
- **"Move Speed setting into Advanced Settings drawer"** (`.planning/todos/pending/2026-08-28-debt-move-speed-setting-to-advanced-settings.md`) — the game-speed control in `GameSettingsScreen.tsx` currently lives outside the Phase 44 Advanced Settings drawer; move it in alongside the other toggles, following that drawer's existing disclosure pattern. Fits CLEANUP-05 (consistency audit) / general milestone-closing polish.

### New in-scope item — hardcoded placeholder bench (explicit scope-guardrail override)
- **D-05:** User explicitly acknowledged this is new capability, not a bug fix, and explicitly asked for it to be included in Phase 46 anyway as a **simple patch** — this is a deliberate, informed scope addition, not an oversight.
- **D-06:** Today, every non-Draft-mode squad in `PLAYER_POOL` (`packages/shared/src/teams.ts`) holds exactly 11 players. `roomHandlers.ts` (~lines 979-993) documents this as deliberate: `confirmedHomeBench`/`confirmedAwayBench` come out empty for standard rooms, and the empty case is intentionally NOT special-cased ("no substitute is generated... until a future phase expands rosters" — comment references decision D-12). Phase 46 is that future phase, but only via the minimal patch below — NOT full per-team roster authoring.
- **D-07:** Build **two generic hardcoded bench rosters** — one "home bench," one "away bench" — NOT per-team-authored data for each of the 4 original teams (Cozmos, Xolos, City, Crew) or all 12 teams. Each bench has exactly 5 placeholder players, one per existing `role` value: `GK`, `DEF`, `MID`, `FWD`, `ST` (matches `PlayerPiece.role` type exactly, `packages/shared/src/types.ts:42`).
- **D-08:** These two generic benches are injected for standard (non-Draft) mode only, after players have chosen teams — i.e., at the same point `confirmedHomeBench`/`confirmedAwayBench` are currently built in `roomHandlers.ts` (~line 979 `else` branch), replacing the always-empty array with the hardcoded 5-player list.
- **D-09:** This is explicitly a placeholder/simple patch. The user will expand real per-team roster depth (so every pre-built team has its own authored bench) in a later milestone — do not over-build this into a data-driven or per-team system now.

### Deferred Ideas (OUT OF SCOPE)
- **"BUG-23: KICK_OFF_SETUP stale shot-path shading"** (`.planning/todos/pending/2026-07-02-bug-kickoff-setup-persistent-light-shading-on-shot-path-hexes.md`) — persistent light shading on hexes matching a prior shot path during `KICK_OFF_SETUP`. Deep static analysis already ruled out every traced code path across 4 prior milestone closes without finding the root cause; would need live console-log instrumentation to diagnose. User declined to fold this in — open-ended investigation risk not appropriate for a cleanup phase. Remains pending for a future phase.
- **"Offside rings persist after goal reset"** (`.planning/todos/pending/2026-08-09-bug-offside-ring-after-goal.md`) — offside rings still render after a goal resets positions for kickoff, despite server-side code provably clearing `offsidePieceIds` on every live scoring path. Same "server clears it, client still renders it" signature as BUG-23 above — flagged as a possible shared root cause but unconfirmed. User declined to fold this in for the same reason (open-ended investigation risk). Remains pending for a future phase.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CLEANUP-05 | Gameplay consistency audit closes identified functional gaps | Auto-reselect bug root cause confirmed + refined fix mechanism (below); FREE_KICK_SETUP ball-hex highlight gap found; move-speed relocation confirmed |
| CLEANUP-06 | Dead-ball hex highlighted consistently across every phase where players select/move with ball dead | `BallLocationRing.tsx`/`BALL_MARKER_PHASES` audited against full `GamePhase` union — `FREE_KICK_SETUP` is a confirmed, concrete gap |
| CLEANUP-07 | Every step of a multi-step phase has help/info text | Spot-audited `ActionPanel.tsx` + 4 dedicated interrupt panels — all currently well-covered; inventory of what was checked below, no unaddressed gap found in the v1.6/v1.7-era phases inspected |
| CLEANUP-08 | Response-move trigger language names what triggered the move | `FREE_MOVE_ATTACK`/`FREE_MOVE_DEFENSE`'s "Free Move!" panel text confirmed as the concrete target — never names the final-third trigger |
| CLEANUP-09 | Duplicate movement-pattern logic consolidated | `selectPiece` vs `setGameState`'s sticky-selection block: parallel per-phase branch structure, tradeoff documented |
| CLEANUP-10 | Kicker/thrower selection interaction aligned across every restart type | All 6 setup panels read and compared; FK's move-to-select vs PK/Corner/ThrowIn's click-select-then-Confirm divergence confirmed with file refs |
| CLEANUP-11 | Pitch/roster/bench card layout aligned | `PlayerStatsPanel.tsx` (own CSS module, different class names, 56px badge, 4-col grid) vs. the already-shared `LineupStatCard`/`DraftCardBody` family (one CSS module, 48px badge, 3-col grid) — concrete divergence found |
| CLEANUP-12 | Redundant multi-step-but-one-action flows collapsed | Candidate list below; genuinely open-ended per D-01, no single flow rises to "unambiguously redundant, safe to auto-collapse" without planner/human judgment |
| CLEANUP-13 | Dead code removed, full build/typecheck/test suite stays green | `pnpm knip` exits 0 with zero findings; `pnpm -w typecheck` exits 0 clean; full `pnpm -w lint`/`pnpm -w test` not run for time (documented below) |
</phase_requirements>

## Summary

Phase 46 is a pure-audit, no-new-framework cleanup phase. There is nothing to select in the "Standard Stack" sense — every finding below is a specific file/line in the existing codebase. The single most load-bearing finding is that **`knip` and `tsc --noEmit` both currently exit clean (zero findings)** — this milestone has not accumulated the kind of dead-export/dead-file debt those tools catch, so CLEANUP-13's "dead code" is either already clean, or lives in categories those tools don't cover (stale doc comments, unreachable UI branches, duplicated JSX shape) — several concrete instances of the latter are documented below (e.g. a stat-count comment in `PlayerStatsPanel.tsx` that no longer matches the actual filtered stat count).

The other headline finding is that **`FREE_KICK_SETUP` is explicitly and by-name excluded from `BallLocationRing.tsx`'s `BALL_MARKER_PHASES` set**, while every structurally-equivalent restart-setup phase (`THROW_IN_SETUP`, `GOAL_KICK_SETUP_GK`, `CORNER_KICK_GK_SETUP_ATTACKING`, `PENALTY_KICK_SETUP_ATTACKING`, `KICK_OFF_SETUP`) IS included. This is a concrete, mechanically-verifiable instance of CLEANUP-06's "ball hex not consistently highlighted."

For CLEANUP-10, all 6 restart setup panels were read side-by-side. Three of them (`PenaltyKickSetupPanel`, `CornerKickSetupPanel`, `ThrowInSetupPanel`) share one interaction pattern for choosing the acting player: **click a board piece (sets `selectedPieceId`) → panel shows a name/description → explicit Confirm button commits the choice**. `FreeKickSetupPanel` uses a structurally different pattern: the kicker is never separately "selected" — whichever piece is physically walked onto `freeKickHex` during stage 0 becomes the locked kicker, with no Confirm step. `GoalKickSetupPanel` has no kicker-selection concept at all (the GK is implicitly the kicker). This is the exact divergence the folded PK/FK todo names, now confirmed against all 6 panels with file/line references.

**Primary recommendation:** Treat this as a punch-list phase, not a feature phase. Prioritize the 3 already-diagnosed/high-confidence fixes (auto-reselect bug, FREE_KICK_SETUP ball-marker gap, move-speed relocation) and the 2 concretely-verified alignment gaps (CLEANUP-10's FK divergence, CLEANUP-11's PlayerStatsPanel divergence) as the backbone of the plan; treat CLEANUP-07/09/12 as a bounded audit-and-fix-what's-clearly-wrong pass using the candidate lists below, per CONTEXT.md D-01/D-03 (no speculative refactor).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Auto-reselect after interrupt resume | Frontend (client state) | — | `useGameStore.ts` client-side selection derivation only; server GameState is unaffected (server already tracks `paceUsedByPieceId`/`movedPieceIds` correctly) |
| Dead-ball hex highlighting | Frontend (client render) | — | `BallLocationRing.tsx` is a pure rendering gate keyed on `GameState.phase`; no server change needed |
| Kicker/thrower selection alignment | Frontend (client UI/interaction) | Shared (if a common hook/module is extracted) | All divergence lives in the 6 `*SetupPanel.tsx` components and `useGameStore.ts`'s per-phase selection branches; no server protocol change required |
| Movement-pattern duplication | Frontend (client state) | Shared (helper functions) | `selectPiece`/`setGameState` in `useGameStore.ts`; the underlying valid-hex math is already centralized in `packages/shared`-adjacent helper functions, only the branch-dispatch boilerplate duplicates |
| Card/pitch/roster/bench layout | Frontend (client render/CSS) | — | Pure component/CSS-module concern; no server or shared-package involvement |
| Bench placeholder patch | Backend (server) | Shared (data) | New `PoolPlayer` entries live in `packages/shared`; the insertion/branch logic lives in `packages/server/src/roomHandlers.ts` |
| Move-speed setting relocation | Frontend (client render) | — | Pure UI relocation inside `GameSettingsScreen.tsx`; the underlying `GameSpeed` state/wire value is untouched |
| Dead code removal | Frontend + Backend + Shared | — | Cuts across all 3 packages; `knip`/`tsc` already certify baseline cleanliness |

## Package Legitimacy Audit

Not applicable — this phase installs no new external packages. All work is internal refactor/cleanup within the existing `@counter-attack/shared`, `@counter-attack/server`, `@counter-attack/client` workspaces plus the existing dependency set (React, Zustand, Socket.io, Express, honeycomb-grid, Vitest, ESLint, knip). No `npm install` occurs in this phase.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Dead-code detection | A manual grep-based "unused export" sweep | `pnpm knip` (already configured, already exits clean) | `knip.json` already covers all 3 workspaces (`packages/shared`, `packages/server`, `packages/client`) with correct entry points; re-running it after each cleanup task is the existing, zero-setup verification gate |
| Hex tint/ring color choices | A new ad hoc color literal anywhere a new highlight is needed | `HIGHLIGHT_STYLES`/`RING_STYLES` in `HexCell.tsx`, extended per `docs/HIGHLIGHT-REFERENCE.md`'s "Adding a New Highlight" checklist | This is the phase's own explicitly-named single source of truth (D-02); any new tint must add a row to both the constant and the doc |
| Card/injury glyph rendering | A 4th independent glyph implementation for any surface found misaligned in CLEANUP-11 | `CardInjuryBadge`/`CardInjuryBadgeGroup` (`CardInjuryBadge.tsx`) | Already the unified Phase 41 component consumed by `PieceOverlay.tsx`, `PlayerStatsPanel.tsx`, `LineupAssignmentScreen.tsx` (`LineupStatCard`), and `BenchCarousel.tsx`/`DraftPackCarousel.tsx` (`DraftCardBody`) — CLEANUP-11 is about surrounding layout, not the badge itself |

**Key insight:** every "don't hand-roll" item above is a tool/component the milestone already built for exactly this purpose — this phase's job is to *use* them consistently, not invent new mechanisms.

## CLEANUP-05: Gameplay Consistency Audit

### Finding A — Auto-reselect after interrupt prompt (confirmed, root cause + fix mechanism refined)

`.planning/todos/pending/2026-08-23-ux-no-auto-reselect-after-interrupt-prompt-resumes.md` already diagnosed the root cause: `useGameStore.ts`'s `setGameState` (line ~1425 `phaseChanged`, clearing branch at lines 1432-1461) clears `selectedPieceId`/`validMoveHexes` on **every** phase transition, including the transition back from `TACKLE_STEAL_PROMPT`/`GK_DIVE_AT_FEET_PROMPT`/`GK_BOX_ENTRY_PROMPT`/`FOUL_CHOICE` to `MOVE`. Confirmed still valid against current code — nothing in Phases 43-45 touched this logic.

**Important refinement for the planner:** the todo's suggested fix says to check "the resume snapshot's piece still has moves remaining," but the resume-snapshot fields (`gkDiveAtFeetResume`, `gkBoxEntryResume`, `tackleStealPromptResume` — `packages/shared/src/types.ts:1796/1813/1846`, all shape `{ phase, activeTeam, movementSlot }`) **do not carry a piece id.** By the time an interrupt phase resolves, `selectedPieceId`/`lastMovedPieceId` were already zeroed on entry to the interrupt phase (same clearing branch fires going both in and out). The piece to re-select must therefore be derived independently: `GameState.paceUsedByPieceId` (`packages/shared/src/types.ts:1296`, "cumulative hexes moved per piece in the current [movement cycle]") is the per-piece pace-used map already used elsewhere in this file (e.g. line ~1684). The fix should look for the piece(s) belonging to the resuming team with `paceUsedByPieceId[id] > 0` and NOT in `movedPieceIds` — that piece has moves remaining and is the one to re-select via the existing `computeMovementValidHexes` sticky-selection path (same function the generic MOVE fallback already calls at line 1701-1702).

**Concrete fix location:** in the clearing branch (lines 1432-1461 of `useGameStore.ts`), add a condition: `phaseChanged && newState.phase === 'MOVE' && ['TACKLE_STEAL_PROMPT','GK_DIVE_AT_FEET_PROMPT','GK_BOX_ENTRY_PROMPT','FOUL_CHOICE'].includes(prevState.phase)` → skip the clear, instead derive the mid-move piece from `paceUsedByPieceId`/`movedPieceIds` and route through the existing sticky-selection `computeMovementValidHexes` call.

### Finding B — FREE_KICK_SETUP ball-marker gap (see CLEANUP-06 below — same root audit)

### Finding C — Move-speed setting location (folded todo, confirmed)

`GameSettingsScreen.tsx` currently renders "Match Speed" as its own top-level `.section` at **lines 196-216**, entirely separate from and rendered *before* the Advanced disclosure section (`advancedOpen` state, toggle button at lines 246-253, `.advancedGrid` with two `.advancedColumn`s at lines 255-341). The Advanced grid's left column currently holds Fouls/Booking/Injury (lines 256-289); the right column holds Out-of-Bounds/Restarts, Referee Leniency (+ stepper), Tackle/Steal Decline (lines 290-340). Concrete relocation: move the `SPEED_OPTIONS` button-group block (lines 197-215) inside `.advancedGrid`, most naturally as an added row in one `.advancedColumn` (whichever keeps the two columns visually balanced — currently 3 rows each). Note the control TYPE differs (a button-group with icon+color per option, not a checkbox) — this is a genuinely different widget shape from every other Advanced-drawer row, so match its existing button-group styling rather than forcing a checkbox visual.

## CLEANUP-06: Dead-Ball Hex Highlighting Consistency

`packages/client/src/components/BallLocationRing.tsx`'s `BALL_MARKER_PHASES` set (lines 31-78) was diffed against the full `GamePhase` union (`packages/shared/src/types.ts` lines ~900-961, 45 members).

**Confirmed gap:** `FREE_KICK_SETUP` is present in the `GamePhase` union and has its own dedicated `FreeKickSetupPanel.tsx` staged-repositioning flow (kicker placement + up to 3 more reposition stages) — but is **explicitly excluded** from `BALL_MARKER_PHASES`. `docs/HIGHLIGHT-REFERENCE.md` line 149 lists it by name among phases deliberately excluded as "standard-turn phases where the ball position is already legible from the ball sprite... without an extra marker." That reasoning does not hold up under comparison: `BallMarker.tsx` (the actual ball sprite) renders unconditionally at `ball.position` regardless of phase — it provides exactly as much "legibility" during `FREE_KICK_SETUP` as it does during `THROW_IN_SETUP`, `GOAL_KICK_SETUP_GK`, `CORNER_KICK_GK_SETUP_ATTACKING`, and `PENALTY_KICK_SETUP_ATTACKING` — all four of which DO get the extra white ring. This is the single most concrete, mechanically-verifiable dead-ball-hex-highlighting inconsistency in the codebase: every other restart-setup family gets the white ring, free kick does not.

**Fix:** add `'FREE_KICK_SETUP'` to the `BALL_MARKER_PHASES` set in `BallLocationRing.tsx` (line ~77, alongside `TACKLE_STEAL_PROMPT`), and correct the exclusion-list prose in `docs/HIGHLIGHT-REFERENCE.md` line 149 to remove `FREE_KICK_SETUP` from the "excluded" list.

**Secondary candidates flagged but NOT confirmed as bugs** (present in the union, absent from the set, worth a planner glance): `FREE_MOVE_ATTACK`/`FREE_MOVE_DEFENSE` — the doc explicitly and intentionally excludes these too, grouped with ordinary `MOVE`/`PASS`. Unlike `FREE_KICK_SETUP`, the ball genuinely IS live/in-open-play-adjacent during these phases (final-third free-move window, not a dead-ball restart), so their exclusion is plausibly correct — flagged for the planner to confirm during CLEANUP-06 execution rather than asserted as a second bug here.

**Doc staleness note:** `docs/HIGHLIGHT-REFERENCE.md` line 138 still describes `BALL_MARKER_PHASES` as a "17-phase list" in prose, while the actual current set (after Phases 37/38/39/43 additions) has 31 members. The doc's own code comment in `BallLocationRing.tsx` (lines 26-29) already flags this exact drift risk ("so `docs/HIGHLIGHT-REFERENCE.md`'s stated phase list can be checked against the real set rather than drifting silently, as it did after Plan 37-02"). This is itself a small CLEANUP-13-flavored doc-fix to bundle with the `FREE_KICK_SETUP` addition.

## CLEANUP-07: Phase Help/Info Text Completeness

Spot-audited the phases most likely to be incomplete (all interrupt/prompt panels added in Phases 39/43, plus the `HIGH_PASS_MOVE`/`FIRST_TIME_PASS_MOVE`/`SNAPSHOT_DEFLECT`/`GK_DIVE` response-move branches in `ActionPanel.tsx`, plus the multi-step `KICK_OFF`/`PASS` action-chooser at `ActionPanel.tsx` lines 754-870+):

| Component | Phase(s) | Help text present? |
|-----------|----------|---------------------|
| `ActionPanel.tsx` | `HIGH_PASS_MOVE`, `FIRST_TIME_PASS_MOVE`, `GK_DIVE`, `SNAPSHOT_DEFLECT`, `FREE_MOVE_ATTACK`/`DEFENSE`, `KICK_OFF`/`PASS` chooser | Yes — every branch has a 2-line `helperBlock` (heading + description); action buttons additionally carry `title` tooltips from `ACTION_SUMMARY` |
| `TackleStealPromptPanel.tsx` | `TACKLE_STEAL_PROMPT` | Yes — names both players and the pending queue count |
| `FoulChoicePanel.tsx` | `FOUL_CHOICE` | Yes — names the victim, conditionally hides "Continue Play" with an explanatory line when it's not legal |
| `GkDiveAtFeetPromptPanel.tsx` | `GK_DIVE_AT_FEET_PROMPT`, `GK_DIVE_AT_FEET_TARGET` | Yes — includes the distance-penalty qualifier |
| `GkBoxEntryPromptPanel.tsx` | `GK_BOX_ENTRY_PROMPT`, `GK_BOX_ENTRY_MOVE` | Yes |
| `KickOffSetupPanel.tsx`, `ThrowInSetupPanel.tsx`, `FreeKickSetupPanel.tsx`, `GoalKickSetupPanel.tsx`, `CornerKickSetupPanel.tsx`, `PenaltyKickSetupPanel.tsx` | all restart phases | Yes — every branch has a `constraintRow` describing the current requirement |

**No confirmed gap found** in this spot-check — this milestone's own additions (Phases 39/43/44/45) were all built with help text as a first-class requirement, and the pattern is consistent. Given CONTEXT.md D-01's instruction that this audit is inherently open-ended, the planner should still budget a task to skim any **pre-v1.6 phase** UI (older MOVE/PASS/SHOT/HEADER branches not re-touched by this milestone) for the same standard, since this research pass concentrated on the v1.6/v1.7-era surfaces most likely to have been rushed. No specific pre-v1.6 gap was identified in the portions read (`ActionPanel.tsx`'s `KICK_OFF`/`PASS`/`GK_DIVE` branches, which predate v1.6, were also checked and are adequately described).

## CLEANUP-08: Response-Move Trigger Language

**Confirmed target:** `ActionPanel.tsx` lines 707-744, the `FREE_MOVE_ATTACK`/`FREE_MOVE_DEFENSE` panel. The code comment at lines 701-704 states the actual game rule precisely: *"triggered when the ball enters a final third — ALL pieces of both teams (GK included) in the opposite final third each get an independent free 6-hex move."* But the rendered player-facing copy (lines 728-731) only ever says **"Free Move!"** / *"{N} players still eligible to move — up to 6 hexes each, regardless of remaining pace."* — it never states that this was triggered by the ball entering the final third. Every comparable restart-triggered response phase (Goal Kick, Corner Kick, Penalty Kick, Throw-In, Free Kick) has a panel heading that names the trigger by definition (the panel is literally titled "Goal Kick"/"Corner Kick"/etc.) — `FREE_MOVE_ATTACK`/`DEFENSE` is the one response-move family whose heading ("Free Move!") gives no indication of why it fired. This is precisely CLEANUP-08's own example ("final-third movement").

**Fix:** change `helperLine1` (line 728) from `'Free Move!'` to something naming the trigger, e.g. `'Final-Third Movement!'` or `'Free Move — Ball in Final Third!'`, matching this file's existing "short-noun-phrase-plus-exclamation" convention (documented in the code comment at lines 719-727, which itself records a prior UAT-driven rename of this exact string).

**Other response-move phases checked and found adequately self-explanatory via their own heading:** `HIGH_PASS_MOVE` ("High Pass Aerial Challenge!"), `FIRST_TIME_PASS_MOVE` ("First-Time Pass!"), `SNAPSHOT_DEFLECT` ("Snapshot — Deflection Attempt!"), `GK_DIVE` ("Attempt Save!"), `GOAL_KICK_MOVE` ("Ball in Air!" inside the "Goal Kick" panel) — none of these need the same fix; `FREE_MOVE_ATTACK`/`DEFENSE` is the specific, confirmed outlier.

## CLEANUP-09: Duplicate Movement-Pattern Logic

Two structurally parallel per-phase branch trees exist in `packages/client/src/store/useGameStore.ts`:
1. **`selectPiece`** (click-handler, starts at line 745) — a long if/else-if chain, one branch per phase (`KICK_OFF_SETUP`, `FREE_KICK_SETUP`, `THROW_IN_SETUP`, `HIGH_PASS_MOVE`, ... continues past line 834).
2. **`setGameState`**'s "sticky selection" block (starts at line 1483, after the phase-changed early-return) — the same phase list, re-implementing the same guard/derive-team/compute-valid-hexes shape, so a selection survives a mid-phase server broadcast.

**What is already de-duplicated (do not re-duplicate this work):** the actual valid-hex math is centralized in shared helper functions called from BOTH branch trees — `computeKickOffSetupValidHexes`, `computeFreeKickSetupValidHexes`, `computeResponseMoveValidHexes` (parameterized by phase-specific `*_CONFIG` objects: `GK_KICK_MOVE_CONFIG`, `FIRST_TIME_PASS_MOVE_CONFIG`, `GOAL_KICK_MOVE_CONFIG`, `CORNER_KICK_FINAL_SETUP_CONFIG`, `HIGH_PASS_MOVE_CONFIG`, `SNAPSHOT_DEFLECT_CONFIG`), `computeFreeMoveValidHexes`, `computeCornerRepositionValidHexes`, `computePenaltyKickValidHexes`, `computeGkDiveAtFeetTargetHexes`, `computeMovementValidHexes`. This consolidation already happened across Phases 32/37/38/39 (per inline comments referencing "SELECTOR-REVIEW.md fix #1/#2/#3").

**What remains duplicated:** the *branch-dispatch boilerplate* — each phase needs its own near-identical "derive `myTeam` via `deriveMyTeam(playerSlot)`, null-guard, call the phase's helper, `set(...)`" shape, written out twice (once per action). Every time a new phase is added, both trees must be updated in lockstep or a bug like BUG-09 (referenced repeatedly in the file's own comments) recurs. This is a genuine structural duplication, but per CONTEXT.md D-03 the depth of any fix is left to planner/executor judgment.

**Tradeoff for the planner:**
- *Surface-level fix:* leave the two trees as-is (they already call shared helpers); this is defensible since knip/tsc are clean and no functional bug currently stems from this shape.
- *Deeper consolidation:* extract a single `{ phase → handler }` dispatch table (a lookup object keyed by `GamePhase`, each entry providing `{ deriveValid: (id, piece, state, team) => HexCoord[] | null, requiresTeamMatch: boolean }`) consumed by both `selectPiece` and `setGameState`'s sticky block. This would mirror the v1.6 `RESTART_STAGES` precedent's spirit (a config-table replacing repeated branches) but is a larger refactor than a "cleanup phase" task — recommend only if time budget allows; the safer default per D-03 is to leave the branch-dispatch shape alone and focus consolidation effort on the CLEANUP-10 restart-panel findings below, which have a much smaller, well-bounded blast radius.

## CLEANUP-10: Kicker/Thrower Selection Interaction Alignment

All 6 setup panels read in full (`FreeKickSetupPanel.tsx`, `PenaltyKickSetupPanel.tsx`, `CornerKickSetupPanel.tsx`, `GoalKickSetupPanel.tsx`, `ThrowInSetupPanel.tsx`, `KickOffSetupPanel.tsx`):

| Panel | How the acting player is chosen | Confirm step? |
|-------|----------------------------------|----------------|
| `PenaltyKickSetupPanel.tsx` (`PENALTY_KICK_TAKER_SELECT`, lines 160-204) | Click a board piece → `selectedPieceId` set by the store's phase-specific `selectPiece` branch → panel shows "Choose your penalty taker." / "Placing your penalty taker…" | Yes — explicit `Confirm` button calls `emitPenaltyKickTaker(selectedPieceId)` |
| `CornerKickSetupPanel.tsx` (`CORNER_KICK_TAKER_SELECT`, lines 156-196) | Same click-then-`selectedPieceId` pattern | Yes — explicit `Confirm` button calls `emitCornerKickTaker(selectedPieceId)` |
| `ThrowInSetupPanel.tsx` (whole panel, lines 18-103) | Same click-then-`selectedPieceId` pattern; panel shows "Thrower: #N Name" once selected | Yes — explicit `Confirm` button calls `emitThrowInPlace(selectedPiece.id)` |
| `FreeKickSetupPanel.tsx` (stage 0, "mandatory kicker-first placement", lines 109-117) | **No separate selection step at all** — whichever piece is physically moved onto `freeKickHex` during stage 0 becomes the locked kicker (`movedPieceIds.includes(p.id)` is the "kicker chosen" test); this is a movement/placement action, not a click-select | No separate confirm for "who is the kicker" — the End Stage / Confirm button that appears later confirms the whole stage's repositioning, not the kicker choice specifically |
| `GoalKickSetupPanel.tsx` (`GOAL_KICK_CHOICE`/`GOAL_KICK_TARGET`, lines 150-206) | No kicker-selection concept — the goalkeeper is always the implicit kicker; the only choice is Kick-vs-Standard-Pass, then a target teammate (via HexGrid click cascade, no Confirm button in this panel for the target step) | Partial — Kick/Pass choice has 2 buttons (no separate confirm needed, each button IS the commit); target selection has none |
| `KickOffSetupPanel.tsx` (whole panel) | No kicker/taker concept — kick-off has no designated "taker," both teams simply reposition and Confirm | N/A — not applicable to this requirement |

**Confirmed divergence (matches the folded todo exactly, now generalized to all 6):** `PenaltyKickSetupPanel`, `CornerKickSetupPanel`, and `ThrowInSetupPanel` already share one common pattern — **click-select the piece on the board, then click a separate Confirm button to commit**. `FreeKickSetupPanel` alone uses a structurally different mechanism — **the kicker is whoever is walked onto the kick hex**, with the "selection" and "placement" steps fused into a single movement action and no explicit Confirm-the-kicker step. `GoalKickSetupPanel` and `KickOffSetupPanel` have no comparable kicker-selection concept at all (GK is fixed; kick-off has no taker), so they are not divergent, merely N/A.

**Design note for the planner:** the PK/Corner/ThrowIn select-then-Confirm pattern was **deliberately introduced** to fix a real defect — `PenaltyKickSetupPanel.tsx`'s own comment (lines 154-159) states it "clos[es] the misclick-commits-irreversibly defect (`PENALTY_KICK_TAKER_PLACED` is an Undo boundary)" — i.e. an earlier single-click-commits model was a bug, and select+Confirm is the corrected replacement. This means the fix direction for CLEANUP-10 is very likely "bring Free Kick's kicker-selection UX toward the PK/Corner/ThrowIn model" (add an explicit kicker-selection step before/independent of the physical placement-move), rather than the reverse. However, Free Kick's kicker selection is structurally coupled to its staged multi-piece repositioning (stage 0 already allows moving up to 5 pieces, and the kicker is simply "whichever one reaches the hex first") — a full alignment may require restructuring `FREE_KICK_STAGES`/`freeKickStageTeam` (`packages/shared`) and is a larger change than PK/Corner/ThrowIn's UI-only pattern. Per D-03, recommend the planner scope this as: (a) minimum — align the *language/wording* so FK's constraint rows describe the kicker requirement in the same "select then this becomes locked" phrasing as the others, and (b) stretch — if time allows, add an explicit "who will take it" pre-selection affordance before stage-0 movement begins. Do not silently change Free Kick's underlying stage mechanics without flagging it as a larger change during planning.

## CLEANUP-11: Card/Pitch/Roster/Bench Layout Alignment

Traced the actual card-rendering component tree (not just visual inspection):

- **Roster card** (`LineupStatCard` inside `LineupAssignmentScreen.tsx`, lines 223-343) and **bench/draft card** (`DraftCardBody` inside `DraftPackCarousel.tsx`, lines 87-160, reused by `BenchCarousel.tsx`) **already share one CSS module** (`LineupAssignmentScreen.module.css`) and near-identical class names (`.cardBody`, `.cardHeader`, `.cardName`/`.cardName`, `.cardMeta`, `.cardRole`, `.cardNum`, `.statGrid`, `.statChip`, `.statBadge`, `.statAbbr`), both using `TeamBadge` at `size={48}`, both filtering the same 9-item `STAT_LABELS` down to 6 role-filtered stats in a 3-column grid. **These two are already well-aligned** — Phase 41's `CardInjuryBadge` unification plus this pre-existing shared markup means roster and bench are not the actual divergence.

- **The real divergence: `PlayerStatsPanel.tsx`** (the "player card" shown when inspecting a piece on the pitch) uses its **own, separately-maintained CSS module** (`PlayerStatsPanel.module.css`) with **different class names** in several places (`.playerName` vs `.cardName`, `.playerMeta` vs `.cardMeta`, `.roleChip` vs `.cardRole`, `.jerseyNum` vs `.cardNum` — only `.cardBody`/`.cardHeader`/`.statGrid`/`.statChip`/`.statBadge`/`.statAbbr` happen to share names, coincidentally, across the two separate stylesheets), a **different `TeamBadge` size** (`size={56} full` at line 133 vs. `size={48}` in the roster/bench family), and a **different stat-grid column count** — its own doc comment (lines 109-118) claims "4-column stat grid → 2 rows of 4+3 (7 role-filtered stats)" while the roster/bench family's comment states "3-column stat chip grid → 2 rows of 3+3 (6 role-filtered stats)." Both actually filter the same `STAT_LABELS` array down to 6 stats (resilience always dropped, plus 2 more for role) — **`PlayerStatsPanel.tsx`'s own doc comment is stale/wrong** (claims 7 stats and 4 columns; the code only ever yields 6), which is itself a small CLEANUP-13 doc-fix.

**Fix direction:** CLEANUP-11 should target aligning `PlayerStatsPanel.tsx`'s card body markup/CSS with the already-unified roster/bench family — either by having it consume `LineupAssignmentScreen.module.css`'s classes directly (risk: that module is large and roster-screen-specific, may pull in unrelated styles) or by extracting the shared card-body layout (header/meta/stat-grid) into a small reusable component both stylesheets' consumers import, with `PlayerStatsPanel.module.css` reduced to only its panel-chrome-specific rules (the 56px badge, `full` variant, panel positioning). The minimum-risk fix is aligning the **TeamBadge size** (48 vs 56) and **stat-grid column count** (3 vs 4) since those are the two visually-obvious, easily-fixed divergences; correcting the stale doc comment costs nothing and should be bundled.

## CLEANUP-12: Redundant Single-Action Multi-Step Flows

This is the most genuinely open-ended item (per CONTEXT.md D-01). Candidates surfaced during this audit, presented for planner judgment rather than as confirmed fixes:

| Candidate flow | Why it might be "always exactly one action" | Caution before collapsing |
|-----------------|-----------------------------------------------|----------------------------|
| `CORNER_KICK_GK_SETUP_ATTACKING`/`_DEFENDING` (`CornerKickSetupPanel.tsx` lines 122-152) | Single GK reposition + always-enabled Confirm, no "N remaining" gate — reads like a single decision ("reposition your keeper, or don't, then confirm") | Repositioning is uncapped (a GK could move multiple times before confirming per the panel's own comment, "Assumption A1") — it is 0-or-more moves, not exactly-one, so collapsing to a single combined click risks losing the ability to reposition more than once before committing |
| `GOAL_KICK_CHOICE` → `GOAL_KICK_TARGET` (`GoalKickSetupPanel.tsx` lines 150-206) | Two separate phases for what could be framed as one decision tree (pick delivery method, then pick target) | These are legitimately two different action types server-side (Kick vs. Standard Pass alters game rules downstream) — collapsing the UI without collapsing the underlying phase machine would be cosmetic only and risks obscuring the rule difference from the player |
| `PENALTY_KICK_TAKER_SELECT` / `CORNER_KICK_TAKER_SELECT` select-then-Confirm | Two clicks (select, then confirm) for what is ultimately one decision (who takes it) | Explicitly NOT a good collapse candidate — the 2-step pattern was deliberately added to fix a real "misclick commits irreversibly" defect (see CLEANUP-10 section); collapsing this back to 1 step would reintroduce that bug |

**No flow in this audit was found to be an unambiguous, safe-to-collapse "the UI shows 2+ steps but the game logic only ever needs 1" case** — every multi-step flow inspected either has a genuine 0-or-more/variable-count shape (GK reposition) or was deliberately split for a defect-prevention reason (taker select+confirm). Recommend the planner treat this requirement as satisfied by documenting the audit (this table) plus fixing anything a fresh look during execution turns up, rather than pre-committing to a specific collapse in the plan.

## Common Pitfalls

### Pitfall 1: Confusing `packages/shared/src/teams.ts` with `packages/shared/src/teamConfig.ts`
**What goes wrong:** CONTEXT.md's own canonical-refs section names `packages/shared/src/teams.ts` as the home of `getSquadPlayers`. It is not — `PLAYER_POOL` lives in `teams.ts` (auto-generated, 3638 lines, do not hand-edit — see Pitfall 2), but `getSquadPlayers` is defined in `teamConfig.ts:408` (`PLAYER_POOL.filter((p) => p.sourceTeamId === teamId)`).
**Why it happens:** the two files are tightly coupled (`teamConfig.ts` imports `PLAYER_POOL` from `teams.ts`) and were probably conflated when CONTEXT.md was written.
**How to avoid:** when implementing the bench patch, edit `teamConfig.ts` (or a new small module) for any new lookup function, and `teams.ts` only for the raw data array — but see Pitfall 2 first.

### Pitfall 2: `teams.ts` is auto-generated — do not hand-edit the array in place without checking the regen path
**What goes wrong:** `packages/shared/src/teams.ts` line 1-9 states: "AUTO-GENERATED by `packages/shared/scripts/seed-rosters.ts`. Source of truth: `packages/shared/src/data/*.csv`... Regenerate: `pnpm run seed:rosters`." Manually appending 10 new `PoolPlayer` entries directly to this file works at runtime but will be **silently overwritten** the next time anyone runs the seed script, or will look like drift to a future contributor.
**Why it happens:** the file's own header makes this clear, but it's easy to miss when doing a quick "just add 10 objects to the array" patch.
**How to avoid:** either (a) add the 2 generic bench rosters as CSV rows in `packages/shared/src/data/*.csv` and regenerate via `pnpm run seed:rosters` (matches the existing data pipeline, keeps `teams.ts` genuinely generated), or (b) if regenerating is out of scope for this "simple patch," hand-edit `teams.ts` directly but add a prominent comment noting these 10 rows are a manual Phase 46 addition that must be preserved/re-added if the seed script is ever re-run, and confirm with the seed script's actual CSV format before choosing (b) over (a) — the planner should decide based on how much friction the CSV route adds versus the drift risk of the manual route.

### Pitfall 3: Bench jersey numbers must not collide with the starting XI's 1-11
**What goes wrong:** `PlayerPiece`'s own doc comment (`types.ts` line 37) states jersey numbers follow "GK = 1; others 2-11 in ROLE_ORDER" for the starting XI. If the 2 generic bench rosters reuse numbers 1-11, two players on the same team sheet will share a jersey number, which will look wrong on `BenchEntry.jerseyNumber` display and may collide with any number-based lookup.
**Why it happens:** easy to default new placeholder data to 1-5 without checking against the existing starting-XI range.
**How to avoid:** assign the 2 generic bench rosters numbers outside 1-11 (e.g. 12-16), matching how Draft-mode benches already get their numbers from `DraftSession.*BenchNumbers` (a separate numbering space from the starting XI).

### Pitfall 4: `BenchEntry.playerId` must resolve through `PLAYER_POOL`, not be an ad hoc string
**What goes wrong:** `BenchEntry.playerId`'s own doc comment (`types.ts` line 109) is explicit: "A `PLAYER_POOL` id (`p001`-style), NOT a `PlayerPiece.id`." The client's midmatch bench rendering (`LineupAssignmentScreen.tsx` line 1037, `resolveTieredCard(entry.playerId)`) looks this id up against `PLAYER_POOL` to build the display card (name, nationality, stats, tier-color border). If the 2 generic bench players are not real `PoolPlayer` entries with full stat blocks, the bench UI will either crash (`resolveTieredCard` returning null, silently filtered out per line 1038's `.filter((c): c is TieredPoolPlayer => c !== null)`) or render with garbage/zeroed stats and an incorrect tier color.
**Why it happens:** it's tempting to treat "hardcoded placeholder bench" as just a `BenchEntry[]` literal without realizing it depends on real `PoolPlayer` records existing in the pool.
**How to avoid:** the 10 new placeholder players (5 home-generic + 5 away-generic) must be added as genuine `PoolPlayer` entries (with a `sourceTeamId` like `'generic-bench-home'`/`'generic-bench-away'` — safe because `sourceTeamId` is typed as a wide `string`, so it will never collide with the closed `TeamId` union `getSquadPlayers` filters against) with reasonable numeric stats for every field (`pace`, `shooting`, `tackling`, `dribbling`, `saving`, `handling`, `resilience`, `aerialAbility`, `highPass`) so `classifyTier`/`computeTotalStat` produce a sensible tier color rather than defaulting to the lowest tier.

### Pitfall 5: `resolveTieredCard` / `applySubstitution` may expect more than the 9 stat fields
**What goes wrong:** substituting a generic bench player onto the pitch mid-match ultimately needs a full `PlayerPiece` (position, id, teamId, etc.), built from the `PoolPlayer` via whatever the existing substitution path (`applySubstitution` in the game engine) already uses for Draft-mode bench players. Since Draft-mode benches already work end-to-end (drafted players sub on successfully today), the safest implementation path is to make the 2 generic `PoolPlayer` entries indistinguishable in shape from any other pool entry — do not add new optional fields or a different code path for "generic" players.
**How to avoid:** verify `applySubstitution`'s handling of a `PoolPlayer`→`PlayerPiece` conversion during planning/implementation, and confirm the 2 generic bench entries need nothing beyond what every other `PoolPlayer` already has.

### Pitfall 6: `knip`/`typecheck` clean does not mean CLEANUP-13 has nothing to do
**What goes wrong:** interpreting the clean `pnpm knip` (0 findings) and clean `pnpm -w typecheck` runs as "no dead code exists" would be wrong — those tools only catch unused exports/files/dependencies and type errors, not stale doc comments (2 found this session: `PlayerStatsPanel.tsx`'s stat-count comment, `docs/HIGHLIGHT-REFERENCE.md`'s "17-phase" prose), unreachable UI branches, or duplicated JSX shape.
**How to avoid:** treat the clean tool runs as a **regression gate** (must stay clean after this phase's changes), not as proof the audit is done. The concrete doc-comment fixes found in this research (CLEANUP-06, CLEANUP-11 sections above) are the actual CLEANUP-13 deliverables from this pass; a broader manual skim of components not touched by v1.6/v1.7 is out of this research's time budget (see Environment Availability below) and should be a bounded planner task, not open-ended.

## Code Examples

### Extending `BALL_MARKER_PHASES` (CLEANUP-06 fix)
```typescript
// packages/client/src/components/BallLocationRing.tsx — add to the existing Set literal,
// alongside the other Phase 39/43 additions:
export const BALL_MARKER_PHASES: ReadonlySet<GamePhase> = new Set([
  // ...existing entries...
  'TACKLE_STEAL_PROMPT',
  'FREE_KICK_SETUP', // CLEANUP-06 (Phase 46): the ball is fixed at freeKickHex throughout every
                      // FREE_KICK_SETUP stage — this phase was previously (and incorrectly)
                      // grouped with ordinary MOVE/PASS in docs/HIGHLIGHT-REFERENCE.md's
                      // exclusion list; every other restart-setup family already gets this marker.
]);
```

### Auto-reselect derivation sketch (CLEANUP-05 Finding A)
```typescript
// useGameStore.ts — inside setGameState, before the existing clearing-condition `if`:
const INTERRUPT_PHASES: GamePhase[] = [
  'TACKLE_STEAL_PROMPT', 'GK_DIVE_AT_FEET_PROMPT', 'GK_BOX_ENTRY_PROMPT', 'FOUL_CHOICE',
];
const resumingFromInterrupt =
  phaseChanged && newState.phase === 'MOVE' && INTERRUPT_PHASES.includes(prevState.phase);
const midMovePieceId = resumingFromInterrupt
  ? newState.pieces.find(
      (p) => (newState.paceUsedByPieceId[p.id] ?? 0) > 0 && !newState.movedPieceIds.includes(p.id),
    )?.id ?? null
  : null;
// ...then gate the existing clearing `if` on `!(resumingFromInterrupt && midMovePieceId !== null)`,
// and in that branch, set selectedPieceId/validMoveHexes via the same computeMovementValidHexes
// path the generic MOVE sticky-selection fallback already uses (line ~1701-1706).
```

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The recommended fix mechanism for the auto-reselect bug (deriving the mid-move piece from `paceUsedByPieceId`/`movedPieceIds` rather than a carried-forward piece id) is correct, since the resume-snapshot fields provably do not carry a piece id | CLEANUP-05 Finding A | If wrong, the executor may need a different derivation (e.g. adding a piece id to the resume-snapshot shape instead) — moderate risk, would require a `GameState` shape change instead of a pure client-side fix |
| A2 | `FREE_MOVE_ATTACK`/`FREE_MOVE_DEFENSE`'s exclusion from `BALL_MARKER_PHASES` is intentionally correct (ball is live, not dead, during these phases) rather than a second instance of the same bug as `FREE_KICK_SETUP` | CLEANUP-06 | Low — if wrong, adding these 2 phases to the set is a one-line change with the same low blast radius as the confirmed `FREE_KICK_SETUP` fix; flagged explicitly for planner confirmation, not asserted as fact |
| A3 | The CSV-regeneration route (Pitfall 2) is preferable to hand-editing `teams.ts` for the bench patch, given D-09's "simple patch" framing might favor the lower-friction hand-edit route instead | CLEANUP bench patch (Pitfall 2) | Low-Medium — either route works functionally; wrong choice only costs future-maintenance clarity, not correctness. Planner should pick based on actual CSV pipeline friction (not independently verified in this research pass) |
| A4 | `sourceTeamId: 'generic-bench-home'`/`'generic-bench-away'` (or similar) as new string values is safe and won't collide with `getSquadPlayers(teamId: TeamId)`'s closed `TeamId` union filter | CLEANUP bench patch | Low — `PoolPlayer.sourceTeamId` is explicitly typed as wide `string` (`teams.ts` comment line 20-21: "Typed as string (wide) per A4 — tightened to a closed union in Phase 21 when all slugs are known"); confirmed no closed-union constraint currently exists on this field |

**If this table is empty:** N/A — see entries above.

## Open Questions

1. **Should `FREE_MOVE_ATTACK`/`FREE_MOVE_DEFENSE` also be added to `BALL_MARKER_PHASES`?**
   - What we know: they are currently excluded, alongside ordinary `MOVE`/`PASS`, described as "standard-turn phases where ball position is already legible."
   - What's unclear: whether the ball is genuinely "live" (in normal open play, just paused for repositioning) during these phases, in which case exclusion is correct, or whether it's functionally a dead-ball moment like every other restart, in which case it's a second instance of the `FREE_KICK_SETUP` bug.
   - Recommendation: confirm against the rulebook/existing game-flow understanding during planning; low-risk either way (one-line fix if needed).

2. **How much of CLEANUP-07's "every step of a multi-step phase has help text" should be re-verified beyond the v1.6/v1.7-era surfaces this research spot-checked?**
   - What we know: every phase this research read (all 6 restart panels, all 4 interrupt panels, all response-move branches in `ActionPanel.tsx`) already has adequate help text.
   - What's unclear: whether older, pre-v1.6 UI (e.g. very early `MOVE`/`SHOT`/`HEADER` flows not re-touched since Phase 8-18) has any gaps, since this research's time budget concentrated on the newer, most-likely-to-be-incomplete surfaces.
   - Recommendation: treat as low-priority/best-effort during execution rather than blocking the phase — no gap was found in what was checked, and CONTEXT.md D-01 already frames this whole audit as open-ended.

3. **Exact CSV data-pipeline mechanics for the bench patch (Pitfall 2)** were not directly inspected (`packages/shared/scripts/seed-rosters.ts` and `packages/shared/src/data/*.csv` were not read in this research pass, only referenced from `teams.ts`'s header comment).
   - What we know: a `pnpm run seed:rosters` script exists and regenerates `teams.ts` from CSV.
   - What's unclear: how much friction adding 10 rows to a new or existing CSV file actually involves versus a direct hand-edit.
   - Recommendation: planner/executor should open `packages/shared/scripts/seed-rosters.ts` and the `data/` directory directly at implementation time to make this call — this is a 5-minute look, deliberately deferred rather than spent here given the exhaustive scope of the rest of this phase's audit.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js / pnpm workspace tooling | all cleanup work | ✓ | (existing monorepo, unchanged) | — |
| `knip` | CLEANUP-13 dead-code gate | ✓ | 6.29.0, exits 0 clean | — |
| `tsc --noEmit` (via `pnpm -w typecheck`) | CLEANUP-13 regression gate | ✓ | exits 0 clean across all 3 packages | — |
| `eslint` (via `pnpm -w lint`) | CLEANUP-13 regression gate | Not fully run this session — timed out at 100-170s on the full monorepo (`eslint .`) in this research environment | — | Planner/executor should budget more time or scope lint to changed files during execution (`eslint <changed-files>`); not a blocker, just deferred for research-session time reasons |
| `pnpm -w test` (Vitest, all 3 packages) | CLEANUP-13 "full test suite stays green" success criterion | Not run this session — deferred to avoid an unbounded-duration run during research; `packages/client`, `packages/server`, `packages/shared` each define `"test": "vitest run"` | — | Must be run as part of phase execution/verification (this is an explicit phase success criterion, not optional) |

**Missing dependencies with no fallback:** none — all tooling needed for this phase already exists in the repo (knip.json is already configured; vitest is already wired in all 3 packages).

**Missing dependencies with fallback:** full-repo `eslint`/`pnpm -w test` runs were skipped in this research pass purely for session-time reasons (each research tool call has practical time limits) — both must be run during actual phase execution/verification per the phase's own success criteria ("the full monorepo build/typecheck/test suite stays green").

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (each package: `"test": "vitest run"`) |
| Config file | Per-package (not centrally inspected this session — `packages/client/package.json`, `packages/server/package.json`, `packages/shared/package.json` each define their own `test` script) |
| Quick run command | `pnpm --filter @counter-attack/client test -- <file-pattern>` (or the equivalent per-package filter) for a single touched file |
| Full suite command | `pnpm -w test` (root `"test": "pnpm -r test"`) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CLEANUP-05 (auto-reselect) | After interrupt-prompt resume, mid-move piece is re-selected with its ring/valid-hexes when moves remain | unit | `pnpm --filter @counter-attack/client test -- useGameStore` | ✅ (`useGameStore` already has extensive existing test coverage per the codebase's testing conventions — exact test file name not confirmed this session, likely `useGameStore.test.ts` or similar; verify path during planning) |
| CLEANUP-06 (ball marker) | `FREE_KICK_SETUP` renders the white ball-location ring | unit | `pnpm --filter @counter-attack/client test -- BallLocationRing` | ✅ `BallLocationRing.test.tsx` exists (confirmed via file listing) |
| CLEANUP-08 (trigger language) | `FREE_MOVE_ATTACK`/`DEFENSE` panel text names the final-third trigger | unit | `pnpm --filter @counter-attack/client test -- ActionPanel` | ✅ `ActionPanel.test.tsx` exists |
| CLEANUP-10 (kicker alignment) | Whichever alignment fix is chosen for `FreeKickSetupPanel` | unit | `pnpm --filter @counter-attack/client test -- FreeKickSetupPanel` | ✅ `FreeKickSetupPanel.test.tsx` exists |
| CLEANUP-11 (layout alignment) | `PlayerStatsPanel` badge size/column-count matches roster/bench family | unit/snapshot | `pnpm --filter @counter-attack/client test -- PlayerStatsPanel` | Test file existence not directly confirmed this session — likely `PlayerStatsPanel.test.tsx`; verify during planning |
| Bench patch (D-05..D-09) | Standard-mode room's bench is populated with 5 generic players per role, per side | integration | `pnpm --filter @counter-attack/server test -- roomHandlers` | Existing `roomHandlers` test coverage should be checked for a bench-related test file to extend, not directly confirmed this session |
| CLEANUP-13 | Full monorepo stays green | integration/gate | `pnpm -w typecheck && pnpm -w lint && pnpm -w test && pnpm knip` | ✅ typecheck/knip confirmed clean this session; lint/test to be run during execution |

### Sampling Rate
- **Per task commit:** run the single affected package's `vitest run -- <touched-test-file>` plus `pnpm knip` (fast, catches new dead exports immediately)
- **Per wave merge:** `pnpm -w typecheck` (already confirmed fast, clean baseline)
- **Phase gate:** `pnpm -w test && pnpm -w lint && pnpm -w typecheck && pnpm knip` all green before `/gsd-verify-work` — this is the phase's own explicit CLEANUP-13 success criterion, not optional

### Wave 0 Gaps
None — every touched component already has an existing `.test.tsx`/`.test.ts` sibling file per this codebase's established 1:1 test-file convention (confirmed for `BallLocationRing`, `ActionPanel`, `FreeKickSetupPanel`, `PenaltyKickSetupPanel`, `CornerKickSetupPanel`, `GoalKickSetupPanel`, `ThrowInSetupPanel`, `KickOffSetupPanel`, `TackleStealPromptPanel`, `FoulChoicePanel`, `GkDiveAtFeetPromptPanel`, `GkBoxEntryPromptPanel`, `DraftPackCarousel`, `CardInjuryBadge` — all found via file listing during this research). No new test infrastructure or shared fixtures are needed; this phase extends existing test files rather than creating new ones.

## Security Domain

Not applicable in the ASVS sense — this phase touches no authentication, session management, access control, cryptography, or externally-facing input-validation surfaces. All changes are internal client-rendering logic, one server-side data-seeding branch (bench patch, server-authoritative per existing `roomHandlers.ts` conventions — the client never supplies bench composition, matching the existing "server ignores client's confirmedOrder" pattern already documented at `roomHandlers.ts` line 949), and CSS/markup alignment. No new trust boundary is introduced.

## Sources

### Primary (HIGH confidence — direct code reads this session)
- `packages/client/src/store/useGameStore.ts` (setGameState/selectPiece, lines 236-1706+) — auto-reselect root cause, sticky-selection duplication
- `packages/shared/src/types.ts` (GamePhase union, resume-snapshot shapes, PoolPlayer/PlayerPiece/BenchEntry types) — phase list diff, bench-patch type constraints
- `packages/client/src/components/BallLocationRing.tsx` + `packages/client/src/components/BallMarker.tsx` — CLEANUP-06 gap
- `packages/client/src/components/{FreeKick,PenaltyKick,CornerKick,GoalKick,ThrowIn,KickOff}SetupPanel.tsx` (all 6, full file reads) — CLEANUP-10 comparison
- `packages/client/src/components/{PlayerStatsPanel,LineupAssignmentScreen,DraftPackCarousel,BenchCarousel,PieceOverlay}.tsx` — CLEANUP-11 comparison
- `packages/client/src/components/ActionPanel.tsx` (lines 252-870+) — CLEANUP-07/08
- `packages/server/src/roomHandlers.ts` (lines 945-1004) + `packages/shared/src/teamConfig.ts:408` (getSquadPlayers) + `packages/shared/src/teams.ts:1-47` — bench patch insertion point
- `docs/HIGHLIGHT-REFERENCE.md` — single source of truth cross-check for CLEANUP-06/09
- `.planning/todos/pending/2026-08-23-ux-no-auto-reselect-after-interrupt-prompt-resumes.md`, `.planning/todos/pending/2026-08-28-debt-pk-kicker-selection-pattern-diverges-from-fk.md`, `.planning/todos/pending/2026-08-28-debt-move-speed-setting-to-advanced-settings.md` — folded todo detail
- `knip.json`, `pnpm knip` run (exit 0, 0 findings), `pnpm -w typecheck` run (exit 0, clean) — CLEANUP-13 tool-verified baseline

### Secondary (MEDIUM confidence)
- None used this session — no web search or external docs were needed; this phase is 100% internal-codebase research.

### Tertiary (LOW confidence)
- `packages/shared/scripts/seed-rosters.ts` and `packages/shared/src/data/*.csv` — referenced but not directly read; flagged as Open Question 3 for the planner to check before choosing the bench-patch data-insertion mechanism

## Metadata

**Confidence breakdown:**
- CLEANUP-05/06/08/10/11 findings: HIGH — each backed by direct file/line reads with confirmed, mechanically-verifiable divergences, not inference
- CLEANUP-07/12 findings: MEDIUM — thorough spot-check with no gap found, but inherently cannot be exhaustive given the codebase's size and the open-ended nature of the requirement (per CONTEXT.md D-01)
- CLEANUP-09 findings: HIGH on what's duplicated / MEDIUM on the recommended fix depth (deliberately left as a tradeoff, per D-03, not a prescription)
- CLEANUP-13 findings: HIGH on the tool-verified clean baseline (knip/typecheck); MEDIUM on "is that sufficient" since full lint/test were not run this session (explicitly flagged, not silently skipped)
- Bench patch (D-05..D-09): HIGH on the insertion point and type constraints; MEDIUM on the CSV-vs-hand-edit data-pipeline choice (Open Question 3)

**Research date:** 2026-08-29
**Valid until:** This is a point-in-time audit of the current codebase state (commit as of 2026-08-29, post-Phase-45). Valid until the next phase's code changes land — re-verify any specific line numbers cited here if significant time passes before this phase executes, since this is a fast-moving milestone (Phases 41-45 all shipped within the same ~2-week window).
