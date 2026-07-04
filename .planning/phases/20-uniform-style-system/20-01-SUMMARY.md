---
phase: 20-uniform-style-system
plan: '01'
subsystem: shared-types
tags: [svg, uniform, palette, shared-types, typescript]
dependency_graph:
  requires: []
  provides:
    - UniformStyleId (packages/shared/src/uniformStyles.ts)
    - UniformStyleMeta (packages/shared/src/uniformStyles.ts)
    - UNIFORM_STYLE_META (packages/shared/src/uniformStyles.ts)
    - TeamConfig.defaultUniformStyle (packages/shared/src/teamConfig.ts)
  affects:
    - packages/shared/src/index.ts (barrel export)
    - Plan 20-02 (client renderer library consumes UniformStyleId)
    - Plan 20-03 (PieceOverlay consumes TeamConfig.defaultUniformStyle)
tech_stack:
  added: []
  patterns:
    - TypeScript string union + Record<Id, Meta> registry (modeled on TeamId/COLOR_SCHEME_REGISTRY)
    - Barrel re-export pattern (modeled on existing Phase 17 offside.js export)
key_files:
  created:
    - packages/shared/src/uniformStyles.ts
  modified:
    - packages/shared/src/teamConfig.ts
    - packages/shared/src/index.ts
decisions:
  - '12-member UniformStyleId union defines the complete style set for Phase 20-22'
  - 'City default: pinstripe (D-01); Crew default: diagonal (D-02)'
  - 'UNIFORM_STYLE_META typed as Record<UniformStyleId,UniformStyleMeta> enforces all 12 keys at compile time'
  - 'No JSX in shared package — renderer functions deferred to client package (Plan 20-02)'
metrics:
  duration: '7 minutes'
  completed: '2026-07-04T04:18:48Z'
  tasks_completed: 2
  tasks_total: 2
  files_changed: 3
requirements:
  - UNIFORM-01
  - UNIFORM-05
---

# Phase 20 Plan 01: Shared Uniform Type Contract Summary

**One-liner:** 12-member UniformStyleId string union + UNIFORM_STYLE_META registry added to shared package, with TeamConfig.defaultUniformStyle field wired for City=pinstripe and Crew=diagonal.

---

## Tasks Completed

| Task | Name                                               | Commit    | Files                                                           |
| ---- | -------------------------------------------------- | --------- | --------------------------------------------------------------- |
| 1    | Create shared uniformStyles.ts                     | `4cc9113` | packages/shared/src/uniformStyles.ts (created)                  |
| 2    | Add TeamConfig.defaultUniformStyle + barrel export | `5b824d7` | packages/shared/src/teamConfig.ts, packages/shared/src/index.ts |

---

## What Was Built

### Task 1: packages/shared/src/uniformStyles.ts

Created the foundational type contract for the uniform style system with:

- `export type UniformStyleId` — 12-member string literal union: `'pinstripe' | 'diagonal' | 'checker' | 'cosmos' | 'plus' | 'v-stripe' | 'quarters' | 'polka-dots' | 'fade' | 'tree-rings' | 'corners' | 'solid'`
- `export interface UniformStyleMeta` — `{ id: UniformStyleId; name: string; description: string; }`
- `export const UNIFORM_STYLE_META: Record<UniformStyleId, UniformStyleMeta>` — 12 entries, one per style, with human-readable name and one-line description

No React/JSX imports. Complies with shared package constraint (renderer functions live in Plan 20-02 client package).

### Task 2: TeamConfig extension + barrel export

- Added `import type { UniformStyleId } from './uniformStyles.js'` to `teamConfig.ts`
- Added required field `defaultUniformStyle: UniformStyleId` to `TeamConfig` interface (after `badgeFile`)
- Assigned `defaultUniformStyle: 'pinstripe'` to `TEAM_CONFIGS.city` (D-01)
- Assigned `defaultUniformStyle: 'diagonal'` to `TEAM_CONFIGS.crew` (D-02)
- Added `export * from './uniformStyles.js'; // Phase 20` to `packages/shared/src/index.ts`
- Workspace type-checks clean (`tsc --noEmit` passes for all 3 packages)

---

## Verification Results

| Check                                               | Result |
| --------------------------------------------------- | ------ |
| 12 UniformStyleId members present                   | PASS   |
| No React/JSX import in shared file                  | PASS   |
| UNIFORM_STYLE_META const present                    | PASS   |
| TeamConfig.defaultUniformStyle field exists         | PASS   |
| TEAM_CONFIGS.city defaultUniformStyle = 'pinstripe' | PASS   |
| TEAM_CONFIGS.crew defaultUniformStyle = 'diagonal'  | PASS   |
| Barrel export in index.ts                           | PASS   |
| packages/shared tsc --noEmit                        | PASS   |
| packages/client tsc --noEmit                        | PASS   |
| packages/server tsc --noEmit                        | PASS   |

---

## Deviations from Plan

**1. [Rule 3 - Blocking Issue] Worktree node_modules missing for pre-commit hook**

- **Found during:** Task 1 commit
- **Issue:** `pnpm exec lint-staged` failed in the worktree because no `node_modules` directory was present. The worktree is a linked checkout with no independent package installation.
- **Fix:** Created Windows junction points from worktree `node_modules` directories to the main repo equivalents (`node_modules`, `packages/client/node_modules`, `packages/server/node_modules`, `packages/shared/node_modules`). This allows `pnpm exec lint-staged` and `tsc` to resolve correctly within the worktree.
- **Files modified:** No source files — filesystem junctions only (not committed to git).
- **Commit:** N/A (infrastructure fix, not a code change)

---

## Known Stubs

None — this plan creates type definitions only. No UI rendering, no data flow, no placeholder values. The `UNIFORM_STYLE_META` descriptions are intentionally brief (one-line visual descriptions for Phase 22 selection UI) and are complete for their purpose.

---

## Threat Flags

None — no network endpoints, no auth paths, no file access patterns, no schema changes at trust boundaries. Pure TypeScript type additions in the shared package.

---

## Self-Check

- [x] `packages/shared/src/uniformStyles.ts` exists
- [x] `packages/shared/src/teamConfig.ts` contains `defaultUniformStyle: UniformStyleId`
- [x] `packages/shared/src/index.ts` contains `export * from './uniformStyles.js'`
- [x] Commit `4cc9113` exists (Task 1)
- [x] Commit `5b824d7` exists (Task 2)

## Self-Check: PASSED
