<!-- generated-by: gsd-doc-writer -->

# Development Guide

Local development setup, build commands, code style rules, and contribution workflow for the Counter Attack POC monorepo.

## Local Setup

### Prerequisites

- Node.js >= 22
- pnpm >= 9 (`npm install -g pnpm`)

### Clone and install

```bash
git clone <repo-url>
cd counter-attack-poc
pnpm install
```

### Build the shared package first

The `@counter-attack/shared` package must be compiled before other packages can import its types. This is required once on initial setup and after any changes to `packages/shared/src/`:

```bash
pnpm --filter @counter-attack/shared build
```

### Start the development servers

Run the server and client in separate terminal windows:

```bash
# Terminal 1 — backend (Express + Socket.io, port 3001)
cd packages/server
pnpm dev

# Terminal 2 — frontend (Vite HMR, port 5173)
cd packages/client
pnpm dev
```

The Vite dev server proxies `/socket.io` requests to `ws://localhost:3001`, so no extra CORS or environment variable configuration is needed during local development.

### Environment variables (server)

The server reads the following variables from the process environment. No `.env` file is required for local development — all have defaults:

| Variable      | Default | Description                                                       |
| ------------- | ------- | ----------------------------------------------------------------- |
| `PORT`        | `3001`  | Port the HTTP/WebSocket server listens on                         |
| `CORS_ORIGIN` | `*`     | Allowed CORS origin. Unset in dev is fine; required in production |
| `NODE_ENV`    | —       | Set to `production` to enable production-mode warnings            |

See `docs/CONFIGURATION.md` for the full configuration reference.

## Build Commands

### Root-level scripts (run from the monorepo root)

| Command             | Description                                               |
| ------------------- | --------------------------------------------------------- |
| `pnpm build`        | Build all packages recursively (`pnpm -r build`)          |
| `pnpm test`         | Run all test suites recursively (`pnpm -r test`)          |
| `pnpm typecheck`    | Type-check all packages recursively (`pnpm -r typecheck`) |
| `pnpm lint`         | Run ESLint across the entire monorepo                     |
| `pnpm format`       | Format all files with Prettier (write mode)               |
| `pnpm format:check` | Check formatting without writing (useful in CI)           |

### Per-package scripts

**`packages/shared`**

| Command             | Description                                                                        |
| ------------------- | ---------------------------------------------------------------------------------- |
| `pnpm build`        | Compile TypeScript to `dist/` — required before server or client can consume types |
| `pnpm test`         | Run shared unit tests with Vitest                                                  |
| `pnpm test:watch`   | Run Vitest in watch mode                                                           |
| `pnpm typecheck`    | Type-check without emitting output                                                 |
| `pnpm clean`        | Delete `dist/` directory                                                           |
| `pnpm seed:rosters` | Run the roster seed script (`scripts/seed-rosters.ts`)                             |

**`packages/server`**

| Command          | Description                                                                       |
| ---------------- | --------------------------------------------------------------------------------- |
| `pnpm dev`       | Build shared then start the server with `tsx watch` (live-reload on file changes) |
| `pnpm build`     | Compile TypeScript to `dist/` for production                                      |
| `pnpm test`      | Run server unit tests with Vitest                                                 |
| `pnpm typecheck` | Type-check without emitting                                                       |
| `pnpm clean`     | Delete `dist/` directory                                                          |

**`packages/client`**

| Command          | Description                                                  |
| ---------------- | ------------------------------------------------------------ |
| `pnpm dev`       | Start the Vite dev server with HMR                           |
| `pnpm build`     | Build the React app to `dist/` (static files for deployment) |
| `pnpm preview`   | Preview the production build locally                         |
| `pnpm test`      | Run client unit tests with Vitest (jsdom environment)        |
| `pnpm typecheck` | Type-check without emitting                                  |

## Code Style

### ESLint

Config file: `eslint.config.js` (ESLint flat config, ESLint 9.x)

The project uses `typescript-eslint` with `recommendedTypeChecked` rules, combined with `eslint-config-prettier` to disable formatting rules that conflict with Prettier.

Notable rule customisations:

- `@typescript-eslint/no-unused-vars` — error; ignores identifiers prefixed with `_`
- Unsafe type rules (`no-unsafe-call`, `no-unsafe-assignment`, etc.) are disabled inside `*.test.ts` / `*.test.tsx` files to reduce friction when asserting on loosely typed test fixtures

Run linting:

```bash
pnpm lint            # check
pnpm lint --fix      # auto-fix
```

### Prettier

Config file: `.prettierrc`

| Setting         | Value   |
| --------------- | ------- |
| `printWidth`    | 100     |
| `trailingComma` | `all`   |
| `singleQuote`   | `true`  |
| `semi`          | `true`  |
| `tabWidth`      | 2       |
| `useTabs`       | `false` |
| `endOfLine`     | `lf`    |

Run formatting:

```bash
pnpm format          # write
pnpm format:check    # check only (used in CI)
```

### TypeScript

Base config: `tsconfig.base.json` (extended by each package)

Key strictness flags enabled across all packages:

- `strict: true`
- `noUncheckedIndexedAccess: true`
- `exactOptionalPropertyTypes: true`
- `noImplicitOverride: true`
- `verbatimModuleSyntax: true`

Package-specific module systems:

- `packages/shared` and `packages/server` — `NodeNext` module resolution
- `packages/client` — `Bundler` module resolution (Vite handles resolution)

### Pre-commit hook

Husky runs `lint-staged` on every commit via `.husky/pre-commit`. The staged-file rules are:

| File pattern           | Actions                                 |
| ---------------------- | --------------------------------------- |
| `*.{ts,tsx}`           | `eslint --fix`, then `prettier --write` |
| `*.{json,md,yaml,yml}` | `prettier --write`                      |

The `prepare` script in root `package.json` installs the Husky hook automatically after `pnpm install`. The hook is skipped in CI (`CI=true`) and on Render (`RENDER=true`).

## Branch Conventions

No branch naming convention is formally documented. The working branch pattern observed in the repository uses descriptive feature prefixes (e.g., `fix/`, `feat/`, `chore/`, `docs/`). The default and main branch is `main`.

## PR Process

No `.github/PULL_REQUEST_TEMPLATE.md` exists. The recommended steps based on project conventions:

- Branch from `main` with a descriptive name
- Keep commits focused; use conventional commit prefixes (`feat:`, `fix:`, `chore:`, `docs:`, `test:`)
- Ensure `pnpm typecheck`, `pnpm test`, and `pnpm lint` all pass before opening a PR
- The CI pipeline (`.github/workflows/ci.yml`) must be green: it runs typecheck, tests, and build on every push and pull request
- Squash or rebase onto `main`; avoid merge commits unless the history is meaningful
