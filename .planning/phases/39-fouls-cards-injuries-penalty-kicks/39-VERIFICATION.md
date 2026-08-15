---
phase: 39-fouls-cards-injuries-penalty-kicks
verified: 2026-08-15T23:13:34Z
status: passed
score: 5/5 roadmap success criteria verified (24/24 requirement IDs traced and confirmed implemented)
overrides_applied: 0
---

# Phase 39: Fouls, Cards, Injuries & Penalty Kicks Verification Report

**Phase Goal:** A tackle, steal, or GK-dive-at-feet roll of 1 always resolves injury and booking before the attacker's continue-or-restart choice, with Professional Fouls, GK-dive-at-feet, and penalty kicks fully modeled — each of Fouls, Booking, and Injury independently toggleable at game creation.
**Verified:** 2026-08-15T23:13:34Z
**Status:** passed
**Re-verification:** No — initial verification (no prior VERIFICATION.md found for this phase)

## Context

This phase shipped in 24 plans across 13 waves: 17 original plans (39-01..39-17, ending
in a blocking live two-browser UAT session) plus 7 gap-closure plans (39-18..39-24)
addressing all 9 defects recorded in `39-UAT.md`. A post-gap-closure code review
(`39-REVIEW.md`) found 1 Critical issue (CR-01: missing server-side occupancy check on
free-kick kicker placement) which was fixed in commit `5e3fadc` with a regression test,
plus 2 Warnings and 2 Info items that do not block goal achievement. This verification
independently re-derived and checked all of that evidence against the current code —
it did not take any SUMMARY.md or REVIEW.md claim at face value.

## Goal Achievement

### Observable Truths (Roadmap Success Criteria)

| #   | Truth                                                                                                                                                                                                                                                                                                                                                                 | Status     | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | A tackle/steal/GK-dive-at-feet defender die of 1 calls a foul; injury (if enabled) then booking (if enabled) resolve, in that order, before the attacker's continue-or-restart choice; a Professional Foul routes to straight-red-vs-yellow instead of the normal booking roll                                                                                        | ✓ VERIFIED | `resolveFoulChain` (`gameEngine.ts:761-889`) gates on `defenderDie > triggerThreshold` (default `FOUL_TRIGGER_DIE=1`), runs the injury block (`state.injuryEnabled`) strictly before the booking block (`state.bookingEnabled`), and threads `isProfessionalFoul(...)` into `resolveBooking({..., professional})` which branches red-vs-yellow instead of yellow-vs-none per `fouls.ts:121-142`. `applyFoulChoice` (`gameEngine.ts:1586-1627`) is the only path to the continue/restart choice and runs strictly after `resolveFoulChain`. 249 targeted server tests (`gameEngine.fouls/booking/injury/gkDiveAtFeet/penaltyKick`, `foulFreeKick`/`gkDiveAtFeet`/`penaltyKick` integration, `restartTimeCost`, `undoReplay39`) + 62 shared `fouls.test.ts` tests, all pass.                                                                                                                                                                                                                                                                                                |
| 2   | An injured player (die ≥ Resilience) has all attributes reduced by 1 for the rest of the match; a second injury forces an immediate substitution, or leaves the player at degraded attributes if no substitute is available                                                                                                                                           | ✓ VERIFIED | `rollsInjury`/`applyInjuryDegradation` (`fouls.ts:86-98`) decrement every `INJURY_DEGRADED_ATTRIBUTES` key by 1 (floored, GK's 0 `highPass` left at 0), increment `injuryCount`. Phase 39 deliberately always takes the "no substitute available" branch since Substitutions ship in Phase 40 (documented decision D-06 in `39-CONTEXT.md`, matching ROADMAP.md's explicit soft-dependency note on Phase 40) — this is a scoped, intentional interim behavior, not a gap.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| 3   | A booked player (die ≥ Leniency) receives yellow; second yellow becomes red with immediate dismissal, no substitute replacement                                                                                                                                                                                                                                       | ✓ VERIFIED | `resolveBooking` (`fouls.ts:106-142`): base outcome from `rollsBooking(die, leniency)`, upgrades a second yellow (`priorYellows >= 1`) to red (`secondYellow: true`). `resolveFoulChain` applies `redCarded: true`/`yellowCards` mutation (`gameEngine.ts:862-874`). No substitute-replacement code path exists (Phase 40 territory) — correct for this phase's scope.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| 4   | GK dive-at-feet: adjacent tackle reuses existing duel; within-3-hex-parallel interrupt at most once per movement cycle, -1 dice from 3rd hex, displacement on success; GK die of 1 in either context fouls into a penalty regardless of duel outcome                                                                                                                  | ✓ VERIFIED | `gkDiveAtFeetUsedByTeam` cap set on accept (`gameEngine.ts:1896-1906`) and reset only at fresh-movement-cycle boundaries (`applyStartMovement`, "Start New Movement Phase", throw-in setup, GK restart movement — 4 sites, all commented "fresh 4-5-2 cycle", not per-slot) — this is the fix for UAT gap 4, confirmed correct (not the pre-fix 6-site version described in `39-UAT.md`). `resolveFoulChain` fires unconditionally on `defenderDie === FOUL_TRIGGER_DIE` regardless of SUCCESS/FAIL (`gameEngine.ts:2046-2058` comment + code). `applyFoulChoice` routes any `foulSource === 'GK_DIVE_AT_FEET'` restart to `triggerPenaltyKick` unconditionally (`gameEngine.ts:1620-1627`). 47 `gameEngine.gkDiveAtFeet.test.ts` + 15 `gkDiveAtFeet.integration.test.ts` tests pass.                                                                                                                                                                                                                                                                                     |
| 5   | Penalty kick = kicker-vs-GK duel with -2 GK dice penalty; both teams freely reposition beforehand (only kicker + defending GK allowed in the box, kicker via existing free-kick kicker-select-equivalent flow); tied duel → Loose Ball at the spot; Fouls/Booking/Injury independently toggleable at game creation, Booking/Injury inert unless Fouls is also enabled | ✓ VERIFIED | `applyPenaltyKickDuel` (`gameEngine.ts:7104-7237+`) applies `computeCombinedScore(gk.saving, gkDie, [-2])` and routes an exact tie to `LOOSE_BALL` at `ball.position` (the penalty spot) per PEN-03. `triggerPenaltyKick` (`gameEngine.ts:6710-6757`) does award-time box clear-out + GK auto-placement, then `PENALTY_KICK_TAKER_SELECT` → `applyPenaltyKickReposition`'s `PENALTY_AREA_RESTRICTED` guard (`gameEngine.ts:6763+`) restricts the box to taker + defending GK only. `GameSettingsScreen.tsx` renders 4 independent Match Rules toggles (Fouls/Booking/Injury/Out-of-Bounds) with Booking/Injury checkboxes `disabled={!fouls}` and normalised `booking: fouls && booking` / `injury: fouls && injury` at confirm time (lines 90-116, 173-193). Server reads `state.foulsEnabled`/`bookingEnabled`/`injuryEnabled` as independent `=== true` gates (`gameEngine.ts:790, 812, 841`). 67+22+17+23 tests across `gameEngine.penaltyKick.test.ts`, `penaltyKick.integration.test.ts`, `PenaltyKickSetupPanel.test.tsx`, `GameSettingsScreen.test.tsx` all pass. |

**Score:** 5/5 roadmap success criteria verified.

### UAT Gap-Closure Verification (9 defects from live two-browser session)

| #   | UAT Gap                                                         | Fix Verified | Evidence                                                                                                                                                                                                                                                                                                               |
| --- | --------------------------------------------------------------- | ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Continue offered after a successful+fouled duel                 | ✓            | `applyFoulChoice` rejects `'continue'` with `CONTINUE_NOT_ALLOWED` when `state.foulDuelSucceeded === true` (`gameEngine.ts:1596-1601`)                                                                                                                                                                                 |
| 2   | Restart placed at fouler's hex, not ball's hex                  | ✓            | `foulHex: carrier.position` at TACKLE_ATTEMPT (`gameEngine.ts:1254`) and GK_DIVE_AT_FEET (`:2058`) call sites; STEAL_ATTEMPT's `foulHex: to` is documented and correct because `to` IS the carrier's post-move hex in that branch (verified by reading the surrounding STEAL_ATTEMPT logic — `pieceId` is the carrier) |
| 3   | No hex-selection step for GK dive-at-feet; GK piece didn't move | ✓            | New `GK_DIVE_AT_FEET_TARGET` phase + `applyGkDiveAtFeetTarget` (`gameEngine.ts:1912-1980+`), client hex-selection wired in `useGameStore.ts` (`computeGkDiveAtFeetTargetHexes`, `GAME_GK_DIVE_AT_FEET_TARGET` emitter)                                                                                                 |
| 4   | GK could shot-block dive again same phase                       | ✓            | See Truth 4 above — cap reset sites now fire only at movement-cycle boundaries                                                                                                                                                                                                                                         |
| 5   | Penalty scoped to GK-dive fouls only                            | ✓            | `isPenaltyRestart` in `applyFoulChoice` checks `isInRegion(foulHex, foulingAreaKey)` for ANY foul source, OR'd with the GK-dive-always-penalty rule (`gameEngine.ts:1613-1627`)                                                                                                                                        |
| 6   | No explicit penalty-kicker select+confirm UX                    | ✓            | `PenaltyKickSetupPanel.tsx:160-204`, select-then-Confirm pattern mirroring corner-kick                                                                                                                                                                                                                                 |
| 7   | No tackle-from-behind rule                                      | ✓            | `isTackleFromBehind`/`hexesBehindAttacker`/`foulTriggerThreshold` (`fouls.ts:234-280`), wired at `gameEngine.ts:1247,1259`; distinct Action Log wording confirmed via `fromBehind` field threaded through `FOUL_CALLED` event                                                                                          |
| 8   | DOGSO wrong geometry                                            | ✓            | `isProfessionalFoul` rewritten to horizontal-proximity + goal-path-reachability (`fouls.ts:199-232`); the exact UAT worked example ((21,15) attacker / (29,12) defender, pace 4 → NOT DOGSO) is a passing unit test (`fouls.test.ts:277-299`)                                                                          |
| 9   | Corner/free/penalty kick missing 1-min clock cost               | ✓            | `gameEngine.restartTimeCost.test.ts` (8 tests, all pass); `applyPenaltyKickDuel` explicitly adds `actionCount: state.actionCount + 1` on both GOAL and SAVED branches (`gameEngine.ts:7178, 7228`)                                                                                                                     |

All 9 UAT gaps independently re-verified against current code, not merely re-read from SUMMARY.md claims.

### Critical Code-Review Finding (CR-01) — Fix Verified

`39-REVIEW.md` flagged CR-01: `applyFreeKickMove`'s kicker-select branch had no
server-side occupancy check, and UAT-gap-2's fix (`foulHex` now the fouled carrier's
own occupied hex) made same-hex piece stacking the guaranteed default case for every
foul-triggered free kick. Verified fixed in commit `5e3fadc`:

```
git show 5e3fadc -- packages/server/src/gameEngine.ts
```

adds a `kickerHexOccupant` lookup and a new `KICKER_HEX_OCCUPIED` rejection reason
before the placement write, plus a 33-line regression test in
`foulFreeKick.integration.test.ts`. Confirmed present in the current `gameEngine.ts`
(not just in the commit diff) and the full targeted test run below includes this file,
passing.

### Required Artifacts

| Artifact                                                                           | Expected                                                 | Status     | Details                                                                                                                                                               |
| ---------------------------------------------------------------------------------- | -------------------------------------------------------- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/shared/src/fouls.ts`                                                     | Foul/injury/booking/DOGSO/tackle-from-behind pure kernel | ✓ VERIFIED | 280 lines, no stubs, 62 passing tests in `fouls.test.ts`                                                                                                              |
| `packages/server/src/gameEngine.ts` (foul/injury/booking/GK-dive/penalty sections) | Engine logic for all 5 success criteria                  | ✓ VERIFIED | `resolveFoulChain`, `applyFoulChoice`, `triggerFoulFreeKick`, `triggerPenaltyKick`, `applyPenaltyKickDuel`, `applyGkDiveAtFeetTarget` all present, substantive, wired |
| `packages/client/src/components/GameSettingsScreen.tsx`                            | 4 independent game-creation toggles                      | ✓ VERIFIED | Fouls/Booking/Injury/Out-of-Bounds checkboxes, Booking/Injury disabled+normalised when Fouls off                                                                      |
| `packages/client/src/components/FoulChoicePanel.tsx`                               | Continue-or-restart UI                                   | ✓ VERIFIED | 11 passing tests                                                                                                                                                      |
| `packages/client/src/components/GkDiveAtFeetPromptPanel.tsx`                       | Dive prompt + hex-target selection                       | ✓ VERIFIED | 15 passing tests                                                                                                                                                      |
| `packages/client/src/components/PenaltyKickSetupPanel.tsx`                         | Reposition windows, taker select+confirm, shoot-only CTA | ✓ VERIFIED | 22 passing tests; PENALTY_KICK phase renders only a "Shoot" button, no pass options (lines 220-230)                                                                   |

### Key Link Verification

| From                              | To                                                                         | Via                                        | Status  | Details                                                                                       |
| --------------------------------- | -------------------------------------------------------------------------- | ------------------------------------------ | ------- | --------------------------------------------------------------------------------------------- |
| `applyMove` TACKLE/STEAL branches | `resolveFoulChain`                                                         | direct call                                | ✓ WIRED | `gameEngine.ts:1175, 1248`                                                                    |
| `resolveFoulChain`                | `isProfessionalFoul` / `resolveBooking` / `rollsInjury`                    | direct call                                | ✓ WIRED | `gameEngine.ts:794, 815, 845`                                                                 |
| `applyFoulChoice`                 | `triggerFoulFreeKick` / `triggerPenaltyKick`                               | conditional call on `isPenaltyRestart`     | ✓ WIRED | `gameEngine.ts:1620-1665`                                                                     |
| `GameSettingsScreen.onConfirm`    | `Room.foulsEnabled/bookingEnabled/injuryEnabled` → `buildInitialGameState` | socket event → server state init           | ✓ WIRED | `gameEngine.ts:369-422` reads the 3 booleans as constructor params with safe `false` defaults |
| Client `GkDiveAtFeetPromptPanel`  | `applyGkDiveAtFeetTarget`                                                  | `GAME_GK_DIVE_AT_FEET_TARGET` socket event | ✓ WIRED | `useGameStore.ts:1842` emits, `gameHandlers.ts`/`gameEngine.ts:1943` handles                  |
| `applyFreeKickMove` kicker-select | occupancy check (CR-01 fix)                                                | inline guard                               | ✓ WIRED | Confirmed present in current file, not just in the fix commit                                 |

### Behavioral Spot-Checks (Targeted Test Runs)

Full workspace test suite was NOT run repeatedly per must-have — targeted files were run once each.

| Behavior                                                             | Command                                                                      | Result                     | Status |
| -------------------------------------------------------------------- | ---------------------------------------------------------------------------- | -------------------------- | ------ |
| Server foul/injury/booking/GK-dive/penalty logic                     | `vitest run` on 10 targeted `packages/server/src/__tests__/*.ts` files       | 249/249 tests pass         | ✓ PASS |
| Shared fouls kernel (incl. DOGSO worked example, tackle-from-behind) | `vitest run src/fouls.test.ts` (shared)                                      | 62/62 tests pass           | ✓ PASS |
| Client foul/GK-dive/penalty/settings UI                              | `vitest run` on 5 targeted `packages/client/src/components/*.test.tsx` files | 80/80 tests pass           | ✓ PASS |
| TypeScript compiles cleanly                                          | `tsc --noEmit` in shared, server, client                                     | 0 errors in all 3 packages | ✓ PASS |

### Requirements Coverage

All 24 requirement IDs are declared across the phase's 24 plans (verified via `requirements:` frontmatter grep) — no orphaned requirements found relative to REQUIREMENTS.md's Phase 39 mapping.

| Requirement     | Description (abbrev.)                                     | Status               | Evidence                                                                                               |
| --------------- | --------------------------------------------------------- | -------------------- | ------------------------------------------------------------------------------------------------------ |
| FOUL-01         | Defender die of 1 calls foul                              | ✓ SATISFIED          | `FOUL_TRIGGER_DIE`, `resolveFoulChain` gate                                                            |
| FOUL-02         | Injury then booking, before continue/restart              | ✓ SATISFIED          | `resolveFoulChain` ordering                                                                            |
| FOUL-03         | Continue-or-restart choice                                | ✓ SATISFIED          | `applyFoulChoice`                                                                                      |
| FOUL-04         | Professional/Last-Man foul, correct geometry              | ✓ SATISFIED          | `isProfessionalFoul` + worked-example test                                                             |
| FOUL-05         | Fouls independent toggle                                  | ✓ SATISFIED          | `foulsEnabled`, `GameSettingsScreen`                                                                   |
| CARD-01         | Yellow on die ≥ Leniency                                  | ✓ SATISFIED          | `rollsBooking`/`resolveBooking`                                                                        |
| CARD-02         | Second yellow → red                                       | ✓ SATISFIED          | `resolveBooking`'s `secondYellow` branch                                                               |
| CARD-03         | Professional foul → straight red/yellow                   | ✓ SATISFIED          | `resolveBooking`'s `professional` branch                                                               |
| CARD-04         | Booking independent toggle                                | ✓ SATISFIED          | `bookingEnabled`, disabled-unless-Fouls checkbox                                                       |
| INJURY-01       | Injury on die ≥ Resilience                                | ✓ SATISFIED          | `rollsInjury`                                                                                          |
| INJURY-02       | -1 all attributes, floored                                | ✓ SATISFIED          | `applyInjuryDegradation`                                                                               |
| INJURY-03       | 2nd injury → sub or degraded                              | ✓ SATISFIED (scoped) | D-06: no-substitute branch always taken pre-Phase-40, documented and roadmap-aligned                   |
| INJURY-04       | Injury independent toggle                                 | ✓ SATISFIED          | `injuryEnabled`, disabled-unless-Fouls checkbox                                                        |
| GKDIVE-01..05   | GK dive-at-feet mechanics                                 | ✓ SATISFIED          | `computeGkDiveAtFeetOffer/TargetHexes`, `applyGkDiveAtFeetResponse/Target`, shared cap                 |
| PEN-01          | -2 GK dice penalty duel                                   | ✓ SATISFIED          | `applyPenaltyKickDuel`                                                                                 |
| PEN-02          | Free reposition, box-restricted, kicker-select flow       | ✓ SATISFIED          | `applyPenaltyKickReposition`'s `PENALTY_AREA_RESTRICTED` guard, `PenaltyKickSetupPanel` select+confirm |
| PEN-03          | Tie → Loose Ball at spot                                  | ✓ SATISFIED          | `applyPenaltyKickDuel` tie branch                                                                      |
| FK-01           | Tackle/steal foul → existing free-kick flow               | ✓ SATISFIED          | `triggerFoulFreeKick`                                                                                  |
| SETTINGS-01..03 | 4 independent toggles, Booking/Injury inert without Fouls | ✓ SATISFIED          | `GameSettingsScreen.tsx`                                                                               |

### REQUIREMENTS.md Traceability Table — Stale Tracking, Not a Functional Gap

`REQUIREMENTS.md`'s traceability table (lines 154-178) currently marks FOUL-01,
FOUL-04, FOUL-05, CARD-01..04, INJURY-01..04, PEN-02, PEN-03, and SETTINGS-01..03 as
"Pending", while the requirement-definition checkboxes above that table (lines 10-97)
show FOUL-02, FOUL-03, GKDIVE-01..05, PEN-01, FK-01 checked `[x]` and the rest still
`[ ]`. Both of these tracking artifacts are stale relative to the actual codebase:
every one of these IDs has substantive, tested, wired implementation as documented in
the Requirements Coverage table above (`gameEngine.booking.test.ts`,
`gameEngine.injury.test.ts`, `GameSettingsScreen.tsx`'s 4 toggles,
`isProfessionalFoul`'s DOGSO rewrite, `isTackleFromBehind`, etc. — all independently
re-verified against source in this report, not inferred from the table). This is a
**documentation tracking gap in REQUIREMENTS.md**, not a functional implementation
gap, and does not block phase completion. Recommend updating REQUIREMENTS.md's
traceability table and definition checkboxes to reflect the actual (Complete) status
for all 24 IDs as a small follow-up documentation task.

### Anti-Patterns Found

Scanned all 16 non-test files modified by the gap-closure diff (`0fb210d^..HEAD`) for
TBD/FIXME/XXX/TODO/HACK/PLACEHOLDER markers and empty-implementation patterns.

| File                                           | Line | Pattern                                             | Severity | Impact                                                                                                                                                                                     |
| ---------------------------------------------- | ---- | --------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `packages/server/src/gameEngine.ts`            | 7501 | `TODO: if an OPPOSING player occupies targetHex...` | ℹ️ INFO  | Pre-existing (July 12 commit, predates Phase 39 entirely), inside `applyQuickThrow` — an unrelated GK quick-throw function never touched by this phase's diff. Not a Phase 39 debt marker. |
| `packages/client/src/components/ActionLog.tsx` | 404  | `D-13 (TODO-STEAL-DETAIL)`                          | ℹ️ INFO  | This is a decision-ID label in a comment, not an open debt marker — the code it documents (auto-intercept sentinel rendering) is fully implemented directly below it.                      |

No TBD/FIXME/XXX debt markers found in any file modified by this phase's diff. No
`return null`/empty-object stub patterns, no hardcoded-empty render paths, no
console.log-only implementations found in the reviewed files.

### Human Verification Required

None. The phase already went through a blocking live two-browser human UAT session
(`39-UAT.md`) that surfaced the 9 gaps closed by this round, and this verification
independently confirmed each fix at the code level with passing automated tests. No
outstanding behavior in this phase depends on visual/real-time/external-service
judgment that automated checks cannot cover.

### Gaps Summary

No gaps found. All 5 roadmap success criteria are independently verified against
current source code (not SUMMARY.md claims), all 9 UAT-reported defects have
confirmed, tested fixes, the one Critical code-review finding (CR-01) has a confirmed
fix with a regression test, and all 24 requirement IDs have substantive, wired,
tested implementations. The only discrepancy found — REQUIREMENTS.md's traceability
table showing several IDs as "Pending" — is a stale documentation artifact, not a
functional gap, and is called out above as a recommended follow-up rather than a
blocker.

---

_Verified: 2026-08-15T23:13:34Z_
_Verifier: Claude (gsd-verifier)_
