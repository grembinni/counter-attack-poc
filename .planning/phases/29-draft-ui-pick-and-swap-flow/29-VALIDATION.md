---
phase: 29
slug: draft-ui-pick-and-swap-flow
status: planned
nyquist_compliant: true
wave_0_complete: true
created: 2026-07-21
---

# Phase 29 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property               | Value                                                                                                                                                                            |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Framework**          | Vitest 2.1.9 (both `packages/server` and `packages/client`), `@testing-library/react` 14.3.1 + `@testing-library/user-event` 14.6.1 for client component tests                   |
| **Config file**        | `packages/client/vite.config.ts` (embedded `test` block, `environment: 'jsdom'`); `packages/server` uses Vitest defaults (no separate config file found — confirm during Wave 0) |
| **Quick run command**  | `pnpm --filter @counter-attack/server test -- <changed-file>` / `pnpm --filter @counter-attack/client test -- <changed-file>` (scoped by filename pattern)                       |
| **Full suite command** | `pnpm -r test` (root-level, runs both packages)                                                                                                                                  |
| **Estimated runtime**  | ~30-60 seconds (monorepo full suite, per prior phase norms — Phase 27)                                                                                                           |

---

## Sampling Rate

- **After every task commit:** Run targeted `vitest run <changed-file>.test.ts(x)` (quick run command above)
- **After every plan wave:** Run `pnpm -r test` (full client + server suite)
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** ~60 seconds

---

## Per-Task Verification Map

> Task ID / Plan / Wave below are filled in from the final Phase 29 plans (29-01 … 29-06, plan-checker pass complete). Each row maps a phase requirement to the plan/task that creates its test coverage per `29-RESEARCH.md`'s Validation Architecture and Security Domain sections.

| Task ID    | Plan          | Wave  | Requirement      | Threat Ref                                      | Secure Behavior                                                                                                                                                               | Test Type            | Automated Command                                                      | File Exists                                                                                                                                             | Status     |
| ---------- | ------------- | ----- | ---------------- | ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| T3         | 29-05         | 3     | DRAFT-06         | —                                               | Draft carousel renders above the lineup grid on the correct screen                                                                                                            | component            | `vitest run src/components/LineupAssignmentScreen.test.tsx -t "draft"` | ✅ Plan 05 Task 3 creates `LineupAssignmentScreen.test.tsx` (new file)                                                                                  | ⬜ pending |
| T2         | 29-04         | 3     | DRAFT-07         | DRAFT_PICK spoofing/tampering (Security Domain) | Pick-and-swap cycle sequencing (1+2+1 ×4, pack swap, new-pack-open) resolves 16 cards/player; server validates `cardId`/`playerSlot` server-side, never trusts client payload | integration (socket) | `vitest run src/__tests__/draftSession.integration.test.ts`            | ✅ Plan 04 Tasks 1-2 create `draftSession.integration.test.ts`                                                                                          | ⬜ pending |
| T1         | 29-02         | 2     | DRAFT-07         | RNG fairness (T-28-04-FAIR precedent)           | Random pack→player assignment is not a fixed 0-3/4-7 split; uses `crypto.randomInt` exclusively                                                                               | unit                 | `vitest run src/draftSession.test.ts`                                  | ✅ Plan 02 Task 1 asserts `assignPackOrders` no-overlap permutation + non-identity shuffle (supersedes the earlier plan to extend `draftPacks.test.ts`) | ⬜ pending |
| T3         | 29-02         | 2     | DRAFT-08         | —                                               | Keeper-safety auto-pick triggers correctly on cycle 4 when no keeper drafted yet                                                                                              | unit                 | `vitest run src/draftSession.test.ts -t "keeper"`                      | ✅ Plan 02 Task 3 (keeper-safety) in `draftSession.test.ts`                                                                                             | ⬜ pending |
| T3         | 29-05         | 3     | DRAFT-09         | —                                               | Bench renders dynamically-sized card list (0 to 16 cards), same visual as draft row                                                                                           | component            | `vitest run src/components/LineupAssignmentScreen.test.tsx`            | ✅ `BenchCarousel` built in Plan 03 Task 2; dynamic-bench render asserted in `LineupAssignmentScreen.test.tsx` (Plan 05 Task 3)                         | ⬜ pending |
| T3 / 04-T2 | 29-02 / 29-04 | 2 / 3 | DRAFT-10         | —                                               | Starters get slot-based numbers; bench gets random unique 15-99 numbers; no auto-repositioning occurs                                                                         | unit + integration   | `vitest run src/draftSession.test.ts -t "numbering"`                   | ✅ Plan 02 Task 3 (`assignBenchNumbers` unit) + Plan 04 Task 2 (integration: distinct 15-99)                                                            | ⬜ pending |
| T3         | 29-04         | 3     | D-13 (reconnect) | Session/reconnect (V3 Session Management)       | Mid-draft reconnect resumes with correct private pack/lineup state — extends existing `sessionToken` mechanism                                                                | integration (socket) | `vitest run src/__tests__/draftReconnect.integration.test.ts`          | ✅ Plan 04 Task 3 creates `draftReconnect.integration.test.ts`                                                                                          | ⬜ pending |

_Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky_

---

## Wave 0 Requirements

> Every gap below is now owned by a specific plan/task (see the map above). `wave_0_complete: true` means the planning coverage is closed; the test files themselves are authored during execution of the owning plan.

- [ ] `packages/server/src/draftSession.ts` + `packages/server/src/draftSession.test.ts` — new pure state-machine module and its unit tests (cycle advance, keeper-safety, bench numbering) — **Plan 02 (Wave 2)**
- [ ] `packages/server/src/__tests__/draftSession.integration.test.ts` — full socket-wire pick-and-swap cycle test, modeled on `lineupAssignment.integration.test.ts`'s existing real-server harness — **Plan 04 Tasks 1-2 (Wave 3)**
- [ ] `packages/server/src/__tests__/draftReconnect.integration.test.ts` — closes the reconnect gap identified in RESEARCH.md Pitfall 3 (only `GAME_STATE` is re-emitted on reconnect today, which is `null` throughout the entire pre-game-start flow) — **Plan 04 Task 3 (Wave 3)**
- [ ] `packages/client/src/components/LineupAssignmentScreen.test.tsx` — currently does not exist at all; needed to cover draft-mode rendering branches without regressing Standard-mode behavior — **Plan 05 Task 3 (Wave 3)**
- [ ] `packages/client/src/components/DraftPackCarousel.test.tsx` — carousel nav, tier-sort, variable pack size (6 vs 7 cards) — **Plan 03 Task 2 (Wave 2)**
- [ ] Pack→player random-assignment coverage — covered by Plan 02 Task 1's `assignPackOrders`/`createDraftSession` fairness tests in `draftSession.test.ts` (the room-level assignment now lives in `draftSession.ts`, not `draftPacks.ts`) — **Plan 02 (Wave 2)**

---

## Manual-Only Verifications

_All phase behaviors have automated verification per the map above. The Plan 06 two-browser human-verify checkpoint is a confirmation layer on top of the automated coverage (re-confirms A1 phase-boundary gating), not a substitute for it._

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 60s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** reconciled against final `PLAN.md` task IDs (plan-checker pass complete, 2026-07-21).
