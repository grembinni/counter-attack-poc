# Phase 30: recalibrate-draft - Pattern Map

**Mapped:** 2026-07-21
**Files analyzed:** 14 (modify-in-place — no new files this phase)
**Analogs found:** 14 / 14 (every file's analog is its own current pre-phase state)

## Note on Analog Model

This phase does not create new files — it rewrites existing ones in place (per RESEARCH.md's
"Recommended Project Structure": "No new files/folders"). Therefore "closest existing analog"
for every file below is **the file itself, as it exists today**, plus (where relevant) a sibling
file already displaying the target pattern (e.g. `computeTotalStat`'s pure-function shape is the
analog for the new `classifyTier`). All code excerpts are extracted directly from the current
repo state so the planner can diff against them precisely.

## File Classification

| Modified File                                                                             | Role                                    | Data Flow                                      | Closest Analog                                                                                                                 | Match Quality |
| ----------------------------------------------------------------------------------------- | --------------------------------------- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | ------------- |
| `packages/shared/src/types.ts`                                                            | config/types                            | transform                                      | itself (current `DraftTier`/`TIER_PERCENTILE_BOUNDS`/`PACKS_PER_MATCH`/`PACK_COMPOSITION`/`DraftSubStep` block, lines 452-535) | exact         |
| `packages/shared/src/draftEngine.ts`                                                      | service (pure engine)                   | transform/CRUD (pool derivation, pack dealing) | itself (`computeTotalStat`/`isInPool`/`assignTiers`/`generateDraftPacks`, full file)                                           | exact         |
| `packages/shared/src/draftEngine.test.ts`                                                 | test                                    | transform                                      | itself (existing describe blocks for `assignTiers`/`generateDraftPacks`)                                                       | exact         |
| `packages/server/src/draftPacks.ts`                                                       | service (RNG-binding adapter)           | transform                                      | itself (12-line `generateMatchPacks` wrapper)                                                                                  | exact         |
| `packages/server/src/draftSession.ts`                                                     | service (pure state machine)            | event-driven                                   | itself (`createDraftSession`/`applyPick`/`advanceSubStep`/`checkKeeperSafety`, full file)                                      | exact         |
| `packages/server/src/draftSession.test.ts`                                                | test                                    | event-driven                                   | itself                                                                                                                         | exact         |
| `packages/server/src/roomHandlers.ts`                                                     | controller (socket handler)             | event-driven/request-response                  | itself (`ROOM_SETTINGS_CONFIRM` handler — likely no-code-change, reads `SELECTABLE_DRAFT_POOLS` dynamically)                   | exact         |
| `packages/server/src/__tests__/draftPacks.test.ts`                                        | test                                    | transform                                      | itself                                                                                                                         | exact         |
| `packages/server/src/__tests__/draftSession.integration.test.ts`                          | test                                    | event-driven                                   | itself                                                                                                                         | exact         |
| `packages/server/src/__tests__/draftReconnect.integration.test.ts`                        | test                                    | event-driven                                   | itself                                                                                                                         | exact         |
| `packages/server/src/__tests__/lineupAssignment.integration.test.ts`                      | test                                    | event-driven                                   | itself                                                                                                                         | exact         |
| `packages/client/src/components/GameSettingsScreen.tsx` (+`.test.tsx`)                    | component                               | request-response (local state + confirm)       | itself — already data-driven off `SELECTABLE_DRAFT_POOLS`, likely zero code change                                             | exact         |
| `packages/client/src/components/DraftPackCarousel.tsx` (+`.test.tsx`)                     | component                               | streaming/display (drag source)                | itself (`TIER_ORDER`/`TIER_CARD_CLASS`/`DraftCardBody`)                                                                        | exact         |
| `packages/client/src/components/BenchCarousel.tsx` (+`.test.tsx`)                         | component                               | drag-drop/display                              | `DraftPackCarousel.tsx` (shares `DraftCardBody`/`TIER_CARD_CLASS` import)                                                      | exact         |
| `packages/client/src/components/LineupAssignmentScreen.tsx` (+`.module.css`, `.test.tsx`) | component (screen + state machine glue) | drag-drop/event-driven                         | itself (`resolveTieredCard`, `LineupStatCard`, `renderDraftColumn`, keeper-banner block)                                       | exact         |

## Pattern Assignments

### `packages/shared/src/types.ts` (config/types)

**Analog:** itself, lines 452-535 (current)

**Current constants being replaced/removed** (lines 461-508):

```typescript
export type DraftPoolId = 'original' | 'mls' | 'international' | 'legends' | 'icons';

export const SELECTABLE_DRAFT_POOLS: readonly DraftPoolId[] = [
  'original',
  'mls',
  'international',
] as const;

export type DraftTier = 'chase' | 'rare' | 'uncommon' | 'common' | 'keeper';

export const TIER_PERCENTILE_BOUNDS: Readonly<Record<'chase' | 'rare' | 'uncommon', number>> = {
  chase: 90,
  rare: 80,
  uncommon: 60,
};

export const PACKS_PER_MATCH = 8;

export const PACK_COMPOSITION: Readonly<Record<DraftTier, number>> = {
  chase: 1,
  rare: 1,
  uncommon: 1,
  common: 3,
  keeper: 1,
};

export type DraftSubStep = 'PICK1' | 'PICK2' | 'PICK3';
```

**Pattern to follow when replacing:**

- Keep the doc-comment convention (`/** DRAFT-XX (Phase N): ... */`) directly above each
  exported const/type — every existing const in this file follows this format; new constants
  (`TIER_STAT_THRESHOLDS`, `DRAFT_ROUNDS`, `DRAFT_ROUND_COUNT`, `PACKS_PER_ROUND`) must match it,
  citing D-03/D-08/D-12–D-19 per RESEARCH.md Pattern 2's proposed shape.
- `SELECTABLE_DRAFT_POOLS` widening to 5 pools is a **one-line value change** — keep the exact
  same `readonly DraftPoolId[]` shape and `as const`, just add `'legends'`/`'icons'` (D-08).
- `DraftTier` narrows from 5 → 4 values (`'chase' | 'rare' | 'uncommon' | 'common'`) — this is a
  breaking type change; grep for every `'keeper'` literal reference before considering it done
  (Pitfall 6).
- `DraftSession`/`DraftClientView` fields to delete outright (grep first, full vertical removal
  per Pitfall 7): `homeHasKeeper`, `awayHasKeeper`, `keeperAutoPickedThisCycle` (both the session
  field and the `DraftClientView` field). Do NOT leave them defined-but-unused.

---

### `packages/shared/src/draftEngine.ts` (pure engine — service, transform/CRUD)

**Analog:** itself, full file (399 lines)

**Imports pattern** (lines 21-31) — unchanged convention, only the imported constant names change:

```typescript
import type { PoolPlayer } from './teams.js';
import { PLAYER_POOL } from './teams.js';
import { TEAM_CONFIGS } from './teamConfig.js';
import type { TeamId } from './teamConfig.js';
import type { DraftPoolId, DraftTier } from './types.js';
import {
  PACKS_PER_MATCH,
  PACK_COMPOSITION,
  TIER_PERCENTILE_BOUNDS,
  SELECTABLE_DRAFT_POOLS,
} from './types.js';
```

New imports should replace `PACKS_PER_MATCH`/`PACK_COMPOSITION`/`TIER_PERCENTILE_BOUNDS` with
`DRAFT_ROUNDS`/`TIER_STAT_THRESHOLDS` (etc.) but keep `SELECTABLE_DRAFT_POOLS` as-is.

**Pure-function pattern to mirror for `classifyTier`** (lines 47-59, `computeTotalStat` — the
model for a pure, RNG-free, side-effect-free classifier):

```typescript
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

`classifyTier(totalStat: number): DraftTier` (per RESEARCH.md Pattern 1) should live directly
below this function, same file, same "one clear pure function, doc-commented with the D-numbers
it satisfies" style. `assignTiers` should be simplified to call `classifyTier` per-player with NO
population/ranking logic (delete the `outfield`/stable-sort/percentile-rank machinery at lines
108-146 entirely — do not keep it dormant).

**`isInPool` bridge pattern** (lines 71-81, current — to be extended per D-09):

```typescript
export function isInPool(player: PoolPlayer, poolId: DraftPoolId): boolean {
  if (poolId === 'original') {
    return player.sourceTeamId === 'free-agent' && !player.poolTag;
  }
  if (poolId === 'mls' || poolId === 'international') {
    const config = TEAM_CONFIGS[player.sourceTeamId as TeamId];
    return config?.league === poolId;
  }
  // 'legends' / 'icons' — deferred (DRAFT-11), never selectable in v1.
  return false;
}
```

Replace the final `return false;` branch with the `POOL_TAG_TO_DRAFT_POOL` bridge from
RESEARCH.md Pattern 5 (`legend`→`'legends'`, `icon`→`'icons'`), preserving the same
if/else-chain structure and the optional-chaining safety convention already used for
`TEAM_CONFIGS[...]?.league`.

**Shuffle helper — reuse verbatim, do not reimplement** (lines 173-182):

```typescript
function shuffle<T>(items: readonly T[], rng: RandomIntFn): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = rng(0, i + 1);
    const tmp = result[i]!;
    result[i] = result[j]!;
    result[j] = tmp;
  }
  return result;
}
```

**`FALLBACK_POOL_ORDER` reorder** (line 189, current):

```typescript
const FALLBACK_POOL_ORDER: readonly DraftPoolId[] = ['original', 'mls', 'international'];
```

Change to `['mls', 'original']` per D-11 (International removed as a fallback source entirely,
not just deprioritized).

**Error/validation pattern to preserve** (lines 234-241, CR-01 fail-closed guard — reuse this
exact shape in the rewritten `generateDraftPacks`):

```typescript
if (selectedPools.length === 0 || !selectedPools.every((p) => SELECTABLE_DRAFT_POOLS.includes(p))) {
  throw new Error(
    `generateDraftPacks: selectedPools must be a non-empty subset of SELECTABLE_DRAFT_POOLS, got ${JSON.stringify(selectedPools)}`,
  );
}
```

Same pattern for the post-backfill "insufficient supply" assertions (lines 325-348) — keep
throwing loudly rather than silently producing short/duplicate packs; re-scope per-round instead
of match-wide (per RESEARCH.md Anti-Patterns section).

**Backfill loop shape to reuse/adapt** (lines 257-312) — the "reclassify union each iteration,
draw one card of the needed kind from the first fallback pool that can supply it" loop structure
is directly reusable; only the tier set (`OUTFIELD_TIERS`/`keeperShort` machinery) needs
re-scoping from "keeper vs. 4 outfield tiers, match-wide" to "per-round-pack-pair, GK-round vs.
tiered-round" per RESEARCH.md Pattern 4.

**Dealing loop shape to reuse/adapt** (lines 350-397) — cursor-based per-tier dealing
(`byTier`/`cursors`/`tierDealOrder`) is the right skeleton; must be re-scoped to run once per
round-pack-pair (not once globally across 8 packs) and to add the position-bucket cap tracking
(`Record<'DEF'|'MID'|'FWD_ST', number>` per pack) described in RESEARCH.md Pattern 4.

---

### `packages/shared/src/draftEngine.test.ts` (test)

**Analog:** itself (330 lines) — existing `describe('assignTiers', ...)` / `describe('generateDraftPacks', ...)` blocks are the structural template for new test blocks (`describe('classifyTier', ...)`, round-scoped pack tests). Must **invert/rewrite**, not just add to, the direct `TIER_PERCENTILE_BOUNDS` assertion (Pitfall 8) — grep for `TIER_PERCENTILE_BOUNDS`, `PACKS_PER_MATCH`, `PACK_COMPOSITION`, `'keeper'` literal assertions before considering the rewrite complete.

---

### `packages/server/src/draftPacks.ts` (RNG-binding adapter — service)

**Analog:** itself, full file (27 lines) — signature is unlikely to change at all:

```typescript
import { randomInt } from 'crypto';
import { generateDraftPacks } from '@counter-attack/shared';
import type { DraftPoolId, DraftPack, TieredPoolPlayer } from '@counter-attack/shared';

export function generateMatchPacks(selectedPools: DraftPoolId[]): {
  pool: TieredPoolPlayer[];
  packs: DraftPack[];
} {
  return generateDraftPacks(selectedPools, randomInt);
}
```

No structural change expected here — `crypto.randomInt` binding stays exactly as-is (fairness
boundary, T-28-04-FAIR). Only the shared `generateDraftPacks` return-shape (e.g. if `DraftPack`
gains a `round` field) needs to flow through unchanged, since this is a thin pass-through.

---

### `packages/server/src/draftSession.ts` (pure state machine — service, event-driven)

**Analog:** itself, full file (479 lines)

**Module-level convention to preserve** (doc comment, lines 1-27) — this module's "zero io/socket
imports, mirrors gameEngine.ts's separation from roomHandlers.ts" convention and its own local
`shuffle` reimplementation (lines 53-62, intentionally duplicated per an explicit "do NOT import
the private one" instruction — do not "fix" this duplication) must both be preserved verbatim.

**Pack-order assignment — must NOT be reused verbatim; adapt to per-round coin-flip** (current,
lines 69-80, the exact function RESEARCH.md Pattern 3 flags as broken under per-round
composition):

```typescript
export function assignPackOrders(
  packCount: number,
  rng: RandomIntFn,
): { homePackOrder: number[]; awayPackOrder: number[] } {
  const indices = Array.from({ length: packCount }, (_, i) => i);
  const shuffled = shuffle(indices, rng);
  const half = packCount / 2;
  return {
    homePackOrder: shuffled.slice(0, half),
    awayPackOrder: shuffled.slice(half),
  };
}
```

Replace with the per-round coin-flip proposed in RESEARCH.md (`assignRoundPackOrder`):

```typescript
function assignRoundPackOrder(rng: RandomIntFn): ['home' | 'away', 'home' | 'away'] {
  return rng(0, 2) === 0 ? ['home', 'away'] : ['away', 'home'];
}
```

**Session-shape functions to rewrite (round-aware) but keep the `getSide`/`withSide` per-side
projection convention** (lines 115-176) — this "internal `SideFields` type + `getSide`/`withSide`
never-mutate-in-place" pattern is exactly right for adding round-tracking fields (e.g. `round`,
`roundPicksRemaining`) and should be extended, not replaced.

**`applyPick` core pattern to preserve almost entirely** (lines 208-250) — the "find card in
current pack → filter it out → append to draftedIds → placement branch (slot vs bench, displaced
occupant to bench) → `withSide` commit → `{ session, ok, error? }` envelope" shape is unchanged by
this phase; only the `hasKeeper`/tier-bookkeeping line (`const newHasKeeper = current.hasKeeper ||
card.tier === 'keeper';`, line 222) must be deleted per D-05/D-21 (no more keeper bookkeeping at
all).

**`advanceSubStep` — rewrite the cycle-length branch, keep the phase-boundary gate** (lines
321-359):

```typescript
export function advanceSubStep(session: DraftSession): DraftSession {
  if (session.homePicksRemaining !== 0 || session.awayPicksRemaining !== 0) {
    return session; // still waiting on at least one player — phase-boundary-only gate
  }
  if (session.subStep === 'PICK1') {
    /* ... */
  }
  if (session.subStep === 'PICK2') {
    /* ... */
  }
  // subStep === 'PICK3': ...
  if (session.cycle < 4) {
    return openNextPack(session);
  }
  return { ...session, draftComplete: true };
}
```

The "no-op while either side has `picksRemaining > 0`" gate at the top is unchanged and must be
kept identical. The branching body must become round-config-driven (read `DRAFT_ROUNDS[round]`
to decide whether round 1 stops after PICK2 with no PICK3/no swap-back, vs. rounds 2-6 continuing
through PICK3) instead of the current fixed "PICK1→PICK2→PICK3→cycle<4?openNextPack" shape.

**Delete outright (D-21) — do not leave dormant:**

```typescript
function autoSelectKeeperIfMissing(session: DraftSession, side: DraftSide): DraftSession {
  /* lines 361-402 */
}
export function checkKeeperSafety(session: DraftSession, rng: RandomIntFn): DraftSession {
  /* lines 415-428 */
}
```

Also delete: `homeHasKeeper`/`awayHasKeeper`/`keeperAutoPickedThisCycle` initialization in
`createDraftSession` (lines 100, 110), the `keeperAutoPickedThisCycle` reset in `openNextPack`
(line 199), and the `keeperAutoPickedThisCycle` projection in `buildDraftView` (lines 460-463,
475).

**`assignBenchNumbers` — unchanged, reuse verbatim** (lines 437-449) — CSPRNG-based distinct
jersey-number assignment via shuffled range + take-first-N is untouched by this phase.

**`buildDraftView` privacy-scoping pattern — preserve exactly, minus keeper field** (lines
456-478) — the "never include opponent-prefixed fields, only the `getSide`-projected view" shape
is the load-bearing privacy contract (T-29-PRIV) and must not be restructured, only trimmed.

---

### `packages/server/src/draftSession.test.ts`, `__tests__/draftSession.integration.test.ts`, `__tests__/draftReconnect.integration.test.ts`, `__tests__/draftPacks.test.ts`, `__tests__/lineupAssignment.integration.test.ts`

**Analog:** themselves (674 / 1028 / 349 / 100 / — lines respectively per RESEARCH.md Wave 0
Gaps) — these are substantial rewrites, not new files. Structural template: existing
`describe`/`it` blocks organized by substep/cycle transition are the shape to follow, re-scoped
to rounds. Grep for `cycle`, `PICK3`, `keeper`, `PACKS_PER_MATCH` literal assertions in each
before considering a rewrite complete (Pitfall 4/6/8).

---

### `packages/server/src/roomHandlers.ts` (controller — event-driven/request-response)

**Analog:** itself — `ROOM_SETTINGS_CONFIRM` handler already reads `SELECTABLE_DRAFT_POOLS`
dynamically (per RESEARCH.md's Architecture Patterns / Integration Points: "no code change,
only the shared constant's value changes"). Confirm this at implementation time by grepping
the handler for a literal pool-name check rather than assuming zero-diff; if a literal
`['original','mls','international']` array is hardcoded anywhere here (rather than importing
`SELECTABLE_DRAFT_POOLS`), that is the one line to fix (V4 Access Control / ASVS — server is
the authoritative allow-list, per RESEARCH.md Security Domain).

---

### `packages/client/src/components/GameSettingsScreen.tsx` (+ `.test.tsx`)

**Analog:** itself, full file (151 lines)

**Data-driven disabled-state pattern — likely zero code change** (lines 16-17, 38-48, 111-136):

```typescript
const ALL_DRAFT_POOLS: DraftPoolId[] = ['original', 'mls', 'international', 'legends', 'icons'];
// ...
function toggleDraftPool(poolId: DraftPoolId) {
  if (!SELECTABLE_DRAFT_POOLS.includes(poolId)) return;
  // ...
}
// ...
{ALL_DRAFT_POOLS.map((poolId) => {
  const disabled = !SELECTABLE_DRAFT_POOLS.includes(poolId);
  const checked = draftPools.includes(poolId);
  return (
    <label key={poolId} className={disabled ? styles.poolRowDisabled : styles.poolRow}>
      <input type="checkbox" checked={checked} disabled={disabled} onChange={() => toggleDraftPool(poolId)} />
      {DRAFT_POOL_LABELS[poolId]}
      {disabled && <span className={styles.comingSoon}> (coming soon)</span>}
    </label>
  );
})}
```

Since `ALL_DRAFT_POOLS` already lists all 5 pools and disabled/coming-soon is purely derived
from `SELECTABLE_DRAFT_POOLS.includes(poolId)`, widening the shared constant in `types.ts` (D-08)
automatically un-disables Legends/Icons here with **no code change to this file** — confirm this
assumption holds rather than adding a redundant special-case branch.

**Test file — must invert two named tests, not delete them** (per Pitfall 8, RESEARCH.md lines
57-78 of `.test.tsx`): tests titled `'Legends and Icons checkboxes are disabled and labelled
"(coming soon)"'` and `'clicking a disabled Legends/Icons checkbox does not check it'` encode the
OLD deferred-DRAFT-11 behavior — flip their assertions to "enabled, no coming-soon label,
clickable" rather than deleting them outright (preserve the test-name-to-behavior traceability).

---

### `packages/client/src/components/DraftPackCarousel.tsx` (+ `.test.tsx`)

**Analog:** itself, full file (227 lines)

**`TIER_ORDER`/`TIER_CARD_CLASS` — drop the 5th entry, keep the map shape** (lines 26, 33-39):

```typescript
export const TIER_ORDER: DraftTier[] = ['chase', 'rare', 'uncommon', 'common', 'keeper'];

export const TIER_CARD_CLASS: Record<DraftTier, string> = {
  chase: styles.cardTierChase!,
  rare: styles.cardTierRare!,
  uncommon: styles.cardTierUncommon!,
  common: styles.cardTierCommon!,
  keeper: styles.cardTierKeeper!,
};
```

Becomes a 4-entry array/map (drop `'keeper'`/`cardTierKeeper`) — this is the single source both
`BenchCarousel.tsx` and (newly, per D-23) `LineupAssignmentScreen.tsx`'s `LineupStatCard` should
import and reuse, rather than each component redefining its own copy.

**`DraftCardBody` — reused unchanged** (lines 67-119) — the shared inner card renderer (TeamBadge

- cardBody/cardHeader/statGrid markup, `className={TIER_CARD_CLASS[card.tier]}` for the border)
  is exported specifically for reuse by `BenchCarousel` already; D-23 extends this same reuse
  pattern to `LineupStatCard`'s starting-11 rendering (currently `LineupStatCard` does NOT use
  `DraftCardBody` — it has its own near-duplicate markup in `LineupAssignmentScreen.tsx` lines
  130-176 without any tier class applied at all — this is the exact gap D-23 closes).

**Rarest-first sort — reuse verbatim, just shrink `TIER_ORDER`** (lines 147-149):

```typescript
const sortedCards = [...cards].sort(
  (a, b) => TIER_ORDER.indexOf(a.tier) - TIER_ORDER.indexOf(b.tier),
);
```

---

### `packages/client/src/components/BenchCarousel.tsx` (+ `.test.tsx`)

**Analog:** `DraftPackCarousel.tsx` (already imports and reuses `DraftCardBody`/`TIER_CARD_CLASS`
from it, per RESEARCH.md's Architecture Diagram: "BenchCarousel: ALREADY uses
DraftCardBody/TIER_CARD_CLASS via resolveTieredCard — this half of D-23 is largely DONE"). Expect
minimal/no changes beyond whatever narrowing `TIER_CARD_CLASS`'s 4-vs-5-entry shape requires
(compile-time only, since the map is `Record<DraftTier, string>` and `DraftTier` narrows).
Doc-comment in this file has a stale "cycle 4/16 cards" reference (per Pitfall 4) worth a
non-functional cleanup pass.

---

### `packages/client/src/components/LineupAssignmentScreen.tsx` (+ `.module.css`, `.test.tsx`)

**Analog:** itself, full file

**`resolveTieredCard` fallback — replace heuristic with exact recomputation** (lines 266-275,
current — the fallback this phase must fix per D-05/Pitfall 5):

```typescript
function resolveTieredCard(cardId: string): TieredPoolPlayer | null {
  const cached = cardCache[cardId];
  if (cached) return cached;
  const player = PLAYER_MAP.get(cardId);
  if (!player) return null;
  const tier: DraftTier = player.role === 'GK' ? 'keeper' : 'common';
  // ... (constructs a TieredPoolPlayer with the heuristic tier + computed totalStat, per file continuation)
```

Replace the heuristic `tier` line with `classifyTier(computeTotalStat(player))` — no role branch
at all, per RESEARCH.md Pattern 1/Pitfall 5 ("once the fixed-threshold replacement is in place,
this fallback becomes exact, not approximate"). Import `classifyTier`/`computeTotalStat` from
`@counter-attack/shared` (same import source as the rest of this file already uses for
`TieredPoolPlayer`/`DraftTier`).

**`LineupStatCard` — currently renders a plain `PoolPlayer` with NO tier context; this is the
D-23 gap to close** (lines 99-177, current — the near-duplicate of `DraftCardBody` with no tier
border):

```typescript
function LineupStatCard({ player, slotMeta, slotIndex, ... }: StatCardProps) {
  // ...
  return (
    <div className={cardClass} draggable={isDraggable} ...>
      <TeamBadge teamId={teamId} size={48} />
      <div className={styles.cardBody}>
        {/* header + statGrid markup, near-identical to DraftCardBody but with slotMeta.jerseyNumber
            instead of a passed-in jerseyNumber prop, and NO tier border class at all */}
      </div>
    </div>
  );
}
```

Per D-23, apply `TIER_CARD_CLASS[classifyTier(computeTotalStat(player))]` (or the resolved tier
from `resolveTieredCard(player.id)`) as an additional/overriding class alongside the existing
`cardClass` drag-state logic (`statCard`/`statCardLocked`/`statCardConfirmed`/`statCardDragging`/
`statCardDropTarget`) — the tier border and the drag-state border are currently two separate
concerns (base `.statCardBase` 1px border vs. tier classes' 3px border via `composes:
statCardBase`); reconcile them so a dragging/confirmed lineup card still shows its tier color,
matching how `DraftPackCarousel`/`BenchCarousel` already combine tier class + interaction state.

**Keeper-banner UI — remove entirely (D-21/Pitfall 7)** (lines 235, 257-264, 567-569, current):

```typescript
const [showKeeperBanner, setShowKeeperBanner] = useState(false);
// ...
useEffect(() => {
  if (draftView?.keeperAutoPickedThisCycle) {
    setShowKeeperBanner(true);
    const timer = setTimeout(() => setShowKeeperBanner(false), 1000);
    return () => clearTimeout(timer);
  }
  return undefined;
}, [draftView?.keeperAutoPickedThisCycle]);
// ...
{showKeeperBanner && (
  <p className={styles.keeperBanner}>Keeper auto-selected — cycle 4 safety net.</p>
)}
```

Delete the state, the effect, and the JSX block wholesale — not just make it unreachable. Also
delete the `.keeperBanner` CSS class (module.css lines 435-445) since nothing renders it anymore.

**Cycle/pick-counter label — update for round terminology** (lines 560-565, current):

```typescript
{!draftView.draftComplete && (
  <p className={styles.cyclePickCounter}>
    Cycle {draftView.cycle} of 4 &middot; Pick {draftView.picksRemaining} of{' '}
    {draftView.picksRemaining <= 1 ? 1 : 2}
  </p>
)}
```

Becomes round-aware (Round N of 6, picks-per-round varies 2 or 3) — read the total picks for the
current round from `DRAFT_ROUNDS[round].picks` rather than the hardcoded `<= 1 ? 1 : 2` literal.

**`cardCache`/`benchCards` memoization — reuse verbatim** (lines 240-255, 291-296) — the "cache
every card seen in `draftView.currentPack` across the session, since the server only sends ids for
already-placed cards" pattern is unchanged infrastructure; only the tier this cache eventually
resolves to (via `classifyTier`) changes, not the caching mechanism itself.

**`.module.css` tier-color values — fix per D-22** (current, lines 323-351):

```css
.cardTierChase {
  composes: statCardBase;
  border: 3px solid #a855f7;
  min-width: 320px;
}
.cardTierRare {
  composes: statCardBase;
  border: 3px solid #ef4444;
  min-width: 320px;
}
.cardTierUncommon {
  composes: statCardBase;
  border: 3px solid #eab308; /* WRONG per D-22 — should be green */
  min-width: 320px;
}
.cardTierCommon {
  composes: statCardBase;
  border: 3px solid #22c55e; /* WRONG per D-22 — should be white */
  min-width: 320px;
}
.cardTierKeeper {
  composes: statCardBase;
  border: 3px solid #ffffff; /* DELETE — no 5th keeper color per D-05 */
  min-width: 320px;
}
```

Fix: chase `#a855f7` (unchanged, correct), rare `#ef4444` (unchanged, correct), uncommon → a green
hex (e.g. reuse the existing `#22c55e` green already used elsewhere in this file for
`.statusActive`/`.confirmButtonGreen`, or pick a comparable green), common → a white/near-white
hex (e.g. `#f5f5f5` or `#ffffff`, mirroring what `.cardTierKeeper` currently uses before deletion).
Delete `.cardTierKeeper` entirely (Pitfall 6/D-05) — do not leave it defined-but-unreferenced.

---

## Shared Patterns

### RNG-agnostic pure engine + server-side CSPRNG binding

**Source:** `packages/shared/src/draftEngine.ts` (`RandomIntFn` type, lines 148-157) +
`packages/server/src/draftPacks.ts` (binds `crypto.randomInt`)
**Apply to:** Any new/rewritten pack-generation or dealing logic — the shared module must never
import `crypto` or `Math.random` directly; randomness is always an injected parameter, bound to
the real CSPRNG only in the server package. This is the fairness boundary (T-28-04-FAIR) and must
be preserved unchanged through the round-structure rewrite.

### Never-mutate-input, always-return-new-session convention

**Source:** `packages/server/src/draftSession.ts` (`getSide`/`withSide`, `applyPick`,
`applyRearrange`, `advanceSubStep` — every exported function takes a `DraftSession` and returns a
brand-new one)
**Apply to:** Every rewritten/extended function in `draftSession.ts` — no `session.x = ...`
in-place mutation anywhere, matching the existing spread-based (`{ ...session, ... }`) pattern.

### Doc-comment convention citing requirement IDs

**Source:** Every exported const/type/function across `types.ts`/`draftEngine.ts`/
`draftSession.ts` (e.g. `/** DRAFT-04 (Phase 28), D-13: ... */`)
**Apply to:** All new/rewritten exports this phase — cite the D-numbers from CONTEXT.md
(D-03–D-23) the same way existing code cites DRAFT-XX/D-XX, so future readers can trace which
decision drove which line.

### Full vertical removal for deleted features (not just the "obvious" function)

**Source:** RESEARCH.md Pitfall 7's analysis of the keeper-safety-net removal
**Apply to:** D-21 (keeper auto-pick) and D-05 (`'keeper'` tier) — both require touching: type
definition → session initial shape → mutation/bookkeeping logic → view projection → wire type →
client state/effect/JSX → CSS class. Grep for the removed identifier (`HasKeeper`,
`keeperAutoPicked`, `'keeper'` as a `DraftTier` literal, `cardTierKeeper`) after each change;
zero matches is the completion signal, not `tsc --noEmit` passing alone (Pitfall 4/6).

### Server-authoritative allow-list, client-side disabling is UX-only

**Source:** `SELECTABLE_DRAFT_POOLS` used in both `GameSettingsScreen.tsx` (checkbox
disabled-state) and (per RESEARCH.md) `roomHandlers.ts`'s `ROOM_SETTINGS_CONFIRM` handler
**Apply to:** D-08's Legends/Icons enablement — the widened `SELECTABLE_DRAFT_POOLS` array in
`types.ts` is the single source of truth; do not add a separate client-only or server-only
allow-list. This is the existing IN-03/ASVS V5 pattern already in place for original/mls/
international, just widened to 5 values.

## No Analog Found

None — every file this phase touches is an existing file being modified in place; no file lacks
a direct current-state analog to diff against.

## Metadata

**Analog search scope:** `packages/shared/src`, `packages/server/src` (+ `__tests__`),
`packages/client/src/components` — the exact file set enumerated in RESEARCH.md's Recommended
Project Structure.
**Files scanned (read in full or targeted range):** `types.ts` (lines 440-540), `draftEngine.ts`
(full, 399 lines), `draftSession.ts` (full, 479 lines), `draftPacks.ts` (full, 27 lines),
`DraftPackCarousel.tsx` (full, 227 lines), `GameSettingsScreen.tsx` (full, 151 lines),
`LineupAssignmentScreen.tsx` (targeted: lines 1-100, 76-275, 470-600),
`LineupAssignmentScreen.module.css` (full, 459 lines).
**Pattern extraction date:** 2026-07-21
