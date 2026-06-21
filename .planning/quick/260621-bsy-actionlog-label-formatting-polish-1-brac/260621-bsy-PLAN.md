---
phase: quick-260621-bsy
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - packages/client/src/components/ActionLog.tsx
autonomous: false
requirements: [QUICK-ACTIONLOG-LABELS]

must_haves:
  truths:
    - 'MOVE-event log prefixes read [MOVE 4] / [MOVE 5] / [MOVE 2], matching the scoreboard phase label'
    - 'The move-sequence change header reads [MOVE 4] -> [MOVE 5] (not [TURN] ATTACKER_4 -> DEFENDER_5) with each bracketed slot colored by the team owning that slot'
    - "The deflect (DEFLECT_ATTEMPT) log entry is spelled out with the defender's number + name and a clear, labeled roll breakdown"
  artifacts:
    - path: 'packages/client/src/components/ActionLog.tsx'
      provides: 'Scoreboard-matching MOVE-slot labels, colored move-sequence header, clarified deflect entry'
      contains: 'MOVE 4'
  key_links:
    - from: 'ActionLog.tsx SLOT_PREFIX / moveSlotLabel'
      to: 'GameBoard.tsx MOVE_SLOT_SUFFIX convention (4/5/2)'
      via: 'shared MOVE-slot numbering'
      pattern: 'MOVE 4'
---

<objective>
Polish three ActionLog formatting details so the match log uses the same player-facing
naming the scoreboard locked in Phase 18, and rewrite the unclear deflect entry.

Purpose: Bracketed log prefixes currently expose internal enum-ish labels
(`[MOVE_A4]`, `[TURN] ATTACKER_4 → DEFENDER_5`) that don't match the scoreboard's
`MOVE 4` / `MOVE 5` / `MOVE 2` convention, and the DEFLECT_ATTEMPT entry is terse and
unclear. This pass aligns all three with the established spelled-out, named-player style.

Output: Updated `packages/client/src/components/ActionLog.tsx`.

NOTE: This file was already modified by three earlier quick tasks today (260621-awb,
260621-b8f). All task actions below are written against the file's CURRENT content
(verified in planning), not the literal examples in the source todos.
</objective>

<execution_context>
@$HOME/.claude/gsd-core/workflows/execute-plan.md
@$HOME/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@packages/client/src/components/ActionLog.tsx
@packages/client/src/components/GameBoard.tsx
@packages/shared/src/types.ts

# Scoreboard naming convention to match (GameBoard.tsx):

# PHASE_LABEL.MOVE = 'MOVE' (lines 18-53)

# MOVE_SLOT_SUFFIX = { ATTACKER_4: ' 4', DEFENDER_5: ' 5', ATTACKER_2: ' 2' } (lines 56-60)

# phaseLabel = PHASE_LABEL.MOVE + moveSlotSuffix(slot) → e.g. "MOVE 4" (line 162)

#

# ActionLog.tsx current state (verified):

# SLOT_PREFIX (lines 88-92): { ATTACKER_4:'[MOVE_A4]', DEFENDER_5:'[MOVE_D5]', ATTACKER_2:'[MOVE_A2]' }

# MOVE event uses SLOT_PREFIX in consolidateEvents (line 130) and formatEvent (line 229)

# SLOT_ADVANCE case (lines 234-240): prefix '[TURN]', content ` ${event.from} → ${event.to ?? 'END'}`, prefixColor null

# DEFLECT_ATTEMPT case (lines 249-266): prefix '[DEFLECT ✓/✗]', uses <P prefix="D"/> (number only), "(Set {band}) — die:{die}[+{tackling}={total}]"

# DEFLECT_ATTEMPT event fields (types.ts 202-210): defenderId, band:'A'|'B', die, tackling, result:'DEFLECTED'|'NO_DEFLECT'

# SLOT_ADVANCE event fields (types.ts line 101): from:MovementSlot, to:MovementSlot|null

# Helpers available: pieceColorOf(pieceId), PNamed (renders "{prefix} {num} {Name}"), pieceNum

</context>

<tasks>

<task type="auto">
  <name>Task 1: Add shared moveSlotLabel helper and align MOVE prefixes + move-sequence header to scoreboard naming</name>
  <files>packages/client/src/components/ActionLog.tsx</files>
  <action>
Add a module-level helper `moveSlotLabel(slot)` near `SLOT_PREFIX` (around lines 88-92) that
maps each `MovementSlot` to the scoreboard-matching number: `ATTACKER_4 -> '4'`,
`DEFENDER_5 -> '5'`, `ATTACKER_2 -> '2'` (mirrors GameBoard.tsx's `MOVE_SLOT_SUFFIX`, the
canonical source). Return the trimmed digit (no leading space) so callers control bracketing.

Replace the `SLOT_PREFIX` map values so MOVE-event prefixes match the scoreboard `MOVE N`
convention: `ATTACKER_4 -> '[MOVE 4]'`, `DEFENDER_5 -> '[MOVE 5]'`, `ATTACKER_2 -> '[MOVE 2]'`.
Define `SLOT_PREFIX` in terms of `moveSlotLabel` (e.g. value = `[MOVE ${moveSlotLabel(slot)}]`)
so the two never drift. The `'[MOVE]'` neutral fallback used at lines 130 and 229 stays unchanged.

Rewrite the `SLOT_ADVANCE` case (currently lines 234-240) so the move-sequence header reads
`[MOVE 4] -> [MOVE 5]` instead of `[TURN] ATTACKER_4 → DEFENDER_5`. Requirements:

- Each `[MOVE N]` segment is its OWN bracketed token colored by the team that owns that slot.
  Determine the owning team color from the slot: `ATTACKER_4` and `ATTACKER_2` are the
  attacking team; `DEFENDER_5` is the defending team. Source the team primary colors the same
  way the rest of the file derives colors — use `pieceColorOf` with a representative piece id
  for the owning positional side, OR read `selectedTeams` via the existing
  `useGameStore.getState().gameState` pattern already used by `pieceColorOf`; pick whichever
  is cleaner given a slot has no single pieceId. (A small local helper
  `slotTeamColor(slot)` returning the attacker-vs-defender color is acceptable.)
- Render content as a fragment: the `from` segment in its team color, a neutral `->`
  separator, then the `to` segment in ITS team color. When `event.to` is `null`, render the
  trailing token as `[END]` in a neutral color (preserve the existing END semantics).
- Since each slot token now carries its own inline color, set the top-level `prefix` to a
  neutral, non-slot marker so the leading colored `prefix` span doesn't double-render a slot.
  Use an empty/neutral prefix (e.g. `prefix: ''` with `prefixColor: null`) and put BOTH
  `[MOVE N]` tokens inside `content`, OR keep a neutral `[SEQ]`-style prefix — choose the
  option that keeps both move tokens individually team-colored within `content`. Do NOT
  leave a `[TURN]` prefix that visually competes with the colored move tokens.

Do not place fenced code in the file beyond normal TSX. Keep all other event branches untouched.
</action>
<verify>
<automated>cd packages/client && pnpm exec tsc --noEmit -p tsconfig.json</automated>
</verify>
<done>
SLOT_PREFIX yields `[MOVE 4]` / `[MOVE 5]` / `[MOVE 2]`; `moveSlotLabel` exists and is the
single source for the digit. SLOT_ADVANCE renders two independently team-colored `[MOVE N]`
tokens with a neutral separator (and `[END]` when `to` is null), no surviving `[TURN]`/raw
`ATTACKER_4` text. TypeScript compiles with no errors.
</done>
</task>

<task type="auto">
  <name>Task 2: Rewrite the DEFLECT_ATTEMPT log entry for clarity</name>
  <files>packages/client/src/components/ActionLog.tsx</files>
  <action>
Rewrite the `DEFLECT_ATTEMPT` case (currently lines 249-266) to follow the spelled-out,
named-player conventions established in Phase 18 and the recent quick tasks (named players via
`PNamed`, clear labeled roll math — same spirit as `fmtStatRoll` used elsewhere).

Current entry renders `[DEFLECT ✓] D7 (Set A) — die:4+3=7` using `<P prefix="D"/>` (number
only) and a cryptic `(Set {band})` / `die:` breakdown. Replace with a clearer entry:

- Keep the success/fail prefix but make it human-readable: e.g. `[DEFLECT ✓]` /
  `[DEFLECT ✗]` (tied to `event.result === 'DEFLECTED'`), `prefixColor` = defender's team
  color via `pieceColorOf(event.defenderId)` (unchanged).
- Use `PNamed` (number + spelled-out name) for the defender, with `prefix="D"`, replacing the
  number-only `P`.
- Spell out the outcome in words: deflected vs not deflected (e.g. "deflected the shot" /
  "failed to deflect").
- Make the roll math explicit and labeled rather than `die:4+3=7`. The event carries `die`,
  `tackling`, and `band` ('A' or 'B'). Preserve the EXISTING rule the current code encodes:
  the tackling bonus is added only when `band === 'A' && die < 5` (the total is then
  `die + tackling`); otherwise the result is the bare `die`. Express this clearly — for the
  bonus case show a labeled breakdown (e.g. `die {die} + Tackling {tackling} = {total}`); for
  the no-bonus case show the plain die (e.g. `die {die}`). Replace the raw `(Set {band})`
  token with a clearer phrasing of which set/band applied (spell out what band A vs B means in
  plain terms, e.g. "close range (Set A)" vs "long range (Set B)" — keep it short; if the
  precise band meaning is uncertain, retain "Set A"/"Set B" but move it into readable prose
  rather than a bare parenthetical). Do NOT silently drop the band — it must remain visible.

Keep `isGoal: false`. Touch no other event branch.
</action>
<verify>
<automated>cd packages/client && pnpm exec tsc --noEmit -p tsconfig.json</automated>
</verify>
<done>
DEFLECT_ATTEMPT entry uses `PNamed` (number + name), states the deflect outcome in words,
shows a labeled roll breakdown that preserves the `band === 'A' && die < 5` tackling-bonus
rule, and keeps the band visible in readable prose. TypeScript compiles with no errors.
</done>
</task>

</tasks>

<verification>
- `cd packages/client && pnpm exec tsc --noEmit -p tsconfig.json` passes (no type errors).
- Grep confirms no remaining `[MOVE_A4]` / `[MOVE_D5]` / `[MOVE_A2]` literals and no `[TURN]`
  prefix on the SLOT_ADVANCE branch:
  `grep -nE "MOVE_A4|MOVE_D5|MOVE_A2|'\[TURN\]'" packages/client/src/components/ActionLog.tsx` returns nothing.
- Grep confirms scoreboard-matching labels exist:
  `grep -n "MOVE 4" packages/client/src/components/ActionLog.tsx` returns a match.
- Manual smoke (optional, post-merge): trigger a MOVE, a slot advance, and a snapshot deflect
  in a local game; confirm the log shows `[MOVE 4] ...`, `[MOVE 4] -> [MOVE 5]` with two team
  colors, and a clear deflect line.
</verification>

<success_criteria>

- All MOVE-event log prefixes read `[MOVE 4]` / `[MOVE 5]` / `[MOVE 2]` (scoreboard-matching).
- The move-sequence header renders `[MOVE 4] -> [MOVE 5]` (and `[MOVE N] -> [END]` at sequence
  end) with each `[MOVE N]` token colored by its owning team; no `[TURN] ATTACKER_4` text remains.
- The DEFLECT_ATTEMPT entry is spelled out (defender number + name, worded outcome, labeled
  roll math, visible band) following Phase 18 conventions.
- TypeScript compiles; no other event branches changed.
  </success_criteria>

<output>
Create `.planning/quick/260621-bsy-actionlog-label-formatting-polish-1-brac/260621-bsy-SUMMARY.md` when done.
</output>
