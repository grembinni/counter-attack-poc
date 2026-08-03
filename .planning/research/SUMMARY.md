# Project Research Summary

**Project:** Counter Attack POC - v1.6 Milestone (Fouls, Cards and Restarts)
**Domain:** Rule-fidelity expansion of an existing server-authoritative, real-time hex-grid football game FSM (Node.js/Socket.io + TypeScript monorepo)
**Researched:** 2026-08-03
**Confidence:** HIGH

## Executive Summary

This milestone adds fouls, bookings (yellow/red cards), injuries, substitutions, penalty kicks, GK-dive-at-feet, and three new dead-ball restart types (goal kick, corner kick, throw-in) plus out-of-bounds detection to an already-mature, server-authoritative dice-duel game engine (5 prior shipped milestones, 4747-line gameEngine.ts, 1738 tests). The single most important finding across all four research files is that this is a pure extension of existing patterns, not new infrastructure: every new mechanic has a direct, already-built precedent in the codebase (FREE_KICK_SETUP staged sub-flow, computeCombinedScore penalty-array mechanism, TACKLE_ATTEMPT/STEAL_ATTEMPT inline non-phase-transitioning dice sub-resolution, SELECTABLE_DRAFT_POOLS server-side allow-list pattern). Zero new npm dependencies are needed.

The recommended approach is to generalize FREE_KICK_SETUP staging mechanism into a reusable RestartSetupState/RESTART_STAGES module, recognize that Goal Kick needs almost no new state-machine work (it is a new trigger into the already-existing GK_RESTART to GK_KICK_TARGET to GK_KICK_MOVE chain), and add a new ball.lastTouchedBy field as the foundational prerequisite for all out-of-bounds classification. The rulebook text contains numerous genuine ambiguities (which die triggers a foul, professional-foul red-vs-yellow semantics, booking/fouls toggle interaction, Corner Kick two-stage repositioning) that must be resolved as explicit REQUIREMENTS.md decisions before implementation, not left to be silently interpreted during phase planning.

The dominant risk is whether every new event type is fully wired into the four disconnected registries this codebase uses for replay/undo, and whether same-phase broadcasts and batched multi-event narration correctly reach the client - both risk classes have already caused real shipped regressions in this exact codebase (BUG-37, Phase 32-05 SELECTOR-REVIEW). A secondary risk is process, not code: this project has twice silently dropped requirements during phase renaming (v1.4 RESP-01..09), and this milestone six loosely-coupled subsystems behind three independent toggles is more exposed to that failure mode than any prior milestone.

## Key Findings

### Recommended Stack

No new npm packages are needed anywhere in packages/shared, packages/server, or packages/client. Every v1.6 feature is expressible via the existing GamePhase FSM (new union members plus apply\* handlers), the existing pure dice-duel pattern (crypto.randomInt-backed rollDice() called only from the socket handler layer, injected into pure engine functions), and the existing pure hex-math module (hex.ts/pitch.ts). This continues the project established philosophy of rejecting frameworks (Colyseus, boardgame.io, XState, Redux, icon libraries, RNG libraries) in favor of hand-rolled, event-driven, server-authoritative logic that already scales to 27 GamePhase members without strain.

Core technologies (all unchanged, no version bumps):

- TypeScript 5.9.3 - new fields (resilience usage, yellowCards, injured, etc.) are additive interface changes, not new infrastructure
- Node.js crypto.randomInt (existing rollDice()) - sole sanctioned RNG source for every new dice roll (foul check, injury, booking, GK-dive-at-feet, penalty duel); no new die range needed
- Socket.io 4.8.3 - new events (FOUL_DECISION, SUBSTITUTE, restart-move events) follow the existing event-oriented pattern
- Zustand 4.5.7 - new selectors/slices on the existing single client store

### Expected Features

Must have (table stakes, rulebook-mandated, all in-scope for v1.6):

- Fouls (roll-of-1 on tackle/steal/GK-dive) - always-fire injury and booking rolls, attacker continue-or-restart choice
- Bookings - yellow greater or equal to Leniency, 2nd yellow to red, Professional/Last-Man foul to straight red (semantics need rulebook confirmation)
- Injuries - roll greater or equal to Resilience, -1 all attributes, 2nd injury forces substitution (with a no-sub-available fallback)
- Substitutions - up to 3 per team per match (not per-half), jersey-number plus lineup-slot inheritance, +1 added time each, available at any stoppage, always-on (no settings gate)
- Penalty Kick - -2 GK dice modifier (reuses existing computeCombinedScore penalty array), tie to Loose Ball (reuses existing mechanic)
- GK-Dive-at-Feet - new duel type (attacking-phase, up to 3 hexes parallel to goal, -1 dice penalty at 3rd hex); defensive-phase variant is just the existing TACKLE_ATTEMPT with a GK-source branch
- Goal Kick / Corner Kick / Throw-In - new restart flows triggered by out-of-bounds classification
- Out-of-Bounds Detection - sideline/attacking-byline/defending-byline classification, requires new lastTouchedByPieceId/ball.lastTouchedBy tracking that does not exist today
- Three independent game-creation settings toggles: Fouls, Booking, Out-of-Bounds/Restarts (Booking is inert without Fouls; Penalty Kick gates under Fouls, not Restarts)

Explicitly deferred (per PROJECT.md, confirmed out of scope this milestone):

- RESP-01..09, game-stats overlay, reconnection grace period, rematch, chat, draft history

### Architecture Approach

Every new mechanic maps onto one of four already-proven shapes in gameEngine.ts: (1) a new GamePhase union member plus apply\* handler for anything needing distinct client UI, following the FREE_KICK_SETUP precedent exactly; (2) a new duel-resolution function shaped like computeHeaderDuelDetail for GK-dive-at-feet and penalty kick; (3) inline, non-phase-transitioning dice sub-resolution (mirroring TACKLE_ATTEMPT/STEAL_ATTEMPT) for the always-fires injury/booking rolls; (4) a standalone phase-keyed allow-list (mirroring applyUndo validUndoPhases) for substitution eligibility, which does not fit the ELIGIBLE_NEXT_ACTIONS sequencing table.

Major components:

1. Generalized RestartSetupState/RESTART_STAGES module - refactor of FREE_KICK_SETUP currently free-kick-specific fields into a kind-parameterized structure shared by Free Kick, Goal Kick (mostly unneeded - see below), Corner Kick, and Throw-In. Should land early, as its own task, before building the new restart types on top of it.
2. ball.lastTouchedBy tracking (new field on BallState) - the single true prerequisite for all out-of-bounds work; must be updated at every existing ball-state mutation site.
3. Goal Kick as a new trigger, not new machinery - reuses the existing GK_RESTART to GK_KICK_TARGET to GK_KICK_MOVE chain unmodified; this is the single biggest scope-reduction finding and should be explicitly costed lower than Corner Kick/Throw-In.
4. Inline foul/injury/booking resolution inside the existing TACKLE_ATTEMPT/STEAL_ATTEMPT/GK_DIVE_AT_FEET duel branches - never inside the restart-setup phases, or continue-play fouls would silently skip injury/booking.
5. Standalone substitution eligibility check (isStoppagePhase/STOPPAGE_PHASES allow-list) plus new GameState.bench/subsUsed fields (bench roster state does not exist in live GameState today, only pre-match in DraftSession).
6. Settings toggles as GameState fields, validated server-side at every gated handler (mirrors SELECTABLE_DRAFT_POOLS existing security pattern) - not client-UI-only gating.

### Critical Pitfalls

1. New dice-roll event types are invisible to Undo/Replay unless registered in at minimum four disconnected lists (isBoundary server plus client mirror, REPLAY_ELIGIBLE_TYPES, possibly ELIGIBLE_NEXT_ACTIONS) - this exact bug class (BUG-37, BUG-30/31) has already shipped twice in this project. Treat every new ActionEventType as a per-event checklist item, not a one-time fix.
2. Reusing the generic DICE_ROLL event type reactivates a dormant full-slot Undo lockout that directly contradicts the always-fires-without-stopping-play requirement - every new roll needs its own specific ActionEventType.
3. Same-phase broadcasts silently go stale on the client if new derived UI state keys off phase instead of eventLog/full gameState - this milestone is the first to introduce dice rolls that fire without a phase transition by design, exercising this bug class (already shipped once, Phase 32-05) far more than any prior milestone.
4. EventBanner only inspects the last new event per broadcast, but a single foul resolution can append 3 chained events (foul, injury, booking) in one broadcast - must be changed to process all newly-appended events, not just the tail.
5. Out-of-bounds detection is not centralized - today, 5+ independent call sites each locally clamp the ball to stay in-bounds; converting clamp to detect-and-classify requires auditing every site individually or an inconsistent, hard-to-notice bug results (ball exits correctly from a pass but stays clamped from a loose-ball bounce).

## Implications for Roadmap

Based on combined research (FEATURES.md dependency graph and phase-splitting recommendation, ARCHITECTURE.md build order, PITFALLS.md per-pitfall phase mapping), the following phase structure is recommended:

### Phase 1: Out-of-Bounds Foundation + Throw-In + Goal Kick

Rationale: Out-of-bounds classification is a hard prerequisite for all three new restart types (nothing downstream is testable without it) and requires the new ball.lastTouchedBy field - a wide-touching but low-risk, purely mechanical change best done first while the codebase is freshest to this pattern. Goal Kick is nearly free once this lands (new trigger into the existing GK_RESTART chain, not new staging machinery), so bundling it here avoids treating it as a peer-cost item to Corner Kick.

Delivers: ball.lastTouchedBy tracking, classifyOutOfBounds pure function, Throw-In staged flow (new, moderate complexity), Goal Kick (trigger-only, low complexity), the Out-of-Bounds/Restarts settings toggle.

Addresses: Out-of-Bounds Detection, Throw-In, Goal Kick target features.

Avoids: inconsistent OOB clamp sites (requires an explicit audit checklist of every existing isPitchHex clamp call site) and client-only settings-toggle gating (must be server-validated).

### Phase 2: Corner Kick

Rationale: The most state-machine-complex of the three restart types (two sequential repositioning windows, finer 2-at-a-time alternation granularity than FREE_KICK_SETUP existing per-team-stage model) - sequencing it after Phase 1 lets it build on the classification foundation and, ideally, the generalized RestartSetupState/RESTART_STAGES refactor rather than duplicating free-kick-specific fields a third time.

Delivers: Corner Kick staged flow, generalized restart-staging module (if not already extracted in Phase 1).

Uses: RestartSetupState generalization, existing HEADER phase as a transition target.

Implements: New multi-window stage-index state machine.

### Phase 3: Fouls + Injury + Booking + GK-Dive-at-Feet + Penalty Kick + Foul-triggered Free Kick

Rationale: This is the identified must-ship-together cluster - injury/booking are unskippable side effects of every foul, GK-dive-at-feet exists specifically to feed Penalty Kick (which has no other trigger), and Foul-triggered Free Kick is meaningless without Fouls existing. Deferred to give maximum lead time for resolving this cluster numerous rulebook ambiguities (which die triggers a foul, Professional Foul red-vs-yellow semantics, Booking/Fouls toggle interaction) via REQUIREMENTS.md before implementation starts.

Delivers: Foul detection on tackle/steal/GK-dive, inline injury+booking resolution, GK-Dive-at-Feet duel, Penalty Kick, Foul-triggered Free Kick (pure reuse of FREE_KICK_SETUP), Fouls plus Booking settings toggles.

Uses: computeCombinedScore existing penalty-array mechanism, RefereeCard.leniency/PlayerAttributes.resilience (already-typed, currently-unused fields).

Implements: Inline non-phase-transitioning dice sub-resolution pattern (mirrors TACKLE_ATTEMPT/STEAL_ATTEMPT).

### Phase 4: Substitutions

Rationale: Fully independent of all other clusters (only soft-depends on Injury for one trigger source: forced substitution on 2nd injury). Placed last so the injury/red-card trigger wiring from Phase 3 already exists (avoiding a small retroactive follow-up), but could be moved earlier or built in parallel if the roadmapper prefers to de-risk it first.

Delivers: Substitution eligibility check (isStoppagePhase allow-list), new GameState.bench/subsUsed state, jersey-number/lineup-slot inheritance, +1 added-time integration, always-on UI affordance (not phase-gated).

Addresses: Substitutions target feature (no settings toggle - always available).

### Phase Ordering Rationale

- Out-of-bounds classification is phased first because it is a strict dependency of 3 of the 4 remaining feature clusters (Throw-In, Corner Kick, Goal Kick) - phasing it later would mean phasing effects before their cause.
- The Fouls/Injury/Booking/GK-Dive/Penalty cluster is deliberately phased later (not first) specifically because it carries this milestone highest concentration of genuine rulebook ambiguities (die-side ambiguity, Professional Foul semantics, toggle-interaction semantics) - later phasing gives more lead time to resolve these via REQUIREMENTS.md rather than under implementation pressure.
- Substitutions is phased last because it is architecturally the most independent (no FSM dependency on any other cluster), so it carries the least schedule risk regardless of position and benefits from Phase 3 injury/red-card wiring already existing.
- This order also front-loads the more novel state-machine work (multi-window staged repositioning, new ball-touch tracking field) while the codebase context is freshest.

### Research Flags

Phases likely needing deeper research during planning (--research-phase):

- Phase 2 (Corner Kick): Genuinely new state-machine shape (2-at-a-time alternating sub-batches within a shared stage, two sequential repositioning windows) with no direct 1:1 precedent in the existing codebase - the closest precedent (freeKickStageIndex) has no per-stage move-count cap today, so this needs new design work, not just a template fill-in.
- Phase 3 (Fouls/Booking cluster): Multiple rulebook-ambiguity items flagged as must-confirm-against-physical-rulebook-text-before-implementation (which die triggers a foul, Professional Foul red-vs-yellow reading, nutmeg vs. existing STEAL_ATTEMPT mapping) - these are rules questions, not architecture questions, but should be resolved before/during this phase planning, not discovered mid-implementation.

Phases with standard, well-documented patterns (safe to skip research-phase, or use it only lightly):

- Phase 1 (Out-of-Bounds + Throw-In + Goal Kick): Goal Kick is a near-zero-risk trigger addition to an existing chain; Throw-In and the classification function are new but structurally simple (single repositioning window, fixed-hex-range check) with strong precedent in hex.ts/pitch.ts.
- Phase 4 (Substitutions): Precedent for the phase-keyed allow-list pattern already exists cleanly (applyUndo validUndoPhases); the main new work (bench state, jersey-number inheritance) is data-shape work, not novel FSM design.

## Confidence Assessment

| Area         | Confidence                                                               | Notes                                                                                                                                                                                                                               |
| ------------ | ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Stack        | HIGH                                                                     | Grounded entirely in direct codebase inspection; zero new dependencies means zero external-ecosystem risk.                                                                                                                          |
| Features     | HIGH (rulebook fidelity) / MEDIUM (general stoppage-sequencing patterns) | Rulebook text was supplied verbatim by the user and cross-checked against real codebase mechanics for every claim; the small MEDIUM carve-out is for general web-sourced FSM-pattern discussion used only as illustrative contrast. |
| Architecture | HIGH                                                                     | Every finding is a direct file:line citation from the current committed source; no external framework research was needed since this is an internal FSM-extension question scoped entirely to this codebase own conventions.        |
| Pitfalls     | HIGH                                                                     | Grounded in direct reading of the actual implementation plus two real, already-shipped incidents in this exact codebase (BUG-37, Phase 32-05 SELECTOR-REVIEW) that generalize directly to this milestone new risk surface.          |

Overall confidence: HIGH

### Gaps to Address

- Which die triggers a foul (defender vs. carrier) on tackle/steal - recommended default (defender die) must be confirmed against the physical rulebook text before Phase 3 implementation; get this wrong and fouls silently fire at the wrong rate/side with no test catching it (1-in-6 probability bug, invisible in casual playtesting).
- Nutmeg mapping - likely flavor text for the existing STEAL_ATTEMPT mechanic rather than a third duel type, but must be confirmed against the rulebook glossary; if wrong, under-scopes Phase 3 by a whole new duel type.
- Professional/Last-Man Foul red-vs-yellow phrasing - genuinely ambiguous between always-straight-red and a modified roll that can produce either outcome; flagged as the single most safety-critical booking ambiguity in the milestone, needs a verbatim rulebook re-quote in REQUIREMENTS.md before Phase 3 starts.
- Corner Kick exact stage/alternation shape - the brief describes what reads as two distinct repositioning windows with different granularities; must be pinned down as an explicit design decision before Phase 2 implementation, not discovered mid-build.
- Booking-without-Fouls toggle semantics - recommended default is Booking has no effect unless Fouls is also enabled (an allowed-but-inert combination); should be documented explicitly in REQUIREMENTS.md so it is not discovered as a surprise during UAT.
- Requirement traceability risk (process gap, not a research gap): this project has twice silently dropped requirements during phase renaming (v1.4 RESP-01..09). Given this milestone bundles six loosely-related subsystems behind three toggles, assign stable requirement IDs (FOUL-xx, BOOK-xx, INJ-xx, SUB-xx, RESTART-xx, OOB-xx) before phase planning and enforce traceability diffing at every /gsd-transition.

## Sources

### Primary (HIGH confidence)

- Direct codebase inspection: packages/server/src/gameEngine.ts (4747 lines), packages/server/src/gameHandlers.ts, packages/server/src/roomStore.ts, packages/server/src/diceUtils.ts, packages/shared/src/types.ts, packages/shared/src/hex.ts, packages/shared/src/pitch.ts, packages/shared/src/offside.ts, packages/shared/src/scoreUtils.ts, packages/shared/src/actionSequence.ts, packages/shared/src/moveValidator.ts, packages/client/src/components/GameBoard.tsx, packages/client/src/components/ActionPanel.tsx, packages/client/src/components/EventBanner.tsx, packages/client/src/store/useGameStore.ts.
- D:\dev\repo\counter-attack-poc\CLAUDE.md - project-authored stack constraints and framework-rejection rationale.
- .planning/PROJECT.md - v1.6 milestone brief, target features, prior Key Decisions, known tech debt.

### Secondary (MEDIUM confidence)

- General turn-based/CCG stack-sequencing background (MTG APNAP triggered-ability ordering) and general layered-FSM pattern discussion (Game Programming Patterns - State) - used only as contrast to justify why a generic interrupt-stack model is unneeded here; the concrete recommendation is grounded entirely in the project own FREE_KICK_SETUP code.

### Tertiary (LOW confidence)

- None - no low-confidence sources were used in this research pass.

---

Research completed: 2026-08-03
Ready for roadmap: yes
