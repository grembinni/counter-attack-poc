# Phase 21: New Teams (MLS + International) — Research

**Researched:** 2026-07-04
**Domain:** TypeScript data model extension, React tab UI, Socket.io real-time state broadcast, CSV-driven player seeding
**Confidence:** HIGH — all findings are from direct codebase inspection; no external API lookups required

---

## Summary

Phase 21 is primarily a **data model extension + UI refactor** phase. The infrastructure from Phases 19 and 20 is already in place: `TeamConfig` has `league`, `palette`, `defaultUniformStyle`, and `playerIds`; `COLOR_SCHEME_REGISTRY` already contains all 10 new team palette entries; all 10 badge PNG assets are present in the assets directory; `PLAYER_POOL` already contains 110 players from `mls.csv` and `national.csv` with correct `sourceTeamId` slugs.

The three work streams are: (1) extending `TeamId` from 2 to 12 members and populating 10 new `TEAM_CONFIGS` entries with `playerIds` resolved from `PLAYER_POOL`; (2) refactoring `TeamSelectionScreen` to show league tabs instead of a flat grid; (3) extending `VALID_TEAM_IDS` on the server and updating tests. The real-time "struck-out" feedback (LEAGUE-02) requires no socket changes — `TEAM_HOME_PICKED` already broadcasts to all room members and `homePickedTeam` is already passed as a prop through `App.tsx`.

The main execution risk is the `playerIds` population step: the seed script already assigned stable IDs (`p069`–`p178`) to all MLS and national players, but the correct player IDs for each of the 10 new squads must be extracted from `PLAYER_POOL` by `sourceTeamId` match and written into `TEAM_CONFIGS`. This can be done via a short extraction helper at data-authoring time rather than code generation.

**Primary recommendation:** Extend `TeamId`, populate `TEAM_CONFIGS`, update `VALID_TEAM_IDS`, then refactor `TeamSelectionScreen` to a two-tab layout. All four items are straightforward mechanical changes on top of the Phase 19/20 foundation.

---

## Architectural Responsibility Map

| Capability                       | Primary Tier             | Secondary Tier | Rationale                                                                                   |
| -------------------------------- | ------------------------ | -------------- | ------------------------------------------------------------------------------------------- |
| TeamId union + TEAM_CONFIGS data | Shared package           | —              | Source of truth for all packages; already in `packages/shared/src/teamConfig.ts`            |
| Player ID assignment per team    | Shared package           | —              | `PLAYER_POOL` and `getSquadPlayers` both live in shared; `playerIds` arrays populated here  |
| Team validation on pick          | API / Backend            | —              | `VALID_TEAM_IDS` allow-list in `roomHandlers.ts` must stay server-side (ASVS V5)            |
| League tab UI                    | Frontend (client)        | —              | Pure client presentation; tab state is local React state in `TeamSelectionScreen`           |
| Struck-out card real-time sync   | API / Backend + Frontend | —              | Server broadcasts `TEAM_HOME_PICKED`; `App.tsx` propagates via `homePickedTeam` prop        |
| Full-size badge Vite imports     | Frontend (client)        | —              | `FULL_BADGE_MAP` static imports in `TeamSelectionScreen.tsx` — client-only                  |
| Test updates                     | Shared + Frontend        | —              | `teamConfig.test.ts` count assertions; `TeamSelectionScreen.test.tsx` card-count assertions |

---

<phase_requirements>

## Phase Requirements

| ID        | Description                                                                                 | Research Support                                                                                                                                     |
| --------- | ------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| TEAM-08   | New MLS team #1 (Miami) — palette, badge, default uniform style, squad from player pool     | `COLOR_SCHEME_REGISTRY.miami` already defined; badge `miami.png`; players `sourceTeamId='inter-miami'` (p069–p079) [VERIFIED]                        |
| TEAM-09   | New MLS team #2 (LA) — palette, badge, default uniform style, squad from player pool        | `COLOR_SCHEME_REGISTRY.la` already defined; badge `la.png`; players `sourceTeamId='lafc'` (p080–p090) [VERIFIED]                                     |
| TEAM-10   | New MLS team #3 (Nashville) — palette, badge, default uniform style, squad from player pool | `COLOR_SCHEME_REGISTRY.nashville` already defined; badge `nashville.png`; players `sourceTeamId='nashville'` (p091–p101)                             |
| TEAM-11   | New MLS team #4 (Seattle) — palette, badge, default uniform style, squad from player pool   | `COLOR_SCHEME_REGISTRY.seattle` defined; badge `seatle.png` (typo in filename); players `sourceTeamId='seattle'` (p102–p112)                         |
| INTL-01   | International team #1 (Canada) — palette, badge, default uniform style, squad seeded        | `COLOR_SCHEME_REGISTRY.canada` defined; badge `canada.png`; players `sourceTeamId='canada'` in PLAYER_POOL                                           |
| INTL-02   | International team #2 (England) — palette, badge, default uniform style, squad seeded       | `COLOR_SCHEME_REGISTRY.england` defined; badge `england.png`; players `sourceTeamId='england'` in PLAYER_POOL                                        |
| INTL-03   | International team #3 (France) — palette, badge, default uniform style, squad seeded        | `COLOR_SCHEME_REGISTRY.france` defined; badge `france.png`; players `sourceTeamId='france'` in PLAYER_POOL                                           |
| INTL-04   | International team #4 (Mexico) — palette, badge, default uniform style, squad seeded        | `COLOR_SCHEME_REGISTRY.mexico` defined; badge `mexico.png`; players `sourceTeamId='mexico'` in PLAYER_POOL                                           |
| INTL-05   | International team #5 (Spain) — palette, badge, default uniform style, squad seeded         | `COLOR_SCHEME_REGISTRY.spain` defined; badge `spain.png`; players `sourceTeamId='spain'` in PLAYER_POOL                                              |
| INTL-06   | International team #6 (USA) — palette, badge, default uniform style, squad seeded           | `COLOR_SCHEME_REGISTRY.us` defined; badge `us.png`; players `sourceTeamId='usmnt'` in PLAYER_POOL                                                    |
| LEAGUE-01 | Team selection screen shows MLS and International tabs; MLS default                         | Requires tab state in `TeamSelectionScreen`; flat `ALL_TEAMS` array replaced with per-league filtered arrays                                         |
| LEAGUE-02 | Struck-out card visible on all tabs in both players' views simultaneously                   | `TEAM_HOME_PICKED` socket event already broadcasts to all room members; `homePickedTeam` already flows via App.tsx prop — no server changes required |

</phase_requirements>

---

## Standard Stack

No new packages required for Phase 21. All work uses the existing stack. [VERIFIED: direct codebase inspection]

### Existing Infrastructure Confirmed Present

| Asset                            | Location                                         | Status                                                                                                                        |
| -------------------------------- | ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| `ColorSchemeId` union            | `packages/shared/src/teamConfig.ts` line 17      | All 10 new IDs already present: `la`, `miami`, `nashville`, `seattle`, `canada`, `england`, `france`, `mexico`, `spain`, `us` |
| `COLOR_SCHEME_REGISTRY` entries  | `packages/shared/src/teamConfig.ts` lines 77–232 | All 10 new teams fully populated with 4-color palettes and `badgeFile` references                                             |
| `TeamConfig.league` field        | `packages/shared/src/teamConfig.ts` line 65      | Present and typed `'mls' \| 'international'`                                                                                  |
| `TeamConfig.defaultUniformStyle` | `packages/shared/src/teamConfig.ts` line 70      | Present and typed `UniformStyleId`                                                                                            |
| `PLAYER_POOL` MLS players        | `packages/shared/src/teams.ts`                   | `p069`–`p112`: 44 players across 4 MLS teams (inter-miami, lafc, seattle, nashville)                                          |
| `PLAYER_POOL` national players   | `packages/shared/src/teams.ts`                   | `p113`–`p178`: 66 players across 6 national teams (usmnt, england, mexico, canada, spain, france)                             |
| Badge PNG files                  | `packages/client/src/assets/badges/`             | All 10 `{team}.png` and `{team}-full.png` files present; `seatle.png` has a typo — see Pitfall 1                              |

---

## Package Legitimacy Audit

No new packages are installed in Phase 21. All work uses existing dependencies.

**Packages removed due to SLOP verdict:** none
**Packages flagged as suspicious:** none

---

## Architecture Patterns

### System Architecture Diagram

```
PLAYER_POOL (teams.ts, auto-generated)
        |
        | sourceTeamId filter
        v
playerIds arrays ──────────────> TEAM_CONFIGS (teamConfig.ts)
                                      |  extends TeamId to 12 members
                                      v
                             COLOR_SCHEME_REGISTRY
                               (palette + badgeFile)
                                      |
                         ┌────────────┴────────────┐
                         v                         v
              TeamSelectionScreen            roomHandlers.ts
               (React client)                  (server)
                         |                         |
               Tab state (local)           VALID_TEAM_IDS
               MLS tab / Intl tab          allow-list (12 IDs)
                         |                         |
               FULL_BADGE_MAP                TEAM_HOME_PICKED
               (Vite static imports)        broadcast to room
                         |                         |
                    badge renders           App.tsx receives
                    per-tab grid             homePickedTeam
                         |                         |
                  struck-out card  <───────────────┘
                  (homePickedTeam prop)
```

### Recommended Project Structure (Phase 21 changes only)

```
packages/shared/src/
├── teamConfig.ts        # TeamId extended to 12; 10 new TEAM_CONFIGS entries added
└── (no new files)

packages/server/src/
└── roomHandlers.ts      # VALID_TEAM_IDS extended to 12

packages/client/src/
├── assets/badges/       # All assets already present
├── components/
│   ├── TeamSelectionScreen.tsx      # Tab UI refactor
│   └── TeamSelectionScreen.module.css  # Tab styles added
└── (no new files required)
```

### Pattern 1: `TeamId` Extension

`TeamId` is the union of selectable team IDs. It lives in `packages/shared/src/teamConfig.ts` and currently reads `'city' | 'crew'`.

Phase 21 must extend it to all 12 selectable teams:

```typescript
// Source: packages/shared/src/teamConfig.ts line 13 (current state)
export type TeamId =
  | 'city'
  | 'crew'
  | 'la'
  | 'miami'
  | 'nashville'
  | 'seattle'
  | 'canada'
  | 'england'
  | 'france'
  | 'mexico'
  | 'spain'
  | 'us';
```

**TypeScript enforcement:** `TEAM_CONFIGS: Record<TeamId, TeamConfig>` will fail to compile until all 12 keys are present. `VALID_TEAM_IDS: readonly TeamId[]` on the server will flag if a new team ID is missing there. This gives a clear error surface.

**Key insight:** `ColorSchemeId` is already the wider union (includes retired teams). `TeamId` is the subset of selectable teams. Adding new members to `TeamId` does NOT affect `ColorSchemeId` — they remain two distinct types by design.

### Pattern 2: `TEAM_CONFIGS` Entry Shape

Each new team entry follows the same shape as `city` and `crew`, already established in Phase 19:

```typescript
// Source: packages/shared/src/teamConfig.ts lines 236–259 (city entry pattern)
la: {
  id: 'la',
  name: 'LA',
  colorSchemeId: 'la',
  palette: COLOR_SCHEME_REGISTRY.la.palette,
  playerIds: [
    'p069', 'p070', 'p071', 'p072', 'p073',
    'p074', 'p075', 'p076', 'p077', 'p078', 'p079',
  ],
  league: 'mls',
  badgeFile: 'la.png',
  defaultUniformStyle: 'solid',  // Claude's Discretion for new teams
},
```

The `playerIds` arrays are the critical data. They are derived from `PLAYER_POOL` by `sourceTeamId` match and already assigned stable IDs by the seed script.

### Pattern 3: `playerIds` Extraction from PLAYER_POOL

The seed script (`seed-rosters.ts`) processes `mls.csv` and `national.csv` in team-appearance order within the file. The `toSlug()` function normalizes team names to sourceTeamId slugs. The ID ranges are:

| Team        | CSV name      | sourceTeamId slug | ID range                                                      |
| ----------- | ------------- | ----------------- | ------------------------------------------------------------- |
| Inter Miami | `Inter Miami` | `inter-miami`     | p069–p079 (11 players) [VERIFIED: teams.ts direct inspection] |
| LAFC        | `LAFC`        | `lafc`            | p080–p090 (11 players) [VERIFIED: teams.ts direct inspection] |
| Seattle     | `Seattle`     | `seattle`         | p091–p101 (11 players) [VERIFIED: teams.ts direct inspection] |
| Nashville   | `Nashville`   | `nashville`       | p102–p112 (11 players) [VERIFIED: teams.ts direct inspection] |
| USMNT       | `USMNT`       | `usmnt`           | p113–p123 (11 players) [VERIFIED: teams.ts direct inspection] |
| England     | `England`     | `england`         | p124–p134 (11 players) [VERIFIED: teams.ts direct inspection] |
| Mexico      | `Mexico`      | `mexico`          | p135–p145 (11 players) [VERIFIED: teams.ts direct inspection] |
| Canada      | `Canada`      | `canada`          | p146–p156 (11 players) [VERIFIED: teams.ts direct inspection] |
| Spain       | `Spain`       | `spain`           | p157–p167 (11 players) [VERIFIED: teams.ts direct inspection] |
| France      | `France`      | `france`          | p168–p178 (11 players) [VERIFIED: teams.ts direct inspection] |

**IMPORTANT:** These ID ranges are DERIVED from the seed script processing order. The seed script processes `mls.csv` teams in first-appearance order within that file (Inter Miami first, then LAFC, then Seattle, then Nashville). The national teams follow: USMNT first, then England, Mexico, Canada, Spain, France. The actual assigned IDs must be verified by inspecting `teams.ts` directly — the ranges above match the current committed file (178 players total: p001–p178 as stated in the seed script comment).

**All ID ranges verified:** Confirmed by direct `PLAYER_POOL` inspection in this research session. The planner can hardcode these ranges without a preliminary verification step.

**TeamConfig-to-sourceTeamId mapping:**

| TeamConfig id | PLAYER_POOL sourceTeamId slug |
| ------------- | ----------------------------- |
| `miami`       | `inter-miami`                 |
| `la`          | `lafc`                        |
| `seattle`     | `seattle`                     |
| `nashville`   | `nashville`                   |
| `us`          | `usmnt`                       |
| `england`     | `england`                     |
| `mexico`      | `mexico`                      |
| `canada`      | `canada`                      |
| `spain`       | `spain`                       |
| `france`      | `france`                      |

Note the mismatch between `TeamConfig.id` (matches `ColorSchemeId`) and `sourceTeamId` slug: `miami` → `inter-miami`, `la` → `lafc`, `us` → `usmnt`. These three require attention during data authoring.

### Pattern 4: `TeamSelectionScreen` Tab UI

The current screen has `ALL_TEAMS: TeamId[]` as a flat array and a single `<div className={styles.grid}>` that maps over it. Phase 21 replaces this with a two-tab layout.

**Current structure (TeamSelectionScreen.tsx lines 21–27):**

```typescript
// Source: packages/client/src/components/TeamSelectionScreen.tsx lines 21–27
const ALL_TEAMS: TeamId[] = ['city', 'crew'];
const FULL_BADGE_MAP: Record<TeamId, string> = {
  city: cityFullBadge,
  crew: crewFullBadge,
};
```

**Phase 21 target structure:**

```typescript
// Replace ALL_TEAMS with per-league maps:
const MLS_TEAMS: TeamId[] = ['city', 'crew', 'la', 'miami', 'nashville', 'seattle'];
const INTL_TEAMS: TeamId[] = ['canada', 'england', 'france', 'mexico', 'spain', 'us'];

// Add all 10 new static Vite badge imports (full-size variants):
import laFullBadge from '../assets/badges/la-full.png';
import miamiFullBadge from '../assets/badges/miami-full.png';
// ... etc for all 10

// Extend FULL_BADGE_MAP to all 12 teams:
const FULL_BADGE_MAP: Record<TeamId, string> = {
  city: cityFullBadge,
  crew: crewFullBadge,
  la: laFullBadge,
  miami: miamiFullBadge,
  // ...
};
```

**Tab state (local React state, NOT Zustand):**

```typescript
// Tab state lives in TeamSelectionScreen — same as homePickedTeam local state pattern in App.tsx
const [activeLeague, setActiveLeague] = useState<'mls' | 'international'>('mls');

// LEAGUE-02: Auto-switch to the league containing the struck-out team
// When homePickedTeam changes and it's on the other tab, switch to that tab
// so away player sees it struck out.
useEffect(() => {
  if (homePickedTeam !== null && !iAmActive) {
    const isInMls = MLS_TEAMS.includes(homePickedTeam);
    setActiveLeague(isInMls ? 'mls' : 'international');
  }
}, [homePickedTeam, iAmActive]);

const visibleTeams = activeLeague === 'mls' ? MLS_TEAMS : INTL_TEAMS;
```

**Tab render pattern:**

```typescript
// Tab bar above the grid:
<div className={styles.tabs}>
  <button
    className={activeLeague === 'mls' ? styles.tabActive : styles.tab}
    onClick={() => setActiveLeague('mls')}
  >
    MLS
  </button>
  <button
    className={activeLeague === 'international' ? styles.tabActive : styles.tab}
    onClick={() => setActiveLeague('international')}
  >
    International
  </button>
</div>

// Grid changes from 2-col to 3-col for 6 teams per tab:
// CSS: grid-template-columns: 1fr 1fr 1fr (3×2 grid for 6 teams per tab)
```

**Critical LEAGUE-02 behavior:** The `isStruckOut` check must span ALL teams, not just the currently visible tab. A team on the MLS tab is struck out even when the International tab is active. The current `isStruckOut = teamId === homePickedTeam` logic already handles this correctly — it checks against the prop, not the visible list.

### Pattern 5: Server `VALID_TEAM_IDS` Extension

```typescript
// Source: packages/server/src/roomHandlers.ts line 40
// Current:
const VALID_TEAM_IDS: readonly TeamId[] = ['city', 'crew'] as const;

// Phase 21 target (TypeScript will enforce all 12 are valid TeamId members):
const VALID_TEAM_IDS: readonly TeamId[] = [
  'city',
  'crew',
  'la',
  'miami',
  'nashville',
  'seattle',
  'canada',
  'england',
  'france',
  'mexico',
  'spain',
  'us',
] as const;
```

TypeScript enforces correctness here: if any value is not in `TeamId`, compilation fails.

### Pattern 6: `getSquadPlayers` Works Unchanged

`getSquadPlayers(teamId: TeamId)` in `teamConfig.ts` already works correctly for any team in `TEAM_CONFIGS`. It looks up `TEAM_CONFIGS[teamId].playerIds` and resolves each ID from `PLAYER_POOL_MAP`. No changes needed to this function — only new entries in `TEAM_CONFIGS` are required.

### Anti-Patterns to Avoid

- **Inline player objects in TEAM_CONFIGS:** All 10 new teams must reference `playerIds: ['p069', ...]` (ID references), not inline `PoolPlayer` objects. This is DATA-02 and the established Phase 19 pattern.
- **Computing `primaryLight` at render time:** PALETTE-03 mandates it is authored at data-definition time. `COLOR_SCHEME_REGISTRY` already contains authored values for all 10 new teams — do not recalculate.
- **Storing `activeLeague` tab state in Zustand:** Tab state is UI-only and not game state. It belongs in `TeamSelectionScreen` local state, matching the existing `homePickedTeam` local state pattern in App.tsx.
- **Fetching badge via dynamic import or runtime path:** All badge files must use static Vite imports (`import laFullBadge from '../assets/badges/la-full.png'`). Dynamic imports would bypass Vite's content-hashing (Phase 15 D-13, Pitfall 3 prevention).
- **Using `activeLeague` to determine struck-out state:** The struck-out card must be based on `homePickedTeam` prop, not on which tab is visible. A team on the hidden tab that was picked must still show as struck out when the user switches back to that tab.

---

## Don't Hand-Roll

| Problem                                | Don't Build                    | Use Instead                                               | Why                                                                                                     |
| -------------------------------------- | ------------------------------ | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Real-time cross-player struck-out sync | Custom pub/sub or polling      | Existing `TEAM_HOME_PICKED` Socket.io event               | Already implemented in Phase 16; broadcasts to all room members via `io.to(roomCode).emit(...)`         |
| Tab-based UI navigation                | Custom router or state machine | Local `useState` for `activeLeague`                       | Two states, no routing needed; same pattern as `homePickedTeam` local state                             |
| Player pool querying                   | Custom query DSL               | `PLAYER_POOL.filter(p => p.sourceTeamId === slug)` inline | PLAYER_POOL is a 178-element array; O(n) filter is instantaneous and only needed at data-authoring time |
| Badge URL resolution                   | Runtime path construction      | Static Vite imports in `FULL_BADGE_MAP`                   | Established Phase 15 pattern; gives content-hashed URLs and build-time existence checks                 |

**Key insight:** Nearly everything needed for Phase 21 already exists. The phase is additive, not architectural.

---

## Runtime State Inventory

Phase 21 is not a rename/refactor phase in the traditional sense, but it does expand `TeamId`. Checking runtime state that holds `TeamId` values:

| Category            | Items Found                                                                      | Action Required                            |
| ------------------- | -------------------------------------------------------------------------------- | ------------------------------------------ |
| Stored data         | No persistent datastore; game state is in-memory only (no DB, no Redis)          | None                                       |
| Live service config | `VALID_TEAM_IDS` in `roomHandlers.ts` — in-process constant, not external config | Code edit only — extend array to 12 values |
| OS-registered state | None                                                                             | None                                       |
| Secrets/env vars    | None reference TeamId                                                            | None                                       |
| Build artifacts     | No compiled artifacts with TeamId embedded (TypeScript compiles fresh)           | None                                       |

---

## Common Pitfalls

### Pitfall 1: Seattle Badge Filename Typo (resolved)

The badge files were renamed from `seatle.png` / `seatle-full.png` to `seattle.png` / `seattle-full.png`, and `teamConfig.ts` `badgeFile` updated to `'seattle.png'`. Use the correct spelling in all Vite imports and registry references.

### Pitfall 2: TeamId-to-sourceTeamId slug mismatch for 3 teams

**What goes wrong:** Three teams have a `TeamId` that does not match the `sourceTeamId` slug in `PLAYER_POOL`:

- `TeamConfig.id = 'miami'` but `sourceTeamId = 'inter-miami'`
- `TeamConfig.id = 'la'` but `sourceTeamId = 'lafc'`
- `TeamConfig.id = 'us'` but `sourceTeamId = 'usmnt'`

If `playerIds` are assembled by filtering `PLAYER_POOL` by `p.sourceTeamId === teamId`, these three teams will get empty arrays.

**Why it happens:** `TeamId` is a short display slug; `sourceTeamId` is the CSV team name passed through `toSlug()`.

**How to avoid:** When assembling `playerIds`, use the correct `sourceTeamId` slug (not the `TeamId`). Use the mapping table in Pattern 3 above.

### Pitfall 3: `teamConfig.test.ts` count assertions will fail

**What goes wrong:** `teamConfig.test.ts` contains `expect(Object.keys(TEAM_CONFIGS)).toHaveLength(2)` and `expect(Object.keys(COLOR_SCHEME_REGISTRY)).toHaveLength(4)`. After Phase 21, `TEAM_CONFIGS` has 12 entries and `COLOR_SCHEME_REGISTRY` has 14.

**Why it happens:** The test was written to assert the Phase 19 transitional state (2 teams only). These are intentional regression guards that must be updated.

**How to avoid:** Update the test assertions as part of the `teamConfig.ts` expansion. The test file is `packages/shared/src/teamConfig.test.ts`.

**Specific changes needed:**

```typescript
// Line 11 — update expected ColorSchemeId array (add 10 new IDs)
const COLOR_SCHEME_IDS: ColorSchemeId[] = [
  'cosmos',
  'xolos',
  'city',
  'crew',
  'la',
  'miami',
  'nashville',
  'seattle',
  'canada',
  'england',
  'france',
  'mexico',
  'spain',
  'us',
];

// Line 14 — update count from 4 to 14
expect(Object.keys(COLOR_SCHEME_REGISTRY)).toHaveLength(14);

// Line 63 — update TeamId array
const TEAM_IDS: TeamId[] = [
  'city',
  'crew',
  'la',
  'miami',
  'nashville',
  'seattle',
  'canada',
  'england',
  'france',
  'mexico',
  'spain',
  'us',
];

// Line 67 — update count from 2 to 12
expect(Object.keys(TEAM_CONFIGS)).toHaveLength(12);

// Line 73-74 — remove (cosmos/xolos absence test no longer distinguishes anything meaningful)
// Or update to assert the full exclusion list (cosmos, xolos only)
```

### Pitfall 4: `TeamSelectionScreen.test.tsx` card-count assertions will fail

**What goes wrong:** Tests assert `expect(teamCards).toHaveLength(2)` and contain comments like `"(Phase 21 restores the full 4-team grid)"`. After Phase 21, each tab shows 6 cards; total in DOM is 12 (but only 6 visible at once).

**How to avoid:** Update tests to check per-tab card counts. The test structure should render with `activeLeague` set (or verify tab switching behavior directly). The test file is `packages/client/src/components/TeamSelectionScreen.test.tsx`.

### Pitfall 5: Tab auto-switch for LEAGUE-02 must not fire on home player's own pick

**What goes wrong:** If tab auto-switch fires when `homePickedTeam` changes AND the current player is home, the home player's view jumps to the away tab unexpectedly after they pick, preventing them from confirming or seeing their own pick.

**Why it happens:** The `useEffect` watching `homePickedTeam` fires for both players.

**How to avoid:** The auto-switch should only fire when `!iAmActive` (it's the away player's turn to pick) AND the just-picked team is on the non-current tab. The home player's view after picking should remain stable; only the away player's view should jump.

### Pitfall 6: 3-column grid requires CSS update

**What goes wrong:** Current `TeamSelectionScreen.module.css` uses `grid-template-columns: 1fr 1fr` (2 columns for 2 teams). With 6 teams per tab, a 2×3 grid is needed.

**How to avoid:** Update `.grid` in `TeamSelectionScreen.module.css` to `grid-template-columns: 1fr 1fr 1fr`. Badge size should decrease from `110×110` to `80×80` or `70×70` to fit 3 per row without overflow.

---

## Code Examples

### Verified Patterns from Codebase

#### Extending `TEAM_CONFIGS` (new entry shape)

```typescript
// Source: packages/shared/src/teamConfig.ts lines 236–259 (city entry — exact pattern)
la: {
  id: 'la',
  name: 'LA',
  colorSchemeId: 'la',
  palette: COLOR_SCHEME_REGISTRY.la.palette,
  playerIds: ['p080', 'p081', 'p082', 'p083', 'p084', 'p085', 'p086', 'p087', 'p088', 'p089', 'p090'], // lafc: p080-p090 [VERIFIED]
  league: 'mls',
  badgeFile: 'la.png',
  defaultUniformStyle: 'solid',
},
```

Note: `playerIds` for LAFC must be verified against actual `PLAYER_POOL` contents — the ranges above are derived from the seed script processing order but must be confirmed by direct inspection of `teams.ts`.

#### Tab State and Auto-Switch Pattern

```typescript
// Source: React useState + useEffect (standard React patterns, verified in codebase)
// App.tsx line 22 shows the co-located local state pattern for homePickedTeam:
const [homePickedTeam, setHomePickedTeam] = useState<TeamId | null>(null);

// TeamSelectionScreen adds:
const [activeLeague, setActiveLeague] = useState<'mls' | 'international'>('mls');

useEffect(() => {
  if (homePickedTeam !== null && !iAmActive) {
    const isInMls = MLS_TEAMS.includes(homePickedTeam);
    setActiveLeague(isInMls ? 'mls' : 'international');
  }
}, [homePickedTeam, iAmActive]);
```

#### FULL_BADGE_MAP with 12 Vite Static Imports

```typescript
// Source: packages/client/src/components/TeamSelectionScreen.tsx lines 17–27 (existing pattern)
import cityFullBadge from '../assets/badges/city-full.png';
import crewFullBadge from '../assets/badges/crew-full.png';
// Phase 21 additions — 10 new imports:
import laFullBadge from '../assets/badges/la-full.png';
import miamiFullBadge from '../assets/badges/miami-full.png';
import nashvilleFullBadge from '../assets/badges/nashville-full.png';
import seattleFullBadge from '../assets/badges/seattle-full.png';
import canadaFullBadge from '../assets/badges/canada-full.png';
import englandFullBadge from '../assets/badges/england-full.png';
import franceFullBadge from '../assets/badges/france-full.png';
import mexicoFullBadge from '../assets/badges/mexico-full.png';
import spainFullBadge from '../assets/badges/spain-full.png';
import usFullBadge from '../assets/badges/us-full.png';
```

#### Server VALID_TEAM_IDS (roomHandlers.ts pattern)

```typescript
// Source: packages/server/src/roomHandlers.ts line 40
const VALID_TEAM_IDS: readonly TeamId[] = [
  'city',
  'crew',
  'la',
  'miami',
  'nashville',
  'seattle',
  'canada',
  'england',
  'france',
  'mexico',
  'spain',
  'us',
] as const;
```

---

## Pre-Work Already Completed (Uncommitted)

The following work is already done in the working tree and should be treated as the starting point — not as tasks to complete:

| Item                                                    | File                                 | Status               |
| ------------------------------------------------------- | ------------------------------------ | -------------------- |
| `ColorSchemeId` extended with 10 new IDs                | `packages/shared/src/teamConfig.ts`  | Done (uncommitted)   |
| `COLOR_SCHEME_REGISTRY` entries for all 10 new teams    | `packages/shared/src/teamConfig.ts`  | Done (uncommitted)   |
| `TeamConfig.league` field                               | `packages/shared/src/teamConfig.ts`  | Done (from Phase 19) |
| `TeamConfig.defaultUniformStyle` field                  | `packages/shared/src/teamConfig.ts`  | Done (from Phase 20) |
| All 10 `{team}.png` and `{team}-full.png` badge files   | `packages/client/src/assets/badges/` | Done (uncommitted)   |
| `PLAYER_POOL` with 178 players including MLS + national | `packages/shared/src/teams.ts`       | Done (from Phase 19) |

**What Phase 21 must still complete:**

1. `TeamId` extended to 12 members (`packages/shared/src/teamConfig.ts`)
2. `TEAM_CONFIGS` entries added for 10 new teams with correct `playerIds`, `league`, and `defaultUniformStyle` (`packages/shared/src/teamConfig.ts`)
3. `VALID_TEAM_IDS` extended to 12 on server (`packages/server/src/roomHandlers.ts`)
4. `TeamSelectionScreen` refactored to two-tab layout with 10 new Vite badge imports (`packages/client/src/components/TeamSelectionScreen.tsx`, `.module.css`)
5. Tests updated: `teamConfig.test.ts` count assertions; `TeamSelectionScreen.test.tsx` card-count and behavior tests

---

## CSV Consolidation Pending Todo Assessment

The `csv-consolidation-player-pool.md` todo proposes merging all 7 CSV files into a single `player-pool.csv`. This is **NOT a prerequisite for Phase 21** and should NOT be included in Phase 21's scope.

Reasons:

- The seed script already handles multi-team CSVs via `toSlug()` — the pattern that would power consolidation is already implemented
- Player IDs are already stable and assigned (`p001`–`p178`); consolidating CSVs would require re-running the seed script and potentially reassigning IDs, which would break `TEAM_CONFIGS.playerIds` arrays
- The todo is tagged `priority: low` and `phase_context: post-19` (it was already deferred once)
- Phase 21's squad seeding works by hardcoding the already-stable IDs from `PLAYER_POOL` — no CSV re-read is needed

**Recommendation:** Defer the CSV consolidation to Phase 24 (Auto-Assignment) or a standalone quick task after Phase 21 completes, as stated in the todo itself.

---

## State of the Art

| Old Approach                                  | Current Approach                          | When Changed | Impact                                            |
| --------------------------------------------- | ----------------------------------------- | ------------ | ------------------------------------------------- |
| Flat `ALL_TEAMS` array, no league grouping    | Two-tab `MLS_TEAMS` / `INTL_TEAMS` arrays | Phase 21     | Requires tab state + CSS 3-col grid update        |
| `TEAM_CONFIGS` has 2 entries (`city`, `crew`) | 12 entries                                | Phase 21     | Test count assertions must update                 |
| `VALID_TEAM_IDS` has 2 members                | 12 members                                | Phase 21     | Server allows all 12 team picks                   |
| `TeamId = 'city' \| 'crew'`                   | 12-member union                           | Phase 21     | TypeScript compilation gate enforces completeness |

**Deprecated/outdated after Phase 21:**

- `// Phase 21 restores the full 4-team grid` comments in `TeamSelectionScreen.tsx` and `.test.tsx` — these are from the Phase 19 transitional state and should be removed
- `// PLAY-03: transitional 2-team state (Phase 19)` comment on the `ALL_TEAMS` constant

---

## Assumptions Log

| #   | Claim                                                                                       | Section   | Risk if Wrong                                                  |
| --- | ------------------------------------------------------------------------------------------- | --------- | -------------------------------------------------------------- |
| A1  | `defaultUniformStyle` for all 10 new teams should be `'solid'` (the simplest neutral style) | Pattern 2 | Visual appearance only — easy to change; not a functional risk |

All player ID range claims (previously A1–A3) have been verified by direct `PLAYER_POOL` inspection:

- `inter-miami`: p069–p079, `lafc`: p080–p090, `seattle`: p091–p101, `nashville`: p102–p112
- `usmnt`: p113–p123, `england`: p124–p134, `mexico`: p135–p145, `canada`: p146–p156, `spain`: p157–p167, `france`: p168–p178

**If this table is near-empty:** Player ID ranges were verified in this research session via Node.js script against `teams.ts`. The only remaining assumption is A1 (defaultUniformStyle choice).

---

## Open Questions

1. **What `defaultUniformStyle` should each of the 10 new teams get?**
   - What we know: Any of the 12 `UniformStyleId` values is valid; `solid` is the simplest and most neutral
   - What's unclear: Whether there are visual/cultural preferences (e.g., France might want `diagonal` like their kit)
   - Recommendation: Default all 10 to `'solid'` in Wave 1; the planner can leave a note that the user may want to specify styles. These can be updated trivially later without any architectural impact.

2. **Should the tab state be initialized to MLS or auto-detect based on `playerSlot`?**
   - What we know: FEATURES.md says "Default tab = MLS" (HIGH confidence finding)
   - What's unclear: Whether away player's tab should also default to MLS or track home player
   - Recommendation: Both players default to MLS tab. The auto-switch logic (Pattern 4) handles the case where home picks from MLS and away needs to see the struck-out card.

3. **Should the struck-out card show a visual "taken" indicator on the inactive tab label?**
   - What we know: FEATURES.md documents "Option B: show a small 'taken' badge on the tab label itself ('MLS (1 taken)')" as optional enhancement
   - What's unclear: Whether the auto-switch (Option A) is sufficient or if the tab badge adds clarity
   - Recommendation: Implement Option A (auto-switch) only. Option B adds complexity; evaluate post-playtesting.

---

## Environment Availability

Step 2.6: SKIPPED (no external dependencies — Phase 21 is purely code/data/config changes using existing installed packages).

---

## Validation Architecture

### Test Framework

| Property           | Value                                                                                                                                  |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| Framework          | Vitest (shared + client)                                                                                                               |
| Config file        | `packages/shared/vitest.config.ts`, `packages/client/vitest.config.ts`                                                                 |
| Quick run command  | `pnpm --filter @counter-attack/shared test run` (shared tests only)                                                                    |
| Full suite command | `pnpm -w test:run` (if configured) or `pnpm --filter @counter-attack/shared test run && pnpm --filter @counter-attack/client test run` |

### Phase Requirements → Test Map

| Req ID                    | Behavior                                                                           | Test Type | Automated Command                                                              | File Exists?                         |
| ------------------------- | ---------------------------------------------------------------------------------- | --------- | ------------------------------------------------------------------------------ | ------------------------------------ |
| TEAM-08..11 + INTL-01..06 | 12 TEAM_CONFIGS entries exist, each has 11 playerIds resolving to valid players    | unit      | `pnpm --filter @counter-attack/shared test run` (teamConfig.test.ts)           | ✅ needs assertion updates           |
| LEAGUE-01                 | Two-tab UI renders 6 MLS teams on MLS tab, 6 international on International tab    | unit      | `pnpm --filter @counter-attack/client test run` (TeamSelectionScreen.test.tsx) | ✅ needs assertion updates           |
| LEAGUE-02                 | Struck-out card visible regardless of active tab; away sees home pick in both tabs | unit      | `pnpm --filter @counter-attack/client test run` (TeamSelectionScreen.test.tsx) | ✅ new test cases needed             |
| DATA-02 (getSquadPlayers) | `getSquadPlayers` returns 11 players for each of 12 teams                          | unit      | `pnpm --filter @counter-attack/shared test run` (teamConfig.test.ts)           | ✅ needs extension to cover 12 teams |

### Sampling Rate

- **Per task commit:** `pnpm --filter @counter-attack/shared test run` (fast, catches shared type errors)
- **Per wave merge:** Both shared and client test suites
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- New test cases in `TeamSelectionScreen.test.tsx` for tab switching and cross-tab struck-out behavior (LEAGUE-01, LEAGUE-02) — these behaviors do not exist yet and require new test scenarios
- `teamConfig.test.ts` needs extended `it.each` arrays for 12 teams (update existing arrays)

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category         | Applies | Standard Control                                                                               |
| --------------------- | ------- | ---------------------------------------------------------------------------------------------- |
| V2 Authentication     | no      | —                                                                                              |
| V3 Session Management | no      | —                                                                                              |
| V4 Access Control     | no      | —                                                                                              |
| V5 Input Validation   | yes     | `VALID_TEAM_IDS` allow-list in `roomHandlers.ts` — already implemented, must be extended to 12 |
| V6 Cryptography       | no      | —                                                                                              |

**V5 note:** The `VALID_TEAM_IDS` allow-list is the only security-relevant change. It must include all 12 team IDs. TypeScript's `readonly TeamId[]` type will cause a compile error if any string in the array is not a valid `TeamId`, providing build-time safety.

### Known Threat Patterns

| Pattern                                 | STRIDE    | Standard Mitigation                                                                        |
| --------------------------------------- | --------- | ------------------------------------------------------------------------------------------ |
| Client-supplied team ID not in registry | Tampering | `VALID_TEAM_IDS` allow-list check at line 181 of `roomHandlers.ts` — extend to 12 values   |
| Client picking same team as home player | Tampering | `teamId === room.homePickedTeam` check at line 204 of `roomHandlers.ts` — no change needed |

---

## Sources

### Primary (HIGH confidence)

- Direct codebase inspection: `packages/shared/src/teamConfig.ts` — ColorSchemeId union, COLOR_SCHEME_REGISTRY, TeamConfig shape, TEAM_CONFIGS
- Direct codebase inspection: `packages/shared/src/teams.ts` — PLAYER_POOL contents, sourceTeamId slugs, ID ranges
- Direct codebase inspection: `packages/shared/scripts/seed-rosters.ts` — ID assignment order, toSlug() function
- Direct codebase inspection: `packages/client/src/components/TeamSelectionScreen.tsx` — current component structure
- Direct codebase inspection: `packages/server/src/roomHandlers.ts` — VALID_TEAM_IDS, TEAM_PICK handler
- Direct codebase inspection: `packages/client/src/assets/badges/` — badge file inventory including `seatle.png` typo
- Direct codebase inspection: `.planning/research/FEATURES.md` — tab UX design decisions (HIGH confidence)
- Direct codebase inspection: `.planning/phases/19-data-model-team-palette/19-PATTERNS.md` — Phase 19 patterns
- Direct codebase inspection: `.planning/phases/20-uniform-style-system/20-PATTERNS.md` — Phase 20 patterns

### Secondary (MEDIUM confidence)

- `.planning/REQUIREMENTS.md` — requirement text and traceability table
- `.planning/ROADMAP.md` — phase dependencies and success criteria
- `.planning/todos/pending/csv-consolidation-player-pool.md` — deferred todo assessment

---

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — no new packages; all infrastructure already present
- Architecture: HIGH — all patterns verified directly in codebase
- PlayerIds ranges: MEDIUM — derived from seed script logic and CSV file ordering; must be confirmed by direct inspection of `teams.ts` before hardcoding
- Pitfalls: HIGH — seatle typo, TeamId/sourceTeamId mismatch, and test count assertions are all concretely verified in source

**Research date:** 2026-07-04
**Valid until:** Stable — no external dependencies or time-sensitive content
