---
phase: 41
slug: card-injury-iconography
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-21
---

# Phase 41 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property               | Value                                                                                           |
| ---------------------- | ----------------------------------------------------------------------------------------------- |
| **Framework**          | Vitest (already configured per every sibling `*.test.tsx` in `packages/client/src/components/`) |
| **Config file**        | `packages/client/vitest.config.ts` (existing)                                                   |
| **Quick run command**  | `pnpm --filter @counter-attack/client test -- <touched-file-name>`                              |
| **Full suite command** | `pnpm --filter @counter-attack/client test`                                                     |
| **Estimated runtime**  | ~30-60 seconds (full client suite)                                                              |

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter @counter-attack/client test -- <touched-file-name>`
- **After every plan wave:** Run `pnpm --filter @counter-attack/client test` (full client suite)
- **Before `/gsd-verify-work`:** Full suite must be green, plus the ICON-01 grep audit (below) returning zero matches
- **Max feedback latency:** ~60 seconds

---

## Per-Task Verification Map

| Task ID  | Plan | Wave | Requirement                                 | Threat Ref | Secure Behavior | Test Type         | Automated Command                                                                                                                                            | File Exists                                  | Status     |
| -------- | ---- | ---- | ------------------------------------------- | ---------- | --------------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------- | ---------- |
| 41-01-01 | 01   | 0    | ICON-01                                     | —          | N/A             | unit              | `pnpm --filter @counter-attack/client test -- CardInjuryBadge`                                                                                               | ❌ W0 (new file)                             | ⬜ pending |
| 41-01-02 | 01   | 0    | ICON-01                                     | —          | N/A             | static/grep audit | `grep -rn "redCarded === true ?" packages/client/src/components --include="*.tsx" \| grep -v CardInjuryBadge.tsx` (expect empty)                             | N/A — audit step                             | ⬜ pending |
| 41-01-03 | TBD  | TBD  | ICON-02                                     | —          | N/A             | unit              | `PlayerStatsPanel.test.tsx` glyph-presence assertions (replaces `.textContent` INJ/INJ x2 assertions)                                                        | ✅ existing file, ❌ new assertions          | ⬜ pending |
| 41-01-04 | TBD  | TBD  | ICON-02                                     | —          | N/A             | unit              | `LineupAssignmentScreen.test.tsx` glyph-presence assertions (replaces `.textContent` INJ/INJ x2 assertions)                                                  | ✅ existing file, ❌ new assertions          | ⬜ pending |
| 41-01-05 | TBD  | TBD  | ICON-02                                     | —          | N/A             | unit              | Side-by-side card+injury geometry assertion (D-04), mirrors `PieceOverlay.test.tsx:315-320`                                                                  | ❌ W0 (new assertion)                        | ⬜ pending |
| 41-01-06 | TBD  | TBD  | ICON-03                                     | —          | N/A             | unit              | New `BenchCarousel.test.tsx`/`DraftPackCarousel.test.tsx` coverage for `redCarded`/booked/injured bench glyph rendering                                      | ❌ W0 (genuine gap — zero existing coverage) | ⬜ pending |
| 41-01-07 | TBD  | TBD  | ICON-03 (bench data model)                  | —          | N/A             | unit (server)     | New test asserting `yellowCards`/`injuryCount` survive onto `BenchEntry` at both construction sites (`relocateRedCardedToBench`, substitution bench-rewrite) | ❌ W0 (new server-side test)                 | ⬜ pending |
| 41-01-08 | TBD  | TBD  | Success Criterion 3 (mid-match consistency) | —          | N/A             | integration       | `LineupAssignmentScreen.test.tsx` — roster glyph updates after simulated `BOOKING_CHECK`/`INJURY_CHECK` state change                                         | ❌ W0 (new integration-style test)           | ⬜ pending |

_Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky_
_Task IDs above are illustrative — the planner assigns final plan/task numbering._

---

## Wave 0 Requirements

- [ ] `CardInjuryBadge.test.tsx` — new file, covers ICON-01/02 (component-level: `cardColorFor` precedence, standalone-vs-group rendering, side-by-side vs. overlapping layout)
- [ ] `BenchCarousel.test.tsx` / `DraftPackCarousel.test.tsx` extension — covers ICON-03 (currently zero coverage of `redCarded`/`unavailable` badge rendering)
- [ ] `PlayerStatsPanel.test.tsx` / `LineupAssignmentScreen.test.tsx` updates — rewrite `.textContent`-based `'INJ'`/`'INJ ×2'` assertions to glyph-presence assertions
- [ ] Server-side test for `BenchEntry` field propagation (`yellowCards`/`injuryCount` at the two `gameEngine.ts` construction sites) — required since the bench-scope decision (2026-08-21) is to extend `BenchEntry`, not scope to red-card-only
- [ ] Framework install: none — Vitest already configured project-wide

---

## Manual-Only Verifications

_None — all phase behaviors have automated verification per the Phase Requirements → Test Map above._

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
