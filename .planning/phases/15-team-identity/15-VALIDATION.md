---
phase: 15
slug: team-identity
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-13
---

# Phase 15 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property               | Value                                                                                              |
| ---------------------- | -------------------------------------------------------------------------------------------------- |
| **Framework**          | vitest (client unit tests) + TypeScript compiler                                                   |
| **Config file**        | `packages/client/vitest.config.ts`                                                                 |
| **Quick run command**  | `pnpm --filter @counter-attack/shared typecheck && pnpm --filter @counter-attack/client typecheck` |
| **Full suite command** | `pnpm -r typecheck && pnpm --filter @counter-attack/client test --run`                             |
| **Estimated runtime**  | ~30 seconds                                                                                        |

---

## Sampling Rate

- **After every task commit:** Run `pnpm -r typecheck`
- **After every plan wave:** Run `pnpm -r typecheck && pnpm --filter @counter-attack/client test --run`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID  | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type           | Automated Command                                | File Exists | Status     |
| -------- | ---- | ---- | ----------- | ---------- | --------------- | ------------------- | ------------------------------------------------ | ----------- | ---------- |
| 15-01-01 | 01   | 1    | TEAM-01     | —          | N/A             | type-check          | `pnpm --filter @counter-attack/shared typecheck` | ✅ W0       | ⬜ pending |
| 15-01-02 | 01   | 1    | TEAM-01     | —          | N/A             | type-check          | `pnpm --filter @counter-attack/shared typecheck` | ✅ W0       | ⬜ pending |
| 15-02-01 | 02   | 2    | TEAM-02     | —          | N/A             | visual              | manual — browser inspection                      | N/A         | ⬜ pending |
| 15-02-02 | 02   | 2    | TEAM-03     | —          | N/A             | visual              | manual — browser inspection                      | N/A         | ⬜ pending |
| 15-03-01 | 03   | 3    | TEAM-04     | —          | N/A             | visual              | manual — browser inspection                      | N/A         | ⬜ pending |
| 15-03-02 | 03   | 3    | TEAM-05     | —          | N/A             | visual              | manual — browser inspection                      | N/A         | ⬜ pending |
| 15-04-01 | 04   | 4    | TEAM-06     | —          | N/A             | type-check + visual | `pnpm -r typecheck` + browser                    | N/A         | ⬜ pending |

_Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky_

---

## Wave 0 Requirements

- [ ] `packages/shared/src/teamConfig.ts` — TeamConfig type + TEAM_CONFIGS record stubbed
- [ ] `packages/shared/src/index.ts` — re-exports TeamConfig, TeamId, TEAM_CONFIGS
- [ ] `packages/client/src/assets/badges/` — cosmos.png, xolos.png, city.png, crew.png present

_Existing TypeScript + Vitest infrastructure covers automated verification; Wave 0 only needs type stubs + asset presence checks._

---

## Manual-Only Verifications

| Behavior                                  | Requirement | Why Manual                                           | Test Instructions                                                                                       |
| ----------------------------------------- | ----------- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Jersey patterns render correctly per team | TEAM-03     | SVG visual fidelity cannot be asserted in unit tests | Open game in browser; verify Cosmos horizontal stripe, Xolos checker, City arch, Crew shoulder diagonal |
| GK jerseys show checker/stripe patterns   | TEAM-03     | Visual-only                                          | Open game; verify home GK has purple checker, away GK has amber+orange stripes                          |
| TeamBadge appears in scoreboard top band  | TEAM-05     | DOM inspection needed                                | Open match view; verify badge images appear for both home/away in the top scoreboard band               |
| Badge images are visually distinct        | TEAM-02     | Human judgment                                       | Inspect cosmos.png, xolos.png, city.png, crew.png — confirm each is unique and thematically correct     |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
