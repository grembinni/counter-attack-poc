# Phase 43: Tackle/Steal Prompt & Decline - Research

**Researched:** 2026-08-23
**Domain:** Server-authoritative game-phase state machine extension (new interrupt-prompt phase) in an existing mature Socket.io/Express + React game engine
**Confidence:** HIGH — every claim below is grounded in a direct read of the current codebase (file:line citations included) during this research session, not generic advice or unverified milestone-level assumptions. Two findings materially correct or narrow the milestone-level PITFALLS.md/ARCHITECTURE.md guidance already in CONTEXT.md's canonical_refs — see "Corrections to Milestone-Level Research" below, read this before planning.

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** When a `STEAL_ATTEMPT`'s `defenders[]` array (`moveValidator.ts`) has 2+ eligible defenders in ZoI range on the same move step, the defending manager gets **sequential per-defender prompts**, not one combined prompt for the group — Attempt/Decline for defender A, then defender B, etc.
- **D-02:** The sequence is ordered **by tackling stat, highest first** — the defender most likely to succeed is prompted first.
- **D-03:** A **failed** attempt does NOT end the sequence — the next eligible defender in order still gets prompted. The sequence only ends when **possession changes** (a successful steal/tackle) or **a foul triggers a stoppage for a kick**. Multiple duels (multiple dice rolls) can stack on a single move step as long as the ball carrier keeps possession and play isn't otherwise halted. Declining still applies per-defender: a decline on defender A doesn't skip defender B's prompt, and does not consume defender A's later eligibility (TACKLE-03).
- **D-04:** A declined-but-still-eligible risk ring shares the **same visual treatment** as a never-yet-offered risk ring (existing amber `risk` ring). No distinct visual state for "already declined once" in this phase.
- **D-05:** Button labels, prompt copy, and the waiting-manager message for `TackleStealPromptPanel` are the planner's discretion — match `GkDiveAtFeetPromptPanel`/`FoulChoicePanel`'s two-button family tone and structure exactly.

### Claude's Discretion

- Exact `GameState` field shapes for the new prompt phase, sibling decline-exclusion fields (`stealDeclinedByIds`/`tackleDeclinedByIds` distinct from `stealAttemptedByIds`/`tackleAttemptedByIds`), and the resume-snapshot mechanics — per research's ARCHITECTURE.md recommendation, mirroring `GkDiveAtFeetPromptPanel`'s established `gkDiveAtFeetTeam`/`gkDiveAtFeetResume` pattern. **This phase's research (below, "Do We Actually Need stealDeclinedByIds/tackleDeclinedByIds?") found the ring-persistence goal these fields were proposed for is already satisfied by existing client recompute logic with zero new fields — read that section before deciding the field shape.**
- The new `ActionEventType` for declines (e.g. `TACKLE_STEAL_PROMPT_DECLINED`) and its Undo/Replay registration (per Pitfall #9: very likely NOT an Undo boundary, mirroring `GK_DIVE_AT_FEET_DECLINED`'s omission).
- Whether declines are visibly logged in ActionLog to both managers — established precedent (`GK_DIVE_AT_FEET_DECLINED`, `ActionLog.tsx:1157-1168`) should be followed for consistency.
- The full reset-policy table across the ~26 existing `stealAttemptedByIds`/`tackleAttemptedByIds` reset call sites (Pitfall #8) — needs a site-by-site decision at planning time. **This research provides that enumeration below.**

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope. The distinct declined-ring visual treatment was considered (research's nice-to-have) and explicitly declined for v1 (D-04), not deferred.
</user_constraints>

<phase_requirements>

## Phase Requirements

| ID        | Description                                                                                             | Research Support                                                                                                                                                                                                                                                                                                |
| --------- | ------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| TACKLE-01 | New game-creation toggle prompts the defender before a tackle/steal attempt, default on                 | Settings→Room→`buildInitialGameState` wiring confirmed identical to `outOfBoundsEnabled` (client default-on/server default-off split) — see "Toggle Wiring" section                                                                                                                                             |
| TACKLE-02 | When enabled, defending manager can decline without it counting as an attempt                           | Confirmed mechanism: decline must NOT append the defender id to `stealAttemptedByIds`/`tackleAttemptedByIds` — see "New GamePhase & Interception Point"                                                                                                                                                         |
| TACKLE-03 | Declined opportunity keeps its risk ring active until carrier moves out of range or movement phase ends | **Confirmed already free**: `HexGrid.tsx`'s `zoiRiskSet` and `useGameStore.ts`'s `tackleRiskHexes` recompute live from `validateMove`'s attempted-exclusion on every render — no new persistent field required for this specific requirement, see "Do We Actually Need stealDeclinedByIds/tackleDeclinedByIds?" |
| TACKLE-04 | Toggle off → duels resolve immediately, no decline prompt, exactly as today                             | Existing `applyMove` STEAL_ATTEMPT/TACKLE_ATTEMPT auto-resolve branches (`gameEngine.ts:1242-1451+`) stay the toggle-off code path verbatim — new phase is additive, not a replacement                                                                                                                          |

</phase_requirements>

## Summary

The tackle/steal duel today resolves synchronously and atomically inside `applyMove` (`gameEngine.ts:1052+`), triggered from the single `GAME_MOVE` socket handler which unconditionally pre-rolls `stealDie`/`tackleDie`/`carrierDie`/`injuryDie`/`bookingDie` (`gameHandlers.ts:920-937`) before calling `applyMove`. There is no existing interrupt point. This phase must add one: a new `GamePhase` (`TACKLE_STEAL_PROMPT`) that `applyMove` enters INSTEAD OF auto-resolving when the new toggle is on, gated by a resume snapshot exactly mirroring the already-shipped `GK_DIVE_AT_FEET_PROMPT`/`gkDiveAtFeetResume` pattern (`types.ts:1712-1727`, `GkDiveAtFeetPromptPanel.tsx`).

Two findings in this research materially change scope versus the milestone-level ARCHITECTURE.md/PITFALLS.md guidance already cited in CONTEXT.md — both save implementation effort and must be read before planning:

1. **Pitfall #7 (moveValidator's missing red-card ZoI exclusion) is ALREADY FIXED.** Commit `613a1317` ("fix(42-01): apply isActivePiece to moveValidator OCCUPIED and ZoI checks"), part of the just-completed Phase 42, added `isActivePiece` filtering to both `moveValidator.ts`'s `OCCUPIED` check (line 71) and its ZoI opponent list (line 104). The shared `isActivePiece` helper PITFALLS.md recommended extracting now exists at `packages/shared/src/stoppagePhases.ts:105-107` and is already imported into `moveValidator.ts:17`. **No remediation work is needed in Phase 43 for this pitfall — only a regression-test confirmation that the fix still holds once the sequential multi-defender loop is added** (the fix was written for the single-defender-per-move case; the new sequential loop iterates the same `defenders[]` array, which is already `isActivePiece`-filtered upstream at the point it's constructed, so no new exclusion logic is needed, but a test exercising a red-carded opponent alongside 2 active ZoI defenders is good defense-in-depth).

2. **The declined-but-live risk ring (TACKLE-03/D-04) requires zero new persistent GameState fields.** Both `HexGrid.tsx`'s `zoiRiskSet` (lines 240-251) and `useGameStore.ts`'s `tackleRiskHexes` (lines 244-249, `computeMovementValidHexes`) are recomputed FRESH on every render/selection by re-calling `validateMove`/`getZoIDefenders` and filtering against `stealAttemptedByIds`/`tackleAttemptedByIds` — never against a server-pushed "ring" field. As long as a decline never appends the defender's id to those two arrays (which ARCHITECTURE.md already establishes as the correct behavior for a different reason — re-triggering eligibility), the ring will automatically re-appear on the next move step with **no client code changes and no new `stealDeclinedByIds`/`tackleDeclinedByIds` sibling array**. See the dedicated section below for what a sibling field IS still needed for (a much narrower, ephemeral, single-sequence-scoped purpose) versus the full ~26-site persistent array CONTEXT.md's discretion section anticipated.

**Primary recommendation:** Build `TACKLE_STEAL_PROMPT` as a new interrupt `GamePhase` entered from `applyMove`, extend the existing (currently single-defender-only) `STEAL_ATTEMPT` resolution into a sequential per-defender queue sorted by `tackling` descending, resolve the ring-persistence requirement for free via the existing recompute logic (do not add a persistent decline-exclusion array unless the planner wants defense-in-depth beyond what's required), and register the new `ActionEventType`/`GamePhase` through the exact same checklist Phase 39/40/42 already used for `GK_DIVE_AT_FEET_DECLINED`/`SUBSTITUTION`/`ROSTER_REPOSITION`.

## Architectural Responsibility Map

| Capability                                      | Primary Tier                                            | Secondary Tier                                              | Rationale                                                                                                                                                                          |
| ----------------------------------------------- | ------------------------------------------------------- | ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Dice roll for steal/tackle duel                 | API/Backend (`packages/server`)                         | —                                                           | Server-authoritative; dice already pre-rolled server-side in `gameHandlers.ts` per project constraint (never generate dice client-side)                                            |
| Duel resolution / phase transition logic        | API/Backend (`packages/server/gameEngine.ts`)           | Shared (`packages/shared/moveValidator.ts` for eligibility) | `applyMove` owns all `GameState` transitions; `moveValidator.ts` only computes eligibility (pure, no mutation), consumed by both server and client                                 |
| Sequential defender ordering (by tackling stat) | Shared (`packages/shared/moveValidator.ts`)             | API/Backend (`gameEngine.ts` consumes the ordered list)     | Sort must be deterministic and identical whether computed for client preview (risk ring) or server resolution — belongs in the shared pure validator, not duplicated in the engine |
| Decline prompt UI (Attempt/Decline buttons)     | Browser/Client (`packages/client/components`)           | —                                                           | New `TackleStealPromptPanel.tsx`, structurally mirrors `GkDiveAtFeetPromptPanel.tsx`                                                                                               |
| Risk ring persistence (declined-but-live)       | Browser/Client (`HexGrid.tsx`/`useGameStore.ts`)        | —                                                           | Already implemented via live recompute against `stealAttemptedByIds`/`tackleAttemptedByIds` exclusion — no new backend field needed for this specific capability                   |
| Settings toggle (`tackleStealDeclineEnabled`)   | Browser/Client (`GameSettingsScreen.tsx`, default true) | API/Backend (`buildInitialGameState` param, default false)  | Mirrors `outOfBoundsEnabled`'s established split exactly (`gameEngine.ts:373-377`, `GameSettingsScreen.tsx:53-56`)                                                                 |
| ActionLog decline entry                         | Browser/Client (`ActionLog.tsx`)                        | API/Backend (event appended to `eventLog`)                  | Standard event-sourced display; server appends the event, client formats it                                                                                                        |

## Standard Stack

No new external libraries are needed. This phase is a pure extension of the existing internal state-machine/event-sourcing architecture (Socket.io events, immutable `GameState` spreads, React/Zustand). All "Standard Stack" recommendations below are internal architectural patterns, not npm packages.

### Core (Internal Patterns to Reuse)

| Pattern                                   | Location                                                                                 | Purpose                                                                                       | Why Standard                                                                                                                                                                                             |
| ----------------------------------------- | ---------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Two-button interrupt-prompt phase         | `GK_DIVE_AT_FEET_PROMPT` / `GkDiveAtFeetPromptPanel.tsx`                                 | Deciding-team prompt + waiting-message branch + resume snapshot                               | Shipped 3 times already (`FoulChoicePanel`, `GkDiveAtFeetPromptPanel`, `GkBoxEntryPromptPanel`) — exact template to mirror per D-05                                                                      |
| Resume-snapshot field trio                | `gkDiveAtFeetResume: { phase, activeTeam, movementSlot } \| null` (`types.ts:1723-1727`) | Restores play state after a prompt sequence resolves/declines                                 | Established, tested pattern; do not invent a new resume shape                                                                                                                                            |
| Sibling tracking field (not overloading)  | `subsUsed`/`addedTimeBonus` (`types.ts:1729-1744`)                                       | Precedent for adding a genuinely new field instead of overloading an existing one's semantics | Directly cited by Pitfall #8 as the anti-pattern to avoid                                                                                                                                                |
| `isActivePiece` shared eligibility helper | `packages/shared/src/stoppagePhases.ts:105-107`                                          | Single source of truth for "is this piece eligible for gameplay computations"                 | Already used by `moveValidator.ts` for both the OCCUPIED and ZoI checks (BUG-38/Phase 42) — the sequential defender loop must consume `moveValidator.ts`'s already-filtered `defenders[]`, not re-filter |

### Alternatives Considered

| Instead of                                                                                    | Could Use                                                     | Tradeoff                                                                                                                                                                                                                                                                                                                 |
| --------------------------------------------------------------------------------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| New `GamePhase` + resume snapshot                                                             | Client-only confirm-before-emit (no server phase)             | Rejected by ARCHITECTURE.md and confirmed by this research: `stealAttemptedByIds`/`tackleAttemptedByIds` exclusion is server-authoritative and consulted inside `validateMove`; a client-only confirm cannot control whether a defender is added to that array, so it cannot deliver TACKLE-03's persistence requirement |
| Persistent `stealDeclinedByIds`/`tackleDeclinedByIds` mirroring the full ~26-site reset table | Ephemeral single-sequence queue field, OR no new field at all | See "Do We Actually Need stealDeclinedByIds/tackleDeclinedByIds?" below — the full persistent array is more machinery than TACKLE-03 requires                                                                                                                                                                            |

**Installation:** None — no new packages.

**Version verification:** N/A — no new dependencies.

## Package Legitimacy Audit

Not applicable — this phase introduces zero new external packages (npm, pip, or otherwise). All work is internal `GameState`/`GamePhase`/`ActionEventType`/React-component extension using already-installed dependencies.

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│ CLIENT: attacker clicks a valid-move hex adjacent to opponent(s)      │
└───────────────────────────────┬───────────────────────────────────────┘
                                 │ emit GAME_MOVE {pieceId, to}
                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│ SERVER: gameHandlers.ts GAME_MOVE handler                             │
│  - pre-rolls stealDie/tackleDie/carrierDie/injuryDie/bookingDie       │
│    (unconditional, dice generation NEVER depends on prompt outcome)   │
│  - calls applyMove(state, pieceId, to, dice)                          │
└───────────────────────────────┬───────────────────────────────────────┘
                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│ SHARED: moveValidator.validateMove                                    │
│  - computes STEAL_ATTEMPT{defenders: PlayerPiece[]} (ZoI, isActivePiece│
│    filtered, stealAttemptedByIds-excluded) OR                         │
│    TACKLE_ATTEMPT{carrierId} (single defender = the mover)            │
└───────────────────────────────┬───────────────────────────────────────┘
                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│ SERVER: gameEngine.applyMove — NEW BRANCH POINT                       │
│  if (state.tackleStealDeclineEnabled !== true) {                      │
│    // TACKLE-04: existing auto-resolve branches, UNCHANGED             │
│  } else {                                                              │
│    // NEW: apply the normal move (piece position, pace, movedPieceIds)│
│    // sort defenders[] by tackling desc (STEAL_ATTEMPT only; TACKLE   │
│    //   is inherently single-defender)                                │
│    // snapshot resume {phase, activeTeam, movementSlot}               │
│    // enter TACKLE_STEAL_PROMPT, set current defenderId + queue       │
│  }                                                                      │
└───────────────────────────────┬───────────────────────────────────────┘
                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│ CLIENT: TackleStealPromptPanel renders (deciding team = defender's    │
│  team); Attempt/Decline buttons; other manager sees waiting message   │
└───────────────────────────────┬───────────────────────────────────────┘
                     ┌───────────┴────────────┐
              emit choice='attempt'      emit choice='decline'
                     ▼                          ▼
┌────────────────────────────┐   ┌───────────────────────────────────┐
│ SERVER: run the SAME dice-  │   │ SERVER: append *_DECLINED event,   │
│ roll-and-resolve logic that │   │ do NOT add defenderId to           │
│ today's inline branch runs  │   │ stealAttemptedByIds/               │
│ (extract to shared helper)  │   │ tackleAttemptedByIds (this is the  │
│                              │   │ WHOLE mechanism for TACKLE-03)     │
│ SUCCESS → possession changes│   │ dequeue defender, advance to next  │
│  → sequence ENDS (D-03)     │   │ queued defender's prompt, OR if    │
│ FAIL → dequeue, advance to  │   │ queue empty, resume from snapshot  │
│  next queued defender (D-03)│   │ (move completes, no possession     │
│  or resume if queue empty   │   │ change, ring recomputes live)      │
└──────────────┬───────────────┘   └───────────────┬─────────────────┘
               └────────────┬────────────────────────┘
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│ BROADCAST: full-state snapshot to both clients (ARCH-04)              │
│  - HexGrid.tsx / useGameStore.ts recompute zoiRiskSet/tackleRiskHexes │
│    fresh from current stealAttemptedByIds/tackleAttemptedByIds — a    │
│    declined defender still in ZoI range automatically re-shows the    │
│    amber `risk` ring with ZERO client changes needed for this.        │
└─────────────────────────────────────────────────────────────────────┘
```

### Recommended Project Structure

No new directories. New files land in existing locations:

```
packages/shared/src/
├── moveValidator.ts        # extend: sort STEAL_ATTEMPT defenders[] by tackling desc (D-02)
├── types.ts                 # extend: GamePhase += 'TACKLE_STEAL_PROMPT'; ActionEventType +=
│                             #   decline event; GameState += tackleStealPrompt* fields +
│                             #   tackleStealDeclineEnabled
├── stoppagePhases.ts         # NO CHANGE — TACKLE_STEAL_PROMPT must NOT be added (mid-duel
│                             #   decision prompt, not a stoppage; mirrors GK_DIVE_AT_FEET_PROMPT's
│                             #   explicit exclusion, stoppagePhases.ts:53-55)

packages/server/src/
├── gameEngine.ts             # extend: applyMove new branch; extract shared duel-resolution
│                             #   helper (used by both toggle-off auto-resolve and toggle-on
│                             #   'attempt' branch); new applyTackleStealChoice function;
│                             #   PHASE_LABEL-equivalent server maps (isBoundary — do NOT add;
│                             #   REPLAY_ELIGIBLE_TYPES — do NOT add, no ballAfter on decline)
├── gameHandlers.ts           # extend: new GAME_TACKLE_STEAL_CHOICE socket handler mirroring
│                             #   GAME_GK_DIVE_AT_FEET's handler shape

packages/client/src/
├── components/
│   ├── TackleStealPromptPanel.tsx        # NEW — mirrors GkDiveAtFeetPromptPanel.tsx
│   ├── TackleStealPromptPanel.module.css # NEW — mirrors GkDiveAtFeetPromptPanel.module.css
│   ├── GameBoard.tsx                     # extend: PHASE_LABEL record + panel routing
│   ├── ActionLog.tsx                     # extend: formatEvent case for the decline event
│   ├── GameSettingsScreen.tsx            # extend: new toggle checkbox + onConfirm payload field
├── store/useGameStore.ts     # extend: emitTackleStealChoice function; confirm zoiRiskSet/
│                             #   tackleRiskHexes need NO changes (already correct, see Summary)
```

### Pattern 1: New Interrupt GamePhase with Resume Snapshot

**What:** A `GamePhase` value that `applyMove` enters instead of returning a normal `ok:true` result, carrying enough state to resume the interrupted move sequence after a player decision.
**When to use:** Any time a dice-roll-triggering game event needs a player-facing accept/decline gate inserted before it (this project has done it 3 times already: `FOUL_CHOICE`, `GK_DIVE_AT_FEET_PROMPT`, `GK_BOX_ENTRY_PROMPT`).
**Example (existing precedent to mirror, not hypothetical):**

```typescript
// Source: packages/shared/src/types.ts:1723-1727 (gkDiveAtFeetResume)
gkDiveAtFeetResume?: {
  phase: GamePhase;
  activeTeam: 'home' | 'away';
  movementSlot: MovementSlot | null;
} | null;
```

For Phase 43, this becomes (proposed shape, Claude's discretion per CONTEXT.md):

```typescript
tackleStealPromptTeam?: 'home' | 'away' | null;       // defending team = decider
tackleStealPromptKind?: 'STEAL' | 'TACKLE' | null;
tackleStealPromptDefenderId?: string | null;            // CURRENT defender being asked
tackleStealPromptCarrierId?: string | null;              // ball carrier (STEAL) or carrier (TACKLE)
tackleStealPromptQueue?: readonly string[];               // remaining defender ids, STEAL_ATTEMPT
                                                            //   multi-defender case only, sorted by
                                                            //   tackling desc, current id already
                                                            //   shifted off
tackleStealPromptResume?: {
  phase: GamePhase;
  activeTeam: 'home' | 'away';
  movementSlot: MovementSlot | null;
} | null;
```

### Pattern 2: Sequential Multi-Defender Ordering (D-01/D-02) — NOT YET IMPLEMENTED ANYWHERE

**What:** `moveValidator.ts`'s `STEAL_ATTEMPT` effect already carries `defenders: PlayerPiece[]` (plural, confirmed `moveValidator.ts:40,105-111`), but `applyMove`'s current resolution ONLY ever resolves `defenders[0]` (`gameEngine.ts:1248: const defender = result.effect.defenders[0];`) — **there is no existing multi-defender iteration to extend; this is new logic, not a variant of existing logic.**
**When to use:** Whenever `result.effect.defenders.length > 1` inside the new `TACKLE_STEAL_PROMPT`-branch of `applyMove`.
**Implementation approach:**

```typescript
// New logic (does not exist today) — sort by tackling descending (D-02), then queue for
// sequential prompting (D-01). TACKLE_ATTEMPT never needs this: its effect carries a single
// carrierId because the MOVER is the (sole) defender in that branch.
const orderedDefenders = [...result.effect.defenders].sort((a, b) => b.tackling - a.tackling);
const [firstDefender, ...restDefenders] = orderedDefenders;
// firstDefender.id -> tackleStealPromptDefenderId
// restDefenders.map(d => d.id) -> tackleStealPromptQueue
```

**Note on tie-breaking:** D-02 says "ordered by tackling stat, highest first" but does not specify a tie-break rule for equal tackling values. `Array.prototype.sort` is stable in modern JS engines (ES2019+, Node 12+), so ties preserve `defenders[]`'s original (ZoI-computation) order — flag this as a minor open question for the planner to confirm is acceptable, or pick an explicit tie-break (e.g., piece id) for determinism in tests.

### Pattern 3: Toggle Wiring (Client Default-On / Server Default-Off Split)

**What:** The exact split already used for `outOfBoundsEnabled` — client UX defaults the checkbox to checked, but the server-side function parameter defaults to `false` so any code path that constructs `GameState` without explicitly passing the new param stays on today's behavior.
**Confirmed locations:**

```typescript
// Source: packages/server/src/gameEngine.ts:373-377 (buildInitialGameState signature)
/**
 * at match start from Room.outOfBoundsEnabled. Defaults to `false` — the disabled path
 */
outOfBoundsEnabled: boolean = false,
```

```typescript
// Source: packages/client/src/components/GameSettingsScreen.tsx:53-56
// GOALKICK-06 / OOB-05 (Phase 37): D-14 (Phase 39) explicitly flips this to default ON,
// superseding the prior "safe default" comment. The SERVER-side default in
// buildInitialGameState deliberately stays `false` — this is a client-only UX default.
const [outOfBounds, setOutOfBounds] = useState<boolean>(true);
```

```typescript
// Source: packages/client/src/components/GameSettingsScreen.tsx:186-193 (checkbox JSX)
<label className={styles.poolRow}>
  <input type="checkbox" checked={outOfBounds} onChange={() => setOutOfBounds((v) => !v)} />
  Out-of-Bounds / Restarts
</label>
```

Mirror this exactly for `tackleStealDeclineEnabled` (client `useState<boolean>(true)`, server param `= false`). The `onConfirm` payload type in `GameSettingsScreen.tsx:22-34` must add a `tackleStealDecline: boolean` field, and whatever downstream Room→`buildInitialGameState` call site consumes `outOfBounds`/`fouls`/`booking`/`injury` today must add the new field alongside them (grep `outOfBoundsEnabled` in the server's socket/room-creation code at planning/implementation time to find the exact call site — not traced in this research session, budget for a short grep pass before writing the plan's task list).

### Anti-Patterns to Avoid

- **Re-filtering `defenders[]` for `isActivePiece`/red-card exclusion inside the new sequential loop:** `moveValidator.ts:104` already filters `opponents` through `isActivePiece` before `getZoIDefenders` ever runs — the `defenders[]` array `applyMove` receives is already clean. Adding a second filter is redundant, not wrong, but signals the author didn't realize BUG-38/Pitfall #7 is already fixed (see Corrections section).
- **Adding the decline event to `REPLAY_ELIGIBLE_TYPES` or the `isBoundary` disjunction:** Both `GK_DIVE_AT_FEET_DECLINED` and `FOUL_CHOICE_MADE` are deliberately excluded from `REPLAY_ELIGIBLE_TYPES` because neither carries a `ballAfter` field (`gameEngine.ts:9929-9931` — explicit comment: "a future reader must not add them here"). The new decline event must follow the identical exclusion for the identical reason (no ball movement on a decline).
- **Overloading `stealAttemptedByIds`/`tackleAttemptedByIds` to also carry declined ids:** Confirmed anti-pattern per Pitfall #8/Technical Debt table — never conflate two different lifecycles in one array, mirroring the explicit `subsUsed`/`addedTimeBonus` precedent.

## Don't Hand-Roll

| Problem                                                            | Don't Build                                              | Use Instead                                                                                                                                                             | Why                                                                                                                                                                                                       |
| ------------------------------------------------------------------ | -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Red-card/inactive-piece exclusion in any new eligibility list      | A new inline `.filter(p => p.redCarded !== true)` clause | `isActivePiece(piece)` from `packages/shared/src/stoppagePhases.ts:105-107`                                                                                             | Already the shared, audited helper (BUG-38/Phase 42); hand-writing a new inline filter is the exact anti-pattern that caused Pitfalls #6/#7 in the first place                                            |
| Two-button decision prompt UI                                      | A bespoke prompt component from scratch                  | `GkDiveAtFeetPromptPanel.tsx` as a structural copy target                                                                                                               | Established, tested pattern (deciding-team branch, waiting-message branch, CTA button pair) — D-05 explicitly mandates matching its tone                                                                  |
| Resume-after-interrupt state                                       | A bespoke ad hoc snapshot shape                          | The `{ phase, activeTeam, movementSlot }` trio already used by `gkDiveAtFeetResume`/`gkBoxEntryResume`                                                                  | Two independent precedents already use this exact 3-field shape; a third ad hoc shape would fragment the pattern for no benefit                                                                           |
| Dice-roll duel resolution math (combined score, success threshold) | New scoring logic for the decline-then-attempt path      | The EXACT existing `computeCombinedScore`/success-threshold logic in `applyMove`'s current STEAL_ATTEMPT/TACKLE_ATTEMPT branches (`gameEngine.ts:1256-1258, 1321-1324`) | ARCHITECTURE.md's own recommendation: extract to a shared helper called from both the toggle-off auto-resolve path and the toggle-on post-'attempt' path — do NOT reimplement the dice math a second time |

**Key insight:** Every piece of "new" mechanics this phase needs (eligibility filtering, resume snapshots, two-button prompts, dice-duel math) already has exactly one canonical implementation elsewhere in this codebase. The entire phase is an exercise in wiring a new phase-transition INTO those existing patterns, not inventing new ones — the risk is inconsistency (a slightly different resume shape, a re-derived filter) more than missing capability.

## Do We Actually Need stealDeclinedByIds/tackleDeclinedByIds?

This section directly answers CONTEXT.md's flagged open item ("needs a site-by-site decision at planning time, not a vision call") with concrete findings, not a recommendation to skip the analysis.

**What the milestone-level PITFALLS.md (Pitfall #8) assumed:** that a declined tackle/steal needs its own persistent exclusion array, sibling to `stealAttemptedByIds`/`tackleAttemptedByIds`, reset at the same ~30 sites, to prevent conflating "declined" with "attempted."

**What this research found by reading the actual ring-rendering code:**

1. `HexGrid.tsx:240-251` (`zoiRiskSet`) recomputes the ZoI steal-risk ring on every render by calling `getZoIDefenders(hex, opponents)` for each valid-move candidate hex and filtering out ids already in `stealAttemptedByIds` — it does NOT read any server-pushed "ring" field.
2. `useGameStore.ts:234-250` (`computeMovementValidHexes`, backing `tackleRiskHexes`) recomputes the tackle-risk ring on every piece selection by calling `validateMove` fresh against the current `GameState` and checking whether the result's effect is `TACKLE_ATTEMPT` — same story, no persisted ring field.
3. Both of these recomputations are **already keyed only on `stealAttemptedByIds`/`tackleAttemptedByIds`**, which ARCHITECTURE.md already establishes must NOT receive a declined defender's id (that's literally the stated mechanism for "risk ring stays active" in the milestone research: "the declining defender is NOT added to stealAttemptedByIds/tackleAttemptedByIds... validateMove's exclusion check re-evaluates fresh on every subsequent move click").

**Conclusion:** TACKLE-03's cross-move-step ring-persistence requirement is satisfied by NOT adding declined defenders to the existing arrays — a fact CONTEXT.md's canonical_refs already stated but did not connect to the client-side ring code. **No new persistent `stealDeclinedByIds`/`tackleDeclinedByIds` array, and no new ~26-site reset table, is required to satisfy TACKLE-03/D-04.**

**What a sibling field IS still needed for:** strictly the WITHIN-ONE-MOVE-STEP sequential ordering (D-01). When `defenders[].length > 1` on a single `validateMove` call, the engine must track "who in this specific queue has already been asked" so it can advance A→B→C without re-asking A after A declines or fails. This is naturally modeled as the `tackleStealPromptQueue: string[]` ephemeral field proposed in Pattern 1 above — populated when the prompt sequence starts, dequeued on each response, and cleared entirely when the sequence resolves (either via a successful attempt, the queue exhausting, or a foul stoppage). **This field's reset scope is narrow and self-contained: it only ever needs clearing at the SAME point `tackleStealPromptResume`/`tackleStealPromptTeam`/etc. clear (i.e., wherever the prompt phase itself exits) — it does NOT need the ~26-site reset table**, because it never persists outside a single active prompt sequence in the first place (unlike `stealAttemptedByIds`, which persists across multiple move steps within a whole movement phase/PASS-cycle by design).

**Planner decision needed:** Confirm this narrower design (ephemeral queue field, no persistent decline-array, no 26-site reset table) is acceptable, OR explicitly choose to still add a persistent `stealDeclinedByIds`/`tackleDeclinedByIds` pair for a DIFFERENT reason not covered by TACKLE-01..04 as written (e.g., future Phase 45 stats work wanting to distinguish "declined" from "never offered" in a match-summary count — worth a quick cross-check against `.planning/research/FEATURES.md`'s Feature 6 stats list, which does NOT currently list a decline-count stat, so this is not presently a blocking concern). If the planner chooses the persistent-array route anyway (e.g. for audit-log completeness), the full site enumeration below is ready to use as the reset-policy table.

## Reset-Site Enumeration: stealAttemptedByIds/tackleAttemptedByIds (for reference, and IF a persistent decline array is chosen)

Confirmed via `grep -n "stealAttemptedByIds: \[\]" packages/server/src/gameEngine.ts` (26 matches; `tackleAttemptedByIds: []` is paired at every one of these except `applyStartMovement`'s `contestedPieceIds`-adjacent line, which resets both together). Every site groups into one of four transition categories:

| Category                                                                                                                                                                                         | Representative line(s)                                                                                                                                                                                            | Transition                                                                                                                                     | Declined-array policy IF a persistent field is added                                                                                                                                                                                                                         |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Fresh movement-phase start                                                                                                                                                                       | `576-577` (`applyStartMovement`)                                                                                                                                                                                  | Enters a brand-new 4-5-2 movement cycle                                                                                                        | **Reset alongside** — a new movement phase means every prior sequence, declined or not, is over                                                                                                                                                                              |
| Any transition to `phase: 'PASS'` (successful pass completion, interception, header resolution, loose-ball scatter landing on an occupant, ATTACKER_2→PASS slot-advance, cancel-movement revert) | `1193-1194, 1426-1427, 1550-1551, 2724-2725, 3844-3845, 4188-4189, 4235-4236, 4319-4320, 4342-4343, 4379-4380, 4487-4488, 4932-4933, 5030-5031, 5146-5147, 5203-5204, 5377-5378, 8196-8197, 8642-8643, 8690-8691` | The current movement/duel sequence has definitively ended (possession settled into a fresh PASS phase, per D-03's own "sequence ends" framing) | **Reset alongside** — every one of these IS a D-03 sequence-end boundary already (possession change, or the movement phase itself terminating into a new phase); this is the single largest category and the reset semantics align exactly with D-03's stated end conditions |
| Stoppage/restart phase entry (GK_RESTART, THROW_IN_SETUP, PENALTY_KICK spot placement, out-of-bounds common reset block, goal-kick standard restart)                                             | `2619-2620, 2692-2693, 5433-5434, 6535-6536, 6907-6908, 7399-7400`                                                                                                                                                | Ball goes dead for a restart                                                                                                                   | **Reset alongside** — a foul-triggered-stoppage-for-a-kick is explicitly named in D-03 as a sequence-end condition; non-foul stoppages (throw-in, goal kick from a clean out-of-bounds) are equally sequence-ending since the movement phase itself is over                  |

**Net finding: every one of the ~26 existing reset sites is already a legitimate sequence-end boundary under D-03's own definition.** There is no site among the 26 where the correct policy is "reset `stealAttemptedByIds` but NOT the new declined-set" or vice versa — they are the same boundary for both concepts. If the planner adds a persistent declined-array despite the "Do We Actually Need" section's recommendation against it, the simplest and lowest-risk implementation is a single shared reset-object literal (e.g. `const stealTackleSequenceReset = { stealAttemptedByIds: [], tackleAttemptedByIds: [], stealDeclinedByIds: [], tackleDeclinedByIds: [] }`) spread at all 26 sites, rather than hand-adding two new lines independently at each — this directly prevents the "31st future site misses one but not the other" risk PITFALLS.md itself warns about.

## New GamePhase & Interception Point

**Exact interception point confirmed:** `gameHandlers.ts:920-937` (`GAME_MOVE` handler) unconditionally pre-rolls all 5 dice, then calls `applyMove(room.gameState, pieceId, to, { stealDie, tackleDie, carrierDie, injuryDie, bookingDie })` (`:931-937`). This call site does NOT need to change — dice generation is intentionally unconditional (matches the existing project-wide pattern of always rolling injury/booking dice even when unused, `:925-929`'s own comment). The branch point is entirely inside `applyMove` (`gameEngine.ts:1052+`):

- Today: `if ('effect' in result && result.effect.type === 'STEAL_ATTEMPT') { ...resolve immediately... }` (`gameEngine.ts:1245-1304`) and the parallel `TACKLE_ATTEMPT` branch (`:1309-1451+`).
- New: both branches need a toggle check (`state.tackleStealDeclineEnabled === true`) inserted before the existing resolve-immediately logic. When true, apply the normal move-mechanics (piece position update, `movedPieceIds`/`paceUsedByPieceId`, the `MOVE` event) exactly as today, but instead of resolving the duel, snapshot `{ phase: state.phase, activeTeam: state.activeTeam, movementSlot: state.movementSlot }` into `tackleStealPromptResume`, set `tackleStealPromptDefenderId`/`tackleStealPromptTeam`/`tackleStealPromptKind`/(`tackleStealPromptQueue` for multi-defender STEAL_ATTEMPT), and return `{ ok: true, state: { ...state, phase: 'TACKLE_STEAL_PROMPT', ... } }`.
- When false (toggle off, TACKLE-04): fall through to the EXACT existing code, unchanged — this is the backward-compatibility guarantee ARCHITECTURE.md already calls out and every existing tackle/steal test depends on.

**New handler:** `GAME_TACKLE_STEAL_CHOICE`, mirroring `GAME_GK_DIVE_AT_FEET`'s handler shape in `gameHandlers.ts` (grep `GAME_GK_DIVE_AT_FEET` at implementation time for the exact sibling handler to copy — not fully traced in this research pass, but the `emitGkDiveAtFeet(accept: boolean)` client-side call at `useGameStore.ts:1850` confirms the boolean-accept payload shape is the established convention to mirror for `emitTackleStealChoice`).

## Common Pitfalls

### Pitfall 1: Only `defenders[0]` is resolved today — the sequential loop is 100% new code, not an extension of existing multi-defender handling

**What goes wrong:** A plan that assumes "extend the existing multi-defender resolution to be sequential" will fail to find any multi-defender resolution to extend — `gameEngine.ts:1248` hardcodes `result.effect.defenders[0]`.
**Why it happens:** `moveValidator.ts` was built to return the FULL eligible-defenders array (plural, for exactly this future use), but the consuming code in `applyMove` was written before this phase's sequential-prompt requirement existed and only ever needed the single most-relevant defender.
**How to avoid:** Budget this as new logic in the plan's task breakdown, not a "make X handle multiple" refactor task. Write a test asserting today's behavior (only `defenders[0]` fires) is confirmed BEFORE starting, so the sequential rewrite has a clear "before" baseline.
**Warning signs:** A plan task titled "extend multi-defender resolution" that doesn't first note the current single-defender hardcoding.

### Pitfall 2: Sort stability / tie-break for D-02's "highest tackling first" is unspecified

**What goes wrong:** Two defenders with equal `tackling` values get an implementation-dependent order if the planner doesn't pick an explicit tie-break, risking test flakiness if tests don't pin exact squad attribute values.
**How to avoid:** `Array.prototype.sort` is stable in Node 12+/all modern browsers, so ties preserve `defenders[]`'s original order (itself derived from `state.pieces`'s array order via `getZoIDefenders`) — document this as the explicit, intentional tie-break rather than leaving it implicit.
**Phase to address:** This phase, during the sort implementation task.

### Pitfall 3: `applyMove`'s existing early-return branches for STEAL_ATTEMPT success (possession-change) bypass the toggle check if inserted in the wrong place

**What goes wrong:** `gameEngine.ts:1245-1304`'s STEAL_ATTEMPT branch and `:1309-1451+`'s TACKLE_ATTEMPT branch each contain MULTIPLE early `return` statements (success path, foul-detected path, fail path) — inserting the toggle check only at the TOP of the function without also verifying no other code path can reach a duel resolution unconditionally risks a partial toggle-off implementation where SOME steal/tackle paths still resolve immediately regardless of the toggle.
**How to avoid:** Insert the toggle check as the FIRST statement inside each of the two `if ('effect' in result && result.effect.type === '...')` blocks (`:1245`, `:1309`), before any dice-die extraction or event construction — this guarantees no code below it runs when the toggle is on, matching the interception-point design above.
**Phase to address:** This phase. Regression test: with the toggle ON, assert `applyMove` returns `phase: 'TACKLE_STEAL_PROMPT'` and appends ZERO `STEAL_ATTEMPT`/`TACKLE_ATTEMPT` events to `eventLog` — the duel event must only appear after the `'attempt'` choice, not at move time.

### Pitfall 4: Foul-triggered stoppage mid-sequence must still end the D-03 sequence, but the existing foul-chain logic runs INSIDE the same branch being made conditional

**What goes wrong:** `resolveFoulChain` (`gameEngine.ts:1286-1303`, `1359-1378`) is called as part of the SAME STEAL_ATTEMPT/TACKLE_ATTEMPT resolution branch this phase makes conditional on the toggle+prompt-accept flow. D-03 says "a foul triggers a stoppage for a kick" is one of only two conditions that end the sequence — so the extracted shared duel-resolution helper (Don't Hand-Roll table) MUST still call `resolveFoulChain` after every 'attempt' (accepted) resolution, exactly as today, and the sequence-continuation logic (dequeue next defender) must check `fouled` the same way the existing code already does before deciding to continue vs. transition to `FOUL_CHOICE`.
**How to avoid:** When extracting the shared duel-resolution helper, preserve the existing `fouled`/`foulFields` threading exactly — do not simplify it away. Write a regression test: toggle on, multi-defender STEAL_ATTEMPT, first defender's attempt triggers a foul → assert phase transitions to `FOUL_CHOICE` (sequence ends), NOT to the next queued defender's prompt.
**Phase to address:** This phase — this is the single highest-complexity interaction between D-03's continuation rule and the existing foul-chain machinery.

### Pitfall 5: New GamePhase must be added to PHASE_LABEL or the build fails (this is a feature, not a risk, but budget for it)

**What goes wrong:** `PHASE_LABEL` is declared `Record<GamePhase, string>` (`GameBoard.tsx:34`) — TypeScript's exhaustiveness checking on `Record<K,V>` means adding `'TACKLE_STEAL_PROMPT'` to the `GamePhase` union without a corresponding `PHASE_LABEL` entry is a COMPILE ERROR, not a silent runtime gap.
**How to avoid:** Nothing special — this is a positive safety net already built into the codebase (unlike `ActionEventType`, which is NOT exhaustiveness-checked anywhere, per Pitfall 6 below). Just remember to add the label string when adding the phase.
**Phase to address:** This phase, trivially, as part of the `GamePhase` union addition task.

### Pitfall 6: ActionEventType additions are NOT exhaustiveness-checked — the classic BUG-30/31/37 bug class applies here verbatim

**What goes wrong:** Confirmed directly: `REPLAY_ELIGIBLE_TYPES` is `Set<string>` (not `Set<ActionEventType>` with exhaustive membership checking), and `applyUndo`'s `isBoundary` is a plain boolean OR-chain (`gameEngine.ts:3473-3530`) — neither structure fails to compile if a new `ActionEventType` union member is added but omitted from either list. `formatEvent`'s switch in `ActionLog.tsx` likewise has no exhaustiveness guard unless the switch itself is written with a `never`-typed default case (not confirmed either way in this research pass — check at implementation time).
**How to avoid:** Treat the new decline event as a checklist, not a single edit: (1) `ActionEventType` union in `types.ts` near `GK_DIVE_AT_FEET_DECLINED` (`:242`) and its payload shape near `:771-777`; (2) do NOT add to `REPLAY_ELIGIBLE_TYPES` (`gameEngine.ts:9873+` — mirror the explicit `GK_DIVE_AT_FEET_DECLINED`-excluded comment pattern at `:9929-9931`); (3) do NOT add to `applyUndo`'s `isBoundary` disjunction (`:3473-3530` — a decline must remain undoable, matching `GK_DIVE_AT_FEET_DECLINED`'s precedent, since it locks in nothing the way a resolved dice roll does); (4) add a `formatEvent` case in `ActionLog.tsx` mirroring `GK_DIVE_AT_FEET_DECLINED`'s block (`:1157-1168`).
**Phase to address:** This phase. Regression test mirroring the project's own `gameEngine.undoReplay*.test.ts` pattern: assert Undo CAN cross back over a decline event (i.e., the decline is NOT a boundary), and assert the decline event produces no replay frame.

### Pitfall 7 (Corrected — see Corrections section): moveValidator ZoI red-card exclusion — ALREADY FIXED, do not re-plan

Superseded finding — see "Corrections to Milestone-Level Research" below. No action needed beyond a confirming regression test alongside the new sequential-defender logic.

## Code Examples

### Existing STEAL_ATTEMPT resolution (the toggle-off path this phase must leave unchanged)

```typescript
// Source: packages/server/src/gameEngine.ts:1245-1304 (abridged)
if ('effect' in result && result.effect.type === 'STEAL_ATTEMPT') {
  const die = dice?.stealDie ?? 3;
  const defender = result.effect.defenders[0]; // <- only ever the first; Pitfall 1
  stealDefenderId = defender!.id;
  if (newStealAttemptedByIds.includes(stealDefenderId)) {
    return { ok: false, reason: 'MOVE_INVALID', detail: 'ALREADY_ATTEMPTED' };
  }
  const combined = computeCombinedScore(defender!.tackling, die, []);
  const stealResult: 'SUCCESS' | 'FAIL' = die === 6 || combined >= 10 ? 'SUCCESS' : 'FAIL';
  // ... event construction, resolveFoulChain call ...
}
```

### Existing isActivePiece-filtered ZoI opponent list (already fixed, Phase 42)

```typescript
// Source: packages/shared/src/moveValidator.ts:100-111
if (state.ball.carrierId === piece.id) {
  const opponents = state.pieces.filter((p) => p.teamId !== piece.teamId && isActivePiece(p));
  const allDefenders = getZoIDefenders(to, opponents);
  const defenders = allDefenders.filter((d) => !(state.stealAttemptedByIds ?? []).includes(d.id));
  if (defenders.length > 0) {
    return { ok: true, effect: { type: 'STEAL_ATTEMPT', defenders } };
  }
}
```

### Existing live risk-ring recompute (proves TACKLE-03 needs no new field)

```typescript
// Source: packages/client/src/components/HexGrid.tsx:240-251
const zoiRiskSet = new Set(
  phase !== 'REPLAY' && isCarrierSelected
    ? validMoveHexes
        .filter(
          (hex) =>
            getZoIDefenders(hex, opponents).filter(
              (d) => !(stealAttemptedByIds ?? []).includes(d.id),
            ).length > 0,
        )
        .map((h) => `${h.q},${h.r}`)
    : [],
);
```

### Existing two-button prompt panel template (D-05's mandated structural mirror)

```typescript
// Source: packages/client/src/components/GkDiveAtFeetPromptPanel.tsx:106-122
return (
  <div className={styles.panel}>
    <div className={styles.helperBlock}>
      <span className={styles.helperLine1}>Dive at Feet?</span>
      <span className={styles.helperLine2}>
        {`${carrierName} is within range — dive to win the ball back?${distanceQualifier}`}
      </span>
    </div>
    <button className={styles.ctaButton} onClick={() => emitGkDiveAtFeet(true)}>Dive</button>
    <button className={styles.ctaButton} onClick={() => emitGkDiveAtFeet(false)}>Decline</button>
    {humanisedError && <span className={styles.errorText}>{humanisedError}</span>}
  </div>
);
```

## Corrections to Milestone-Level Research

CONTEXT.md's canonical_refs point to `.planning/research/PITFALLS.md` and `.planning/research/ARCHITECTURE.md` written 2026-08-21 (before Phase 42 shipped, 2026-08-23). Two items in those documents are now stale as of this phase's planning:

1. **PITFALLS.md Pitfall #7 ("moveValidator's ZoI opponent list has zero red-card/off-pitch awareness") is RESOLVED.** Fixed in Phase 42 by commit `613a1317` ("fix(42-01): apply isActivePiece to moveValidator OCCUPIED and ZoI checks"). Verified by direct read of `moveValidator.ts:71,104` (both use `isActivePiece`) and `stoppagePhases.ts:105-107` (the shared helper PITFALLS.md itself recommended extracting — it now exists). CONTEXT.md's `code_context` section still frames this as "worth fixing in the same pass since the sequential per-defender ordering (D-01/D-02) will iterate the same defender list" — this framing is now moot; the defender list the sequential ordering will iterate is ALREADY correctly filtered. **Do not schedule a fix task for this in Phase 43's plan** — only a confirming regression test (Pitfall 1's warning-signs guidance above).

2. **ARCHITECTURE.md's/PITFALLS.md's implied need for a persistent `stealDeclinedByIds`/`tackleDeclinedByIds` pair mirroring the full ~26-site reset table is narrower than assumed** — see "Do We Actually Need stealDeclinedByIds/tackleDeclinedByIds?" above. The ring-persistence requirement (TACKLE-03) these fields were proposed to satisfy is already satisfied by existing client recompute logic (`HexGrid.tsx`, `useGameStore.ts`) that neither milestone-level document traced down to. The only genuine need for a new field is a much smaller, ephemeral, single-sequence-scoped queue (D-01's within-move-step ordering), not a persistent cross-phase-transition array.

## Runtime State Inventory

Not applicable — this phase is a pure code/schema addition (new `GamePhase`, `ActionEventType`, `GameState` fields, React component). It does not rename, refactor, or migrate any existing identifier, datastore key, or external service configuration. No stored data, live service config, OS-registered state, secrets, or build artifacts reference "tackle" or "steal" in a way this phase's additions would collide with or need to migrate.

## Assumptions Log

| #   | Claim                                                                                                                                                                                                                                                                                                                                                                             | Section                            | Risk if Wrong                                                                                                                                                                                                                   |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A1  | Proposed field names (`tackleStealPromptTeam`, `tackleStealPromptDefenderId`, `tackleStealPromptQueue`, `tackleStealPromptResume`, `tackleStealDeclineEnabled`, `TACKLE_STEAL_PROMPT` phase, `TACKLE_STEAL_PROMPT_DECLINED`/similar event name) are this research's proposal, not confirmed against any existing partial implementation                                           | Pattern 1, New GamePhase section   | Low — CONTEXT.md explicitly leaves exact field shapes to planner discretion; naming collisions with existing fields were checked via grep (none found)                                                                          |
| A2  | The exact Room→`buildInitialGameState` call site that threads `outOfBoundsEnabled`-style params from the settings-confirm socket handler was not traced end-to-end in this research pass (confirmed the two endpoints — `GameSettingsScreen.tsx`'s `onConfirm` payload and `buildInitialGameState`'s parameter — but not the middle-layer room/socket handler that connects them) | Pattern 3 (Toggle Wiring)          | Low — this is a single grep-and-read task at plan/implementation time (`grep -rn outOfBoundsEnabled packages/server/src` beyond `gameEngine.ts`), not a design risk                                                             |
| A3  | `ELIGIBLE_NEXT_ACTIONS` (referenced in `types.ts:934,951,955`) does not need a new entry for `TACKLE_STEAL_PROMPT` since it appears to key off `lastActionType`, not `GamePhase`, and the new phase is a special-panel interrupt (like `GK_DIVE_AT_FEET_PROMPT`) rather than a `CHOOSE_ACTION`-adjacent phase                                                                     | New GamePhase & Interception Point | Low-Medium — worth a quick confirming grep at plan time; if wrong, a missing `ELIGIBLE_NEXT_ACTIONS` entry would show up immediately as a test failure, not a silent bug, since the existing guard rejects unlisted transitions |
| A4  | `formatEvent`'s switch in `ActionLog.tsx` has no `never`-typed exhaustiveness guard (unconfirmed either way)                                                                                                                                                                                                                                                                      | Pitfall 6                          | Low — if it DOES have such a guard, that's a strictly positive finding (compile-time safety net, like `PHASE_LABEL`); if it doesn't, the recommended checklist-based approach still covers it                                   |

**If this table is empty:** N/A — see entries above; all are low-risk implementation-detail assumptions, not architectural or compliance-relevant claims.

## Open Questions

1. **Does the planner want the full persistent `stealDeclinedByIds`/`tackleDeclinedByIds` array anyway, for reasons beyond TACKLE-01..04 (e.g., future Phase 45 match-summary "declined" stat)?**
   - What we know: TACKLE-01..04 as written do not require it (see "Do We Actually Need" section); Phase 45's STATS-06 (tackle/steal success %) does not currently list a decline-count sub-stat in FEATURES.md.
   - What's unclear: whether a future phase will want this data and whether retrofitting it later is cheaper than building it now.
   - Recommendation: Build the narrow ephemeral-queue version now (satisfies all 4 requirements); if Phase 45 planning later reveals a real need for historical decline counts, that phase can add a lightweight `TACKLE_STEAL_PROMPT_DECLINED`-event `eventLog` scan (matching Feature 6's own recommended eventLog-scan-at-popup-open architecture, PITFALLS.md Pitfall #12) rather than a live GameState counter — no retrofit cost either way.

2. **Exact middle-layer socket/room-settings-confirm handler that threads the new toggle from `GameSettingsScreen` to `buildInitialGameState`.**
   - What we know: both endpoints are confirmed (client `onConfirm` shape, server parameter).
   - What's unclear: the exact file/handler in between (not traced this session — see Assumption A2).
   - Recommendation: A 2-minute grep (`outOfBoundsEnabled` across `packages/server/src`) at the start of implementation resolves this immediately; not worth blocking planning on.

3. **Tie-break rule for D-02 when two defenders have equal `tackling` values.**
   - What we know: stable sort preserves original array order as the de facto tie-break.
   - What's unclear: whether this is acceptable to the user or whether an explicit rule (e.g., lower piece number first) is wanted.
   - Recommendation: Default to stable-sort-preserves-original-order; flag explicitly in the plan so it's a visible, intentional choice rather than an implicit one.

## Environment Availability

Not applicable — this phase has no new external tool/service/runtime dependencies. All work uses the already-installed Node.js/TypeScript/React/Socket.io toolchain confirmed present and pinned per `CLAUDE.md`'s Technology Stack section.

## Validation Architecture

### Test Framework

| Property           | Value                                                                                                                                                                                                                                 |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Framework          | Vitest (confirmed via existing `*.test.ts`/`*.test.tsx` files across `packages/server`, `packages/shared`, `packages/client`)                                                                                                         |
| Config file        | Per-package `vitest.config.ts` (not individually re-verified this session; standard project layout per `.planning/PROJECT.md` monorepo structure)                                                                                     |
| Quick run command  | `pnpm --filter @counter-attack/server test -- moveValidator` / `pnpm --filter @counter-attack/server test -- gameEngine` (scoped to touched files; exact package names per `packages/*/package.json`, confirm at implementation time) |
| Full suite command | `pnpm -r test` (repo-wide, matches CLAUDE.md's pnpm-workspace monorepo convention)                                                                                                                                                    |

### Phase Requirements → Test Map

| Req ID    | Behavior                                                                                                                   | Test Type          | Automated Command                                                                                                                  | File Exists?                          |
| --------- | -------------------------------------------------------------------------------------------------------------------------- | ------------------ | ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| TACKLE-01 | Toggle defaults on client, off server, threads through Settings→Room→buildInitialGameState                                 | unit + integration | `pnpm --filter @counter-attack/server test -- gameEngine.buildInitialGameState`                                                    | ❌ Wave 0 — new test file/case needed |
| TACKLE-02 | Decline does not append defender id to stealAttemptedByIds/tackleAttemptedByIds; move still completes                      | unit               | `pnpm --filter @counter-attack/server test -- gameEngine.applyMove` (extend existing suite)                                        | ✅ existing suite, new cases needed   |
| TACKLE-03 | Ring stays active across a subsequent move step after decline; clears once carrier leaves ZoI range or movement phase ends | unit (client)      | `pnpm --filter @counter-attack/client test -- HexGrid` / `useGameStore`                                                            | ✅ existing suite, new cases needed   |
| TACKLE-04 | Toggle off → all existing tackle/steal tests pass unchanged (regression)                                                   | unit               | `pnpm --filter @counter-attack/server test -- moveValidator gameEngine` (full existing suite, no new cases — pure regression gate) | ✅ existing, must stay green          |

### Sampling Rate

- **Per task commit:** scoped Vitest run against the touched package (`moveValidator`/`gameEngine`/`HexGrid`/`useGameStore`/`ActionLog` as applicable)
- **Per wave merge:** `pnpm -r test` (full repo-wide suite — this phase touches `packages/shared`, `packages/server`, AND `packages/client`, so cross-package regressions are a real risk given the shared `isActivePiece`/`validateMove` surface)
- **Phase gate:** Full suite green before `/gsd-verify-work`, PLUS a manual two-browser UAT pass for the sequential multi-defender prompt flow (dice-roll-driven UX with server-authoritative timing is historically under-covered by automated tests in this project per STATE.md's recurring `human_needed` verification-gap pattern)

### Wave 0 Gaps

- [ ] `packages/server/src/gameEngine.applyMove.tackleStealPrompt.test.ts` (or equivalent extension of the existing `applyMove` test file) — covers TACKLE-01, TACKLE-02, TACKLE-04
- [ ] `packages/server/src/gameEngine.undoReplay43.test.ts` (mirrors the project's own `gameEngine.undoReplay39.test.ts`/`gameEngine.undoReplay40.test.ts` naming convention) — covers Pitfall 6's Undo/Replay registration checklist
- [ ] Client-side test extension in `HexGrid.test.tsx`/`useGameStore.test.ts` — covers TACKLE-03's ring-persistence-across-move-steps assertion
- [ ] Framework install: none — Vitest already present repo-wide

_(No framework-level gaps — this is a well-instrumented existing test suite; gaps are new test CASES within existing files/patterns, not missing infrastructure.)_

## Security Domain

### Applicable ASVS Categories

| ASVS Category         | Applies | Standard Control                                                                                                                                                                                                                                                                                            |
| --------------------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| V2 Authentication     | No      | No auth changes in this phase                                                                                                                                                                                                                                                                               |
| V3 Session Management | No      | No session changes                                                                                                                                                                                                                                                                                          |
| V4 Access Control     | Yes     | `isActivePlayer(socket, room)` guard (existing pattern, `gameHandlers.ts:915-919`) must gate the new `GAME_TACKLE_STEAL_CHOICE` handler exactly like `GAME_MOVE`/`GAME_GK_DIVE_AT_FEET` — only the DEFENDING team's socket may submit a choice for `tackleStealPromptTeam`                                  |
| V5 Input Validation   | Yes     | Server must independently validate the incoming `choice` payload is exactly `'attempt' \| 'decline'` (or boolean, matching `emitGkDiveAtFeet`'s convention) — never trust an arbitrary client string; mirrors the existing `INVALID_TARGET`-style re-validation pattern used elsewhere (`applyDeclareShot`) |
| V6 Cryptography       | No      | No crypto surface in this phase                                                                                                                                                                                                                                                                             |

### Known Threat Patterns for this stack

| Pattern                                                                                              | STRIDE                  | Standard Mitigation                                                                                                                                                                                                                                                                      |
| ---------------------------------------------------------------------------------------------------- | ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Wrong-team client submits a tackle/steal choice for the other team's prompt                          | Elevation of Privilege  | `isActivePlayer`/`socketTeam(socket) === tackleStealPromptTeam` guard, rejecting with `WRONG_TEAM` — exact existing pattern used by every other two-button prompt handler in this codebase                                                                                               |
| Client fabricates a dice value or duel outcome                                                       | Tampering               | N/A by construction — dice are pre-rolled server-side in `gameHandlers.ts` before `applyMove` is ever called, and the client never sends dice values; this phase does not change that invariant                                                                                          |
| Client submits a choice for a prompt phase that has already resolved (double-submit / stale request) | Tampering / Repudiation | Server re-checks `room.gameState.phase === 'TACKLE_STEAL_PROMPT'` before processing (mirrors every other phase-guard in `gameHandlers.ts`, e.g. `:910` for `GAME_MOVE`'s own `WRONG_PHASE` guard) — `room.isProcessing` mutex additionally prevents a race between two rapid submissions |

## Sources

### Primary (HIGH confidence — direct codebase reads this session)

- `packages/shared/src/moveValidator.ts` (full file) — STEAL_ATTEMPT/TACKLE_ATTEMPT effect shapes, isActivePiece usage confirmed
- `packages/shared/src/stoppagePhases.ts` (full file) — isActivePiece helper, STOPPAGE_PHASES exclusion list and rationale comments
- `packages/shared/src/types.ts:872-955, 1700-1750` — GamePhase union, gkDiveAtFeetResume/gkBoxEntryResume field shapes, ActionEventType union region
- `packages/server/src/gameEngine.ts:1052-1460, 3455-3540, 9873-9940` — applyMove STEAL_ATTEMPT/TACKLE_ATTEMPT resolution, applyUndo isBoundary disjunction, REPLAY_ELIGIBLE_TYPES set
- `packages/server/src/gameEngine.ts` (grep, 26 matches) — full stealAttemptedByIds/tackleAttemptedByIds reset-site enumeration
- `packages/server/src/gameHandlers.ts:880-1030` — GAME_MOVE handler dice pre-roll and applyMove call site
- `packages/client/src/components/GkDiveAtFeetPromptPanel.tsx` (full file) — two-button prompt template
- `packages/client/src/components/ActionLog.tsx:1130-1179` — GK_DIVE_AT_FEET_DECLINED formatEvent precedent
- `packages/client/src/components/HexGrid.tsx:220-290` — zoiRiskSet/tackleRiskHexes live recompute logic (the key finding of this research)
- `packages/client/src/store/useGameStore.ts:234-250, 1362-1367` — computeMovementValidHexes, tackleRiskHexes derivation
- `packages/client/src/components/GameSettingsScreen.tsx` (full file) — outOfBoundsEnabled toggle wiring pattern
- `docs/HIGHLIGHT-REFERENCE.md:24,48,56,63-64` — risk ring token confirmation
- `git log --oneline -- packages/shared/src/moveValidator.ts` — confirmed commit `613a1317` fixed Pitfall #7 in Phase 42

### Secondary (MEDIUM confidence — milestone-level research, partially superseded)

- `.planning/research/ARCHITECTURE.md` §Feature 5 (lines 170-186) — directionally correct (new GamePhase + resume snapshot recommendation confirmed sound), but written before this session's deeper trace of the ring-recompute and dice-interception-point details
- `.planning/research/PITFALLS.md` Pitfalls #7, #8, #9 — #7 now resolved (see Corrections section); #8 narrowed (see Do We Actually Need section); #9 confirmed accurate and directly actionable

### Tertiary (LOW confidence — not independently verified this session)

- Exact Room→buildInitialGameState settings-confirm handler location (Assumption A2)
- ELIGIBLE_NEXT_ACTIONS interaction with the new phase (Assumption A3)
- formatEvent switch exhaustiveness guard presence (Assumption A4)

## Metadata

**Confidence breakdown:**

- Standard stack / architecture: HIGH — no new dependencies, every pattern traced to an existing, working, tested precedent in this exact codebase
- Pitfalls: HIGH — grounded in direct file:line reads, including one confirmed-via-git-log correction to milestone-level research (Pitfall #7 already fixed) and one confirmed-via-code-read narrowing (declined-state field scope)
- Reset-site table: HIGH — full enumeration via grep, all 26 sites read in context and categorized

**Research date:** 2026-08-23
**Valid until:** Low churn risk for the underlying architecture (stable since early phases); re-verify the reset-site count and moveValidator/gameEngine line numbers if Phase 44 or 45 lands first and touches the same files (30 days, or immediately if Phase 44/45 ships first)
