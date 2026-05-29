---
phase: 3
slug: server-room-manager-socket-io-scaffold
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-29
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property               | Value                                                            |
| ---------------------- | ---------------------------------------------------------------- |
| **Framework**          | Vitest 2.x (matching `packages/shared`)                          |
| **Config file**        | `packages/server/vitest.config.ts` — Wave 0 gap, must be created |
| **Quick run command**  | `pnpm --filter @counter-attack/server test`                      |
| **Full suite command** | `pnpm --filter @counter-attack/server test`                      |
| **Estimated runtime**  | ~5 seconds                                                       |

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter @counter-attack/server build`
- **After every plan wave:** Run `pnpm --filter @counter-attack/server test`
- **Before `/gsd-verify-work`:** `pnpm -r build` green + `pnpm --filter @counter-attack/server test` green
- **Max feedback latency:** ~10 seconds

---

## Per-Task Verification Map

| Req ID  | Behavior                                                                   | Test Type   | Automated Command                            | File Exists | Status     |
| ------- | -------------------------------------------------------------------------- | ----------- | -------------------------------------------- | ----------- | ---------- |
| CONN-01 | `createRoom()` returns unique 5-char alphanumeric code + sessionToken      | unit        | `pnpm --filter @counter-attack/server test`  | ❌ Wave 0   | ⬜ pending |
| CONN-01 | Two `createRoom()` calls never return the same room code                   | unit        | `pnpm --filter @counter-attack/server test`  | ❌ Wave 0   | ⬜ pending |
| CONN-02 | `joinRoom()` assigns slot=2 and transitions room to 'playing'              | unit        | `pnpm --filter @counter-attack/server test`  | ❌ Wave 0   | ⬜ pending |
| CONN-03 | Both players joining triggers `game:state` broadcast with `phase: 'LOBBY'` | integration | `pnpm --filter @counter-attack/server test`  | ❌ Wave 0   | ⬜ pending |
| CONN-04 | `joinRoom()` rejects unknown room code with `room:error`                   | unit        | `pnpm --filter @counter-attack/server test`  | ❌ Wave 0   | ⬜ pending |
| CONN-04 | `joinRoom()` rejects room with status 'playing' with distinct error        | unit        | `pnpm --filter @counter-attack/server test`  | ❌ Wave 0   | ⬜ pending |
| ARCH-01 | State mutations only occur server-side                                     | manual-only | N/A — architectural constraint               | manual      | ⬜ pending |
| ARCH-04 | Every state change emits full `GameState` via `game:state`                 | integration | `pnpm --filter @counter-attack/server test`  | ❌ Wave 0   | ⬜ pending |
| SC-3    | Reconnect within 90s cancels grace timer + re-emits state                  | integration | `pnpm --filter @counter-attack/server test`  | ❌ Wave 0   | ⬜ pending |
| SC-5    | `GET /health` returns HTTP 200                                             | smoke       | `curl http://localhost:PORT/health` (manual) | ❌ Wave 0   | ⬜ pending |

_Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky_

---

## Wave 0 Requirements

- [ ] `packages/server/vitest.config.ts` — Vitest config for server package
- [ ] `packages/server/src/__tests__/roomStore.test.ts` — unit tests: createRoom, joinRoom, findPlayerByToken
- [ ] `packages/server/src/__tests__/room.integration.test.ts` — Socket.io integration tests (CONN-03, ARCH-04, SC-3)
- [ ] Install: `pnpm add -D --filter @counter-attack/server vitest@2 socket.io-client @vitest/coverage-v8`

---

## Manual-Only Verifications

| Behavior                               | Requirement | Why Manual                                                   | Test Instructions                                              |
| -------------------------------------- | ----------- | ------------------------------------------------------------ | -------------------------------------------------------------- |
| State mutations only occur server-side | ARCH-01     | Architectural constraint — code review, not testable in unit | Review that no game state calculation occurs in client package |
| `GET /health` returns 200 from ALB     | SC-5        | AWS ALB health check tested at deploy time                   | `curl http://localhost:PORT/health` returns `{"status":"ok"}`  |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
