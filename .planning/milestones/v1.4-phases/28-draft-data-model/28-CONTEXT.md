# Phase 28: Draft Data Model - Context

**Gathered:** 2026-07-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Build the data-model layer for Draft mode: classify the player pool into five rarity tiers by total stat count (DRAFT-04), and generate the full set of 7-card packs a match needs from the selected pool(s) with a correct, configurable per-rarity composition (DRAFT-05). This is a pure data/generation engine — no UI, no pick-and-swap flow, no session/turn orchestration. Phase 29 (Draft UI + Pick-and-Swap Flow) consumes what this phase produces.

</domain>

<decisions>
## Implementation Decisions

### "Original" Pool Definition

- **D-01:** The free-agent bucket (56 players, `sourceTeamId: 'free-agent'`) contains 10 name-suffix-tagged superstars — 5 marked `(L)` (Maradona, Pelé, Ronaldinho, Zidane, Maldini) and 5 marked `(M)` (Ronaldo, Haaland, Neymar Jr, De Bruyne, van Dijk). These are excluded from the `'original'` draft pool for now — they're reserved for the future Legends/Icons pools (DRAFT-11, deferred).
- **D-02:** Add an explicit `poolTag?: 'legend' | 'icon'` field to `PoolPlayer` (in `packages/shared/src/teams.ts`) rather than regex-matching the name suffix at runtime. Thread it through the CSV (`packages/shared/src/data/player-pool.csv` gets a new `PoolTag` column) and the seed script (`packages/shared/scripts/seed-rosters.ts`). `undefined` = ordinary free agent, included in `'original'`.
- **D-03:** Strip the `(L)`/`(M)` suffix from `lastName` for those 10 players now that `poolTag` carries that meaning (e.g. `"Maradona (L)"` → `"Maradona"`, `poolTag: 'legend'`).
- **D-04 (derived):** `'mls'` and `'international'` pools map directly via the existing `TEAM_CONFIGS[sourceTeamId].league` field (`packages/shared/src/teamConfig.ts`) — no new mapping needed for those two. `'original'` = `PLAYER_POOL.filter(p => p.sourceTeamId === 'free-agent' && !p.poolTag)`.

### Tier Percentile Scope

- **D-05:** Tier percentiles (Chase 90–100%, Rare 80–89%, Uncommon 60–79%, Common below 60%) are recomputed dynamically per draft session, based on the percentile rank of total stat within the union of whichever pool(s) are checked for that match (plus any backfill players — see D-10). Not a static/precomputed property of the full 188-player pool.
- **D-06:** Ties at a percentile boundary use rank-based percentile: sort candidates by total stat descending, percentile = rank position / count, ties broken by stable sort order (input/id order) — not value-based percentile (where exactly-tied stat values would force identical tiers).
- **D-07:** "Total stat count" = sum of all 9 `PoolPlayer` numeric fields (`pace + shooting + tackling + dribbling + saving + handling + resilience + aerialAbility + highPass`). Outfield players' `saving`/`handling` are always 0 so they don't skew the outfield ranking — one uniform formula, no role-conditional branches.

### Keeper Tier & GK Exclusion

- **D-08:** `'Keeper'` tier is simply `role === 'GK'` — its own bucket, no stat-based subdivision. GKs are filtered out of the population entirely before computing Chase/Rare/Uncommon/Common percentiles among outfield players (so GK stat profiles, which are saving/handling-heavy, never skew outfield tiering).

### Pack Generation

- **D-09:** Packs are batch-generated all at once for the whole match (not generated lazily per pick-cycle) — the engine's output is the complete set of packs, and no player appears in more than one pack across that whole batch (aside from the D-10 backfill exception for scarce keepers).
- **D-10 (`PACKS_PER_MATCH`):** Export a configurable constant, default `8` — matching DRAFT-05's "all tier-boundary percentages and pack composition counts are configurable constants" requirement.
- **D-11 (composition, confirmed unchanged):** Composition stays as REQUIREMENTS.md DRAFT-05 states — **1 chase, 1 rare, 1 uncommon, 3 common, 1 keeper** per 7-card pack. (A mid-discussion slip suggested 2 uncommon/2 common; user confirmed the original 1/3 split is correct — no REQUIREMENTS.md change needed.)
- **D-12 (pool-shortage backfill):** Running the numbers: 8 packs × 1 keeper = 8 keepers needed, but every single-pool selection only has 4–6 GKs (Original 4, MLS 6, International 6) — always short. Original-alone is also short on outfield players (42 eligible vs. 48 needed for 8×(1+1+1+3)). Resolution: when the checked pool(s) fall short in **any** tier (keeper or outfield), the engine backfills by randomly adding players from non-selected pools in fallback order **Original → MLS → International**, skipping whichever pool(s) the player already checked, until the shortfall is filled. This applies uniformly to both keeper and outfield shortages.
- **D-13:** Tier→display (card-back colors gold/silver/bronze/blue/green, tier name replacing the team icon on cards) is explicitly deferred to Phase 29 (Draft UI). Phase 28 only produces the tier value itself (e.g. `'chase' | 'rare' | 'uncommon' | 'common' | 'keeper'`) — no color/label constants in this phase's output.

### Claude's Discretion

- Exact module/file layout for the new tier-classification and pack-generation functions (e.g. new `draftEngine.ts` vs. extending `teams.ts`) — follow existing `packages/shared/src` conventions (pure functions, no side effects, importable by both client and server).
- Exact shuffle/randomization mechanism for the backfill sampling and per-pack composition dealing (e.g. Fisher-Yates) — no dice/crypto requirement was specified for pool shuffling (unlike in-game dice rolls, which per project convention always use `crypto.randomInt` server-side and never on the client — but pack generation happens server-side at settings-confirm time, so this convention still applies for consistency).

</decisions>

<canonical_refs>

## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements

- `.planning/REQUIREMENTS.md` §Draft Mode (DRAFT) — DRAFT-04, DRAFT-05 definitions (lines 34-35); DRAFT-11 (Legends/Icons, deferred, line 50)

### Roadmap

- `.planning/ROADMAP.md` §Phase 28 — Goal statement and success criteria (Draft Data Model)

### Data Model (existing, to extend)

- `packages/shared/src/teams.ts` — `PoolPlayer` interface and `PLAYER_POOL` export (188 players); add `poolTag` field here
- `packages/shared/src/data/player-pool.csv` — source-of-truth CSV; add `PoolTag` column, strip `(L)`/`(M)` suffixes from the 10 tagged rows
- `packages/shared/scripts/seed-rosters.ts` — seed script that generates `teams.ts` from the CSV; thread `poolTag` through here
- `packages/shared/src/teamConfig.ts` — `TEAM_CONFIGS[...].league: 'mls' | 'international'` (lines 72-81, 299-398) — reuse directly for `'mls'`/`'international'` pool mapping, no new logic needed
- `packages/shared/src/types.ts` — `TeamType`, `DraftPoolId`, `SELECTABLE_DRAFT_POOLS` (lines 445-467, from Phase 27); new tier/composition/pack-count types and constants belong alongside these

### Prior Phase Context

- `.planning/phases/27-game-creation-settings/27-CONTEXT.md` — Phase 27 established the settings pre-step; draft pool selection (`draftPools: DraftPoolId[]`) is already captured server-side and broadcast to both players at room-join per D-01/D-02 there — Phase 28's tier/pack engine consumes that existing `draftPools` field as its input

</canonical_refs>

<code_context>

## Existing Code Insights

### Reusable Assets

- `packages/shared/src/teams.ts` `PoolPlayer` / `PLAYER_POOL` — flat array of 188 players with `sourceTeamId`, `role`, and all 9 stat fields already in place. Tier classification and pool filtering both operate directly on this array.
- `packages/shared/src/teamConfig.ts` `TEAM_CONFIGS[...].league` — already-established `'mls' | 'international'` grouping per team slug (from LEAGUE-01..03, Phase 21). Reused as-is for pool mapping — no new team→pool table needed for those two pools.
- `packages/shared/src/types.ts` `DraftPoolId`, `SELECTABLE_DRAFT_POOLS`, `TeamType` (Phase 27) — the pool-selection vocabulary this phase's engine consumes as input.
- `packages/shared/scripts/seed-rosters.ts` — existing CSV→TypeScript codegen pipeline (D-01/D-02 pattern from `teams.ts` header comments); the `poolTag` field addition follows this same regenerate-don't-hand-edit convention.

### Established Patterns

- All player data is data-driven from CSV via a seed script, never hand-edited in `teams.ts` directly (per the `AUTO-GENERATED` header comment in `teams.ts`).
- Shared package code (`packages/shared/src`) is pure TypeScript with no side effects, importable identically by client and server — the tier/pack-generation engine should follow this same shape so both sides can use it (server generates authoritatively; client may need the same logic for display/preview).
- Dice/randomness convention: server-authoritative `crypto.randomInt`, never client-side `Math.random()` for anything gameplay-affecting (from PROJECT.md Key Pitfalls). Pack generation happens at settings-confirm time server-side, so this convention applies to the shuffle/backfill sampling too.

### Integration Points

- Pack generation is triggered once per match, presumably at the point Phase 27's `ROOM_SETTINGS_CONFIRM` flow locks in `teamType: 'draft'` + `draftPools` — exact trigger point/timing is a Phase 29 orchestration concern, not this phase's.
- Output shape (tiered player list + generated pack array) needs to be typed in `packages/shared/src/types.ts` or a new shared module so Phase 29's client-side draft UI and server-side draft handlers both consume identical types.

</code_context>

<specifics>
## Specific Ideas

- Card-back colors mentioned for future reference (Phase 29 to actually use): Chase = gold, Rare = silver, Uncommon = bronze, Common = blue, Keeper = green. Also: the pool/tier name should appear in place of the team icon on drafted cards (since drafted players don't have a single "team" once pooled). Captured here as a forward-pointer even though D-13 defers the actual constants to Phase 29.

</specifics>

<deferred>
## Deferred Ideas

- Tier→color/label display constants and card-back rendering (D-13) — Phase 29 (Draft UI), not this phase.
- Exact pick-and-swap cycle timing, session state, and how many packs get consumed per cycle — Phase 29.

### Reviewed Todos (not folded)

- `csv-consolidation-player-pool.md` (tagged `resolves_phase: 29`) — **Already resolved.** Git history shows the CSV consolidation this todo requested happened back in Phase 21 (`e715f3c fix(phase-21): fix 3 new-team kickoff bugs and consolidate player CSV`, `dd85d00 chore(data): rebuild player pool — 188 players, 12 teams`). `packages/shared/src/data/player-pool.csv` is already the single unified file described in the todo. Recommend closing/deleting this stale todo rather than carrying it into Phase 29.

</deferred>

---

_Phase: 28-Draft-Data-Model_
_Context gathered: 2026-07-21_
