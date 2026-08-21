---
phase: 41-card-injury-iconography
plan: 06
subsystem: testing
tags:
  [
    vitest,
    react-testing-library,
    source-scan-audit,
    cross-surface-consistency,
    card-injury-iconography,
  ]

# Dependency graph
requires:
  - phase: 41-card-injury-iconography (plans 01-05)
    provides: CardInjuryBadge.tsx shared component, and its four consumers (PieceOverlay,
      PlayerStatsPanel, LineupAssignmentScreen, BenchCarousel via DraftPackCarousel's
      DraftCardBodyProps.cardColor/injuryCount pattern)
provides:
  - A permanent, source-scanning ICON-01 audit spec that fails (and names the offending
    file) if any consumer ever re-implements the card-colour derivation or glyph markup
  - A permanent, render-based four-surface consistency spec proving ROADMAP Phase 41
    Success Criterion 3 end to end
affects: [phase-42-substitution-ux-overhaul]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - 'Source-scanning vitest spec (readdirSync + whitespace-normalized readFileSync) as
      the executable form of an architectural invariant that no render-based test can
      express ("nothing else implements this")'
    - 'Single glyphContract() assertion vocabulary spanning both the SVG CardInjuryBadgeGroup
      surface and the three self-contained-<svg> CardInjuryBadge DOM surfaces'

key-files:
  created:
    - packages/client/src/components/CardInjuryBadge.audit.test.ts
    - packages/client/src/components/CardInjuryBadge.crossSurface.test.tsx
  modified:
    - .planning/REQUIREMENTS.md

key-decisions:
  - "Used dirname(fileURLToPath(import.meta.url)) instead of the plan's literal
    fileURLToPath(new URL('.', import.meta.url)) — the latter throws 'The URL must be
    of scheme file' under this project's vitest/Windows ESM transform; the substitute
    is equally portable ESM (no __dirname) and satisfies the same intent"
  - "Checked off ICON-03 in REQUIREMENTS.md (was still [ ] despite being delivered in
    plan 41-05) — this plan's audit and cross-surface specs independently confirm the
    bench card renders the shared glyph end-to-end, closing the gap the task brief
    flagged as needing verification"

patterns-established:
  - 'Phase 42 (bench red-card marker) MUST extend CardInjuryBadge.audit.test.ts rather
    than delete it when adding new components under packages/client/src/components/'

requirements-completed: [ICON-01, ICON-02, ICON-03]

# Metrics
duration: ~20min
completed: 2026-08-21
---

# Phase 41 Plan 06: Repo-Wide Audit & Cross-Surface Consistency Summary

**Two permanent vitest specs close Phase 41: a source-scanning audit proving the card/injury derivation and glyph markup exist in exactly one place (ICON-01), and a four-surface render test proving one mid-match booking+injury updates the pitch token, scoreboard, roster card, and bench card identically with none left stale (ROADMAP Success Criterion 3).**

## Performance

- **Duration:** ~20 min
- **Tasks:** 2/2 completed
- **Files modified:** 3 (2 created, 1 modified — REQUIREMENTS.md)

## Accomplishments

- `CardInjuryBadge.audit.test.ts` (9 tests): confirms the `redCarded === true ? 'red' : ...`
  derivation and the `piece-card-badge`/`piece-injury-badge` glyph markup exist only in
  `CardInjuryBadge.tsx`; confirms all four surfaces import the shared module; confirms zero
  residue of the removed text-chip treatment (`stats-card-chip`, `stats-injury-chip`,
  `cardColor.toUpperCase()`, `'INJ'`, `INJ ×2/x2`) in any source, test, or CSS Module file.
  Falsification-verified: injecting a duplicate derivation into `PlayerStatsPanel.tsx` makes
  the suite fail and names the offending file; reverting restores green.
- `CardInjuryBadge.crossSurface.test.tsx` (5 tests): a single `glyphContract()` helper and
  `BOOKED_AND_INJURED` constant prove — via a clean-then-update render sequence, never a
  direct booked-state render — that `PieceOverlay`, `PlayerStatsPanel`, `LineupAssignmentScreen`
  (midmatch mode), and `BenchCarousel` all render the identical glyph contract after the same
  mid-match booking+injury is applied to a previously clean player. A fifth test collects all
  four booked-state results into one array assertion, closing ICON-02's "identical iconography"
  claim explicitly.
- Corrected a stale gap in `.planning/REQUIREMENTS.md`: ICON-03 was still unchecked despite
  being delivered in plan 41-05 — this plan's specs independently confirm the bench card
  renders the shared glyph end-to-end, so ICON-03 is now checked off and the Phase 41
  traceability row is marked Complete.
- Full monorepo verification green at phase close: `pnpm -r test` (shared 17 files/all green,
  server 56 files/1444 passed/1 skipped/1 todo, client 37 files/1048 passed), `pnpm -r typecheck`,
  `pnpm stylelint`, `pnpm knip` (no orphaned modules or dead exports).

## Task Commits

Each task was committed atomically:

1. **Task 1: ICON-01 consolidation audit as a permanent spec** - `9ce5b13` (test)
2. **Task 2: Four-surface consistency spec (ROADMAP Success Criterion 3)** - `6b15c81` (test)

**Plan metadata:** (this commit, following SUMMARY.md write)

## Files Created/Modified

- `packages/client/src/components/CardInjuryBadge.audit.test.ts` - Source-scanning ICON-01
  invariant spec (readdirSync-driven, so a new component file is covered automatically without
  editing the spec)
- `packages/client/src/components/CardInjuryBadge.crossSurface.test.tsx` - Four-surface
  Success-Criterion-3 render spec
- `.planning/REQUIREMENTS.md` - Checked off ICON-03, marked ICON-01..03 traceability row Complete

## Decisions Made

- `dirname(fileURLToPath(import.meta.url))` instead of the plan's literal
  `fileURLToPath(new URL('.', import.meta.url))` form — the latter threw `TypeError: The URL
must be of scheme file` under this project's vitest/Windows ESM setup even though
  `import.meta.url` itself is a valid file URL; `dirname(fileURLToPath(...))` is equally
  portable ESM (still no `__dirname`) and produces the identical `COMPONENTS_DIR` value.
- Checked off ICON-03 in REQUIREMENTS.md. Plan 41-05's own summary
  (`requirements-completed: [ICON-02, ICON-03]`) already claimed this delivery with its own
  `BenchCarousel.test.tsx` coverage; this plan's cross-surface spec independently re-proves it
  end-to-end (clean bench card → booking/injury applied → glyph appears), so the checkbox now
  reflects reality.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Worktree had no installed dependencies**

- **Found during:** Task 1, first `pnpm --filter @counter-attack/client test` attempt
- **Issue:** This worktree (`agent-a7f6661e42bfc70e4`) had no `node_modules` at all — `pnpm`
  reported `vitest' is not recognized`. Per project memory on Windows node_modules junction
  risk, did NOT attempt to junction/symlink from the main repo's real `node_modules` (that
  workaround has previously deleted real shared package content).
- **Fix:** Ran `pnpm install --frozen-lockfile` inside the worktree, building its own
  independent `node_modules` tree without touching the main repo's.
- **Files modified:** none tracked (node_modules is gitignored)
- **Verification:** `pnpm --filter @counter-attack/client test` subsequently ran successfully
- **Committed in:** N/A (not a tracked change)

**2. [Rule 3 - Blocking] `packages/shared` had no built `dist/` output**

- **Found during:** Task 1, `pnpm --filter @counter-attack/client typecheck`
- **Issue:** `tsc --noEmit` failed with `Cannot find module '@counter-attack/shared'` across
  several pre-existing files (`useGameStore.ts`, `uniformStyles.tsx`/`.test.tsx`) — the shared
  package's `dist/index.d.ts` didn't exist yet in this freshly-installed worktree.
  This is a pre-existing project structural dependency (shared package must be built before
  client typecheck can resolve its types), not something this plan's own files caused.
- **Fix:** Ran `pnpm --filter @counter-attack/shared build`.
- **Files modified:** `packages/shared/dist/**` (build output, gitignored, not tracked)
- **Verification:** `pnpm --filter @counter-attack/client typecheck` then exits 0
- **Committed in:** N/A (not a tracked change)

**3. [Rule 1 - Bug] `new URL('.', import.meta.url)` threw under this project's vitest/Windows setup**

- **Found during:** Task 1, first test run of the newly-written audit spec
- **Issue:** `fileURLToPath(new URL('.', import.meta.url))` (the plan's specified literal form)
  threw `TypeError: The URL must be of scheme file` when transformed by vitest in this
  environment.
- **Fix:** Switched to `dirname(fileURLToPath(import.meta.url))` — same portable-ESM intent
  (still explicitly avoids `__dirname`), resolves to the identical directory.
- **Files modified:** `packages/client/src/components/CardInjuryBadge.audit.test.ts`
- **Verification:** All 9 audit assertions pass; acceptance-criteria greps for `.tsx`,
  `readdirSync`, whitespace normalization, and `DraftPackCarousel` all still satisfied
- **Committed in:** `9ce5b13` (Task 1 commit)

**4. [Rule 1 - Bug] Unused `BenchEntry` type import**

- **Found during:** Task 2, `pnpm exec eslint` on the new crossSurface spec
- **Issue:** `import type { PlayerPiece, BenchEntry, HexCoord }` — `BenchEntry` was never
  referenced (the bench test builds a `TieredPoolPlayer`, not a `BenchEntry`).
- **Fix:** Removed the unused import.
- **Files modified:** `packages/client/src/components/CardInjuryBadge.crossSurface.test.tsx`
- **Verification:** `pnpm exec eslint` clean; all 5 crossSurface tests still pass; acceptance
  grep counts (`glyphContract` ≥6, surface names ≥4, `BOOKED_AND_INJURED` ≥5) unaffected
- **Committed in:** `6b15c81` (Task 2 commit)

---

**Total deviations:** 4 auto-fixed (2 blocking/environment, 2 bugs in this plan's own new files)
**Impact on plan:** All four fixes were necessary to get the new specs running/committable in
this worktree; none touched any file outside this plan's own two new test files (deviations 1-2
were environment setup with no tracked-file changes). No scope creep.

## Issues Encountered

- **Pre-existing, unrelated `pnpm lint` failure (NOT fixed, out of scope):** the whole-workspace
  `pnpm lint` fails with 11 `Parsing error: Too many files (>8) have matched the default project`
  errors, all in `packages/shared/src/*.test.ts` files (fouls, hex, moveValidator, offside,
  outOfBounds, passValidator, pitch, scoreUtils, shotValidator, snapshotValidator,
  stoppagePhases, teamConfig, teams, actionSequence, draftEngine, events, headingValidator).
  This is the exact pre-existing tech debt documented in `PROJECT.md` since Phase 32 close
  ("the whole-workspace `pnpm lint` OOMs on a pre-existing `packages/shared` typescript-eslint
  file-count-cap config issue... doesn't gate CI") — `eslint.config.js`'s
  `allowDefaultProject: ['packages/shared/src/*.test.ts', ...]` glob hits typescript-eslint's
  built-in 8-file safety cap now that `packages/shared/src` has grown to 17 test files. None of
  the failing files are touched by this plan (both new files live under
  `packages/client/src/components/`). Per the Scope Boundary rule this was left unfixed and is
  not re-logged to a new deferred-items.md (already tracked in `PROJECT.md`'s "Known tech debt"
  section). Verified instead via `pnpm exec eslint` scoped to this plan's own two files (both
  clean) plus `pnpm -r typecheck` / `pnpm stylelint` / `pnpm knip` / `pnpm -r test` (all exit 0).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 41 (Card & Injury Iconography) is complete: all three requirements (ICON-01, ICON-02,
  ICON-03) are now checked off in REQUIREMENTS.md with executable, permanent regression coverage.
- Phase 42 (Substitution UX Overhaul) consumes `CardInjuryBadge` for its bench red-card marker.
  It MUST extend `CardInjuryBadge.audit.test.ts`'s scans (which are directory-driven via
  `readdirSync`, so new component files are covered automatically) rather than delete or bypass
  them.
- The pre-existing, unrelated `pnpm lint` whole-workspace failure (packages/shared file-count
  cap) remains open tech debt, unchanged in status by this plan — already tracked in
  `PROJECT.md`.

---

_Phase: 41-card-injury-iconography_
_Completed: 2026-08-21_
