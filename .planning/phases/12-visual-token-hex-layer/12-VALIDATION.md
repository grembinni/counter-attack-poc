---
phase: 12
slug: visual-token-hex-layer
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-12
---

# Phase 12 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property               | Value                                       |
| ---------------------- | ------------------------------------------- |
| **Framework**          | Vitest + @testing-library/react             |
| **Config file**        | `packages/client/vitest.config.ts`          |
| **Quick run command**  | `pnpm --filter @counter-attack/client test` |
| **Full suite command** | `pnpm --filter @counter-attack/client test` |
| **Estimated runtime**  | ~15 seconds                                 |

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter @counter-attack/client test`
- **After every plan wave:** Run `pnpm --filter @counter-attack/client test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** ~15 seconds

---

## Per-Task Verification Map

| Task ID  | Plan | Wave | Requirement   | Threat Ref | Secure Behavior | Test Type | Automated Command                                                    | File Exists | Status     |
| -------- | ---- | ---- | ------------- | ---------- | --------------- | --------- | -------------------------------------------------------------------- | ----------- | ---------- |
| 12-01-01 | 01   | 0    | VIS-01, UX-05 | —          | N/A             | unit      | `pnpm --filter @counter-attack/client test -- --grep "PieceOverlay"` | ❌ W0       | ⬜ pending |
| 12-01-02 | 01   | 0    | UX-06         | —          | N/A             | unit      | `pnpm --filter @counter-attack/client test -- --grep "HexCell"`      | ❌ W0       | ⬜ pending |
| 12-02-01 | 02   | 1    | VIS-01, UX-05 | —          | N/A             | unit      | `pnpm --filter @counter-attack/client test -- --grep "PieceOverlay"` | ❌ W0       | ⬜ pending |
| 12-02-02 | 02   | 1    | UX-06         | —          | N/A             | unit      | `pnpm --filter @counter-attack/client test -- --grep "HexCell"`      | ❌ W0       | ⬜ pending |
| 12-03-01 | 03   | 2    | VIS-02        | —          | N/A             | unit      | `pnpm --filter @counter-attack/client test`                          | ✅ (extend) | ⬜ pending |
| 12-04-01 | 04   | 2    | UX-05, UX-06  | —          | N/A             | unit      | `pnpm --filter @counter-attack/client test`                          | ✅          | ⬜ pending |

_Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky_

---

## Wave 0 Requirements

- [ ] `packages/client/src/components/PieceOverlay.test.tsx` — stubs for VIS-01, UX-05
- [ ] `packages/client/src/components/HexCell.test.tsx` — stubs for UX-06

Existing `PlayerStatsPanel.test.tsx` can be extended in-place to cover VIS-02 (mini token badge presence).

---

## Manual-Only Verifications

| Behavior                                                     | Requirement    | Why Manual                                                                                 | Test Instructions                                                                                                                                          |
| ------------------------------------------------------------ | -------------- | ------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Stripe visual appearance at PIECE_RADIUS=12                  | VIS-01, VIS-02 | Color rendering is subjective; automated tests check attribute presence not visual quality | Open game board, verify home tokens show vertical black stripe, away tokens show two horizontal dark bands; confirm both readable against pitch background |
| Selection ring visual distinctness (3 states simultaneously) | UX-05          | Multiple ring states visible at once requires human evaluation                             | Trigger a move sequence so a selectable, active, and activated piece are all visible; verify blue/green/orange rings are distinct                          |
| Hex tint distinctness (all 5 types)                          | UX-06          | Color perception and contrast against grass is a visual judgment                           | Trigger each highlight type and verify orange/red/yellow/blue/white are clearly distinct on `#3d6b34` grass                                                |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
