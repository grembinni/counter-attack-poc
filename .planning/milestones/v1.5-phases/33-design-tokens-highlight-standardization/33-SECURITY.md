---
phase: 33
slug: design-tokens-highlight-standardization
status: verified
threats_open: 0
asvs_level: 1
created: 2026-07-26
---

# Phase 33 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary   | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Data Crossing                   |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------- |
| (none new) | Phase 33 is a pure UI color/token refactor across 7 plans (chrome design tokens, hex highlight consolidation, piece-ring recolor, ball-location marker, reference doc). All color values are developer-authored literals or derived from the closed, typed `TeamId`/`GamePhase` enums via `TEAM_CONFIGS`. No user-supplied input reaches any CSS/SVG paint value, and no new network endpoints, auth paths, file access, or schema changes were introduced. | None — presentation-only values |

---

## Threat Register

| Threat ID | Category               | Component                                                      | Disposition | Mitigation                                                                                                                                                                                                                                                                                                            | Status |
| --------- | ---------------------- | -------------------------------------------------------------- | ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| T-33-01   | Tampering              | `--team-accent` runtime CSS-var injection (GameBoard, 33-01)   | accept      | Value comes only from `TEAM_CONFIGS[TeamId].palette.uiColor` (closed enum, no free-form user text) — no CSS-injection/XSS vector.                                                                                                                                                                                     | closed |
| T-33-02   | Information Disclosure | tokens.css / chrome colors (33-01)                             | accept      | Pure presentation values; no secrets, PII, or auth state involved.                                                                                                                                                                                                                                                    | closed |
| T-33-03   | Tampering              | Inline `var()` reads in panel .tsx files (33-02)               | accept      | `var(--token)` string reads reference developer-defined tokens only; no user-controlled interpolation.                                                                                                                                                                                                                | closed |
| T-33-04   | Information Disclosure | Panel chrome colors (33-02)                                    | accept      | Pure presentation; no secrets/PII.                                                                                                                                                                                                                                                                                    | closed |
| T-33-05   | Tampering              | Screen chrome CSS Modules (33-03)                              | accept      | Developer-defined token references only; no injection surface.                                                                                                                                                                                                                                                        | closed |
| T-33-06   | Information Disclosure | Screen chrome colors (33-03)                                   | accept      | Pure presentation; no secrets/PII.                                                                                                                                                                                                                                                                                    | closed |
| T-33-07   | Tampering              | HIGHLIGHT_STYLES / ring rendering (33-04)                      | accept      | Pure SVG paint from a fixed lookup table; no injection surface.                                                                                                                                                                                                                                                       | closed |
| T-33-08   | Tampering              | PieceOverlay ring/overlay rendering (33-05)                    | accept      | Fixed SVG paint values; no injection surface.                                                                                                                                                                                                                                                                         | closed |
| T-33-09   | Tampering              | HexGrid highlight routing + BallLocationRing (33-06)           | accept      | Fixed SVG paint from a lookup table / typed `GamePhase` gate; no injection surface. Ball position and phase come from server-authoritative `GameState`.                                                                                                                                                               | closed |
| T-33-10   | Denial of Service      | Extra topmost SVG sibling per render (33-06, BallLocationRing) | accept      | One additional `<polygon>` at most; negligible render cost within the existing ~962-hex SVG.                                                                                                                                                                                                                          | closed |
| T-33-11   | Information Disclosure | docs/HIGHLIGHT-REFERENCE.md (33-07)                            | accept      | Developer-facing color reference; no secrets/PII.                                                                                                                                                                                                                                                                     | closed |
| T-33-SC   | Tampering              | npm/pip/cargo installs (all 7 plans)                           | mitigate    | No package installs across any of the 7 plans in this phase — independently verified via `git log` on `package.json`/`pnpm-lock.yaml`: the last dependency-affecting commit before Phase 33 was Phase 32 (`81b96f7`/`6b6b69a`/`89abc8a`), and the next was Phase 34 (`a920233`). Nothing to verify at the code level. | closed |

_Status: open · closed_
_Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)_

---

## Accepted Risks Log

| Risk ID  | Threat Ref                                           | Rationale                                                                                                                                                                                                                                                                                                                                                                                                                                      | Accepted By                     | Date       |
| -------- | ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------- | ---------- |
| AR-33-01 | T-33-01, T-33-03, T-33-05, T-33-07, T-33-08, T-33-09 | All hex/piece/chrome color values are either developer-authored literals in fixed lookup tables (`HIGHLIGHT_STYLES`, `RING_STYLES`, `tokens.css`) or derived from closed, typed enums (`TeamId`, `GamePhase`) via `TEAM_CONFIGS`/server-authoritative `GameState`. No free-form or user-controlled string ever reaches a CSS custom property, inline style, or SVG attribute in this phase — eliminating CSS/SVG injection as a viable vector. | User (via /gsd-secure-phase 33) | 2026-07-26 |
| AR-33-02 | T-33-02, T-33-04, T-33-06, T-33-11                   | All values touched are pure UI presentation (colors, a reference doc) with no secrets, PII, or auth-relevant state.                                                                                                                                                                                                                                                                                                                            | User (via /gsd-secure-phase 33) | 2026-07-26 |
| AR-33-03 | T-33-10                                              | The added always-on-top ball-location marker renders at most one extra SVG polygon per frame within an existing ~962-hex SVG tree — the incremental render cost is negligible and does not constitute a meaningful DoS surface.                                                                                                                                                                                                                | User (via /gsd-secure-phase 33) | 2026-07-26 |
| AR-33-04 | T-33-SC                                              | Verified independently against `git log` that no plan in this phase touched `package.json`, `pnpm-lock.yaml`, or any client package manifest — the supply-chain mitigation is vacuously satisfied.                                                                                                                                                                                                                                             | User (via /gsd-secure-phase 33) | 2026-07-26 |

_Accepted risks do not resurface in future audit runs._

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By                                                                       |
| ---------- | ------------- | ------ | ---- | ---------------------------------------------------------------------------- |
| 2026-07-26 | 12            | 12     | 0    | Claude (gsd-secure-phase, orchestrator-run per user's "accept all" decision) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-07-26
