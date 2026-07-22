---
phase: 30
slug: recalibrate-draft
status: verified
threats_open: 0
asvs_level: 1
created: 2026-07-22
---

# Phase 30 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary                                | Description                                                                                               | Data Crossing                                           |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| client → server (ROOM_SETTINGS_CONFIRM) | Untrusted `draftPools` array crosses here; validated against `SELECTABLE_DRAFT_POOLS`                     | Pool selection (5-value allow-list incl. legends/icons) |
| client → server (DRAFT_PICK)            | Untrusted card id + destination slot; validated against server pool state + GK-slot role rules            | Card id, slot index                                     |
| build-time CSV → generated teams.ts     | Data pipeline; no runtime trust boundary, but stale output silently corrupts every stat computation       | Player stat rows                                        |
| pure state machine (no io)              | `draftSession.ts` trusts pre-validated inputs from the socket handler; performs no auth/allow-list itself | Session state transitions                               |
| generateDraftPacks randomness           | Shared engine is RNG-agnostic; CSPRNG binding lives only server-side                                      | Injected `RandomIntFn`                                  |
| buildDraftView per-side projection      | Server → client view must never leak the opponent's pack/lineup                                           | Per-side `DraftClientView`                              |

---

## Threat Register

| Threat ID | Category               | Component                                                                                 | Disposition | Mitigation                                                                                                                                                                                                                                                                                                                                                                                                                                       | Status |
| --------- | ---------------------- | ----------------------------------------------------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------ |
| T-30-01   | Tampering              | Draft pool allow-list (`SELECTABLE_DRAFT_POOLS`, widened to 5 values incl. legends/icons) | mitigate    | Single shared const is the source of truth for both client checkbox state and server `ROOM_SETTINGS_CONFIRM` validation; unknown pool ids rejected with `INVALID_DRAFT_POOL`. Verified: `packages/shared/src/types.ts:470` defines the 5-value const; `packages/server/src/roomHandlers.ts:410-431` validates against it and rejects invalid/duplicate pools; integration tests assert both accept (legends/icons) and reject (unknown id) paths | closed |
| T-30-DATA | Tampering              | Stale `teams.ts` vs finished CSV                                                          | mitigate    | `seed:rosters` regeneration gated on `EXPECTED_TOTAL === 188` fail-fast assertion. Verified: `packages/shared/scripts/seed-rosters.ts:370-373`; `teams.ts` p021 record confirms Carlo Holse present, João Klauss/Mykhi Joyner/Sang-bin Jeong absent                                                                                                                                                                                              | closed |
| T-30-02   | Tampering              | `generateDraftPacks`/pack randomness                                                      | mitigate    | Shared engine stays RNG-agnostic (`RandomIntFn` injected); never imports crypto or `Math.random`; CSPRNG (`crypto.randomInt`) bound only in server `draftPacks.ts`. Verified: `grep -c "Math.random\|from 'crypto'" packages/shared/src/draftEngine.ts` = 0; `packages/server/src/draftPacks.ts` binds `crypto.randomInt`                                                                                                                        | closed |
| T-30-03   | Tampering              | GK card dealt/placed outside round 1                                                      | mitigate    | Generation-time exclusion (rounds 2-6 candidate pools filter `role !== 'GK'`; round-1 candidates filter `role === 'GK'`) plus server-side slot-role validation on `DRAFT_PICK`/rearrange. Verified: `packages/shared/src/draftEngine.ts:255,298,395`; `packages/server/src/roomHandlers.ts:885-890,997-1002`                                                                                                                                     | closed |
| T-30-04   | Tampering              | Pack-to-side assignment                                                                   | mitigate    | `assignRoundPackOrder` uses only the injected `rng` (bound to CSPRNG server-side); no client input influences which pack a side receives. Verified: `packages/server/src/draftSession.ts:89,111`                                                                                                                                                                                                                                                 | closed |
| T-30-PRIV | Information Disclosure | `buildDraftView` per-side projection                                                      | mitigate    | Preserves the T-29-PRIV contract — returns only the `getSide`-projected view, never opponent-prefixed fields; `DraftClientView` shape enforces this structurally. Verified: `packages/server/src/draftSession.ts:410-425`                                                                                                                                                                                                                        | closed |
| T-30-SC   | Tampering              | npm/pnpm installs                                                                         | accept      | Zero new packages introduced across all 6 plans of this phase (RESEARCH Package Legitimacy Audit: not applicable)                                                                                                                                                                                                                                                                                                                                | closed |

_Status: open · closed_
_Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)_

---

## Accepted Risks Log

| Risk ID  | Threat Ref | Rationale                                                                                                                                                                                               | Accepted By                                 | Date       |
| -------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- | ---------- |
| AR-30-01 | T-30-SC    | No new npm/pnpm dependencies were introduced anywhere in Phase 30 (shared/server/client changes were all internal refactors of existing modules); supply-chain audit surface is unchanged from Phase 29 | Phase 30 plan authors (30-01 through 30-06) | 2026-07-22 |

_Accepted risks do not resurface in future audit runs._

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By                                                                                                                                                                                                        |
| ---------- | ------------- | ------ | ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-07-22 | 7             | 7      | 0    | /gsd-secure-phase (orchestrator, direct verification — all 6 PLAN.md files carried parseable threat models; short-circuit rule applied after independently confirming each mitigation against implementation) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-07-22
