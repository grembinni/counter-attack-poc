# Phase 21: New Teams (MLS + International) - Pattern Map

**Mapped:** 2026-07-04
**Files analyzed:** 6 (4 modified source files + 2 test files)
**Analogs found:** 6 / 6

---

## File Classification

| New/Modified File                                               | Role              | Data Flow                            | Closest Analog                                         | Match Quality |
| --------------------------------------------------------------- | ----------------- | ------------------------------------ | ------------------------------------------------------ | ------------- |
| `packages/shared/src/teamConfig.ts`                             | model             | CRUD (data extension)                | itself — `city`/`crew` entries as the pattern          | exact         |
| `packages/server/src/roomHandlers.ts`                           | middleware/config | request-response (allow-list)        | itself — `VALID_TEAM_IDS` constant at line 40          | exact         |
| `packages/client/src/components/TeamSelectionScreen.tsx`        | component         | event-driven (tab state + prop flow) | itself — existing flat-grid structure to be refactored | role-match    |
| `packages/client/src/components/TeamSelectionScreen.module.css` | config (styles)   | —                                    | itself — `.grid`, `.card`, `.speedOption` patterns     | exact         |
| `packages/shared/src/teamConfig.test.ts`                        | test              | —                                    | itself — `it.each` arrays and count assertions         | exact         |
| `packages/client/src/components/TeamSelectionScreen.test.tsx`   | test              | —                                    | itself — `describe`/`render`/`screen` pattern          | exact         |

---

## Pattern Assignments

### `packages/shared/src/teamConfig.ts` (model, data extension)

**Analog:** Itself — the existing `city` and `crew` entries in `TEAM_CONFIGS`.

**Step 1 — Extend `TeamId` union** (line 13, currently `'city' | 'crew'`):

```typescript
// Source: packages/shared/src/teamConfig.ts line 13 (target state)
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

TypeScript enforcement: `TEAM_CONFIGS: Record<TeamId, TeamConfig>` will fail to compile until all 12 keys are present. `ColorSchemeId` (lines 17–31) already contains all 14 values — do NOT modify it.

**Step 2 — New `TEAM_CONFIGS` entry shape** (copy from `city` entry, lines 237–259):

```typescript
// Source: packages/shared/src/teamConfig.ts lines 237–259 (city entry — canonical pattern)
city: {
  id: 'city',
  name: 'City',
  colorSchemeId: 'city',
  palette: COLOR_SCHEME_REGISTRY.city.palette,
  playerIds: [
    'p023', 'p024', 'p025', 'p026', 'p027',
    'p028', 'p029', 'p030', 'p031', 'p032', 'p033',
  ],
  league: 'mls',
  badgeFile: 'city.png',
  defaultUniformStyle: 'pinstripe',
},
```

**All 10 new entries to add** (field values per CONTEXT.md D-01..D-17):

| TeamId      | name          | colorSchemeId | playerIds     | league            | badgeFile         | defaultUniformStyle |
| ----------- | ------------- | ------------- | ------------- | ----------------- | ----------------- | ------------------- |
| `miami`     | `'Miami'`     | `'miami'`     | `p069`–`p079` | `'mls'`           | `'miami.png'`     | `'fade'`            |
| `la`        | `'LA'`        | `'la'`        | `p080`–`p090` | `'mls'`           | `'la.png'`        | `'checker'`         |
| `nashville` | `'Nashville'` | `'nashville'` | `p091`–`p101` | `'mls'`           | `'nashville.png'` | `'corners'`         |
| `seattle`   | `'Seattle'`   | `'seattle'`   | `p102`–`p112` | `'mls'`           | `'seattle.png'`   | `'v-stripe'`        |
| `canada`    | `'Canada'`    | `'canada'`    | `p146`–`p156` | `'international'` | `'canada.png'`    | `'cosmos'`          |
| `england`   | `'England'`   | `'england'`   | `p124`–`p134` | `'international'` | `'england.png'`   | `'solid'`           |
| `france`    | `'France'`    | `'france'`    | `p168`–`p178` | `'international'` | `'france.png'`    | `'quarters'`        |
| `mexico`    | `'Mexico'`    | `'mexico'`    | `p135`–`p145` | `'international'` | `'mexico.png'`    | `'tree-rings'`      |
| `spain`     | `'Spain'`     | `'spain'`     | `p157`–`p167` | `'international'` | `'spain.png'`     | `'plus'`            |
| `us`        | `'USA'`       | `'us'`        | `p113`–`p123` | `'international'` | `'us.png'`        | `'polka-dots'`      |

**Critical ID mismatches** — `TeamId` does NOT match `sourceTeamId` slug for 3 teams:

- `miami` → sourceTeamId is `inter-miami` → playerIds `p069`–`p079`
- `la` → sourceTeamId is `lafc` → playerIds `p080`–`p090`
- `us` → sourceTeamId is `usmnt` → playerIds `p113`–`p123`

**playerIds array format** (copy the spacing style from `city`):

```typescript
playerIds: [
  'p069', 'p070', 'p071', 'p072', 'p073',
  'p074', 'p075', 'p076', 'p077', 'p078', 'p079',
],
```

**Note on ordering within TEAM_CONFIGS:** Add entries in the order MLS then International; within MLS, originals first (`city`, `crew`), then new MLS teams; then international teams alphabetically. This mirrors the D-11/D-12 tab ordering.

---

### `packages/server/src/roomHandlers.ts` (middleware/config, allow-list)

**Analog:** Itself — `VALID_TEAM_IDS` at line 40.

**Current** (line 40):

```typescript
// Source: packages/server/src/roomHandlers.ts line 40
const VALID_TEAM_IDS: readonly TeamId[] = ['city', 'crew'] as const;
```

**Target** (extend to 12 — TypeScript enforces all values are valid `TeamId` members):

```typescript
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

No other changes to `roomHandlers.ts`. The `teamId === room.homePickedTeam` struck-out check at line 204 works for all 12 teams without modification.

---

### `packages/client/src/components/TeamSelectionScreen.tsx` (component, event-driven)

**Analog:** Itself — existing flat-grid structure plus React `useState`/`useEffect` conventions already visible in the file.

**Step 1 — Replace static badge imports** (lines 17–18, add 10 more):

```typescript
// Source: packages/client/src/components/TeamSelectionScreen.tsx lines 17–18 (existing)
import cityFullBadge from '../assets/badges/city-full.png';
import crewFullBadge from '../assets/badges/crew-full.png';
// Phase 21 additions — 10 new static Vite imports (content-hashed at build time):
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

**Badge filename spelling:** Use `seattle-full.png` (the typo `seatle` has been corrected in the assets directory and `teamConfig.ts`).

**Step 2 — Replace `ALL_TEAMS` with per-league arrays** (lines 21–27):

```typescript
// REMOVE:
// const ALL_TEAMS: TeamId[] = ['city', 'crew'];

// ADD (D-11, D-12):
const MLS_TEAMS: TeamId[] = ['city', 'crew', 'la', 'miami', 'nashville', 'seattle'];
const INTL_TEAMS: TeamId[] = ['canada', 'england', 'france', 'mexico', 'spain', 'us'];
```

**Step 3 — Extend `FULL_BADGE_MAP`** (lines 24–27):

```typescript
// Source: packages/client/src/components/TeamSelectionScreen.tsx lines 24–27 (existing pattern)
const FULL_BADGE_MAP: Record<TeamId, string> = {
  city: cityFullBadge,
  crew: crewFullBadge,
  // Phase 21 additions:
  la: laFullBadge,
  miami: miamiFullBadge,
  nashville: nashvilleFullBadge,
  seattle: seattleFullBadge,
  canada: canadaFullBadge,
  england: englandFullBadge,
  france: franceFullBadge,
  mexico: mexicoFullBadge,
  spain: spainFullBadge,
  us: usFullBadge,
};
```

**Step 4 — Add tab state inside the component** (after `iAmActive` computation, before return):

```typescript
// Tab state is LOCAL React state — NOT Zustand (D-14 decision).
// Same pattern as homePickedTeam local state in App.tsx.
const [activeLeague, setActiveLeague] = useState<'mls' | 'international'>('mls');

// LEAGUE-02: Auto-switch only fires for the away player when home picks a team.
// Guard by !iAmActive to prevent home player's tab jumping after their own pick (Pitfall 5).
useEffect(() => {
  if (homePickedTeam !== null && !iAmActive) {
    const isInMls = MLS_TEAMS.includes(homePickedTeam);
    setActiveLeague(isInMls ? 'mls' : 'international');
  }
}, [homePickedTeam, iAmActive]);

const visibleTeams = activeLeague === 'mls' ? MLS_TEAMS : INTL_TEAMS;
```

**Step 5 — Add tab bar to JSX** (inside `<div className={styles.screen}>`, before the grid):

```tsx
{
  /* LEAGUE-01: Tab bar — MLS default (D-13); tab state is local React useState */
}
<div className={styles.tabs}>
  <button
    role="tab"
    aria-selected={activeLeague === 'mls'}
    className={activeLeague === 'mls' ? styles.tabActive : styles.tab}
    onClick={() => setActiveLeague('mls')}
  >
    MLS
  </button>
  <button
    role="tab"
    aria-selected={activeLeague === 'international'}
    className={activeLeague === 'international' ? styles.tabActive : styles.tab}
    onClick={() => setActiveLeague('international')}
  >
    International
  </button>
</div>;
```

**Step 6 — Replace `ALL_TEAMS.map(...)` with `visibleTeams.map(...)`** (line 110):

```tsx
// REMOVE: {ALL_TEAMS.map((teamId) => {
// ADD:
{visibleTeams.map((teamId) => {
  const isStruckOut = teamId === homePickedTeam; // checks ALL teams, not just visible tab
  const isDisabled = !iAmActive || isStruckOut;
  // ...rest of card JSX unchanged
```

**Step 7 — Update badge inline size** from `110` to `80` (two occurrences in the `<span>` and `<img>`):

```tsx
// Source: packages/client/src/components/TeamSelectionScreen.tsx lines 127–140
// Change width/height from 110 to 80 throughout (Pitfall 6 — 3-col grid needs smaller badges)
<span style={{ display: 'inline-flex', width: 80, height: 80, ... }}>
  <img src={FULL_BADGE_MAP[teamId]} alt={...} width={80} height={80} ... />
</span>
```

**Step 8 — Remove transitional comments:**

- Remove `// PLAY-03: transitional 2-team state (Phase 19); Phase 21 restores the full 4-team grid.` (line 20)
- Remove `// Phase 21 restores the full 4-team grid` (line 7 in JSDoc)
- Remove `// D-04 (Phase 19): cosmos/xolos removed from TeamId; Phase 21 will re-expand the team grid.` (line 16)

**Required imports to add** at top of file:

```typescript
import { useState, useEffect } from 'react';
```

(Check whether these are already imported — the current file does not show a React import block because it uses JSX transform, but `useState`/`useEffect` must be explicitly imported.)

---

### `packages/client/src/components/TeamSelectionScreen.module.css` (styles)

**Analog:** Itself — existing `.grid`, `.card`, `.speedOption` patterns.

**Change 1 — Update `.grid` from 2-col to 3-col** (lines 36–42):

```css
/* Source: TeamSelectionScreen.module.css lines 36–42 (current — 2 columns) */
.grid {
  display: grid;
  grid-template-columns: 1fr 1fr; /* CHANGE to: 1fr 1fr 1fr */
  gap: 16px;
  max-width: 480px; /* CHANGE to: 720px (3×3 layout needs more room) */
  width: 100%;
}
```

**Change 2 — Add tab styles** (new classes, follow `.speedOption` / `.speedOptionActive` conventions for button styling):

```css
/* LEAGUE-01: Tab bar — two-tab navigation above the grid */
.tabs {
  display: flex;
  flex-direction: row;
  gap: 0;
  border-bottom: 2px solid #2a2a4a;
  max-width: 720px;
  width: 100%;
}

/* Inactive tab button */
.tab {
  font-size: 13px;
  font-weight: 400;
  color: #a0a0a0;
  background: transparent;
  border: none;
  border-bottom: 2px solid transparent;
  padding: 8px 20px;
  cursor: pointer;
  transition:
    color 0.15s ease,
    border-color 0.15s ease;
  margin-bottom: -2px; /* overlap the container border */
}

.tab:hover {
  color: #e0e0e0;
}

/* Active/selected tab */
.tabActive {
  font-size: 13px;
  font-weight: 700;
  color: #e0e0e0;
  background: transparent;
  border: none;
  border-bottom: 2px solid #e0e0e0;
  padding: 8px 20px;
  cursor: default;
  margin-bottom: -2px;
}
```

**Note:** The UI-SPEC at `.planning/phases/21-new-teams-mls-international/21-UI-SPEC.md` contains authoritative CSS values. If the UI-SPEC conflicts with the values above, the UI-SPEC takes precedence. Read the UI-SPEC before implementing CSS.

---

### `packages/shared/src/teamConfig.test.ts` (test, data model)

**Analog:** Itself — existing `describe`/`it.each` structure.

**Change 1 — Update `COLOR_SCHEME_IDS` array** (line 10, add 10 new IDs):

```typescript
// Source: packages/shared/src/teamConfig.test.ts line 10 (current — 4 IDs)
const COLOR_SCHEME_IDS: ColorSchemeId[] = ['cosmos', 'xolos', 'city', 'crew'];

// Target — 14 IDs:
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
```

**Change 2 — Update count assertion** (line 13):

```typescript
// CHANGE: expect(Object.keys(COLOR_SCHEME_REGISTRY)).toHaveLength(4);
// TO:
expect(Object.keys(COLOR_SCHEME_REGISTRY)).toHaveLength(14);
```

**Change 3 — Update `TEAM_IDS` array** (line 62):

```typescript
// Source: packages/shared/src/teamConfig.test.ts line 62 (current — 2 IDs)
const TEAM_IDS: TeamId[] = ['city', 'crew'];

// Target — 12 IDs:
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
```

**Change 4 — Update TEAM_CONFIGS count assertion** (line 64):

```typescript
// CHANGE: expect(Object.keys(TEAM_CONFIGS)).toHaveLength(2);
// TO:
expect(Object.keys(TEAM_CONFIGS)).toHaveLength(12);
```

**Change 5 — Update the "does NOT contain cosmos or xolos" test** (line 72–75):
This test stays valid as-is — `cosmos` and `xolos` remain absent from `TEAM_CONFIGS`. No change needed.

**Change 6 — Extend `getSquadPlayers` tests** (lines 118–149):
Add `it.each` over all 12 team IDs for the squad length check:

```typescript
// Source: packages/shared/src/teamConfig.test.ts lines 118–125 (current — 2 explicit tests)
// Replace with it.each over all 12:
it.each(TEAM_IDS)('getSquadPlayers(%s) returns exactly 11 players', (teamId) => {
  expect(getSquadPlayers(teamId)).toHaveLength(11);
});
```

Keep the existing "each returned player has all required PoolPlayer fields" test (lines 126–141) — it tests `city` which remains valid. Optionally extend to a second team (e.g., `canada`) to cover the international path.

---

### `packages/client/src/components/TeamSelectionScreen.test.tsx` (test, component)

**Analog:** Itself — existing `render`/`screen`/`userEvent` pattern.

**Change 1 — Update card-count assertions** (lines 43, 61, 75):

```typescript
// Source: TeamSelectionScreen.test.tsx line 35 (test description to update)
// CHANGE description: 'renders exactly 2 team cards (city, crew)'
// TO: 'renders exactly 6 team cards on the default MLS tab'

// CHANGE assertion (line 43):
// expect(teamCards).toHaveLength(2);
// TO (MLS tab has 6 cards):
expect(teamCards).toHaveLength(6);
```

**Change 2 — Update "all cards enabled for home player" test** (line 61):

```typescript
// expect(teamCards).toHaveLength(2);  →  expect(teamCards).toHaveLength(6);
// The for loop checking !disabled is unchanged.
```

**Change 3 — Update "all cards disabled for away player" test** (line 75):

```typescript
// expect(teamCards).toHaveLength(2);  →  expect(teamCards).toHaveLength(6);
```

**Change 4 — Update "struck-out city" test** (lines 94–111):
After phase 21, clicking "Away: crew remains active" requires the home pick to be a team on the same tab:

```typescript
// Away player view after home picked 'city' (MLS tab — city struck out, 5 enabled)
render(<TeamSelectionScreen homePickedTeam="city" onPick={vi.fn()} {...DEFAULT_SPEED_PROPS} />);
// expect 1 disabled, 5 enabled (on MLS tab) — not 1 disabled, 1 enabled
expect(disabledCards).toHaveLength(1);
expect(enabledCards).toHaveLength(5);
```

**Change 5 — Add new tab-behavior tests** (new `describe` blocks):

```typescript
// Pattern: use the existing render + screen.getByRole approach
describe('TeamSelectionScreen — LEAGUE-01: two-tab layout', () => {
  it('renders MLS tab as active by default', () => {
    useGameStore.setState({ playerSlot: 1 });
    render(<TeamSelectionScreen homePickedTeam={null} onPick={vi.fn()} {...DEFAULT_SPEED_PROPS} />);
    const mlsTab = screen.getByRole('tab', { name: /mls/i });
    expect(mlsTab).toHaveAttribute('aria-selected', 'true');
  });

  it('shows 6 team cards on MLS tab', () => {
    useGameStore.setState({ playerSlot: 1 });
    render(<TeamSelectionScreen homePickedTeam={null} onPick={vi.fn()} {...DEFAULT_SPEED_PROPS} />);
    const allButtons = screen.getAllByRole('button');
    const teamCards = allButtons.filter((b) => !b.hasAttribute('aria-pressed') && !b.hasAttribute('role') || b.getAttribute('role') !== 'tab');
    // Simpler: count non-tab, non-speed buttons
    // Use data-testid if needed; otherwise filter by aria-selected absence and aria-pressed absence
    expect(teamCards.filter(b => b.getAttribute('role') !== 'tab' && !b.hasAttribute('aria-pressed'))).toHaveLength(6);
  });

  it('switches to International tab on click, shows 6 cards', async () => {
    useGameStore.setState({ playerSlot: 1 });
    render(<TeamSelectionScreen homePickedTeam={null} onPick={vi.fn()} {...DEFAULT_SPEED_PROPS} />);
    await userEvent.click(screen.getByRole('tab', { name: /international/i }));
    const intlTab = screen.getByRole('tab', { name: /international/i });
    expect(intlTab).toHaveAttribute('aria-selected', 'true');
  });
});

describe('TeamSelectionScreen — LEAGUE-02: cross-tab struck-out behavior', () => {
  it('away player auto-switches to MLS tab when home picks an MLS team', () => {
    useGameStore.setState({ playerSlot: 2 });
    // Start on International tab (simulate user having navigated there)
    // Then homePickedTeam changes to 'city' (MLS) — auto-switch should fire
    // Test: after render with homePickedTeam='city', MLS tab is active
    render(<TeamSelectionScreen homePickedTeam="city" onPick={vi.fn()} {...DEFAULT_SPEED_PROPS} />);
    expect(screen.getByRole('tab', { name: /mls/i })).toHaveAttribute('aria-selected', 'true');
  });

  it('struck-out card is disabled regardless of active tab', () => {
    // Home picked 'city' (MLS); away switches to International tab
    // City card should still be struck-out state if user switches back
    useGameStore.setState({ playerSlot: 2 });
    render(<TeamSelectionScreen homePickedTeam="city" onPick={vi.fn()} {...DEFAULT_SPEED_PROPS} />);
    const allButtons = screen.getAllByRole('button');
    const teamCards = allButtons.filter((b) => b.getAttribute('role') !== 'tab' && !b.hasAttribute('aria-pressed'));
    const disabledCards = teamCards.filter((c) => c.hasAttribute('disabled'));
    expect(disabledCards).toHaveLength(1); // city struck out
  });
});
```

**Remove transitional comments** from test file:

- Line 35: `'— transitional Phase 19 state; Phase 21 restores 4'` portion of the `it()` description.
- Line 95: Comment `'(Phase 19)` in test labels.

---

## Shared Patterns

### Static Vite Badge Imports

**Source:** `packages/client/src/components/TeamSelectionScreen.tsx` lines 17–18
**Apply to:** All 10 new badge imports in `TeamSelectionScreen.tsx`

```typescript
// Pattern: import {teamId}FullBadge from '../assets/badges/{teamId}-full.png';
// All badge imports must be static (not dynamic) — gives content-hashed URLs and
// build-time file existence checks (Phase 15 D-03 pattern).
import cityFullBadge from '../assets/badges/city-full.png';
```

### CSS Module Button Variant Pattern

**Source:** `packages/client/src/components/TeamSelectionScreen.module.css` lines 44–88
**Apply to:** Tab `.tab` and `.tabActive` classes
The existing `.speedOption` / `.speedOptionActive` pair is the convention for two-state button classes in this CSS module. New `.tab` / `.tabActive` classes follow the same structure: base style + active variant by class swap, `transition` on the changing property.

### `it.each` Test Array Pattern

**Source:** `packages/shared/src/teamConfig.test.ts` lines 20–54
**Apply to:** All extended `it.each` loops in `teamConfig.test.ts`

```typescript
// Pattern: define an array constant, pass to it.each, use %s placeholder
it.each(TEAM_IDS)('%s.id strictly equals its key', (teamId) => {
  expect(TEAM_CONFIGS[teamId].id).toBe(teamId);
});
```

### Local State + useEffect Pattern

**Source:** `packages/client/src/App.tsx` (homePickedTeam local state) + React conventions shown in RESEARCH.md Pattern 4
**Apply to:** `activeLeague` tab state in `TeamSelectionScreen.tsx`
Tab state must be `useState` inside the component — not Zustand. The `useEffect` watching `homePickedTeam` must guard on `!iAmActive` (Pitfall 5 prevention).

---

## No Analog Found

All files in Phase 21 have clear analogs within the existing codebase. No new file types are introduced.

---

## Critical Pitfalls (for planner action items)

| Pitfall                                                                    | Location                           | Guard                                                 |
| -------------------------------------------------------------------------- | ---------------------------------- | ----------------------------------------------------- |
| `seattle` badge typo (`seatle`) is fixed — use `seattle-full.png`          | All Vite imports                   | Correct filename in assets directory confirmed        |
| 3 TeamId/sourceTeamId mismatches (miami→inter-miami, la→lafc, us→usmnt)    | playerIds in TEAM_CONFIGS          | Use RESEARCH.md Pattern 3 table                       |
| Tab auto-switch must guard `!iAmActive`                                    | `useEffect` in TeamSelectionScreen | Pitfall 5 in RESEARCH.md                              |
| `isStruckOut` checks `homePickedTeam` prop, NOT which tab is active        | Card render logic                  | Already correct in current code — do not change       |
| `teamConfig.test.ts` count assertions will fail until updated (2→12, 4→14) | Lines 13, 64                       | Update as part of same task as TEAM_CONFIGS expansion |
| `TeamSelectionScreen.test.tsx` card-count assertions target 2 cards        | Lines 43, 61, 75                   | Update to 6 per tab                                   |

---

## Metadata

**Analog search scope:** `packages/shared/src/`, `packages/server/src/`, `packages/client/src/components/`
**Files read:** `teamConfig.ts`, `teamConfig.test.ts`, `roomHandlers.ts` (lines 1–60), `TeamSelectionScreen.tsx`, `TeamSelectionScreen.test.tsx`, `TeamSelectionScreen.module.css`
**Pattern extraction date:** 2026-07-04
