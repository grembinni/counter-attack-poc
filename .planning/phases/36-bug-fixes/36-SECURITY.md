---
phase: 36
slug: bug-fixes
status: verified
threats_open: 0
asvs_level: default
created: 2026-08-03
---

# Phase 36 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary                                                            | Description                                                                                                                                                  | Data Crossing                                    |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------ |
| browser client → Socket.io server                                   | Untrusted client-emitted events cross here; room lifecycle mutations, draft pack generation, dice/ball resolution, and undo must all be server-authoritative | Room codes, draft pool selections, undo requests |
| Socket.io handler → in-memory `rooms` Map                           | Room deletion destroys shared state affecting both players in a room                                                                                         | Room lifecycle state                             |
| `generateMatchPacks` (server) → `generateDraftPacks` (shared, pure) | RNG-injection boundary — the only place randomness enters the draft engine; also where a client-selectable pool combination can exhaust supply               | Draft pool selection, crypto RNG                 |
| `ROOM_SETTINGS_CONFIRM` handler → Node process                      | A synchronous throw inside a Socket.io handler is process-fatal for every room on the server                                                                 | Uncaught exceptions                              |
| `applyRoll` (pure, server) → broadcast `GameState`                  | Ball position is authoritative shared state affecting both players; client only renders the broadcast snapshot                                               | Ball position                                    |
| `applyUndo` (pure, server) → broadcast `GameState`                  | The only place undo actually mutates shared state; client's own `canUndo` gate is not a control                                                              | Undo requests, event log                         |

---

## Threat Register

| Threat ID | Category               | Component                                                      | Disposition | Mitigation                                                                                                                                                                                                                                                                | Status |
| --------- | ---------------------- | -------------------------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| T-36-01   | Spoofing               | `LEAVE_ROOM` handler (`roomHandlers.ts`)                       | mitigate    | Handler takes no event payload, reads room code exclusively from server-assigned `socket.data.roomCode` (`roomHandlers.ts:257-284`); event typed `() => void` (`events.ts:166`). 2 wire-level integration tests prove a room-less socket cannot affect an unrelated room. | closed |
| T-36-02   | Tampering              | client-side `resetLobby()` screen transition                   | mitigate    | Client reset is cosmetic only (`App.tsx:253-261`); authoritative teardown is server's `deleteRoom` (`roomHandlers.ts:276`), independent of client state.                                                                                                                  | closed |
| T-36-03   | Denial of Service      | away player socket left in a deleted room                      | accept      | D-05 resolved this race as non-issue; `getRoom` returns `undefined` for a deleted room so subsequent actions silently no-op.                                                                                                                                              | closed |
| T-36-04   | Denial of Service      | repeated `LEAVE_ROOM` emits                                    | accept      | `deleteRoom` on an already-removed key is a safe, idempotent no-op.                                                                                                                                                                                                       | closed |
| T-36-05   | Tampering              | `generateDraftPacks` pack contents                             | mitigate    | Engine remains RNG-agnostic (no `Math.random`/insecure-random import found in `draftEngine.ts`); `crypto.randomInt` binding in `draftPacks.ts` unmodified since Phase 28.                                                                                                 | closed |
| T-36-06   | Information Disclosure | `pool` return value                                            | accept      | Unchanged semantics — already-broadcast full candidate universe; dedup adds/removes no field.                                                                                                                                                                             | closed |
| T-36-07   | Denial of Service      | `ROOM_SETTINGS_CONFIRM` → `generateMatchPacks`                 | mitigate    | Call wrapped in try/catch → `GAME_ERROR 'DRAFT_SUPPLY_EXHAUSTED'` (`roomHandlers.ts:491-500`), computed before any room-state mutation.                                                                                                                                   | closed |
| T-36-08   | Tampering              | client influencing which pool a card comes from                | mitigate    | Server-side allow-list check (`roomHandlers.ts:457-464`) plus independent fail-closed guard inside `generateDraftPacks` (`draftEngine.ts:502-514`).                                                                                                                       | closed |
| T-36-09   | Repudiation            | silent supply degradation hiding a broken pack                 | mitigate    | Genuine shortfall throws loudly (`draftEngine.ts:274,544-546,559-561`) — no reused-card or short-pack fallback path exists.                                                                                                                                               | closed |
| T-36-10   | Tampering              | ball position after a blocked shot                             | mitigate    | `applyRoll` server-authoritative; tie branch's `ballAfter`/`ball` both read `gkEffectivePos` (`gameEngine.ts:2317,2327`); client `BallMarker.tsx` is pure render, no physics.                                                                                             | closed |
| T-36-11   | Repudiation            | replay disagreeing with live play                              | mitigate    | Same branch fix corrects event and state together; `buildReplayFrames` consistency asserted in `gameEngine.phase8.test.ts` (81/81 passing).                                                                                                                               | closed |
| T-36-12   | Information Disclosure | ball position fix                                              | accept      | No new data crosses any boundary; only one coordinate value differs inside the existing broadcast shape.                                                                                                                                                                  | closed |
| T-36-13   | Tampering              | client forging `game:undo` to re-roll a committed dice outcome | mitigate    | `applyUndo`'s `isBoundary` unconditionally includes `TACKLE_ATTEMPT`/`STEAL_ATTEMPT` (`gameEngine.ts:1411-1420`); returns `ok:false`/`UNDO_LOCKED` past that boundary. Client `canUndo` mirror is UX-only, not relied on. 10/10 tests passing.                            | closed |
| T-36-14   | Denial of Service      | over-blocking Undo for the rest of a slot                      | mitigate    | Slot-wide lockout check (`gameEngine.ts:1426`) confirmed unchanged — only `SLOT_ADVANCE`/`DICE_ROLL` gate it, so Undo remains available for post-contest moves.                                                                                                           | closed |
| T-36-15   | Repudiation            | undo silently erasing a resolved contest from the event log    | mitigate    | Splice index (`gameEngine.ts:1500-1504`) is structurally always past the boundary event — the resolved contest can never be the spliced element.                                                                                                                          | closed |
| T-36-SC   | Tampering              | npm/pip/cargo installs                                         | accept      | Not applicable — all 5 plans in this phase modified zero `package.json`/lockfile entries.                                                                                                                                                                                 | closed |

_Status: open · closed_
_Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)_

**Verification method:** Every `mitigate` entry was checked against the actual source file and line(s) cited (not PLAN.md prose or SUMMARY.md self-report). Test suites were independently re-run during this audit: `gameEngine.phase8` (81/81), `gameEngine.phase26-undo` (10/10), `room.integration` (17/17), `draftEngine` (67/67) — all green.

**Defense-in-depth note (T-36-13/14/15):** Client mirror at `ActionPanel.tsx:269-276` contains the identical `isBoundary` disjunction as the server. Server remains sole enforcement layer per the threat model; client copy is UX-only.

**Notable finding (informational, not a gap):** Post-plan code-review commits (`1e3e4fa`, `a23b1b8`) added a guard to `LEAVE_ROOM` preventing teardown of an in-progress match, and a `ROOM_CLOSED` notification to the other room member. Verified as strict hardening beyond T-36-01/T-36-03's requirements — additive, not a regression.

**Unregistered flags:** None. All five plan SUMMARY.md files (36-01–36-05) checked for a `## Threat Flags` section — none present. No new attack surface self-reported by any plan executor beyond the register authored at plan time.

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale                                                                                                                                                                                                                                                                                                                        | Accepted By          | Date       |
| ------- | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- | ---------- |
| R-36-01 | T-36-03    | Away player socket left in a deleted room after `LEAVE_ROOM` — D-05 resolved this race as non-issue; room code not shared with away player until next screen; `getRoom` no-ops on a deleted room. Post-audit hardening (commit `1e3e4fa`) now also sends `ROOM_CLOSED` — a strict improvement, not required by this disposition. | gsd-security-auditor | 2026-08-03 |
| R-36-02 | T-36-04    | Repeated `LEAVE_ROOM` emits are a safe, verified no-op (`rooms.delete()` on an already-removed key); no mutex or rate limit needed for a terminal, idempotent handler.                                                                                                                                                           | gsd-security-auditor | 2026-08-03 |
| R-36-03 | T-36-06    | `pool` return value semantics unchanged by match-wide dedup — already-broadcast full candidate universe, no field added or removed.                                                                                                                                                                                              | gsd-security-auditor | 2026-08-03 |
| R-36-04 | T-36-12    | Ball position fix changes only one coordinate value inside the existing broadcast shape; no new data crosses any boundary.                                                                                                                                                                                                       | gsd-security-auditor | 2026-08-03 |
| R-36-05 | T-36-SC    | Not applicable — zero packages installed across all 5 plans in this phase (confirmed via `files_modified` frontmatter, no dependency-manifest paths touched).                                                                                                                                                                    | gsd-security-auditor | 2026-08-03 |

_Accepted risks do not resurface in future audit runs._

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By               |
| ---------- | ------------- | ------ | ---- | -------------------- |
| 2026-08-03 | 16            | 16     | 0    | gsd-security-auditor |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-08-03
