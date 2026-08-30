# Deferred Items

## Plan 42-11

- **Pre-existing `pnpm format:check` warnings (13 files)** — discovered while running the plan's
  `<verification>` step. None of the flagged files were touched by this plan (`DraftPackCarousel.tsx`,
  `BenchCarousel.test.tsx`, `CardInjuryBadge.crossSurface.test.tsx`, `LineupAssignmentScreen.test.tsx`
  are all clean). Out of scope per the executor's scope-boundary rule (only auto-fix issues directly
  caused by the current task's changes). Files flagged: `.planning/debug/resolved/shot-range-gate-no-filter.md`,
  `.planning/debug/resolved/snapshot-shot-flow-mismatch.md`,
  `.planning/quick/260621-b8f-add-missing-or-improperly-merged-actionl/260621-b8f-PLAN.md`,
  `packages/client/index.html`, `packages/client/src/App.module.css`,
  `packages/client/src/components/ActionPanel.module.css`,
  `packages/client/src/components/CardInjuryBadge.audit.test.ts`,
  `packages/client/src/components/LineupAssignmentScreen.module.css`,
  `packages/client/src/components/PlayerStatsPanel.module.css`,
  `packages/client/src/components/TeamSelectionScreen.module.css`,
  `packages/client/src/index.css`, `packages/server/src/__tests__/gameEngine.teamselect.test.ts`,
  `packages/server/src/__tests__/kickoffDebug.test.ts`. Not fixed; logged only.
