# Phase 30: recalibrate-draft - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-21
**Phase:** 30-recalibrate-draft
**Areas discussed:** Player stat rebalance, Tier visual identity, Tier/pack tuning constants, Legends/Icons pools, Pack/round redesign, Fallback pool order, Position-cap rule, Outline scope, Forced-keeper retirement, TBD player

---

## Initial framing (open question)

No goal existed in ROADMAP.md for Phase 30 — it was a bare placeholder. Uncommitted working-tree edits (player-pool.csv broad stat rebalance + roster swap; LineupAssignmentScreen.module.css tier-color changes) were surfaced as evidence of likely intended scope.

**User's response (free text):** Provided the full scope unprompted — finish the player-pool update, finish the tier-color outline (chase=purple, rare=red, uncommon=green, common=white, with outline persisting to the lineup view), enable Legends/Icons, switch tier assignment to fixed absolute total-stat thresholds (chase 32+, rare 31, uncommon 29–30, common <29), redesign packs to be smaller with position/GK constraints and a 6-round variable-composition structure, and retire the forced-keeper-on-cycle-4 rule.

---

## Tier colors

| Option                          | Description                                                                                                                  | Selected |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | -------- |
| 4-color scheme, no keeper color | chase=purple, rare=red, uncommon=green, common=white; GK cards use whichever of these 4 colors their stat-tier lands them in | ✓        |
| Keep keeper as a 5th color      | Same 4 colors plus a distinct keeper color for GK cards regardless of stat tier                                              |          |
| Let me clarify                  | Freeform                                                                                                                     |          |

**User's choice:** 4-color scheme, no keeper color.

---

## Tier rule (absolute thresholds + GK + Legends/Icons)

| Option                                 | Description                                                                                                             | Selected |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | -------- |
| Same cutoffs for everyone, icons=chase | GKs use the identical 29/30/31/32 thresholds; Legends/Icons players land wherever their total stat falls (likely chase) | ✓        |
| GKs need their own cutoffs             | Separate GK-specific threshold numbers                                                                                  |          |
| Legends/Icons need a tier above chase  | New top tier for icon/legend players                                                                                    |          |

**User's choice:** Same cutoffs for everyone, icons=chase.
**Notes:** Verified against live pool data — all 16 current GKs land in chase/rare/uncommon under these cutoffs (none below 29).

---

## Pack rounds (structural redesign)

Presented a parsed reconstruction of the user's round-by-round description for confirmation: 6 rounds, 12 packs total, Round 1 = 4-GK pack ×2 (2 picks/player), Rounds 2–3 = 4-common pack ×2 each (3 picks/player), Round 4 = 2-uncommon/2-common pack ×2 (3 picks/player), Rounds 5–6 = 1-chase-or-rare/1-uncommon/2-common pack ×2 each (3 picks/player). Total 17 cards/player.

| Option                        | Description                                                                   | Selected |
| ----------------------------- | ----------------------------------------------------------------------------- | -------- |
| Correct — leftovers discarded | Reconstruction is accurate; undrafted pack cards are discarded, no auto-bench | ✓        |
| Correct — leftovers to bench  | Reconstruction accurate but undrafted cards auto-add to bench                 |          |
| My read is off                | Correction needed                                                             |          |

**User's choice:** Correct — leftovers discarded.

---

## Cleanup: forced-keeper rule + TBD player

| Option                     | Description                                        | Selected |
| -------------------------- | -------------------------------------------------- | -------- |
| Delete forced-keeper rule  | DRAFT-08 cycle-4 auto-keeper-pick removed outright | ✓        |
| TBD player needs finishing | Real name/stats required before phase ships        |          |
| TBD player is out of scope | Leave as-is, separate cleanup                      | ✓        |

**User's choice (multiSelect):** Delete forced-keeper rule; TBD player is out of scope.

---

## Fallback pool order

| Option                         | Description                                        | Selected |
| ------------------------------ | -------------------------------------------------- | -------- |
| MLS → Original → International | Reordered but International stays as last resort   |          |
| MLS → Original only            | International dropped from fallback chain entirely | ✓        |
| Something else                 | Freeform                                           |          |

**User's choice:** MLS → Original only. (International remains directly selectable as a pool in settings — it's only removed from backfill duty.)

---

## Position-cap rule (max 2 per pack)

| Option                          | Description                   | Selected |
| ------------------------------- | ----------------------------- | -------- |
| FWD and ST are separate buckets | Max 2 of each independently   |          |
| FWD and ST are one bucket       | Combined cap of 2 across both | ✓        |

**User's choice:** FWD and ST are one bucket.

---

## Outline scope (tier border on lineup)

| Option                     | Description                                                | Selected |
| -------------------------- | ---------------------------------------------------------- | -------- |
| Yes, everywhere post-draft | Starting-11 slots AND bench carousel both show tier border | ✓        |
| Bench only                 | Only bench carousel needs it                               |          |

**User's choice:** Yes, everywhere post-draft.

---

## Done check

Asked whether further gray areas remained or the user was ready for CONTEXT.md.

**User's choice:** I'm ready for context.

---

## Claude's Discretion

- Exact internal data-shape for the new per-round pack-composition model (arrays vs. per-round config objects)
- Exact mechanism for extending the DraftSubStep/cycle state machine to variable pick-counts per round
- Whether `resolveTieredCard`'s `'keeper'` fallback heuristic in LineupAssignmentScreen.tsx needs updating alongside the tier-value removal (flagged, not resolved here)
- Exact hex values for the new uncommon (green) and common (white) tier-border colors

## Deferred Ideas

- TBD City ST player naming/stats — explicit out-of-scope callout, separate cleanup task
- `csv-consolidation-player-pool.md` todo — stale, already resolved by a prior phase; candidate for separate closure, not folded into this phase
- 3 other matched todos (GK_KICK replay visibility, KICK_OFF_SETUP shot-path shading, header-winner eligibility) — reviewed via todo.match-phase, all unrelated to draft recalibration, not folded
