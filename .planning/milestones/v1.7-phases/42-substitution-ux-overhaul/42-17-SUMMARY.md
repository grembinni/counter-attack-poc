---
phase: 42-substitution-ux-overhaul
plan: 17
subsystem: shared/rules-engine
tags: [audit, bug-fix, gap-closure, offside, passing, quality-gate, regression-tripwire]

# Dependency graph
requires:
  - phase: 42-substitution-ux-overhaul (plan 16)
    provides: 'passValidator.ts LONG landing restriction and offside.ts opponent counting/flag evaluation filtered through isActivePiece'
  - phase: 42-substitution-ux-overhaul (plan 05)
    provides: 'gameEngine.ts whole-file D-10 item 4 audit and classification methodology (OCCUPANCY/CONSTRUCTION labels)'
provides:
  - 'Exhaustive D-10 item 4 audit of the whole packages/shared package (19 sites, zero unclassified), explicitly including offside.ts'
  - 'Confirmation that all three 42-VERIFICATION.md missing: items are closed'
  - "A green whole-repo quality gate over 42-16's changes (10 commands, documented lint fallback)"
affects: [42-VERIFICATION.md re-run, /gsd-verify-phase 42]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - 'Audit-only plans record ACTUAL findings against a pre-captured baseline table rather than re-deriving classification from scratch'

key-files:
  created: []
  modified: []

key-decisions:
  - 'No source file required modification — every site the audit enumerated was already isActivePiece-filtered by 42-16 (offside.ts, passValidator.ts) or 42-01/42-03/42-05 (moveValidator.ts, fouls.ts, outOfBounds.ts, shotValidator.ts). Zero NEW findings outside the 19-row baseline, so the inline-fix policy was never triggered.'
  - "pnpm format:check (gate command 7) fails on 12 pre-existing files unrelated to 42-16/42-17's scope (none of the 12 are among the four files 42-16 modified, independently confirmed clean via a scoped prettier --check). Recorded as a genuine, out-of-scope pre-existing gate failure per the Scope Boundary rule rather than silently fixed or silently ignored."

requirements-completed: [BUG-38]

duration: ~35min
completed: 2026-08-23
---

# Phase 42 Plan 17: Shared-Package Piece-List Audit & Whole-Repo Quality Gate Summary

**Closed the D-10 item 4 audit for the whole `packages/shared` package (19 sites, zero unclassified, `offside.ts` explicitly in scope) with zero new findings — every site was already `isActivePiece`-filtered by 42-16 or earlier plans — and ran the 10-command whole-repo quality gate, confirming all three `42-VERIFICATION.md` `missing:` items are closed.**

## Performance

- **Duration:** ~35 min
- **Completed:** 2026-08-23T12:08:59Z
- **Tasks:** 2 (as planned)
- **Files modified:** 0 (read-only audit and verification plan; no inline-fix conditions were met)

## Accomplishments

- Ran both enumeration greps (`pieces\.filter|pieces\.find|pieces\.some|pieces\.map` and the loop/`.pieces\b` variant) across all of `packages/shared/src`, merged the results, and classified all 19 baseline sites — every one matched its EXPECTED classification with zero deviation and zero new (unlisted) sites found.
- Confirmed `offside.ts` — the file the original D-10 item 4 audit never named — is now fully `isActivePiece`-aware: `opposingPiecesEqualOrAhead` (OCCUPANCY, filtered by 42-16), `evaluateOffside`'s `stillFlagged`/`newlyFlagged` derivations (OCCUPANCY, filtered by 42-16), and the `piecesById` map / `triggerOffsideFoul` offender lookup (both CONSTRUCTION, correctly left unfiltered per 42-16's own audit notes, re-verified here rather than re-cited).
- Ran the step-C raw-flag contract check: every remaining `redCarded`/`onPitch` reference in `packages/shared/src` outside test files is inside `stoppagePhases.ts` (the predicate itself and the deliberately-unfiltered `maxOnPitchFor`), inside `types.ts` (field declarations/doc comments), or an explanatory comment (`fouls.ts:219`) — zero live filter clauses hand-write the flag anywhere else.
- Ran the server/client regression tripwire: `gameEngine.ts` still has 60 `isActivePiece` call sites (meets the `>= 60` threshold from `42-VERIFICATION.md`), `gameHandlers.ts` has 10 (non-zero; all seven named line numbers — 1096, 1176, 1305, 2389, 2613, 2691, 2790 — independently re-confirmed to resolve to `isActivePiece` usage), `HexGrid.tsx` has 25 (non-zero).
- Ran the plan's automated verify command: exits 0, `{ off: 5, pv: 12, mv: 8 }` — all three counts exceed their required minimums (4/7/3).
- Ran the full 10-command whole-repo quality gate: build, typecheck, shared/server/client test suites (879/1507/1116 tests respectively), lint (with the documented pre-existing fallback), format:check (pre-existing unrelated failure, recorded not fixed), stylelint, knip, and client contrast check.
- Confirmed via `git diff --stat` that zero files were modified by this plan (no new findings triggered the inline-fix policy) — the only change in the working tree across both tasks is this SUMMARY.

## Task Commits

Neither task modified a source or test file (Task 1's audit found zero new sites requiring the inline-fix policy; Task 2 is read-only verification), so there is no per-task code commit. Both tasks' evidence is captured in full below and in this SUMMARY, which is committed as this plan's sole artifact per its `files_modified: []` frontmatter.

**Plan metadata:** commit pending (final SUMMARY/STATE commit is handled by the orchestrator per worktree isolation)

## Files Created/Modified

None — audit-only plan; `files_modified: []` per plan frontmatter, confirmed unchanged by `git diff --stat` (empty) after both tasks.

## Shared-Package Piece-List Audit

Enumeration command 1: `grep -rn "pieces\.filter\|pieces\.find\|pieces\.some\|pieces\.map" packages/shared/src --include=*.ts | grep -v "\.test\.ts"`
Enumeration command 2: `grep -rn "for (const .* of .*pieces\|\.pieces\b" packages/shared/src --include=*.ts | grep -v "\.test\.ts"`

Both commands were run against the current tree (post-42-16). Merged, deduplicated result: 17 raw grep hits across `fouls.ts`, `moveValidator.ts`, `offside.ts`, `outOfBounds.ts`, `passValidator.ts`, `shotValidator.ts`, and `stoppagePhases.ts`. One baseline row (`offside.ts`'s `stillFlagged` filter) is a `priorFlagged.filter(...)` call — filtering an id array, not a `pieces.*` expression directly — so it is not a literal grep hit on either pattern; it is still reproduced below (row 8) because it was read and independently verified during the `read_first` pass, per the baseline table's own instruction to match "by file plus enclosing function name, never by line number."

| #   | File                | Enclosing function / expression                                   | Expected class | Actual class | Evidence                                                                                                                                                                                              |
| --- | ------------------- | ----------------------------------------------------------------- | -------------- | ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `fouls.ts`          | `isProfessionalFoul` — `fouler` by-id lookup (line 205)           | CONSTRUCTION   | CONSTRUCTION | `state.pieces.find((p) => p.id === foulerId)` — unfiltered by-id resolution, correct                                                                                                                  |
| 2   | `fouls.ts`          | `isProfessionalFoul` — `candidates` filter (line 214)             | OCCUPANCY      | OCCUPANCY    | `isActivePiece(candidate)` conjunct present (line 224), pre-existing from 42-03                                                                                                                       |
| 3   | `moveValidator.ts`  | destination-occupancy `.some` (line 71)                           | OCCUPANCY      | OCCUPANCY    | `isActivePiece(p) && p.position.q === to.q && p.position.r === to.r`                                                                                                                                  |
| 4   | `moveValidator.ts`  | ZoI `opponents` filter (line 104)                                 | OCCUPANCY      | OCCUPANCY    | `p.teamId !== piece.teamId && isActivePiece(p)`                                                                                                                                                       |
| 5   | `moveValidator.ts`  | ball `carrier` by-id lookup (line 123)                            | CONSTRUCTION   | CONSTRUCTION | `state.pieces.find((p) => p.id === state.ball.carrierId)` — unfiltered by-id resolution, correct                                                                                                      |
| 6   | `offside.ts`        | `opposingPiecesEqualOrAhead` (line 141-148)                       | OCCUPANCY      | OCCUPANCY    | `if (!isActivePiece(opp)) return false;` — filtered by 42-16                                                                                                                                          |
| 7   | `offside.ts`        | `evaluateOffside` — `piecesById` map (line 198)                   | CONSTRUCTION   | CONSTRUCTION | `new Map(state.pieces.map((p) => [p.id, p] as const))` — annotated `// BUG-38 audit:` comment (42-16), correct: downstream `stillFlagged` check filters at point of use                               |
| 8   | `offside.ts`        | `evaluateOffside` — `stillFlagged` filter (line 200-206)          | OCCUPANCY      | OCCUPANCY    | `if (!isActivePiece(piece)) return false;` — filtered by 42-16 (not a literal `pieces.*` grep hit — filters `priorFlagged`, an id array — but independently re-verified by reading the function body) |
| 9   | `offside.ts`        | `evaluateOffside` — `newlyFlagged` filter (line 209-211)          | OCCUPANCY      | OCCUPANCY    | `state.pieces.filter((p) => isActivePiece(p) && ...)` — filtered by 42-16                                                                                                                             |
| 10  | `offside.ts`        | `triggerOffsideFoul` — `offender` by-id lookup (line 263)         | CONSTRUCTION   | CONSTRUCTION | `state.pieces.find((p) => p.id === offenderId)` — annotated `// BUG-38 audit:` comment (42-16), correct                                                                                               |
| 11  | `outOfBounds.ts`    | `resolveThrowInHex` — `isOccupied` `.some` (line 197-200)         | OCCUPANCY      | OCCUPANCY    | `isActivePiece(p as PlayerPiece) && p.position.q === hex.q && p.position.r === hex.r`                                                                                                                 |
| 12  | `passValidator.ts`  | STANDARD `opponentPieces` filter (line 104-106)                   | OCCUPANCY      | OCCUPANCY    | `p.teamId !== piece.teamId && isActivePiece(p)`                                                                                                                                                       |
| 13  | `passValidator.ts`  | HIGH/LONG adjacent-blocker `opponentPieces` filter (line 114-116) | OCCUPANCY      | OCCUPANCY    | `p.teamId !== piece.teamId && isActivePiece(p)`                                                                                                                                                       |
| 14  | `passValidator.ts`  | LONG `ownTeammates` filter (line 135-137)                         | OCCUPANCY      | OCCUPANCY    | `isActivePiece(p) && p.teamId === piece.teamId && p.id !== piece.id` — filtered by 42-16                                                                                                              |
| 15  | `passValidator.ts`  | LONG `opponents` filter (line 141)                                | OCCUPANCY      | OCCUPANCY    | `isActivePiece(p) && p.teamId !== piece.teamId` — filtered by 42-16                                                                                                                                   |
| 16  | `passValidator.ts`  | `destDefender` lookup (line 157-166)                              | OCCUPANCY      | OCCUPANCY    | `p.teamId !== piece.teamId && isActivePiece(p) && p.position.q === to.q && p.position.r === to.r`                                                                                                     |
| 17  | `passValidator.ts`  | `rollIntercepts` `opponents` filter (line 176)                    | OCCUPANCY      | OCCUPANCY    | `p.teamId !== piece.teamId && isActivePiece(p)`                                                                                                                                                       |
| 18  | `shotValidator.ts`  | `gk` and `carrier` by-id lookups (line 152-153)                   | CONSTRUCTION   | CONSTRUCTION | `state.pieces.find((p) => p.id === gkId)` / `...carrierId)` — unfiltered by-id resolution inside `computeGkDiveAtFeetTargetHexes`, correct                                                            |
| 19  | `stoppagePhases.ts` | `maxOnPitchFor` — `redCardCount` filter (line 76)                 | DELIBERATE     | DELIBERATE   | `pieces.filter((p) => p.teamId === teamId && p.redCarded === true)` — MUST stay unfiltered (SUB-06/D-08 counts dismissed pieces intentionally)                                                        |

**Result: 19/19 rows classified, zero unclassified, zero ACTUAL-vs-EXPECTED contradictions, zero new findings outside the baseline.** No file scanned by the enumeration greps was left un-visited: `fouls.ts`, `moveValidator.ts`, `offside.ts`, `outOfBounds.ts`, `passValidator.ts`, `shotValidator.ts`, `stoppagePhases.ts` — every `.ts` file under `packages/shared/src` matching either grep pattern is represented above. `offside.ts` — the file item 4's original written scope never named — is fully represented (rows 6-10) and fully closed.

Since every row's ACTUAL class matched its EXPECTED class with no gaps, none of Task 1's inline-fix policy conditions were triggered (the policy only applies to a NEW site not in the baseline). No source file was modified by this plan.

## Raw-Flag Contract Check

Command: `grep -rn "redCarded\|onPitch" packages/shared/src --include=*.ts | grep -v "\.test\.ts" | grep -v "^\s*\*"`

Full output (17 lines):

```
./fouls.ts:219:    // (onPitch === false) piece, which the original inline check did not.
./stoppagePhases.ts:72: * in `state.pieces` (with `redCarded: true`), so this count is unaffected by the
./stoppagePhases.ts:76:  const redCardCount = pieces.filter((p) => p.teamId === teamId && p.redCarded === true).length;
./stoppagePhases.ts:87: * never spliced out of `state.pieces` (see `PlayerPiece.onPitch`'s own field comment in
./stoppagePhases.ts:92: * Both `redCarded` and `onPitch` are checked, not either alone: gameEngine.ts's
./stoppagePhases.ts:93: * booking-resolution red-card branch sets `redCarded: true` and `onPitch: false`
./stoppagePhases.ts:95: * TODAY — but `onPitch` is documented as an independently-settable client-rendering
./stoppagePhases.ts:99: * Hand-writing `p.redCarded !== true` inline at a call site is the exact bug class
./stoppagePhases.ts:106:  return piece.redCarded !== true && piece.onPitch !== false;
./types.ts:63:  redCarded?: boolean;
./types.ts:67:   * once a piece has been dismissed (redCarded) — the client stops rendering it, but `position`
./types.ts:70:   * redCarded piece: it is kept in `state.pieces` rather than spliced out, and movement/
./types.ts:72:   * flag is a pure client-rendering signal, independent of `redCarded`'s rules meaning — do not
./types.ts:76:  onPitch?: boolean;
./types.ts:83:   * `buildSquadPieces` populates it (plan 40-04). Explicitly NOT `onPitch` — see that
./types.ts:98: * - `'redCarded'` — D-13: a sent-off player, shown on the bench so the roster screen
./types.ts:101: *   `redCarded: true`, `onPitch: false`) — this bench entry is a display mirror, not a
./types.ts:105:export type BenchEntryStatus = 'available' | 'subbedOut' | 'redCarded';
./types.ts:122:   * 'redCarded'` remains sufficient on its own to derive a red card, so `yellowCards` on
./types.ts:1764:   * lineup/bench split and appended to (in place, `status: 'redCarded'`) when a red card
```

Line-by-line accounting: 1 comment (`fouls.ts:219`), 8 lines inside `stoppagePhases.ts` (the predicate's own definition plus its documenting comments, including `maxOnPitchFor`'s deliberate `redCardCount` filter), 10 lines inside `types.ts` (the `redCarded`/`onPitch` field declarations, `BenchEntryStatus` type, and their doc comments). **Zero** remaining raw `redCarded`/`onPitch` references exist as a live filter clause anywhere else in `packages/shared/src` — every OCCUPANCY row in the audit table above resolves through `isActivePiece(...)`, never a hand-written comparison.

## Server/Client Regression Tripwire

| Site                                         | Command                                                              | Threshold                                                | Actual                                                                                 | Status |
| -------------------------------------------- | -------------------------------------------------------------------- | -------------------------------------------------------- | -------------------------------------------------------------------------------------- | ------ |
| `packages/server/src/gameEngine.ts`          | `grep -c "isActivePiece" packages/server/src/gameEngine.ts`          | `>= 60` (from `42-VERIFICATION.md` line 69)              | 60                                                                                     | PASS   |
| `packages/server/src/gameHandlers.ts`        | `grep -c "isActivePiece" packages/server/src/gameHandlers.ts`        | non-zero; 7 named lines resolve to `isActivePiece` usage | 10; lines 1096, 1176, 1305, 2389, 2613, 2691, 2790 all confirmed present via `grep -n` | PASS   |
| `packages/client/src/components/HexGrid.tsx` | `grep -c "isActivePiece" packages/client/src/components/HexGrid.tsx` | non-zero                                                 | 25                                                                                     | PASS   |

Automated verify command from Task 1 (comment-stripped `isActivePiece` counts):

```
node -e "..." → { off: 5, pv: 12, mv: 8 }
exit code: 0
```

`off >= 4` (5 ✓), `pv >= 7` (12 ✓), `mv >= 3` (8 ✓) — all thresholds exceeded.

## Whole-Repo Quality Gate

| #   | Command                                                     | Verdict                                      | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| --- | ----------------------------------------------------------- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | `pnpm --filter @counter-attack/shared build`                | ✓ PASS (exit 0)                              | `tsc` clean                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| 2   | `pnpm -r typecheck`                                         | ✓ PASS (exit 0)                              | shared/server/client all clean                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| 3   | `pnpm --filter @counter-attack/shared test -- --pool=forks` | ✓ PASS (exit 0)                              | 879 passed (17 test files)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| 4   | `pnpm --filter @counter-attack/server test -- --pool=forks` | ✓ PASS (exit 0 on 2nd run)                   | Run 1: known vitest worker-crash flake — "Worker exited unexpectedly" (Unhandled Error), 60/61 test files completed (1 file's worker crashed before reporting), 1496 passed / 1 skipped / 1 todo. Run 2 (immediate rerun, same command, no source change): 61/61 test files passed clean, 1505 passed / 1 skipped / 1 todo (1507 total). Diagnosed as (b) the documented flake, not (a) a genuine regression — confirmed by the clean rerun with zero source or test changes between runs.                                                                                                                                                                                                                                                                   |
| 5   | `pnpm --filter @counter-attack/client test -- --pool=forks` | ✓ PASS (exit 0)                              | 1116 passed (37 test files)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| 6   | `pnpm lint`                                                 | ✓ PASS via documented fallback               | Whole-workspace run fails with the pre-existing `packages/shared` typescript-eslint file-count-cap parsing error (`Too many files (>8) have matched the default project`) — same class of failure documented in `42-15-SUMMARY.md`/`.planning/phases/32-code-cleanup/deferred-items.md`, unrelated to this round's (zero) changes. Fallback: `npx eslint packages/shared/src/offside.ts packages/shared/src/offside.test.ts packages/shared/src/passValidator.ts packages/shared/src/passValidator.test.ts` — exit 0, zero output (clean).                                                                                                                                                                                                                   |
| 7   | `pnpm format:check`                                         | ✗ FAIL (exit 1) — pre-existing, out of scope | 12 files flagged: 2 `.planning/debug/resolved/*.md`, 1 `.planning/quick/*` plan doc, `packages/client/index.html`, 5 `packages/client/src/**/*.{module.css,css}`, `packages/client/src/components/CardInjuryBadge.audit.test.ts`, `packages/server/src/__tests__/gameEngine.teamselect.test.ts`, `packages/server/src/__tests__/kickoffDebug.test.ts`. None of these 12 files are among the four files 42-16 modified (`passValidator.ts`, `passValidator.test.ts`, `offside.ts`, `offside.test.ts`) — independently confirmed via `git log --stat` on 42-16's two commits. Scoped re-check (`npx prettier --check` on 42-16's four files only) passes clean. Per the Scope Boundary rule, this pre-existing, out-of-scope debt is recorded here, not fixed. |
| 8   | `pnpm stylelint`                                            | ✓ PASS (exit 0)                              | zero output                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| 9   | `pnpm knip`                                                 | ✓ PASS (exit 0)                              | shared build + knip clean, zero unused-export/file findings                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| 10  | `pnpm --filter @counter-attack/client check-contrast`       | ✓ PASS (exit 0)                              | "all 12 teams clear AA thresholds (text >= 4.5, ui >= 3)"                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |

**`git diff --stat` confirms zero files changed by this plan** — both tasks produced only this SUMMARY.md as output; no test expectation anywhere was edited, and command 7's failure is unrelated pre-existing debt (see row 7 above), not something introduced or masked by this round.

**Test count deltas (this round):**

| Package                  | Before (post-42-16, per this round's first run)                   | After (post-42-17)                            | Delta                |
| ------------------------ | ----------------------------------------------------------------- | --------------------------------------------- | -------------------- |
| `@counter-attack/shared` | 879 passed                                                        | 879 passed                                    | 0 (no source change) |
| `@counter-attack/server` | 1505 passed / 1 skipped / 1 todo (1507 total, on the clean rerun) | 1505 passed / 1 skipped / 1 todo (1507 total) | 0 (no source change) |

## Verification Gap Closure

Quoting `42-VERIFICATION.md` lines 45-48 verbatim:

1. **"Apply isActivePiece to passValidator.ts's LONG landing-restriction ownTeammates/opponents filters (mirrors the WR-01 fix already proposed in 42-REVIEW.md)."**
   **Status: CLOSED.** Closed by plan **42-16**, Task 1, commit `13772f3c`. Evidence: `passValidator.ts:135-144` — the LONG landing-restriction `ownTeammates` filter now leads with `isActivePiece(p) &&` (line 136) and the `opponents` filter likewise (line 141). Re-verified in this plan's audit table row 14/15 (both classified OCCUPANCY, ACTUAL matches EXPECTED). Regression coverage: `passValidator.test.ts` grew from 34 to 39 tests, all passing (confirmed in this round's gate command 3: 879 shared tests total, all green).

2. **"Apply isActivePiece to offside.ts's opposingPiecesEqualOrAhead opponent filter, and add redCarded/onPitch:false regression coverage to offside.test.ts."**
   **Status: CLOSED.** Closed by plan **42-16**, Task 2, commit `54541335`. Evidence: `offside.ts:141-148` — `opposingPiecesEqualOrAhead`'s `.filter` callback now starts with `if (!isActivePiece(opp)) return false;` (line 144). Re-verified in this plan's audit table row 6 (OCCUPANCY, ACTUAL matches EXPECTED). Regression coverage: `offside.test.ts` grew from 8 to 19 tests, all passing (confirmed in this round's gate command 3).

3. **"Re-run the D-10 item 4 whole-shared-package grep audit with explicit inclusion of offside.ts, since the original audit scope (per 42-CONTEXT.md/42-05-PLAN.md) never named this file."**
   **Status: CLOSED.** Closed by **this plan (42-17)**, Task 1. Evidence: the `## Shared-Package Piece-List Audit` section above — both enumeration greps were run against the whole of `packages/shared/src` with no file exclusions beyond `*.test.ts`, `offside.ts` is fully represented (audit table rows 6-10), and zero unclassified or new-finding rows exist. This closes the audit scope hole permanently: any future site in `packages/shared` matching either enumeration grep pattern will surface in a re-run of the same two commands.

**All three `missing:` items from `42-VERIFICATION.md` are now CLOSED.**

## Decisions Made

- No inline fix was applied in Task 1: the exhaustive re-audit found zero sites outside the 19-row baseline, and every baseline row's ACTUAL classification matched its EXPECTED classification (all already fixed by 42-16 or earlier plans). The inline-fix policy's four conditions (new site, inside `packages/shared/src`, OCCUPANCY class, single-conjunct fix) were never triggered because there was no new site to evaluate them against.
- Gate command 7 (`pnpm format:check`)'s failure is recorded as a genuine but out-of-scope pre-existing issue rather than silently patched. Per the Scope Boundary rule ("Only auto-fix issues DIRECTLY caused by the current task's changes"), and since none of the 12 flagged files were touched by 42-16 or this plan, fixing them here would be scope creep into unrelated formatting debt spanning `.planning/` docs, `packages/client` CSS/HTML, and two unrelated server test files.

## Deviations from Plan

None — plan executed exactly as written. Both tasks matched their described `<action>` blocks. No Rule 1-4 deviations were required or applied; the audit found zero new findings, so the plan's own narrow inline-fix exception was correctly never invoked.

## Issues Encountered

- The worktree had no `node_modules` (fresh worktree, same pattern documented in `42-05-SUMMARY.md`/`42-16-SUMMARY.md`). Ran `pnpm install --frozen-lockfile` before any gate command could succeed. Not a plan deviation — infrastructure setup only.
- `pnpm --filter @counter-attack/server test -- --pool=forks` hit the documented recurring "Worker exited unexpectedly" vitest flake on its first run (60/61 test files completed). Per the plan's explicit instruction, re-ran the identical command with no source changes; the second run completed all 61 test files clean (1505 passed / 1 skipped / 1 todo). Both runs are recorded in the Whole-Repo Quality Gate table above.
- `pnpm lint` failed on the whole workspace due to the pre-existing `packages/shared` typescript-eslint file-count-cap parsing error (documented precedent in `42-15-SUMMARY.md` and `.planning/phases/32-code-cleanup/deferred-items.md`). Used the plan's documented fallback (`npx eslint` scoped to the four BUG-38 files) — exit 0, clean.
- `pnpm format:check` failed on 12 pre-existing, out-of-scope files (see gate table row 7). Confirmed none are among 42-16's four touched files, confirmed those four files are independently clean via a scoped `prettier --check`. Recorded as pre-existing, out-of-scope debt per the Scope Boundary rule; not fixed in this plan.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- D-10 item 4's audit is now closed for the WHOLE `packages/shared` package by enumeration, not by suspicion — `offside.ts` is explicitly represented and fully closed. Any future site matching either enumeration grep pattern will surface in a straightforward re-run of the two commands documented above.
- All three `42-VERIFICATION.md` `missing:` items are closed with named evidence (plan, commit, and re-verified audit row for each).
- The repository is green on every gate command except the pre-existing, out-of-scope `format:check` failure (12 unrelated files, none touched by 42-16 or this plan) and the known, re-confirmed vitest worker-crash flake on the server suite's first run (resolved clean on rerun).
- No source file needed a fix in this round — BUG-38's shared-package scope is fully closed as of 42-16 and independently re-confirmed here.

## Next Step

Run `/gsd-verify-phase 42` to re-score Success Criterion 5 — this plan closes all three `missing:` items `42-VERIFICATION.md` recorded against it, with re-verified evidence (not merely cited from 42-16's own SUMMARY) for each.

## Known Stubs

None.

## Threat Flags

None — this plan modified no source file, introduced no new network endpoint, auth path, file access pattern, or schema change. All work is read-only audit/verification against the existing `threat_model`'s T-42-65 through T-42-68 mitigations (each independently re-confirmed: T-42-65 via the 19-row enumerated table with ACTUAL column, T-42-66 via the empty `git diff --stat`, T-42-67 via the regression tripwire table, T-42-68 via both recorded server-suite runs).

## Self-Check: PASSED

- FOUND: `.planning/phases/42-substitution-ux-overhaul/42-17-SUMMARY.md` (this file)
- CONFIRMED: `git diff --stat` empty — no source file modified by this plan
- CONFIRMED: `grep -c "isActivePiece" packages/server/src/gameEngine.ts` = 60 (threshold `>= 60` met)
- CONFIRMED: `grep -c "isActivePiece" packages/server/src/gameHandlers.ts` = 10 (non-zero)
- CONFIRMED: `grep -c "isActivePiece" packages/client/src/components/HexGrid.tsx` = 25 (non-zero)
- CONFIRMED: Task 1 automated verify command exits 0 with `{ off: 5, pv: 12, mv: 8 }`
- CONFIRMED: shared test suite 879/879 passed; server test suite 1505 passed/1 skipped/1 todo (clean rerun); client test suite 1116/1116 passed

---

_Phase: 42-substitution-ux-overhaul_
_Completed: 2026-08-23_
