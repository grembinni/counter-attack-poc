---
phase: 03-server-room-manager-socket-io-scaffold
plan: '01'
subsystem: infra
tags: [express, socket.io, cors, nanoid, tsx, vitest, typescript, monorepo]

requires:
  - phase: 01-monorepo-scaffold-shared-types
    provides: pnpm workspace structure, shared types package, tsconfig.base.json

provides:
  - packages/server runtime deps (express@4.22.2, socket.io@4.8.3, cors@2.8.6, nanoid@5.1.11)
  - packages/server dev deps (tsx@4.22.3, vitest@2.1.9, socket.io-client@4.8.3, @types/express@5.0.6, @types/cors@2.8.19)
  - packages/server vitest test runner wired (scripts.test = vitest run)
  - packages/server/vitest.config.ts with src/**/*.test.ts glob and node environment
  - packages/shared/src/events.ts SocketData extended with sessionToken?: string and all three fields optional

affects:
  - 03-02 (roomStore.ts and sessionMiddleware.ts can assign socket.data.sessionToken without TypeScript errors)
  - 03-03 (integration tests can run via pnpm --filter @counter-attack/server test)

tech-stack:
  added:
    - express@4.22.2
    - socket.io@4.8.3
    - cors@2.8.6
    - nanoid@5.1.11
    - tsx@4.22.3
    - vitest@2.1.9 (pinned to match packages/shared)
    - socket.io-client@4.8.3
    - '@types/express@5.0.6'
    - '@types/cors@2.8.19'
  patterns:
    - vitest.config.ts exact-copy pattern across workspace packages
    - SocketData optional fields pattern for pre-connection socket state
    - TDD RED/GREEN on type-level changes verified via source file text assertions

key-files:
  created:
    - packages/server/vitest.config.ts
    - packages/shared/src/events.test.ts
  modified:
    - packages/server/package.json
    - packages/shared/src/events.ts
    - pnpm-lock.yaml

key-decisions:
  - 'Vitest pinned to 2.1.9 in server package to match shared — avoids version mismatch between workspace packages'
  - 'All SocketData fields widened to optional — brand-new sockets pre-middleware have no playerSlot/roomCode/sessionToken'
  - 'eslint-disable added to pre-existing empty InterServerEvents interface (required Socket.io type parameter, not a real object)'

patterns-established:
  - 'vitest.config.ts: exact verbatim copy across packages (shared and server)'
  - 'SocketData optional fields: all socket.data fields are optional at the type level'

requirements-completed:
  - ARCH-01

duration: 4min
completed: '2026-05-29'
---

# Phase 3 Plan 01: Server Deps + SocketData sessionToken Extension Summary

**Express + Socket.io runtime deps installed, vitest 2.1.9 wired, and SocketData extended with optional sessionToken field to unblock Plans 02 and 03**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-05-29T18:08:53Z
- **Completed:** 2026-05-29T18:12:57Z
- **Tasks:** 3 (Task 3 used TDD: 2 commits — test RED + feat GREEN)
- **Files modified:** 5 (package.json, vitest.config.ts, events.ts, events.test.ts, pnpm-lock.yaml)

## Accomplishments

- Installed 9 packages into packages/server with exact version pins from RESEARCH.md (no peer warnings)
- Wired `vitest run` into scripts.test and added `tsx watch src/main.ts` to scripts.dev
- Created packages/server/vitest.config.ts as verbatim copy of packages/shared/vitest.config.ts
- Extended SocketData interface with `sessionToken?: string` and widened playerSlot/roomCode to optional
- All 99 shared tests pass; pnpm -r build exits 0

## Installed Package Versions (vs RESEARCH.md Standard Stack pins)

| Package          | Installed | Research Pin                   | Match |
| ---------------- | --------- | ------------------------------ | ----- |
| express          | 4.22.2    | 4.22.2                         | yes   |
| socket.io        | 4.8.3     | 4.8.3                          | yes   |
| cors             | 2.8.6     | 2.8.6                          | yes   |
| nanoid           | 5.1.11    | 5.1.11                         | yes   |
| tsx              | 4.22.3    | 4.22.3                         | yes   |
| vitest           | 2.1.9     | 2.1.9 (pinned to match shared) | yes   |
| @types/express   | 5.0.6     | 5.0.6                          | yes   |
| @types/cors      | 2.8.19    | 2.8.19                         | yes   |
| socket.io-client | 4.8.3     | 4.8.3                          | yes   |

## pnpm Peer Dependency Warnings

None — `pnpm install` exited 0 with no peer warnings.

## SocketData Interface (final shape)

```typescript
/**
 * Per-socket data stored by Socket.io.
 * All fields are optional: brand-new sockets connecting through io.use() middleware
 * have none of these set yet. The session middleware populates sessionToken first;
 * playerSlot and roomCode are set when the socket joins a room.
 */
export interface SocketData {
  playerSlot?: 1 | 2;
  roomCode?: string;
  sessionToken?: string;
}
```

## pnpm -r build Confirmation

`pnpm -r build` exits 0. Output:

- packages/shared build: tsc — Done
- packages/client build: echo placeholder — Done
- packages/server build: tsc — Done

## Task Commits

Each task was committed atomically:

1. **Task 1: Install server deps and wire vitest test script** - `f599ed6` (feat)
2. **Task 2: Create vitest.config.ts for packages/server** - `1b8ff1d` (chore)
3. **Task 3 RED: Add failing tests for SocketData sessionToken extension** - `923f651` (test)
4. **Task 3 GREEN: Extend SocketData with sessionToken and make all fields optional** - `8dac765` (feat)

## Files Created/Modified

- `packages/server/package.json` - Added 9 runtime/dev deps, wired scripts.test and scripts.dev
- `packages/server/vitest.config.ts` - New file, verbatim copy of shared vitest config
- `packages/shared/src/events.ts` - SocketData extended with sessionToken?, fields widened to optional
- `packages/shared/src/events.test.ts` - New test file verifying SocketData shape (TDD RED/GREEN)
- `pnpm-lock.yaml` - Updated with resolved hashes for all new deps

## Decisions Made

- Vitest pinned to 2.1.9 in packages/server to match packages/shared — RESEARCH.md Open Question A6 explicitly warns against using 4.1.7
- All three SocketData fields made optional to reflect real socket lifecycle: sockets connecting through `io.use()` middleware have no playerSlot or roomCode yet
- `eslint-disable-next-line @typescript-eslint/no-empty-object-type` added to pre-existing `InterServerEvents {}` — the empty interface is required as a Socket.io type generic parameter, not an accidental empty type

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] ESLint pre-commit hook failure on pre-existing empty InterServerEvents**

- **Found during:** Task 3 GREEN (commit of events.ts changes)
- **Issue:** The pre-existing `export interface InterServerEvents {}` triggered `@typescript-eslint/no-empty-object-type` lint error when the pre-commit hook ran against the staged file. The error was not present before because the file had not been staged in this worktree session.
- **Fix:** Added `// eslint-disable-next-line @typescript-eslint/no-empty-object-type` before the interface. The interface is a required type parameter for Socket.io Server generic — it cannot be removed.
- **Files modified:** packages/shared/src/events.ts
- **Verification:** Commit succeeded; eslint exit 0; 99 tests pass
- **Committed in:** 8dac765 (Task 3 GREEN commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - pre-commit lint fix for pre-existing issue exposed by staged file)
**Impact on plan:** Minimal — one-line comment added. No scope creep. Required to allow commit to proceed.

## Issues Encountered

- `pnpm --filter @counter-attack/shared exec vitest run` failed with "vitest not recognized" until `pnpm install` was run from the repo root to hydrate the worktree node_modules. This is expected worktree behavior (node_modules not pre-populated) and resolved by running install.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Plans 02 and 03 can proceed immediately
- `pnpm --filter @counter-attack/server test` will run via the vitest config
- `socket.data.sessionToken` assignment in sessionMiddleware.ts will compile without TypeScript errors
- Workspace:\* link to @counter-attack/shared preserved in server package.json

---

_Phase: 03-server-room-manager-socket-io-scaffold_
_Completed: 2026-05-29_
