---
phase: quick-260621-gcu
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
Apply four ActionLog log-formatting changes requested by the user, all confined to
`ActionLog.tsx` (plus stale-test updates in `ActionLog.test.tsx`):

1. Drop the `prefix="D"` / `prefix="A"` role letters from the two **"vs"-comparison**
   `PNamed` lines only (TACKLE_ATTEMPT and the contested-HEADER duel).
2. Add the player number to consolidated MOVE log entries (`move_group` render branch).
3. Prefix every displayed jersey number with `#` (in `PNamed`, in `P`, and in the new
   MOVE-log number).
4. Rename the internal-code-style `[MOVE_HP_A1]`/`[MOVE_HP_D1]` prefixes to a single
   human-readable `[HIGH PASS MOVE 1]` (both ATTACKER and DEFENDER slots). Apply the same
   treatment to the parallel `FTP_MOVE` prefixes → `[FIRST TIME PASS MOVE 1]`.

Purpose: Make the action log read in plain football language with consistent number
formatting, removing developer-internal prefix codes and redundant role letters.
Output: Updated `ActionLog.tsx` rendering; updated assertions in `ActionLog.test.tsx`.
</objective>

<scoping_decisions>

- **FTP_MOVE renamed alongside HP_MOVE (deliberate, not an oversight).** `FTP_MOVE` carries
  the identical `[MOVE_FTP_A1]`/`[MOVE_FTP_D1]` internal-code pattern in both
  `consolidateEvents` and `formatEvent`, mirroring HP_MOVE. Per the planning directive's
  "lean toward consistency" guidance, the plan renames it to `[FIRST TIME PASS MOVE 1]` for
  both slots. This is the same bug pattern and trivial extra effort; leaving it would create
  an inconsistent log where one move type is human-readable and its sibling is not.
- **Out of scope — left exactly as-is (do NOT touch):**
  - `GK_KICK_MOVE`'s `[GK_KICK_K]`/`[GK_KICK_O]` prefixes and its `P prefix="K"/"O"` labels.
  - `GK_KICK`'s `P prefix="GK"` label — but note requirement 3's `#` change DOES apply to it
    because `P` is shared (see Task 2).
  - Non-"vs" `PNamed`/`P` role prefixes: STEAL_ATTEMPT (`prefix="D"`), DEFLECT_ATTEMPT
    (`prefix="D"`), uncontested HEADER (`prefix={rolePrefix}`), GOAL (no prefix). These keep
    their role letters. They DO still receive the `#` number change from requirement 3 because
    that change lives inside the shared `PNamed`/`P` components.
  - Anything that is not a jersey number (dice rolls, hex coordinates, scores) — no `#`.
    </scoping_decisions>

<execution_context>
@$HOME/.claude/gsd-core/workflows/execute-plan.md
</execution_context>

<context>
@packages/client/src/components/ActionLog.tsx
@packages/client/src/components/ActionLog.test.tsx
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add # to PNamed, remove D/A from the two vs-lines, add numbered MOVE label</name>
  <files>packages/client/src/components/ActionLog.tsx</files>
  <action>
Three edits in ActionLog.tsx, all touching the `PNamed`-based / move_group rendering paths:

(a) Requirement 3 — `PNamed` component (~line 58-67): the JSX currently renders
`{prefix ? `${prefix} ` : ''}{num} {name}`. Change the number to carry a `#` so it renders
`{prefix ? `${prefix} ` : ''}#{num} {name}`. Do NOT change `pieceNum()` — only the JSX that
displays `num`. (`#` goes immediately before the digits; the optional role prefix, when
present, still renders before the `#`, e.g. "D #7 Jane Doe".)

(b) Requirement 1 — drop the role letters from the two "vs"-comparison lines ONLY:

- TACKLE_ATTEMPT case (~line 371-372): change
  `<PNamed pieceId={event.defenderId} prefix="D" /> ({defStr}) vs <PNamed pieceId={event.carrierId} prefix="A" /> ({carrStr})`
  to drop both `prefix="D"` and `prefix="A"` →
  `<PNamed pieceId={event.defenderId} /> ({defStr}) vs <PNamed pieceId={event.carrierId} /> ({carrStr})`.
- Contested HEADER case (~line 607-608): change
  `<PNamed pieceId={event.attackerId!} prefix="A" /> {aScore} vs <PNamed pieceId={event.defenderId!} prefix="D" /> {dScore}`
  to drop both prefixes →
  `<PNamed pieceId={event.attackerId!} /> {aScore} vs <PNamed pieceId={event.defenderId!} /> {dScore}`.
  Do NOT remove the role prefix from any OTHER PNamed usage (STEAL_ATTEMPT line ~329 and ~345,
  DEFLECT_ATTEMPT line ~307, uncontested HEADER line ~564 keep their `prefix`). Those are not
  "vs" comparisons and stay as-is.

(c) Requirements 2 & 3 — `move_group` render branch in `ActionLog()` (~line 748-767): the
branch currently builds `const name = pieceName(item.pieceId, item.pieceLabel);` and renders
`<span ...>{name}</span> | {path}`. Add the player number with a `#` prefix, reusing the
existing `pieceNum()` helper (do NOT duplicate its regex). Compute
`const num = pieceNum(item.pieceId);` then render the number before the name, matching
`PNamed`'s "#{num} {name}" shape, e.g. `<span ...>#{num} {name}</span> | {path}`. Keep the
existing team-color/bold span styling and the `| {path}` suffix unchanged.
</action>
<verify>
<automated>cd packages/client && pnpm test -- ActionLog</automated>
</verify>
<done>
PNamed renders "#{num} {name}" (with role prefix before # when present); the TACKLE_ATTEMPT
and contested-HEADER "vs" lines render with no D/A role letters; move_group entries render
"#{num} {name} | {path}". STEAL/DEFLECT/uncontested-HEADER role prefixes are unchanged. Test
command runs (failures from now-stale assertions are expected and fixed in Task 3).
</done>
</task>

<task type="auto">
  <name>Task 2: Add # to the P component number; rename HP_MOVE and FTP_MOVE prefixes</name>
  <files>packages/client/src/components/ActionLog.tsx</files>
  <action>
(a) Requirement 3 — `P` component (~line 41-48): currently renders `{prefix}{pieceNum(pieceId)}`.
Insert a space + `#` between the role prefix and the digits so it reads, e.g., "A #4", "GK #1",
"K #2", "O #3". Render `{prefix} #{pieceNum(pieceId)}` (a literal space before `#`). This is the
shared component used by HP_MOVE, FTP_MOVE, GK_KICK_MOVE, and GK_KICK — all of them inherit the
`#` change, which is intended (requirement 3 is "wherever a jersey number displays"). Do NOT
change `pieceNum()` itself.

(b) Requirement 4 — rename HP_MOVE prefixes to one human-readable literal for BOTH slots:

- `consolidateEvents` HP_MOVE branch (~line 208): change
  `const prefix = event.slot === 'ATTACKER' ? '[MOVE_HP_A1]' : '[MOVE_HP_D1]';` to
  `const prefix = '[HIGH PASS MOVE 1]';` (drop the A/D conditional entirely; both slots use the
  same literal). Leave the `team`/`pieceLabel`/`color`/`groupKey` lines in that branch unchanged
  — `team` is still needed for the fallback `pieceLabel`.
- `formatEvent` `case 'HP_MOVE'` (~line 645): change the returned
  `prefix: event.slot === 'ATTACKER' ? '[MOVE_HP_A1]' : '[MOVE_HP_D1]',` to
  `prefix: '[HIGH PASS MOVE 1]',`. Leave the `team` local and the `<P prefix={team} />` content
  unchanged (the A/D role letter still renders on the player label, only the bracketed code
  prefix changes — consistent with requirement 4 which only renames the bracket prefix).

(c) Requirement 4 (consistency, per scoping decision) — rename FTP_MOVE prefixes identically:

- `formatEvent` `case 'FTP_MOVE'` (~line 660): change
  `prefix: event.slot === 'ATTACKER' ? '[MOVE_FTP_A1]' : '[MOVE_FTP_D1]',` to
  `prefix: '[FIRST TIME PASS MOVE 1]',`. (FTP*MOVE is not consolidated into a move_group in
  `consolidateEvents` — only MOVE, GK_KICK_MOVE, and HP_MOVE have consolidation branches — so
  there is no FTP branch in `consolidateEvents` to edit. FTP_MOVE renders solely through
  `formatEvent`. Confirm by grep that no `[MOVE_FTP*` literal remains.)

After edits, grep the file to confirm zero remaining occurrences of `[MOVE_HP_`, `[MOVE_FTP_`,
`MOVE_HP_A1`, `MOVE_HP_D1`, `MOVE_FTP_A1`, `MOVE_FTP_D1`.
</action>
<verify>
<automated>cd packages/client && pnpm test -- ActionLog</automated>
</verify>
<done>
`P` renders "{prefix} #{num}" (space before #). HP*MOVE renders `[HIGH PASS MOVE 1]` for both
slots in both consolidateEvents and formatEvent. FTP_MOVE renders `[FIRST TIME PASS MOVE 1]` in
formatEvent. No `[MOVE_HP*_]`/`[MOVE*FTP*_]`literals remain. GK_KICK_MOVE / GK_KICK bracket
prefixes are unchanged (they only inherit the`#`change from the shared`P` component).
</done>
</task>

<task type="auto">
  <name>Task 3: Update stale test assertions for the new format; typecheck + test green</name>
  <files>packages/client/src/components/ActionLog.test.tsx</files>
  <action>
Update assertions in ActionLog.test.tsx that the Task 1/2 formatting changes invalidate. Search
the file for: D/A prefix shape regexes, `[MOVE_HP` / `[MOVE_FTP` literals, and move_group
name-only assertions. Known stale assertions to fix:

1. TACKLE_ATTEMPT "name + result glyph parity" test (~line 236):
   `expect(container.textContent).toMatch(/D \d+\s+\S+/);` — this asserted the defender rendered
   with a "D" role prefix. Requirement 1 removed the D/A prefix from the TACKLE_ATTEMPT vs-line.
   Update the regex to assert the new "#{number} {name}" shape with NO leading role letter, e.g.
   `/#\d+\s+\S+/`. (The away-1 name is not hardcoded — keep asserting shape, not literal name.)

2. STEAL_ATTEMPT challenge-detail test (~line 367):
   `expect(container.textContent).toMatch(/D \d+\s+\S+/);` — STEAL_ATTEMPT KEEPS its `prefix="D"`
   (out of scope for requirement 1), but requirement 3 adds `#` before the number, so the bare
   `D \d+` no longer matches. Update to `/D #\d+\s+\S+/` (role letter, space, #, digits, name).

3. D-01 move-log test (~line 188): `expect(screen.getByText(/Nicolae Rusu/)).toBeDefined();` —
   the move_group now renders "#{num} Nicolae Rusu" in a single span. `getByText(/Nicolae Rusu/)`
   uses substring matching by default and should still match. Verify it still passes after the
   render change; if RTL's normalization causes a miss, switch to
   `expect(container.textContent).toMatch(/#\d+\s+Nicolae Rusu/)` to lock in the new numbered
   shape. Prefer adding/strengthening the assertion to assert the number now appears (the whole
   point of requirement 2), e.g. add `expect(container.textContent).toMatch(/#\d+\s+Nicolae Rusu/);`.

4. Scan for any remaining `MOVE_HP` / `MOVE_FTP` literal assertions and any other `D \d` /
   `A \d` shape assertions in vs-context; update them to the new `#`-prefixed / role-letter-dropped
   format. (Based on the current test file, items 1-3 are the only matches; confirm via grep that
   no `[MOVE_HP` or `[MOVE_FTP` string assertions exist.)

Do NOT weaken unrelated assertions (fmtStatRoll `- 0`, glyph prefixes like `[TACKLE ✓]`,
`[SHOT ✗]`, `[HANDLING]`, hex-path arrows, scores). Only the number/prefix-shape assertions
listed above change.
</action>
<verify>
<automated>cd packages/client && pnpm test -- ActionLog</automated>
</verify>
<done>
`pnpm --filter @counter-attack/client test -- ActionLog` passes (all ActionLog tests green),
and `pnpm -r typecheck` from the repo root passes. No stale D/A-shape or MOVE_HP/MOVE_FTP
assertions remain.
</done>
</task>

</tasks>

<verification>
From repo root:
- `pnpm -r typecheck` passes (no shared rebuild needed — only client files changed).
- `pnpm --filter @counter-attack/client test -- ActionLog` passes.

Manual grep sanity (no remaining internal-code prefixes):

- No `[MOVE_HP_`, `[MOVE_FTP_`, `MOVE_HP_A1`, `MOVE_HP_D1`, `MOVE_FTP_A1`, `MOVE_FTP_D1` in
  ActionLog.tsx.
  </verification>

<success_criteria>

1. TACKLE_ATTEMPT and contested-HEADER "vs" lines render player labels with no D/A role
   letters; STEAL/DEFLECT/uncontested-HEADER role letters are preserved.
2. Consolidated MOVE log entries render "#{number} {Name} | {path}".
3. Every displayed jersey number is `#`-prefixed: `PNamed` → "#{num} {name}" (role letter
   before `#` when present); `P` → "{prefix} #{num}"; the new MOVE-log number → "#{num}".
   No `#` on dice rolls, hex coords, or scores.
4. HP_MOVE renders `[HIGH PASS MOVE 1]` (both slots, both consolidateEvents + formatEvent);
   FTP_MOVE renders `[FIRST TIME PASS MOVE 1]`. GK_KICK_MOVE/GK_KICK bracket prefixes unchanged.
5. `pnpm -r typecheck` and `pnpm --filter @counter-attack/client test -- ActionLog` both pass.
   </success_criteria>

<output>
Create `.planning/quick/260621-gcu-actionlog-tsx-formatting-drop-d-a-role-l/260621-gcu-SUMMARY.md` when done.
</output>
