# Deferred Items — 260816-bn5

## `pnpm lint` failure: pre-existing, out of scope

**Found during:** Task 3 (full-repo regression gate)

**Symptom:**

```
D:\...\packages\shared\src\teamConfig.test.ts
  0:0  error  Parsing error: Too many files (>8) have matched the default project.
D:\...\packages\shared\src\teams.test.ts
  0:0  error  Parsing error: Too many files (>8) have matched the default project.

✖ 9 problems (9 errors, 0 warnings)
```

**Root cause:** `eslint.config.js`'s `allowDefaultProject: ['packages/shared/src/*.test.ts', ...]`
glob (last touched Phase 34, commit `8fa0aee`) now matches 16 files in
`packages/shared/src/*.test.ts`, exceeding typescript-eslint's default
`maximumDefaultProjectFileMatchCount` of 8. Test files were added past that threshold
across Phases 37-39 (confirmed via `git log`, e.g. `fouls.test.ts` added in Phase 39
commit `7a966de`/`b0b8d0f`).

**Why deferred, not fixed:** This plan's scope is exactly two files —
`packages/server/src/gameEngine.ts` (Task 1: un-export `triggerFoulFreeKick`) and
`knip.json` (Task 2: prune 6 redundant entry patterns). Neither change touches
`eslint.config.js` or the count of `packages/shared/src/*.test.ts` files. Per the
plan's own Task 3 instruction ("if a check fails, fix the cause in the file owned
by Task 1 or Task 2 and re-run") and the executor's SCOPE BOUNDARY rule, this
failure's cause is not attributable to either task's file and must not be fixed here.

**Recommended follow-up:** A future quick task or phase plan should either raise
`maximumDefaultProjectFileMatchCount` in `eslint.config.js`, or split the
`packages/shared/src/*.test.ts` glob into a full tsconfig-backed project reference
so `allowDefaultProject` isn't needed for that directory at all.

**Verified pre-existing (not introduced by this plan's `pnpm install`):**
`typescript-eslint` version installed (8.60.0) matches the version pinned in
`package.json`/`pnpm-lock.yaml` exactly — no version drift from running
`pnpm install` to populate this worktree's previously-empty `node_modules`.
