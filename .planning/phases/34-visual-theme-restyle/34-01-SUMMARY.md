---
phase: 34-visual-theme-restyle
plan: 01
subsystem: ui
tags: [stylelint, css-modules, design-tokens, wcag-contrast, tsx, tooling]

# Dependency graph
requires:
  - phase: 33-design-tokens-highlight-standardization
    provides: all 17 chrome .module.css files migrated to var(--token) color values with zero raw hex/rgba literals
provides:
  - Root-level stylelint gate (stylelint.config.js) enforcing var()/keyword-only color values across packages/client/src/**/*.module.css
  - function-disallowed-list supplement banning rgb()/rgba()/hsl()/hsla() literals (strict-value plugin doesn't catch these by default)
  - Root package.json script aliases: stylelint, check-contrast (check-contrast inert until plan 34-03)
  - wcag-contrast + @types/wcag-contrast + tsx installed in packages/client for downstream Wave 2 (34-02 AA-derivation) and Wave 3 (34-03 contrast-check script)
affects: [34-02, 34-03]

# Tech tracking
tech-stack:
  added:
    [
      stylelint@17.14.1,
      stylelint-declaration-strict-value@1.11.1,
      wcag-contrast@3.0.0,
      '@types/wcag-contrast@3.0.3',
      tsx@4.22.3 (client),
    ]
  patterns:
    [
      'ESM root-level config file (stylelint.config.js export default) matching eslint.config.js convention',
    ]

key-files:
  created: [stylelint.config.js]
  modified: [package.json, packages/client/package.json, pnpm-lock.yaml]

key-decisions:
  - 'Deliberately did NOT extend stylelint-config-standard (per plan) — repo already owns formatting via Prettier/vite build; scoped stylelint.config.js to exactly the two rules THEME-02 needs'
  - "Added expandShorthand: true and removed the literal 'border' entry from the strict-value rule's property list — using 'border' as an exact-match primary option makes the plugin check the entire shorthand value ('1px solid var(...)') as one token, which rejects the '1px'/'solid' portions even when the color component is already var()-driven. expandShorthand decomposes border into longhands and only border-color (matched by /color$/) is checked, leaving border-width/border-style unchecked. Confirmed root cause via plugin's own README before changing config, not by patching CSS."

patterns-established:
  - 'stylelint.config.js is the canonical location for any future chrome-CSS-Modules lint rule additions; CLI invocation glob (not a files/glob config key) controls scope'

requirements-completed: [THEME-02]

# Metrics
duration: ~15min (continuation session; Task 1 checkpoint approval + Tasks 2-3 execution)
completed: 2026-07-26
---

# Phase 34 Plan 01: Tooling Install + Stylelint Color-Literal Gate Summary

**Root stylelint gate (stylelint.config.js) enforcing var()/keyword-only chrome CSS colors, verified green on Phase 33's already-migrated CSS Modules, plus wcag-contrast/tsx installed in the client package for downstream waves.**

## Performance

- **Tasks:** 3/3 complete (Task 1 checkpoint approved by user prior to this continuation; Tasks 2-3 executed in this session)
- **Files modified:** 4 (package.json, packages/client/package.json, pnpm-lock.yaml, stylelint.config.js)

## Accomplishments

- Task 1 (checkpoint:human-verify, gate="blocking-human") — package legitimacy verification for `stylelint` and `tsx` — approved by user before this continuation began; treated as approved, not re-presented.
- Task 2 — Installed `stylelint@17.14.1` + `stylelint-declaration-strict-value@1.11.1` as root devDependencies; `wcag-contrast@3.0.0` as a client runtime dependency; `@types/wcag-contrast@3.0.3` + `tsx@4.22.3` as client devDependencies. Created `stylelint.config.js` (ESM `export default`) with `scale-unlimited/declaration-strict-value` + `function-disallowed-list` rules. Added root `stylelint`/`check-contrast` script aliases.
- Task 3 — Ran `pnpm stylelint` against the 17 chrome `.module.css` files. Found and fixed a config-level false-positive (see Deviations below), then confirmed the gate exits 0 on current code and correctly catches a temporary probe literal (`#abcdef`), which was reverted after verification.

## Task Commits

Each task was committed atomically:

1. **Task 1: Package legitimacy verification (stylelint + tsx [SUS] gate)** - approved by user (no commit — checkpoint only, no code changes)
2. **Task 2: Install tooling deps + create stylelint config + wire root scripts** - `a920233` (feat)
3. **Task 3: Verify stylelint gate is green on current chrome CSS** - `e15605e` (fix — config correction, see Deviations)

**Plan metadata:** pending final `docs(34-01): complete plan` commit (see final_commit step)

## Files Created/Modified

- `stylelint.config.js` - Root ESM stylelint config: `scale-unlimited/declaration-strict-value` (targets `/color$/`, `background`, `background-color`, `border-color`, `fill`, `stroke` with `ignoreValues: ['transparent', 'inherit', 'currentColor', 'none']` and `expandShorthand: true`) + `function-disallowed-list: ['rgb', 'rgba', 'hsl', 'hsla']`
- `package.json` - Added root devDependencies `stylelint`, `stylelint-declaration-strict-value`; added `stylelint` and `check-contrast` script aliases
- `packages/client/package.json` - Added `wcag-contrast` dependency; `@types/wcag-contrast` and `tsx` devDependencies
- `pnpm-lock.yaml` - Updated for all five new package installs

## Decisions Made

- Skipped `stylelint-config-standard` entirely (plan-directed deviation, not this executor's decision) — avoids Prettier-owned formatting-rule noise and a Phase-32 knip unused-dependency trip.
- Fixed a genuine config defect (see Deviations) rather than touching any `.module.css` file, per Task 3's explicit instruction not to edit CSS blindly when the failure isn't a real color literal.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] stylelint.config.js `border` shorthand handling produced 35 false-positive violations**

- **Found during:** Task 3 (verify stylelint gate is green)
- **Issue:** The plan's literal config (properties list including `'border'` as an exact-match entry, no `expandShorthand`) caused `pnpm stylelint` to report 35 errors across 12 files, all on lines like `border: 1px solid var(--color-border);`. The `stylelint-declaration-strict-value` plugin, when `'border'` is an exact-match primary option, validates the _entire_ shorthand value as a single token rather than decomposing it — so the literal `1px`/`solid` portions fail the var()/function/keyword check even though the color component is already correctly tokenized (Phase 33 migration). This contradicted the plan's own stated truth ("gate is green on today's already-migrated CSS") and was confirmed as a config/plugin-behavior issue (not a real hardcoded color) by reading the plugin's own README (`expandShorthand`/exact-match-priority documented behavior) and manually inspecting the flagged CSS lines.
- **Fix:** Removed the literal `'border'` entry from the rule's primary properties array and added `expandShorthand: true` to the secondary options. This makes `border` decompose to its longhand properties when no exact match is found, and only `border-color` (matched by the existing `/color$/` regex) is checked — `border-width`/`border-style` are left alone, since they were never in scope.
- **Files modified:** `stylelint.config.js`
- **Verification:** `pnpm stylelint` now exits 0 on all current chrome CSS. Re-verified the gate still catches real violations by temporarily inserting `color: #abcdef;` into `ActionLog.module.css`, confirming non-zero exit (2) and the correct error message, then reverting (confirmed via `git diff --stat` showing no residual diff on that file).
- **Committed in:** `e15605e` (Task 3 commit)

---

**Total deviations:** 1 auto-fixed (1 bug fix, Rule 1)
**Impact on plan:** Necessary for Task 3's acceptance criteria (gate must exit 0 on current code) to be met without touching any CSS. No scope creep — fix is isolated to the config file this plan already owns.

## Issues Encountered

None beyond the deviation documented above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- THEME-02's stylelint gate is live, green, and verified to catch real regressions — ready for Wave 2 (34-02) and Wave 3 (34-03) to build on.
- `wcag-contrast`, `@types/wcag-contrast`, and `tsx` are installed and importable in `packages/client`, satisfying the dependency provisioning this plan was responsible for.
- `check-contrast` root script alias exists but is intentionally inert until plan 34-03 creates the underlying client script it delegates to.

---

_Phase: 34-visual-theme-restyle_
_Completed: 2026-07-26_
