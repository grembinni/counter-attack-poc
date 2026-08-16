---
status: resolved
trigger: 'bug - need to move attacker off the kick before selecting kicker otherwise no other player can be selected for the kick. auto move attackers out of kick 3 hex bubble, opposite direction as defenders'
created: 2026-08-16T00:19:29Z
updated: 2026-08-16T00:38:57Z
---

## Current Focus

hypothesis: Plan 39-18 made `freeKickHex` the fouled carrier's own occupied hex (previously it was the fouling defender's landing hex, which relocateTrappedFreeKickPieces always vacated). The just-landed CR-01 fix (commit 5e3fadc) added a server-side occupancy check to applyFreeKickMove's kicker-select branch that rejects placing ANY piece other than the current occupant onto freeKickHex. Net effect: since the carrier is now guaranteed to already be standing on freeKickHex, and no code moves the carrier (or other kicking-team pieces) away before kicker-select begins, the manager has no way to select a kicker other than the carrier itself — CR-01's own review note flagged this as "the same UX gap the client already has" and suggested relocating the carrier as the more complete fix.
test: read packages/server/src/gameEngine.ts's triggerFoulFreeKick / relocateTrappedFreeKickPieces (only relocates the CONCEDING team) and applyFreeKickMove's kicker-select branch (KICKER_HEX_OCCUPIED guard from CR-01); confirm no equivalent relocation exists for the KICKING team's other pieces around freeKickHex
expecting: confirms the gap — need a new relocation step (mirroring relocateTrappedFreeKickPieces / relocateOutsidePenaltyArea's anti-stacking pattern) that clears KICKING-team pieces (including the carrier) out of a hex bubble around freeKickHex, moved in the opposite direction from where the conceding team was already relocated, before kicker-select begins
next_action: fix implemented and verified by full automated suite (server 53 files/1337 tests, client 2 files/147 tests) — awaiting human confirmation in the real client that kicker-select is no longer stuck after a tackle/steal-sourced foul restart
reasoning_checkpoint:
hypothesis: "triggerFoulFreeKick (TACKLE/STEAL-sourced restart only) sets freeKickHex to the fouled carrier's own current hex (Plan 39-18), and applyFoulChoice's restart branch only calls relocateTrappedFreeKickPieces for the CONCEDING team — no code relocates the carrier (a KICKING-team piece) away from freeKickHex before kicker-select begins. Combined with CR-01's server-side KICKER_HEX_OCCUPIED guard (commit 5e3fadc) and the client's own computeFreeKickSetupValidHexes (useGameStore.ts:416-423, which returns [] for any candidate other than the current occupant), the carrier is the ONLY piece that can ever be placed as kicker."
confirming_evidence: - "gameEngine.ts:1254/2058 and the 39-18 comment at :1238-1247 confirm foulHex = carrier.position for TACKLE, and :1181 confirms foulHex = to (carrier's post-move hex) for STEAL — in both cases a KICKING-team piece, never displaced by the duel resolution." - "relocateTrappedFreeKickPieces (gameEngine.ts:8485-8556) filters strictly on `p.teamId === concedingTeam` — the kicking team is never included in its sweep." - "applyFreeKickMove's kicker-select branch (gameEngine.ts:8656-8669, CR-01) rejects any piece other than the current occupant of freeKickHex with KICKER_HEX_OCCUPIED — confirmed by the passing test '39-REVIEW CR-01' in foulFreeKick.integration.test.ts:572-603." - "useGameStore.ts:416-423's computeFreeKickSetupValidHexes returns [] for every candidate piece except the one already occupying freeKickHex during kicker-select — client-side confirmation of the same gap." - "39-REVIEW.md CR-01 finding (lines 165-172) explicitly names 'relocate the carrier off freeKickHex (mirroring relocateOutsidePenaltyArea's pattern)' as the more complete fix over a bare occupancy rejection."
falsification_test: "If, after adding a KICKING-team relocation sweep (mirroring the existing 2-hex-radius conceding-team sweep) into applyFoulChoice's TACKLE/STEAL restart branch, applyFreeKickMove can successfully place a NON-carrier kicking-team piece onto freeKickHex on the first attempt (no KICKER_HEX_OCCUPIED), the hypothesis is confirmed. If it still rejects, the carrier relocation didn't actually vacate freeKickHex (hypothesis wrong or fix incomplete)."
fix_rationale: "Generalizing relocateTrappedFreeKickPieces to accept an explicit target team (default: conceding team, preserving existing offside/tackle-fouling-team behavior byte-for-byte) and invoking it a SECOND time for the kicking team, scoped only to applyFoulChoice's non-penalty TACKLE/STEAL restart branch, directly closes the gap CR-01 identified without touching the offside path (whose kicking-team pieces are never guaranteed to be on freeKickHex, so no bug exists there) or the penalty path (different trigger function entirely). Reusing the same 'own goal line' ring-3 destination logic automatically pushes kicking-team pieces toward their own goal — the opposite end of the pitch from where conceding-team pieces are pushed — satisfying the trigger's 'opposite direction as defenders' requirement for free with no new sorting logic."
blind_spots: "Three existing tests in foulFreeKick.integration.test.ts currently assert the carrier legitimately remains standing on freeKickHex after 'restart' (this IS the bug being fixed) — these must be updated to assert the carrier is relocated and freeKickHex is vacated instead, or they will fail after the fix lands. Have not yet verified whether any OTHER kicking-team piece could legitimately already be exactly on freeKickHex in some edge case the 2-hex sweep wouldn't catch (should be impossible — freeKickHex is always exactly the carrier's hex for this path)."
tdd_checkpoint: null

## Symptoms

expected: When a free kick is awarded from a foul, the kicking (fouled) team's manager should be able to select ANY eligible kicking-team piece as the free-kick taker — not just the carrier who happens to already be standing on freeKickHex.
actual: Only the carrier itself can be placed on freeKickHex as kicker; any other kicking-team piece is rejected with KICKER_HEX_OCCUPIED (server-side, from the CR-01 fix in commit 5e3fadc) — and the client's own computeFreeKickSetupValidHexes already independently restricted kicker options to just the carrier before that, so the manager was effectively stuck at the UI layer too.
errors: server-side, a forged/direct attempt returns `{ ok: false, reason: 'KICKER_HEX_OCCUPIED' }`; no client-visible crash, just no usable "other kicker" option in the UI
reproduction: Trigger any tackle/steal-sourced foul (die of 1, or die of 1/2 on a tackle-from-behind per 39-24), choose "restart" at the foul choice, reach FREE_KICK_SETUP kicker-select — observe that no piece other than the fouled carrier is selectable/placeable as kicker.
started: The occupancy collision became the GUARANTEED default state as of Plan 39-18 (2026-08-15, this milestone) which changed freeKickHex from the fouling defender's landing hex to the carrier's own hex. It was only fully blocked (vs. merely awkward) once CR-01's server-side occupancy guard landed in commit 5e3fadc, same day.

## Eliminated

## Evidence

- timestamp: 2026-08-16T00:30:00Z
  checked: packages/server/src/gameEngine.ts triggerFoulFreeKick (1531-1556), applyFoulChoice restart branch (1663-1678), relocateTrappedFreeKickPieces (8485-8556), applyFreeKickMove kicker-select branch (8620-8701)
  found: relocateTrappedFreeKickPieces filters strictly `p.teamId === concedingTeam`; the KICKING team (whose carrier is guaranteed to occupy freeKickHex for TACKLE/STEAL-sourced fouls per 39-18) is never swept. CR-01's KICKER_HEX_OCCUPIED guard in applyFreeKickMove then permanently rejects any other kicking-team piece from being placed on freeKickHex.
  implication: confirms hypothesis — no code relocates the carrier or any kicking-team piece off freeKickHex before kicker-select begins on this path.
- timestamp: 2026-08-16T00:31:00Z
  checked: packages/client/src/store/useGameStore.ts computeFreeKickSetupValidHexes (401-423)
  found: during kicker-select (freeKickKickerChosen === false), returns [] for any candidate piece other than the current occupant of freeKickHex — matches server-side rejection, confirms UI is equally stuck.
  implication: fix must be server-side state repositioning (vacate freeKickHex before kicker-select), not a client validity-set change — once freeKickHex is vacated, the existing client logic already returns [freeKickHex] for any candidate correctly with no further client changes needed.
- timestamp: 2026-08-16T00:32:00Z
  checked: .planning/phases/39-fouls-cards-injuries-penalty-kicks/39-REVIEW.md CR-01 finding (lines 87-172)
  found: review explicitly names relocating the carrier off freeKickHex (mirroring relocateOutsidePenaltyArea's pattern) as "the more complete fix" over a bare occupancy rejection, which the CR-01 commit only shipped as an interim measure.
  implication: fix direction independently corroborated by prior code review, not just this session's own reasoning.
- timestamp: 2026-08-16T00:33:00Z
  checked: packages/server/src/**tests**/foulFreeKick.integration.test.ts (tests at lines 481, 545, 572) and packages/server/src/**tests**/gameEngine.fouls.test.ts (restart tests at 414-483)
  found: foulFreeKick.integration.test.ts has THREE tests that explicitly assert the carrier legitimately remains standing exactly on freeKickHex after 'restart' (this is the bug's current behavior encoded as an expectation). gameEngine.fouls.test.ts's restart tests only assert freeKickHex's VALUE (unaffected by piece-position relocation), not carrier position — no changes needed there.
  implication: the three foulFreeKick.integration.test.ts tests must be updated to match the corrected behavior (carrier relocated, freeKickHex vacated, any kicking-team piece placeable) as part of this fix.
- timestamp: 2026-08-16T00:34:00Z
  checked: packages/server/src/gameEngine.ts triggerOffsideFoul call site / packages/shared/src/offside.ts freeKickHex assignment (offside.ts:258)
  found: for offside, freeKickHex = offender's position, and the offender is always a CONCEDING-team piece (the team that was offside) — the KICKING team (defending team) has no guaranteed piece on freeKickHex, so this bug class does not exist on the offside path.
  implication: fix should be scoped narrowly to applyFoulChoice's TACKLE/STEAL restart branch only — do not modify applyOffsideFoulWithRelocation's behavior, avoiding any risk to the already-correct offside flow.
- timestamp: 2026-08-16T00:38:00Z
  checked: full automated test run after implementing the fix — `npx vitest run` in packages/server (53 files) and targeted run of packages/client's useGameStore.test.ts + FreeKickSetupPanel.test.tsx
  found: server — 53 test files, 1337 passed, 1 skipped, 1 todo, 0 failed (includes 3 rewritten foulFreeKick.integration.test.ts tests directly proving the fix: carrier relocated off freeKickHex, a non-carrier kicking-team piece now succeeds where it previously got KICKER_HEX_OCCUPIED, and CR-01's underlying guard still fires when a collision is constructed directly). client — 147 tests passed, 0 failed (no client files touched, confirms the fix is purely server-side as expected since the client's computeFreeKickSetupValidHexes already reacts correctly once freeKickHex is vacated).
  implication: fix verified against the full existing regression suite plus new targeted coverage; no client-side change was necessary.

## Resolution

root_cause: Plan 39-18 changed freeKickHex (for TACKLE/STEAL-sourced fouls only) to the fouled carrier's own current hex, but no relocation step was ever added for the KICKING team — only relocateTrappedFreeKickPieces's conceding-team sweep runs. Since the carrier is guaranteed to be standing on freeKickHex, and CR-01's occupancy guard (server) plus computeFreeKickSetupValidHexes (client) both reject/hide any other piece as a kicker candidate, the carrier is the only selectable kicker.
fix: Generalized relocateTrappedFreeKickPieces (gameEngine.ts) to accept an explicit target team (defaults to conceding team, preserving existing callers byte-for-byte), then added a second call in applyFoulChoice's TACKLE/STEAL restart branch (non-penalty path only) that sweeps the KICKING team's pieces within the same 2-hex bubble around freeKickHex — including the carrier — before FREE_KICK_SETUP becomes interactive. Reuses the existing "closest ring-3 hex to own goal line" destination logic unmodified, which naturally pushes kicking-team pieces toward the opposite end of the pitch from the conceding-team sweep. The offside and penalty-kick paths are untouched.
verification: Automated (server 53 files/1337 tests, client 147 tests, all passing) AND confirmed by the user in a live two-browser session (2026-08-16) — accepted.
files_changed:

- packages/server/src/gameEngine.ts
- packages/server/src/**tests**/foulFreeKick.integration.test.ts
