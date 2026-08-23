---
phase: quick/260823-akw
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - packages/server/src/gameEngine.ts
  - packages/server/src/__tests__/gameEngine.test.ts
  - packages/shared/src/types.ts
  - packages/shared/README.md
  - .planning/REQUIREMENTS.md
autonomous: true
requirements: [REFEREE-03]

must_haves:
  truths:
    - '`buildInitialGameState` assigns `refereeCard.leniency` an integer in 2..5 inclusive — never 1, never 6 — across repeated builds'
    - 'The leniency value is still generated server-side via `crypto.randomInt` (never client-supplied, never `Math.random`)'
    - 'Nothing but the roll range changes: the booking threshold (`rollsBooking` / `die >= leniency`) and the added-time formula (`roll + leniency + addedTimeBonus`) are byte-for-byte untouched'
    - 'The full server test suite passes (`pnpm --filter @counter-attack/server test`)'
    - 'No source comment, shared type doc, or shared README row still describes the CURRENT random leniency range as 1–6'
    - 'REQUIREMENTS.md REFEREE-03 states the random assignment is 2–5 and no longer says "unchanged from today"'
    - 'No manual-override toggle, stepper UI, or settings drawer code is added (Phase 44 scope stays untouched)'
  artifacts:
    - path: 'packages/server/src/gameEngine.ts'
      provides: 'Initial-state referee card roll narrowed to 2..5'
      contains: 'randomInt(2, 6)'
    - path: 'packages/server/src/__tests__/gameEngine.test.ts'
      provides: 'Bounds test asserting leniency in 2..5 across repeated builds'
      contains: 'toBeGreaterThanOrEqual(2)'
    - path: 'packages/shared/src/types.ts'
      provides: 'RefereeCard + GameState.refereeCard doc comments describing the 2–5 random range'
    - path: '.planning/REQUIREMENTS.md'
      provides: 'REFEREE-03 amended to the narrowed range'
  key_links:
    - from: 'packages/server/src/gameEngine.ts (buildInitialGameState return object)'
      to: 'crypto.randomInt'
      via: 'refereeCard leniency assignment'
      pattern: 'refereeCard: \{ leniency: randomInt\(2, 6\)'
---

<objective>
Narrow the random Referee Leniency roll performed at match start from 1–6 to 2–5, and bring every comment, shared-type doc, and requirement statement that documents that range back into agreement with the code.

`crypto.randomInt` is min-inclusive / max-exclusive, so `randomInt(2, 6)` yields 2, 3, 4, or 5 — the same 4-value band Phase 44's REFEREE-02 manual stepper will offer. 1 and 6 are the auto-lenient / auto-strict extremes (REQUIREMENTS.md "Out of Scope" already excludes them from the manual override); this change removes them from the random path too, so the random and manual paths cover an identical range.

Purpose: make the default (override-off) Leniency band match the band Phase 44 will expose manually, so the two paths cannot disagree, and eliminate the stale "range 1–6" doc sites that would otherwise become wrong the moment the code changes.

Output: a one-line behaviour change in `gameEngine.ts`, a strengthened bounds test, four doc-comment corrections, and an amended REFEREE-03 requirement.

**Explicitly out of scope** (do NOT implement, do NOT scaffold, do NOT stub):

- REFEREE-01 manual override toggle at game creation
- REFEREE-02 up/down stepper UI
- REFEREE-04 UI copy about added-time coupling
- SETTINGS-05/06/07 Advanced settings drawer
- Any Phase 43 (Tackle/Steal Prompt & Decline) work
- The `RefereeCard.leniency` field type — it stays `number`, not a narrowed literal union. Dozens of test fixtures construct states with `leniency: 0`, `2`, `3`, `4` directly; narrowing the type would break them and is not part of this task.
  </objective>

<execution_context>
@$HOME/.claude/gsd-core/workflows/execute-plan.md
@$HOME/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/REQUIREMENTS.md

@packages/server/src/gameEngine.ts
@packages/server/src/**tests**/gameEngine.test.ts
@packages/shared/src/types.ts
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Narrow the initial-state leniency roll to 2..5 and tighten its bounds test</name>
  <files>packages/server/src/__tests__/gameEngine.test.ts, packages/server/src/gameEngine.ts</files>
  <behavior>
    - Bounds: every `buildInitialGameState(...)` call produces `refereeCard.leniency` as an integer with `2 <= leniency <= 5`. Asserted over 50 successive builds, not one — a single build passes 4 times out of 6 even against the OLD 1..6 code, so a one-sample assertion is not a real gate. At 50 samples the pre-fix failure probability is `1 - (4/6)^50` ≈ 99.9999998%, i.e. the test reliably goes RED before the fix and stays GREEN after it.
    - Randomness (existing adjacent test, unchanged): at least 2 distinct leniency values across 10 builds. Still valid with 4 possible values — the all-identical flake probability rises from ~1e-7 to ~4e-6, which is negligible. Do not modify this test.
  </behavior>
  <action>
    Write the test change FIRST, run it to observe RED, then make the source change and observe GREEN.

    **Step 1 — test (RED).** In `packages/server/src/__tests__/gameEngine.test.ts`, the test currently named `refereeCard.leniency is an integer in 1..6 (TEAM-03)` (~line 125) builds one state and asserts `toBeGreaterThanOrEqual(1)` / `toBeLessThanOrEqual(6)`. Rename it to `refereeCard.leniency is an integer in 2..5 (TEAM-03)` and restructure the body to loop 50 iterations, calling `buildInitialGameState` with a distinct room code per iteration (follow the `ROOM-${i}` template-literal pattern already used by the adjacent randomness test at ~line 133) and passing the same `DEFAULT_TEAMS, 'standard', DEFAULT_STYLES` arguments the existing test uses. Inside the loop assert `Number.isInteger(leniency)` is true, `leniency` is `toBeGreaterThanOrEqual(2)`, and `leniency` is `toBeLessThanOrEqual(5)`. Run `pnpm --filter @counter-attack/server test -- gameEngine.test.ts` and confirm this test FAILS.

    **Step 2 — source (GREEN).** In `packages/server/src/gameEngine.ts` change three lines:
    - Line ~428, inside the `buildInitialGameState` return object: `randomInt(1, 7)` becomes `randomInt(2, 6)`, and the trailing inline comment `// TEAM-03: random 1–6` becomes a comment stating the value is a random `2–5` and noting that `randomInt` is max-exclusive so `(2, 6)` yields 2..5. Use the en-dash form `2–5` (matching the existing `1–6` house style) at least once on this line.
    - Line ~265, the `buildInitialGameState` JSDoc line `TEAM-03: refereeCard.leniency is randomly assigned in range 1–6 at match start.` — restate it as range `2–5`. You may keep a short "(narrowed from 1–6)" trailer for traceability; the verify gate below is written to allow that, it only forbids the literal `randomInt(1, 7)` call text.
    - Line ~12, the module header JSDoc line `TEAM-03: refereeCard assigned randomly at match start via crypto.randomInt(1, 7).` — update the literal call to `crypto.randomInt(2, 6)`. This site is easy to miss; the verify gate below fails if it is left stale.

    Change nothing else in `gameEngine.ts`. In particular do not touch the booking comparison sites (~lines 944, 952) or the added-time formula (~line 2562) — narrowing the roll flows through both automatically and by design (the REFEREE-04 coupling decision), so no code there needs adjusting.

  </action>
  <verify>
    <automated>pnpm --filter @counter-attack/server test && ! grep -n "randomInt(1, 7)" packages/server/src/gameEngine.ts && grep -q "randomInt(2, 6)" packages/server/src/gameEngine.ts && test "$(grep -c '2–5' packages/server/src/gameEngine.ts)" -ge 2</automated>
  </verify>
  <done>The full server suite passes; `gameEngine.ts` contains `randomInt(2, 6)`, contains zero occurrences of the literal `randomInt(1, 7)` (covering both the module header at ~line 12 and the assignment at ~line 428), and carries at least two `2–5` mentions (the ~line 265 JSDoc and the ~line 428 inline comment); the renamed bounds test asserts 2..5 across 50 builds and was observed failing before the source edit.</done>
</task>

<task type="auto">
  <name>Task 2: Correct the remaining 1–6 documentation sites</name>
  <files>packages/shared/src/types.ts, packages/shared/README.md, .planning/REQUIREMENTS.md</files>
  <action>
    Comment/prose-only edits — no runtime or type-shape changes.

    1. `packages/shared/src/types.ts` ~line 164-165, the `RefereeCard` type JSDoc: it currently reads that leniency is assigned randomly at match start with `Range 1–6 (matches dice face range per MATCH-02). TEAM-03.` Rewrite so it states the random assignment range is `2–5`, while keeping the `TEAM-03` tag. Drop the "matches dice face range" clause — it is no longer true. Keep the field declaration `leniency: number;` exactly as-is.

    2. `packages/shared/src/types.ts` ~line 1215, the `GameState.refereeCard` JSDoc `/** TEAM-03: Referee card drawn at match start. leniency range 1–6. */` — restate as leniency range `2–5`.

    3. `packages/shared/README.md` line 50, the `RefereeCard` row of the shared-types table: `Referee leniency attribute (range 1–6) drawn at match start` becomes `Referee leniency attribute (range 2–5) drawn at match start`. This file's tables are prettier-formatted with padded column alignment; after editing, run `pnpm format` (or hand-align) so `pnpm format:check` stays clean.

    4. `.planning/REQUIREMENTS.md` line 14, REFEREE-03. Replace the bullet text with:
       `- [ ] **REFEREE-03**: When the override is off (default), Leniency is randomly assigned 2–5 at match start (narrowed from the previous 1–6 roll)`
       Keep the unchecked `[ ]` box — Phase 44 still owns closing this requirement, and REFEREE-01/02/04 remain unimplemented.

    Note on the verify gate: it requires `2–5` to appear at least twice in `types.ts` (once per JSDoc site) and forbids the exact stale strings, rather than banning every mention of `1–6` — so a "(narrowed from 1–6)" trailer is allowed anywhere.

    Do NOT edit the REQUIREMENTS.md "Out of Scope" row about overrides outside 2–5 (its rationale is unaffected), the Traceability table, or any other requirement. Do NOT touch the ~40 test fixtures that hardcode `refereeCard: { leniency: N }` — those construct states directly rather than going through `buildInitialGameState`, several deliberately use out-of-band values like 0 to isolate the added-time formula, and all remain valid.

  </action>
  <verify>
    <automated>test "$(grep -c '2–5' packages/shared/src/types.ts)" -ge 2 && ! grep -n 'matches dice face range' packages/shared/src/types.ts && ! grep -n 'leniency range 1–6' packages/shared/src/types.ts && grep -q 'Referee leniency attribute (range 2–5)' packages/shared/README.md && grep -q 'randomly assigned 2–5' .planning/REQUIREMENTS.md && ! grep -n 'unchanged from today' .planning/REQUIREMENTS.md && pnpm typecheck && pnpm format:check</automated>
  </verify>
  <done>Both `types.ts` JSDoc sites and the README table row describe the 2–5 range; the stale `matches dice face range` and `leniency range 1–6` strings are gone; REFEREE-03 reads "randomly assigned 2–5" and no longer contains "unchanged from today"; `pnpm typecheck` and `pnpm format:check` both pass.</done>
</task>

</tasks>

<threat_model>

## Trust Boundaries

| Boundary                    | Description                                                                        |
| --------------------------- | ---------------------------------------------------------------------------------- |
| client→server socket events | Untrusted input; all game state transitions are re-validated server-side (ARCH-01) |
| RNG source → game state     | Referee leniency must originate from server-side `crypto.randomInt` only           |

## STRIDE Threat Register

| Threat ID | Category               | Component                                   | Disposition | Mitigation Plan                                                                                                                                                                                                             |
| --------- | ---------------------- | ------------------------------------------- | ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T-akw-01  | Tampering              | `buildInitialGameState` leniency assignment | mitigate    | Roll stays inside the server-only pure engine and keeps using `crypto.randomInt`; no client-supplied value and no `Math.random` is introduced. Task 1's verify gate asserts `randomInt(2, 6)` is present in `gameEngine.ts` |
| T-akw-02  | Information Disclosure | `refereeCard` in broadcast snapshot         | accept      | Leniency is already broadcast to both clients today and is intended to be visible match information; the range change does not alter what is exposed                                                                        |
| T-akw-SC  | Tampering              | npm/pip/cargo installs                      | accept      | No dependency is added, removed, or upgraded by this task — no package-manager install step exists, so the legitimacy gate does not apply                                                                                   |

</threat_model>

<verification>
Run from the repo root after both tasks:

1. `pnpm --filter @counter-attack/server test` — full server suite green (if a vitest worker crash appears on Windows, rerun with `--pool=forks`; that is a known environment flake, not a code failure).
2. `pnpm typecheck` — all workspaces clean.
3. `pnpm format:check` — markdown table alignment intact after the README/REQUIREMENTS edits.
4. `grep -rn "randomInt(1, 7)" packages/` — zero matches.
5. Confirm the leniency consumers were not touched: `git diff packages/server/src/gameEngine.ts` should show exactly three changed lines (module header comment, `buildInitialGameState` JSDoc, and the `refereeCard:` line with its inline comment) — nothing near the booking checks (~944, ~952) or the added-time formula (~2562).
   </verification>

<success_criteria>

- `refereeCard.leniency` from `buildInitialGameState` is always 2, 3, 4, or 5 — verified by a 50-build bounds test that was observed RED before the source change.
- Booking-threshold and added-time behaviour are unchanged in code; only the input range narrowed.
- No source comment, shared type doc, or README row still presents 1–6 as the current range (a "narrowed from 1–6" historical note is fine).
- REFEREE-03 in `.planning/REQUIREMENTS.md` describes the 2–5 random assignment and drops "unchanged from today"; its checkbox stays unchecked.
- Server tests, repo-wide typecheck, and format:check all pass.
- No Phase 44 override/stepper/drawer code and no Phase 43 code introduced.
  </success_criteria>

<output>
Create `.planning/quick/260823-akw-narrow-the-random-referee-leniency-roll-/260823-akw-SUMMARY.md` when done.
</output>
