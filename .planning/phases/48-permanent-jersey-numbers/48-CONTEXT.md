# Phase 48: Permanent Jersey Numbers - Context

**Gathered:** 2026-08-31
**Status:** Ready for planning

<domain>
## Phase Boundary

Make every player's jersey number permanent from squad-build/draft-complete time onward — no reset path, reposition, substitution, or redraw may ever change a player's number for the rest of the match. Covers both standard (non-draft) team selection and draft mode, both starting-XI and bench, and the kickoff-striker anchor lookup that currently depends on `number === 9`.

**Out of scope:** GK box-entry/final-third fixes (Phase 49), foul/injury/booking banner sequencing (Phase 50), the rules-fidelity audit (Phase 51).

</domain>

<decisions>
## Implementation Decisions

### Number Source
- **D-01:** Starting-XI ("position") players keep today's convention — number is derived from the formation slot the player occupies (GK=1, then 2–11 by `FORMATIONS[...].slots[i].jerseyNumber`) — **not** each player's own canonical `PoolPlayer.number`. This is an explicit rejection of the "player's own identity number" alternative that was on the table.
- **D-02:** Bench players get a random number in the existing `15–99` range (`BENCH_NUMBER_MIN`/`BENCH_NUMBER_MAX` in `draftSession.ts`, unchanged — user said "12–99" verbally but confirmed keeping the existing 15–99 constant when the discrepancy was flagged).
- **D-03:** Numbers must be unique per team — no two players on the same team (starters + bench combined) share a number. The existing `assignBenchNumbers` shuffle-without-replacement approach already satisfies this for bench-vs-bench; it must also not collide with the 1–11 starter range (it doesn't today, by range separation).
- **D-04:** This slot-derived-starters / random-bench scheme applies uniformly to **both** standard (non-draft) team mode and draft mode — not just draft mode. NUMBER-05's "draft-mode bench" framing is the minimum bar; the same rule extends to standard-mode bench too, since the user's answers were mode-agnostic.
- **D-05 (locking):** The number is computed once — at squad-build/draft-complete time / "locked after draft/before start of game" — and never recomputed afterward. **Never re-roll once assigned**: a player who already has a permanent number keeps it forever; only players who don't yet have one (e.g., newly added/rearranged) get a fresh draw. This directly satisfies NUMBER-01, NUMBER-02, NUMBER-04, and the "not re-rolled" half of NUMBER-05.
- **D-06:** Draft-mode starting-XI picks follow the **same rule as everyone else** (D-01, slot-derived), not their own random-once scheme — only draft-mode bench uses the random 15–99 draw (same as D-02/D-04).

### Kickoff-Striker Lookup (NUMBER-03)
- **D-07:** Replace `p.number === 9` with a **formation-slot-based** lookup — find the piece occupying the slot with `slotId === 'ST'` (`slotRole: 'FWD-central'`) in the confirmed formation, not the piece's own `PlayerPiece.role === 'ST'` identity field. This is deliberately positional: it will always find exactly one match per team regardless of who the manager assigned to that slot, sidestepping the 0-or-2+-matches edge case that an identity-role lookup could hit if `confirmedHomeOrder`/`confirmedAwayOrder` places a non-striker in the ST slot.

### Claude's Discretion
- Where exactly the one-time number computation/lock happens in the call graph (e.g., a new field/map, or restructuring `buildSquadPieces` so it stops recomputing `number` on every call) — as long as D-01 through D-06's observable behavior holds.
- Exact mechanism for "never re-roll once assigned" (e.g., checking an existing map before drawing, vs. only ever calling the assignment function once per player at the correct lifecycle point).
- How standard-mode `homeBench`/`awayBench` (currently "seeded verbatim, never generated" per `gameEngine.ts:417-419`) gets its initial numbers reconciled with D-02/D-04 — needs verification of current behavior during research (see Existing Code Insights below).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements and roadmap
- `.planning/REQUIREMENTS.md` — NUMBER-01 through NUMBER-05 (lines ~27-31), traceability table (lines ~99-103).
- `.planning/ROADMAP.md` §Phase 48 (lines 211-224) — Goal, Depends-on (Phase 47's `applyRosterReposition` exercised end-to-end by the new click-to-select UI), Success Criteria.

### Existing implementation (files this phase modifies)
- `packages/server/src/gameEngine.ts` — `buildSquadPieces` (lines ~277-333, where `number` is currently derived from slot index every call — this is the core of NUMBER-01's violation); `applyRosterContinuity` (lines 3982-3991) and its 4 call sites (unsaveable-shot GOAL ~5128-5131, shot-duel GOAL ~5225-5228, penalty-kick GOAL ~8399-8402, `applyHalfTimeStart` ~10334-10337); `applyRosterReposition` (lines 3830-3965, currently ties `number` to slot `id` on swap — see docstring ~3800-3813); kickoff-striker anchor (line ~325, `number === 9` check to replace per D-07); bench-entry `jerseyNumber` capture (~881-883).
- `packages/shared/src/formations.ts` — `FORMATIONS` registry; each slot has `slotId`, `slotRole`, `position`, `jerseyNumber` (lines 27-32 for the type, e.g. 46-56 for one formation's slots). `slotId === 'ST'` / `slotRole: 'FWD-central'` is the target of D-07's lookup.
- `packages/shared/src/teams.ts` — `PoolPlayer.number` (line 26, "Jersey number within source squad, 1–11 per squad, 0 for free agents") — the canonical identity-number field that D-01 explicitly decided NOT to use for starters.
- `packages/server/src/draftSession.ts` — `assignBenchNumbers` (lines 394-406, shuffle-without-replacement over `BENCH_NUMBER_MIN`(15)-`BENCH_NUMBER_MAX`(99)); called once from `packages/server/src/roomHandlers.ts:1154-1161` on transition into `draftComplete`. `DRAFT_REARRANGE` (`roomHandlers.ts:1182+`) never re-touches the bench-number maps — relevant to D-05's "never re-roll" requirement and needs verification that rearrange-after-complete doesn't orphan a player without a number.
- `packages/shared/src/types.ts` — `PlayerPiece.number` (line 38) and `PlayerPiece.role` (line 42, `'GK'|'DEF'|'MID'|'FWD'|'ST'` — this is the identity-role field D-07 explicitly decided NOT to use for the kickoff lookup).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `assignBenchNumbers` (`draftSession.ts:394-406`) — the shuffle-without-replacement pattern is the right shape for D-02/D-04's random-bench-number requirement; needs generalizing beyond draft-mode-only bench to also cover standard-mode bench (D-04).

### Established Patterns
- `applyRosterContinuity` already matches pieces by `id` (slot identity) and preserves everything except `position` from the live piece — this is close to what D-05 needs but currently preserves a *slot-derived* number, not a person-derived one; once numbers are truly locked at build time this function's existing "carry forward from currentPiece" behavior should keep working unchanged.
- `applyRosterReposition` deliberately ties `number` to slot `id` on swap today (documented as intentional in its own docstring) — this is the exact behavior that needs to change so number follows the person, not the slot, on reposition.

### Integration Points
- Kickoff-striker anchor (`gameEngine.ts:325`) runs inside `buildSquadPieces`, which is called at match start and at every `applyRosterContinuity` reset site — D-07's fix must work correctly at all of those call sites, not just initial kickoff.
- Bench-entry construction (`gameEngine.ts:881-883`, `BenchEntry.jerseyNumber: piece.number`) — captures a number at substitution time; once numbers are locked (D-05) this becomes a straightforward copy of an already-permanent value rather than a slot-derived snapshot.

### Open verification item for research phase
- How `homeBench`/`awayBench` get their initial `jerseyNumber` in **standard (non-draft)** mode is not yet traced — `gameEngine.ts:417-419` says these are "seeded verbatim, never generated," implying some upstream code (likely in `roomHandlers.ts` at match setup) already assigns bench numbers for standard mode. The phase researcher should trace this and confirm/reconcile with D-02/D-04 before planning.

</code_context>

<specifics>
## Specific Ideas

- User's own words on the number scheme: "slot derived, for position players random numbers (12-99) for players on the bench. locked after draft/before start of game. numbers are unique per team." (D-01–D-05). Note the "12-99" figure was verbal shorthand — the user confirmed keeping the actual existing constant (15-99) when this was flagged (D-02).
- "the position a player is drafted into will decide thier number" — confirms D-06 (draft-mode starters follow the same slot-derived rule as standard mode, not their own scheme).

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope. No todos matched this phase (`todo.match-phase 48` returned zero matches).

</deferred>

---

*Phase: 48-permanent-jersey-numbers*
*Context gathered: 2026-08-31*
