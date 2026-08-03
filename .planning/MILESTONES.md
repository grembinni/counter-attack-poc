# Milestones

## v1.5 UX Refresh & Code Cleanup (Shipped: 2026-08-03)

**Phases:** 31–36 (6 phases) | **Plans:** 35 | **Timeline:** 2026-07-22 → 2026-08-03 (12 days)
**Commits:** 328 | **Files changed:** 221 | **Insertions:** 30,214 | **Deletions:** 1,952
**Requirements:** 25/25 complete
**Test suite:** shared 613 / server 642 (1 skipped, 1 todo) / client 483 = 1,738 tests, all green

**Delivered:**
Replaced the deep-blue chrome with a broadcast-sports charcoal/graphite theme built on a single design-token layer; standardized the hex-highlight/ring color system into one source of truth (resolving the red-means-both-offside-and-shot-target conflict); unified ActionPanel/ActionLog formatting, borders, buttons, and terminology across every game phase; paid down code debt (dead-code gate, consolidated color/team-slot lookups, Zustand selector review, hook-dependency lint); and closed 8 known bugs. Grew mid-milestone — Phase 36 was added to close 5 additional defects surfaced by Phase 35's UAT pass.

**Key Accomplishments:**

1. Fixed 3 replay/eligibility/GK-deflection defects (BUG-30..32), including two gap-closure rounds that closed VERIFICATION.md truths the first fix pass left open (Phase 31)
2. Installed `knip` as a permanent CI-enforced dead-code gate and consolidated color/team-slot derivation into `useTeamColors`/`useMyTeam`, with a full Zustand selector/derived-state review that caught a real staleness bug (Phase 32)
3. Built a single chrome design-token layer (`tokens.css` + one runtime `--team-accent` variable) and a single source-of-truth highlight/ring color table, documented in `docs/HIGHLIGHT-REFERENCE.md` (Phase 33)
4. Replaced the app-wide deep-blue theme with a WCAG AA-verified charcoal/graphite palette, built entirely on the Phase 33 token layer (Phase 34)
5. Unified ActionPanel/ActionLog into one borderless, terminology-consistent system with a shared CTA color pattern across all 18 render sites (Phase 35)
6. Fixed 5 more bugs (BUG-33..37) — Game Settings room-teardown, draft-pack uniqueness/cascade correctness, blocked-shot loose-ball origin, and an undo boundary clamp at a resolved dice roll (Phase 36)

**Known deferred items at close:** 2 (see STATE.md Deferred Items) — a KICK_OFF_SETUP shot-path shading bug (rendering, root cause unresolved) and a low-priority CSV-consolidation idea, both carried forward. RESP-01..09 (response-move activation model) remains deferred again, unscheduled.

Full archive: [milestones/v1.5-ROADMAP.md](milestones/v1.5-ROADMAP.md) · [Requirements](milestones/v1.5-REQUIREMENTS.md) · [Audit](milestones/v1.5-MILESTONE-AUDIT.md)

---

## v1.4 Response Polish + Draft Mode (Shipped: 2026-07-22)

**Phases completed:** 5 phases, 30 plans, 66 tasks

**Key accomplishments:**

- Lock FREE_KICK_SETUP undo to the current stage via a server NOTHING_TO_UNDO fix and a client canUndo empty-stage guard using freeKickPlacedPieceIds.
- Regression suite locking BUG-28 (header-target range uses contestant position, not ball) and BUG-29 (shot range cube-consistent at distance 11) — investigation confirms production code already correct for both bugs
- Three client fixes — MOVE End Turn button color from ctaButtonClass, opponent activated-piece inspect on click, and deflect log format verification with test coverage.
- Added `TeamType`/`DraftPoolId`/`SELECTABLE_DRAFT_POOLS` to shared types and the `ROOM_SETTINGS_CONFIRM`/`ROOM_SETTINGS_CONFIRMED` typed Socket.io event pair to `packages/shared/src/events.ts` — pure type-surface widening, no runtime behavior changes.
- Host-authenticated ROOM_SETTINGS_CONFIRM Socket.io handler with a both-conditions gate (settingsConfirmed && slot-2-joined) that closes the race where a fast-joining player could reach team selection before game settings exist.
- Host-only GameSettingsScreen (Match Speed + Standard/Draft toggle + 5 draft-pool checkboxes) wired into the client Screen state machine, with a new shared SPEED_OPTIONS constant and App.tsx routing/emit/receipt plumbing for ROOM_SETTINGS_CONFIRM/CONFIRMED.
- Converted the interactive Match Speed picker on UniformSelectionScreen and TeamSelectionScreen to a read-only subheader (Standard) / single settings-summary line (Draft), backed by a new centralized `formatSettingsSummary` formatter.
- Added a read-only active-match-speed segment to the GameBoard scoreboard (D-08) and closed out Phase 27 with an approved holistic human-verify checkpoint covering the full game-creation-settings flow, including one UI gap-closure fix (centered/spaced settings subheader) requested during review.
- Threaded a `poolTag` field ('legend' | 'icon') through the CSV -> seed-rosters.ts -> teams.ts codegen pipeline to tag 10 reserved Legends/Icons free agents, and added `DraftTier`/`TIER_PERCENTILE_BOUNDS`/`PACKS_PER_MATCH`/`PACK_COMPOSITION` configurable draft constants to types.ts.
- Built the pure `draftEngine.ts` module (pool derivation + total-stat + rank-based percentile tier classification) that 28-03 and 28-04 will import unchanged.
- Extended `draftEngine.ts` with `generateDraftPacks` — a fully RNG-injected batch pack generator that produces all 8 match packs with D-12 pool-shortage backfill (Original -> MLS -> International) and D-09 no-cross-pack-duplication dealing.
- `packages/server/src/draftPacks.ts` binds Node's `crypto.randomInt` into the shared `generateDraftPacks` engine via `generateMatchPacks(selectedPools)`, with an integration test proving 8/7/1-1-1-3-1/no-duplication invariants hold across repeated real-CSPRNG runs.
- New DraftSession/DraftClientView types, DRAFT_PICK/DRAFT_REARRANGE/DRAFT_STATE_UPDATED typed Socket.io events, and Room.draftSession field — the interface-first contract every other Phase 29 plan compiles against.
- Pure, unit-tested `draftSession.ts` implementing the full 1+2+1×4 pick-and-swap cycle machine, independent pack-to-player shuffle (D-04), cycle-4 keeper safety auto-pick, and CSPRNG-driven bench numbering — zero `io`/`socket` dependencies, mirroring `gameEngine.ts`'s separation from the socket layer.
- Two new client carousels — `DraftPackCarousel` (variable-size, tier-sorted, drag-source-only pack row) and `BenchCarousel` (dynamic drag-source + drop-target bench) — sharing one `DraftCardBody` renderer and five new tier-border CSS classes, isolating all new draft visuals so Plan 05 only wires `.tsx`.
- Wired the pure draftSession.ts state machine into the live Socket.io layer: draft settings confirm bootstraps a CSPRNG-assigned DraftSession, UNIFORM_CONFIRM diverges cleanly for draft vs. standard mode, DRAFT_PICK/DRAFT_REARRANGE enforce full server-authoritative validation (card membership, bidirectional GK-slot rules, mutex, per-socket privacy), and mid-draft reconnect resumes exactly where it left off.
- Wired the full draft interaction into LineupAssignmentScreen (carousel-over-lineup, pack-to-pick and rearrange drag-drop, GK-slot rule, waiting/counter/keeper-banner UI, draft-complete hand-off) and routed App.tsx to the draft screen off DRAFT_STATE_UPDATED — Standard mode fully non-regressed by a new first-ever test file.
- Automated gate fully green (typecheck, 1527 tests, build); the draft itself (4 cycles, 16 cards/player) works, but live two-browser verification surfaced 5 gaps in post-draft rearrangement, bench carousel, and game-start hand-off — phase held open for gap-closure, not marked complete.
- 1. [Rule 1 - Bug] Fixed ambiguous "Previous card" query in the pre-existing D-12 waiting-for-opponent test
- Re-ran the full monorepo automated gate after the 29-07 (server lifecycle) and 29-08 (client carousel/robustness) gap fixes merged — typecheck, 1542 tests, and build all green — then ran the mandatory human two-browser walkthrough (Task 2): 7 of 8 scripted checks pass without qualification (confirming the three original critical gaps are closed, plus keeper safety and reconnect), but the human discovered a new, more specific defect — dragging a card from one filled lineup slot onto another filled lineup slot sends the displaced player to the bench instead of trading places with the dragged card. This plan does NOT mark Phase 29 complete; it records the new gap in 29-VERIFICATION.md for a follow-up gap-closure cycle (29-10).
- Fixed `applyRearrange` to perform a true two-way swap for lineup-slot-to-lineup-slot drags instead of bumping the displaced occupant to the bench, closing 29-VERIFICATION.md Gap 1.
- Three server-side guard-only fixes closing the last CRITICAL gap on Phase 29: draft-mode LINEUP_CONFIRM now enforces draftComplete, DRAFT_PICK now shares DRAFT_REARRANGE's post-confirm/post-start guard, and reconnect re-sync now covers the post-complete/pre-confirm window.
- Regenerated teams.ts from the finished CSV rebalance and rewrote the draft type/engine contract to fixed-absolute-threshold tier classification (4-value DraftTier, TIER_STAT_THRESHOLDS) with a 6-round DRAFT_ROUNDS config table and a legend/icon PoolTag bridge for Legends/Icons pools.
- Rewrote `generateDraftPacks` from the flat 8-pack/uniform-composition model to a 6-round, GK-only-round-1, position-and-tier-constrained, per-round-variable-composition model driven entirely by the `DRAFT_ROUNDS` config table from Plan 01, plus a 13-test round-scoped test suite covering every D-09..D-18/D-25 invariant.
- Rewrote the pure draft-session state machine (`draftSession.ts`) from the fixed 4-cycle/16-card model to the round-aware 6-round/17-card model, deleting the DRAFT-08 keeper-safety-net mechanic outright and replacing global pack-order shuffling with a per-round coin-flip.
- Narrowed the client's 5-color tier system to 4 (D-22 hex values corrected fresh), extended tier-colored card borders to the starting-11 lineup slots, replaced the role-based keeper tier fallback with exact classifyTier resolution, deleted the dead keeper-safety banner, made the draft progress label round-aware, and inverted the Legends/Icons checkbox tests for the D-08 pool unlock.
- Wired the round-aware draft session into `roomHandlers.ts` (openNextRound, keeper-safety-net call block deleted) and rewrote all four server draft integration test suites for the 6-round/17-card/no-keeper-tier model, closing the cross-plan RED window and bringing `packages/server` to a fully green build/typecheck/test state (minus one pre-existing, out-of-scope failure).
- Closed the phase's last cross-plan collateral RED window (8 test failures traced to Plan 01's player-pool CSV rebalance, logged in deferred-items.md by Plan 05) by re-pinning 3 stale test fixtures — full 3-package suite (1,567 tests) and full-workspace typecheck are both green, every superseded draft identifier is confirmed purged from `packages/`, and the live two-browser 6-round draft walkthrough is human-approved.

---

## v1.2 — Team Identity & Core Fixes (Shipped: 2026-07-03)

**Phases:** 15–18.4 (10 sub-phases) | **Plans:** 52 | **Timeline:** 2026-06-13 → 2026-07-03 (20 days)
**Commits:** 544 | **Files changed:** 326 | **Insertions:** 60,174 | **Deletions:** 2,235
**Requirements:** 48/50 complete (OFFSIDE-01/02 code implemented; human UAT deferred to v1.3)

**Delivered:**
Four named teams (Cozmos, Xolos, City, Crew) with badge PNGs and jersey patterns, CSV-seeded player rosters, full team-selection lobby, v1.4.1 action model alignment, offside detection, 28 bug fixes, and 8 UX enhancements.

**Key Accomplishments:**

1. Four real teams with badge PNGs, jersey patterns (outfield + GK), and TEAM_CONFIGS color system replaced hardcoded placeholders
2. CSV-seeded player rosters (fc_stats.csv) with full team-selection lobby — home picks first, away from remaining three
3. Seven rule-correctness defects fixed (BUG-01..05, MOVE-06, PASS-02) and full Counter Attack v1.4.1 action model aligned across 16 plans (Phase 17.1)
4. Offside detection (sticky, team-relative, all pieces) + free-kick restart flow implemented (OFFSIDE-01/02 code; UAT deferred)
5. 21 bug-bash fixes (Phases 18.2/18.3): replay visibility, duplicate-logic consolidation, movement-state-machine correctness, log formatting
6. 8 UX enhancements: game-speed selector, end-turn confirmation dialog, final-third red lines, stat/action tooltips, transient EventBanner

**Known deferred items at close:** 19 (see STATE.md Deferred Items)
Full archive: [milestones/v1.2-ROADMAP.md](milestones/v1.2-ROADMAP.md) · [Requirements](milestones/v1.2-REQUIREMENTS.md)

---

## v1.1 Roadmap Archive — Counter Attack Web v1.1 (Backfilled: 2026-06-21)

**Note:** Synthesized from archive snapshot by `/gsd-health --backfill`. Original completion date unknown.

---

## v1.0 Roadmap Archive — Counter Attack Web v1.0 (Backfilled: 2026-06-21)

**Note:** Synthesized from archive snapshot by `/gsd-health --backfill`. Original completion date unknown.

---
