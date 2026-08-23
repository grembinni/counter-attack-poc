<!-- generated-by: gsd-doc-writer -->

# @counter-attack/shared

Shared TypeScript types, Socket.io event contracts, hex-grid utilities, and game-rule validators used by both the server and client packages in the Counter Attack monorepo.

Part of the [counter-attack-poc](../../README.md) monorepo.

---

## Installation

This package is `private` and is consumed only within the monorepo workspace. It is not published to npm.

To use it in a sibling package, reference it as a workspace dependency:

```json
"@counter-attack/shared": "workspace:*"
```

Then import from the single barrel entry point:

```typescript
import { GameState, ClientEvents, hexDistance } from '@counter-attack/shared';
```

No sub-path imports are used — all exports are available from `@counter-attack/shared`.

---

## API Summary

### Types (`types.ts`)

The core domain model for a Counter Attack match.

| Export               | Description                                                                                                                                       |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ | ------------------------------------------------------ |
| `HexCoord`           | `{ q: number; r: number }` — ODD-Q offset coordinate for a hex cell                                                                               |
| `PlayerPiece`        | A player on the pitch with stats (pace, shooting, tackling, dribbling, saving, handling, resilience, aerialAbility, highPass) and identity fields |
| `BallState`          | Current ball position and optional carrier piece ID                                                                                               |
| `GameState`          | Full match snapshot broadcast to both clients after every action                                                                                  |
| `GamePhase`          | Union of all FSM phase strings (e.g. `'MOVE'`, `'PASS'`, `'SHOT'`, `'HEADER'`, `'LOBBY'`, `'FULL_TIME'`, etc.)                                    |
| `ActionEvent`        | Discriminated union of every recordable game action, appended to `GameState.eventLog`                                                             |
| `ActionEventType`    | String literal union of all `ActionEvent` discriminants                                                                                           |
| `MovementSlot`       | `'ATTACKER_4'                                                                                                                                     | 'DEFENDER_5' | 'ATTACKER_2'` — the 4-5-2 movement sub-phase sequence  |
| `LastActionType`     | Tracks the most recent completed action for next-action eligibility checks                                                                        |
| `GameSpeed`          | `'slow'                                                                                                                                           | 'standard'   | 'fast'` — controls match-clock minutes per MOVE action |
| `GAME_SPEED_MINUTES` | Record mapping each `GameSpeed` to its per-MOVE clock increment (1, 2, or 3 minutes)                                                              |
| `RefereeCard`        | Referee leniency attribute (range 2–5) drawn at match start                                                                                       |

### Socket.io Events (`events.ts`)

Typed event name constants and Socket.io interface maps shared by server and client.

| Export                 | Description                                                                                                          |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `ClientEvents`         | Const object of all client-to-server event name strings (e.g. `ClientEvents.GAME_MOVE`, `ClientEvents.GAME_ROLL`)    |
| `ServerEvents`         | Const object of all server-to-client event name strings (e.g. `ServerEvents.GAME_STATE`, `ServerEvents.ROOM_JOINED`) |
| `ClientToServerEvents` | Socket.io typed event map for client emissions                                                                       |
| `ServerToClientEvents` | Socket.io typed event map for server emissions                                                                       |
| `InterServerEvents`    | Empty interface (required by Socket.io type params; unused in single-instance POC)                                   |
| `SocketData`           | Per-socket data stored by Socket.io (`playerSlot`, `roomCode`, `sessionToken`)                                       |

### Hex Math (`hex.ts`)

ODD-Q flat-top offset coordinate utilities.

| Export         | Description                                                   |
| -------------- | ------------------------------------------------------------- |
| `toCube`       | Convert ODD-Q offset `(q, r)` to cube coordinates `(x, y, z)` |
| `fromCube`     | Convert cube coordinates back to ODD-Q offset `(q, r)`        |
| `hexNeighbors` | Return the 6 neighboring hex coordinates for a given cell     |
| `hexDistance`  | Cube-coordinate distance between two offset hexes             |
| `hexLine`      | All hexes on a straight line between two offset hexes         |

### Pitch (`pitch.ts`)

Pitch geometry constants and zone-classification helpers.

### Teams (`teams.ts`)

Starting formation data and team roster helpers.

### Team Config (`teamConfig.ts`)

| Export         | Description                                                                   |
| -------------- | ----------------------------------------------------------------------------- | ------- | ------ | ------- |
| `TeamId`       | `'cosmos'                                                                     | 'xolos' | 'city' | 'crew'` |
| `TeamConfig`   | Interface with id, name, primaryColor, secondaryColor, and badgeFile filename |
| `TEAM_CONFIGS` | Record mapping each `TeamId` to its full `TeamConfig`                         |

### Validators

Rule-enforcement functions that run on the server (and can be imported by the client for pre-flight checks).

| Module                 | Description                                                                         |
| ---------------------- | ----------------------------------------------------------------------------------- |
| `moveValidator.ts`     | Validates piece movement — pace limits, Zone of Influence, hex adjacency            |
| `passValidator.ts`     | Validates pass declarations and interception eligibility                            |
| `shotValidator.ts`     | Validates shot attempts and shot-duel eligibility                                   |
| `headingValidator.ts`  | Validates header contestant selection and heading duel flow                         |
| `snapshotValidator.ts` | Validates snapshot declarations and GK penalty distance bands                       |
| `actionSequence.ts`    | `ELIGIBLE_NEXT_ACTIONS` table mapping `LastActionType` to allowed next action types |
| `scoreUtils.ts`        | Loose-ball trajectory math and score/added-time computation                         |
| `offside.ts`           | Team-relative offside geometry and sticky offside flag helpers                      |

---

## Testing

Run the test suite for this package in isolation:

```bash
pnpm --filter @counter-attack/shared test
```

Watch mode during development:

```bash
pnpm --filter @counter-attack/shared test:watch
```

Test files are colocated with source files and follow the `*.test.ts` naming convention (e.g. `src/hex.test.ts`, `src/moveValidator.test.ts`). The test runner is [Vitest](https://vitest.dev/) v2.

---

## Build

The package compiles TypeScript to `dist/` using `tsc`. Consumers depend on the compiled output.

```bash
pnpm --filter @counter-attack/shared build
```

The build output (`dist/index.js` and `dist/index.d.ts`) must exist before sibling packages (`server`, `client`) can typecheck. Run this first in a clean workspace.
