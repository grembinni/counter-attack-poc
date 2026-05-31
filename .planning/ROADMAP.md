**Plans:** 4 plans

Plans:

**Wave 1**

- [x] 07-01-PLAN.md — socket.ts singleton + Vite proxy + Zustand store extension (emitters, playerSlot/roomCode, movePiece→emitMove) + store tests
- [x] 07-04-PLAN.md — game:shot event (D-06): GAME_SHOT in shared events + ClientToServerEvents, server game:shot handler (phase/team/payload guards, records room.shotTarget, no broadcast, dice resolution unchanged) + integration tests

**Wave 2** _(blocked on Wave 1 completion)_

- [x] 07-02-PLAN.md — App.tsx central socket listener hub (connect-on-mount, 5 named handlers, cleanup) + LobbyScreen real room:create/room:join wiring
- [x] 07-03-PLAN.md — ActionPanel (buttons + PassTypeSelector + undo gating) + ConnectionStatus + DisconnectBanner + GameBoard wiring + HexGrid/HexCell SHOT click routing (emits game:shot per D-06) + ActionPanel tests

**UI hint**: yes
