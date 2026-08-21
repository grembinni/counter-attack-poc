# Architecture Research — v1.7 Integration

**Domain:** Feature integration into an existing shipped Node.js/Socket.io + React monorepo (real-time hex-grid football game)
**Researched:** 2026-08-21
**Confidence:** HIGH (grounded in direct reads of the cited files/lines; no speculative APIs)

This is not greenfield architecture research — it answers "where do v1.7's 6 features plug into the existing system, in what order, and what's the concrete root cause of the reported red-card/deflection bug." All claims below are backed by file/line references from the current codebase (read 2026-08-21).

## Existing Architecture Recap (as verified, not assumed)

```
GameSettingsScreen.tsx (client)
   │  onConfirm({speed, teamType, draftPools, outOfBounds, fouls, booking, injury})
   ▼
ROOM_SETTINGS_CONFIRM handler — packages/server/src/roomHandlers.ts:410-580
   │  allow-list validates each field, then:
   │  room.outOfBoundsEnabled = outOfBounds   (roomHandlers.ts:549)
   │  room.foulsEnabled       = fouls          (:550)
   │  room.bookingEnabled     = fouls && booking (:555, server-side re-normalize — never trust client)
   │  room.injuryEnabled      = fouls && injury  (:556)
   ▼
Room (packages/server/src/roomStore.ts:80-121) — optional `?:` fields, each documented
   "undefined = not yet confirmed, treated as false when building game state"
   ▼
LINEUP_CONFIRM handler — packages/server/src/roomHandlers.ts:939-957 — the ONE call site
that builds the real match GameState:
   buildInitialGameState(roomCode, selectedTeams, gameSpeed, uniforms, formations,
     jerseyTypes, confirmedHomeOrder, confirmedAwayOrder,
     room.outOfBoundsEnabled ?? false, room.foulsEnabled ?? false,
     room.bookingEnabled ?? false, room.injuryEnabled ?? false,
     confirmedHomeBench, confirmedAwayBench)
   ▼
buildInitialGameState — packages/server/src/gameEngine.ts:351-430 — every toggle is a
positional parameter with a `= false` default (never breaks old callers/tests), baked
into the returned GameState as a same-named field (`state.foulsEnabled`, etc.)
   ▼
GameState (packages/shared/src/types.ts) — broadcast in full on every action
(`broadcastState`, no deltas) — client Zustand store (`useGameStore.ts`) replaces
`gameState` wholesale on every `GAME_STATE` event.
```

Two other recurring idioms this research leans on:

- **Two-button decision-prompt family**: `FoulChoicePanel.tsx`, `GkDiveAtFeetPromptPanel.tsx`, `GkBoxEntryPromptPanel.tsx`. Shape: a `GameState` field names the deciding team (e.g. `gkDiveAtFeetTeam`), a `*Resume` snapshot field (`{phase, activeTeam, movementSlot}`) restores play after the prompt resolves, a two-button panel checks `myTeam !== decidingTeam` to render a waiting message instead of buttons, and a paired `_DECLINED` `ActionEventType` exists for the "no" branch (e.g. `GK_DIVE_AT_FEET_DECLINED`).
- **New-event-type registration hazard** (explicitly flagged as a recurring bug class in this codebase, and independently confirmed by reading the code): every new `ActionEventType` must be added to at minimum: `formatEvent`'s switch (`packages/client/src/components/ActionLog.tsx:343`), `REPLAY_ELIGIBLE_TYPES` (`packages/server/src/gameEngine.ts:9522`), and `applyUndo`'s `isBoundary` disjunction if the event should clamp/gate Undo (`packages/server/src/gameEngine.ts:3238-3300`). `GameBoard.tsx`'s `PHASE_LABEL` map needs a new entry for every new `GamePhase`. Any v1.7 feature that adds a phase or event type (features 4, 5, and optionally 6) must budget for touching all of these.

---

## Feature 1 — Referee Leniency Manual Override

**Integration point:** Follows the exact toggle-propagation path above, byte-for-byte, with one addition: `refereeCard.leniency` is currently assigned unconditionally at `buildInitialGameState` (`packages/server/src/gameEngine.ts:422`, `refereeCard: { leniency: randomInt(1, 7) }`). This is the ONLY construction site for `refereeCard` in the real game-start path (test fixtures hardcode it directly, which is irrelevant to production wiring).

**New vs. modified:**

- **New:** `refereeLeniencyOverride?: number | null` on the `ROOM_SETTINGS_CONFIRM` payload and on `Room` (mirrors `outOfBoundsEnabled?: boolean` at `roomStore.ts:103`, except this is a `number | null`, not boolean — validate as `typeof === 'number' && Number.isInteger(v) && v >= 2 && v <= 5`, matching the requirement's 2–5 manual range, distinct from the 1–6 random range).
- **New:** a `manualLeniency` checkbox + numeric stepper (2–5) in `GameSettingsScreen.tsx`, in the same "Match Rules" section block as Fouls/Booking/Injury (`GameSettingsScreen.tsx:170-194`), bundled into the same `onConfirm` object the existing 3 booleans already use (`GameSettingsScreen.tsx:22-34`).
- **Modified:** `buildInitialGameState`'s signature gains one more optional trailing parameter (mirrors the existing `outOfBoundsEnabled/foulsEnabled/bookingEnabled/injuryEnabled` chain at `gameEngine.ts:371-399` — each documented "defaults to X so no existing GameState construction site breaks"). Line 422 becomes:
  `refereeCard: { leniency: refereeLeniencyOverride ?? randomInt(1, 7) }`.
- **Does NOT need a new field to "coexist" with `RefereeCard.leniency`** — the override replaces the random roll at the single assignment site; there is no second reader of leniency to reconcile (bookings read `state.refereeCard.leniency` uniformly at `gameEngine.ts:922,930` and `:2537` for added time, unaware of whether it was rolled or overridden). This is the simplest possible integration: one nullable parameter threaded through the same pipe as the other 4 toggles, no schema fork.

**Gotcha:** `roomHandlers.ts` has TWO `buildInitialGameState`-adjacent call sites reading Room toggles (`:240-245` in the ROOM_JOIN gate's echo of `ROOM_SETTINGS_CONFIRMED`, and `:951-954` at the real build site) — the echo at `:236-245` re-emits the confirmed settings to a late joiner; a `refereeLeniencyOverride` value must be added to that emit tuple too or a reconnecting/late-joining client's settings echo will be silently incomplete (this exact "two echo call sites" shape is already present for `outOfBounds/fouls/booking/injury`, so mirroring it correctly means touching both, not just the real build site).

---

## Feature 2 — Unified Card/Injury Iconography

**Current state (confirmed duplication, not a superficial one):** the "compute card/injury visual state from a `PlayerPiece`" logic is independently re-implemented at 3 sites with the identical ternary (`piece.redCarded === true ? 'red' : (piece.yellowCards ?? 0) > 0 ? 'yellow' : null`), but rendered in TWO structurally different ways:

1. **SVG primitives** — `packages/client/src/components/PieceOverlay.tsx:233-292`: card = an SVG `<rect>`, injury = a hand-built plus-sign from two `<rect>`s inside a `<g data-testid="piece-injury-badge">`. This is the pitch piece overlay, embedded inside the single `HexGrid` `<svg>` document.
2. **DOM chips** — `packages/client/src/components/PlayerStatsPanel.tsx:151` and `packages/client/src/components/LineupAssignmentScreen.tsx:455` (the `LineupStatCard` used for roster/bench/lineup cards): a plain `<span data-testid="stats-card-chip" data-card={cardColor}>YELLOW/RED</span>` text chip plus a separate `INJ`/`INJ ×2` chip (`LineupAssignmentScreen.tsx:249-258`), styled via CSS Modules — no SVG at all.

**Why this can't be "one shared SVG `<symbol>`/`<defs>` block":** the project's own Phase 12 decision (cited in CLAUDE.md) is that SVG `<defs>` must be self-contained per `<svg>` document because `url(#id)` cross-document references don't resolve reliably in this codebase's rendering setup. That decision is moot here anyway — half of the 3 call sites (`PlayerStatsPanel`, `LineupStatCard`) aren't inside an `<svg>` at all; they're CSS-Module `<div>`/`<span>` cards. A shared `<defs>`/`<use>` symbol can only serve the pitch overlay, not the DOM cards.

**Recommended integration point:** a new shared **React component**, e.g. `packages/client/src/components/CardInjuryBadge.tsx`, exporting a pure function of `{ cardColor: 'yellow'|'red'|null, injuryCount: number }` that renders small self-contained SVG markup (a `<svg viewBox="0 0 W H">` wrapper with its own inline shapes — consistent with the Phase 12 "self-contained per document" rule, since each usage gets its own tiny `<svg>`, no sharing needed). Two consumption modes:

- **Inline in the pitch `<svg>`:** `PieceOverlay.tsx` swaps its current inline `<rect>`/`<g>` block (`:233-292`) for `<CardInjuryBadge cx={badgeCx} cy={badgeCy} r={badgeR} cardColor={cardColor} injuryCount={piece.injuryCount ?? 0} />`, where the component returns a `<g>` fragment (not a nested `<svg>`) so it composes directly into the parent SVG's coordinate space — this preserves the existing badge geometry/positioning logic untouched.
- **Standalone in DOM cards:** `PlayerStatsPanel.tsx` and `LineupAssignmentScreen.tsx`'s `LineupStatCard` (and, per the milestone's explicit ask, `BenchCarousel.tsx`, which currently only receives pre-filtered `redCardedPlayerIds`/`unavailablePlayerIds` string arrays and renders its own badge, not card/injury) replace their DOM `<span data-card>`/`INJ` chip markup with `<CardInjuryBadge cardColor={...} injuryCount={...} size={N} />` wrapped in its own small fixed-size `<svg>`, positioned "between name and flag, or after flag" per the requirement's copy.

**New:** `CardInjuryBadge.tsx` (+ `.test.tsx`).
**Modified:** `PieceOverlay.tsx` (replace inline badge JSX with the component), `PlayerStatsPanel.tsx`, `LineupAssignmentScreen.tsx` (`LineupStatCard`'s header layout — `:236-260`), `BenchCarousel.tsx` (currently has no card/injury rendering at all — needs `cardColor`/`injuryCount` props threaded in from its caller, which already computes `redCardedPlayerIds` at `LineupAssignmentScreen.tsx:779-781` and could compute the fuller per-card state the same way).

**Sequencing note:** this should land BEFORE or ALONGSIDE Feature 4 (substitution UX overhaul), because Feature 4's bench card rework and its red-card-badge requirements ("red-carded players show on the bench as a red-card marker") are the same visual surface — building the shared badge component first means Feature 4 consumes it rather than inventing a 4th ad-hoc badge implementation.

---

## Feature 3 — Advanced Settings Drawer

**Current state:** `GameSettingsScreen.tsx` is a single flat `<div className={styles.card}>` with 4 sequential `<div className={styles.section}>` blocks (Match Speed, Team Type, Match Rules, Draft Pool) — no collapsible/grouped structure exists today. The "Match Rules" section (`:170-194`) already contains the Fouls/Booking/Injury/Out-of-Bounds toggles plus the dependency-greyout logic: `toggleBooking`/`toggleInjury` early-return when `!fouls` (`:90-99`), and the JSX applies `styles.poolRowDisabled` + a `disabled` attribute + a "(requires Fouls)" hint whenever `!fouls` (`:176-185`). This logic is entirely local `useState` + plain conditionals — no external state machine to fight.

**Integration approach:** wrap the "Match Rules" section's existing 4 toggle rows (plus the 2 new v1.7 toggles — Referee Leniency override and Tackle/Steal decline — see Features 1 and 5) in a new collapsible `<Advanced>` subsection, rendered with local `useState<boolean>` for open/closed (same pattern as every other piece of local UI state in this component — no store involvement needed, this is pre-game-only UI). The dependency-greyout logic (`toggleBooking`/`toggleInjury`/the disabled-row rendering) is **unaffected by the collapse** — it operates on the same `fouls`/`booking`/`injury` state variables regardless of whether the section is visually collapsed; collapsing only changes whether the section's DOM is rendered/visible, not the toggle logic itself. The 2-column layout is a pure CSS Grid change in `GameSettingsScreen.module.css` (`grid-template-columns: 1fr 1fr` on the drawer's row container) — no component logic changes required beyond wrapping the existing `<label className={styles.poolRow}>` rows in a grid container.

**New:** a small `<AdvancedSettingsDrawer>` presentational wrapper (or just inline `useState` + conditional render inside `GameSettingsScreen.tsx` — given this is single-use, a separate component is optional; Claude's discretion at planning time based on how many toggles end up inside it, currently 6: Fouls, Booking, Injury, Out-of-Bounds, Referee Leniency, Tackle/Steal Decline).
**Modified:** `GameSettingsScreen.tsx` (`:170-194` section restructure), `GameSettingsScreen.module.css` (2-column grid).

**Build-order dependency:** this should land AFTER Features 1 and 5 add their toggle state/UI (or the drawer is built with placeholders and the two new toggles slot in later) — the 2-column layout and the drawer both want to size themselves against the final toggle count (4 existing + 2 new = 6), not be reworked twice.

---

## Feature 4 — Substitution UX Overhaul (largest feature; includes the live bug root cause)

### 4a. Default mode: rework `mode='midmatch'`, don't fork it

**Current state:** `LineupAssignmentScreen.tsx`'s `mode === 'midmatch'` branch (`:740-843`) is a SINGLE interaction model today: bench cards are draggable, on-pitch cards are hardcoded non-draggable (`isDraggable = isMidmatch ? false : ...`, `LineupAssignmentScreen.tsx:186-190`, with an explicit comment: "bench->pitch is the only substitution gesture"), and every on-pitch card's `onDrop` handler unconditionally calls `onSubstitute?.(piece.id, inPlayerId)` (`:477-491`). There is no existing "position-repositioning" interaction at all in this screen — v1.7's default mode is net-new, not a variant of something that exists.

**Recommended shape — (a) rework the existing `mode='midmatch'` screen's default interaction, with substitution as an explicit sub-mode, NOT (b) a second parallel screen.** Reasons:

- The screen already owns all the state needed (live pieces, bench, sub cap, red-card badges) — a second screen would duplicate `renderMidmatchColumn`, the bench rendering, and the rejection-message wiring (`:317-351`) wholesale.
- The requirement explicitly describes ONE screen with a mode TOGGLE ("substitution triggered via an action button... button becomes Cancel in substitution mode"), not a screen swap.
- The existing `isDraggable`/`isMidmatch` boolean split (`LineupStatCard`, `:181-190`) is exactly the seam to extend: today it's a 2-way branch (pregame vs. midmatch); it becomes a 3-way branch (pregame / midmatch-reposition / midmatch-substitute).

**Concrete integration:**

- **New local state** in `LineupAssignmentScreen.tsx`: `const [subMode, setSubMode] = useState(false)` (or richer, e.g. `'reposition' | 'substitute'`), gated additionally by "disabled when an action is selected" — this needs a new prop threaded from the parent (`App.tsx`/wherever this screen is mounted) reflecting whether a game action is currently mid-flight (likely derivable from existing `useGameStore` phase/selection state — e.g. `room.gameState.phase !== 'MOVE base idle'` or an existing "is an action pending" selector; needs a planning-time check of `useGameStore.ts`'s selection-state fields to pick the exact guard).
- **`renderMidmatchColumn`'s on-pitch card behavior forks on `subMode`:**
  - `subMode === false` (default): on-pitch cards become draggable (`isDraggable` for midmatch needs a new `allowReposition` prop, since today it's a hard `false`), bench cards become non-draggable (bench "not selectable" per the requirement), and `onDrop` on an on-pitch card calls a NEW `onReposition?.(pieceIdA, pieceIdB)` callback instead of `onSubstitute`.
  - `subMode === true`: reverts to today's exact behavior — on-pitch non-draggable, bench draggable, drop calls `onSubstitute`, "only 1 sub selectable per action" (a local `useState` lock similar to `midmatchDragPlayerId`, already present at `:432`).
- **New action button + Cancel toggle:** a new button (disabled at 3 subs used — `subsUsedVal >= 3`, data already present at `:743,796-802`) that flips `subMode`; when `subMode === true` the same button relabels to "Cancel" and reverts `subMode` to `false` on click.
- **Confirmation modal:** "confirmation popup states player off/player on" — new, since today `onSubstitute` fires immediately on drop with no confirm step (`:489-490` fires straight through). This is a client-only staging step: on drop, stash `{outPieceId, inPlayerId}` in local state instead of calling `onSubstitute` immediately, render a small modal with the two names (resolvable via the existing `pieces`/bench lookups already in scope), and only call `onSubstitute` on modal confirm.
- **Banner/Resume-button visuals** ("side banner background turns green when editable," "green Resume button replaces the small close (X)") are pure CSS Module + conditional-render changes in whatever wraps this screen (likely `App.tsx`'s panel chrome) — needs a planning-time look at that wrapper, not found in the files read for this research.

**New:** `onReposition` prop + handler wiring on `LineupAssignmentScreen`, a new server round-trip (`GAME_ROSTER_REPOSITION` client event, mirrored on the server), a confirmation-modal sub-component, `subMode` local state.
**Modified:** `LineupStatCard`'s `isDraggable` derivation (`:181-190`), `renderMidmatchColumn` (`:448-499`), the mid-match `BenchCarousel` `disabled` wiring (`:827` currently only keys off `readOnly`, needs to also key off `subMode === false`).

### 4b. Server-side: a new pure function mirroring `applySubstitution`

**Pattern to mirror exactly** (`packages/server/src/gameHandlers.ts:1724-1806`, the `GAME_SUBSTITUTION` handler): gate on `isStoppagePhase(room.gameState.phase)` (`packages/shared/src/stoppagePhases.ts:59`, the shared allow-list — SUB-01's precedent explicitly says "never a locally re-declared array"), use `socketTeam(socket)` not `isActivePlayer` (substitutions are NOT turn-bound — a manager can act during a stoppage regardless of `activeTeam`; the on-pitch reposition swap should follow the identical rule, since it's the same class of "roster admin, not a game turn" action), validate the untrusted payload shape defensively before any lookup, delegate to a new pure `applyRosterReposition(state, team, pieceIdA, pieceIdB)` in `packages/server/src/gameEngine.ts` (mirrors `applySubstitution`'s location and shape — not `applyMove`, since this is not a hex-adjacency move, it's a same-team on-pitch position swap gated to stoppages only), and reject a `redCarded === true` piece on either side (mirrors `applyMove`'s `CARD-02/CARD-04` guard at `gameEngine.ts:1066-1071`).

**New `ActionEventType`:** e.g. `'ROSTER_REPOSITION'` — triggers the full new-event-type registration checklist (see the recap section above): `formatEvent` in `ActionLog.tsx:343`, `REPLAY_ELIGIBLE_TYPES` in `gameEngine.ts:9522`, and a decision on whether it's an Undo boundary (`applyUndo`'s disjunction, `gameEngine.ts:3238-3300` — probably NOT a boundary, since it's a stoppage-time admin action outside the movement-slot undo model entirely, closer to `SUBSTITUTION` which also isn't referenced in the boundary list).

### 4c. Live bug — root cause investigation: "red card players are still on field and triggered deflection"

**Verdict: confirmed, concrete, reproducible root cause found. It is NOT in `applyRosterContinuity`, NOT in the client's `onPitch === false` render-skip (both of those are correctly implemented), and NOT primarily in the interactive `SNAPSHOT_DEFLECT` move-selection gate (that one is masked client-side, see below) — it is in the SERVER-SIDE deflection-defender-set builder, which operates on raw `state.pieces` positions with no rendering gate at all.**

**What IS correct (ruled out):**

- `applyRosterContinuity` (`gameEngine.ts:3201-3210`) spreads `{...currentPiece, position: resetPiece.position}` — i.e. it takes `redCarded`/`onPitch`/`yellowCards`/`injuryCount` from the LIVE roster and only overwrites `position` from the freshly-rebuilt kickoff formation. This correctly preserves `onPitch: false` across every goal/half-time reset. All 7 call sites (4 in-engine: `gameEngine.ts:4309, 4405, 7516, 9384`; 3 handler-side: `gameHandlers.ts:1407, 2407, 3866`) pass the arguments in the correct `(resetPieces, currentPieces)` order.
- `HexGrid.tsx:761` (`if (piece.onPitch === false) return null;`) unconditionally skips rendering AND skips every downstream `canSelect*` derivation for that piece, since all `canSelect*` flags (`canSelectSnapDeflect`, `canSelectHighPassMove`, etc., `:830-870`) are computed AFTER this early return in the same `.map()` callback. A piece with `onPitch: false` genuinely cannot be clicked/selected in `HexGrid` for any interactive response-move step, including `SNAPSHOT_DEFLECT`.
- Booking resolution (`gameEngine.ts:939-953`) sets `redCarded: true` AND `onPitch: false` together, atomically, in the same `pieces.map()` — there is no code path that sets one without the other.

**What IS the bug — two confirmed sites, same bug class, purely server-side and positional:**

`packages/server/src/gameHandlers.ts:1285-1287` (SNAPSHOT_DEFLECT deflection-defender-set builder) and `packages/server/src/gameHandlers.ts:2288-2289` (regular SHOT-phase deflection-defender-set builder, explicitly commented "same pattern as GAME_SHOT") both build their eligible-defender list like this:

```ts
for (const defender of baseSnapState.pieces.filter(
  (p) => p.teamId === defendingTeam && p.role !== 'GK',
)) {
  const onPath = pathSet.has(`${defender.position.q},${defender.position.r}`);
  // ... nearPath check against defender.position ...
  if (onPath || nearPath) {
    snapDefInputs.push({ defenderId: defender.id, defenderPosition: defender.position, ... });
  }
}
```

Neither filter excludes `p.redCarded === true` (nor `p.onPitch === false`). This is purely a **positional** check against `state.pieces` — it never touches rendering, never touches the interactive `canSelectSnapDeflect` gate, and requires no user action to trigger.

By design (`types.ts:66-76`, the `onPitch` doc comment, and `gameEngine.ts:1066-1071`'s comment on `applyMove`'s red-card rejection), a red-carded `PlayerPiece`'s `position` field is **deliberately never nulled out** — it stays a real on-pitch `HexCoord` forever (only `onPitch: false` suppresses rendering; `redCarded` is what gates move/selection eligibility everywhere else). So a dismissed player's stale position can legitimately sit on or adjacent to a later shot's `hexLine(shooter.position, target)` path. When it does, this filter happily includes it in `snapDefInputs`/`defInputs`, rolls it a real deflection die (`rollDice()`, `gameHandlers.ts:1303` / presumably the twin line near `:2306`), and — if the die qualifies (Set A: 5, 6, or die+tackling≥10) — resolves the shot as **deflected by a player who is invisible on both clients' boards**. This exactly matches the reported symptom: the dismissed player is (correctly) not rendered, yet a shot passing through their frozen position gets blocked as if they were still there.

**This is the same bug class the "Debug red-card-bench-removal-scope (Part 1)" session already fixed at several other eligibility sites** (`gameEngine.ts` grep hits: `applyMove`'s explicit rejection at `:1069`, the corner-kick-taker filter at `:5738` ("... and `redCarded !== true`"), the penalty/free-kick eligible-ids filter at `:6323`, and the general note at `:6942/6956`, "`redCarded` pieces are excluded from both lists") — but that pass evidently never reached `gameHandlers.ts`'s two deflection-defender-set builders, since they build their filter inline in the handler rather than through one of the shared `gameEngine.ts` eligibility helpers that were audited.

**Fix shape (for the eventual bug-fix plan, not prescribed here as final):** add `&& p.redCarded !== true` (or `p.onPitch !== false`, either is sufficient given they're always set together) to both filters at `gameHandlers.ts:1286` and `:2289`. This is a 2-line, low-risk, mechanically identical fix at both sites — no new event types, no state shape changes.

**Secondary, lower-severity finding (same bug class, currently masked, worth fixing in the same pass for defense-in-depth):** the shared `validateResponseMoveStep` guard sequence (`gameHandlers.ts:273-329`), used by `HIGH_PASS_MOVE`, `GK_KICK_MOVE`, `FIRST_TIME_PASS_MOVE`, `SNAPSHOT_DEFLECT`, and `GOAL_KICK_MOVE`, never checks `piece.redCarded`/`onPitch` — nor do the matching client-side `canSelectSnapDeflect`/`canSelectHighPassMove`/`canSelectGKKickMove`/`canSelectGoalKickMove`/`canSelectFirstTimePassMove` gates in `HexGrid.tsx:830-870` (contrast with `canSelectCornerKickTaker`, which DOES check `piece.redCarded !== true`, `HexGrid.tsx:~939`). Today this is masked because `HexGrid.tsx:761`'s render-skip prevents ever clicking a dismissed piece through the normal UI — but it means `validateResponseMoveStep` has no server-side defense-in-depth against a modified client attempting to move a dismissed piece into one of these 5 response-move slots. Given `applyMove`'s equivalent regular-Movement-Phase guard exists specifically because "a modified client bypassing the client-side gate" was the exact rationale documented for the sibling `BUG-32` GK-exclusion check right next to this code (`gameHandlers.ts:526-533`), this is worth closing in the same plan as the primary fix.

**Build-order implication:** this bug fix has NO dependency on any other v1.7 feature (it's a pure server-side eligibility-filter correction) and should be scheduled early/independently — it's a data-correctness bug, not a UX feature, and fixing it does not block or get blocked by the substitution-screen rework in 4a/4b.

---

## Feature 5 — Tackle/Steal Prompt-and-Decline Toggle

**Current state (confirmed — no prompt step exists today):** the entire tackle/steal duel is resolved atomically, synchronously, inside the single `GAME_MOVE` handler (`gameHandlers.ts:456-940`). Dice are pre-rolled unconditionally on every `GAME_MOVE` (`stealDie/tackleDie/carrierDie/injuryDie/bookingDie`, `:908-916`) and handed into `applyMove`, which internally decides via `validateMove`'s returned `effect` (`moveValidator.ts:28-41,92-124`) whether a `STEAL_ATTEMPT`/`TACKLE_ATTEMPT` actually consumes them. There is currently **no point at which a player is asked anything** — the defender's die is rolled and the outcome applied the instant the attacker's move lands. This means "prompt defender, allow decline" is a genuinely new interaction step, not a variant of an existing one.

**Answer to the question's three options: it should be a new `GamePhase` + new two-button player-response prompt — mirroring the existing `GK_DIVE_AT_FEET_PROMPT`/`GkDiveAtFeetPromptPanel` family exactly, not a pure client-side confirmation.** A client-only confirm-before-emit cannot satisfy "keep the risk ring active so the defender can be prompted again on a later move step," because the exclusion tracking (`stealAttemptedByIds`/`tackleAttemptedByIds`) is a server-authoritative `GameState` field consulted by `validateMove` (`moveValidator.ts:99,120`) — whether a defender is added to that exclusion list on decline has to be a server decision, and the server currently has no decline concept to hook into.

**Concrete integration, mirroring `GkDiveAtFeetPromptPanel`'s established shape:**

- **New `GameState` fields**, modeled on `gkDiveAtFeetTeam`/`gkDiveAtFeetResume` (`types.ts:1670-1686`): something like `tackleStealPromptTeam`, `tackleStealPromptDefenderId`, `tackleStealPromptCarrierId`, `tackleStealPromptKind: 'STEAL'|'TACKLE'`, and a `tackleStealPromptResume: { phase, activeTeam, movementSlot }` snapshot.
- **New `GamePhase`** (e.g. `TACKLE_STEAL_PROMPT`) entered from `applyMove` INSTEAD OF auto-resolving, but only when the new toggle (`tackleStealDeclineEnabled`, threaded through the exact same Settings→Room→`buildInitialGameState` pipeline as Features 1/3, default toggle-on client-side but defaulting the engine parameter to `false` — mirroring `outOfBoundsEnabled`'s documented split: "the SERVER-side default in buildInitialGameState deliberately stays false — this is a client-only UX default," `GameSettingsScreen.tsx:53-55`) is on. When off, `applyMove` keeps its exact current auto-resolve behavior — this toggle must be fully backward-compatible with every existing tackle/steal test.
- **New client event** (e.g. `GAME_TACKLE_STEAL_CHOICE`, payload `'attempt' | 'decline'`), handled server-side mirroring `GAME_GK_DIVE_AT_FEET`'s handler shape.
  - `'attempt'`: runs the SAME dice-roll-and-resolve logic currently inline in the `GAME_MOVE` handler (worth extracting to a shared helper at this point, since it will now be called from two places — the instant-resolve path when the toggle is off, and the deferred-resolve path after `'attempt'`), resumes from the snapshot.
  - `'decline'`: the attacker's move still completes (piece occupies the destination hex; ball moves with them if carrier) but no dice are rolled and no duel event is appended. Critically, the declining defender is **NOT** added to `stealAttemptedByIds`/`tackleAttemptedByIds` — this is the mechanism that satisfies "risk ring stays active": `validateMove`'s exclusion check (`moveValidator.ts:99,120`) re-evaluates fresh on every subsequent move click, so the same ZoI/adjacency condition can retrigger the prompt again on the attacker's next step.
- **New two-button panel**, e.g. `TackleStealPromptPanel.tsx`, structurally identical to `GkDiveAtFeetPromptPanel.tsx` (`:20-123`): deciding team = the defending team (owner of the prompted defender), waiting-message branch for the other manager, `Attempt`/`Decline` buttons.
- **New `ActionEventType`** for the decline branch (e.g. `TACKLE_STEAL_PROMPT_DECLINED`, mirroring `GK_DIVE_AT_FEET_DECLINED`) — same registration checklist as Feature 4's new event type applies here (`formatEvent`, `REPLAY_ELIGIBLE_TYPES`; likely NOT an Undo boundary, mirroring `GK_DIVE_AT_FEET_DECLINED`'s omission from the boundary list at `gameEngine.ts:3238-3300`).

**Build-order note:** this is architecturally independent of Feature 4 (different phases, different event types, different panels) but shares the "new prompt phase + resume snapshot + paired panel" skeleton closely enough that doing Feature 5 either right before or right after studying/building Feature 4's server-side reposition action (4b) is efficient — the `applyRosterReposition` stoppage-gating pattern and the `TACKLE_STEAL_PROMPT` phase-gating pattern are different in kind (stoppage-allow-list vs. movement-phase interrupt) but both extend the same "new phase, new event type, new event-type registration checklist" work.

---

## Feature 6 — Match Summary / Stats Popup with xG

**The tension to resolve:** this codebase has **both** patterns in active use, and the milestone's own decisions log entry cited in the prompt (`ball.lastTouchedBy` chosen over an `eventLog` scan "because one authoritative field is simpler to reason about than re-deriving possession history") is about a **hot-path, per-action** derivation (out-of-bounds classification runs on every ball touch). The Game Summary popup is explicitly the opposite shape: "reachable via an (i) icon... at any time" — an on-demand, low-frequency, display-time read, not a hot path. That difference matters for which half of the codebase's existing precedent actually applies.

**Recommended hybrid, not a single uniform approach:**

1. **Continuously-incrementing counters on `GameState`, mirroring `subsUsed`/`addedTimeBonus`'s exact shape** (`types.ts:1730-1744`: optional `?:` fields, `?? 0` defaults at every read site, incremented inline at the specific engine transition that produces them) for stats that are naturally "increment by 1 at a specific, already-existing code location" and would be expensive/awkward to re-derive from a growing `eventLog` on every popup open: possession-attributable action counts (feeds possession %), pass attempts/completions (increment inside the existing `STANDARD_PASS`/`HIGH_PASS`/`FIRST_TIME_PASS`/`LONG_BALL` resolution branches in `gameEngine.ts`), tackle/steal attempts and successes (increment inside the existing `TACKLE_ATTEMPT`/`STEAL_ATTEMPT` resolution — which already discriminates `result: 'SUCCESS'|'FAIL'` in the `ActionEvent` shape, `types.ts:266-285`), and foul/card counts (increment inside `resolveFoulChain`, which already has dedicated `FOUL_CALLED`/`INJURY_CHECK`/`BOOKING_CHECK` branches at `gameEngine.ts:860-962` — a natural single insertion point per team). This is the `addedTimeBonus` precedent applied directly: one authoritative running number per stat, not a re-derivation.

2. **Data captured AT THE MOMENT of the shot, appended to the existing `SHOT_ATTEMPT`/`SNAPSHOT` `ActionEvent`s (which already get appended to `eventLog` on every shot resolution)**, for xG specifically. The existing `SHOT_ATTEMPT` event shape (`types.ts:355-380`) already carries `shooterId`, `targetHex` (the GOAL hex aimed at, NOT the shooter's own position), dice, and scores — but **not** the two xG inputs the question calls out: shot-hex distance-from-goal and defender-in-box count. Neither is derivable retroactively from a later `eventLog` scan, because by the time the summary popup opens the shooter has moved (or been subbed off) — the shooter's hex AT THE MOMENT of the shot must be captured explicitly, the same way `LOOSE_BALL_LAND`'s `direction`/`distance` fields were added as required (non-optional) fields specifically so no construction site could omit them (`types.ts:459-466`). Concretely: add `shooterHex: HexCoord` and `defendersInBox: number` to `SHOT_ATTEMPT`/`SNAPSHOT`'s `ActionEvent` variant, computed at the existing shot-resolution call sites in `gameEngine.ts`/`gameHandlers.ts` (the GK-dive/shot-duel branches already inspected around `gameEngine.ts:4270-4420` for the unsaveable-shot and shot-duel-GOAL branches, and the equivalent SNAPSHOT branches in `gameHandlers.ts` near the deflection-builder code at `:1270-1340`/`:2280-2340` — these are exactly the places `shooter.position` and `state.pieces` filtered to the opponent's penalty box are already in scope). `defendersInBox` reuses the existing `isInRegion(..., 'awayPenaltyArea'|'homePenaltyArea')` helper already imported and used at `gameEngine.ts:4373` for the outside-area shooting penalty — no new geometry helper needed.
3. **The xG formula itself and "xG per shot" display** are then computed on-demand from a scan of `eventLog` filtered to `SHOT_ATTEMPT`/`SNAPSHOT` events at POPUP-OPEN time — this IS an `eventLog` scan, but it's the low-frequency, display-time kind the `ball.lastTouchedBy` precedent was never arguing against; it only becomes viable because step 2 already put the needed inputs (`shooterHex`, `defendersInBox`) directly on each event, so no possession-history re-derivation is needed, only a filter+map over already-complete records.

**New:** `shooterHex`/`defendersInBox` fields on `SHOT_ATTEMPT`/`SNAPSHOT` `ActionEvent`s; new running-counter `GameState` fields (`possessionActionCount`, `passAttempts`/`passCompletions`, `tackleStealAttempts`/`tackleStealSuccesses`, per-team, mirroring `subsUsed: {home, away}`'s shape); a new `GameSummaryPopup.tsx` component (client) reading the counters directly plus deriving xG/shot-count/goal-count from an `eventLog` filter; a new `(i)` icon affordance on the scoreboard component (not identified in the files read for this research — needs a planning-time look at whatever renders the persistent top-band scoreboard, referenced in PROJECT.md's `LAYOUT-01` decision).
**Modified:** every pass/tackle/steal/foul resolution branch in `gameEngine.ts` gains one counter increment each (mechanical, low-risk, high fan-out — touches many call sites, which is why this should be scheduled with care/tests per site, not as one big diff).

**Toggle recap in the popup** ("settings/toggle recap including referee leniency") is free — every relevant field (`foulsEnabled`, `bookingEnabled`, `injuryEnabled`, `outOfBoundsEnabled`, the new `refereeLeniencyOverride`/`tackleStealDeclineEnabled`, and `refereeCard.leniency` itself) already lives on `GameState` and needs no new plumbing, only a read.

**Build-order dependency:** this should be LAST among the 6 features, for two reasons: (a) it is the only feature that reads state produced by the others (referee leniency override, tackle/steal decline stats) rather than being independent of them, and (b) the counter-increment work touches the largest number of existing call sites across `gameEngine.ts`, so building it after the engine has stabilized from Features 4/5's own `gameEngine.ts` changes avoids rebasing counter-increment edits across two sets of concurrent engine changes.

---

## Suggested Build Order

1. **Bug fix: red-card deflection eligibility** (Feature 4c root cause) — zero dependencies, pure correctness fix, 2-line change at 2 sites (`gameHandlers.ts:1286`, `:2289`), optionally paired with the secondary `validateResponseMoveStep`/`canSelect*` defense-in-depth hardening. Do this first and independently; it de-risks nothing else but blocks nothing else either, and shipping it early means the substitution-screen rework (Feature 4a/4b) isn't tested against a still-buggy engine.
2. **Feature 2 — Unified Card/Injury Iconography** (`CardInjuryBadge.tsx`) — build this before Feature 4a's bench/roster rework, since Feature 4 explicitly needs a red-card marker on the bench and this is the shared component that should back it, avoiding a 4th ad-hoc badge implementation.
3. **Feature 1 — Referee Leniency Manual Override** — small, isolated, touches the settings pipeline only; can run in parallel with #2 since there's no file overlap.
4. **Feature 5 — Tackle/Steal Prompt-and-Decline** — isolated new phase/event/panel family; can also run in parallel with #1–3 (different files: `moveValidator.ts`/`gameHandlers.ts`'s `GAME_MOVE` branch vs. the settings/badge work above), but do it before Feature 6 since Feature 6 wants to count tackle/steal attempts+successes and a decline changes what "an attempt" means for that stat.
5. **Feature 4a/4b — Substitution UX Overhaul** (the reposition/substitute dual-mode screen + server-side `applyRosterReposition`) — the largest, most interdependent feature; benefits from #1 (clean engine) and #2 (shared badge) already landed.
6. **Feature 3 — Advanced Settings Drawer** — do this once Features 1 and 5 have added their new toggles, so the drawer is built once against the final 6-toggle set instead of being reshuffled twice.
7. **Feature 6 — Match Summary / Stats Popup with xG** — last, for the reasons given in that section (reads state the other features produce; touches the most engine call sites, so benefits from a stable engine).

---

## Cross-Cutting Risk: New-Event-Type / New-Phase Registration Checklist

Every one of Features 4, 5, and 6 (event-shape additions) introduces new `ActionEventType` and/or `GamePhase` values. Per this codebase's documented recurring bug class, each new value must be checked against ALL of the following consumer lists, not just the obvious one:

| Registry                                                                                                  | File:Location                                      | What breaks if skipped                                                                                                   |
| --------------------------------------------------------------------------------------------------------- | -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `formatEvent` switch                                                                                      | `packages/client/src/components/ActionLog.tsx:343` | New event renders as blank/crash in the Action Log                                                                       |
| `PHASE_LABEL` map                                                                                         | `packages/client/src/components/GameBoard.tsx`     | New phase shows no header label                                                                                          |
| `REPLAY_ELIGIBLE_TYPES`                                                                                   | `packages/server/src/gameEngine.ts:9522`           | New event invisible in post-match replay (silently, no error)                                                            |
| `applyUndo`'s `isBoundary` disjunction                                                                    | `packages/server/src/gameEngine.ts:3238-3300`      | New event either wrongly undoable past, or (if it should be a boundary and isn't) a committed duel/decision gets un-done |
| `STOPPAGE_PHASES` allow-list (only if the new phase should permit substitutions/roster actions during it) | `packages/shared/src/stoppagePhases.ts:27-43`      | A stoppage window silently doesn't allow substitution/reposition when it should                                          |
| Client `useGameStore.ts` GameState-shape typing / selectors                                               | `packages/client/src/store/useGameStore.ts`        | New fields not surfaced to panels; stale/undefined reads                                                                 |

## Sources

All findings above are drawn directly from reading the following files at their cited line numbers (2026-08-21, current `main` branch state):

- `packages/shared/src/types.ts` (full)
- `packages/shared/src/moveValidator.ts` (full)
- `packages/shared/src/fouls.ts` (full)
- `packages/shared/src/stoppagePhases.ts` (full)
- `packages/server/src/gameEngine.ts` (targeted: buildInitialGameState, buildSquadPieces, applyMove, resolveFoulChain, applyRosterContinuity, applyUndo boundary list, computeShotPathDeflection, REPLAY_ELIGIBLE_TYPES, and grep-located redCarded/applyRosterContinuity call sites)
- `packages/server/src/gameHandlers.ts` (targeted: `validateResponseMoveStep`, `GAME_MOVE`/SNAPSHOT_DEFLECT branch, deflection-defender-set builders at both SHOT and SNAPSHOT sites, `GAME_SUBSTITUTION` handler)
- `packages/server/src/roomHandlers.ts` (targeted: `ROOM_SETTINGS_CONFIRM`, `LINEUP_CONFIRM`'s `buildInitialGameState` call)
- `packages/server/src/roomStore.ts` (targeted: `Room` type toggle fields)
- `packages/client/src/components/GameSettingsScreen.tsx` (full)
- `packages/client/src/components/LineupAssignmentScreen.tsx` (full)
- `packages/client/src/components/HexGrid.tsx` (targeted: piece render-skip, `canSelect*` derivations)
- `packages/client/src/components/PieceOverlay.tsx` (targeted: card/injury badge rendering)
- `packages/client/src/components/FoulChoicePanel.tsx` (full)
- `packages/client/src/components/GkDiveAtFeetPromptPanel.tsx` (full)
- `.planning/PROJECT.md` (Context, Constraints, Key Decisions sections)
