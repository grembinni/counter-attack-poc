# Phase 13: Layout & Clock - Research

**Researched:** 2026-06-12
**Domain:** React layout restructure — CSS Grid top band, component relocation, event-driven clock
**Confidence:** HIGH

---

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Single-row top band spans full width, always visible. Layout left-to-right: `[home score] [center section] [player card] [action section] [log section] [away score]`
- **D-02:** Center section shows three stacked lines: match time (MM:SS, prominent), connection status (small), active player + phase label + moves remaining.
- **D-03:** Player card shows last-selected piece's 6 skill stats in a 2×3 grid. Persists showing last-selected piece's data even after deselection — never blank after first selection.
- **D-04:** Action section shows phase-aware action buttons: ActionPanel / KickOffSetupPanel / ReplayPanel.
- **D-05:** Log section (ActionLog) starts collapsed by default.
- **D-06:** Sidebar is removed entirely.
- **D-07:** TurnIndicator retired; content absorbed into center section of top band.
- **D-08:** Clock is event-driven only — updates on each server GameState broadcast. No client-side timer.
- **D-09:** Clock format: `${actionCount}:00`. Examples: actionCount=7 → "7:00"; actionCount=45 → "45:00".
- **D-10:** Second half carries forward from 45:00. `actionCount` continues incrementing past 45.
- **D-11:** Clock visible in every game phase — no PLAY_PHASES filter.
- **D-12:** App.tsx no longer routes to separate HalfTimeScreen or FullTimeScreen components.
- **D-13:** HalfTimeScreen and FullTimeScreen converted to overlay components rendered inside GameBoard's pitch area.
- **D-14:** REPLAY already routes through GameBoard — unchanged.

### Claude's Discretion

- Exact pixel heights and proportional widths of top band sections.
- Collapsed state of the log section (chevron/button style).
- Visual style of the compact player card (dark theme inherited from PlayerStatsPanel).
- Connection status positioning within the center section.

### Deferred Ideas (OUT OF SCOPE)

- Icon enhancements for action buttons and log prefixes (future visual polish phase).
  </user_constraints>

---

<phase_requirements>

## Phase Requirements

| ID        | Description                                                                                                                                     | Research Support                                                                                       |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| LAYOUT-01 | Persistent scoreboard at top of screen in all game phases; home score, match time + half indicator + connection status, away score              | D-01/D-02/D-11: top band always renders; score columns at edges; center section has clock + connection |
| LAYOUT-02 | Action/log panel at top of screen alongside scoreboard; action buttons, phase status text, recent event log; hex grid below both top components | D-04/D-05: ActionSection + LogToggle in top band; pitchContainer below                                 |
| CLOCK-01  | MM:SS format; first half from 0:00 forward; second half starts at 45:00, runs forward through added time                                        | D-09/D-10: `${actionCount}:00` formula; second half continues past 45 naturally                        |
| CLOCK-02  | Clock visible in all game phases including kick off setup, GK restart, GK diving, half time, full time, replay                                  | D-11/D-12: no PLAY_PHASES filter; top band renders in every phase via GameBoard                        |

</phase_requirements>

---

## Summary

Phase 13 is a client-only layout restructure. It replaces the existing 48px header + 280px right sidebar pattern with a single 80px top band that spans the full viewport width. The top band contains six sections (home score, center info, compact player card, action section, collapsible log, away score). The pitch area expands to fill everything below the band.

The match clock changes from the current gated `N'` format (shown only in PLAY_PHASES) to a permanent `MM:00` format derived from `GameState.actionCount` on every server broadcast — no client-side timer, no phase gating.

The App.tsx routing simplification removes HALF_TIME and FULL_TIME from the screen-level switch. Both phases now render `<GameBoard />`, and their content becomes overlay cards drawn over the pitch area. This eliminates the PLAY_PHASES filter entirely and makes the clock automatically present during every game phase including overlays.

**Primary recommendation:** Implement the top band as a CSS Grid row (`grid-template-columns: 56px 1fr 1fr 1fr auto 56px`) inside GameBoard.tsx. All new markup is inline JSX in GameBoard — no new component files needed. The `PLAY_PHASES` constant, the sidebar `<aside>`, and the `TurnIndicator` import are all deleted.

---

## Architectural Responsibility Map

| Capability                            | Primary Tier     | Secondary Tier | Rationale                                                              |
| ------------------------------------- | ---------------- | -------------- | ---------------------------------------------------------------------- |
| Top band layout & scoreboard          | Browser / Client | —              | Pure render from Zustand store state; no server round-trip             |
| Match clock display                   | Browser / Client | —              | Derived from `GameState.actionCount`; updated on each socket broadcast |
| Phase overlay (HALF_TIME / FULL_TIME) | Browser / Client | —              | Conditional render over pitch; no new server events                    |
| App routing simplification            | Browser / Client | —              | Remove screen enum branches for HALF_TIME/FULL_TIME                    |
| Log toggle (collapse/expand)          | Browser / Client | —              | Local `useState` only; no Zustand, no server state                     |
| Action section phase swap             | Browser / Client | —              | Mirrors existing sidebar phase-swap logic                              |

---

## Standard Stack

This phase installs **no new packages**. All required libraries are already in the project.

### Already Installed (verified in codebase)

| Library            | Version (pinned) | Purpose                                                            | Status                      |
| ------------------ | ---------------- | ------------------------------------------------------------------ | --------------------------- |
| React              | 18.3.1           | Component rendering, `useState` for log toggle                     | In use [VERIFIED: codebase] |
| Zustand            | 4.5.7            | `useGameStore` selectors for score, phase, actionCount, activeTeam | In use [VERIFIED: codebase] |
| CSS Modules (Vite) | 5.x              | `GameBoard.module.css` replacement                                 | In use [VERIFIED: codebase] |
| TypeScript         | 5.x              | All component typing                                               | In use [VERIFIED: codebase] |

### Package Legitimacy Audit

No packages are installed in this phase. This section is not applicable.

---

## Architecture Patterns

### System Architecture Diagram

```
game:state broadcast (Socket.io)
        │
        ▼
useGameStore.setGameState()
        │
        ├──► GameBoard.tsx (renders top band + pitch area)
        │         │
        │         ├── TopBand (CSS Grid, 80px, full width)
        │         │     ├── ScoreColumn [home] ── score.home from store
        │         │     ├── CenterSection ─────── actionCount → "MM:00"
        │         │     │                          activeTeam, phase, movementSlot
        │         │     │                          <ConnectionStatus /> (local socket events)
        │         │     ├── CompactPlayerCard ──── selectedPieceId → last piece stats
        │         │     ├── ActionSection ───────── phase swap: ActionPanel | KickOffSetupPanel | ReplayPanel
        │         │     ├── LogToggle ──────────── local useState(collapsed)
        │         │     │                          <ActionLog /> when expanded
        │         │     └── ScoreColumn [away] ── score.away from store
        │         │
        │         └── PitchArea (flex: 1)
        │               ├── <HexGrid />
        │               └── PhaseOverlay (when phase === HALF_TIME or FULL_TIME)
        │
        └──► App.tsx setScreen()
                  │
                  └── All game phases → <GameBoard /> (HALF_TIME + FULL_TIME no longer fork to separate screens)
```

### Recommended Project Structure

No new files required. All changes are in existing files:

```
packages/client/src/
├── App.tsx                          ← routing: remove HALF_TIME/FULL_TIME branches
├── App.module.css                   ← no changes expected
├── store/
│   └── useGameStore.ts              ← Screen type: remove HALF_TIME / FULL_TIME values
└── components/
    ├── GameBoard.tsx                ← full rewrite: top band + pitch + overlays
    ├── GameBoard.module.css         ← full rewrite: remove .header, .sidebar; add .topBand, .topBandGrid sections
    ├── ConnectionStatus.module.css  ← fix: dot width/height to 8px × 8px (from current 10px)
    ├── TurnIndicator.tsx            ← DELETE
    ├── TurnIndicator.module.css     ← DELETE
    ├── HalfTimeScreen.tsx           ← DELETE (content absorbed into GameBoard PhaseOverlay)
    ├── HalfTimeScreen.module.css    ← DELETE
    ├── FullTimeScreen.tsx           ← DELETE (content absorbed into GameBoard PhaseOverlay)
    └── FullTimeScreen.module.css    ← DELETE
```

### Pattern 1: CSS Grid Top Band

**What:** A single CSS Grid row divides the 80px band into fixed-width score columns at the edges and flexible content sections in the middle.

**When to use:** Multiple heterogeneous sections in a single row where some are fixed-width and others flex.

```css
/* Source: CONTEXT.md D-01 + UI-SPEC §Layout Contract */
.topBand {
  display: grid;
  grid-template-columns: 56px 1fr 1fr 1fr auto 56px;
  height: 80px;
  flex-shrink: 0;
  background: #1a1a2e;
  border-bottom: 1px solid #0f3460;
}

.topBandSection {
  background: #16213e;
  border-right: 1px solid #0f3460;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 0 8px;
}
```

### Pattern 2: Event-Driven Clock Display

**What:** Clock value is purely derived from `GameState.actionCount` on every store update. No `setInterval`, no `useEffect` timer.

**When to use:** Any value that should update only when the server says so (not between ticks).

```tsx
// Source: CONTEXT.md D-08 / D-09 / UI-SPEC §Interaction Contract — Clock
const actionCount = useGameStore((s) => s.gameState.actionCount);
const clockDisplay = `${String(actionCount).padStart(2, '0')}:00`;
// Rendered with color: #f5c518, font-size: 20px, font-weight: 700
```

### Pattern 3: Log Toggle with Local useState

**What:** Collapsible panel using local React state — not Zustand — because collapse state is UI-only with no cross-component consumers.

**When to use:** UI state that no other component reads or writes.

```tsx
// Source: UI-SPEC §Interaction Contract — Log Toggle
const [logExpanded, setLogExpanded] = useState(false);

// Collapsed: 32px strip with chevron; Expanded: 240px panel with ActionLog
<div className={logExpanded ? styles.logExpanded : styles.logCollapsed}>
  <button onClick={() => setLogExpanded((v) => !v)}>{logExpanded ? '‹' : '›'}</button>
  {logExpanded && <ActionLog />}
</div>;
```

### Pattern 4: Persistent Player Card (never blank after first selection)

**What:** Track the last-selected piece in a `useRef` so the card never clears to blank.

**When to use:** Display a "last seen" value that should not disappear on deselection.

```tsx
// Source: CONTEXT.md D-03 / UI-SPEC §Interaction Contract — Player Card
const selectedPieceId = useGameStore((s) => s.selectedPieceId);
const pieces = useGameStore((s) => s.gameState.pieces);

const lastPieceRef = useRef<PlayerPiece | null>(null);
const currentPiece = selectedPieceId
  ? (pieces.find((p) => p.id === selectedPieceId) ?? null)
  : null;
if (currentPiece) lastPieceRef.current = currentPiece;
const displayPiece = lastPieceRef.current;

// Render displayPiece stats if non-null; else show "Select a piece" placeholder
```

### Pattern 5: Phase Overlay (absolute over pitch)

**What:** Centered card rendered with `position: absolute; inset: 0` inside the pitch container when HALF_TIME or FULL_TIME is active.

**When to use:** Non-blocking overlay that keeps the top band visible behind it.

```tsx
// Source: CONTEXT.md D-13 / UI-SPEC §PhaseOverlay
// pitchContainer must have position: relative
{
  (phase === 'HALF_TIME' || phase === 'FULL_TIME') && (
    <div className={styles.overlay}>
      <div className={styles.overlayCard}>
        {phase === 'HALF_TIME' ? <HalfTimeContent /> : <FullTimeContent />}
      </div>
    </div>
  );
}
```

```css
.overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.6);
  z-index: 10;
}
```

### Pattern 6: Compact 2×3 Stats Grid

**What:** Six skills displayed in a 2-column CSS grid within the player card. Reuses PlayerStatsPanel stat-rendering logic; uses abbreviated labels (SPD/SHT/TAC/HED/PAS/STM).

**When to use:** When the full 10-stat vertical list from PlayerStatsPanel would overflow the 80px band height.

```tsx
// Source: CONTEXT.md D-03 / UI-SPEC §CompactPlayerCard
// Skill subset per UI-SPEC: pace→SPD, shooting→SHT, tackling→TAC, heading→HED, passing→PAS, stamina→STM
const COMPACT_STATS: Array<[keyof PlayerPiece, string]> = [
  ['pace', 'SPD'],
  ['shooting', 'SHT'],
  ['tackling', 'TAC'],
  ['heading', 'HED'],
  ['passing', 'PAS'],
  ['stamina', 'STM'], // confirm field names from PlayerPiece type
];
```

**Note:** PlayerStatsPanel uses `pace`, `shooting`, `tackling`, `heading` as field names (verified in `PlayerStatsPanel.tsx`). The field names `passing` and `stamina` are not confirmed in the codebase — use the abbreviated display labels SPD/SHT/TAC/HED/PAS/STM but verify against the actual `PlayerPiece` type before coding the 5th and 6th stats. [ASSUMED for fields 5-6]

### Anti-Patterns to Avoid

- **Keeping PLAY_PHASES filter:** Remove the `PLAY_PHASES` Set entirely. The clock must render in ALL phases (CLOCK-02). There is no conditional rendering of the clock.
- **Using `setInterval` for the clock:** The clock advances only when the server broadcasts a new `GameState`. A client timer would show stale data. Event-driven only (D-08).
- **Putting log expand state in Zustand:** The log toggle affects only the LogToggle section. Put it in local `useState` (UI-SPEC §Interaction Contract).
- **Removing HalfTimeScreen/FullTimeScreen logic before creating PhaseOverlay:** Delete the old components only after the overlay versions are verified working. Orphaning the emitHalfTimeStart handler will break the "Start 2nd Half" button.
- **Forgetting `position: relative` on pitchContainer:** The phase overlay uses `position: absolute; inset: 0` and requires its nearest positioned ancestor to be pitchContainer — otherwise it escapes the pitch area and covers the top band.
- **Using grid column `fr` for score columns:** Score columns should be `56px` fixed (UI-SPEC). Using `fr` causes them to resize when the center sections expand.
- **Removing HALF_TIME/FULL_TIME from the Screen type before updating App.tsx:** The store's `Screen` type and the App.tsx routing must be updated together. Remove HALF_TIME/FULL_TIME from `Screen` type only after the routing branches are gone and setScreen no longer calls those values.

---

## Don't Hand-Roll

| Problem                                 | Don't Build                      | Use Instead                                              | Why                                                                                                    |
| --------------------------------------- | -------------------------------- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| CSS flex/grid layout                    | Custom JS layout calculations    | CSS Grid + Flexbox                                       | Browser handles responsive resizing; no JS measurement needed                                          |
| Log collapse animation                  | CSS transitions or JS animations | No animation (instant show/hide)                         | REQUIREMENTS.md: animations are out of scope for v1.1                                                  |
| Clock ticking between updates           | `setInterval` client timer       | Read `actionCount` from Zustand on each server broadcast | Server-authoritative state; client timer would drift                                                   |
| Component library for top band sections | shadcn/ui or third-party         | Plain CSS Modules (project convention)                   | shadcn not initialized; introducing it mid-project breaks token consistency (UI-SPEC §Registry Safety) |

**Key insight:** Every element needed is already in the project as a relocatable or refactorable component. This is a restructure, not a build.

---

## Runtime State Inventory

This is a client-only refactor — no server changes. No persistent state is affected.

| Category            | Items Found                                                   | Action Required                                                                 |
| ------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Stored data         | None — layout state is ephemeral React/Zustand                | None                                                                            |
| Live service config | None — server unchanged                                       | None                                                                            |
| OS-registered state | None                                                          | None                                                                            |
| Secrets/env vars    | None                                                          | None                                                                            |
| Build artifacts     | `packages/shared/tsconfig.tsbuildinfo` — stale per git status | `pnpm --filter @counter-attack/shared build` if type errors arise; not blocking |

---

## Common Pitfalls

### Pitfall 1: Screen enum out-of-sync with routing

**What goes wrong:** `useGameStore.ts` defines `Screen` as a union type that includes `'HALF_TIME'` and `'FULL_TIME'`. If App.tsx removes those routing branches but the type still includes them, TypeScript will not error — and `setScreen('HALF_TIME')` in the `onGameState` handler will still set the screen to a value that no longer routes anywhere, causing a blank screen.

**Why it happens:** The `onGameState` handler in App.tsx explicitly calls `setScreen('HALF_TIME')` and `setScreen('FULL_TIME')` when the game phase matches. These calls survive a partial refactor.

**How to avoid:** Update `Screen` type and `onGameState` handler in the same task. The fix is: remove the HALF_TIME/FULL_TIME branches from the `if` chain and let both phases fall through to `setScreen('GAME_BOARD')` (or remove the setScreen call for those phases entirely since they will already be on GAME_BOARD).

**Warning signs:** App renders blank/nothing after a goal is scored and half time is reached.

### Pitfall 2: Phase overlay escapes the pitch area

**What goes wrong:** `position: absolute; inset: 0` on the overlay div positions relative to the nearest ancestor with `position` set. If `pitchContainer` does not have `position: relative`, the overlay covers the entire viewport including the top band.

**Why it happens:** The existing `GameBoard.module.css .pitchContainer` does not set `position: relative`.

**How to avoid:** Add `position: relative` to `.pitchContainer` in the new CSS.

**Warning signs:** Top band disappears behind a semi-transparent black layer when HALF_TIME or FULL_TIME is reached.

### Pitfall 3: CompactPlayerCard field names

**What goes wrong:** The player card shows 6 stats. The first 4 (`pace`, `shooting`, `tackling`, `heading`) are confirmed in `PlayerStatsPanel.tsx`. The field names for the 5th and 6th stats in the 2×3 grid (labeled PAS and STM) are assumed based on common naming conventions.

**Why it happens:** `PlayerStatsPanel.tsx` shows 10 stats but the full `PlayerPiece` type needs to be checked to confirm the exact field names for `passing` and `stamina` (or equivalent).

**How to avoid:** Before writing the CompactPlayerCard stat array, read `packages/shared/src/types.ts` to confirm all `PlayerPiece` field names. Substitute the correct field names from the type definition.

**Warning signs:** TypeScript error on `piece['passing']` or `piece['stamina']` — field does not exist on type.

### Pitfall 4: ActionLog panel header "ACTION LOG" vs "MATCH LOG"

**What goes wrong:** `ActionLog.tsx` renders a `<div className={styles.panelHeader}>ACTION LOG</div>` heading inside the panel. The UI-SPEC copywriting contract specifies "MATCH LOG" for the log section header when expanded in the top band.

**Why it happens:** The existing component uses its own header text appropriate for the sidebar context.

**How to avoid:** The LogToggle wrapper (not ActionLog itself) should render the "MATCH LOG" heading when the section is expanded — OR the ActionLog component's internal header should be suppressed. The simplest approach: render "MATCH LOG" as a label in the expanded LogToggle header, and keep ActionLog unchanged (it renders its own "ACTION LOG" label internally). Check if having two headers is visually acceptable, or suppress ActionLog's internal header by prop if needed.

**Warning signs:** Two stacked labels ("MATCH LOG" and "ACTION LOG") visible when log is expanded.

### Pitfall 5: useRef persistence vs component re-mount

**What goes wrong:** The `useRef` pattern for the persistent player card (`lastPieceRef`) only works while the GameBoard component is mounted. If GameBoard unmounts and remounts (e.g. navigating back to lobby and rejoining), the ref resets to null and the card shows "Select a piece" again.

**Why it happens:** This is correct behavior — a new game session should start with a fresh card. Not a bug, just a behavior to be aware of.

**How to avoid:** This is acceptable. The ref pattern is the right tool for within-session persistence.

### Pitfall 6: ConnectionStatus dot size

**What goes wrong:** The existing `ConnectionStatus.module.css` sets the dot to `width: 10px; height: 10px`. The UI-SPEC requires `8px × 8px`.

**Why it happens:** Phase 12 UI-SPEC set the size to 8px but the CSS was not updated yet (noted in UI-SPEC metadata: `shadcn_initialized: false`, `status: draft`).

**How to avoid:** Update `ConnectionStatus.module.css` dot dimensions to `width: 8px; height: 8px` as part of Phase 13.

---

## Code Examples

Verified patterns from codebase inspection:

### Existing PHASE_LABEL table (copy directly from TurnIndicator.tsx)

```typescript
// Source: packages/client/src/components/TurnIndicator.tsx lines 6-27
const PHASE_LABEL: Record<GamePhase, string> = {
  LOBBY: '',
  KICK_OFF: 'KICK OFF',
  KICK_OFF_SETUP: 'KICK OFF SETUP',
  MOVEMENT: 'MOVEMENT PHASE',
  PASS: 'PASS PHASE',
  SHOT_DECLARED: 'SHOT DECLARED',
  GK_DIVING: 'GK DIVING',
  SNAP_DEFLECT: 'SNAP DEFLECT',
  SHOT: 'SHOT PHASE',
  HEADER: 'HEADER PHASE',
  SNAPSHOT: 'SNAPSHOT PHASE',
  LOOSE_BALL: 'LOOSE BALL',
  HIGH_PASS_MOVEMENT: 'HIGH PASS — REPOSITION',
  GK_RESTART: 'GK RESTART',
  QUICK_THROW: 'QUICK THROW',
  GK_KICK_TARGET: 'GK KICK — SELECT TARGET',
  GK_KICK_MOVEMENT: 'GK KICK — REPOSITION',
  HALF_TIME: 'HALF TIME',
  FULL_TIME: 'FULL TIME',
  REPLAY: 'REPLAY',
};
```

### Existing slot total / moves remaining (copy directly from TurnIndicator.tsx)

```typescript
// Source: packages/client/src/components/TurnIndicator.tsx lines 29-55
const SLOT_TOTAL: Record<MovementSlot, number> = {
  ATTACKER_4: 4,
  DEFENDER_5: 5,
  ATTACKER_2: 2,
};
const remaining =
  phase === 'MOVEMENT' && movementSlot != null
    ? SLOT_TOTAL[movementSlot] - Object.keys(paceUsedByPieceId).length
    : null;
```

### Existing phase swap pattern (preserve from GameBoard.tsx)

```tsx
// Source: packages/client/src/components/GameBoard.tsx lines 70-80
{
  phase === 'KICK_OFF_SETUP' ? (
    <KickOffSetupPanel />
  ) : phase === 'REPLAY' ? (
    <ReplayPanel />
  ) : (
    <ActionPanel />
  );
}
```

### onGameState routing fix (App.tsx)

```tsx
// Source: packages/client/src/App.tsx lines 27-37 — BEFORE (to be replaced)
if (state.phase === 'HALF_TIME') {
  setScreen('HALF_TIME');
} else if (state.phase === 'FULL_TIME') {
  setScreen('FULL_TIME');
} else if (state.phase === 'REPLAY') {
  setScreen('REPLAY');
} else {
  const s = useGameStore.getState().screen;
  if (s !== 'GAME_BOARD') setScreen('GAME_BOARD');
}

// AFTER: HALF_TIME and FULL_TIME no longer fork to separate screens
if (state.phase === 'REPLAY') {
  // REPLAY still uses screen='REPLAY' to distinguish from GAME_BOARD if needed,
  // but both render <GameBoard /> — so this branch can be simplified to:
  const s = useGameStore.getState().screen;
  if (s !== 'GAME_BOARD') setScreen('GAME_BOARD');
}
// (All other phases including HALF_TIME and FULL_TIME fall through to GAME_BOARD)
```

### App.tsx render tree (AFTER)

```tsx
// Source: CONTEXT.md D-12 / App.tsx current structure
// Replace: screen === 'HALF_TIME' → HalfTimeScreen, screen === 'FULL_TIME' → FullTimeScreen
// With: all game screens render GameBoard; lobby screens render LobbyScreen

return (
  <div className={styles.app}>
    {screen === 'GAME_BOARD' || screen === 'REPLAY' ? <GameBoard /> : <LobbyScreen />}
  </div>
);
```

---

## State of the Art

| Old Approach                                                 | Current Approach                                                     | When Changed | Impact                                                            |
| ------------------------------------------------------------ | -------------------------------------------------------------------- | ------------ | ----------------------------------------------------------------- |
| `N'` clock format, shown only during PLAY_PHASES             | `MM:00` always shown on every phase                                  | Phase 13     | Clock appears during HALF_TIME, FULL_TIME, KICK_OFF_SETUP, REPLAY |
| HALF_TIME / FULL_TIME as separate full-screen routes         | Overlay cards rendered inside GameBoard pitch area                   | Phase 13     | Top band (clock + scoreboard) stays visible during these phases   |
| Right sidebar with TurnIndicator + ActionPanel + ActionLog   | Top band with scoreboard + center info + action section + log toggle | Phase 13     | Pitch area gains full width; all game info stays visible          |
| PlayerStatsPanel in sidebar (returns null when no selection) | Compact 2×3 player card in top band (persists last selection)        | Phase 13     | Card always shows something after first piece click               |

**Deprecated/outdated after this phase:**

- `PLAY_PHASES` Set — removed; clock is always shown
- `TurnIndicator` component — retired; logic absorbed into GameBoard center section
- `HalfTimeScreen` / `FullTimeScreen` as top-level routed components — converted to inline overlays
- `Screen` union type values `'HALF_TIME'` and `'FULL_TIME'` — removed from store type

---

## Assumptions Log

| #   | Claim                                                                                                                        | Section                         | Risk if Wrong                                                                                            |
| --- | ---------------------------------------------------------------------------------------------------------------------------- | ------------------------------- | -------------------------------------------------------------------------------------------------------- |
| A1  | PlayerPiece fields for the 5th/6th compact stats are named `passing` and `stamina` (or similar 2-letter abbreviatable names) | Code Examples / Don't Hand-Roll | TypeScript error at compile time; easy to fix by checking types.ts                                       |
| A2  | The Screen type values `'HALF_TIME'` and `'FULL_TIME'` can be removed without breaking other store consumers                 | Common Pitfalls                 | Compile error if any other component reads `screen === 'HALF_TIME'`; grep required during implementation |

---

## Open Questions

1. **PlayerPiece field names for compact card stats 5 and 6**
   - What we know: `pace`, `shooting`, `tackling`, `heading`, `saving`, `handling`, `resilience`, `aerialAbility`, `highPass` are confirmed in PlayerStatsPanel.tsx STAT_LABELS
   - What's unclear: There is no `passing` or `stamina` in the confirmed list. The UI-SPEC uses labels "PAS" and "STM" for the 2×3 grid — which actual PlayerPiece fields map to these labels?
   - Recommendation: Read `packages/shared/src/types.ts` PlayerPiece definition at the start of Wave 1 / Plan 1 and select the two most relevant remaining stats from the confirmed list. Likely candidates from the 10 total: `saving` (GK-relevant) and `highPass`, or any two that fit "PAS / STM" display intent.

2. **Whether REPLAY screen value is still needed in the Screen enum**
   - What we know: App.tsx currently branches `screen === 'REPLAY'` to `<GameBoard />` (same as GAME_BOARD). After Phase 13, HALF_TIME and FULL_TIME are also GameBoard. Effectively all game phases render GameBoard.
   - What's unclear: Is there any component that reads `screen === 'REPLAY'` to show/hide UI within GameBoard?
   - Recommendation: Grep for `screen === 'REPLAY'` before removing the REPLAY value from the Screen enum.

---

## Environment Availability

Step 2.6: SKIPPED — this phase makes no external CLI, tool, or service calls. All changes are to client-side TypeScript/CSS files in the existing Vite + React project.

---

## Validation Architecture

### Test Framework

| Property           | Value                                             |
| ------------------ | ------------------------------------------------- |
| Framework          | Vitest (jsdom environment)                        |
| Config file        | `packages/client/vitest.config.ts`                |
| Quick run command  | `pnpm --filter @counter-attack/client test --run` |
| Full suite command | `pnpm --filter @counter-attack/client test --run` |

### Phase Requirements → Test Map

| Req ID    | Behavior                                                                         | Test Type     | Automated Command                                              | File Exists? |
| --------- | -------------------------------------------------------------------------------- | ------------- | -------------------------------------------------------------- | ------------ |
| LAYOUT-01 | Scoreboard shows home score, clock, connection status, away score in every phase | unit/snapshot | `pnpm --filter @counter-attack/client test --run -- GameBoard` | ❌ Wave 0    |
| LAYOUT-02 | Action section shows correct panel per phase; log toggles on click               | unit          | `pnpm --filter @counter-attack/client test --run -- GameBoard` | ❌ Wave 0    |
| CLOCK-01  | Clock displays `${actionCount}:00` format for actionCount=0, 7, 45, 46           | unit          | `pnpm --filter @counter-attack/client test --run -- GameBoard` | ❌ Wave 0    |
| CLOCK-02  | Clock renders regardless of phase (HALF_TIME, FULL_TIME, KICK_OFF_SETUP, REPLAY) | unit          | `pnpm --filter @counter-attack/client test --run -- GameBoard` | ❌ Wave 0    |

### Sampling Rate

- **Per task commit:** `pnpm --filter @counter-attack/client test --run`
- **Per wave merge:** `pnpm --filter @counter-attack/client test --run`
- **Phase gate:** Full client test suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `packages/client/src/components/GameBoard.test.tsx` — covers LAYOUT-01, LAYOUT-02, CLOCK-01, CLOCK-02

_(Existing tests in `useGameStore.test.ts`, `ActionPanel.test.tsx`, `PlayerStatsPanel.test.tsx`, `HexCell.test.tsx`, `PieceOverlay.test.tsx`, `LobbyScreen.test.tsx` are unaffected by this phase — they test components that are not being restructured.)_

---

## Security Domain

> `security_enforcement` not explicitly `false` in config.json.

### Applicable ASVS Categories

| ASVS Category         | Applies | Standard Control                                                                                    |
| --------------------- | ------- | --------------------------------------------------------------------------------------------------- |
| V2 Authentication     | no      | —                                                                                                   |
| V3 Session Management | no      | —                                                                                                   |
| V4 Access Control     | no      | —                                                                                                   |
| V5 Input Validation   | no      | All data is read from Zustand store (server-authoritative); no user input to validate in this phase |
| V6 Cryptography       | no      | —                                                                                                   |

**Security note:** Phase 13 is a pure client layout restructure. No new data entry, no new API calls, no new server events, no credentials handled. The existing server-authoritative architecture is unchanged. No security controls apply to this phase.

---

## Sources

### Primary (HIGH confidence)

- `packages/client/src/components/GameBoard.tsx` — existing layout structure, PLAY_PHASES set, phase swap pattern [VERIFIED: codebase]
- `packages/client/src/components/TurnIndicator.tsx` — PHASE_LABEL table, SLOT_TOTAL, moves-remaining logic to absorb [VERIFIED: codebase]
- `packages/client/src/components/HalfTimeScreen.tsx` + `HalfTimeScreen.module.css` — card layout, emitHalfTimeStart, scoring display to convert to overlay [VERIFIED: codebase]
- `packages/client/src/components/FullTimeScreen.tsx` + `FullTimeScreen.module.css` — card layout, result derivation to convert to overlay [VERIFIED: codebase]
- `packages/client/src/store/useGameStore.ts` — Screen enum, Zustand selectors, onGameState routing [VERIFIED: codebase]
- `packages/client/src/App.tsx` — routing branches to remove [VERIFIED: codebase]
- `.planning/phases/13-layout-clock/13-CONTEXT.md` — all locked decisions D-01 through D-14 [VERIFIED: planning artifact]
- `.planning/phases/13-layout-clock/13-UI-SPEC.md` — pixel dimensions, typography, colors, CSS grid template, copywriting contract [VERIFIED: planning artifact]

### Secondary (MEDIUM confidence)

- `.planning/REQUIREMENTS.md` — LAYOUT-01, LAYOUT-02, CLOCK-01, CLOCK-02 full definitions [VERIFIED: planning artifact]

---

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — no new packages; all libraries are verified in the running codebase
- Architecture: HIGH — all patterns read directly from existing source files
- Pitfalls: HIGH — identified from concrete code inspection (actual line numbers, actual field names, actual CSS values)
- Clock formula: HIGH — locked in CONTEXT.md D-08/D-09 and verified against GameState.actionCount field in useGameStore.ts
- Compact player card field names (PAS/STM): LOW [ASSUMED] — needs verification against types.ts

**Research date:** 2026-06-12
**Valid until:** 2026-07-12 (stable — no external dependencies)
