# Phase 48: Permanent Jersey Numbers - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-31
**Phase:** 48-permanent-jersey-numbers
**Areas discussed:** Number Source, Kickoff-Striker Lookup, Draft Starters, Bench Number Range, Reroll Rule

---

## Number Source

| Option | Description | Selected |
|--------|-------------|----------|
| Slot-derived, then locked | Keep today's convention (GK=1, others 2-11 by starting-lineup slot order) but only compute it once at squad-build/draft-complete, never recomputed. | ✓ |
| Player's own identity number | Use each player's real `PoolPlayer.number` (canonical shirt number from teams.ts/CSV data) regardless of starting slot; free agents (number:0) need fallback assignment. | |

**User's choice:** Slot-derived, then locked.
**Notes:** "slot derived, for position players random numbers (12-99) for players on the bench. locked after draft/before start of game. numbers are unique per team." — established the full scheme (D-01 through D-05 in CONTEXT.md).

---

## Kickoff-Striker Lookup

| Option | Description | Selected |
|--------|-------------|----------|
| Player's identity role | Match `PlayerPiece.role === 'ST'` (player's own listed position from teams.ts). Needs a fallback if a manager starts a non-ST player in the ST slot. | |
| Formation slot's role | Match whichever piece occupies `slotId === 'ST'` / `slotRole: 'FWD-central'` in the confirmed formation — positional, always exactly one match. | ✓ |

**User's choice:** Formation slot's role.
**Notes:** None beyond the selection.

---

## Draft Starters

| Option | Description | Selected |
|--------|-------------|----------|
| Same rule as everyone else | Starting-XI draft picks follow the Number Source decision (slot-derived), one consistent rule for the whole roster. | ✓ |
| Random-once, like bench | Starting-XI draft picks get their own random-once assignment, separate scheme from standard-team matches. | |

**User's choice:** Same rule as everyone else.
**Notes:** "the position a player is drafted into will decide their number. random (12-99) if on the bench, random if a player already has their number." — the second clause was ambiguous and resolved in the follow-up Reroll Rule question below.

---

## Bench Number Range

| Option | Description | Selected |
|--------|-------------|----------|
| 12–99 (as stated) | Update `BENCH_NUMBER_MIN` from 15 to 12 to match what the user said verbally. | |
| Keep existing 15–99 | Leave the current constant alone. | ✓ |

**User's choice:** Keep existing 15–99.
**Notes:** User said "12-99" twice in free text but confirmed keeping the existing constant when the discrepancy with the actual code (`BENCH_NUMBER_MIN = 15`) was flagged directly.

---

## Reroll Rule

| Option | Description | Selected |
|--------|-------------|----------|
| Never re-roll once assigned | Once a player has a permanent number, it's locked forever — later draft/lineup changes never touch it; only new/unassigned players get a fresh draw. | ✓ |
| Re-roll on collision only | A bench player's random draw retries only if it collides with an already-taken number on the team; no broader re-roll semantics. | |

**User's choice:** Never re-roll once assigned.
**Notes:** Clarifies "random if a player already has their number" from the Draft Starters answer — resolved as idempotent assignment (matches NUMBER-05's "not re-rolled" wording).

---

## Claude's Discretion

- Exact call-graph location for the one-time number computation/lock (new field/map vs. restructuring `buildSquadPieces`).
- Exact mechanism for enforcing "never re-roll once assigned."
- How standard-mode `homeBench`/`awayBench` initial numbers are currently seeded — flagged as an open verification item for the research phase rather than decided here.

## Deferred Ideas

None — discussion stayed within phase scope.
