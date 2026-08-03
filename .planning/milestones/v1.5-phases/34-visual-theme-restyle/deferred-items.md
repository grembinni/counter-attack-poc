# Deferred Items — Phase 34

Out-of-scope discoveries logged during plan execution (not fixed, per executor scope-boundary rules).

## 34-03: `eslint .` (full-repo) fails with "Too many files (>8) have matched the default project"

**Found during:** Task 1 verification (running full `eslint .` to sanity-check the eslint.config.js
narrowing edit).

**Root cause:** Pre-existing, unrelated to this plan. `eslint.config.js`'s
`allowDefaultProject: ['packages/shared/src/*.test.ts', ...]` entry alone matches 13
`packages/shared/src/*.test.ts` files, which already exceeds typescript-eslint's default
`maximumDefaultProjectFileMatchCount` of 8 when the full repo is linted in one pass
(`eslint .` / root `pnpm lint`). This is not triggered by the normal commit path — Husky's
`lint-staged` only lints staged files per-commit, and `pnpm lint` is not part of `.github/workflows/ci.yml`
— so it does not block this plan's `pnpm check-contrast` / `pnpm knip` / CI gates.

**Verified pre-existing:** Confirmed the 13-file `packages/shared/src/*.test.ts` match alone (independent
of any scripts-glob change made in 34-03) already exceeds the 8-file cap.

**Not fixed:** Out of scope for 34-03 (THEME-04 CI contrast gate). Whoever picks this up next should either
raise `maximumDefaultProjectFileMatchCount_THIS_WILL_SLOW_DOWN_LINTING`, or give `packages/shared`'s test
files their own tsconfig project (e.g. a `tsconfig.test.json` with `include: ["src/**/*.test.ts"]`) so they
stop relying on the default-project fallback entirely.
