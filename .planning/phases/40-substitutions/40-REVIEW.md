---
phase: 40-substitutions
reviewed: 2026-08-17T00:40:07Z
depth: standard
files_reviewed: 25
files_reviewed_list:
  - packages/client/src/components/ActionLog.tsx
  - packages/client/src/components/ActionPanel.tsx
  - packages/client/src/components/BenchCarousel.test.tsx
  - packages/client/src/components/BenchCarousel.tsx
  - packages/client/src/components/DraftPackCarousel.tsx
  - packages/client/src/components/GameBoard.module.css
  - packages/client/src/components/GameBoard.test.tsx
  - packages/client/src/components/GameBoard.tsx
  - packages/client/src/components/LineupAssignmentScreen.module.css
  - packages/client/src/components/LineupAssignmentScreen.test.tsx
  - packages/client/src/components/LineupAssignmentScreen.tsx
  - packages/client/src/store/useGameStore.test.ts
  - packages/client/src/store/useGameStore.ts
  - packages/server/src/__tests__/draftSession.integration.test.ts
  - packages/server/src/__tests__/gameEngine.substitution.test.ts
  - packages/server/src/__tests__/gameHandlers.substitution.test.ts
  - packages/server/src/__tests__/lineupAssignment.integration.test.ts
  - packages/server/src/__tests__/substitution.integration.test.ts
  - packages/server/src/gameEngine.ts
  - packages/server/src/gameHandlers.ts
  - packages/server/src/roomHandlers.ts
  - packages/shared/src/events.ts
  - packages/shared/src/index.ts
  - packages/shared/src/stoppagePhases.test.ts
  - packages/shared/src/stoppagePhases.ts
  - packages/shared/src/types.ts
findings:
  critical: 0
  warning: 2
  info: 2
  total: 4
status: issues_found
---

# Phase 40: Code Review Report

**Reviewed:** 2026-08-17T00:40:07Z
**Depth:** standard
**Files Reviewed:** 25
**Status:** issues_found

## Summary

This phase adds mid-match substitutions end-to-end: shared eligibility rules
(`isStoppagePhase`/`MAX_SUBS_PER_TEAM`/`maxOnPitchFor` in `packages/shared/src/stoppagePhases.ts`),
a pure engine authority (`applySubstitution`/`applyRosterContinuity`/`relocateRedCardedToBench`
in `gameEngine.ts`), a socket handler (`GAME_SUBSTITUTION` in `gameHandlers.ts`), and client UI
(a persistent SUB affordance on `GameBoard`, a mid-match roster panel adapted from
`LineupAssignmentScreen`).

The server-side authority is solid. `applySubstitution` re-validates every guard
server-side regardless of what the handler already checked (phase, cap, ownership,
red-card-out, bench-entry existence/status, red-card-in, pool-identity, GK parity), never
trusts a client-supplied bench/pool, and is extensively covered by both unit
(`gameEngine.substitution.test.ts`) and full socket-integration tests
(`gameHandlers.substitution.test.ts`, `substitution.integration.test.ts`) including the
double-emit mutex, malformed-payload handling, and roster continuity across a
goal/half-time reset (`applyRosterContinuity` correctly overlays live identity onto a
freshly-rebuilt formation array, matched by slot `id`, so a goal reset can never resurrect
a subbed-out player or clear a red card). I traced `applySubstitution`'s guard ordering,
the bench-entry replace-in-place logic (never changes bench length, never lets a bench
player be subbed in twice), the SUB-05 added-time bonus fold-in/direct-increment split
across `applyEndTurn`, and the GK-parity invariant across repeated substitutions on the
same slot — all correct and consistent with their documented design.

The client-side formation-slot-preservation fix in `LineupAssignmentScreen.tsx`
(`renderMidmatchColumn`, grouping by the FIXED formation slot's `slotRole` parsed from
`piece.id`'s `${team}-${slotIndex}` suffix, not by the occupant's own `piece.role`) is
sound: the id scheme it depends on (`buildSquadPieces` in `gameEngine.ts`, `id: \`home-${i}\``)
is stable and never changes across a substitution (SUB-03), so the regex-based slot lookup
is not fragile in practice, and it is covered by a dedicated regression test
(`LineupAssignmentScreen.test.tsx` "formation-shape regression").

Socket-layer validation is thorough: the `GAME_SUBSTITUTION` handler validates the payload
shape before any lookup, checks piece ownership before ever calling into the engine, and
never inspects/mutates the bench itself (defers entirely to the engine). No security gaps
were found in the substitution-specific code paths.

One real, provable defect was found: a client-side rejection-message mapping bug where two
`SubstitutionRejection` reason strings (`GK_SLOT_REQUIRES_GK`/`NON_GK_SLOT_REJECTS_GK`) are
reused verbatim from the pregame lineup-swap/draft-rearrange flows, and the shared
`gameError`-driven UI in `LineupAssignmentScreen.tsx` always renders the pregame "Swap
rejected — …" wording for them even when they originate from a mid-match substitution
rejection, producing a misleading message in that context.

## Warnings

### WR-01: Misleading "Swap rejected" copy shown for a mid-match substitution's GK-parity rejection

**File:** `packages/client/src/components/LineupAssignmentScreen.tsx:319-346`
**Issue:** `applySubstitution` (`packages/server/src/gameEngine.ts:3084-3092`, guard 9) can
reject a mid-match substitution with reason `GK_SLOT_REQUIRES_GK` or
`NON_GK_SLOT_REJECTS_GK` — these are the exact same string literals the pregame
`LINEUP_SWAP`/`DRAFT_PICK`/`DRAFT_REARRANGE` handlers use for their own GK-slot guard
(`packages/server/src/roomHandlers.ts:1045,1049,1157,1161`). This is confirmed
server-side by `gameHandlers.substitution.test.ts:638-664` ("GK_SLOT_REQUIRES_GK when
subbing a non-GK into the GK slot" / "NON_GK_SLOT_REJECTS_GK when subbing a GK into a
non-GK slot" — both driven through `GAME_SUBSTITUTION`, not a lineup swap).

On the client, `LineupAssignmentScreen`'s single `gameError`-driven `useEffect` maps every
one of the 11 known `gameError` values to a message, and does so **without regard to
`mode`**:

```tsx
} else if (gameError === 'NON_GK_SLOT_REJECTS_GK') {
  message = 'Swap rejected — only a goalkeeper card can be placed here.';
} else if (gameError === 'GK_SLOT_REQUIRES_GK') {
  message = 'Swap rejected — goalkeeper slot requires a GK card.';
}
...
} else if (gameError === 'SUB_CAP_REACHED') {
  message = 'Substitution rejected — limit reached.';
} else if (gameError === 'ALREADY_SUBBED') {
  message = 'Substitution rejected — player already substituted.';
} else if (gameError === 'WRONG_PHASE') {
  message = 'Substitution rejected — not currently a stoppage.';
} ...
```

Every OTHER substitution rejection reason gets "Substitution rejected — …" wording, but a
GK-parity rejection during a mid-match substitution (drag a bench GK onto a non-GK slot, or
a bench outfielder onto the GK slot) shows "Swap rejected — …" instead — wrong verb for an
action the user never took (there is no "swap" concept in mid-match mode; the mode's own
copy elsewhere consistently says "Substitute"/"Substitution", see the panel heading and the
CTA copy at lines 787-792). This is untested: `LineupAssignmentScreen.test.tsx`'s "rejection
messages" describe block (lines 763-794) only covers `SUB_CAP_REACHED` and
`CANNOT_SUB_IN_RED_CARDED` for `mode="midmatch"` — the GK-parity path was never exercised
against the midmatch rendering, so this collision shipped unnoticed.
**Fix:** Branch on `mode` (already an available prop) before falling back to the shared
message, e.g.:

```tsx
} else if (gameError === 'NON_GK_SLOT_REJECTS_GK') {
  message =
    mode === 'midmatch'
      ? 'Substitution rejected — only a goalkeeper can fill this slot.'
      : 'Swap rejected — only a goalkeeper card can be placed here.';
} else if (gameError === 'GK_SLOT_REQUIRES_GK') {
  message =
    mode === 'midmatch'
      ? 'Substitution rejected — this slot requires a goalkeeper.'
      : 'Swap rejected — goalkeeper slot requires a GK card.';
}
```

Add a test to the "rejection messages" `describe` block in
`LineupAssignmentScreen.test.tsx` asserting the midmatch-specific copy for both reasons.

### WR-02: `onDragOver` in the mid-match on-pitch column skips the `readOnly` guard that `onDrop` enforces

**File:** `packages/client/src/components/LineupAssignmentScreen.tsx:472-491`
**Issue:** `renderMidmatchColumn`'s on-pitch card `onDrop` handler explicitly checks
`readOnly === true` before ever calling `onSubstitute` (with a comment explaining this is
"a defensive second gate rather than relying on drag-source gating alone"). The sibling
`onDragOver` handler for the same card has no equivalent guard:

```tsx
onDragOver={(e) => {
  e.preventDefault();
  setMidmatchDropTargetPieceId(piece.id);
}}
```

`e.preventDefault()` unconditionally signals "this is a valid drop target" to the browser
and unconditionally applies the `.statCardSubTarget` hover-highlight class, even when
`readOnly === true`. In today's UI this is inert in practice only because
`BenchCarousel`'s cards are also made non-draggable when `disabled === true`
(`BenchCarousel.tsx:106,181`), so no legitimate drag can currently reach this handler while
read-only — but it is an inconsistent application of the project's own stated
"defense-in-depth, never rely on a single gate" principle (the same principle guard 6 in
`applySubstitution` and the handler-level ownership re-check both apply), and any future
drag source added to the page (e.g. a browser file drag, or a new draggable element) would
visually invite a drop that the `onDrop` handler will silently reject.
**Fix:** Mirror the `onDrop` guard:

```tsx
onDragOver={(e) => {
  if (readOnly === true) return;
  e.preventDefault();
  setMidmatchDropTargetPieceId(piece.id);
}}
```

## Info

### IN-01: `maxOnPitchFor` recomputes the whole `pieces` array on every `GameBoard` render

**File:** `packages/client/src/components/GameBoard.tsx:606`
**Issue:** `maxOnPitch={maxOnPitchFor(pieces, myTeam)}` runs a full `.filter()` over the
combined 22-piece array on every render that touches `pieces` (out of scope per the
review's explicit performance exclusion, noted only because it sits directly beside the
substitution feature and would be trivial to memoize alongside the other per-slice
selectors already used in this component). Not flagged as a defect — purely a note for a
future pass.
**Fix:** None required; informational only.

### IN-02: `SubstitutionButton`'s `onOpen` can set `subOpen` true when `myTeam` is `null`, with no visible effect

**File:** `packages/client/src/components/GameBoard.tsx:582,621`
**Issue:** The button's `onClick` always calls `setSubOpen(true)` regardless of `myTeam`,
but the modal itself is gated on `subOpen && myTeam !== null` (line 582). If `myTeam` is
`null` (a socket whose `playerSlot` hasn't resolved to a team yet — should not occur once a
match has started, but the component doesn't assert it), clicking the button silently does
nothing observable, and `subOpen` stays `true` in the background so if `myTeam` later
becomes non-null within the same mount (e.g. a hot-reload or an unusual reconnect timing)
the modal would pop open without an explicit click. Low likelihood given `useMyTeam()`'s
contract, but worth a defensive `myTeam !== null` check on the button itself for
consistency with the `subOpen && myTeam !== null` gate.
**Fix:**

```tsx
<SubstitutionButton
  actionable={isSubEligiblePhase}
  onOpen={() => {
    if (myTeam !== null) setSubOpen(true);
  }}
/>
```

---

_Reviewed: 2026-08-17T00:40:07Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
