---
status: complete
phase: 07-client-server-integration
source: [07-01-SUMMARY.md, 07-02-SUMMARY.md, 07-03-SUMMARY.md, 07-04-SUMMARY.md]
started: 2026-06-03T00:00:00Z
updated: 2026-06-03T02:30:00Z
---

## Current Test

[testing complete]

## Tests

### 1. End-to-end two-tab room session

expected: Open the app in two browser tabs. Tab 1 clicks "Create Room" and gets a room code. Tab 2 clicks "Join Room", enters the code, and submits. Both tabs advance to the game board. Tab 1 is Home (slot 1), Tab 2 is Away (slot 2).
result: pass
note: "Multiple fixes required — see Gaps section for fixes applied during this test."

### 2. Undo move re-clickability (UNDO-04)

expected: During the MOVEMENT phase, move a piece on the board, then click the Undo button. The piece is restored to its previous hex AND can be clicked and moved again (it is no longer greyed-out or stuck as already-moved).
result: pass
note: "Fix required — applyUndo did not clear movedPieceIds; piece stayed non-selectable after undo."

### 3. Undo button disappears on phase transition

expected: Undo Move button is visible in the MOVEMENT phase for the active player. When the phase transitions (e.g. to PASS or SHOT), the Undo button disappears from the action panel.
result: pass

### 4. Disconnect banner lifecycle

expected: With both tabs open and connected, disconnect one tab's network. The other tab shows a yellow warning banner. Re-enable the network — the banner auto-dismisses on the next game:state broadcast.
result: pass
note: "Fix required — server only sent GAME_STATE to reconnecting socket; added socket.to(room) emit so the watching player's onGameState dismisses the banner."

### 5. ConnectionStatus visual states

expected: The connection indicator in the game board header shows green (Connected) during normal play, amber/yellow (Reconnecting…) during a brief network interruption, and red (Disconnected) when the connection is fully lost.
result: pass
note: "Fix required — component initialized as 'disconnected'; seeded from socket.connected instead."

## Summary

total: 5
passed: 5
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

- truth: "Teams start on correct side of field at kick-off (Home left, Away right or per game spec)"
  status: resolved
  reason: "Fixed in Phase 7.1 (07.1-01): HOME_SQUAD and AWAY_SQUAD now use real 37x26 4-5-2 board coordinates; away mirrors home across q=18."
  severity: major
  test: observed
  root_cause: "Placeholder starting positions in packages/shared/src/teams.ts — comment notes 'Phase 6 replaces with real board coordinates from measurements'. Pre-existing deferred item, not a Phase 7 regression."
  artifacts:
  - path: "packages/shared/src/teams.ts"
    issue: "HOME_SQUAD and AWAY_SQUAD use placeholder positions (q 0-11 / q 12-24) on a 25x16 grid; actual pitch is 37x26"
    missing:
  - "Replace placeholder positions with real board coordinates from board photo/measurements (blocking dependency per CLAUDE.md)"

## Fixes Applied During UAT

1. **sessionStorage instead of localStorage** (socket.ts, App.tsx) — tabs shared the same token causing Tab 2 to reconnect as player 1
2. **playerSlot only set when token is non-empty** (App.tsx onRoomJoined) — the "slot 2 joined" notification was overwriting Tab 1's slot
3. **Reconnect path gated on room.status === 'playing'** (createServer.ts) — 'waiting' rooms fell through to fresh path so ROOM_JOIN was always registered
4. **onGameState advances from any lobby screen** (App.tsx) — CREATE_ROOM was not advancing to GAME_BOARD on reconnect after page refresh
5. **Server re-emits ROOM_JOINED on reconnect** (createServer.ts) — playerSlot was null after page refresh
6. **No auto-create room on connect** (App.tsx + LobbyScreen.tsx) — auto-created room locked Tab 2 into a session, preventing it from joining elsewhere
7. **HexCell highlight overlay forwards onClick** (HexCell.tsx) — the gold overlay polygon covered the base polygon's click handler
8. **Non-active player cannot select pieces** (HexGrid.tsx) — added isActivePlayer gate to canSelect and onClick
9. **applyUndo clears movedPieceIds** (gameEngine.ts) — piece stayed non-selectable after undo
10. **Disconnect banner dismissal via socket.to** (createServer.ts) — watching player's onGameState now fires on reconnect
11. **ConnectionStatus seeded from socket.connected** (ConnectionStatus.tsx) — component always initialized as 'disconnected'
