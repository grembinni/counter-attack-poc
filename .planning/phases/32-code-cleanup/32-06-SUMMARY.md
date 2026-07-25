---
phase: 32-code-cleanup
plan: 06
subsystem: testing
tags: [eslint, react-hooks, eslint-plugin-react-hooks, zustand, lint, react]

# Dependency graph
requires:
  - phase: 32-code-cleanup (plan 01)
    provides: knip dead-code baseline (ConnectionStatus.tsx already removed)
  - phase: 32-code-cleanup (plan 04)
    provides: prior client refactor context this plan's dependency-array fixes build on
provides:
  - eslint-plugin-react-hooks 7.1.1 enabled at error, scoped to packages/client/src/**
  - react-hooks/rules-of-hooks and react-hooks/exhaustive-deps enforced with zero violations
  - App.tsx mount-once socket-registration effect deps corrected (highest-risk site, D-07)
  - LineupAssignmentScreen.tsx benchCards useMemo deps corrected via stabilized resolveTieredCard
affects: [future client component work touching useEffect/useMemo/useCallback dependency arrays]

# Tech tracking
tech-stack:
  added: [eslint-plugin-react-hooks@7.1.1]
  patterns:
    - 'Stable Zustand setter/action references added to dependency arrays instead of eslint-disable (behavior-preserving)'
    - 'useCallback wrapping for component-scoped helper functions consumed inside useMemo, keyed on the state they close over'

key-files:
  created: []
  modified:
    - eslint.config.js
    - package.json
    - pnpm-lock.yaml
    - packages/client/src/App.tsx
    - packages/client/src/components/LineupAssignmentScreen.tsx

key-decisions:
  - "Declared only react-hooks/rules-of-hooks and react-hooks/exhaustive-deps explicitly in the new eslint.config.js block instead of spreading reactHooks.configs.recommended.rules, because eslint-plugin-react-hooks 7.1.1's recommended config (unlike what RESEARCH.md assumed) now bundles ~10 additional React-Compiler-readiness rules (set-state-in-effect, refs, immutability, purity, static-components, etc.) at error severity in BOTH recommended and recommended-latest — spreading it would have pulled in dozens of unbudgeted violations outside CLEANUP-04's stated scope."
  - "App.tsx's mount-once socket-registration useEffect: added the 7 closed-over Zustand setters to its deps array (default fix, Pitfall 3) instead of eslint-disable — these references are stable for the store's lifetime so the effect still only registers listeners once on mount."
  - "LineupAssignmentScreen.tsx's resolveTieredCard wrapped in useCallback keyed on cardCache to give it a stable identity, then added [draftView, resolveTieredCard] to the benchCards useMemo deps (replacing [draftView?.benchIds, cardCache]) — behavior-preserving given the app's full-snapshot broadcast pattern, since draftView only gets a new reference on a genuine DRAFT_STATE_UPDATED (exactly when benchIds also changes), preserving Gap-closure 29-12's (DRAFT-09) stable-identity guarantee for BenchCarousel's scroll-reset effect."
  - "Ran a full `pnpm install` mid-plan: the worktree's packages/client/node_modules was missing entirely (client dependencies, including vitest, were never linked in this worktree), which was blocking Task 2's test-suite verification step. This was a pre-existing worktree setup gap, not caused by this plan's changes — fixed via `pnpm install` (workspace-wide) rather than a targeted single-package install."

requirements-completed: [CLEANUP-04]

# Metrics
duration: ~14min
completed: 2026-07-24
---

# Phase 32 Plan 06: React Hook Dependency Lint Enforcement Summary

**Enabled `eslint-plugin-react-hooks` 7.1.1 at error severity scoped to the client package and fixed both surfaced `exhaustive-deps` violations with stable-dependency additions — zero suppressions needed.**

## Performance

- **Duration:** ~14 min
- **Started:** 2026-07-24T19:14:54-05:00 (first commit reference point)
- **Completed:** 2026-07-24T19:28:24-05:00
- **Tasks:** 2 of 3 (Task 3's human-verify checkpoint was not triggered — see below)
- **Files modified:** 5

## Accomplishments

- `eslint-plugin-react-hooks` 7.1.1 installed as a root devDependency and enabled at `error` for `react-hooks/rules-of-hooks` and `react-hooks/exhaustive-deps`, scoped to `packages/client/src/**/*.{ts,tsx}` only (shared/server are non-React, D-07).
- Discovered and corrected a RESEARCH.md assumption gap: in the installed v7.1.1, `reactHooks.configs.recommended.rules` (both `recommended` and `recommended-latest`) now bundles ~10 additional React-Compiler-readiness rules at `error` (not just `rules-of-hooks`/`exhaustive-deps` as RESEARCH.md's "use stable `recommended`, not `recommended-latest`" guidance assumed). Declared only the two intended rules explicitly to stay within CLEANUP-04's scope.
- Fixed both `exhaustive-deps` violations the correctly-scoped rule surfaced — `App.tsx`'s mount-once socket-registration effect (highest-risk site, ~14 setters closed over in the plan's original risk assessment, 7 actually flagged as missing) and `LineupAssignmentScreen.tsx`'s `benchCards` `useMemo` — both via the "add the missing stable dependency" default fix, zero `eslint-disable` suppressions.
- `pnpm lint` reports zero `react-hooks/*` violations across the client package.
- Full client test suite (387 tests, 22 files) passes with no regressions.
- `pnpm knip` does not flag `eslint-plugin-react-hooks` as an unused devDependency.

## Task Commits

Each task was committed atomically:

1. **Task 1: Install eslint-plugin-react-hooks and enable it at error, scoped to the client** - `89abc8a` (feat)
2. **Task 2: Fix every react-hooks violation — prefer adding stable deps over eslint-disable** - `f0ff5e1` (fix)

**Plan metadata:** (this commit, docs — see below)

## Task 3: Human Review Checkpoint — NOT TRIGGERED

Task 3 (`checkpoint:human-verify`, gate=`blocking`) exists in the plan to review any `eslint-disable-next-line react-hooks/exhaustive-deps` suppression added or kept. Per the orchestrator's explicit instruction for this run: _"If your fixes require NO suppressions at all ... you may not hit this checkpoint at all — proceed autonomously."_

**Verification the checklist condition is met:**

```
grep -rn "eslint-disable.*react-hooks" packages/client/src
```

returned zero matches (grep exit code 1) both immediately after Task 2's fixes and again after the final commits (post `eslint --fix`/`prettier` pre-commit hooks). **The suppression list is empty.** Both violations found by the correctly-scoped rule were resolved via the default fix (adding stable dependency references) — the ideal outcome per Pitfall 3 and the must*have truth: *"The dominant fix is adding missing STABLE Zustand action/setter references... not eslint-disable."\_

**Reviewed suppression list:** empty — nothing to review, nothing to approve/convert. D-08's checklist is trivially satisfied because the escape hatch it governs was never exercised.

## Files Created/Modified

- `eslint.config.js` — added `import reactHooks from 'eslint-plugin-react-hooks';` and a new flat-config block scoping `react-hooks/rules-of-hooks` and `react-hooks/exhaustive-deps` (both `error`) to `packages/client/src/**/*.{ts,tsx}`
- `package.json` — added `eslint-plugin-react-hooks@^7.1.1` devDependency
- `pnpm-lock.yaml` — lockfile update from the install
- `packages/client/src/App.tsx` — mount-once socket-registration `useEffect` deps array now lists its 7 closed-over Zustand setters (`setDisconnectWarning`, `setGameError`, `setGameState`, `setPlayerSlot`, `setRoomCode`, `setRoomError`, `setScreen`) instead of `[]`
- `packages/client/src/components/LineupAssignmentScreen.tsx` — `resolveTieredCard` converted from a plain function to a `useCallback` keyed on `cardCache`; `benchCards` `useMemo` deps changed from `[draftView?.benchIds, cardCache]` to `[draftView, resolveTieredCard]`

## Decisions Made

See `key-decisions` in frontmatter. Summary:

1. Explicit two-rule declaration instead of spreading `recommended.rules`, to correct a RESEARCH.md assumption invalidated by the actual installed package version's rule bundling.
2. Both violations fixed via stable-dependency addition (Pitfall 3's preferred fix), not suppression.
3. Ran a workspace-wide `pnpm install` to fix a pre-existing missing-`node_modules` gap in `packages/client` that was blocking the test-verification step (unrelated to this plan's code changes, but necessary to complete Task 2's verification).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Corrected react-hooks config block to avoid unintended React-Compiler rule scope creep**

- **Found during:** Task 1 (enabling react-hooks at error)
- **Issue:** PATTERNS.md's exact code block (`...reactHooks.configs.recommended.rules` spread + override) was written under RESEARCH.md's assumption that stable `recommended` contains only `rules-of-hooks`/`exhaustive-deps`, with `recommended-latest` being the one that bundles React-Compiler-readiness rules. Verified directly against the installed `eslint-plugin-react-hooks@7.1.1` package (`node -e "console.log(Object.keys(require('eslint-plugin-react-hooks').configs.recommended.rules))"`): both `recommended` and `recommended-latest` bundle the same ~14 rules (only `void-use-memo` differs, present in `-latest` only), including `set-state-in-effect`, `refs`, `immutability`, `purity`, `static-components`, `use-memo`, `preserve-manual-memoization`, `incompatible-library`, `globals`, `error-boundaries`, `set-state-in-render`, `config`, `gating` — all at `error`. Literally following PATTERNS.md's snippet would have enabled ~10 additional rules never audited in this plan, surfacing 17+ additional violations (confirmed via a scoped test run: 10 `react-hooks/refs` + 7 `react-hooks/set-state-in-effect`) with no budgeted fix scope.
- **Fix:** Declared only `'react-hooks/rules-of-hooks': 'error'` and `'react-hooks/exhaustive-deps': 'error'` explicitly in the rules object, without spreading `reactHooks.configs.recommended.rules`. This achieves the plan's documented intent (D-07: enable exactly these two rules at error) without pulling in unrelated, unbudgeted rules. Documented the discrepancy in an inline code comment.
- **Files modified:** `eslint.config.js`
- **Verification:** `pnpm lint` after the change shows exactly 2 `react-hooks/*` violations (both `exhaustive-deps`, matching RESEARCH.md's expected violation class), zero `rules-of-hooks`, zero Compiler-readiness-rule violations.
- **Committed in:** `89abc8a` (Task 1 commit)

**2. [Rule 3 - Blocking] Ran full `pnpm install` to restore missing `packages/client/node_modules`**

- **Found during:** Task 2 verification (`pnpm --filter @counter-attack/client test`)
- **Issue:** The client test command failed with `'vitest' is not recognized` — `packages/client/node_modules` did not exist at all in this worktree, even though the root `node_modules/.bin` had root-devDependency binaries (eslint, prettier, knip, husky, lint-staged) linked. This blocked the plan's mandated behavior-regression verification step.
- **Fix:** Ran `pnpm install` (workspace-wide, no flags) to link all four workspace projects' dependencies. Not a targeted install — the missing linkage affected the whole `packages/client` tree, not just react-hooks-related packages.
- **Files modified:** none (node_modules is gitignored; no lockfile change resulted since the lockfile was already up to date — `pnpm install` reported "Lockfile is up to date, resolution step is skipped")
- **Verification:** `pnpm --filter @counter-attack/client test` subsequently ran and passed (387/387 tests, 22 files).
- **Committed in:** N/A (no trackable file change — node_modules is gitignored)

---

**Total deviations:** 2 auto-fixed (2 Rule 3 - blocking)
**Impact on plan:** Both deviations were necessary to complete the plan's verification steps as written and to correctly achieve the plan's stated D-07 objective given the real installed package's behavior. No scope creep — deviation 1 actively _reduced_ scope (avoided fixing 17 unrelated Compiler-readiness violations); deviation 2 was a workspace tooling fix with zero code/behavior impact.

## Known Stubs

None.

## Threat Flags

None — no new network endpoints, auth paths, file access patterns, or schema changes introduced. Per the plan's threat model, T-32-SC (package install) and T-32-07 (dependency-array corrections) are the only in-scope threats, both dispositioned `mitigate`/`accept` and satisfied as planned (package verdict OK per RESEARCH.md's legitimacy audit; both dependency-array fixes are behavior-preserving stable-ref additions, guarded by the full client test suite).

## Issues Encountered

None beyond the two auto-fixed deviations documented above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `react-hooks/rules-of-hooks` and `react-hooks/exhaustive-deps` are now permanently enforced at `error` for the client package — any future PR introducing a stale-closure bug in a `useEffect`/`useMemo`/`useCallback` will fail lint immediately.
- Zero `eslint-disable-next-line react-hooks/exhaustive-deps` suppressions exist in the codebase — a clean baseline for any future team member reaching for the escape hatch (D-08's review bar remains in force for any future addition).
- Flagged for a future phase (not in this plan's scope): if the team later wants React-Compiler readiness, the other ~10 rules bundled in `reactHooks.configs.recommended.rules` (set-state-in-effect, refs, immutability, purity, static-components, use-memo, preserve-manual-memoization, incompatible-library, globals, error-boundaries, set-state-in-render, config, gating) are available but were deliberately left disabled here — they surfaced 17 violations across the client codebase in a scoped test run that were never audited or fixed as part of CLEANUP-04.

---

_Phase: 32-code-cleanup_
_Completed: 2026-07-24_

## Self-Check: PASSED

- FOUND: `.planning/phases/32-code-cleanup/32-06-SUMMARY.md`
- FOUND: `eslint.config.js`
- FOUND: `eslint-plugin-react-hooks` in `package.json`
- FOUND commit: `89abc8a` (Task 1)
- FOUND commit: `f0ff5e1` (Task 2)
- FOUND commit: `68b3b7b` (docs: SUMMARY.md)
