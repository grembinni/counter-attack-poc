# Phase 42: Substitution UX Overhaul - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-21
**Phase:** 42-substitution-ux-overhaul
**Areas discussed:** Position-swap confirmation, Banner & Resume button placement, Red-carded player's vacated slot, Red-card bench marker style, BUG-38 fix shape

---

## Position-Swap Confirmation

**Scope clarification asked first:** does "drag an on-field player onto another on-field player" (SUB-08) happen on the live HexGrid pitch, or inside the roster panel?

| Option                 | Description                                                                                                                                                      | Selected |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| Yes, roster panel only | All dragging happens inside `LineupAssignmentScreen`'s midmatch formation-column/bench cards, opened via the `SubstitutionButton` modal. Live HexGrid untouched. | ✓        |
| No — something else    | —                                                                                                                                                                |          |

**User's choice:** Roster panel only.
**Notes:** User flagged that the initial question wrongly implied field/pitch dragging: "substitutions should not be happening on the field, only on the substitution panel that shows roster and bench."

| Option                              | Description                                                                                                                                                                        | Selected |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| Instant, no popup                   | Applies immediately on drop, matching SUB-08's wording; substitution mode is the one place a confirm step is explicitly required (SUB-14), since a sub consumes a capped resource. | ✓        |
| Confirm popup, same as substitution | Reuses `withEndTurnConfirm`/`confirmDialog` for consistency, at the cost of an extra click for a freely-repeatable action.                                                         |          |

**User's choice:** Instant, no popup.

---

## Banner & Resume Button Placement

| Option                                            | Description                                                                                                                                    | Selected |
| ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| The modal header, inside the panel                | Since the persistent strip's button already has a green background+text state, SUB-17 might target the modal's own plain heading area instead. |          |
| The persistent strip needs more visible treatment | Even with an existing green state, maybe it needs to be more prominent.                                                                        |          |
| Both                                              | Both elements should reflect the green editable state.                                                                                         |          |

**User's choice:** Neither exactly as framed — user corrected the premise by pasting the live DOM (`<div class="_subButtonStrip_...">` wrapping `<button class="_sideLogChevron_..._subButtonActive_...">`), showing only the small inner button currently carries the green background, not the full strip container. The strip container itself needs the green background.
**Notes:** This resolves SUB-17 as: extend the existing green treatment from the inner 28px button to the full-height `.subButtonStrip` container.

| Option                   | Description                                                                                    | Selected |
| ------------------------ | ---------------------------------------------------------------------------------------------- | -------- |
| Same position, top-right | Swap the `×` glyph for a labeled green Resume button/pill in the same fixed top-right anchor.  |          |
| Move to a bottom CTA     | Full-width green button at the bottom of the panel, matching other CTA buttons' visual weight. | ✓        |

**User's choice:** Move to a bottom CTA.

---

## Red-Carded Player's Vacated Slot

| Option                                                      | Description                                                                                                                                                       | Selected |
| ----------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| Vacated slot can be dragged into by another on-field player | The formation grid shows an empty/marked slot; another on-field player can be dragged into it to reshuffle shape. Bench-side marker stays non-draggable (SUB-10). | ✓        |
| Slot stays permanently locked/unfillable                    | Removed from play entirely for the rest of the match.                                                                                                             |          |

**User's choice:** Vacated slot can be dragged into by another on-field player.

---

## Red-Card Bench Marker Style

| Option                                | Description                                                                 | Selected |
| ------------------------------------- | --------------------------------------------------------------------------- | -------- |
| Normal card + CardInjuryBadge overlay | Same treatment as every other bench card, using the shared badge component. |          |
| Stripped placeholder, badge only      | Simplified bench slot, no name/stats, just a red-card glyph.                |          |

**User's choice:** Neither exactly as framed — user corrected the premise: "a player with a red card will be on the bench and unselectable for substitution and will display card and injury as normal. There is no 'red-card' marker that is independent from a player. On the roster screen on field positioning a red card icon can be used to indicate why the position is empty and does not have a player."
**Notes:** Two follow-up confirmations locked this in: (1) bench = normal `CardInjuryBadge`-equipped card, no separate marker; (2) formation-grid empty slot = red-card icon in place of a player card. Second follow-up confirmed the bench card reuses Phase 41's `CardInjuryBadge` as-is with no new work, just a regression check.

---

## BUG-38 Fix Shape

User asked to discuss the expected fix for the red-carded-player-still-affects-gameplay bug in more depth.

**Presented:** the confirmed root cause (`gameHandlers.ts:1286`/`:2289` deflection-defender-set builders lack a `redCarded` filter) and the 2-line fix shape from research, plus the option of also closing a related masked gap (`validateResponseMoveStep` + client `canSelect*` gates).

**User's question:** "why are we not removing the player piece from the field instead of updating multiple blocks of code to ignore it" — pushed back on the filter-patching approach as the default assumption.

**Investigation performed live:** confirmed `position: HexCoord` is a non-optional field (`types.ts:17`), and that the codebase deliberately keeps a red-carded piece in `state.pieces` (documented in the `onPitch` field's comment and `applyMove`'s CARD-02/CARD-04 guard comment) because other logic — `maxOnPitchFor`'s red-card count, roster continuity, bench `playerId` linkage — depends on the piece record still existing. Removing/nulling would be the larger, riskier change.

| Option                                               | Description                                                                                                                                                                               | Selected |
| ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| Shared helper + fix all sites + audit for stragglers | Extract `isActivePiece(piece)`, apply to the 2 confirmed sites, retrofit already-correct sites for consistency, add defense-in-depth checks, and grep-audit for remaining inline filters. | ✓        |
| Shared helper, but don't touch already-correct sites | Same helper, applied only to broken/new sites — leave already-working inline checks as-is to minimize diff.                                                                               |          |

**User's choice:** Shared helper + fix all sites + audit for stragglers.
**Notes:** This directly addresses the "too many places to patch" concern raised — centralizing the exclusion logic into one shared, tested helper (rather than a 4th ad-hoc inline copy) is what actually solves the recurring-bug-class problem, not a data-model removal.

---

## Claude's Discretion

- Exact naming/shape of the `subMode` local state (boolean vs. enum) and the precise "action pending" guard field in `useGameStore.ts`.
- Exact shape/naming and package location of the shared `isActivePiece` helper.
- Visual/CSS specifics of the red-card icon on the empty formation slot and the bottom-CTA Resume button styling.

## Deferred Ideas

None — discussion stayed within phase scope (ROADMAP.md/REQUIREMENTS.md already covered every area discussed).

Two weak-scoring pending todos were reviewed but not folded (unrelated rendering bugs — `KICK_OFF_SETUP` shot-path shading, offside ring after goal) — see CONTEXT.md's "Reviewed Todos" section.
