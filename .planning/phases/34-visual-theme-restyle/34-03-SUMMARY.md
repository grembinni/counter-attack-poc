---
phase: 34-visual-theme-restyle
plan: 03
subsystem: testing
tags: [ci, wcag-contrast, stylelint, knip, eslint, tsx, github-actions]

# Dependency graph
requires:
  - phase: 34-visual-theme-restyle (34-02)
    provides: deriveAaAccentColor(), AA_TEXT_MIN_RATIO, AA_UI_MIN_RATIO exported from packages/client/src/hooks/useTeamColors.ts
provides:
  - packages/client/scripts/check-contrast.ts CI script asserting every TEAM_CONFIGS team's accent clears AA thresholds via the shared runtime derivation function
  - packages/client package.json check-contrast script (tsx scripts/check-contrast.ts)
  - knip.json registration for the new script (packages/client entry + project globs)
  - .github/workflows/ci.yml pnpm stylelint + pnpm check-contrast required-green steps
affects: [34-04 (tokens.css value swap — this gate must stay green after it)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - 'CI scripts import the exact runtime derivation function (never re-implement) to avoid CI/runtime drift'
    - 'CSS custom-property reference values read from tokens.css at script runtime via regex extraction, not hardcoded, so future token tuning does not silently desync the check'

key-files:
  created:
    - packages/client/scripts/check-contrast.ts
    - .planning/phases/34-visual-theme-restyle/deferred-items.md
  modified:
    - packages/client/package.json
    - packages/client/tsconfig.json
    - knip.json
    - eslint.config.js
    - .github/workflows/ci.yml

key-decisions:
  - "check-contrast.ts resolves tokens.css and its own scripts directory via fileURLToPath(import.meta.url), never process.cwd(), matching seed-rosters.ts's existing idiom"
  - "Included packages/client/tsconfig.json's scripts/**/* so check-contrast.ts is type-checked under the client project's real moduleResolution/paths instead of eslint's default-project fallback, which was resolving @counter-attack/shared and wcag-contrast imports as untyped/any and tripping @typescript-eslint/no-unsafe-* rules"
  - "Narrowed eslint.config.js's allowDefaultProject scripts glob from packages/*/scripts/*.ts to packages/shared/scripts/*.ts only, since packages/client/scripts is now covered by its own tsconfig project"

patterns-established:
  - 'Threshold constants and derivation logic for team-accent AA contrast live in exactly one place (useTeamColors.ts); CI and runtime both import it'

requirements-completed: [THEME-04, THEME-02]

# Metrics
duration: ~25min
completed: 2026-07-26
---

# Phase 34 Plan 03: CI Contrast Gate + CI Wiring Summary

**Automated `pnpm check-contrast` CI script that imports the runtime `deriveAaAccentColor()` derivation (zero drift), reads charcoal/white reference values from `tokens.css` at runtime, and is wired into `.github/workflows/ci.yml` alongside `pnpm stylelint` as required-green gates.**

## Performance

- **Duration:** ~25 min
- **Completed:** 2026-07-26T14:23:09Z
- **Tasks:** 2/2 completed
- **Files modified:** 6 (2 created, 4 modified) + 1 deferred-items tracking doc

## Accomplishments

- `check-contrast.ts` iterates all 12 active `TEAM_CONFIGS` teams, derives each accent via the exact `deriveAaAccentColor()` used at render time, and fails (`process.exit(1)`) if any team doesn't clear `AA_TEXT_MIN_RATIO`/`AA_UI_MIN_RATIO` — both imported, not re-implemented
- Charcoal (`--color-bg-page`) / white (`--color-text-inverse`) reference values are regex-extracted from `tokens.css` at script runtime, so the gate stays correct after 34-04's value swap without code changes
- `knip.json` registers the new script so the Phase-32 dead-code gate stays green
- `.github/workflows/ci.yml` now runs `pnpm stylelint` and `pnpm check-contrast` as required-green steps after `pnpm -r build`, preserving the existing flat step convention

## Task Commits

Each task was committed atomically:

1. **Task 1: Create check-contrast.ts + wire client script + knip registration** - `8fa0aee` (feat)
2. **Task 2: Wire stylelint + check-contrast into CI** - `cbf6d0c` (feat)

Additional commit:

- **deferred-items.md tracking** - `bc3a95a` (docs) — logs a pre-existing, out-of-scope eslint full-repo scan issue discovered during verification (see Deviations below)

_Note: worktree mode — STATE.md/ROADMAP.md final metadata commit is owned by the orchestrator, not this agent._

## Files Created/Modified

- `packages/client/scripts/check-contrast.ts` - New tsx CI script; imports `deriveAaAccentColor`, `AA_TEXT_MIN_RATIO`, `AA_UI_MIN_RATIO` from `../src/hooks/useTeamColors.js`, `hex` from `wcag-contrast`, `TEAM_CONFIGS` from `@counter-attack/shared`; extracts token values from `tokens.css`; loops all teams, exits non-zero on any failure
- `packages/client/package.json` - Added `"check-contrast": "tsx scripts/check-contrast.ts"` script
- `knip.json` - `packages/client` block: added `scripts/check-contrast.ts` to `entry`, `scripts/**/*.ts` to `project`
- `.github/workflows/ci.yml` - Added `- run: pnpm stylelint` and `- run: pnpm check-contrast` steps after `pnpm -r build`
- `packages/client/tsconfig.json` - Added `scripts/**/*` to `include` (deviation, see below)
- `eslint.config.js` - Narrowed the scripts `allowDefaultProject` glob to `packages/shared/scripts/*.ts` only (deviation, see below)

## Decisions Made

- Resolve `tokens.css` and script-relative paths via `fileURLToPath(import.meta.url)` (never `process.cwd()`) to match `seed-rosters.ts`'s existing idiom and guarantee correct resolution regardless of invocation directory.
- Use the exported `AA_TEXT_MIN_RATIO`/`AA_UI_MIN_RATIO` constants directly rather than hardcoding `4.5`/`3.0` literals, keeping the single source of truth in `useTeamColors.ts`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] eslint type-aware lint failures on check-contrast.ts's cross-package imports**

- **Found during:** Task 1, pre-commit hook (`lint-staged` → `eslint --fix`)
- **Issue:** `eslint.config.js`'s `allowDefaultProject: ['packages/*/scripts/*.ts']` entry put `check-contrast.ts` on TypeScript-ESLint's ad-hoc "default project" fallback, which does not share `packages/client/tsconfig.json`'s `moduleResolution`/paths setup. As a result, imports of `@counter-attack/shared`, `../src/hooks/useTeamColors.js`, and `wcag-contrast` resolved as untyped/`any`, tripping 12 `@typescript-eslint/no-unsafe-*` errors and blocking the commit.
- **Fix:** Added `scripts/**/*` to `packages/client/tsconfig.json`'s `include` so `check-contrast.ts` is covered by the client's real tsconfig project (matching how `src/**/*` files already resolve these same imports cleanly). Narrowed `eslint.config.js`'s scripts-glob `allowDefaultProject` entry from `packages/*/scripts/*.ts` to `packages/shared/scripts/*.ts` (the only remaining scripts directory that still needs the default-project fallback, since `packages/shared/tsconfig.json`'s `include` is `src/**/*` only and doesn't cover `scripts/`).
- **Files modified:** `packages/client/tsconfig.json`, `eslint.config.js`
- **Verification:** `npx eslint packages/client/scripts/check-contrast.ts packages/shared/scripts/seed-rosters.ts` — zero errors on both. `pnpm --filter @counter-attack/client typecheck` passes.
- **Committed in:** `8fa0aee` (Task 1 commit)

**2. [Rule 1 - Bug] `noUncheckedIndexedAccess` type error on regex capture group**

- **Found during:** Task 1, `pnpm --filter @counter-attack/client typecheck`
- **Issue:** `tsconfig.base.json`'s `noUncheckedIndexedAccess: true` types `match[1]` as `string | undefined`, but `extractToken()`'s return type was declared `string`, causing a TS2322 error.
- **Fix:** Store `match?.[1]` in a local `value` variable, throw if falsy (same fail-fast contract as before), then return `value` (now narrowed to `string`).
- **Files modified:** `packages/client/scripts/check-contrast.ts`
- **Verification:** `pnpm --filter @counter-attack/client typecheck` passes; `pnpm check-contrast` still exits 0 with all 12 teams clearing thresholds.
- **Committed in:** `8fa0aee` (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (1 blocking eslint/tsconfig config fix, 1 bug fix for strict-null-checked regex indexing)
**Impact on plan:** Both fixes were necessary to get the plan's own required verification (`pnpm check-contrast && pnpm knip`, plus the pre-commit hook) to pass at all. No scope creep — no other files touched, no architectural change.

## Issues Encountered

- Worktree had no `node_modules` (fresh worktree with no build artifacts); ran `pnpm install` (idle ~2m35s) and `pnpm --filter @counter-attack/shared build` before any verification command would run. Not a deviation — standard worktree bootstrap, not a plan or code change.
- Running full-repo `eslint .` (not part of any required gate — `pnpm lint` is not a CI step and `lint-staged` only lints staged files per commit) surfaced a pre-existing, unrelated failure: typescript-eslint's default 8-file cap on `allowDefaultProject` fallback matches is already exceeded by the 13 `packages/shared/src/*.test.ts` files that pattern alone matches, independent of anything this plan touched. Logged to `.planning/phases/34-visual-theme-restyle/deferred-items.md` (Rule: scope boundary — pre-existing, unrelated to this plan's files) rather than fixed.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- THEME-04 is now continuously enforced in CI via `pnpm check-contrast`, sharing 100% of the runtime derivation logic with `useTeamColors.ts` (34-02) — no drift possible.
- THEME-02 (`pnpm stylelint`) and THEME-04 (`pnpm check-contrast`) are both wired as required-green CI steps.
- Phase-32's `pnpm knip` gate remains green with the new script registered.
- 34-04 (the `tokens.css` value swap) can proceed — this gate will automatically re-validate the new charcoal/white values against all 12 teams without any script changes, since both are read from `tokens.css` at runtime.
- Deferred: pre-existing `eslint .` full-repo default-project cap issue (see `deferred-items.md`) — does not block 34-04 or any CI gate, but should be addressed by a future phase/plan if full-repo linting is ever added to CI.

---

_Phase: 34-visual-theme-restyle_
_Completed: 2026-07-26_
