---
phase: 06-react-hex-grid-renderer
plan: '03'
subsystem: client-ui-chrome
tags:
  - react
  - ui
  - lobby
  - turn-indicator
  - action-log
  - hex-clip
dependency_graph:
  requires:
    - 06-02
  provides:
    - turn-indicator-panel
    - action-log-panel
    - lobby-screens
    - app-root-router
    - correct-pitch-clip-boundaries
  affects:
    - packages/client/src/components/TurnIndicator.tsx
    - packages/client/src/components/ActionLog.tsx
    - packages/client/src/components/LobbyScreen.tsx
    - packages/client/src/components/GameBoard.tsx
    - packages/client/src/components/HexGrid.tsx
    - packages/client/src/App.tsx
tech_stack:
  added: []
  patterns:
    - Zustand per-slice selectors for all UI panels (Pitfall 6)
    - ActionEvent discriminated union switch rendering via JSX interpolation (T-06-06)
    - navigator.clipboard.writeText for room code copy (no document.execCommand)
    - CSS @keyframes for waiting-screen dot pulse animation
    - clipPath in <g> local coordinate space (post-translate) — not SVG viewport space
key_files:
  created:
    - packages/client/src/components/TurnIndicator.tsx
    - packages/client/src/components/TurnIndicator.module.css
    - packages/client/src/components/ActionLog.tsx
    - packages/client/src/components/ActionLog.module.css
    - packages/client/src/components/LobbyScreen.tsx
    - packages/client/src/components/LobbyScreen.module.css
    - packages/client/src/App.module.css
  modified:
    - packages/client/src/components/GameBoard.tsx
    - packages/client/src/components/HexGrid.tsx
    - packages/client/src/App.tsx
decisions:
  - 'clipPath operates in <g> local (post-translate) coordinate space — CLIP_X=-10 clips left tips, CLIP_RIGHT=1090 clips right tips at their 60°/300° corners'
  - 'ODD-Q offset hex colour formula: (2r + q%2) % 3 — derived from visual adjacency not axial'
  - 'Hex adjacency highlights use ODD-Q offset neighbour calculation, not axial neighbours'
  - 'ActionEvent rendering uses formatEvent() switch returning plain strings — JSX text nodes only'
  - 'LobbyScreen uses MOCK42 placeholder code; real generation deferred to Phase 7 server integration'
metrics:
  duration_minutes: 45
  completed_date: '2026-05-31'
  tasks_completed: 2
  files_created: 7
  files_modified: 3
  fix_commits: 13
---

# Phase 6 Plan 03: UI Chrome + Clip Boundary Summary

**One-liner:** TurnIndicator, ActionLog, and LobbyScreen panels wired to Zustand mock state; App root router between lobby and game board; hex pitch clip boundaries corrected so all four edges render a clean straight boundary.

## Tasks Completed

| #   | Name                                             | Commit  | Result                                                               |
| --- | ------------------------------------------------ | ------- | -------------------------------------------------------------------- |
| 1   | TurnIndicator, ActionLog, updated GameBoard      | f65be31 | Build exits 0; all 12 GamePhase mappings; no dangerouslySetInnerHTML |
| 2   | LobbyScreen, App router, full build verification | 35f334c | pnpm -r build + pnpm -r test both exit 0; 90 tests green             |
| —   | Hex clip boundary debugging (13 fix commits)     | 5e0ba92 | All four pitch edges render clean straight boundaries                |

## Verification Results

1. `pnpm -r build` — exits 0 (shared + server + client, 76 modules transformed)
2. `pnpm -r test` — 90 tests, all green (shared 0 + server 84 + client 6); 1 todo skipped
3. `pnpm --filter @counter-attack/client typecheck` — exits 0, zero TypeScript errors
4. `grep dangerouslySetInnerHTML packages/client/src/**` — one comment-only hit in ActionLog.tsx confirming it is NOT used; no actual usage
5. `grep document.execCommand packages/client/src/**` — no matches; navigator.clipboard.writeText confirmed
6. Human-verify checkpoint — all checklist items confirmed by user

## Must-Have Truths Verified

- TurnIndicator shows active team (ALL CAPS, accent color), phase label (all 12 GamePhase values mapped), score, and MOVEMENT slot/remaining — confirmed
- ActionLog uses `switch(event.type)` over ActionEvent union with JSX string interpolation — no dangerouslySetInnerHTML — confirmed (T-06-06)
- ActionLog renders "No actions yet." when eventLog is empty — confirmed
- LobbyScreen renders Create Room, Join Room, and Waiting sub-screens with sub-link navigation — confirmed
- App.tsx routes `screen === 'GAME_BOARD'` → GameBoard, all else → LobbyScreen — confirmed
- `pnpm -r build` exits 0 — confirmed

## Key Discovery: clipPath Coordinate Space

The most significant debugging effort in this plan was determining the correct `<clipPath>` coordinate system. The clip path applied to `<g transform="translate(20, 17.32)">` operates in the **`<g>`'s local post-translate coordinate space**, not the SVG viewport space.

Consequence:

- `CLIP_X = -10` (local) clips at the 120°/240° corners of q=0 hexes (local x=−10); the 180° tips at local x=−20 are outside the clip → removed.
- `CLIP_RIGHT = 1090` (local) clips at the 60°/300° corners of q=36 hexes (local x=1090); the 0° tips at local x=1100 are outside the clip → removed.
- `CLIP_W = 1100` (CLIP_RIGHT − CLIP_X = 1090 − (−10))

Earlier attempts used SVG viewport coordinates (CLIP_W=1120, 1140) which produced the correct arithmetic in theory but left the right edge tips visible because 1090 local = 1110 SVG is the correct boundary, not 1110 SVG = 1090 local for the right tips.

## Other Fixes Applied During Human Verify

| Commit          | Issue Fixed                                                                                    |
| --------------- | ---------------------------------------------------------------------------------------------- |
| 67e09ca         | Hex adjacency highlights used axial neighbours; switched to ODD-Q offset neighbour calculation |
| 2773639         | Hex colour formula used axial coords; corrected to ODD-Q visual adjacency: `(2r + q%2) % 3`    |
| 117bf16         | Rectangular pitch layout and initial clip boundary setup                                       |
| 26535c1         | Bottom clip symmetric with top edge (half-hex behaviour)                                       |
| f2106b4         | Left clip at 180° vertex; right unchanged                                                      |
| 0571d7b–5e0ba92 | Left/right clip boundary iteration (6 commits) to determine correct local-coord values         |

## Decisions Made

- **clipPath local-space discovery:** The clip path on `<g>` operates in the group's own post-translate coordinate space. CLIP constants reference local hex geometry directly, not SVG viewport geometry. Documented in HexGrid.tsx comments.
- **ODD-Q offset for everything visual:** Both neighbour calculation (highlight reachability) and colour formula use ODD-Q offset arithmetic. Axial neighbour calculation produced incorrect highlight sets because odd-q columns are shifted by half a row in pixel space.
- **MOCK42 placeholder:** LobbyScreen uses a hardcoded room code "MOCK42". Phase 7 replaces this with a server-generated code received on `room:create`.

## Deviations from Plan

None — all plan requirements met. Additional fix commits were needed for clip boundary and hex math correctness discovered during human verification.

## Threat Surface Scan

Threat mitigations verified as implemented:

- **T-06-06 (ActionEvent → DOM):** `formatEvent()` returns plain strings; JSX renders as text nodes. No innerHTML path.
- **T-06-07 (LobbyScreen input):** `value.toUpperCase().slice(0, 6)` in onChange; no server call in Phase 6.
- **T-06-08 (navigator.clipboard):** Accepted; only reveals the room code the user generated; HTTPS handled in Phase 9.

## Self-Check: PASSED

Files exist:

- packages/client/src/components/TurnIndicator.tsx — FOUND
- packages/client/src/components/TurnIndicator.module.css — FOUND
- packages/client/src/components/ActionLog.tsx — FOUND
- packages/client/src/components/ActionLog.module.css — FOUND
- packages/client/src/components/LobbyScreen.tsx — FOUND
- packages/client/src/components/LobbyScreen.module.css — FOUND
- packages/client/src/App.tsx (updated) — FOUND
- packages/client/src/App.module.css (updated) — FOUND
- packages/client/src/components/GameBoard.tsx (updated) — FOUND
- packages/client/src/components/HexGrid.tsx (updated, clip fix) — FOUND
