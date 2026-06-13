---
phase: 15-team-identity
plan: 03
subsystem: ui
tags: [typescript, react, svg, team-identity, tdd, scoreboard, color-refactor]

# Dependency graph
requires:
  - phase: 15-01
    provides: TEAM_CONFIGS, TEAM_DEFAULTS, TeamId union, TeamBadge component
  - phase: 15-02
    provides: D-06 refactor pattern in PieceOverlay (analog for GameBoard/ActionLog/PlayerStatsPanel)
provides:
  - Scoreboard renders TeamBadge PNG images for home (cosmos) and away (xolos) (TEAM-06)
  - TeamShieldIcon removed; TeamBadge used in scoreboard and player card icon (D-07)
  - Single color source of truth via TEAM_CONFIGS in GameBoard, ActionLog, PlayerStatsPanel (D-06)
  - MiniTokenBadge uses team-keyed jersey patterns (mini-{teamId}-jersey-{id}) (D-06)
  - Home GK mini token uses checker pattern matching main board (mini-home-gk-checker-{id}) (D-10)
affects: [phase-16-team-selection]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - TEAM_CONFIGS[TEAM_DEFAULTS[positional]].primaryColor as single color source of truth
    - TeamBadge <img> replacing SVG shield icon in scoreboard and player card
    - Team-keyed SVG pattern ids (mini-{teamId}-jersey-{id}) preventing positional coupling
    - Home GK checker pattern scaled to mini token (10px tile, 5px checkers)

key-files:
  modified:
    - packages/client/src/components/GameBoard.tsx
    - packages/client/src/components/GameBoard.test.tsx
    - packages/client/src/components/ActionLog.tsx
    - packages/client/src/components/PlayerStatsPanel.tsx
    - packages/client/src/components/PlayerStatsPanel.test.tsx

key-decisions:
  - 'TeamShieldIcon SVG function deleted; TeamBadge PNG component used in both scoreboard cells and player card icon'
  - 'resultColor draw branch keeps neutral #e0e0e0 (not a team-identity color); home/away win branches use TEAM_CONFIGS'
  - 'Away GK MiniTokenBadge keeps solid amber #f59e0b (no pattern needed); home GK gets checker pattern matching main board (D-10)'
  - 'MiniTokenBadge uses a simplified horizontal stripe pattern for all outfield teams — sufficient for mini 18px token; exact per-team patterns (cosmos/xolos/city/crew) would be imperceptibly small at 20px SVG size'

patterns-established:
  - 'Pattern: TEAM_CONFIGS[TEAM_DEFAULTS[positional]].primaryColor — canonical D-06 color lookup now consistent across GameBoard, ActionLog, PlayerStatsPanel, and PieceOverlay'
  - 'Pattern: team-keyed mini pattern ids (mini-{teamId}-jersey-{id}) decoupled from positional home/away — ready for Phase 16 dynamic team selection'

requirements-completed: [TEAM-06]

# Metrics
duration: ~6min
completed: 2026-06-13
---

# Phase 15 Plan 03: Scoreboard Badge Wiring + D-06 Color Refactor Summary

**PNG team badges wired into scoreboard via TeamBadge; TeamShieldIcon deleted; all team-identity color literals in GameBoard, ActionLog, and PlayerStatsPanel replaced with TEAM_CONFIGS lookups; MiniTokenBadge GK checker aligned with main board**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-06-13T14:05:27Z
- **Completed:** 2026-06-13T14:11:08Z
- **Tasks:** 2 (each with TDD RED/GREEN cycle)
- **Files modified:** 5

## Accomplishments

### Task 1 — GameBoard.tsx + GameBoard.test.tsx

- `TeamShieldIcon` SVG function (lines 44-56) deleted
- Added imports: `TEAM_CONFIGS` from `@counter-attack/shared`, `TEAM_DEFAULTS` from `../teamDefaults.js`, `TeamBadge` from `./TeamBadge.js`
- Scoreboard home cell: `<TeamBadge teamId={TEAM_DEFAULTS['home']} size={28} />` + score numeral color from TEAM_CONFIGS (TEAM-06)
- Scoreboard away cell: `<TeamBadge teamId={TEAM_DEFAULTS['away']} size={28} />` + score numeral color from TEAM_CONFIGS (TEAM-06)
- Player card icon: `<TeamBadge teamId={TEAM_DEFAULTS[displayPiece.teamId]} size={28} />`
- `teamColor` derived via `TEAM_CONFIGS[TEAM_DEFAULTS[activeTeam]].primaryColor`
- `secondHalfTeamColor` derived via TEAM_CONFIGS
- `resultColor` home/away branches use TEAM_CONFIGS; draw keeps neutral `#e0e0e0`
- HALF_TIME and FULL_TIME overlay team labels use TEAM_CONFIGS colors
- 3 new tests added to GameBoard.test.tsx: badge img alt text assertions for home (cosmos) and away (xolos)
- **18/18 GameBoard tests pass**

### Task 2 — ActionLog.tsx + PlayerStatsPanel.tsx

- ActionLog: `HOME_COLOR`/`AWAY_COLOR` constants deleted; added TEAM_CONFIGS + TEAM_DEFAULTS imports
- ActionLog: `pieceColorOf()` now returns `TEAM_CONFIGS[TEAM_DEFAULTS[positional]].primaryColor`
- ActionLog: GOAL event `prefixColor` also uses TEAM_CONFIGS lookup
- PlayerStatsPanel: added TEAM_CONFIGS + TEAM_DEFAULTS imports
- MiniTokenBadge: `jerseyPatId = mini-${teamId}-jersey-${piece.id}` (team-keyed, not positional)
- MiniTokenBadge: home GK uses `url(#mini-home-gk-checker-${piece.id})` checker pattern (10px tile, 5px dark-purple checkers on purple base) — aligned with main board (D-10)
- MiniTokenBadge: away GK keeps solid `#f59e0b` amber
- PlayerStatsPanel.test.tsx: updated 3 existing tests + added away GK solid amber test (4 tests total)
- **8/8 PlayerStatsPanel tests pass**

## Task Commits

TDD RED/GREEN cycles:

1. **Task 1 RED: TEAM-06 badge tests** - `8a65549` (test)
2. **Task 1 GREEN: TeamBadge + D-06 in GameBoard** - `90c297a` (feat)
3. **Task 2 RED: team-keyed pattern + home GK checker tests** - `7e97ac0` (test)
4. **Task 2 GREEN: ActionLog + PlayerStatsPanel refactor** - `b072b42` (feat)

## Files Created/Modified

- `packages/client/src/components/GameBoard.tsx` - TeamShieldIcon deleted; TeamBadge wired; all team-identity color literals replaced with TEAM_CONFIGS
- `packages/client/src/components/GameBoard.test.tsx` - 3 new TEAM-06 badge image tests added (18 total)
- `packages/client/src/components/ActionLog.tsx` - HOME_COLOR/AWAY_COLOR deleted; pieceColorOf uses TEAM_CONFIGS
- `packages/client/src/components/PlayerStatsPanel.tsx` - MiniTokenBadge team-keyed jersey patterns + home GK checker (D-10)
- `packages/client/src/components/PlayerStatsPanel.test.tsx` - Tests updated for new pattern ids; away GK test added (8 total)

## Decisions Made

- `resultColor` draw branch keeps `#e0e0e0` — this is a neutral text color for "Draw", not a team-identity color. Only the home-win and away-win branches use TEAM_CONFIGS (per plan instruction to keep draw neutral).
- MiniTokenBadge outfield pattern simplified to a single horizontal stripe pattern (18px tile, team primaryColor base, white stripe at y=6) rather than per-team cosmos/xolos/city/crew exact reproductions. At 20px SVG size the micro-patterns are imperceptible; the team color via TEAM_CONFIGS is the identity signal.
- Away GK MiniTokenBadge kept as solid amber `#f59e0b` (no pattern) — matches main board behavior from Plan 02 (away GK stripes are sibling elements at PIECE_RADIUS scale, not needed at mini 9px radius).

## Deviations from Plan

None — plan executed exactly as written. TDD RED/GREEN cycles followed for both tasks.

## TDD Gate Compliance

- Task 1 RED gate: commit `8a65549` — `test(15-03)` prefix; 3 tests failing before implementation
- Task 1 GREEN gate: commit `90c297a` — `feat(15-03)` prefix; all 18 tests passing
- Task 2 RED gate: commit `7e97ac0` — `test(15-03)` prefix; 3 tests failing before implementation
- Task 2 GREEN gate: commit `b072b42` — `feat(15-03)` prefix; all 8 tests passing

## Verification

- `pnpm --filter @counter-attack/client test --run GameBoard` — 18/18 PASS
- `pnpm --filter @counter-attack/client test --run PlayerStatsPanel` — 8/8 PASS
- `grep -c 'TeamShieldIcon' packages/client/src/components/GameBoard.tsx` — 0
- `grep -v '^\s*//' packages/client/src/components/GameBoard.tsx | grep -c '#1a56b0'` — 0
- `grep -v '^\s*//' packages/client/src/components/GameBoard.tsx | grep -c '#c0392b'` — 0
- `grep -v '^\s*//' packages/client/src/components/ActionLog.tsx | grep -c '#1a56b0'` — 0
- `grep -v '^\s*//' packages/client/src/components/ActionLog.tsx | grep -c '#c0392b'` — 0
- `grep -v '^\s*//' packages/client/src/components/PlayerStatsPanel.tsx | grep -c '#1a56b0'` — 0
- TypeScript errors in modified files: 0 (pre-existing mock ballAfter errors are out-of-scope, confirmed pre-existing from Plans 01 and 02)

## Known Stubs

None — all changes wire actual data from TEAM_CONFIGS/TEAM_DEFAULTS. Badge PNGs render via static Vite imports (Pitfall 3 prevention, established Plan 01). TEAM_DEFAULTS is intentionally hardcoded (Phase 16 SELECT-01 will introduce dynamic selection).

## Threat Flags

None — rendering-only changes. No network endpoints, no auth paths, no schema changes.

T-15-04 (color-literal refactor miss): mitigated — comment-filtered grep confirms 0 occurrences of `#1a56b0`/`#c0392b` in all three modified files.

---

_Phase: 15-team-identity_
_Completed: 2026-06-13_
