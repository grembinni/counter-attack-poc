# Phase 30: recalibrate-draft - Research

**Researched:** 2026-07-21
**Domain:** In-repo TypeScript game-rules/data rewrite (draft tier classification, pack generation, pick/swap state machine, tier-color UI) — no new external technology
**Confidence:** HIGH (all findings sourced from direct codebase inspection and computed data analysis; no unverified third-party claims)

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** The in-progress `player-pool.csv` stat rebalance (broad attribute value changes across nearly all players, plus City roster swap: João Klauss/Mykhi Joyner/Sang-bin Jeong removed, Alex Mățan/Carlo Holse added) is in scope — finish it as part of this phase.
- **D-02:** The City ST row currently named literally `TBD` with placeholder stats (4,4,3,6,3,3,5) is explicitly **out of scope** for this phase — leave as-is, do not block phase completion on it.
- **D-03:** Tier assignment switches from session-relative percentile ranking (`TIER_PERCENTILE_BOUNDS`: top 10%/20%/40%, recomputed per draft session) to **fixed absolute total-stat thresholds**: chase = 32+, rare = 31 (exactly), uncommon = 29–30, common = <29 (total stat = sum of all 9 `PoolPlayer` numeric stat fields, per existing `computeTotalStat`).
- **D-04:** GKs are classified into the same 4 tiers (chase/rare/uncommon/common) using the **identical numeric cutoffs** as outfield players — no separate GK-specific thresholds, and no reserved "keeper" tier for classification purposes. (Context claimed: "Verified against current pool data: all 16 GKs land in chase/rare/uncommon under these cutoffs — none currently fall below 29." **Researcher finding: this claim does not hold against the actual current CSV data — see Common Pitfalls #1, this is flagged prominently, not silently corrected.**)
- **D-05:** The `'keeper'` `DraftTier` value/color goes away entirely for tier-classification and display purposes. GK cards show whichever of chase/rare/uncommon/common color their total stat lands them in, same as any outfield card.
- **D-06:** Once Legends/Icons pools are enabled, those players are **not** given a tier above chase — they're classified by the same absolute thresholds as everyone else and will typically land in chase.
- **D-07:** GKs remain a distinct **pack-composition** category (dedicated GK-only packs in round 1) even though they no longer have a distinct classification tier — "GK" is now purely a pack-dealing concern, not a rarity concern.
- **D-08:** Enable `'legends'` and `'icons'` as selectable draft pools. The client (`GameSettingsScreen.tsx`) already renders both as greyed-out checkboxes with a "(coming soon)" label, gated by `SELECTABLE_DRAFT_POOLS` (currently `['original', 'mls', 'international']`) — this phase adds `'legends'` and `'icons'` to that allow-list and removes the disabled/coming-soon state for them.
- **D-09:** `isInPool()` in `draftEngine.ts` currently always returns `false` for `'legends'`/`'icons'` — needs real logic. **Naming mismatch to resolve during research/planning:** the CSV's `PoolTag` column uses singular values (`icon`, `legend`), while `DraftPoolId` uses plural (`'icons'`, `'legends'`). The mapping must bridge this, not assume a literal string match.
- **D-10:** Legends/Icons pools are small (a handful of tagged players each) — they will need heavy backfill from the fallback chain (D-11) whenever selected, by design.
- **D-11:** Fallback chain for backfilling short packs is **MLS → Original only**. International is dropped from the fallback chain entirely (it remains directly selectable as a pool in settings, it just never backfills another pool's shortage). This replaces the current `FALLBACK_POOL_ORDER` (`Original → MLS → International`).
- **D-12:** Round 1 — two 4-card **GK-only** packs (4 GK cards each). Pick pattern: draft one, swap, draft one (**2 picks per player**).
- **D-13:** Rounds 2–3 — two 4-card **all-common** packs each round. Pick pattern: draft one, swap, draft one, swap, draft one (**3 picks per player**) per round.
- **D-14:** Round 4 — two 4-card packs, each composed of **2 uncommon + 2 common**. Pick pattern: 3 picks per player (same draft/swap/draft/swap/draft pattern).
- **D-15:** Rounds 5–6 — two 4-card packs each round, each composed of **1 chase-or-rare + 1 uncommon + 2 common**. Pick pattern: 3 picks per player per round.
- **D-16:** Total per player across all 6 rounds: **17 cards drafted** (2 from the GK round + 3×5 = 15 from rounds 2–6).
- **D-17:** Non-GK packs (rounds 2–6) exclude GK entirely and enforce **max 2 players per position bucket per pack**, where **FWD and ST count as one combined bucket** (not two separate ones) — so e.g. a pack could have at most 2 total players drawn from {FWD, ST} combined, alongside independent DEF and MID caps of 2 each.
- **D-18:** Cards dealt into a round's packs but never picked by either player (e.g. round 1 deals 8 GK cards total, only 4 get picked) are **discarded** — they do not automatically land on the bench or reappear anywhere.
- **D-19:** This is a structural change to `PACK_COMPOSITION`/`PACKS_PER_MATCH` — the current types model (one fixed composition applied uniformly) cannot express per-round variable composition + variable pick-count + position/GK constraints. Research/planning must design the new data shape, not just retune constant values.
- **D-20:** The existing `DraftSubStep` (`PICK1`/`PICK2`/`PICK3`) and SWAP/SWAP_BACK/NEW_PACK transition model likely still fits the "draft, swap, draft[, swap, draft]" pattern per round, but round 1 has only 2 picks (no third pick) while rounds 2–6 have 3 — the state machine must support a **variable pick-count per round**, not a fixed cycle length.
- **D-21:** DRAFT-08's "forced keeper on cycle 4" auto-pick mechanic is **deleted outright** — fully superseded by the round-1 dedicated GK-pack round, which guarantees every player exactly 2 GK cards without any auto-pick fallback logic needed.
- **D-22:** Tier border colors: **chase = purple (`#a855f7`), rare = red (`#ef4444`), uncommon = green (currently `#eab308` yellow — needs correcting), common = white (currently `#22c55e` green — needs correcting)**. No 5th "keeper" color (see D-05). The uncommitted `LineupAssignmentScreen.module.css` changes already have chase/rare correct but have uncommon/common colors swapped relative to what's wanted here.
- **D-23:** The tier-colored card border currently renders ONLY inside `DraftPackCarousel.tsx` (draft-stage carousel). It must be extended to **both** the starting-11 lineup slots (currently no tier styling at all) **and** the bench carousel (which already has a partial fallback tier-resolution heuristic in `LineupAssignmentScreen.tsx`'s `resolveTieredCard`) — so tier color is visible everywhere a drafted card appears, post-draft included.

### Claude's Discretion

- Exact internal data-shape for the new per-round pack-composition model (arrays vs. per-round config objects, etc.) — left to research/planning, per D-19. **Researcher recommendation provided below in Architecture Patterns.**
- Exact mechanism for extending the `DraftSubStep`/cycle state machine to variable pick-counts per round — left to research/planning, per D-20. **Researcher recommendation provided below in Architecture Patterns.**
- Whether `resolveTieredCard`'s existing `'keeper'` fallback heuristic in `LineupAssignmentScreen.tsx` needs updating in the same pass that removes the `'keeper'` tier value (very likely yes) — **confirmed yes below, with a concrete simpler replacement (`classifyTier`) that removes the need for a heuristic entirely.**

### Deferred Ideas (OUT OF SCOPE)

- TBD City ST player naming/stats (D-02) — explicitly out of scope for this phase; separate cleanup task.
- Reviewed-but-not-folded todos: GK_KICK replay visibility, KICK_OFF_SETUP shot-path shading, header-winner eligibility, CSV consolidation (already resolved) — all unrelated to draft recalibration.

</user_constraints>

<phase_requirements>

## Phase Requirements

| ID       | Description                                                                                                                                                                 | Research Support                                                                                                                                                                                                          |
| -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| DRAFT-04 | Player pool classified by total stat count into tiers (originally 5-tier percentile model) — **superseded by D-03/D-04/D-05**: 4-tier fixed absolute threshold model        | `classifyTier()` design (Architecture Patterns), verified tier-distribution data (Common Pitfalls #1), `TIER_STAT_THRESHOLDS` constant replacing `TIER_PERCENTILE_BOUNDS`                                                 |
| DRAFT-05 | Packs generated from selected pool with configurable per-rarity composition — **superseded by D-12–D-19**: 6-round, position/GK-constrained, variable per-round composition | New `DRAFT_ROUNDS` config table design, round-scoped pack generation algorithm, position-bucket-constrained dealing loop (Architecture Patterns)                                                                          |
| DRAFT-08 | Forced-keeper-on-cycle-4 auto-pick — **deleted per D-21**                                                                                                                   | `checkKeeperSafety`/`autoSelectKeeperIfMissing` removal plan, `keeperAutoPickedThisCycle`/`homeHasKeeper`/`awayHasKeeper` field removal, client banner removal (Common Pitfalls #7)                                       |
| DRAFT-11 | Legends and Icons player pools — **enabled per D-08/D-09**                                                                                                                  | `isInPool()` PoolTag→DraftPoolId bridge design, `SELECTABLE_DRAFT_POOLS` allow-list update (client+server), pool-size feasibility data (Common Pitfalls #2), existing test assertions that must flip (Common Pitfalls #8) |

</phase_requirements>

## Summary

This phase is a self-contained, in-repo TypeScript rewrite of the draft system's rules/data layer — it introduces **no new external packages, frameworks, or services**. All prior research recommendations in `CLAUDE.md` (Socket.io, React/Vite, pnpm workspaces) remain unchanged and untouched by this phase. The work is entirely: (1) finishing a CSV data edit and regenerating a derived TypeScript file, (2) replacing a percentile-based tier classifier with a fixed-threshold one, (3) replacing a flat 8-pack/4-cycle draft engine with a 6-round, per-round-composition, position-constrained one, (4) extending an existing pick/swap state machine to variable-length rounds, and (5) extending an existing tier-color CSS system from one component to three.

The single most important operational finding is that **`packages/shared/src/teams.ts` is an auto-generated file** (`pnpm --filter @counter-attack/shared run seed:rosters`), and it has **not yet been regenerated** against the in-progress `player-pool.csv` edit — `git status` shows only the CSV as modified, not `teams.ts`. Every stat used by `computeTotalStat`/`assignTiers`/pack generation at runtime comes from `teams.ts`, not the CSV directly. "Finishing the CSV edit" (D-01) is incomplete as a phase deliverable unless the seed script is re-run and its output committed.

The second most important finding is a **direct computational contradiction of a CONTEXT.md verification claim**: D-04 asserts "all 16 GKs land in chase/rare/uncommon... none currently fall below 29" under the new thresholds. Running the documented `computeTotalStat` formula (including the seed script's GK `highPass`-zeroing override) against the actual current CSV data shows **11 of 16 GKs land below 29** (in `common`). This is surfaced prominently below (Common Pitfalls #1) — it is not fatal to the phase (a `common`-tier GK card is still valid per D-07, since GK is a pack-dealing category, not a rarity category), but the planner and/or user must consciously decide whether to (a) accept this distribution, or (b) further rebalance GK stats as part of "finishing" D-01's CSV edit.

**Primary recommendation:** Introduce a single pure `classifyTier(totalStat: number): DraftTier` function in `draftEngine.ts` (replacing the population-percentile `assignTiers` ranking logic entirely, since fixed absolute thresholds require no population context) and reuse it in exactly three places: server-side pack generation, `draftEngine.test.ts`, and the client's `resolveTieredCard` fallback in `LineupAssignmentScreen.tsx` — this one function is what makes D-03/D-04/D-05/D-23's discretion item all consistent and trivially testable. Model the new pack/round structure as an explicit `DRAFT_ROUNDS` config array (not a single retuned constant), and change pack-to-player assignment from a single global shuffle-and-split (`assignPackOrders`) to a per-round coin-flip, since round-specific composition means packs are no longer structurally interchangeable across rounds.

## Architectural Responsibility Map

| Capability                                              | Primary Tier                                            | Secondary Tier                                              | Rationale                                                                                                                                                                                                                           |
| ------------------------------------------------------- | ------------------------------------------------------- | ----------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Player pool data (CSV → generated PLAYER_POOL)          | Shared package (build-time codegen)                     | —                                                           | `packages/shared/src/data/player-pool.csv` + `seed-rosters.ts` is the existing, unchanged data pipeline; this phase only edits CSV values, it does not change the pipeline                                                          |
| Tier classification (`classifyTier`)                    | Shared package (pure function)                          | —                                                           | Must be importable identically by server (pack generation) and client (lineup/bench tier-color fallback) — matches existing `computeTotalStat`/`scoreUtils.ts` convention                                                           |
| Pack generation / RNG binding                           | API / Backend (server)                                  | Shared package (pure algorithm)                             | Pack contents are gameplay-affecting and must use `crypto.randomInt` server-side only (T-28-04-FAIR, unchanged fairness boundary) — the shared engine stays RNG-agnostic, the server module (`draftPacks.ts`) binds the real CSPRNG |
| Draft session state machine (round/substep progression) | API / Backend (server, `draftSession.ts`)               | —                                                           | Pure, no-`io`-import module mirroring `gameEngine.ts`'s separation from `roomHandlers.ts` — unchanged architectural pattern, only its internal transition table changes                                                             |
| Draft pool selection allow-list validation              | API / Backend (server, `ROOM_SETTINGS_CONFIRM` handler) | Browser / Client (`GameSettingsScreen.tsx` checkbox gating) | Server is the authoritative allow-list (`SELECTABLE_DRAFT_POOLS`); client-side disabling is UX-only and must never be the sole gate (ASVS V5, pre-existing pattern)                                                                 |
| Tier-color card border rendering                        | Browser / Client                                        | —                                                           | Pure CSS/React display concern; `TIER_CARD_CLASS` map and `DraftCardBody`/`LineupStatCard` components                                                                                                                               |

## Standard Stack

No new libraries, frameworks, or services are introduced by this phase. The existing stack (Node 22, Socket.io 4.x, React 18 + Vite 5, TypeScript 5.x, pnpm workspaces, vitest) is unchanged and sufficient. `crypto.randomInt` (Node built-in) remains the sole RNG source for pack generation, consistent with `CLAUDE.md`'s "Raw WebSocket" / fairness conventions and the existing `draftPacks.ts` module.

### Alternatives Considered

Not applicable — no new tooling decision exists in this phase's scope.

## Package Legitimacy Audit

**Not applicable.** This phase installs zero new external packages (npm or otherwise). No `package.json` dependency changes are anticipated. If the planner discovers a need for any new dependency during implementation, it must be routed back through this gate before use.

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│  CSV DATA EDIT (D-01)                                                │
│  packages/shared/src/data/player-pool.csv                            │
│         │                                                            │
│         ▼  pnpm --filter @counter-attack/shared run seed:rosters     │
│  packages/shared/src/teams.ts  (AUTO-GENERATED, must be re-run       │
│         │                       and committed — currently STALE)     │
│         ▼                                                            │
│  PLAYER_POOL: readonly PoolPlayer[]                                  │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│  SHARED ENGINE (packages/shared/src/draftEngine.ts) — pure, RNG-agnostic │
│                                                                        │
│  computeTotalStat(player) ──► classifyTier(totalStat) ──► DraftTier   │
│                                (NEW: replaces assignTiers percentile  │
│                                 ranking entirely — no population      │
│                                 context needed for a fixed threshold) │
│                                                                        │
│  isInPool(player, poolId) ──► bridges CSV PoolTag (singular:          │
│                                'legend'/'icon') to DraftPoolId         │
│                                (plural: 'legends'/'icons') (D-09)     │
│                                                                        │
│  generateDraftPacks(selectedPools, rng) ──►                          │
│    NEW: iterates DRAFT_ROUNDS config (6 entries) instead of a single │
│    PACKS_PER_MATCH × PACK_COMPOSITION loop. Per round:                │
│      1. resolve tier-slot needs (GK-only OR tiered composition)      │
│      2. deal 2 packs (one per side) enforcing D-17's per-pack        │
│         position-bucket cap (DEF≤2, MID≤2, {FWD∪ST}≤2) ACROSS ALL    │
│         cards in that pack regardless of which tier-slot they filled │
│      3. tag each DraftPack with its round number                     │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│  SERVER (packages/server/src)                                        │
│                                                                        │
│  draftPacks.ts: generateMatchPacks() binds crypto.randomInt (unchanged)│
│                                                                        │
│  draftSession.ts: pure state machine                                 │
│    createDraftSession ──► openNextRound (was openNextPack) ──►       │
│    applyPick ──► [round===1 ? PICK1→PICK2→(round complete) :         │
│                   PICK1→PICK2→PICK3→(round complete)] ──►             │
│    advanceSubStep reads DRAFT_ROUNDS[round].picks to decide whether   │
│    to stop at PICK2 (round 1) or continue to PICK3 (rounds 2-6)      │
│    NO keeper-safety-net logic (D-21: fully removed, not just unused) │
│                                                                        │
│  roomHandlers.ts: ROOM_SETTINGS_CONFIRM allow-lists 5 pools now       │
│    (SELECTABLE_DRAFT_POOLS includes legends/icons) (D-08)             │
│    DRAFT_PICK handler: unchanged GK-slot-role validation logic works │
│    as-is (still checks card.role === 'GK' vs FormationSlot.slotRole)  │
└─────────────────────────────────────────────────────────────────────┘
                              │  DRAFT_STATE_UPDATED (privacy-scoped view)
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│  CLIENT (packages/client/src/components)                              │
│                                                                        │
│  DraftPackCarousel.tsx: TIER_ORDER/TIER_CARD_CLASS drop 'keeper'      │
│                          (4 entries now, not 5)                       │
│  LineupAssignmentScreen.tsx:                                          │
│    resolveTieredCard(cardId) ──► classifyTier(computeTotalStat(       │
│      PLAYER_MAP.get(cardId))) — NO MORE role-based heuristic          │
│    LineupStatCard (starting-11 slots) ──► NEW: apply TIER_CARD_CLASS  │
│      using a card resolved the same way (currently plain PoolPlayer,  │
│      no tier at all) — this is the D-23 gap                          │
│    BenchCarousel ──► ALREADY uses DraftCardBody/TIER_CARD_CLASS       │
│      via resolveTieredCard — this half of D-23 is largely DONE        │
│    showKeeperBanner / keeperAutoPickedThisCycle UI ──► REMOVE (D-21)  │
│  GameSettingsScreen.tsx: ALL_DRAFT_POOLS unchanged (already lists all │
│    5); disabled/coming-soon logic driven by SELECTABLE_DRAFT_POOLS    │
│    — no client code change needed beyond the shared constant (D-08)  │
└─────────────────────────────────────────────────────────────────────┘
```

### Recommended Project Structure

No new files/folders — this phase modifies existing files in place:

```
packages/shared/src/
├── data/player-pool.csv        # finish D-01 edit
├── teams.ts                    # REGENERATE via seed:rosters (currently stale)
├── types.ts                    # DraftTier (4 values), TIER_STAT_THRESHOLDS (new,
│                                #   replaces TIER_PERCENTILE_BOUNDS), DRAFT_ROUNDS config
│                                #   (new, replaces PACKS_PER_MATCH/PACK_COMPOSITION),
│                                #   DraftSession shape changes (remove hasKeeper/
│                                #   keeperAutoPickedThisCycle fields; add round-aware fields)
├── draftEngine.ts               # classifyTier (new), isInPool (bridge legends/icons),
│                                #   FALLBACK_POOL_ORDER (reordered: mls, original),
│                                #   generateDraftPacks rewritten for round structure
└── draftEngine.test.ts         # rewrite tier/pack tests for new model

packages/server/src/
├── draftPacks.ts                # generateMatchPacks — signature likely unchanged
├── draftSession.ts              # round-aware state machine; remove keeper-safety-net
├── draftSession.test.ts        # rewrite substep/round transition tests
├── roomHandlers.ts              # ROOM_SETTINGS_CONFIRM already reads SELECTABLE_DRAFT_POOLS
│                                #   dynamically — likely no code change, only the shared
│                                #   constant's value changes
└── __tests__/draftPacks.test.ts, draftSession.integration.test.ts,
    draftReconnect.integration.test.ts, lineupAssignment.integration.test.ts  # rewrite

packages/client/src/components/
├── GameSettingsScreen.tsx       # no code change expected (already data-driven);
│   .test.tsx                   #   REWRITE tests asserting legends/icons are disabled
├── DraftPackCarousel.tsx        # TIER_ORDER/TIER_CARD_CLASS: drop 'keeper' entry
├── BenchCarousel.tsx            # no change expected — already tier-aware
└── LineupAssignmentScreen.tsx   # resolveTieredCard simplification; LineupStatCard tier
    .module.css                 #   border extension; remove keeper banner; D-22 colors
```

### Pattern 1: Fixed-threshold tier classification replaces percentile ranking

**What:** Replace `assignTiers`'s outfield-population stable-sort + percentile-rank logic with a direct per-player classifier.
**When to use:** Any place a `DraftTier` is derived from a player's stats.
**Example:**

```typescript
// packages/shared/src/draftEngine.ts — proposed replacement
// [ASSUMED: researcher design proposal, not yet implemented/verified in this session]

export const TIER_STAT_THRESHOLDS = {
  chase: 32,
  rare: 31,
  uncommon: 29,
} as const;

/** D-03/D-04: absolute-threshold classification — identical rule for GK and outfield. */
export function classifyTier(totalStat: number): DraftTier {
  if (totalStat >= TIER_STAT_THRESHOLDS.chase) return 'chase';
  if (totalStat === TIER_STAT_THRESHOLDS.rare) return 'rare';
  if (totalStat >= TIER_STAT_THRESHOLDS.uncommon) return 'uncommon';
  return 'common';
}

export function assignTiers(players: PoolPlayer[]): TieredPoolPlayer[] {
  return players.map((player) => {
    const totalStat = computeTotalStat(player);
    return { ...player, tier: classifyTier(totalStat), totalStat };
  });
}
```

This removes the outfield-vs-GK split, the stable-sort, and the percentile-rank math entirely — a strict simplification since D-04 mandates identical cutoffs for every role. `DraftTier` narrows from 5 to 4 values (`'chase' | 'rare' | 'uncommon' | 'common'`), which is a breaking type change everywhere `'keeper'` is referenced (see Common Pitfalls #6).

### Pattern 2: Round-configuration table replaces flat pack-composition constant

**What:** Model the 6-round structure as data, not as branching logic scattered through the pack generator.
**When to use:** `generateDraftPacks`'s dealing loop and `draftSession.ts`'s substep transitions should both read from this single source of truth.
**Example:**

```typescript
// packages/shared/src/types.ts — proposed shape [ASSUMED: design proposal]

/** A tier-slot need within one pack. 'chaseOrRare' is a virtual combined bucket —
 *  filled by merging chase+rare candidates into one shuffled draw pool for that slot
 *  (an even, unbiased mix), NOT by preferring one tier over the other. */
type PackSlot =
  | { tier: 'common' | 'uncommon' | 'chase' | 'rare'; count: number }
  | { tier: 'chaseOrRare'; count: number };

export type RoundConfig =
  | { round: number; kind: 'gk'; cardsPerPack: 4; picks: 2 }
  | { round: number; kind: 'tiered'; cardsPerPack: 4; picks: 3; slots: PackSlot[] };

export const DRAFT_ROUNDS: readonly RoundConfig[] = [
  { round: 1, kind: 'gk', cardsPerPack: 4, picks: 2 },
  { round: 2, kind: 'tiered', cardsPerPack: 4, picks: 3, slots: [{ tier: 'common', count: 4 }] },
  { round: 3, kind: 'tiered', cardsPerPack: 4, picks: 3, slots: [{ tier: 'common', count: 4 }] },
  {
    round: 4,
    kind: 'tiered',
    cardsPerPack: 4,
    picks: 3,
    slots: [
      { tier: 'uncommon', count: 2 },
      { tier: 'common', count: 2 },
    ],
  },
  {
    round: 5,
    kind: 'tiered',
    cardsPerPack: 4,
    picks: 3,
    slots: [
      { tier: 'chaseOrRare', count: 1 },
      { tier: 'uncommon', count: 1 },
      { tier: 'common', count: 2 },
    ],
  },
  {
    round: 6,
    kind: 'tiered',
    cardsPerPack: 4,
    picks: 3,
    slots: [
      { tier: 'chaseOrRare', count: 1 },
      { tier: 'uncommon', count: 1 },
      { tier: 'common', count: 2 },
    ],
  },
] as const;

export const DRAFT_ROUND_COUNT = DRAFT_ROUNDS.length; // 6
export const PACKS_PER_ROUND = 2; // one per side — replaces PACKS_PER_MATCH
```

This single table drives: (a) pack dealing composition + GK-only exclusion, (b) `advanceSubStep`'s decision to stop after PICK2 (round 1) vs. continue to PICK3 (rounds 2–6), and (c) total-picks bookkeeping (`DRAFT-16`'s 17-card total is `sum(picks)` over the table, not a hardcoded literal). Total cards dealt per side across the match = 2 + 3+3+3+3+3 = 17, matching D-16.

### Pattern 3: Per-round pack-to-player assignment (NOT a global shuffle-and-split)

**What:** `assignPackOrders` currently shuffles ALL pack indices together and splits the shuffled list in half (first half → home, second half → away). This only worked because every pack had **identical** composition under the old model.
**Why it must change:** Under the new model, pack composition is round-specific (GK-only in round 1, uncommon+common in round 4, etc.). A global shuffle-and-split could theoretically hand home player a round-4-composition pack while home's `cycle`/`round` counter still says "round 1" if the shuffle happens to place that pack early — the packs are no longer interchangeable across rounds, only within a round's own pair.
**Recommendation:** Generate packs **grouped by round** (2 packs per round, tagged with a `round` field), and randomize only **which of the two same-round packs goes to home vs. away** (a single coin-flip per round, using the injected `rng`), never shuffle across round boundaries.

```typescript
// packages/server/src/draftSession.ts — proposed change [ASSUMED: design proposal]
function assignRoundPackOrder(rng: RandomIntFn): ['home' | 'away', 'home' | 'away'] {
  // rng(0,2) === 0 → [packA→home, packB→away]; === 1 → [packA→away, packB→home]
  return rng(0, 2) === 0 ? ['home', 'away'] : ['away', 'home'];
}
```

Fairness invariant (T-28-04-FAIR / CR-01) is preserved: which specific _cards_ land in which pack is still randomized by the shuffle-and-deal step; only the "packA vs packB → home vs away" assignment changes from a match-wide shuffle to a per-round coin-flip. This is a **structural correction** the planner must apply — not something CONTEXT.md called out explicitly, since it only surfaces once you examine `assignPackOrders`'s current implementation in detail.

### Pattern 4: Position-bucket-constrained dealing (D-17) is a pack-wide, cross-tier constraint

**What:** For rounds 2–6, at most 2 cards in a given pack may come from `{DEF}`, at most 2 from `{MID}`, and at most 2 from `{FWD, ST}` combined — **counted across the whole 4-card pack, regardless of which tier-slot each card filled** (e.g. a round-4 pack's 2 uncommon + 2 common cards must jointly respect the cap, not independently per tier).
**Recommendation:** Deal each pack slot-by-slot in a fixed order (rarest first: chaseOrRare → uncommon → common), maintaining a per-pack `Record<'DEF'|'MID'|'FWD_ST', number>` counter; when drawing the next candidate from a tier's shuffled cursor, skip candidates whose bucket is already at 2 and advance to the next unused card in that tier's shuffled array (a linear scan forward, not a hard reshuffle) — falling back to relaxing the cap only if the tier's array is exhausted without a valid candidate (verified as a low-probability edge case given current pool sizes — see Common Pitfalls #2).

### Pattern 5: Bootstrapping Legends/Icons via a PoolTag → DraftPoolId bridge

**What:** `isInPool` must map CSV `PoolTag` (`'legend'`, `'icon'` — singular, matches `PoolPlayer.poolTag`'s existing type) to the plural `DraftPoolId` values.
**Example:**

```typescript
// packages/shared/src/draftEngine.ts — proposed addition [ASSUMED: design proposal]
const POOL_TAG_TO_DRAFT_POOL: Readonly<Record<'legend' | 'icon', DraftPoolId>> = {
  legend: 'legends',
  icon: 'icons',
};

export function isInPool(player: PoolPlayer, poolId: DraftPoolId): boolean {
  if (poolId === 'original') {
    return player.sourceTeamId === 'free-agent' && !player.poolTag;
  }
  if (poolId === 'mls' || poolId === 'international') {
    const config = TEAM_CONFIGS[player.sourceTeamId as TeamId];
    return config?.league === poolId;
  }
  // 'legends' / 'icons' (D-09): bridge the CSV's singular PoolTag to the plural DraftPoolId.
  return player.poolTag !== undefined && POOL_TAG_TO_DRAFT_POOL[player.poolTag] === poolId;
}
```

### Anti-Patterns to Avoid

- **Re-adding a `'keeper'` fallback tier client-side:** D-05 removes `'keeper'` entirely; any leftover role-based fallback (`role === 'GK' ? 'keeper' : 'common'`) must be replaced with `classifyTier(computeTotalStat(...))`, not patched to avoid the literal string `'keeper'` while keeping a role-based special case.
- **Keeping `TIER_PERCENTILE_BOUNDS`/percentile logic "just in case":** Dead code that references a population-relative model will confuse the next reader given D-03's explicit switch to absolute thresholds — remove, don't deprecate-in-place.
- **Treating `generateDraftPacks`'s per-tier need count as match-wide only:** Needs must be computed **per round-pack-pair**, not as one lump total across all 6 rounds, because position-bucket constraints are pack-scoped (see Pattern 4) — computing totals alone (e.g. "need 8 commons across the match") is necessary but not sufficient; the dealing loop still needs per-pack bucket tracking.

## Don't Hand-Roll

| Problem                  | Don't Build                                         | Use Instead                                                                                                                                                                                                              | Why                                                                                                                                   |
| ------------------------ | --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| Shuffling/dealing cards  | A new shuffle implementation                        | The existing Fisher-Yates `shuffle<T>()` helper (already duplicated once, in `draftEngine.ts` and `draftSession.ts` per an explicit "do NOT import the private one" convention noted in `draftSession.ts`'s doc comment) | Proven correct, already unit-tested via `assignPackOrders`/`assignBenchNumbers`                                                       |
| Total-stat computation   | A new sum formula                                   | `computeTotalStat` (unchanged, D-07 confirms the formula itself doesn't change — only the tier-mapping function downstream of it does)                                                                                   | Already the single source of truth, already tested                                                                                    |
| CSPRNG for pack fairness | `Math.random()` or a seeded PRNG in production code | `crypto.randomInt` bound in `draftPacks.ts` (unchanged pattern)                                                                                                                                                          | T-28-04-FAIR — pack contents are gameplay-affecting; this is an established project-wide convention (`diceUtils.ts`, `gameEngine.ts`) |

**Key insight:** Every "don't hand-roll" item here is about NOT re-deriving primitives that Phase 28/29 already built correctly — this phase's actual complexity is in the round/composition/bucket **data shape and transition logic**, which has no existing off-the-shelf abstraction to reuse (it's bespoke game rules, not a solved infrastructure problem).

## Runtime State Inventory

> Included because this phase edits a data file with a derived/generated build artifact — the closest fit among the trigger categories, even though this is not a classic rename/refactor phase.

| Category            | Items Found                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Action Required                                                                                                                                                                                                                       |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Stored data         | None — draft session state is entirely in-memory per-room (`room.draftSession`), never persisted to disk/DB. No migration needed.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | None                                                                                                                                                                                                                                  |
| Live service config | None — no external services (n8n, Datadog, etc.) reference draft data.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | None                                                                                                                                                                                                                                  |
| OS-registered state | None.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | None                                                                                                                                                                                                                                  |
| Secrets/env vars    | None — no secrets reference tier names, pool ids, or pack constants.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | None                                                                                                                                                                                                                                  |
| Build artifacts     | **`packages/shared/src/teams.ts` is auto-generated from `player-pool.csv` via `pnpm --filter @counter-attack/shared run seed:rosters` and is currently STALE relative to the in-progress CSV edit** (confirmed: `git status` shows only the CSV modified, not `teams.ts`; spot-checked several rows — e.g. Alex Mățan/Carlo Holse, the new City roster additions, do not yet appear in `teams.ts`'s `PLAYER_POOL` array). The seed script must be re-run and its output committed as part of this phase, or every stat-dependent computation (`computeTotalStat`, tier classification, pack generation) will silently use OLD data despite the CSV looking "finished." | Re-run `pnpm --filter @counter-attack/shared run seed:rosters` after finishing the CSV edit; commit the regenerated `teams.ts`; re-verify player counts (`EXPECTED_TOTAL = 188` fail-fast assertion in the seed script) still passes. |

## Common Pitfalls

### Pitfall 1: CONTEXT.md's GK-tier verification claim does not match actual computed data — [VERIFIED: computed directly from packages/shared/src/data/player-pool.csv using the documented computeTotalStat formula and seed-rosters.ts's GK highPass-zeroing/floor-to-1 overrides]

**What goes wrong:** D-04 states "Verified against current pool data: all 16 GKs land in chase/rare/uncommon under these cutoffs — none currently fall below 29." Running the actual formula against the actual current CSV shows **11 of 16 GKs land in `common` (below 29)**: Maxime Crepeau (28), Roman Bürki (27), Patrick Schulte (28), Jordan Pickford (26), Oliver Walker (28), Tim Firrell (27), Guillermo Ochoa (27), Dayne St. Clair (28), Andrew Thomas (28), Unai Simon (28), Matt Turner (28). Only 1 GK is `rare` and 4 are `uncommon`; zero are `chase`.
**Why it happens:** The seed script (`seed-rosters.ts`) forces every GK's `highPass` to 0 regardless of the CSV value (a pre-existing, unrelated Phase 19 rule: "GKs use GK kick accuracy rule, not highPass") — this alone removes 3–5 points from a GK's total compared to a naive CSV-column sum, which is likely how the verification in CONTEXT.md's discussion session was computed (summing CSV columns directly without applying this override, or without accounting for the CSV edit's exact current state).
**How to avoid:** This is not something the planner can silently "fix" by re-deriving a different formula — `computeTotalStat` and the GK `highPass`-zeroing rule are both pre-existing, locked, unrelated-to-this-phase behaviors. The planner has two legitimate paths: (a) accept the distribution as-is (functionally harmless per D-07 — GK tier is cosmetic only, pack composition is unaffected since GK cards are dealt by role, not tier), and note it in the phase's plan/verification docs as a consciously-accepted outcome; or (b) treat "finishing the CSV edit" (D-01) as including a further GK stat bump specifically targeting this invariant, which would require going back to the user for confirmation since D-04's stated verification was a premise handed down from CONTEXT.md, not something this research is positioned to unilaterally re-litigate.
**Warning signs:** If plan verification tests assert "no GK is ever `common` tier," they will fail against current data — do not write such a test without first resolving (a) vs (b) above.

### Pitfall 2: Small pools (Legends/Icons, GK-heavy rounds) are supply-constrained in specific ways — [VERIFIED: computed from current CSV, applying D-11's pool definitions]

**What goes wrong:** Round 1 needs 8 GK cards per match (2 packs × 4 cards). If a user selects only `'international'` (6 GKs) with no other pool checked, GK supply is short by 2 — but D-11's fallback chain (`mls`, `original`) covers this (10 GK combined from those two pools is always available regardless of what's selected, since neither is ever removed from being a backfill _source_ — only from being backfilled _into_). Legends (0 GKs) and Icons (0 GKs) pools are even more GK-supply-constrained by design (D-10) and rely entirely on the fallback chain for round 1.
**Why it happens:** GK count per league: original=4, mls=6, international=6 (16 total). Selecting a single non-MLS/non-Original pool alone never has enough GKs for round 1 without backfill.
**How to avoid:** Confirm the round-1 GK dealing step draws from the SAME backfill-augmented union the rest of the pack generator uses (i.e., don't special-case round 1 to skip backfill) — this is a natural consequence of Pattern 2/4's design if the round loop reuses the same backfill-then-deal structure the current `generateDraftPacks` already has, just re-scoped to run once per round-slot-kind rather than once globally.
**Warning signs:** A test selecting `['legends']` or `['icons']` alone that expects round-1 packs to fail/throw would be over-strict — the fallback chain (verified: MLS+Original = 10 GKs) should make this succeed, matching D-10's explicit "heavy backfill by design" expectation.

### Pitfall 3: `assignPackOrders`'s global shuffle-and-split breaks under per-round composition

See Architecture Patterns, Pattern 3. This is a structural bug risk if the planner reuses `assignPackOrders` verbatim rather than adapting it to a per-round coin-flip — flagged here again because it is easy to miss (the function still "compiles" and "looks correct" if naively reused with the new pack count, it just silently produces round/composition mismatches for one of the two players in some fraction of matches).

### Pitfall 4: `PACKS_PER_MATCH`/`PACK_COMPOSITION` are referenced in 8 files

**What goes wrong:** These two constants (and `TIER_PERCENTILE_BOUNDS`, `FALLBACK_POOL_ORDER`) are imported/asserted-against in: `packages/shared/src/types.ts` (definition), `packages/shared/src/draftEngine.ts` (usage), `packages/shared/src/draftEngine.test.ts`, `packages/server/src/__tests__/draftPacks.test.ts`, `packages/server/src/draftSession.ts`, `packages/server/src/__tests__/draftSession.integration.test.ts`, plus doc-comment-only mentions in `packages/client/src/components/BenchCarousel.tsx` (stale comment referencing "cycle 4/16 cards" milestones in `roomHandlers.ts`, non-functional but should be updated for clarity).
**Why it happens:** This was a load-bearing pair of constants for the old flat model; the new model has no single "N packs, uniform composition" invariant to preserve.
**How to avoid:** Grep for all 4 constant names across the repo before considering the rename "done" — a partial rename (e.g. leaving `PACKS_PER_MATCH` defined but unused, or leaving a stale doc comment asserting an old cycle count) will pass `tsc` but leave misleading documentation.
**Warning signs:** `tsc --noEmit` passing is NOT sufficient evidence the rename is complete — several of the affected references are comments or test assertion literals (e.g. `expect(packs).toHaveLength(PACKS_PER_MATCH)` in a test that will need a completely different assertion shape, not just a renamed constant).

### Pitfall 5: `resolveTieredCard`'s fallback is currently WRONG even under the OLD model for one case

**What goes wrong (pre-existing, surfaced by this research):** The current fallback (`role === 'GK' ? 'keeper' : 'common'`) always assigns `'common'` to any non-cached non-GK card, even if that card was actually `chase`/`rare`/`uncommon`. This is a pre-existing approximation (only used for the rare case where a card never appeared in the viewing client's own pack history, e.g. an opponent-side auto-pick under the old DRAFT-08 keeper mechanic).
**Why it's relevant now:** D-21 deletes the keeper-safety-net auto-pick entirely, which was the ONLY path that could place a card on a bench/lineup without it ever appearing in the resolving client's own `currentPack` history. Once the fixed-threshold `classifyTier(computeTotalStat(player))` replacement is in place (Pattern 1), this fallback becomes **exact**, not approximate — `PLAYER_MAP.get(cardId)` already gives full stats, so the fallback path can now always compute the correct tier deterministically, with no heuristic needed at all.
**How to avoid:** Implement the fallback as an exact recomputation, not a "better heuristic" — this closes a small pre-existing display bug as a side effect of the D-05 tier-value change.

### Pitfall 6: `'keeper'` appears in 6+ places beyond `types.ts`/`draftEngine.ts`

Grep confirms `'keeper'`/`cardTierKeeper`/`TIER_ORDER`/`TIER_CARD_CLASS` references in `DraftPackCarousel.tsx` (both the exported `TIER_ORDER` array and `TIER_CARD_CLASS` map), `LineupAssignmentScreen.module.css` (`.cardTierKeeper` CSS class, D-22 says "no 5th keeper color" — this class should be deleted, not just left unreferenced), and the fallback heuristic in `LineupAssignmentScreen.tsx` (Pitfall 5). A full-repo grep for `'keeper'` (case-sensitive, as a `DraftTier` literal — not the unrelated goalkeeper-role `'GK'` string) before considering D-05 complete is recommended.

### Pitfall 7: Keeper-safety-net removal (D-21) touches session shape, not just one function

**What goes wrong:** Deleting `checkKeeperSafety`/`autoSelectKeeperIfMissing` alone leaves `DraftSession.homeHasKeeper`/`awayHasKeeper`/`keeperAutoPickedThisCycle` fields orphaned in the type, `DraftClientView.keeperAutoPickedThisCycle` still in the wire shape, and `LineupAssignmentScreen.tsx`'s `showKeeperBanner` UI state/effect/JSX (lines ~235, ~258-264, ~567 per current file) still rendering a banner that can never fire.
**Why it happens:** The function removal is the "obvious" part of D-21; the field/UI removal is easy to miss because nothing will error at compile time if the fields are simply left unused-but-present (they're optional-shaped booleans, not something `tsc` flags as dead by default).
**How to avoid:** Treat D-21 as a full vertical removal: `DraftSession` type fields → `createDraftSession`'s initial shape → `applyPick`'s `hasKeeper` bookkeeping → `buildDraftView`'s projection → `DraftClientView` type → client state/effect/JSX. Confirm via grep for `HasKeeper`/`keeperAutoPicked` after the change (should be zero matches).

### Pitfall 8: Existing tests actively assert the BEHAVIOR THIS PHASE REMOVES

`GameSettingsScreen.test.tsx` (lines ~57-78) has tests titled `'Legends and Icons checkboxes are disabled and labelled "(coming soon)"'` and `'clicking a disabled Legends/Icons checkbox does not check it'` — these must be **inverted**, not deleted-and-forgotten, since a naive "make it pass" pass could satisfy them by accident if a planner doesn't realize they encode the OLD deferred-DRAFT-11 behavior. Similarly, `draftEngine.test.ts` has a test asserting `TIER_PERCENTILE_BOUNDS` equals `{ chase: 90, rare: 80, uncommon: 60 }` — this is a direct, named assertion of the D-03-superseded model, not incidental collateral.

## Code Examples

### Verified current formula (unchanged by this phase)

```typescript
// packages/shared/src/draftEngine.ts — computeTotalStat, UNCHANGED by D-03
export function computeTotalStat(player: PoolPlayer): number {
  return (
    player.pace +
    player.shooting +
    player.tackling +
    player.dribbling +
    player.saving +
    player.handling +
    player.resilience +
    player.aerialAbility +
    player.highPass
  );
}
```

### Verified GK-stat override (unchanged, but material to Pitfall 1)

```typescript
// packages/shared/scripts/seed-rosters.ts (existing, pre-Phase-30 code — lines 157-167)
if (role === 'GK') {
  highPass = 0; // D-04 (Phase 19): GKs use GK kick accuracy rule, not highPass
  if (pace === 0) pace = 1;
  if (shooting === 0) shooting = 1;
  if (tackling === 0) tackling = 1;
  if (dribbling === 0) dribbling = 1;
  if (resilience === 0) resilience = 1;
}
```

### Regenerating the player pool after finishing the CSV edit

```bash
# From repo root — must be run and its output (teams.ts) committed as part of D-01
pnpm --filter @counter-attack/shared run seed:rosters
```

## State of the Art

| Old Approach (Phase 28/29)                                                                                                                 | New Approach (Phase 30)                                                                                                 | When Changed           | Impact                                                                                                                                                                       |
| ------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------- | ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `TIER_PERCENTILE_BOUNDS` — session-relative percentile rank (chase=top 10%, rare=top 20%, uncommon=top 40%)                                | `TIER_STAT_THRESHOLDS` — fixed absolute totals (chase≥32, rare=31, uncommon=29-30)                                      | This phase (D-03)      | Tier no longer depends on the selected pool's population — a player's tier is now a pure function of their own stats, computable without `assignTiers` ranking a whole array |
| GKs excluded from outfield population, assigned reserved `'keeper'` tier unconditionally                                                   | GKs classified by the SAME thresholds as outfield (D-04); `'keeper'` removed from `DraftTier` entirely (D-05)           | This phase             | `DraftTier` narrows from 5 to 4 values; GK becomes purely a pack-dealing category (D-07), not a rarity                                                                       |
| `PACKS_PER_MATCH = 8`, single `PACK_COMPOSITION` (1 chase/1 rare/1 uncommon/3 common/1 keeper = 7 cards), applied uniformly to all 8 packs | `DRAFT_ROUNDS` (6-entry config table), 2 packs/round (12 total), composition varies by round, cards-per-pack = 4 always | This phase (D-12–D-19) | Total drafted per player: 16 → 17; pack size: 7 → 4 (always); GK dealt in a dedicated round instead of 1-per-pack                                                            |
| `DraftSubStep`: PICK1(1 card)→SWAP→PICK2(2 cards)→SWAP_BACK→PICK3(1 card)→NEW_PACK, fixed 4-cycle length                                   | Same 3-substep shape, but PICK2 becomes 1 card (not 2) always, and round 1 stops after PICK2 (no PICK3/no swap-back)    | This phase (D-20)      | State machine logic is actually SIMPLER per-substep (always 1 card/substep) but needs a round-aware "does this round have a PICK3" branch                                    |
| DRAFT-08: cycle-4 forced-keeper auto-pick safety net                                                                                       | Deleted entirely — round-1 GK-only round guarantees 2 GK cards structurally                                             | This phase (D-21)      | Removes `checkKeeperSafety`/`autoSelectKeeperIfMissing` and all `hasKeeper`/`keeperAutoPickedThisCycle` state                                                                |
| `FALLBACK_POOL_ORDER = ['original', 'mls', 'international']`                                                                               | `['mls', 'original']` (international removed as a fallback SOURCE; still directly selectable)                           | This phase (D-11)      | Order AND membership both change — not just a truncation of the old array                                                                                                    |
| Tier-color borders only in `DraftPackCarousel`/`BenchCarousel` (draft-stage only)                                                          | Extended to starting-11 lineup slots (`LineupStatCard`) as well (D-23)                                                  | This phase             | `LineupStatCard` currently renders plain `PoolPlayer` with no tier context at all — needs a tier-resolution path added, not just a CSS class swap                            |

**Deprecated/outdated:**

- `TIER_PERCENTILE_BOUNDS`, `PACKS_PER_MATCH`, `PACK_COMPOSITION`: all three constants should be deleted (not deprecated-in-place) once D-03/D-19 land — no dual-mode/legacy-support requirement exists per CONTEXT.md (this is a full replacement, not an additive feature).
- `checkKeeperSafety`, `autoSelectKeeperIfMissing` (draftSession.ts): delete outright per D-21.
- `.cardTierKeeper` CSS class: delete per D-22 ("no 5th keeper color").

## Assumptions Log

| #   | Claim                                                                                                                                                                                 | Section                                             | Risk if Wrong                                                                                                                                                                                                                                                                                                                                               |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A1  | The proposed `DRAFT_ROUNDS` config-table data shape (discriminated union of `'gk'`/`'tiered'` round kinds, with a `PackSlot[]` composition list) is the right internal representation | Architecture Patterns, Pattern 2                    | Low — this is an internal implementation detail with no external contract; a planner could choose a different equivalent shape without affecting correctness, as long as it captures the same per-round variability D-19 requires                                                                                                                           |
| A2  | `'chaseOrRare'` should be implemented as a merged/shuffled combined draw pool (unbiased mix) rather than "prefer chase, fall back to rare" or a coin-flip-per-card                    | Architecture Patterns, Pattern 2                    | Medium — CONTEXT.md's D-15 says "1 chase-or-rare" but does not specify the tie-break mechanism; a "prefer chase" implementation would systematically under-represent rare cards in that slot across many matches. Flagging as an explicit design choice for the planner/user to confirm rather than silently picking one.                                   |
| A3  | Pack-to-round-pair assignment should change from a global shuffle-and-split to a per-round coin-flip (Pattern 3)                                                                      | Architecture Patterns, Pattern 3                    | Medium-High if ignored — this is a genuine correctness bug risk (round/composition mismatch) if the planner reuses `assignPackOrders` verbatim without adapting it; the recommendation itself is sound reasoning from the existing code, not an external claim, but is still a researcher-proposed fix rather than something CONTEXT.md explicitly mandated |
| A4  | Position-bucket dealing (D-17) is feasible (won't need to relax the cap) given current pool sizes, based on the computed bucket×tier breakdown in Pitfall 2/Architecture Pattern 4    | Common Pitfalls #2, Architecture Patterns Pattern 4 | Low-Medium — computed from the ACTUAL current CSV data (verified), but a future further CSV edit could shift this; the planner should re-verify supply feasibility if the CSV changes again after this phase                                                                                                                                                |

**On Pitfall 1 (GK tier distribution) and the "teams.ts is stale" finding:** these are NOT assumptions — both are directly verified computations against the actual repository state in this session (CSV contents, `git status`, and the documented `computeTotalStat`/seed-script formulas), not training-data claims. They are called out in Common Pitfalls, not here, because they are findings, not assumptions.

## Open Questions

1. **Should "finishing the CSV edit" (D-01) include further GK stat rebalancing to correct the Pitfall 1 discrepancy?**
   - What we know: D-04's stated verification ("no GK falls below 29") does not match the actual current CSV data (11/16 GKs are below 29).
   - What's unclear: Whether this is because the CSV edit is genuinely incomplete (more GK-specific changes still to come) or because D-04's verification was computed differently (e.g., without the `highPass`-zeroing override) and the CSV is otherwise "finished" as-is.
   - Recommendation: Surface this to the user/planner explicitly before locking the plan — do not silently rebalance GK stats without confirmation, and do not silently accept the discrepancy without documenting the decision. Functionally, either path is safe (D-07 confirms GK tier is cosmetic, not gameplay-affecting).

2. **What is the exact tie-break/mix mechanism for the "chase-or-rare" pack slot (D-15)?**
   - What we know: Each of the 4 packs in rounds 5-6 needs exactly 1 card that is either chase-tier or rare-tier.
   - What's unclear: Whether this should be an even random mix (recommended, see Assumption A2), a chase-preferred-when-available rule, or something else.
   - Recommendation: Implement as an unbiased merged-pool draw (Pattern 2) unless the user specifies otherwise during plan review.

3. **Does the position-bucket cap (D-17) apply only to the CURRENT pack, or does it also need to avoid double-dealing the SAME player across a player's two packs in the same round?**
   - What we know: D-17's wording ("max 2 players per position bucket per pack") is unambiguous about being per-pack.
   - What's unclear: Whether a single card could theoretically appear in both of a round's 2 packs (home's and away's) — the existing D-09 "no cross-pack duplication" convention (from `generateDraftPacks`'s doc comment) should still hold and prevents this, but should be explicitly re-asserted for the new per-round dealing loop.
   - Recommendation: Preserve the D-09 no-cross-pack-duplication invariant explicitly in the new dealing loop's tests (one test per round, not just one match-wide test).

## Environment Availability

Not applicable — this phase has no new external tool/service/runtime dependencies. All required tooling (Node 22, pnpm, vitest, tsx for the seed script) is already installed and in active use by the existing project.

## Validation Architecture

### Test Framework

| Property           | Value                                                                                                                                                          |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Framework          | vitest (existing, per-package `vitest.config.ts` in `client`/`server`/`shared`)                                                                                |
| Config file        | `packages/{client,server,shared}/vitest.config.ts`                                                                                                             |
| Quick run command  | `pnpm --filter @counter-attack/shared test` / `pnpm --filter @counter-attack/server test` / `pnpm --filter @counter-attack/client test` (package-scoped, fast) |
| Full suite command | `pnpm test` (root — runs `pnpm -r test` across all 3 packages)                                                                                                 |

### Phase Requirements → Test Map

| Req ID              | Behavior                                                                                                                                                           | Test Type                          | Automated Command                                                                                                                                                                                       | File Exists?                                                                                                         |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| DRAFT-04            | `classifyTier`/`assignTiers` fixed-threshold classification (chase/rare/uncommon/common, GK included)                                                              | unit                               | `pnpm --filter @counter-attack/shared test draftEngine`                                                                                                                                                 | ✅ (rewrite existing describe blocks)                                                                                |
| DRAFT-05            | Round-scoped pack generation: correct composition per round, GK-only round 1, position-bucket cap enforced, no cross-pack duplication                              | unit + integration                 | `pnpm --filter @counter-attack/shared test draftEngine` (unit), `pnpm --filter @counter-attack/server test draftPacks draftSession` (integration)                                                       | ✅ (rewrite existing files)                                                                                          |
| DRAFT-08 (deletion) | Confirm no keeper-safety-net code path remains reachable; `DraftSession`/`DraftClientView` no longer carry keeper-related fields                                   | unit + grep-based structural check | `pnpm --filter @counter-attack/server test draftSession`; manual grep for `HasKeeper`/`keeperAutoPicked`                                                                                                | ✅ (existing tests reference this — must be removed, not just left passing)                                          |
| DRAFT-11            | Legends/Icons selectable end-to-end: client checkbox enabled, server allow-list accepts, `isInPool` bridges PoolTag correctly, pool sizes/backfill behave per D-10 | unit + component + integration     | `pnpm --filter @counter-attack/client test GameSettingsScreen`; `pnpm --filter @counter-attack/shared test draftEngine`; `pnpm --filter @counter-attack/server test` (ROOM_SETTINGS_CONFIRM allow-list) | ✅ (existing tests currently assert the OPPOSITE — see Pitfall 8, must invert)                                       |
| D-22/D-23           | Tier-color borders render correctly on draft carousel, bench, AND starting-11 lineup slots; correct 4-color mapping                                                | component                          | `pnpm --filter @counter-attack/client test LineupAssignmentScreen DraftPackCarousel BenchCarousel`                                                                                                      | ✅ (LineupAssignmentScreen.test.tsx exists but has no lineup-slot tier-color assertions yet — new test cases needed) |

### Sampling Rate

- **Per task commit:** package-scoped `pnpm --filter <pkg> test` for whichever package the task touched.
- **Per wave merge:** `pnpm test` (full 3-package suite) plus `pnpm typecheck` (this phase changes shared types referenced across all 3 packages — a type error in one package after a `shared` change is a very likely regression class).
- **Phase gate:** Full suite green before `/gsd-verify-work`, PLUS a manual grep pass for `'keeper'`/`PACKS_PER_MATCH`/`TIER_PERCENTILE_BOUNDS`/`FALLBACK_POOL_ORDER` old-value literals (tests passing does not guarantee these were fully purged, per Pitfall 4/6).

### Wave 0 Gaps

- No new test framework/config needed — vitest is already fully configured in all 3 packages.
- Existing test files that need REWRITES (not new files, but substantial rewrites given the scale of the model change): `packages/shared/src/draftEngine.test.ts` (330 lines), `packages/server/src/draftSession.test.ts` (674 lines), `packages/server/src/__tests__/draftSession.integration.test.ts` (1028 lines), `packages/server/src/__tests__/draftReconnect.integration.test.ts` (349 lines), `packages/server/src/__tests__/draftPacks.test.ts` (100 lines), `packages/client/src/components/GameSettingsScreen.test.tsx` (178 lines, inverted assertions per Pitfall 8), `packages/client/src/components/DraftPackCarousel.test.tsx` (149 lines), `packages/client/src/components/BenchCarousel.test.tsx` (234 lines), `packages/client/src/components/LineupAssignmentScreen.test.tsx` (369 lines, needs NEW tier-color-on-lineup-slot cases). Total existing test surface directly touched by this phase: ~3,411 lines across 9 files — this is a significant rewrite scope the planner should budget waves for, not a small tweak.

## Security Domain

### Applicable ASVS Categories

| ASVS Category         | Applies | Standard Control                                                                                                                                                                                                                                                                          |
| --------------------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| V2 Authentication     | No      | Unchanged — draft actions already gate on `socket.data.playerSlot`, not client-supplied identity                                                                                                                                                                                          |
| V3 Session Management | No      | Unchanged — room/session lifecycle untouched by this phase                                                                                                                                                                                                                                |
| V4 Access Control     | Yes     | `SELECTABLE_DRAFT_POOLS` server-side allow-list in `ROOM_SETTINGS_CONFIRM` — must be updated to include `'legends'`/`'icons'` (D-08) on the SERVER side, not just the client checkbox; this is the exact same pattern already in place for `original`/`mls`/`international`, just widened |
| V5 Input Validation   | Yes     | Draft pool selection is already allow-list validated server-side (`SELECTABLE_DRAFT_POOLS.includes(pool)` + duplicate-rejection, per the existing IN-03 fix) — this pattern is unchanged, only the allow-list's membership grows from 3 to 5 values                                       |
| V6 Cryptography       | Yes     | `crypto.randomInt` remains the sole RNG for pack generation and bench-number assignment — unchanged, no new crypto surface introduced                                                                                                                                                     |

### Known Threat Patterns for this stack

| Pattern                                                                                                                                          | STRIDE    | Standard Mitigation                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| ------------------------------------------------------------------------------------------------------------------------------------------------ | --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Client sends a `draftPools` array containing `'legends'`/`'icons'` before this phase ships (or a forged payload bypassing the disabled checkbox) | Tampering | Already mitigated by the existing server-side `SELECTABLE_DRAFT_POOLS` allow-list check in `ROOM_SETTINGS_CONFIRM` — this phase's D-08 change is exactly widening that allow-list in a controlled, single-source-of-truth way; verify no other path (e.g. a stale client build) can smuggle a 6th/invalid pool id past the allow-list                                                                                                                                   |
| A malicious/modified client attempts to force a specific card into a specific pack (predict/influence pack contents)                             | Tampering | Unchanged — pack generation remains 100% server-side with `crypto.randomInt`; the shared engine stays RNG-agnostic and the server never accepts client-supplied randomness or pack contents                                                                                                                                                                                                                                                                             |
| A player attempts to place a GK card outside round-1 packs (since round 1 is now the ONLY source of GK cards)                                    | Tampering | The existing `DRAFT_PICK` handler's GK-slot-role validation (`card.role === 'GK'` vs `FormationSlot.slotRole`) is unaffected by this phase and continues to apply; additionally, since non-GK packs (rounds 2-6) now structurally EXCLUDE GK cards from being dealt at all (D-17), there is no server-side path that could ever place a GK card id into a round-2-6 pack in the first place — the constraint is enforced at generation time, not just at placement time |

## Sources

### Primary (HIGH confidence — direct codebase inspection and computed data analysis)

- `packages/shared/src/types.ts` — `DraftPoolId`, `SELECTABLE_DRAFT_POOLS`, `DraftTier`, `TIER_PERCENTILE_BOUNDS`, `PACKS_PER_MATCH`, `PACK_COMPOSITION`, `DraftSubStep`, `DraftSession`, `DraftClientView` (full type definitions read directly)
- `packages/shared/src/draftEngine.ts` — `computeTotalStat`, `isInPool`, `resolvePoolPlayers`, `assignTiers`, `generateDraftPacks`, `FALLBACK_POOL_ORDER` (full implementation read directly)
- `packages/shared/scripts/seed-rosters.ts` — CSV→teams.ts codegen pipeline, GK stat override rules (full implementation read directly)
- `packages/shared/src/data/player-pool.csv` (current working-tree state) — read directly, tier/pool/bucket distributions computed via a local Node script applying the exact documented formula
- `packages/shared/src/teams.ts` — spot-checked against the CSV to confirm staleness (grep for `Crepeau`, `Mățan`)
- `packages/server/src/draftSession.ts`, `draftPacks.ts`, `roomHandlers.ts` (ROOM_SETTINGS_CONFIRM, DRAFT_PICK, DRAFT_REARRANGE handlers, LINEUP_CONFIRM draft-completeness check) — full implementations read directly
- `packages/client/src/components/DraftPackCarousel.tsx`, `BenchCarousel.tsx`, `LineupAssignmentScreen.tsx`, `LineupAssignmentScreen.module.css`, `GameSettingsScreen.tsx` — full implementations read directly
- `packages/shared/src/draftEngine.test.ts`, `packages/server/src/draftSession.test.ts`, `packages/client/src/components/GameSettingsScreen.test.tsx` — existing test assertions read directly to identify which must invert/rewrite
- `git diff` on `player-pool.csv` and `LineupAssignmentScreen.module.css` (uncommitted working-tree changes) — read directly to establish exactly what D-01/D-22's "in-progress" edits currently contain

### Secondary (MEDIUM confidence)

- None — no web/external documentation was consulted for this phase, since it introduces no new external technology. All findings are first-party codebase/data analysis.

### Tertiary (LOW confidence)

- None.

## Metadata

**Confidence breakdown:**

- Standard stack: N/A — no new stack decisions this phase
- Architecture (round/pack data model, state machine extension): MEDIUM-HIGH — the overall shape (config table, per-round coin-flip, slot-based dealing) is a sound engineering derivation from the existing code and the literal CONTEXT.md spec, but the exact data shape is explicitly left to planner discretion (D-19/D-20) and tagged as researcher proposals (Assumptions A1-A3), not verified-correct implementations
- Pitfalls: HIGH — every pitfall in this document is either a direct grep/read finding or a locally-computed data analysis using the project's own documented formulas, not an inferred/assumed claim
- Data distribution findings (GK tier discrepancy, pool feasibility): HIGH — computed directly from the actual current repository state using the exact documented `computeTotalStat`/seed-script formulas, cross-checked against multiple individual player rows by hand

**Research date:** 2026-07-21
**Valid until:** Until the next `player-pool.csv` edit or `teams.ts` regeneration (the computed tier-distribution numbers in this document are a point-in-time snapshot of the CURRENT working-tree CSV state — re-verify Pitfall 1/2's numbers if the CSV changes again before this phase is planned/executed).
