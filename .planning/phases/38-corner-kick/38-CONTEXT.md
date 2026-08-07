# Phase 38: Corner Kick - Context

**Gathered:** 2026-08-07
**Status:** Ready for planning

<domain>
## Phase Boundary

A ball exiting over the defending byline after last being touched by a defending player is awarded and fully playable as a corner kick, matching the physical rulebook's two-window repositioning and header/pass mechanics.

Covers OOB-03, CORNER-01..06. Depends on Phase 37 (out-of-bounds classification, `ball.lastTouchedBy`, the pure `computeCombinedScore`/`HEADER` duel/`computeLooseBall` helpers, and the `resolveThrowInHex`-style occupied-hex handling all already exist). Does not touch Fouls/Cards/Injury/GK-Dive-at-Feet/Penalty Kick (Phase 39) or Substitutions (Phase 40).

</domain>

<decisions>
## Implementation Decisions

### Corner-taker placement geometry

- **D-01:** The corner-taker restarts from a **single fixed hex per corner** (4 total: home-top, home-bottom, away-top, away-bottom) — no placement choice, no click-to-select-arc-hex UI. This directly mirrors Phase 37's `GOAL_KICK_RESTART_HEX` precedent (`packages/shared/src/outOfBounds.ts:46-49`): one deterministic hex per side, resolved through the same occupied-hex relocation pattern (`resolveThrowInHex`) rather than double-stacking. No such "corner-arc hex" constant exists in the codebase today — ROADMAP.md's "one of the corner's existing fixed corner-arc hexes" wording is read as "the corner's fixed hex" (singular, established-going-forward), not as an existing multi-hex selectable set. `DIFFICULT_ANGLE_HEXES` (`packages/shared/src/pitch.ts:103`, 16 hexes/corner, PITCH-03 shooting-penalty zone) is a **different, much larger region** and must NOT be conflated with or reused as the corner-taker restart point.
- **D-02:** Exact coordinates for the 4 fixed corner hexes are Claude's discretion during planning/implementation — pick the nearest on-pitch hex to each physical corner flag, mirror-symmetric home/away (`home.q + away.q === 36`) and top/bottom (matching `PITCH_REGIONS`/`GOAL_R_VALUES` boundary conventions already in `pitch.ts`), consistent with how `GOAL_KICK_RESTART_HEX` was derived from existing formation/goal geometry rather than picked arbitrarily.

### Goalkeeper repositioning (before corner-taker placement)

- **D-03:** The "both goalkeepers may be repositioned first" step (CORNER-01) is **turn-based, attacking manager first** — not simultaneous. This mirrors Goal Kick's already-built sequential turn-order pattern (GK's team, then opponent) exactly, including its panel phrasing convention (`"{Team} is repositioning…"`, Phase 35 D-09). Reuse that same turn-order UI shape rather than building a new simultaneous-submit mechanism.
- **D-04:** This GK reposition step runs **before** the corner-taker is placed (per the roadmap's literal ordering: GK reposition → corner-taker placement + 6-hex window → pre-kick 3-hex window → kick). Sequence is: GK reposition (attacker's GK, then defender's GK) → corner-taker placed at the fixed hex (D-01) → CORNER-03's alternating 6-hex window → CORNER-06's pre-kick 3-hex window → High/Low Pass choice and resolution.

### Alternating 6-hex reposition window (CORNER-03)

- **D-05:** One "round" of the alternating window is **strict pairs**: the attacking manager selects and moves up to 2 pieces (each up to 6 hexes) and confirms, then the defending manager does the same, repeating for up to 3 rounds per side (6 pieces total) — not a free-form "either side moves 1-2 in any order" turn cycle. A manager may move fewer than 2 in a round (or pass) but the turn structure itself (attacker-pair → defender-pair → attacker-pair → …) does not change.
- **D-06:** Whether a manager can end their reposition early (move 0 pieces in a round to skip ahead) vs. must always get the option to move up to 2 before the turn passes is Claude's discretion during planning — follow whatever "Confirm"/pass-through pattern the existing Goal Kick 6-hex reposition window (`GOAL_KICK_SETUP_GK`/`GOAL_KICK_SETUP_OPPONENT`, `packages/shared/src/types.ts:521-522`) already uses for "confirm with 0 moves made."

### Restart chain identity (carried forward from Phase 37 D-01)

- **D-07:** Corner Kick gets its **own new dedicated `GamePhase` values/state chain**, following the exact same precedent Phase 37 set for Goal Kick (`37-CONTEXT.md` D-01) — it is a structurally distinct restart type from both `GK_RESTART` and Goal Kick's new chain, not a reuse of either. Reuse only the **pure helper functions** (`computeCombinedScore`, the `HEADER` duel resolution, `computeLooseBall`, `resolveThrowInHex`'s occupied-hex pattern) — never the state-machine phases/fields themselves (mirrors Phase 37 D-02). Whether Corner Kick's new phases share underlying staged-repositioning _implementation_ patterns (not phase values) with Goal Kick's just-built chain is a planner-level code-organization call, not a user decision — Corner Kick must still read as its own genuinely distinct flow.
- **D-08:** Exact phase-naming (e.g. `CORNER_KICK_GK_SETUP` / `CORNER_KICK_SETUP` / `CORNER_KICK_MOVE` or similar) is Claude's discretion — follow the existing `GOAL_KICK_*` naming convention for consistency.

### Setup-panel visual conventions (carried forward from Phase 37 D-07/D-08)

- **D-09:** New Corner Kick setup panels (GK reposition, corner-taker placement, 6-hex window, pre-kick 3-hex window) follow Phase 35's locked conventions (`"Confirm"` button verb, no container border, two-line title+detail helper text, `"{Team} is repositioning…"` waiting phrasing) by default — adapt only where something genuinely doesn't fit, per Phase 37's identical precedent. Map onto the **existing** hex-highlight tint system (`HIGHLIGHT_STYLES`/`RING_STYLES` in `HexCell.tsx`); do not add new tint types to `docs/HIGHLIGHT-REFERENCE.md` for this phase.

### Claude's Discretion

- Exact coordinates for the 4 fixed corner-taker hexes (D-02).
- Whether a manager can pass early with 0 moves during an alternating round (D-06).
- Exact `GamePhase`/`GameState` field naming for the new Corner Kick chain (D-08).
- Exact adherence-vs-adaptation balance for Corner Kick panel styling relative to Phase 35 conventions (D-09).
- Internal code-sharing between Goal Kick's and Corner Kick's staged-repositioning implementations, so long as Corner Kick's phase values/state remain genuinely its own (D-07).

</decisions>

<canonical_refs>

## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & roadmap

- `.planning/REQUIREMENTS.md` (OOB-03, CORNER-01..06 sections, lines 69-74, 88) — locked requirement text for this phase
- `.planning/ROADMAP.md` (Phase 38 section) — phase goal, 4 success criteria, dependency on Phase 37
- `.planning/STATE.md` — v1.6 "Decisions Locked" section (`ball.lastTouchedBy` field, per-event-type Undo/Replay registration pitfall, "audit each of 5+ independent clamp-to-pitch call sites individually" pitfall) — all apply to this phase too

### Phase 37 precedent (structural template + explicit override to follow again)

- `.planning/phases/37-out-of-bounds-detection-throw-in-goal-kick/37-CONTEXT.md` D-01/D-02 — the "new dedicated chain per restart type, reuse only pure helpers" precedent this phase's D-07 explicitly re-applies
- `.planning/phases/37-out-of-bounds-detection-throw-in-goal-kick/37-VERIFICATION.md` — confirms Goal Kick's final shipped shape (5-phase flow, sequential 6-hex reposition GK's-team-first, Kick-vs-Standard-Pass choice, header-contest radius preview) as the closest working reference implementation

### Existing code (out-of-bounds hook point, restart-hex precedent, corner-zone data)

- `packages/server/src/gameEngine.ts:3193-3218` — `triggerOutOfBoundsRestart`'s `if (restart === 'CORNER_KICK') return null;` early-return is the exact, explicitly-commented Phase 38 hook point ("place to add `CORNER_KICK_*` when that restart family exists")
- `packages/shared/src/outOfBounds.ts:46-49, 108-125` — `GOAL_KICK_RESTART_HEX` (fixed-hex precedent for D-01/D-02) and `classifyOutOfBounds`'s existing `'CORNER_KICK'` result (already returned correctly for byline exits after a defending touch — OOB-03's classification half is already done, only the restart-trigger half remains)
- `packages/shared/src/pitch.ts:96-189` — `DIFFICULT_ANGLE_HEXES` (the shooting-penalty zone that must NOT be conflated with the new corner-taker restart hex, per D-01) and the region-definition pattern (`buildRegion`, mirror-symmetric q/r construction) to follow when defining the 4 new corner-taker hexes
- `packages/shared/src/types.ts:130-131, 460-467, 521-525` — `GOAL_KICK_CHOICE`/`GOAL_KICK_MOVE` phase values and their `GameState` fields, the direct naming-convention template for D-08
- `packages/client/src/components/GoalKickSetupPanel.tsx` (dispatched at `GameBoard.tsx:348`) — closest existing component analog for the new Corner Kick setup panels' structure, turn-order UI, and styling

### Visual/UX conventions (Phase 35, carried forward per D-09)

- `.planning/milestones/v1.5-phases/35-actionpanel-log-standardization/35-CONTEXT.md` — locked ActionPanel/panel-family conventions referenced by D-09
- `docs/HIGHLIGHT-REFERENCE.md` — single source of truth for hex-tint types; D-09 requires reusing existing entries, not adding new ones

No other external specs/ADRs apply beyond the above — requirements are fully captured in the Decisions section.

</canonical_refs>

<code_context>

## Existing Code Insights

### Reusable Assets

- `computeCombinedScore` (`scoreUtils.ts`) — the 8+ accuracy check for both High Pass and Low Pass corner resolution (CORNER-04), same function Goal Kick already calls.
- `HEADER` duel resolution — reused verbatim for a High Pass corner's mandatory header (CORNER-05).
- `computeLooseBall` — reused for an inaccurate corner kick, same as Goal Kick/Throw-In.
- `resolveThrowInHex`-style occupied-hex relocation — reused for the fixed corner-taker hex when occupied (D-01/D-02).
- `GOAL_KICK_RESTART_HEX` construction pattern — direct template for the new 4-entry fixed corner-hex constant (D-02), including its mirror-symmetry test convention (`outOfBounds.test.ts` asserts against derived geometry, not restated literals).

### Established Patterns

- `isProcessing` mutex + phase-guard + pure-function-delegate shape for every socket handler (`gameHandlers.ts`) — the new Corner Kick handlers should follow this exactly, same as Goal Kick/Throw-In did.
- Goal Kick's sequential turn-order reposition pattern (GK's team first, then opponent) — direct template for D-03's GK-reposition step and D-05's alternating-pairs window (extended to 2-piece batches instead of Goal Kick's full-6-then-opponent's-full-6).
- Phase 35's panel-family visual conventions — default target for new panels per D-09.

### Integration Points

- `packages/client/src/components/GameBoard.tsx:328-348` — per-phase panel dispatch; needs new cases for whatever new `GamePhase` values D-07/D-08 introduce for Corner Kick.
- `packages/server/src/gameEngine.ts:3218` — the single, explicitly-marked hook point where the `CORNER_KICK` classification result currently dead-ends; replace the early return with the new trigger logic.

</code_context>

<specifics>
## Specific Ideas

- User confirmed all three recommended options directly (single fixed corner hex, turn-based GK reposition attacker-first, strict-pairs alternating window) — no deviation from the precedent-consistent defaults proposed during discussion, and no further gray areas were raised.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

### Reviewed Todos (not folded)

- **`2026-07-02-bug-kickoff-setup-persistent-light-shading-on-shot-path-hexes.md`** (BUG-23) — matched Phase 38 by generic keyword overlap only (score 0.6, same pattern as it matched Phases 31/35/36/37 previously). Not raised or discussed this session; remains a highlight-rendering defect unrelated to this phase's scope.
- **`csv-consolidation-player-pool.md`** — matched by generic keyword overlap only (score 0.6). Not raised or discussed this session; a data-pipeline idea unrelated to this phase's scope.

</deferred>

---

_Phase: 38-Corner Kick_
_Context gathered: 2026-08-07_
