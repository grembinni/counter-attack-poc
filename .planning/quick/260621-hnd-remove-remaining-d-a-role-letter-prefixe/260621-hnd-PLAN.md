---
phase: quick-260621-hnd
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - packages/client/src/components/ActionLog.tsx
  - packages/client/src/components/ActionLog.test.tsx
autonomous: true
requirements: []
---

<objective>
Finish the D/A role-letter cleanup in the ActionLog by removing the four remaining
`prefix` props that still render a leading "D"/"A" role letter (DEFLECT_ATTEMPT,
STEAL_ATTEMPT x2, uncontested HEADER), and fix the SNAPSHOT case which is the only
place in `formatEvent` that leaks a raw piece-id string (literal "home-N"/"away-N")
into rendered log text instead of resolving a real player name.

Purpose: Two prior quick tasks (260621-gcu, 260621-bsy) cleaned D/A from TACKLE_ATTEMPT,
contested HEADER, and GOAL. The user has now asked to remove ALL remaining D/A role
letters AND any remaining "home"/"away" leaks in visible log text. This plan closes
that out.

Output: Updated ActionLog.tsx (no D/A role letters in duel/header log lines, SNAPSHOT
shows a resolved player name) plus updated/added test coverage. No type changes, no
shared-package rebuild.
</objective>

<execution_context>
@$HOME/.claude/gsd-core/workflows/execute-plan.md
@$HOME/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@packages/client/src/components/ActionLog.tsx
@packages/client/src/components/ActionLog.test.tsx

# Confirmed during planning (do NOT re-edit types.ts):

# packages/shared/src/types.ts line 217 — the SNAPSHOT ActionEvent variant's

# `shooterId` is a plain non-nullable `string`. A direct

# `<PNamed pieceId={event.shooterId} />` typechecks cleanly; NO fallback needed.

# Because no types.ts edit is required, NO `packages/shared` rebuild is needed.

</context>

<tasks>

<task type="auto">
  <name>Task 1: Remove the four remaining D/A role-letter prefixes and fix the SNAPSHOT raw-id leak in formatEvent</name>
  <files>packages/client/src/components/ActionLog.tsx</files>
  <action>
Make five edits, all inside the `formatEvent` function. Confirm exact line numbers
when reading (they may have shifted); the surrounding code shapes below are the
reliable anchors.

1. DEFLECT_ATTEMPT case (around line 305): change
   `<PNamed pieceId={event.defenderId} prefix="D" />` to
   `<PNamed pieceId={event.defenderId} />` — remove only the `prefix="D"` prop.

2. STEAL_ATTEMPT case, the `isAutoIntercept` branch (around line 327): change
   `<PNamed pieceId={event.defenderId} prefix="D" />` to
   `<PNamed pieceId={event.defenderId} />` — remove only the `prefix="D"` prop.

3. STEAL_ATTEMPT case, the regular (non-auto-intercept) branch (around line 343):
   change `<PNamed pieceId={event.defenderId} prefix="D" />` to
   `<PNamed pieceId={event.defenderId} />` — remove only the `prefix="D"` prop.

4. HEADER case, the uncontested branch `if (!isContested) { ... }` (around lines
   554-568): change `<PNamed pieceId={contestantId} prefix={rolePrefix} />` to
   `<PNamed pieceId={contestantId} />` — remove the `prefix={rolePrefix}` prop.
   Then DELETE the now-dead const declaration
   `const rolePrefix: 'A' | 'D' = event.attackerId !== null ? 'A' : 'D';`
   (around line 556). Before deleting, scan the ~15 lines of the uncontested
   branch to confirm `rolePrefix` has NO other consumer — it exists solely to feed
   that prop. Leaving it behind WILL fail the pre-commit hook via eslint
   no-unused-vars (this exact mistake has bitten this repo's quick tasks before).
   Leave the sibling `contestantId` and `prefixColor` consts untouched.

5. SNAPSHOT case (around lines 521-527): the `content` is currently the raw
   template string `` ` ${event.shooterId}` `` which renders literal "home-N"/"away-N"
   text. Replace it with the JSX-fragment-with-leading-space idiom used by every
   sibling case (see the GOAL case `<>{' '}<PNamed pieceId={event.scorerId} /> SCORED!</>`
   for the exact style). New content:
   `(<>{' '}<PNamed pieceId={event.shooterId} /></>)`. A direct `<PNamed>` is correct
   here because `shooterId` is non-nullable `string` (confirmed in types.ts) — do NOT
   add an `event.shooterId ?` ternary fallback (that branch is dead and reads as wrong).
   Leave the SNAPSHOT `prefix` and `prefixColor` lines unchanged.

Do NOT touch: the `[GK_KICK_O]` bracket prefix, the `P` component's "GK"/"K"/"O"
role-letter props, or the already-fixed TACKLE_ATTEMPT / contested-HEADER / GOAL cases.
The `PNamed` component's optional `prefix?` param stays as-is (still used nowhere after
this — that's fine, it's an optional param, not an unused variable; do not remove it).
</action>
<verify>
<automated>pnpm -r typecheck</automated>
</verify>
<done>
All four `prefix="D"` / `prefix={rolePrefix}` props are gone; the dead `rolePrefix`
const is deleted; SNAPSHOT renders `<PNamed pieceId={event.shooterId} />`. `pnpm -r typecheck`
passes (confirms the SNAPSHOT direct `<PNamed>` and the deleted const both typecheck,
and that no shared rebuild was needed).
</done>
</task>

<task type="auto">
  <name>Task 2: Update the stale STEAL_ATTEMPT test and add DEFLECT_ATTEMPT / uncontested-HEADER / SNAPSHOT regression coverage</name>
  <files>packages/client/src/components/ActionLog.test.tsx</files>
  <action>
Use the existing `setEventLog([...])` + `render(<ActionLog />)` idiom throughout.
Copy field shapes from neighboring tests of the same event type. Seeded names in the
mock config (cosmos/xolos via `mockMovementState`): `home-9` resolves to "Nicolae Rusu",
`away-0` resolves to "Oliver Walker" (both already used elsewhere in this file).

1. Fix the stale STEAL_ATTEMPT test (around lines 365-383, titled
   "a rolled STEAL_ATTEMPT renders the defender name, the Tackling fmtStatRoll line,
   and the threshold clause"):
   - The assertion `expect(container.textContent).toMatch(/D #\d+\s+\S+/);` is now
     stale (the "D " prefix was removed in Task 1). Change the regex to drop the
     leading `D `: `expect(container.textContent).toMatch(/#\d+\s+\S+/);`
   - The two-line comment above it explaining STEAL_ATTEMPT "keeps its D role prefix
     (out of scope for requirement 1)" is now incorrect — remove it (or replace with
     a one-line note that the D prefix was dropped in quick task 260621-hnd). Keep the
     other two assertions in that test (`Tackling.*=\s*7` and the threshold clause)
     unchanged.

2. Add a new test for the uncontested HEADER branch. Fixture: a HEADER event with
   one side null so `isContested` is false — i.e. `attackerId: 'home-9'`,
   `defenderId: null`, `attackerDie: null`, `defenderDie: null`, plus the aerial/combined
   fields set to null and `result: 'ATTACKER_WIN'`, `timestamp: 0`. (Copy the contested
   HEADER fixture shape from the test around lines 142-155 for the full field list, then
   null out the defender + both dice to trigger the uncontested branch.) Assert:
   - the rendered text contains the contestant's `#<number> <name>` shape:
     `expect(container.textContent).toMatch(/#\d+\s+Nicolae Rusu/);`
   - NO leading role letter immediately precedes the contestant number — be precise so
     the regex can't accidentally match unrelated log text:
     `expect(container.textContent).not.toMatch(/\b[AD] #\d/);`

3. Add a new test for DEFLECT_ATTEMPT (currently no coverage). Fixture: a DEFLECT_ATTEMPT
   event matching the types.ts shape — `defenderId: 'away-1'`, `band: 'A'`, `die: 6`,
   `tackling: 2`, `result: 'DEFLECTED'`, `timestamp: 0`. Assert:
   - the defender renders as `#<number> <name>` with no leading "D ":
     `expect(container.textContent).toMatch(/#\d+\s+\S+/);`
   - no leading role letter: `expect(container.textContent).not.toMatch(/\b[AD] #\d/);`
   - the deflect prefix is present: `expect(container.textContent).toMatch(/\[DEFLECT/);`

4. Add a new test for SNAPSHOT (currently no coverage). Fixture: a SNAPSHOT event with
   `shooterId: 'home-9'`, `timestamp: 0`,
   `ballAfter: { position: { q: 35, r: 13 }, carrierId: 'home-9' }`. Assert:
   - the resolved player NAME renders: `expect(screen.getByText(/Nicolae Rusu/)).toBeDefined();`
   - the raw id string does NOT appear as visible text:
     `expect(container.textContent).not.toMatch(/home-9/);`

Place the new tests in a new `describe(...)` block (e.g. "ActionLog — quick-task
260621-hnd: remaining D/A removal + SNAPSHOT name resolution") near the bottom of the
file, matching the existing describe-block style.
</action>
<verify>
<automated>pnpm --filter @counter-attack/client test -- ActionLog</automated>
</verify>
<done>
The stale STEAL_ATTEMPT regex/comment is corrected; new passing tests cover the
uncontested HEADER branch (name present, no leading role letter), DEFLECT_ATTEMPT
(name present, no leading role letter), and SNAPSHOT (resolved name present, raw id
absent). `pnpm --filter @counter-attack/client test -- ActionLog` passes with all
existing tests still green.
</done>
</task>

</tasks>

<verification>
- `pnpm -r typecheck` passes (no type regressions; SNAPSHOT direct `<PNamed>` typechecks,
  deleted `rolePrefix` const removed cleanly).
- `pnpm --filter @counter-attack/client test -- ActionLog` passes — all prior ActionLog
  tests plus the 3 new tests and the corrected STEAL_ATTEMPT test are green.
- No `packages/shared` rebuild required (no types.ts edits — confirmed during planning).
</verification>

<success_criteria>

- Zero `prefix="D"` / `prefix={rolePrefix}` (role-letter) props remain in ActionLog.tsx's
  formatEvent (verify by grep: no `prefix="D"`, no `prefix={rolePrefix}`).
- The dead `rolePrefix` const is deleted (no eslint no-unused-vars failure at commit).
- SNAPSHOT renders a resolved player name via `<PNamed>`, not a raw "home-N"/"away-N" id.
- All explicitly out-of-scope items untouched: `[GK_KICK_O]`, P-component GK/K/O props,
  TACKLE_ATTEMPT, contested HEADER, GOAL.
- Both verification commands pass.
  </success_criteria>

<output>
Create `.planning/quick/260621-hnd-remove-remaining-d-a-role-letter-prefixe/260621-hnd-SUMMARY.md` when done
</output>
