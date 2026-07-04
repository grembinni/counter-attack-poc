---
phase: 19
slug: data-model-team-palette
status: verified
threats_open: 0
asvs_level: 1
created: 2026-07-03
---

# Phase 19 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary                    | Description                                                                                         | Data Crossing                                          |
| --------------------------- | --------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| CSV files → seed script     | Developer-authored static input; read only at dev time by `pnpm run seed:rosters`, never at runtime | Non-sensitive player roster data (public names, stats) |
| client → server `team:pick` | Untrusted client-supplied teamId string crosses into server game-state construction                 | TeamId string                                          |

---

## Threat Register

| Threat ID | Category               | Component                           | Disposition | Mitigation                                                                                                                                                                              | Status |
| --------- | ---------------------- | ----------------------------------- | ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| T-19-01   | Tampering              | seed-rosters.ts CSV parsing         | accept      | Dev-only build tool; CSV input is committed to the repo and reviewed; no runtime or network exposure                                                                                    | closed |
| T-19-02   | Information Disclosure | PLAYER_POOL contents                | accept      | Player stat data is non-sensitive game content; no PII beyond public roster names                                                                                                       | closed |
| T-19-03   | Tampering              | roomHandlers.ts `team:pick` handler | mitigate    | `VALID_TEAM_IDS = ['city', 'crew'] as const` at line 40; checked at line 181 before any TEAM_CONFIGS lookup — rejects cosmos/xolos at the allow-list guard (ASVS V5)                    | closed |
| T-19-04   | Denial of Service      | buildSquadPieces / getSquadPlayers  | mitigate    | `PLAYER_POOL_MAP` (O(1) lookup) in teamConfig.ts:157; try/catch around `buildInitialGameState` in roomHandlers.ts:211 emits `GAME_ERROR` to socket instead of crashing the Node process | closed |
| T-19-05   | Tampering              | Client `Record<TeamId, …>` maps     | accept      | Display-only lookups; TeamId is compile-time narrowed to `'city' \| 'crew'` — an out-of-union key cannot be constructed; server allow-list is the trust boundary                        | closed |
| T-19-SC   | Tampering              | npm/pip/cargo installs              | mitigate    | No packages installed this phase; no install tasks present                                                                                                                              | closed |

_Status: open · closed_
_Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)_

---

## Accepted Risks Log

| Risk ID  | Threat Ref | Rationale                                                                                                                                                       | Accepted By | Date       |
| -------- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- | ---------- |
| AR-19-01 | T-19-01    | CSV parsing runs only at dev time; input is author-controlled and committed to version control. No runtime attack surface.                                      | dev         | 2026-07-03 |
| AR-19-02 | T-19-02    | PLAYER_POOL contains public game roster data (names, stats). No PII, no sensitive data.                                                                         | dev         | 2026-07-03 |
| AR-19-05 | T-19-05    | Client-side Record maps are display-only. Compile-time TeamId narrowing prevents invalid keys. Server allow-list (T-19-03) is the authoritative trust boundary. | dev         | 2026-07-03 |

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By                    |
| ---------- | ------------- | ------ | ---- | ------------------------- |
| 2026-07-03 | 6             | 6      | 0    | Claude (gsd-secure-phase) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-07-03
