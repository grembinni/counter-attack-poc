# Phase 45: Game Summary Popup - Research

**Researched:** 2026-08-28
**Domain:** Server-authoritative whole-match stat accumulation (possession/passes/tackles/shots/xG/fouls/cards) + client-side read-only stats modal, in an existing Node.js/Socket.io/React monorepo
**Confidence:** MEDIUM-HIGH (codebase mechanics VERIFIED by direct read; a few stat-definition edge cases remain ASSUMED and flagged)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**xG Formula (STATS-08) — fully specified by the user, verbatim**

- **D-01:** Use this exact per-shot xG formula (not a Claude-proposed approximation):

  ```
  xg = 1
     * (1 - (D * 0.13))
     * (1 - (C * 0.10))
     * (1 - (ABS(Y-13) > 3 ? ABS(Y-13) * 0.07 : ABS(Y-13) * 0.04))
     * (1 - (X > 3 ? X * 0.07 : X * 0.04))
  ```

  Where:
  - `D` = number of defenders in the goal box (6-yard box) at the moment of the shot
  - `C` = number of defenders in the penalty box **not including** the goal box (i.e., penalty-box-only defenders)
  - `X` = the shot hex's distance from the near goal line along the q-axis, in hexes (0 = standing on the goal line, growing as the shooter moves away)
  - `Y` = the shot hex's raw axial `r` coordinate (the formula's own `-13` term centers it, since `r=13` is the board's vertical centre row per the kickoff hex `{q:18, r:13}`)
  - Accumulate per-shot xG into a running per-team total (never reset at half-time).

- **D-02:** Coordinate mapping confirmed directly with the user: `X` is a hex-distance-from-goal-line **depth** value (perpendicular to the goal line, using the q-axis), and `Y` is the raw `r` coordinate of the shot hex — NOT an offset already computed by the caller. Downstream implementers must derive both from the shot hex at the moment of each shot-resolution branch (per D-03).
- **D-03:** xG must be captured at **every** shot-resolution branch, per ROADMAP.md Success Criterion 3: standard shot, snapshot/deflection, headed shot, penalty, and GK-dive-at-feet penalty. No single existing shared hook covers all of these today (per STATE.md pitfall) — each branch needs its own instrumentation point.
- **D-04:** Goal-box and penalty-box hex membership (for computing `D` and `C`) must be derived from the same geometric boundaries already used for `PitchMarkings.tsx`'s visual rendering (home/away penalty box and 6-yard box edges) — not a new, separately-defined zone. Planner should translate those existing pixel/hex boundaries into a reusable hex-membership check.

**Possession % (STATS-04)**

- **D-05:** Possession is tracked as a **live running accumulator** tied to `attackingTeam`, incremented per action/MOVE tick — mirrors the existing event-driven MM:00 clock mechanism and the `subsUsed` never-reset-at-half-time pattern. Do NOT derive possession retrospectively by scanning `eventLog` on each popup open.
- **D-06:** This same "live accumulator, never reset at half-time" approach applies to all other whole-match stats in this phase (passes, tackles/steals, shots, fouls, cards) — confirmed by ROADMAP.md Success Criterion 4 ("mirroring the existing subsUsed persistence pattern"), not just possession.

**Tackle/Steal Success % and the Phase 43 Decline Mechanic (STATS-06)**

- **D-07:** A **declined** tackle/steal (Phase 43's `TACKLE_STEAL_PROMPT` decline) does **NOT** count toward the attempt total used in the success-percentage denominator. This directly matches Phase 43's own rule (TACKLE-02: "declining doesn't count as an attempt"). Only duels that actually rolled dice count as attempts; declined-but-still-live opportunities are invisible to this stat.

**(i) Icon Placement & Access (STATS-01)**

- **D-08:** The icon is placed **top-center, directly above the "00:00" clock**, inside `GameBoard.tsx`'s `.scoreboardCentreCell` (as a new small row above the existing `.clockRow`) — reads as a global match-level affordance rather than tied to either team's side of the scoreboard. `.scoreboardCentreCell` is currently a `justify-content: center` column sized to its content (`clockRow` + `phaseSummary`), not a cell with pre-reserved empty space — the new icon row must be added as an actual child element above `clockRow`, not positioned into "already-empty" space.
- **D-09:** The icon is **always clickable**, in every game phase, including mid-duel/prompt interrupt phases (tackle/steal prompt, GK dive-at-feet, foul choice, etc.) — no phase-gating/disabling logic needed. The popup is read-only and cannot conflict with an in-progress action.

**HALF_TIME/FULL_TIME Integration (STATS-02)**

- **D-10:** The existing HALF_TIME/FULL_TIME overlay (`GameBoard.tsx` lines ~519+/~575+, the large score-row with team badges/score numerals/"HALF TIME"–"FULL TIME"/clock) **keeps its current header exactly as-is**. The full match-summary content (settings recap + all STATS-04..09 stats, same structure/content/format as the on-demand popup) is **appended below** that existing header, inside the same overlay card. The existing proceed/confirm controls (mutual-confirm kick-off button at half-time, result display at full-time) stay below the appended stats content.
- **D-11:** This means the match-summary content should be built as one reusable component/section (e.g. a `MatchSummaryContent` block) consumed by both: (a) the on-demand modal opened via the (i) icon, and (b) appended inline inside the existing `HALF_TIME`/`FULL_TIME` overlay card. Do not duplicate the stats-rendering logic between the two call sites.

**Settings/Toggle Recap Format (STATS-03)**

- **D-12:** Render as an **inline row of parenthetical toggle:state pairs**, e.g. `(Fouls: Off) (Booking: Active) (Injury: Active) (Out-of-Bounds: Active) (Referee Leniency: Manual — 4) (Tackle/Steal Decline: On)` — not a table, not a bulleted list, not a settings-panel-style layout.
- **D-13:** The recap covers the 6 match-rule toggles from Phase 44's Advanced drawer: Fouls, Booking, Injury, Out-of-Bounds/Restarts, Referee Leniency (state + manual value when overridden), Tackle/Steal Decline. Game Speed and team/formation/uniform selections are **not** part of this recap.

### Claude's Discretion

- Exact GameState field shapes for the new whole-match counters (possession accumulator, pass/tackle/shot/foul/card counts per team) — mirror the `subsUsed`/sibling-counter pattern (`types.ts:1834`) already established in this codebase; needs a per-site instrumentation audit at planning time (which existing handlers/branches increment which counter). **Research finding below refines this: most counters do NOT need a per-site audit — see "Recommended Accumulator Architecture."**
- Exact visual/CSS treatment of the new (i) icon (size, icon glyph/asset, hover state) within the existing design-token system — resolved by 45-UI-SPEC.md (16px neutral circle, `i` glyph, no asset).
- Popup modal chrome (open/close mechanics, backdrop, dismiss button) — follow existing modal patterns already used elsewhere in the app (e.g. the substitution modal from Phase 42) rather than inventing a new modal pattern.
- Whether the popup content live-updates while open or is a snapshot taken at open time — default to live-updating (the store already broadcasts full state snapshots on every action, so a live-bound popup is the natural default and requires no extra work over a static snapshot). **Confirmed feasible below — no new socket event needed.**
- Exact hex-membership check implementation for goal-box/penalty-box defender counts (D-04) — translate `PitchMarkings.tsx`'s existing pixel-space box boundaries into an axial hex-membership helper. **Research finding below: this already exists — no translation work needed, see `PITCH_REGIONS`/`isInRegion`.**

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope. (3 unrelated pending todos were reviewed and correctly NOT folded into this phase; they remain tagged to Phase 46.)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| STATS-01 | (i) icon on scoreboard opens match summary popup at any time | `GameBoard.tsx` scoreboard structure confirmed (lines 409-450); `.scoreboardCentreCell`/`.clockRow` CSS confirmed; existing `subOpen`-style modal-state pattern (line 338, 610-649) is the direct precedent |
| STATS-02 | Popup remains reachable at half-time/full-time alongside existing recap | HALF_TIME/FULL_TIME overlay structure read verbatim (lines 519-602); `MatchSummaryContent` insertion point identified precisely |
| STATS-03 | Settings/toggle recap incl. Referee Leniency | All 5 existing toggle fields located in `types.ts` (`foulsEnabled`, `bookingEnabled`, `injuryEnabled`, `outOfBoundsEnabled`, `tackleStealDeclineEnabled`); Referee Leniency override flag is **NOT** currently on `GameState` — new field required (see Pitfalls) |
| STATS-04 | Possession % of elapsed minutes, per team | `actionCount`/`GAME_SPEED_MINUTES` clock mechanism read; recommended single-hook accumulator architecture documented below |
| STATS-05 | Total completed passes per team | All pass `ActionEvent` types enumerated (`STANDARD_PASS`, `FIRST_TIME_PASS`, `HIGH_PASS`, `LONG_BALL`, `HEADED_PASS`); exact "completed" definition flagged as an assumption needing confirmation |
| STATS-06 | Successful tackles+steals per team + success % | `TACKLE_ATTEMPT`/`STEAL_ATTEMPT`/`TACKLE_STEAL_DECLINED` event shapes read verbatim at both construction sites (`applyMove` inline, `applyTackleStealChoice`) |
| STATS-07 | Total shots per team | Recommended to share the exact same instrumentation footprint as xG (1 shot = 1 xG-logging site) |
| STATS-08 | Accumulated xG per team, exact formula | Full shot-resolution code path traced (SHOT case, snapshot deflection, headed-shot routing, GK-dive-at-feet, penalty); `PITCH_REGIONS`/`isInRegion` already provides D-04's hex-membership requirement |
| STATS-09 | Fouls, yellow cards, red cards per team | `FOUL_CALLED`/`BOOKING_CHECK` event shapes read (`types.ts:708-744`); single shared `resolveFoulChain` helper already centralizes foul/booking dice logic |
</phase_requirements>

## Summary

This phase adds a read-only, live-updating stats modal to an existing, mature, server-authoritative Socket.io game. Two categories of work are structurally very different and must be planned separately:

1. **Simple boilerplate** (icon, modal chrome, `MatchSummaryContent` component, HALF_TIME/FULL_TIME insertion): straightforward — every needed precedent (substitution modal, overlay CSS, full-state broadcast, whole-match-counter field pattern) already exists in the codebase and was read directly during this research.
2. **Stat accumulation** (possession/passes/tackles/shots/xG/fouls/cards): the codebase's shot-resolution logic is **not centralized** — `SHOT_ATTEMPT` events, for example, are constructed inline at 4+ separate literal-object-construction sites split across `gameEngine.ts` and `gameHandlers.ts` (not one shared function), and a scoring shot **replaces `state.pieces` with a freshly-reset kickoff formation in the same return statement that builds the event** — meaning any xG capture that reads `state.pieces` after the fact (e.g., from a later broadcast hook) will read the WRONG (post-reset) defender positions for a goal-scoring shot. xG must be computed **inline, at each resolution site, before the pieces-reset overwrite**, using data already in scope in each function.

For the five other whole-match counters (passes, tackle/steal, shots, fouls, cards), the research below recommends a materially different, lower-risk architecture than the "per-site instrumentation audit" contemplated in CONTEXT.md's discretion note: these can be computed **once, centrally**, inside the existing `broadcastState()` function (`packages/server/src/roomStore.ts:436`) by diffing newly-appended `eventLog` entries against the previous broadcast, rather than duplicating increment logic at 10+ scattered call sites. `broadcastState` already runs after **every** state-mutating handler and already tracks one piece of pre/post broadcast diff state (`room.lastBroadcastBallPosition`) — extending that same pattern to `lastBroadcastEventLogLength` (or similar) is a single, well-tested choke point instead of an error-prone multi-site audit. Possession-minutes (time-delta based) fits the same choke point using `actionCount` diffing.

**Primary recommendation:** Use a hybrid architecture — (a) xG computed **inline** at each of the ~7 shot-resolution construction sites, stashed as a new field on the resolving event, using the already-existing `PITCH_REGIONS`/`isInRegion` hex-membership helpers for D/C; (b) all other whole-match counters (passes, tackle/steal, shots, fouls, cards, possession) computed via a **single new-event-diff reducer inside `broadcastState()`** that folds newly appended `ActionEvent`s (plus the `xg` field stashed by (a)) into new `GameState` counter fields, mirroring `subsUsed`'s shape and never-reset-at-half-time contract.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| xG computation (per-shot formula) | API / Backend (`gameEngine.ts`) | — | Requires authoritative `state.pieces` positions at the exact moment of each shot-resolution branch, before any post-goal pieces reset; must never be computed client-side (server-authoritative project convention) |
| Whole-match counter accumulation (possession, passes, tackles, shots, fouls, cards) | API / Backend (`roomStore.ts` broadcast choke point) | — | Same reasoning as `subsUsed` (Phase 40): counters are part of `GameState`, broadcast in the existing full-snapshot pattern, never derived by the client |
| Settings/toggle recap rendering | Browser / Client (`MatchSummaryContent`) | — | Pure read of already-broadcast `GameState` boolean fields; no new server logic beyond the one new `refereeLeniencyOverrideEnabled` field (see Pitfalls) |
| (i) icon + modal open/close | Browser / Client (`GameBoard.tsx`) | — | Pure UI state (`useState`), mirrors existing `subOpen` pattern; no server round-trip needed to open/close |
| Stat-bar rendering (diverging bars, pills, xG accordion) | Browser / Client (`MatchSummaryContent` + CSS Modules) | — | Presentation only, per 45-UI-SPEC.md; consumes already-broadcast counters, no client-side computation of any stat value |
| Hex-membership for goal-box/penalty-box (D/C inputs) | API / Backend (`packages/shared/src/pitch.ts`) | Browser (already used for visual rendering in `PitchMarkings.tsx`) | Already implemented, shared package, consumed by both tiers today — no new module needed |

## Standard Stack

This phase introduces **no new npm packages**. Per 45-UI-SPEC.md: no icon library, no tooltip/portal library (accordion-style inline reveal used instead), no charting library (hand-rolled diverging-bar CSS). All work uses the existing stack already pinned in this repo:

### Core (existing, no changes)
| Library | Version (installed) | Purpose |
|---------|---------|---------|
| React | ^18.3.1 (client) | Modal/component rendering |
| Zustand | ^4.5.7 (client) | Reads already-broadcast `GameState` into the popup — no new store slice logic needed beyond a `matchSummaryOpen` boolean |
| Socket.io | 4.8.3 (server) | No new event type — popup consumes the existing `ServerEvents.GAME_STATE` full-snapshot broadcast |
| TypeScript | project-pinned | Shared `ActionEvent`/`GameState` types extended with new fields |

**Installation:** None required — this phase adds fields/components to existing packages only.

**Version verification:** Not applicable — no new dependency declarations. `[VERIFIED: packages/*/package.json read directly]`

## Package Legitimacy Audit

Not applicable — this phase installs zero external packages. `packages/shared` has no dependencies at all (`node -e "require('./packages/shared/package.json').dependencies"` → `{}`); client/server dependency sets are unchanged by this phase's scope per 45-UI-SPEC.md's explicit "no new dependency" statements in the Design System table.

**Packages removed due to [SLOP] verdict:** none (n/a — no packages proposed)
**Packages flagged as suspicious [SUS]:** none (n/a)

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│ SERVER (packages/server) — authoritative                             │
│                                                                        │
│  gameEngine.ts (applyRoll / applyMove / applyTackleStealChoice /     │
│                 applyGkDiveAtFeetTarget / applyPenaltyKickDuel /      │
│                 applyResolveHeaderTarget)                            │
│    │                                                                  │
│    │  at EACH shot-resolution branch (7 sites):                     │
│    │    - read shooter/defender positions still in scope            │
│    │    - isInRegion(pos, 'home/awaySixYardBox') → D                │
│    │    - isInRegion(pos, 'home/awayPenaltyArea') minus box → C     │
│    │    - X = |shotHex.q - goalQ|, Y = shotHex.r                    │
│    │    - compute xg via D-01 formula                                │
│    │    - stash xg on the resolving ActionEvent (new field)         │
│    ▼                                                                  │
│  eventLog: [...existing, <event with xg?: number>]                  │
│    │                                                                  │
│    ▼                                                                  │
│  gameHandlers.ts (~40 GAME_* handlers) → sets room.gameState = ...  │
│    │                                                                  │
│    ▼                                                                  │
│  roomStore.ts: broadcastState(io, room)  ◄── SINGLE CHOKE POINT     │
│    │  NEW: diff eventLog[lastBroadcastLen..] against previous len   │
│    │  NEW: fold matching event types into matchStats counters        │
│    │       (passes, tackle/steal +success, shots, fouls, cards)     │
│    │  NEW: diff actionCount delta, attribute to PRE-action           │
│    │       attackingTeam → possessionMinutes                        │
│    │  (existing) diff ball position → box-entry offer check          │
│    ▼                                                                  │
│  io.to(roomCode).emit(ServerEvents.GAME_STATE, room.gameState)      │
│         (full snapshot — includes new matchStats fields)             │
└─────────────────────────────┬──────────────────────────────────────┘
                               │ Socket.io (existing, no new event)
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│ CLIENT (packages/client) — read-only presentation                    │
│                                                                        │
│  useGameStore (Zustand) ── already holds latest GameState            │
│    │                                                                  │
│    ▼                                                                  │
│  GameBoard.tsx                                                       │
│    ├─ .scoreboardCentreCell → NEW (i) icon row → matchSummaryOpen    │
│    ├─ HALF_TIME overlay → NEW: <MatchSummaryContent /> appended       │
│    ├─ FULL_TIME overlay → NEW: <MatchSummaryContent /> appended       │
│    └─ matchSummaryOpen && <MatchSummaryModal><MatchSummaryContent/>  │
│                                                                        │
│  MatchSummaryContent.tsx (NEW, shared, 2 consumers per D-11)         │
│    reads state.matchStats, state.foulsEnabled, etc. — renders only,  │
│    computes NOTHING (all math already done server-side)              │
└─────────────────────────────────────────────────────────────────────┘
```

### Recommended Project Structure

```
packages/shared/src/
├── pitch.ts                    # EXISTING — PITCH_REGIONS/isInRegion, reused verbatim for D/C
├── matchStats.ts               # NEW — pure xG formula fn + shared MatchStats type
└── types.ts                    # EXTEND — GameState.matchStats field, new ActionEvent xg? field(s)

packages/server/src/
├── gameEngine.ts                # EXTEND — inline xG capture at ~7 shot-resolution sites
├── gameHandlers.ts              # EXTEND — 2 duplicate GK-out-of-range SHOT_ATTEMPT sites, 2 DEFLECT_ATTEMPT sites
└── roomStore.ts                 # EXTEND — broadcastState() gains the new-event-diff reducer

packages/client/src/components/
├── GameBoard.tsx                 # EXTEND — (i) icon row, modal state, HALF_TIME/FULL_TIME insertion
├── MatchSummaryModal.tsx         # NEW — standalone on-demand modal chrome (backdrop/card/close)
├── MatchSummaryContent.tsx       # NEW — shared stats block (D-11), consumed by 2 call sites
├── MatchSummaryContent.module.css
└── MatchSummaryModal.module.css
```

### Pattern 1: Inline xG capture at shot-resolution time (not deferred)

**What:** Compute the D-01 xG formula synchronously, at the exact point each shot-resolution branch builds its terminal event, using local variables already in scope (shooter, gk, defending team, `state.pieces` before any reset).

**When to use:** Every one of the ~7 shot-resolution construction sites enumerated in Pitfalls below.

**Example (standard/headed shot — inside `case 'SHOT'` in `applyRoll`, gameEngine.ts ~5043):**
```typescript
// Source: derived from packages/shared/src/pitch.ts (isInRegion, PITCH_REGIONS) — VERIFIED read
import { isInRegion } from '@counter-attack/shared';

function computeShotXg(
  shotHex: HexCoord,
  attackingTeam: 'home' | 'away',
  defendingPieces: readonly PlayerPiece[],
): number {
  const goalQ = attackingTeam === 'home' ? 36 : 0;
  const sixYardBox = attackingTeam === 'home' ? 'awaySixYardBox' : 'homeSixYardBox';
  const penaltyArea = attackingTeam === 'home' ? 'awayPenaltyArea' : 'homePenaltyArea';

  const D = defendingPieces.filter((p) => isInRegion(p.position, sixYardBox)).length;
  const C = defendingPieces.filter(
    (p) => isInRegion(p.position, penaltyArea) && !isInRegion(p.position, sixYardBox),
  ).length;
  const X = Math.abs(shotHex.q - goalQ);
  const Y = shotHex.r;
  const absYOffset = Math.abs(Y - 13);

  return (
    1 *
    (1 - D * 0.13) *
    (1 - C * 0.1) *
    (1 - (absYOffset > 3 ? absYOffset * 0.07 : absYOffset * 0.04)) *
    (1 - (X > 3 ? X * 0.07 : X * 0.04))
  );
}
```

Call this ONCE near the top of `case 'SHOT'` (before any GOAL branch resets `pieces`), using `shooter.position` as `shotHex` and `state.pieces.filter(isActivePiece)` restricted to the defending team, then attach the resulting number to whichever terminal event is built (GOAL/SAVE/LOOSE_BALL — all 3 sub-branches share the same shot geometry).

### Pattern 2: Centralized new-event-diff reducer for simple counters (NOT xG)

**What:** A single function, called from `broadcastState()`, that receives `(previousEventLogLength, newState)` and returns incremented `matchStats` counters by inspecting only the newly-appended `eventLog` slice.

**When to use:** Passes, tackle/steal attempts+successes, shot counts (increment alongside xG), fouls, yellow/red cards. NOT for xG itself (must be inline per Pattern 1 — the pieces-reset gotcha in Pitfalls makes a deferred/diff-based read of `state.pieces` unsafe for goal-scoring shots specifically, but eventLog *events themselves* are immutable once appended, so diffing eventLog for simple boolean/count facts is always safe).

**Example (sketch, mirrors the existing `room.lastBroadcastBallPosition` pattern at roomStore.ts:441):**
```typescript
// Source: pattern derived from packages/server/src/roomStore.ts:436-441 (VERIFIED read)
export function broadcastState(io: Server, room: Room): void {
  if (room.gameState === null) return;
  room.gameState = applyFreeMoveZoneCheck(room.gameState);

  const prevLen = room.lastBroadcastEventLogLength ?? 0;
  const newEvents = room.gameState.eventLog.slice(prevLen);
  if (newEvents.length > 0) {
    room.gameState = foldMatchStats(room.gameState, newEvents); // NEW — pure reducer
  }
  room.lastBroadcastEventLogLength = room.gameState.eventLog.length;

  // ...existing box-entry / offside broadcast logic unchanged...
  io.to(room.roomCode).emit(ServerEvents.GAME_STATE, room.gameState);
}
```

### Anti-Patterns to Avoid

- **Deferring xG computation to the broadcast choke point:** `state.pieces` is overwritten with a fresh kickoff formation in the SAME return statement that builds a goal-scoring `SHOT_ATTEMPT`/`PENALTY_KICK` event (see Pitfalls). By the time `broadcastState` runs, defender positions for a scoring shot are gone. xG MUST be computed inline, not diffed later.
- **Scanning full `eventLog` on every popup open:** explicitly forbidden by D-05. Counters must be pre-computed running totals on `GameState`, not derived retroactively client-side or even server-side-on-read.
- **Treating "declined" tackle/steal as an attempt:** `TACKLE_STEAL_DECLINED` is a distinct `ActionEvent` type (`types.ts:786`) — never fold it into the attempt denominator (D-07).
- **Assuming a single shared "shot resolution" function exists:** it does not. `SHOT_ATTEMPT` is constructed inline at 4+ separate literal sites (see Pitfalls) — grep for `type: 'SHOT_ATTEMPT'` and `type: 'PENALTY_KICK'` etc. during planning to get the exhaustive, current list rather than trusting a remembered count.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Goal-box / penalty-box hex membership (D/C inputs) | A new pixel-to-hex translation of `PitchMarkings.tsx`'s SVG rectangles | `PITCH_REGIONS.homeSixYardBox` / `awaySixYardBox` / `homePenaltyArea` / `awayPenaltyArea` + `isInRegion(hex, region)` — `packages/shared/src/pitch.ts:47-93,208-209` `[VERIFIED: direct read]` | Already implemented, already used server-side for the existing "outside penalty area shooting penalty" and snapshot-eligibility checks (`gameEngine.ts` uses `isInRegion(shooter.position, opponentPenaltyArea)` today) — exact axial bounds already tuned to match the visual rendering |
| Excluding red-carded/benched pieces from any stat count | A new ad hoc `.filter(p => !p.redCarded)` at each new call site | `isActivePiece(piece)` — `packages/shared/src/stoppagePhases.ts:107` `[VERIFIED: direct read]` | Already the shared helper introduced in Phase 42 (BUG-38) specifically to prevent this exact class of duplicated-filter bug; reuse it for defender counts, pass/tackle attribution, everywhere a "live piece" check is needed |
| Whole-match, never-reset-at-half-time counters | A bespoke reset-policy design | Mirror `subsUsed?: { home: number; away: number }` shape exactly — `types.ts:1834` `[VERIFIED: direct read]` | Established, tested pattern; every read site already knows the `?? 0` default convention |
| Determining who to attribute a tackle/steal to | Deriving team from the event alone | `state.pieces.find(p => p.id === event.defenderId)?.teamId` | `STEAL_ATTEMPT`/`TACKLE_ATTEMPT` events carry `defenderId` but NOT `teamId` directly (`types.ts:288-307`) — team must be resolved via a piece lookup, same as the existing ActionLog code already does for narration |

**Key insight:** This phase's biggest risk is not "what to build" (all UI/chrome patterns already exist) but "where exactly to hook into" a large, organically-grown dice-resolution engine that duplicates event construction across multiple files rather than centralizing it. Research time here was spent finding and enumerating those exact hook points so planning doesn't have to re-discover them mid-implementation.

## Common Pitfalls

### Pitfall 1: `SHOT_ATTEMPT` is constructed at 4+ separate literal sites, not one function

**What goes wrong:** A planner or implementer instruments only `applyRoll`'s `case 'SHOT':` block (gameEngine.ts ~5043-5372) and misses that TWO more `SHOT_ATTEMPT`-constructing branches exist **outside** that switch, directly in `gameHandlers.ts`, for the "GK cannot reach any point on the shot path" auto-goal case — one for a regularly-declared shot (`gameHandlers.ts` ~2482-2498) and a near-identical duplicate for a snapshot (`gameHandlers.ts` ~1399-1415). Both bypass `applyRoll` entirely and build the event inline at declare-time, before any dice roll.
**Why it happens:** The codebase resolves "GK physically cannot reach the shot path" (checked at shot-declare time, in the handler) and "GK dived but too far to be saveable" (checked at dice-roll time, in `applyRoll`'s `case 'SHOT'`) as two structurally different checks that happen to produce the same event type from different files.
**How to avoid:** During planning, grep the current codebase for `type: 'SHOT_ATTEMPT'`, `type: 'PENALTY_KICK'`, `type: 'GK_DIVE_AT_FEET'`, and `type: 'DEFLECT_ATTEMPT'` and treat that literal grep result as the authoritative site list — not the 5-category conceptual list from CONTEXT.md (which is correct at the *feature* level but underspecifies the *code* level, where "standard shot" alone has 3 sub-sites: unsaveable-auto-goal in `applyRoll`, duel-resolved GOAL/SAVE/LOOSE_BALL in `applyRoll`, and out-of-range-at-declare in `gameHandlers.ts`).
**Warning signs:** A shot that scores via the "GK out of range at declare time" path (a fairly common outcome — happens whenever no path hex is within 3 of the GK) shows 0 xG contribution if only the `applyRoll` case is instrumented.

### Pitfall 2: `state.pieces` is overwritten with a fresh kickoff formation in the SAME return statement as a goal-scoring event

**What goes wrong:** Every GOAL-outcome branch (`applyRoll`'s SHOT case, `applyPenaltyKickDuel`, the two `gameHandlers.ts` out-of-range branches) computes `resetPieces = applyRosterContinuity(buildKickOffPieces(...), state.pieces)` and returns `{ ...state, pieces: resetPieces, ... }` in the exact same object as the `SHOT_ATTEMPT`/`GOAL`/`PENALTY_KICK` events. If xG computation is deferred to any point after this return (e.g., a `broadcastState`-level diff reducer reading `room.gameState.pieces`), the defender positions used for `D`/`C` will be the FRESH KICKOFF FORMATION, not the positions at the moment of the shot — silently producing wrong xG for every goal.
**Why it happens:** Kickoff-formation reset and event-log append are performed together for good reason (BUG-30's replay-reconstruction fix), but it means "pieces at shot time" is only available in local variables inside the resolving function, never in the state that gets broadcast.
**How to avoid:** Compute xG synchronously inside each resolving function, using the pre-reset local `state.pieces`/`shooter`/`gk` variables, and stash the numeric result directly on the event object (or a sibling field) before it's ever appended to `eventLog`. Never write an xG reducer that reads `GameState.pieces` after the fact.
**Warning signs:** xG per team stops increasing specifically on goals (but increases fine on saves/misses) — a strong signal this exact bug is present.

### Pitfall 3: Referee Leniency's "was it manually overridden" flag is NOT currently on `GameState`

**What goes wrong:** `refereeLeniencyOverrideEnabled`/`refereeLeniencyValue` (Phase 44) live only on the server's in-memory `Room` object (`roomHandlers.ts` lines 428-630) and are consumed ONLY as parameters to `buildInitialGameState` to seed `refereeCard.leniency` — they are never copied onto `GameState` itself. `[VERIFIED: grep of gameEngine.ts/roomHandlers.ts, no occurrence in types.ts]` The settings recap (D-12) needs to render `(Referee Leniency: Manual — 4)` vs `(Referee Leniency: Auto — 4)`, which is impossible from `refereeCard.leniency` alone (it's just a number 2-5 regardless of source).
**Why it happens:** Phase 44 only needed the override to compute the *value*; it never needed to remember, mid-match, whether that value came from a manual toggle or a random roll.
**How to avoid:** Add a new whole-match, never-reset field to `GameState` (e.g. `refereeLeniencyWasManual: boolean`, or fold it into `refereeCard` itself as `refereeCard.wasManualOverride: boolean`), set once at `buildInitialGameState` time from the `refereeLeniencyOverrideEnabled` parameter already being passed in (`gameEngine.ts:423`), and never mutated again.
**Warning signs:** Settings recap always shows "Auto" even when the host explicitly set a manual value, or the field is missing entirely and the recap can't render this row.

### Pitfall 4: `actionCount` (the clock driver) increments at 15+ independent call sites — possession cannot be computed the same way

**What goes wrong:** Unlike a single "advance the clock" function, `state.actionCount + GAME_SPEED_MINUTES[state.gameSpeed]` (or a smaller `passTimeCost`) is computed inline at 15+ separate return sites across `gameEngine.ts` (tackle/steal success, pass resolution ×4 pass types, movement end-turn, etc.). `[VERIFIED: grep count]` A naive per-site possession-instrumentation approach (incrementing a possession counter next to every `actionCount` increment) would require touching the same 15+ sites and is exactly the failure mode CONTEXT.md's discretion note anticipated.
**Why it happens:** Same organic-growth pattern as Pitfall 1 — each action type's time cost was added independently over ~40 phases of development.
**How to avoid:** Do NOT instrument every `actionCount` site. Instead, compute the possession delta ONCE per broadcast, inside `broadcastState()`, as `newState.actionCount - previousActionCount`, attributed to the **pre-action** `attackingTeam` (see Pitfall 5) — this needs exactly one new piece of `Room`-level tracking state (`room.lastBroadcastActionCount`), mirroring the existing `room.lastBroadcastBallPosition` field already at `roomStore.ts:441`.
**Warning signs:** A possession-instrumentation PR touches 10+ files in `gameEngine.ts` — that's the signal the wrong architecture was chosen.

### Pitfall 5: Possession-minute attribution timing — pre-action team, not post-action team

**What goes wrong:** A single state update can both (a) advance `actionCount` AND (b) change `attackingTeam` in the same return object — e.g., a successful tackle/steal both consumes elapsed time (`stealNewActionCount`) and flips `attackingTeam` to the winning defender's team, in the exact same returned state (`gameEngine.ts` ~1675-1690). If a possession reducer naively reads `newState.attackingTeam` to decide who to credit, it will credit the team that just WON the ball for the minutes that elapsed while the OTHER team still had it.
**Why it happens:** The elapsed-time delta represents "how long team X was attacking before this action resolved," but the resolved state already reflects the NEW possessor.
**How to avoid:** Attribute the possession-minute delta to the `attackingTeam` value from the **previous** broadcast state (before this action's mutation), not the new one.
**Warning signs:** Possession percentages look inverted around goals/turnovers specifically (correct in steady open play, wrong at exactly the moments possession changes).

### Pitfall 6: "Completed pass" has no single canonical definition in the existing event model

**What goes wrong:** Pass-family `ActionEvent`s include `STANDARD_PASS`/`FIRST_TIME_PASS`/`HIGH_PASS`/`LONG_BALL` (all carry `accurate: boolean`), plus `HEADED_PASS` (no `accurate` field — instead branches on whether an occupant exists at the target hex), plus goalkeeper distribution (`GK_KICK`, `GK_PUNT`) and dead-ball deliveries (`THROW_IN_PLACE`, `GOAL_KICK`, `CORNER_KICK_ACCURACY`). REQUIREMENTS.md's STATS-05 just says "total completed passes" with no further definition, and CONTEXT.md does not resolve which of these event types count.
**Why it happens:** Not a code bug — a genuine scope-definition gap left open by the discussion.
**How to avoid:** Flagged in Assumptions Log below. Recommended default: count `STANDARD_PASS`/`FIRST_TIME_PASS`/`HIGH_PASS`/`LONG_BALL` events with `accurate === true`, plus `HEADED_PASS` when it lands on a teammate — exclude goalkeeper distribution and dead-ball restarts (throw-in/goal-kick/corner) since those are not "passes" in the sense most soccer-stats UIs mean, and Counter Attack's own rulebook treats them as distinct restart mechanics. Confirm with the user during planning or discuss-phase if precision matters.
**Warning signs:** Pass counts look implausibly high (goalkeeper distribution and restarts included) or implausibly low (only STANDARD_PASS counted, headed layoffs excluded).

### Pitfall 7: "GK-dive-at-feet penalty" as an xG-eligible branch is ambiguous in the current code model

**What goes wrong:** `GK_DIVE_AT_FEET` (`applyGkDiveAtFeetTarget`, gameEngine.ts ~2213-2360) is a **dispossession duel** (GK vs. ball carrier), not a shot at goal — on GK "FAIL" the carrier simply keeps the ball and play continues; there is no automatic goal or shot event fired from this function. CONTEXT.md D-03 lists "GK-dive-at-feet penalty" as one of the 5 xG-eligible branches, but the current code has no "GK dive at feet → automatic shot/goal" path to hang an xG capture on.
**Why it happens:** Most likely reading: "penalty" here refers to a **penalty kick awarded because the GK's dive-at-feet attempt fouled the carrier** (`GKDIVE-03`: a GK die of 1 always calls a foul via `resolveFoulChain`, which can route to `FOUL_CHOICE` → `PENALTY_KICK` if the foul was in the box) — i.e., this is NOT a 6th xG-capture code path distinct from "penalty," but rather confirmation that penalties **awarded via this specific foul source** must also flow through the existing single `applyPenaltyKickDuel` hook (which they already do, since `applyPenaltyKickDuel` doesn't care what awarded the penalty).
**How to avoid:** Do not build a 6th, GK-dive-at-feet-specific xG capture site. Confirm with the user/planner that "penalty" and "GK-dive-at-feet penalty" in D-03 collapse to the SAME single `applyPenaltyKickDuel` instrumentation point (this is the most structurally consistent reading and requires zero extra code paths). Flagged as an open question below for explicit confirmation before implementation.
**Warning signs:** An implementer builds a redundant xG-capture branch inside `applyGkDiveAtFeetTarget` that never fires (because a GK-dive-at-feet FAIL never itself produces a goal in the current rules).

## Code Examples

### Existing hex-membership helper (reuse verbatim — D-04 discretion item resolved)
```typescript
// Source: packages/shared/src/pitch.ts:47-93,208-209 (VERIFIED direct read)
export type PitchRegions = {
  homeThird: ReadonlySet<string>;
  awayThird: ReadonlySet<string>;
  homePenaltyArea: ReadonlySet<string>;
  awayPenaltyArea: ReadonlySet<string>;
  homeSixYardBox: ReadonlySet<string>;
  awaySixYardBox: ReadonlySet<string>;
  // ...
};
// homeSixYardBox:   q ∈ [0, 1],   r ∈ [8, 17]
// awaySixYardBox:   q ∈ [35, 36], r ∈ [8, 17]
// homePenaltyArea:  q ∈ [0, 5],   r ∈ [5, 19]
// awayPenaltyArea:  q ∈ [31, 36], r ∈ [5, 19]
export function isInRegion(hex: HexCoord, region: keyof Omit<PitchRegions, 'kickOffHex'>): boolean {
  return PITCH_REGIONS[region].has(hexKey(hex));
}
```

### Existing STEAL_ATTEMPT/TACKLE_ATTEMPT event shapes (for STATS-06 team attribution)
```typescript
// Source: packages/shared/src/types.ts:288-307 (VERIFIED direct read)
| {
    type: 'STEAL_ATTEMPT';
    defenderId: string;      // team must be resolved via pieces.find(p => p.id === defenderId).teamId
    result: 'SUCCESS' | 'FAIL';
    // ...
  }
| {
    type: 'TACKLE_ATTEMPT';
    defenderId: string;
    carrierId: string;
    result: 'SUCCESS' | 'FAIL';
    // ...
  }
```

### Existing whole-match counter precedent (mirror this shape exactly)
```typescript
// Source: packages/shared/src/types.ts:1834 (VERIFIED direct read)
subsUsed?: { home: number; away: number };
// Every read site: state.subsUsed?.[team] ?? 0
// NEVER reset at half-time (contrast with addedTimeBonus, which IS reset per-half)
```

## State of the Art

Not applicable in the traditional external-library sense (no new dependencies). Internally, this phase is the first to introduce a **cross-cutting stat-accumulation concern** that spans nearly every existing action handler — the codebase's established pattern for this kind of thing (per Phase 40's `subsUsed`) is single-field-add-with-inline-increment-at-each-site, which this research recommends **diverging from** for the 5 non-xG counters (centralized diff-reducer instead) due to the sheer number of scattered call sites this phase's stats touch, compared to `subsUsed`'s single call site (`applySubstitution`).

**Deprecated/outdated:** N/A.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | "Completed passes" (STATS-05) = `STANDARD_PASS`/`FIRST_TIME_PASS`/`HIGH_PASS`/`LONG_BALL` events with `accurate === true`, plus `HEADED_PASS` landing on a teammate; goalkeeper distribution (`GK_KICK`/`GK_PUNT`) and dead-ball restarts (throw-in/goal-kick/corner) excluded | Pitfall 6, Phase Requirements | Pass counts could look wrong to the user if they expected restarts/GK distribution included; low functional risk (display-only stat), easy to adjust the event-type filter list later |
| A2 | "GK-dive-at-feet penalty" (D-03) is NOT a 6th distinct xG-capture code path, but rather confirmation that fouls-in-box awarded via the GK-dive-at-feet source still flow through the single existing `applyPenaltyKickDuel` hook | Pitfall 7 | If wrong, a genuinely distinct xG-worthy moment (the carrier's one-on-one chance itself, independent of any subsequent penalty) would be missed from xG totals — low-to-medium risk, worth explicit confirmation before implementation since it affects task count |
| A3 | Possession-minute attribution should use the PRE-action `attackingTeam`, not the post-action one, for the delta computed at each broadcast | Pitfall 5 | If implemented with post-action attribution instead, possession % would be silently wrong specifically around every turnover (tackle/steal success, interception) — moderate risk since this is subtle and easy to get backwards without the explicit warning |
| A4 | New `refereeLeniencyWasManual`-style field should be added to `GameState` at `buildInitialGameState` time, never mutated after kickoff | Pitfall 3 | If instead derived by comparing `refereeCard.leniency` against remembered client-side "was it 2-5 random" logic, there's no reliable way to distinguish manual-4 from random-4 — must be a genuine new server field |
| A5 | "Total shots" (STATS-07) shares the exact same event-set as xG-logged events (1 shot = 1 xG data point, even when xG is very small) | Phase Requirements, Pattern 1 | If the user intends "shots" to include only on-target attempts (excluding e.g. deflected-before-reaching-goal snapshots), the two counters would need separate instrumentation — currently assumed identical for simplicity |

**If this table is empty:** N/A — see rows above; all 5 need lightweight confirmation but none block starting implementation (each has a documented, reasonable default).

## Open Questions

1. **Does "GK-dive-at-feet penalty" in D-03 mean a distinct xG-capture site, or is it satisfied by the single existing `applyPenaltyKickDuel` hook?**
   - What we know: `applyGkDiveAtFeetTarget` never itself produces a goal/shot event; a GK-dive-at-feet-sourced foul CAN route to a penalty via the existing shared `resolveFoulChain` → `FOUL_CHOICE` → `applyPenaltyKickDuel` path, same as any other in-box foul.
   - What's unclear: whether the user intends this phrase as "make sure penalties from this specific source are covered" (already true, zero new work) or "the one-on-one chance itself deserves its own xG value regardless of whether a foul/penalty results" (would require new instrumentation inside `applyGkDiveAtFeetTarget`).
   - Recommendation: confirm with the user during plan-check or discuss-phase; default to "no new code path" (Assumption A2) since it's the structurally consistent reading and avoids inventing an ungrounded formula input for a non-shot event.

2. **What exactly counts as a "completed pass" for STATS-05?**
   - What we know: 4 distinct pass `ActionEvent` types carry `accurate: boolean`; `HEADED_PASS` does not; GK distribution and dead-ball restarts are separate event families entirely.
   - What's unclear: whether the user wants a strict "open-play pass" count or a broader "any ball delivered to a teammate" count.
   - Recommendation: default to Assumption A1's definition (documented above); this is a low-risk, easily-adjustable filter list, not worth blocking planning on.

3. **Should `MatchSummaryContent`'s reusable stats-computation live in `packages/shared` or purely as `GameState` fields the client just renders?**
   - What we know: 45-UI-SPEC.md's diverging-bar math (`home_share = home / (home + away)`) is pure display arithmetic that can live client-side safely (no game-authority concern — it's a ratio of two already-authoritative numbers).
   - What's unclear: whether any derived display value (e.g. tackle/steal success %) should be pre-computed server-side (stored as a `GameState` field) or computed client-side from the raw `attempts`/`successes` counts already broadcast.
   - Recommendation: broadcast only raw counts (attempts, successes) from the server, matching the `subsUsed` precedent of storing minimal source-of-truth counters; compute percentages/ratios client-side in `MatchSummaryContent` — this avoids adding derived (redundant) fields to `GameState` and keeps the server's new surface area small.

## Environment Availability

Skipped — this phase has no external dependencies beyond the already-running Node.js/Socket.io/React dev stack already verified functional by 44 prior completed phases in this repo.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (all 3 packages: `shared`, `server`, `client`) `[VERIFIED: vitest.config.ts present in all 3 package dirs]` |
| Config file | `packages/server/vitest.config.ts`, `packages/client/vitest.config.ts`, `packages/shared/vitest.config.ts` |
| Quick run command | `pnpm --filter @counter-attack/server test -- gameEngine.matchStats` (or equivalent new test file name) |
| Full suite command | `pnpm --filter @counter-attack/server test` / `pnpm --filter @counter-attack/client test` / `pnpm --filter @counter-attack/shared test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| STATS-08 | xG formula computes correctly for known D/C/X/Y inputs | unit | `pnpm --filter @counter-attack/shared test -- matchStats` | ❌ Wave 0 — new `packages/shared/src/matchStats.ts` + test |
| STATS-08 | xG captured at each of the ~7 shot-resolution sites, using pre-reset piece positions on goals | unit | `pnpm --filter @counter-attack/server test -- gameEngine.matchStats` | ❌ Wave 0 — mirrors `gameEngine.refereeLeniency.test.ts` naming convention |
| STATS-04 | Possession delta attributed to pre-action attackingTeam, accumulates across half-time | unit | `pnpm --filter @counter-attack/server test -- roomStore.matchStats` (or `gameEngine.matchStats`) | ❌ Wave 0 |
| STATS-05/06/07/09 | Pass/tackle/steal/shot/foul/card counters increment on matching eventLog entries only | unit | `pnpm --filter @counter-attack/server test -- gameEngine.matchStats` | ❌ Wave 0 |
| STATS-06 | Declined tackle/steal excluded from attempt denominator | unit | same file, dedicated case | ❌ Wave 0 |
| STATS-01/02 | (i) icon opens modal in every phase incl. mid-duel interrupts; HALF_TIME/FULL_TIME shows same content | component/integration | `pnpm --filter @counter-attack/client test -- GameBoard.matchSummary` | ❌ Wave 0 — new `GameBoard.matchSummary.test.tsx` |
| STATS-03 | Settings recap renders all 6 toggles incl. Referee Leniency Manual/Auto distinction | component | `pnpm --filter @counter-attack/client test -- MatchSummaryContent` | ❌ Wave 0 — new `MatchSummaryContent.test.tsx` |

### Sampling Rate
- **Per task commit:** targeted `vitest run <new-test-file>` (quick run command above)
- **Per wave merge:** full suite per package: `pnpm --filter @counter-attack/shared test && pnpm --filter @counter-attack/server test && pnpm --filter @counter-attack/client test`
- **Phase gate:** Full suite green (all 3 packages) before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `packages/shared/src/matchStats.ts` + `matchStats.test.ts` — pure xG formula function, unit-testable in isolation from any GameState
- [ ] `packages/server/src/__tests__/gameEngine.matchStats.test.ts` — covers STATS-04..09 accumulation logic (mirrors `gameEngine.refereeLeniency.test.ts` naming)
- [ ] `packages/server/src/__tests__/matchStats.integration.test.ts` — full room round-trip, mirrors `refereeLeniency.integration.test.ts` naming
- [ ] `packages/client/src/components/GameBoard.matchSummary.test.tsx` — (i) icon + modal open/close across phases
- [ ] `packages/client/src/components/MatchSummaryContent.test.tsx` — settings recap + stat-row rendering

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Phase adds no new auth surface — reuses existing room/socket session |
| V3 Session Management | no | No session changes |
| V4 Access Control | yes (narrow) | The (i) icon/modal is read-only and available to both players symmetrically — no new access-control decision needed, but the new `matchStats` fields must be broadcast to BOTH sockets identically (the existing full-snapshot `GAME_STATE` broadcast already does this — no per-team filtering like `DraftClientView`'s privacy split is needed here since match stats are not secret) |
| V5 Input Validation | yes (narrow) | The only new client→server input surface is potentially zero (if popup open/close stays fully client-side, per Claude's Discretion) — if a future iteration adds any server round-trip, standard existing handler-validation patterns (`roomHandlers.ts`'s explicit `typeof`/range checks, e.g. `refereeLeniencyValue` validation at line 516-535) apply |
| V6 Cryptography | no | Not applicable |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Client trusting its own computed stats instead of server-broadcast values | Tampering | All stat VALUES (counts, xG) must originate server-side in `GameState`; client only computes pure display ratios (percentages) from server-provided raw counts — never recomputes xG or event counts itself, consistent with this project's server-authoritative convention (STATE.md "Decisions Locked") |
| Stale/partial `matchStats` on reconnect | Information disclosure (minor) / availability | Not a new risk — the existing full-snapshot broadcast-on-every-action pattern already ensures a reconnecting client gets current stats for free; no new reconnect-handling logic needed for this phase |

## Sources

### Primary (HIGH confidence — direct codebase reads this session)
- `D:\dev\repo\counter-attack-poc\packages\shared\src\types.ts` — `ActionEvent` union (lines 270-900), `GameState` shape (1222+), `subsUsed` (1834), toggle fields (1540-1710)
- `D:\dev\repo\counter-attack-poc\packages\shared\src\pitch.ts` — `PITCH_REGIONS`, `isInRegion`, `GOAL_R_VALUES`, `PENALTY_SPOT`
- `D:\dev\repo\counter-attack-poc\packages\shared\src\stoppagePhases.ts` — `isActivePiece` (line 107)
- `D:\dev\repo\counter-attack-poc\packages\server\src\gameEngine.ts` — `applyRoll` SHOT/PASS cases, `applyMove` STEAL/TACKLE inline resolution, `applyTackleStealChoice`, `applyGkDiveAtFeetTarget`, `applyPenaltyKickDuel`, `applyDeclareShot`, `applyGKDive`, `applyResolveHeaderTarget`, `applySnapshot`, `enterGkDiveOrSkip`, `applySubstitution` (`subsUsed` precedent), `buildInitialGameState` (referee leniency override params)
- `D:\dev\repo\counter-attack-poc\packages\server\src\gameHandlers.ts` — duplicate `SHOT_ATTEMPT`/`DEFLECT_ATTEMPT` construction sites for snapshot and regular-shot GK-out-of-range branches
- `D:\dev\repo\counter-attack-poc\packages\server\src\roomHandlers.ts` — `refereeLeniencyOverrideEnabled`/`refereeLeniencyValue` room-level (not GameState-level) storage
- `D:\dev\repo\counter-attack-poc\packages\server\src\roomStore.ts` — `broadcastState` (line 436), `GAME_STATE` emit (line 519), existing `lastBroadcastBallPosition` diff pattern
- `D:\dev\repo\counter-attack-poc\packages\client\src\components\GameBoard.tsx` — scoreboard/topBand structure (340-450), HALF_TIME/FULL_TIME overlays (519-602), substitution modal precedent (338, 610-649)
- `D:\dev\repo\counter-attack-poc\packages\client\src\components\PitchMarkings.tsx` — SVG pixel-space box boundaries (confirmed superseded by `pitch.ts`'s existing hex regions for this phase's purposes)
- `.planning/phases/45-game-summary-popup/45-CONTEXT.md`, `45-UI-SPEC.md`, `.planning/REQUIREMENTS.md`, `.planning/STATE.md` — phase scope, UI contract, requirement IDs, project decision history

### Secondary (MEDIUM confidence)
- None — all findings this session were direct, verified codebase reads; no external web/docs lookups were needed since this phase is 100% internal-codebase work with zero new dependencies.

### Tertiary (LOW confidence)
- None.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependencies, all versions read directly from `package.json` files
- Architecture: HIGH — every integration point (icon placement, modal chrome, HALF_TIME/FULL_TIME insertion, broadcast mechanism, hex-region helpers) verified by direct source read, with exact line numbers
- Stat-accumulation hook points: MEDIUM-HIGH — the multi-site `SHOT_ATTEMPT`/`DEFLECT_ATTEMPT` duplication and pieces-reset gotcha are VERIFIED facts; the recommended centralized-diff-reducer architecture is a well-grounded recommendation but not yet implemented/tested in this codebase, so treat as a strong proposal for the planner to validate against, not an existing pattern
- Pitfalls: HIGH — all 7 pitfalls are grounded in specific line-numbered code reads this session, not general domain knowledge
- Stat definitions (completed pass, GK-dive-at-feet penalty xG scope): MEDIUM — genuine scope gaps flagged as assumptions with recommended defaults, not blocking

**Research date:** 2026-08-28
**Valid until:** Effectively indefinite for the architectural findings (internal codebase facts, not external library docs) — but re-verify shot-resolution line numbers if any other phase touches `gameEngine.ts`/`gameHandlers.ts` shot logic before Phase 45 is planned/executed, since line numbers will drift with any intervening commit.
