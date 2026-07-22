# Phase 31: Bug Fixes - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-22
**Phase:** 31-Bug Fixes
**Areas discussed:** Fold-related-todos, Goal-reset replay fix approach, "Started a move" definition + Undo interaction, GK deflection guard — client-only vs also server-side

---

## Fold Related Todos

| Option                           | Description                                                                                                         | Selected |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------- | -------- |
| GK_KICK replay invisibility      | Same replay defect class as BUG-30: GK_KICK long-kicks have no ballAfter and are missing from REPLAY_ELIGIBLE_TYPES | ✓        |
| Header-winner-piece eligibility  | Same movedPieceIds/eligibility-locking class as BUG-31                                                              | ✓        |
| KICK_OFF_SETUP shot-path shading | Persistent light shading on prior shot-path hexes; root cause unconfirmed, recommended for Phase 33/34 instead      |          |
| None — keep to BUG-30/31/32 only | Stay strictly scoped to the three roadmapped bugs                                                                   |          |

**User's choice:** Fold in "GK_KICK replay invisibility" and "Header-winner-piece eligibility". Leave "KICK_OFF_SETUP shot-path shading" in the backlog, deferred to Phase 33/34.
**Notes:** Both folded todos touch the same code/defect class as BUG-30 (replay reconstruction) and BUG-31 (eligibility/movedPieceIds locking) respectively, so fixing them alongside is low marginal cost. The shading bug is a highlight-color rendering issue better handled once Phase 33/34's highlight audit exists.

---

## Goal-reset replay fix approach

| Option                          | Description                                                                                   | Selected |
| ------------------------------- | --------------------------------------------------------------------------------------------- | -------- |
| Mirror live path (recommended)  | buildReplayFrames calls buildKickOffPieces on GOAL, exactly like the live gameEngine.ts paths |          |
| Snapshot positions in the event | Add a piecesAfter field to the GOAL ActionEvent carrying the full post-reset piece array      | ✓        |
| You decide                      | Let researcher/planner pick during implementation                                             |          |

**User's choice:** Snapshot positions in the event (piecesAfter field on GOAL ActionEvent).
**Notes:** Chosen over mirroring the live path despite the schema-change cost — explicit snapshot is more self-contained and avoids buildReplayFrames needing to re-derive formation logic.

| Option                         | Description                                                                                    | Selected |
| ------------------------------ | ---------------------------------------------------------------------------------------------- | -------- |
| Check it too (recommended)     | Verify the second-half kickoff reset (gameEngine.ts:4442) reconstructs correctly in replay too | ✓        |
| Out of scope — goal-reset only | Stick strictly to the goal-scored → kickoff reset case                                         |          |

**User's choice:** Check it too.
**Notes:** Same reconstruction mechanism (buildKickOffPieces) is reused for second-half kickoff; worth verifying while this code is already being touched.

---

## "Started a move" definition + Undo interaction

| Option                           | Description                                                                                | Selected |
| -------------------------------- | ------------------------------------------------------------------------------------------ | -------- |
| First hex stepped (recommended)  | paceUsedByPieceId[id] > 0 — reuses existing activatedCount signal from HexGrid.tsx:702-704 | ✓        |
| Piece selected (before any step) | Counts from the instant of piece selection; requires a new signal                          |          |

**User's choice:** First hex stepped.
**Notes:** Reuses an existing signal (activatedCount) already computed for slot-quota gating, rather than plumbing a new "currently selected" signal through from client selection state.

| Option                         | Description                                                                                              | Selected |
| ------------------------------ | -------------------------------------------------------------------------------------------------------- | -------- |
| Immediate revert (recommended) | Undo removes the piece from the started-signal immediately; remaining/button color recompute same render | ✓        |
| You decide                     | Let planner figure out exact Undo timing mechanics                                                       |          |

**User's choice:** Immediate revert.
**Notes:** No stale-state window between Undo firing and the UI reflecting it.

---

## GK deflection guard — client-only vs also server-side

| Option                        | Description                                                                                           | Selected |
| ----------------------------- | ----------------------------------------------------------------------------------------------------- | -------- |
| Client + server (recommended) | Add guard in HexGrid.tsx canSelectSnapDeflect AND reject GK-selected deflection responder server-side | ✓        |
| Client-only                   | Only fix HexGrid.tsx; accept the latent server-side gap                                               |          |

**User's choice:** Client + server.
**Notes:** Matches the project's server-authoritative architecture (ARCH-01..07) — every other move type already has both a client selection gate and a server validator; BUG-32's fix should follow that same two-layer pattern rather than being the one exception.

---

## Claude's Discretion

None — all decisions were explicitly made by the user; no "you decide" options were selected.

## Deferred Ideas

- KICK_OFF_SETUP persistent shot-path shading bug — reviewed, not folded. Recommended for Phase 33 (Design Tokens & Highlight Standardization) or Phase 34 (Visual Theme Restyle).
