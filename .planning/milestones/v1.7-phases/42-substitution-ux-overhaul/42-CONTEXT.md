# Phase 42: Substitution UX Overhaul - Context

**Gathered:** 2026-08-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Rework the mid-match roster panel (`LineupAssignmentScreen.tsx`'s `mode="midmatch"` branch, opened via `GameBoard.tsx`'s `SubstitutionButton`/`.substitutionModalCard`) into two coexisting interaction modes on the SAME screen:

1. **Default positioning mode** — on-field formation cards can be dragged onto each other to instantly swap positions; bench cards are never draggable/selectable in this mode.
2. **Explicit substitution mode** — entered via an action button (disabled at 3 subs used), which becomes a Cancel button while active; exactly one bench↔pitch swap can be staged per action, confirmed via a popup naming the player off/on before it applies.

Plus chrome changes (green Resume button, green side-banner background) and a bug fix (BUG-38) ensuring a red-carded player's frozen pitch position is fully excluded from every gameplay computation (deflection eligibility, ZoI), not just rendering.

All dragging (both modes) happens entirely within this roster panel — NOT on the live HexGrid pitch during gameplay.

</domain>

<decisions>
## Implementation Decisions

### Position-Swap Mode

- **D-01:** All drag interactions — both position-swap and substitution — happen entirely within the mid-match roster panel (`LineupAssignmentScreen` midmatch mode, opened via the `SubstitutionButton` modal). The live HexGrid/pitch view is untouched by this phase.
- **D-02:** Dragging one on-field formation card onto another applies the position swap **instantly on drop — no confirm popup**. Only substitution mode (SUB-14) gets a confirm popup, since a substitution consumes the capped 3-per-team resource while a position swap is freely repeatable and reversible.

### Banner & Resume Button Chrome

- **D-03:** The "side banner" in SUB-17 is the persistent `SubstitutionButton` strip container (`.subButtonStrip` in `GameBoard.module.css` — the 28px full-height vertical bar mirroring `SideLog` on the opposite edge of `pitchRow`), **not** the modal's own header. Today only the small inner button (`.sideLogChevron.subButtonActive`) gets the green background/text treatment (`background: var(--color-speed-standard-bg)`, `color: var(--color-success)`); SUB-17 requires extending that green background to the full `.subButtonStrip` container.
- **D-04:** SUB-16's green Resume button replaces the small fixed top-right close control (`.substitutionModalClose`, the `&times;` button in `GameBoard.tsx`) but **moves to a full-width bottom CTA** inside the modal panel, matching the visual weight of other CTA buttons in the app (e.g. the ActionPanel's Confirm button), rather than staying a small corner icon.

### Red-Carded Player Display

- **D-05:** A red-carded player's vacated formation slot remains a real, empty slot in the positioning-mode formation grid. Another on-field player **can** be dragged into it to reshuffle team shape around the numerical disadvantage — it does not stay permanently locked.
- **D-06:** The vacated formation-grid slot (on-field side) displays a **red-card icon in place of a player card**, indicating why that slot is empty.
- **D-07:** There is **no separate "red-card marker" component on the bench**. A red-carded player on the bench is a normal bench card using Phase 41's existing `CardInjuryBadge` exactly as it already renders card/injury status today — reuse as-is. This phase's only bench-side obligation is a regression check that the badge still displays correctly once BUG-38's fix and the reposition/substitution rework land — not new bench-card work.

### BUG-38 Fix Shape

- **D-08:** Do NOT null out `position` or splice red-carded pieces out of `state.pieces`. `position: HexCoord` is a non-optional field (`packages/shared/src/types.ts:17`), and the codebase deliberately keeps a red-carded piece in `state.pieces` because other logic depends on it being there (`maxOnPitchFor`'s `11 - redCardCount` math, roster continuity resets, bench `playerId` linkage). Removing the piece from the array is the bigger, riskier redesign — not the safer fix. The established convention is exclude-by-flag at each consumer, not remove-by-splice (see `applyMove`'s own comment at `gameEngine.ts:1072-1077`).
- **D-09:** Extract **one shared helper** (e.g. `isActivePiece(piece)`) checking `redCarded !== true` (and/or `onPitch !== false`), and have every eligibility/defender-list site call it — instead of each site hand-writing its own inline filter clause (which has already happened 3+ times and is why 2 sites were missed).
- **D-10:** Apply the shared helper at:
  1. The 2 confirmed broken sites — `gameHandlers.ts` SNAPSHOT_DEFLECT defender-set builder (~line 1286) and the regular SHOT-phase deflection defender-set builder (~line 2289).
  2. Retrofit the already-correct sites (`applyMove`'s red-card rejection, the corner-kick-taker filter, the penalty/free-kick eligible-ids filter) to use the same shared helper for consistency.
  3. Add the missing `redCarded`/`onPitch` check to `validateResponseMoveStep` (`gameHandlers.ts:273-329`) and the client's `canSelect*` gates in `HexGrid.tsx:830-870` (currently masked by the render-skip at `HexGrid.tsx:761`, but no server-side defense-in-depth against a modified client).
  4. Grep-audit `gameEngine.ts`/`gameHandlers.ts`/`packages/shared`'s validators (`moveValidator.ts` explicitly — ZoI opponent list, Pitfall #7) for any remaining inline `redCarded`-unaware filters, per Success Criterion 5's "plus any other site an audit finds."

### Claude's Discretion

- Exact naming/shape of the `subMode` local state (boolean vs. `'reposition' | 'substitute'` enum) and the exact prop threading for the "action pending" guard (client already has `selectedPieceId` as the closest existing signal — confirm the precise field during planning).
- Exact shape/naming of the shared `isActivePiece` helper and which package it lives in (likely `packages/shared` given `moveValidator.ts` also needs it).
- Visual/CSS specifics of the red-card icon on the formation-grid empty slot and the bottom-CTA Resume button styling, within the existing design-token system.

</decisions>

<canonical_refs>

## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & Roadmap

- `.planning/ROADMAP.md` — Phase 42 entry: goal, success criteria, depends-on Phase 41
- `.planning/REQUIREMENTS.md` — SUB-08 through SUB-18, BUG-38 (lines 31-42, 108-109)
- `.planning/STATE.md` — "Decisions Locked" and "Key Pitfalls to Avoid" sections carrying v1.7-wide context relevant to this phase (`isActivePiece` extraction note, positioning/substitution shared-component regression risk, open questions for Phase 42)

### Research (v1.7 milestone-level, written 2026-08-21)

- `.planning/research/ARCHITECTURE.md` §"Feature 4 — Substitution UX Overhaul" (lines 99-166) — current-state analysis of `LineupAssignmentScreen.tsx`'s `mode='midmatch'` branch, recommended shape (rework not fork), concrete integration points, and the confirmed BUG-38 root cause with exact file:line citations
- `.planning/research/PITFALLS.md` — Pitfall 5 (positioning/substitution mode entanglement, highest regression risk of the milestone), Pitfall 6 (`DEFLECT_ATTEMPT` missing red-card exclusion), Pitfall 7 (`moveValidator`'s ZoI opponent list missing red-card exclusion)
- `.planning/debug/resolved/red-card-bench-removal-scope.md` — prior investigation into the red-carded-piece-still-on-pitch bug class; confirms which consumer sites were and were not previously fixed

### Prior Phase Context

- `.planning/phases/41-card-injury-iconography/41-CONTEXT.md` — the shared `CardInjuryBadge` component this phase's bench card reuses as-is (D-07)

</canonical_refs>

<code_context>

## Existing Code Insights

### Reusable Assets

- `CardInjuryBadge.tsx` (Phase 41) — already renders card/injury status on bench cards; reuse as-is for red-carded bench display (D-07), no new component needed.
- `ActionPanel.tsx`'s `withEndTurnConfirm`/`confirmDialog` pattern — the existing "early-movement-end confirmation" pattern SUB-14 says to mirror for the substitution confirm popup.
- `.subButtonActive` CSS (`GameBoard.module.css:603-610`) — existing green background+color token pairing (`--color-speed-standard-bg` / `--color-success`) to extend onto `.subButtonStrip` (D-03).

### Established Patterns

- `LineupAssignmentScreen.tsx`'s `isMidmatch`/`isDraggable` 2-way branch (`:181-190`) is the seam to extend into a 3-way branch (pregame / midmatch-reposition / midmatch-substitute) — confirmed still current as of this discussion.
- `GameBoard.tsx` (not `App.tsx`) is the wrapper owning the mid-match substitution modal chrome: `subOpen` state, `.substitutionOverlay`/`.substitutionModalCard`, `.substitutionModalClose` (the `&times;` button to be replaced per D-04), and the persistent `SubstitutionButton`/`.subButtonStrip` (D-03). This resolves the "wrapper component" open question noted in STATE.md — research had guessed `App.tsx`; it is actually `GameBoard.tsx`.
- Exclude-by-flag (not remove-by-splice) is the established convention for red-carded pieces app-wide — confirmed via `applyMove`'s guard (`gameEngine.ts:1072-1077`) and the `onPitch` field's doc comment (`types.ts:64-75`).

### Integration Points

- `GameBoard.tsx`'s `readOnly={!isSubEligiblePhase}` prop already gates the whole midmatch panel to stoppage phases — the new `subMode` state layers on top of this, not instead of it.
- `useGameStore.ts`'s `selectedPieceId` is the closest existing "is an action pending" signal for gating positioning-mode drag; confirm the exact field/derivation during planning (STATE.md open question, partially resolved here — needs final confirmation against the store's phase/selection fields).

</code_context>

<specifics>
## Specific Ideas

- The red-card icon on the vacated formation-grid slot should read as "this slot has no player because of a red card," distinct from an ordinary empty/unfilled slot — exact icon/asset to be determined during planning within the existing design-token system.
- The Resume button should have the visual weight of a real CTA (bottom of panel), not a small corner affordance — matching the app's existing Confirm-button pattern.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope. The formation-change/reposition mechanic and BUG-38 fix were both already in-scope per ROADMAP.md and REQUIREMENTS.md; no new capabilities were proposed.

### Reviewed Todos (not folded)

- `2026-07-02-bug-kickoff-setup-persistent-light-shading-on-shot-path-hexes.md` — weak keyword-only match (score 0.6, generic terms "bug/off/shows/phase/goal"); this is a `KICK_OFF_SETUP` rendering bug unrelated to substitution UX. Not folded.
- `2026-08-09-bug-offside-ring-after-goal.md` — weak keyword-only match (score 0.6); an offside-ring-after-goal rendering bug unrelated to substitution UX. Not folded.

</deferred>

---

_Phase: 42-substitution-ux-overhaul_
_Context gathered: 2026-08-21_
