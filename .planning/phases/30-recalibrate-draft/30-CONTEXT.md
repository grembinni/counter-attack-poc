# Phase 30: recalibrate-draft - Context

**Gathered:** 2026-07-21
**Status:** Ready for planning

<domain>
## Phase Boundary

ROADMAP.md's Phase 30 entry was a placeholder ("Goal: [To be planned]", "Requirements: TBD") — no goal had been decided yet. This discussion defined the goal from scratch, grounded partly in uncommitted working-tree edits (player-pool.csv stat rebalance, LineupAssignmentScreen.module.css tier-color changes) the user had already started by hand.

**This phase delivers a ground-up recalibration of the draft system**, replacing the Phase 28/29 tier-and-pack model with a new one:

1. Player pool stat rebalance (finish the in-progress CSV edit)
2. Switch tier classification from session-relative percentile ranking to fixed absolute total-stat thresholds
3. Enable the previously-deferred Legends/Icons draft pools (DRAFT-11)
4. Replace the flat 8×7-card pack model with a 6-round, position/GK-constrained, variable-composition pack structure
5. Replace the old 4-cycle pick-and-swap protocol with the new 6-round structure (round pick-counts vary: 2 picks in round 1, 3 picks in rounds 2–6)
6. Delete the DRAFT-08 forced-keeper-on-cycle-4 rule (superseded by the round-1 dedicated GK-pack mechanic)
7. Retire the 5-color tier visual scheme in favor of a 4-color scheme, and extend the tier-colored card border to the starting-11 lineup slots (currently draft-carousel-only)

This is a rules/engine/data rewrite of the draft system's core mechanics, not a bug-fix or additive feature — it touches `draftEngine.ts`, `types.ts` constants, the draft session state machine, the settings screen, and the card-rendering components.

</domain>

<decisions>
## Implementation Decisions

### Player Pool Data

- **D-01:** The in-progress `player-pool.csv` stat rebalance (broad attribute value changes across nearly all players, plus City roster swap: João Klauss/Mykhi Joyner/Sang-bin Jeong removed, Alex Mățan/Carlo Holse added) is in scope — finish it as part of this phase.
- **D-02:** The City ST row currently named literally `TBD` with placeholder stats (4,4,3,6,3,3,5) is explicitly **out of scope** for this phase — leave as-is, do not block phase completion on it.

### Tier Classification Rule

- **D-03:** Tier assignment switches from session-relative percentile ranking (`TIER_PERCENTILE_BOUNDS`: top 10%/20%/40%, recomputed per draft session) to **fixed absolute total-stat thresholds**: chase = 32+, rare = 31 (exactly), uncommon = 29–30, common = <29 (total stat = sum of all 9 `PoolPlayer` numeric stat fields, per existing `computeTotalStat`).
- **D-04:** GKs are classified into the same 4 tiers (chase/rare/uncommon/common) using the **identical numeric cutoffs** as outfield players — no separate GK-specific thresholds, and no reserved "keeper" tier for classification purposes. (Verified against current pool data: all 16 GKs land in chase/rare/uncommon under these cutoffs — none currently fall below 29 — worth flagging to the researcher as a distribution note, not a blocker.)
- **D-05:** The `'keeper'` `DraftTier` value/color goes away entirely for tier-classification and display purposes. GK cards show whichever of chase/rare/uncommon/common color their total stat lands them in, same as any outfield card.
- **D-06:** Once Legends/Icons pools are enabled, those players are **not** given a tier above chase — they're classified by the same absolute thresholds as everyone else and will typically land in chase.
- **D-07:** GKs remain a distinct **pack-composition** category (dedicated GK-only packs in round 1) even though they no longer have a distinct classification tier — "GK" is now purely a pack-dealing concern, not a rarity concern.

### Legends/Icons Pools (DRAFT-11)

- **D-08:** Enable `'legends'` and `'icons'` as selectable draft pools. The client (`GameSettingsScreen.tsx`) already renders both as greyed-out checkboxes with a "(coming soon)" label, gated by `SELECTABLE_DRAFT_POOLS` (currently `['original', 'mls', 'international']`) — this phase adds `'legends'` and `'icons'` to that allow-list and removes the disabled/coming-soon state for them.
- **D-09:** `isInPool()` in `draftEngine.ts` currently always returns `false` for `'legends'`/`'icons'` — needs real logic. **Naming mismatch to resolve during research/planning:** the CSV's `PoolTag` column uses singular values (`icon`, `legend` — confirmed present on Ronaldo, Haaland, De Bruyne, Neymar Jr [`icon`], Maradona, Paolo Maldini [`legend`]), while `DraftPoolId` uses plural (`'icons'`, `'legends'`). The mapping must bridge this, not assume a literal string match.
- **D-10:** Legends/Icons pools are small (a handful of tagged players each) — they will need heavy backfill from the fallback chain (D-11) whenever selected, by design.

### Pool Backfill Fallback Order

- **D-11:** Fallback chain for backfilling short packs is **MLS → Original only**. International is dropped from the fallback chain entirely (it remains directly selectable as a pool in settings, it just never backfills another pool's shortage). This replaces the current `FALLBACK_POOL_ORDER` (`Original → MLS → International`).

### Pack Composition & Round Structure

Replaces the current flat model (`PACKS_PER_MATCH = 8`, one fixed 7-card `PACK_COMPOSITION` for every pack). New model is **6 rounds, 12 packs total (2 packs per round, one per player), variable composition per round**:

- **D-12:** Round 1 — two 4-card **GK-only** packs (4 GK cards each). Pick pattern: draft one, swap, draft one (**2 picks per player**).
- **D-13:** Rounds 2–3 — two 4-card **all-common** packs each round. Pick pattern: draft one, swap, draft one, swap, draft one (**3 picks per player** per round).
- **D-14:** Round 4 — two 4-card packs, each composed of **2 uncommon + 2 common**. Pick pattern: 3 picks per player (same draft/swap/draft/swap/draft pattern).
- **D-15:** Rounds 5–6 — two 4-card packs each round, each composed of **1 chase-or-rare + 1 uncommon + 2 common**. Pick pattern: 3 picks per player per round.
- **D-16:** Total per player across all 6 rounds: **17 cards drafted** (2 from the GK round + 3×5 = 15 from rounds 2–6).
- **D-17:** Non-GK packs (rounds 2–6) exclude GK entirely and enforce **max 2 players per position bucket per pack**, where **FWD and ST count as one combined bucket** (not two separate ones) — so e.g. a pack could have at most 2 total players drawn from {FWD, ST} combined, alongside independent DEF and MID caps of 2 each.
- **D-18:** Cards dealt into a round's packs but never picked by either player (e.g. round 1 deals 8 GK cards total, only 4 get picked) are **discarded** — they do not automatically land on the bench or reappear anywhere.
- **D-19:** This is a structural change to `PACK_COMPOSITION`/`PACKS_PER_MATCH` — the current types model (one fixed composition applied uniformly) cannot express per-round variable composition + variable pick-count + position/GK constraints. Research/planning must design the new data shape, not just retune constant values.

### Draft Protocol / Cycle Machine

- **D-20:** The existing `DraftSubStep` (`PICK1`/`PICK2`/`PICK3`) and SWAP/SWAP_BACK/NEW_PACK transition model likely still fits the "draft, swap, draft[, swap, draft]" pattern per round, but round 1 has only 2 picks (no third pick) while rounds 2–6 have 3 — the state machine must support a **variable pick-count per round**, not a fixed cycle length.
- **D-21:** DRAFT-08's "forced keeper on cycle 4" auto-pick mechanic is **deleted outright** — fully superseded by the round-1 dedicated GK-pack round, which guarantees every player exactly 2 GK cards without any auto-pick fallback logic needed.

### Tier Visual Identity

- **D-22:** Tier border colors: **chase = purple (`#a855f7`), rare = red (`#ef4444`), uncommon = green (currently `#eab308` yellow — needs correcting), common = white (currently `#22c55e` green — needs correcting)**. No 5th "keeper" color (see D-05). The uncommitted `LineupAssignmentScreen.module.css` changes already have chase/rare correct but have uncommon/common colors swapped relative to what's wanted here.
- **D-23:** The tier-colored card border currently renders ONLY inside `DraftPackCarousel.tsx` (draft-stage carousel). It must be extended to **both** the starting-11 lineup slots (currently no tier styling at all) **and** the bench carousel (which already has a partial fallback tier-resolution heuristic in `LineupAssignmentScreen.tsx`'s `resolveTieredCard`) — so tier color is visible everywhere a drafted card appears, post-draft included.

### Claude's Discretion

- Exact internal data-shape for the new per-round pack-composition model (arrays vs. per-round config objects, etc.) — left to research/planning, per D-19.
- Exact mechanism for extending the `DraftSubStep`/cycle state machine to variable pick-counts per round — left to research/planning, per D-20.
- Whether `resolveTieredCard`'s existing `'keeper'` fallback heuristic in `LineupAssignmentScreen.tsx` needs updating in the same pass that removes the `'keeper'` tier value (very likely yes, since D-05 removes `'keeper'` as a valid tier) — flagged for the researcher, not re-litigated here.

### Folded Todos

None — the 4 todos matched by `todo.match-phase` (GK_KICK replay visibility, KICK_OFF_SETUP shot-path shading, header-winner eligibility, CSV consolidation) are all unrelated to draft recalibration and were not folded. See Deferred section.

</decisions>

<canonical_refs>

## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Draft data model & engine (current implementation being replaced/extended)

- `packages/shared/src/types.ts` (lines ~460–520) — `DraftPoolId`, `SELECTABLE_DRAFT_POOLS`, `DraftTier`, `TIER_PERCENTILE_BOUNDS`, `PACKS_PER_MATCH`, `PACK_COMPOSITION`, `DraftSubStep` — all of these constants/types are directly superseded by this phase's decisions (D-03, D-08, D-12–D-19)
- `packages/shared/src/draftEngine.ts` — `computeTotalStat`, `isInPool`, `resolvePoolPlayers`, `assignTiers`, `generateDraftPacks` (Fisher-Yates shuffle, backfill loop, per-tier dealing cursors) — the pack-generation algorithm this phase rewrites
- `packages/shared/src/draftEngine.test.ts` — existing test coverage for the model being replaced; a baseline for what new tests must cover

### Draft UI & session state (Phase 29 deliverables, extended by this phase)

- `packages/client/src/components/DraftPackCarousel.tsx` — only place `cardTier*` CSS classes currently apply
- `packages/client/src/components/LineupAssignmentScreen.tsx` — `resolveTieredCard` (line ~270, GK→'keeper'/else→'common' fallback heuristic needing update per D-05), `benchCards` memoization, `cardCache`
- `packages/client/src/components/LineupAssignmentScreen.module.css` — `.cardTierChase/.cardTierRare/.cardTierUncommon/.cardTierCommon/.cardTierKeeper` (has uncommitted color edits that partially but not fully match D-22)
- `packages/client/src/components/GameSettingsScreen.tsx` — `ALL_DRAFT_POOLS`, `SELECTABLE_DRAFT_POOLS`-driven disabled/"(coming soon)" state (lines ~16–130) — the exact spot D-08 unlocks Legends/Icons

### Requirements traceability

- `.planning/REQUIREMENTS.md` — DRAFT-04/05 (tier classification, pack generation — being superseded), DRAFT-08 (forced keeper — being deleted per D-21), DRAFT-11 (Legends/Icons — being enabled per D-08). Note: this file's traceability table is stale (last updated 2026-07-12, predates Phase 29's actual completion) — do not trust its Phase-number mapping for DRAFT-06..10 without cross-checking ROADMAP.md.
- `.planning/ROADMAP.md` Phase 28/29 sections — describe the current tier/pack/pick-and-swap model in full; useful as "what's being replaced" reference

No other external specs/ADRs — requirements for this phase were captured fresh in this discussion, not from a pre-existing doc.

</canonical_refs>

<code_context>

## Existing Code Insights

### Reusable Assets

- `computeTotalStat` (draftEngine.ts) — the total-stat formula (sum of 9 numeric fields) is unchanged by this phase; only how the resulting number maps to a tier changes (D-03).
- `shuffle` (Fisher-Yates, draftEngine.ts) — the injected-RNG shuffle helper is reusable as-is for the new per-round dealing logic.
- Existing `DraftSubStep`/SWAP/SWAP_BACK/NEW_PACK transition machinery in the draft session state machine is structurally close to the new round pattern (draft→swap→draft[→swap→draft]) — likely extend rather than replace, per D-20.

### Established Patterns

- Shared engine modules (`draftEngine.ts`, mirroring `scoreUtils.ts`) are pure, RNG-agnostic (RNG injected as a parameter), and import-identical on client/server — this convention must be preserved for whatever new pack-generation function replaces/extends `generateDraftPacks`.
- Tier/rarity display constants are deliberately kept out of the shared engine (D-13 from Phase 28: "tier value only this phase; display constants deferred") — CSS tier-color mapping lives client-side only, matching this phase's D-22/D-23 scope.

### Integration Points

- `SELECTABLE_DRAFT_POOLS` is validated on both client (disabled-checkbox UI) and server (`ROOM_SETTINGS_CONFIRM` handler allow-list, per the Phase 27 CR-01 fairness note in draftEngine.ts) — enabling Legends/Icons (D-08) must update both sides, not just the client checkbox state.
- `generateMatchPacks`/pack generation is server-authoritative (crypto.randomInt bound server-side) — any new per-round pack logic must preserve that boundary; packs cannot be generated or influenced client-side.

</code_context>

<specifics>
## Specific Ideas

The user provided the full round-by-round draft structure verbatim (see D-12–D-18) — this is a literal, non-negotiable structural spec, not a rough sketch. The planner should implement exactly this round sequence, not a reinterpreted/simplified version of it.

Exact tier-color hex values were not re-specified beyond D-22's named colors (purple/red/green/white) — the researcher/planner may reuse or pick reasonable hex values matching the existing purple/red already staged in `LineupAssignmentScreen.module.css` (`#a855f7` chase, `#ef4444` rare) and choose appropriate green/white values for uncommon/common.

</specifics>

<deferred>
## Deferred Ideas

- TBD City ST player naming/stats (D-02) — explicitly out of scope for this phase; separate cleanup task.

### Reviewed Todos (not folded)

- `2026-06-21-bug-gk-kick-ball-delivery-invisible-during-replay.md` — replay rendering bug, unrelated to draft recalibration
- `2026-07-02-bug-kickoff-setup-persistent-light-shading-on-shot-path-hexes.md` — rendering bug, unrelated
- `2026-07-12-bug-header-winner-piece-ineligible-next-phase.md` — rules bug, unrelated
- `csv-consolidation-player-pool.md` — already resolved by a prior phase (single `player-pool.csv` already exists); stale todo, candidate for closing separately

</deferred>

---

_Phase: 30-recalibrate-draft_
_Context gathered: 2026-07-21_
