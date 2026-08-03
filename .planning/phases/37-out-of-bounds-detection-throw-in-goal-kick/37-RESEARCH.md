# Phase 37: Out-of-Bounds Detection, Throw-In & Goal Kick - Research

**Researched:** 2026-08-03
**Domain:** Server-authoritative hex-grid football FSM extension (TypeScript monorepo, Node/Socket.io + React/Zustand) — internal game-logic research, no new external libraries
**Confidence:** HIGH — every finding below is grounded in direct inspection of the current committed source (file:line citations), cross-checked against the two milestone-level research documents already on disk (`ARCHITECTURE.md`, `FEATURES.md`) and the locked CONTEXT.md decisions that override parts of them. No web/library research was needed — this phase is 100% internal FSM/state-model work.

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions

**Goal Kick's dedicated identity (overrides research's reuse recommendation)**

- **D-01:** Goal Kick does **not** reuse the existing `GK_RESTART`→`GK_KICK_TARGET`→`GK_KICK_MOVE` chain, despite `ARCHITECTURE.md` Q1 recommending exactly that reuse as the cheapest path. GOALKICK-01's requirement text ("independent of the existing GK-catch/save restart chain") is to be read literally and structurally, not just cosmetically: build **new `GamePhase` value(s)**, **new `GameState` fields**, a **new repositioning step** (GOALKICK-02's 6-hex both-final-thirds window — goalkeeper's team first, then opposing team — which the existing `GK_RESTART` chain has no equivalent of today), a **new target-selection step**, and a **new travel/move chain** (GOALKICK-05's 1-player-per-team 3-hex movement while the kick travels). This is a deliberate rejection of the research recommendation — confirmed/flagged explicitly below.
- **D-02:** Within those new phases, reuse the existing **pure formula/helper functions** — the High Pass 8+ combined-score accuracy check, the unmodified Standard Pass mechanic (GOALKICK-04 says so explicitly), the `HEADER` duel resolution, and `computeLooseBall`/Loose Ball handling. Do not duplicate this dice/scoring math — only the state-machine wiring (phases, fields, transitions) is new. This mirrors how `FREE_KICK_SETUP` already calls into shared pure functions rather than reimplementing pass/header math.
- **D-03:** Exact phase-naming and field-naming (e.g. `GOAL_KICK_SETUP`/`GOAL_KICK_TARGET`/`GOAL_KICK_MOVE` or similar) is Claude's discretion — follow the existing `GK_KICK_TARGET`/`GK_KICK_MOVE` naming convention for consistency, but these must be genuinely new phase values, not the reused GK-restart ones.

**Out-of-bounds classification edge cases**

- **D-04:** A throw-in that itself exits the pitch (overthrown past the far touchline, straight into touch) is reclassified by the same Out-of-Bounds Detection system as any other exit — sideline again → throw-in to the _other_ team at the new spot; byline → corner/goal kick per the normal last-touched-by rules. This matches THROWIN-05 and real football; no special-cased "re-throw" or Loose Ball behavior for this case.
- **D-05:** When the ball's exit hex is ambiguous between sideline and byline (corner-adjacent geometry), default to **byline classification** (goal kick / corner kick) over sideline (throw-in). Confirm this default against the actual grid's corner-hex geometry during implementation — it's a starting assumption, not verified against exact hex coordinates yet.
- **D-06:** `lastTouchedBy` (per `ARCHITECTURE.md` Q2's recommended `ball.lastTouchedBy: {pieceId, teamId} | null` field) updates on **any contact**, not just possession changes — every deflection, header contact, GK save/parry, and loose-ball bounce off a piece updates it, even when that piece never gains `ball.carrierId`. A deflected shot that goes out is "last touched by" the deflector, matching real football and resolving the ambiguity `FEATURES.md` flagged.

**New setup-screen visual conventions**

- **D-07:** Whether Throw-In Setup and Goal Kick Setup panels match Phase 35's locked conventions (`"Confirm"` button verb, no container border, two-line title+detail helper text, `"{Team} is repositioning…"` waiting phrasing) exactly, versus adapting details where they don't read naturally, is **Claude's discretion during planning** — apply the established pattern wherever it fits, use judgment elsewhere.
- **D-08:** The new repositioning windows (throw-in placement, goal kick's two-team 6-hex reposition, both restart types' ball-travel movement windows) reuse the **existing** hex-highlight tint system (`HIGHLIGHT_STYLES`/`RING_STYLES` in `HexCell.tsx`) — map onto the closest existing tint type (e.g. the kick-off-repositioning tint, `safe`/`selectable` tints). Do not add new tint types to `docs/HIGHLIGHT-REFERENCE.md` for this phase unless something genuinely doesn't fit any existing type.

**Throw-in sequence — Movement Phase choice model**

- **D-09 (structural, not a binary upfront pick):** THROWIN-03's "1 or 2 Movement Phases" is modeled as a **per-step decision**, not a choice made once at sequence entry:
  1. Throw-in setup places the thrower + ball at the exit hex.
  2. **Movement Phase 1 is mandatory** — no throw option is available before it.
  3. After Movement Phase 1 completes, the manager chooses: **Standard throw-in** (take the throw now, low) / **High throw-in** (take the throw now, high) / **Move** (take a second Movement Phase).
  4. If **Move** is chosen again, Movement Phase 2 runs.
  5. After Movement Phase 2, only **Standard throw-in** / **High throw-in** remain — no third move option (hard cap at 2).
- **D-10:** The Low (Standard Pass) vs. High (header-required) throw-type choice within the actual throw step is **Claude's discretion during planning** — match whatever selection-UI pattern the existing High Pass / Standard Pass choice already uses elsewhere in the codebase.

### Claude's Discretion

- Exact `GamePhase`/`GameState` field naming for the new Goal Kick chain (D-03).
- Exact adherence-vs-adaptation balance for Throw-In/Goal-Kick panel styling relative to Phase 35 conventions (D-07).
- Low/High throw-type selection UI shape for throw-ins (D-10).
- Exact corner-hex geometry verification for the byline-default edge case (D-05) — implementation-time verification, not a design decision.

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope. Corner Kick (Phase 38) was referenced repeatedly as context/precedent but never proposed as in-scope for this phase.

</user_constraints>

<phase_requirements>

## Phase Requirements

| ID          | Description                                                                      | Research Support                                                                                                                                 |
| ----------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| OOB-01      | Game tracks which piece/team last touched the ball, independent of possession    | `ball.lastTouchedBy` field design (Architecture Patterns §1); enumerated update sites (§1.3)                                                     |
| OOB-02      | Sideline exit awards throw-in to the non-touching team                           | Sideline/byline classification via rectangular grid boundaries (§2); LOOSE_BALL clamp hook (§3)                                                  |
| OOB-04      | Byline exit after attacker touch (or untouched off-target shot) awards goal kick | Same classification function; SHOT duel-tie routes through the same LOOSE_BALL site (§3, Pitfall 3)                                              |
| OOB-05      | Toggle disables all new behavior; existing clamp preserved exactly               | Toggle plumbing pattern (§6); early-return guard pattern from `ARCHITECTURE.md`                                                                  |
| THROWIN-01  | Throw-in awarded on any sideline exit (pass/loose ball)                          | Classification hook applies uniformly to all ball-exit paths (§3)                                                                                |
| THROWIN-02  | Attacker places thrower+ball at exit hex                                         | New `THROW_IN_SETUP` phase design (§4.1)                                                                                                         |
| THROWIN-03  | 1 or 2 Movement Phases before the throw                                          | Recommended reuse of the real `MOVE` phase + new `LastActionType` rows (§4.1, Code Examples)                                                     |
| THROWIN-04  | Throw ≤6 hexes, Low (Standard Pass) or High (header)                             | Reuse of `STANDARD_PASS`/`HIGH_PASS`→`HEADER` pure mechanics with a 6-hex context cap (§4.1)                                                     |
| THROWIN-05  | A throw that exits is reclassified by the same system                            | Single shared classification hook, not a special case (§3, D-04)                                                                                 |
| GOALKICK-01 | Goal kick is its own dedicated flow, independent of GK_RESTART                   | New phase family per D-01 (§4.2) — explicit override of `ARCHITECTURE.md`'s reuse finding                                                        |
| GOALKICK-02 | Both final-thirds reposition ≤6 hexes each, GK's team first                      | Recommended reuse of `FREE_MOVE_ATTACK`/`FREE_MOVE_DEFENSE`'s per-piece-budget shape, not `FREE_KICK_STAGES`'s distinct-piece-count shape (§4.2) |
| GOALKICK-03 | GK chooses Kick (High Pass, 8+) or Standard Pass                                 | New `GOAL_KICK_CHOICE` phase (§4.2)                                                                                                              |
| GOALKICK-04 | Inaccurate Kick → Loose Ball; Standard Pass unmodified                           | Reuse `computeLooseBall`/pass-delivery mechanics per D-02 (§4.2)                                                                                 |
| GOALKICK-05 | Both teams move 1 player ≤3 hexes while a Kicked ball travels; receiver headers  | New `GOAL_KICK_MOVE` phase mirroring `GK_KICK_MOVE`'s shape (§4.2)                                                                               |
| GOALKICK-06 | Independent game-creation toggle                                                 | Toggle plumbing pattern (§6)                                                                                                                     |

</phase_requirements>

## Summary

This phase is pure internal FSM extension work on an already-mature, convention-heavy codebase — there is no new library to evaluate and no external API to integrate. The two prerequisite research documents already on disk (`.planning/research/ARCHITECTURE.md`, `.planning/research/FEATURES.md`) did the heavy lifting on the general shape of this milestone; this document narrows that to Phase 37's exact scope (OOB-01/02/04/05, THROWIN-01..05, GOALKICK-01..06 — explicitly **not** OOB-03/CORNER-\*, which is Phase 38), reconciles it against the CONTEXT.md decisions that override part of `ARCHITECTURE.md`'s recommendation (D-01), and grounds every recommendation in actual file:line citations rather than the prior documents' more general framing.

Three findings materially change or sharpen what the planner should build:

1. **The project does not use `honeycomb-grid` anywhere** despite `CLAUDE.md`'s stack table naming it. All hex math (`hexDistance`, `hexNeighbors`, `hexLine`, `hexesInRange`, offset↔cube conversion) is a hand-rolled, well-tested module at `packages/shared/src/hex.ts` — this is the single source of truth to extend, not a library API to learn. `packages/shared/src/pitch.ts` builds a **rectangular** 37×26 hex grid (`q ∈ [0,36]`, `r ∈ [0,25]`) with `isPitchHex`/`PITCH_HEXES`/`PITCH_REGIONS` already doing O(1) boundary membership checks — sideline-vs-byline classification is **not** the hard hex-grid geometry problem `FEATURES.md` worried about; it reduces to two simple range comparisons (§2).
2. **Goal Kick's phase design, per D-01's explicit override, should mirror the exact `GK_RESTART`→`GK_KICK_TARGET`→`GK_KICK_MOVE` _shape_ with all-new phase names/fields** — and its 6-hex-per-team reposition window (GOALKICK-02) structurally matches the existing `FREE_MOVE_ATTACK`/`FREE_MOVE_DEFENSE` per-piece-budget pattern (`freeMoveEligibleIds`/`freeMoveUsedPace`, capped at 6 hexes per piece) far more closely than it matches `FREE_KICK_SETUP`'s distinct-piece-count stage-budget pattern. Recommending the wrong template here would produce a needlessly complex reposition step.
3. **Throw-In's "1 or 2 Movement Phases" (THROWIN-03/D-09) should reuse the actual `MOVE` phase engine** (the real 4-5-2 `movementSlot` sequence), not a bespoke single-piece reposition phase — the hook point is `applyEndTurn`'s `nextSlot === null` branch (`gameEngine.ts:1141-1159`), which already has an established precedent for branching to a non-generic next-phase (`gameEngine.ts:1106-1132`, the "GK carrier in own penalty area → GK_RESTART" branch). The post-movement three-way choice ("Standard Throw-In" / "High Throw-In" / "Move") should reuse the existing generic `PASS` choice-phase + `ELIGIBLE_NEXT_ACTIONS` mechanism with two new `LastActionType` rows, rather than a bespoke choice phase — this is the same idiom every other post-movement choice in the engine already uses.

**Primary recommendation:** Add `ball.lastTouchedBy` to `BallState` first (touches ~10 mutation sites but is mechanically simple and is the hard prerequisite for everything else); build a single pure `classifyOutOfBounds()` function in a new `packages/shared/src/outOfBounds.ts`; hook it into the `LOOSE_BALL` clamp site (`gameEngine.ts:2769-2833`, the single dominant convergence point for scattered/inaccurate/duel-tied balls); build Throw-In as setup-placement + reused `MOVE` phase + reused `PASS`-phase choice; build Goal Kick as an all-new phase quartet (`GOAL_KICK_SETUP` → `GOAL_KICK_CHOICE` → `GOAL_KICK_TARGET` → `GOAL_KICK_MOVE`) that borrows `GK_RESTART`'s _shape_ and `FREE_MOVE_ATTACK/DEFENSE`'s _reposition-budget model_, wired behind a new `outOfBoundsEnabled` toggle following the exact `gameSpeed`/`teamType` settings precedent.

## Architectural Responsibility Map

| Capability                                          | Primary Tier                                                   | Secondary Tier                                                           | Rationale                                                                                                                                                                                          |
| --------------------------------------------------- | -------------------------------------------------------------- | ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Ball last-touch tracking                            | API / Backend (`gameEngine.ts`)                                | —                                                                        | Server-authoritative state; must be correct before any classification decision is made. Never derived client-side.                                                                                 |
| Sideline/byline classification                      | API / Backend (`packages/shared`, imported by server)          | —                                                                        | Pure function, no I/O — lives in `packages/shared` so it is importable by server (enforcement) and, if ever needed, client (display-only). Classification itself is never trusted from the client. |
| Throw-in placement / movement / throw               | API / Backend (phase FSM, `gameEngine.ts`)                     | Browser/Client (`FreeKickSetupPanel`-style panel, hex-tint highlighting) | Server validates every placement/move/throw; client only renders legal-target highlights and dispatches intents, exactly like every existing restart flow.                                         |
| Goal kick reposition / choice / target / travel     | API / Backend (phase FSM, `gameEngine.ts`)                     | Browser/Client (new setup panel)                                         | Same split as above — server owns all phase transitions and dice; client is a thin intent-dispatcher + highlight renderer.                                                                         |
| Out-of-Bounds/Restarts toggle                       | API / Backend (`Room`/`GameState` boolean, gates FSM branches) | Browser/Client (`GameSettingsScreen` checkbox)                           | Mirrors the existing `gameSpeed`/`teamType` two-step pattern: client collects the toggle pre-match, server bakes it into `GameState` and is the sole enforcement point.                            |
| Hex-tint highlighting for new repositioning windows | Browser/Client (`HexCell.tsx`)                                 | —                                                                        | Purely presentational; D-08 requires reusing existing `HexHighlightType` members, not inventing new ones.                                                                                          |

## Package Legitimacy Audit

**Not applicable to this phase.** No new external packages are introduced — every mechanism described below (`ball.lastTouchedBy`, `classifyOutOfBounds`, the new `GamePhase` values, the new setup panels) is built entirely from code patterns and pure functions already present in `packages/shared` and `packages/server`. `honeycomb-grid` appears in `CLAUDE.md`'s stack table and `docs/ARCHITECTURE.md` as a historical recommendation but **is not installed or imported anywhere in the current codebase** (confirmed via repo-wide search — zero matches under `packages/*/src`); the project's actual hex math is the hand-rolled `packages/shared/src/hex.ts` module described below. Do not add `honeycomb-grid` as a dependency for this phase — it would introduce an unused, redundant hex-math implementation alongside the one already in production use.

**Packages removed due to [SLOP] verdict:** none — no packages were proposed.
**Packages flagged as suspicious [SUS]:** none.

## Architecture Patterns

### System Architecture Diagram

```
Client (React/Zustand)                         Server (Node/Socket.io, authoritative)
┌────────────────────────┐                     ┌──────────────────────────────────────────┐
│ ThrowInSetupPanel /     │  socket.emit(...)   │ gameHandlers.ts                            │
│ GoalKickSetupPanel      │ ───────────────────▶│  isProcessing mutex → phase guard →         │
│ (mirrors                │                     │  delegate to pure apply* fn → broadcast     │
│  FreeKickSetupPanel     │                     └───────────────┬────────────────────────────┘
│  structure)             │                                     │
└────────────▲────────────┘                                     ▼
             │ full GameState                     gameEngine.ts (pure FSM functions)
             │ broadcast after                    ┌────────────────────────────────────────┐
             │ every action                       │ Existing ball-exit convergence points:   │
             │                                     │  • LOOSE_BALL scatter clamp (2769-2833)  │
┌────────────┴────────────┐                        │  • SHOT duel-tie → LOOSE_BALL (2299-2335)│
│ HexCell.tsx tint system  │                        │  • GK save-spill (2337-2394, Phase-38    │
│ (existing HighlightType  │                        │    scope only — see Pitfall 3)           │
│ reused per D-08)         │                        └───────────────┬──────────────────────────┘
└──────────────────────────┘                                        │ NEW: classifyOutOfBounds()
                                                                     │ hook (packages/shared/
                                                                     │ outOfBounds.ts, pure fn)
                                                                     ▼
                                                    ┌─────────────────────────────────────────┐
                                                    │ sideline exit → THROW_IN_SETUP           │
                                                    │ byline exit, attacker-touched/untouched  │
                                                    │   → GOAL_KICK_SETUP                      │
                                                    │ outOfBoundsEnabled === false → existing   │
                                                    │   clamp-only behavior, unchanged (OOB-05) │
                                                    └─────────────────────────────────────────┘
```

A reader tracing "attacker's inaccurate Standard Pass sails past the sideline" follows: `GAME_PASS` handler → `validatePass`/accuracy check fails → engine transitions to `LOOSE_BALL` phase with a scatter roll pending → `GAME_ROLL` handler → `applyRoll`'s `LOOSE_BALL` case computes the scatter trajectory via `computeLooseBall` → **(new)** before clamping, checks each step against `classifyOutOfBounds`; the first step that leaves the rectangular grid triggers sideline/byline classification instead of clamping → transitions into `THROW_IN_SETUP` or `GOAL_KICK_SETUP` (gated on `outOfBoundsEnabled`).

### 1. `ball.lastTouchedBy` — the hard prerequisite (OOB-01)

**Recommendation (matches `ARCHITECTURE.md` Q2, adopted verbatim by CONTEXT.md D-06):** add to `BallState` (`packages/shared/src/types.ts:45-48`):

```typescript
export type BallState = {
  position: HexCoord;
  carrierId: string | null;
  /** OOB-01: piece/team that last made contact with the ball, independent of
   *  current possession (carrierId). Updates on EVERY contact — carrier changes,
   *  deflections, header contact, GK saves/parries/spills, loose-ball bounces off
   *  a piece — even when that contact never grants carrierId (D-06). */
  lastTouchedBy: { pieceId: string; teamId: 'home' | 'away' } | null;
};
```

Because `BallState` is a nested object assigned via `ball: { position, carrierId }` object literals at **every** ball-mutating call site (dozens across `gameEngine.ts` — passes, shots, headers, deflections, GK actions, loose-ball landings), this is a wide-touching but entirely mechanical change: add `lastTouchedBy` to every one of those object literals. **Do not use a default/spread shortcut that silently omits it** — a missed site is a silent OOB-classification bug (wrong team awarded the restart), not a crash, so it will not be caught by TypeScript unless `lastTouchedBy` is a **required** (non-optional) field on `BallState`, which is the recommended design specifically so the compiler forces every construction site to supply it.

Concrete update sites to audit (non-exhaustive — this list will need to be verified complete during planning/implementation, not just at these anchors):

- `applyMove` — carrier picks up a loose ball, or dribbles (carrier unchanged, but still "touching")
- `STEAL_ATTEMPT`/`TACKLE_ATTEMPT` resolution (`gameEngine.ts:808-947`) — successful tackle/steal changes touch
- `STANDARD_PASS`/`FIRST_TIME_PASS`/`HIGH_PASS`/`LONG_BALL` delivery (`gameEngine.ts` PASS case, ~1800-2100) — passer touches at kick, receiver touches at delivery
- `HEADER` resolution — both contestants "touch" even on a tie
- `SHOT`/`SNAPSHOT` duel resolution (`gameEngine.ts:2107-2399`) — shooter touches at kick; GK touches on save/spill/parry
- `DEFLECT_ATTEMPT` (`gameEngine.ts`) — the deflecting defender becomes last-toucher (this is the D-06 case `FEATURES.md` flagged as ambiguous — now resolved: deflector counts even without gaining `carrierId`)
- `LOOSE_BALL` landing (`gameEngine.ts:2769-2833`) — if the scatter lands on an occupied hex, that piece becomes last-toucher
- `GK_KICK`/`GK_PUNT`/`applyQuickThrow` (`gameEngine.ts:2960-3097`) — GK touches at kick

**Do not derive `lastTouchedBy` retroactively from `eventLog` scans** — both real trigger sites (the `LOOSE_BALL` clamp and, in a future phase, GK save-spill) need the answer synchronously and cheaply; a live field is O(1), an event-log walk is O(n) and fragile against future `ActionEvent` additions (explicit anti-pattern already called out in `ARCHITECTURE.md`).

### 2. Sideline vs. byline classification — simpler than the milestone research assumed

`FEATURES.md`'s Out-of-Bounds Detection table flagged "hex grid, not a rectangular pitch" as a source of geometric ambiguity. **This does not apply to this codebase's actual pitch model.** `packages/shared/src/pitch.ts:9-17` builds the pitch as a **fully rectangular** `q ∈ [0,36] × r ∈ [0,25]` grid (962 hexes, no irregular boundary shape) — confirmed by `isPitchHex` (`pitch.ts:195-197`), which is a flat `PITCH_HEX_SET.has()` check against that rectangle. There is no octagonal/hexagonal pitch outline to reason about.

This means classification reduces to simple range comparisons on the _attempted_ next hex during any scatter/trajectory walk:

```typescript
// packages/shared/src/outOfBounds.ts (new file)
export type OutOfBoundsExit = 'SIDELINE' | 'BYLINE' | null;

/** Classifies why `hex` is off the pitch. Call only on a hex that already
 *  fails isPitchHex — returns null if hex is still on-pitch (defensive). */
export function classifyExit(hex: HexCoord): OutOfBoundsExit {
  const qOut = hex.q < 0 || hex.q > 36;
  const rOut = hex.r < 0 || hex.r > 25;
  if (!qOut && !rOut) return null; // still on pitch
  // D-05: ambiguous double-boundary exit (corner-adjacent, both q and r out
  // of range in the same step) defaults to BYLINE.
  if (qOut) return 'BYLINE'; // q out of range = short edge = goal line
  return 'SIDELINE'; // r out of range = long edge
}
```

`q=0`/`q=36` are the goal-line columns (`PITCH_REGIONS.homeGoal`/`awayGoal` sit exactly on those columns, `pitch.ts:68-69`) — so "q out of range" is unambiguously the byline. `r=0`/`r=25` are the long touchlines. The only genuine ambiguity is a single scatter/trajectory **step** that overshoots both bounds simultaneously (e.g., from `{q:1, r:1}` scattering to `{q:-1, r:-2}` in one hex-step) — D-05's byline-default rule (`qOut` checked first) handles this deterministically. **This should still be spot-checked against a few real corner-hex trajectories during implementation** (per D-05's own caveat), but it is a one-line ordering decision, not new geometry.

`classifyExit` needs to be combined with `ball.lastTouchedBy` to produce the actual restart type:

```typescript
export function classifyOutOfBounds(
  exit: 'SIDELINE' | 'BYLINE',
  lastTouchedByTeam: 'home' | 'away' | null,
): 'THROW_IN' | 'GOAL_KICK' | 'CORNER_KICK' {
  if (exit === 'SIDELINE') return 'THROW_IN'; // OOB-02: awarded to the OTHER team (caller inverts)
  // BYLINE. Which byline (home's own goal line vs away's) determines who is
  // "attacking" at that line — caller must pass the correct byline-owner team,
  // not just lastTouchedByTeam, to fully resolve GOAL_KICK vs CORNER_KICK.
  // Phase 37 scope: only GOAL_KICK is reachable (OOB-04). CORNER_KICK (OOB-03)
  // is Phase 38 — do not build its trigger branch yet, but do not make this
  // function's signature incompatible with adding it later.
  return lastTouchedByTeam === null ? 'GOAL_KICK' : 'GOAL_KICK'; // see note below
}
```

**Important scoping note for the planner:** Phase 37 only needs the `GOAL_KICK` branch of byline classification (OOB-04: byline exit after **attacker** touch, or untouched). OOB-03 (byline exit after **defender** touch → `CORNER_KICK`) is explicitly Phase 38 scope per CONTEXT.md's phase boundary. Recommend writing `classifyOutOfBounds` to return the theoretically-correct three-way result now (so Phase 38 doesn't have to touch this function's core logic, only its `CORNER_KICK` consumer branch), but Phase 37's engine call sites should only ever route the `GOAL_KICK` result live — assert/log if a `CORNER_KICK` result is ever produced during Phase 37 (it shouldn't be reachable yet since nothing awards it), rather than silently building the Corner Kick flow early.

### 3. Where to hook classification — the LOOSE_BALL clamp is the dominant convergence point

`gameEngine.ts:2769-2833` (the `LOOSE_BALL` phase's dice-resolution case) is **the single site every relevant ball-exit path in Phase 37's scope converges on**:

- Inaccurate Standard/High/Long pass → `LOOSE_BALL` phase entered with a pending scatter roll (mirrors the existing `applyRoll` PASS-branch inaccuracy handling)
- A tied SHOT duel (`gameEngine.ts:2299-2335`, `shotResultWithPenalty.outcome === 'LOOSE_BALL'`) → same `LOOSE_BALL` phase — this is also where OOB-04's "untouched off-target shot" scenario resolves: there is **no separate "MISS" shot outcome** in this codebase today (shots resolve to `GOAL`, `SAVE` (caught/spilled), or `LOOSE_BALL` on a duel tie) — an off-target shot that reaches a GK duel and ties is already routed through this exact site, so no new SHOT-outcome branch is needed, only correct `lastTouchedBy` bookkeeping (shooter touches at the moment of the shot) feeding into the classification at scatter time.
- Any other Loose Ball trigger (deflections, failed tackles that spill the ball, etc.) — same phase.

The existing clamp loop (`gameEngine.ts:2777-2783`):

```typescript
let clampedPos = from;
for (let step = 1; step <= distance; step++) {
  const next: HexCoord = computeLooseBall(from, direction, step as 1 | 2 | 3 | 4 | 5 | 6);
  if (isPitchHex(next)) clampedPos = next;
  else break;
}
```

is the exact hook point: **replace** "break" (stop clamping, ball stays at last valid hex) with "classify the first off-pitch `next` via `classifyExit`, and — gated on `state.outOfBoundsEnabled` — transition to `THROW_IN_SETUP` or `GOAL_KICK_SETUP` at that boundary hex instead of falling through to the existing clamp-and-continue-as-PASS-phase logic." When `outOfBoundsEnabled` is `false`, the existing clamp behavior must run completely unchanged (OOB-05) — recommend an early branch, not interleaved conditionals, per `ARCHITECTURE.md`'s own guidance: `if (!state.outOfBoundsEnabled) { /* existing clamp code, byte-for-byte unchanged */ } else { /* new classify-and-transition path */ }`.

### Pitfall 3 (elevated from Common Pitfalls — read before planning the hook points)

**GK save-spill (`gameEngine.ts:2337-2394`) is _not_ a Phase 37 hook, even though `ARCHITECTURE.md` lists it as a general OOB integration point.** A spilled save today has no scatter/trajectory computation at all — the ball simply drops to the GK's own effective position and is treated as a clean catch (`GK_RESTART`). There is no code path today where a save-spill could carry the ball over the byline for a corner kick (`OOB-03`, Phase 38 scope) or a goal kick (an already-caught-by-the-GK ball cannot also be "out of bounds"). **Do not build a save-spill OOB hook in this phase** — it is correctly out of scope; flag it explicitly for Phase 38 planning instead, since a real spill-scatter mechanic (if ever added) would be the trigger for `OOB-03`'s corner-kick-after-defensive-touch case, not anything Phase 37 needs.

### 4.1 Recommended Throw-In phase design (THROWIN-01..05)

**Setup (THROWIN-02):** new `GamePhase` value `THROW_IN_SETUP`. Much simpler than `FREE_KICK_SETUP` — single team, single piece, no stage table, no kicker-select sub-step distinct from the main placement (there is only one placement: the thrower, with the ball, at the exit hex). New `GameState` fields:

```typescript
throwInHex?: HexCoord | null;          // the exit hex (fixed target for placement)
throwInTeam?: 'home' | 'away' | null;  // team awarded the throw-in
throwInPhasesTaken?: 0 | 1 | 2 | null; // how many Movement Phases completed so far
```

Placement confirms → transition directly into the **existing** `MOVE` phase (`movementSlot: 'ATTACKER_4'`, `attackingTeam: throwInTeam`, `activeTeam: throwInTeam`, ball carried by the placed thrower) — this reuses the entire existing movement engine (`applyMove`, `applyEndTurn`, pace tracking, ZoI, offside) wholesale. This is the single biggest scope-reduction opportunity in the throw-in flow: **do not build a bespoke "Movement Phase" sub-mechanic** — THROWIN-03's capitalized "Movement Phase" almost certainly refers to the real 4-5-2 movement phase, the exact same unit of play used everywhere else in the engine.

**Post-movement choice (D-09's per-step three-way decision):** hook into `applyEndTurn`'s existing `nextSlot === null` branch (`gameEngine.ts:1141-1159`), which already has a precedent for branching to a non-generic next phase (the "GK carrier in own penalty area → GK_RESTART" check immediately above it, `gameEngine.ts:1106-1132`). Add an equivalent early branch: `if (state.throwInPhasesTaken !== null && state.throwInPhasesTaken !== undefined) { ... }` that sets a **new `LastActionType`** instead of the generic `'MOVEMENT_PHASE'`:

```typescript
// packages/shared/src/types.ts — LastActionType additions
| 'THROW_IN_MOVEMENT_1'
| 'THROW_IN_MOVEMENT_2'

// packages/shared/src/actionSequence.ts — ELIGIBLE_NEXT_ACTIONS additions
THROW_IN_MOVEMENT_1: new Set<NextActionType>(['STANDARD_PASS', 'HIGH_PASS', 'MOVEMENT']),
THROW_IN_MOVEMENT_2: new Set<NextActionType>(['STANDARD_PASS', 'HIGH_PASS']), // D-09 hard cap
```

This reuses the **existing generic `PASS` phase** as the choice screen — the same phase/UI (`ActionPanel`) already used for every other post-movement decision — instead of inventing a bespoke `THROW_IN_CHOICE` phase. The "Standard Throw-In" / "High Throw-In" / "Move" button set (per UI-SPEC's copy contract) is exactly `ELIGIBLE_NEXT_ACTIONS`-derived button rendering, the same mechanism `ActionPanel` already uses for every phase. If `MOVEMENT` is chosen again, increment `throwInPhasesTaken` and re-enter `MOVE` (mirrors the very first Movement Phase 1 entry); if a throw is chosen, `throwInPhasesTaken`/`throwInHex`/`throwInTeam` clear on delivery.

**The throw itself (THROWIN-04):** reuse `STANDARD_PASS` (Low) and `HIGH_PASS`→`HEADER` (High) mechanics **verbatim** per D-02's reuse instruction — but capped at **6 hexes**, not Standard Pass's 11 or High Pass's 15. `validatePass` (`packages/shared/src/passValidator.ts:66-`) takes a `passType` union with per-type distance caps hardcoded inline (`dist > 11`/`dist > 6`/`dist > 15`). Two viable approaches, both compatible with D-02:

1. Add a context-aware cap override parameter to `validatePass` (small, additive change), or
2. Follow the existing precedent at `gameHandlers.ts:1310` (`if (room.gameState.phase === 'KICK_OFF' && passType !== 'STANDARD_PASS')`) — a phase-based special case in the handler layer, checking `room.gameState.lastActionType` is one of the two throw-in rows and rejecting `dist > 6` before calling `validatePass` at all.

Either is acceptable; recommend (1) since it keeps the single-source-of-truth range logic in the shared validator rather than duplicating range enforcement in the handler.

**Reclassification (THROWIN-05/D-04):** because the throw delivery reuses the exact `STANDARD_PASS`/`HIGH_PASS` pure functions and those, on inaccuracy, already route through the shared `LOOSE_BALL` clamp site being made OOB-aware in §3, **no special-casing is needed** — a throw-in's own inaccurate/overthrown delivery is automatically reclassified by the same `classifyExit`/`classifyOutOfBounds` hook, exactly matching D-04's requirement that this be "the same detection system," not a bespoke re-throw branch.

### 4.2 Recommended Goal Kick phase design (GOALKICK-01..06, D-01 override)

Per D-01, this is deliberately **not** a trigger into the existing `GK_RESTART` chain — it is a new, structurally parallel phase family that borrows the _shape_ of `GK_RESTART`/`GK_KICK_TARGET`/`GK_KICK_MOVE` (`gameEngine.ts:2880-3097`) with all-new phase names, fields, and functions (D-03: naming is discretionary but should follow that existing convention).

**Reposition window (GOALKICK-02) — use the `FREE_MOVE_ATTACK`/`FREE_MOVE_DEFENSE` template, not `FREE_KICK_STAGES`.** This is the single most important structural correction this research makes to a naive reading of `FEATURES.md`/`ARCHITECTURE.md`'s more generic "reuse the staged-repositioning pattern" framing: GOALKICK-02 says **each player** may reposition **up to 6 hexes** — a per-piece pace budget — not a "kicking team places N distinct pieces" stage-count budget like `FREE_KICK_STAGES` (`{side, max}` = max _distinct pieces touched_). The existing field cluster that already models "N eligible pieces, each with its own hex budget, in a defined window" is `freeMoveEligibleIds`/`freeMoveUsedPace` (`types.ts:936-949`, driving `FREE_MOVE_ATTACK`/`FREE_MOVE_DEFENSE`). New phase: `GOAL_KICK_SETUP`, with fields modeled on that pair:

```typescript
goalKickWindow?: 'GK_TEAM' | 'OPPONENT' | null;              // which team's window is active
goalKickEligibleIds?: { gkTeam: readonly string[]; opponent: readonly string[] } | null; // final-third pieces only
goalKickUsedPace?: Readonly<Record<string, number>> | null;  // per-piece hexes used, capped at 6
```

Eligibility (which pieces may move) is computed once at trigger time: all pieces of each team currently in **that team's own final third** (`PITCH_REGIONS.homeThird`/`awayThird`, `pitch.ts:61,63` — reuse `isInRegion` directly, mirroring how `FREE_MOVE_*`'s eligible lists are precomputed). GK's team's window runs first (GOALKICK-02's explicit ordering), then the opponent's — two sequential sub-windows within the single `GOAL_KICK_SETUP` phase (`goalKickWindow` flips once the active team ends its window), not two separate `GamePhase` values (consistent with the `FREE_MOVE_ATTACK`/`FREE_MOVE_DEFENSE` precedent of using two distinct phases for two teams' windows — either two phase values or one phase + a window field is acceptable; recommend mirroring `FREE_MOVE_ATTACK`/`_DEFENSE`'s two-phase-value shape for consistency, i.e. `GOAL_KICK_SETUP_GK` / `GOAL_KICK_SETUP_OPPONENT`, since that is the more literal existing precedent).

**Choice (GOALKICK-03):** new phase `GOAL_KICK_CHOICE` — GK's team chooses `'kick'` (High Pass, 8+ combined score via `computeCombinedScore`, per D-02) or `'standard'` (Standard Pass, unmodified per GOALKICK-04's explicit "uses the existing Standard Pass mechanic unmodified"). Mirrors `applyGKRestart`'s choice-branching shape (`gameEngine.ts:2880-2957`) but as a new function (e.g. `applyGoalKickChoice`) over new phase values, per D-01.

- `'standard'` branch: resolves immediately via the existing `STANDARD_PASS`/`validatePass` delivery mechanic (GK as passer, normal range/no header requirement) — transitions straight to `PASS` phase, no travel-movement window (GOALKICK-05 only applies "while a **Kicked** ball travels" — Standard Pass, like every other Standard Pass in the engine, delivers instantly).
- `'kick'` branch: transitions to a new `GOAL_KICK_TARGET` phase (GK's team selects destination hex — mirrors `applyGKKickTarget`'s shape at `gameEngine.ts:2980-3029`, including the existing "cannot target own hex" / "cannot target opponent's final third" checks, reused verbatim as validation logic even though the phase itself is new) → on confirm, transitions to a new `GOAL_KICK_MOVE` phase (both teams reposition 1 piece ≤3 hexes while the ball is in the air — mirrors `GK_KICK_MOVE`'s exact field shape: `goalKickMoveSlot: 'KICKER' | 'OPP' | null`, `goalKickMovedPieceId`, `goalKickPaceUsed`, capped at 3, reusing the identical slot-alternation logic already proven at `gameEngine.ts:1432-1546`) → on completion, resolves the High Pass 8+ accuracy check: accurate → `HEADER` phase (receiver must attempt a header, reusing the exact `HIGH_PASS`→`HEADER` transition already implemented at `gameEngine.ts:2038-2083`); inaccurate → `LOOSE_BALL` phase via `computeLooseBall` (GOALKICK-04), which — because it is the same `LOOSE_BALL` site from §3 — is itself OOB-aware for any further scatter that exits the pitch.

### Recommended Project Structure (new files/additions only)

```
packages/shared/src/
├── outOfBounds.ts        # NEW — classifyExit(), classifyOutOfBounds() pure functions
├── types.ts               # MODIFIED — BallState.lastTouchedBy, new GamePhase values,
│                           #   new GameState fields (throwIn*/goalKick*), new
│                           #   LastActionType rows, new ActionEventType/ActionEvent variants
├── actionSequence.ts      # MODIFIED — ELIGIBLE_NEXT_ACTIONS: THROW_IN_MOVEMENT_1/_2 rows
packages/server/src/
├── gameEngine.ts          # MODIFIED — LOOSE_BALL clamp site (§3 hook), applyEndTurn
│                           #   throw-in branch, new apply* functions for THROW_IN_SETUP
│                           #   and the GOAL_KICK_* phase family
├── gameHandlers.ts        # MODIFIED — new socket handlers for throw-in placement/throw,
│                           #   goal-kick reposition/choice/target/move; validUndoPhases[]
│                           #   extended; ELIGIBLE_NEXT_ACTIONS-consuming handlers extended
├── roomStore.ts            # MODIFIED — Room.outOfBoundsEnabled? (mirrors gameSpeed/teamType)
packages/client/src/components/
├── ThrowInSetupPanel.tsx  # NEW — mirrors FreeKickSetupPanel structure (per UI-SPEC)
├── GoalKickSetupPanel.tsx # NEW — mirrors FreeKickSetupPanel/KickOffSetupPanel structure
├── GameBoard.tsx           # MODIFIED — phase-dispatch ternary (line ~328-336) extended
├── GameSettingsScreen.tsx # MODIFIED — new "Out-of-Bounds / Restarts" checkbox row
├── HexCell.tsx              # UNCHANGED unless a genuinely new tint case is found (D-08)
```

### Anti-Patterns to Avoid

- **Deriving `lastTouchedBy` from `eventLog` scans at classification time** — maintain it as a live field, not a derived-on-read value (§1, matches `ARCHITECTURE.md`'s explicit anti-pattern).
- **Reusing `GK_RESTART`/`GK_KICK_TARGET`/`GK_KICK_MOVE` for Goal Kick** — this is `ARCHITECTURE.md`'s own recommendation but is explicitly overridden by CONTEXT.md D-01. Do not silently revert to reuse because it is cheaper — GOALKICK-01's literal text requires structural independence.
- **Modeling Goal Kick's 6-hex reposition window as a `FREE_KICK_STAGES`-style distinct-piece-count budget** — it is a per-piece pace budget; use the `FREE_MOVE_ATTACK`/`FREE_MOVE_DEFENSE` template instead (§4.2).
- **Building a bespoke "Movement Phase" mechanic for Throw-In** — reuse the real `MOVE` phase engine (§4.1).
- **Building a bespoke `THROW_IN_CHOICE` phase** — reuse the existing generic `PASS` choice-phase + two new `LastActionType`/`ELIGIBLE_NEXT_ACTIONS` rows (§4.1) — this is the same idiom the engine already uses for every other post-action choice.
- **Building an OOB hook at the GK save-spill site in this phase** — out of scope; no scatter mechanic exists there today (Pitfall 3).
- **One `GamePhase` value per internal sub-stage** (e.g. `GOAL_KICK_STAGE_1`, `GOAL_KICK_STAGE_2`) — `ARCHITECTURE.md`'s established anti-pattern for this codebase; use a `window`/stage-index scalar field instead, or (per the `FREE_MOVE_ATTACK`/`_DEFENSE` precedent chosen above) two purpose-named phase values, not a numeric stage index, for the two-team reposition window specifically.

## Don't Hand-Roll

| Problem                                                          | Don't Build                                                                               | Use Instead                                                                                                                       | Why                                                                                                                                                                                                                            |
| ---------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Sideline/byline exit geometry                                    | A new hex-boundary-segment classifier from scratch                                        | `isPitchHex`/`PITCH_HEXES` + simple `q`/`r` range checks (§2)                                                                     | The pitch is a rectangle in this codebase's actual coordinate model — no polygon/segment math needed.                                                                                                                          |
| Scatter/trajectory math for a ball leaving the pitch             | A new direction/distance walker                                                           | `computeLooseBall` (`scoreUtils.ts:87-97`) — already parity-correct cube-coordinate math                                          | Already the single source of truth for every Loose Ball trajectory in the engine; a second implementation would drift.                                                                                                         |
| High Pass accuracy / combined-score checks                       | New dice-scoring math for the Kick option or the High throw-in                            | `computeCombinedScore` (`scoreUtils.ts:28-37`)                                                                                    | Already has the DICE-04 -2 penalty clamp built in; per D-02, this phase adds zero new dice math.                                                                                                                               |
| "Receiver must attempt a header" delivery                        | A new header-trigger mechanic                                                             | The existing `HIGH_PASS`→`HEADER` transition (`gameEngine.ts:2038-2083`)                                                          | Already handles the "no eligible headers → Loose Ball, else → HEADER phase" branching correctly; reuse verbatim for both the Goal Kick's Kick option and the throw-in's High option.                                           |
| Per-piece repositioning-budget tracking (6-hex Goal Kick window) | A new budget-tracking data structure                                                      | `freeMoveEligibleIds`/`freeMoveUsedPace` shape (`types.ts:936-949`)                                                               | Already solves "N eligible pieces, each with an independent hex budget, within a bounded window" — exactly GOALKICK-02's shape.                                                                                                |
| "Both teams move 1 piece ≤3 hexes while the ball travels"        | A new slot-alternation mechanic                                                           | The `GK_KICK_MOVE` slot-alternation logic (`gameEngine.ts:1432-1546`, `gkKickMovementSlot`/`gkKickMovedPieceId`/`gkKickPaceUsed`) | Identical shape to GOALKICK-05's requirement; copy the pattern into new `goalKick*` fields, don't design a new one.                                                                                                            |
| Undo support for the new staged phases                           | Deferred/skipped Undo (matching `FREE_KICK_SETUP`'s known Undo gap, tracked as tech debt) | The `FK_KICKER_CHOSEN`/`FK_STAGE_ADVANCE` boundary-event pattern (`types.ts:379-401`, scan logic `gameEngine.ts:1401+`)           | `FEATURES.md` explicitly flags "do not repeat the FREE_KICK_SETUP Undo gap across four more new staged flows" — decide and build Undo boundaries for the new phases from day one in this phase's plan, not as a follow-up bug. |

**Key insight:** every dice-scoring, geometry, and slot-alternation primitive this phase needs already exists in the codebase in a form ready to reuse. The actual new work is entirely state-machine wiring (new phases, new fields, new handlers) — not new algorithms. Treat any task that proposes new dice math, new scatter math, or a new budget-tracking shape as a signal to search the existing codebase harder before writing it.

## Common Pitfalls

### Pitfall 1: New `GamePhase` values are invisible unless registered in every consuming list

This codebase has a proven bug class (STATE.md: "new dice-roll event types are invisible to Undo/Replay unless registered in every relevant list... this bug class has already shipped twice"). The same risk applies to new **phase values**, not just event types. Every new `GamePhase` this phase introduces (`THROW_IN_SETUP`, `GOAL_KICK_SETUP_GK`/`GOAL_KICK_SETUP_OPPONENT` or equivalent, `GOAL_KICK_CHOICE`, `GOAL_KICK_TARGET`, `GOAL_KICK_MOVE`) must be added to:

- `GamePhase` union (`types.ts:403-430`) — TypeScript will then force the next two:
- `PHASE_LABEL: Record<GamePhase, string>` (`GameBoard.tsx:24-59`) — compile error if missed (a safety net, not optional).
- `GameBoard.tsx`'s phase-dispatch ternary (`GameBoard.tsx:328-336`) — **not** compiler-enforced; easy to silently skip and get a generic `ActionPanel` fallback instead of the new setup panel.
- `validUndoPhases: GamePhase[]` in the `GAME_UNDO` handler (`gameHandlers.ts:1130-1139`) — if Undo should be supported (recommended, per Don't Hand-Roll above).
- `BALL_MARKER_PHASES` (`BallLocationRing.tsx`, documented in `docs/HIGHLIGHT-REFERENCE.md` §3) — decide whether the ball-location white-outline marker should render during each new phase (recommended: yes, for target/move phases where the ball is mid-air or at a fixed hex, matching the existing 11-phase list's precedent of including every restart/kick phase).
- `PLAY_PHASES`/any other phase-classification lists not yet located — search the codebase for `GamePhase` array/Record literals before considering this list complete.

**Warning sign:** a new setup panel renders correctly but the ball's location marker never appears during it, or Undo silently no-ops — both are symptoms of an incomplete registration list, not a logic bug in the new phase's core function.

### Pitfall 2: New `ActionEventType`/`ActionEvent` variants need the same per-type checklist

STATE.md's own pitfall: "do not reuse the generic `DICE_ROLL` event type for new rolls — it reactivates a dormant full-slot Undo lockout." Any new dice roll this phase introduces (the Kick's High Pass accuracy roll, if it needs its own event beyond reusing the existing `HP_ACCURACY`/pass-delivery event shapes) needs its **own** `ActionEventType`, registered in: the `ActionEventType` union (`types.ts:65-107`), the `ActionEvent` discriminated union (`types.ts:114-401`), `applyUndo`'s boundary-scan logic if it should act as an undo boundary, and `buildReplayFrames`'s replay-eligible-types list (verify this list's location — referenced in STATE.md pitfalls as `REPLAY_ELIGIBLE_TYPES`, not directly located in this research pass; search before implementation). Recommend minimizing new event types by reusing `STANDARD_PASS`/`HIGH_PASS`/`GK_PUNT`-shaped events wherever the underlying mechanic is genuinely the same pure function (per D-02) — new event types should only be added for the genuinely new state transitions (placement, reposition-window-end, choice) that have no existing analog.

### Pitfall 3: GK save-spill is not an OOB hook in this phase

Covered in detail in Architecture Patterns §3 — repeated here because it directly contradicts a plausible reading of `ARCHITECTURE.md`'s more general integration-points table. Do not add out-of-bounds classification logic to `gameEngine.ts:2337-2394`.

### Pitfall 4: `validatePass` has no pitch-boundary check today

`packages/shared/src/passValidator.ts`'s `validatePass` function validates distance caps, path-blocking, and PASS-04 landing constraints — it does **not** call `isPitchHex` on the target hex anywhere in its body. This means an _accurate_ Standard/High/Long pass targeting an off-pitch hex is not rejected by the shared validator today; the client's hex-highlight system is the only current containment (only on-pitch hexes are ever offered as clickable pass targets). This has two implications for this phase:

1. The new throw-in's 6-hex range cap (§4.1) should be enforced the same way — a context-aware cap, not a pitch-boundary check, since pitch-boundary enforcement isn't this validator's existing job.
2. **Open question for the planner (see Open Questions below):** should an _accurate_ pass/throw/kick that a malicious or buggy client targets off-pitch also be OOB-classified, or should target selection itself be hard-rejected server-side? Recommend adding an explicit `isPitchHex(targetHex)` guard in the relevant new handlers (throw delivery, goal-kick target selection) as defense-in-depth (ASVS V5 — never trust client-supplied target hexes), independent of whether the general-purpose `validatePass` gets the same treatment.

### Pitfall 5: `buildInitialGameState` is a long positional-parameter function

`gameEngine.ts:317-331` — adding `outOfBoundsEnabled` (or any new toggle) means adding a new positional parameter to an already-long parameter list (currently 8 parameters), following the exact pattern `gameSpeed` used when it was added. Every call site that constructs initial game state must be updated; a missed call site silently defaults the new parameter (if given a default value) rather than erroring, so audit all call sites rather than trusting the type checker alone (TypeScript will not flag a missing _optional-with-default_ positional argument).

## Code Examples

### The exact hook point for OOB-gated vs. unchanged LOOSE_BALL clamp behavior (OOB-05)

```typescript
// gameEngine.ts, inside the 'LOOSE_BALL' case (~2769-2833), replacing the plain clamp loop:
const from = state.ball.position;
let clampedPos = from;
let exitInfo: { hex: HexCoord; kind: 'SIDELINE' | 'BYLINE' } | null = null;

for (let step = 1; step <= distance; step++) {
  const next: HexCoord = computeLooseBall(from, direction, step as 1 | 2 | 3 | 4 | 5 | 6);
  if (isPitchHex(next)) {
    clampedPos = next;
  } else {
    if (state.outOfBoundsEnabled) {
      const kind = classifyExit(next); // 'SIDELINE' | 'BYLINE' (never null here)
      exitInfo = { hex: next, kind: kind! };
    }
    break;
  }
}

if (exitInfo) {
  // route to THROW_IN_SETUP or GOAL_KICK_SETUP using state.ball.lastTouchedBy —
  // OOB-05 guarantees this branch is unreachable when outOfBoundsEnabled is false,
  // in which case execution falls through to the existing clampedPos/trajectory/
  // finalPosition logic completely unchanged.
}
```

### Existing `HIGH_PASS`→`HEADER` transition — the exact pattern to reuse for Goal Kick's Kick option and Throw-In's High option

```typescript
// gameEngine.ts:2038-2083 (existing, unmodified — cite as the reuse target)
if (newLastActionType === 'HIGH_PASS') {
  const homeEligible = state.pieces.some(
    (p) => p.teamId === 'home' && hexDistance(p.position, targetHex) <= 2,
  );
  const awayEligible = state.pieces.some(
    (p) => p.teamId === 'away' && hexDistance(p.position, targetHex) <= 2,
  );
  if (!homeEligible && !awayEligible) {
    // no eligible headers → LOOSE_BALL (no header contest)
  }
  // else → phase: 'HEADER', headerContestants/headerConfirmed/headerAccuracyRollPending set
}
```

### `applyEndTurn`'s existing precedent for branching to a non-generic next phase — the template for the Throw-In movement-count branch

```typescript
// gameEngine.ts:1106-1132 (existing, unmodified) — precedent pattern:
const carrier = state.ball.carrierId
  ? state.pieces.find((p) => p.id === state.ball.carrierId)
  : null;
if (carrier?.role === 'GK') {
  const ownArea = carrier.teamId === 'home' ? 'homePenaltyArea' : 'awayPenaltyArea';
  if (isInRegion(carrier.position, ownArea)) {
    return { ok: true, state: { ...state, phase: 'GK_RESTART' /* ... */ } };
  }
}
// NEW: an equivalent branch, inserted before the generic PASS return at line 1141:
if (state.throwInPhasesTaken !== null && state.throwInPhasesTaken !== undefined) {
  const nextLastActionType =
    state.throwInPhasesTaken === 0 ? 'THROW_IN_MOVEMENT_1' : 'THROW_IN_MOVEMENT_2';
  return {
    ok: true,
    state: {
      ...state,
      phase: 'PASS', // reuses the generic choice phase — see §4.1
      lastActionType: nextLastActionType,
      throwInPhasesTaken: (state.throwInPhasesTaken + 1) as 1 | 2,
      /* ...clock/offside fields unchanged from the generic branch... */
    },
  };
}
```

### `gameHandlers.ts` handler shape to follow exactly (mutex + phase guard + pure-function delegate)

```typescript
// Mirrors GAME_FREE_KICK_MOVE (gameHandlers.ts:1886-1955) — the template for every new
// throw-in/goal-kick socket handler in this phase.
socket.on(ClientEvents.GAME_THROW_IN_PLACE, (pieceId: string) => {
  const { roomCode } = socket.data;
  if (roomCode === undefined) return;
  const room = getRoom(roomCode);
  if (!room || room.isProcessing) return; // SC-5: drop duplicate silently

  room.isProcessing = true;
  try {
    if (room.gameState === null || room.gameState.phase !== 'THROW_IN_SETUP') {
      socket.emit(ServerEvents.GAME_ERROR, 'WRONG_PHASE');
      broadcastState(io, room);
      return;
    }
    // ...team/piece ownership checks, then delegate to a new pure apply* function...
    const result = applyThrowInPlace(room.gameState, pieceId);
    if (!result.ok) {
      socket.emit(ServerEvents.GAME_ERROR, result.reason);
      broadcastState(io, room);
      return;
    }
    room.gameState = result.state;
    broadcastState(io, room);
  } finally {
    room.isProcessing = false; // MUST be in finally — Pitfall 5 (project-wide convention)
  }
});
```

## State of the Art

Not applicable in the usual sense — this is a self-contained internal codebase extension, not an ecosystem-facing library integration. There is no "old approach vs. new approach" industry shift to track; the relevant history is entirely this project's own prior milestones (documented above via file:line citations to the existing `FREE_KICK_SETUP`/`GK_RESTART`/`FREE_MOVE_ATTACK` implementations this phase extends).

## Assumptions Log

| #   | Claim                                                                                                                                                                                          | Section                    | Risk if Wrong                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A1  | THROWIN-03's "Movement Phase" refers to the real 4-5-2 `MOVE` phase engine (both teams' slots), not a bespoke single-team reposition step                                                      | Architecture Patterns §4.1 | If the rulebook actually intends a throwing-team-only single-piece-budget reposition (closer to `FREE_MOVE_ATTACK` alone), the recommended reuse of the full `MOVE` phase would let the _defending_ team also move during what should be a throw-in-only setup window — this is the single highest-impact assumption in this document and should be confirmed against the physical rulebook text before implementation, not just inferred from capitalization. |
| A2  | Goal Kick's `GOAL_KICK_SETUP` reposition window should be split into two purpose-named phase values (`GOAL_KICK_SETUP_GK`/`GOAL_KICK_SETUP_OPPONENT`) rather than one phase + a `window` field | Architecture Patterns §4.2 | Low risk either way — this is explicitly D-03 Claude's-discretion naming/shape; flagged only so the planner picks one shape deliberately rather than drifting between both mid-implementation.                                                                                                                                                                                                                                                                 |
| A3  | An off-target/missed shot has no dedicated engine outcome today and is already covered by the existing duel-tie → `LOOSE_BALL` path                                                            | Architecture Patterns §3   | If a future/parallel phase adds a genuine "MISS" shot outcome with its own scatter, this phase's OOB hook (placed only at the `LOOSE_BALL` case) would need a second hook at that new site — verify no such change is planned concurrently in Phase 39 (Fouls/GK-Dive) before finalizing the hook-site list.                                                                                                                                                   |
| A4  | `validatePass`'s missing `isPitchHex` check is intentional/relied-upon by client-side containment, not an existing bug to silently fix in this phase                                           | Common Pitfalls §4         | If treated as a pre-existing bug and "fixed" as a side effect of this phase's work, it could change behavior for the three existing pass types outside this phase's scope — recommend leaving `validatePass` itself unchanged and adding defense-in-depth only in the new throw-in/goal-kick handlers.                                                                                                                                                         |

## Open Questions

1. **Does an accurate (non-scattering) pass/throw/kick targeting an off-pitch hex need OOB classification, or should it be a hard server-side rejection?**
   - What we know: `validatePass` does not check pitch bounds today (Pitfall 4); the client only offers on-pitch targets.
   - What's unclear: whether a determined/buggy client could submit an off-pitch target and what the correct server response is — accept-and-classify (treat as an immediate exit) vs. reject as invalid input.
   - Recommendation: reject as `OFF_PITCH` (matching the existing `applyGKKickTarget`/`applyQuickThrow` precedent, `gameEngine.ts:2986,3060`) for the new throw-in/goal-kick target-selection handlers specifically — these are new code, so adding the guard costs nothing. Leave `validatePass` itself untouched (A4).

2. **Exact split of `GOAL_KICK_SETUP` into one vs. two `GamePhase` values for the GK-team-first/opponent-second reposition windows.**
   - What we know: `FREE_MOVE_ATTACK`/`FREE_MOVE_DEFENSE` uses two phase values for an analogous two-team-sequential-window shape.
   - What's unclear: whether the planner should follow that precedent exactly or use a single `GOAL_KICK_SETUP` phase + a `goalKickWindow` field (closer to `FREE_KICK_SETUP`'s single-phase-plus-stage-index shape).
   - Recommendation: two phase values, matching `FREE_MOVE_ATTACK`/`_DEFENSE` more literally, since GOALKICK-02's ordering ("goalkeeper's team first, then opposing team") is a hard two-step sequence with no intermediate stages, unlike `FREE_KICK_SETUP`'s four-stage table. Either is compile-correct; pick one and apply it consistently to both the reposition window and (if needed) `GOAL_KICK_MOVE`'s kicker/opponent slots.

3. **Whether `GOAL_KICK_MOVE`'s "both teams move 1 player ≤3 hexes" window should also gate on `outOfBoundsEnabled` transitioning back to the pre-restart clamp behavior, or is unconditionally new** — since the entire Goal Kick flow is only reachable when the toggle is on (it is triggered exclusively via the new OOB classification hook), this sub-phase has no "toggle off" fallback state to preserve, unlike the `LOOSE_BALL` clamp site. Recommendation: no additional toggle-branching needed inside the Goal Kick phase family itself — the toggle only needs to gate the **entry point** (the classification hook in §3), not every downstream phase.

## Environment Availability

Not applicable — this phase has no external tool/service/runtime dependencies beyond the existing pnpm/Node/Vitest toolchain already in continuous use across the project. No new packages, no new external services.

## Validation Architecture

### Test Framework

| Property           | Value                                                                                                                                        |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Framework          | Vitest (confirmed via `packages/server/vitest.config.ts`, `packages/shared/vitest.config.ts`)                                                |
| Config file        | `packages/server/vitest.config.ts` (`environment: 'node'`, `include: ['src/**/*.test.ts']`); `packages/shared/vitest.config.ts` (same shape) |
| Quick run command  | `pnpm --filter @counter-attack/shared test -- <pattern>` / `pnpm --filter @counter-attack/server test -- <pattern>`                          |
| Full suite command | `pnpm --filter @counter-attack/shared test && pnpm --filter @counter-attack/server test`                                                     |

### Phase Requirements → Test Map

| Req ID                 | Behavior                                                                             | Test Type        | Automated Command                                           | File Exists?                                                                                                              |
| ---------------------- | ------------------------------------------------------------------------------------ | ---------------- | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| OOB-01                 | `ball.lastTouchedBy` updates on every contact type                                   | unit             | `pnpm --filter @counter-attack/server test -- gameEngine`   | ❌ Wave 0 (new assertions in existing `gameEngine.test.ts` or a new file)                                                 |
| OOB-02/04              | `classifyExit`/`classifyOutOfBounds` pure functions                                  | unit             | `pnpm --filter @counter-attack/shared test -- outOfBounds`  | ❌ Wave 0 — new `packages/shared/src/outOfBounds.test.ts`                                                                 |
| OOB-05                 | Toggle off preserves exact existing clamp behavior                                   | unit/integration | `pnpm --filter @counter-attack/server test -- gameEngine`   | ❌ Wave 0 — extend existing `LOOSE_BALL` clamp tests with `outOfBoundsEnabled: false` cases                               |
| THROWIN-01..05         | Full throw-in sequence (placement → movement(s) → throw → possible reclassification) | integration      | `pnpm --filter @counter-attack/server test -- gameHandlers` | ❌ Wave 0 — new integration test file, mirrors `packages/server/src/__tests__/kickoffSetup.integration.test.ts` structure |
| GOALKICK-01..06        | Full goal-kick sequence (reposition ×2 → choice → target/standard → move → resolve)  | integration      | `pnpm --filter @counter-attack/server test -- gameHandlers` | ❌ Wave 0 — new integration test file, mirrors the same existing structure                                                |
| SETTINGS toggle wiring | `outOfBoundsEnabled` plumbed through Room → GameState, gates entry point             | unit             | `pnpm --filter @counter-attack/server test -- roomStore`    | ❌ Wave 0 — extend `roomStore.test.ts`                                                                                    |

### Sampling Rate

- **Per task commit:** targeted `vitest run -- <changed-file-pattern>` in the relevant package.
- **Per wave merge:** full suite (`pnpm --filter @counter-attack/shared test && pnpm --filter @counter-attack/server test`; client suite if any panel-rendering tests are added).
- **Phase gate:** full suite green before `/gsd-verify-work`.

### Wave 0 Gaps

- [ ] `packages/shared/src/outOfBounds.test.ts` — covers OOB-01/02/04/05's pure classification logic, including the D-05 double-boundary-exit default and the Assumption A1/A3 edge cases.
- [ ] Extend `packages/server/src/__tests__/gameEngine.test.ts` (or a new `gameEngine.outOfBounds.test.ts`) — covers the `LOOSE_BALL` clamp hook's toggle-gated branching, `ball.lastTouchedBy` propagation through the widest set of mutation sites, and the throw-in/goal-kick `apply*` functions.
- [ ] New `packages/server/src/__tests__/throwIn.integration.test.ts` and `goalKick.integration.test.ts` — full socket-handler-level sequences, mirroring `kickoffSetup.integration.test.ts`'s structure.
- [ ] No new framework install needed — Vitest is already configured project-wide.

## Security Domain

### Applicable ASVS Categories

| ASVS Category         | Applies | Standard Control                                                                                                                                                                                                                                                                                                                    |
| --------------------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| V2 Authentication     | no      | Out of scope — no auth changes in this phase.                                                                                                                                                                                                                                                                                       |
| V3 Session Management | no      | Out of scope.                                                                                                                                                                                                                                                                                                                       |
| V4 Access Control     | yes     | Existing `socketTeam(socket)` + phase-guard + `isProcessing` mutex pattern (`gameHandlers.ts`), applied identically to every new handler — never trust which team a client claims to be.                                                                                                                                            |
| V5 Input Validation   | yes     | Every new handler validates payload shape (`typeof x.q !== 'number'` pattern, `gameHandlers.ts:1901-1910`) before use; new target-hex selections (throw-in throw target, goal-kick target) get an explicit `isPitchHex` guard (Pitfall 4/Open Question 1) as defense-in-depth even though `validatePass` itself doesn't enforce it. |
| V6 Cryptography       | no      | Not applicable — no secrets/crypto touched by this phase.                                                                                                                                                                                                                                                                           |

### Known Threat Patterns for this stack

| Pattern                                                                                                | STRIDE                                              | Standard Mitigation                                                                                                                                                                                                                                                                                       |
| ------------------------------------------------------------------------------------------------------ | --------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Client submits a piece ID belonging to the wrong team during throw-in placement / goal-kick reposition | Spoofing                                            | `socketTeam(socket) !== piece.teamId` guard, identical to every existing restart handler (e.g. `gameHandlers.ts:1918-1926`).                                                                                                                                                                              |
| Client submits an off-pitch or already-occupied target hex                                             | Tampering                                           | `isPitchHex`/occupancy guards before delegating to the pure `apply*` function (Pitfall 4, Open Question 1) — server is the sole source of truth, never trust client-computed legality.                                                                                                                    |
| Double-submission race on the new phase-advance events (e.g. rapid double-click on "Confirm")          | Denial of Service (self-inflicted state corruption) | `room.isProcessing` mutex, guarded/released in `finally`, on every new handler — the project-wide SC-5 convention, no exceptions.                                                                                                                                                                         |
| Client attempts to skip the mandatory Movement Phase 1 and throw immediately                           | Tampering (business-logic bypass)                   | Server-side `ELIGIBLE_NEXT_ACTIONS` check on `lastActionType` — the client-side button set is UX-only; the server independently validates that `STANDARD_PASS`/`HIGH_PASS` from the throw-in context is only legal after `THROW_IN_MOVEMENT_1`/`_2` lastActionType, never directly from `THROW_IN_SETUP`. |

## Sources

### Primary (HIGH confidence — direct codebase inspection)

- `packages/shared/src/types.ts` — `BallState`, `GamePhase`, `GameState`, `ActionEvent`/`ActionEventType`, `LastActionType` (full definitions read: lines 1-1012)
- `packages/shared/src/pitch.ts` — `PITCH_HEXES`, `PITCH_REGIONS`, `isPitchHex`, `isInRegion`, `computeBallZone` (full file read)
- `packages/shared/src/hex.ts` — `toCube`/`fromCube`/`hexDistance`/`hexNeighbors`/`hexesInRange`/`hexLine` (full file read) — confirms `honeycomb-grid` is not the actual hex-math implementation
- `packages/shared/src/scoreUtils.ts` — `computeCombinedScore`, `computeLooseBall` (full file read)
- `packages/shared/src/passValidator.ts` — `validatePass` (lines 1-140 read) — confirms no `isPitchHex` boundary check today
- `packages/shared/src/offside.ts` — `FREE_KICK_STAGES`, `freeKickStageTeam`, `attackingDirection`, `isPastHalfway` (lines 1-80 read)
- `packages/shared/src/actionSequence.ts` — `ELIGIBLE_NEXT_ACTIONS`, `NextActionType` (full file read)
- `packages/server/src/gameEngine.ts` — `LOOSE_BALL` clamp (2769-2833), GK save-spill (2337-2394), `applyGKRestart`/`applyGKKickTarget`/`applyQuickThrow` (2880-3097), `applyFreeKickMove`/`applyFreeKickReady` (4133-4441), `applyEndTurn` (1034-1177), SHOT case incl. duel-tie routing (2105-2399), HIGH_PASS→HEADER transition (2000-2100), `buildInitialGameState` (317-345), `isPitchHex` usage audit (grep across file)
- `packages/server/src/gameHandlers.ts` — `GAME_FREE_KICK_MOVE`/`GAME_FREE_KICK_READY` handlers (1880-1994), `GAME_UNDO`'s `validUndoPhases` (1122-1176), `validateResponseMoveStep` (200-258), `GAME_PASS`-equivalent handler's `ELIGIBLE_NEXT_ACTIONS`/`validatePass` call (1300-1360), `KICKOFF_STANDARD_PASS_ONLY` precedent (1310)
- `packages/server/src/roomStore.ts` — `Room.gameSpeed?`/`Room.teamType?` settings-toggle precedent (grep confirmed)
- `packages/client/src/components/FreeKickSetupPanel.tsx` — full file read (panel structure template)
- `packages/client/src/components/GameBoard.tsx` — `PHASE_LABEL` (24-59), phase-dispatch ternary (300-360)
- `packages/client/src/components/GameSettingsScreen.tsx` — `toggleDraftPool`/checkbox-row pattern (40-154)
- `docs/HIGHLIGHT-REFERENCE.md` — full file read (tint/ring system, `BALL_MARKER_PHASES` 11-phase list)
- `.planning/config.json` — confirms `nyquist_validation: true`, `security_enforcement` absent (treated as enabled)
- `packages/server/vitest.config.ts`, `packages/server/package.json` — test framework/command confirmation

### Secondary (MEDIUM confidence — prior milestone research, partially superseded by CONTEXT.md)

- `.planning/research/ARCHITECTURE.md` — Q1 (staged-restart generalization), Q2 (`lastTouchedBy` field recommendation, adopted), the GOAL_KICK-reuse finding (explicitly overridden by D-01 — do not follow it for this phase)
- `.planning/research/FEATURES.md` — Out-of-Bounds Detection / Throw-In / Goal Kick edge-case tables; the throw-in-re-exit and corner-hex-ambiguity findings (both resolved by CONTEXT.md D-04/D-05)

### Tertiary (LOW confidence — none)

None — this research required no external/web sources; every claim traces to either direct codebase inspection or the two prior milestone-research documents (themselves grounded in codebase inspection per their own Sources sections).

## Metadata

**Confidence breakdown:**

- Standard stack: N/A — no new libraries (HIGH confidence in this being correctly N/A, since a repo-wide search confirms `honeycomb-grid` is unused)
- Architecture (phase/field design for Throw-In and Goal Kick): HIGH for the reuse targets (`MOVE`, `PASS`+`ELIGIBLE_NEXT_ACTIONS`, `FREE_MOVE_ATTACK/DEFENSE`, `GK_KICK_MOVE`'s slot pattern) — all directly cited to existing working code; MEDIUM for the exact new-phase-count/naming choices flagged in Open Questions 2, since D-03 leaves that discretionary
- Pitfalls: HIGH — every pitfall cites either an existing STATE.md-documented bug class or a directly-observed code gap (e.g. `validatePass`'s missing boundary check)
- Sideline/byline geometry: HIGH — the rectangular grid model is directly confirmed in `pitch.ts`, contradicting `FEATURES.md`'s more cautious "hex grid ambiguity" framing

**Research date:** 2026-08-03
**Valid until:** Stable — this is internal-only architecture research tied to the current commit of a slow-moving, convention-locked codebase; re-verify only if `gameEngine.ts`'s `LOOSE_BALL`/`GK_RESTART`/`FREE_KICK_SETUP` regions or `types.ts`'s `GamePhase`/`BallState` definitions change materially before this phase is planned/executed.
