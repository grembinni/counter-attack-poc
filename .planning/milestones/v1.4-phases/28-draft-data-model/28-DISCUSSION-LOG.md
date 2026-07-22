# Phase 28: Draft Data Model - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-21
**Phase:** 28-Draft-Data-Model
**Areas discussed:** "Original" pool definition, Tier percentile scope, Keeper tier & GK stat exclusion, Pack exhaustion model

---

## "Original" Pool Definition

| Option                             | Description                                                                                    | Selected |
| ---------------------------------- | ---------------------------------------------------------------------------------------------- | -------- |
| Exclude (L)/(M) tagged players     | Filter them out of 'original' by name-suffix pattern — reserves the 10 superstars for DRAFT-11 | ✓        |
| Include them in 'original' for now | No filtering — simpler, but leaks Maradona/Ronaldo etc. into an "Original"-only draft          |          |

**User's choice:** Exclude (L)/(M) tagged players.

| Option                                   | Description                                                                                         | Selected |
| ---------------------------------------- | --------------------------------------------------------------------------------------------------- | -------- |
| Add explicit poolTag field to PoolPlayer | New `poolTag?: 'legend' \| 'icon'` field, CSV gets a PoolTag column, seed script threads it through | ✓        |
| Regex-match the name suffix at runtime   | No schema change but fragile — breaks silently if a real name ever ends in a parenthetical          |          |

**User's choice:** Add explicit poolTag field to PoolPlayer.

| Option                         | Description                                                   | Selected |
| ------------------------------ | ------------------------------------------------------------- | -------- |
| Strip the suffix from lastName | Clean names ("Maradona") now that poolTag carries the meaning | ✓        |
| Keep suffix as-is in lastName  | Smaller diff, no touch to 10 rows of display data             |          |

**User's choice:** Strip the suffix from lastName.

**Notes:** MLS/International pool mapping doesn't need discussion — `TEAM_CONFIGS[...].league` already provides that grouping from Phase 21 (LEAGUE-01..03).

---

## Tier Percentile Scope

| Option                                   | Description                                                                                  | Selected |
| ---------------------------------------- | -------------------------------------------------------------------------------------------- | -------- |
| Dynamic — recompute per selected pool(s) | Rank percentile within the union of checked pools each time a match's settings are confirmed | ✓        |
| Static — precompute once over all 188    | Fixed tier per player independent of which pools a match selects                             |          |

**User's choice:** Dynamic — recompute per selected pool(s).

| Option                                           | Description                                                                                     | Selected |
| ------------------------------------------------ | ----------------------------------------------------------------------------------------------- | -------- |
| Rank-based percentile (stable sort)              | Sort descending by total stat, percentile = rank/count, ties broken by stable order             | ✓        |
| Value-based percentile (tied players share tier) | Percentile computed from stat value's position in distribution — exact ties always share a tier |          |

**User's choice:** Rank-based percentile (stable sort).

| Option                                  | Description                                                                                               | Selected |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------- | -------- |
| Sum all 9 fields as-is                  | totalStat = sum of all 9 PoolPlayer numeric fields; outfield saving/handling are 0 and don't skew ranking | ✓        |
| Sum only the 7 outfield-relevant fields | Exclude saving/handling from the formula entirely                                                         |          |

**User's choice:** Sum all 9 fields as-is.

---

## Keeper Tier & GK Stat Exclusion

| Option                                            | Description                                                                                               | Selected |
| ------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | -------- |
| Yes — GKs are a separate role-only bucket         | Every GK is tier: 'keeper', no percentile ranking; GKs filtered out before outfield percentile math       | ✓        |
| GKs percentile-ranked too, floor-capped at Keeper | Same end result but computed with GKs still in the population — more complex for no behavioral difference |          |

**User's choice:** Yes — GKs are a separate role-only bucket.

---

## Pack Exhaustion Model

| Option                                                       | Description                                                                                            | Selected |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------ | -------- |
| Stateless generator + caller-supplied exclusion set          | generatePack(pool, composition, excludeIds) is pure; Phase 29 decides what accumulates into excludeIds |          |
| Engine owns match-wide drafted-state internally              | Phase 28 tracks drafted state itself via a session object                                              |          |
| _(free text)_ All packs generated at once, no shared players | Batch-generate the whole match's packs up front, globally unique                                       | ✓        |

**User's choice:** All packs should be generated at once and not share players (free-text answer).

**Follow-up — pack count:**

| Option                                                    | Description                                                       | Selected |
| --------------------------------------------------------- | ----------------------------------------------------------------- | -------- |
| Configurable constant, default 8                          | Export `PACKS_PER_MATCH = 8` alongside tier/composition constants | ✓        |
| Derived from cycle/player math, not a standalone constant | Pack count falls out of Phase 29's cycle timing instead           |          |

**User's choice:** Configurable constant, default 8. (User's message also specified the full composition breakdown and card-back colors in one go — see below.)

**Follow-up — composition discrepancy check:**

User's free-text answer described composition as 1 chase/1 rare/**2** uncommon/**2** common/1 keeper, which conflicts with REQUIREMENTS.md DRAFT-05's stated default of 1 chase/1 rare/**1** uncommon/**3** common/1 keeper.

| Option                                             | Description                                             | Selected |
| -------------------------------------------------- | ------------------------------------------------------- | -------- |
| 2 uncommon / 2 common (latest answer)              | Update REQUIREMENTS.md to match the new composition     |          |
| 1 uncommon / 3 common (REQUIREMENTS.md as written) | Keep existing default — user's prior message was a slip | ✓        |

**User's choice:** 1 uncommon / 3 common — REQUIREMENTS.md as written is correct.

**Follow-up — tier display constants:**

| Option                                      | Description                                                                           | Selected |
| ------------------------------------------- | ------------------------------------------------------------------------------------- | -------- |
| Phase 28 exports tier→color/label constants | TIER_DISPLAY map added to this phase's data model                                     |          |
| Defer entirely to Phase 29                  | Phase 28 only produces the tier value; Phase 29's UI-SPEC.md defines visual treatment | ✓        |

**User's choice:** Defer entirely to Phase 29.

**Follow-up — pool supply shortage:**

Math check: 8 packs × 1 keeper = 8 keepers needed, but Original/MLS/International alone only have 4/6/6 GKs respectively. Original-alone is also short on outfield players (42 vs. 48 needed).

| Option                                       | Description                                                                                           | Selected |
| -------------------------------------------- | ----------------------------------------------------------------------------------------------------- | -------- |
| Keepers repeat, outfield stays unique        | Outfield dealt without replacement; keeper slot samples independently (with replacement) per pack     |          |
| Reduce PACKS_PER_MATCH to fit smallest pool  | Pack count varies by pool selection instead of a fixed 8                                              |          |
| _(free text)_ Backfill from unselected pools | Randomly add players from non-selected pools (Original→MLS→International order) to fill any shortfall | ✓        |

**User's choice:** Backfill approach (free-text), then confirmed via follow-up: applies to both keeper and outfield shortages, fallback order Original → MLS → International, skipping whichever pool(s) are already selected.

---

## Claude's Discretion

- Exact module/file layout for tier-classification and pack-generation functions (new file vs. extending `teams.ts`).
- Exact shuffle/randomization mechanism for backfill sampling and pack dealing (server-side, following the project's `crypto.randomInt` convention rather than client `Math.random()`).

## Deferred Ideas

- Tier→color/label display constants and card-back rendering (gold/silver/bronze/blue/green) — Phase 29 (Draft UI).
- Exact pick-and-swap cycle timing and how many packs get consumed per cycle — Phase 29.
- `csv-consolidation-player-pool.md` todo reviewed — already resolved in Phase 21; recommend closing the stale todo file rather than carrying it forward.
