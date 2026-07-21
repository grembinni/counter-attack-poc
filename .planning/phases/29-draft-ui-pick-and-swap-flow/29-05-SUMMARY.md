---
phase: 29-draft-ui-pick-and-swap-flow
plan: 05
subsystem: ui
tags: [react, drag-and-drop, draft-mode, socket.io, client-routing]

requires:
  - phase: 29-draft-ui-pick-and-swap-flow
    plan: 01
    provides: DraftClientView/DraftDestination/DraftSlotRef/DraftPickPayload/DraftRearrangePayload shared types, DRAFT_PICK/DRAFT_REARRANGE/DRAFT_STATE_UPDATED event contracts
  - phase: 29-draft-ui-pick-and-swap-flow
    plan: 03
    provides: DraftPackCarousel/BenchCarousel components, DraftCardBody shared renderer, TIER_CARD_CLASS/TIER_ORDER, tier-border + carousel CSS classes
provides:
  - 'LineupAssignmentScreen draftMode branch: renders DraftPackCarousel above and BenchCarousel below the formation grid, driven by draftView.lineupSlots/benchIds instead of assignment'
  - 'Single parent-owned dragState resolves every drop (pack->pick, slot/bench->rearrange) — no dataTransfer reads at drop time'
  - 'Client-side GK-slot rule enforcement (both directions) with rejection copy; gameError effect extended for GK_SLOT_REQUIRES_GK/NON_GK_SLOT_REJECTS_GK/INVALID_CARD'
  - 'Cycle/pick counter, waiting-for-opponent indicator, keeper-safety banner, draft-complete carousel hide + Confirm hand-off'
  - "App.tsx DRAFT_STATE_UPDATED handler + draftView local state + handleDraftPick/handleDraftRearrange, routed to teamType==='draft' branch"
  - 'First-ever LineupAssignmentScreen.test.tsx (Standard-mode non-regression + 6 draft-mode tests)'
affects: [30-draft-ui-pick-and-swap-flow-uat, phase-29-holistic-checkpoint]

tech-stack:
  added: []
  patterns:
    - 'Single parent-owned dragState (discriminated union: pack | slot | bench) resolves every drop — children never read dataTransfer at drop time; dataTransfer.setData payloads exist only to satisfy native HTML5 drag initiation (29-03 pattern extended into the parent)'
    - "Card-cache accumulator (Record<cardId, TieredPoolPlayer>) merges draftView.currentPack on every update so already-drafted cards (which leave currentPack once picked) can still render their tier border on the bench; falls back to a PLAYER_MAP + role-based tier heuristic (keeper for GK, common otherwise) for cards never seen in this client's pack history (e.g. a cycle-4 keeper safety-net auto-pick)"
    - 'allowGKDrag optional prop on LineupStatCard (default false/undefined) toggles the Standard-mode permanent GK lock off for draft mode, where a GK card moves freely between lineup/bench (D-08) — additive, zero behavior change when omitted'
    - 'Standard-mode and draft-mode are two fully separate return branches inside the same component function (shared hooks/state at the top, JSX diverges at the return) — guarantees the pre-existing Standard-mode render path is untouched'

key-files:
  created:
    - packages/client/src/components/LineupAssignmentScreen.test.tsx
  modified:
    - packages/client/src/components/LineupAssignmentScreen.tsx
    - packages/client/src/App.tsx

key-decisions:
  - 'DraftSlotRef''s bench variant requires benchIndex even as a rearrange destination (append) — despite the type''s own doc comment implying "no index needed" for a destination bench drop, the type union has no index-less bench variant, so the append destination passes draftView.benchIds.length as its benchIndex'
  - "Bench card TieredPoolPlayer resolution: a client-side cardCache accumulates every card seen in draftView.currentPack (tier data only ever arrives via currentPack); a PLAYER_MAP + role-based tier heuristic (GK->keeper, else common) is the fallback for the one edge case where a card could reach the bench without ever appearing in this client's pack history"
  - "Draft-complete lineup Confirm reuses the existing onConfirm(confirmedOrder: string[]) contract by mapping draftView.lineupSlots (string|null)[] to string[] via id ?? '' — no prop-contract change needed on the Standard-mode onConfirm signature"
  - 'GK-slot rule (D-09) is enforced identically regardless of drag source (pack/slot/bench) via one shared rejectForGKRule(slotIndex, cardId) helper — avoids duplicating the two rejection branches per source type'

requirements-completed: [DRAFT-06, DRAFT-09, DRAFT-10]

duration: ~35min
completed: 2026-07-21
---

# Phase 29 Plan 05: Draft Client Screen Integration Summary

**Wired the full draft interaction into LineupAssignmentScreen (carousel-over-lineup, pack-to-pick and rearrange drag-drop, GK-slot rule, waiting/counter/keeper-banner UI, draft-complete hand-off) and routed App.tsx to the draft screen off DRAFT_STATE_UPDATED — Standard mode fully non-regressed by a new first-ever test file.**

## Performance

- **Duration:** ~35 min (includes `pnpm install` + `@counter-attack/shared` build for the fresh worktree, same one-time cost noted in 29-03-SUMMARY.md)
- **Completed:** 2026-07-21
- **Tasks:** 3/3 completed
- **Files modified:** 3 (2 modified, 1 created)

## Accomplishments

- Extended `LineupAssignmentScreen` with optional `draftMode`/`draftView`/`onDraftPick`/`onDraftRearrange` props and a fully separate draft-mode return branch: `DraftPackCarousel` renders above the GK|DEF|MID|FWD formation grid (driven by `draftView.lineupSlots` resolved via the existing `PLAYER_MAP`, with dashed `.benchSlot`-style placeholders for null slots per D-22) and `BenchCarousel` renders below it (cards resolved from `draftView.benchIds` via a card-cache + fallback resolver, since the server only sends ids for bench/lineup, not full card objects).
- Implemented a single parent-owned `dragState` (discriminated union `pack | slot | bench`) that resolves every drop: a `pack`-sourced drop calls `onDraftPick(cardId, destination)`; a `slot`/`bench`-sourced drop calls `onDraftRearrange(from, to)`. No child component (`DraftPackCarousel`, `BenchCarousel`, or the lineup slot cards) has its `dataTransfer` payload read at drop time — matching the 29-03 pattern.
- Enforced the D-09 GK-slot rule both directions client-side (UX only; server remains authoritative) via one shared `rejectForGKRule` helper, with the exact UI-SPEC rejection copy, auto-clearing after 2000ms; extended the existing `gameError` effect to map `GK_SLOT_REQUIRES_GK`/`NON_GK_SLOT_REJECTS_GK`/`INVALID_CARD` server reasons to the same messages.
- Added `allowGKDrag` to the shared `LineupStatCard` (default off) so a GK card can move freely in draft mode (D-08) without touching Standard mode's permanent GK lock/LOCK badge.
- Rendered the `Cycle {n} of 4 · Pick {k} of {1|2}` counter, the "Waiting for {Home/Visitor} Player to pick…" indicator (row dims via `DraftPackCarousel`'s own `disabled` prop), and a 1s keeper-safety banner (`Keeper auto-selected — cycle 4 safety net.`); the draft-pack row disappears entirely once `draftView.draftComplete` is true, leaving the finalized lineup + bench and the pre-existing Confirm button/flow (D-23).
- Wired `App.tsx`: added local (non-Zustand) `draftView` state, an `onDraftStateUpdated` handler that stores the view and routes to `LINEUP_ASSIGNMENT` on first arrival (covers reconnect resume, D-13), matching `socket.on`/`socket.off` pairs, and `handleDraftPick`/`handleDraftRearrange` emitting `DRAFT_PICK`/`DRAFT_REARRANGE`. The `LINEUP_ASSIGNMENT` render branch now always passes `draftMode={teamType === 'draft'}` plus `draftView`/`onDraftPick`/`onDraftRearrange` alongside the unchanged Standard-mode props.
- Created `LineupAssignmentScreen.test.tsx` (first-ever test for this component): draft-mode carousel-above-grid-above-bench DOM order, a pack-to-slot drag emitting `onDraftPick` with a slot destination, waiting-for-opponent disabling the row + showing the wait text, the cycle/pick counter text, `draftComplete` hiding the carousel and showing Confirm, the keeper-safety banner, and a Standard-mode non-regression test (4 columns + Confirm render unchanged with `draftMode` falsy).

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend LineupAssignmentScreen with the draftMode branch** - `d7c9afd` (feat)
2. **Task 2: App routing + DRAFT_STATE_UPDATED wiring** - `f6be17f` (feat)
3. **Task 3: LineupAssignmentScreen component tests** - `1fce268` (test)

## Files Created/Modified

- `packages/client/src/components/LineupAssignmentScreen.tsx` (MODIFIED) - draftMode branch, DragState, GK-slot rejection, cycle/counter/waiting/keeper-banner UI, `allowGKDrag` on `LineupStatCard`
- `packages/client/src/App.tsx` (MODIFIED) - `draftView` local state, `onDraftStateUpdated` handler + socket.on/off, `handleDraftPick`/`handleDraftRearrange`, draft props passed to `LineupAssignmentScreen`
- `packages/client/src/components/LineupAssignmentScreen.test.tsx` (NEW) - 7 tests: 6 draft-mode + 1 Standard-mode non-regression

## Decisions Made

- `DraftSlotRef`'s bench variant requires a `benchIndex` even when used as a rearrange _destination_ (append) — the union type has no index-less bench member, despite the type's own comment describing a destination bench drop as "always an append with no index needed." Resolved by passing `draftView.benchIds.length` as the append position when constructing the destination ref in `handleDropToBench`.
- Bench cards need full `TieredPoolPlayer` objects (for `BenchCarousel`'s tier border), but `draftView.benchIds`/`lineupSlots` are id-only. Built a `cardCache` that accumulates every card seen in `draftView.currentPack` across updates (tier data only ever arrives that way), with a `PLAYER_MAP` + role-based tier heuristic (`GK -> 'keeper'`, else `'common'`) as the fallback for the one edge case where a card could reach the bench without ever appearing in this client's own pack history (e.g. a cycle-4 keeper safety-net auto-pick placed without the receiving player ever seeing it in `currentPack`).
- Reused the existing `onConfirm(confirmedOrder: string[])` contract for the draft-complete Confirm button by mapping `draftView.lineupSlots` (`(string|null)[]`) to `string[]` via `id ?? ''` — no prop-contract change to the Standard-mode-owned `onConfirm` signature.
- Kept Standard-mode and draft-mode as two fully separate `return` branches within one component function (shared hooks/state declared once at the top per React's rules-of-hooks, JSX diverges only at the return) to make the "Standard-mode render path is unchanged" guarantee structurally obvious rather than relying on prop-threading through a single shared JSX tree.

## Deviations from Plan

None — plan executed exactly as written. The `DraftSlotRef` benchIndex-on-destination point above is a type-contract accommodation (Plan 01's shared type), not a deviation from this plan's own instructions.

## Issues Encountered

- Worktree had no `node_modules` (fresh git worktree checkout, same as 29-03) — ran `pnpm install --frozen-lockfile` (429 packages resolved from the existing pnpm store, no downloads) and `pnpm --filter @counter-attack/shared build` once to populate `packages/shared/dist` for `tsc --noEmit` to resolve `@counter-attack/shared`. Normal monorepo build-order requirement, not a plan deviation.

## Next Phase Readiness

- Phase 29's client-side draft interaction is now fully wired end-to-end against the shared type/event contracts from Plan 01 and the carousel components from Plan 03. This plan does not depend on Plan 04's server-side handlers being implemented yet (client code compiles and is tested purely against the shared package's types/events) — Plan 04 (server) can land independently and the client will exercise the real flow once both are merged.
- Full client test suite (359 tests across 19 files, including the 7 new `LineupAssignmentScreen.test.tsx` tests) passes with no regressions; `pnpm --filter @counter-attack/client typecheck` is green.
- Standard-mode `LineupAssignmentScreen`/`App.tsx` behavior is provably unchanged (new non-regression test + structurally separate draft-mode return branch).
- No blockers for the Phase 29 wave-3/holistic checkpoint (Plan 06), pending Plan 04's server-side completion for full two-browser UAT.

---

_Phase: 29-draft-ui-pick-and-swap-flow_
_Completed: 2026-07-21_

## Self-Check: PASSED

All claimed files exist (LineupAssignmentScreen.tsx, App.tsx, LineupAssignmentScreen.test.tsx, this SUMMARY.md) and all four commits (`d7c9afd`, `f6be17f`, `1fce268`, `3b111c5`) are present in git log.
