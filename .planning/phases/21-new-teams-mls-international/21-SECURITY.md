---
phase: 21
slug: new-teams-mls-international
status: verified
threats_open: 0
asvs_level: 1
created: 2026-07-04
---

# Phase 21 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary                              | Description                                                    | Data Crossing                   |
| ------------------------------------- | -------------------------------------------------------------- | ------------------------------- |
| client → server (Socket.io TEAM_PICK) | Client-supplied `teamId` string crosses into server room state | TeamId string (low sensitivity) |

---

## Threat Register

| Threat ID | Category  | Component                         | Disposition | Mitigation                                                                                                 | Status |
| --------- | --------- | --------------------------------- | ----------- | ---------------------------------------------------------------------------------------------------------- | ------ |
| T-21-01   | Tampering | roomHandlers.ts TEAM_PICK handler | mitigate    | `VALID_TEAM_IDS: readonly TeamId[]` 12-member allow-list (line 40) + guard at line 194 rejects unknown IDs | closed |
| T-21-02   | Tampering | roomHandlers.ts struck-out guard  | accept      | `teamId === room.homePickedTeam` at line 217 prevents duplicate picks; unchanged this phase                | closed |
| T-21-SC   | Tampering | npm/pnpm installs                 | accept      | Zero new packages installed this phase — no supply-chain surface                                           | closed |
| T-21-03   | Tampering | client team pick UI               | accept      | Client tab/pick UI is presentation-only; VALID_TEAM_IDS server-side check is authoritative                 | closed |

_Status: open · closed_
_Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)_

---

## Accepted Risks Log

| Risk ID  | Threat Ref | Rationale                                                                           | Accepted By       | Date       |
| -------- | ---------- | ----------------------------------------------------------------------------------- | ----------------- | ---------- |
| AR-21-02 | T-21-02    | Existing duplicate-pick guard (pre-Phase 21) unchanged; no new attack surface added | plan threat model | 2026-07-04 |
| AR-21-SC | T-21-SC    | No packages installed this phase — npm/pnpm supply-chain surface is zero            | plan threat model | 2026-07-04 |
| AR-21-03 | T-21-03    | Client UI cannot bypass server allow-list; presentation-only risk accepted          | plan threat model | 2026-07-04 |

---

## Mitigation Evidence

### T-21-01 — VALID_TEAM_IDS allow-list (verified in code)

File: `packages/server/src/roomHandlers.ts`

- Line 40: `const VALID_TEAM_IDS: readonly TeamId[] = ['city', 'crew', 'la', 'miami', 'nashville', 'seattle', 'canada', 'england', 'france', 'mexico', 'spain', 'us'] as const;`
- Line 194: `if (!(VALID_TEAM_IDS as readonly string[]).includes(teamId)) { socket.emit(ServerEvents.GAME_ERROR, 'INVALID_TEAM'); return; }`
- Type gate: `readonly TeamId[]` with `as const` — any non-TeamId string fails compilation

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By           |
| ---------- | ------------- | ------ | ---- | ---------------- |
| 2026-07-04 | 4             | 4      | 0    | gsd-secure-phase |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-07-04
