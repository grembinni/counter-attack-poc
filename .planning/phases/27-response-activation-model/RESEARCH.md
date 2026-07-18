# Phase 27: Response Activation Model - Research

**Researched:** 2026-07-18
**Domain:** Real-time Socket.io game FSM — client/server single-selection movement UX, SVG hex highlight layering, zone-crossing triggers
**Confidence:** HIGH (code-grounded — every claim below was verified by reading the actual source, not inferred from CONTEXT.md's approximate line pointers)

## Summary

This phase is a **UX unification** layered on top of a codebase that already contains most of the low-level primitives it needs, plus **one genuinely net-new mechanic** (keeper ball-in-box) that has **zero existing implementation or trigger condition**. The existing `validateResponseMoveStep` (server, `gameHandlers.ts`) / `computeResponseMoveValidHexes` (client, `useGameStore.ts`) pair is the exact "single-selection, pace-capped, single-piece-lock" pattern already powering `HIGH_PASS_MOVE`, `GK_KICK_MOVE`, `FIRST_TIME_PASS_MOVE`, and `SNAPSHOT_DEFLECT` — DEFLECT (RESP-03) already **is** `SNAPSHOT_DEFLECT`, so most of that phase's plumbing exists; it only needs a new shot-path eligibility filter. DIVE (RESP-07) already fully implements interactive positioning via `applyGKDive`/`validateGKDive`/`gkDiveTargetSet` — it needs a visual retrofit only, not new mechanics. HEADER (RESP-04) requires a genuinely new sequencing layer: today's `GAME_HEADER_CONTESTANT` is a **simultaneous multi-select nomination** with no movement at all, not a turn-based single-piece move — the new sequential attacker-then-defender positioning step must be added _ahead of_ the existing (unchanged) contestant/duel/target flow. FINAL THIRD (RESP-05/06) is structurally closest to the existing `FREE_MOVE_ATTACK`/`FREE_MOVE_DEFENSE` sub-phase (`applyFreeMove`, `applyFreeMoveEnd`, `applyFreeMoveZoneCheck`) — that machinery is the ideal template to clone, **but it is not the same mechanic**: the existing free-move triggers on entry into a final third and moves pieces in the **opposite** third, whereas RESP-05 needs pieces already **in** the entered third. These must not be conflated. Keeper ball-in-box (part of RESP-01) has no phase, no handler, no trigger condition, and no rulebook doc anywhere in the repo — this needs to be either defined by the user before planning locks it in, or explicitly scoped as best-effort/deferred.

**Primary recommendation:** Reuse and extend the existing `validateResponseMoveStep`/`computeResponseMoveValidHexes` single-piece-lock pattern for HEADER positioning; reuse the existing `applyFreeMove`/`applyFreeMoveEnd` multi-piece pattern for FINAL THIRD; retrofit DIVE and DEFLECT's _visuals only_ (no new server mechanics); build keeper ball-in-box from scratch only after its trigger condition is confirmed with the user — do not guess it during planning.

## Architectural Responsibility Map

| Capability                                                           | Primary Tier                                                                                                                | Secondary Tier                                                                             | Rationale                                                                                   |
| -------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------- |
| Response-phase eligibility computation (who can be selected)         | API / Backend (`gameEngine.ts`)                                                                                             | Browser (mirror for UX-01 defense-in-depth, matches existing `selectPiece` client mirrors) | Server is sole FSM authority (ARCH-01); client mirrors are cosmetic/pre-validation only     |
| Hex highlight rendering (`response` type, `-1` badge, ball-hex ring) | Browser / Client (`HexCell.tsx`, `HexGrid.tsx`)                                                                             | —                                                                                          | Pure SVG rendering, no server involvement                                                   |
| Response-move validation (range, occupancy, pace)                    | API / Backend (`validateResponseMoveStep`, new `applyFinalThirdMove`)                                                       | —                                                                                          | ARCH-01/T-4-03: server re-validates every move server-side, client `to` coord never trusted |
| Keeper auto-reposition trigger                                       | API / Backend (`broadcastState` central hook, mirrors `applyFreeMoveZoneCheck`)                                             | —                                                                                          | Must run centrally after every action, same as existing MOVE-06 zone check                  |
| Auto-skip + log (RESP-08)                                            | API / Backend (per-phase entry-point guard, mirrors existing HIGH_PASS→HEADER eligibility check at gameEngine.ts:2018-2065) | Browser (waiting-panel UX only)                                                            | Server decides skip; client only displays the resulting phase                               |

## User Constraints (from CONTEXT.md)

<user_constraints>

### Locked Decisions

- **D-01:** This phase implements positioning/movement selection only. Existing downstream contest/duel/resolution logic for HEADER, DEFLECT, DIVE, and keeper ball-in-box is unchanged — do not touch resolution mechanics, only the selection→movement step that precedes them.
- **D-02:** HEADER: each side (attacker, then defender) gets a single-selection movement turn — eligible pieces highlighted, selecting one shows in-range header hexes, selecting a hex moves the piece and hands off to the other side. Once both sides have positioned, the existing duel/target-selection flow proceeds exactly as it does today (GAME_HEADER_CONTESTANT / duel / GAME_HEADER_TARGET logic untouched).
- **D-03:** DEFLECT is one-sided: only the defender gets a positioning turn (single-select, move within range). The deflect dice roll fires immediately after that move — no hand-off, no confirm button.
- **D-04:** FINAL THIRD has no auto-resolve at all. It behaves exactly like a MOVEMENT phase: select an eligible piece, move it within its per-player range, mark it activated, allow undo, End Turn once all eligible pieces have moved (or been skipped).
- **D-05:** DIVE (GK_DIVING) and keeper ball-in-box keep today's defer-to-later-event resolution model (single click sets position now; dice resolution happens at the next triggering event) — matches the existing `applyGKDive` pattern and needs no resolution-timing change, only the shared visual/eligibility treatment below.
- **D-06:** New `response` highlightType: white hex fill for all valid response destinations.
- **D-07:** Hexes that incur a challenge penalty render a small "−1" text badge on top of the white fill (not a color-tint variant, not an icon).
- **D-08:** Penalty rule is type-specific and distance-based: HEADER dist 1 clean, dist 2 = −1 badge. DIVE dist 1–2 clean, dist 3 = −1 badge (same penalty already implemented via `validateGKDive`, this phase adds the matching visual only). DEFLECT, FINAL THIRD, GK ball-in-box: no penalty — flat white.
- **D-09:** RESP-09 ball-hex highlight: static gold/yellow ring/outline on the ball's hex, layered under the BallMarker, shown during all response phases.
- **D-10:** HEADER: eligible responders within hex-distance 2 of the ball.
- **D-11:** DIVE: unchanged, hex-distance ≤ 3 from GK's current position, −1 penalty visual at distance 3.
- **D-12:** DEFLECT: eligible defenders are those who can legally move to a hex on-or-adjacent to the shot-path line (`hexLine(shotOrigin, shotTargetHex)`), within hex-distance 3 of any point on that line. No penalty tiering.
- **D-13:** FINAL THIRD **diverges from the literal ROADMAP/RESP-05 wording**. The "6-hex ring" is NOT a fixed ring around the ball — it is a per-player movement range shown around whichever piece is currently selected (normal per-piece movement range, same shape as MOVEMENT). ALL pieces from BOTH teams already positioned within the final-third zone are eligible (not defending team only). Speed optimization — these moves trigger no reaction/contest.
- **D-14:** Keeper ball-in-box: keeper only, hex-distance ≤ 1 from current position. No penalty tiering.
- **D-15:** Keeper auto-reposition trigger: fires once, the instant the ball first enters the final-third zone (zone-crossing detection, same category of check as existing `ballZone` crossing logic). Does NOT re-trigger on subsequent re-entries within the same possession.
- **D-16:** Reposition is an instant jump (no animation), consistent with KICK_OFF_SETUP snap-back.
- **D-17:** "Starting position" = the keeper's formation/lineup starting position (existing per-piece formation data), not a fixed goal-line-center constant.
- **D-18:** Keeper is excluded from the final-third eligible-player count for the duration of that response phase. Helper text wording is Claude's discretion during planning.

### Claude's Discretion

- Exact wording of the RESP-06 keeper-repositioning helper text (D-18).
- Naming/internal structure of the new `response` highlightType and its priority ordering relative to existing types (`risk > goal > shot-path > kickoff > safe`).
- Whether the −1 badge is a new SVG `<text>` element pattern or reuses the existing jersey-number text-rendering approach.

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.

</user_constraints>

<phase_requirements>

## Phase Requirements

| ID      | Description                                                                         | Research Support                                                                                                                                                                                           |
| ------- | ----------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| RESP-01 | Consistent single-selection activation model for all response moves                 | `validateResponseMoveStep`/`computeResponseMoveValidHexes` pattern documented below (server+client); keeper ball-in-box flagged as needing a trigger-condition decision before this can be fully satisfied |
| RESP-02 | White range hexes + `-1` penalty indicator                                          | New `response` highlightType + badge — exact insertion points in `HexCell.tsx`/`HexGrid.tsx` documented below                                                                                              |
| RESP-03 | Deflect eligibility gated to shot-path proximity                                    | `SNAPSHOT_DEFLECT` phase exists; shot-path filter is net-new — documented below with exact gap vs. current behavior                                                                                        |
| RESP-04 | Header eligibility gated to heading range                                           | `validateHeading`'s existing HEAD-01 distance-2 rule is the exact source of truth — documented below                                                                                                       |
| RESP-05 | Final-third 6-hex-ring response hexes (per D-13: per-piece range, not literal ring) | `applyFreeMove`/`applyFreeMoveEnd` template documented below — explicitly NOT the same mechanic as existing `FREE_MOVE_ATTACK/DEFENSE`                                                                     |
| RESP-06 | Keeper auto-reposition on final-third entry + eligible-count exclusion              | `computeBallZone`/`state.ballZone`/`applyFreeMoveZoneCheck` pattern + GK formation-start-position derivation documented below; sequencing hazard flagged                                                   |
| RESP-07 | Dive valid-hexes-only                                                               | Already fully implemented (`applyGKDive`, `validateGKDive`, `gkDiveTargetSet`) — visual retrofit only                                                                                                      |
| RESP-08 | Auto-skip + log when no eligible players                                            | Existing precedent at `gameEngine.ts:2018-2065` (HIGH_PASS→HEADER eligibility) and the GK_DIVE out-of-range auto-GOAL fallback (`gameHandlers.ts:2380-2465`) — documented below                            |
| RESP-09 | Ball-hex highlight during response phases                                           | Existing precedent already in `HexGrid.tsx:589-599` (HEADER-only gold overlay) — generalize, don't reinvent                                                                                                |

</phase_requirements>

## Project Constraints (from CLAUDE.md)

- Backend: Node.js + Express + Socket.io (server authoritative FSM, ARCH-01). All new response-move validation must live server-side in `gameEngine.ts`/`gameHandlers.ts`; client is a mirror only.
- Frontend: React + Vite + Zustand (`useGameStore.ts`). No Redux, no Canvas, no new rendering framework — extend the existing SVG hex components.
- No new external packages are required for this phase (pure extension of existing hex-math/state patterns) — Package Legitimacy Audit is not applicable.
- TypeScript everywhere; `packages/shared` holds cross-package types/validators (`headingValidator.ts`, `shotValidator.ts`, `pitch.ts`) — new pure validators (e.g. a deflect shot-path eligibility check) belong there, matching existing precedent.

## Standard Stack

No new libraries are needed. This phase is 100% extension of existing in-repo primitives:

| Component                                                       | Location                                                       | Purpose                                                                          | Reuse For                                                                            |
| --------------------------------------------------------------- | -------------------------------------------------------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `validateResponseMoveStep`                                      | `packages/server/src/gameHandlers.ts:202-258`                  | Shared server guard sequence for single-piece-lock, pace-capped response moves   | HEADER positioning (new), keeper ball-in-box (new)                                   |
| `computeResponseMoveValidHexes`                                 | `packages/client/src/store/useGameStore.ts:233-253`            | Client mirror of the above for valid-hex highlighting                            | HEADER positioning (new), keeper ball-in-box (new)                                   |
| `applyGKDive` / `validateGKDive`                                | `gameEngine.ts:3746-3794`, `shared/src/shotValidator.ts:93-99` | Single-click-to-any-in-range-hex positioning (no piece-select step, only one GK) | DIVE (already done — visual only), template for keeper ball-in-box                   |
| `applyFreeMove` / `applyFreeMoveEnd` / `applyFreeMoveZoneCheck` | `gameEngine.ts:495-579`, `1202-1257`, `1286-1345`              | Multi-piece, no-contest, pace-capped movement phase with resume-to-prior-phase   | FINAL THIRD (new `applyFinalThirdMove`, structurally identical)                      |
| `validateHeading` (HEAD-01)                                     | `shared/src/headingValidator.ts:61-86`                         | Distance-1-clean/distance-2-penalty rule, `OUT_OF_RANGE` at >2                   | Exact source of truth for D-08's HEADER penalty tier and D-10's eligibility distance |
| `computeBallZone` / `PITCH_REGIONS.homeThird/awayThird`         | `shared/src/pitch.ts:60-72, 181-185`                           | O(1) zone classification                                                         | RESP-06 trigger + FINAL THIRD eligibility region check                               |
| `FORMATIONS` registry                                           | `shared/src/formations.ts`                                     | Per-formation slot positions, slot 0 always GK                                   | D-17's "keeper starting position" — see Common Pitfalls for the exact derivation     |

### Alternatives Considered

None — this is a pure extension phase. Introducing any new library (e.g. a "positioning wizard" UI library) would be over-engineering; the codebase already has 4 working precedents of the exact interaction pattern requested.

**Installation:** None required.

## Package Legitimacy Audit

Not applicable — this phase adds zero external packages.

## Architecture Patterns

### System Architecture Diagram

```
                     ┌─────────────────────────────────────────┐
                     │        broadcastState (roomStore.ts)      │
                     │  single ARCH-04 entry point, runs after   │
                     │  every resolved server action              │
                     └───────────────┬─────────────────────────┘
                                     │
              ┌──────────────────────┼───────────────────────────┐
              ▼                      ▼                            ▼
    applyFreeMoveZoneCheck   NEW: applyKeeperFinalThird   io.to(room).emit(GAME_STATE, ...)
    (existing, MOVE-06)      RepositionCheck (RESP-06)     (existing, unchanged)
    reads/writes ballZone    MUST run BEFORE the above
                              overwrites ballZone (see
                              Common Pitfall: sequencing)

  Phase-entry trigger points (each response phase's "who is eligible, and is
  anyone eligible at all" gate — RESP-08 auto-skip lives HERE, one per type):

  HIGH_PASS resolve ──► HEADER (existing eligibility check, gameEngine.ts:2018-2065)
  GAME_SNAPSHOT/SHOT ──► GK_DIVE (existing, auto-GOAL fallback if GK unreachable)
  GAME_SNAPSHOT ──► SNAPSHOT_DEFLECT (existing phase = "DEFLECT"; NEW: shot-path filter)
  ball enters final third ──► NEW FINAL_THIRD_RESPONSE phase (NOT the same as
                                existing FREE_MOVE_ATTACK/DEFENSE — see pitfall)
  ??? ──► NEW keeper-ball-in-box phase — TRIGGER CONDITION UNDEFINED, see Open Questions

  Client single-selection flow (existing pattern, 4 precedents already wired):
  selectPiece(id) ──► phase-branch in useGameStore.ts (line ~392-655)
       │                 computes validMoveHexes via computeResponseMoveValidHexes
       ▼
  HexGrid renders 'response' highlightType white hexes + '-1' badge on penalty hexes
       │
       ▼
  click hex ──► emitMove(pieceId, hex) ──► GAME_MOVE ──► gameHandlers.ts phase-branch
       │                                    ──► validateResponseMoveStep(...) or
       │                                        new applyFinalThirdMove(...)
       ▼
  broadcastState ──► GAME_STATE ──► client setGameState ──► re-render
```

### Recommended Project Structure

No new files/folders are needed — this phase extends existing files in place:

```
packages/shared/src/
├── headingValidator.ts   # existing — HEAD-01 distance rule (reuse, no changes needed)
├── shotValidator.ts      # existing — validateGKDive (reuse, no changes needed)
├── pitch.ts              # existing — computeBallZone/PITCH_REGIONS (reuse)
└── deflectValidator.ts   # NEW (optional) — shot-path proximity eligibility for RESP-03,
                           #   mirrors headingValidator.ts's shape (pure fn, testable in isolation)
packages/server/src/
├── gameEngine.ts          # extend: new applyFinalThirdMove (mirrors applyFreeMove),
                           #   new applyKeeperFinalThirdRepositionCheck (mirrors applyFreeMoveZoneCheck),
                           #   new HEADER-positioning sub-state transitions
├── gameHandlers.ts        # extend: widen ResponseMoveConfig unions, add new GAME_MOVE
                           #   phase branches for HEADER positioning + keeper ball-in-box
└── roomStore.ts           # extend: call new keeper-reposition check in broadcastState
                           #   (BEFORE applyFreeMoveZoneCheck — see Common Pitfalls)
packages/client/src/
├── store/useGameStore.ts  # extend: widen ResponseMoveValidHexConfig unions, add
                           #   selectPiece branches for HEADER positioning / FINAL_THIRD_RESPONSE
├── components/HexCell.tsx # extend: add 'response' to HexHighlightType + HIGHLIGHT_STYLES,
                           #   add '-1' badge <text> rendering
└── components/HexGrid.tsx # extend: priority ternary, generalize the existing ball-hex
                           #   gold-overlay block (line 589-599) to all response phases
```

### Pattern 1: Single-piece-lock response move (server + client pair)

**What:** One piece per team locked in for a movement slot; pace-capped; click-to-any-in-budget-hex (SNAPSHOT_DEFLECT style) or strict-adjacency (HIGH_PASS_MOVE style).
**When to use:** HEADER positioning, keeper ball-in-box (both are inherently single-piece: HEADER picks one contestant per side, keeper ball-in-box has exactly one keeper).
**Example (existing code, to be extended not replaced):**

```typescript
// Source: packages/server/src/gameHandlers.ts:202-258 (validateResponseMoveStep)
// Source: packages/client/src/store/useGameStore.ts:200-253 (mirror pair)
type ResponseMoveConfig = {
  actingTeam: 'home' | 'away';
  lockedPieceIdKey: 'highPassMovedPieceId' | 'gkKickMovedPieceId'
    | 'firstTimePassMovedPieceId' | 'snapDeflectMovedPieceId'
    // NEW members needed: | 'headerPositionMovedPieceId' | 'gkBallInBoxMovedPieceId'
  paceUsedKey: /* ...matching union, needs the same new members */;
  paceCap: number;
  carrierExclusionKey?: 'highPassCarrierId' | 'firstTimePassCarrierId';
  clickDistanceMode: 'strict-1' | 'range';
};
```

Both the server `ResponseMoveConfig` (gameHandlers.ts) and client `ResponseMoveValidHexConfig` (useGameStore.ts) are **closed literal unions**. Extending them for HEADER positioning and keeper ball-in-box requires widening BOTH unions in lockstep (they are intentionally parallel per the file's own "Cluster 1/3, DESIGN-03" comments) plus adding the corresponding `GameState` fields (`types.ts`, following the existing `?: string | null` / `?: number` optional-field convention seen at `types.ts:580-660`) and new `ActionEventType`/`ActionEvent` variants for undo support (mirrors `SNAP_DEFLECT_MOVE`'s shape: `{ type; pieceId; from; to; timestamp }`).

### Pattern 2: No-contest, multi-piece pace-capped movement phase

**What:** Every eligible piece (both teams) gets an independent pace budget; no single-piece lock; standard MOVEMENT-style select→highlight→click→activate flow; End Turn when done; resumes to a snapshotted prior phase.
**When to use:** FINAL THIRD (D-04/D-13).
**Example (existing code — clone this shape, do not modify it):**

```typescript
// Source: packages/server/src/gameEngine.ts:495-579 (applyFreeMove)
// Dispatch point: gameEngine.ts:645-657 (applyMove's early phase-branch)
if (state.phase === 'FREE_MOVE_ATTACK' || state.phase === 'FREE_MOVE_DEFENSE') {
  return applyFreeMove(state, pieceId, to);
}
// NEW: add an analogous branch —
// if (state.phase === 'FINAL_THIRD_RESPONSE') return applyFinalThirdMove(state, pieceId, to);
```

`applyFreeMove` already has NO ZoI/tackle-effect checks (only adjacency + occupancy + pace-cap) — this exactly matches D-13's "these moves trigger no reaction/contest" requirement. `applyFreeMoveEnd` (gameEngine.ts:1202-1257) is the End Turn / resume-to-prior-phase template; `applyFreeMoveZoneCheck` (gameEngine.ts:1286-1345) is the entry-trigger template — **but see the Common Pitfall below: FINAL THIRD is NOT the same trigger/eligibility as this existing mechanic.**

### Pattern 3: No-piece-selection single-click positioning (implicit single piece)

**What:** No `selectPiece` step at all — because there is exactly one eligible piece (the GK), the client computes the target-hex set unconditionally once the phase is entered, and a click directly emits the move.
**When to use:** DIVE (existing), keeper ball-in-box (new, once trigger condition is defined) — because both have exactly one eligible piece by definition (D-11/D-14: "keeper only").
**Example:**

```typescript
// Source: packages/client/src/components/HexGrid.tsx:152-166 (gkDiveTargetSet) +
//         HexGrid.tsx:516-518 (onClick = () => emitGKDive(hex))
const gkDiveTargetSet = new Set<string>();
if (phase === 'GK_DIVE' && gkDivePosition != null) {
  // ...builds the set directly from hexLine + hexDistance, no selectPiece involved
}
```

### Anti-Patterns to Avoid

- **Conflating FINAL_THIRD_RESPONSE with the existing `FREE_MOVE_ATTACK`/`FREE_MOVE_DEFENSE` mechanic.** They share a superficial trigger ("ball enters a final third") but have **opposite eligibility**: existing free-move moves pieces in the **opposite** third from where the ball just entered (an unrelated MOVE-06 "give distant players a repositioning opportunity" rule); RESP-05 moves pieces **already in** the entered third (a positioning-for-the-imminent-attack rule). Do not extend `applyFreeMoveZoneCheck`'s eligibility logic in place — write a new, separate function.
- **Confusing the existing `header-target` highlightType with the new HEADER positioning white hexes.** `header-target` (green, 0.4 opacity, `HexCell.tsx:61-67`) is the **post-duel** target-hex-selection overlay (winner picks where to head the ball to — unchanged by D-01). The new `response` white type is for the **pre-duel** contestant positioning step. Both are active during `phase === 'HEADER'` at different sub-steps — do not let them collide in the priority ternary.
- **Treating "GK_DIVING" as a real phase identifier.** CONTEXT.md's prose uses "GK_DIVING" several times; the actual `GamePhase` union value is `'GK_DIVE'` (`shared/src/types.ts:385`). No code, event, or type anywhere uses the string `GK_DIVING`.
- **Adding the ball-hex ring as a new entry in `HexHighlightType`.** The highlightType priority ternary (`HexGrid.tsx:480-496`) allows only ONE highlightType per hex — a hex could simultaneously be a valid response destination (`response`, white fill) AND the ball's hex (gold ring). Making the ring a `HexHighlightType` member would force it to compete for the single-value slot instead of layering. The codebase already has the correct pattern for this: an unconditional sibling `<polygon>` drawn independent of `highlightType` (see Pattern 4 below).

### Pattern 4: Ball-hex ring as an unconditional sibling overlay (not a highlightType)

**What:** An additional SVG element drawn for the ball's hex regardless of what `highlightType` that hex has, so it composes with any other highlight.
**Existing precedent — generalize this, don't reinvent it:**

```typescript
// Source: packages/client/src/components/HexGrid.tsx:589-599
{/* HEADER phase: gold overlay on ball position hex so players can see where the ball landed */}
{phase === 'HEADER' && hex.q === ball.position.q && hex.r === ball.position.r && (
  <polygon
    points={points}
    fill="#f5c518"
    fillOpacity={0.5}
    stroke="#f5c518"
    strokeWidth={2}
    pointerEvents="none"
  />
)}
```

This is functionally 90% of RESP-09 already. Recommended: generalize the condition to `RESPONSE_PHASES.has(phase)` (covering HEADER, SNAPSHOT_DEFLECT, GK_DIVE, FINAL_THIRD_RESPONSE, and the new keeper ball-in-box phase) and change `fill="#f5c518" fillOpacity={0.5}` → `fill="none"` with just the `stroke` (D-9 explicitly says "ring/outline", not a filled overlay — this existing block is filled, so a small style change is needed, but the layering/element-placement approach should be reused verbatim). Because this element is rendered inside the Layer-1 hex-map loop (before `<BallMarker>` at Layer 2), the "renders under BallMarker" requirement (D-09) is automatically satisfied by DOM order — no z-index work needed.

## Don't Hand-Roll

| Problem                                           | Don't Build                                      | Use Instead                                                                                   | Why                                                                                                                                         |
| ------------------------------------------------- | ------------------------------------------------ | --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Single-piece-lock pace-capped movement validation | A new bespoke validator per response type        | `validateResponseMoveStep`/`computeResponseMoveValidHexes`, widened                           | 4 existing phases already share this exact code; a 5th and 6th bespoke copy would violate the codebase's own DESIGN-03 consolidation intent |
| Multi-piece no-contest movement phase             | A new "final third movement" system from scratch | `applyFreeMove`/`applyFreeMoveEnd` shape, cloned into `applyFinalThirdMove`                   | Nearly line-for-line what D-04/D-13 ask for; already handles pace, occupancy, abandon-on-switch, undo-friendly event logging                |
| Header-range / penalty-distance math              | New distance-tier logic                          | `validateHeading` (HEAD-01)                                                                   | Already implements exactly distance-1-clean/distance-2-penalty/distance->2-reject; do not duplicate this constant elsewhere                 |
| Zone-crossing detection for RESP-06               | New "has ball entered final third" polling logic | `computeBallZone` + `state.ballZone` comparison, same primitive `applyFreeMoveZoneCheck` uses | Already O(1), already the established idiom, already exercised by tests                                                                     |

**Key insight:** Nearly every piece of domain logic this phase needs already exists somewhere in the codebase under a different phase name. The main engineering risk is **structural confusion between similar-looking existing mechanics** (FREE_MOVE vs FINAL_THIRD_RESPONSE; `header-target` vs new HEADER positioning `response` hexes; GK_DIVE vs "GK_DIVING") rather than missing primitives.

## Common Pitfalls

### Pitfall 1: Keeper-reposition check ordering in `broadcastState`

**What goes wrong:** `applyFreeMoveZoneCheck` (existing) unconditionally rewrites `state.ballZone` to the newly computed zone on every call — including calls where nothing else happens (`return { ...state, ballZone: newZone }` when the zone hasn't changed meaningfully, and also on every clean crossing). If a new keeper-reposition check is registered in `broadcastState` **after** `applyFreeMoveZoneCheck` runs, it will read `state.ballZone` already overwritten to the current zone and will find `newZone === state.ballZone` on every single call — **the crossing will never be detected and the keeper will never reposition.**
**Why it happens:** `roomStore.ts:315-319`'s `broadcastState` is the single ARCH-04 entry point; both the existing free-move check and any new keeper-reposition check must read the _same_ "old vs new zone" comparison, but only one of them can run first and see the pre-update value.
**How to avoid:** Either (a) run the new keeper-reposition check **before** `applyFreeMoveZoneCheck` in `broadcastState`, reading `state.ballZone` while it's still the old value, or (b) merge both checks into a single function that computes `newZone` once and applies both effects before writing `ballZone` a single time.
**Warning signs:** Keeper never moves in manual testing despite the ball visibly crossing into a final third; a unit test that asserts `ballZone` updates would pass while the reposition assertion silently fails only if reposition logic runs second.

### Pitfall 2: "Once per possession" has no existing primitive to hook

**What goes wrong:** D-15 requires the keeper reposition to fire once per **possession**, not once per zone-entry. The codebase has no centralized "possession changed" / "turnover" event — `attackingTeam` is mutated ad hoc across many code paths (steal success, tackle success, pass interception, loose-ball pickup, GK save, etc.), each inline in `gameEngine.ts`. A naive `state.ballZone !== newZone` check (mirroring `applyFreeMoveZoneCheck` exactly) will **incorrectly re-fire** if the ball leaves a final third to the middle and re-enters the same final third without any turnover (e.g., a back-and-forth sequence within the same attack).
**Why it happens:** `ballZone` alone conflates "did the zone change" with "did we already reposition for this stay" — these are different questions once re-entry-without-turnover is possible.
**How to avoid:** Track an explicit flag, e.g. `keeperRepositionedForZone: { home: boolean; away: boolean }` (mirrors `ballZone`'s `'home'|'middle'|'away'` shape), set `true` when firing for a given zone and reset the whole map on any kickoff/half-reset (the 3 existing `ballZone: 'middle'` reset sites: `gameEngine.ts:358`, `~4470`, `~4561`) **and** on any turnover. Because there is no single turnover hook, this is the one piece of this phase's design that genuinely needs a planning-time decision, not just an implementation detail — see Open Questions.
**Warning signs:** Keeper snaps back to its formation spot repeatedly during a single sustained attack, which looks like a bug to a player even though it technically matches a naive "re-trigger on every zone-crossing" reading of the ballZone field.

### Pitfall 3: HEADER's existing contestant model is simultaneous multi-select, not sequential single-move

**What goes wrong:** `GAME_HEADER_CONTESTANT` (`gameHandlers.ts:2492-2600ish`) currently accepts `pieceIds: string[]` — an array, because a team may nominate **multiple** contestants (the duel logic in `computeHeaderDuelDetail` explicitly resolves ties among a team's own multiple nominees). Both teams act **simultaneously** (whichever confirms first sees a "waiting for opponent" panel; there is no attacker-then-defender ordering today). D-02 requires a strictly **sequential**, **single-piece**, **movement-based** flow. A planner who reads only the "GAME_HEADER_CONTESTANT / duel / GAME_HEADER_TARGET logic untouched" line in D-02 might assume the existing contestant-selection UI can be reused as-is with a movement step bolted on — it cannot; the entire selection UX (multi-select toggle, simultaneous confirm) needs to be replaced by a new pre-step, after which the (unchanged) `GAME_HEADER_CONTESTANT` handler is invoked automatically with a single-element array once each side's move completes.
**Why it happens:** The requirement's phrasing ("existing duel/target-selection flow proceeds exactly as it does today") is easy to over-read as "the whole HEADER phase's client UI is unchanged."
**How to avoid:** Plan a genuinely new sub-state (e.g. `headerPositioningTurn: 'attacker' | 'defender' | null`) that gates a new positioning UI ahead of the untouched contestant/duel/target UI. `toggleHeaderContestantId`/the multi-select ActionPanel block (`ActionPanel.tsx:441-474`) becomes dead code for the _positioning_ step but the underlying `emitHeaderContestant([pieceId])` call is still how the new flow hands off to the old flow.
**Warning signs:** A plan that only touches `HexGrid.tsx` highlight rendering for HEADER without touching `ActionPanel.tsx`'s HEADER block or adding new `GameState` sequencing fields is under-scoped.

### Pitfall 4: DEFLECT's shot-path eligibility is entirely new — SNAPSHOT_DEFLECT today has no path restriction

**What goes wrong:** The existing `SNAPSHOT_DEFLECT` phase (`validateResponseMoveStep` config: `paceCap: 2, clickDistanceMode: 'range'`, no `carrierExclusionKey`) lets the defending team move **any** defending piece, to **any** legal hex within a 2-hex budget — there is no check anywhere that the destination (or the piece's reachability) relates to the shot path. D-12's "on-or-adjacent to the shot-path line, within hex-distance 3" is a **net-new filter**, not a visual-only retrofit like DIVE.
**Why it happens:** CONTEXT.md's code pointer note ("SNAP_DEFLECT: ... needs a full read during research/planning, not yet deeply inspected") correctly flagged this as unverified — it is now verified: there is no existing path-proximity logic.
**How to avoid:** Plan two independent additions: (1) an eligibility filter (which pieces are selectable — piece's current position within 3 hexes of any point on `hexLine(shotOrigin, shotTargetHex)`), and (2) a destination filter (which hexes within the existing pace budget are highlighted — intersect the existing pace-based reachable set with "on-or-adjacent to the shot-path line").
**Also flag:** D-12 says eligibility is bounded by "hex-distance 3" — but the existing pace **cap** for `SNAPSHOT_DEFLECT` is 2 hexes (`paceCap: 2`, both server and client). CONTEXT.md does not reconcile whether D-12's "3" changes the movement budget or is purely an eligibility-radius concept layered on top of the unchanged 2-hex pace cap. Do not silently pick one interpretation — see Open Questions.
**Warning signs:** A plan that filters only the _destination_ hex highlight but not the _eligible-piece_ set (or vice versa) will not satisfy RESP-03's "only activates eligible players who can legally move onto or adjacent to the shot path" wording, which is about player eligibility, not just hex highlighting.

### Pitfall 5: Keeper ball-in-box has no trigger condition anywhere in the codebase

**What goes wrong:** A repo-wide search for "ball in box" / "ball-in-box" turns up matches **only** in Phase 27's own planning docs (`27-CONTEXT.md`, `27-DISCUSSION-LOG.md`) and the high-level roadmap/requirements/project docs that reference this phase — never in `gameEngine.ts`, `gameHandlers.ts`, or any rulebook doc. There is no `GamePhase` value, no handler, no `ActionEvent` type, and critically **no defined moment when this phase would begin** (unlike HEADER which starts from `HIGH_PASS` resolution, or DIVE which starts from shot declaration). LOOSE_BALL resolution (`gameEngine.ts:2739-2810`) always transitions to `'PASS'` regardless of where the ball lands — there is no special case for the ball landing in a penalty area.
**Why it happens:** D-14 defines the eligibility _range_ (keeper only, ≤1 hex) assuming the phase already exists and gets triggered somehow; the CONTEXT.md discussion never surfaced the trigger question.
**How to avoid:** This must be resolved as an explicit design decision before planning locks in a specific implementation — see Open Questions for the most plausible candidate (LOOSE_BALL landing inside `homePenaltyArea`/`awayPenaltyArea`) and the risk of guessing wrong.
**Warning signs:** A plan that implements keeper ball-in-box's positioning UI but never wires an actual entry trigger into the FSM (or wires an unconfirmed guess) should be flagged at plan-check time.

### Pitfall 6: GK "starting position" is not a stored field — must be derived from FORMATIONS

**What goes wrong:** `PlayerPiece` (`shared/src/types.ts:7-36`) has no `startPosition`/`spawnPosition` field. A naive implementation might hardcode a goal-line-center hex (exactly what D-17 forbids) or try to track "the GK's position at kickoff" via a new mutable field that could drift.
**Why it happens:** The formation system (`shared/src/formations.ts`) stores slot positions in a registry keyed by `FormationId`, not per-piece.
**How to avoid:** Derive it: `FORMATIONS[state.selectedFormation?.[team] ?? '4-4-2'].slots[0].position`, mirrored for away (`{ q: 36 - pos.q, r: pos.r }`). Verified fact: **GK is slot index 0 in all 4 current formations, and is explicitly exempt from the kick-off +4 shift** (`gameEngine.ts:272-282`, "GK is exempt"), so this evaluates to a fixed `{q: 2, r: 13}` (home) / `{q: 34, r: 13}` (away) constant across all 4 shipped formations today — but should still be computed via the registry (not hardcoded) so it stays correct if a future formation ever places the GK elsewhere.
**Warning signs:** A plan that adds a new `gkStartPosition` field to `PlayerPiece` or `GameState` and tries to "track" it is over-engineering — it's a pure derivation, zero state needed.

## Code Examples

### Existing header-range distance rule (source of truth for D-08/D-10)

```typescript
// Source: packages/shared/src/headingValidator.ts:61-86
export function validateHeading(
  _state: GameState,
  challenger: PlayerPiece,
  ballPosition: HexCoord,
  options: HeadingOptions,
): HeadingResult {
  if (options.previousActionWasHeadedPass) {
    return { ok: false, reason: 'CONSECUTIVE_HEADER' };
  }
  const dist = hexDistance(challenger.position, ballPosition);
  if (dist > 2) return { ok: false, reason: 'OUT_OF_RANGE' };
  // ... dist === 2 → penaltyModifier -1 (contested only)
}
```

### Existing auto-skip precedent (template for RESP-08)

```typescript
// Source: packages/server/src/gameEngine.ts:2018-2065
const homeEligible = state.pieces.some(
  (p) => p.teamId === 'home' && hexDistance(p.position, targetHex) <= 2,
);
const awayEligible = state.pieces.some(
  (p) => p.teamId === 'away' && hexDistance(p.position, targetHex) <= 2,
);
if (!homeEligible && !awayEligible) {
  // No eligible players → ball falls loose (no header contest) — RESP-08's "auto-skip" shape
  return { ok: true, state: { ...state, phase: 'LOOSE_BALL' /* ...+ event log entry */ } };
}
// 5.2: auto-confirm teams with no eligible players (they automatically decline)
```

Every new response phase needs its own version of this "compute eligible set at entry → if empty, skip with a logged event → if partially empty, auto-confirm the empty side" gate. There is no single shared helper for this today (each site is bespoke) — this phase would be a reasonable place to extract one if 3+ new call sites end up needing the same shape (YAGNI until then).

### GK dive penalty distance (source of truth for D-08/D-11, already implemented — visual-only work remains)

```typescript
// Source: packages/shared/src/shotValidator.ts:93-99
export function validateGKDive(_gk: PlayerPiece, distance: number): DiveResult {
  const d = Math.max(distance, 0);
  if (d > 3) return { saveable: false, reason: 'OUT_OF_RANGE' };
  const savingPenalty = d === 3 ? -1 : 0;
  return { saveable: true, savingPenalty };
}
```

## State of the Art

| Old Approach                                                        | Current Approach                                                                                 | When Changed                 | Impact                                                                                                                                                                                                                                  |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| HEADER contestant = simultaneous multi-select, no movement          | Sequential single-piece positioning move, hands off to existing (unchanged) contestant/duel flow | This phase (net-new)         | Requires a new sub-state field + new ActionPanel block; existing `toggleHeaderContestantId`/multi-select UI becomes dead code for the positioning step but the underlying single-element `emitHeaderContestant` call remains the bridge |
| SNAPSHOT_DEFLECT = unrestricted defender repositioning              | Shot-path-proximity-gated repositioning                                                          | This phase (net-new filter)  | New eligibility + destination filtering logic; existing pace/occupancy validation unchanged                                                                                                                                             |
| GK_DIVE hex highlight = ad hoc `shot-path-action`/`shot-path` reuse | Dedicated `response` white type + `-1` badge at distance 3                                       | This phase (visual retrofit) | Low risk — `applyGKDive`/`validateGKDive` mechanics are completely untouched                                                                                                                                                            |

**Deprecated/outdated:** None — no code is being removed, only extended. `toggleHeaderContestantId`/multi-select header UI becomes unused for the _positioning_ step specifically but the underlying store action and `GAME_HEADER_CONTESTANT` handler stay wired for the post-positioning hand-off, per D-02.

## Assumptions Log

| #   | Claim                                                                                                                                                                                             | Section          | Risk if Wrong                                                                                                                                                                                                                                             |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A1  | Keeper ball-in-box's most plausible (unconfirmed) trigger is "LOOSE_BALL lands inside the defending team's penalty area"                                                                          | Open Questions   | If wrong, the entire keeper ball-in-box slice gets built against the wrong entry condition and needs rework                                                                                                                                               |
| A2  | D-12's "hex-distance 3" for DEFLECT is an eligibility radius layered on the existing unchanged 2-hex pace cap, not a pace-cap increase to 3                                                       | Common Pitfall 4 | If wrong (i.e. pace cap should become 3), the server `paceCap: 2` config for SNAPSHOT_DEFLECT needs to change, which is a materially different, larger diff than an eligibility filter alone                                                              |
| A3  | "Once per possession" (D-15) should be tracked via a `{home: boolean, away: boolean}` map reset at existing kickoff/half-reset sites plus turnover detection, rather than a single global boolean | Common Pitfall 2 | If the simpler global-boolean interpretation is what the user actually wants, the zone-keyed map is unnecessary complexity; if the richer interpretation is wanted, a global boolean under-delivers (won't re-fire for the opposite third mid-possession) |
| A4  | FINAL THIRD should be built as a brand-new phase (e.g. `FINAL_THIRD_RESPONSE`) rather than repurposing/extending `FREE_MOVE_ATTACK`/`FREE_MOVE_DEFENSE` in place                                  | Anti-Patterns    | If the intent was actually to reuse/relabel the existing MOVE-06 mechanic (unlikely given the opposite eligibility direction, but not 100% excluded by CONTEXT.md's wording), building a parallel new phase would be redundant                            |

**If this table is empty:** N/A — see above.

## Open Questions

1. **What triggers keeper ball-in-box?**
   - What we know: eligibility is "keeper only, ≤1 hex" (D-14); resolution model mirrors `applyGKDive`'s defer-to-later-event pattern (D-05).
   - What's unclear: the entry condition. No phase, handler, or trigger exists anywhere in the codebase or any rulebook doc for "ball in box."
   - Recommendation: Before planning locks in an implementation, confirm with the user whether the intended trigger is "a `LOOSE_BALL` resolution lands inside `homePenaltyArea`/`awayPenaltyArea`" (the closest existing primitive — `PITCH_REGIONS.homePenaltyArea`/`awayPenaltyArea` already exist in `pitch.ts:33-34, 55-56`) or something else (e.g. a specific GK_RESTART sub-case, or a shot that results in a loose ball inside the box). This is the single highest-risk unknown in the phase.

2. **Does D-12's "hex-distance 3" change DEFLECT's pace cap, or only its eligibility radius?**
   - What we know: SNAPSHOT_DEFLECT's existing pace cap is 2 hexes (`paceCap: 2` in both `gameHandlers.ts` and `useGameStore.ts`); D-12 introduces "hex-distance 3."
   - What's unclear: whether the pace cap itself should increase to 3, or whether "3" is purely an eligibility pre-filter (which pieces get highlighted as selectable at all) layered on the unchanged 2-hex movement budget.
   - Recommendation: Treat as eligibility-radius-only (A2 above) unless the user confirms otherwise — this is the lower-risk, smaller-diff interpretation and matches the discussion log's phrasing ("defenders within 3 hexes of any point on the shot path"), which describes _who is eligible_, not _how far they may move_.

3. **What exact mechanism satisfies "once per possession" for RESP-06 (D-15)?**
   - What we know: must not re-fire on re-entry into the same final third within the same possession; must fire again for a genuinely new possession or a different (opposite) final third.
   - What's unclear: the codebase has no centralized "turnover" event to hook a reset into — `attackingTeam` mutates across many scattered call sites.
   - Recommendation: See Common Pitfall 2 for the recommended `{home, away}`-keyed flag design; the planner should pick a concrete, minimal set of reset hook-points (at minimum: the 3 existing `ballZone: 'middle'` kickoff/half reset sites) rather than attempting to instrument every turnover call site, and accept that same-zone re-entry after a turnover-that-keeps-ball-in-the-same-third is a rare edge case that may not need perfect coverage in v1.

4. **Does FINAL THIRD alternate attacker-then-defender turns, or allow simultaneous free-for-all selection by both teams?**
   - What we know: D-13 says "ALL pieces from BOTH teams... eligible to be selected and moved" but does not specify turn order. The closest existing precedent (`FREE_MOVE_ATTACK`/`FREE_MOVE_DEFENSE`) is explicitly sequential (attacker sub-phase, then defender sub-phase).
   - What's unclear: whether FINAL_THIRD_RESPONSE should mirror that sequential two-sub-phase structure, or allow both teams' clients to select-and-move independently in one shared phase (which would need careful `isProcessing`-mutex handling to avoid races since `selectPiece`/`emitMove` currently assume one team acts within an `activeTeam`-gated phase at a time).
   - Recommendation: Mirror the existing sequential `FREE_MOVE_ATTACK`→`FREE_MOVE_DEFENSE` structure (attacking team's eligible final-third pieces move and End Turn, then defending team's) — this is the path of least structural risk given `activeTeam`-gating is baked into nearly every phase-branch in both `gameEngine.ts` and `useGameStore.ts`.

## Environment Availability

Not applicable — this phase has no new external tool/service dependencies (Node/Socket.io/React/Vite/vitest are already installed and exercised by the existing test suite).

## Validation Architecture

### Test Framework

| Property           | Value                                                                                         |
| ------------------ | --------------------------------------------------------------------------------------------- |
| Framework          | Vitest 2.1.9 (both `packages/server` and `packages/client`)                                   |
| Config file        | per-package `vitest` config (see `package.json` `"test": "vitest run"` in both packages)      |
| Quick run command  | `pnpm --filter @counter-attack/server test -- gameEngine.phase27` (once new test file exists) |
| Full suite command | `pnpm -r test` (root, runs both packages)                                                     |

### Phase Requirements → Test Map

| Req ID  | Behavior                                                           | Test Type                                                               | Automated Command                                                                                                                                              | File Exists?                                                                      |
| ------- | ------------------------------------------------------------------ | ----------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| RESP-01 | Single-selection activation model consistent across response types | unit (server)                                                           | `vitest run gameEngine.phase27.test.ts`                                                                                                                        | ❌ Wave 0 — new file, mirrors `gameEngine.phase17.test.ts` naming convention      |
| RESP-02 | White hex + `-1` badge rendering                                   | unit (client, if component tests exist) or manual/visual                | N/A — repo has no client component-render test precedent found; likely manual/UAT                                                                              | ❌ — confirm during planning whether client visual assertions are in scope        |
| RESP-03 | Deflect eligibility gated to shot path                             | unit (shared validator, if extracted per Recommended Project Structure) | `vitest run deflectValidator.test.ts` (new, mirrors `headingValidator.test.ts`)                                                                                | ❌ Wave 0                                                                         |
| RESP-04 | Header eligibility gated to heading range                          | unit (shared)                                                           | Existing `headingValidator.test.ts` already covers HEAD-01 distance rule; new positioning-flow integration test needed in `gameHandlers.phaseNN.test.ts` style | ❌ Wave 0 (integration only; unit coverage of the underlying rule already exists) |
| RESP-05 | Final-third per-piece-range movement                               | unit (server)                                                           | `vitest run gameEngine.phase27.test.ts` (new `applyFinalThirdMove` cases)                                                                                      | ❌ Wave 0                                                                         |
| RESP-06 | Keeper auto-reposition + eligible-count exclusion                  | unit (server)                                                           | `vitest run gameEngine.phase27.test.ts` (new zone-check cases)                                                                                                 | ❌ Wave 0                                                                         |
| RESP-07 | Dive valid-hexes-only                                              | unit (server)                                                           | Existing `gameEngine.test.ts`/`shotGkRange.test.ts` already cover `validateGKDive`/`applyGKDive` — only new visual-classification assertions needed if any     | ✅ largely covered already                                                        |
| RESP-08 | Auto-skip + log when no eligible players                           | unit (server)                                                           | `vitest run gameEngine.phase27.test.ts` (per-type auto-skip cases)                                                                                             | ❌ Wave 0                                                                         |
| RESP-09 | Ball-hex highlight during response phases                          | manual/visual (no existing client render-test precedent found in repo)  | N/A                                                                                                                                                            | ❌ — confirm scope during planning                                                |

### Sampling Rate

- **Per task commit:** `vitest run <new-test-file>` (server package)
- **Per wave merge:** `pnpm -r test` (full suite, both packages)
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `packages/server/src/__tests__/gameEngine.phase27.test.ts` — covers RESP-01, RESP-03 (server-side eligibility), RESP-05, RESP-06, RESP-08
- [ ] `packages/server/src/__tests__/gameHandlers.phase27.test.ts` — covers the new/extended `GAME_MOVE` phase branches, mirrors existing `gameHandlers.phase17-06.test.ts`/`gameHandlers.rule11.test.ts` harness pattern (real Socket.io server on port 0)
- [ ] `packages/shared/src/deflectValidator.test.ts` — if the shot-path eligibility check is extracted as a shared pure function (recommended), needs its own unit test mirroring `headingValidator.test.ts`
- [ ] No existing client-side component-render test harness was found for `HexCell.tsx`/`HexGrid.tsx`/`ActionPanel.tsx` — RESP-02 and RESP-09's visual requirements likely rely on manual/UAT verification unless the planner introduces one; flag this explicitly rather than assuming coverage

## Security Domain

Not applicable in the ASVS sense — no new auth/session/crypto surface. The relevant control class here is **ASVS V4 Access Control / Tampering** (already the codebase's own convention, referenced throughout as "ASVS V4" in comments):

| Pattern                                                                              | STRIDE    | Standard Mitigation (already established in this codebase)                                                                                                                                                                   |
| ------------------------------------------------------------------------------------ | --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Client claims to move an opponent's piece / a piece it doesn't control               | Tampering | Server-side ownership check (`piece.teamId !== config.actingTeam` → reject), same as every existing `validateResponseMoveStep` call site                                                                                     |
| Client claims a destination hex outside the server-computed eligible/pace-capped set | Tampering | Server re-validates distance/occupancy/pitch-boundary independently of the client's highlight computation — client highlight sets are cosmetic only (T-4-03 convention)                                                      |
| Client spoofs "duel winner" / contestant selection for the opposing team             | Spoofing  | Existing `teamSlot` derivation from `socket.data.playerSlot` (never trusts client-claimed team) — new HEADER positioning code must follow the same `socketTeam(socket)` pattern already used everywhere in `gameHandlers.ts` |

New response-move handlers must follow the exact same guard ordering already established by `validateResponseMoveStep` (active-player → ownership → lock → pace-cap → distance → pitch-boundary → occupancy) rather than inventing a new guard sequence.

## Sources

### Primary (HIGH confidence — verified by direct code inspection this session)

- `packages/client/src/components/HexCell.tsx` (full file read) — `HexHighlightType`/`HIGHLIGHT_STYLES`
- `packages/client/src/components/HexGrid.tsx` (lines 1-720 read) — highlight priority ternary, GK dive rendering, ball-hex gold overlay precedent
- `packages/server/src/gameEngine.ts` (multiple ranges read: 225-340, 485-660, 1170-1345, 1990-2090, 3190-3320, 3690-3800) — `buildSquadPieces`, `applyFreeMove`/`applyFreeMoveEnd`/`applyFreeMoveZoneCheck`, HIGH_PASS→HEADER eligibility gate, `computeHeaderDuelDetail`, `applyGKDive`
- `packages/server/src/gameHandlers.ts` (lines 1-380, 2260-2600 read) — `validateResponseMoveStep`/`ResponseMoveConfig`, `GAME_MOVE` phase branches, `GAME_HEADER_ACCURACY_ACK`/`CONTESTANT`/`TARGET` handlers
- `packages/client/src/store/useGameStore.ts` (lines 1-660 read) — `computeResponseMoveValidHexes`/`ResponseMoveValidHexConfig`, `selectPiece` phase branches
- `packages/shared/src/types.ts` (lines 1-440, 580-660 read) — `PlayerPiece`, `GamePhase`, `ActionEvent`/`ActionEventType`, `GameState` optional-field conventions
- `packages/shared/src/formations.ts` (full file read) — `FORMATIONS` registry, GK slot-0 constant
- `packages/shared/src/pitch.ts` (full file read) — `PITCH_REGIONS`, `computeBallZone`, `isInRegion`
- `packages/shared/src/headingValidator.ts` (full file read) — HEAD-01 distance rule
- `packages/shared/src/shotValidator.ts` (full file read) — `validateGKDive`, `validateShotDuel`, `validateHandlingCheck`
- `packages/server/src/roomStore.ts` (lines 300-334 read) — `broadcastState` central hook, `applyFreeMoveZoneCheck` call site
- `packages/client/src/components/ActionPanel.tsx` (lines 355-475 read) — existing HEADER contestant UI, GK_DIVE/SNAPSHOT_DEFLECT helper-text patterns
- `packages/client/src/components/PieceOverlay.tsx` (lines 235-268 read) — jersey-number `<text>` pattern (candidate for `-1` badge)
- `.planning/REQUIREMENTS.md`, `.planning/ROADMAP.md` (Phase 27 section), `.planning/STATE.md` (Decisions Locked, Phase 12 P04) — canonical refs per CONTEXT.md
- Repo-wide grep for "ball in box"/"ball-in-box" (case-insensitive, all `.md` and source files) confirming zero implementation exists outside Phase 27's own planning docs

### Secondary (MEDIUM confidence)

None used — all findings this session were grounded in direct source reads (no WebSearch/Context7 lookups were needed; this is a pure in-repo extension phase with no new external libraries).

### Tertiary (LOW confidence)

None.

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — zero new dependencies, all patterns read directly from source
- Architecture: HIGH — every integration point cited was opened and read this session, not inferred from CONTEXT.md's approximate pointers (which turned out to be accurate on line numbers but incomplete on semantics — see Common Pitfalls 3-5)
- Pitfalls: HIGH for Pitfalls 1, 3, 4, 6 (directly observed in code); MEDIUM for Pitfall 2/5's exact recommended fix (the "once per possession" and "keeper ball-in-box trigger" designs are reasoned recommendations, not verified against an authoritative source, since no such source exists in-repo)

**Research date:** 2026-07-18
**Valid until:** No expiry driver (in-repo research, not version-pinned to an external library) — revalidate only if Phase 28+ significantly refactors `gameEngine.ts`'s phase-branch structure before this phase is planned/executed.
