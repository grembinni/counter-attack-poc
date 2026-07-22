---
phase: 29-draft-ui-pick-and-swap-flow
plan: 02
subsystem: api
tags: [typescript, draft-mode, state-machine, vitest]

requires:
  - phase: 29-draft-ui-pick-and-swap-flow (Plan 01)
    provides: DraftSession/DraftClientView/DraftSubStep/DraftDestination/DraftSlotRef types, RandomIntFn/DraftPack/TieredPoolPlayer from draftEngine.ts
provides:
  - 'packages/server/src/draftSession.ts — pure, io/socket-free draft state-machine helpers: assignPackOrders, createDraftSession, openNextPack, applyPick, applyRearrange, advanceSubStep, checkKeeperSafety, assignBenchNumbers, buildDraftView'
  - '31 unit tests covering pack-assignment fairness, pick/rearrange placement-with-displacement, the full 1+2+1x4 cycle machine, cycle-4 keeper safety, bench numbering, and the DraftClientView privacy projection'
affects: [29-04-server-wiring, 29-05-client-screen]

tech-stack:
  added: []
  patterns:
    - 'Pure state-machine module mirroring gameEngine.ts — zero io/socket imports, every function returns a NEW session object, never mutates its input'
    - 'getSide/withSide internal helpers project/replace the home-/away-prefixed fields of DraftSession by a DraftSide literal, avoiding computed-property-name TypeScript friction while keeping applyPick/applyRearrange/checkKeeperSafety symmetric across sides'
    - 'Deterministic array/constant-backed fake RNGs for exact-value unit assertions, combined with real crypto.randomInt looped over iterations (mirroring draftPacks.test.ts) for shuffle/statistical structural invariants'

key-files:
  created:
    - packages/server/src/draftSession.ts
    - packages/server/src/draftSession.test.ts
  modified: []

key-decisions:
  - 'Implemented the full pure module (all 9 exported helpers) in Task 1s commit rather than spreading the implementation across all three task commits — the helpers are tightly interdependent (advanceSubStep calls openNextPack; checkKeeperSafety/applyPick/applyRearrange all share the getSide/withSide side-projection helpers), so building them together in one pass was more correct and maintainable than an artificially staged partial implementation. Tests were still added incrementally per task (Task 2s commit is test-only for openNextPack/advanceSubStep; Task 3s commit is test-only for checkKeeperSafety/assignBenchNumbers/buildDraftView), preserving the plans intended task-by-task verification narrative.'
  - 'checkKeeperSafety accepts an rng parameter for signature parity with the other fairness-sensitive helpers in this module, but never calls it — every generated pack is guaranteed exactly one keeper-tier card (PACK_COMPOSITION.keeper === 1, Phase 28 invariant), so there is never a random choice to make. Documented inline with `void rng;` to satisfy the no-unused-vars lint rule without renaming the parameter.'
  - 'applyRearrange treats a slot-to-occupied-slot move as a displacement (the destination slots prior occupant is pushed to the bench), not a literal A<->B swap — this keeps the D-07 displacement rule uniform across applyPick and applyRearrange rather than introducing a second distinct behavior for the rearrange case, which the tasks acceptance criteria did not require.'
  - 'Card-tier sort ordering (D-20s "rarest cards populate/sort to the left" carousel requirement) is explicitly NOT implemented in this module — documented in the top doc-comment as a client-side display concern deferred to Plan 03/05, since openNextPack copies DraftPack.cards verbatim in whatever order generateDraftPacks dealt them.'

patterns-established:
  - 'DraftSide = "home" | "away" local alias, reused by every function signature in this module for a consistent per-player parameter shape'

requirements-completed: [DRAFT-07, DRAFT-08, DRAFT-10]

duration: ~35min
completed: 2026-07-21
---

# Phase 29 Plan 02: Draft State Machine (Pack Assignment, Pick/Swap Cycle, Keeper Safety, Bench Numbering) Summary

**Pure, unit-tested `draftSession.ts` implementing the full 1+2+1×4 pick-and-swap cycle machine, independent pack-to-player shuffle (D-04), cycle-4 keeper safety auto-pick, and CSPRNG-driven bench numbering — zero `io`/`socket` dependencies, mirroring `gameEngine.ts`'s separation from the socket layer.**

## Performance

- **Duration:** ~35 min (includes one-time `pnpm install --frozen-lockfile` + `@counter-attack/shared` build to populate the worktree's missing `node_modules`/`dist`)
- **Completed:** 2026-07-21
- **Tasks:** 3/3 completed
- **Files modified:** 2 (both newly created)

## Accomplishments

- `assignPackOrders(packCount, rng)` — independent Fisher-Yates shuffle over pack **indices** (not a slice of `generateDraftPacks`'s own dealt order), split evenly between home/away; proven both structurally (no-overlap permutation of 0..7 across 20 real-`crypto.randomInt` runs) and non-identity (a controlling constant rng demonstrably redistributes elements across the home/away halves, closing RESEARCH.md Pitfall 5)
- `createDraftSession`/`openNextPack` bootstrap and advance each cycle's per-player pack contents from the pre-assigned pack order
- `applyPick`/`applyRearrange` implement the full D-06/D-07/D-08/D-10 placement contract: draft-and-place in one motion, displaced-slot-occupant-to-bench semantics, rejection of out-of-pack cards and empty rearrange sources, and a guarantee that cycle/subStep/picksRemaining are untouched by rearrangement
- `advanceSubStep` implements the complete PICK1→SWAP→PICK2→SWAP_BACK→PICK3→(NEW_PACK|complete) machine under phase-boundary-only mutual-wait gating (Assumption A1) — verified with a mid-PICK2 no-op test and a full 4-cycle, 16-drafted-ids-per-player end-to-end cross-check
- `checkKeeperSafety` implements the DRAFT-08 cycle-4 safety net: auto-drafts the guaranteed keeper-tier card from a keeperless player's own pack, auto-places it into the empty GK slot (else bench), and its `keeperAutoPickedThisCycle` flag is read back by `advanceSubStep` to correctly reduce that side's next PICK2 requirement to 1
- `assignBenchNumbers` and `buildDraftView` close out DRAFT-10/D-14: distinct random 15-99 jersey numbers via CSPRNG shuffle, and a privacy-scoped per-player view proven structurally free of any opponent-prefixed field

## Task Commits

Each task was committed atomically:

1. **Task 1: Pack assignment + session bootstrap + pick & rearrange application** - `61615da` (feat)
2. **Task 2: Sub-step advancement state machine (1+2+1 x4)** - `09f2ef3` (test — implementation was already present from Task 1's combined commit; see Decisions Made)
3. **Task 3: Keeper safety (cycle 4) + bench numbering + buildDraftView** - `6fa47ac` (test — implementation was already present from Task 1's combined commit; see Decisions Made)

## Files Created/Modified

- `packages/server/src/draftSession.ts` - New pure module: `assignPackOrders`, `createDraftSession`, `openNextPack`, `applyPick`, `applyRearrange`, `advanceSubStep`, `checkKeeperSafety`, `assignBenchNumbers`, `buildDraftView`, plus private `shuffle`/`getSide`/`withSide`/`autoSelectKeeperIfMissing` helpers
- `packages/server/src/draftSession.test.ts` - 31 unit tests across 9 `describe` blocks covering every exported function

## Decisions Made

See `key-decisions` in the frontmatter for the full rationale on: (1) implementing the whole module in Task 1's commit rather than splitting it artificially across all three tasks, (2) `checkKeeperSafety`'s unused-by-design `rng` parameter, (3) treating rearrange-onto-occupied-slot as a displacement rather than a literal swap, and (4) deferring tier-sort ordering to the client (Plan 03/05).

## Deviations from Plan

None triggering Rules 1-4 — the module implements every behavior specified in the plan's `<behavior>` blocks. The one process-level deviation (combining all three tasks' implementation into Task 1's commit, then layering tests per task) is documented above as a `key-decision` rather than a Rule 1-4 auto-fix, since it did not change the resulting code's correctness or scope — only the commit granularity.

## Issues Encountered

- The worktree had no `node_modules` and `packages/shared` had no `dist/` build output (both expected for a fresh worktree checkout per the Plan 01 precedent). Ran `pnpm install --frozen-lockfile` (resolved from the existing pnpm store, zero downloads) followed by `pnpm --filter @counter-attack/shared build`. Neither step touched the main repo's `node_modules` — no junction/symlink workaround was used, per project memory on the worktree junction risk.
- `DraftSlotRef`'s `{ type: 'bench' }` variant requires a `benchIndex` field even for a rearrange _destination_ (where the plan's `applyRearrange` behavior always appends rather than inserting at a specific index) — this is a byproduct of `DraftSlotRef` being a single shared union type for both `from` and `to` in `DraftRearrangePayload` (Plan 01's type design). Test call sites supply `benchIndex: 0` for destination-bench moves since `applyRearrange`'s implementation ignores it for the `to` case; documented inline in the implementation.
- Initial `Math.random` grep check (acceptance criteria) counted 1 hit because a JSDoc block comment (`* ... Math.random ...`) isn't stripped by `grep -v '^\s*//'` (which only strips `//`-style line comments). Reworded the comment to avoid the literal string entirely rather than changing the grep contract.
- `let lineupSlots` in `applyRearrange` tripped `prefer-const` (array elements are mutated in place, but the binding itself is never reassigned) — changed to `const` per lint auto-fix guidance.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `packages/server/src/draftSession.ts` exports the complete, tested state-machine surface Plan 04 needs to wire into `roomHandlers.ts` (binding `crypto.randomInt` as the `RandomIntFn`), with explicit doc-comment boundaries noting what the Plan 04 socket handler must do BEFORE calling into this module (GK-slot role allow-list validation) and in what order (`checkKeeperSafety` before `advanceSubStep` on the cycle-4 PICK1 boundary, so the reduced `picksRemaining` lands correctly).
- `pnpm --filter @counter-attack/server test` (full suite, 591 tests) and `pnpm --filter @counter-attack/server typecheck` both pass with the additive changes — no existing test or type was modified or broken.
- No blockers for Plan 04 (server wiring) or Plan 03/05 (client carousel/screen), which can now rely on this module's exact function names, signatures, and behavior guarantees without re-deriving the state machine.

---

_Phase: 29-draft-ui-pick-and-swap-flow_
_Completed: 2026-07-21_

## Self-Check: PASSED

All claimed files exist (`packages/server/src/draftSession.ts`, `packages/server/src/draftSession.test.ts`, this SUMMARY.md) and all four commits (`61615da`, `09f2ef3`, `6fa47ac`, `64c7b43`) are present in git log.
