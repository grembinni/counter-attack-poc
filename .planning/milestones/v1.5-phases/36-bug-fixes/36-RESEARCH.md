# Phase 36: Bug Fixes - Research

**Researched:** 2026-07-27
**Domain:** Internal defect correction across 3 subsystems (room lifecycle, draft engine, movement/undo engine) in an existing Node.js+Socket.io / React+Zustand / TypeScript monorepo
**Confidence:** HIGH — every claim below was verified by reading the actual current source (not training-data recall); no external library research was needed since this phase touches zero new dependencies

## Summary

This is a pure defect-correction phase touching five independent, non-overlapping code paths. All five root causes were traced to specific line numbers in the current codebase during this research pass — one of them (the loose-ball path-origin bug, item 4) turned out to live at a **different location than either the CONTEXT.md pointers or the folded todo's suggested-investigation pointers indicate**. That correction is the single most important finding in this document; see "Corrected Root Cause" under Bug 4 below.

The other four bugs were fully confirmed exactly as CONTEXT.md described, with additional precision added: (1) the Game Settings Back button has a ready-made, already-tested client-side reset primitive (`resetLobby()` in the Zustand store) that a sibling screen (`WaitingScreen`) already uses via a `useLobbyBack()` hook — but that existing pattern does NOT emit a room-teardown event and must NOT be copied as-is (D-03 forbids it); (2)/(3) the draft-engine match-wide-uniqueness fix has a real, numerically-verified supply-exhaustion consequence for `['original']`-only matches (common-tier need of 28 cards match-wide vs. 21 available in `original`, and a `chaseOrRare` shortfall of 3) that the planner must design cascade+fallback tests around, not just theorize about; (5) the undo-boundary fix must be implemented by extending the **boundary-detection set** in both `applyUndo` (server) and `canUndo` (client), NOT the separate full-lockout check that already exists for the literal `'DICE_ROLL'` event type — conflating these two would either fail to fix the bug or over-block Undo in a way that violates D-13's explicit "still works for steps after" requirement.

**Primary recommendation:** Treat this as 3 independent waves (room lifecycle / draft engine / movement engine) with no cross-wave dependencies — confirmed via full source read, no shared files or state between the three subsystems' fix sites.

## Architectural Responsibility Map

| Capability                               | Primary Tier                                                 | Secondary Tier                                   | Rationale                                                                                                                                                                         |
| ---------------------------------------- | ------------------------------------------------------------ | ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Game Settings Back navigation            | Frontend (Zustand store + component)                         | API/Backend (new socket handler + room teardown) | Client screen state is client-owned; but room deletion MUST be server-authoritative (ARCH-01) — client cannot delete a room itself, only request it                               |
| Draft pack uniqueness (match-wide dedup) | API/Backend (shared engine, bound to server RNG)             | —                                                | `generateDraftPacks` lives in `packages/shared` but is only ever invoked server-side via `generateMatchPacks` (crypto RNG); client never runs it (T-28-04-FAIR fairness boundary) |
| Draft pool/tier fallback cascade         | API/Backend (same engine as above)                           | —                                                | Same fairness boundary — pack contents are gameplay-affecting and must not be client-computable                                                                                   |
| Loose-ball path origin on blocked shot   | API/Backend (`gameEngine.ts` pure state-transition function) | —                                                | Dice-resolution and ball-physics are server-authoritative; client only renders `state.ball.position` from the broadcast snapshot                                                  |
| Undo boundary at dice-roll action        | API/Backend (`applyUndo` — authoritative)                    | Frontend (`canUndo` — UX-only mirror)            | Server is the enforcement layer (a modified client must not bypass the boundary); client `canUndo` only controls button enable/disable, never the actual state mutation           |

## User Constraints

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions

**Game Settings Back button**

- D-01: Back navigates to the Landing screen — `GameSettingsScreen` is the very first step after Create Room, so there's no meaningful intermediate screen.
- D-02: The room already exists server-side by the time `GameSettingsScreen` renders (confirmed via `App.tsx`'s `onRoomJoined`, `App.tsx:74-86`). Back must tear the room down server-side, not just switch the client screen.
- D-03: Add a new dedicated `LEAVE_ROOM` (or equivalent) socket event + server handler that immediately deletes the room and clears client session storage — do NOT rely on the existing disconnect/grace-timer path (`roomHandlers.ts:1047-1049`'s `deleteRoom(roomCode)` on timeout), since that leaves the room code alive/joinable for up to ~90s after Back is clicked.
- D-04: This Back button is scoped ONLY to `GameSettingsScreen` — explicitly NOT added to `UniformSelectionScreen`, `LineupAssignmentScreen`, or any other pre-game screen.
- D-05: Always show/allow Back regardless of `room.status` — no away-player-joined guard needed (in practice the room code isn't given to the away player until the next screen).

**Duplicate players in draft packs (reverses Phase 30 D-18)**

- D-06: Player uniqueness is match-wide, not per-round. A player may appear in at most ONE pack across all 6 rounds / 12 packs of a single match. Overrides `draftEngine.ts`'s documented D-18 comment and the per-round-fresh candidate resolution in `generateDraftPacks` (363-438) — must thread a persistent "already-used-this-match" id set across every round.
- D-07: Within-round no-duplicate-card behavior (existing D-09) is unaffected — superset extension, not a replacement.

**Cross-pool / cross-tier fallback interaction**

- D-08 (tier cascade, same pool first): When a pack slot's exact tier is short on supply, cascade DOWN through tiers within the already-selected pool(s) first: `chase → rare → uncommon → common`. Never substitute a HIGHER tier than the slot originally called for.
- D-09 (cross-pool fallback restricted to common only): If the same-pool tier cascade reaches `common` and is STILL short, only THEN fall back to the existing D-11 cross-pool chain (`FALLBACK_POOL_ORDER = ['mls', 'original']`) — and even then, only pull `common`-tier cards from the other pool(s). Never pull a rare/chase/uncommon card from a non-selected pool.
- D-10 (GK round exemption confirmed unchanged): GK-round backfill has no tier concept — D-08/D-09 don't apply to it; constrained only by D-06's match-wide-unique id set.
- D-11 (supply exhaustion fallback, not silent): If still short after cascading to common AND exhausting common-tier cross-pool fallback, keep the existing loud-fail "insufficient supply" error — never silently reuse a used card or leave a pack short.

**Draft pool restriction — verification scope**

- D-12: Audit + regression-test task, not a standalone behavior change beyond D-08/D-09. Confirm (a) same-pool cascade tried before cross-pool reach, (b) cross-pool fallback never pulls non-common from a non-selected pool. Fix any gap found.

**Undo boundary at a dice-roll action (folded todo)**

- D-13: Undo is boundary-clamped, not fully disabled. Once `TACKLE_ATTEMPT`/`STEAL_ATTEMPT` has resolved within the current move, Undo continues to work normally for steps AFTER that action — it only refuses to revert to before it. Add to the existing boundary-event set in both client `canUndo` (`ActionPanel.tsx`) and server `applyUndo` (`gameHandlers.ts`/`gameEngine.ts`).

**Loose-ball path origin on a blocked shot (folded todo)**

- D-14: Root-cause fix plus targeted regression tests for the specific blocked-shot scenario — not a broader sweep. Correct the `from` hex used for the loose-ball scatter to the blocking piece's/deflection hex instead of the shooter's origin hex.

### Claude's Discretion

- Exact naming/payload shape of the new `LEAVE_ROOM` socket event (D-03).
- Exact data structure used to thread the match-wide "already-used" player-id set through `generateDraftPacks`'s round loop (D-06).
- Whether the D-12 audit surfaces any actual pre-existing gap in D-11's current behavior beyond what D-08/D-09 already redefine — if found, fix as part of this task per D-12.

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope. Two folded todos (loose-ball path origin, undo boundary) were already scoped to this phase.

Reviewed-but-not-folded todos (do not touch): `2026-07-02-bug-kickoff-setup-persistent-light-shading-on-shot-path-hexes.md` (BUG-23, highlight-rendering, unrelated), `csv-consolidation-player-pool.md` (data-pipeline idea, unrelated).
</user_constraints>

<phase_requirements>

## Phase Requirements

No BUG-NN requirement IDs have been minted yet for this phase (confirmed in REQUIREMENTS.md: "Bug Fixes (BUG)" section currently ends at BUG-32 from Phase 31; ROADMAP.md Phase 36 section states "Requirements: TBD"). The planner/roadmapper must mint 5 new IDs (recommend `BUG-33` through `BUG-37`, continuing the existing sequence) — one per success criterion in the phase description — and add them to REQUIREMENTS.md's Bug Fixes table + Traceability table before or during planning.

| Proposed ID        | Description                                                                       | Research Support                                                                                                                                                            |
| ------------------ | --------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| BUG-33 (suggested) | Game Settings Back button restored, tears down room server-side                   | Confirmed missing; existing `resetLobby()`/`useLobbyBack()` client pattern + `deleteRoom`/`joinRoom` server functions identified as reusable primitives — see Bug 1 section |
| BUG-34 (suggested) | Draft packs never contain duplicate players match-wide                            | Confirmed current per-round-only dedup; exact edit sites and a numerically-verified supply-risk scenario identified — see Bug 2 section                                     |
| BUG-35 (suggested) | Cross-pool fallback restricted to common-tier only, same-pool cascade tried first | Confirmed no cascade mechanism exists today; cross-pool fallback currently unrestricted by tier — see Bug 3 section                                                         |
| BUG-36 (suggested) | Loose-ball path origin corrected on blocked shot                                  | **Root cause corrected during this research** to a third location neither CONTEXT.md nor the folded todo names — see Bug 4 section                                          |
| BUG-37 (suggested) | Undo cannot revert past a resolved dice-roll action                               | Confirmed gap; exact boundary-set edit sites identified in both client and server, with an explicit warning about the WRONG fix location — see Bug 5 section                |

</phase_requirements>

## Project Constraints (from CLAUDE.md)

- Backend: Node.js 22 LTS + Express 4.x + Socket.io 4.x (server-authoritative; already in place, no changes needed for this phase).
- Frontend: React 18.x + Vite 5.x + Zustand 4.x (already in place).
- TypeScript everywhere (`ts` strict mode, `exactOptionalPropertyTypes` enforced per STATE.md precedent — new optional fields must use `field?: T | null`, never rely on `undefined`).
- Server-authoritative state; full-snapshot broadcast after every action (STATE.md "Decisions Locked" — no differential patching). The `LEAVE_ROOM` handler must not bypass this by having the client self-transition without a server round-trip for anything that mutates shared room state.
- Never generate dice on the client; all rolls use `crypto.randomInt` server-side (draft pack generation already follows this via `draftPacks.ts`'s `generateMatchPacks` — no change needed, D-06/D-08/D-09 stay within the existing RNG-injection boundary).
- Per-room `isProcessing` mutex before any game logic — the new `LEAVE_ROOM` handler should follow the same guard convention used by `ROOM_CREATE`/`ROOM_SETTINGS_CONFIRM` (though `LEAVE_ROOM` is a terminal action with no further state to race against, so the mutex may not be strictly necessary — confirm during planning whether `room.isProcessing` even applies to a delete-and-exit handler).
- No project skills found in `.claude/skills/` etc. — no additional conventions beyond CLAUDE.md and in-repo patterns.

## Standard Stack

No new libraries are introduced by this phase. All five fixes are internal logic/state-transition corrections using the existing stack (Socket.io events, Zustand store actions, pure TypeScript functions in `gameEngine.ts`/`draftEngine.ts`). **Package Legitimacy Audit is not applicable** — no `npm install` of any kind occurs in this phase.

## Package Legitimacy Audit

Not applicable — this phase installs no external packages. No `npm view` / registry checks were run because there is nothing to check.

## Architecture Patterns

### System Architecture Diagram (this phase's 3 independent flows)

```
Bug 1 — Game Settings Back:
  [GameSettingsScreen: Back click]
        |
        v
  [client emits LEAVE_ROOM] --(new socket event)--> [server: LEAVE_ROOM handler]
        |                                                    |
        |                                                    v
        |                                          [deleteRoom(roomCode)] (existing fn, roomStore.ts:285)
        |                                                    |
        v                                                    v
  [client: sessionStorage.removeItem + resetLobby()]   [socket.data cleared / room removed from Map]
        |
        v
  [screen -> LANDING] (Zustand store field, mirrors existing resetLobby() shape)

Bug 2/3 — Draft pack generation (server-only, single entry point):
  [ROOM_SETTINGS_CONFIRM handler] --> [generateMatchPacks(selectedPools)] (draftPacks.ts, binds crypto.randomInt)
        |
        v
  [generateDraftPacks(selectedPools, rng)] (draftEngine.ts:363) -- THE edit site for D-06/D-08/D-09
        |
        for each round in DRAFT_ROUNDS (1=GK, 2-6=tiered):
          |
          v
        [resolveGkCandidates / resolveTieredCandidates] --exclude--> [match-wide usedIds Set] (NEW, D-06)
          |
          v
        [same-pool tier cascade: chase->rare->uncommon->common] (NEW, D-08)
          |
          v (only if still short, common-tier only)
        [cross-pool FALLBACK_POOL_ORDER backfill] (EXISTING, D-09 restricts to common)
          |
          v
        [drawFromPool draws cards into packs[]] --add drawn ids--> [match-wide usedIds Set]
        (repeat for next round)

Bug 4 — Blocked shot -> loose ball (server-only, applyRoll SHOT case):
  [client emits game:roll] --> [applyRoll(state, shooterDie, gkDie, handlingDie)] (gameEngine.ts, SHOT case)
        |
        v
  [validateShotDuel] --outcome: LOOSE_BALL (tie)--> *** BUG: ball stays at state.ball.position (shooter's hex) ***
        |                                              should use gkEffectivePos (line 2111) instead
        v
  [next game:roll for LOOSE_BALL phase] --> [scatter walk reads `from = state.ball.position`] (line 2760)
        (this second step is CORRECT already — the bug is entirely upstream, at the LOOSE_BALL-tie
         branch's ball-position assignment, line 2310)

Bug 5 — Undo boundary (client mirror + server authority):
  [player: MOVE, then TACKLE_ATTEMPT fires (FAIL), MOVE continues in same slot]
        |
        v
  [client: Undo button] --canUndo boundary scan (ActionPanel.tsx:265-272)--
        |
  [server: GAME_UNDO] --> [applyUndo(state)] --boundary scan (gameEngine.ts:1399-1408)--
        |
        BUG: TACKLE_ATTEMPT/STEAL_ATTEMPT not in the isBoundary set on EITHER side ->
             Undo walks back past the resolved dice roll to pre-tackle moves.
        FIX: add TACKLE_ATTEMPT/STEAL_ATTEMPT to the isBoundary disjunction (NOT the
             separate full-lockout `.some(...DICE_ROLL...)` check at gameEngine.ts:1413,
             which would over-block instead of clamping).
```

### Component Responsibilities (fix sites, verified against current source)

| File                                                            | Bug  | What changes                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| --------------------------------------------------------------- | ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/shared/src/events.ts`                                 | 1    | Add `LEAVE_ROOM: 'room:leave'` to `ClientEvents` (kebab `room:` namespace, matches `ROOM_CREATE`/`ROOM_JOIN`/`ROOM_SETTINGS_CONFIRM` convention); add void-payload entry to the `ClientEvents` typed-payload interface around line 154-167                                                                                                                                                                                                                                          |
| `packages/server/src/roomHandlers.ts`                           | 1    | New `socket.on(ClientEvents.LEAVE_ROOM, ...)` handler inside `registerRoomHandlers` (mirror `ROOM_CREATE`'s structure at lines 149-182): read `socket.data.roomCode`, call `deleteRoom(roomCode)` (existing fn), clear `socket.data` fields, `socket.leave(roomCode)`                                                                                                                                                                                                               |
| `packages/server/src/roomStore.ts`                              | 1    | No changes — `deleteRoom` (line 285) already does everything needed (clears disconnect timers, replay timer, removes from Map)                                                                                                                                                                                                                                                                                                                                                      |
| `packages/client/src/App.tsx`                                   | 1    | Emit `LEAVE_ROOM` from the new Back handler (or reuse a variant of the existing pattern at `LobbyScreen.tsx`'s `useLobbyBack`)                                                                                                                                                                                                                                                                                                                                                      |
| `packages/client/src/components/GameSettingsScreen.tsx`         | 1    | Add a `onBack` prop + Back button (styled like `LobbyScreen`'s `.subLink`, per the existing "reuses LobbyScreen's .ctaButton" CSS convention comment already in `GameSettingsScreen.module.css:2,190`)                                                                                                                                                                                                                                                                              |
| `packages/client/src/store/useGameStore.ts`                     | 1    | No new store fields needed — `resetLobby()` (line 977) already resets `screen: 'LANDING', roomCode: null, playerSlot: null, roomError: null, gameError: null, disconnectWarning: false`                                                                                                                                                                                                                                                                                             |
| `packages/shared/src/draftEngine.ts`                            | 2, 3 | `generateDraftPacks` (363-438): thread a match-wide `usedIds: Set<string>` across the `for (const round of DRAFT_ROUNDS)` loop; `resolveGkCandidates` (250-268) and `resolveTieredCandidates` (293-315): accept/exclude the match-wide set in addition to their existing local `usedIds`; new same-pool cascade helper (does not exist today — see Bug 3 section); `FALLBACK_POOL_ORDER` cross-pool backfill in `resolveTieredCandidates` (302-312): restrict to `common`-tier only |
| `packages/server/src/__tests__/draftPacks.test.ts`              | 2, 3 | Update the per-round-only duplicate check (lines 54-66, currently explicitly scoped "not match-wide" per old D-18) to assert match-wide non-duplication instead                                                                                                                                                                                                                                                                                                                     |
| `packages/server/src/gameEngine.ts`                             | 4    | Line 2310 (`case 'SHOT'`, `shotResultWithPenalty.outcome === 'LOOSE_BALL'` branch): change `ball: { position: state.ball.position, carrierId: null }` to `ball: { position: gkEffectivePos, carrierId: null }`; also fix the `shotAttempt` event's `ballAfter` field (~line 2302) the same way so replay reconstruction stays correct                                                                                                                                               |
| `packages/client/src/components/ActionPanel.tsx`                | 5    | `canUndo`'s `isBoundary` disjunction (lines 266-270): add `evt.type === 'TACKLE_ATTEMPT' \|\| evt.type === 'STEAL_ATTEMPT'`                                                                                                                                                                                                                                                                                                                                                         |
| `packages/server/src/gameEngine.ts`                             | 5    | `applyUndo`'s `isBoundary` disjunction (lines 1400-1406): add the same two event types — NOT the separate lockout check at line 1413                                                                                                                                                                                                                                                                                                                                                |
| `packages/server/src/__tests__/gameEngine.phase26-undo.test.ts` | 5    | Extend the existing `describe('Phase 26 BUG-24: applyUndo scoping — MOVE phase', ...)` block (line 351) with a new tackle/steal-boundary scenario                                                                                                                                                                                                                                                                                                                                   |

### Recommended Wave Structure

No file overlaps exist between the three subsystems — confirmed by direct comparison of every touched file above. Recommend 3 independent plans/waves with no ordering dependency:

- **Wave A — Room lifecycle (Bug 1):** `events.ts`, `roomHandlers.ts`, `App.tsx`, `GameSettingsScreen.tsx` (+ `.module.css`)
- **Wave B — Draft engine (Bugs 2+3, tightly coupled — same function, same decisions D-06 through D-12):** `draftEngine.ts`, `draftPacks.test.ts`
- **Wave C — Movement engine (Bugs 4+5, both in `gameEngine.ts` but in disjoint functions — could be 1 or 2 plans):** `gameEngine.ts` (SHOT case line ~2310, `applyUndo` line ~1400), `ActionPanel.tsx`, `gameEngine.phase26-undo.test.ts`

Bugs 4 and 5 both touch `gameEngine.ts` but in non-adjacent, non-interacting functions (`case 'SHOT'` vs. `applyUndo`) — safe to parallelize as separate tasks within Wave C, or even separate plans, since neither fix's diff overlaps the other's.

### Anti-Patterns to Avoid

- **Fixing Bug 4 at the pointed-to locations:** Do not spend time modifying `computeShotPathDeflection` (gameEngine.ts:3615) or the `computeLooseBall` scatter-walk call site (gameEngine.ts:2757-2766) — both are already correct. The bug is 445 lines away, in the SHOT case's tie-outcome branch (line 2310). See Bug 4 section for full verification trail.
- **Fixing Bug 5 by extending the wrong check:** `applyUndo`'s line 1413 (`currentSlotEvents.some((e) => e.type === 'SLOT_ADVANCE' || e.type === 'DICE_ROLL')`) is a full per-slot LOCKOUT, not a boundary-clamp. Adding `TACKLE_ATTEMPT`/`STEAL_ATTEMPT` there would make Undo permanently unavailable for the rest of the slot even for moves made AFTER the tackle — directly contradicting D-13 ("Undo continues to work normally for any steps that happened AFTER that action"). The correct edit site is the boundary-detection reducer at lines 1399-1408 (and its client mirror at ActionPanel.tsx 265-272).
- **Reusing `useLobbyBack()`/`resetLobby()` as the WHOLE fix for Bug 1:** These are real, correct, reusable client-side reset primitives, but on their own they only disconnect+reconnect the socket and rely on the server's 90-second disconnect grace timer to eventually call `deleteRoom` — exactly the anti-pattern D-03 explicitly forbids. `WaitingScreen`'s existing Back button (which already uses this exact pattern) has this same latent gap, but it is OUT OF SCOPE for this phase per D-04 (scoped only to `GameSettingsScreen`) — do not "fix" `WaitingScreen` as a drive-by.
- **Cross-pool fallback pulling non-common tiers:** The existing `resolveTieredCandidates` fallback loop (draftEngine.ts:302-312) currently backfills at whatever tier `tierSupplyMeetsNeed` finds short — with no tier restriction. A naive "keep the loop, just also add cascade" implementation would still leave the old unrestricted-tier cross-pool pull in place. D-09 requires this loop's cross-pool contribution be filtered to `p.tier === 'common'` candidates only, once the same-pool cascade (new) has been exhausted.
- **Marking a card "used" (D-06) before it's actually dealt into a pack:** `resolveTieredCandidates`/`buildTierPoolsForRound` build a full classified/shuffled candidate pool that is usually LARGER than what a round actually draws (see `drawFromPool`, which only takes `slot.count` cards, leaving the rest of the shuffled pool unused). The match-wide `usedIds` set must only be populated with the ids that end up in `packs` (i.e., the exact cards returned by `drawFromPool`/the GK round's `dealt.slice(0, neededCount)`), not the entire candidate/classified pool — otherwise legitimately undealt candidates would be wrongly excluded from later rounds.

## Don't Hand-Roll

| Problem                               | Don't Build                        | Use Instead                                                                            | Why                                                                                                                                                                                                                                                         |
| ------------------------------------- | ---------------------------------- | -------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Room teardown                         | A new room-deletion routine        | `deleteRoom(roomCode)` (`roomStore.ts:285`)                                            | Already handles clearing disconnect timers + replay timer + Map removal; the new `LEAVE_ROOM` handler should call it directly                                                                                                                               |
| Client-side "return to landing" reset | New Zustand actions/fields         | `resetLobby()` (`useGameStore.ts:977`)                                                 | Already resets `screen`, `roomCode`, `playerSlot`, `roomError`, `gameError`, `disconnectWarning` in one action, already unit-exercised via `LobbyScreen.tsx`'s usage                                                                                        |
| Match-wide dedup id tracking          | A new module/class                 | A plain `Set<string>` threaded as a function parameter through the existing round loop | The codebase's established pattern for `usedIds` is already a local `Set` per `resolveGkCandidates`/`resolveTieredCandidates` call — extending its scope (not its shape) is the minimal-diff path CONTEXT.md's "Claude's Discretion" explicitly leaves open |
| Loose-ball scatter math               | Any new trajectory/direction logic | `computeLooseBall` (`scoreUtils.ts:87`) — untouched by this fix                        | The scatter-walk itself is already correct (cube-coordinate, parity-independent, well-tested per `scoreUtils.test.ts`'s 72-case regression suite); Bug 4's fix never touches this function, only the `ball.position` value fed into it as `from`            |

**Key insight:** Every one of this phase's 5 fixes has an exact same-file, same-pattern sibling to copy (matching the precedent established in Phase 31's `31-PATTERNS.md`, which found the identical situation for that bug-fix phase) — the GOAL/SAVE branches in the SHOT case already use `gkEffectivePos` correctly (Bug 4's copy target), and the existing boundary-set reducers already exist for SLOT_ADVANCE/KICK_OFF/HP_REPOSITION (Bug 5's copy target).

## Common Pitfalls

### Pitfall 1: Trusting CONTEXT.md's line-number pointers as the actual fix site for Bug 4

**What goes wrong:** CONTEXT.md and the folded todo both point at `computeShotPathDeflection` (~3615) and the `computeLooseBall` scatter-walk (~2757) as the investigation targets. Both are already correct — `computeShotPathDeflection` is only used for outfield-defender deflections (which already correctly use `deflectorPosition`), and the scatter-walk correctly reads `state.ball.position` as `from`.
**Why it happens:** The todo's author correctly identified the SYMPTOM (loose ball scatters from the wrong hex) but the suggested investigation pointers were approximate/aspirational, written before the actual GK-duel-tie code path was traced.
**How to avoid:** Fix `gameEngine.ts` line 2310 (and the `shotAttempt` event's `ballAfter` at ~line 2302) in the SHOT case's `outcome === 'LOOSE_BALL'` branch, using `gkEffectivePos` (already computed at line 2111) instead of `state.ball.position`.
**Warning signs:** If a plan step says "modify `computeShotPathDeflection`" or "modify the LOOSE_BALL scatter-walk clamp logic" for this bug, that is the wrong location — flag before implementation.

### Pitfall 2: Confusing "blocked by a defender" with "GK duel tie"

**What goes wrong:** There are TWO distinct code paths that can be colloquially called "blocked": (a) an outfield defender physically deflecting the shot mid-path (`computeShotPathDeflection`, already correct), and (b) the shooter-vs-GK duel resolving as a TIE (`validateShotDuel`'s `outcome === 'LOOSE_BALL'`, the actual bug). A plan or test that only exercises scenario (a) will pass without ever touching the real bug.
**Why it happens:** Both scenarios produce a `LOOSE_BALL` phase and both are plausibly described by a player as "the shot got blocked."
**How to avoid:** The regression test for D-14 must specifically construct a shooter/GK duel where combined scores tie (see `gameEngine.phase8.test.ts:718-745` for an existing tie-producing dice combination: shooter die 3 + GK die 4 with a GK dive position that does NOT cancel the tie), and assert `result.state.ball.position` equals `gkEffectivePos` (the GK's dive-adjusted position), not the shooter's position.
**Warning signs:** A test titled "blocked shot" that only sets up an outfield defender is testing the already-correct path, not the bug.

### Pitfall 3: Over-scoping the D-06 match-wide dedup to the GK round

**What goes wrong:** CONTEXT.md flags "GK supply risk" (only 4 GKs in `original`, 6 in MLS, 6 in International — 8 needed per match) as a concern under D-06. In practice, this risk does NOT manifest from D-06's match-wide dedup, because GK round (round 1, `DRAFT_ROUNDS[0]`) is always the FIRST round dealt — there is no earlier round whose dealt cards could collide with it. GK players are also permanently filtered out of every subsequent tiered round (`resolveTieredCandidates`'s `selectedUnion.filter((p) => p.role !== 'GK')`), so GK supply is never affected by anything dealt in rounds 2-6 either.
**Why it happens:** The GK-supply concern is real in the codebase's ALREADY-EXISTING pool-fallback logic (it's why `resolveGkCandidates` has backfill at all), but it predates and is independent of D-06 — D-06 doesn't add new pressure to it.
**How to avoid:** Do not spend implementation effort making the GK round D-06-aware beyond simply seeding/updating the match-wide set consistently (D-10 already says GK round behavior is otherwise unchanged). Focus real match-wide supply-risk analysis on rounds 4-6 (the only rounds using `uncommon`/`chase`/`rare` tiers) — see Pitfall 4.
**Warning signs:** A plan step that adds special-case GK-round logic to "prevent match-wide exhaustion" is solving a non-problem.

### Pitfall 4: Underestimating real supply pressure for `['original']`-only matches after D-06

**What goes wrong:** Assuming D-06's match-wide dedup is a purely defensive/theoretical change without checking whether it can actually be triggered by the existing single-pool test scenarios already in `draftPacks.test.ts` (Test 1: `['original']`).
**Why it happens:** The current codebase's `isInPool`/`resolvePoolPlayers` never needed to reason about match-wide totals before, so there was no reason to compute these numbers previously.
**How to avoid:** Use these researched, CSV-verified numbers when designing D-08/D-09 cascade tests:

| Pool                                | outfield chase | outfield rare | outfield uncommon | outfield common | GK count |
| ----------------------------------- | -------------- | ------------- | ----------------- | --------------- | -------- |
| `original` (free-agent, no poolTag) | 0              | 1             | 12                | 21              | 4        |
| `mls`                               | 3              | 9             | 11                | 37              | 6        |
| `international`                     | 6              | 10            | 21                | 23              | 6        |

Match-wide totals needed across the whole 6-round draft (both packs combined, per side is half): `chaseOrRare` = 4 (rounds 5+6), `uncommon` = 8 (rounds 4+5+6), `common` = 28 (rounds 2+3+4+5+6). For `['original']` alone: `chaseOrRare` available (1) < needed (4) — same-pool cascade (D-08) into uncommon/common covers this since `original` has 33 uncommon+common combined. `common` available (21) < needed (28) — a genuine 7-card shortfall that WILL exercise the D-09 cross-pool common-only fallback in every single `['original']`-only match, not just as an edge case. For `['mls']` and `['international']` alone, all three tiers have comfortable headroom (no fallback needed in the common case, though `mls` chase+rare=12 vs need 4 and uncommon=11 vs need 8 are tighter). Multi-pool selections (any 2+ pools) have no realistic shortage risk.
**Warning signs:** A test suite that only asserts `not.toThrow()` (like the existing Test 3 in `draftPacks.test.ts`) without verifying the ACTUAL fallback tier used would silently accept a regression where common-tier fallback incorrectly pulls rare/chase cards instead.

### Pitfall 5: Marking undealt candidates as "used" in D-06's match-wide set

**What goes wrong:** `resolveTieredCandidates` returns a full `classified: TieredPoolPlayer[]` array that is the CANDIDATE pool for a round, not the dealt cards. `buildTierPoolsForRound` shuffles subsets of this into per-tier draw pools, and `drawFromPool` only consumes `slot.count` cards from each pool via `splice` — leaving genuine leftover, never-dealt candidates. If the match-wide `usedIds` set is populated from `classified` (or from the tier pools) instead of from the actual `cards` arrays pushed into `packs`, legitimately available players will be wrongly excluded from later rounds, worsening the supply-exhaustion risk described in Pitfall 4 for no reason.
**Why it happens:** It's tempting to mark a candidate "used" as soon as it's fetched/classified for a round, since that's structurally the simplest hook point.
**How to avoid:** Only add ids to the match-wide set from the actual dealt `cards` (the values pushed into `packs.push({ packNumber, round: round.round, cards })`), after each round's pack-dealing loop completes — not from the round's candidate/classified arrays.
**Warning signs:** A diff that calls `.add()` on the match-wide set inside `resolveGkCandidates`/`resolveTieredCandidates` (which only build CANDIDATE pools) rather than inside/after the `packs.push(...)` loop in `generateDraftPacks` itself.

### Pitfall 6: `LEAVE_ROOM` silently duplicating `WaitingScreen`'s existing (buggy) Back pattern

**What goes wrong:** `LobbyScreen.tsx`'s `useLobbyBack()` hook is already wired to `WaitingScreen`'s Back button and does `sessionStorage.removeItem` + `socket.disconnect()`/`socket.connect()` + `resetLobby()` — with NO explicit room-teardown emit, relying entirely on the server's 90s disconnect grace timer. This is a real, pre-existing, in-scope-adjacent bug (same defect class as this phase's Bug 1) that is explicitly OUT OF SCOPE per D-04.
**Why it happens:** It's the closest existing analog and looks like exactly the right thing to reuse wholesale.
**How to avoid:** Build a NEW handler flow for `GameSettingsScreen` specifically: emit `LEAVE_ROOM` (new event, calls `deleteRoom` immediately server-side) THEN do the equivalent client-side reset (can reuse `resetLobby()` itself, and can reuse the `sessionStorage.removeItem('ca_session_token')` line, but must NOT rely on `socket.disconnect()`/`socket.connect()` + the grace timer as the room-cleanup mechanism).
**Warning signs:** A `GameSettingsScreen` Back button that calls `useLobbyBack()` directly with no new `LEAVE_ROOM` emit added.

## Code Examples

### Bug 1 — Correct pattern to mirror for the new `LEAVE_ROOM` handler

```typescript
// Source: packages/server/src/roomHandlers.ts:149-182 (ROOM_CREATE handler — the pattern to mirror)
socket.on(ClientEvents.ROOM_CREATE, () => {
  if (socket.data.roomCode !== undefined) {
    socket.emit(ServerEvents.ROOM_ERROR, 'ALREADY_IN_ROOM');
    return;
  }
  // ... creates + persists socket.data.roomCode/playerSlot/sessionToken, socket.join(roomCode)
});

// New LEAVE_ROOM handler (design sketch — not yet in codebase):
socket.on(ClientEvents.LEAVE_ROOM, () => {
  const roomCode = socket.data.roomCode;
  if (roomCode === undefined) return; // nothing to leave
  deleteRoom(roomCode); // packages/server/src/roomStore.ts:285 — existing fn, already clears timers
  void socket.leave(roomCode);
  socket.data.roomCode = undefined;
  socket.data.playerSlot = undefined;
  socket.data.sessionToken = undefined;
});
```

### Bug 1 — Existing client-side reset primitive (already correct, reuse directly)

```typescript
// Source: packages/client/src/store/useGameStore.ts:977-986 (already exists, no changes needed)
resetLobby: () =>
  set({
    screen: 'LANDING',
    roomCode: null,
    playerSlot: null,
    roomError: null,
    gameError: null,
    disconnectWarning: false,
    gameState: mockMovementState,
  }),
```

### Bug 4 — The exact sibling pattern to copy (SAVE branches, already correct)

```typescript
// Source: packages/server/src/gameEngine.ts:2339-2341, 2350, 2368 (already correct — copy this pattern)
ballAfter: handling.caught
  ? { position: gkEffectivePos, carrierId: gk.id }
  : { position: gkEffectivePos, carrierId: null },
// ...
ball: { position: gkEffectivePos, carrierId: gk.id },

// Source: packages/server/src/gameEngine.ts:2286-2318 (the BUGGY branch — this is what to fix)
if (shotResultWithPenalty.outcome === 'LOOSE_BALL') {
  const shotAttempt: ActionEvent = {
    // ...
    ballAfter: { position: state.ball.position, carrierId: null }, // BUG: should be gkEffectivePos
  };
  return {
    ok: true,
    state: {
      ...state,
      pieces: piecesWithGKPos,
      phase: 'LOOSE_BALL',
      ball: { position: state.ball.position, carrierId: null }, // BUG: should be gkEffectivePos
      // ...
    },
  };
}
```

### Bug 5 — The exact boundary-set edit site (both client and server)

```typescript
// Source: packages/server/src/gameEngine.ts:1399-1408 (applyUndo — SERVER, authoritative)
const lastSlotAdvanceIdx = state.eventLog.reduce<number>((acc, evt, idx) => {
  const isBoundary =
    evt.type === 'SLOT_ADVANCE' ||
    evt.type === 'KICK_OFF' ||
    (state.phase === 'HIGH_PASS_MOVE' && evt.type === 'HP_REPOSITION') ||
    (state.phase === 'FIRST_TIME_PASS_MOVE' && evt.type === 'FTP_REPOSITION') ||
    (state.phase === 'FREE_KICK_SETUP' &&
      (evt.type === 'FK_KICKER_CHOSEN' || evt.type === 'FK_STAGE_ADVANCE'));
  // ADD: || evt.type === 'TACKLE_ATTEMPT' || evt.type === 'STEAL_ATTEMPT'  (D-13 fix)
  return isBoundary ? idx : acc;
}, -1);

// DO NOT touch this separate check — it is a full-lockout for a DIFFERENT event type
// ('DICE_ROLL', not TACKLE_ATTEMPT/STEAL_ATTEMPT) and adding to it would over-block:
if (currentSlotEvents.some((e) => e.type === 'SLOT_ADVANCE' || e.type === 'DICE_ROLL')) {
  return { ok: false, reason: 'UNDO_LOCKED' };
}
```

```typescript
// Source: packages/client/src/components/ActionPanel.tsx:265-272 (canUndo — CLIENT, UX mirror)
const lastBoundaryIdx = eventLog.reduce<number>((acc, evt, idx) => {
  const isBoundary =
    evt.type === 'SLOT_ADVANCE' ||
    evt.type === 'KICK_OFF' ||
    (phase === 'HIGH_PASS_MOVE' && evt.type === 'HP_REPOSITION') ||
    (phase === 'FIRST_TIME_PASS_MOVE' && evt.type === 'FTP_REPOSITION');
  // ADD: || evt.type === 'TACKLE_ATTEMPT' || evt.type === 'STEAL_ATTEMPT'  (D-13 fix)
  return isBoundary ? idx : acc;
}, -1);
```

### Bug 2/3 — Where match-wide dedup and tier cascade must be threaded

```typescript
// Source: packages/shared/src/draftEngine.ts:392-431 (generateDraftPacks round loop — edit site)
let packNumber = 0;
// ADD (D-06): const matchUsedIds = new Set<string>();

for (const round of DRAFT_ROUNDS) {
  if (round.kind === 'gk') {
    // resolveGkCandidates(selectedUnion, fallbackChain, neededCount) — ADD matchUsedIds param,
    // filter `selectedUnion`/fallback candidates to exclude ids already in matchUsedIds
    // ... existing dealt/packs.push logic ...
    // ADD: after packs.push loop, add every dealt card's id (the ones actually sliced into packs.push) to matchUsedIds
  } else {
    // resolveTieredCandidates(selectedUnion, fallbackChain, round) — ADD matchUsedIds param
    // NEW (D-08): before the existing FALLBACK_POOL_ORDER loop, add a same-pool cascade step
    //   that tries lower tiers (chase->rare->uncommon->common) within `classified` before
    //   reaching the cross-pool fallback loop at all.
    // MODIFY (D-09): the existing cross-pool fallback loop (currently pulls whatever tier is
    //   short) must filter `fallbackPlayers` to `p.tier === 'common'` only once reached.
    // ... existing tierPools/drawFromPool logic ...
    // ADD: after both packs' cards are drawn for this round, add every card id in `cards` to matchUsedIds
  }
}
```

## State of the Art

Not applicable — no external library/framework version changes in this phase. All "state of the art" here is internal: the codebase's OWN prior decision (D-18, Phase 30) is being reversed by this phase's D-06, which is a normal in-repo evolution, not an ecosystem change.

## Assumptions Log

| #   | Claim                                                                                                                                                             | Section               | Risk if Wrong                                                                                                                                                                                                                                                                                                          |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A1  | Recommended new requirement IDs are `BUG-33` through `BUG-37` (continuing the existing sequence from `BUG-32`)                                                    | Phase Requirements    | Low — cosmetic; the planner/roadmapper can freely choose different IDs, this is explicitly flagged as "TBD" and a suggestion only, not a locked decision                                                                                                                                                               |
| A2  | The `LEAVE_ROOM` handler does not need the `room.isProcessing` mutex, since it's a terminal action with nothing left to race against once the room is deleted     | Project Constraints   | Low-Medium — if a rapid double-click could fire `LEAVE_ROOM` twice before the first `deleteRoom` completes, the second call is a no-op anyway (`deleteRoom` on an already-deleted `roomCode` just does `rooms.delete()` on a missing key, safe); worth a quick planner sanity-check but not expected to need the mutex |
| A3  | No server ack/broadcast is needed after `LEAVE_ROOM` — the client resets its own screen state immediately after emitting, without waiting for a server round-trip | Code Examples (Bug 1) | Low — this mirrors the "Claude's Discretion" note in CONTEXT.md about exact payload shape; if the planner prefers a confirmation round-trip (e.g. to guard against `deleteRoom` silently failing), that's a valid alternative design, just adds one more event                                                         |

**If this table is empty:** N/A — see entries above. All three assumptions are low-risk implementation-detail judgment calls already flagged as "Claude's Discretion" in CONTEXT.md, not disputed facts.

## Open Questions (RESOLVED)

1. **(RESOLVED)** **Does the away player need to be notified if `LEAVE_ROOM` fires after they've already joined?**
   - What we know: D-05 concluded no guard is needed because "in practice the room code isn't given to the away player until the next screen." `joinRoom` (`roomStore.ts:237-263`) has no gate tied to which screen the host is viewing, so a fast away-player join before Back is clicked is technically possible.
   - What's unclear: If this race does occur, the away player's socket would be left in a room that no longer exists in the `rooms` Map after `deleteRoom` — their subsequent actions would silently no-op (`getRoom(roomCode)` returns `undefined`) rather than erroring cleanly.
   - Resolution: Treated as out-of-scope per D-05's explicit resolution ("no away-player-joined guard needed") and accepted as a documented risk in plan 36-01's threat model (T-36-03).

2. **(RESOLVED)** **Should `resetLobby()` be reused as-is by the new Back handler, or does `GameSettingsScreen` need a dedicated reset?**
   - What we know: `resetLobby()` resets exactly the fields needed (`screen`, `roomCode`, `playerSlot`, `roomError`, `gameError`, `disconnectWarning`) and is already used by `LobbyScreen.tsx`.
   - What's unclear: `GameSettingsScreen`'s Back click happens with `teamType`/`draftPools`/`selectedSpeed` local `useState` in `App.tsx` (not the Zustand store — see `App.tsx:40-47`) already set from a possible prior interaction; `resetLobby()` doesn't touch these since they're outside Zustand.
   - Resolution: Plan 36-01 Task 2 implements resetting `App.tsx`'s local `teamType`/`draftPools`/`selectedSpeed`/`homePickedTeam` state alongside `resetLobby()`, so a fresh Create Room afterward doesn't inherit stale local state.

## Environment Availability

Skipped — this phase has no external dependencies beyond the existing dev toolchain (Node 22, pnpm, Vitest, already installed and verified working via the existing test suite). No new services, CLIs, or runtimes required.

## Validation Architecture

### Test Framework

| Property           | Value                                                                                                                                                                   |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Framework          | Vitest 2.1.9 (all 3 packages: shared, server, client)                                                                                                                   |
| Config file        | `packages/shared/vitest.config.ts`, `packages/server/vitest.config.ts`, `packages/client/vitest.config.ts` (client also uses `jsdom` + `@testing-library/react` 14.3.1) |
| Quick run command  | `pnpm --filter @counter-attack/server test -- <file-substring>` (Vitest CLI filters by filename substring) or `npx vitest run <path/to/file>` from the package dir      |
| Full suite command | `pnpm test` (root — runs `pnpm -r test`, i.e. all 3 packages)                                                                                                           |

### Phase Requirements → Test Map

| Req ID (suggested) | Behavior                                                                                                                    | Test Type        | Automated Command                                                                                                                      | File Exists?                                                                                                             |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------- | ---------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| BUG-33             | Back button restores + tears down room server-side within grace period (not 90s later)                                      | integration      | `pnpm --filter @counter-attack/server test -- room.integration` (extend existing suite)                                                | ✅ extend `packages/server/src/__tests__/room.integration.test.ts`                                                       |
| BUG-33             | Back button renders only on `GameSettingsScreen`, not other pre-game screens                                                | unit (component) | `pnpm --filter @counter-attack/client test -- GameSettingsScreen`                                                                      | ✅ extend `packages/client/src/components/GameSettingsScreen.test.tsx`                                                   |
| BUG-34             | No player id appears in more than one pack across all 6 rounds/12 packs                                                     | unit             | `pnpm --filter @counter-attack/server test -- draftPacks`                                                                              | ✅ extend `packages/server/src/__tests__/draftPacks.test.ts` (modify the existing per-round-only check at lines 54-66)   |
| BUG-35             | Same-pool cascade tried before cross-pool; cross-pool fallback pulls common-tier only                                       | unit             | `pnpm --filter @counter-attack/shared test -- draftEngine` (may need a new `draftEngine.test.ts` if one doesn't exist — see gap below) | ⚠️ verify existence during Wave 0                                                                                        |
| BUG-35             | `['original']`-only match still succeeds without throwing, using common-tier cross-pool fallback for the ~7-card shortfall  | integration      | `pnpm --filter @counter-attack/server test -- draftPacks`                                                                              | ✅ extend Test 1 in `draftPacks.test.ts`                                                                                 |
| BUG-36             | Shooter/GK duel TIE routes loose ball to `gkEffectivePos`, not shooter's hex                                                | unit             | `pnpm --filter @counter-attack/server test -- gameEngine.phase8`                                                                       | ✅ extend `packages/server/src/__tests__/gameEngine.phase8.test.ts` (near line 718-745, the existing tie-producing test) |
| BUG-37             | Undo cannot revert past a resolved TACKLE_ATTEMPT/STEAL_ATTEMPT within the same MOVE slot, but CAN undo moves made after it | unit             | `pnpm --filter @counter-attack/server test -- gameEngine.phase26-undo`                                                                 | ✅ extend `packages/server/src/__tests__/gameEngine.phase26-undo.test.ts` (line 351 describe block)                      |
| BUG-37             | Client `canUndo` mirrors the same boundary (button disabled state)                                                          | unit (component) | `pnpm --filter @counter-attack/client test -- ActionPanel`                                                                             | ✅ extend `packages/client/src/components/ActionPanel.test.tsx`                                                          |

### Sampling Rate

- **Per task commit:** the single most relevant `vitest run <file>` for the file(s) just touched (see table above)
- **Per wave merge:** full package suite for whichever package(s) the wave touched (`pnpm --filter @counter-attack/shared test`, `@counter-attack/server test`, `@counter-attack/client test` as applicable)
- **Phase gate:** `pnpm test` (full monorepo suite) green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] Verify whether `packages/shared/src/draftEngine.test.ts` exists as a standalone unit-test file for the pure engine functions (`resolveGkCandidates`, `resolveTieredCandidates`, the new cascade helper), separate from `packages/server/src/__tests__/draftPacks.test.ts`'s integration-style structural-invariant tests. If it doesn't exist, Wave B likely needs one — the new same-pool cascade logic (D-08) is intricate enough to warrant direct unit tests against `resolveTieredCandidates` rather than only being exercised indirectly through `generateMatchPacks`'s structural-invariant tests.
- [ ] No framework install needed — Vitest is already configured and working in all 3 packages.

_(All other test infrastructure — Vitest config, existing describe blocks to extend, `makeShotState`/`makeMovementState` fixtures — already exists and covers this phase's needs; see file-by-file mapping above.)_

## Security Domain

`security_enforcement` is not explicitly set to `false` in `.planning/config.json` (absent = enabled), so this section is included per protocol. However, this phase's scope is internal defect correction with no new user-facing input surface, no new authentication/authorization logic, and no new cryptography — the ASVS categories below are included for completeness but none require new controls beyond what's already in place.

### Applicable ASVS Categories

| ASVS Category         | Applies        | Standard Control                                                                                                                                                                                                                                                                                                                                                           |
| --------------------- | -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| V2 Authentication     | No             | No auth changes — session-token handling (`sessionStorage`) already exists and is unchanged by this phase                                                                                                                                                                                                                                                                  |
| V3 Session Management | Marginal       | The new `LEAVE_ROOM` handler destroys server-side room state on client request — must verify `socket.data.roomCode` (not client-supplied room code) to prevent a socket from deleting a room it doesn't belong to (mirrors the existing pattern already used by every other room handler, which reads `socket.data.roomCode` rather than trusting a client-supplied value) |
| V4 Access Control     | Marginal       | Same as above — `LEAVE_ROOM` must only ever act on `socket.data.roomCode`, never accept a room code as an event payload argument                                                                                                                                                                                                                                           |
| V5 Input Validation   | No new surface | `LEAVE_ROOM` should take no payload (void, matching `ROOM_CREATE`'s signature) — there is nothing for a malicious client to inject                                                                                                                                                                                                                                         |
| V6 Cryptography       | No             | Draft pack RNG already uses `crypto.randomInt` server-side (T-28-04-FAIR fairness boundary, unchanged by D-06/D-08/D-09 — these are pure filtering/selection changes downstream of the RNG, not new randomness sources)                                                                                                                                                    |

### Known Threat Patterns for this stack

| Pattern                                                                                                  | STRIDE    | Standard Mitigation                                                                                                                                                                                                                                                                                              |
| -------------------------------------------------------------------------------------------------------- | --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Client claims to leave a room it isn't actually in (forged/stale `roomCode`)                             | Spoofing  | `LEAVE_ROOM` handler reads `socket.data.roomCode` (server-assigned at `ROOM_CREATE`/`ROOM_JOIN` time), never a client-supplied event argument — same pattern already used by every existing room handler in `roomHandlers.ts`                                                                                    |
| Predictable/manipulable draft pack contents (client could pre-compute or influence which cards it gets)  | Tampering | Already mitigated pre-existing: `generateDraftPacks` is RNG-agnostic and only ever invoked server-side via `generateMatchPacks`'s `crypto.randomInt` binding (T-28-04-FAIR) — D-06/D-08/D-09 do not touch this boundary, they only change candidate filtering logic that runs after the RNG shuffle              |
| Client bypasses the Undo boundary by forging a `game:undo` sequence that skips past a resolved dice roll | Tampering | `applyUndo` (server-authoritative) is the actual enforcement point — the client `canUndo` check is UX-only (button disabled state). D-13's fix must land in BOTH layers, matching this project's established defense-in-depth convention (same pattern as BUG-32 in Phase 31, per CONTEXT.md's explicit callout) |

## Sources

### Primary (HIGH confidence — direct source read this session)

- `packages/client/src/components/GameSettingsScreen.tsx` — confirmed no Back button exists
- `packages/client/src/App.tsx` (lines 26-130, 288-289) — confirmed `onRoomJoined`/`GAME_SETTINGS` routing matches D-02
- `packages/client/src/store/useGameStore.ts` (lines 20-115, 955-999) — confirmed `Screen` type, `resetLobby()` action
- `packages/client/src/components/LobbyScreen.tsx` (full file) — discovered `useLobbyBack()` pattern and its D-03-relevant gap
- `packages/server/src/roomHandlers.ts` (lines 140-480, 1000-1068) — confirmed `ROOM_CREATE`/`ROOM_JOIN`/`ROOM_SETTINGS_CONFIRM` handler patterns and the disconnect grace-timer path (1028-1067, matches D-03's "1047-1049" pointer)
- `packages/server/src/roomStore.ts` (lines 199-320) — confirmed `joinRoom` has no screen-state gate (matches D-05), confirmed `deleteRoom` (285-295) is reusable as-is
- `packages/shared/src/events.ts` (lines 1-30, 150-260) — confirmed `ClientEvents`/`ServerEvents` naming convention and typed-payload interface structure
- `packages/shared/src/draftEngine.ts` (full file) — confirmed `generateDraftPacks`, `resolveGkCandidates`, `resolveTieredCandidates`, `buildTierPoolsForRound`, `FALLBACK_POOL_ORDER`, `assignTiers`, `classifyTier` — no existing tier-cascade mechanism, cross-pool fallback currently unrestricted by tier
- `packages/shared/src/types.ts` (lines 460-585, 55-230) — confirmed `SELECTABLE_DRAFT_POOLS`, `TIER_STAT_THRESHOLDS` (chase>=32, rare===31, uncommon 29-30), `DRAFT_ROUNDS` (round compositions), `ActionEventType`/`ActionEvent` union (confirmed `DICE_ROLL` is a distinct type from `TACKLE_ATTEMPT`/`STEAL_ATTEMPT`)
- `packages/server/src/__tests__/draftPacks.test.ts` (full file) — confirmed the existing per-round-only duplicate check (lines 54-66) that must change for D-06
- `packages/server/src/draftPacks.ts` (full file) — confirmed `generateMatchPacks` signature is unaffected by D-06/D-08/D-09 (internal-only changes)
- `packages/server/src/gameEngine.ts` (lines 780-1000, 1340-1520, 1990-2470, 2680-2800, 3580-3710) — confirmed the actual root cause of Bug 4 (line 2310, not the CONTEXT.md-pointed locations), confirmed `applyUndo`'s boundary-vs-lockout distinction (lines 1399-1413), confirmed TACKLE_ATTEMPT/STEAL_ATTEMPT emission sites and their FAIL-continues-MOVE-phase behavior (lines 803-992)
- `packages/client/src/components/ActionPanel.tsx` (lines 240-350) — confirmed client `canUndo`'s boundary computation mirrors the server's structure
- `packages/shared/src/scoreUtils.ts` / `scoreUtils.test.ts` — confirmed `computeLooseBall` is already correct and well-tested (not the Bug 4 fix site)
- `packages/shared/src/shotValidator.ts` (full file) — confirmed `validateShotDuel`'s `LOOSE_BALL` outcome is the tie case, which is the actual "blocked shot" scenario for Bug 4
- `packages/shared/src/data/player-pool.csv` — computed exact tier/GK distribution per pool via a one-off Node script (verified counts in Pitfall 4's table)
- `packages/server/src/__tests__/gameEngine.phase26-undo.test.ts`, `gameEngine.phase8.test.ts` — confirmed existing test file/describe-block conventions to extend
- `packages/server/src/__tests__/room.integration.test.ts` — confirmed real-socket integration test convention (`ClientEvents.ROOM_CREATE` emit pattern) to extend for `LEAVE_ROOM`
- `.planning/phases/31-bug-fixes/31-CONTEXT.md`, `31-PATTERNS.md` — precedent for this project's bug-fix phase pattern (in-file sibling analogs, defense-in-depth client+server fixes, folded-todo handling); confirmed the same "CONTEXT.md pointer needs correction during implementation" situation occurred in the prior bug-fix phase too (SNAPSHOT_DEFLECT validator location correction)
- `.planning/config.json` — confirmed `workflow.nyquist_validation: true` (Validation Architecture section required) and no search-provider MCP tools configured for this project (brave/firecrawl/exa all `false`)
- `.planning/REQUIREMENTS.md`, `.planning/STATE.md` — confirmed no BUG-NN ids exist yet for Phase 36, confirmed project decision history

### Secondary / Tertiary

None — this phase required zero external documentation lookups (no new libraries, frameworks, or APIs). Every claim in this document is either `[VERIFIED: direct source read]` or explicitly marked `[ASSUMED]` in the Assumptions Log above.

## Metadata

**Confidence breakdown:**

- Standard stack: N/A (no new stack — HIGH confidence nothing needs to be added)
- Architecture: HIGH — every fix site verified against current source, including one significant correction to CONTEXT.md's pointers (Bug 4)
- Pitfalls: HIGH — all 6 pitfalls above are drawn from actual code-reading discoveries this session, not speculation

**Research date:** 2026-07-27
**Valid until:** Effectively unbounded for this specific phase (internal-only, no external dependency drift risk) — but re-verify line numbers if any other phase/quick-task touches `gameEngine.ts`, `draftEngine.ts`, `roomHandlers.ts`, `ActionPanel.tsx`, or `GameSettingsScreen.tsx` before this phase is implemented, since line numbers will shift.
