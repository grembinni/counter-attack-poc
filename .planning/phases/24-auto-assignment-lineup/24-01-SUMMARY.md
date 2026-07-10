---
phase: 24-auto-assignment-lineup
plan: 01
subsystem: api
tags: [socket.io, typescript, events, shared-types]

# Dependency graph
requires:
  - phase: 23-formation-system
    provides: FormationId and BOTH_FORMATIONS_CONFIRMED event — the trigger for Phase 24 lineup flow
provides:
  - Four Phase 24 lineup socket event names with typed payload signatures in packages/shared/src/events.ts
  - ClientEvents.LINEUP_SWAP and ClientEvents.LINEUP_CONFIRM for Plan 03 server handlers
  - ServerEvents.LINEUP_ASSIGNMENT_READY and ServerEvents.LINEUP_ASSIGNMENT_UPDATED for Plan 04 client
affects:
  - 24-02 (computeAutoAssignment + roomStore)
  - 24-03 (server LINEUP_SWAP + LINEUP_CONFIRM handlers)
  - 24-04 (LineupAssignmentScreen client component)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Const-object event names with JSDoc Phase + Decision references (existing pattern extended)
    - Typed interface computed-property keys referencing const values for compile-time event safety

key-files:
  created: []
  modified:
    - packages/shared/src/events.ts

key-decisions:
  - 'LINEUP_SWAP payload uses { slotIndexA, slotIndexB } (D-08) — both numeric slot indices'
  - 'LINEUP_CONFIRM payload uses { confirmedOrder: string[] } (D-10) — server ignores and uses stored state (ASVS V5)'
  - 'LINEUP_ASSIGNMENT_READY and LINEUP_ASSIGNMENT_UPDATED both carry assignment: string[] (PlayerId[]) of 11 entries (D-06, D-07, D-12)'

patterns-established:
  - 'Phase 24 event naming: lineup: namespace prefix for all four new events'

requirements-completed: [ASSIGN-02, ASSIGN-03, ASSIGN-05]

# Metrics
duration: 2min
completed: 2026-07-10
---

# Phase 24 Plan 01: Event Contracts Summary

**Four Phase 24 lineup socket events added to shared events.ts: LINEUP_SWAP, LINEUP_CONFIRM (client-to-server) and LINEUP_ASSIGNMENT_READY, LINEUP_ASSIGNMENT_UPDATED (server-to-client) with fully typed payload signatures**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-07-10T17:26:16Z
- **Completed:** 2026-07-10T17:27:41Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments

- Extended `ClientEvents` const object with `LINEUP_SWAP: 'lineup:swap'` and `LINEUP_CONFIRM: 'lineup:confirm'`
- Extended `ServerEvents` const object with `LINEUP_ASSIGNMENT_READY: 'lineup:assignment-ready'` and `LINEUP_ASSIGNMENT_UPDATED: 'lineup:assignment-updated'`
- Added `ClientToServerEvents[LINEUP_SWAP]` typed as `(payload: { slotIndexA: number; slotIndexB: number }) => void`
- Added `ClientToServerEvents[LINEUP_CONFIRM]` typed as `(payload: { confirmedOrder: string[] }) => void`
- Added `ServerToClientEvents[LINEUP_ASSIGNMENT_READY]` and `[LINEUP_ASSIGNMENT_UPDATED]` each as `(assignment: string[]) => void`
- Shared package compiles clean; barrel re-export via `export * from './events.js'` propagates all symbols with no changes to index.ts

## Task Commits

Each task was committed atomically:

1. **Task 1: Add four lineup events + typed payload signatures to events.ts** - `435ef80` (feat)

**Plan metadata:** TBD (docs: complete plan)

## Files Created/Modified

- `packages/shared/src/events.ts` - Four new events in ClientEvents/ServerEvents const objects and matching entries in ClientToServerEvents/ServerToClientEvents typed interfaces

## Decisions Made

None - followed plan as specified. All event names, payload shapes, and JSDoc references were pre-decided in CONTEXT.md D-07/D-08/D-10/D-12 and RESEARCH.md Pattern 3.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All four Phase 24 event names and typed payload signatures are now importable from `@counter-attack/shared`
- Plan 02 (computeAutoAssignment + roomStore fields) and Plan 03 (server handlers) can consume these event names without re-reading shared types
- Plan 04 (LineupAssignmentScreen) can consume `ServerEvents.LINEUP_ASSIGNMENT_READY` and `ServerEvents.LINEUP_ASSIGNMENT_UPDATED` for socket.on registration

---

_Phase: 24-auto-assignment-lineup_
_Completed: 2026-07-10_
