---
phase: quick-260612-kvw
plan: 01
subsystem: client-ui
tags: [ui-polish, gameboard, actionpanel, kickoff, side-log, scores]
dependency_graph:
  requires: []
  provides: [gameboard-score-centre, side-log-panel, compact-actionpanel, compact-kickoff]
  affects:
    [
      GameBoard.tsx,
      GameBoard.module.css,
      ActionPanel.tsx,
      ActionPanel.module.css,
      KickOffSetupPanel.tsx,
      KickOffSetupPanel.module.css,
    ]
tech_stack:
  added: []
  patterns: [inline-component-SideLog, css-width-transition, flex-row-pitch-layout]
key_files:
  created: []
  modified:
    - packages/client/src/components/GameBoard.tsx
    - packages/client/src/components/GameBoard.module.css
    - packages/client/src/components/ActionPanel.tsx
    - packages/client/src/components/ActionPanel.module.css
    - packages/client/src/components/KickOffSetupPanel.tsx
    - packages/client/src/components/KickOffSetupPanel.module.css
decisions:
  - 'SideLog uses two separate class names (sideLogCollapsed / sideLogExpanded) rather than a shared class with conditional modifier — CSS transition on width via separate rules'
  - 'Top band grid-template-columns reduced from 5 tracks (auto 1fr auto 1fr auto) to 4 tracks (auto 1fr 1fr auto); scoreboard auto-track removed entirely'
  - 'pitchRow is a flex row (not column) wrapping SideLog + pitchContainer; pitchContainer retains flex:1 to fill remaining width'
metrics:
  duration: '~8 minutes'
  completed: '2026-06-12'
  tasks_completed: 2
  files_modified: 6
---

# Quick Task 260612-kvw: GameBoard UI Polish — Scores Flanking Clock + Side Log

**One-liner:** Scores merged into centre section flanking the clock, log moved to a collapsible side panel, ActionPanel and KickOffSetupPanel compressed to fit 80px top band.

## Tasks Completed

| Task | Name                                                              | Commit  | Files                                                                                        |
| ---- | ----------------------------------------------------------------- | ------- | -------------------------------------------------------------------------------------------- |
| 1    | Merge scoreboard into centre + add side-log panel                 | ee41965 | GameBoard.tsx, GameBoard.module.css                                                          |
| 2    | Compact ActionPanel + rename One-Touch; compact KickOffSetupPanel | c89df7c | ActionPanel.tsx, ActionPanel.module.css, KickOffSetupPanel.tsx, KickOffSetupPanel.module.css |

## What Was Done

### Task 1 — GameBoard.tsx + GameBoard.module.css

- Removed `logExpanded` state, top-band log JSX (both logExpanded and logCollapsed branches), and scoreboard `<div className={styles.scoreboard}>` block.
- Replaced `<div className={styles.topBandSection}>` centre block with `<div className={styles.centreSection}>` containing a `scoreRow`: `[TeamShieldIcon home | home score numeral | clockDisplay | away score numeral | TeamShieldIcon away]`.
- Retained `connectionLine` and `phaseSummary` rows inside `centreSection`.
- Added inline `SideLog` component above `GameBoard`: collapsed (28px, `sideLogCollapsed` class, › chevron) or expanded (220px, `sideLogExpanded` class, MATCH LOG heading + `<ActionLog />`).
- Wrapped pitch area in `<div className={styles.pitchRow}>` containing `<SideLog />` + `<div className={styles.pitchContainer}>`.
- Updated `topBand` grid from `auto 1fr auto 1fr auto` to `auto 1fr 1fr auto` (4 tracks).
- Added CSS: `.centreSection`, `.scoreRow`, `.pitchRow`, `.sideLogCollapsed`, `.sideLogExpanded`, `.sideLogHeader`, `.sideLogChevron`.
- Removed CSS: `.scoreboard`, `.scoreIcon`, `.scoreDash`, `.logCollapsed`, `.logExpanded`, `.logChevron`, `.logHeader`.
- Reduced `.actionSection` padding from `8px` to `4px`.

### Task 2 — ActionPanel + KickOffSetupPanel

- `PASS_TYPE_LABELS.FIRST_TIME_PASS` changed from `'First-time Pass'` to `'One-Touch'`.
- Chooser button text for `FIRST_TIME_PASS` changed to `'One-Touch'`.
- `ActionPanel.module.css`: `.panel` padding `4px 6px`, gap `3px`; `.ctaButton` padding `3px 8px`, font-size `11px`; `.backButton` padding `2px 6px`, font-size `11px`; `.phaseLabel`, `.gkLabel`, `.errorText` all `11px`.
- `KickOffSetupPanel.tsx`: removed `<p className={styles.instruction}>` paragraph.
- `KickOffSetupPanel.module.css`: removed `.instruction` rule; `.panel` padding `6px 8px`, gap `4px`; `.panelHeading` `12px`; `.constraintRow` `11px`; `.ctaButton` padding `4px 10px`, font-size `11px`; `.errorText` `11px`.

## Verification

- 15/15 GameBoard.test.tsx tests pass after both tasks.
- `pnpm --filter @counter-attack/client build` passes with zero TypeScript errors (117 modules, 953ms).
- Test for log toggle chevron `›` passes — chevron now comes from `SideLog` collapsed state (default).

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None.

## Threat Flags

None — no new network endpoints, auth paths, or schema changes introduced.

## Self-Check: PASSED

- packages/client/src/components/GameBoard.tsx — committed in ee41965
- packages/client/src/components/GameBoard.module.css — committed in ee41965
- packages/client/src/components/ActionPanel.tsx — committed in c89df7c
- packages/client/src/components/ActionPanel.module.css — committed in c89df7c
- packages/client/src/components/KickOffSetupPanel.tsx — committed in c89df7c
- packages/client/src/components/KickOffSetupPanel.module.css — committed in c89df7c
