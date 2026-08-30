---
phase: 44-referee-leniency-advanced-settings-drawer
verified: 2026-08-24T06:10:00Z
status: passed
score: 9/9 must-haves verified
overrides_applied: 0
---

# Phase 44: Referee Leniency & Advanced Settings Drawer Verification Report

**Phase Goal:** At game creation, all match-rule toggles — the four existing plus a new Referee Leniency override — live in a collapsed-by-default Advanced section on the settings screen, laid out in a two-column layout instead of a single vertical stack.
**Verified:** 2026-08-24T06:10:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Host can enable a manual Referee Leniency override (default off); when enabled, host sets 2–5 via a stepper defaulting to a mid value; the value drives both booking threshold and added-time; UI copy notes the coupling | ✓ VERIFIED | `GameSettingsScreen.tsx:96` `useState<boolean>(false)`, `:102` `useState<number>(4)`, `:314-324` `<input type="number" min={2} max={5} disabled={!refereeLeniencyOverride}>`, `:328` `(also affects added time)`. Engine: `gameEngine.ts:456-464` — single `refereeCard.leniency` conditional expression feeds both `resolveBooking` (`:1005`,`:1013`) and `newAddedTime` (`:3092`). Proven end-to-end over a real socket by `refereeLeniency.integration.test.ts` (6/6 passing) plus human walkthrough sign-off recorded in `44-05-SUMMARY.md` ("approved", D-03 resolved: "implemented behavior is fine"). |
| 2 | When override is left off, Leniency is randomly assigned 2..5 at match start unchanged (REFEREE-03) | ✓ VERIFIED | `gameEngine.ts:463` `randomInt(2, 6)` fallback branch untouched; regression-pinned by `gameEngine.refereeLeniency.test.ts` (9/9 passing, includes ≥2-distinct-values-across-20-builds check) and `refereeLeniency.integration.test.ts` override-OFF case. Note: ROADMAP.md's own SC #2 text says "1–6... exactly as before" — this is stale wording pre-dating quick task `260823-akw` (commit `390bd271`), which already narrowed the roll to 2–5 before Phase 44 started; REQUIREMENTS.md's REFEREE-03 text ("narrowed from the previous 1–6 roll") is the current, correct spec and matches the code. Not a Phase 44 gap — flagged for a future ROADMAP.md text cleanup only. |
| 3 | All match-rule toggles — Fouls, Booking, Injury, Out-of-Bounds, Referee Leniency, Tackle/Steal Decline — live under a collapsed-by-default Advanced section, two-column layout | ✓ VERIFIED | `GameSettingsScreen.tsx:246-343` — `Advanced ▸`/`▾` trigger with `aria-expanded={advancedOpen}` (default `false`), conditional-render `.advancedGrid` with two `.advancedColumn` children: left = Fouls/Booking/Injury, right = Out-of-Bounds/Referee Leniency/Tackle-Steal-Decline. `GameSettingsScreen.test.tsx` (42/42 passing) pins collapsed-by-default, toggle, and two-column structure. |
| 4 | Booking/Injury still visibly grey out when Fouls is off, inside the new layout, at both render time and confirm time, via one shared derivation | ✓ VERIFIED | `deriveFoulDependents` (`GameSettingsScreen.tsx:35-41`) is the single call (`:125`) feeding toggle guards (`:145`,`:151`), render-time className/disabled/helper-text (`:262-288`), and confirm-time payload (`:179-180`). `grep -c "fouls &&"` = 2 (both inside the derivation); `grep -n '!fouls'` = 1 hit (inside the derivation). Server also independently re-normalises (`roomHandlers.ts:602-603`, unchanged, defense-in-depth). |

**Score:** 4/4 roadmap success criteria verified

### Must-Haves from Plan Frontmatter (all 5 plans)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 5 | 44-01: override active → `refereeCard.leniency` exactly equals override value; override inactive → still random 2..5; no separate override branch at either consumer; every existing positional caller still compiles | ✓ VERIFIED | `gameEngine.ts:414-464`; 13th/14th trailing defaulted params; single conditional expression; both consumers unmodified. Full server suite green (1574 passed / 1 skipped / 1 todo, 67 files) proves no positional caller broke. |
| 6 | 44-02: collapsed disclosure, two-column grid, single `deriveFoulDependents`, unopened drawer confirms identical payload | ✓ VERIFIED | See truths #3–#4 above; `GameSettingsScreen.test.tsx` includes a "closed-drawer-after-editing" and "never-opened-drawer default payload" test, both passing. |
| 7 | 44-03: Leniency row between Out-of-Bounds and Tackle/Steal Decline; checkbox default off; stepper always visible, greyed while off; switching on leaves stepper at 4; integers 2–5 only; inline coupling note; `onConfirm` carries both new fields | ✓ VERIFIED | `GameSettingsScreen.tsx:290-339` row order confirmed (Out-of-Bounds line 291 < Leniency line 304 < Tackle/Steal line 332); `:96/:102` defaults; `:314-324` always-mounted `disabled={!refereeLeniencyOverride}`; `:186-187` raw pass-through in `handleConfirm`. |
| 8 | 44-04: host's override choice travels ROOM_SETTINGS_CONFIRM → Room; forged non-boolean flag rejected `INVALID_REFEREE_LENIENCY_OVERRIDE` pre-mutation; forged out-of-range/non-integer value rejected `INVALID_REFEREE_LENIENCY_VALUE` pre-mutation; both `ROOM_SETTINGS_CONFIRMED` emit sites carry flag+value; `LINEUP_CONFIRM` passes stored override into `buildInitialGameState` | ✓ VERIFIED | `roomHandlers.ts:515-535` (guards before `:609-610` mutation), `:609-610` (persist), `:626`/`:630` (confirm-emit), `:251-252` (`ROOM_JOIN` replay emit), `:1018`/`:1021` (engine call site, final two positional args). `room.integration.test.ts` rejection + happy-path tests and full server suite pass. |
| 9 | 44-05: end-to-end socket proof + human sign-off of the whole UI surface | ✓ VERIFIED | `refereeLeniency.integration.test.ts` (283 lines, 6/6 passing) covers override-ON exactness at both bounds, override-OFF randomness, Room/GameState agreement, late-joiner `ROOM_JOIN` replay, and the no-sibling-key structural coupling check (`grep -c "refereeCard.leniency"` = 11 ≥ 4 required). `44-05-SUMMARY.md` records the developer's verbatim "approved" and D-03 answer ("implemented behavior is fine"). |

**Score:** 9/9 must-haves verified (4 roadmap SCs + 5 plan-level must-have groups)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/server/src/gameEngine.ts` | `refereeLeniencyOverrideEnabled`/`refereeLeniencyValue` trailing params + conditional | ✓ VERIFIED | Present at lines 423/433, conditional at 461-464 |
| `packages/server/src/__tests__/gameEngine.refereeLeniency.test.ts` | REFEREE-02/03/04 engine regression suite | ✓ VERIFIED | 105 lines, 9/9 tests passing |
| `packages/client/src/components/GameSettingsScreen.tsx` | `advancedOpen`, `deriveFoulDependents`, two-column grid, Leniency row, widened `onConfirm` | ✓ VERIFIED | All present and wired (see truths #3, #4, #7) |
| `packages/client/src/components/GameSettingsScreen.module.css` | `.advancedGrid`/`.advancedColumn`/`.leniencyRow`/`.leniencyControls`/`.leniencyInput` | ✓ VERIFIED | All 5 classes present, `:disabled` pseudo-class on `.leniencyInput` |
| `packages/client/src/components/GameSettingsScreen.test.tsx` | disclosure/two-column/shared-derivation/Leniency regression tests | ✓ VERIFIED | 42/42 tests passing, includes `aria-expanded` and `spinbutton` role queries |
| `packages/shared/src/events.ts` | `refereeLeniencyOverride`/`refereeLeniencyValue` on both events | ✓ VERIFIED | Required fields on `ROOM_SETTINGS_CONFIRM` (284-286), trailing positional args on `ROOM_SETTINGS_CONFIRMED` (469/471) |
| `packages/server/src/roomStore.ts` | `Room.refereeLeniencyOverrideEnabled`/`Room.refereeLeniencyValue` | ✓ VERIFIED | Optional fields at lines 133/139 |
| `packages/server/src/roomHandlers.ts` | ASVS allow-list guards, persistence, both broadcast sites, engine wiring | ✓ VERIFIED | Guards 516-535, persist 609-610, broadcasts 251-252/626-630, engine call 1018/1021 |
| `packages/server/src/__tests__/refereeLeniency.integration.test.ts` | socket-level end-to-end proof | ✓ VERIFIED | 283 lines, 6/6 tests passing |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `gameEngine.ts buildInitialGameState` | `GameState.refereeCard.leniency` | conditional override expression | ✓ WIRED | `refereeLeniencyOverrideEnabled && refereeLeniencyValue !== undefined ? refereeLeniencyValue : randomInt(2, 6)` at line 461-464 |
| `GameState.refereeCard.leniency` | `resolveBooking` / `newAddedTime` | unchanged reads | ✓ WIRED | 3 read sites at 1005, 1013, 3092 — single source of truth confirmed, no sibling field |
| `GameSettingsScreen.tsx` advanced disclosure button | `advancedOpen` state | `onClick` toggle + `aria-expanded` | ✓ WIRED | Line 249-253 |
| `GameSettingsScreen.tsx deriveFoulDependents` | render + `handleConfirm` | single call feeds both | ✓ WIRED | Called once at line 125, consumed at 145/151/262-288/179-180 |
| `GameSettingsScreen.tsx` Leniency checkbox | number input `disabled` | `disabled={!refereeLeniencyOverride}` | ✓ WIRED | Line 322 |
| `GameSettingsScreen.tsx` local Leniency state | `onConfirm` payload | raw pass-through | ✓ WIRED | Lines 186-187 |
| `ROOM_SETTINGS_CONFIRM` handler | `Room.refereeLeniencyOverrideEnabled`/`Value` | assignment after guards | ✓ WIRED | Lines 609-610, after guards at 516-535 |
| `LINEUP_CONFIRM` handler | `buildInitialGameState` referee params | two trailing positional args | ✓ WIRED | Lines 1018/1021, final two args after `confirmedAwayBench` |
| `ROOM_SETTINGS_CONFIRM` payload over real socket | broadcast `GameState.refereeCard.leniency` | store → `LINEUP_CONFIRM` → `buildInitialGameState` | ✓ WIRED | Proven by `refereeLeniency.integration.test.ts`, all 6 tests passing including late-joiner `ROOM_JOIN` replay |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Engine + socket-level Leniency override tests pass | `pnpm --filter @counter-attack/server test -- refereeLeniency` | 2 files, 15/15 tests passed | ✓ PASS |
| Client GameSettingsScreen tests pass | `pnpm --filter @counter-attack/client test -- GameSettingsScreen` | 1 file, 42/42 tests passed | ✓ PASS |
| Full server suite green (no regressions) | `pnpm --filter @counter-attack/server test` | 67 files, 1574 passed / 1 skipped / 1 todo | ✓ PASS |
| Monorepo typecheck green | `pnpm -r typecheck` | shared/client/server all "Done" | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan(s) | Description | Status | Evidence |
|-------------|-----------------|--------------|--------|----------|
| REFEREE-01 | 44-03, 44-04, 44-05 | Host can toggle manual override, default off | ✓ SATISFIED | Checkbox default `false`, ASVS guard, engine wiring, human-verified |
| REFEREE-02 | 44-01, 44-03, 44-04, 44-05 | 2–5 stepper defaulting to mid value | ✓ SATISFIED | Default 4, min/max 2/5, clamp, socket-level exact-value proof at both bounds |
| REFEREE-03 | 44-01, 44-05 | Random 2–5 when override off | ✓ SATISFIED | `randomInt(2, 6)` fallback unchanged, regression-pinned |
| REFEREE-04 | 44-01, 44-03, 44-04, 44-05 | Override drives both booking + added-time identically; UI copy notes coupling | ✓ SATISFIED | Single `refereeCard.leniency` field read by both consumers; `(also affects added time)` copy; structural no-sibling-key test |
| SETTINGS-05 | 44-02, 44-05 | Collapsed-by-default Advanced section | ✓ SATISFIED | `advancedOpen` default `false`, human-verified |
| SETTINGS-06 | 44-02, 44-03, 44-05 | Two-column grid layout | ✓ SATISFIED | `.advancedGrid`/`.advancedColumn`, fixed logical grouping, human-verified |
| SETTINGS-07 | 44-02, 44-05 | Single shared Fouls-dependency derivation | ✓ SATISFIED | `deriveFoulDependents`, 1 call site, both render+confirm consumers |

No orphaned requirements — REQUIREMENTS.md's Phase 44 mapping (`REFEREE-01..04 | Phase 44`, `SETTINGS-05..07 | Phase 44`) matches exactly the union of all 5 plans' frontmatter `requirements` fields. (REQUIREMENTS.md's checkbox/status column still shows "[ ] Pending" — this is expected; it is updated by the orchestrator after verification closes the phase, not by the executor.)

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| — | — | No TBD/FIXME/XXX/TODO/HACK markers found in any file this phase modified | — | none |
| `GameSettingsScreen.tsx` | 364 | `(coming soon)` | ℹ️ Info | Pre-existing Legends/Icons draft-pool copy, unrelated to this phase's changes — not a new stub |

### Human Verification Required

None outstanding. Plan 44-05 Task 2 was an explicit `checkpoint:human-verify` (gate="blocking") executed during the phase, not deferred to end-of-phase. The developer completed the full 20-step walkthrough (collapsed disclosure, two-column layout, Fouls-dependency isolation inside the new layout, Leniency row bounds/behavior, and end-to-end match effect on booking + added time) and replied **"approved"**, with the D-03 native-vs-custom-stepper flag-back question explicitly answered **"implemented behavior is fine"** (no Phase 46 follow-up requested). This response is recorded verbatim in `44-05-SUMMARY.md`.

### Gaps Summary

No gaps found. All 4 ROADMAP success criteria and all 5 plans' frontmatter must-haves are verified against the live codebase: engine coupling confirmed by direct read of `gameEngine.ts`, wire contract/validation/persistence/broadcast confirmed by direct read of `events.ts`/`roomStore.ts`/`roomHandlers.ts`, client UI confirmed by direct read of `GameSettingsScreen.tsx`/`.module.css`, and every claim cross-checked against a fresh, independent run of the relevant test suites (not trusted from SUMMARY.md prose) — engine+integration suite (15/15), client component suite (42/42), full server suite (1574/1574 non-skipped), and full monorepo typecheck, all passing at verification time. The only textual discrepancy found (ROADMAP.md SC #2's stale "1–6" wording vs. the correct, already-shipped "2–5" behavior) predates Phase 44 and does not reflect a code gap — REQUIREMENTS.md's canonical REFEREE-03 wording matches the actual, tested, human-approved behavior.

---

_Verified: 2026-08-24T06:10:00Z_
_Verifier: Claude (gsd-verifier)_
