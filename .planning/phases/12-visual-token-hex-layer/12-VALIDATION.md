---
phase: 12
slug: visual-token-hex-layer
status: complete
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-12
audited: 2026-06-12
---

# Phase 12 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property                | Value                                                                                                                                                                |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Framework**           | Vitest 2.1.9 + @testing-library/react                                                                                                                                |
| **Config file**         | `packages/client/vitest.config.ts`                                                                                                                                   |
| **Phase12 run command** | `pnpm --filter @counter-attack/client exec vitest run src/components/PieceOverlay.test.tsx src/components/HexCell.test.tsx src/components/PlayerStatsPanel.test.tsx` |
| **Full suite command**  | `pnpm --filter @counter-attack/client exec vitest run`                                                                                                               |
| **Estimated runtime**   | ~2 seconds (phase12 tests only)                                                                                                                                      |

---

## Sampling Rate

- **After every task commit:** Run phase12 test triplet
- **After every plan wave:** Run full client suite
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** ~15 seconds

---

## Per-Task Verification Map

| Task ID  | Plan  | Wave | Requirement | Test File                  | Test Description                                                               | Status    |
| -------- | ----- | ---- | ----------- | -------------------------- | ------------------------------------------------------------------------------ | --------- |
| 12-01-T1 | 12-01 | 1    | VIS-01      | PieceOverlay.test.tsx      | Home outfield fill → url(#home-stripe-\<id>)                                   | ✅ green  |
| 12-01-T1 | 12-01 | 1    | VIS-01      | PieceOverlay.test.tsx      | Away outfield fill → url(#away-stripe-\<id>)                                   | ✅ green  |
| 12-01-T1 | 12-01 | 1    | VIS-01      | PieceOverlay.test.tsx      | Home GK: solid fill #9b59b6, no stripe url                                     | ✅ green  |
| 12-01-T1 | 12-01 | 1    | VIS-01      | PieceOverlay.test.tsx      | Away GK: solid fill #f59e0b, no stripe url                                     | ✅ green  |
| 12-01-T2 | 12-01 | 1    | UX-05       | PieceOverlay.test.tsx      | selectionState='selectable' → ring stroke #3b82f6                              | ✅ green  |
| 12-01-T2 | 12-01 | 1    | UX-05       | PieceOverlay.test.tsx      | selectionState='active' → ring stroke #22c55e                                  | ✅ green  |
| 12-01-T2 | 12-01 | 1    | UX-05       | PieceOverlay.test.tsx      | selectionState='activated' → orange ring + red X path                          | ✅ green  |
| 12-01-T2 | 12-01 | 1    | UX-05       | PieceOverlay.test.tsx      | selectionState='none' → no ring circle rendered                                | ✅ green  |
| 12-02-T1 | 12-02 | 1    | UX-06       | HexCell.test.tsx           | highlightType='safe' → overlay polygon fill rgba(245,197,24,1)                 | ✅ green  |
| 12-02-T1 | 12-02 | 1    | UX-06       | HexCell.test.tsx           | highlightType='risk' → overlay polygon fill rgba(255,140,0,1)                  | ✅ green  |
| 12-02-T1 | 12-02 | 1    | UX-06       | HexCell.test.tsx           | highlightType='goal' → overlay polygon fill rgba(220,50,50,1)                  | ✅ green  |
| 12-02-T1 | 12-02 | 1    | UX-06       | HexCell.test.tsx           | highlightType='kickoff' → overlay polygon fill rgba(59,130,246,1)              | ✅ green  |
| 12-02-T1 | 12-02 | 1    | UX-06       | HexCell.test.tsx           | highlightType='shot-path' → overlay fill rgba(255,255,255,1)                   | ✅ green  |
| 12-02-T1 | 12-02 | 1    | UX-06       | HexCell.test.tsx           | highlightType='shot-path-action' → overlay fill rgba(255,255,255,1)            | ✅ green  |
| 12-02-T1 | 12-02 | 1    | UX-06       | HexCell.test.tsx           | highlightType=undefined → base polygon only, no tint overlay                   | ✅ green  |
| 12-03-T1 | 12-03 | 2    | VIS-02      | PlayerStatsPanel.test.tsx  | Home outfield: mini-token url(#mini-home-stripe-\<id>) + pattern def           | ✅ green  |
| 12-03-T1 | 12-03 | 2    | VIS-02      | PlayerStatsPanel.test.tsx  | Away outfield: mini-token url(#mini-away-stripe-\<id>) + pattern def           | ✅ green  |
| 12-03-T1 | 12-03 | 2    | VIS-02      | PlayerStatsPanel.test.tsx  | GK: solid fill, no stripe url, no mini-... pattern                             | ✅ green  |
| 12-04-T1 | 12-04 | 2    | UX-05       | — (HexGrid wiring, manual) | selectionState derived per piece in HexGrid (active/activated/selectable/none) | ⚠️ manual |
| 12-04-T2 | 12-04 | 2    | UX-06       | — (HexGrid wiring, manual) | highlightType priority resolution: risk > goal > shot-path > kickoff > safe    | ⚠️ manual |

_Status: ⬜ pending · ✅ green · ❌ red · ⚠️ manual/flaky_

**Test counts:** 22 tests across 3 files — all passing

---

## Wave 0 Requirements

Wave 0 was not applied before execution — test files were created as part of plan execution:

- `PieceOverlay.test.tsx` created in Plan 12-01 (Wave 1)
- `HexCell.test.tsx` created in Plan 12-02 (Wave 1)
- `PlayerStatsPanel.test.tsx` extended in Plan 12-03 (Wave 2)

This is the historical record. No retroactive Wave 0 action required.

---

## Manual-Only Verifications

| Behavior                                                                                                                                                     | Requirement      | Why Manual                                                                                                                                                                                                           | Test Instructions                                                                                                                                          |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| HexGrid derives selectionState='active' for selected piece, 'activated' for spent pieces, 'selectable' for eligible unselected pieces, 'none' for ineligible | UX-05 (wiring)   | Skipped: automatable via @testing-library/react but user chose to skip. Leaf component (PieceOverlay) tests cover rendering contract. HexGrid.tsx lines 613–651 implement the derivation as direct game-state reads. | Mount HexGrid with known game state. Verify active piece has green ring, spent piece has orange ring+X, eligible piece has blue ring.                      |
| HexGrid resolves highlightType by priority: risk > goal > shot-path > kickoff > safe (single ternary D-12)                                                   | UX-06 (priority) | Skipped: automatable but user chose to skip. HexCell tests cover all 5 tint styles. Priority ternary is a single expression at HexGrid.tsx lines 346–412.                                                            | Set up a hex with both risk (ZoI) and safe (valid move) flags active. Verify orange (risk) tint wins over yellow (safe).                                   |
| Stripe visual appearance at PIECE_RADIUS=12                                                                                                                  | VIS-01, VIS-02   | Color rendering is subjective                                                                                                                                                                                        | Open game board, verify home tokens show vertical black stripe, away tokens show two horizontal dark bands; confirm both readable against pitch background |
| Selection ring visual distinctness (3 states simultaneously)                                                                                                 | UX-05            | Multiple ring states visible at once requires human evaluation                                                                                                                                                       | Trigger a move sequence so selectable, active, and activated pieces are all visible; verify blue/green/orange rings are distinct                           |
| Hex tint distinctness (all 5 types)                                                                                                                          | UX-06            | Color perception and contrast against grass background                                                                                                                                                               | Trigger each highlight type; verify orange/red/yellow/blue/white are clearly distinct on #3d6b34 grass                                                     |

---

## Validation Sign-Off

- [x] All tasks have automated verify or documented Manual-Only reason
- [ ] Wave 0 applied before execution (not done — tests created during execution)
- [x] Sampling continuity: all phase12 tests run in ~2s
- [x] No watch-mode flags
- [x] Feedback latency < 15s
- [ ] `nyquist_compliant: true` — 2 manual-only gaps prevent full compliance

**Approval:** partial — 20/22 automatable tasks covered; 2 HexGrid wiring tests marked manual-only by user choice (2026-06-12)

---

## Validation Audit 2026-06-12

| Metric               | Count |
| -------------------- | ----- |
| Gaps found           | 2     |
| Resolved (automated) | 0     |
| Marked manual-only   | 2     |
| Tests passing        | 22/22 |
