---
phase: 6
slug: react-hex-grid-renderer
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-05-31
---

# Phase 6 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property               | Value                                                |
| ---------------------- | ---------------------------------------------------- |
| **Framework**          | vitest 2.1.9                                         |
| **Config file**        | `packages/client/vitest.config.ts` — Wave 0 installs |
| **Quick run command**  | `pnpm --filter @counter-attack/client test`          |
| **Full suite command** | `pnpm -r test`                                       |
| **Estimated runtime**  | ~15 seconds                                          |

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter @counter-attack/shared test` (protect pitch.ts changes) or `pnpm --filter @counter-attack/client test` (for client tasks)
- **After every plan wave:** Run `pnpm -r test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** ~15 seconds

---

## Per-Task Verification Map

| Task ID                | Plan   | Wave   | Requirement     | Threat Ref | Secure Behavior                                                                    | Test Type | Automated Command                           | File Exists   | Status     |
| ---------------------- | ------ | ------ | --------------- | ---------- | ---------------------------------------------------------------------------------- | --------- | ------------------------------------------- | ------------- | ---------- |
| pitch.ts 37×26         | shared | W0     | PITCH-02        | —          | Region membership is O(1) Set lookup; no boundary math at call time                | unit      | `pnpm --filter @counter-attack/shared test` | ❌ W0 rewrite | ⬜ pending |
| useGameStore           | client | W0     | PITCH-04, UX-02 | —          | selectPiece only calls validateMove on pace-range candidates (not all 962 hexes)   | unit      | `pnpm --filter @counter-attack/client test` | ❌ W0         | ⬜ pending |
| movePiece store action | client | W0     | PITCH-04        | —          | movePiece clears selectedPieceId and validMoveHexes after move                     | unit      | `pnpm --filter @counter-attack/client test` | ❌ W0         | ⬜ pending |
| hexToPixel utility     | client | W0     | —               | —          | axialToPixel(0,0,20) = {cx:0, cy:0}; axialToPixel(1,0,20) = {cx:30, cy:17.32}      | unit      | `pnpm --filter @counter-attack/client test` | ❌ W0         | ⬜ pending |
| BallMarker renders     | client | render | PITCH-05        | —          | Ball visible as off-white circle distinct from piece circles                       | manual    | visual inspection                           | —             | ⬜ pending |
| TurnIndicator          | client | render | UX-01           | —          | Phase label, team name, slot + moves-remaining shown correctly for each mock state | manual    | visual inspection per mock state            | —             | ⬜ pending |
| ActionLog              | client | render | UX-03, UX-04    | —          | Last 10 events shown newest-first; empty state shows "No actions yet."             | manual    | visual inspection                           | —             | ⬜ pending |
| Lobby screens          | client | render | —               | —          | Create/Join/Waiting screens navigable by sub-links without server                  | manual    | visual inspection                           | —             | ⬜ pending |

_Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky_

---

## Wave 0 Requirements

- [x] `packages/client/vitest.config.ts` — test runner config with jsdom environment (Plan 06-01 Task 2)
- [x] `packages/client/src/store/useGameStore.test.ts` — covers PITCH-04, UX-02 (selectPiece, movePiece) (Plan 06-01 Task 3)
- [x] Rewrite `packages/shared/src/pitch.test.ts` — covers PITCH-02 for 37×26 grid (all 11 assertions must be updated: PITCH_HEXES.length → 962, kickoff hex → {q:18,r:13}, region boundary tests for D-05 values) (Plan 06-01 Task 1)

---

## Manual-Only Verifications

| Behavior                                                                                         | Requirement | Why Manual                                            | Test Instructions                                                                                                              |
| ------------------------------------------------------------------------------------------------ | ----------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| SVG pitch renders 962 hexes at correct positions with flat-top orientation                       | PITCH-01    | SVG coordinate geometry requires visual verification  | Open app at 1280px; inspect first hex (q=0,r=0) and last hex (q=36,r=25) are in correct positions                              |
| Ball marker is visually distinct from piece circles at all times                                 | PITCH-05    | Color/size distinction is a visual property           | Load mockMovementState; confirm ball is off-white circle, smaller than piece circles                                           |
| Turn indicator shows active team, phase, slot, remaining moves                                   | UX-01       | Multi-field panel is render-only                      | Load each mock state; verify all 4 fields update correctly                                                                     |
| Valid-move hexes highlight gold on piece selection; non-highlighted hexes have no click response | UX-02       | Click interaction + visual highlight requires browser | Select an own-team piece in MOVEMENT phase; click highlighted hex (should move); click non-highlighted hex (should do nothing) |
| Action log renders ActionEvent types correctly in reverse-chronological order                    | UX-03       | Rendering correctness is visual                       | Load mockMovementState with eventLog entries; verify order and format                                                          |
| Lobby screens (Create/Join/Waiting) navigable in isolation                                       | —           | Screen routing is UI interaction                      | Navigate between lobby screens using sub-links; verify no server calls made                                                    |
| Half-hex clipping: top and bottom rows of hexes are visually clipped                             | —           | SVG clipPath is visual                                | Inspect top-row (r=0) and bottom-row (r=25) hexes are half-clipped                                                             |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
