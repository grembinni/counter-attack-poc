---
phase: 27-game-creation-settings
plan: 04
subsystem: ui
tags: [react, zustand, css-modules, settings-summary]

# Dependency graph
requires:
  - phase: 27-01
    provides: TeamType/DraftPoolId shared types, SELECTABLE_DRAFT_POOLS allow-list
  - phase: 27-03
    provides: shared SPEED_OPTIONS constant (packages/client/src/constants/speedOptions.ts), App.tsx teamType/draftPools/selectedSpeed local state
provides:
  - 'formatSettingsSummary(speed, teamType, draftPools) -> string | null helper + DRAFT_POOL_LABELS (packages/client/src/constants/settingsSummary.ts)'
  - 'UniformSelectionScreen read-only speed subheader (Standard) / settings summary line (Draft) — no interactive picker, no onSpeedChange'
  - 'TeamSelectionScreen identical conversion (dead-twin, no live-app effect) for consistency + test coverage'
  - 'App.tsx threads settingsSummary into both screens; removed unused handleSpeedChange/emitTeamSpeed selector'
affects: [28-draft-data-model, 29-draft-ui-pick-and-swap-flow]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - 'Read-only info-subheader conversion: delete iAmHome-gated interactive/readonly ternary, always render read-only branch; settingsSummary prop (string | null) drives Standard-vs-Draft copy without the screen touching DraftPoolId formatting'

key-files:
  created:
    - packages/client/src/constants/settingsSummary.ts
  modified:
    - packages/client/src/components/UniformSelectionScreen.tsx
    - packages/client/src/components/UniformSelectionScreen.test.tsx
    - packages/client/src/components/TeamSelectionScreen.tsx
    - packages/client/src/components/TeamSelectionScreen.test.tsx
    - packages/client/src/App.tsx

key-decisions:
  - "Draft-mode summary line stands alone (no '0 | MATCH SPEED' / 'Match speed:' label prefix) on both screens — the summary string itself already begins with 'Speed: ...', so keeping the section label would be redundant; label is shown only in Standard mode (settingsSummary === null)"
  - 'settingsSummary computed once in App.tsx via formatSettingsSummary(selectedSpeed, teamType, draftPools) and passed as a pre-formatted string | null — screens never import DraftPoolId or DRAFT_POOL_LABELS themselves'
  - 'emitTeamSpeed store method and TEAM_SPEED_SET/TEAM_SPEED_CHANGED events left in place as flagged dead code per plan — only the local handleSpeedChange wrapper and its call sites were removed from App.tsx'

patterns-established:
  - "Settings-summary formatting centralized in constants/settingsSummary.ts, mirroring constants/speedOptions.ts extraction from 27-03 — third instance of the same value would trigger the same 'extract to constants/' rule"

requirements-completed: [DRAFT-02, DRAFT-03]

# Metrics
duration: ~20min
completed: 2026-07-20
---

# Phase 27 Plan 04: Read-Only Speed Subheader + Draft Settings Summary Summary

**Converted the interactive Match Speed picker on UniformSelectionScreen and TeamSelectionScreen to a read-only subheader (Standard) / single settings-summary line (Draft), backed by a new centralized `formatSettingsSummary` formatter.**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-07-20T18:35:00-05:00 (approx.)
- **Completed:** 2026-07-20T18:45:16-05:00
- **Tasks:** 2
- **Files modified:** 6 (1 created, 5 modified)

## Accomplishments

- New `packages/client/src/constants/settingsSummary.ts`: `formatSettingsSummary(speed, teamType, draftPools)` returns `null` in Standard mode and `"Speed: {icon} {Label} · Team Type: Draft · Draft Pool: {Pool1, Pool2, ...}"` in Draft mode, plus the shared `DRAFT_POOL_LABELS` map.
- `UniformSelectionScreen.tsx` (live path): interactive speed-picker buttons and `onSpeedChange` prop removed entirely; renders exactly one read-only element — the existing colored speed label in Standard mode, or the settings-summary line (standing alone, no "0 | MATCH SPEED" label) in Draft mode.
- `TeamSelectionScreen.tsx` (dead twin, unreachable in the live app since Phase 22 per 27-RESEARCH.md): identical conversion applied for consistency and test coverage — no live-app user-facing effect, per plan's documented known-open-item.
- `App.tsx`: both screens now receive `settingsSummary={formatSettingsSummary(selectedSpeed, teamType, draftPools)}`; the now-unused `handleSpeedChange` function and its `emitTeamSpeed` selector were removed (the store method and `TEAM_SPEED_SET`/`TEAM_SPEED_CHANGED` events remain in place as flagged dead code, out of scope per plan).

## Task Commits

Each task was committed atomically:

1. **Task 1: Convert UniformSelectionScreen to read-only subheader/summary (live path) + summary formatter + App wiring** - `56ed809` (feat)
2. **Task 2: Convert TeamSelectionScreen (dead twin) + App wiring + drop now-unused speed handler** - `6b466af` (feat)

**Plan metadata:** (this commit)

## Files Created/Modified

- `packages/client/src/constants/settingsSummary.ts` - `formatSettingsSummary` + `DRAFT_POOL_LABELS`
- `packages/client/src/components/UniformSelectionScreen.tsx` - read-only speed subheader/summary; `settingsSummary` prop replaces `onSpeedChange`; imports shared `SPEED_OPTIONS`
- `packages/client/src/components/UniformSelectionScreen.test.tsx` - `DEFAULT_PROPS` updated (settingsSummary replaces onSpeedChange); 3 new tests (no interactive button, standard-mode label, draft-mode exact summary line)
- `packages/client/src/components/TeamSelectionScreen.tsx` - identical D-07/D-09 conversion
- `packages/client/src/components/TeamSelectionScreen.test.tsx` - `DEFAULT_SPEED_PROPS` updated in lockstep (Pitfall 2); 3 new tests mirroring UniformSelectionScreen's
- `packages/client/src/App.tsx` - threads `settingsSummary` into both screens; removes `handleSpeedChange`/`emitTeamSpeed` selector; `teamType`/`draftPools` state comments updated (no longer "unused")

## Decisions Made

- Draft-mode summary line stands alone with no section-label prefix on either screen (see key-decisions above) — matches D-09's "single summary line" framing more literally than keeping a redundant label.
- `settingsSummary` formatting is fully centralized; neither screen component imports `DraftPoolId` or pool-label logic, satisfying the plan's must-have truth.

## Deviations from Plan

None - plan executed exactly as written. Both tasks' `<action>` and `<acceptance_criteria>` were implemented verbatim, including the App.tsx cleanup of `handleSpeedChange`/`emitTeamSpeed` in Task 2.

## Issues Encountered

- Worktree had no `node_modules` and `packages/shared` had no built `dist/` on first run (`pnpm install` + `pnpm --filter @counter-attack/shared build` required before tests/typecheck could resolve `@counter-attack/shared`). Not a plan deviation — standard worktree bootstrap, no code changes involved.
- Root `pnpm lint` fails on 5 pre-existing files in `packages/shared/src/*.test.ts` with a `typescript-eslint` "too many files matched default project" parser error, unrelated to this plan's `packages/client`-only changes (confirmed by running `eslint packages/client/src` directly, which is fully clean — 0 errors). This is pre-existing tech debt in `packages/shared`'s eslint config, out of scope per the deviation-rules scope boundary (not directly caused by this task's changes). Not fixed; flagged here for visibility since it blocks a clean root `pnpm lint` run.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- DRAFT-02/DRAFT-03 fully satisfied: neither pre-game screen exposes an interactive speed picker or `onSpeedChange`; Draft mode shows the single settings-summary line.
- `formatSettingsSummary`/`DRAFT_POOL_LABELS` are available in `packages/client/src/constants/settingsSummary.ts` for reuse by future draft-mode UI (Phase 29/30) if a similar summary is needed elsewhere.
- Pre-existing `packages/shared` root-lint gap (see Issues Encountered) is not part of this plan's scope and remains for a future cleanup pass — no action required before phase close unless the phase verifier wants the root `pnpm lint` command specifically green (it is not, for reasons unrelated to 27-04).

---

_Phase: 27-game-creation-settings_
_Completed: 2026-07-20_

## Self-Check: PASSED

All created/modified files and task commit hashes verified present:

- `packages/client/src/constants/settingsSummary.ts` — FOUND
- `packages/client/src/components/UniformSelectionScreen.tsx` — FOUND
- `packages/client/src/components/TeamSelectionScreen.tsx` — FOUND
- `.planning/phases/27-game-creation-settings/27-04-SUMMARY.md` — FOUND
- Commit `56ed809` (Task 1) — FOUND
- Commit `6b466af` (Task 2) — FOUND
- Commit `a520e34` (docs: summary) — FOUND
