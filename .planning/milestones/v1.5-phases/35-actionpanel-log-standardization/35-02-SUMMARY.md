---
phase: 35-actionpanel-log-standardization
plan: 02
subsystem: client-ui
tags: [action-log, formatting, glyph-rule, terminology, i18n-consistency]
dependency_graph:
  requires: []
  provides:
    - 'ActionLog.tsx formatEvent single-language/format system (RESULT_LABEL, SHOT_OUTCOME_LABEL, HEADER_RESULT_LABEL)'
    - 'Border-free, single-headed ActionLog panel'
  affects:
    - 'packages/client/src/components/ActionLog.tsx'
    - 'packages/client/src/components/ActionLog.module.css'
    - 'packages/client/src/components/ActionLog.test.tsx'
tech_stack:
  added: []
  patterns:
    - 'Typed Record<union, string> label maps for enum-to-prose narration (compile-time exhaustiveness against shared enums)'
key_files:
  created: []
  modified:
    - packages/client/src/components/ActionLog.tsx
    - packages/client/src/components/ActionLog.module.css
    - packages/client/src/components/ActionLog.test.tsx
decisions:
  - 'GK_KICK''s <P prefix="GK"> changed to prefix="K", matching the GK_KICK_MOVE family''s existing ''K'' kicker-slot abbreviation (D-03)'
  - "HANDLING sub-check glyph is from the keeper's perspective: SAVE (caught) = success glyph, non-SAVE (spilled) = fail glyph (D-04)"
  - "SNAP_DEFLECT_MOVE renamed [DEFLECT] -> [DEFLECT MOVE] to remove a visual collision with DEFLECT_ATTEMPT's outcome-bearing [DEFLECT check/x] prefixes; it remains glyph-free (D-04)"
metrics:
  duration: '~35min'
  completed: '2026-07-27'
---

# Phase 35 Plan 02: ActionLog Language & Format Standardization Summary

Standardized ActionLog.tsx's formatEvent switch to one glyph rule, one arrow glyph, one
casing convention, and one keeper terminology, and removed the log panel's duplicate
internal header and border — closing D-01, D-03, D-04, D-10, D-11, D-12 for the ActionLog
half of the D-05 component set (PANEL-02, PANEL-04).

## What Was Built

**Task 1 — Panel chrome and keeper terminology (D-01/D-03/D-10):**

- Removed the `<div className={styles.panelHeader}>ACTION LOG</div>` duplicate heading from
  `ActionLog.tsx`; `GameBoard.tsx`'s `SideLog` `MATCH LOG` header (unmodified) is now the
  log's single heading.
- Removed the `.panelHeader` CSS rule (now unreferenced) and the `.panel` border declaration
  from `ActionLog.module.css`. `background`, `border-radius`, `padding`, `overflow-y`, and
  `flex-grow` retained unchanged.
- `GK_KICK`'s `<P pieceId={event.gkId} prefix="GK" />` changed to `prefix="K"`, matching the
  `GK_KICK_MOVE` family's existing `'K'` kicker-slot abbreviation.
- `SHOT_ATTEMPT`'s no-duel branch narration `GOAL — GK out of range` changed to
  `Goal — keeper out of range` (this single edit satisfies both D-03's keeper-terminology
  rule and D-11's sentence-case rule, per the plan's explicit instruction).

**Task 2 — Sentence-case narration and unicode arrows (D-11/D-12/D-13):**

- Added three typed module-scope label maps next to `SLOT_PREFIX`:
  - `RESULT_LABEL: Record<'SUCCESS' | 'FAIL', string>` → `{ SUCCESS: 'Success', FAIL: 'Failed' }`
  - `SHOT_OUTCOME_LABEL: Record<'GOAL' | 'SAVE' | 'LOOSE_BALL', string>` →
    `{ GOAL: 'Goal', SAVE: 'Save', LOOSE_BALL: 'Loose ball (tie)' }`
  - `HEADER_RESULT_LABEL: Record<'ATTACKER_WIN' | 'DEFENDER_WIN' | 'TIE', string>` →
    `{ ATTACKER_WIN: 'Attacker wins', DEFENDER_WIN: 'Defender wins', TIE: 'Tie → loose ball' }`
    Typed against the shared union (not `Record<string, string>`) so a future enum addition
    fails typecheck instead of silently rendering a raw/undefined value.
- Replaced every raw `{event.result}` / hardcoded ALL-CAPS interpolation with the appropriate
  label-map lookup: `STEAL_ATTEMPT` (both auto-intercept and rolled branches),
  `TACKLE_ATTEMPT`, `SHOT_ATTEMPT` (both the handling-duel branch and the regular-duel
  branch), and `HEADER` (single `winLabel` const now sourced from the map, used in both the
  uncontested and contested content branches).
- `GOAL` case: `SCORED!` → `Scored!`. `HP_ACCURACY`: `ACCURATE -> CONTESTING HEADER` →
  `Accurate → contesting header`. `GK_KICK`: `ACCURATE`/`inaccurate` → `Accurate`/`Inaccurate`.
- Replaced all six ASCII `-> `/`{' -> '}` arrow sites with the unicode `→` glyph:
  `SLOT_ADVANCE`, `STEAL_ATTEMPT` (both branches), `TACKLE_ATTEMPT`, `SHOT_ATTEMPT` (both
  branches) — one more site than 35-PATTERNS.md's original enumeration (`SLOT_ADVANCE`,
  confirmed during planning).
- D-13 verified untouched: all `${event.from.q},${event.from.r} → ${event.to.q},${event.to.r}`
  raw axial coordinate renderings across MOVE/pass/move-event cases are byte-for-byte
  unchanged from before this plan.

**Task 3 — Glyph rule audit (D-04):**

Audited every case in `formatEvent` (34 rows — 33 switch-case prefixes plus the
`SHOT_ATTEMPT` `HANDLING` sub-kind, which shares the `SHOT_ATTEMPT` case but renders a
separate log entry with its own prefix) against the rule: a genuine binary success/fail
outcome carries `✓`/`✗`; a structural/informational event carries no glyph.

| Event type (case)                | Binary outcome?                 | Prefix before                                        | Prefix after                                      |
| -------------------------------- | ------------------------------- | ---------------------------------------------------- | ------------------------------------------------- |
| MOVE                             | No                              | `[MOVE 4/5/2]`                                       | unchanged                                         |
| SLOT_ADVANCE                     | No                              | `` (empty)                                           | unchanged                                         |
| DICE_ROLL                        | No                              | `[DICE]`                                             | unchanged                                         |
| DEFLECT_ATTEMPT                  | Yes                             | `[DEFLECT ✓]`/`[DEFLECT ✗]`                          | unchanged                                         |
| STEAL_ATTEMPT                    | Yes                             | `[INTERCEPT ✓]`/`[INTERCEPT ✗]`                      | unchanged                                         |
| TACKLE_ATTEMPT                   | Yes                             | `[TACKLE ✓]`/`[TACKLE ✗]`                            | unchanged                                         |
| GOAL                             | No (structural, D-04 exemption) | `[SHOT]`                                             | unchanged                                         |
| KICK_OFF                         | No                              | `[KICK OFF]`                                         | unchanged                                         |
| HALF_TIME_KICKOFF_RESET          | No                              | `[KICK OFF]`                                         | unchanged                                         |
| STANDARD_PASS                    | Yes                             | `[PASS ✓]`/`[PASS ✗]`                                | unchanged                                         |
| FIRST_TIME_PASS                  | Yes                             | `[PASS ✓]`/`[PASS ✗]`                                | unchanged                                         |
| HIGH_PASS                        | Yes (3-state)                   | `[HIGH ✓]`/`[HIGH ✗]`/`[HIGH →]`                     | unchanged                                         |
| LONG_BALL                        | Yes                             | `[LONG ✓]`/`[LONG ✗]`                                | unchanged                                         |
| SHOT_ATTEMPT (duel)              | Yes                             | `[SHOT ✓]`/`[SHOT ✗]`                                | unchanged                                         |
| SHOT_ATTEMPT (HANDLING sub-kind) | Yes                             | `[HANDLING]`                                         | **`[HANDLING ✓]`/`[HANDLING ✗]` — corrected**     |
| SNAPSHOT                         | No                              | `[SNAPSHOT]`                                         | unchanged                                         |
| HALF_TIME                        | No                              | `[HALF TIME]`                                        | unchanged                                         |
| FULL_TIME                        | No                              | `[FULL TIME]`                                        | unchanged                                         |
| HEADER                           | Yes (3-state)                   | `[HEADER ~]`/`[HEADER ✓]`/`[HEADER ✗]`               | unchanged                                         |
| HP_REPOSITION                    | No                              | `[HP ATTACKER/DEFENDER]`                             | unchanged                                         |
| FTP_REPOSITION                   | No                              | `[FTP ATTACKER/DEFENDER]`                            | unchanged                                         |
| HP_ACCURACY                      | Yes                             | `[HIGH ✓]`/`[HIGH ✗]`                                | unchanged                                         |
| LOOSE_BALL_LAND                  | No                              | `[LOOSE BALL]`                                       | unchanged                                         |
| HP_MOVE                          | No                              | `[HIGH PASS MOVE 1]`                                 | unchanged                                         |
| FTP_MOVE                         | No                              | `[FIRST TIME PASS MOVE 1]`                           | unchanged                                         |
| GK_KICK                          | Yes                             | `[KEEPER KICK TARGET ✓]`/`[KEEPER KICK TARGET ✗]`    | unchanged                                         |
| GK_KICK_MOVE                     | No                              | `[KEEPER KICK RESULT]`/`[KEEPER KICK RESPONSE MOVE]` | unchanged                                         |
| HEADED_PASS                      | No                              | `[HEADER PASS]`                                      | unchanged                                         |
| GK_PUNT                          | No                              | `[PUNT]`                                             | unchanged                                         |
| KICK_OFF_SETUP                   | No                              | `[SETUP]`                                            | unchanged                                         |
| SNAP_DEFLECT_MOVE                | No                              | `[DEFLECT]`                                          | **`[DEFLECT MOVE]` — renamed (still glyph-free)** |
| FK_SETUP_MOVE                    | No                              | `[FK]`                                               | unchanged                                         |
| FK_KICKER_CHOSEN                 | No                              | `[FK]`                                               | unchanged                                         |
| FK_STAGE_ADVANCE                 | No                              | `[FK]`                                               | unchanged                                         |

Two corrections applied (both pre-identified by the plan, no additional violations found
during the audit):

1. `[HANDLING]` → `[HANDLING ✓]` (SAVE / caught, keeper success) or `[HANDLING ✗]`
   (spilled, keeper fail). Derived from the same `handlingResult` condition already
   computed in that branch (no double-testing `event.outcome`).
2. `SNAP_DEFLECT_MOVE`'s `[DEFLECT]` → `[DEFLECT MOVE]`. Repositioning event, no outcome —
   stays glyph-free; the rename removes the visual collision with `DEFLECT_ATTEMPT`'s
   outcome-bearing `[DEFLECT ✓]`/`[DEFLECT ✗]` prefixes.

## Commits

| Commit    | Task   | Description                                                         |
| --------- | ------ | ------------------------------------------------------------------- |
| `6468acd` | Task 1 | Remove duplicate log header, panel border, and GK terminology drift |
| `acca1c6` | Task 2 | Convert formatEvent narration to sentence case and unicode arrows   |
| `300dda7` | Task 3 | Correct HANDLING and SNAP_DEFLECT_MOVE glyph-rule violations (D-04) |

## Verification

- `pnpm --filter @counter-attack/client test -- ActionLog`: 40/40 passed (after all 3 tasks;
  29/29 after Task 1 only, 37/37 after Task 1+2 — each intermediate state was independently
  verified green before its commit).
- `pnpm --filter @counter-attack/client test` (full client suite): 431/431 passed.
- `pnpm --filter @counter-attack/client typecheck`: exits 0 (confirms the `Record<union,
string>` label maps are exhaustive against the shared `ActionEvent` enums).
- `pnpm stylelint`: exits 0.
- `pnpm -r build`: exits 0 (shared/client/server all build clean).
- Scoped `eslint` on the two changed source files (`ActionLog.tsx`, `ActionLog.test.tsx`):
  0 issues. The whole-workspace `pnpm lint` (`eslint .`) was **not** run to completion — it
  has a pre-existing, documented OOM on a `packages/shared` typescript-eslint file-count-cap
  config issue unrelated to this plan (see `.planning/phases/32-code-cleanup/deferred-items.md`
  and `PROJECT.md`'s "Known tech debt entering Phase 33" note). Scoped eslint on the modified
  files is used as the substitute signal.
- All plan-specified `grep`-based source assertions pass; see "Acceptance criteria grep
  discrepancies" below for two assertions whose exact expected counts differ from the
  plan's `grep -c` count due to substring-matching artifacts (not functional gaps).

## Deviations from Plan

### Auto-fixed Issues

None — all edits matched the plan's prescribed actions exactly (D-01 through D-13 as
specified). No Rule 1/2/3 auto-fixes were needed.

### Process deviation (commit reconstruction, not a code deviation)

During execution the three tasks' edits were initially applied to the working tree in
sequence without an intermediate commit between tasks (a process slip, not a plan
deviation). Before committing, the original per-task boundaries were reconstructed exactly:
the file was reset to the HEAD version, Task 1's edits were reapplied and independently
verified (test/typecheck/stylelint green) before its commit, then Task 2's edits were
reapplied on top and independently verified before its commit, then Task 3's edits were
reapplied and the resulting file was diffed byte-for-byte against the original
fully-edited/tested version to confirm no drift before its commit. All three commits are
therefore genuinely atomic and each is independently green, matching the intended
task-by-task execution flow.

### Acceptance criteria grep discrepancies (documentation only, not code issues)

Two of the plan's `grep -c` acceptance-criteria patterns return a different count than
literally stated, due to substring-matching artifacts in the grep pattern itself — the
underlying code is correct per the plan's actual intent in both cases:

1. **`grep -c "{event.result}" ActionLog.tsx` returns `1`, not `0`.** The one remaining hit
   is `DICE_ROLL`'s `` ` Rolled ${event.result}` `` — a `number`-typed field (die roll
   result), not the `SUCCESS`/`FAIL` enum the acceptance criteria was targeting. D-12
   explicitly exempts `DICE_ROLL` from the label-map treatment ("no stat+roll+penalty
   triple exists here"). All enum-typed `.result` interpolations (`STEAL_ATTEMPT` x2,
   `TACKLE_ATTEMPT`, `HEADER`) now route through `RESULT_LABEL`/`HEADER_RESULT_LABEL`.
2. **`grep -c "\[DEFLECT MOVE\]"` / `grep -c "\[DEFLECT ✓\]"` each return `2`, not `1`.**
   The second hit in each case is the explanatory code comment added directly above the
   `SNAP_DEFLECT_MOVE` case documenting the D-04 rename rationale (which itself mentions
   both prefixes for context). The functional prefix string itself appears exactly once in
   each case, matching the plan's intent.

No stubs, no threat-surface changes beyond what the plan's threat model already accounted
for (T-35-04 mitigation — label maps closing off raw enum interpolation — is the only
security-relevant change in this plan, and it is fully applied).

## Known Stubs

None.

## Threat Flags

None — this plan only reworded/reformatted client-side log text and removed CSS/JSX; no new
network surface, auth path, or file-access pattern was introduced. T-35-04's mitigation
(closed `Record<union, string>` lookups replacing raw enum interpolation) is fully applied,
matching the plan's threat model.
