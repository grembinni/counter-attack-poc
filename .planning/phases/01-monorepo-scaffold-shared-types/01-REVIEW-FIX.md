---
phase: 01-monorepo-scaffold-shared-types
fixed_at: 2026-05-28T00:00:00Z
review_path: .planning/phases/01-monorepo-scaffold-shared-types/01-REVIEW.md
iteration: 1
findings_in_scope: 6
fixed: 6
skipped: 0
status: all_fixed
---

# Phase 01: Code Review Fix Report

**Fixed at:** 2026-05-28
**Source review:** .planning/phases/01-monorepo-scaffold-shared-types/01-REVIEW.md
**Iteration:** 1

**Summary:**

- Findings in scope: 6 (1 Critical, 5 Warning)
- Fixed: 6
- Skipped: 0

## Fixed Issues

### CR-01: .gitignore does not cover .env.\* variants

**Files modified:** `.gitignore`
**Commit:** 5ac7953
**Applied fix:** Added a comment header and two new glob patterns — `.env.*` and `.env.*.local` — beneath the existing `.env` entry. This covers `.env.production`, `.env.development`, `.env.staging`, `.env.test`, and all Vite per-environment local overrides, preventing any environment-specific secret file from being committed.

---

### WR-01: clean scripts use Unix rm -rf — breaks on Windows

**Files modified:** `packages/server/package.json`, `packages/shared/package.json`
**Commit:** 6b1778e
**Applied fix:** Replaced `"clean": "rm -rf dist"` in both files with `"clean": "node --eval \"const fs=require('fs');fs.rmSync('dist',{recursive:true,force:true})\""`. Uses Node.js built-in `fs.rmSync` with `{recursive: true, force: true}` — identical behaviour on Windows and Unix with no new dependency required.

---

### WR-02: Client build script runs tsc with noEmit:true — produces no artifacts

**Files modified:** `packages/client/package.json`
**Commit:** 1bf46cb
**Applied fix:** Renamed `"build": "tsc"` to `"typecheck": "tsc --noEmit"` (matching the actual behaviour) and added `"build": "echo 'Vite build added in Phase 6'"` as an explicit stub. This prevents CI from treating a no-op type-check as a successful build, and the stub message makes the intent clear to any developer who runs `pnpm build` before Phase 6.

---

### WR-03: Module-level side effect in server placeholder

**Files modified:** `packages/server/src/index.ts`
**Commit:** 7a2a902
**Applied fix:** Removed the bare `bootstrap();` call at line 19. Added a three-line comment explaining that callers must invoke `bootstrap()` explicitly, why (to prevent side effects on import), and that Phase 3 will wire up a dedicated entrypoint. The `bootstrap` function itself and all imports are unchanged.

---

### WR-04: events.ts missing InterServerEvents and SocketData types

**Files modified:** `packages/shared/src/events.ts`
**Commit:** 5154e31
**Applied fix:** Appended two new exported interfaces after `ServerToClientEvents`: `InterServerEvents {}` (empty, required for the Socket.io v4 `Server<>` fourth type parameter in single-instance mode) and `SocketData { playerSlot: 1 | 2; roomCode: string; }` (stub for per-socket metadata that Phase 3 will populate). Both include JSDoc comments explaining their purpose.

---

### WR-05: \*.svg marked as binary in .gitattributes — loses text diff

**Files modified:** `.gitattributes`
**Commit:** 4f5df6f
**Applied fix:** Moved `*.svg` from the binary section (where it was set to `binary`) to the text section, replacing it with `*.svg text eol=lf`. This restores git diff and merge-conflict detection for SVG files, which are XML text and will be a first-class source artifact in the client package per CLAUDE.md.

---

_Fixed: 2026-05-28_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
