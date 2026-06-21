---
phase: quick-260621-ajd
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - packages/client/src/components/GameBoard.module.css
  - packages/client/src/components/KickOffSetupPanel.module.css
  - packages/client/src/components/ActionPanel.tsx
  - packages/client/src/components/ActionPanel.test.tsx
autonomous: true
requirements: [QUICK-ACTIONPANEL-HELPER]

must_haves:
  truths:
    - 'No light-blue/dark-blue outline box surrounds the ActionPanel helper text in the top band'
    - "The kick-off action prompt shows meaningful copy explaining the opening Standard Pass (not just a bare 'Choose Action' label)"
    - "MOVE phase helper text counts down remaining players (e.g. '3 of 4 players left to move') instead of a static total"
    - 'FREE_MOVE_ATTACK / FREE_MOVE_DEFENSE helper text counts down remaining players left to move'
  artifacts:
    - path: 'packages/client/src/components/GameBoard.module.css'
      provides: '.actionSection without the light-blue outline border'
    - path: 'packages/client/src/components/ActionPanel.tsx'
      provides: 'Kick-off helper copy + remaining-player countdown for MOVE and FREE_MOVE phases'
  key_links:
    - from: 'ActionPanel.tsx MOVE branch'
      to: 'gameState.movedPieceIds + movementSlot slotTotal'
      via: 'remaining = slotTotal - movedPieceIds.length'
      pattern: 'movedPieceIds'
    - from: 'ActionPanel.tsx FREE_MOVE branch'
      to: 'gameState.freeMoveEligibleIds + freeMoveUsedPace'
      via: 'remaining = eligible.length - movedCount'
      pattern: 'freeMoveEligibleIds'
---

<objective>
Clean up ActionPanel helper text in two ways: (1) remove the blue outline boxes that surround
the helper text in the GameBoard top band (and give the kick-off prompt meaningful copy), and
(2) convert the MOVE and FREE_MOVE phase helper text from a static "Move up to N players" line
into a live countdown of how many players are left to move.

Purpose: Two pieces of Phase 18 close-out UX feedback — the outline boxes "don't read as needed"
and the static move counts don't reflect progress during a slot.
Output: Updated ActionPanel.tsx + CSS modules, plus countdown/copy test coverage.
</objective>

<execution_context>
@$HOME/.claude/gsd-core/workflows/execute-plan.md
@$HOME/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/todos/pending/2026-06-21-remove-outline-boxes-from-actionpanel-and-kick-off-helper-te.md
@.planning/todos/pending/2026-06-21-show-remaining-player-countdown-in-move-and-free-move-phase-.md
@packages/client/src/components/ActionPanel.tsx
@packages/client/src/components/ActionPanel.module.css
@packages/client/src/components/GameBoard.module.css
@packages/client/src/components/KickOffSetupPanel.module.css
@packages/client/src/components/ActionPanel.test.tsx
</context>

<orientation>
The "light-blue outline box" the user refers to is NOT a rule inside ActionPanel.module.css
(`.helperBlock` has no border). It is the wrapper container border:

- `GameBoard.module.css` `.actionSection` has `border: 1px solid #0f3460` (the dark/light-blue
  outline) plus `background: #16213e` — this is the box around the ActionPanel in the top band.
- `KickOffSetupPanel.module.css` `.panel` has the same `border: 1px solid #0f3460` box (the
  kick-off SETUP panel). The ActionPanel's own `.panel` (ActionPanel.module.css) also has a
  `background: #16213e` fill but no border.

The "kick-off helper text" lives in ActionPanel.tsx: when `phase === 'KICK_OFF'` the chooser
(Step 1, ~line 509) renders only a `.phaseLabel` reading "Choose Action" and a Standard Pass
button — there is currently no `.helperBlock` explaining the kick-off. That bare label is the
copy to improve.

Countdown data sources (already in GameState, no server change needed):

- MOVE phase: `slotTotal` (derived from `movementSlot`: ATTACKER_4=4, DEFENDER_5=5, ATTACKER_2=2)
  is the total; `gameState.movedPieceIds.length` is how many have finished. Remaining =
  `slotTotal - movedPieceIds.length`.
- FREE_MOVE_ATTACK/DEFENSE: `gameState.freeMoveEligibleIds.attack` / `.defense` (array) is the
  eligible total for the active sub-phase; `gameState.freeMoveUsedPace` (Record<pieceId,number>)
  keys are pieces that have moved. Remaining = eligible.length minus count of eligible ids that
  appear as keys in freeMoveUsedPace.
  </orientation>

<tasks>

<task type="auto">
  <name>Task 1: Remove the blue outline boxes from the ActionPanel + kick-off helper containers</name>
  <files>packages/client/src/components/GameBoard.module.css, packages/client/src/components/KickOffSetupPanel.module.css</files>
  <action>
    In GameBoard.module.css `.actionSection`, remove the `border: 1px solid #0f3460` line so the
    helper text no longer sits in an outlined box. Keep `background`, `border-radius`, `padding`,
    `width`, `overflow-y`, and `max-height` intact (only the border rule is removed). In
    KickOffSetupPanel.module.css `.panel`, remove its `border: 1px solid #0f3460` line as well so
    the kick-off setup helper text also loses its box, keeping all other declarations. Do NOT touch
    `.ctaButton` or `.backButton` borders (those are button styles, not helper-text boxes) and do
    NOT touch the `.panel` background fills — only the 1px outline borders that frame the helper
    text are removed, per the user's "remove all light blue outline boxes from the action panel".
  </action>
  <verify>
    <automated>grep -n "border:" packages/client/src/components/GameBoard.module.css | grep -v "border-radius" ; echo "actionSection border should be gone"</automated>
  </verify>
  <done>`.actionSection` and KickOffSetupPanel `.panel` no longer declare a `1px solid #0f3460` border; button borders and panel backgrounds unchanged.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Add kick-off helper copy + remaining-player countdown to MOVE and FREE_MOVE</name>
  <files>packages/client/src/components/ActionPanel.tsx, packages/client/src/components/ActionPanel.test.tsx</files>
  <behavior>
    - MOVE phase, slot ATTACKER_4 (total 4), movedPieceIds=[] → line2 reads "4 of 4 players left to move."
    - MOVE phase, slot ATTACKER_4 (total 4), movedPieceIds=["home-9"] → line2 reads "3 of 4 players left to move."
    - MOVE phase, slot ATTACKER_2 (total 2) → countdown text still appended with the existing "(2 hex max)" note preserved.
    - FREE_MOVE_ATTACK, freeMoveEligibleIds.attack has 3 ids, freeMoveUsedPace has 1 of those ids keyed → helper reads that 2 players are left to move.
    - KICK_OFF chooser (phase KICK_OFF, selectedPassType null) renders a helper block whose copy explains the kick-off Standard Pass (e.g. title "Kick-Off!" + a meaningful detail line), not just the bare "Choose Action" label.
  </behavior>
  <action>
    In ActionPanel.tsx MOVE branch (~line 604-619): replace the static `slotHelperLine2`
    ("Move up to N players.") with a countdown. Compute `remaining = slotTotal - movedPieceIds.length`
    (clamp at 0). Render line2 as "{remaining} of {slotTotal} players left to move." For the
    ATTACKER_2 slot, append the existing " (2 hex max)" note after the countdown so the 2-hex cap
    is still surfaced. Keep the `.helperBlock` / `.helperLine1` ("Move!") / `.helperLine2` structure.

    In the FREE_MOVE_ATTACK/FREE_MOVE_DEFENSE branch (~line 427-445): derive the eligible list for
    the active sub-phase from `gameState.freeMoveEligibleIds` (`.attack` when phase is
    FREE_MOVE_ATTACK, else `.defense`; default to empty array if null). Count how many of those
    eligible ids appear as keys in `gameState.freeMoveUsedPace` (default empty object); remaining =
    eligibleTotal - movedCount (clamp at 0). Read both fields via `useGameStore` selectors at the
    top of the component alongside the existing state selectors. Update line2 to keep the
    "{sideLabel} — move up to 6 hexes per player" guidance AND append the countdown
    "{remaining} of {eligibleTotal} players left to move." Use the locked phrasing pattern from the
    todo ("{total} players, {remaining} left to move") adapted to read naturally — the key
    requirement is that the number drops as players move.

    In the KICK_OFF chooser (phase KICK_OFF, selectedPassType === null, the `isKickOff` Step-1
    return ~line 509): prepend a `.helperBlock` above the "Choose Action" label with
    `.helperLine1` "Kick-Off!" and a `.helperLine2` giving meaningful copy explaining that play
    starts with a Standard Pass from the centre circle (the only legal opening action per MATCH-07).
    Keep the existing "Choose Action" phaseLabel and the Standard Pass button. Only add the helper
    block when `isKickOff` is true (the regular PASS chooser keeps its current bare "Choose Action").

    In ActionPanel.test.tsx: add tests covering the five behaviors above. Reuse the existing
    `mockMovementState` + `useGameStore.setState` pattern; set `movementSlot`, `movedPieceIds`,
    `freeMoveEligibleIds`, `freeMoveUsedPace`, and `phase` as needed on `gameState`. Assert on the
    rendered countdown text and the kick-off helper copy via `screen.getByText`.

  </action>
  <verify>
    <automated>cd packages/client && pnpm vitest run src/components/ActionPanel.test.tsx</automated>
  </verify>
  <done>MOVE and FREE_MOVE helper text show a live "{remaining} of {total} players left to move" countdown; the KICK_OFF chooser shows a meaningful kick-off helper block; all ActionPanel tests pass and typecheck is clean.</done>
</task>

</tasks>

<verification>
- `pnpm vitest run src/components/ActionPanel.test.tsx` passes (run from packages/client).
- `pnpm --filter @counter-attack/client typecheck` (or `tsc --noEmit`) clean — no unused-import or
  exactOptionalPropertyTypes regressions from the new freeMoveEligibleIds/freeMoveUsedPace reads.
- Manual sanity: no `border: 1px solid #0f3460` remains on `.actionSection` or KickOffSetupPanel `.panel`.
</verification>

<success_criteria>

- The blue outline box no longer frames the ActionPanel/kick-off helper text in the top band.
- Kick-off prompt has meaningful copy (not a bare "Choose Action" label).
- MOVE phase helper text counts down players left to move as players are moved.
- FREE_MOVE_ATTACK / FREE_MOVE_DEFENSE helper text counts down players left to move.
- ActionPanel tests + typecheck green.
  </success_criteria>

<output>
Create `.planning/quick/260621-ajd-clean-up-actionpanel-helper-text-1-remov/260621-ajd-SUMMARY.md` when done
</output>
