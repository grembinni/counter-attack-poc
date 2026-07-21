---
phase: 29-draft-ui-pick-and-swap-flow
plan: 01
subsystem: api
tags: [typescript, socket.io, shared-types, draft-mode]

requires:
  - phase: 28-draft-data-model
    provides: draftEngine.ts (TieredPoolPlayer, DraftPack, generateMatchPacks), DraftPoolId/DraftTier/PACKS_PER_MATCH/PACK_COMPOSITION types
provides:
  - 'DraftSubStep, DraftDestination, DraftSlotRef, DraftPickPayload, DraftRearrangePayload types'
  - 'DraftSession (server-authoritative draft state) and DraftClientView (privacy-scoped per-player view) types'
  - 'ClientEvents.DRAFT_PICK / DRAFT_REARRANGE and ServerEvents.DRAFT_STATE_UPDATED typed events'
  - 'Room.draftSession optional field on the server room store'
affects:
  [29-02-draft-state-machine, 29-03-client-carousel, 29-04-server-wiring, 29-05-client-screen]

tech-stack:
  added: []
  patterns:
    - 'Type-only circular import (types.ts <-> draftEngine.ts) via `import type` + verbatimModuleSyntax, erased at compile time — no runtime cycle'
    - 'DraftClientView structurally excludes opponent-pack fields to enforce D-14 privacy at the type level (T-29-PRIV)'

key-files:
  created: []
  modified:
    - packages/shared/src/types.ts
    - packages/shared/src/events.ts
    - packages/server/src/roomStore.ts

key-decisions:
  - "DraftSession fields refined beyond RESEARCH.md's draft shape per PLAN.md spec: homePicksRemaining/awayPicksRemaining (numeric, replacing the boolean homePickedThisSubStep/awayPickedThisSubStep flags sketched in RESEARCH.md) and homeBenchNumbers/awayBenchNumbers + keeperAutoPickedThisCycle object added for DRAFT-08/DRAFT-10 support — PLAN.md's task spec is the authoritative shape, RESEARCH.md's code example was illustrative only"
  - 'types.ts imports TieredPoolPlayer/DraftPack from draftEngine.ts via `import type` only — verbatimModuleSyntax erases the import at compile time, so no runtime circular dependency is introduced even though draftEngine.ts imports value consts from types.ts'

patterns-established:
  - 'DraftDestination (drop target: slot|bench, no benchIndex) vs DraftSlotRef (source/target with benchIndex) — distinct discriminated unions because a destination bench drop is always an append, while addressing an existing bench card for rearrangement needs its index'

requirements-completed: [DRAFT-06, DRAFT-07, DRAFT-08, DRAFT-09, DRAFT-10]

duration: ~15min
completed: 2026-07-21
---

# Phase 29 Plan 01: Draft Shared Type + Event Contract Summary

**New DraftSession/DraftClientView types, DRAFT_PICK/DRAFT_REARRANGE/DRAFT_STATE_UPDATED typed Socket.io events, and Room.draftSession field — the interface-first contract every other Phase 29 plan compiles against.**

## Performance

- **Duration:** ~15 min (includes one-time `pnpm install` to populate the worktree's missing `node_modules`)
- **Completed:** 2026-07-21
- **Tasks:** 2/2 completed
- **Files modified:** 3

## Accomplishments

- Added 7 new exported types to `packages/shared/src/types.ts`: `DraftSubStep`, `DraftDestination`, `DraftSlotRef`, `DraftPickPayload`, `DraftRearrangePayload`, `DraftSession`, `DraftClientView`
- `DraftClientView` is structurally opponent-pack-free — `currentPack: TieredPoolPlayer[]` is the only pack field, with no `homeCurrentPack`/`awayCurrentPack`/`opponentPack` member possible (T-29-PRIV mitigation enforced at the type level)
- Wired three new Socket.io events into the typed event maps: `ClientEvents.DRAFT_PICK` ('draft:pick'), `ClientEvents.DRAFT_REARRANGE` ('draft:rearrange'), `ServerEvents.DRAFT_STATE_UPDATED` ('draft:state-updated'), each with full `ClientToServerEvents`/`ServerToClientEvents` signatures
- Added `Room.draftSession?: DraftSession | null` to `packages/server/src/roomStore.ts`, left uninitialized in `createRoom` (matches the existing `homeAssignment`-style lazy-population convention; Plan 04 will populate it in the settings handler)

## Task Commits

Each task was committed atomically:

1. **Task 1: Add draft session + client-view types to the shared package** - `93b0860` (feat)
2. **Task 2: Add the three draft events and the Room.draftSession field** - `a225a69` (feat)

## Files Created/Modified

- `packages/shared/src/types.ts` - Added `DraftSubStep`, `DraftDestination`, `DraftSlotRef`, `DraftPickPayload`, `DraftRearrangePayload`, `DraftSession`, `DraftClientView`; added a type-only import of `TieredPoolPlayer`/`DraftPack` from `./draftEngine.js`
- `packages/shared/src/events.ts` - Added `DRAFT_PICK`/`DRAFT_REARRANGE` to `ClientEvents`, `DRAFT_STATE_UPDATED` to `ServerEvents`, plus their `ClientToServerEvents`/`ServerToClientEvents` signatures; imported `DraftClientView`/`DraftPickPayload`/`DraftRearrangePayload` from `./types.js`
- `packages/server/src/roomStore.ts` - Added `draftSession?: DraftSession | null` field to the `Room` type; imported `DraftSession` from `@counter-attack/shared`

## Decisions Made

- Circular-import check (per Task 1's `<action>` instruction): `types.ts` now type-imports `TieredPoolPlayer`/`DraftPack` from `draftEngine.ts`, while `draftEngine.ts` already value-imports `DraftPoolId`/`DraftTier`/`PACKS_PER_MATCH`/etc. from `types.ts`. Since the new import in `types.ts` is `import type` only and the workspace has `verbatimModuleSyntax: true`, the import is fully erased at compile time — `tsc --noEmit` confirmed zero errors in both `@counter-attack/shared` and `@counter-attack/server`, and `pnpm -r build` succeeded end-to-end (shared, server, client). No fallback to re-exporting from `draftEngine.ts` was needed.
- `DraftSession`'s field list follows PLAN.md's task action text exactly (which is more detailed than RESEARCH.md's illustrative code example) — notably `homePicksRemaining`/`awayPicksRemaining` (numeric picks-left counters) instead of RESEARCH.md's boolean `homePickedThisSubStep`/`awayPickedThisSubStep` flags, plus `homeBenchNumbers`/`awayBenchNumbers` and a `keeperAutoPickedThisCycle: { home: boolean; away: boolean }` object that RESEARCH.md's sketch omitted. This is expected — RESEARCH.md is explicitly marked as a "recommended shape" while PLAN.md's task spec is the executable contract for this plan.

## Deviations from Plan

None - plan executed exactly as written. Both tasks matched their `<action>` blocks verbatim; no Rule 1-4 auto-fixes were needed.

## Issues Encountered

- The worktree had no `node_modules` (a plain git worktree checkout does not carry the parent repo's installed dependencies). Per project memory (`feedback_worktree_junction_risk.md`), Windows directory-junction workarounds pointing at the main repo's `node_modules` are unsafe and have previously caused destructive deletions during cleanup. Instead, ran a standard `pnpm install --frozen-lockfile` inside the worktree, which resolved all 429 packages from the existing global pnpm content-addressable store with zero downloads and did not touch the main repo's `node_modules` in any way. This is the safe, standard fix and required no cleanup step afterward.
- `pnpm --filter @counter-attack/server typecheck` initially failed with `Cannot find module '@counter-attack/shared'` — root cause: `@counter-attack/shared`'s `package.json` resolves via its `dist/` build output, which didn't exist yet in the freshly-installed worktree. Ran `pnpm --filter @counter-attack/shared build` once, after which the server typecheck passed cleanly. This is a normal monorepo build-order requirement, not a plan deviation.

## Next Phase Readiness

- `@counter-attack/shared` now exports the full draft session/event type contract; Plan 02 (server state machine), Plan 03 (client carousel), Plan 04 (server wiring), and Plan 05 (client screen) can all compile against these exact type/event names without exploring the codebase for contracts.
- `pnpm -r build` succeeds across shared/server/client with the additive changes — no existing type/event was removed or renamed, Standard-mode flow is untouched.
- No blockers for downstream plans.

---

_Phase: 29-draft-ui-pick-and-swap-flow_
_Completed: 2026-07-21_

## Self-Check: PASSED

All claimed files exist and both task commits (`93b0860`, `a225a69`) are present in git log.
