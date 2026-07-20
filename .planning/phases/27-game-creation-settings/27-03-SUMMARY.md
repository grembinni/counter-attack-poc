---
phase: 27-game-creation-settings
plan: 03
subsystem: ui
tags: [react, zustand, socket.io, client-only, draft-mode]

# Dependency graph
requires:
  - phase: 27-game-creation-settings (plan 01)
    provides: TeamType/DraftPoolId/SELECTABLE_DRAFT_POOLS shared types, ROOM_SETTINGS_CONFIRM/ROOM_SETTINGS_CONFIRMED event contract
provides:
  - GameSettingsScreen component (host-only pre-step settings form)
  - Shared SPEED_OPTIONS constant module
  - GAME_SETTINGS Screen union member
  - App.tsx routing branch, host redirect, confirm emit, and settings-receipt handler
affects: [27-04 (draft data model UI), 27-05 (checkpoint / manual UAT)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - 'Local useState + single bundled onConfirm callback (mirrors UniformSelectionScreen)'
    - 'Rule-of-three constant extraction (SPEED_OPTIONS) to packages/client/src/constants/'
    - 'Testing Library getByRole<T> generic type parameter instead of `as` casts (survives eslint --fix under recommendedTypeChecked)'

key-files:
  created:
    - packages/client/src/constants/speedOptions.ts
    - packages/client/src/components/GameSettingsScreen.tsx
    - packages/client/src/components/GameSettingsScreen.module.css
    - packages/client/src/components/GameSettingsScreen.test.tsx
  modified:
    - packages/client/src/store/useGameStore.ts
    - packages/client/src/App.tsx

key-decisions:
  - 'SPEED_OPTIONS extracted to shared client module now that GameSettingsScreen is a third consumer (rule of three); TeamSelectionScreen/UniformSelectionScreen keep local copies until 27-04 converts them'
  - 'App.tsx teamType/draftPools local state added now (write-only in this plan) with an explicit eslint-disable-next-line for @typescript-eslint/no-unused-vars, since 27-04 is the plan that reads them into the settings summary'
  - 'GameSettingsScreen.module.css duplicates needed tokens from LobbyScreen/TeamSelectionScreen CSS rather than sharing a base file, per existing project convention'

requirements-completed: [DRAFT-01]

# Metrics
duration: ~35min
completed: 2026-07-20
---

# Phase 27 Plan 03: Game Creation Settings Screen Summary

**Host-only GameSettingsScreen (Match Speed + Standard/Draft toggle + 5 draft-pool checkboxes) wired into the client Screen state machine, with a new shared SPEED_OPTIONS constant and App.tsx routing/emit/receipt plumbing for ROOM_SETTINGS_CONFIRM/CONFIRMED.**

## Performance

- **Duration:** ~35 min
- **Tasks:** 3 completed
- **Files modified:** 6 (4 created, 2 modified)

## Accomplishments

- New `GameSettingsScreen` component renders "Game Settings" heading, an interactive Match Speed picker (slow/standard/fast), a Standard/Draft team-type toggle, and — only in Draft mode — five pool checkboxes (Original, MLS, International, Legends, Icons) with Legends/Icons disabled and labelled "(coming soon)"
- Original pre-checked by default in Draft mode (D-05); Confirm Settings button disabled whenever zero of the three enabled pools are checked (D-06), driven off `SELECTABLE_DRAFT_POOLS` (not a hardcoded id list)
- Single bundled `onConfirm({ speed, teamType, draftPools })` — draftPools is `[]` in Standard mode
- `Screen` union gains `'GAME_SETTINGS'` member (positioned after `'WAITING'`, before `'TEAM_SELECTION'`)
- App.tsx: host (`slot === 1`) now lands on `GAME_SETTINGS` after Create Room instead of `WAITING`; `handleSettingsConfirm` emits `ROOM_SETTINGS_CONFIRM`; `onRoomSettingsConfirmed` (registered/cleaned up per Pitfall 9) stores the confirmed settings and moves the host off `GAME_SETTINGS` to `WAITING` — a no-op for the joiner, who never renders `GAME_SETTINGS`
- `SPEED_OPTIONS` extracted to `packages/client/src/constants/speedOptions.ts` (rule of three — third consumer is `GameSettingsScreen`); `TeamSelectionScreen.tsx`/`UniformSelectionScreen.tsx` keep their local copies for now (27-04 converts them)

## Task Commits

Each task was committed atomically:

1. **Task 1: Extract shared SPEED_OPTIONS + add GAME_SETTINGS Screen member** - `1e1d68f` (feat)
2. **Task 2: Build GameSettingsScreen component + tests** - `c378aeb` (feat)
3. **Task 3: Wire GAME_SETTINGS into App routing, host redirect, confirm emit, and settings receipt** - `f34ef3c` (feat)

**Deviation fix (same-scope, post-Task-3):** `1dc5ef8` (fix) — see Deviations below.

## Files Created/Modified

- `packages/client/src/constants/speedOptions.ts` - Shared `SPEED_OPTIONS` const (value/label/icon/colorClass for slow/standard/fast)
- `packages/client/src/components/GameSettingsScreen.tsx` - Host-only settings pre-step form component
- `packages/client/src/components/GameSettingsScreen.module.css` - Dark-theme CSS module (page/card shell, speed picker, tab toggle, pool checkboxes, CTA)
- `packages/client/src/components/GameSettingsScreen.test.tsx` - 11 tests covering render, Draft-mode reveal, disabled-state, and onConfirm payload shape
- `packages/client/src/store/useGameStore.ts` - Added `'GAME_SETTINGS'` to the `Screen` union
- `packages/client/src/App.tsx` - Imports `GameSettingsScreen`; `teamType`/`draftPools` local state; `onRoomJoined` slot-1 redirect to `GAME_SETTINGS`; `handleSettingsConfirm`; `onRoomSettingsConfirmed` (registered + cleaned up); `GAME_SETTINGS` routing branch before `TEAM_SELECTION`

## Decisions Made

- Extracted `SPEED_OPTIONS` now rather than adding a third inline copy inside `GameSettingsScreen.tsx` — matches RESEARCH.md's rule-of-three recommendation and is a net line-count reduction.
- Added `teamType`/`draftPools` local state to `App.tsx` in this plan even though nothing reads them yet (27-04 threads them into the read-only settings summary on the two team-selection screens) — this matches the plan's explicit instruction to add this state "alongside `selectedSpeed`" in 27-03. Since the project's ESLint config (`recommendedTypeChecked` + a `no-unused-vars` rule with no default ignore for plain state) treats write-only `useState` bindings as unused, added a targeted `// eslint-disable-next-line @typescript-eslint/no-unused-vars` on each binding with a comment pointing to 27-04 as the consumer, rather than renaming to an underscore-prefixed binding (which would force 27-04 to rename them back, contradicting that plan's stated task shape).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Missing shared-package build blocked typecheck**

- **Found during:** Task 1 verification
- **Issue:** `pnpm --filter @counter-attack/client typecheck` failed with `Cannot find module '@counter-attack/shared'` because `packages/shared/dist/` did not exist in this fresh worktree checkout (node_modules also needed a `pnpm install`).
- **Fix:** Ran `pnpm install` (workspace deps) and `pnpm --filter @counter-attack/shared build` before continuing; no source changes.
- **Files modified:** none (build artifacts only, not committed — `dist/` is gitignored)
- **Verification:** `pnpm --filter @counter-attack/client typecheck` exits 0 afterward.

**2. [Rule 1 - Bug] eslint --fix repeatedly stripped test-file type assertions, breaking tsc**

- **Found during:** Task 3 (post-commit verification of the full plan)
- **Issue:** The pre-commit `eslint --fix` hook (`typescript-eslint` `recommendedTypeChecked` ruleset) removed the `as HTMLInputElement`/`as HTMLButtonElement` casts in `GameSettingsScreen.test.tsx` on two separate commits, each time silently reintroducing `tsc --noEmit` failures (`Property 'checked'/'disabled' does not exist on type 'HTMLElement'`) that only surfaced on the _next_ typecheck run, not at commit time (husky only runs eslint/prettier, not `tsc`).
- **Fix:** Replaced all `screen.getByRole('checkbox', {...}) as HTMLInputElement` / `... as HTMLButtonElement` patterns with Testing Library's generic `screen.getByRole<HTMLInputElement>('checkbox', {...})` form, which needs no post-hoc assertion and is not touched by the assertion-stripping autofix.
- **Files modified:** `packages/client/src/components/GameSettingsScreen.test.tsx`
- **Verification:** `pnpm --filter @counter-attack/client typecheck` exits 0 and `npx eslint packages/client/src/components/GameSettingsScreen.test.tsx` reports no errors after re-running the pre-commit hook (confirmed stable across the commit).
- **Committed in:** `1dc5ef8`

---

**Total deviations:** 2 auto-fixed (1 blocking/environment, 1 bug/tooling)
**Impact on plan:** Both fixes were necessary to reach a green typecheck/test state; no scope creep — no plan behavior changed.

## Issues Encountered

- The worktree required `pnpm install` and a `packages/shared` build before any typecheck/test command would succeed (see Deviation 1). This is expected in a freshly-created worktree and not specific to this plan's changes.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- 27-04 can now import the shared `SPEED_OPTIONS` and read App's `teamType`/`draftPools`/`selectedSpeed` local state to build the read-only settings summary on `TeamSelectionScreen.tsx`/`UniformSelectionScreen.tsx`, per the plan's `<artifacts_produced>` contract.
- Server-side validation of `ROOM_SETTINGS_CONFIRM` (host-only guard, allow-list, both-conditions `TEAM_SELECTION_START` gate) is out of scope for this plan — confirmed already delivered by 27-02 per this plan's context references; client emits the event but this plan does not touch `roomHandlers.ts`.
- Manual verification (create a room → land on Game Settings → toggle Draft → confirm) is deferred to the 27-05 checkpoint per this plan's `<verification>` section.

---

_Phase: 27-game-creation-settings_
_Completed: 2026-07-20_
