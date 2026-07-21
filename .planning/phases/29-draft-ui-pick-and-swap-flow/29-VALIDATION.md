---
phase: 29
slug: draft-ui-pick-and-swap-flow
status: draft
nyquist_compliant: false
wave_0_complete: false
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

> Task ID / Plan / Wave are TBD — assigned when the planner creates `PLAN.md`. Rows below map each phase requirement to its expected test coverage per `29-RESEARCH.md`'s Validation Architecture and Security Domain sections; the planner/executor must fill in exact Task IDs and confirm this table stays accurate.

| Task ID | Plan | Wave | Requirement      | Threat Ref                                      | Secure Behavior                                                                                                                                                               | Test Type            | Automated Command                                                                                     | File Exists                                                                                    | Status     |
| ------- | ---- | ---- | ---------------- | ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- | ----------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ---------- |
| TBD     | TBD  | TBD  | DRAFT-06         | —                                               | Draft carousel renders above the lineup grid on the correct screen                                                                                                            | component            | `vitest run src/components/LineupAssignmentScreen.test.tsx -t "draft"`                                | ❌ Wave 0 — no existing `LineupAssignmentScreen.test.tsx` found; new test file needed          | ⬜ pending |
| TBD     | TBD  | TBD  | DRAFT-07         | DRAFT_PICK spoofing/tampering (Security Domain) | Pick-and-swap cycle sequencing (1+2+1 ×4, pack swap, new-pack-open) resolves 16 cards/player; server validates `cardId`/`playerSlot` server-side, never trusts client payload | integration (socket) | `vitest run src/__tests__/draftSession.integration.test.ts`                                           | ❌ Wave 0 — new file, model on `lineupAssignment.integration.test.ts`'s real Socket.io harness | ⬜ pending |
| TBD     | TBD  | TBD  | DRAFT-07         | RNG fairness (T-28-04-FAIR precedent)           | Random pack→player assignment is not a fixed 0-3/4-7 split; uses `crypto.randomInt` exclusively                                                                               | unit                 | `vitest run src/__tests__/draftPacks.test.ts -t "assignment"`                                         | 🟡 existing file (`draftPacks.test.ts`) covers pack generation only — extend, don't duplicate  | ⬜ pending |
| TBD     | TBD  | TBD  | DRAFT-08         | —                                               | Keeper-safety auto-pick triggers correctly on cycle 4 when no keeper drafted yet                                                                                              | unit                 | `vitest run src/draftSession.test.ts -t "keeper"`                                                     | ❌ Wave 0 — new `draftSession.ts` module needs its own unit test file                          | ⬜ pending |
| TBD     | TBD  | TBD  | DRAFT-09         | —                                               | Bench renders dynamically-sized card list (0 to 16 cards), same visual as draft row                                                                                           | component            | `vitest run src/components/BenchCarousel.test.tsx` (or folded into `LineupAssignmentScreen.test.tsx`) | ❌ Wave 0                                                                                      | ⬜ pending |
| TBD     | TBD  | TBD  | DRAFT-10         | —                                               | Starters get slot-based numbers; bench gets random unique 15-99 numbers; no auto-repositioning occurs                                                                         | unit + integration   | `vitest run src/__tests__/draftSession.test.ts -t "numbering"`                                        | ❌ Wave 0                                                                                      | ⬜ pending |
| TBD     | TBD  | TBD  | D-13 (reconnect) | Session/reconnect (V3 Session Management)       | Mid-draft reconnect resumes with correct private pack/lineup state — extends existing `sessionToken` mechanism                                                                | integration (socket) | `vitest run src/__tests__/draftReconnect.integration.test.ts`                                         | ❌ Wave 0 — also exposes/closes the pre-existing reconnect gap noted in RESEARCH.md Pitfall 3  | ⬜ pending |

_Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky_

---

## Wave 0 Requirements

- [ ] `packages/server/src/draftSession.ts` + `packages/server/src/draftSession.test.ts` — new pure state-machine module and its unit tests (cycle advance, keeper-safety, bench numbering)
- [ ] `packages/server/src/__tests__/draftSession.integration.test.ts` — full socket-wire pick-and-swap cycle test, modeled on `lineupAssignment.integration.test.ts`'s existing real-server harness
- [ ] `packages/server/src/__tests__/draftReconnect.integration.test.ts` — closes the reconnect gap identified in RESEARCH.md Pitfall 3 (only `GAME_STATE` is re-emitted on reconnect today, which is `null` throughout the entire pre-game-start flow)
- [ ] `packages/client/src/components/LineupAssignmentScreen.test.tsx` — currently does not exist at all; needed to cover draft-mode rendering branches without regressing Standard-mode behavior
- [ ] `packages/client/src/components/DraftPackCarousel.test.tsx` (or equivalent) — carousel nav, tier-sort, variable pack size (6 vs 7 cards)
- [ ] Extend `packages/server/src/__tests__/draftPacks.test.ts` with a pack→player random-assignment case (currently only tests `generateDraftPacks`/`generateMatchPacks` directly, not the room-level assignment step, which doesn't exist yet)

---

## Manual-Only Verifications

_All phase behaviors have automated verification per the map above._

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending — to be reconciled against final `PLAN.md` task IDs after the plan-checker pass
