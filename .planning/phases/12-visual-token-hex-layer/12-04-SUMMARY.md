---
phase: 12-visual-token-hex-layer
plan: '04'
subsystem: client-rendering
tags: [svg, hexgrid, selection-state, highlight-type, tint-system, hex-overlay, vis-01, ux-05, ux-06]
dependency_graph:
  requires:
    - phase: 12-visual-token-hex-layer/12-01
      provides: PieceOverlay selectionState prop + SelectionState enum; stripe patterns on-pitch
    - phase: 12-visual-token-hex-layer/12-02
      provides: HexCell highlightType prop + HexHighlightType enum; HIGHLIGHT_STYLES tint table
  provides:
    - HexGrid.tsx: selectionState derivation per piece (selectable/active/activated/none) passed to PieceOverlay
    - HexGrid.tsx: priority-resolved highlightType per hex (risk > goal > shot-path > kickoff > safe) passed to HexCell
    - Tint-only polygon overlays collapsed into HexCell; only action overlays remain as explicit polygons
  affects:
    - Phase 13 (Layout & Clock) — HexGrid stable API surface; no planned HexGrid changes

tech-stack:
  added: []
  patterns:
    - D-07: isHeaderEligible AND isHeaderContestant both map to selectionState='active' (green ring)
    - D-11: all polygon overlays consolidated in HexGrid — tint-only polygons folded into HexCell highlightType; action overlays retained
    - D-12: highlightType priority order: risk > goal > shot-path > kickoff > safe
    - D-13: HIGH_PASS header non-goal target hexes use white shot-path tint (replacing cyan)
    - Two-tier white tint: shot-path=rgba(255,255,255,0.25) (lighter), shot-path-action=rgba(255,255,255,0.35) (darker) for dive/header hexes

key-files:
  created: []
  modified:
    - packages/client/src/components/HexGrid.tsx
    - packages/client/src/components/HexGrid.module.css

key-decisions:
  - 'D-07: header-eligible AND header-contestant both map to selectionState=active (green ring); no separate isHeaderContestant prop'
  - 'D-11: tint-only overlays folded into HexCell; .hexZoIRisk removed; .hexTackleRisk retained for interception-risk pass overlay'
  - 'D-12: highlightType priority order risk > goal > shot-path > kickoff > safe applied in single ternary chain'
  - 'D-13: isHeaderNonGoalTarget overlay changed from cyan rgba(34,211,238,0.18) to white rgba(255,255,255,0.35)'
  - 'Two-tier shot-path white tint added: lighter for shot-path hexes, darker for dive/header action hexes'
  - 'Activated X stroke color set to orange #f97316 to match activated ring'
  - 'Yellow-ball-hex / risk suppression on header pass reverted per user request — documented as known open item'

patterns-established:
  - 'selectionState derivation pattern: isSpentNow → activated; selectedPieceId || isHeaderEligible || isHeaderContestant → active; isClickable → selectable; else none'
  - 'highlightType priority resolution: single ternary chain after all boolean preconditions computed; inMyZone/isCentreHex hoisted above derivation'

requirements-completed: [VIS-01, UX-05, UX-06]

duration: ~45m (3 auto tasks + 1 human-verify + 9 post-checkpoint fix commits)
completed: '2026-06-12'
---

# Phase 12 Plan 04: HexGrid Wiring Summary

**HexGrid rewired to consume PieceOverlay's selectionState and HexCell's highlightType — three selection rings and five hex tints now driven by real game state, with tint-only polygon overlays collapsed into HexCell and action overlays retained with click handlers intact.**

## Performance

- **Duration:** ~45 min
- **Started:** 2026-06-12 (morning)
- **Completed:** 2026-06-12
- **Tasks:** 3 auto + 1 human-verify checkpoint (approved)
- **Files modified:** 2 (plus 9 post-checkpoint fix commits across HexGrid.tsx and HexCell.tsx)

## Accomplishments

- `HexGrid.tsx` computes `const selectionState: SelectionState` per piece — activated/active/selectable/none — and passes it as the single prop to `PieceOverlay`; the four old boolean props (`isSelected`, `isClickable`, `isSpent`, `isHeaderContestant`) are fully removed from the call site
- `HexGrid.tsx` priority-resolves `const highlightType: HexHighlightType | undefined` per hex using the D-12 order (risk > goal > shot-path > kickoff > safe) and passes it to `HexCell`; six tint-only polygon overlay blocks removed
- D-07 satisfied: both `isHeaderEligible` and `isHeaderContestant` map to `'active'` (green ring) — eligible-but-not-yet-toggled pieces also show the green ring
- D-11 satisfied: `.hexZoIRisk` removed from CSS; `.hexTackleRisk` retained for the interception-risk pass overlay (only action-overlay polygon using it)
- D-13 satisfied: `isHeaderNonGoalTarget` overlay tint changed from cyan to white `rgba(255,255,255,0.35)`
- Post-checkpoint tuning: activated X stroke matched to orange ring (#f97316), risk tint opacity raised (0.4→0.65), header ring colors and HIGH_PASS movement highlights corrected, two-tier white tint introduced
- All 56 client tests pass; full client type-check clean

## Task Commits

Each task was committed atomically:

1. **Task 1: Compute selectionState per piece, update PieceOverlay call site** - `74e6689` (feat)
2. **Task 2: Priority-resolve highlightType per hex, collapse tint-only overlays** - `a561c2d` (feat)
3. **Task 3: Remove dead .hexZoIRisk CSS; fix exactOptionalPropertyTypes + stale test prop** - `9d0617e` (chore)

Post-checkpoint fixes (applied during human-verify loop, all committed):

4. **Activated X stroke color → orange #f97316** - `f33e9d5` (fix)
5. **Risk hex tint visibility increased (opacity 0.4→0.65, darker stroke)** - `e2a7593` (fix)
6. **Header bugs: remove redundant target-selection step after header duel + 3 more** - `db6e3e4` (fix)
7. **Header ring colors + HEADER_MOVEMENT highlights corrected** - `243359d` (fix)
8. **Two-tier white tint: lighter shot-path, darker shot-path-action for dive/header hexes** - `12d26e0` (fix)
9. **Remove yellow tint and risk hexes from header pass step** - `ad25e6f` (fix)
10. **Use lastActionType=HEADER for correct risk suppression on header pass** - `5917fb2` (fix)
11. **[Reverted] Suppress yellow ball hex on carrier hold** - `73a21bd` then reverted as `7968efc` (per user request)
12. **[Reverted] Suppress yellow ball hex + risk on header/unblockable passes** - `cef2dbf` then reverted as `f9622f0` (per user request)

## Files Created/Modified

- `packages/client/src/components/HexGrid.tsx` — selectionState derivation per piece; highlightType priority resolution per hex; PieceOverlay and HexCell call sites updated; six tint-only polygon overlay blocks removed; isHeaderNonGoalTarget tint changed from cyan to white; post-checkpoint ring color and tint corrections
- `packages/client/src/components/HexGrid.module.css` — `.hexZoIRisk` rule removed (colour now owned by HexCell HIGHLIGHT_STYLES); `.hexTackleRisk` retained

## Decisions Made

- **D-07:** Both `isHeaderEligible` and `isHeaderContestant` map to `selectionState='active'` — eligible-but-not-yet-toggled pieces show the green ring, consistent with the plan spec
- **D-11:** Six tint-only polygon blocks removed from HexGrid; tinting now entirely owned by HexCell. The `.hexZoIRisk` CSS class removed. `.hexTackleRisk` retained because the interception-risk pass overlay is an action overlay (has an `onClick`) and was explicitly designated as a KEEP overlay in the plan
- **D-12:** Priority chain implemented as a single ternary: `isRisk ? 'risk' : isGoalTint ? 'goal' : isShotPathTint ? 'shot-path' : isKickoffTint ? 'kickoff' : isSafeTint ? 'safe' : undefined`
- **D-13:** `isHeaderNonGoalTarget` overlay fill changed from `rgba(34,211,238,0.18)` (cyan) to `rgba(255,255,255,0.35)` (white), with stroke updated from `rgba(34,211,238,0.4)` to `#cccccc`
- **Two-tier white tint:** Post-checkpoint fix introduced two opacity levels for shot-path whites — lighter for resolved shot-path hexes, darker (shot-path-action) for active dive/header target hexes — improving perceptual distinction between context types
- **Yellow-ball-hex suppression reverted:** Two commits suppressing yellow tint on the ball carrier's hex were reverted per user request; this remains a known open item

## Deviations from Plan

### Auto-fixed Issues (post-checkpoint, Rule 1 — Bug)

**1. [Rule 1 - Bug] Activated X stroke color mismatched — shown as default, not orange**

- **Found during:** Post-checkpoint human visual verification
- **Issue:** The activated (spent) piece X mark stroke was rendering in a default color instead of the expected orange to match the activated ring
- **Fix:** Set X stroke color to `#f97316` (Tailwind orange-500) to match the activated ring color
- **Files modified:** `packages/client/src/components/HexGrid.tsx`
- **Commit:** `f33e9d5`

**2. [Rule 1 - Bug] Risk hex tint barely visible — opacity too low**

- **Found during:** Post-checkpoint human visual verification
- **Issue:** Risk hexes at opacity 0.4 were barely distinguishable from normal hexes on the rendered board
- **Fix:** Raised orange fill opacity to 0.65 and darkened the stroke for risk hexes in HexCell HIGHLIGHT_STYLES
- **Files modified:** `packages/client/src/components/HexCell.tsx`
- **Commit:** `e2a7593`

**3. [Rule 1 - Bug] Header phase: 4 UI bugs identified during verification**

- **Found during:** Post-checkpoint human visual verification (HEADER/HIGH_PASS flow)
- **Issue:** (a) Redundant target-selection step appeared after header duel; (b) header-eligible ring showed wrong colour; (c) HEADER_MOVEMENT highlights incorrect; (d) other header flow sequencing bugs
- **Fix:** Corrected HexGrid header-related conditions — ring colour mappings, phase-gated highlight conditions, eliminated double target-selection step
- **Files modified:** `packages/client/src/components/HexGrid.tsx`
- **Commits:** `db6e3e4`, `243359d`

**4. [Rule 1 - Bug] Shot-path white tint lacked visual distinction between resolved path and active dive/header hexes**

- **Found during:** Post-checkpoint human visual verification
- **Issue:** All shot-path-category hexes used the same white tint, making it impossible to distinguish a previously resolved shot path from an active header/dive target
- **Fix:** Introduced two-tier tint — lighter white (`rgba(255,255,255,0.25)`) for resolved shot-path hexes, darker white (`rgba(255,255,255,0.35)`) for active shot-path-action hexes (dive targets, header targets)
- **Files modified:** `packages/client/src/components/HexCell.tsx`, `packages/client/src/components/HexGrid.tsx`
- **Commit:** `12d26e0`

**5. [Rule 1 - Bug] Yellow tint and risk hexes incorrectly shown during header pass step**

- **Found during:** Post-checkpoint human visual verification
- **Issue:** During header pass targeting, the board was showing yellow safe-move tints and orange risk tints from the underlying movement state, creating visual noise during what should be a clean header target overlay
- **Fix:** Used `lastActionType=HEADER` to suppress yellow/risk tints during header pass context; later refined via `5917fb2`
- **Files modified:** `packages/client/src/components/HexGrid.tsx`
- **Commits:** `ad25e6f`, `5917fb2`

### Reverted Changes (per user request)

**Yellow-ball-hex suppression — reverted**

- **What was attempted:** Two commits (`73a21bd`, `cef2dbf`) attempted to suppress the yellow tint on the ball carrier's own hex (and risk hexes) during certain pass contexts
- **Outcome:** User explicitly requested revert; changes reverted as `7968efc` and `f9622f0`
- **Status:** Open item — yellow ball hex behaviour remains unchanged from pre-plan-04 state; user may address in a future plan

---

**Total deviations:** 5 auto-fixed (all Rule 1 bugs found during human visual verification); 1 reverted per user request
**Impact on plan:** All auto-fixes improved correctness and visual fidelity of the wired system. The revert leaves one cosmetic open item that does not block the plan's success criteria.

## Issues Encountered

- `inMyZone` / `isCentreHex` constants were declared after the `<HexCell />` call in the original HexGrid — they had to be hoisted above the `highlightType` derivation block to avoid use-before-declaration. Resolved inline during Task 2 as noted in the plan's executor notes.
- `exactOptionalPropertyTypes` TypeScript strictness caught a stale test prop in Task 3 — fixed in the same commit (`9d0617e`).

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- VIS-01 satisfied: striped tokens render on the live board via PieceOverlay (Plan 01) integrated through HexGrid (Plan 04); replay reuses PieceOverlay directly
- UX-05 satisfied: three selection rings (selectable=blue, active=green, activated=orange+X) driven by real game state
- UX-06 satisfied: five hex tint types (risk=orange, goal=red, shot-path=white, kickoff=blue, safe=yellow) with D-12 priority resolution
- Phase 12 complete — all 4 plans landed; VIS-01, VIS-02, UX-05, UX-06 all satisfied
- Phase 13 (Layout & Clock) is unblocked — HexGrid API is stable

## Known Stubs

None — all selectionState and highlightType derivations draw from live game state in the Zustand store. No placeholder data.

## Threat Flags

None — HexGrid is a pure client-side render component with no network endpoints, auth paths, or data persistence.

## Self-Check: PASSED

- `packages/client/src/components/HexGrid.tsx`: exists; contains `selectionState` derivation and `highlightType` priority chain
- `packages/client/src/components/HexGrid.module.css`: `.hexZoIRisk` removed; `.hexTackleRisk` retained
- 56/56 client tests pass (`pnpm --filter @counter-attack/client test`)
- `pnpm tsc --noEmit` exits 0 (clean)
- Task commits 74e6689, a561c2d, 9d0617e present in git log
- Post-checkpoint fix commits f33e9d5, e2a7593, db6e3e4, 243359d, 12d26e0, ad25e6f, 5917fb2 present in git log
- Reverts 7968efc, f9622f0 present in git log (confirming yellow-ball-hex suppression is rolled back)
