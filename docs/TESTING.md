<!-- generated-by: gsd-doc-writer -->

# Testing

This document covers how to run tests, write new tests, and understand the testing structure across all packages in the Counter Attack monorepo.

## Test Framework and Setup

All three packages use **Vitest 2.1.9** as the test runner.

| Package                  | Environment | Config file                        |
| ------------------------ | ----------- | ---------------------------------- |
| `@counter-attack/shared` | `node`      | `packages/shared/vitest.config.ts` |
| `@counter-attack/server` | `node`      | `packages/server/vitest.config.ts` |
| `@counter-attack/client` | `jsdom`     | `packages/client/vitest.config.ts` |

The client package additionally uses **@testing-library/react 14** and **@testing-library/user-event 14** for component rendering. The server integration tests use a real **socket.io-client 4.8.3** connected to a live server spun up on port 0 (OS-assigned) in each test's `beforeEach`.

Before running any tests, install dependencies:

```bash
pnpm install
```

The `@counter-attack/shared` package must be built before running server or client tests, because both packages import from its compiled output:

```bash
pnpm --filter @counter-attack/shared build
```

## Running Tests

### Full test suite (all packages)

```bash
pnpm test
```

This runs `vitest run` in every package via `pnpm -r test`.

### Single package

```bash
# shared package only
pnpm --filter @counter-attack/shared test

# server package only
pnpm --filter @counter-attack/server test

# client package only
pnpm --filter @counter-attack/client test
```

### Watch mode (shared package)

The `@counter-attack/shared` package exposes a watch mode script:

```bash
pnpm --filter @counter-attack/shared test:watch
```

Watch mode is not configured in the server or client `package.json` scripts. Run `vitest` directly inside those package directories if interactive watch mode is needed there.

### Single file

Pass the file path as an argument to Vitest from within a package directory:

```bash
cd packages/shared
pnpm vitest run src/moveValidator.test.ts
```

## Writing New Tests

### File naming conventions

| Package  | Convention               | Example                            |
| -------- | ------------------------ | ---------------------------------- |
| `shared` | `src/**/*.test.ts`       | `src/moveValidator.test.ts`        |
| `server` | `src/**/*.test.ts`       | `src/__tests__/gameEngine.test.ts` |
| `client` | `src/**/*.test.{ts,tsx}` | `src/components/HexCell.test.tsx`  |

Server tests are colocated under `src/__tests__/`. Shared and client tests sit alongside their source files.

### Test helpers and mocks

**Client mock states** (`packages/client/src/mock/`)

The client package provides pre-built `GameState` fixtures for use in store and component tests:

| Export               | File                         | Description                       |
| -------------------- | ---------------------------- | --------------------------------- |
| `mockMovementState`  | `mock/mockMovementState.ts`  | State during the movement phase   |
| `mockPassState`      | `mock/mockPassState.ts`      | State during the pass phase       |
| `mockShotState`      | `mock/mockShotState.ts`      | State during a shot               |
| `mockGKRestartState` | `mock/mockGKRestartState.ts` | State during a goalkeeper restart |

Import them from the barrel:

```ts
import { mockMovementState } from '../mock/index.js';
```

**Socket mock (client store tests)**

Use `vi.mock` to replace the socket module with a stub so store tests do not open a real connection:

```ts
vi.mock('../socket.js', () => ({
  socket: { emit: vi.fn(), on: vi.fn(), off: vi.fn() },
}));
```

**Server integration test pattern**

Integration tests in `packages/server/src/__tests__/` spin up a real HTTP + Socket.io server on port 0 and connect typed clients. The pattern is:

```ts
import { buildServer } from '../createServer.js';
import { clearAllRooms } from '../roomStore.js';

let httpServer: ReturnType<typeof buildServer>['httpServer'];
let address: string;

beforeEach(async () => {
  const server = buildServer();
  httpServer = server.httpServer;
  await new Promise<void>((resolve) => {
    httpServer.listen(0, () => resolve());
  });
  const addr = httpServer.address() as { port: number };
  address = `http://localhost:${addr.port}`;
});

afterEach(async () => {
  // disconnect clients, then close server
  await new Promise<void>((resolve) => httpServer.close(() => resolve()));
  clearAllRooms();
});
```

Always use `transports: ['websocket']` and `forceNew: true` on every test client to avoid polling fallback and connection reuse across tests.

**Component rendering (client)**

Use `@testing-library/react` for React component tests. Always call `cleanup()` in `afterEach`:

```tsx
import { render, cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

afterEach(() => cleanup());
```

SVG components must be rendered inside an `<svg>` wrapper:

```tsx
render(
  <svg>
    <HexCell hex={{ q: 18, r: 13 }} highlightType="safe" onClick={() => {}} />
  </svg>,
);
```

## Coverage Requirements

No coverage thresholds are configured in any `vitest.config.ts`. Coverage is not enforced in CI.

## CI Integration

Tests run in the **CI** workflow (`.github/workflows/ci.yml`) on every push and every pull request.

**Workflow:** `CI`
**Trigger:** `push` (all branches), `pull_request` (all branches)
**Runner:** `ubuntu-latest`, Node.js 22

Steps that run in order:

1. `pnpm install --frozen-lockfile`
2. `pnpm --filter @counter-attack/shared build` — compiles shared types before typecheck and tests
3. `pnpm -r typecheck` — TypeScript type checking across all packages
4. `pnpm -r test` — full test suite across all packages
5. `pnpm -r build` — production build verification
