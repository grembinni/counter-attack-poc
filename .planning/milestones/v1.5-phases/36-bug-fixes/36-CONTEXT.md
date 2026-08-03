# Phase 36: Bug Fixes - Context

**Gathered:** 2026-07-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Five known defects are fixed and verified:

1. **Game Settings Back button** — `GameSettingsScreen.tsx` has no way to navigate back; host gets stuck once they've clicked Create Room.
2. **Duplicate players in draft packs** — a player can currently appear in more than one pack across different rounds of the same match (documented as intentional in Phase 30's D-18); this phase reverses that decision to match-wide uniqueness.
3. **Draft pool restriction verification** — audit + regression tests confirming the existing cross-pool fallback (D-11) only ever activates when the selected pool(s) genuinely can't supply a round/tier.
4. **Loose-ball path origin on a blocked shot** — folded from `.planning/todos/pending/loose-ball-pathing-blocked-shot-wrong-origin.md`.
5. **Undo boundary at a dice-roll action** — folded from `.planning/todos/pending/undo-boundary-should-stop-at-dice-roll-trigger.md`.

This phase does NOT touch response-move activation logic (RESP-01..09, out of scope for all of v1.5), does not touch chrome/highlight color systems (Phase 33/34), and does not touch ActionPanel/ActionLog formatting (Phase 35).

</domain>

<decisions>
## Implementation Decisions

### Game Settings Back button

- **D-01:** Back navigates to the Landing screen (room-code entry / create-join choice) — `GameSettingsScreen` is the very first step after Create Room, so there's no meaningful intermediate screen.
- **D-02:** The room already exists server-side by the time `GameSettingsScreen` renders — confirmed via `App.tsx`'s `onRoomJoined` handler (`packages/client/src/App.tsx:74-86`), which stores `roomCode`/session token and transitions the host straight to `GAME_SETTINGS` on room creation, before any settings are confirmed. Back must therefore tear the room down server-side, not just switch the client screen.
- **D-03:** Add a new dedicated `LEAVE_ROOM` (or equivalent) socket event + server handler that immediately deletes the room and clears client session storage — do NOT rely on the existing disconnect/grace-timer path (`roomHandlers.ts:1047-1049`'s `deleteRoom(roomCode)` on timeout), since that leaves the room code alive/joinable for up to ~90s after Back is clicked.
- **D-04:** This Back button is scoped ONLY to `GameSettingsScreen` (the speed/team-type/draft-pool screen) — explicitly NOT added to `UniformSelectionScreen`, `LineupAssignmentScreen`, or any other pre-game screen.
- **D-05:** Always show/allow Back regardless of `room.status`, even though `joinRoom` (`roomStore.ts:237-263`) technically permits the away player to join at any time the room is `'waiting'` (no gate tied to which screen the host is viewing). User's reasoning: in practice the room code isn't given to the away player until the next screen, so this race is a non-issue — no away-player-joined guard needed on the Back button.

### Duplicate players in draft packs (reverses Phase 30 D-18)

- **D-06:** Player uniqueness is match-wide, not per-round. A player may appear in at most ONE pack across all 6 rounds / 12 packs of a single match. This explicitly overrides `packages/shared/src/draftEngine.ts`'s documented D-18 ("a card CAN reappear in a different round, since discarded/unpicked cards are never tracked match-wide") — that comment and the underlying per-round-fresh `resolveGkCandidates`/`resolveTieredCandidates`/`buildTierPoolsForRound` calls in `generateDraftPacks` (`draftEngine.ts:363-438`) must be changed to thread a persistent "already-used-this-match" id set across every round's candidate resolution, not just within a single round's `usedIds` (currently scoped per-round-call only).
- **D-07:** Within-round no-duplicate-card behavior (existing D-09) is unaffected — this is a superset extension, not a replacement.

### Cross-pool / cross-tier fallback interaction (ties D-06, item 2, and item 3 together)

- **D-08 (tier cascade, same pool first):** When a pack slot's exact tier is short on supply (now more likely given D-06's match-wide dedup), cascade DOWN through tiers within the already-selected pool(s) first: `chase → rare → uncommon → common`. Never substitute a HIGHER tier than the slot originally called for (e.g. never give a 'rare' slot a 'chase' card just because chase is available) — only ever step down.
- **D-09 (cross-pool fallback restricted to common only):** If the same-pool tier cascade reaches `common` and is STILL short, only THEN fall back to the existing D-11 cross-pool chain (`FALLBACK_POOL_ORDER = ['mls', 'original']`) — and even then, only pull `common`-tier cards from the other pool(s). Never pull a rare/chase/uncommon card from a non-selected pool. This is a behavior change from today's D-11, which currently backfills at whatever tier is short, not just common.
- **D-10 (GK round exemption confirmed unchanged):** GK-round backfill (`resolveGkCandidates`, `draftEngine.ts:250-268`) has no tier concept — D-08/D-09 don't apply to it; it keeps its existing pool-fallback-only behavior, now also constrained by D-06's match-wide-unique id set.
- **D-11 (supply exhaustion fallback, not silent):** If a slot is still short after cascading to common AND exhausting the common-tier cross-pool fallback, keep the existing loud-fail "insufficient supply" error (`generateDraftPacks`'s established CR-01/WR-01 fail-closed convention) — do not silently reuse a used card or leave a pack short.

### Draft pool restriction — verification scope (item 3)

- **D-12:** This item is an audit + regression-test task, not a standalone behavior change beyond D-08/D-09 above. Confirm (with tests) that: (a) the D-08 same-pool tier cascade is tried before any cross-pool reach, and (b) cross-pool fallback never pulls a non-common card from a non-selected pool. If auditing surfaces an actual gap against that rule, fix it as part of this task.

### Undo boundary at a dice-roll action (folded todo)

- **D-13:** Undo is boundary-clamped, not fully disabled. Once a dice-roll-triggering action (`TACKLE_ATTEMPT` / `STEAL_ATTEMPT`) has resolved within the current move, Undo continues to work normally for any steps that happened AFTER that action — it only refuses to revert state to before it. Add `TACKLE_ATTEMPT`/`STEAL_ATTEMPT` to the existing boundary-event set in both the client `canUndo` scan (`ActionPanel.tsx`) and the server's `applyUndo` guard (`gameHandlers.ts`), per the todo's suggested investigation.

### Loose-ball path origin on a blocked shot (folded todo)

- **D-14:** Root-cause fix plus targeted regression tests for the specific blocked-shot scenario — not a broader sweep across all block/deflection angle combinations. Confirm which hex `computeLooseBall`'s `from` argument is seeded with when a shot is blocked (`packages/server/src/gameEngine.ts` — `computeShotPathDeflection` ~line 3615, `computeLooseBall` ~line 2757) and correct it to the blocking piece's/deflection hex instead of the shooter's origin hex.

### Claude's Discretion

- Exact naming/payload shape of the new `LEAVE_ROOM` socket event (D-03) — implementation-detail judgment call, following the project's existing event-naming conventions (`ROOM_SETTINGS_CONFIRM`, etc.).
- Exact data structure used to thread the match-wide "already-used" player-id set through `generateDraftPacks`'s round loop (D-06) — implementation-detail judgment call.
- Whether the D-12 audit surfaces any actual pre-existing gap in D-11's current behavior beyond what D-08/D-09 already redefine — if found, fix as part of this task per D-12.

### Folded Todos

- **`loose-ball-pathing-blocked-shot-wrong-origin.md`** — "loose-ball pathing on a blocked shot paths from the shooting square instead of the blocking square." Same defect the user listed as item 4; already has root-cause pointers from Phase 34/35 discussions (see D-14 above).
- **`undo-boundary-should-stop-at-dice-roll-trigger.md`** — "Undo can progress earlier than a dice-roll-triggering action (tackle/steal) within a move." Same defect the user listed as item 5; already has root-cause pointers from Phase 34/35 discussions (see D-13 above).

</decisions>

<canonical_refs>

## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Bug root-cause backlog docs (folded into this phase)

- `.planning/todos/pending/loose-ball-pathing-blocked-shot-wrong-origin.md` — root-cause pointer for D-14
- `.planning/todos/pending/undo-boundary-should-stop-at-dice-roll-trigger.md` — root-cause pointer for D-13

### Project/milestone context

- `.planning/PROJECT.md` — v1.5 milestone goal, current-state tech debt list
- `.planning/REQUIREMENTS.md` — v1.5 requirements (no BUG-NN ids assigned yet for this phase's 5 items — planner/roadmapper should mint them)
- `.planning/ROADMAP.md` (Phase 36 section) — phase goal, 5 success criteria, dependency on Phase 35
- `.planning/phases/31-bug-fixes/31-CONTEXT.md` — precedent for this project's bug-fix phase pattern (defense-in-depth client+server fixes, folded-todo handling)

### Existing code (Game Settings / room lifecycle)

- `packages/client/src/components/GameSettingsScreen.tsx` — no Back button/prop exists today; D-01/D-04 target
- `packages/client/src/App.tsx` (lines 74-86, 288-289) — `onRoomJoined` handler confirms room-already-exists timing (D-02); `GAME_SETTINGS` screen routing
- `packages/server/src/roomHandlers.ts` (lines 1047-1049) — existing disconnect-driven `deleteRoom` grace-timer path; NOT to be reused per D-03
- `packages/server/src/roomStore.ts` (`joinRoom`, lines 237-263) — confirms `room.status` stays `'waiting'` regardless of host's current screen (informed D-05's discussion, resolved as no-guard-needed)

### Existing code (Draft engine — duplicate players / pool / tier fallback)

- `packages/shared/src/draftEngine.ts` — `generateDraftPacks` (lines 363-438) is the D-06/D-08/D-09 primary edit site; `resolveGkCandidates` (250-268) and `resolveTieredCandidates` (293-315) currently resolve candidates fresh per round — must be threaded with a match-wide used-id set; documented D-18 comment (lines ~354-357) is now superseded by D-06 and must be updated/removed; `FALLBACK_POOL_ORDER` (line 181) and `buildTierPoolsForRound` (323-338) are the D-08/D-09 cascade edit sites
- `packages/server/src/draftPacks.ts` — `generateMatchPacks`, the server-authoritative entry point calling `generateDraftPacks` with `crypto.randomInt` (unaffected by these changes but must remain the sole RNG-binding site, per its existing threat-model comment)
- `packages/shared/src/data/player-pool.csv` — 188 total players; only 1 GK per real team (4 in 'original'/free-agent, 6 in MLS, 6 in International) — informs why D-06 raises real supply-exhaustion risk for single-pool GK rounds (8 GKs needed per match)
- `packages/shared/src/types.ts` (lines 533-584) — `DRAFT_ROUNDS`, `PACKS_PER_ROUND` (2), `cardsPerPack` (4) — confirms 48 total player-cards drawn per match (8 GK + 40 outfield)
- `packages/server/src/__tests__/draftPacks.test.ts`, `packages/server/src/draftSession.test.ts`, `packages/server/src/__tests__/draftSession.integration.test.ts` — existing test coverage to extend for D-06/D-08/D-09/D-12

### Existing code (Loose-ball / Undo — folded todos)

- `packages/server/src/gameEngine.ts` — `computeShotPathDeflection` (~line 3615), `computeLooseBall` (~line 2757) for D-14; both folded-todo files list these same locations
- `packages/client/src/components/ActionPanel.tsx` — `canUndo` event-log boundary scan for D-13
- `packages/server/src/gameHandlers.ts` — server-side `applyUndo` validation for D-13

No other external specs/ADRs apply beyond the above — requirements are fully captured in the Decisions section.

</canonical_refs>

<code_context>

## Existing Code Insights

### Reusable Assets

- `deleteRoom(roomCode)` (`roomStore.ts`) — existing room-teardown function; D-03's new `LEAVE_ROOM` handler should call this directly rather than duplicating teardown logic.
- `usedIds` per-round dedup pattern already exists in `resolveGkCandidates`/`resolveTieredCandidates` (local `Set` scoped to one round's call) — D-06 extends this exact pattern to a persistent set threaded across the whole `generateDraftPacks` call instead of re-creating it fresh per round.
- `SELECTABLE_DRAFT_POOLS` — single source of truth for which pools may be chosen; unaffected by this phase's changes but referenced by the fallback logic being modified.

### Established Patterns

- Server-authoritative fail-closed convention (CR-01/WR-01, `draftEngine.ts` comments) — D-11 explicitly keeps this pattern rather than introducing a new silent-degradation path.
- Defense-in-depth client+server validation (used for BUG-32 in Phase 31) — D-13's undo-boundary fix follows the same two-layer pattern (client `canUndo` + server `applyUndo`).
- `hasConfirmed`-style double-submit guards already exist in `GameSettingsScreen.tsx` (line 36) and `UniformSelectionScreen` — the new `LEAVE_ROOM` emit (D-03) should follow the same single-fire guard convention if a rapid double-click risk exists.

### Integration Points

- `packages/client/src/App.tsx` — new `LEAVE_ROOM` emit site and a new `onRoomLeft`/equivalent handler to reset client state back to `LANDING` (D-01/D-03).
- `packages/server/src/roomHandlers.ts` — new `LEAVE_ROOM` socket handler, mirroring the structure of existing handlers like `ROOM_SETTINGS_CONFIRM`.
- `packages/shared/src/draftEngine.ts`'s `generateDraftPacks` — the single integration point for D-06/D-08/D-09/D-10/D-11; all downstream callers (`draftPacks.ts`, `draftSession.ts`) are unaffected by the internal algorithm change since the function signature stays the same.

</code_context>

<specifics>
## Specific Ideas

- "Confirm" was not revisited here — D-08's tier-cascade decision was explicit: "cascade all the way to common. only pull common from cross-pool. dont pull in higher tier players" (user's exact words), meaning fallback logic must never substitute a higher-value card than a slot's stated tier.
- The Back button is explicitly scoped to the Game Settings (speed/draft) screen only — user was explicit this should NOT extend to Uniform Selection or Lineup/Formation screens, even though those screens have similar mid-flow structure.
- Match-wide player uniqueness (D-06) is a deliberate reversal of a documented prior-phase decision (Phase 30 D-18) — flagged explicitly during discussion, user confirmed intent to reverse it despite the supply-exhaustion tradeoffs surfaced.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope. (The two folded todos were already scoped to this phase; no new out-of-scope ideas came up during this session.)

### Reviewed Todos (not folded)

- **`2026-07-02-bug-kickoff-setup-persistent-light-shading-on-shot-path-hexes.md`** (BUG-23) — matched Phase 36 by generic keyword overlap only (score 0.6), same as it matched Phase 31/35 previously. Not raised or discussed this session; remains a highlight-rendering defect unrelated to this phase's scope.
- **`csv-consolidation-player-pool.md`** — matched by generic keyword overlap only (score 0.6). Not raised or discussed this session; a data-pipeline idea unrelated to this phase's bug-fix scope.

</deferred>

---

_Phase: 36-Bug Fixes_
_Context gathered: 2026-07-27_
