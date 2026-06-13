---
phase: 13
slug: layout-clock
status: complete
nyquist_compliant: false
wave_0_complete: true
created: 2026-06-12
audited: 2026-06-12
---

# Phase 13 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property                | Value                                                                                    |
| ----------------------- | ---------------------------------------------------------------------------------------- |
| **Framework**           | Vitest 2.1.9 + @testing-library/react (jsdom environment)                                |
| **Config file**         | `packages/client/vitest.config.ts`                                                       |
| **Phase13 run command** | `pnpm --filter @counter-attack/client exec vitest run src/components/GameBoard.test.tsx` |
| **Full suite command**  | `pnpm --filter @counter-attack/client exec vitest run`                                   |
| **Estimated runtime**   | ~4 seconds (phase13 tests only)                                                          |

---

## Sampling Rate

- **After every task commit:** Run GameBoard.test.tsx
- **After every plan wave:** Run full client suite
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** ~15 seconds

---

## Per-Task Verification Map

| Task ID  | Plan  | Wave | Requirement                              | Test File              | Test Description                                                                                                | Status   |
| -------- | ----- | ---- | ---------------------------------------- | ---------------------- | --------------------------------------------------------------------------------------------------------------- | -------- |
| 13-01-T1 | 13-01 | 0    | LAYOUT-01, LAYOUT-02, CLOCK-01, CLOCK-02 | GameBoard.test.tsx     | Wave 0 scaffold: 15 RED tests created before GameBoard rewrite (P13-02 drives GREEN)                            | ✅ green |
| 13-02-T1 | 13-02 | 1    | CLOCK-01                                 | GameBoard.test.tsx     | actionCount=7→"7:00", actionCount=45→"45:00", actionCount=46→"46:00", actionCount=0→"0:00" (×4 tests)           | ✅ green |
| 13-02-T1 | 13-02 | 1    | CLOCK-02                                 | GameBoard.test.tsx     | Clock visible in HALF_TIME, KICK_OFF_SETUP, FULL_TIME, REPLAY phases (×4 tests)                                 | ✅ green |
| 13-02-T1 | 13-02 | 1    | LAYOUT-01                                | GameBoard.test.tsx     | Home score "2" + away "1", default 0/0, large scores 3/2 (×3 tests)                                             | ✅ green |
| 13-02-T1 | 13-02 | 1    | LAYOUT-02                                | GameBoard.test.tsx     | KickOffSetupPanel in KICK_OFF_SETUP, ReplayPanel in REPLAY, ActionPanel in MOVEMENT, log chevron "›" (×4 tests) | ✅ green |
| 13-02-T2 | 13-02 | 1    | LAYOUT-01, LAYOUT-02                     | GameBoard.test.tsx     | GameBoard.module.css rewrite: top-band grid, overlay anchoring, clock styles — covered by full build + tests    | ✅ green |
| 13-03-T1 | 13-03 | 2    | LAYOUT-01, CLOCK-02                      | GameBoard.test.tsx     | App.tsx routing: HALF_TIME/FULL_TIME fall through to GameBoard; Screen type trimmed                             | ✅ green |
| 13-03-T2 | 13-03 | 2    | —                                        | — (build verification) | Delete retired TurnIndicator, HalfTimeScreen, FullTimeScreen — 71/71 tests green post-deletion                  | ✅ green |

_Status: ⬜ pending · ✅ green · ❌ red · ⚠️ manual/flaky_

**Test counts:** 15 tests in GameBoard.test.tsx — all passing

---

## Wave 0 Requirements

Wave 0 was applied as Plan 13-01 — GameBoard.test.tsx was created with 15 RED tests before Plan 13-02 began implementation. This is the correct RED→GREEN Nyquist pattern.

- [x] `packages/client/src/components/GameBoard.test.tsx` — created in P13-01 with 15 failing assertions before P13-02 implementation

---

## Manual-Only Verifications

| Behavior                                    | Requirement          | Why Manual                                      | Test Instructions                                                                                                                                              |
| ------------------------------------------- | -------------------- | ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Top band renders correctly at 1080p desktop | LAYOUT-01, LAYOUT-02 | Visual layout cannot be fully verified in jsdom | Launch `pnpm --filter @counter-attack/client dev`, open two browser tabs, join same room; verify top band has scoreboard + action section visible at all times |
| Clock displays during HALF_TIME overlay     | CLOCK-02             | jsdom doesn't render CSS overlays               | Reach half time in a 2-player session; verify clock MM:SS is visible above overlay card                                                                        |
| Log section expands/collapses on click      | LAYOUT-02            | Interaction test                                | Click `›` chevron in top band; verify log expands to 240px; click `‹` to collapse                                                                              |

---

## Validation Sign-Off

- [x] All tasks have automated verify or documented Manual-Only reason
- [x] Wave 0 applied before execution (Plan 13-01 was Wave 0 scaffold)
- [x] Sampling continuity: all phase13 tests run in ~4s
- [x] No watch-mode flags
- [x] Feedback latency < 15s
- [ ] `nyquist_compliant: true` — 3 manual-only gaps prevent full compliance

**Approval:** partial — 15/15 automatable tasks covered; 3 browser UAT items marked manual-only (top-band 1080p layout, HALF_TIME clock visibility above overlay, log toggle expand/collapse)

---

## Validation Audit 2026-06-12

| Metric               | Count |
| -------------------- | ----- |
| Gaps found           | 0     |
| Resolved (automated) | 0     |
| Marked manual-only   | 3     |
| Tests passing        | 15/15 |
