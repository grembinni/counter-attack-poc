# Project Research Summary

**Project:** Counter Attack POC — v1.7 (UI/UX Consistency, Substitution Rework & Match Summary)
**Domain:** Feature-addition milestone on an existing, shipped, server-authoritative real-time hex-grid football game (Node.js/Socket.io + React monorepo)
**Researched:** 2026-08-21
**Confidence:** HIGH

## Executive Summary

This is not greenfield work — it is a polish/consistency milestone layered onto a mature, already-shipped codebase (React 18 + Zustand 4 + Socket.io 4 + hand-written shared TypeScript hex math, full-state-snapshot broadcast). All research this round was grounded in direct inspection of the actual shipped code. The unanimous conclusion across all four research files: no new npm dependencies are needed. All six target features (referee-leniency override, unified card/injury iconography, an Advanced settings drawer, a substitution UX overhaul, a tackle/steal decline-and-retry toggle, and an on-demand match-summary/xG popup) are buildable by extending patterns already proven in this codebase.

The recommended approach is six semi-independent feature slices plus one embedded cross-cutting bug-fix (red-carded players still triggering deflections/ZoI steals — a confirmed, currently-live bug), sequenced by dependency and risk rather than request order. The highest-risk item is the Substitution UX overhaul: it adds a second, coexisting interaction mode to an already-tested component (LineupAssignmentScreen.tsx), risking regression to existing SUB-02..07 guards. The second-highest risk is the tackle/steal decline mechanic, genuinely novel engine state with no code path or genre precedent to extend from.

Key risks and mitigations: (1) the red-card exclusion bug has now recurred 3+ times because the filter is hand-written ad hoc at each site, so extract a shared isActivePiece helper while fixing it; (2) refereeCard.leniency is a dual-consumer field (booking AND added-time), so an override touching only booking code will silently change added time too; (3) card/injury iconography is triplicated today and a 4th surface (bench) has neither icon, so unify is a genuine 4-surface consolidation; (4) match-stat counters must follow subsUsed (never reset at half-time), not addedTimeBonus (reset per-half); (5) xG capture must be instrumented at every shot-resolution branch (SHOT, SNAPSHOT_DEFLECT, headed shot, penalty, GK-dive-at-feet penalty) or it will silently under-report.

## Key Findings

### Recommended Stack

No new packages required. All work operates within the already-validated stack: React 18.3.1, Zustand 4.5.7, Socket.io 4.8.3, TypeScript project-wide, inline SVG (no Canvas), CSS Modules, and hand-written shared hex/validator math in packages/shared (no honeycomb-grid, despite the v1.0 recommendation, since custom hex math was actually shipped).

Core technologies (all pre-existing, zero installs):

- React 18 + Zustand 4 — ordinary component/state work, no new rendering paradigm
- Socket.io 4 — new fields ride the existing full-snapshot broadcast; new events mirror existing handler shapes
- Native HTML5 Drag and Drop API — already implements substitution drag-and-drop at the required scale
- Inline SVG + CSS Modules — every visual glyph is a hand-tuned SVG primitive keyed off tokens.css
- packages/shared/src/hex.ts — hexDistance() and box-occupancy helpers directly reusable for xG inputs

### Expected Features

All six features are explicitly in-scope P1 per PROJECT.md — none should be cut. Genre research (FIFA/EA FC, Football Manager, broadcast stats) confirms the requested shape closely matches industry convention, with two exceptions flagged as project-specific inventions.

Must have (table stakes):

- Consistent card/injury iconography, one fixed position, across every player-showing surface
- Explicit off/on confirmation before a substitution commits
- Red-carded/unavailable bench players stay visible with a status marker, never removed
- Progressive-disclosure Advanced settings section
- Basic on-demand match stats (possession, shots, cards) reachable mid-match

Should have (differentiators, partially novel):

- Referee Leniency manual override (2-5 dial) — thin override of existing random-roll logic
- Tackle/Steal decline-and-retry with persistent still-live ring — no mainstream soccer-game precedent; nearest analogue is turn-based tactics games' overwatch/reserved-action pattern
- Default drag-and-drop on-field positioning mode — also no direct precedent, project's own invention
- On-demand info-icon stats popup, lighter than the existing full-screen half-time/full-time recap

Defer (anti-features, not v1.7 scope):

- Heat maps, pass-network diagrams, shot maps, per-player ratings
- Leniency override permitting 1 or 6 (meaningless extremes) — must stay bounded 2-5
- Undo/redo for a confirmed substitution
- AI-suggested substitutions / tactical-instructions system
- Configurable decline thresholds — binary toggle only

### Architecture Approach

The existing Settings-to-Room-to-buildInitialGameState-to-GameState propagation pipeline (broadcast in full on every action, Zustand replaces state wholesale) is the load-bearing seam for 4 of 6 features. Two other recurring idioms anchor the rest: the two-button decision-prompt family (FoulChoicePanel/GkDiveAtFeetPromptPanel — deciding-team field plus resume snapshot plus waiting-message branch plus paired DECLINED event) is the template for the new Tackle/Steal prompt; and the new-event-type registration checklist (formatEvent, REPLAY_ELIGIBLE_TYPES, applyUndo isBoundary disjunction, PHASE_LABEL map, STOPPAGE_PHASES) is a documented recurring bug class every feature adding a new ActionEventType or GamePhase (Features 4, 5, 6) must budget for.

Major components (new/modified):

1. CardInjuryBadge.tsx — replaces 3 duplicated inline implementations, adds card/injury display to the bench (currently has neither); should land before/alongside the substitution rework
2. LineupAssignmentScreen.tsx rework — coexisting subMode (default positioning/reposition vs. explicit substitution), new applyRosterReposition server function, client-side confirmation modal
3. TackleStealPromptPanel.tsx plus new GamePhase/GameState fields mirroring GkDiveAtFeetPromptPanel — decline must use a sibling exclusion field, not overload stealAttemptedByIds/tackleAttemptedByIds
4. GameSummaryPopup.tsx plus new match-wide counter fields (mirroring subsUsed never-reset shape) plus shooterHex/defendersInBox captured at every shot-resolution branch for xG

### Critical Pitfalls

1. CONFIRMED LIVE BUG — red-carded players still trigger deflections and ZoI steal/tackle prompts. Two DEFLECT_ATTEMPT defender-input builders and moveValidator.ts ZoI opponent list never exclude redCarded/onPitch false pieces. Fix at both sites; extract a shared isActivePiece helper.
2. Referee Leniency is a dual-consumer field (booking threshold plus added-time bonus) — an override touching only booking code silently changes added time too.
3. Card/injury iconography is already triplicated, and a 4th surface (bench) has neither icon. Unify means replacing 3 tested implementations AND adding net-new bench display.
4. Substitution positioning-mode and substitution-mode share the same tested component and drag handlers — highest regression risk in the milestone. Keep drop handlers separate; re-run the full SUB-0X test suite as an explicit gate.
5. Tackle/Steal declined state must not overload the existing attempted-tracking arrays, which reset at roughly 30 independent call sites with a different semantic. Needs a sibling field with its own explicit reset policy.

## Implications for Roadmap

Based on combined research (ARCHITECTURE.md Suggested Build Order and PITFALLS.md phase-mapping table independently converged on a similar sequence):

### Phase 1: Red-Card Eligibility Bug Fix

Rationale: Zero dependencies, pure server-side correctness fix, confirmed live bug. Ships first so later phases aren't tested against a still-buggy engine.
Delivers: Fixed DEFLECT_ATTEMPT filters (2 sites) and moveValidator.ts ZoI filter; extracted shared isActivePiece helper; regression tests.
Addresses: The bug-fix requirement embedded in the Substitution UX ask (red-carded players fully removed from play).
Avoids: Pitfalls #6, #7 (confirmed live bugs).

### Phase 2: Unified Card/Injury Iconography

Rationale: Lands before the substitution rework so its bench red-card marker consumes a real shared component.
Delivers: New CardInjuryBadge.tsx; replaces 3 duplicated implementations; adds card/injury display to the bench.
Addresses: Table-stakes consistent iconography.
Avoids: Pitfall #3 (triplicated logic plus missing 4th-surface coverage).

### Phase 3: Referee Leniency Manual Override

Rationale: Small, isolated, settings-pipeline-only; no file overlap with Phase 2.
Delivers: refereeLeniencyOverride threaded through the Settings-Room-GameState pipeline (both real build site and late-joiner echo site); server-side range re-validation (2-5 integer); UI toggle plus stepper.
Uses: Existing toggle-propagation pipeline.
Avoids: Pitfalls #1 (dual-consumer field) and #2 (missing server-side re-validation).

### Phase 4: Tackle/Steal Prompt-and-Decline Toggle

Rationale: Isolated new phase/event/panel family; highest design risk after the substitution rework — sequenced before Match Summary since a decline changes what an attempt means for that stat.
Delivers: New GamePhase, GameState fields mirroring GkDiveAtFeetPromptPanel, new TackleStealPromptPanel.tsx, sibling exclusion field for declined state, new ActionEventType with explicit Undo/Replay registration decisions.
Implements: Two-button decision-prompt architecture pattern.
Avoids: Pitfalls #8 (declined/attempted state conflation) and #9 (new event type missing from Undo/Replay checklist).

### Phase 5: Substitution UX Overhaul (largest, highest-risk phase)

Rationale: Largest, most interdependent feature — benefits from Phase 1 clean engine and Phase 2 shared badge already in place.
Delivers: Coexisting subMode in LineupAssignmentScreen.tsx; new applyRosterReposition server function; new GAME_ROSTER_REPOSITION event; confirmation modal; bench red-card marker (consuming Phase 2 badge); green Resume-button/banner visuals.
Addresses: Table-stakes substitution confirmation, positioning-mode differentiator, bench red-card marker.
Avoids: Pitfall #5 (mode guard entanglement) — requires separate drop handlers and full SUB-0X re-verification.

### Phase 6: Advanced Settings Drawer

Rationale: Built last among settings-touching phases so it sizes itself against the final toggle count (4 existing plus Leniency plus Tackle/Steal Decline equals 6).
Delivers: Collapsed-by-default Advanced section; two-column CSS Grid; single derived-state function shared between render-time and confirm-time Fouls-dependency logic.
Uses: Existing local useState plus CSS Modules pattern.
Avoids: Pitfall #4 (Fouls-dependency logic split across two mechanisms).

### Phase 7: Match Summary / Stats Popup with xG

Rationale: Last — it reads state the other features produce, and touches the largest number of existing gameEngine.ts call sites, so building it after the engine stabilizes avoids rebasing across concurrent engine edits.
Delivers: New match-wide (never-reset) counter fields for possession/passes/tackle-steal/fouls-cards; shooterHex/defendersInBox captured at every shot-resolution branch for xG; GameSummaryPopup.tsx deriving xG from an on-demand eventLog scan; scoreboard info-icon; settings/toggle recap.
Addresses: Table-stakes on-demand match stats; the largest net-new server-side surface of the six.
Avoids: Pitfalls #10 (wrongly reset at half-time), #11 (xG missing for non-main-branch shot types), #12 (possession/pass-count source-of-truth ambiguity — default to on-demand eventLog scan, mirroring the ball.lastTouchedBy precedent).

### Phase Ordering Rationale

- Bug fix and low-novelty toggles first, novel state machines and highest-regression-risk UI in the middle, stats aggregation last — follows both the dependency graph (Match Summary reads state earlier phases produce) and risk-mitigation logic (fix the engine before testing new UI against it; build the shared badge before the UI that needs it).
- Substitution UX is deliberately not first, despite being the largest feature, because it benefits measurably from Phase 1 (clean engine, since it owns the red-card bug-fix scope) and Phase 2 (shared badge) landing first.
- This avoids the specific pitfall class already documented in this codebase (new-event-type registration gaps, dual-consumer field surprises, duplicated eligibility filters) by grouping related audit work into the phase introducing the new state.

### Research Flags

Needs deeper research/design during phase planning:

- Phase 4 (Tackle/Steal decline): Genuinely novel engine state machine, no genre precedent, no existing code path to extend from. Flag for deeper design/context work at plan time.
- Phase 7 (Match Summary/xG): xG capture spans 4+ independently-coded shot-resolution branches with no shared hook — needs explicit branch enumeration before implementation. Also needs an explicit live-counter-vs-eventLog-scan architecture decision recorded before implementation.
- Phase 5 (Substitution UX): Should get dedicated planning time enumerating every existing SUB-0X guard before implementation (test-first for the mode-coexistence boundary) given confirmed regression risk.

Phases with standard, well-documented patterns (skip deep research-phase):

- Phase 1 (bug fix): Mechanical filter additions at already-identified sites.
- Phase 2 (iconography): Standard component-extraction refactor; visual pattern already confirmed industry-standard and partially implemented.
- Phase 3 (Leniency override): Thin override mirroring an already-established toggle-propagation pattern used 4 times before.
- Phase 6 (Advanced drawer): Native details/useState plus CSS Grid; zero new architecture.

## Confidence Assessment

| Area         | Confidence | Notes                                                                                                                                                                                                                                     |
| ------------ | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Stack        | HIGH       | Grounded in direct inspection of package.json manifests and shipped code; unanimous no-new-deps-needed conclusion                                                                                                                         |
| Features     | MEDIUM     | Established genre/UX conventions cross-checked against public sources, but 2 of 6 features (tackle/steal decline, default positioning mode) have no direct genre precedent — flagged explicitly rather than forced into a false precedent |
| Architecture | HIGH       | Every integration claim backed by file:line citations from direct code reads; no speculative APIs                                                                                                                                         |
| Pitfalls     | HIGH       | Grounded in direct code reads; two pitfalls (#6, #7) are confirmed, currently-live, reproducible bugs discovered during this research                                                                                                     |

Overall confidence: HIGH

### Gaps to Address

- Tackle/Steal decline state machine design is not fully specified — exact GameState field shape, resume-snapshot mechanics, and reset-policy table across roughly 30 existing reset sites needs to be worked out during Phase 4 planning.
- The wrapper component owning the substitution-mode banner/Resume-button chrome (green banner, green Resume button) was not identified during architecture research — needs a planning-time look at App.tsx or the equivalent wrapper.
- The scoreboard component that will host the new info-icon affordance was not identified — needs a planning-time lookup (referenced only via PROJECT.md LAYOUT-01 decision).
- Whether Referee Leniency's added-time coupling should be fixed (split the field) or just documented/messaged in UI is an open product decision — confirm with the user before implementation.
- The is-an-action-pending guard needed to disable positioning-mode drag during an active game action needs a planning-time check of useGameStore.ts selection-state fields.

## Sources

### Primary (HIGH confidence)

- Direct repository inspection: packages/client/package.json, packages/server/package.json, packages/shared/package.json
- Direct component/module inspection: PieceOverlay.tsx, PlayerStatsPanel.tsx, LineupAssignmentScreen.tsx, ActionPanel.tsx, GameSettingsScreen.tsx, HexGrid.tsx, BenchCarousel.tsx, DraftPackCarousel.tsx, GkDiveAtFeetPromptPanel.tsx, FoulChoicePanel.tsx
- Direct server/shared module inspection: gameEngine.ts, gameHandlers.ts, roomHandlers.ts, roomStore.ts, moveValidator.ts, fouls.ts, stoppagePhases.ts, types.ts, hex.ts
- .planning/PROJECT.md and .planning/STATE.md — documented pitfall precedents (subsUsed/addedTimeBonus, lastTouchedBy decision, BUG-30/31/37)
- .planning/debug/resolved/red-card-bench-removal-scope.md — prior investigation directly informing the confirmed live-bug pitfalls

### Secondary (MEDIUM confidence)

- FIFA/EA Sports FC and Football Manager substitution-flow public references — confirms the select-outgoing/select-incoming/Confirm pattern
- Sportmonks/football-stats glossary sources — standard broadcast stat-category taxonomy
- Progressive Disclosure UX pattern references (LogRocket, UXPin) — standard collapsed-by-default Advanced-section convention

### Tertiary (LOW confidence)

- None flagged — all findings were either direct code reads or corroborated by multiple independent public sources

---

Research completed: 2026-08-21
Ready for roadmap: yes
