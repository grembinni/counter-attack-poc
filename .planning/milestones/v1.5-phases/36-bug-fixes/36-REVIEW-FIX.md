---
phase: 36-bug-fixes
fixed_at: 2026-08-02T20:26:00Z
review_path: .planning/phases/36-bug-fixes/36-REVIEW.md
iteration: 1
findings_in_scope: 5
fixed: 4
skipped: 1
status: partial
---

# Phase 36: Code Review Fix Report

**Fixed at:** 2026-08-02T20:26:00Z
**Source review:** .planning/phases/36-bug-fixes/36-REVIEW.md
**Iteration:** 1

**Summary:**

- Findings in scope: 5 (3 Critical, 2 Warning — `fix_scope: critical_warning`)
- Fixed: 4
- Skipped: 1

## Fixed Issues

### CR-01: `LEAVE_ROOM` deletes the room without notifying an already-joined second player

**Files modified:** `packages/server/src/roomHandlers.ts`, `packages/client/src/App.tsx`
**Commit:** `1e3e4fa`
**Applied fix:** `LEAVE_ROOM` now emits `ServerEvents.ROOM_ERROR('ROOM_CLOSED')` to any other
socket still in the room before calling `deleteRoom`. `App.tsx`'s `onRoomError` handler
gained a `'ROOM_CLOSED'` branch that clears the stored session token and calls
`resetLobby()` to return the stranded client to the landing screen (mirroring the existing
`'SESSION_EXPIRED'` handling pattern). Added `resetLobby` to the socket-listener
`useEffect`'s dependency array for consistency with the file's own documented convention
(Zustand setter references are referentially stable — listing them doesn't change when the
effect re-registers listeners).

Verification: Tier 1 (re-read) + Tier 2 (TypeScript syntax parse, `tsc --noEmit` for both
packages) + full test run — `pnpm --filter @counter-attack/server test` (642 passed,
including the two existing `room.integration.test.ts` `LEAVE_ROOM` tests) and
`pnpm --filter @counter-attack/client test` (483 passed, including `App.test.tsx`).

### CR-02: `LEAVE_ROOM` has no game-phase guard — any connected socket can delete an in-progress match's room

**Files modified:** `packages/server/src/roomHandlers.ts`
**Commit:** `a23b1b8`
**Applied fix:** Added a `room.gameState !== null` guard mirroring the pattern already used
by `TEAM_SPEED_SET` and `ROOM_SETTINGS_CONFIRM` in the same file. `LEAVE_ROOM` is now a
no-op once a match's `gameState` has been built, closing the one-shot DoS where any
connected socket (home or away) could replay the bare `room:leave` event mid-match and
delete the room for both players with no way to resume. Applied exactly as the review's own
code sample specified (no additional host-only restriction beyond the phase guard, since
the review's sample code did not include one despite the prose mentioning it as an "ideally").

Verification: Tier 1 (re-read) + Tier 2 (`tsc --noEmit`) + full server test suite (642
passed).

### CR-03: `GameSettingsScreen` permanently hides Confirm on any server-side confirm failure, with no error shown

**Files modified:** `packages/client/src/components/GameSettingsScreen.tsx`,
`packages/client/src/components/GameSettingsScreen.module.css`
**Commit:** `5fc7f64`
**Applied fix:** `GameSettingsScreen` now reads `gameError` from the store (matching the
pattern already used by `ActionPanel`, `FreeKickSetupPanel`, `KickOffSetupPanel`, and
`LineupAssignmentScreen`), renders it via a new `.errorText` class (copied verbatim from
`ActionPanel.module.css`'s declaration), and resets `hasConfirmed` to `false` in a
`useEffect` whenever a `gameError` arrives — so a `'DRAFT_SUPPLY_EXHAUSTED'` (or any other)
server-side rejection re-shows the Confirm button along with the error text instead of
leaving the host stuck with neither, letting them correct their pool selection and retry.

Verification: Tier 1 (re-read) + Tier 2 (`tsc --noEmit`, clean) + full client test suite
(483 passed, including all 14 existing `GameSettingsScreen.test.tsx` tests, none of which
needed modification). Pre-commit `lint-staged` hook (eslint --fix + prettier --write) ran
clean with no unexpected changes.

### WR-01: `tierSupplyMeetsNeed`/`buildTierPoolsForRound` tier-processing order is not stable-sorted for same-rank tiers beyond `chaseOrRare`

**Files modified:** `packages/shared/src/draftEngine.ts`
**Commit:** `e78f147`
**Applied fix:** Added `assertNoAmbiguousChaseRareSlots(round)`, called at the top of both
`tierSupplyMeetsNeed` and `buildTierPoolsForRound`, which throws if a single tiered round
ever declares both a standalone `'chase'` slot and a standalone `'rare'` slot (the only
scenario where the two functions' same-rank tie-break — `Map` insertion order, i.e.
`round.slots` declaration order — could matter and could theoretically diverge between the
two call sites). Chose the "runtime assertion" option from the review's two suggested
alternatives over the "explicit secondary sort key" option, since `DRAFT_ROUNDS` never
actually needs both standalone tiers simultaneously (only the merged `'chaseOrRare'`) —
the assertion documents and enforces that invariant rather than adding sort-key complexity
for a combination that should simply never be constructed.

Verification: Tier 1 (re-read) + Tier 2 (`tsc --noEmit` for `@counter-attack/shared`,
clean) + full shared package test suite (`pnpm --filter @counter-attack/shared test`, 613
passed, including all 67 `draftEngine.test.ts` tests) + server `draftPacks.test.ts` (9
passed, exercises `draftEngine` via the server's pack-generation path).

## Skipped Issues

### WR-02: `buildTierPoolsForRound` claims a tier's entire unclaimed primary population, not just what it needs

**File:** `packages/shared/src/draftEngine.ts:416-437` (current: ~432-453 after the WR-01
edit shifted line numbers)
**Reason:** Explicitly marked "Not required for correctness" in REVIEW.md, and the
function's own docblock states the full-population claim is _intentional_: "A tier's pool
starts with its FULL unclaimed primary population (preserving pre-cascade behaviour and
`drawFromPool`'s bucket-cap slack)". Slicing the primary pool down to `need` (+ some
unspecified slack) — as the review's fix suggests — would reduce the candidate surplus
`drawFromPool` relies on when skipping position-bucket-capped candidates (D-17: DEF/MID/
FWD_ST cap of 2 per pack), risking a behavioral regression in the bucket-cap invariant that
is currently covered by real-crypto-RNG structural-invariant tests in
`draftEngine.test.ts`. The review does not specify a concrete "reasonable slack" quantity,
and I confirmed via code-path analysis that the current over-claim has zero correctness
impact (cascades only ever flow downward into commoner tiers, never upward, so a tier
over-claiming its own primary population can never starve a different tier's own need).
Given the change is purely a performance/clarity optimization with a real, unquantified
risk of destabilizing tested gameplay-critical pack-generation logic, I deferred this fix
for human judgment on an acceptable slack-sizing formula rather than guessing at one.
**Original issue:** For a tier whose primary population already meets `need` (the common
case), `pool = shuffle(primaryCandidates, rng)` uses the entire unclaimed primary
population and claims all of it, rather than only the `need` amount actually destined to
be drawn — more pool computation than necessary per round, though not incorrect.

---

_Fixed: 2026-08-02T20:26:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
