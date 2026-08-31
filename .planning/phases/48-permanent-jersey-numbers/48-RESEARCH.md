# Phase 48: Permanent Jersey Numbers - Research

**Researched:** 2026-08-31
**Domain:** Server-side game-engine state model (in-memory TypeScript, no new packages)
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Starting-XI ("position") players keep today's convention — number is derived from the formation slot the player occupies (GK=1, then 2–11 by `FORMATIONS[...].slots[i].jerseyNumber`) — **not** each player's own canonical `PoolPlayer.number`. This is an explicit rejection of the "player's own identity number" alternative that was on the table.
- **D-02:** Bench players get a random number in the existing `15–99` range (`BENCH_NUMBER_MIN`/`BENCH_NUMBER_MAX` in `draftSession.ts`, unchanged — user said "12–99" verbally but confirmed keeping the existing 15–99 constant when the discrepancy was flagged).
- **D-03:** Numbers must be unique per team — no two players on the same team (starters + bench combined) share a number. The existing `assignBenchNumbers` shuffle-without-replacement approach already satisfies this for bench-vs-bench; it must also not collide with the 1–11 starter range (it doesn't today, by range separation).
- **D-04:** This slot-derived-starters / random-bench scheme applies uniformly to **both** standard (non-draft) team mode and draft mode — not just draft mode. NUMBER-05's "draft-mode bench" framing is the minimum bar; the same rule extends to standard-mode bench too, since the user's answers were mode-agnostic.
- **D-05 (locking):** The number is computed once — at squad-build/draft-complete time / "locked after draft/before start of game" — and never recomputed afterward. **Never re-roll once assigned**: a player who already has a permanent number keeps it forever; only players who don't yet have one (e.g., newly added/rearranged) get a fresh draw. This directly satisfies NUMBER-01, NUMBER-02, NUMBER-04, and the "not re-rolled" half of NUMBER-05.
- **D-06:** Draft-mode starting-XI picks follow the **same rule as everyone else** (D-01, slot-derived), not their own random-once scheme — only draft-mode bench uses the random 15–99 draw (same as D-02/D-04).
- **D-07 (kickoff-striker lookup, NUMBER-03):** Replace `p.number === 9` with a **formation-slot-based** lookup — find the piece occupying the slot with `slotId === 'ST'` (`slotRole: 'FWD-central'`) in the confirmed formation, not the piece's own `PlayerPiece.role === 'ST'` identity field.

### Claude's Discretion

- Where exactly the one-time number computation/lock happens in the call graph (e.g., a new field/map, or restructuring `buildSquadPieces` so it stops recomputing `number` on every call) — as long as D-01 through D-06's observable behavior holds.
- Exact mechanism for "never re-roll once assigned" (e.g., checking an existing map before drawing, vs. only ever calling the assignment function once per player at the correct lifecycle point).
- How standard-mode `homeBench`/`awayBench` gets its initial numbers reconciled with D-02/D-04 — **resolved by this research, see "Critical Finding 1" below.**

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope. GK box-entry/final-third fixes (Phase 49), foul/injury/booking banner sequencing (Phase 50), and the rules-fidelity audit (Phase 51) are explicitly out of scope for this phase.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| NUMBER-01 | Each player is assigned a jersey number once at squad-build time, independent of formation/lineup slot | `buildSquadPieces` today recomputes `number` from slot index on **every** call (initial build AND every reset rebuild). See "Architecture Patterns" for the one-time-assignment model that satisfies this without touching the 4 reset call sites. |
| NUMBER-02 | A player's jersey number persists unchanged through repositioning, substitution, goal reset, and half-time reset | Traced all 4 code paths. Repositioning (`applyRosterReposition`) and substitution (`applySubstitution`) currently **violate** this (Pitfalls 2 and 3 below); goal/half-time reset (`applyRosterContinuity`) already satisfies it and needs no change (verified, see "Critical Finding 2"). |
| NUMBER-03 | The kickoff-striker anchor lookup no longer depends on `number === 9`; it uses a role-based lookup instead | Confirmed exactly one `slotId === 'ST'` slot exists in all 4 formations (`formations.ts`) — a slot-based lookup is safe and unambiguous. See Pitfall 4 and Code Examples. |
| NUMBER-04 | `applyRosterContinuity` preserves each player's permanent number across all reset call sites (goal-via-shot, goal-via-penalty, half-time, and any other reset site) | Verified: `applyRosterContinuity` already spreads `...currentPiece` (which carries `number`) and takes only `position` from the rebuilt array, at all 4 call sites. **No change needed here** once starters/bench numbers are truly permanent upstream — see "Critical Finding 2." |
| NUMBER-05 | Draft-mode bench players also receive a permanent number assigned once, not re-rolled | `assignBenchNumbers` (draft-complete transition) is correct in isolation, but `DRAFT_REARRANGE` can silently orphan a newly-benched player's number to `0` post-draft-complete — see Pitfall 5 ("Critical Finding 3"). |
</phase_requirements>

## Summary

This phase is a pure server-side logic fix inside `packages/server/src/gameEngine.ts`, `draftSession.ts`, `roomHandlers.ts`, and `packages/shared/src/types.ts`/`formations.ts`. No new packages, no new UI. The core problem is that `PlayerPiece.number` is currently treated as a **derived** value (recomputed from formation slot index every time `buildSquadPieces` runs, and explicitly re-tied to slot on every reposition/substitution swap) rather than a **permanent** value assigned once per person and carried forward untouched thereafter.

Research traced every place `number`/`jerseyNumber` is read or written across both standard and draft team-selection modes and found **three concrete, currently-shipping violations** of the locked decisions that were not fully enumerated in `48-CONTEXT.md`'s file list, plus confirmation that one of the four `applyRosterContinuity` call sites (the mechanism CONTEXT.md worried most about) is **already correct** and needs no code change:

1. **Standard-mode bench numbers are wrong today** (`roomHandlers.ts` ~1008-1017): they use each `PoolPlayer`'s own canonical `number` field (1–11, the identity number CONTEXT.md's D-01 explicitly said NOT to use), not a random 15–99 draw. This directly resolves CONTEXT.md's "Open verification item."
2. **`applySubstitution` violates NUMBER-02 today** (`gameEngine.ts` ~3679-3708, ~3711-3728) — a bench player entering the pitch currently inherits the **vacated slot's** number (SUB-03's documented contract: "the substitute inherits the slot's `id`/`teamId`/`number`/`position`"), not their own permanent bench number. The reverse assignment (the newly-benched outgoing player's bench entry) is also backwards — it copies the *incoming* player's old bench number, not the outgoing player's own number. **This function was not in CONTEXT.md's canonical file list and must be added to the plan's scope.**
3. **`DRAFT_REARRANGE` can orphan a bench number post-draft-complete** (`roomHandlers.ts` ~1182+, `draftSession.ts` `applyRearrange`) — rearranging a lineup player onto the bench after `draftComplete` (legal per the existing T-29-07-01 gap-closure comment) never adds them to `homeBenchNumbers`/`awayBenchNumbers`, so the consuming code's `session.homeBenchNumbers[id] ?? 0` fallback silently gives them jersey number **0**.

`applyRosterReposition` (canonical ref, confirmed) also needs the fix CONTEXT.md anticipated: it explicitly re-ties `number` to slot on every swap and must instead let `number` travel with the person.

**Primary recommendation:** Model the fix as "assign once at the earliest point identity is known, then treat `number` as an opaque field that every subsequent piece-mutating function carries forward via full-object spread and never recomputes." Concretely: keep `buildSquadPieces`'s slot-derived computation only for the very first build (`buildInitialGameState`, matched against `confirmedHomeOrder`/`confirmedAwayOrder`), fix `applyRosterReposition` and `applySubstitution` to stop re-deriving `number`, fix the standard-mode bench-number generation to reuse `assignBenchNumbers` (already imported in `roomHandlers.ts`), and add a "fill gaps, never re-roll existing" pass wherever bench membership can change after numbers were first assigned (both standard and draft mode, at the point `confirmedHomeBench`/`confirmedAwayBench` is finally built in the `LINEUP_CONFIRM` handler).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Jersey number assignment (starters, slot-derived) | API / Backend (`gameEngine.ts`) | — | Computed once at `buildInitialGameState` time from `confirmedHomeOrder`/`confirmedAwayOrder` + `FORMATIONS`; server-authoritative, never client-supplied. |
| Jersey number assignment (bench, random 15–99) | API / Backend (`draftSession.ts` + `roomHandlers.ts`) | — | `assignBenchNumbers` uses `crypto`-backed `randomInt` (never client-supplied, never `Math.random`); must run identically for standard and draft rooms. |
| Jersey number persistence across reposition/substitution/reset | API / Backend (`gameEngine.ts` pure functions) | — | All roster mutations are pure functions over `GameState`; no persistence layer exists (in-memory rooms only) — "permanent" means "never recomputed for the lifetime of the room process," not durable storage. |
| Jersey number display (pitch, bench, roster screens) | Browser / Client | — | Client already renders `piece.number` / `BenchEntry.jerseyNumber` verbatim wherever it appears today; no client-side lookup logic depends on the number's value (no `.number === 9` found in `packages/client/src`), so **no client changes are required** by this phase. |

## Package Legitimacy Audit

Not applicable — this phase installs no new packages. All work is within existing `gameEngine.ts`, `draftSession.ts`, `roomHandlers.ts`, `formations.ts`, and `types.ts`.

## Architecture Patterns

### Number Lifecycle (current vs. required)

```
CURRENT (broken):                          REQUIRED (permanent):
┌──────────────────┐                       ┌──────────────────┐
│ buildSquadPieces  │  recomputes number    │ buildSquadPieces  │  computes number ONLY
│ (called at every  │  from slot index      │ (still called at │  the first time — every
│ reset AND at      │  on EVERY call        │ every reset, but  │  subsequent call's number
│ initial build)    │                       │ its output number │  is discarded by the
└──────────────────┘                       │  is never trusted) │  applyRosterContinuity
        │                                   └──────────────────┘  overlay (verified: already
        ▼                                                          correct, no change needed)
┌──────────────────┐
│ applyRosterRepos  │  ties number to SLOT   ┌──────────────────┐
│ -ition (swap)     │  (`number: pieceA.     │ applyRosterRepos  │  number is NOT re-derived;
│                   │   number`)             │ -ition (swap)     │  it travels with the person
└──────────────────┘                        │                   │  via the unmodified spread
        │                                    └──────────────────┘
        ▼
┌──────────────────┐
│ applySubstitution │  substitute inherits   ┌──────────────────┐
│                   │  the SLOT's number     │ applySubstitution │  substitute keeps THEIR
│                   │  (`...outPiece`)       │                   │  OWN permanent number
└──────────────────┘                        │                   │  (`benchEntry.jerseyNumber`)
                                              └──────────────────┘
```

### Recommended Model: Compute Once, Then Treat `number` as Opaque

1. **Starters:** `number` is set exactly once, inside `buildSquadPieces`, but **only when called from `buildInitialGameState`** (i.e., the very first build with `confirmedHomeOrder`/`confirmedAwayOrder`). Every other call site of `buildSquadPieces` (via `buildKickOffPieces`, used at all 4 reset points) still computes a slot-derived `number` internally — this is **harmless and requires no defensive change**, because `applyRosterContinuity` immediately overlays `...currentPiece` (which carries the real permanent `number`) over the rebuilt array, discarding the reset build's recomputed number. This was independently verified by reading all 4 call sites (`gameEngine.ts:5128-5131`, `5225-5228` [via the shot-duel branch], `8399-8402`, `10334-10337`) — every one follows the identical `applyRosterContinuity(buildKickOffPieces(...), state.pieces)` pattern.
2. **Bench (both modes):** `jerseyNumber` is set exactly once, at the earliest point bench membership is known for a given player, using the existing `assignBenchNumbers` shuffle-without-replacement helper (`draftSession.ts:394-406`) — reused for standard mode too, not reimplemented.
3. **Every subsequent mutation function** (`applyRosterReposition`, `applySubstitution`) must stop writing a computed `number`/`jerseyNumber` value and instead let it flow through unchanged via the existing full-object spread (`...pieceA`, `...pieceB`, `...outPiece`, `...benchEntry`).
4. **"Never re-roll, only fill gaps"** is best implemented as a small pure helper — e.g. `fillMissingBenchNumbers(benchIds: string[], existing: Record<string, number>, rng): Record<string, number>` — that returns `existing` unchanged for ids already present and draws only for ids missing an entry, chosen from the range excluding numbers already in use. This can wrap or sit beside `assignBenchNumbers` (which currently always draws for every id passed in, with no "already has one" check) and should run at both (a) the draft-complete transition (`roomHandlers.ts:1154-1161`) and (b) the point `confirmedHomeBench`/`confirmedAwayBench` is finally read in the `LINEUP_CONFIRM` handler (`roomHandlers.ts:~968-1018`), to close the `DRAFT_REARRANGE` gap (Pitfall 5).

### Recommended Project Structure

No new files or directories are required. All changes are localized to:
```
packages/shared/src/
├── types.ts        # BenchEntry.jerseyNumber doc comment update (Pitfall 6); no shape change needed
└── formations.ts    # no change — FORMATIONS already has slotId/slotRole; read-only reference

packages/server/src/
├── gameEngine.ts     # buildSquadPieces (kickoff-striker anchor fix), applyRosterReposition
│                     # (stop tying number to slot), applySubstitution (number bugfix — NEW
│                     # scope beyond CONTEXT.md's file list)
├── draftSession.ts   # assignBenchNumbers reused as-is; optionally add a "fill gaps" wrapper
└── roomHandlers.ts   # standard-mode bench-number generation fix (~1008-1017); optional
                       # gap-fill pass in LINEUP_CONFIRM handler for post-draftComplete rearranges
```

### Pattern: Slot-Based Kickoff-Striker Anchor (replaces number-based lookup)

**What:** Find the piece occupying the formation's designated `slotId === 'ST'` slot, by array index, instead of matching `p.number === 9`.
**When to use:** Inside `buildSquadPieces`, for the kickoff-striker positioning logic (NUMBER-03/D-07).
**Why it's safe:** Verified all 4 formations (`4-4-2`, `5-3-2`, `4-3-3`, `3-4-3`) in `formations.ts` — each has **exactly one** slot with `slotId === 'ST'`. Squad-order arrays (`homeSquad`/`awaySquad`) are built by mapping `homePlayers[i]` to `homeSlots[i]` 1:1, so the ST slot's array index is a pure property of the formation, independent of which player currently occupies it or what number they wear.

```typescript
// Source: packages/shared/src/formations.ts (read directly — verified)
// Current (gameEngine.ts:325, to be replaced):
const kickingStriker = pieces.find((p) => p.teamId === attackingTeam && p.number === 9);

// Required (D-07):
const attackingSlots = attackingTeam === 'home' ? homeSlots : awaySlots;
const attackingSquad = attackingTeam === 'home' ? homeSquad : awaySquad;
const stSlotIndex = attackingSlots.findIndex((s) => s.slotId === 'ST');
const kickingStriker = stSlotIndex === -1 ? undefined : attackingSquad[stSlotIndex];
```

### Anti-Patterns to Avoid

- **Re-deriving `number` inside any function that already has a `PlayerPiece` in hand:** If a function receives a `PlayerPiece` (or `BenchEntry`) and spreads it forward, do not explicitly overwrite `number`/`jerseyNumber` unless the function is genuinely doing the once-only initial assignment. `applyRosterReposition`'s `number: pieceA.number` / `number: pieceB.number` and `applySubstitution`'s implicit inheritance via `...outPiece` are both instances of this anti-pattern that must be removed.
- **Hand-rolling a second random-number generator for standard-mode bench:** `assignBenchNumbers` (`draftSession.ts:394-406`) already does exactly what D-02/D-04 require (shuffle-without-replacement over `[15,99]`, seeded by the injected `RandomIntFn`, never `Math.random`). Reuse it; do not write a parallel implementation in `roomHandlers.ts`'s standard-mode branch.
- **Treating `PoolPlayer.number` as a jersey number for anything other than starters-at-build-time:** `PoolPlayer.number` (`teams.ts:26`) is explicitly documented as "Jersey number **within source squad** (1–11 per squad; 0 for free agents)" — a squad-relative identity field, not a match jersey number. D-01 already forbids using it for starters' displayed numbers; the standard-mode bench bug (Critical Finding 1) is exactly this anti-pattern applied to bench players.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|--------------|-----|
| Random unique bench number in [15,99] | A new shuffle/random-draw function in `roomHandlers.ts` for standard mode | `assignBenchNumbers` (`draftSession.ts:394-406`), already imported into `roomHandlers.ts` and used for draft mode | Already implements shuffle-without-replacement with an injected `RandomIntFn` (never `Math.random`, consistent with the project's "never generate dice/randomness insecurely" convention); D-04 requires standard and draft mode to use the identical rule, so reuse is both correct and the path of least duplication. |
| "Only draw a number for players who don't already have one" | A bespoke per-call-site conditional scattered across `roomHandlers.ts` | One small pure helper (e.g. `fillMissingBenchNumbers`) called from both the draft-complete transition and the `LINEUP_CONFIRM` handler | Centralizes the "never re-roll, fill gaps only" rule (D-05) in one tested place instead of two independently-written conditionals that can drift out of sync. |

**Key insight:** Every piece of machinery this phase needs already exists in the codebase (`assignBenchNumbers`, the full-object-spread pattern used throughout `gameEngine.ts`, `applyRosterContinuity`'s identity-overlay pattern). This phase is a **removal/correction** of three places where numbers are wrongly re-derived, plus one new small "fill gaps" helper — not new infrastructure.

## Common Pitfalls

### Pitfall 1 (Critical Finding 1): Standard-mode bench numbers use the wrong field today
**What goes wrong:** `roomHandlers.ts` line 1010/1015 sets `jerseyNumber: p.number` where `p` is a `PoolPlayer` from `getSquadPlayers`/`getGenericBenchPlayers` — this is the squad-identity number (1–11, or 0 for free agents), not a random 15–99 draw.
**Why it happens:** The draft-mode branch (lines 970-979) correctly reads `session.homeBenchNumbers[id]` (populated by `assignBenchNumbers` at draft-complete), but the standard-mode branch (lines 1008-1017, added in Phase 46 for the generic-placeholder-bench feature) was written independently and never wired to the same random-number mechanism.
**How to avoid:** Replace `jerseyNumber: p.number` in the standard-mode branch with a call to `assignBenchNumbers(homeBenchPlayers.map(p => p.id), randomInt)` (mirroring the draft-mode call at line 1158), then map each id to its drawn number.
**Warning signs:** A standard-mode bench card displaying a number in the 1-11 range (colliding with, or duplicating, a starter's number) instead of 15-99. This also means today's standard-mode bench numbers can literally **collide with starting-XI numbers** (e.g., a bench player showing `#4` while a starting defender also wears `#4`), which independently violates D-03's per-team uniqueness rule even before D-02 is considered — this is a live bug, not just an inconsistency.

### Pitfall 2 (Critical Finding 2 — reassurance, not a bug): `applyRosterContinuity` already does the right thing
**What could go wrong (but doesn't):** It would be easy to assume all 4 goal/half-time reset call sites need code changes to preserve numbers.
**Why it's actually fine:** `applyRosterContinuity` (`gameEngine.ts:3982-3991`) is `resetPieces.map((resetPiece) => { const currentPiece = ...find by id...; return { ...currentPiece, position: resetPiece.position }; })` — it spreads the **entire live piece** (including `number`) and overrides only `position`. Verified this exact call pattern at all 4 sites (`5128-5131`, the shot-duel branch, `8399-8402`, `10334-10337`).
**How to avoid wasted work:** Do not modify `applyRosterContinuity` or its 4 call sites. Focus effort on making sure `state.pieces` (the `currentPieces` argument) already holds permanent numbers by the time any reset runs — which is guaranteed once Pitfalls 3 and 4 below are fixed, since resets always happen after squad-build/substitution/reposition, never before.
**Warning signs:** none expected — this is a positive verification, include a regression test that goal/half-time resets preserve a non-slot-standard number (e.g., a repositioned player's or a substitute's number) to lock in this already-correct behavior against future regressions.

### Pitfall 3: `applyRosterReposition` explicitly re-ties number to slot on swap
**What goes wrong:** Lines 3924-3935 build the two swapped pieces with explicit `number: pieceA.number` / `number: pieceB.number` — i.e., number stays with the SLOT (`id`), not the PERSON. This is the exact bug NUMBER-01/02 target, and the function's own docstring (lines 3795-3798, 3800-3802) currently documents this as **intentional**: "the swap moves the OCCUPANT between slots — `id`, `position` and `number` stay bound to the slot."
**Why it happens:** This was Phase 42's deliberate design (justified at the time by keeping `applyRosterContinuity`'s overlay simple) — Phase 48 is the phase that explicitly supersedes this design per CONTEXT.md.
**How to avoid:** Remove the `number: pieceA.number` / `number: pieceB.number` lines so `newA`/`newB` inherit `number` from the spread (`...pieceB`/`...pieceA` respectively) — i.e., number now follows the person being moved, not the slot. Also update the docstring (lines 3795-3813) which currently asserts the opposite as load-bearing design rationale — stale documentation here would actively mislead a future reader.
**Warning signs:** Existing test `gameEngine.rosterReposition.test.ts:63-86` ("happy path: two outfield same-team pieces swap occupants; id/position/**number unchanged**") explicitly asserts `newA.number === a.number` (the OLD slot-tied contract) and `newB.number === b.number` — this test encodes the bug and must be rewritten to assert the new contract (`newA.number === b.number` i.e. person B's own number moves with them into slot A, and vice versa) as part of this phase, not left passing coincidentally.

### Pitfall 4: Substitution violates NUMBER-02 today (not in CONTEXT.md's file list — new scope)
**What goes wrong:** `applySubstitution` (`gameEngine.ts:3604-3774`) builds the incoming piece via `{ ...outPiece, playerId: inPoolPlayer.id, ... }` (lines 3687-3708) — this spreads the **outgoing (vacated slot's) piece**, so the substitute inherits the slot's number, not their own. The function's own docstring (line 3681-3683) documents this as intentional: "the substitute inherits the slot's `id`/`teamId`/`number`/`position`." Symmetrically, the newly-benched outgoing player's bench entry (lines 3715-3728) is built with `jerseyNumber: benchEntry.jerseyNumber` — but `benchEntry` here is the **incoming player's** bench entry (found by `inPlayerId` at line 3645), so the outgoing player's new bench card shows the incoming player's OLD number, not their own.
**Why it happens:** Same Phase 40 "slot owns the number" design as Pitfall 3, applied to substitution instead of reposition — this function was correctly identified as needing a change by the CONTEXT.md success criteria ("unchanged after... a substitution") but was **not listed in CONTEXT.md's canonical_refs file list**. Flag this explicitly to the planner as additional required scope.
**How to avoid:**
- Incoming piece: set `number: benchEntry.jerseyNumber` explicitly (the incoming player's own permanent bench number) instead of inheriting it via the `...outPiece` spread.
- Outgoing player's new bench entry: set `jerseyNumber: outPiece.number` (their own permanent number, which they take with them onto the bench) instead of `benchEntry.jerseyNumber`.
- Update the docstring at lines 3681-3686 which currently states the opposite as the documented, load-bearing contract.
**Warning signs:** Existing test `gameEngine.substitution.test.ts:176-189` ("SUB-03: substitute inherits id/number/position...") explicitly asserts `expect(newPiece.number).toBe(outPiece.number)` — this test encodes the bug and must be rewritten (new assertion: `newPiece.number` should equal the incoming player's own bench number) as part of this phase.
**Practical implication:** Under the corrected model, a substitute can legitimately wear a number outside 1–11 while playing on the pitch (e.g., `#37` playing at ST) — this mirrors real football, where a substitute's shirt number does not change to match the position they're filling in for.

### Pitfall 5 (Critical Finding 3): `DRAFT_REARRANGE` can orphan a bench number after draft-complete
**What goes wrong:** Bench numbers are assigned exactly once, at the `draftComplete` transition (`roomHandlers.ts:1154-1161`, calling `assignBenchNumbers(session.homeBenchIds, randomInt)`). But `DRAFT_REARRANGE` (`roomHandlers.ts:1182+`, delegating to `applyRearrange` in `draftSession.ts:279-327`) is explicitly documented as legal **after** `draftComplete` and before the requesting side confirms their lineup (see the `T-29-07-01` comment at `roomHandlers.ts:1175-1180`). `applyRearrange` freely moves card ids between `lineupSlots` and `benchIds` but never touches `homeBenchNumbers`/`awayBenchNumbers`. If a lineup player is rearranged onto the bench post-draft-complete, their id is now in `benchIds` but has no entry in `homeBenchNumbers` — and the consuming code at line 972/977 (`session.homeBenchNumbers[id] ?? 0`) silently falls back to jersey number **0**.
**Why it happens:** `assignBenchNumbers` was written as a one-shot "assign for the current bench membership" call, with no mechanism to detect and backfill bench membership that changes afterward.
**How to avoid:** Add a "fill gaps, never re-roll existing" pass — either (a) re-run at every `DRAFT_REARRANGE` that changes bench membership, or (b) simpler: run it once at the point `confirmedHomeBench`/`confirmedAwayBench` is actually built in the `LINEUP_CONFIRM` handler (`roomHandlers.ts:970-979`), checking each `session.homeBenchIds` entry against `session.homeBenchNumbers` and drawing fresh numbers only for ids missing an entry (excluding numbers already in use). Option (b) is simpler (one call site, not scattered across every rearrange path) and is recommended, but either satisfies D-05.
**Warning signs:** A draft-mode bench card showing jersey number `0` after a post-draft-complete rearrange — write a regression test that rearranges a lineup player onto the bench after `draftComplete` and asserts their `jerseyNumber` is a valid unique 15-99 value, not `0`.

### Pitfall 6: Stale type documentation will actively mislead implementers
**What goes wrong:** `packages/shared/src/types.ts:112-114` documents `BenchEntry.jerseyNumber` as: "Draft rooms: `DraftSession.*BenchNumbers`; standard rooms: **the pool player's own `number`**." This comment describes the current (buggy) behavior as if it were the intended contract.
**How to avoid:** Update this comment as part of the fix so it accurately states both modes use a random 15-99 draw via `assignBenchNumbers`, assigned once and never re-rolled.
**Warning signs:** A future contributor reading this comment in isolation would conclude the Pitfall-1 bug is intentional and "fix" a correct implementation back to the broken one.

### Pitfall 7: Kickoff-striker anchor fix must be verified across ALL 4 buildSquadPieces call contexts
**What goes wrong:** `buildSquadPieces` is called both at initial match build (`buildInitialGameState`, with `confirmedHomeOrder`/`confirmedAwayOrder`) and at every reset (`buildKickOffPieces`, always with the DEFAULT `getSquadPlayers` order, no confirmed order passed — this is pre-existing, unrelated-to-this-phase behavior, confirmed by reading `buildKickOffPieces`'s signature at `gameEngine.ts:522-528`). The slot-based anchor fix (D-07) works correctly in both contexts because the ST slot's array index is a pure formation property, not dependent on which player-order array was used to build the squad — but this equivalence should be covered by a test in both contexts (initial build and reset), not just one.
**How to avoid:** Add/update tests covering: (a) initial kickoff anchor via `buildInitialGameState` with a confirmed order where the ST-slot player does NOT have jersey number 9 (e.g., after this phase's other fixes make that possible only post-first-reposition, but the *test* itself doesn't need permanent-number machinery — it can directly construct formation slots or squad arrays), and (b) a goal/half-time reset where the previously-repositioned or substituted-in ST-slot occupant is still correctly anchored despite wearing a non-9 number.
**Warning signs:** Existing tests `formations.test.ts:47-51` ("every formation has exactly one slot with jerseyNumber === 9") and `gameEngine.phase23.test.ts:66-79` ("Test 5: kicking team jersey-#9 piece anchored to kick-off hex", using `p.number === 9` as the lookup) test the OLD number-based mechanism by field name. These should be updated to assert via `slotId === 'ST'` / the new lookup, with the number-based assertions either removed or kept only as an incidental "still happens to be 9 in the default unmoved case" sanity check — not as the primary correctness mechanism.

## Code Examples

### Current (to be replaced): standard-mode bench number generation
```typescript
// Source: packages/server/src/roomHandlers.ts:1008-1017 (read directly, verified)
confirmedHomeBench = homeBenchPlayers.map((p) => ({
  playerId: p.id,
  jerseyNumber: p.number, // BUG: PoolPlayer.number is 1-11 squad-identity, not a bench draw
  status: 'available' as const,
}));
```

### Correct pattern already used by draft mode (reuse this)
```typescript
// Source: packages/server/src/roomHandlers.ts:970-979 (read directly, verified) — draft mode does this correctly already
confirmedHomeBench = session.homeBenchIds.map((id) => ({
  playerId: id,
  jerseyNumber: session.homeBenchNumbers[id] ?? 0, // populated by assignBenchNumbers at draftComplete
  status: 'available' as const,
}));
```

### `assignBenchNumbers` — the helper to reuse for standard mode
```typescript
// Source: packages/server/src/draftSession.ts:387-406 (read directly, verified)
export function assignBenchNumbers(benchIds: string[], rng: RandomIntFn): Record<string, number> {
  const range = Array.from(
    { length: BENCH_NUMBER_MAX - BENCH_NUMBER_MIN + 1 },
    (_, i) => i + BENCH_NUMBER_MIN,
  );
  const shuffled = shuffle(range, rng);
  const numbers: Record<string, number> = {};
  benchIds.forEach((id, index) => {
    numbers[id] = shuffled[index]!;
  });
  return numbers;
}
```

### Current (to be fixed): `applyRosterReposition` swap ties number to slot
```typescript
// Source: packages/server/src/gameEngine.ts:3924-3935 (read directly, verified)
const newA: PlayerPiece = {
  ...pieceB,
  id: pieceA.id,
  position: pieceA.position,
  number: pieceA.number, // BUG (D-05): forces number to stay with the slot, not the person
};
const newB: PlayerPiece = {
  ...pieceA,
  id: pieceB.id,
  position: pieceB.position,
  number: pieceB.number, // BUG (D-05): same issue, mirrored
};
```

### Current (to be fixed): `applySubstitution` incoming/outgoing number handling
```typescript
// Source: packages/server/src/gameEngine.ts:3687-3708, 3715-3728 (read directly, verified)
const newPiece: PlayerPiece = {
  ...outPiece, // BUG: carries outPiece.number forward (the vacated slot's number)
  playerId: inPoolPlayer.id,
  firstName: inPoolPlayer.firstName,
  // ... other identity/attribute fields correctly taken from inPoolPlayer ...
  redCarded: false,
  yellowCards: 0,
  injuryCount: 0,
  // MISSING: number: benchEntry.jerseyNumber (the incoming player's own permanent number)
};
// ...
const newTeamBench: BenchEntry[] = benchEntries.map((e) =>
  e.playerId === inPlayerId
    ? {
        playerId: outPiece.playerId!,
        jerseyNumber: benchEntry.jerseyNumber, // BUG: this is the INCOMING player's old number,
                                                // not the outgoing player's own number
        status: 'subbedOut' as const,
        yellowCards: outPiece.yellowCards ?? 0,
        injuryCount: outPiece.injuryCount ?? 0,
      }
    : e,
);
```

## State of the Art

Not applicable — this is an internal game-logic correctness fix within a stable, already-chosen stack (TypeScript, no framework version dependency). No external ecosystem changes are relevant.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| — | (none) | — | Every claim in this research was verified directly against the current repository source (`Read`/`Grep` on `gameEngine.ts`, `draftSession.ts`, `roomHandlers.ts`, `formations.ts`, `types.ts`, `teams.ts`, `teamConfig.ts`, and the relevant `__tests__/*.test.ts` files) rather than drawn from training knowledge or web search. No `[ASSUMED]` claims are present. |

**If this table is empty:** All claims in this research were verified or cited — no user confirmation needed. (Table is empty by design — see note above.)

## Open Questions

1. **Should the "fill gaps" bench-number backfill run eagerly on every `DRAFT_REARRANGE`, or lazily once at `LINEUP_CONFIRM`?**
   - What we know: Both satisfy D-05's observable contract (never re-roll existing, only fill gaps for newly-bench players). Lazy (once, at `LINEUP_CONFIRM`) touches one call site; eager (on every rearrange) keeps `draftSession.homeBenchNumbers` always in sync with `homeBenchIds` but touches the `DRAFT_REARRANGE` handler too.
   - What's unclear: Whether any other code path reads `session.homeBenchNumbers` directly (for display during the draft/rearrange UI, before `LINEUP_CONFIRM`) — if so, lazy backfill would leave that intermediate UI showing a stale/missing number until confirm.
   - Recommendation: Grep the client for any pre-confirm bench-number display during draft rearrange; if found, prefer the eager approach. This research did not find such a client dependency in the time available — flagged for the planner to do a final confirm-or-deny grep before choosing.

## Environment Availability

Not applicable — no external tools, services, or runtimes beyond the existing Node.js/pnpm/vitest toolchain already used throughout the project. No new dependency surface is introduced by this phase.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (server: `vitest run`, config at `packages/server/vitest.config.ts`) |
| Config file | `packages/server/vitest.config.ts` — `include: ['src/**/*.test.ts']`, `environment: 'node'` |
| Quick run command | `pnpm --filter @counter-attack/server test -- <file-glob>` (or `pnpm --filter @counter-attack/server exec vitest run <file>`) |
| Full suite command | `pnpm --filter @counter-attack/server test` |

**Windows note (project memory):** vitest worker-crash flake is a known intermittent issue on this environment — rerun failed runs with `--pool=forks` before concluding a real regression.

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| NUMBER-01 | Starter number assigned once at build, independent of slot recompute on reset | unit | `vitest run src/__tests__/gameEngine.phase23.test.ts` (existing, needs Pitfall 7 rewrite) + new assertion in build test | ✅ existing file, ❌ new assertions (Wave 0) |
| NUMBER-02 (reposition) | Number follows person on swap | unit | `vitest run src/__tests__/gameEngine.rosterReposition.test.ts` (existing, needs Pitfall 3 rewrite) | ✅ existing file, ❌ new assertions (Wave 0) |
| NUMBER-02 (substitution) | Substitute keeps own number; outgoing player's bench entry gets own number | unit | `vitest run src/__tests__/gameEngine.substitution.test.ts` (existing, needs Pitfall 4 rewrite) | ✅ existing file, ❌ new assertions (Wave 0) |
| NUMBER-02 (goal/half-time reset) | `applyRosterContinuity` preserves permanent number | unit | `vitest run src/__tests__/gameEngine.rosterReposition.test.ts` or a dedicated continuity test — add regression case with a non-default number | ✅ existing coverage of the function; ❌ explicit permanent-number regression case (Wave 0) |
| NUMBER-03 | Kickoff-striker anchor uses slot lookup, works when striker's number ≠ 9 | unit | `vitest run src/__tests__/formations.test.ts src/__tests__/gameEngine.phase23.test.ts` (existing, needs Pitfall 7 rewrite) | ✅ existing file, ❌ new assertions (Wave 0) |
| NUMBER-04 | All 4 reset call sites preserve number (goal-unsaveable, goal-shot-duel, penalty, half-time) | integration | `vitest run src/__tests__/gameEngine.substitution.test.ts src/__tests__/replay.integration.test.ts` (spot-check via existing reset-covering suites) | ✅ existing coverage, ❌ explicit permanent-number assertion per site (Wave 0) |
| NUMBER-05 | Draft-mode bench number assigned once, survives post-draftComplete rearrange | integration | `vitest run src/__tests__/draftSession.integration.test.ts` (existing bench-number-range coverage at line ~685, needs new post-rearrange case) | ✅ existing file, ❌ new rearrange-after-complete case (Wave 0) |
| (standard-mode bench) | Standard-mode bench numbers are random 15-99, unique per team | unit/integration | New test in `roomHandlers`-adjacent suite or `gameEngine.substitution.test.ts`'s standard-mode bench setup | ❌ Wave 0 — no existing coverage found for standard-mode bench *number range*, only bench *membership* |

### Sampling Rate
- **Per task commit:** `pnpm --filter @counter-attack/server exec vitest run <touched-test-file>`
- **Per wave merge:** `pnpm --filter @counter-attack/server test`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] New/updated assertions in `gameEngine.rosterReposition.test.ts` — number follows person, not slot, on swap (Pitfall 3)
- [ ] New/updated assertions in `gameEngine.substitution.test.ts` — substitute keeps own number; outgoing player's bench entry gets own number, not the incoming player's old number (Pitfall 4)
- [ ] New/updated assertions in `formations.test.ts` / `gameEngine.phase23.test.ts` — kickoff anchor via `slotId === 'ST'`, verified independent of jersey number (Pitfall 7)
- [ ] New test: standard-mode bench numbers are random 15-99, unique per team, not `PoolPlayer.number` (Pitfall 1 / Critical Finding 1)
- [ ] New test: `DRAFT_REARRANGE` after `draftComplete` moving a lineup player onto the bench yields a valid unique 15-99 number, not `0` (Pitfall 5 / Critical Finding 3)
- [ ] New test: goal/half-time reset preserves a non-slot-standard permanent number end-to-end (Pitfall 2 reassurance — regression lock, not a new fix)

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Not touched by this phase — no auth surface changes. |
| V3 Session Management | no | No session changes. |
| V4 Access Control | no | No access-control changes; ownership checks in `applyRosterReposition`/`applySubstitution` are unchanged by this phase (only `number` handling changes). |
| V5 Input Validation | yes | All number assignment remains fully server-authoritative — no client-supplied jersey number is ever consumed at any call site (verified: numbers are always server-computed from `FORMATIONS` or `assignBenchNumbers`, never read from a client payload). This phase must preserve that invariant. |
| V6 Cryptography | yes | Random bench-number draws must continue to use the injected `RandomIntFn` (backed by `crypto.randomInt` per the project's existing locked decision "Never generate dice on the client; all rolls use `crypto.randomInt` server-side") — never `Math.random`. The standard-mode fix (Pitfall 1) must call `assignBenchNumbers` with the same `randomInt` already imported in `roomHandlers.ts`, not a new insecure generator. |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Client supplies its own jersey number in a substitution/reposition payload | Tampering | Continue the existing pattern: `applySubstitution`/`applyRosterReposition` never accept a `number` parameter from the caller; number is always derived server-side from existing state (`benchEntry.jerseyNumber`, the person's own stored `number`). No new attack surface is introduced by this phase — verify no new function signature accidentally adds a client-suppliable number field. |
| Predictable bench numbers (weak RNG) | Information Disclosure (low severity — cosmetic, not security-critical, but consistency matters) | `assignBenchNumbers` already uses the injected `RandomIntFn` (`crypto.randomInt`-backed); reuse for standard mode rather than introducing `Math.random()`. |

## Sources

### Primary (HIGH confidence — direct codebase verification)
- `packages/server/src/gameEngine.ts` (`buildSquadPieces` lines 277-360; `buildInitialGameState` lines 362-527; `buildKickOffPieces` lines 522-528; `applySubstitution` lines 3604-3774; `applyRosterReposition` lines 3830-3965; `applyRosterContinuity` lines 3982-3991; all 4 reset call sites at 5128-5131, ~5225-5228, 8399-8402, 10334-10337; `relocateRedCardedToBench` lines 870-896) — read directly.
- `packages/server/src/roomHandlers.ts` (bench-build branch lines 939-1018; `DRAFT_PICK` bench-number assignment lines 1154-1161; `DRAFT_REARRANGE` handler lines 1182-1250+) — read directly.
- `packages/server/src/draftSession.ts` (`assignBenchNumbers` lines 387-406; `applyRearrange` lines 279-327; `BENCH_NUMBER_MIN`/`MAX` lines 64-65) — read directly.
- `packages/shared/src/formations.ts` (`FormationSlot` type lines 25-33; `FORMATIONS` registry, all 4 formations' `ST` slots confirmed at lines 56, 72, 87, 103) — read directly.
- `packages/shared/src/types.ts` (`PlayerPiece` lines 14-90 incl. `number`/`playerId`/`role`; `BenchEntry`/`BenchEntryStatus` lines 105-125; `DraftSession.homeBenchNumbers`/`awayBenchNumbers` lines 1204-1210) — read directly.
- `packages/shared/src/teams.ts` (`PoolPlayer.number` doc comment line 25-26) — read directly.
- `packages/shared/src/teamConfig.ts` (`getSquadPlayers`, `getGenericBenchPlayers` lines 404-424) — read directly.
- `packages/server/src/__tests__/gameEngine.rosterReposition.test.ts`, `gameEngine.substitution.test.ts`, `gameEngine.phase23.test.ts`, `formations.test.ts`, `draftSession.integration.test.ts` — read directly for existing-contract assertions that will need rewriting.

### Secondary (MEDIUM confidence)
- None — no web/external documentation was needed for this phase; the entire domain is internal to this repository.

### Tertiary (LOW confidence)
- None.

## Metadata

**Confidence breakdown:**
- Standard stack: N/A — no new packages
- Architecture: HIGH — every claim traced to specific line numbers in the current source
- Pitfalls: HIGH — 3 of the 5 pitfalls are confirmed-live bugs (not hypothetical), found by tracing actual code paths, not inferred

**Research date:** 2026-08-31
**Valid until:** Until this phase's plan executes (codebase is actively changing; line numbers will shift once Phase 47 or other work lands more commits — re-verify line numbers at plan time if execution is delayed).
