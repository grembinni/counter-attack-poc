---
phase: '07'
plan: '01'
subsystem: client
tags: [socket-io, zustand, vite, typescript, tdd]
dependency_graph:
  requires:
    - packages/shared/src/events.ts (ClientEvents, ServerToClientEvents, ClientToServerEvents)
    - packages/client/src/mock/index.js (mockMovementState for initial store state)
  provides:
    - packages/client/src/socket.ts (module-singleton typed Socket)
    - packages/client/src/store/useGameStore.ts (extended store with Phase 7 fields and emitters)
  affects:
    - packages/client/src/components/HexGrid.tsx (movePiece -> emitMove migration)
tech_stack:
  added: []
  patterns:
    - Module-singleton socket with autoConnect:false and localStorage auth callback
    - Zustand store emit actions: socket.emit wrapped in store methods
    - TDD cycle: RED (test(07-01)) -> GREEN (feat(07-01)) commits
key_files:
  created:
    - packages/client/src/socket.ts
  modified:
    - packages/client/vite.config.ts
    - packages/client/src/store/useGameStore.ts
    - packages/client/src/store/useGameStore.test.ts
    - packages/client/src/components/HexGrid.tsx
decisions:
  - autoConnect:false on socket creation; explicit connect() in App.tsx mount effect (D-02)
  - transports:['websocket'] only — no polling fallback (STATE.md locked decision)
  - socket.ts auth callback reads localStorage.ca_session_token on each connection attempt
  - emitMove uses positional args (pieceId, to) to match ClientToServerEvents[GAME_MOVE] signature
  - movePiece local-mutation removed; HexGrid.tsx migrated to emitMove (D-08)
  - exactOptionalPropertyTypes requires explicit null-guard before cb({sessionToken:token})
metrics:
  duration_minutes: 35
  completed_date: '2026-05-31'
  tasks_completed: 2
  tasks_total: 2
  files_created: 1
  files_modified: 4
---

# Phase 7 Plan 01: Socket Singleton + Store Extensions Summary

Module-singleton Socket.io client with autoConnect:false and Zustand store extended with six setters and six server-emit actions; movePiece local-mutation deleted and replaced by emitMove.

## Tasks Completed

| Task      | Name                                                     | Commit  | Files                                                                                 |
| --------- | -------------------------------------------------------- | ------- | ------------------------------------------------------------------------------------- |
| 1         | Create socket.ts singleton and add Vite dev proxy        | f8eae6d | packages/client/src/socket.ts, packages/client/vite.config.ts                         |
| 2 (RED)   | Add failing tests for Phase 7 store extensions           | 1457c3d | packages/client/src/store/useGameStore.test.ts                                        |
| 2 (GREEN) | Extend useGameStore with Phase 7 fields and emit actions | 6d29c53 | packages/client/src/store/useGameStore.ts, packages/client/src/components/HexGrid.tsx |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed HexGrid.tsx movePiece reference after store deletion**

- **Found during:** Task 2 GREEN (tsc --noEmit after removing movePiece from store)
- **Issue:** HexGrid.tsx used `useGameStore((s) => s.movePiece)` which became undefined after the movePiece removal
- **Fix:** Replaced `movePiece(hex)` call with `emitMove(selectedPieceId, hex)` — uses the new emitter; added null guard on selectedPieceId for type safety
- **Files modified:** packages/client/src/components/HexGrid.tsx
- **Commit:** 6d29c53 (included in GREEN commit)

**2. [Rule 1 - Bug] Fixed exactOptionalPropertyTypes auth callback**

- **Found during:** Task 1 tsc verification
- **Issue:** `cb({ sessionToken: token ?? undefined })` fails with exactOptionalPropertyTypes:true; `string | undefined` is not assignable to `string` in optional property context
- **Fix:** Added explicit null guard: `if (token !== null) { cb({ sessionToken: token }); } else { cb({}); }`
- **Files modified:** packages/client/src/socket.ts
- **Commit:** f8eae6d

**3. [Rule 1 - Bug] Fixed @typescript-eslint/unbound-method in test file**

- **Found during:** Task 2 RED commit lint hook
- **Issue:** `expect(socket.emit).toHaveBeenCalledWith(...)` triggers unbound-method rule; also `socket.emit as Mock` at module level
- **Fix:** Added eslint-disable-next-line comment for the mock-capture line; used local `emitMock` variable for all assertions
- **Files modified:** packages/client/src/store/useGameStore.test.ts
- **Commit:** 1457c3d

**4. [Rule 3 - Blocking] Node_modules not present in worktree**

- **Found during:** Task 1 tsc verification
- **Issue:** Git worktree does not inherit node_modules from main repo; `tsc --noEmit` and `vitest run` failed immediately
- **Fix:** Ran `pnpm install` in worktree root to set up node_modules + `pnpm -r build` to compile `@counter-attack/shared` (required for type resolution)
- **Files modified:** None (setup only)

## TDD Gate Compliance

- RED gate: commit `1457c3d` (`test(07-01): add failing tests...`) — 12 tests failing as expected
- GREEN gate: commit `6d29c53` (`feat(07-01): extend useGameStore...`) — all 16 tests passing
- REFACTOR gate: not required (no cleanup needed)

## Verification Results

- `npx tsc --noEmit -p tsconfig.json` — exit 0
- `npx vitest run src/store/useGameStore.test.ts` — 16/16 passing
- `grep -v '^[[:space:]]*[/*]' useGameStore.ts | grep -c movePiece` — 0

## Known Stubs

None — socket.ts and store extensions are fully wired. Initial gameState uses mockMovementState (pre-existing from Phase 6; replaced by real server broadcasts once App.tsx wires the game:state listener in plan 07-02).

## Threat Flags

None — no new network endpoints or auth paths introduced beyond those specified in the plan's threat model (T-07-01 through T-07-SC).

## Self-Check: PASSED

- packages/client/src/socket.ts — FOUND
- packages/client/vite.config.ts — FOUND (proxy added)
- packages/client/src/store/useGameStore.ts — FOUND (emitUndo, emitMove present; movePiece absent)
- packages/client/src/store/useGameStore.test.ts — FOUND (vi.mock, no movePiece describe)
- Commit f8eae6d — FOUND
- Commit 1457c3d — FOUND
- Commit 6d29c53 — FOUND
