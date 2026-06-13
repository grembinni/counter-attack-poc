---
phase: 15-team-identity
plan: 01
subsystem: ui
tags: [typescript, react, vite, shared-types, svg, team-identity]

# Dependency graph
requires:
  - phase: 1-monorepo-scaffold
    provides: shared package barrel export pattern, ESM .js import convention
provides:
  - TeamId union type ('cosmos' | 'xolos' | 'city' | 'crew') in @counter-attack/shared
  - TeamConfig interface (id, name, primaryColor, secondaryColor, badgeFile) in @counter-attack/shared
  - TEAM_CONFIGS record with four teams and exact D-04 color values in @counter-attack/shared
  - TEAM_DEFAULTS client-only positional map (home->cosmos, away->xolos)
  - TeamBadge React component rendering PNG badges via static Vite imports
  - vite-env.d.ts triple-slash shim for PNG TypeScript support
affects: [15-02, 15-03, phase-16-team-selection]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Static Vite PNG imports via BADGE_MAP to avoid build-time URL hashing issues
    - Module-level TEAM_DEFAULTS constant (not inside components) for stable Zustand selector references
    - ESM .js extension in shared barrel exports (teamConfig.js convention)

key-files:
  created:
    - packages/shared/src/teamConfig.ts
    - packages/shared/src/teamConfig.test.ts
    - packages/client/src/teamDefaults.ts
    - packages/client/src/components/TeamBadge.tsx
    - packages/client/src/vite-env.d.ts
  modified:
    - packages/shared/src/index.ts

key-decisions:
  - "badgeFile in TeamConfig is a filename key only ('cosmos.png'), not an asset path — actual import happens in TeamBadge to get Vite-hashed URLs (D-01, Pitfall 3)"
  - 'TEAM_DEFAULTS is client-only and module-level to avoid Zustand reference-identity churn on re-renders (D-05, Pitfall 6)'
  - 'Pre-existing tsc errors in test mock files (ballAfter missing) are out-of-scope; confirmed pre-existing on main before Plan 01'

patterns-established:
  - 'Pattern: BADGE_MAP static imports — import each PNG at module level, collect in Record<TeamId, string>, reference by key in component'
  - 'Pattern: vite-env.d.ts triple-slash reference — required companion file for PNG module type resolution alongside tsconfig types: [vite/client]'

requirements-completed: [TEAM-01, TEAM-06]

# Metrics
duration: 3min
completed: 2026-06-13
---

# Phase 15 Plan 01: Team Identity Foundation Summary

**TeamId union, TeamConfig interface, TEAM_CONFIGS record (four teams with D-04 colors), TEAM_DEFAULTS client map, and TeamBadge PNG component established as the data foundation for all Wave 2 rendering plans**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-06-13T08:51:29Z
- **Completed:** 2026-06-13T08:54:29Z
- **Tasks:** 2 (Task 1 TDD: RED + GREEN commits; Task 2: direct implementation)
- **Files modified:** 6

## Accomplishments

- Shared `teamConfig.ts` exports `TeamId`, `TeamConfig`, and `TEAM_CONFIGS` with all four teams (Cosmos, Xolos, City, Crew) with exact D-04 color values; barrel-exported from `@counter-attack/shared`
- Unit test suite (22 tests) covers all four teams: id equality, name spelling, hex color format, badgeFile format, and Cosmos name spelling guard
- `teamDefaults.ts` defines module-level `TEAM_DEFAULTS: Record<'home'|'away', TeamId>` (home->cosmos, away->xolos) as a client-only constant outside any component
- `TeamBadge.tsx` renders PNG badges via static Vite imports in `BADGE_MAP`; default 28px scoreboard size with configurable `size` prop for Phase 16 reuse
- `vite-env.d.ts` shim created to enable TypeScript resolution of `*.png` module imports

## Task Commits

Each task was committed atomically:

1. **Task 1 RED: failing teamConfig unit tests** - `894e335` (test)
2. **Task 1 GREEN: teamConfig.ts + barrel export** - `6a92267` (feat)
3. **Task 2: TEAM_DEFAULTS, vite-env.d.ts, TeamBadge** - `8f36d45` (feat)

## Files Created/Modified

- `packages/shared/src/teamConfig.ts` - TeamId union, TeamConfig interface, TEAM_CONFIGS record (4 teams, D-04 color values)
- `packages/shared/src/teamConfig.test.ts` - 22 unit tests covering all team fields and Cosmos spelling
- `packages/shared/src/index.ts` - Added `export * from './teamConfig.js'` barrel line
- `packages/client/src/teamDefaults.ts` - Module-level `TEAM_DEFAULTS` positional map (D-05)
- `packages/client/src/components/TeamBadge.tsx` - Static PNG imports, BADGE_MAP, TeamBadge component (D-07)
- `packages/client/src/vite-env.d.ts` - `/// <reference types="vite/client" />` shim

## Decisions Made

- `badgeFile` field in `TeamConfig` stores only the filename key (e.g., `'cosmos.png'`) — NOT used as `<img src>`. The `TeamBadge` component uses static Vite imports so URLs get content-hashed at build time (Pitfall 3 prevention).
- `TEAM_DEFAULTS` defined at module scope in a dedicated `teamDefaults.ts` file, not inside any component, to ensure stable object identity for Zustand selectors (Pitfall 6 prevention).
- Pre-existing TypeScript errors in `ActionPanel.test.tsx`, `mockGKRestartState.ts`, `mockPassState.ts`, and `mockShotState.ts` (missing `ballAfter` field) are out of scope — confirmed present on `main` before this plan's changes.

## Deviations from Plan

None - plan executed exactly as written. TDD RED/GREEN cycle followed for Task 1. Task 2 type-checked cleanly (no new errors introduced).

## Issues Encountered

- `pnpm --filter @counter-attack/shared test --run` failed with "Unknown option: 'run'" — used `pnpm --filter @counter-attack/shared exec vitest run` as the correct invocation for this project setup.
- Pre-existing `tsc --noEmit` errors in client test mock files (not caused by Plan 01 changes). Confirmed by stashing changes and observing identical errors. Logged to deferred items (out of scope per deviation rules).

## Known Stubs

None - all four team configs have complete data. TEAM_DEFAULTS is intentionally hardcoded (Phase 16 will introduce dynamic selection via SELECT-01).

## Threat Flags

None - this plan introduces no network endpoints, auth paths, file access patterns, or schema changes at trust boundaries. Badge PNG assets are static public game assets (T-15-01: accepted).

## Next Phase Readiness

- `TEAM_CONFIGS`, `TEAM_DEFAULTS`, and `TeamBadge` are all exported and ready for Wave 2 consumption
- Plan 15-02 (PieceOverlay jersey patterns) can import `TEAM_DEFAULTS` from `../teamDefaults.js` to drive the `cosmos-jersey-{id}` / `xolos-jersey-{id}` / `city-jersey-{id}` / `crew-jersey-{id}` SVG pattern defs
- Plan 15-03 (GameBoard/ActionLog color refactor) can import both `TEAM_CONFIGS` and `TEAM_DEFAULTS` to replace all `#1a56b0`/`#c0392b` hardcoded literals

---

_Phase: 15-team-identity_
_Completed: 2026-06-13_

## Self-Check: PASSED

- packages/shared/src/teamConfig.ts: FOUND
- packages/shared/src/teamConfig.test.ts: FOUND
- packages/shared/src/index.ts: FOUND (barrel export appended)
- packages/client/src/teamDefaults.ts: FOUND
- packages/client/src/components/TeamBadge.tsx: FOUND
- packages/client/src/vite-env.d.ts: FOUND
- .planning/phases/15-team-identity/15-01-SUMMARY.md: FOUND
- Commit 894e335 (RED test): FOUND
- Commit 6a92267 (GREEN impl): FOUND
- Commit 8f36d45 (Task 2): FOUND
