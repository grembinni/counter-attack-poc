# Phase 13: Layout & Clock - Context

**Gathered:** 2026-06-12
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 13 restructures the game screen from a sidebar-based layout (pitch left, panel right) to a top-band layout (scoreboard + action/log components in a single top bar, hex grid occupying the full area below). It also replaces the current minute-counter clock display with a persistent MM:SS format clock visible during every game phase.

**In scope:**

- New single-row top band replacing both the old 48px header and the 280px sidebar
- Scoreboard component: home score | center info | away score
- Compact player card embedded in top band (last-selected piece stats, persists after deselection)
- ActionPanel + KickOffSetupPanel + ReplayPanel relocated into action section of top band
- ActionLog relocated to collapsible log section at far right of top band
- Match clock reformatted as MM:SS, always visible, event-driven (updates on server broadcast)
- TurnIndicator retired; its data absorbed into the center section of the top band
- All game phases (HALF_TIME, FULL_TIME) route through GameBoard; separate screen routing removed from App.tsx
- HalfTimeScreen and FullTimeScreen content converted to overlay components rendered over the pitch

**Out of scope:**

- Server changes — layout is client-only
- Icon enhancements for buttons/logs (deferred visual polish)
- Mobile layout — desktop-first only
- Kick-off rule enforcement (Phase 14)
- Replay speed / simultaneous animation (Phase 14)

</domain>

<decisions>
## Implementation Decisions

### Top Band Layout

- **D-01:** Single-row top band spans full width, always visible. Layout left-to-right:
  `[home score] [center section] [player card] [action section] [log section] [away score]`
  Home score and away score are at the far edges; all other sections expand to fill the middle.
- **D-02:** Center section (≈50% of middle area) shows three stacked lines: match time (MM:SS, prominent), connection status (small), active player + phase label + moves remaining (replaces TurnIndicator).
- **D-03:** Player card section (compact) shows last-selected piece's 6 skill stats in a 2×3 grid (two skills per row). Persists showing the last-selected piece's data even after deselection — never blank after first selection.
- **D-04:** Action section shows action buttons — phase-aware: ActionPanel for normal play, KickOffSetupPanel during KICK_OFF_SETUP, ReplayPanel during REPLAY. Same phase-swap logic as current sidebar.
- **D-05:** Log section (ActionLog) starts **collapsed by default**; user can expand it. The rest of the top band is always expanded.
- **D-06:** Sidebar is removed entirely. No right-side panel remains.

### TurnIndicator Retirement

- **D-07:** TurnIndicator component is retired. Its data is absorbed into the center section of the top band:
  - Active team name (colored: blue/red)
  - Phase label (e.g., "MOVEMENT PHASE")
  - Moves remaining (e.g., "ATTACKER_4 · 3 moves remaining" — only during MOVEMENT phase)
    Score is dropped from TurnIndicator since it already appears in the scoreboard.

### Match Clock

- **D-08:** Clock is **event-driven only** — updates on each server GameState broadcast. No client-side timer ticking between server updates. Seconds always display as :00.
- **D-09:** MM:SS format: minutes from `GameState.actionCount` (integer), seconds always 0. Display: `MM:00`. Examples: actionCount=7 → "7:00"; actionCount=45 → "45:00"; actionCount=47 → "47:00".
- **D-10:** Second half carries forward from 45:00. `actionCount` continues incrementing past 45; display follows naturally. Added time shows as 46:00, 47:00, etc. No reset at half time.
- **D-11:** Clock visible in every game phase — no PLAY_PHASES filter. The top band always renders regardless of phase, so the clock is always present (satisfies CLOCK-02).

### HALF_TIME / FULL_TIME Screen Integration

- **D-12:** `App.tsx` no longer routes to separate `<HalfTimeScreen />` or `<FullTimeScreen />` components. All phases (including HALF_TIME and FULL_TIME) render `<GameBoard />`. The scoreboard/top-band shows in every phase automatically.
- **D-13:** `HalfTimeScreen` and `FullTimeScreen` content is converted to overlay components rendered inside GameBoard's pitch area when `phase === 'HALF_TIME'` or `phase === 'FULL_TIME'` — a centered message banner over the hex grid.
- **D-14:** REPLAY already routes through GameBoard (unchanged). Top band (including clock) displays during replay — no extra work needed.

### Claude's Discretion

- Exact pixel heights and proportional widths of top band sections — choose values that keep the hex grid tall enough to play comfortably on a 1080p desktop screen; top band should not exceed ~80–100px total height.
- Collapsed state of the log section — a small expand button or chevron at the edge; width when collapsed (e.g., just a button strip) vs. when expanded (e.g., 200–280px).
- Visual style of the compact player card — inherit dark theme (`#1a1a2e` background, `#e0e0e0` text) matching existing `PlayerStatsPanel.module.css`; label+value pairs in compact form.
- Connection status positioning within the center section — small indicator, not dominant.

</decisions>

<canonical_refs>

## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements

- `.planning/REQUIREMENTS.md` — LAYOUT-01, LAYOUT-02, CLOCK-01, CLOCK-02 full definitions (authoritative spec for what each requirement must achieve)

### Layout — Files Being Restructured

- `packages/client/src/components/GameBoard.tsx` — main layout component to restructure; current header/sidebar/pitchContainer structure replaced; phase-swap logic for ActionPanel/KickOffSetupPanel/ReplayPanel must be preserved
- `packages/client/src/components/GameBoard.module.css` — layout CSS; `.header`, `.gameLayout`, `.pitchContainer`, `.sidebar` all replaced
- `packages/client/src/App.tsx` — routing changes: remove `screen === 'HALF_TIME'` and `screen === 'FULL_TIME'` branches; all game phases render `<GameBoard />`

### Components Relocated (sidebar → top band)

- `packages/client/src/components/ActionPanel.tsx` — moves to action section; no logic changes, only location
- `packages/client/src/components/ActionLog.tsx` — moves to collapsible log section; no logic changes
- `packages/client/src/components/KickOffSetupPanel.tsx` — moves to action section; swaps in during KICK_OFF_SETUP
- `packages/client/src/components/ReplayPanel.tsx` — moves to action section; swaps in during REPLAY
- `packages/client/src/components/PlayerStatsPanel.tsx` — source for player card skills data/layout patterns; compact 2×3 grid replaces full panel

### Components Being Retired/Converted

- `packages/client/src/components/TurnIndicator.tsx` — retired; content (active team, phase label, moves remaining) absorbed inline into top band center section
- `packages/client/src/components/HalfTimeScreen.tsx` — converted to overlay; content reused as centered phase overlay inside GameBoard
- `packages/client/src/components/FullTimeScreen.tsx` — converted to overlay; same pattern as HalfTimeScreen

### Components Staying (minor changes)

- `packages/client/src/components/ConnectionStatus.tsx` — moves from standalone header item to center section of top band
- `packages/client/src/components/DisconnectBanner.tsx` — stays below top band; no changes expected

### Shared Types (read for clock fields)

- `packages/shared/src/types.ts` — `GameState.actionCount` (integer minutes), `GameState.half` (1|2), `GameState.addedTime` (number|null), `GameState.phase` (GamePhase), `GameState.score`, `GameState.activeTeam`, `GameState.movementSlot`, `GameState.paceUsedByPieceId`

</canonical_refs>

<code_context>

## Existing Code Insights

### Reusable Assets

- `useGameStore` Zustand selectors — all selectors for score, phase, actionCount, half, addedTime, activeTeam, movementSlot, paceUsedByPieceId already exist; new top band reads from same store without new selectors
- `PlayerStatsPanel.tsx` — compact skill stats rendering pattern; 6 stats already computed from `piece` object; reuse skill-display logic in the new inline player card
- `TurnIndicator.tsx` — phase label table and moves-remaining computation can be copied directly into the top band center section; component is then deleted
- `ConnectionStatus.tsx` — drop-in import; just relocate into top band JSX

### Established Patterns

- Zustand per-slice selectors — each top-band subsection selects only its needed state slice; no whole-component re-render on unrelated state changes
- Phase-swap sidebar pattern in `GameBoard.tsx:70-80` — `{phase === 'KICK_OFF_SETUP' ? <KickOffSetupPanel /> : phase === 'REPLAY' ? <ReplayPanel /> : <ActionPanel />}` — replicate this in the action section of the new top band
- Dark theme (`#1a1a2e` background, `#e0e0e0` text, `#f5c518` accent gold) — use throughout new top band for visual consistency
- Home team `#1a56b0` blue, away team `#c0392b` red — use for score display and active team indicator

### Integration Points

- `App.tsx:88-99` — remove `screen === 'HALF_TIME'` → `<HalfTimeScreen />` and `screen === 'FULL_TIME'` → `<FullTimeScreen />` branches; both now fall through to `<GameBoard />`
- `GameBoard.tsx` pitch area — add conditional overlay render: when `phase === 'HALF_TIME'`, render HalfTimeScreen content as overlay; when `phase === 'FULL_TIME'`, render FullTimeScreen content as overlay
- Clock formula in `GameBoard.tsx:43-48` — replace current `showTime` + `timeLabel` logic with `${actionCount}:00` format, always shown (no PLAY_PHASES filter)

</code_context>

<specifics>
## Specific Ideas

- User's ASCII layout sketch: `[home score] [time/connection/phase summary] [player card] [actions] [logs→] [away score]` — the log section has a collapse arrow indicating it folds/expands to the right
- "Use my feedback as a guide but use your discretion on dimensions, scaling, and design" — Claude has design latitude on pixel values within the above structural constraints
- Player card shows skills in 2×3 compact grid: skill1 | skill2 / skill3 | skill4 / skill5 | skill6 — space-efficient alternative to the current vertical list in PlayerStatsPanel
- Center section label/weight hint from user: time ≈40%, connection ≈5%, phase+step summary ≈55% of that section's area
- The `"counter attack"` title text in the current header is removed in the new layout (replaced by functional scoreboard)

</specifics>

<deferred>
## Deferred Ideas

- **Icon enhancements for action buttons and log prefixes** — simple Unicode/SVG icons (e.g., ▶ Move, ⚽ Pass) on buttons and log entries. User confirmed this belongs in a future visual polish phase, not Phase 13.

</deferred>

---

_Phase: 13-layout-clock_
_Context gathered: 2026-06-12_
