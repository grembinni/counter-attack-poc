# Phase 38: Corner Kick - Research

**Researched:** 2026-08-07
**Domain:** Server-authoritative hex-grid football FSM extension (TypeScript monorepo, Node/Socket.io + React/Zustand) — internal game-logic research, no new external libraries
**Confidence:** HIGH — every finding below is grounded in direct inspection of the current committed source (file:line citations against the actual Phase 37-shipped code, not the pre-implementation 37-RESEARCH.md), cross-checked against `.planning/phases/38-corner-kick/38-CONTEXT.md`'s locked decisions and `.planning/REQUIREMENTS.md`'s CORNER-01..06/OOB-03 text. No web/library research was needed — this phase is 100% internal FSM/state-model work, directly analogous to (and, per CONTEXT.md D-07, structurally distinct from) the just-shipped Goal Kick flow.

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions

**Corner-taker placement geometry**

- **D-01:** The corner-taker restarts from a **single fixed hex per corner** (4 total: home-top, home-bottom, away-top, away-bottom) — no placement choice, no click-to-select-arc-hex UI. This directly mirrors Phase 37's `GOAL_KICK_RESTART_HEX` precedent (`packages/shared/src/outOfBounds.ts:46-49`): one deterministic hex per side, resolved through the same occupied-hex relocation pattern (`resolveThrowInHex`) rather than double-stacking. No such "corner-arc hex" constant exists in the codebase today — ROADMAP.md's "one of the corner's existing fixed corner-arc hexes" wording is read as "the corner's fixed hex" (singular, established-going-forward), not as an existing multi-hex selectable set. `DIFFICULT_ANGLE_HEXES` (`packages/shared/src/pitch.ts:103`, 16 hexes/corner, PITCH-03 shooting-penalty zone) is a **different, much larger region** and must NOT be conflated with or reused as the corner-taker restart point.
- **D-02:** Exact coordinates for the 4 fixed corner hexes are Claude's discretion during planning/implementation — pick the nearest on-pitch hex to each physical corner flag, mirror-symmetric home/away (`home.q + away.q === 36`) and top/bottom (matching `PITCH_REGIONS`/`GOAL_R_VALUES` boundary conventions already in `pitch.ts`), consistent with how `GOAL_KICK_RESTART_HEX` was derived from existing formation/goal geometry rather than picked arbitrarily.

**Goalkeeper repositioning (before corner-taker placement)**

- **D-03:** The "both goalkeepers may be repositioned first" step (CORNER-01) is **turn-based, attacking manager first** — not simultaneous. This mirrors Goal Kick's already-built sequential turn-order pattern (GK's team, then opponent) exactly, including its panel phrasing convention (`"{Team} is repositioning…"`, Phase 35 D-09). Reuse that same turn-order UI shape rather than building a new simultaneous-submit mechanism.
- **D-04:** This GK reposition step runs **before** the corner-taker is placed (per the roadmap's literal ordering: GK reposition → corner-taker placement + 6-hex window → pre-kick 3-hex window → kick). Sequence is: GK reposition (attacker's GK, then defender's GK) → corner-taker placed at the fixed hex (D-01) → CORNER-03's alternating 6-hex window → CORNER-06's pre-kick 3-hex window → High/Low Pass choice and resolution.

**Alternating 6-hex reposition window (CORNER-03)**

- **D-05:** One "round" of the alternating window is **strict pairs**: the attacking manager selects and moves up to 2 pieces (each up to 6 hexes) and confirms, then the defending manager does the same, repeating for up to 3 rounds per side (6 pieces total) — not a free-form "either side moves 1-2 in any order" turn cycle. A manager may move fewer than 2 in a round (or pass) but the turn structure itself (attacker-pair → defender-pair → attacker-pair → …) does not change.
- **D-06:** Whether a manager can end their reposition early (move 0 pieces in a round to skip ahead) vs. must always get the option to move up to 2 before the turn passes is Claude's discretion during planning — follow whatever "Confirm"/pass-through pattern the existing Goal Kick 6-hex reposition window (`GOAL_KICK_SETUP_GK`/`GOAL_KICK_SETUP_OPPONENT`, `packages/shared/src/types.ts:521-522`) already uses for "confirm with 0 moves made."

**Restart chain identity (carried forward from Phase 37 D-01)**

- **D-07:** Corner Kick gets its **own new dedicated `GamePhase` values/state chain**, following the exact same precedent Phase 37 set for Goal Kick (`37-CONTEXT.md` D-01) — it is a structurally distinct restart type from both `GK_RESTART` and Goal Kick's new chain, not a reuse of either. Reuse only the **pure helper functions** (`computeCombinedScore`, the `HEADER` duel resolution, `computeLooseBall`, `resolveThrowInHex`'s occupied-hex pattern) — never the state-machine phases/fields themselves (mirrors Phase 37 D-02). Whether Corner Kick's new phases share underlying staged-repositioning _implementation_ patterns (not phase values) with Goal Kick's just-built chain is a planner-level code-organization call, not a user decision — Corner Kick must still read as its own genuinely distinct flow.
- **D-08:** Exact phase-naming (e.g. `CORNER_KICK_GK_SETUP` / `CORNER_KICK_SETUP` / `CORNER_KICK_MOVE` or similar) is Claude's discretion — follow the existing `GOAL_KICK_*` naming convention for consistency.

**Setup-panel visual conventions (carried forward from Phase 37 D-07/D-08)**

- **D-09:** New Corner Kick setup panels (GK reposition, corner-taker placement, 6-hex window, pre-kick 3-hex window) follow Phase 35's locked conventions (`"Confirm"` button verb, no container border, two-line title+detail helper text, `"{Team} is repositioning…"` waiting phrasing) by default — adapt only where something genuinely doesn't fit, per Phase 37's identical precedent. Map onto the **existing** hex-highlight tint system (`HIGHLIGHT_STYLES`/`RING_STYLES` in `HexCell.tsx`); do not add new tint types to `docs/HIGHLIGHT-REFERENCE.md` for this phase.

### Claude's Discretion

- Exact coordinates for the 4 fixed corner-taker hexes (D-02).
- Whether a manager can pass early with 0 moves during an alternating round (D-06).
- Exact `GamePhase`/`GameState` field naming for the new Corner Kick chain (D-08).
- Exact adherence-vs-adaptation balance for Corner Kick panel styling relative to Phase 35 conventions (D-09).
- Internal code-sharing between Goal Kick's and Corner Kick's staged-repositioning implementations, so long as Corner Kick's phase values/state remain genuinely its own (D-07).

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope. Two todos were matched by generic keyword overlap only (a pre-existing shot-path shading bug, BUG-23; a CSV-consolidation idea) — neither raised or discussed this session, both unrelated to this phase.

</user_constraints>

<phase_requirements>

## Phase Requirements

| ID        | Description                                                                                                                                             | Research Support                                                                                                                                                                                                                              |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| OOB-03    | Byline exit after a defending touch awards a corner kick to the attacking team                                                                          | `classifyOutOfBounds`'s existing `CORNER_KICK` branch (already returns correctly, Phase 37-shipped) — this phase only needs to replace `triggerOutOfBoundsRestart`'s dead-end early return at `gameEngine.ts:3218` (Architecture Patterns §1) |
| CORNER-01 | Both goalkeepers may be repositioned first, attacking manager's GK first                                                                                | New turn-based GK-reposition phase pair, mirrors Goal Kick's sequential turn-order pattern (Architecture Patterns §3)                                                                                                                         |
| CORNER-02 | Kicking manager selects a corner-taker, placed with the ball at the fixed corner-arc hex                                                                | New `CORNER_KICK_HEX` 4-entry constant (D-01/D-02) + a taker-select sub-step mirroring `FREE_KICK_SETUP`'s kicker-placement pattern (Architecture Patterns §2/§4)                                                                             |
| CORNER-03 | Each manager repositions up to 6 players, alternating 2 at a time, attacking manager first                                                              | New 6-stage alternating array (`FREE_KICK_STAGES`-shape) **fused with** the per-piece 6-hex pace-budget model (`applyGoalKickReposition`-shape) — the single most novel architecture surface in this phase (Architecture Patterns §5)         |
| CORNER-04 | High Pass (unlimited in the penalty area, else ≤15 hexes) or Low Pass, both with the existing 8+ combined-score accuracy check                          | Reuses `HIGH_PASS`'s existing accuracy/delivery machinery near-verbatim for the High option; the Low option needs one small, well-scoped new accuracy gate (Architecture Patterns §6)                                                         |
| CORNER-05 | High Pass requires a header attempt; Low Pass does not                                                                                                  | Reuses the exact existing `HIGH_PASS`→`HEADER` eligibility-check transition (`gameEngine.ts:2038-2083` in the Phase-37-shipped file) verbatim (Architecture Patterns §6)                                                                      |
| CORNER-06 | Immediately before the kick, both teams may each move one more player up to 3 hexes, attacking manager first — a second, separate window from CORNER-03 | Direct reuse of `GOAL_KICK_MOVE`'s slot-alternation shape (`goalKickMoveSlot`/`goalKickMovedPieceId`/`goalKickPaceUsed`) (Don't Hand-Roll table; Architecture Patterns §5.4)                                                                  |

</phase_requirements>

## Summary

Like Phase 37, this is pure internal FSM extension work on an already-mature, convention-heavy codebase — there is no new library to evaluate. Unlike Phase 37, this phase does **not** start from a mostly-empty hook: `packages/shared/src/outOfBounds.ts`'s `classifyOutOfBounds` already returns `'CORNER_KICK'` correctly (Phase 37 built the classification half of OOB-03 on purpose, anticipating this phase), and `gameEngine.ts:3218`'s `triggerOutOfBoundsRestart` has an explicit, commented dead-end (`if (restart === 'CORNER_KICK') return null;`) marking exactly where this phase's engine work begins. The Goal Kick flow this phase must structurally parallel (per D-07) is now real, shipped, verified code — not a research proposal — so this document cites the actual `GOAL_KICK_SETUP_GK`/`_OPPONENT`/`_CHOICE`/`_TARGET`/`_MOVE` implementation directly rather than a plan for it.

Four findings materially shape what the planner should build:

1. **CORNER-03's alternating 6-hex window has no single existing precedent — it is a fusion of two.** `FREE_KICK_STAGES` (`packages/shared/src/offside.ts:38-43`) already models "alternating sides, N max distinct pieces per stage" (exactly D-05's strict-pairs structure, just with `max: 2` and 6 stages instead of 4 with `max: 4/4/3/2`) but its `applyFreeKickMove` allows **teleporting a piece anywhere** with no distance cap. Goal Kick's reposition window (`applyGoalKickReposition`, `gameEngine.ts:3486-3593`) already models "per-piece cumulative 6-hex pace budget, one adjacent hex per click" (exactly D-05's "each up to 6 hexes") but has no distinct-piece-count-per-turn concept — it is one continuous per-team window, not alternating rounds. Corner-03 needs **both** properties simultaneously: alternating rounds capped at 2 distinct pieces AND each of those pieces capped at 6 cumulative hexes. Neither existing pattern alone is sufficient; the correct design fuses `FREE_KICK_STAGES`'s stage-array/alternation shape with `applyGoalKickReposition`'s per-piece pace-budget shape (Architecture Patterns §5).
2. **CORNER-04's accuracy rule ("both High and Low Pass get the existing 8+ combined-score check") is a genuine deviation from every existing pass precedent in this codebase, but the deviation is small and mostly confined to the Low option.** In the shipped engine, `STANDARD_PASS`/`FIRST_TIME_PASS` never roll for accuracy at all (`gameEngine.ts:1880-1881`: "STANDARD_PASS and FIRST_TIME_PASS skip accuracy and always deliver the ball") — only `HIGH_PASS`/`LONG_BALL` do. Corner's **High** option is therefore near-free reuse: it is functionally an ordinary `HIGH_PASS` with an extended (penalty-area-conditional) range cap, and the existing `HIGH_PASS`→`HEADER` transition already requires the header verbatim (CORNER-05). Corner's **Low** option is the one genuinely new mechanic in this phase: an accuracy-gated delivery with no header requirement, which nothing in the codebase does today. This should be modeled as a persistent context field (mirroring `throwInTeam`/`highPassCarrierId`, not a brand-new `LastActionType`) so the existing `STANDARD_PASS` delivery mechanics can be reused for everything except the accuracy gate itself (Architecture Patterns §6).
3. **The corner-taker "placement" (CORNER-02) is two decisions bundled into one requirement sentence, and only one of them is discretionary.** The destination hex is fixed and non-discretionary (D-01) — but _which piece_ becomes the corner-taker is a real choice the kicking manager makes ("selects a corner-taker and places them"). This is structurally identical to `FREE_KICK_SETUP`'s existing kicker-select sub-step (`freeKickKickerChosen`, `applyFreeKickMove`'s `state.freeKickKickerChosen === false` branch, `gameEngine.ts:5406-5450`): the kicking team clicks any of their own on-pitch pieces, and that piece teleports to the fixed hex. Recommend copying that shape (not `applyThrowInPlace`'s simpler "engine already told the client which single piece-agnostic hex to place at" model, since throw-in's placement is truly a single confirm-only action once a piece is chosen, which is the same operation) — either template works; `applyThrowInPlace` (`gameEngine.ts:3370-3428`) is the smaller, more directly reusable shape since it is a one-shot "place chosen piece at server-owned fixed hex" function with no stage/budget bookkeeping at all.
4. **OOB-03's classification is already done.** `classifyOutOfBounds` (`packages/shared/src/outOfBounds.ts:118-128`) already returns `'CORNER_KICK'` when `lastTouchedByTeam === bylineOwnerTeam` (a defender touched last), and its JSDoc explicitly documents that Phase 38 "only needs to add the consumer branch that acts on `'CORNER_KICK'`; it must never edit this function's logic." This phase's OOB-03 work is entirely inside `triggerOutOfBoundsRestart` (`gameEngine.ts:3203-3339`), replacing the single `if (restart === 'CORNER_KICK') return null;` line with a corner-kick trigger branch structurally mirroring the adjacent `GOAL_KICK` branch already in that same function.

**Primary recommendation:** Replace `triggerOutOfBoundsRestart`'s `CORNER_KICK` dead-end with a trigger branch that resolves the fixed corner hex (new `CORNER_KICK_HEX` 4-entry constant, D-01/D-02) via `bylineOwner(exitHex)` + a top/bottom nearest-hex comparison against `lastInBoundsHex`, and transitions into a new `CORNER_KICK_GK_SETUP_ATTACKING`/`_DEFENDING` phase pair (CORNER-01). From there: `CORNER_KICK_TAKER_SELECT` (CORNER-02, mirrors `applyThrowInPlace`'s one-shot placement) → `CORNER_KICK_REPOSITION` (CORNER-03, single phase + a new 6-entry stage array fusing `FREE_KICK_STAGES`'s alternation with `applyGoalKickReposition`'s per-piece pace budget) → `CORNER_KICK_FINAL_SETUP` (CORNER-06, direct copy of `GOAL_KICK_MOVE`'s slot-alternation shape) → `PASS` phase with a new `lastActionType: 'CORNER_KICK_RESTART'` row restricting the next action to `STANDARD_PASS`/`HIGH_PASS`, with a persistent `cornerKickTeam` field gating a small accuracy-check extension in `applyRoll`'s existing `PASS` case (CORNER-04/05).

## Architectural Responsibility Map

| Capability                                                             | Primary Tier                                                    | Secondary Tier                                         | Rationale                                                                                                                                                                                                                                                            |
| ---------------------------------------------------------------------- | --------------------------------------------------------------- | ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Corner-kick trigger (OOB-03 consumer branch)                           | API / Backend (`gameEngine.ts`, `triggerOutOfBoundsRestart`)    | —                                                      | Server-authoritative; the classification decision (`classifyOutOfBounds`) is already pure/shared, but acting on it (mutating state, awarding the restart) is engine-only, exactly like the adjacent `GOAL_KICK`/`THROW_IN` branches.                                 |
| Fixed corner-hex geometry (`CORNER_KICK_HEX`)                          | Shared (`packages/shared/src/outOfBounds.ts` or a sibling file) | —                                                      | Pure data, importable by both server (enforcement) and client (if ever needed for display) — mirrors `GOAL_KICK_RESTART_HEX`'s placement in the same file.                                                                                                           |
| GK reposition / taker select / 6-hex window / 3-hex window (phase FSM) | API / Backend (`gameEngine.ts`)                                 | Browser/Client (new setup panel(s))                    | Server owns every phase transition, budget check, and dice roll; client is a thin intent-dispatcher + highlight renderer, identical split to Goal Kick's shipped implementation.                                                                                     |
| High/Low Pass accuracy + header/delivery resolution                    | API / Backend (`gameEngine.ts` `applyRoll` PASS case)           | —                                                      | Reuses the existing dice-authoritative PASS resolution pipeline; no new client-side scoring logic.                                                                                                                                                                   |
| Hex-tint highlighting for the new reposition windows                   | Browser/Client (`HexCell.tsx`)                                  | —                                                      | Purely presentational; D-09 requires reusing existing `HexHighlightType` members (`safe`, `pass-target`, etc.), not inventing new ones.                                                                                                                              |
| Out-of-Bounds/Restarts toggle gating                                   | API / Backend (`state.outOfBoundsEnabled`, already shipped)     | Browser/Client (`GameSettingsScreen`, already shipped) | **No new toggle work needed this phase** — GOALKICK-06's toggle already covers "goal kick, corner kick, throw-in, and out-of-bounds detection" per its own requirement text; Corner Kick is gated by the existing `outOfBoundsEnabled` field with zero new plumbing. |

## Package Legitimacy Audit

**Not applicable to this phase.** No new external packages are introduced. Every mechanism described below is built from code patterns and pure functions already present in `packages/shared` and `packages/server` (the same conclusion Phase 37's research reached and Phase 37's shipped code confirmed — `honeycomb-grid` remains unused; the hand-rolled `packages/shared/src/hex.ts` is still the only hex-math implementation, re-confirmed by this session's direct reads of `hex.ts`-derived functions in `outOfBounds.ts`/`pitch.ts`/`scoreUtils.ts`).

**Packages removed due to [SLOP] verdict:** none — no packages were proposed.
**Packages flagged as suspicious [SUS]:** none.

## Architecture Patterns

### System Architecture Diagram

```
Client (React/Zustand)                          Server (Node/Socket.io, authoritative)
┌─────────────────────────┐                     ┌───────────────────────────────────────────┐
│ CornerKickSetupPanel     │  socket.emit(...)   │ gameHandlers.ts                             │
│ (mirrors                 │ ───────────────────▶│  isProcessing mutex → phase guard →          │
│  GoalKickSetupPanel      │                     │  delegate to pure apply* fn → broadcast      │
│  structure, D-09)        │                     └───────────────┬─────────────────────────────┘
└────────────▲─────────────┘                                     │
             │ full GameState                                     ▼
             │ broadcast after           gameEngine.ts: triggerOutOfBoundsRestart (EXISTING —
             │ every action               only the CORNER_KICK dead-end changes, gameEngine.ts:3218)
┌────────────┴─────────────┐              │
│ HexCell.tsx tint system   │              ▼
│ (existing HighlightType   │   ┌───────────────────────────────────────────┐
│  reused per D-09)         │   │ CORNER_KICK_GK_SETUP_ATTACKING/_DEFENSIVE  │  CORNER-01
└───────────────────────────┘   │   (turn-based GK reposition, no cap —      │
                                 │    mirrors Goal Kick's turn-order shape)   │
                                 └────────────────────┬────────────────────────┘
                                                       ▼
                                 ┌───────────────────────────────────────────┐
                                 │ CORNER_KICK_TAKER_SELECT                   │  CORNER-02
                                 │   (kicking mgr picks ANY own piece;        │
                                 │    teleports to fixed CORNER_KICK_HEX,     │
                                 │    D-01/D-02 — mirrors applyThrowInPlace)  │
                                 └────────────────────┬────────────────────────┘
                                                       ▼
                                 ┌───────────────────────────────────────────┐
                                 │ CORNER_KICK_REPOSITION                     │  CORNER-03
                                 │   (single phase + cornerKickStageIndex     │
                                 │    0..5, NEW stage-array fusing            │
                                 │    FREE_KICK_STAGES alternation with       │
                                 │    applyGoalKickReposition's per-piece     │
                                 │    6-hex pace budget — §5)                 │
                                 └────────────────────┬────────────────────────┘
                                                       ▼
                                 ┌───────────────────────────────────────────┐
                                 │ CORNER_KICK_FINAL_SETUP                    │  CORNER-06
                                 │   (direct copy of GOAL_KICK_MOVE's slot-   │
                                 │    alternation shape, 1 piece/team, ≤3hex) │
                                 └────────────────────┬────────────────────────┘
                                                       ▼
                                 ┌───────────────────────────────────────────┐
                                 │ PASS phase, lastActionType:                │  CORNER-04/05
                                 │   'CORNER_KICK_RESTART' →                  │
                                 │   client picks STANDARD_PASS (Low) or      │
                                 │   HIGH_PASS (High); cornerKickTeam field   │
                                 │   persists through applyRoll's PASS case,  │
                                 │   gating the 8+ accuracy check on BOTH     │
                                 │   options (§6)                             │
                                 └─────────────────────────────────────────────┘
```

A reader tracing "home defender deflects the ball behind their own byline" follows: `LOOSE_BALL`/`SHOT`-tie/pass-inaccuracy clamp (already OOB-aware, Phase 37) → first off-pitch hex → `classifyExit`/`bylineOwner`/`classifyOutOfBounds` (unchanged, already returns `'CORNER_KICK'`) → `triggerOutOfBoundsRestart`'s **new** corner branch (replacing the dead-end) → `CORNER_KICK_GK_SETUP_ATTACKING` → … → `CORNER_KICK_FINAL_SETUP` → `PASS` with `lastActionType: 'CORNER_KICK_RESTART'` → client's High/Low choice → `applyRoll`'s existing PASS case (extended) → `HEADER` (High, accurate) or direct delivery (Low, accurate) or `LOOSE_BALL` (either, inaccurate — itself OOB-aware for a scattered corner that exits again).

### 1. OOB-03 hook point — the only classification work already done

`packages/shared/src/outOfBounds.ts:118-128` (`classifyOutOfBounds`, Phase-37-shipped, unchanged since):

```typescript
export function classifyOutOfBounds(
  exit: 'SIDELINE' | 'BYLINE',
  lastTouchedByTeam: 'home' | 'away' | null,
  bylineOwnerTeam: 'home' | 'away' | null,
): OutOfBoundsRestart {
  if (exit === 'SIDELINE') return 'THROW_IN';
  if (lastTouchedByTeam !== null && lastTouchedByTeam === bylineOwnerTeam) {
    return 'CORNER_KICK';
  }
  return 'GOAL_KICK';
}
```

This function's own JSDoc (lines 108-116) is explicit: "Phase 38 only needs to add the consumer branch that acts on `'CORNER_KICK'`; it must never edit this function's logic." **Do not touch `outOfBounds.ts`'s classification logic.** The only shared-package addition this phase needs there (or in a sibling file) is the new `CORNER_KICK_HEX` constant (§2).

`packages/server/src/gameEngine.ts:3203-3218` (`triggerOutOfBoundsRestart`, Phase-37-shipped):

```typescript
export function triggerOutOfBoundsRestart(
  state: GameState,
  exitHex: HexCoord,
  lastInBoundsHex: HexCoord,
): GameState | null {
  const exit = classifyExit(exitHex);
  if (exit === null) return null;

  const owner = bylineOwner(exitHex);
  const restart = classifyOutOfBounds(exit, state.ball.lastTouchedBy?.teamId ?? null, owner);

  // OOB-03 / Phase 38: the only change Phase 38 needs at this call site is to
  // replace this early return with a corner-kick trigger. ...
  if (restart === 'CORNER_KICK') return null;   // <-- THIS is the entire Phase 37 hook for Phase 38
  ...
```

This is the single, explicitly-marked engine hook. The existing `GOAL_KICK` branch immediately below it (lines 3271-3339) is the direct structural template: it resolves `owner` (the defending/awarded team — for corners this is the **attacking** team, since `classifyOutOfBounds` already inverted the `lastTouchedByTeam === bylineOwnerTeam` case to mean "the defender touched it last, so byline owner is the _defending_ team, and the corner is awarded to the _other_ team"), looks up a fixed restart hex, resolves it against occupancy via `resolveThrowInHex`, and returns a fully-formed `GameState` with a new phase. Corner Kick's branch should structurally mirror this shape, not `THROW_IN`'s (which awards to a team keyed differently — see §2 for the exact team-resolution detail corner needs).

**Important team-resolution detail:** for `GOAL_KICK`, `owner` (the byline's own team) **is** the awarded team (the defending team takes their own goal kick). For `CORNER_KICK`, `owner` (the byline's own team, i.e. the team whose defender touched it last) is the **opposite** of the awarded team — the corner goes to the attacking team, i.e. `owner === 'home' ? 'away' : 'home'`. Get this inversion right; it is the one place a copy-paste of the `GOAL_KICK` branch would silently award the corner to the wrong side.

### 2. Fixed corner-taker hex geometry (D-01/D-02)

Recommend a new export alongside `GOAL_KICK_RESTART_HEX` in `packages/shared/src/outOfBounds.ts` (or a new small file if the team prefers to keep corner-specific geometry separate — either is fine, no existing convention forces one or the other):

```typescript
/**
 * CORNER_KICK_HEX — the fixed hex a corner-taker restarts from (CORNER-02, D-01/D-02).
 * Keyed by BYLINE OWNER (the defending team whose goal line the ball crossed — same
 * indexing convention as GOAL_KICK_RESTART_HEX, NOT the attacking/kicking team), then
 * by which of the two corners on that byline (top = lower r, bottom = higher r).
 *
 * Mirror-symmetric home/away (home.q + away.q === 36, matching GOAL_KICK_RESTART_HEX's
 * convention) and chosen as the nearest on-pitch hex to each physical corner flag —
 * the same corner-of-the-bounding-rectangle hexes DIFFICULT_ANGLE_HEXES's first entry
 * per corner already identifies (pitch.ts:105,123,141,159), reused here ONLY for their
 * coordinates, never by importing/aliasing DIFFICULT_ANGLE_HEXES itself (D-01: the two
 * concepts must stay structurally separate).
 */
export const CORNER_KICK_HEX: Readonly<
  Record<'home' | 'away', Record<'top' | 'bottom', HexCoord>>
> = {
  home: { top: { q: 0, r: 1 }, bottom: { q: 0, r: 25 } },
  away: { top: { q: 36, r: 1 }, bottom: { q: 36, r: 25 } },
};
```

Rationale for the exact coordinates: `q=0`/`q=36` are already `PITCH_REGIONS.homeGoal`/`awayGoal`'s columns (`pitch.ts:69-70,86-87`) — the byline. `PITCH_HEXES` excludes `r=0` **only for even `q`** (`pitch.ts:27-31`), and `q=0`/`q=36` are both even, so `(0,0)`/`(36,0)` do not exist on the pitch — `r=1` is the nearest valid row to the top corner flag on both bylines. `r=25` is never excluded (no `r=25` hex is filtered), so the bottom corner can sit exactly on the pitch's last row. These are the identical coordinates `DIFFICULT_ANGLE_HEXES`'s own top-left/top-right/bottom-left/bottom-right first entries already use (`{q:0,r:1}`, `{q:36,r:1}`, `{q:0,r:25}`, `{q:36,r:25}` — `pitch.ts:105,141,123,159`), confirming this is the codebase's own established "nearest on-pitch hex to the physical corner" answer, independently re-derived here. `home.q + away.q === 0 + 36 === 36` ✓ (matches `GOAL_KICK_RESTART_HEX`'s mirror-symmetry convention exactly).

**Top vs. bottom resolution at trigger time:** rather than hardcoding an `r` midpoint constant, recommend picking whichever of the byline owner's two corner hexes is closer (`hexDistance`) to `lastInBoundsHex` (the same "nearest" reasoning `resolveThrowInHex` already uses for occupancy, applied here to corner selection) — this avoids introducing a new magic-number boundary and degrades gracefully for any future pitch-geometry tweak. Tie-break (exact pitch-vertical-centre exit, vanishingly rare given `PITCH_HEXES` has no hex exactly equidistant given odd row count) can default to `'top'` deterministically.

### 3. GK reposition (CORNER-01, D-03/D-04)

No existing phase does "one specific piece per team, turn-based, no stated hex cap." The closest shapes:

- **Turn order/UI:** Goal Kick's `GOAL_KICK_SETUP_GK`/`GOAL_KICK_SETUP_OPPONENT` two-phase-value precedent (attacker's window first, then defender's) is the direct template for D-03's turn order and D-09's panel phrasing (`"{Team} is repositioning…"`).
- **Movement model:** unlike CORNER-03 (explicitly "each up to 6 hexes") and CORNER-06 (explicitly "up to 3 hexes"), CORNER-01's requirement text states **no distance cap** ("both goalkeepers may be repositioned first" — no "up to N hexes" qualifier anywhere in CORNER-01 or the roadmap goal). This omission, next to two sibling requirements that are explicit about their caps, is very unlikely to be accidental. Recommend an **uncapped placement model** — the GK may be moved to any legal on-pitch, unoccupied hex in one click, mirroring `FREE_KICK_STAGES`'s "pick up and place anywhere" model (`applyFreeKickMove`'s general branch, no `hexDistance` cap check at all) rather than `applyGoalKickReposition`'s adjacent-step/cumulative-budget model. This is flagged `[ASSUMED]` — see Assumptions Log A1; confirm against the physical rulebook or via a `checkpoint:human-verify` during planning if the team wants certainty before building it.
- Recommend a new phase pair `CORNER_KICK_GK_SETUP_ATTACKING`/`CORNER_KICK_GK_SETUP_DEFENDING` (D-08 naming discretion — any consistent pair works), each resolved via a small new `apply*` function structurally mirroring `applyThrowInPlace`'s one-shot "place piece X at hex Y, done" shape (no budget bookkeeping needed at all if uncapped) rather than `applyGoalKickReposition`'s per-piece pace-budget shape.

### 4. Corner-taker selection + placement (CORNER-02, D-01/D-02)

This is two responsibilities folded into one requirement, and only the piece-choice half is real work:

1. **Which piece** (real choice, kicking manager's) — new phase `CORNER_KICK_TAKER_SELECT`. Recommend copying `applyThrowInPlace`'s exact shape (`gameEngine.ts:3370-3428`): phase guard, piece lookup, team-ownership check, then an unconditional teleport to the server-resolved fixed hex (`CORNER_KICK_HEX[bylineOwnerTeam][topOrBottom]`, resolved through `resolveThrowInHex` against the current piece list exactly like Goal Kick's restart hex is, so an occupied corner hex relocates to the nearest free on-pitch hex instead of double-stacking).
2. **Which hex** (fixed, D-01) — resolved once, at `triggerOutOfBoundsRestart` time or at `CORNER_KICK_TAKER_SELECT` confirm time (either is defensible; resolving it once at trigger time and storing it in a new `cornerKickHex` field, mirroring `throwInHex`, is the more consistent choice since it matches how `GOAL_KICK_RESTART_HEX` is resolved once at trigger time in the `GOAL_KICK` branch).

After placement: `ball.carrierId = cornerTakerId`, `ball.lastTouchedBy = { pieceId: cornerTakerId, teamId: cornerKickTeam }` — this persists unchanged through CORNER-03 and CORNER-06 (neither window touches the ball) until the kick resolution in §6.

### 5. Alternating 6-hex reposition window (CORNER-03, D-05/D-06) — the phase's central novel design

**Neither existing precedent is individually sufficient (Summary finding #1).** Recommend a new stage array, structurally modeled on `FREE_KICK_STAGES` (`packages/shared/src/offside.ts:38-43`) but sized and capped for corner:

```typescript
// packages/shared/src/offside.ts or a new corner-specific module — mirrors FREE_KICK_STAGES exactly
export const CORNER_KICK_STAGES: readonly { side: 'attacking' | 'defending'; max: 2 }[] = [
  { side: 'attacking', max: 2 },
  { side: 'defending', max: 2 },
  { side: 'attacking', max: 2 },
  { side: 'defending', max: 2 },
  { side: 'attacking', max: 2 },
  { side: 'defending', max: 2 },
]; // D-05: 3 rounds/side × 2 pieces/round = 6 stages, alternating, attacking first

export function cornerKickStageTeam(
  stageIndex: 0 | 1 | 2 | 3 | 4 | 5,
  cornerKickTeam: 'home' | 'away', // the ATTACKING/kicking team
): 'home' | 'away' {
  const stage = CORNER_KICK_STAGES[stageIndex];
  if (stage.side === 'attacking') return cornerKickTeam;
  return cornerKickTeam === 'home' ? 'away' : 'home';
}
```

New `GameState` fields (mirrors the `freeKickStageIndex`/`freeKickPlacedPieceIds` pair, fused with `goalKickUsedPace`'s per-piece budget):

```typescript
cornerKickStageIndex?: 0 | 1 | 2 | 3 | 4 | 5 | null;   // mirrors freeKickStageIndex
cornerKickStagePlacedIds?: readonly string[] | null;    // mirrors freeKickPlacedPieceIds — DISTINCT pieces touched THIS stage (max 2)
cornerKickUsedPace?: Readonly<Record<string, number>> | null; // mirrors goalKickUsedPace — cumulative hexes per piece, capped at 6, persists ACROSS stages (a piece finishing a round with pace remaining does not get more later — matches D-05's "each up to 6 hexes" being a per-piece total, not a per-round allowance)
```

Move validation (`applyCornerKickReposition`) should structurally copy `applyGoalKickReposition`'s body (adjacency check via `hexDistance === 1`, `isPitchHex`/occupancy guards, cumulative-pace-vs-6 check) — **not** call it — exactly as `applyGoalKickReposition`'s own doc comment instructs for its relationship to `applyFreeMove`. The one addition beyond that copied shape: a distinct-piece-count guard mirroring `applyFreeKickMove`'s `PLACEMENT_LIMIT_REACHED` check (`cornerKickStagePlacedIds.length >= 2` for a not-yet-counted piece → reject).

Stage-end (`applyCornerKickReady`, mirrors `applyFreeKickReady`): advances `cornerKickStageIndex` (0→5), merging the stage's `cornerKickStagePlacedIds` into `movedPieceIds`-style permanent-lock bookkeeping is **not** appropriate here (a piece that used only 2 of its 6 hexes in round 1 should still be able to move again with its remaining budget if picked again in round 2 or 3 — D-05 says "up to 6 hexes" per piece total across the whole window, not per-round) — this is a deliberate divergence from `FREE_KICK_STAGES`'s permanent-lock-per-stage behavior, and should be called out explicitly in the plan so it isn't "corrected" into matching `applyFreeKickReady`'s lock-in-movedPieceIds pattern by mistake. At `stageIndex === 5`'s end, transition to `CORNER_KICK_FINAL_SETUP` (§5.4).

**D-06 (early confirm with 0 moved):** the CONTEXT.md decision directs following Goal Kick's Confirm-with-0 pattern specifically (not Free Kick's) — `GoalKickSetupPanel.tsx`'s `withEndTurnGuard`/`pendingEndTurn` dialog ("N players left to reposition, are you sure?") already implements exactly this: End Turn is always clickable, a confirmation dialog fires only when `remaining > 0`. Reuse this UI pattern verbatim for each of Corner's new panels.

### 5.4 Pre-kick 3-hex window (CORNER-06) — direct reuse

CORNER-06 ("both teams may each move one more player up to 3 hexes, attacking manager first") is structurally identical to `GOAL_KICK_MOVE`'s already-shipped shape (`applyGoalKickMoveEnd`'s `goalKickMoveSlot: 'KICKER' | 'OPP'` alternation, `gameEngine.ts:3924+`), differing only in **when** it runs (Corner: before the kick is taken at all; Goal Kick: while an already-taken Kick travels). Recommend a direct field-shape copy:

```typescript
cornerKickMoveSlot?: 'ATTACKER' | 'DEFENDER' | null;  // mirrors goalKickMoveSlot
cornerKickMovedPieceId?: string | null;                 // mirrors goalKickMovedPieceId
cornerKickPaceUsed?: number;                             // mirrors goalKickPaceUsed, capped at 3
```

New phase `CORNER_KICK_FINAL_SETUP`, resolved via `applyCornerKickReposition`-shaped move validation (adjacency+cumulative-pace, capped at 3 instead of 6) and an `applyCornerKickFinalSetupEnd` mirroring `applyGoalKickMoveEnd`'s slot-flip-then-resolve shape — except Corner's "resolve" step is the High/Low choice + kick (§6), not a travel-window accuracy roll, since the kick hasn't been taken yet at this point in Corner's sequence (unlike Goal Kick, where the target is picked _before_ the 3-hex window because the ball is already in the air).

### 6. High/Low Pass resolution (CORNER-04/05) — the second novel design surface, but smaller than it looks

**Key finding:** because `HIGH_PASS`/`LONG_BALL` already require the 8+ combined-score accuracy check and `HIGH_PASS` already transitions to `HEADER` on an accurate delivery (`gameEngine.ts` `applyRoll`'s `PASS` case, `requiresAccuracyCheck` boolean and the `HIGH_PASS`→`HEADER` block), **Corner's High option needs almost no new engine logic** — it is functionally an ordinary `HIGH_PASS` with an extended range cap. Corner's **Low** option is the one piece that needs new logic, because `STANDARD_PASS` in this engine never rolls for accuracy at all today.

**Recommended approach — extend, don't duplicate:**

1. Transition `CORNER_KICK_FINAL_SETUP`'s end into the existing generic `PASS` phase with a new `LastActionType` row `'CORNER_KICK_RESTART'` (mirrors `GOAL_KICK_RESTART`/`FREE_KICK_RESTART`) and a new `ELIGIBLE_NEXT_ACTIONS` entry: `CORNER_KICK_RESTART: new Set<NextActionType>(['STANDARD_PASS', 'HIGH_PASS'])`. **Reuse the existing `STANDARD_PASS`/`HIGH_PASS` client-facing `passType` labels directly** — do not invent `CORNER_KICK_HIGH`/`CORNER_KICK_LOW` labels — matching the exact precedent Throw-In already set (`THROW_IN_MOVEMENT_1`/`_2` rows also route to plain `'STANDARD_PASS'`/`'HIGH_PASS'`, `actionSequence.ts:103-110`).
2. Add a **persistent** `cornerKickTeam?: 'home' | 'away' | null` field (mirrors `throwInTeam`/`goalKickTeam`) that survives the `lastActionType` overwrite the `GAME_ROLL` handler performs when committing the client's chosen `passType`. This field — not `lastActionType` — is what distinguishes "an ordinary Standard Pass" from "a corner kick's Low option."
3. **Range cap:** in the `GAME_ROLL` handler (`gameHandlers.ts:1609-1620`, the exact site that already special-cases throw-in's `THROW_IN_MAX_DISTANCE` override via `isThrowInContext`), add an `isCornerKickContext(lastActionType)` check (mirrors `isThrowInContext`, `gameHandlers.ts:106-107`) that, when the chosen `passType` is `'HIGH_PASS'` **and** the target hex is inside the byline-owner team's own penalty area (`isInRegion(targetHex, bylineOwnerTeam === 'home' ? 'homePenaltyArea' : 'awayPenaltyArea')`), passes a large `{ maxDistance: <sentinel> }` override to `validatePass` to lift HIGH's already-15 default cap entirely (CORNER-04's "no distance limit" inside the box); otherwise the existing default 15-hex `HIGH` cap applies unchanged (CORNER-04's "elsewhere up to 15 hexes" — this is already `validatePass`'s out-of-the-box behavior, needing zero change). **No `validatePass` signature change is needed** — this reuses the exact `options.maxDistance` mechanism Phase 37 already added for `THROW_IN_MAX_DISTANCE`, just computed conditionally instead of as a flat constant.
4. **Accuracy gate extension** (`gameEngine.ts` `applyRoll`, `PASS` case): extend the existing `requiresAccuracyCheck` boolean —
   ```typescript
   const requiresAccuracyCheck =
     state.lastActionType === 'HIGH_PASS' ||
     state.lastActionType === 'LONG_BALL' ||
     (state.cornerKickTeam != null && state.lastActionType === 'STANDARD_PASS'); // NEW: corner's Low option
   ```
   High corners need no further change — `state.lastActionType === 'HIGH_PASS'` is already `true` and the existing `HIGH_PASS`→`HEADER` block already fires unconditionally on any accurate High Pass delivery, corner or not (CORNER-05 falls out for free). Low corners (`lastActionType === 'STANDARD_PASS'` with `cornerKickTeam` set) need the accuracy check applied via `validatePassAccuracy(carrier, 'HIGH', d1, [])` (same threshold-8 computation, reusing the `'HIGH'` accuracy type regardless of the `STANDARD_PASS` delivery label — CORNER-04 says "the existing combined-score 8+ accuracy check," and 8 is specifically the `HIGH` threshold, not `LONG`'s 9/10) — on accurate, fall through to the **existing** `STANDARD_PASS` delivery/interception-skip path (recommend treating corner passes as non-interceptable, mirroring `HIGH`/`LONG`'s "fly over defenders" skip, since CORNER-04/05 describe an aerial/set-piece delivery with no mention of interception — flagged `[ASSUMED]`, see Assumptions Log A2); on inaccurate, the existing `LOOSE_BALL` branch already works unmodified.
5. Clear `cornerKickTeam` (and `cornerKickHex`/other corner fields) on whichever branch actually resolves the ball (accurate High → `HEADER` entry; accurate Low → delivery; inaccurate either → `LOOSE_BALL`), mirroring how `goalKickTeam`/`goalKickGkId` are cleared in `applyGoalKickChoice`'s `'standard'` branch.

This design keeps the net-new engine surface to: one new `LastActionType` value, one new `ELIGIBLE_NEXT_ACTIONS` row, one new persistent context field, one small `isCornerKickContext`-style handler helper, one conditional range override, and a 3-line `requiresAccuracyCheck` extension — not a parallel pass-resolution pipeline.

### Recommended Project Structure (new files/additions only)

```
packages/shared/src/
├── outOfBounds.ts        # MODIFIED — new CORNER_KICK_HEX constant (§2)
├── offside.ts             # MODIFIED — new CORNER_KICK_STAGES array + cornerKickStageTeam() (§5),
│                           #   sibling to FREE_KICK_STAGES/freeKickStageTeam (or a new file if
│                           #   the team prefers corner-specific logic isolated — no strong
│                           #   existing precedent forces either choice)
├── types.ts               # MODIFIED — new GamePhase values, new GameState fields (cornerKick*),
│                           #   new LastActionType row ('CORNER_KICK_RESTART'), new
│                           #   ActionEventType/ActionEvent variants
├── actionSequence.ts       # MODIFIED — ELIGIBLE_NEXT_ACTIONS: CORNER_KICK_RESTART row
packages/server/src/
├── gameEngine.ts           # MODIFIED — triggerOutOfBoundsRestart's CORNER_KICK branch (§1),
│                           #   new apply* functions for the 5 new phases, applyRoll PASS-case
│                           #   accuracy-gate extension (§6)
├── gameHandlers.ts         # MODIFIED — new socket handlers for the 5 new phases; isCornerKickContext
│                           #   helper + conditional range override in GAME_ROLL (§6); validUndoPhases[]
│                           #   extended; BALL_MARKER_PHASES-equivalent client list extended (Pitfall 1)
packages/client/src/components/
├── CornerKickSetupPanel.tsx # NEW — mirrors GoalKickSetupPanel.tsx structure (D-09), covers all
│                             #   5 new corner-kick phases the way one panel covers Goal Kick's 5
├── GameBoard.tsx             # MODIFIED — PHASE_LABEL + phase-dispatch ternary extended
├── BallLocationRing.tsx      # MODIFIED — BALL_MARKER_PHASES extended with the 5 new phases
```

### Anti-Patterns to Avoid

- **Reusing `GK_RESTART`/Goal Kick's phase values for Corner Kick** — D-07 requires structural independence, exactly like D-01 required for Goal Kick over `GK_RESTART` in Phase 37.
- **Modeling CORNER-03's window as a pure `FREE_KICK_STAGES` copy (teleport-anywhere, no per-piece hex cap)** — loses D-05's explicit "each up to 6 hexes" per-piece budget. Equally wrong: modeling it as a pure `applyGoalKickReposition` copy (no alternating-pairs turn structure) — loses D-05's explicit strict-pairs alternation. Both properties are required simultaneously (§5).
- **Inventing new `CORNER_KICK_HIGH`/`CORNER_KICK_LOW` passType/NextActionType labels** — the established precedent (Throw-In, Phase 37) is to reuse the existing `STANDARD_PASS`/`HIGH_PASS` labels and gate special behavior on a persistent context field, not new enum values (§6).
- **Locking a piece permanently (via `movedPieceIds`) after it moves during a CORNER-03 stage** — unlike `FREE_KICK_STAGES`'s per-stage permanent lock, Corner's per-piece budget (up to 6 hexes total) must persist and remain spendable across multiple rounds if the same piece is picked again (§5).
- **Conflating `CORNER_KICK_HEX` with `DIFFICULT_ANGLE_HEXES`** — explicitly forbidden by D-01; they happen to share endpoint coordinates by construction (§2) but must remain two separate constants with two separate purposes.
- **Editing `classifyOutOfBounds`'s logic** — its `CORNER_KICK` branch is already correct and explicitly documented as not-to-be-touched by this phase (§1).
- **Building an OOB hook at the GK save-spill site** — still out of scope (unchanged from Phase 37's Pitfall 3; no scatter mechanic exists there today).

## Don't Hand-Roll

| Problem                                                       | Don't Build                                       | Use Instead                                                                                                                       | Why                                                                                                                                                         |
| ------------------------------------------------------------- | ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Fixed-hex restart geometry                                    | A new hex-selection UI or click-to-place mechanic | `CORNER_KICK_HEX` (a `resolveThrowInHex`-style constant, §2)                                                                      | D-01 explicitly forbids a placement-choice UI; the mechanic (fixed hex + occupied-hex relocation) is already proven by `GOAL_KICK_RESTART_HEX`.             |
| Alternating-turn structure for CORNER-03                      | A bespoke turn-cycling state machine              | `FREE_KICK_STAGES`'s `{side, max}` array shape, resized to 6 entries (§5)                                                         | Already solves "alternating sides, capped distinct pieces per turn" — just needs a different array literal, not new turn-cycling logic.                     |
| Per-piece cumulative hex-movement budget                      | A new distance-tracking mechanism                 | `applyGoalKickReposition`'s `goalKickUsedPace`-shape per-piece ledger (§5)                                                        | Already solves "N eligible pieces, each with an independent hex budget" — copy the shape into `cornerKickUsedPace`.                                         |
| "Both teams move 1 piece ≤3 hexes" pre-kick window            | A new slot-alternation mechanic                   | `GOAL_KICK_MOVE`'s `goalKickMoveSlot`/`goalKickMovedPieceId`/`goalKickPaceUsed` shape (§5.4)                                      | Identical shape to CORNER-06's requirement; only the trigger timing differs, not the mechanic.                                                              |
| High Pass accuracy / combined-score checks                    | New dice-scoring math                             | `computeCombinedScore`/`validatePassAccuracy` (unchanged, already threshold-8 for `HIGH`)                                         | Corner's accuracy rule is literally the existing High Pass threshold — no new math (§6).                                                                    |
| "Receiver must attempt a header" on an accurate High delivery | A new header-trigger mechanic                     | The existing `HIGH_PASS`→`HEADER` transition (`gameEngine.ts` `applyRoll` PASS case)                                              | Already fires unconditionally on any accurate High Pass, corner or not — CORNER-05 is free once Corner's High option is modeled as a real `HIGH_PASS` (§6). |
| Kicking-team piece selection at a fixed destination           | A new pick-a-piece mechanic                       | `applyThrowInPlace`'s one-shot "place chosen piece at server-owned fixed hex" shape (§4)                                          | Already solves exactly this: pick any own piece, teleport to a server-resolved hex, no budget bookkeeping.                                                  |
| Undo support for the new staged phases                        | Deferred/skipped Undo                             | The `FK_KICKER_CHOSEN`/`FK_STAGE_ADVANCE`-style boundary-event pattern (`types.ts`), already extended once for Goal Kick's phases | STATE.md's own pitfall: don't repeat the `FREE_KICK_SETUP` Undo gap a third time — decide and build Undo boundaries for Corner's new phases from day one.   |

**Key insight:** as with Phase 37, every dice-scoring, geometry, and slot-alternation primitive this phase needs already exists in a form ready to reuse or lightly extend. The only genuinely new _structural_ work is the CORNER-03 stage/pace fusion (§5) and the CORNER-04 Low-option accuracy gate (§6) — both are small, well-scoped extensions of existing patterns, not new subsystems.

## Runtime State Inventory

Not applicable — this is a greenfield feature-addition phase (new game phases/fields), not a rename, refactor, or migration. No existing stored data, live service config, OS-registered state, secrets, or build artifacts reference "corner kick" under any prior name.

## Common Pitfalls

### Pitfall 1: New `GamePhase` values are invisible unless registered in every consuming list

Unchanged risk from Phase 37 (STATE.md's documented bug class), now with a **concrete, current checklist** since Goal Kick's shipped registration sites are directly greppable. Every new Corner Kick `GamePhase` (`CORNER_KICK_GK_SETUP_ATTACKING`/`_DEFENDING`, `CORNER_KICK_TAKER_SELECT`, `CORNER_KICK_REPOSITION`, `CORNER_KICK_FINAL_SETUP`) must be added to:

- `GamePhase` union (`types.ts:490-528`) — compiler-enforced downstream.
- `PHASE_LABEL: Record<GamePhase, string>` (`GameBoard.tsx:24-64`) — compile error if missed.
- `GameBoard.tsx`'s phase-dispatch ternary (`GameBoard.tsx:328-360`, currently the `THROW_IN_SETUP`/five-way `GOAL_KICK_*` check) — **not** compiler-enforced; extend the same ternary with a Corner Kick five-way (or however many phases are chosen) check.
- `validUndoPhases: GamePhase[]` in the `GAME_UNDO` handler (`gameHandlers.ts:1356-1371`, currently lists `GOAL_KICK_SETUP_GK`/`_OPPONENT`/`GOAL_KICK_MOVE` as "contains a reversible piece move") — add Corner's equivalent reversible-move phases.
- `BALL_MARKER_PHASES` (`BallLocationRing.tsx:31-52`) — the just-shipped Goal Kick block (lines 43-51) is the direct template; the ball is fixed at a restart hex or mid-repositioning during every one of Corner's new phases too.
- `ELIGIBLE_NEXT_ACTIONS`'s `Record<LastActionType, ...>` exhaustiveness (`actionSequence.ts:49`) — TypeScript forces the new `CORNER_KICK_RESTART` row to exist the moment the `LastActionType` union gains the value.
- Any other `GamePhase`-keyed array/Record literal not yet located — search before considering this list complete (Phase 37's own research flagged this same caveat and it held: `DICE_PHASES` in `gameHandlers.ts:95` did NOT need a Corner Kick entry since Corner's new phases aren't dice-roll phases themselves, only the final `PASS` phase is — verify this holds for whichever exact phase set Corner ends up with).

### Pitfall 2: New `ActionEventType`/`ActionEvent` variants need the same per-type checklist

STATE.md's pitfall (already cited once in Phase 37, still applies): never reuse the generic `DICE_ROLL` event type for a new roll. Corner's accuracy roll needs its own event type (recommend `CORNER_KICK_ACCURACY` or `CORNER_KICK`, mirroring `GOAL_KICK`'s dedicated type shape at `types.ts:474-488` — `gkId`→takerId, `targetHex`, `accurate`, `kickDie`, `kickScore`, `timestamp`, `ballAfter`), registered in the `ActionEventType` union, the `ActionEvent` discriminated union, and (if Undo should reach across it) `applyUndo`'s boundary-scan logic.

### Pitfall 3: `cornerKickTeam`'s persistence must survive every intermediate phase transition, not just the final one

Because §6's design relies on `cornerKickTeam` (not `lastActionType`) as the "this Standard/High Pass is a corner" signal, every state-literal return between `CORNER_KICK_FINAL_SETUP`'s end and the eventual `PASS`-phase accuracy resolution must explicitly carry `cornerKickTeam` forward (or the field silently reverts to its default and the Low-option accuracy gate never fires). This is the same class of bug Phase 37 flagged for `highPassCarrierId`/`throwInTeam` — grep for every `...state` spread between trigger and resolution and confirm the field is present, not just assumed to survive via the spread (a spread only preserves a field if no intermediate return _object-literals_ the field out by omission in a non-spread branch).

### Pitfall 4: The CORNER-03 per-piece budget must NOT reset between stages

Directly called out in §5: `cornerKickUsedPace` is a per-piece, per-window total (max 6 across all 3 rounds a side gets), not a per-stage allowance. A naive port of `applyFreeKickReady`'s stage-advance logic (which resets `freeKickPlacedPieceIds` to `[]` every stage, correctly, since that field only tracks _distinct pieces this stage_) must NOT also reset `cornerKickUsedPace` — only `cornerKickStagePlacedIds` (the distinct-piece-per-stage counter) resets; `cornerKickUsedPace` (the cumulative-hex-per-piece ledger) persists across all 6 stages.

### Pitfall 5: Corner's "penalty area" for the unlimited-range rule is the byline owner's OWN area, not the kicking team's

CORNER-04's "any hex in the penalty area with no distance limit" means the box the attacking team is kicking _into_ — which is the **defending/byline-owner team's own** `homePenaltyArea`/`awayPenaltyArea` (the box adjacent to the goal being attacked), not a region keyed by the kicking team. Getting this backwards would silently disable the unlimited-range rule for every real corner (since the kicking team's own penalty area is on the opposite side of the pitch from where a corner is ever aimed).

## Code Examples

### The exact `triggerOutOfBoundsRestart` dead-end this phase replaces

```typescript
// gameEngine.ts:3214-3218 (current, Phase-37-shipped)
// OOB-03 / Phase 38: the only change Phase 38 needs at this call site is to
// replace this early return with a corner-kick trigger. classifyOutOfBounds's
// CORNER_KICK branch (packages/shared/src/outOfBounds.ts) must not be edited to
// support it — see that function's own doc comment.
if (restart === 'CORNER_KICK') return null;
```

### The adjacent `GOAL_KICK` branch — direct structural template (note the team-inversion caveat in §1)

```typescript
// gameEngine.ts:3271-3339 (current, Phase-37-shipped) — the shape to mirror
const goalKickTeam = owner; // GOAL_KICK: owner IS the awarded team
if (goalKickTeam === null) return null;
const gk = state.pieces.find((p) => p.teamId === goalKickTeam && p.role === 'GK');
if (!gk) return null;
const preferredRestartHex = GOAL_KICK_RESTART_HEX[goalKickTeam];
const otherPieces = state.pieces.filter((p) => p.id !== gk.id);
const resolvedRestartHex = resolveThrowInHex(preferredRestartHex, otherPieces);
// ... repositions gk, sets ball.carrierId = gk.id, transitions to GOAL_KICK_SETUP_GK ...

// Corner Kick's branch (NEW) must instead compute:
// const cornerKickTeam = owner === 'home' ? 'away' : 'home'; // CORNER: owner is the OPPOSITE of the awarded team
// ... resolve CORNER_KICK_HEX[owner][topOrBottom] (keyed by owner/byline, not cornerKickTeam) ...
// ... transition to CORNER_KICK_GK_SETUP_ATTACKING with attackingTeam/activeTeam = cornerKickTeam ...
```

### `isThrowInContext`'s exact shape — the template for the new `isCornerKickContext` handler helper

```typescript
// gameHandlers.ts:106-107 (current, Phase-37-shipped)
const isThrowInContext = (lastActionType: LastActionType | null): boolean =>
  lastActionType === 'THROW_IN_MOVEMENT_1' || lastActionType === 'THROW_IN_MOVEMENT_2';

// New (Corner Kick): note this checks a PERSISTENT FIELD, not lastActionType,
// per §6's design — lastActionType gets overwritten to STANDARD_PASS/HIGH_PASS
// by the time this matters, unlike throw-in's two-value lastActionType signal.
// const isCornerKickContext = (state: GameState): boolean => state.cornerKickTeam != null;
```

### The conditional range-override site — exact insertion point in the `GAME_ROLL` handler

```typescript
// gameHandlers.ts:1609-1620 (current, Phase-37-shipped) — the exact call site to extend
const vpType = passTypeMap[passType];
const passResult = validatePass(
  room.gameState,
  carrier,
  carrier.position,
  targetHex,
  vpType,
  isThrowInContext(room.gameState.lastActionType)
    ? { maxDistance: THROW_IN_MAX_DISTANCE }
    : undefined,
  // NEW: a third ternary arm (or restructure to a single computed `options` value)
  // for the corner-in-penalty-area-unlimited-range case — see §6 step 3.
);
```

## State of the Art

Not applicable — internal-only architecture research tied to this project's own prior milestone (Phase 37), not an external ecosystem shift.

## Assumptions Log

| #   | Claim                                                                                                                                                                                                                               | Section                     | Risk if Wrong                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| A1  | CORNER-01's GK reposition step is uncapped (no hex-distance limit), inferred from the requirement text's silence on a cap where its two sibling requirements (CORNER-03, CORNER-06) are both explicit                               | Architecture Patterns §3    | If the rulebook actually intends a capped GK reposition (e.g. matching CORNER-06's 3-hex cap, or its own distinct cap), an uncapped implementation would let a GK reposition anywhere on the pitch before a corner — a significant rules deviation. Low implementation cost to fix either way (swap the "place anywhere" model for `applyGoalKickReposition`'s pace-budget model with a different cap constant), but should be confirmed before or during planning, not assumed silently.                                                                                      |
| A2  | Neither corner-kick option (High or Low) is interceptable — modeled as skipping `validatePass`'s interception-list population, mirroring `HIGH`/`LONG`'s existing "fly over defenders" behavior                                     | Architecture Patterns §6    | If Low Pass corners should in fact be interceptable (closer to a grounded `STANDARD_PASS`'s real interception mechanic than to `HIGH_PASS`'s fly-over model), this changes both the passType mapping used internally for `validatePass` and the delivery/interception-loop code path taken in `applyRoll`. The requirement text (CORNER-04/05) does not mention interception either way for either option.                                                                                                                                                                     |
| A3  | Corner's fixed hexes (`CORNER_KICK_HEX`) share their exact coordinates with `DIFFICULT_ANGLE_HEXES`'s first per-corner entry (`{q:0,r:1}` etc.) by independent geometric derivation, not by design intent to align the two concepts | Architecture Patterns §2    | Low risk — this is a coordinate coincidence following from both constants independently picking "nearest on-pitch hex to the physical corner flag." If a future board-photo verification (per STATE.md's `DIFFICULT_ANGLE_HEXES` open TODO, "verify against docs/board-photo.jpg when available") changes `DIFFICULT_ANGLE_HEXES`'s coordinates, `CORNER_KICK_HEX` should be independently re-derived from the same physical-corner-flag reasoning, not silently kept in sync with whatever `DIFFICULT_ANGLE_HEXES` becomes (D-01 explicitly keeps the two concepts separate). |
| A4  | Corner-taker exclusion: the piece selected as corner-taker (CORNER-02) and the GKs (already repositioned in CORNER-01) are excluded from CORNER-03's/CORNER-06's eligible-piece pools                                               | Architecture Patterns §4/§5 | If a GK or the corner-taker should in fact remain eligible for the later reposition windows, the eligible-list computation (mirroring `computeGoalKickEligibleIds`) needs a different filter. This is a small, easily-adjusted detail but affects the exact eligible-ID computation function's filter predicate.                                                                                                                                                                                                                                                               |

## Open Questions

1. **Exact hex-distance cap (if any) for CORNER-01's GK reposition step.**
   - What we know: CORNER-03 and CORNER-06 both explicitly state a hex cap ("up to 6 hexes", "up to 3 hexes"); CORNER-01 states none.
   - What's unclear: whether this is a deliberate "unlimited" rule or an omission in the requirement's summarization of the physical rulebook.
   - Recommendation: build the uncapped model (A1) but flag it for a `checkpoint:human-verify` or explicit rulebook-text confirmation during planning, matching how Phase 37's STATE.md already tracks similar rulebook-fidelity gaps (e.g. the Phase 39 foul-trigger-die and Professional Foul ambiguities) rather than silently shipping an assumption for a rules-fidelity detail.

2. **Interceptability of Corner Kick's Low Pass option.**
   - What we know: `STANDARD_PASS` is normally interceptable; `HIGH_PASS`/`LONG_BALL` are not; Corner's Low option shares `STANDARD_PASS`'s delivery label but CORNER-04 requires it to share `HIGH_PASS`'s accuracy-check behavior.
   - What's unclear: whether it should also share `HIGH_PASS`'s non-interceptable delivery, or retain `STANDARD_PASS`'s interception mechanic on top of the added accuracy gate.
   - Recommendation: non-interceptable (A2), for consistency with the aerial/set-piece framing implied by "combined-score accuracy check" (the same mechanic every other non-interceptable pass type in this codebase uses) — but this is genuinely underspecified by the requirement text and worth a quick confirmation pass before implementation.

3. **Whether Corner's 5-6 new phases should be a single `CornerKickSetupPanel.tsx` (mirroring `GoalKickSetupPanel.tsx`'s "one panel, branch internally by phase" shape) or split across smaller panels.**
   - What we know: `GoalKickSetupPanel.tsx` covers all 5 Goal Kick phases in one component, branching on `phase` internally; this is the established, working pattern for a multi-phase restart flow.
   - What's unclear: whether Corner's larger phase count (5-6 vs. Goal Kick's 5) changes that calculus.
   - Recommendation: follow the same single-panel-branch-internally shape (D-09's "adopt Phase 35's conventions by default" plus the direct `GoalKickSetupPanel.tsx` precedent) — the component will be longer but the pattern is proven and consistent.

## Environment Availability

Not applicable — this phase has no external tool/service/runtime dependencies beyond the existing pnpm/Node/Vitest toolchain already in continuous use across the project. No new packages, no new external services.

## Validation Architecture

### Test Framework

| Property           | Value                                                                                                                                        |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Framework          | Vitest (confirmed via `packages/server/vitest.config.ts`, `packages/shared/vitest.config.ts` — unchanged since Phase 37)                     |
| Config file        | `packages/server/vitest.config.ts` (`environment: 'node'`, `include: ['src/**/*.test.ts']`); `packages/shared/vitest.config.ts` (same shape) |
| Quick run command  | `pnpm --filter @counter-attack/shared test -- <pattern>` / `pnpm --filter @counter-attack/server test -- <pattern>`                          |
| Full suite command | `pnpm --filter @counter-attack/shared test && pnpm --filter @counter-attack/server test && pnpm --filter @counter-attack/client test`        |

### Phase Requirements → Test Map

| Req ID       | Behavior                                                                                                            | Test Type          | Automated Command                                                                                                  | File Exists?                                                                                                                                                   |
| ------------ | ------------------------------------------------------------------------------------------------------------------- | ------------------ | ------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| OOB-03       | `triggerOutOfBoundsRestart`'s new `CORNER_KICK` branch (team inversion, hex resolution)                             | unit               | `pnpm --filter @counter-attack/server test -- gameEngine`                                                          | ❌ Wave 0 — extend the existing `outOfBounds`/goal-kick test coverage in `gameEngine.test.ts` with corner-kick trigger cases                                   |
| CORNER-01    | Turn-based GK reposition, attacker's GK first, no distance cap (pending A1 confirmation)                            | unit + integration | `pnpm --filter @counter-attack/server test -- gameEngine` / `gameHandlers`                                         | ❌ Wave 0 — new test file, mirrors `goalKick.integration.test.ts`'s reposition-window structure                                                                |
| CORNER-02    | Kicking manager selects any own piece; teleports to the correct fixed hex; occupied-hex relocation                  | unit               | `pnpm --filter @counter-attack/server test -- gameEngine`                                                          | ❌ Wave 0 — mirrors `applyThrowInPlace`'s existing test coverage shape                                                                                         |
| CORNER-03    | 6-stage alternating window: max-2-per-stage, per-piece 6-hex cumulative budget persisting across stages (Pitfall 4) | unit               | `pnpm --filter @counter-attack/shared test -- offside` / `pnpm --filter @counter-attack/server test -- gameEngine` | ❌ Wave 0 — new `CORNER_KICK_STAGES`/`cornerKickStageTeam` unit tests mirroring `FREE_KICK_STAGES`'s; new reposition-window integration tests                  |
| CORNER-04/05 | High/Low accuracy gate, penalty-area-conditional range, header requirement only on High                             | unit + integration | `pnpm --filter @counter-attack/server test -- gameEngine`                                                          | ❌ Wave 0 — extend `applyRoll` PASS-case test coverage with `cornerKickTeam`-gated Standard Pass accuracy cases; new penalty-area-range-override handler tests |
| CORNER-06    | Pre-kick 1-piece/team ≤3-hex slot alternation, attacking manager first                                              | unit + integration | `pnpm --filter @counter-attack/server test -- gameEngine`                                                          | ❌ Wave 0 — mirrors `applyGoalKickMoveEnd`'s existing test coverage shape                                                                                      |

### Sampling Rate

- **Per task commit:** targeted `vitest run -- <changed-file-pattern>` in the relevant package.
- **Per wave merge:** full suite (`pnpm --filter @counter-attack/shared test && pnpm --filter @counter-attack/server test`; client suite if any panel-rendering tests are added).
- **Phase gate:** full suite green before `/gsd-verify-work`.

### Wave 0 Gaps

- [ ] New corner-kick trigger + all 5-6 new `apply*` function unit tests in `packages/server/src/__tests__/gameEngine.test.ts` (or a new `gameEngine.cornerKick.test.ts`, mirroring how Goal Kick's tests were organized).
- [ ] New `CORNER_KICK_STAGES`/`cornerKickStageTeam` unit tests in `packages/shared/src/offside.test.ts` (or wherever `CORNER_KICK_STAGES` is placed), mirroring `FREE_KICK_STAGES`'s existing coverage.
- [ ] New `packages/server/src/__tests__/cornerKick.integration.test.ts`, mirroring `goalKick.integration.test.ts`'s full socket-handler-level sequence structure.
- [ ] No new framework install needed — Vitest is already configured project-wide.

## Security Domain

### Applicable ASVS Categories

| ASVS Category         | Applies | Standard Control                                                                                                                                                                                                                          |
| --------------------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| V2 Authentication     | no      | Out of scope — no auth changes in this phase.                                                                                                                                                                                             |
| V3 Session Management | no      | Out of scope.                                                                                                                                                                                                                             |
| V4 Access Control     | yes     | Existing `socketTeam(socket)` + phase-guard + `isProcessing` mutex pattern (`gameHandlers.ts`), applied identically to every new handler — never trust which team a client claims to be, exactly matching every existing restart handler. |
| V5 Input Validation   | yes     | Every new handler validates payload shape before use; new target-hex selections get an explicit `isPitchHex` guard as defense-in-depth; the corner-taker piece-selection handler validates team ownership before teleporting.             |
| V6 Cryptography       | no      | Not applicable — no secrets/crypto touched by this phase.                                                                                                                                                                                 |

### Known Threat Patterns for this stack

| Pattern                                                                                                                   | STRIDE                                              | Standard Mitigation                                                                                                                                                                                                                                                                       |
| ------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Client submits a piece ID belonging to the wrong team during any of Corner's 5-6 reposition/selection steps               | Spoofing                                            | `socketTeam(socket) !== piece.teamId` guard, identical to every existing restart handler.                                                                                                                                                                                                 |
| Client submits an off-pitch or already-occupied target hex during the corner-taker select or reposition windows           | Tampering                                           | `isPitchHex`/occupancy guards before delegating to the pure `apply*` function, mirroring `applyGoalKickReposition`'s existing off-pitch/occupied checks.                                                                                                                                  |
| Client attempts to exceed the per-piece 6-hex (CORNER-03) or 3-hex (CORNER-06) cumulative budget via repeated small moves | Tampering                                           | Server-side cumulative pace tracking (`cornerKickUsedPace`), never trusting a client-computed "hexes remaining" value — mirrors `applyGoalKickReposition`'s existing `GOAL_KICK_PACE_EXHAUSTED` guard.                                                                                    |
| Client attempts to select a High Pass corner target outside the penalty area while claiming unlimited range               | Tampering                                           | Server-side `isInRegion` check on the byline-owner's penalty area before applying the range-override, re-validated authoritatively in the handler exactly as `validatePass` already is for every existing pass type (ASVS V5 — never trust a client-supplied "this is in the box" claim). |
| Double-submission race on any new phase-advance event (rapid double-click on "Confirm")                                   | Denial of Service (self-inflicted state corruption) | `room.isProcessing` mutex, guarded/released in `finally`, on every new handler — the project-wide SC-5 convention, no exceptions.                                                                                                                                                         |

## Sources

### Primary (HIGH confidence — direct codebase inspection, current committed source)

- `packages/shared/src/outOfBounds.ts` — full file read: `classifyExit`, `bylineOwner`, `classifyOutOfBounds`, `resolveThrowInHex`, `GOAL_KICK_RESTART_HEX` (all Phase-37-shipped, current)
- `packages/shared/src/pitch.ts` — full file read: `PITCH_HEXES`, `PITCH_REGIONS`, `DIFFICULT_ANGLE_HEXES`, `isInRegion`, `isPitchHex` (confirms rectangular grid model, corner-hex coordinates, penalty-area regions)
- `packages/shared/src/offside.ts` — full file read: `FREE_KICK_STAGES`, `freeKickStageTeam` (the direct structural template for `CORNER_KICK_STAGES`)
- `packages/shared/src/passValidator.ts` — full file read: `validatePass` (confirms the `options.maxDistance` override mechanism already added for throw-in, directly reusable for corner's conditional range), `validatePassAccuracy` (confirms HIGH threshold 8)
- `packages/shared/src/scoreUtils.ts` — full file read: `computeCombinedScore`, `computeLooseBall`
- `packages/shared/src/types.ts` — `GamePhase` (lines 490-528), `LastActionType` (537-558), `GameState` goal-kick field cluster (1090-1172), `ActionEvent` goal-kick variants (440-488) — all Phase-37-shipped, current
- `packages/shared/src/actionSequence.ts` — full file read: `ELIGIBLE_NEXT_ACTIONS`, `NextActionType` (confirms `THROW_IN_MOVEMENT_1/_2`/`GOAL_KICK_RESTART` rows as the direct precedent for the new `CORNER_KICK_RESTART` row)
- `packages/server/src/gameEngine.ts` — direct reads of: `triggerOutOfBoundsRestart` (3183-3339, the OOB-03 hook and `GOAL_KICK` branch template), `applyThrowInPlace` (3341-3428, the corner-taker placement template), `computeGoalKickEligibleIds`/`applyGoalKickReposition`/`applyGoalKickWindowEnd`/`applyGoalKickChoice`/`applyGoalKickTarget`/`applyGoalKickMoveEnd` (3430-3960+, the full shipped Goal Kick chain), `applyFreeKickMove`/`applyFreeKickReady` (5340-5697, the `FREE_KICK_STAGES` alternation template and kicker-select sub-step template), `applyRoll`'s `PASS` case (1873-2117+, the accuracy-gate/delivery/interception logic Corner's High/Low resolution extends)
- `packages/server/src/gameHandlers.ts` — direct reads of: `DICE_PHASES`/`THROW_IN_MAX_DISTANCE`/`isThrowInContext` (90-107), the `GAME_ROLL` handler's full PASS-phase branch (1495-1650+, the exact site extended for corner's conditional range override), goal-kick handler grep (all `GAME_GOAL_KICK_*`/`applyGoalKick*` call sites), `validUndoPhases` (1356-1371)
- `packages/client/src/components/GoalKickSetupPanel.tsx` — full file read (the direct structural/visual template for the new `CornerKickSetupPanel.tsx`, D-09)
- `packages/client/src/components/GameBoard.tsx` — `PHASE_LABEL` (24-64), phase-dispatch ternary (328-360) grep-confirmed for the exact Goal Kick five-way check to mirror
- `packages/client/src/components/BallLocationRing.tsx` — full `BALL_MARKER_PHASES` read (31-52), confirms the exact 6-phase Goal Kick block added in Phase 37 as the template for Corner's equivalent addition
- `packages/client/src/components/HexCell.tsx` — full `HexHighlightType`/`HIGHLIGHT_STYLES`/`RING_STYLES` read (D-09's reuse-only constraint)
- `.planning/phases/38-corner-kick/38-CONTEXT.md` — full file read (all locked decisions D-01..D-09, canonical references, code context)
- `.planning/REQUIREMENTS.md` — OOB-03/CORNER-01..06 verbatim text (lines 69, 88), traceability table
- `.planning/STATE.md` — v1.6 decisions-locked section, key pitfalls, Phase 37 completion status
- `.planning/config.json` — confirms `nyquist_validation: true`, `security_enforcement` absent (treated as enabled) — unchanged since Phase 37

### Secondary (MEDIUM confidence — prior phase's research/verification documents)

- `.planning/phases/37-out-of-bounds-detection-throw-in-goal-kick/37-RESEARCH.md` — pre-implementation research; used here only to confirm which of its recommendations were actually adopted (cross-checked against the shipped code, not trusted at face value)
- `.planning/phases/37-out-of-bounds-detection-throw-in-goal-kick/37-VERIFICATION.md` — confirms Goal Kick's final shipped shape (5-phase flow, sequential 6-hex reposition, Kick-vs-Standard-Pass choice, header-contest radius preview) matches what this document cites as "current committed source"

### Tertiary (LOW confidence — none)

None — this research required no external/web sources; every claim traces to direct codebase inspection of the current, Phase-37-shipped and Phase-38-relevant source files, or to `.planning` documents produced by prior phases of this same project.

## Metadata

**Confidence breakdown:**

- Standard stack: N/A — no new libraries (HIGH confidence, re-confirmed against current source)
- OOB-03 hook / trigger mechanics: HIGH — the exact dead-end and its adjacent template are both directly cited, current, shipped code
- Fixed-hex geometry (D-02): HIGH for the coordinate derivation method; MEDIUM for the exact top/bottom-selection tie-break logic (a reasonable default is proposed but not rulebook-verified)
- CORNER-03 stage/pace fusion: MEDIUM — the two source patterns being fused are both HIGH-confidence (directly cited shipped code), but the fusion itself is new design work, not a direct precedent
- CORNER-04/05 accuracy-gate extension: MEDIUM — the High-option reuse is HIGH confidence (near-identical to existing `HIGH_PASS` behavior); the Low-option accuracy gate is a genuinely new mechanic, flagged with Open Questions/Assumptions
- Pitfalls: HIGH — every pitfall cites either an existing STATE.md-documented bug class or a directly-observed shipped-code pattern this phase must extend correctly

**Research date:** 2026-08-07
**Valid until:** Stable — this is internal-only architecture research tied to the current commit of a slow-moving, convention-locked codebase; re-verify only if `gameEngine.ts`'s `triggerOutOfBoundsRestart`/Goal Kick region, `offside.ts`'s `FREE_KICK_STAGES`, or `types.ts`'s `GamePhase`/`GameState` definitions change materially before this phase is planned/executed.
