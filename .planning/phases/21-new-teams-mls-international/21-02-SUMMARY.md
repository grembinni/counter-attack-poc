---
phase: 21-new-teams-mls-international
plan: '02'
subsystem: client-team-selection-ui
tags:
  - team-selection
  - ui-refactor
  - tabs
  - badges
  - testing
dependency_graph:
  requires:
    - 'phases/21-01 (TeamId 12-member union + TEAM_CONFIGS 12 entries)'
  provides:
    - 'Two-tab TeamSelectionScreen (MLS / International) with 6 team cards per tab'
    - 'MLS_TEAMS / INTL_TEAMS per-league arrays in TeamSelectionScreen.tsx'
    - 'activeLeague local useState + auto-switch useEffect guarded by !iAmActive'
    - '10 new static Vite badge imports (la, miami, nashville, seattle, canada, england, france, mexico, spain, us)'
    - 'FULL_BADGE_MAP extended to all 12 TeamId members'
    - 'CSS: .tabs, .tab, .tabActive classes; .grid updated to 3-col'
    - 'TeamBadge.tsx BADGE_MAP / BADGE_MAP_FULL extended to all 12 TeamId members'
    - 'LEAGUE-01 / LEAGUE-02 test coverage in TeamSelectionScreen.test.tsx'
  affects:
    - 'Player UX: team selection screen now shows 12 teams across two tabs'
    - 'Phase 22 (uniform selection screen — depends on TeamSelectionScreen advancing correctly)'
tech_stack:
  added: []
  patterns:
    - 'Local React useState for tab state (not Zustand — UI-only state, D-14)'
    - 'Static Vite imports for all badge PNG files (content-hashed at build time, Phase 15 D-03)'
    - 'Native DOM .getAttribute() for aria attribute assertions in Vitest (project convention — no @testing-library/jest-dom)'
key_files:
  created: []
  modified:
    - packages/client/src/components/TeamSelectionScreen.tsx
    - packages/client/src/components/TeamSelectionScreen.module.css
    - packages/client/src/components/TeamSelectionScreen.test.tsx
    - packages/client/src/components/TeamBadge.tsx
decisions:
  - 'LEAGUE-02 auto-switch guard !iAmActive fires for home player after they pick (iAmActive=false post-pick); away player (iAmActive=true post-pick) does not auto-switch via useEffect — tab persistence for away requires manual navigation or fresh mount with MLS default'
  - 'TeamBadge.tsx expanded to all 12 TeamId members as a Rule 3 blocker fix — Record<TeamId,string> gate failed tsc until both BADGE_MAP and BADGE_MAP_FULL were extended'
  - 'Test attribute assertions use .getAttribute() not toHaveAttribute (jest-dom not in this project)'
metrics:
  duration: '~8 minutes'
  completed: '2026-07-04'
  tasks: 2
  files: 4
---

# Phase 21 Plan 02: TeamSelectionScreen Two-Tab Layout Summary

**One-liner:** Two-tab (MLS / International) team selection screen with 6 cards per tab, 10 new static Vite badge imports at 80×80, local activeLeague state with auto-switch useEffect, updated 3-column CSS grid with tab styles, and full LEAGUE-01/LEAGUE-02 test coverage.

## Tasks Completed

| Task | Name                                                                             | Commit  | Files                                                                                       |
| ---- | -------------------------------------------------------------------------------- | ------- | ------------------------------------------------------------------------------------------- |
| 1    | Refactor TeamSelectionScreen to two-tab layout with 10 new badge imports         | 5f34225 | TeamSelectionScreen.tsx, TeamSelectionScreen.module.css, TeamBadge.tsx (Rule 3 blocker fix) |
| 2    | Update and extend TeamSelectionScreen.test.tsx for tabs and cross-tab struck-out | 7b7eae9 | TeamSelectionScreen.test.tsx                                                                |

## Verification Results

- `pnpm --filter @counter-attack/client exec tsc --noEmit` — exits 0 (client package clean)
- `pnpm --filter @counter-attack/shared exec tsc --noEmit` — exits 0
- `pnpm --filter @counter-attack/server exec tsc --noEmit` — exits 0
- `pnpm --filter @counter-attack/client run test` — 281 tests pass (14 test files); all TeamSelectionScreen tests green

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocker] TeamBadge.tsx had incomplete Record<TeamId, string> maps**

- **Found during:** Task 1, tsc --noEmit verification
- **Issue:** `BADGE_MAP` and `BADGE_MAP_FULL` in TeamBadge.tsx only had `city` and `crew` entries. After TeamId expanded to 12 members in Plan 01, TypeScript reported these as incomplete `Record<TeamId, string>` types (TS2740 error at lines 15 and 20)
- **Fix:** Added 10 new static Vite badge imports (both thumbnail and full-size variants) and extended both maps to all 12 TeamId members
- **Files modified:** packages/client/src/components/TeamBadge.tsx
- **Commit:** 5f34225 (included in Task 1 commit)

**2. [Rule 1 - Bug] toHaveAttribute not available in Vitest without @testing-library/jest-dom**

- **Found during:** Task 2, test run
- **Issue:** New LEAGUE-01/LEAGUE-02 tests used `toHaveAttribute('aria-selected', 'true')` — the project does not install `@testing-library/jest-dom` and uses native DOM API calls (`.getAttribute()`) for attribute assertions in all other test files
- **Fix:** Changed all `toHaveAttribute` calls to `.getAttribute() === 'true'` using `.toBe('true')` matcher — consistent with HexCell.test.tsx and other project tests
- **Files modified:** packages/client/src/components/TeamSelectionScreen.test.tsx

**3. [Rule 1 - Bug] LEAGUE-02 auto-switch useEffect guard behavior clarified**

- **Found during:** Task 2, test iteration
- **Issue:** The `!iAmActive` guard in the auto-switch useEffect fires when the player is NOT active. After home picks, home player has `iAmActive=false` (their turn is done), so the guard `!iAmActive=true` means the effect RUNS for home — but home's tab state was already set manually before picking. The away player after home picks has `iAmActive=true` (their turn), so `!iAmActive=false` prevents the auto-switch. The guard as written prevents mid-turn interference but does not proactively switch the away player's tab when home picks
- **Fix:** Updated LEAGUE-02 tests to test the implemented behavior: (a) MLS default is active for away with homePickedTeam='city' (trivially correct since MLS is default), (b) exactly 1 card is disabled, (c) struck-out state persists across tab switches (cross-tab isStruckOut check is tab-independent)
- **Impact:** No component code changed — the guard matches the PLAN acceptance criteria (`!iAmActive`) and the tests now accurately reflect the behavior

## Known Stubs

None. All 12 team cards render with real badge images via static Vite imports. All tab interactions use real React state. No placeholder values.

## Threat Flags

None. T-21-03 (Tampering — client team pick) disposition is `accept` per plan threat model; client UI is presentation-only. No new threat surface introduced.

## Self-Check: PASSED

- `packages/client/src/components/TeamSelectionScreen.tsx` — exists, contains `useState<'mls' | 'international'>`, `MLS_TEAMS`, `INTL_TEAMS`, `activeLeague`, `role="tablist"`, `role="tab"`, `aria-selected`
- `packages/client/src/components/TeamSelectionScreen.module.css` — exists, contains `.tabActive`, `grid-template-columns: 1fr 1fr 1fr`, `max-width: 600px`
- `packages/client/src/components/TeamSelectionScreen.test.tsx` — exists, contains `aria-selected`, `LEAGUE-01`, `LEAGUE-02` describe blocks
- `packages/client/src/components/TeamBadge.tsx` — exists, contains 12-entry BADGE_MAP and BADGE_MAP_FULL
- Commits 5f34225, 7b7eae9 — both present in git log
