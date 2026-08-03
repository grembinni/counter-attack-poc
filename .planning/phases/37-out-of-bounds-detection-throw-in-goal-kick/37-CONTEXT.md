# Phase 37: Out-of-Bounds Detection, Throw-In & Goal Kick - Context

**Gathered:** 2026-08-03
**Status:** Ready for planning

<domain>
## Phase Boundary

The ball leaving the pitch over a sideline or the defending byline is classified by who last touched it and immediately playable as a throw-in or goal kick, with Out-of-Bounds/Restarts as its own independent, server-enforced game-creation toggle.

Covers OOB-01, OOB-02, OOB-04, OOB-05, THROWIN-01..05, GOALKICK-01..06. Corner kick (OOB-03, CORNER-01..06) is explicitly deferred to Phase 38 — this phase does not build corner-arc geometry, the two-window corner repositioning sequence, or attacking-byline classification behavior beyond what's needed to distinguish it from goal-kick classification. Does not touch Fouls/Cards/Injury/GK-Dive-at-Feet/Penalty Kick (Phase 39) or Substitutions (Phase 40).

</domain>

<decisions>
## Implementation Decisions

### Goal Kick's dedicated identity (overrides research's reuse recommendation)

- **D-01:** Goal Kick does **not** reuse the existing `GK_RESTART`→`GK_KICK_TARGET`→`GK_KICK_MOVE` chain, despite `ARCHITECTURE.md` Q1 recommending exactly that reuse as the cheapest path. GOALKICK-01's requirement text ("independent of the existing GK-catch/save restart chain") is to be read literally and structurally, not just cosmetically: build **new `GamePhase` value(s)**, **new `GameState` fields**, a **new repositioning step** (GOALKICK-02's 6-hex both-final-thirds window — goalkeeper's team first, then opposing team — which the existing `GK_RESTART` chain has no equivalent of today), a **new target-selection step**, and a **new travel/move chain** (GOALKICK-05's 1-player-per-team 3-hex movement while the kick travels). This is a deliberate rejection of the research recommendation — confirm/flag this explicitly to the researcher/planner so they don't silently revert to pure reuse.
- **D-02:** Within those new phases, reuse the existing **pure formula/helper functions** — the High Pass 8+ combined-score accuracy check, the unmodified Standard Pass mechanic (GOALKICK-04 says so explicitly), the `HEADER` duel resolution, and `computeLooseBall`/Loose Ball handling. Do not duplicate this dice/scoring math — only the state-machine wiring (phases, fields, transitions) is new. This mirrors how `FREE_KICK_SETUP` already calls into shared pure functions rather than reimplementing pass/header math.
- **D-03:** Exact phase-naming and field-naming (e.g. `GOAL_KICK_SETUP`/`GOAL_KICK_TARGET`/`GOAL_KICK_MOVE` or similar) is Claude's discretion — follow the existing `GK_KICK_TARGET`/`GK_KICK_MOVE` naming convention for consistency, but these must be genuinely new phase values, not the reused GK-restart ones.

### Out-of-bounds classification edge cases

- **D-04:** A throw-in that itself exits the pitch (overthrown past the far touchline, straight into touch) is reclassified by the same Out-of-Bounds Detection system as any other exit — sideline again → throw-in to the _other_ team at the new spot; byline → corner/goal kick per the normal last-touched-by rules. This matches THROWIN-05 and real football; no special-cased "re-throw" or Loose Ball behavior for this case.
- **D-05:** When the ball's exit hex is ambiguous between sideline and byline (corner-adjacent geometry), default to **byline classification** (goal kick / corner kick) over sideline (throw-in). Confirm this default against the actual grid's corner-hex geometry during implementation — it's a starting assumption, not verified against exact hex coordinates yet.
- **D-06:** `lastTouchedBy` (per `ARCHITECTURE.md` Q2's recommended `ball.lastTouchedBy: {pieceId, teamId} | null` field) updates on **any contact**, not just possession changes — every deflection, header contact, GK save/parry, and loose-ball bounce off a piece updates it, even when that piece never gains `ball.carrierId`. A deflected shot that goes out is "last touched by" the deflector, matching real football and resolving the ambiguity `FEATURES.md` flagged.

### New setup-screen visual conventions

- **D-07:** Whether Throw-In Setup and Goal Kick Setup panels match Phase 35's locked conventions (`"Confirm"` button verb, no container border, two-line title+detail helper text, `"{Team} is repositioning…"` waiting phrasing) exactly, versus adapting details where they don't read naturally, is **Claude's discretion during planning** — apply the established pattern wherever it fits, use judgment elsewhere. There is no explicit instruction to deviate.
- **D-08:** The new repositioning windows (throw-in placement, goal kick's two-team 6-hex reposition, both restart types' ball-travel movement windows) reuse the **existing** hex-highlight tint system (`HIGHLIGHT_STYLES`/`RING_STYLES` in `HexCell.tsx`) — map onto the closest existing tint type (e.g. the kick-off-repositioning tint, `safe`/`selectable` tints). Do not add new tint types to `docs/HIGHLIGHT-REFERENCE.md` for this phase unless something genuinely doesn't fit any existing type.

### Throw-in sequence — Movement Phase choice model

- **D-09 (structural, not a binary upfront pick):** THROWIN-03's "1 or 2 Movement Phases" is modeled as a **per-step decision**, not a choice made once at sequence entry:
  1. Throw-in setup places the thrower + ball at the exit hex.
  2. **Movement Phase 1 is mandatory** — no throw option is available before it. (Resolves an internal contradiction raised during discussion: the flow initially described allowed a zero-movement immediate throw; user confirmed THROWIN-03 stays as written — at least one Movement Phase is required.)
  3. After Movement Phase 1 completes, the manager chooses: **Standard throw-in** (take the throw now, low) / **High throw-in** (take the throw now, high) / **Move** (take a second Movement Phase).
  4. If **Move** is chosen again, Movement Phase 2 runs.
  5. After Movement Phase 2, only **Standard throw-in** / **High throw-in** remain — no third move option (hard cap at 2).
- **D-10:** The Low (Standard Pass) vs. High (header-required) throw-type choice within the actual throw step is **Claude's discretion during planning** — match whatever selection-UI pattern the existing High Pass / Standard Pass choice already uses elsewhere in the codebase (e.g. Goal Kick's own Kick-vs-Standard-Pass choice, once designed).

### Claude's Discretion

- Exact `GamePhase`/`GameState` field naming for the new Goal Kick chain (D-03).
- Exact adherence-vs-adaptation balance for Throw-In/Goal-Kick panel styling relative to Phase 35 conventions (D-07).
- Low/High throw-type selection UI shape for throw-ins (D-10).
- Exact corner-hex geometry verification for the byline-default edge case (D-05) — implementation-time verification, not a design decision.

</decisions>

<canonical_refs>

## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & roadmap

- `.planning/REQUIREMENTS.md` (OOB-01..05, THROWIN-01..05, GOALKICK-01..06 sections) — locked requirement text for this phase; GOALKICK-01's exact wording ("independent of the existing GK-catch/save restart chain") is the textual basis for D-01
- `.planning/ROADMAP.md` (Phase 37 section) — phase goal, 4 success criteria, dependency on Phase 36
- `.planning/STATE.md` — v1.6 "Decisions Locked" section flags the exact GOALKICK-01 reconciliation tension resolved by D-01/D-02 in this document; also documents the `ball.lastTouchedBy` field decision (D-06 confirms and extends it), the "new dice-roll event types need their own specific ActionEventType" pitfall, and the "audit each of 5+ independent clamp-to-pitch call sites individually" pitfall — all apply to this phase's implementation

### Research (grounds most structural decisions, with D-01 as an explicit override)

- `.planning/research/ARCHITECTURE.md` — Q1 (staged-restart pattern, `RestartSetupState`/`RESTART_STAGES` generalization recommendation), Q2 (`ball.lastTouchedBy` field recommendation, adopted as D-06), the "GOAL_KICK should NOT be a new staged-repositioning phase" finding (explicitly overridden by D-01 — flag this to the researcher/planner) — file:line citations throughout for `gameEngine.ts`/`types.ts`/`offside.ts`
- `.planning/research/FEATURES.md` — Goal Kick / Throw-In / Out-of-Bounds Detection sections; documents the throw-in-re-exit ambiguity (resolved by D-04), the corner-hex classification ambiguity (resolved by D-05), and the deflection/bounce "touch" ambiguity (resolved by D-06)

### Existing code (staged-restart reference pattern)

- `packages/server/src/gameEngine.ts:4133-4441` — `applyFreeKickMove`/`applyFreeKickReady`, the direct structural template for the new goal-kick/throw-in staging phases (per D-01, goal kick gets its own new phases inspired by this pattern, not the GK-restart chain)
- `packages/shared/src/offside.ts:38-56` — `FREE_KICK_STAGES`/`freeKickStageTeam()`, the stage-table pattern to potentially generalize/mirror for the new restart types
- `packages/server/src/gameEngine.ts:2880-3097` — existing `GK_RESTART`/`GK_KICK_TARGET`/`GK_KICK_MOVE` chain — explicitly NOT reused for Goal Kick per D-01, but its Kick/Standard-Pass choice UX and travel-movement mechanics are a useful reference for the new chain's shape
- `packages/server/src/gameEngine.ts:2769-2833` — `LOOSE_BALL` clamp-to-pitch-edge logic, the concrete hook point for out-of-bounds classification (replace clamp-only with classify-and-transition, gated by the toggle per OOB-05)
- `packages/server/src/gameEngine.ts:2376-2394` — GK save-spill routing, second out-of-bounds hook point
- `packages/shared/src/types.ts:45-48` — `BallState`, target location for the new `lastTouchedBy` field (D-06)
- `packages/shared/src/scoreUtils.ts:28-37` — `computeCombinedScore`, the shared accuracy-check function to reuse per D-02 (not reimplement)

### Visual/UX conventions (Phase 35, carried forward per D-07/D-08)

- `.planning/milestones/v1.5-phases/35-actionpanel-log-standardization/35-CONTEXT.md` — locked ActionPanel/panel-family conventions: "Confirm" button verb (D-08 of that phase), no container border (D-01), two-line title+detail helper text pattern, `"{Team} is repositioning…"` waiting-state phrasing (D-09), panel heading pattern (D-07)
- `docs/HIGHLIGHT-REFERENCE.md` — single source of truth for hex-tint types; D-08 requires reusing existing entries, not adding new ones, for this phase's repositioning windows
- `packages/client/src/components/FreeKickSetupPanel.tsx`/`.module.css` — closest existing component analog for the new Throw-In/Goal-Kick setup panels' structure and styling

No other external specs/ADRs apply beyond the above — requirements are fully captured in the Decisions section.

</canonical_refs>

<code_context>

## Existing Code Insights

### Reusable Assets

- `computeCombinedScore` (`scoreUtils.ts`) — accuracy-check math to call from the new goal-kick/throw-in phases, not reimplement (D-02).
- `FREE_KICK_STAGES`/`freeKickStageTeam()` pattern (`offside.ts`) — structural template for any new staged-repositioning table the new phases need, even though the underlying GK-restart chain itself is not reused.
- `HIGHLIGHT_STYLES`/`RING_STYLES` (`HexCell.tsx`) — existing tint system to map onto for new repositioning windows (D-08), not extend.
- `isPitchHex`/`PITCH_HEXES` boundary data — existing pitch-boundary checking to extend with sideline-vs-byline segment classification (D-05's implementation hook).

### Established Patterns

- `isProcessing` mutex + phase-guard + pure-function-delegate shape for every socket handler (`gameHandlers.ts`) — the new Goal Kick / Throw-In handlers should follow this exactly.
- Phase 35's panel-family visual conventions (border-free containers, "Confirm" verb, two-line helper text, waiting-team phrasing) — default target for the new panels per D-07, though not mandated verbatim.
- The `TACKLE_ATTEMPT`/`STEAL_ATTEMPT` inline-dice-sub-resolution pattern (no forced phase transition) — not directly used by this phase's decisions, but relevant precedent for how "always happens" mechanics are modeled elsewhere in this codebase (useful context, not an instruction).

### Integration Points

- `packages/client/src/components/GameBoard.tsx:328-336` — per-phase panel dispatch; needs new cases for whatever new `GamePhase` values D-01/D-03 introduce for Goal Kick and Throw-In setup.
- `packages/server/src/gameEngine.ts` — `LOOSE_BALL` clamp logic and GK save-spill routing are the two existing out-of-bounds hook points to modify (gated behind the `outOfBoundsEnabled` toggle per OOB-05, preserving today's clamp behavior unchanged when disabled).

</code_context>

<specifics>
## Specific Ideas

- User's exact words for the throw-in sequence structure (D-09): "on throw in - initial actions are standard throw-in, high throw-in, move. If move is selected - next actions are standard throw-in, high throw-in, move. If move is selected again - next actions are standard throw-in, high throw-in" — then clarified that the very first choice is actually forced to a Movement Phase (no throw option before Movement Phase 1 completes), keeping THROWIN-03's "1 or 2" wording intact rather than allowing a zero-movement immediate throw.
- Goal Kick's independence from the GK-restart chain (D-01) is an explicit, deliberate override of the phase research's own recommendation — the user was clear: "Dont reuse the same flow under the hood. New phase + new repositioning + new target + new move chain."
- "Review the provided rules to refine flow" (user's own words, D-01 follow-up) — signal to research/planning to re-derive the exact goal-kick phase sequence carefully from GOALKICK-01..06's literal text rather than defaulting to the cheapest engineering path.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope. Corner Kick (Phase 38) was referenced repeatedly as context/precedent but never proposed as in-scope for this phase.

### Reviewed Todos (not folded)

- **`2026-07-02-bug-kickoff-setup-persistent-light-shading-on-shot-path-hexes.md`** (BUG-23) — matched Phase 37 by generic keyword overlap only (score 0.6, same pattern as it matched Phases 31/35/36 previously). Not raised or discussed this session; remains a highlight-rendering defect unrelated to this phase's scope.
- **`csv-consolidation-player-pool.md`** — matched by generic keyword overlap only (score 0.6). Not raised or discussed this session; a data-pipeline idea unrelated to this phase's scope.

</deferred>

---

_Phase: 37-Out-of-Bounds Detection, Throw-In & Goal Kick_
_Context gathered: 2026-08-03_
