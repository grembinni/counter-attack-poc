---
phase: quick-260621-awb
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - packages/client/src/components/ActionLog.tsx
  - packages/client/src/components/ActionLog.test.tsx
autonomous: true
requirements: [TODO-NAME, TODO-CHECKX, TODO-STEAL-DETAIL]
must_haves:
  truths:
    - "Every duel log entry (TACKLE_ATTEMPT, STEAL_ATTEMPT, SHOT_ATTEMPT, HEADER) identifies each player as '{number} {Name}' resolved from gameState.pieces, matching the move-log convention"
    - 'Every duel log entry shows a ✓ / ✗ result glyph in its prefix, matching the pass-log convention'
    - 'STEAL_ATTEMPT (intercept) log shows the full defender challenge line (stat + roll + threshold/result), at the same detail level as TACKLE_ATTEMPT'
  artifacts:
    - path: 'packages/client/src/components/ActionLog.tsx'
      provides: 'Unified duel-log rendering: name resolution + ✓/✗ glyphs + full steal detail'
    - path: 'packages/client/src/components/ActionLog.test.tsx'
      provides: 'Tests asserting name + glyph + steal-detail behavior on duel branches'
  key_links:
    - from: 'ActionLog.tsx duel branches'
      to: 'pieceName(pieceId, fallback)'
      via: 'name resolution helper reused from move-log lines'
      pattern: "pieceName\\("
---

<objective>
Make every duel-style ActionLog entry consistent with the existing move-log and pass-log conventions, and bring the STEAL (intercept) entry up to TACKLE's level of detail.

Three pending todos drive this, all touching the same file (packages/client/src/components/ActionLog.tsx):

1. TODO-NAME — duels should identify players as "{number} {Name}" (like move logs use pieceName), not the terse "D7"/"A3" labels the `<P>` component currently renders.
2. TODO-CHECKX — duels should carry a ✓ / ✗ result glyph in their prefix (like `[PASS ✓]`/`[PASS ✗]`). TACKLE (`[TACKLE]`) and SHOT (`[SHOT]`) currently have NO glyph; STEAL and HEADER already do.
3. TODO-STEAL-DETAIL — STEAL_ATTEMPT shows only the defender's stat line, while TACKLE shows a structured, labeled challenge. STEAL carries no carrier-side data in the event (it is a one-sided interception check vs a fixed threshold, NOT a head-to-head duel), so "parity" means presenting the full defender challenge with the same structure and the threshold it was checked against — not fabricating a second contestant.

Purpose: Visual/format consistency across all ActionLog entry types so players read every entry the same way.
Output: Updated ActionLog.tsx render branches + tests.
</objective>

<execution_context>
@$HOME/.claude/gsd-core/workflows/execute-plan.md
@$HOME/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@packages/client/src/components/ActionLog.tsx
@packages/client/src/components/ActionLog.test.tsx
@.planning/todos/pending/2026-06-21-actionlog-duels-should-show-player-number-and-name-like-move.md
@.planning/todos/pending/2026-06-21-actionlog-duels-should-show-check-or-x-result-indicator-like.md
@.planning/todos/pending/2026-06-21-fix-steal-intercept-log-missing-full-challenge-detail.md

# Interface facts (already verified — do NOT re-derive)

# - `pieceName(pieceId, fallback)` resolves "{firstName} {lastName}" from gameState.pieces (ActionLog.tsx ~line 20).

# - `pieceNum(pieceId)` returns the 1-based player number string, e.g. 'home-3' -> '4' (ActionLog.tsx ~line 66).

# - `pieceColorOf(pieceId)` returns the team primary color (ActionLog.tsx ~line 9).

# - `<P pieceId prefix>` renders team-colored bold `{prefix}{pieceNum}` (e.g. "D7") — this is the OLD terse label to replace in duel branches.

# - STEAL_ATTEMPT event fields (shared/src/types.ts ~line 107): defenderId, result ('SUCCESS'|'FAIL'), defenderDie, defenderCombined. NO carrierId / carrierDie / carrierCombined exist.

# - TACKLE_ATTEMPT fields (~line 116): defenderId, carrierId, defenderDie, carrierDie, defenderCombined, carrierCombined, result.

# - SHOT_ATTEMPT fields (~line 177): shooterId, outcome ('GOAL'|'SAVE'|'LOOSE_BALL'), shooterDie, shooterScore (nullable), gkDie, gkScore (nullable), handlingDie, gkHandling, shooterPenaltyTotal, gkPenaltyTotal.

# - HEADER result is 'TIE' | 'ATTACKER_WIN' | 'DEFENDER_WIN'.

# - Steal interception threshold (server gameEngine.ts ~line 1484): intercepted when defenderDie === 6 OR defenderCombined >= 10.

</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Unify duel player names ({# Name}) and add ✓/✗ result glyphs across all four duel branches</name>
  <files>packages/client/src/components/ActionLog.tsx, packages/client/src/components/ActionLog.test.tsx</files>
  <behavior>
    - TACKLE_ATTEMPT: prefix becomes `[TACKLE ✓]` when result==='SUCCESS', `[TACKLE ✗]` when 'FAIL'. Each player rendered as "{number} {Name}" (number from pieceNum, name from pieceName) in team color, replacing the `<P>` "D#"/"A#" terse labels.
    - SHOT_ATTEMPT: prefix becomes `[SHOT ✓]` when outcome==='GOAL', `[SHOT ✗]` otherwise (SAVE/LOOSE_BALL). Shooter rendered as "{number} {Name}". (GK is referenced by stat line, not a piece id in this event — leave GK textual reference as-is.)
    - STEAL_ATTEMPT: keep existing `[INTERCEPT ✓]`/`[INTERCEPT ✗]` glyph (already correct); defender rendered as "{number} {Name}".
    - HEADER: keep existing `[HEADER ✓]`/`[HEADER ✗]`/`[HEADER ~]` glyphs; each contestant rendered as "{number} {Name}".
    - A duel entry for an unknown pieceId (not in gameState.pieces) falls back to the pieceNum label without throwing.
  </behavior>
  <action>
    Add a small inline helper component named `PNamed` next to the existing `P` component in ActionLog.tsx: it renders, in team color and bold, `{pieceNum(pieceId)} {pieceName(pieceId, pieceNum(pieceId))}` — i.e. the player number followed by the resolved name, falling back to just the number when the piece is unknown (pieceName already handles the fallback via its second arg). Use a single space separator and prepend the role prefix letter ONLY where the existing branch already distinguishes role (keep A/D semantics by passing an optional `prefix` that, when present, renders before the number, e.g. "D 7 Jane Doe"); match the format used in the move-log line (number then name) so all entry types read consistently — number-then-name, team-colored, bold.

    In the four duel branches of formatEvent, replace every `<P pieceId=... prefix=... />` usage with `<PNamed pieceId=... prefix=... />`. Do NOT change the stat/roll content strings (fmtStatRoll output) in this task except where the inline player label was embedded.

    For result glyphs: change the TACKLE_ATTEMPT prefix from the static `'[TACKLE]'` to `event.result === 'SUCCESS' ? '[TACKLE ✓]' : '[TACKLE ✗]'`. Change the SHOT_ATTEMPT prefix from the static `'[SHOT]'` to `event.outcome === 'GOAL' ? '[SHOT ✓]' : '[SHOT ✗]'`. Leave STEAL_ATTEMPT and HEADER prefixes unchanged (they already carry glyphs). Keep prefixColor logic as-is for each branch.

    Update ActionLog.test.tsx: extend the existing duel tests (or add focused new ones) to assert (a) a TACKLE_ATTEMPT entry renders the contestant's resolved name (e.g. the cosmos/xolos squad name for the seeded pieceId, mirroring the existing move-log name assertion at ~line 188) AND a `[TACKLE ✓]` or `[TACKLE ✗]` prefix matching result; (b) a SHOT_ATTEMPT GOAL renders `[SHOT ✓]` and a SAVE/LOOSE_BALL renders `[SHOT ✗]`; (c) the existing fmtStatRoll assertions still pass unchanged. Resolve the actual seeded display names by reading them the same way the existing move-log test does (pieces from mockMovementState) rather than hardcoding a guess — if unsure of the exact name for a given pieceId, assert on a `/\d+\s+\S+/` number-then-name shape near the contestant instead.

  </action>
  <verify>
    <automated>cd packages/client && pnpm vitest run src/components/ActionLog.test.tsx</automated>
  </verify>
  <done>All four duel branches render "{number} {Name}" team-colored labels; TACKLE prefix shows ✓/✗ by result and SHOT prefix shows ✓/✗ by outcome===GOAL; ActionLog.test.tsx passes including new glyph + name assertions and unchanged fmtStatRoll assertions.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Bring STEAL_ATTEMPT (intercept) to TACKLE-parity challenge detail</name>
  <files>packages/client/src/components/ActionLog.tsx, packages/client/src/components/ActionLog.test.tsx</files>
  <behavior>
    - STEAL_ATTEMPT content matches TACKLE's structured shape: leads with the result, an arrow, the defender label ("{number} {Name}"), the full fmtStatRoll defender line, and the interception threshold the defender was checked against (die===6 OR combined>=10), so the entry explains WHY it succeeded/failed — not just the defender's raw numbers.
    - The auto-intercept case (defenderDie===0, defenderCombined===0 — emitted when the destination hex was the defender's hex, no dice rolled) renders as an explicit "auto-intercept (no roll)" detail instead of a misleading "Tackling 0 + 0 - 0 = 0" line.
    - An unknown defender pieceId still renders without throwing.
  </behavior>
  <action>
    Rework the STEAL_ATTEMPT branch in formatEvent so its content structure mirrors TACKLE_ATTEMPT's: `{result} -> {defender PNamed} ({fmtStatRoll line}) — needs die 6 or total >= 10`. Reuse the existing `defStat`/`dStr` computation already present in the branch (defenderCombined - defenderDie for the stat). Append the threshold clause as a short literal string describing the interception success condition (die===6 OR combined>=10) sourced from the server rule already documented in context — present it as directive copy (e.g. "intercept if die 6 or total ≥ 10"), not as a recomputation of the result.

    Guard the auto-intercept case: when `event.defenderDie === 0 && event.defenderCombined === 0`, render content as `{result} -> {defender PNamed} — auto-intercept (no roll)` and SKIP the fmtStatRoll line and threshold clause (those zeros are sentinel "no dice" values from gameEngine.ts ~line 1452, not a real 0-stat roll).

    Do not invent a carrier/second-contestant side — STEAL_ATTEMPT carries no carrier fields; "parity" here is full defender-challenge detail + the threshold, presented in TACKLE's structural shape.

    Update ActionLog.test.tsx: add a test that a rolled STEAL_ATTEMPT (e.g. defenderDie:6, defenderCombined:7, result:'SUCCESS') renders the defender name, the `Tackling ... = 7` fmtStatRoll line, AND the threshold clause text; and a test that an auto-intercept STEAL_ATTEMPT (defenderDie:0, defenderCombined:0, result:'SUCCESS') renders "auto-intercept" and does NOT render a "Tackling 0" line. Keep the existing "STEAL_ATTEMPT renders Tackling and - 0" test green by adjusting it only if the new threshold/auto-intercept wording requires it (the rolled-case Tackling line must still be present).

  </action>
  <verify>
    <automated>cd packages/client && pnpm vitest run src/components/ActionLog.test.tsx</automated>
  </verify>
  <done>Rolled STEAL_ATTEMPT entries show defender name + full fmtStatRoll line + interception threshold in TACKLE's structural shape; auto-intercept (0/0) entries show an explicit no-roll label and omit the bogus 0-stat line; all ActionLog tests pass.</done>
</task>

</tasks>

<verification>
- `cd packages/client && pnpm vitest run src/components/ActionLog.test.tsx` — all green.
- `cd packages/client && pnpm typecheck` (or repo-root typecheck) — clean; no new TS errors from PNamed / prefix changes.
- Visual spot-check intent (not gating): every ActionLog entry type now reads "{number} {Name}" for players and carries a ✓/✗ (or ~) result glyph; STEAL intercept lines read at TACKLE's detail level.
</verification>

<success_criteria>

- TODO-NAME satisfied: TACKLE/STEAL/SHOT/HEADER all render players as "{number} {Name}" via pieceName, matching move logs.
- TODO-CHECKX satisfied: TACKLE and SHOT prefixes now carry ✓/✗; STEAL and HEADER glyphs retained — every duel entry has a result indicator like passes.
- TODO-STEAL-DETAIL satisfied: STEAL intercept shows full defender challenge detail + threshold in TACKLE's structural shape, with the auto-intercept no-dice case handled honestly.
- No fabricated data: STEAL is not given a fake second contestant; the one-sided nature of the interception check is preserved.
- ActionLog.test.tsx passes; typecheck clean.
  </success_criteria>

<output>
Create `.planning/quick/260621-awb-actionlog-duel-format-consistency-1-tack/260621-awb-SUMMARY.md` when done.
</output>
