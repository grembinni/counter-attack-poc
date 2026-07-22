---
phase: 30
slug: recalibrate-draft
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-21
---

# Phase 30 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property               | Value                                                                                                                                                    |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Framework**          | vitest (existing, per-package `vitest.config.ts` in `client`/`server`/`shared`)                                                                          |
| **Config file**        | `packages/{client,server,shared}/vitest.config.ts`                                                                                                       |
| **Quick run command**  | `pnpm --filter @counter-attack/shared test` / `pnpm --filter @counter-attack/server test` / `pnpm --filter @counter-attack/client test` (package-scoped) |
| **Full suite command** | `pnpm test` (root — runs `pnpm -r test` across all 3 packages)                                                                                           |
| **Estimated runtime**  | ~30-60 seconds (full suite, existing project scale)                                                                                                      |

---

## Sampling Rate

- **After every task commit:** Run package-scoped `pnpm --filter <pkg> test` for whichever package the task touched.
- **After every plan wave:** Run `pnpm test` (full 3-package suite) PLUS `pnpm typecheck` — this phase changes shared types referenced across all 3 packages, so a type error in one package after a `shared` change is a very likely regression class.
- **Before `/gsd-verify-work`:** Full suite must be green, PLUS a manual grep pass for `'keeper'` / `PACKS_PER_MATCH` / `TIER_PERCENTILE_BOUNDS` / `FALLBACK_POOL_ORDER` old-value literals (tests passing does not guarantee these were fully purged — see RESEARCH.md Pitfall 4/6).
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

| Task ID  | Plan | Wave | Requirement         | Threat Ref        | Secure Behavior                                                                                                                                                                                                                                                          | Test Type                          | Automated Command                                                                                                                                                                                       | File Exists                                                                               | Status     |
| -------- | ---- | ---- | ------------------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | ---------- |
| 30-01-xx | 01   | 1    | DRAFT-04            | —                 | `classifyTier`/`assignTiers` fixed-threshold classification (chase/rare/uncommon/common, GK included, no percentile ranking)                                                                                                                                             | unit                               | `pnpm --filter @counter-attack/shared test draftEngine`                                                                                                                                                 | ✅ rewrite existing                                                                       | ⬜ pending |
| 30-02-xx | 02   | 1-2  | DRAFT-05            | —                 | Round-scoped pack generation: correct composition per round, GK-only round 1, position-bucket cap (D-17) enforced pack-wide, no cross-pack duplication (D-09 invariant re-tested per round)                                                                              | unit + integration                 | `pnpm --filter @counter-attack/shared test draftEngine` (unit), `pnpm --filter @counter-attack/server test draftPacks draftSession` (integration)                                                       | ✅ rewrite existing                                                                       | ⬜ pending |
| 30-03-xx | 03   | 2    | DRAFT-08 (deletion) | —                 | No keeper-safety-net code path remains reachable; `DraftSession`/`DraftClientView` no longer carry `hasKeeper`/`keeperAutoPickedThisCycle` fields; client banner removed                                                                                                 | unit + grep-based structural check | `pnpm --filter @counter-attack/server test draftSession`; manual grep for `HasKeeper`/`keeperAutoPicked` (expect zero matches)                                                                          | ✅ existing tests must be removed/inverted                                                | ⬜ pending |
| 30-04-xx | 04   | 2    | DRAFT-11            | V4 Access Control | Legends/Icons selectable end-to-end: client checkbox enabled, server `SELECTABLE_DRAFT_POOLS` allow-list accepts (server-authoritative, not just client UX), `isInPool` bridges PoolTag (singular) → DraftPoolId (plural) correctly, pool sizes/backfill behave per D-10 | unit + component + integration     | `pnpm --filter @counter-attack/client test GameSettingsScreen`; `pnpm --filter @counter-attack/shared test draftEngine`; `pnpm --filter @counter-attack/server test` (ROOM_SETTINGS_CONFIRM allow-list) | ✅ existing tests assert the OPPOSITE — must invert, see Pitfall 8                        | ⬜ pending |
| 30-05-xx | 05   | 3    | D-22/D-23           | —                 | Tier-color borders render correctly on draft carousel, bench carousel, AND starting-11 lineup slots; correct 4-color mapping (no 5th keeper color)                                                                                                                       | component                          | `pnpm --filter @counter-attack/client test LineupAssignmentScreen DraftPackCarousel BenchCarousel`                                                                                                      | ✅ LineupAssignmentScreen.test.tsx exists but needs NEW lineup-slot tier-color test cases | ⬜ pending |

_Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky_

---

## Wave 0 Requirements

- [ ] `packages/shared/src/data/player-pool.csv` finish D-01 edit, then run `pnpm --filter @counter-attack/shared run seed:rosters` and commit regenerated `packages/shared/src/teams.ts` — **blocking prerequisite**: `teams.ts` is currently stale relative to the in-progress CSV edit (confirmed via git status + spot-check), and every downstream computation (`computeTotalStat`, tier classification, pack generation) reads from `teams.ts`, not the CSV directly. All other Wave 0/1 work is invalid until this regeneration lands.
- [ ] Re-verify `EXPECTED_TOTAL = 188` fail-fast assertion in `seed-rosters.ts` still passes after CSV edit + regeneration.

---

## Manual-Only Verifications

| Behavior                                                                                                           | Requirement         | Why Manual                                                                              | Test Instructions                                                                                                                                                                                          |
| ------------------------------------------------------------------------------------------------------------------ | ------------------- | --------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Full 6-round draft flow feels correct end-to-end (round transitions, pick/swap UX, tier colors visible throughout) | DRAFT-05, D-22/D-23 | Visual/UX flow across round boundaries is not fully capturable by component tests alone | Play a full 2-player draft locally via `/run`; confirm round 1 GK-only packs, rounds 2-6 tiered packs, tier-colored borders visible on carousel + bench + starting-11 lineup slots after lineup assignment |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (teams.ts regeneration)
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
