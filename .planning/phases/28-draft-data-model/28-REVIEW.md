---
phase: 28-draft-data-model
reviewed: 2026-07-21T00:00:00Z
depth: standard
files_reviewed: 10
files_reviewed_list:
  - packages/server/src/__tests__/draftPacks.test.ts
  - packages/server/src/draftPacks.ts
  - packages/shared/scripts/seed-rosters.ts
  - packages/shared/src/data/player-pool.csv
  - packages/shared/src/draftEngine.test.ts
  - packages/shared/src/draftEngine.ts
  - packages/shared/src/index.ts
  - packages/shared/src/teams.test.ts
  - packages/shared/src/teams.ts
  - packages/shared/src/types.ts
findings:
  critical: 1
  warning: 2
  info: 3
  total: 6
status: issues_found
---

# Phase 28: Code Review Report

**Reviewed:** 2026-07-21
**Depth:** standard
**Files Reviewed:** 10
**Status:** issues_found

## Summary

Reviewed the draft-data-model engine (`draftEngine.ts`), its server-side CSPRNG binding
(`draftPacks.ts`), the roster seed pipeline, and all associated tests/data. The
`draftEngine.ts` module correctly stays RNG-agnostic (no `crypto`/`Math.random` import
anywhere in shared source — confirmed by grep), `draftPacks.ts` correctly binds Node's
`crypto.randomInt` as the sole real-randomness source, and the Fisher-Yates shuffle in
`shuffle()` is a standard, unbiased implementation with correct `rng(0, i+1)` bounds. All
existing unit/integration tests pass, `tsc` builds clean for both packages, and regenerating
`teams.ts` from `player-pool.csv` reproduces the committed file byte-for-byte (module
whitespace/quote-style only) — the checked-in generated data is in sync with its source CSV.

To go beyond "tests pass," this review executed the engine directly (via a temporary,
since-removed vitest spec) against real `crypto.randomInt` across every reachable pool
combination (`['original']`, `['mls']`, `['international']`, all pairs, and all three) for
30 iterations each: zero duplicate-card or composition failures were observed, which
disproves my initial hypothesis that the small `'international'`/`'mls'`-only populations
could produce an unfillable "chase" tier — the backfill loop handles it correctly.

However, direct execution also surfaced a real defect: `generateDraftPacks` performs **no
validation** on its `selectedPools` argument. Passing `[]` or an out-of-contract value like
`'legends'` does not throw — it silently falls back to drawing from the _entire_ fallback
universe (all real pools), which is the opposite of fail-safe for a module whose own
docstring frames pool selection as a fairness/security boundary. See CR-01.

Two design-level warnings and three informational findings (mostly documentation/dead-code
drift in the seed script) round out the review.

## Critical Issues

### CR-01: `generateDraftPacks`/`generateMatchPacks` silently draft from ALL pools when given an empty or invalid `selectedPools`

**File:** `packages/shared/src/draftEngine.ts:220-227` (also reachable via `packages/server/src/draftPacks.ts:22-27`)

**Issue:** `generateDraftPacks` never validates `selectedPools` against `SELECTABLE_DRAFT_POOLS`
(or even checks for a non-empty array) before computing `fallbackPools`:

```ts
const selected = resolvePoolPlayers(selectedPools);
const fallbackPools = FALLBACK_POOL_ORDER.filter((p) => !selectedPools.includes(p));
```

If `selectedPools` is `[]` (e.g. an upstream bug leaves `room.draftPools` unset) or contains
only an unselectable value such as `'legends'`/`'icons'` (which `isInPool` always returns
`false` for), `resolvePoolPlayers` returns an empty "selected" set — but
`fallbackPools` still resolves to **all three** real pools (`['original', 'mls',
'international']`), because none of them were literally present in `selectedPools`. The
backfill loop then happily draws every needed card from the full universe and returns a
complete, valid-looking 8-pack draft with no error, warning, or signal that the caller's
selection was empty/invalid.

Verified by direct execution (not merely inspection):

```
generateDraftPacks([], randomInt)          -> sourceTeamIds: [la, free-agent, crew, miami, seattle, city, nashville]
generateDraftPacks(['legends'], randomInt) -> sourceTeamIds: [seattle, miami, free-agent, crew, la, city, nashville]
```

Both calls succeed and silently draft from MLS/international/free-agent players — i.e.
exactly as if the player had selected `['original', 'mls', 'international']` — even though
zero (or a non-selectable) pool was actually requested. This is a fail-open pattern in a
module whose own docstring (lines 143-151) explicitly calls pack contents "gameplay-affecting"
and names randomness/pool-selection as a fairness boundary (T-28-04-FAIR), and it is exactly
the kind of allow-list gap `types.ts` warns about for `SELECTABLE_DRAFT_POOLS` ("a modified
client could select 'legends'/'icons'... Pitfall 3 / ASVS V5 Input Validation"). Today the
allow-list check is deferred to the not-yet-written Phase 29 `ROOM_SETTINGS_CONFIRM` handler,
but this module — described as "the single authoritative entry point" for pack generation —
provides no defense-in-depth if that future caller has any gap (a race condition, a default
of `[]` before settings are confirmed, a typo in the allow-list, etc.).

**Fix:** Validate `selectedPools` at the top of `generateDraftPacks` (or at minimum in
`generateMatchPacks`) and throw a descriptive error for empty/unselectable input instead of
silently broadening scope:

```ts
export function generateDraftPacks(
  selectedPools: DraftPoolId[],
  rng: RandomIntFn,
): { pool: TieredPoolPlayer[]; packs: DraftPack[] } {
  if (
    selectedPools.length === 0 ||
    !selectedPools.every((p) => SELECTABLE_DRAFT_POOLS.includes(p))
  ) {
    throw new Error(
      `generateDraftPacks: selectedPools must be a non-empty subset of SELECTABLE_DRAFT_POOLS, got ${JSON.stringify(selectedPools)}`,
    );
  }
  const selected = resolvePoolPlayers(selectedPools);
  // ...
}
```

## Warnings

### WR-01: Insufficient-supply scenarios fail silently instead of throwing (short packs and/or cross-pack duplication)

**File:** `packages/shared/src/draftEngine.ts:296-341`

**Issue:** After the backfill loop terminates (`!drew` → `break`), the code proceeds straight
to dealing without ever checking that every tier actually reached its need. Two silent
failure modes exist as a result:

1. Dealing loop (lines 336-341): `if (tierArray.length === 0) continue;` — if a tier has
   _zero_ members at all, the loop just skips those card slots, silently producing a
   `DraftPack` with `cards.length < 7`, breaking the D-09 "7 cards per pack" contract with no
   error, log, or thrown exception.
2. Cursor wraparound (line 338): `const idx = cursors[tier] % tierArray.length;` — if a tier
   has _some_ members but fewer than `PACKS_PER_MATCH * PACK_COMPOSITION[tier]` needed, the
   modulo wraps and the **same player is dealt into more than one pack**, silently violating
   the D-09 no-cross-pack-duplication invariant the whole backfill stage exists to guarantee.

For the current constants (`PACKS_PER_MATCH = 8`, default `PACK_COMPOSITION`, and the full
16-goalkeeper / large-outfield universe across `original`+`mls`+`international`) this path is
provably dormant — confirmed by stress-executing every reachable pool combination with real
`crypto.randomInt` (0 failures across 210 iterations). But nothing in the code enforces that
invariant going forward: if `PACKS_PER_MATCH` or `PACK_COMPOSITION` are ever tuned (a very
plausible future change per the "Configurable" comments on both constants) past what the
fixed 188-player pool can support, this degrades silently into duplicate/short packs instead
of a clear error at generation time.

**Fix:** After the final `assignTiers` classification (step 5, ~line 296), assert each tier's
population meets its need and throw a descriptive error otherwise, e.g.:

```ts
const pool = assignTiers(union);
const finalCounts = /* tally pool by tier, as already done in the backfill loop */;
for (const tier of ['chase', 'rare', 'uncommon', 'common'] as const) {
  if (finalCounts[tier] < need[tier]) {
    throw new Error(`generateDraftPacks: insufficient '${tier}' supply (${finalCounts[tier]}/${need[tier]}) after backfill`);
  }
}
if (finalKeeperCount < keeperNeed) {
  throw new Error(`generateDraftPacks: insufficient keeper supply (${finalKeeperCount}/${keeperNeed}) after backfill`);
}
```

### WR-02: Test coverage gap — `draftPacks.test.ts` Test 3 never checks no-duplication/composition for the tightest-supply single pools

**File:** `packages/server/src/__tests__/draftPacks.test.ts:76-80`

**Issue:**

```ts
it('Test 3: every single-pool selection in SELECTABLE_DRAFT_POOLS backfills successfully without throwing', () => {
  for (const poolId of SELECTABLE_DRAFT_POOLS) {
    expect(() => generateMatchPacks([poolId])).not.toThrow();
  }
});
```

This only asserts the call doesn't throw. `'mls'` and `'international'` each have only 6
goalkeepers (vs. a keeper need of 8) and a comparatively small outfield population — they are
the tightest-supply, backfill-dependent scenarios in the whole test matrix — yet the full
structural invariants (`assertStructuralInvariants`, which checks pack size, composition, and
no cross-pack duplication) are only exercised for `['original']` and the all-three-pools case
(Test 1/Test 2). A regression that reintroduces duplication or short packs specifically for
`'mls'`-only or `'international'`-only selections would pass this suite silently.

**Fix:** Call `assertStructuralInvariants(['mls'])` and `assertStructuralInvariants(['international'])`
explicitly (in addition to, or instead of, the bare `not.toThrow()` loop).

## Info

### IN-01: Stale/incorrect CSV-processing-order documentation in `seed-rosters.ts`

**File:** `packages/shared/scripts/seed-rosters.ts:14-27`

**Issue:** The header comment documents the CSV row-processing order (which determines
p-ID assignment) as:

```
canada → p001–011, city → p012–022, crew → p023–033, england → p034–044,
free-agent → p045–100, france → p101–111, miami → p112–122, lafc → p123–133,
mexico → p134–144, nashville → p145–155, seattle → p156–166, spain → p167–177,
usmnt → p178–188
```

This does not match the actual `player-pool.csv` first-appearance order (verified by
re-running `pnpm run seed:rosters` and by direct inspection of the `Team` column): the real
order is `canada, city, crew, england, france, free-agent, la, mexico, miami, nashville,
seattle, spain, us` — `france` comes _before_ `free-agent` (not after), and the MLS/national
slugs `'lafc'`/`'usmnt'` don't exist in the CSV at all (the actual slugs are `'la'`/`'us'`,
matching `TEAM_CONFIGS`). This doesn't affect runtime behavior (the script derives order from
the CSV itself, not from this comment), but it's actively misleading for anyone trying to
reason about or verify p-ID stability when editing the CSV.

**Fix:** Regenerate this comment block from the current CSV's actual team order, or replace
it with a note that the true order is whatever `Team` column values first appear in the CSV.

### IN-02: Dead "SourceTeam" column branch in `seed-rosters.ts`

**File:** `packages/shared/scripts/seed-rosters.ts:169-172, 319-320`

**Issue:** Both `parseRow` and `main()` prefer a `SourceTeam` CSV column and fall back to
`toSlug(row[idx['Team']])` only "for backwards compatibility if SourceTeam is absent." The
current `player-pool.csv` header (`Player,Team,Nationality,Position,...`) has no `SourceTeam`
column at all, so `idx['SourceTeam']` is always `undefined` and the "primary" branch is
unreachable dead code in practice — every row is processed via the fallback. The comments
("SourceTeam column holds the canonical slug directly") frame the dead branch as the
expected/primary path, which will confuse a future reader trying to understand which column
actually drives `sourceTeamId`.

**Fix:** Either add the `SourceTeam` column to the CSV (making the primary branch live) or
remove the dead branch and comment, documenting that `sourceTeamId` is derived via
`toSlug(Team)`.

### IN-03: Naive CSV parser has no quoted-field support for data rows

**File:** `packages/shared/scripts/seed-rosters.ts:120-128, 302-308`

**Issue:** `parseCSV` splits each line on a bare `,` with no quote-handling, and the only
comma-safety check (`CR-02`, lines 302-308) validates the **header** row only. If a future
roster addition includes a comma inside a text field (a player's name, nationality, etc.),
the parser will silently misalign every subsequent column for that row with no error —
`parseRow` will happily produce a `RawPlayer` with garbage numeric stats read from the wrong
column offsets. This is a dev-tool (not a build step) so the blast radius is limited to
`teams.ts` regeneration, but it's a landmine with no safety net for a person editing the CSV
by hand.

**Fix:** Either extend the `CR-02`-style validation to scan data rows too (reject any row
whose comma count doesn't match the header's), or switch to a quote-aware CSV parser.

---

_Reviewed: 2026-07-21_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
