# Phase 28: Draft Data Model - Pattern Map

**Mapped:** 2026-07-21
**Files analyzed:** 6 (3 modified, 1 new module + tests, 2 data files)
**Analogs found:** 6 / 6

## File Classification

| New/Modified File                                                                                | Role                                                 | Data Flow       | Closest Analog                                                                                           | Match Quality                                                |
| ------------------------------------------------------------------------------------------------ | ---------------------------------------------------- | --------------- | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| `packages/shared/src/teams.ts` (`PoolPlayer` interface — add `poolTag`)                          | model                                                | transform       | itself (existing interface)                                                                              | exact — additive field                                       |
| `packages/shared/src/data/player-pool.csv` (add `PoolTag` column)                                | config/data                                          | batch           | itself (existing CSV)                                                                                    | exact                                                        |
| `packages/shared/scripts/seed-rosters.ts` (thread `poolTag` through codegen)                     | utility (codegen script)                             | batch/transform | itself (existing script)                                                                                 | exact                                                        |
| `packages/shared/src/types.ts` (new tier/composition/pack-count types)                           | model                                                | transform       | `packages/shared/src/types.ts` `DraftPoolId`/`SELECTABLE_DRAFT_POOLS` (Phase 27 addition, lines 445-467) | exact — same file, same recent addition pattern              |
| New `packages/shared/src/draftEngine.ts` (tier classification + pack generation, pure functions) | service (pure data engine)                           | batch/transform | `packages/shared/src/scoreUtils.ts` (pure function module, no side effects)                              | role-match — closest existing "pure algorithm module" shape  |
| New `packages/shared/src/draftEngine.test.ts`                                                    | test                                                 | —               | `packages/shared/src/teams.test.ts`                                                                      | exact — vitest describe/it style for shared data-shape tests |
| Server-side crypto.randomInt usage (for pack shuffle/backfill sampling)                          | utility (randomness)                                 | —               | `packages/server/src/diceUtils.ts`                                                                       | exact                                                        |
| `packages/shared/src/teamConfig.ts` (`TEAM_CONFIGS[...].league`)                                 | model (lookup table, reuse only — no changes needed) | —               | n/a (read-only reuse)                                                                                    | exact, no modification needed                                |

## Pattern Assignments

### `packages/shared/src/teams.ts` — add `poolTag` field to `PoolPlayer`

**Analog:** itself, lines 17-41 (existing `PoolPlayer` interface)

**Current interface shape** (lines 17-41):

```typescript
export interface PoolPlayer {
  id: string;
  sourceTeamId: string;
  firstName: string;
  lastName: string;
  number: number;
  nationality: string;
  role: 'GK' | 'DEF' | 'MID' | 'FWD' | 'ST';
  position: HexCoord;
  pace: number;
  shooting: number;
  tackling: number;
  dribbling: number;
  saving: number;
  handling: number;
  resilience: number;
  aerialAbility: number;
  highPass: number;
}
```

**Pattern to follow:** Add `poolTag?: 'legend' | 'icon';` as an optional field with a doc comment mirroring the style of existing field comments (e.g. the `aerialAbility` comment: `/** D-13: Aerial Ability — CSV header typo corrected in Phase 19. */`). Field ordering convention: annotate with the deciding phase/decision ID, e.g. `/** D-02 (Phase 28): pool tag for reserved Legends/Icons players — undefined = ordinary player. */`.

**Critical:** `teams.ts` has an `AUTO-GENERATED` header (lines 1-10) — this file must NOT be hand-edited directly. The interface edit happens in the seed script's emitted template string (see below); regenerating via `pnpm run seed:rosters` produces the final `teams.ts`. Only the generator template (`seed-rosters.ts`) is hand-edited.

Example existing player entries to update in the CSV /codegen (the 10 tagged rows currently carry suffixes in `lastName`, to be stripped per D-03), e.g.:

```typescript
{ id: 'p065', sourceTeamId: 'free-agent', firstName: 'Cristiano', lastName: 'Ronaldo (M)', ... }
{ id: 'p066', sourceTeamId: 'free-agent', firstName: 'Diego', lastName: 'Maradona (L)', ... }
{ id: 'p096', sourceTeamId: 'free-agent', firstName: 'Pelé', lastName: '(L)', ... }
```

Note `p096`/`p098` (Pelé, Ronaldinho) have the tag as the ENTIRE `lastName` value (`'(L)'`) with empty first-name space — stripping needs to leave a valid non-empty `lastName` (likely just the mononym moved to `lastName`, with `firstName` empty, or a special-cased rename). This is a data-quality edge case the codegen/CSV edit must handle explicitly — check final CSV output for these two rows.

---

### `packages/shared/src/data/player-pool.csv` — add `PoolTag` column

**Analog:** itself — existing header row

**Current header** (row 1):

```
Player,Team,Nationality,Position,Pace,Dribbling,Highpass,Resilience,Shooting,Tackling,Aerial Ability,Saving,Handling
```

Note: no `SourceTeam` column currently exists in the header despite `seed-rosters.ts` checking for `idx['SourceTeam']` (falls back to `toSlug(row[idx['Team']])`) — the `Team` column already holds slugs directly (e.g. `canada`, `free-agent`). Add `PoolTag` as a new trailing column (or wherever convenient); seed script reads it via `row[idx['PoolTag']]`, blank → `undefined`/`'legend'`/`'icon'` for the 10 tagged rows. Also strip `(L)`/`(M)` from the `Player` column's name text for those 10 rows per D-03.

**CSV parsing constraint (from `seed-rosters.ts` lines 291-298):** header cells must not contain commas (naive `split(',')` parser, no quoted-field support) — `PoolTag` values (`legend`, `icon`, blank) satisfy this trivially.

---

### `packages/shared/scripts/seed-rosters.ts` — thread `poolTag` through codegen

**Analog:** itself, `RawPlayer` interface (lines 91-107), `parseRow` (lines 129-188), `PlayerEntry` interface (lines 190-208), `serializePlayer` (lines 256-276)

**Pattern — add field to `RawPlayer`:**

```typescript
interface RawPlayer {
  firstName: string;
  lastName: string;
  teamCsvName: string;
  nationality: string;
  role: 'GK' | 'DEF' | 'MID' | 'FWD' | 'ST';
  pace: number;
  // ... existing fields ...
  poolTag?: 'legend' | 'icon'; // NEW
}
```

**Pattern — read from CSV in `parseRow`** (mirrors existing `toInt`/direct-read style, lines 129-187):

```typescript
const poolTagRaw = (row[idx['PoolTag']] ?? '').trim();
const poolTag = poolTagRaw === 'legend' || poolTagRaw === 'icon' ? poolTagRaw : undefined;
```

Then include `poolTag` in the returned `RawPlayer` object (line ~172-187).

**Pattern — carry through to `PlayerEntry`** (interface lines 190-208, plus `buildSquadEntries` lines 212-253 and the free-agent inline push at lines 325-349): add `poolTag?: 'legend' | 'icon';` to `PlayerEntry`, and spread/pass it through in both the free-agent branch (lines 330-348, direct push) and `buildSquadEntries`'s per-player map (lines 234-251) — though in practice only free-agent rows will ever carry a tag (per D-01), so the squad branch can omit it or pass `undefined` unconditionally.

**Pattern — emit in `serializePlayer`** (lines 256-276): conditionally emit the line only when defined, matching the file's existing all-fields-always-present style but adding one guarded line:

```typescript
function serializePlayer(p: PlayerEntry, indent = '  '): string {
  return `${indent}{
${indent}  id: '${p.id}',
${indent}  sourceTeamId: '${p.sourceTeamId.replace(/'/g, "\\'")}',
${indent}  firstName: '${p.firstName.replace(/'/g, "\\'")}',
${indent}  lastName: '${p.lastName.replace(/'/g, "\\'")}',
${indent}  number: ${p.number},
  ...
${indent}  highPass: ${p.highPass},
${p.poolTag ? `${indent}  poolTag: '${p.poolTag}',\n` : ''}${indent}}`;
}
```

**Regeneration is a dev-tool step, not a build step** (per file header comment, lines 1-13 and `teams.ts` header) — remember to run `pnpm run seed:rosters` after editing the CSV/script, and commit the regenerated `teams.ts`.

---

### `packages/shared/src/types.ts` — new tier/composition/pack-count types

**Analog:** itself, the Phase 27 `TeamType`/`DraftPoolId`/`SELECTABLE_DRAFT_POOLS` addition (lines 445-467)

**Pattern to follow exactly** (this is the most recent addition to this file and sets the house style: JSDoc block citing the requirement ID + phase + decision ID, union type, then an accompanying `const` array/record when a runtime-checkable subset or config value is needed):

```typescript
/** DRAFT-01/02/03 (Phase 27): team type selected on the pre-game settings screen. */
export type TeamType = 'standard' | 'draft';

/**
 * DRAFT-01 (Phase 27): selectable draft player pools. ...
 */
export type DraftPoolId = 'original' | 'mls' | 'international' | 'legends' | 'icons';

/**
 * DRAFT-01 (Phase 27): pools selectable in v1.4 ...
 */
export const SELECTABLE_DRAFT_POOLS: readonly DraftPoolId[] = [
  'original',
  'mls',
  'international',
] as const;
```

**New types to add following this same shape (per D-13, tier value only, no display constants):**

```typescript
/** DRAFT-04 (Phase 28): rarity tier assigned to each pooled player for a draft session. */
export type DraftTier = 'chase' | 'rare' | 'uncommon' | 'common' | 'keeper';

/** DRAFT-05 (Phase 28): configurable packs-per-match constant (D-10). */
export const PACKS_PER_MATCH = 8;

/** DRAFT-05 (Phase 28): per-pack composition counts (D-11 — 1/1/1/3/1, confirmed unchanged). */
export const PACK_COMPOSITION: Readonly<Record<DraftTier, number>> = {
  chase: 1,
  rare: 1,
  uncommon: 1,
  common: 3,
  keeper: 1,
};
```

Plus a typed output shape for tiered players / packs (e.g. `TieredPoolPlayer`, `DraftPack`) — exact naming and whether this lives in `types.ts` vs. the new engine module is Claude's Discretion per CONTEXT.md; if colocated in `draftEngine.ts`, still export via the barrel (`index.ts`) per convention below.

---

### New `packages/shared/src/draftEngine.ts` — tier classification + pack generation

**Analog:** `packages/shared/src/scoreUtils.ts` (pure function module, no side effects, JSDoc-documented decisions, imports only shared types/`hex.ts` helpers)

**Imports pattern** (from `scoreUtils.ts` lines 11-12, adapt for draft engine):

```typescript
import type { PoolPlayer } from './teams.js';
import { PLAYER_POOL } from './teams.js';
import { TEAM_CONFIGS } from './teamConfig.js';
import type { DraftPoolId, DraftTier } from './types.js';
```

Note: `.js` extension on relative imports is the established convention throughout `packages/shared/src` (ESM output).

**Core pattern — pure function, JSDoc citing decision IDs** (mirrors `computeCombinedScore`/`computeLooseBall` style in `scoreUtils.ts` lines 14-37 and 67-97): each exported function should have a JSDoc block referencing the CONTEXT.md decision ID(s) it implements (e.g. `D-05`, `D-06`, `D-07` for tier percentile logic; `D-09`..`D-12` for pack generation), parameter/return docs, and NO internal RNG — accept pre-generated randomness or an injected shuffle function as a parameter where determinism matters for testing (mirrors `computeLooseBall`'s D-06 note: "dice values as parameters — no random number generation here").

**Percentile/tie-break pattern (D-06):** sort candidates by total stat descending, use rank-position/count for percentile, ties broken by stable sort (input order) — implement as a pure function taking `PoolPlayer[]` and returning tier-annotated results, no mutation of `PLAYER_POOL`.

**Pool resolution pattern (D-04):** reuse `TEAM_CONFIGS[sourceTeamId].league` directly for `'mls'`/`'international'` — no new lookup table:

```typescript
function isInPool(player: PoolPlayer, poolId: DraftPoolId): boolean {
  if (poolId === 'original') {
    return player.sourceTeamId === 'free-agent' && !player.poolTag;
  }
  const config = TEAM_CONFIGS[player.sourceTeamId as TeamId];
  return config?.league === poolId; // 'mls' | 'international'
}
```

**Shuffle/backfill randomness (Claude's Discretion + project convention):** must use `crypto.randomInt` server-side, never `Math.random()` — see Shared Patterns below. Since `packages/shared` is imported by both client and server, the engine's public functions should accept an injectable RNG function (e.g. `rng: () => number` or `randomInt: (max: number) => number`) as a parameter, defaulting to a client-safe implementation only where the caller is client-side preview code — but the actual match-authoritative pack generation call (server-side, at settings-confirm time) MUST pass a `crypto.randomInt`-backed function. This keeps `draftEngine.ts` itself framework/environment-agnostic (no Node-only `crypto` import inside `packages/shared`), consistent with the "pure, importable by both client and server" convention.

**No side effects:** function signatures take `PoolPlayer[]` / config values in, return new arrays/objects out — never mutate `PLAYER_POOL` (which is `readonly PoolPlayer[]`) — this matches `scoreUtils.ts`'s treatment of `PLAYER_POOL`/`HexCoord` as pure inputs.

---

### New `packages/shared/src/draftEngine.test.ts`

**Analog:** `packages/shared/src/teams.test.ts` (lines 1-9 header/import style, lines 15-60 `describe`/`it` structure)

**Imports pattern** (lines 1-7):

```typescript
import { describe, it, expect } from 'vitest';
import { PLAYER_POOL } from './teams.js';
import { getSquadPlayers } from './teamConfig.js';
```

**Test structure pattern** (lines 15-56): `describe('<subject> — <REQUIREMENT-ID>: <short description>', () => { it('<behavior in plain language>', () => { expect(...).toBe/toHaveLength/toMatch(...); }); });` — group by requirement ID (`DRAFT-04`, `DRAFT-05`) matching the file's existing `DATA-01`/`DATA-02` grouping style.

---

### Server-side crypto.randomInt usage (shuffle/backfill sampling convention)

**Analog:** `packages/server/src/diceUtils.ts` (full file, 13 lines) and `packages/server/src/gameEngine.ts` (lines 10-15)

**Exact pattern to copy** (`diceUtils.ts`, entire file):

```typescript
import { randomInt } from 'crypto';

/**
 * Rolls a single d6. Returns 1–6 inclusive.
 *
 * All dice in the game use this function — no other RNG source permitted (D-08, DICE-01).
 * Wraps Node.js crypto.randomInt for cryptographically secure randomness.
 * min inclusive, max exclusive: randomInt(1, 7) → 1..6.
 */
export function rollDice(): number {
  return randomInt(1, 7);
}
```

**`gameEngine.ts` doc-comment convention for citing this rule** (lines 10-15):

```typescript
// D-13: attackingTeam assigned via coin flip using crypto.randomInt (never client-supplied).
// TEAM-03: refereeCard assigned randomly at match start via crypto.randomInt(1, 7).
import { randomInt } from 'crypto';
```

**Application to pack generation:** since pack generation is server-authoritative and happens at settings-confirm time (not client-side), the actual shuffle/sampling implementation used by the server (likely in `packages/server/src/` — a new function or inline in the room-settings-confirm handler) should follow this exact `import { randomInt } from 'crypto'` + small wrapper-function pattern, e.g. a `shuffleWithRandomInt<T>(arr: T[]): T[]` Fisher-Yates helper using `randomInt(0, i + 1)` per swap, colocated server-side (NOT inside `packages/shared`, to avoid a Node-only `crypto` import leaking into client bundles) and passed into `draftEngine.ts`'s pure functions as an injected RNG parameter (see draftEngine pattern above).

---

## Shared Patterns

### Server-authoritative randomness (crypto.randomInt, never Math.random)

**Source:** `packages/server/src/diceUtils.ts` (whole file); reinforced in `packages/server/src/gameEngine.ts` lines 10-15
**Apply to:** the pack-generation engine's shuffle and backfill sampling steps. `packages/shared/src/draftEngine.ts` itself must stay `crypto`-free (importable by client); the server wraps `crypto.randomInt` and injects it into the shared engine's pure functions.

### AUTO-GENERATED data file discipline

**Source:** `packages/shared/src/teams.ts` header comment (lines 1-10); `packages/shared/scripts/seed-rosters.ts` header comment (lines 1-28)
**Apply to:** All `teams.ts`/CSV changes — edit `player-pool.csv` and `seed-rosters.ts` only, then regenerate via `pnpm run seed:rosters`. Never hand-edit `teams.ts` directly.

### Barrel export convention

**Source:** `packages/shared/src/index.ts` (lines 1-19)
**Apply to:** Any new shared module (e.g. `draftEngine.ts`) must be added as `export * from './draftEngine.js';` in `index.ts` so client/server consumers import from `@counter-attack/shared` only (D-05, no sub-path imports).

### Pure-function, no-side-effect shared modules with decision-ID JSDoc

**Source:** `packages/shared/src/scoreUtils.ts` (whole file)
**Apply to:** `draftEngine.ts` — every exported function documents which CONTEXT.md decision ID(s) (D-05..D-12) it implements; no mutation of `PLAYER_POOL`; randomness/dice-like values passed in as parameters rather than generated internally.

### vitest describe/it grouped-by-requirement-ID test style

**Source:** `packages/shared/src/teams.test.ts` (lines 1-60)
**Apply to:** `draftEngine.test.ts` — group tests under `describe('<subject> — DRAFT-04/05: ...')`.

## Metadata

**Analog search scope:** `packages/shared/src`, `packages/shared/scripts`, `packages/server/src`
**Files scanned:** `teams.ts`, `teams.test.ts`, `teamConfig.ts`, `types.ts`, `index.ts`, `scoreUtils.ts`, `seed-rosters.ts`, `diceUtils.ts`, `gameEngine.ts` (grep only), `player-pool.csv` header
**Pattern extraction date:** 2026-07-21
