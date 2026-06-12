---
phase: quick-260612-lme
plan: '01'
subsystem: client-ui
tags: [ui-polish, scoreboard, action-panel, css, quick-task]
dependency_graph:
  requires: []
  provides: [scoreboard-dot-clock-row, movement-helper-text, centred-phase-label]
  affects: [GameBoard.tsx, GameBoard.module.css, ActionPanel.module.css]
tech_stack:
  added: []
  patterns: [slot-total-derived-helper-text, dot-only-connection-indicator]
key_files:
  created: []
  modified:
    - packages/client/src/components/ActionPanel.module.css
    - packages/client/src/components/GameBoard.tsx
    - packages/client/src/components/GameBoard.module.css
decisions:
  - ConnectionStatus component removed from scoreboard; replaced by static 8x8 green dot (T-lme-01: always-on dot is cosmetic; DisconnectBanner owns real disconnect UX)
  - movementHelperText derived inline from SLOT_TOTAL[movementSlot] — no new store selector needed
  - Phase summary separator changed from bare space to middot (· ) to match plan spec
metrics:
  duration: '~6 minutes'
  completed: '2026-06-12'
  tasks_completed: 2
  files_modified: 3
---

# Phase quick-260612-lme Plan 01: Scoreboard & ActionPanel Polish Summary

**One-liner:** Five targeted UI tweaks — green dot + 26px clock row, trimmed phase summary with MOVEMENT slot helper, and centred ActionPanel heading.

## Tasks Completed

| Task | Name                                                                         | Commit  | Files                               |
| ---- | ---------------------------------------------------------------------------- | ------- | ----------------------------------- |
| 1    | ActionPanel — centre phaseLabel                                              | abe9940 | ActionPanel.module.css              |
| 2    | GameBoard — dot+clock row, larger clock, trim phase summary, MOVEMENT helper | 5115fce | GameBoard.tsx, GameBoard.module.css |

## Changes Made

### Task 1 — ActionPanel.module.css

- Added `text-align: center` to the standalone `.phaseLabel` rule. The "Choose action" label (and all other phaseLabel spans) now centre within their full-width column span.

### Task 2 — GameBoard.tsx

- Removed `import { ConnectionStatus } from './ConnectionStatus.js'` — no longer referenced.
- Removed `paceUsedByPieceId` store selector (was only used for the deleted `remaining` computation).
- Removed `remaining` computation (`SLOT_TOTAL[movementSlot] - Object.keys(paceUsedByPieceId).length`).
- Added `movementHelperText` IIFE: resolves to `{ line1, line2 }` when `phase === 'MOVEMENT' && movementSlot != null`, `null` otherwise. Derives player count from `SLOT_TOTAL[movementSlot]`.
- Replaced centre cell JSX block: now a `.clockRow` flex div (dot + clock span), a `.phaseSummary` row (team name · phase label, no slot name or remaining count), and a conditional `.movementHelper` block.
- Phase summary separator updated from bare `&nbsp;` to `&nbsp;&middot;&nbsp;` per plan spec.

### Task 2 — GameBoard.module.css

- `.clockDisplay` font-size: `20px` → `26px`.
- Removed `.connectionLine` rule (no longer referenced in JSX).
- Removed `.movesRemaining` rule (no longer referenced in JSX).
- Added `.clockRow { display: flex; align-items: center; gap: 6px; }`.
- Added `.movementHelper`, `.movementHelperLine1`, `.movementHelperLine2` rules for the two-line MOVEMENT helper text.

## Verification Results

- TypeScript build: clean (`vite build` exits 0, 115 modules transformed).
- Test suite: 71/71 pass (8 test files, 0 failures).
- `ConnectionStatus` import absent from GameBoard.tsx (grep confirmed).
- `.connectionLine` and `.movesRemaining` absent from GameBoard.module.css (grep confirmed).
- `font-size: 26px` present in `.clockDisplay` (line 198).
- `text-align: center` present in `.phaseLabel` in ActionPanel.module.css (line 46).
- `.clockRow` rule exists in GameBoard.module.css (line 204).

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None.

## Threat Flags

None — no new network endpoints, auth paths, file access patterns, or schema changes introduced. The green dot (T-lme-01) is cosmetic; DisconnectBanner retains the real disconnect UX.

## Self-Check: PASSED

- `packages/client/src/components/ActionPanel.module.css` — exists, contains `text-align: center`.
- `packages/client/src/components/GameBoard.tsx` — exists, no ConnectionStatus import.
- `packages/client/src/components/GameBoard.module.css` — exists, contains `.clockRow`, `26px`, no `.connectionLine`, no `.movesRemaining`.
- Commit `abe9940` — confirmed in git log.
- Commit `5115fce` — confirmed in git log.
