---
phase: '07'
plan: '02'
subsystem: client
tags: [socket-io, react, zustand, lobby, routing]
requires:
  - '07-01-SUMMARY.md'
provides:
  - 'Central Socket.io event hub in App.tsx wired to all ServerToClientEvents'
  - 'Real room:create / room:join lobby flow replacing MOCK42'
affects:
  - 'packages/client/src/App.tsx'
  - 'packages/client/src/components/LobbyScreen.tsx'
  - 'packages/client/src/components/LobbyScreen.module.css'
tech-stack:
  patterns:
    - 'Named socket handler functions inside useEffect (not inline arrows) for stable socket.off cleanup'
    - 'WAITING→GAME_BOARD advance driven by game:state handler, not room:joined (Pitfall 7 avoidance)'
    - 'Session token stored in localStorage only when truthy to guard slot-2 empty-token broadcast'
key-files:
  modified:
    - packages/client/src/App.tsx
    - packages/client/src/components/LobbyScreen.tsx
    - packages/client/src/components/LobbyScreen.module.css
key-decisions:
  - decision: 'WAITING→GAME_BOARD advance in onGameState, not onRoomJoined'
    rationale: 'Avoids race condition where board opens before game:state arrives (RESEARCH Pitfall 7)'
  - decision: 'localStorage token write guarded by truthiness check'
    rationale: 'Slot-2 existing-player broadcast carries empty string token — must not overwrite valid token'
  - decision: 'setScreen removed from JoinRoomScreen.handleSubmit'
    rationale: 'Navigation is fully server-driven via App.tsx room:joined → onRoomJoined handler'
requirements-completed: [UNDO-03]
duration: '~25 minutes'
completed: '2026-05-31'
---

# Phase 07 Plan 02: App.tsx Event Hub + LobbyScreen Real Socket Wiring Summary

App.tsx wired as the single central Socket.io event hub with connect-on-mount and five named server-event listeners routing into Zustand. LobbyScreen's MOCK42 placeholder replaced with real room:create / room:join server calls, inline error mapping, and server-driven navigation.

**Duration:** ~25 minutes | **Tasks:** 2/2 | **Files:** 3 modified

## What Was Built

### Task 1 — App.tsx Central Socket Hub

- Added single `useEffect([], [])` that calls `socket.connect()` on mount
- Five named `function on...` handlers (never inline arrows) registered via `socket.on`:
  - `onGameState`: calls `setGameState`, dismisses disconnect banner, advances WAITING→GAME_BOARD when first state arrives
  - `onRoomJoined`: stores session token (truthiness-guarded), sets roomCode + playerSlot, advances CREATE_ROOM→WAITING
  - `onRoomError`: calls `setRoomError`
  - `onGameError`: calls `setGameError`
  - `onDisconnectWarning`: calls `setDisconnectWarning(true)`
- Cleanup returns `socket.off` with same named references — eliminates duplicate listener accumulation

### Task 2 — LobbyScreen Real Wiring

- Deleted `const MOCK_CODE = 'MOCK42'` and all references
- `CreateRoomScreen`: emits `room:create` on mount, shows `roomCode ?? 'Generating…'` from store
- `JoinRoomScreen`: emits `room:join` with positional string arg, clears stale roomError before each attempt, displays inline error with server-reason mapping (`NOT_FOUND`/`INVALID_CODE` → "Room not found"; `NOT_WAITING`/`FULL`/`ALREADY_IN_ROOM` → "This room is already in progress"; fallback generic message)
- `WaitingScreen`: reads `roomCode` from store instead of constant
- `CopyButton`: accepts `code: string | null` prop, copies `code ?? ''`
- Added `.errorText { color: #ef4444 }` to `LobbyScreen.module.css`

## Commits

| Hash      | Description                                                             |
| --------- | ----------------------------------------------------------------------- |
| `0cc4062` | feat(07-02): add central socket listener hub to App.tsx                 |
| `6bbb452` | feat(07-02): replace MOCK42 with real room socket wiring in LobbyScreen |

## Deviations from Plan

None — plan executed exactly as written. The TRAP warning about not including `setScreen('GAME_BOARD')` inside `onRoomJoined` was honoured.

## Verification

- `npx tsc --noEmit` exits 0 ✓
- `grep -c MOCK LobbyScreen.tsx` returns 0 ✓
- App.tsx registers and cleans up exactly 5 server-event listeners ✓

## Self-Check: PASSED

Next: Ready for Phase 07 completion — 07-03 (ActionPanel, ConnectionStatus, GameBoard wiring) also complete.
