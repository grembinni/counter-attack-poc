---
phase: 13-layout-clock
verified: 2026-07-03T12:15:00Z
status: verified
score: 8/8 must-haves verified
overrides_applied: 1
overrides:
  - must_have: 'Match time displays in MM:SS format with real seconds'
    reason: 'CONTEXT.md D-08/D-09 explicitly changed the clock contract to event-driven MM:00 before implementation. Seconds always display as :00 by design; the format is driven by actionCount. This is a deliberate scope narrowing documented in phase planning artifacts before any code was written. ROADMAP wording said MM:SS but the canonical phase spec (CONTEXT.md) and all plans specify MM:00.'
    accepted_by: 'gsd-verifier'
    accepted_at: '2026-06-12T13:30:00Z'
human_verification_completed: 2026-07-03T12:15:00Z
human_verification_results:
  - test: 'Top band renders correctly at 1080p desktop with all six tracks visible'
    result: PASS
  - test: 'Clock MM:00 is visible above the HALF_TIME overlay card (not hidden behind it)'
    result: PASS
  - test: 'Log section expands and collapses on chevron click'
    result: PASS
  - test: 'Clock MM:00 is visible above the HALF_TIME overlay card (not hidden behind it)'
    expected: 'When phase reaches HALF_TIME, the overlay covers only the pitchContainer (position:absolute inset:0 on the overlay, position:relative on pitchContainer). The 80px topBand above it remains fully visible including the clockDisplay element showing MM:00'
    why_human: 'CSS stacking context and position:relative scoping to a flex child cannot be asserted in jsdom; only a real browser rendering confirms the overlay is clipped to pitchContainer'
  - test: 'Log section expands and collapses on chevron click'
    expected: 'Clicking the › button changes the log section from 32px collapsed state (chevron only) to 240px expanded state (MATCH LOG header + ActionLog entries visible); clicking ‹ collapses it back'
    why_human: 'Interaction test requiring real DOM event handling and CSS class transitions; the jsdom test suite verifies the chevron exists but not that the toggle behavior produces correct visual width change'
---

# Phase 13: Layout & Clock Verification Report

**Phase Goal:** The screen has a persistent top scoreboard and action/log panel above the hex grid, and the match clock is visible in MM:SS format throughout all game phases
**Verified:** 2026-06-12T13:30:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| #   | Truth                                                                                             | Status   | Evidence                                                                                                                                                                                                                                                                |
| --- | ------------------------------------------------------------------------------------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- | ---------------------------------------------------------- |
| 1   | A persistent top band renders in every phase with home score left, away score right, clock centre | VERIFIED | GameBoard.tsx lines 124–223: `.topBand` div with `.scoreColumn` (Home), `.topBandSection` (centre: clockDisplay), `.scoreColumnAway` (Away). No phase gating on the band itself.                                                                                        |
| 2   | Clock displays MM:00 derived from actionCount with no PLAY_PHASES gating                          | VERIFIED | GameBoard.tsx line 88: `String(actionCount).padStart(2, '0') + ':00'`. "PLAY_PHASES" string absent from file. clockDisplay rendered unconditionally at line 135.                                                                                                        |
| 3   | Action section swaps ActionPanel / KickOffSetupPanel / ReplayPanel by phase                       | VERIFIED | GameBoard.tsx lines 179–186: ternary `KICK_OFF_SETUP → KickOffSetupPanel                                                                                                                                                                                                | REPLAY → ReplayPanel | else → ActionPanel`. All three imports present lines 9–11. |
| 4   | Log toggle collapses and expands (chevron state, MATCH LOG header)                                | VERIFIED | GameBoard.tsx lines 190–214: `logExpanded` useState, collapsed renders › button, expanded renders MATCH LOG header + ‹ button + ActionLog.                                                                                                                              |
| 5   | HALF_TIME and FULL_TIME render as overlays over the pitch (not separate screens)                  | VERIFIED | GameBoard.tsx lines 233–305: conditional overlay divs with `.overlay` and `.overlayCard` inside `.pitchContainer`. `.pitchContainer` has `position: relative` (CSS line 239); `.overlay` has `position: absolute; inset: 0` (CSS lines 246–247).                        |
| 6   | App.tsx routes HALF_TIME/FULL_TIME to GameBoard (no HalfTimeScreen/FullTimeScreen import)         | VERIFIED | App.tsx line 82: `screen === 'GAME_BOARD' \|\| screen === 'REPLAY' ? <GameBoard /> : <LobbyScreen />`. No HalfTimeScreen or FullTimeScreen import in file. App.tsx onGameState handler (lines 25–31): no `setScreen('HALF_TIME')` or `setScreen('FULL_TIME')` branches. |
| 7   | TurnIndicator, HalfTimeScreen, FullTimeScreen files are deleted                                   | VERIFIED | All six files absent from disk (ls confirms `No such file or directory` for all). git commit 19a6661 shows `6 files changed, 368 deletions(-)`.                                                                                                                         |
| 8   | Full client test suite (71 tests) passes                                                          | VERIFIED | `pnpm vitest run` output: `8 passed (8)` test files, `71 passed (71)` tests. GameBoard.test.tsx contributes 15 tests covering CLOCK-01, CLOCK-02, LAYOUT-01, LAYOUT-02.                                                                                                 |

**Score:** 8/8 truths verified (1 carries an accepted override on clock format wording; see overrides section)

### Clock Format Override Note

ROADMAP.md success criterion 3 and REQUIREMENTS.md CLOCK-01 state "MM:SS format" with a counting clock. The implementation delivers "MM:00" — event-driven minutes only, seconds fixed at :00. This was an explicit design decision documented in CONTEXT.md D-08/D-09 before any code was written: "Seconds always display as :00. Display: MM:00. Examples: actionCount=7 → '7:00'." All three plans (13-01, 13-02, 13-03) specify MM:00 throughout. The intent of CLOCK-01 — a visible clock that updates with game progress, present in all phases — is fully met. Only the literal formatting diverges from the early ROADMAP wording.

### Required Artifacts

| Artifact                                                     | Expected                                              | Status   | Details                                                                                                                                                                                              |
| ------------------------------------------------------------ | ----------------------------------------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/client/src/components/GameBoard.tsx`               | Top-band layout host with clock, scoreboard, overlays | VERIFIED | 309 lines, full rewrite. Contains topBand, clockDisplay, COMPACT_STATS, phase overlays, log toggle.                                                                                                  |
| `packages/client/src/components/GameBoard.module.css`        | Top band CSS grid + overlay + compact card styles     | VERIFIED | 331 lines. .topBand with grid-template-columns, .pitchContainer position:relative, .overlay position:absolute, .overlayCard max-width:440px, .compactStatsGrid repeat(2,1fr), .clockDisplay #f5c518. |
| `packages/client/src/components/ConnectionStatus.module.css` | 8px connection dot per UI-SPEC                        | VERIFIED | .dot width: 8px; height: 8px. No "10px" anywhere in file.                                                                                                                                            |
| `packages/client/src/components/GameBoard.test.tsx`          | Wave 0 test scaffold: 15 tests covering all 4 reqs    | VERIFIED | 185 lines. 4 describe blocks (CLOCK-01, CLOCK-02, LAYOUT-01, LAYOUT-02). 15 tests, all passing.                                                                                                      |
| `packages/client/src/App.tsx`                                | Simplified routing — all game phases render GameBoard | VERIFIED | Line 82: `screen === 'GAME_BOARD' \|\| screen === 'REPLAY' ? <GameBoard /> : <LobbyScreen />`. No retired component imports.                                                                         |
| `packages/client/src/store/useGameStore.ts`                  | Screen type without HALF_TIME/FULL_TIME               | VERIFIED | Line 22: `type Screen = 'LANDING' \| 'CREATE_ROOM' \| 'JOIN_ROOM' \| 'WAITING' \| 'GAME_BOARD' \| 'REPLAY'`. emitHalfTimeStart preserved (lines 126, 590–591).                                       |
| TurnIndicator.tsx / .module.css (deleted)                    | Files must not exist                                  | VERIFIED | Absent from disk.                                                                                                                                                                                    |
| HalfTimeScreen.tsx / .module.css (deleted)                   | Files must not exist                                  | VERIFIED | Absent from disk.                                                                                                                                                                                    |
| FullTimeScreen.tsx / .module.css (deleted)                   | Files must not exist                                  | VERIFIED | Absent from disk.                                                                                                                                                                                    |

### Key Link Verification

| From                         | To                                 | Via                                            | Status | Details                                                                                                                              |
| ---------------------------- | ---------------------------------- | ---------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| GameBoard.tsx                | useGameStore.gameState.actionCount | clockDisplay derivation                        | WIRED  | Line 67: `const actionCount = useGameStore(...)`. Line 88: `String(actionCount).padStart(...)`. Line 135: `{clockDisplay}` rendered. |
| GameBoard.tsx                | emitHalfTimeStart                  | HALF_TIME overlay button onClick               | WIRED  | Line 82: selector. Line 270: `onClick={() => emitHalfTimeStart()}`. useGameStore.ts line 590: action defined.                        |
| GameBoard.tsx pitchContainer | Phase overlay                      | position:relative ancestor + absolute overlay  | WIRED  | pitchContainer has `position: relative` (CSS line 239). overlay has `position: absolute; inset: 0` (CSS lines 246–247).              |
| App.tsx onGameState          | setScreen                          | HALF_TIME/FULL_TIME fall through to GAME_BOARD | WIRED  | Lines 25–31: only REPLAY branch sets REPLAY; all else falls to GAME_BOARD guard.                                                     |

### Data-Flow Trace (Level 4)

| Artifact      | Data Variable | Source                               | Produces Real Data                                                              | Status  |
| ------------- | ------------- | ------------------------------------ | ------------------------------------------------------------------------------- | ------- |
| GameBoard.tsx | score         | useGameStore(s => s.gameState.score) | Yes — Zustand state populated by server broadcast via setGameState in App.tsx   | FLOWING |
| GameBoard.tsx | clockDisplay  | actionCount from useGameStore        | Yes — server-authoritative GameState.actionCount, incremented per server action | FLOWING |
| GameBoard.tsx | phase         | useGameStore(s => s.gameState.phase) | Yes — server FSM state                                                          | FLOWING |

### Behavioral Spot-Checks

| Behavior                                         | Command                                                                           | Result                     | Status |
| ------------------------------------------------ | --------------------------------------------------------------------------------- | -------------------------- | ------ |
| GameBoard.test.tsx 15 tests all pass             | `pnpm vitest run src/components/GameBoard.test.tsx`                               | 15/15 pass                 | PASS   |
| Full 71-test suite passes                        | `pnpm vitest run` (full run)                                                      | 71/71 pass                 | PASS   |
| Production build succeeds                        | `pnpm build` (from packages/client)                                               | exit 0, 117 modules, 980ms | PASS   |
| No imports of retired components remain anywhere | `grep -r "import.*TurnIndicator\|import.*HalfTimeScreen\|import.*FullTimeScreen"` | 0 results                  | PASS   |

### Probe Execution

No probes declared in PLAN files. No `scripts/*/tests/probe-*.sh` found. Step 7c: SKIPPED (no probes for this phase).

### Requirements Coverage

| Requirement | Source Plan | Description                                                                  | Status                    | Evidence                                                                                                                                                             |
| ----------- | ----------- | ---------------------------------------------------------------------------- | ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| LAYOUT-01   | 13-01/02/03 | Persistent scoreboard at top in all phases with home score, time, away score | SATISFIED                 | GameBoard.tsx topBand always rendered; score.home and score.away displayed; clockDisplay present in every render.                                                    |
| LAYOUT-02   | 13-01/02    | Action/log panel at top; hex grid below; phase-aware action buttons          | SATISFIED                 | Phase-swap ternary lines 179–186; logCollapsed/logExpanded toggle; HexGrid in pitchContainer below topBand.                                                          |
| CLOCK-01    | 13-01/02    | Match time visible, MM:00 format from actionCount                            | SATISFIED (with override) | MM:SS wording in REQUIREMENTS deviates from CONTEXT.md D-08/D-09 design decision. MM:00 implemented correctly per phase spec.                                        |
| CLOCK-02    | 13-01/02/03 | Clock visible in all phases without exception                                | SATISFIED                 | clockDisplay rendered unconditionally; no PLAY_PHASES gating; confirmed by CLOCK-02 test group (4 tests across HALF_TIME, KICK_OFF_SETUP, FULL_TIME, REPLAY phases). |

### Anti-Patterns Found

Scanned GameBoard.tsx, GameBoard.module.css, ConnectionStatus.module.css, App.tsx, useGameStore.ts for debt markers and stubs.

| File | Line | Pattern                                 | Severity | Impact |
| ---- | ---- | --------------------------------------- | -------- | ------ |
| —    | —    | No TBD/FIXME/XXX/HACK/PLACEHOLDER found | —        | —      |

No stubs detected. All state variables (score, phase, actionCount, selectedPieceId, pieces) are sourced from Zustand store with real server-broadcast data. The player card placeholder "Select a piece" only shows when `displayPiece` is null — this is correct UI behavior, not a data stub.

### Human Verification Required

Three items require human testing that cannot be verified programmatically in jsdom:

#### 1. Top Band Visual Layout at 1080p

**Test:** Launch `pnpm dev` in packages/client, open two browser tabs, join the same room. Observe the top band at 1080p resolution.
**Expected:** An 80px strip spanning full width with six visible tracks — Home score (56px, left edge), centre section (clock/connection/phase), player card section, action section, log toggle (› chevron, collapsed), Away score (56px, right edge). No overflow. Hex grid fills the area below.
**Why human:** CSS grid layout and pixel track widths cannot be asserted in jsdom. The test suite confirms the HTML structure exists but not that all tracks render within their width constraints.

#### 2. HALF_TIME Overlay Clipped to Pitch (Clock Visible Above It)

**Test:** Reach HALF_TIME phase in a 2-player session (end the first half by reaching action count threshold).
**Expected:** A semi-transparent overlay card ("Half Time", score, "Start 2nd Half" button) appears over the hex grid. The 80px top band above it — including the clock (MM:00) — remains fully visible and is not obscured by the overlay.
**Why human:** The CSS `position: relative` on `.pitchContainer` plus `position: absolute; inset: 0` on `.overlay` should clip the overlay to the pitch area only. jsdom does not compute stacking context or apply CSS positioning; this can only be confirmed in a real browser.

#### 3. Log Toggle Expand/Collapse Interaction

**Test:** In the game board, click the › chevron button at the right of the top band. Then click the ‹ button to collapse.
**Expected:** Clicking › expands the log section to 240px wide, showing "MATCH LOG" header and ActionLog entries. Clicking ‹ collapses it back to 32px (chevron only). The rest of the top band does not reflow.
**Why human:** The GameBoard.test.tsx suite verifies that the › button exists in the DOM. It does not test that the onClick handler correctly toggles the CSS class from `.logCollapsed` to `.logExpanded` and produces the expected visual width change. Interaction requires a real browser.

### Gaps Summary

No automated gaps. All must-haves verified in the codebase. The three human verification items above are standard end-of-phase UAT items — they require a browser session, not code fixes.

The clock format deviation (MM:00 vs MM:SS in ROADMAP wording) is accepted via override; the design decision was made before implementation in CONTEXT.md D-08/D-09 and is consistent throughout all phase planning artifacts.

---

_Verified: 2026-06-12T13:30:00Z_
_Verifier: Claude (gsd-verifier)_
