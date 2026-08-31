---
phase: 48-permanent-jersey-numbers
verified: 2026-08-31T17:24:54Z
status: passed
score: 5/5 must-haves verified
overrides_applied: 0
---

# Phase 48: Permanent Jersey Numbers Verification Report

**Phase Goal:** Every player is assigned one jersey number at squad-build time that never changes for the rest of the match, regardless of position changes, substitutions, or resets.
**Verified:** 2026-08-31T17:24:54Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth (ROADMAP Success Criteria) | Status | Evidence |
|---|---------|------------|----------|
| 1 | Each player is assigned a jersey number once at squad-build time, independent of formation/lineup slot | ✓ VERIFIED | `buildSquadPieces` sets `number: homeSlots[i]!.jerseyNumber` / `awaySlots[i]!.jerseyNumber` once at build time (gameEngine.ts:300,308). Standard-mode bench: `assignBenchNumbers` draws once at `LINEUP_CONFIRM` (roomHandlers.ts:1019-1023). Pregame Step 3 client no longer fabricates a number before that draw (`LineupAssignmentScreen.tsx:1389-1424`, no `benchNumbers` prop passed). Regression test `LineupAssignmentScreen.test.tsx` (113/113 pass, incl. new NUMBER-01 case) confirms zero `#n` markup pre-confirm. |
| 2 | A player's jersey number is unchanged after repositioning, after a substitution, after a goal (by shot or penalty), and after half-time | ✓ VERIFIED | `applyRosterReposition`'s `newA`/`newB` literals omit `number` entirely (gameEngine.ts:3947-3959), so it flows through the `...pieceB`/`...pieceA` spread. `applySubstitution` explicitly sets `number: benchEntry.jerseyNumber` on the incoming piece (line 3722) and `jerseyNumber: outPiece.number` on the outgoing bench card (line 3740) — both person-owned. `applyRosterContinuity` (line 4011-4020) does `{ ...currentPiece, position: resetPiece.position }`, a full-object spread that carries `number` through unchanged. `gameEngine.rosterReposition.test.ts` (20/20), `gameEngine.substitution.test.ts` (48/48), and `substitution.integration.test.ts` (12/12) all pass. |
| 3 | The kickoff striker is selected by role, not by checking for jersey number 9 | ✓ VERIFIED | `grep -n "number === 9" packages/server/src/gameEngine.ts` → 0 matches anywhere in the file. `buildSquadPieces` now resolves `stSlotIndex = attackingSlots.findIndex(s => s.slotId === 'ST')` and anchors `attackingSquad[stSlotIndex]` (gameEngine.ts:331-336). `formations.test.ts` (6/6) and `gameEngine.phase23.test.ts` (8/8, extended to all 4 formations × 2 attacking sides) pass. |
| 4 | No reset path (goal-via-shot, goal-via-penalty, half-time, or any other `applyRosterContinuity` call site) ever reassigns a player's permanent number to someone else | ✓ VERIFIED | All 4 call sites of `applyRosterContinuity` traced: line 5157 (unsaveable-shot GOAL), line 5254 (shot-with-penalty-context GOAL), line 8428 (PENALTY_KICK GOAL), line 10363 (`applyHalfTimeStart`). All route through the same full-object-spread helper at line 4011-4020, which never overrides `number`. |
| 5 | Draft-mode bench players also receive a permanent number assigned once, not re-rolled on a later view or redraw | ✓ VERIFIED | `backfillBenchNumbers` (draftSession.ts:421-453) only fills missing ids, never touches an existing entry (`missingIds` computed from ids lacking a `benchNumbers` key), and is idempotent by reference (`if (missingIds.length === 0) return session`). Wired at `DRAFT_PICK`'s draft-complete transition (roomHandlers.ts:1178-1179, replacing the prior direct `assignBenchNumbers` call — now idempotent against re-entry) and at `DRAFT_REARRANGE` (roomHandlers.ts:1295, draftComplete-gated, placed before the requester-private `DRAFT_STATE_UPDATED` unicast). `draftSession.integration.test.ts` (22/22, incl. new NUMBER-05 and NUMBER-05/D-05 cases) and `draftSession.test.ts` (35/35, incl. 6 new `backfillBenchNumbers` unit cases) pass. |

**Score:** 5/5 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/server/src/gameEngine.ts` `applyRosterReposition` | number-follows-person, no slot override | ✓ VERIFIED | `number` absent from `newA`/`newB` literals (lines 3947-3959); wired (spread flows through to `newPieces`). |
| `packages/server/src/__tests__/gameEngine.rosterReposition.test.ts` | NUMBER-01/02/04 assertions | ✓ VERIFIED | 20 tests, all pass; includes NUMBER-02 event-pairing and NUMBER-04 reset-survival cases (confirmed by test names in file and passing run). |
| `packages/server/src/draftSession.ts` `assignBenchNumbers`/`backfillBenchNumbers` | crypto-backed 15-99 draw + fill-gaps-never-re-roll | ✓ VERIFIED | Both exported (lines 394, 421); `backfillBenchNumbers` unit-tested (6 cases in `draftSession.test.ts`), all pass. |
| `packages/server/src/roomHandlers.ts` standard-mode bench branch | `assignBenchNumbers(randomInt)`, not `PoolPlayer.number` | ✓ VERIFIED | Lines 1019-1023; `jerseyNumber: p.number` anti-pattern absent (grep confirms no such assignment remains in the bench branch). |
| `packages/shared/src/types.ts` `BenchEntry.jerseyNumber` doc | corrected both-modes contract | ✓ VERIFIED | Comment updated per 48-02-SUMMARY.md claim (spot-checked, describes 15-99 crypto-random unified contract). |
| `packages/client/src/components/LineupAssignmentScreen.tsx` pregame bench | no fabricated client-side number | ✓ VERIFIED | `pregameBenchNumbers` map and `benchNumbers` prop both removed (lines 1389-1424); `BenchCarousel` rendered without the prop. |
| `packages/server/src/gameEngine.ts` `applySubstitution` | person-owned number on both incoming piece and outgoing bench entry | ✓ VERIFIED | Line 3722 (`number: benchEntry.jerseyNumber`), line 3740 (`jerseyNumber: outPiece.number`). |
| `packages/server/src/roomHandlers.ts` `DRAFT_REARRANGE` handler | eager `backfillBenchNumbers` call, draftComplete-gated | ✓ VERIFIED | Line 1295, gated on `room.draftSession.draftComplete`, placed before the unicast (load-bearing ordering confirmed by reading surrounding code). |
| `packages/server/src/gameEngine.ts` `buildSquadPieces` kick-off anchor | `slotId === 'ST'` lookup, not `number === 9` | ✓ VERIFIED | Lines 331-336; zero remaining `number === 9` occurrences anywhere in `gameEngine.ts`. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `applyRosterReposition` | `applyRosterContinuity` | full-object spread contract (reposition writes no number, continuity carries it through every reset) | ✓ WIRED | Confirmed: reposition omits `number` from override literals; continuity spreads `currentPiece` in full. |
| `roomHandlers.ts` standard-mode bench branch | `draftSession.ts` `assignBenchNumbers` | `assignBenchNumbers(benchPlayerIds, randomInt)` | ✓ WIRED | Import present (line 63), call sites at 1019/1023. |
| `applySubstitution` incoming piece | `BenchEntry.jerseyNumber` of incoming player | `number: benchEntry.jerseyNumber` override | ✓ WIRED | Confirmed at gameEngine.ts:3722; `benchEntry` resolved via `inPlayerId` (line 3652). |
| `applySubstitution` outgoing bench entry | `PlayerPiece.number` of outgoing piece | `jerseyNumber: outPiece.number` override | ✓ WIRED | Confirmed at gameEngine.ts:3740. |
| `roomHandlers.ts` `DRAFT_REARRANGE` handler | `draftSession.ts` `backfillBenchNumbers` | `backfillBenchNumbers(room.draftSession, side, randomInt)` immediately after `applyRearrange`, gated on `draftComplete` | ✓ WIRED | Confirmed at roomHandlers.ts:1295, placed before the `DRAFT_STATE_UPDATED` unicast at line 1300 (ordering verified). |
| `roomHandlers.ts` `DRAFT_REARRANGE` handler | client `BenchCarousel` | `buildDraftView(...).benchNumbers` in the `DRAFT_STATE_UPDATED` unicast | ✓ WIRED | `socket.emit(ServerEvents.DRAFT_STATE_UPDATED, buildDraftView(room.draftSession, side))` immediately follows the backfill call. |
| `gameEngine.ts` `buildSquadPieces` | `packages/shared/src/formations.ts` `FORMATIONS[...].slots` | `findIndex((s) => s.slotId === 'ST')` into the matching squad array index | ✓ WIRED | Confirmed at gameEngine.ts:331-332; `formations.test.ts` locks ST-slot existence/uniqueness invariant per formation. |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Reposition/reset engine-level regression suites pass | `vitest run gameEngine.rosterReposition.test.ts gameEngine.substitution.test.ts formations.test.ts gameEngine.phase23.test.ts draftSession.test.ts --pool=forks` | 5 files, 117 tests, all pass | ✓ PASS |
| Server integration suites pass | `vitest run substitution.integration.test.ts lineupAssignment.integration.test.ts draftSession.integration.test.ts --pool=forks` | 3 files, 45 tests, all pass | ✓ PASS |
| Client pregame bench regression suite passes | `vitest run LineupAssignmentScreen.test.tsx --pool=forks` (client package) | 1 file, 113 tests, all pass | ✓ PASS |
| No remaining `number === 9` identity lookup in game engine | `grep -n "number === 9" packages/server/src/gameEngine.ts` | 0 matches | ✓ PASS |
| No other slot-derived `number:`/`.number =` override site outside the 3 sanctioned build-time locations | `grep -n "\.number =\|number: [a-zA-Z]" packages/server/src/gameEngine.ts` | Exactly 3 matches: `buildSquadPieces` ×2 (initial build), `applySubstitution` ×1 (person-owned) | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| NUMBER-01 | 48-01, 48-02, 48-03 | Each player assigned a jersey number once at squad-build time, independent of slot | ✓ SATISFIED | Verified truths #1 above. |
| NUMBER-02 | 48-01, 48-04 | Number persists through repositioning, substitution, goal reset, half-time reset | ✓ SATISFIED | Verified truths #2 above. |
| NUMBER-03 | 48-06 | Kickoff-striker anchor uses role/slot lookup, not `number === 9` | ✓ SATISFIED | Verified truths #3 above. |
| NUMBER-04 | 48-01 | `applyRosterContinuity` preserves number across all reset call sites | ✓ SATISFIED | Verified truths #4 above. |
| NUMBER-05 | 48-02, 48-05 | Draft-mode bench players get a permanent number once, not re-rolled | ✓ SATISFIED | Verified truths #5 above. |

**Traceability discrepancy (documentation only, not a functional gap):** `.planning/REQUIREMENTS.md`'s checkbox list (lines 27-31) and its Traceability table (lines 100,102-103) still show `NUMBER-02`, `NUMBER-04`, and `NUMBER-05` as unchecked/"Pending", even though plans 48-01, 48-02, 48-04, and 48-05 each declared `requirements-completed` for these IDs in their SUMMARY.md frontmatter, and this verification independently confirmed all three are implemented and covered by passing tests. Only `NUMBER-01` and `NUMBER-03` were marked complete in `REQUIREMENTS.md` (by commits `21b0a06a` and `b21db8a4` respectively) — no commit updated the other three. This is a documentation-sync gap in `REQUIREMENTS.md`, not a code defect; recommend updating the checkboxes/traceability table before closing the milestone.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `packages/shared/src/types.ts` | 37 | `PlayerPiece.number` doc comment still reads "D-04 (Phase 16): jersey number (GK = 1; others 2–11 in ROLE_ORDER)" — stale, contradicts Phase 48's own number-follows-person invariant (a substitute can legitimately wear 15-99, including a GK sub) | ⚠️ Warning | Documentation drift only — no functional impact. Flagged as WR-01 in `48-REVIEW.md` and left unfixed; every other Phase-48 touch point recorded an in-source decision note except this one field. |
| `packages/server/src/roomHandlers.ts` | 973,978 vs 1029,1034 | Two structurally-identical "resolve this bench player's confirmed jersey number" sites fail differently on a missing map entry: draft-room path silently falls back to `?? 0` (invalid jersey, no error logged), standard-room path non-null-asserts (would throw) | ⚠️ Warning | Both currently unreachable given existing invariants (per `48-REVIEW.md` WR-02 analysis), but inconsistent fail-safe behavior is latent risk if a future change breaks either invariant. No evidence found of dead/incorrect number values as of this verification. |
| `packages/client/src/components/LineupAssignmentScreen.tsx` | 547, 1052 | `/-(\d+)$/.exec(piece.id)` slot-index parsing duplicated across two call sites with no shared helper | ℹ️ Info | Not a jersey-number correctness issue; noted in `48-REVIEW.md` IN-01 as a future desync risk. |

No `TBD`/`FIXME`/`XXX` debt markers found in any file modified by this phase (`gameEngine.ts`, `draftSession.ts`, `roomHandlers.ts`, `types.ts`, `LineupAssignmentScreen.tsx`).

### Human Verification Required

None. All five success criteria are deterministic server-side game-engine/session logic (plus one deterministic client render-omission), fully exercised by automated unit and integration tests that were independently re-run during this verification and confirmed passing (117 + 45 + 113 = 275 tests across the touched suites, all green).

### Gaps Summary

No blocking gaps. All 5 ROADMAP success criteria are independently verified against the actual codebase (not merely SUMMARY.md claims): source code was read at each cited location, the number-follows-person contract was traced through every mutation site (`applyRosterReposition`, `applySubstitution`, `applyRosterContinuity` and its 4 call sites, `buildSquadPieces`, `assignBenchNumbers`/`backfillBenchNumbers`, and the pregame client render path), and the relevant test suites were re-executed live rather than trusted from prior run logs.

Two non-blocking WARNING-level code-review findings (stale doc comment, inconsistent fail-safe fallback) and one INFO-level finding (duplicated regex parsing) remain open from `48-REVIEW.md` — none affect the phase goal's correctness, but are worth closing in a follow-up pass. Additionally, `.planning/REQUIREMENTS.md`'s own checkbox/traceability tracking for NUMBER-02/04/05 was never updated to "Complete" despite the underlying work being done and verified — a documentation-sync task, not a code gap.

---

_Verified: 2026-08-31T17:24:54Z_
_Verifier: Claude (gsd-verifier)_
