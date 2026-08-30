# Project Research Summary

**Project:** Counter Attack POC (v1.8 - Roster Interaction Overhaul and Rules Audit)
**Domain:** Subsequent-milestone integration work on a mature, server-authoritative real-time hex-grid football game: roster interaction UX rework, rules-engine sequencing fixes, and a rules-fidelity audit
**Researched:** 2026-08-30
**Confidence:** HIGH

## Executive Summary

v1.8 is not a green-field build; it is five targeted changes plus one audit deliverable layered onto an established React/Zustand/Socket.io/Node engine (gameEngine.ts, 10,849 lines, pure-function FSM) that has already solved the general shape of every problem this milestone raises. No new libraries or architecture are needed; every recommendation in STACK.md is to reuse the pattern that already exists (click-to-select via a SelectionState-style union, useGameStore for cross-component state, HIGHLIGHT_STYLES-table-driven CSS). The work is entirely about correctly locating and extending existing mechanisms without breaking their existing invariants.

The recommended approach is: (1) replace the roster screens two drag-and-drop sub-modes (reposition, substitute) with click-to-select, keeping the two modes eligibility/guard logic in separate functions exactly as the drag implementation already does; this is the single highest-risk item and should be built and stabilized first, in isolation, before anything else touches the same files; (2) make jersey numbers travel with the player, not the formation slot, which requires touching not just the assignment site but every one of the 4+ applyRosterContinuity reset call sites (goal, penalty, half-time) or the fix will silently regress on the first goal; (3) resequence the GK box-entry offer to fire before an outside-the-box shots dive resolution, which requires new logic inside applyDeclareShot (not a whitelist tweak) because the existing GK_BOX_ENTRY_PHASES design deliberately excludes GK_DIVE; (4) close the long-open foul-injury-booking banner bug via live two-browser plus DevTools verification, not another synthetic-test-only patch, since two prior synthetic-only attempts (including one shipped fix) already failed to reproduce or resolve the live symptom; (5) a small, low-risk GK-exemption fix to the final-third confirm button; and (6) a documentation-only rulebook gap analysis that must be cross-checked against PROJECT.md existing Deferred/Out-of-Scope list before logging anything as a new gap.

The dominant risk pattern across all five implementation items is regression at a reset/reuse site the fix did not touch: click-to-select re-merging two guard bodies that were deliberately kept separate; jersey numbers reverting at an untouched applyRosterContinuity call site; GK box-entry double-firing or breaking one of 8 named existing shot/header/corner/penalty suites; and the banner bug being declared fixed again on unit-test pass rate alone when that exact verification gap already produced one false-positive fix. Mitigation in every case is the same: locate every call site of the mechanism being changed (not just the obvious one) and add a regression test per site before considering the item done.

## Key Findings

### Recommended Stack

No new core technologies, libraries, or dev tools are required for v1.8; this is a pure extend-existing-patterns milestone. See STACK.md for the explicit alternatives-considered (DnD replacement libraries, XState, UUID libraries, headless UI primitives), all correctly rejected as disproportionate to the change.

Core technologies (all already installed):
- React 18 (useState) - local, ephemeral roster-card selection state, mirroring the existing local drag-state precedent in LineupAssignmentScreen.tsx
- Zustand (useGameStore) - only if roster selection state needs to be visible outside the roster screen (mirrors selectedPieceId/validMoveHexes); otherwise stay local
- CSS Modules (HIGHLIGHT_STYLES/RING_STYLES-style table) - selected/eligible/deselected outline states, extending the existing single-source-of-truth styling convention rather than inventing a second one

### Expected Features

All 6 items named in PROJECT.md v1.8 scope are P1; none are optional stretch scope. See FEATURES.md for full detail.

Must have (table stakes):
- Select-based swap/substitution replacing drag-and-drop (the one remaining interaction surface in the app that does not match the rest of the games click-to-select model)
- Permanent jersey numbers (numbers currently derive from formation slot, not player - a visible correctness bug)
- Final-third confirm fix (GK-only-remaining should not block/warn on confirm)
- Foul-injury-booking banner sequencing, closed with live verification (not re-attempted synthetically)

Should have (differentiators this milestone):
- GK box-entry-before-dive resequencing - genuine new design decision (not a 1-line reorder), the highest scope-risk item after select-based swap
- Rules-fidelity gap analysis - audit-only deliverable, reuses the existing vX-MILESTONE-AUDIT.md format, scopes the next milestone

Defer (v2+):
- Whatever the gap analysis surfaces as highest-priority (unknown until the audit runs)
- RESP-01..09 response-move single-selection activation model (deferred across 5 consecutive milestones; may become cheaper once this milestones click-to-select vocabulary exists)
- A general interrupt/priority-stack engine for GK reactive moves (not yet justified with only 3 interrupt types)
- The pregame/draft-mode drag-and-drop carousel flows - explicitly out of scope, do not touch

### Architecture Approach

The existing architecture (pnpm monorepo; server-authoritative gameEngine.ts pure-function FSM; Socket.io typed events; roomStore.ts single broadcastState choke point; Zustand client store replaced wholesale on game:state) is fixed and does not need to change. This researchs value is entirely in mapping each of the 5 features onto exact existing hook points.

Major components/hook points:
1. LineupAssignmentScreen.tsx mode-midmatch branch (about 800 lines) plus LineupStatCards isMidmatch ternary - the only surface Feature 1 (select-based swap) touches; pregame/draft branches are untouched
2. applyDeclareShot (gameEngine.ts:9406-9483) plus the gkBoxEntryResume snapshot shape - Feature 2 (GK resequencing) must hook here, not widen the broadcastState/GK_BOX_ENTRY_PHASES whitelist
3. buildSquadPieces, applyRosterReposition, applySubstitution, and critically applyRosterContinuity (the reset overlay, 4+ call sites) - Feature 3 (permanent numbers) must update all of these together, plus fix the jersey-number-9-based kickoff-striker lookup which will silently break once numbers are player-permanent
4. EventBanner.tsx plus FoulChoicePanel.tsx/GameBoard.tsx layout - Feature 4 (banner bug), continued investigation, not a known fix location yet
5. ActionPanel.tsx MOVE-phase branch (withEndTurnConfirm/remaining calc) - Feature 5 (final-third GK exemption), single-file, client-only, no server mirror needed

### Critical Pitfalls

1. Select-to-swap merges two modes guard logic into one handler - keep reposition and substitute eligibility/guard logic in two structurally separate functions (mirroring the current drag-and-drop splits own documented Pitfall 5 HARD CONSTRAINT); also explicitly clear selection state on every mode toggle.
2. Box-entry resequencing collides with the deliberate whitelist design - do not widen GK_BOX_ENTRY_PHASES to include GK_DIVE; instead add new logic inside applyDeclareShot using the shot target (always in-box) rather than ball position, and add a regression test proving box-entry fires at most once per shot.
3. Permanent jersey numbers regress at an untouched reset site - the fix must extend applyRosterContinuitys preserved-field set (all 4+ call sites: goal-via-shot, goal-via-penalty, half-time, and any other reset) or numbers will silently revert on the first goal after kickoff; also fix the number-equals-9 kickoff-striker lookup, which breaks the instant numbers are player-permanent.
4. Banner-sequencing fix re-patches the same reachable-but-wrong hypothesis - a prior fix (activeRef, commit 0664573) is real but proven unreachable from any current foul path and confirmed live by the user as NOT fixing the symptom; the next attempt must use live two-browser plus DevTools verification (or a DOM-stacking-aware test), not another synthetic-only pass.
5. Rules-gap audit scope-creeps into fixing, or misclassifies intentional simplifications as gaps - cross-check every finding against PROJECT.md Deferred/Out-of-Scope/Key-Decisions tables first (e.g. FTP_MOVE_ENABLED=false, NUTMEG-01+, RESP-01..09 are known, intentional deferrals, not new gaps); zero source-file diffs outside .planning/ for this phase.

## Implications for Roadmap

Based on research, suggested phase structure (5 implementation phases plus 1 audit phase):

### Phase 1: Select-Based Roster Interaction
Rationale: Highest line-count, highest regression risk (Phase 42s own retrospective called the equivalent drag-and-drop build the largest, highest-regression-risk phase of v1.7); touches the same file/component tree as nothing else in this milestone, so building it first and stabilizing it avoids merge contention with everything downstream.
Delivers: Click-to-select interaction replacing drag-and-drop for both mid-match positioning and stage-and-confirm substitution, with dead drag-and-drop scaffolding removed.
Addresses: Select-based swap/substitution (table stakes)
Avoids: Pitfall 1 (merged guard logic) - build and unit-test positioning mode first, then extend the same selection-state shape to substitution mode, then delete drag code only after both are unified.

### Phase 2: Permanent Jersey Numbers
Rationale: Must come after Phase 1, not in parallel - applyRosterReposition (one of the 3 sites this phase touches) is invoked by the exact interaction Phase 1 rebuilds; testing the number-follows-person logic is far more reliable once the new click-select UI (not the soon-to-be-deleted drag UI) is driving it end-to-end.
Delivers: Numbers assigned once per player at squad-build time, surviving reposition/substitution/reset; role-based (not number-based) kickoff-striker lookup.
Uses: PoolPlayer.number/BenchEntry.jerseyNumber (already player-bound today for bench display) extended to on-pitch pieces
Implements: Extension of applyRosterContinuitys preserved-field pattern (already the projects established mechanism for survive-every-reset fields)
Avoids: Pitfall 3 (reset-site regression) - one test per applyRosterContinuity call site with a prior substitution/reposition in place.

### Phase 3: GK Box-Entry-Before-Dive Resequencing
Rationale: Independent of Phases 1/2; requires the most genuine new design work (not a reorder) so should get dedicated review/discussion time rather than being squeezed alongside the higher-mechanical-risk phases.
Delivers: A pre-GK_DIVE box-entry offer on outside-the-box shots that resolves before the shot-blocking dive, without double-interrupting or breaking the 8 existing shot/header/corner/penalty/GK-catch regression suites.
Uses: Existing computeBoxEntryOffer/applyBoxEntryResponse/applyBoxEntryMove machinery, unchanged; new guard inside applyDeclareShot
Avoids: Pitfall 2 (whitelist collision) - explicit design decision required; write the fires-once-before-outcome regression test before touching roomStore.ts/gameEngine.ts.

### Phase 4: Final-Third Confirm Fix (GK Exemption)
Rationale: Small, low-risk, independent of everything else - good filler/parallel-friendly work alongside Phase 3.
Delivers: Confirm button no longer warns/blocks when only the GK is unmoved in the final-third free-move phases.
Addresses: Final-third confirm fix (table stakes)

### Phase 5: Foul-Injury-Booking Banner Sequencing (Investigation and Fix)
Rationale: No shared files with Phases 1-4; schedule independently. Budget as investigation-first, not fix-first - root cause is still unconfirmed after a full paused investigation session, and one prior fix already shipped clean without resolving the live symptom.
Delivers: A verified (live two-browser plus DevTools, or DOM-stacking-aware test) fix for the banner sequencing bug, plus resolution of the separately-confirmed foul-injury-booking display-order discrepancy.
Avoids: Pitfall 4 (unverified re-fix) - do not close this on unit/component test pass rate alone.

### Phase 6: Rules-Fidelity Gap Analysis (Audit)
Rationale: Independent of all implementation phases; can run in parallel or last. Running it after Phases 1-5 land means it naturally excludes ground already covered this milestone.
Delivers: A scoped, prioritized findings document (reusing the vX-MILESTONE-AUDIT.md format) cross-referencing rulebook clauses against implementation, explicitly classifying each finding as gap / intentional-simplification / false-positive.
Avoids: Pitfall 5 (scope creep / re-discovering known deferrals) - build the known-deferred/out-of-scope cross-reference from PROJECT.md before reading the rulebook; zero source-file diffs outside .planning/.

### Phase Ordering Rationale

- Phase 1 must precede Phase 2 because Phase 2s number-follows-person logic is exercised through the exact reposition interaction Phase 1 rebuilds - sequencing avoids testing new logic against soon-to-be-deleted UI.
- Phases 3 and 4 are mutually independent and independent of 1/2 - both are small, isolated, single-file-ish changes and can be parallelized with each other or slotted in wherever convenient.
- Phase 5 is a standalone debug/investigation task with no shared files with any other phase - schedule independently, but do not underestimate it; two prior fix attempts have already failed.
- Phase 6 (audit) has no code dependency on any other phase and is best run last so it naturally excludes ground this milestone already closed, though it could also run first or in parallel if the team wants early visibility into next-milestone candidates.

### Research Flags

Phases likely needing deeper research during planning:
- Phase 3 (GK box-entry resequencing): Genuinely new design scope contradicting an existing documented architectural decision (the GK_BOX_ENTRY_PHASES whitelist rationale) - needs explicit design-decision documentation before implementation, and an audit of all 5 GK_DIVE entry sites (not just applyDeclareShot) to confirm scope boundaries.
- Phase 5 (banner sequencing): Root cause still unconfirmed after a full prior investigation; may require live two-browser session tooling not currently installed in the repo (no Playwright/e2e tooling present per the debug log) - planning should address how live verification will actually be performed.

Phases with standard patterns (skip research-phase):
- Phase 1 (select-based roster interaction): Pattern already fully proven elsewhere in this exact codebase (piece selection/movement); implementation research already complete in ARCHITECTURE.md file/line-level mapping.
- Phase 2 (permanent jersey numbers): All source/reset call sites already enumerated in ARCHITECTURE.md and PITFALLS.md; mechanism to extend (applyRosterContinuity) is an established project pattern.
- Phase 4 (final-third confirm fix): Single-file, single-branch change with the exact fix already located and described.
- Phase 6 (rules-fidelity audit): Established project convention (vX-MILESTONE-AUDIT.md format) to reuse; process is well-defined, not a research gap.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | No new technology proposed; findings are direct codebase inspection of an already-working, precedented pattern. Nothing to verify externally. |
| Features | MEDIUM-HIGH | Grounded primarily in direct codebase/PROJECT.md inspection (HIGH); a few external corroborating sources (HN discussion, MTG stack articles, Wikipedia squad-number reference, generic toast-UX roundups) are MEDIUM-LOW confidence but used only as illustrative analogies, not as load-bearing recommendations. |
| Architecture | HIGH | Every finding is a direct file/line-level read of the current repository; no invented APIs or external documentation needed for this integration-focused research. |
| Pitfalls | HIGH | All findings grounded in direct inspection of this codebases source and its own prior debug/investigation history (.planning/debug/foul-banner-sequence-not-pausing.md), not generic industry advice. |

Overall confidence: HIGH

### Gaps to Address

- Banner-sequencing root cause is genuinely unknown - this is not a research gap so much as an open investigation; planning for Phase 5 should budget real investigation time (live two-browser session, DevTools) rather than assuming a quick code fix, and should explicitly decide how live verification will be performed given no e2e tooling is currently installed.
- GK box-entry resequencing scope boundary - research flagged that the fix should apply to declared shots only (applyDeclareShot), not the header/snapshot GK_DIVE entry sites, but this is a scope decision that should be explicitly confirmed/documented during planning, not assumed.
- MidmatchSubMode toggle buttons fate - architecture research raised (but deliberately left open) whether the explicit Reposition/Substitute toggle button is still needed once selection source (pitch vs. bench) already disambiguates intent; this is a UX call for planning, not resolved in research.
- Draft-mode bench number permanence - permanent jersey numbers for draft-mode bench players (assignBenchNumbers, currently a random bench-display-only number) need a new assign-once-freeze semantic that does not exist today; needs an explicit decision during Phase 2 planning, not just an extension of the Standard-room logic.

## Sources

### Primary (HIGH confidence)
- Direct codebase inspection: packages/client/src/components/LineupAssignmentScreen.tsx, packages/client/src/store/useGameStore.ts, packages/client/src/components/PieceOverlay.tsx, packages/client/src/components/ActionPanel.tsx, packages/client/src/components/EventBanner.tsx, packages/client/src/components/GameBoard.tsx, packages/server/src/gameEngine.ts, packages/server/src/roomStore.ts, packages/server/src/gameHandlers.ts, packages/server/src/draftSession.ts, packages/shared/src/formations.ts, packages/shared/src/types.ts, packages/shared/src/pitch.ts
- .planning/PROJECT.md - Key Decisions, Deferred/Out-of-Scope tables
- .planning/debug/foul-banner-sequence-not-pausing.md - full prior investigation history
- .planning/milestones/v1.6-MILESTONE-AUDIT.md - precedent audit format

### Secondary (MEDIUM confidence)
- Click and Swap, our alternative to Drag and Drop (Hacker News discussion, https://news.ycombinator.com/item?id=30034999) - corroborates pick-n-plop as an established DnD alternative
- The Stack and Priority in Magic: The Gathering (https://magicthegatheringauthority.com/the-stack-and-priority) and MTG The Stack Explained (https://www.tabletopmeta.com/blog/mtg-stack-explained) - illustrative causal-order reference only, not an architecture recommendation
- Squad number (association football), Wikipedia (https://en.wikipedia.org/wiki/Squad_number_(association_football)) - corroborates real-world permanent-number convention

### Tertiary (LOW confidence)
- General toast/notification-queue UX best-practice sources - generic web-app advice extrapolated to a game-banner context, used only to corroborate an already-built pattern

---
Research completed: 2026-08-30
Ready for roadmap: yes
