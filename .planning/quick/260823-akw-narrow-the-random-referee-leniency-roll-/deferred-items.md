# Deferred Items — 260823-akw

## Pre-existing `pnpm format:check` failures (out of scope)

`pnpm format:check` fails repo-wide on 12 files that are unrelated to this task and were already unformatted before this task began (confirmed via `git diff HEAD -- <file>` showing no changes, and `git log` showing their last touch was an unrelated prior commit):

- `.planning/debug/resolved/shot-range-gate-no-filter.md`
- `.planning/debug/resolved/snapshot-shot-flow-mismatch.md`
- `.planning/quick/260621-b8f-add-missing-or-improperly-merged-actionl/260621-b8f-PLAN.md`
- `packages/client/index.html`
- `packages/client/src/App.module.css`
- `packages/client/src/components/ActionPanel.module.css`
- `packages/client/src/components/CardInjuryBadge.audit.test.ts`
- `packages/client/src/components/PlayerStatsPanel.module.css`
- `packages/client/src/components/TeamSelectionScreen.module.css`
- `packages/client/src/index.css`
- `packages/server/src/__tests__/gameEngine.teamselect.test.ts`
- `packages/server/src/__tests__/kickoffDebug.test.ts`

None of the 3 files this task modified (`packages/shared/src/types.ts`, `packages/shared/README.md`, `.planning/REQUIREMENTS.md`) are in this list — those three are prettier-clean after the Task 2 edits. Per the scope boundary rule (only auto-fix issues directly caused by the current task's changes), these 12 pre-existing files were left untouched rather than reformatted.
