---
phase: 30
slug: recalibrate-draft
status: complete
nyquist_compliant: true
wave_0_complete: true
created: 2026-07-21
validated: 2026-07-22
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

| Task ID  | Plan | Wave | Requirement         | Threat Ref        | Secure Behavior                                                                                                                                                                                                                                                          | Test Type                          | Automated Command                                                                                                                                                                                       | File Exists                                                                                                                                                                                                                 | Status   |
| -------- | ---- | ---- | ------------------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| 30-01-xx | 01   | 1    | DRAFT-04            | —                 | `classifyTier`/`assignTiers` fixed-threshold classification (chase/rare/uncommon/common, GK included, no percentile ranking)                                                                                                                                             | unit                               | `pnpm --filter @counter-attack/shared test draftEngine`                                                                                                                                                 | ✅ `draftEngine.test.ts` — boundary tests at all 4 thresholds + D-24 GK-can-be-common assertion                                                                                                                             | ✅ green |
| 30-02-xx | 02   | 1-2  | DRAFT-05            | —                 | Round-scoped pack generation: correct composition per round, GK-only round 1, position-bucket cap (D-17) enforced pack-wide, no cross-pack duplication (D-09 invariant re-tested per round)                                                                              | unit + integration                 | `pnpm --filter @counter-attack/shared test draftEngine` (unit), `pnpm --filter @counter-attack/server test draftPacks draftSession` (integration)                                                       | ✅ `draftEngine.test.ts` (13-test round-structure block) + `draftPacks.test.ts`/`draftSession.integration.test.ts`                                                                                                          | ✅ green |
| 30-03-xx | 03   | 2    | DRAFT-08 (deletion) | —                 | No keeper-safety-net code path remains reachable; `DraftSession`/`DraftClientView` no longer carry `hasKeeper`/`keeperAutoPickedThisCycle` fields; client banner removed                                                                                                 | unit + grep-based structural check | `pnpm --filter @counter-attack/server test draftSession`; manual grep for `HasKeeper`/`keeperAutoPicked` (expect zero matches)                                                                          | ✅ `draftSession.test.ts` rewritten (29 tests); repo-wide grep for `keeperAutoPicked`/`homeHasKeeper`/`awayHasKeeper`/`autoSelectKeeperIfMissing`/`checkKeeperSafety`/`keeperBanner`/`cardTierKeeper` confirms zero matches | ✅ green |
| 30-04-xx | 04   | 2    | DRAFT-11            | V4 Access Control | Legends/Icons selectable end-to-end: client checkbox enabled, server `SELECTABLE_DRAFT_POOLS` allow-list accepts (server-authoritative, not just client UX), `isInPool` bridges PoolTag (singular) → DraftPoolId (plural) correctly, pool sizes/backfill behave per D-10 | unit + component + integration     | `pnpm --filter @counter-attack/client test GameSettingsScreen`; `pnpm --filter @counter-attack/shared test draftEngine`; `pnpm --filter @counter-attack/server test` (ROOM_SETTINGS_CONFIRM allow-list) | ✅ `GameSettingsScreen.test.tsx` inverted (11/11 passing); `room.integration.test.ts` legends-accepted + unknown-pool-rejected pair; `draftPacks.test.ts` Legends/Icons backfill tests                                      | ✅ green |
| 30-05-xx | 05   | 3    | D-22/D-23           | —                 | Tier-color borders render correctly on draft carousel, bench carousel, AND starting-11 lineup slots; correct 4-color mapping (no 5th keeper color)                                                                                                                       | component                          | `pnpm --filter @counter-attack/client test LineupAssignmentScreen DraftPackCarousel BenchCarousel`                                                                                                      | ✅ `LineupAssignmentScreen.test.tsx` D-23 describe block (`TIER_CARD_CLASS` selector assertion on starting-11 slots); `DraftPackCarousel.test.tsx`/`BenchCarousel.test.tsx` narrowed to 4-tier fixtures                     | ✅ green |

_Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky_

---

## Wave 0 Requirements

- [x] `packages/shared/src/data/player-pool.csv` finish D-01 edit, then run `pnpm --filter @counter-attack/shared run seed:rosters` and commit regenerated `packages/shared/src/teams.ts` — completed in 30-01-SUMMARY.md (commit `0f659bd`, plus a follow-up data-bug fix in `9de92f9` for an accidental icon PoolTag on the Cristiano Ribeiro decoy row).
- [x] Re-verify `EXPECTED_TOTAL = 188` fail-fast assertion in `seed-rosters.ts` still passes after CSV edit + regeneration — `teams.test.ts` asserts `PLAYER_POOL` has length 188 and the last id is `p188`; confirmed green in the current full-suite run.

---

## Manual-Only Verifications

| Behavior                                                                                                           | Requirement         | Why Manual                                                                              | Test Instructions                                                                                                                                                                                          |
| ------------------------------------------------------------------------------------------------------------------ | ------------------- | --------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Full 6-round draft flow feels correct end-to-end (round transitions, pick/swap UX, tier colors visible throughout) | DRAFT-05, D-22/D-23 | Visual/UX flow across round boundaries is not fully capturable by component tests alone | Play a full 2-player draft locally via `/run`; confirm round 1 GK-only packs, rounds 2-6 tiered packs, tier-colored borders visible on carousel + bench + starting-11 lineup slots after lineup assignment | ✅ completed — see 30-06-SUMMARY.md Task 2, user response "approved", all 6 checks passed |

---

## Validation Audit 2026-07-22

Retroactive audit against the executed phase (all 6 plans complete, 30-VERIFICATION.md/30-UAT.md/30-SECURITY.md all closed). Cross-referenced every requirement's test file against the current codebase and re-ran the full suite independently of the SUMMARY claims.

| Metric               | Count                                                                                     |
| -------------------- | ----------------------------------------------------------------------------------------- |
| Gaps found           | 0                                                                                         |
| Resolved             | 0                                                                                         |
| Escalated            | 0                                                                                         |
| Requirements COVERED | 5/5 (DRAFT-04, DRAFT-05, DRAFT-08, DRAFT-11, D-22/D-23) + Wave 0 (188-count regeneration) |

Independently verified (not just re-stated from SUMMARY.md files):

- `pnpm test` — 583/583 shared, 614/616 server (1 pre-existing skip + 1 todo, unrelated to phase 30), 371/371 client — all green
- `pnpm typecheck` — 0 errors across shared/server/client
- Repo-wide grep for superseded identifiers (`keeperAutoPicked`, `homeHasKeeper`/`awayHasKeeper`, `autoSelectKeeperIfMissing`, `checkKeeperSafety`, `keeperBanner`, `cardTierKeeper`) — zero functional matches; surviving `'keeper'`/`'Keeper'` string hits are all unrelated prose (goalkeeper duel labels, removal-documentation comments)
- `LineupAssignmentScreen.test.tsx` D-23 describe block confirmed present and asserting `TIER_CARD_CLASS` on starting-11 slot cards
- `teams.test.ts` confirms `PLAYER_POOL` length 188 (Wave 0 blocking prerequisite)

No gaps to fill — auditor subagent not spawned.

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (teams.ts regeneration)
- [x] No watch-mode flags
- [x] Feedback latency < 60s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** Nyquist-compliant as of 2026-07-22 audit.
