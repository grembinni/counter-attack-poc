---
phase: 01-monorepo-scaffold-shared-types
reviewed: 2026-05-28T00:00:00Z
depth: standard
files_reviewed: 24
files_reviewed_list:
  - .gitattributes
  - .gitignore
  - .husky/pre-commit
  - .nvmrc
  - .prettierignore
  - .prettierrc
  - eslint.config.js
  - package.json
  - packages/client/package.json
  - packages/client/src/main.ts
  - packages/client/tsconfig.json
  - packages/server/package.json
  - packages/server/src/index.ts
  - packages/server/tsconfig.json
  - packages/shared/package.json
  - packages/shared/src/events.ts
  - packages/shared/src/hex.test.ts
  - packages/shared/src/hex.ts
  - packages/shared/src/index.ts
  - packages/shared/src/pitch.ts
  - packages/shared/src/types.ts
  - packages/shared/tsconfig.json
  - packages/shared/tsconfig.test.json
  - packages/shared/vitest.config.ts
  - pnpm-workspace.yaml
  - tsconfig.base.json
findings:
  critical: 1
  warning: 5
  info: 4
  total: 10
status: issues_found
---

# Phase 01: Code Review Report

**Reviewed:** 2026-05-28
**Depth:** standard
**Files Reviewed:** 24
**Status:** issues_found

## Summary

This is a TypeScript monorepo scaffold for the Counter Attack POC. The core hex math
(`hex.ts`) is correct — the axial distance formula, neighbor vectors, and `hexesInRange`
loop all produce the right results and are backed by well-chosen test cases. The shared
types are well-structured and the event maps follow the Socket.io v4 typed pattern
correctly. The tsconfig chain is coherent with strict settings enabled appropriately.

The one critical finding is an incomplete `.gitignore` that will silently allow
`.env.production` and similar environment-specific secret files to be committed. The
warnings cover a cross-platform breakage in `clean` scripts, a misleading `build` script
in the client package, a module-level side effect anti-pattern in the server placeholder,
and two gaps in the typed Socket.io API surface that will require rework in Phase 3.

---

## Critical Issues

### CR-01: `.gitignore` does not cover `.env.*` variants — secret files will be committed

**File:** `.gitignore:6-7`

**Issue:** Only `.env` and `.env.local` are listed. Files named `.env.production`,
`.env.development`, `.env.staging`, `.env.test`, or `.env.*.local` (the standard
Create-React-App / Vite / dotenv naming scheme) are not excluded. When Vite is added in
Phase 6 it auto-loads `.env.production` at build time. If a developer creates that file
with real API URLs or secrets and forgets it is not gitignored, it will be committed and
pushed. Per CLAUDE.md, the deployment path uses `eb setenv` and the constraint is "never
commit secrets" — this gap directly violates that constraint.

**Fix:**

```gitignore
# Environment variable files — never commit any .env variant
.env
.env.*
.env.*.local
```

Replace lines 6–7 with the three-line block above. The glob `.env.*` covers
`.env.production`, `.env.development`, `.env.staging`, and any future variants.
`.env.*.local` covers Vite's per-environment local overrides.

---

## Warnings

### WR-01: `clean` scripts use Unix `rm -rf` — breaks on Windows

**File:** `packages/server/package.json:10`, `packages/shared/package.json:22`

**Issue:** Both `clean` scripts invoke `rm -rf dist`. The development environment is
Windows (win32 per session context). PowerShell does not have `rm -rf`; the command
silently fails or errors depending on the shell used. This will cause confusion when
developers run `pnpm clean` locally.

**Fix:** Replace with a cross-platform node invocation or add `rimraf` as a dev
dependency:

```json
"clean": "node --eval \"const fs=require('fs');fs.rmSync('dist',{recursive:true,force:true})\""
```

Or add `"rimraf": "^6"` to root `devDependencies` and use `"clean": "rimraf dist"` in
each package.

---

### WR-02: `packages/client` `build` script runs `tsc` with `noEmit: true` — produces no artifacts

**File:** `packages/client/package.json:8`, `packages/client/tsconfig.json:7`

**Issue:** `packages/client/tsconfig.json` sets `"noEmit": true`, so running the
`"build": "tsc"` script performs a type-check only and emits no files. The root
`"build": "pnpm -r build"` will silently succeed with no client artifact produced. When
Vite is wired up in Phase 6, this script will be replaced — but between now and then,
any CI pipeline that gates on the `build` script will receive a false-green signal that
no build artifact was produced.

**Fix:** Rename the script to match its actual behavior:

```json
"scripts": {
  "build": "echo 'Vite build added in Phase 6'",
  "typecheck": "tsc --noEmit"
}
```

This makes the mismatch explicit and prevents CI from treating a no-op as a successful
build.

---

### WR-03: Module-level side effect in server placeholder

**File:** `packages/server/src/index.ts:19`

**Issue:** `bootstrap()` is called unconditionally at the module's top level (line 19).
Any future code that imports a named export from this module (e.g., importing a helper
function added later) will trigger `bootstrap()` as a side effect — logging to stdout and
potentially starting server infrastructure. Module-level side effects are an anti-pattern
in Node.js ESM because they cannot be tree-shaken and surprise importers.

**Fix:** Remove the bare call and require the entry point to call it explicitly:

```typescript
// In index.ts — export only; do NOT call at module level
export function bootstrap(): void { ... }

// In a separate entrypoint (e.g., main.ts) or in package.json "main":
import { bootstrap } from './index.js';
bootstrap();
```

For this placeholder phase, removing line 19 and adding a comment documenting the
intent is sufficient.

---

### WR-04: `events.ts` exports only 2 of the 4 Socket.io generic type parameters

**File:** `packages/shared/src/events.ts:25-41`

**Issue:** Socket.io v4's `Server` constructor is:

```typescript
Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;
```

`events.ts` exports `ClientToServerEvents` and `ServerToClientEvents` but provides no
`InterServerEvents` or `SocketData` types. When the server is scaffolded in Phase 3,
the developer will either use `{}` inline (losing the type-checked pattern established
here) or add these types ad-hoc in the server package without sharing them. This defeats
the purpose of centralising event types in `@counter-attack/shared`.

**Fix:** Add the two missing types to `events.ts` now:

```typescript
/** Inter-server events (unused in single-instance POC, required for type param). */
export interface InterServerEvents {}

/** Per-socket data stored by Socket.io (player slot, room code, etc.). */
export interface SocketData {
  playerSlot: 1 | 2;
  roomCode: string;
}
```

Both can be empty objects or minimal stubs; they establish the shared type contract
that Phase 3 will implement.

---

### WR-05: `*.svg` marked as binary in `.gitattributes` — loses text diff

**File:** `.gitattributes:21`

**Issue:** `*.svg binary` tells git to treat SVG files as binary blobs. SVG is XML text.
Marking it binary means: (a) git will not render diffs for SVG changes in `git diff` or
pull requests, (b) git will not insert conflict markers during merges, meaning SVG merge
conflicts resolve silently by picking one side. Per CLAUDE.md, the hex grid is rendered
as SVG components, so SVG files will be a first-class source artifact in the client
package. Losing diffs and conflict detection for these files is a real maintenance
hazard.

**Fix:**

```gitattributes
*.svg text eol=lf
```

Replace line 21 with the above. SVG line endings should be normalized to LF (consistent
with all other source files in this repo).

---

## Info

### IN-01: `hexDistance` JSDoc comment uses ambiguous label for the middle term

**File:** `packages/shared/src/hex.ts:17`

**Issue:** The formula comment reads `(|dq| + |dq+dr| + |dr|) / 2`. The second term
`|dq+dr|` is correctly computed as `|ds|` (the implicit cube s-axis delta) but its label
looks like it reuses `dq`, which could be read as `|dq| + |dr|` by a skimmer. The
formula is mathematically correct; the label is confusing.

**Fix:**

```typescript
* Formula: (|dq| + |dr| + |ds|) / 2  where s = -q-r (cube third axis)
```

---

### IN-02: `hexesInRange` has no guard for negative `range`

**File:** `packages/shared/src/hex.ts:39`

**Issue:** `hexesInRange(center, -1)` silently returns `[]` because the outer loop
`for (let q = -range; q <= range; q++)` never executes when range is negative. Returning
an empty array for an invalid range argument may mask caller bugs (e.g., `pace - 1`
where pace is 0 would produce `hexesInRange(pos, -1)` returning no valid moves).

**Fix:**

```typescript
export function hexesInRange(center: HexCoord, range: number): HexCoord[] {
  if (range < 0) return []; // or: throw new RangeError(`range must be >= 0, got ${range}`)
  // ... existing loop
}
```

Add an explicit guard — either a documented early return or a thrown error. Either is
acceptable; a thrown error is safer because it surfaces the caller bug at development
time. Add a test case for range = -1.

---

### IN-03: `PlayerPiece` has no role discriminant between goalkeeper and outfield

**File:** `packages/shared/src/types.ts:3-16`

**Issue:** `PlayerPiece` includes both `saving`/`handling` (goalkeeper-specific stats)
and `tackling`/`dribbling` (outfield stats) on every piece. There is no `role` field
to distinguish a goalkeeper from an outfield player. Game logic that needs to identify
the goalkeeper (e.g., shot resolution, GK restart phase) will have to rely on
conventions (e.g., id prefix, position checks) rather than a typed discriminant.

**Fix:** Add a role field before the stats:

```typescript
export type PlayerPiece = {
  id: string;
  teamId: 'home' | 'away';
  role: 'outfield' | 'goalkeeper';
  position: HexCoord;
  // ... stats
};
```

This is scaffolding phase, so adding the field now costs nothing and avoids a breaking
type change in Phase 3+ when shot logic is implemented.

---

### IN-04: `console.log` in server and client placeholder files

**File:** `packages/server/src/index.ts:11-16`, `packages/client/src/main.ts:18-22`

**Issue:** Both placeholder files contain `console.log` calls used for verifying import
resolution. These will pass through to production unless explicitly removed. The server's
`console.log` runs at module load time (see WR-03 above); the client's runs when
`placeholder()` is called. While these are intentional for Phase 1 validation, they
should be removed before Phase 3 scaffolding builds on these files.

**Fix:** Remove `console.log` calls or replace with structured logging before Phase 3.
Add a `// TODO(Phase 3): remove placeholder logging` comment so the debt is tracked.

---

_Reviewed: 2026-05-28_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
