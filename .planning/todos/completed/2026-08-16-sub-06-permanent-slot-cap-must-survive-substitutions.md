---
created: 2026-08-16T00:54:58.663Z
title: SUB-06 permanent slot cap must survive substitutions
area: planning
resolves_phase: 40
files:
  - .planning/REQUIREMENTS.md:55
  - .planning/debug/resolved/red-card-bench-removal-scope.md
---

## Problem

During Phase 39 live two-browser testing (2026-08-15/16), the user asked for a red-carded
player to be removed from the pitch and requested that this vacated on-field slot be
_permanently_ unfillable — i.e. a team that has taken 1 red card should be capped at 10
on-field players for the rest of the match, even after fully using its substitution
allowance for other (injured/other) players.

Investigation (debug session `.planning/debug/resolved/red-card-bench-removal-scope.md`)
confirmed this maps exactly onto the already-locked requirement **SUB-06**: "A red-carded
(sent-off) player cannot be replaced by a substitute." It is genuinely Phase 40
(Substitutions) scope, not a Phase 39 gap — Phase 40 is "Not started" as of this session,
and no substitution/roster/bench data model exists yet in `GameState` to express a
permanently-unfillable slot.

The scoped Phase 39 half of the original bug report (visually/positionally removing a
red-carded piece from the pitch, plus closing 3 unrelated `redCarded` eligibility gaps in
goal-kick/corner-kick/free-move reposition windows) was fixed separately and does NOT need
revisiting here — only the permanent-cap-survives-subs behavior remains open.

## Solution

When discussing/planning Phase 40, make sure the substitution design explicitly covers this
interaction: SUB-06 isn't just "can't directly substitute the sent-off player" — it should
also prevent _any other_ substitution from indirectly backfilling that lost on-field slot,
so a team with 1 red card stays permanently at 10 on-field players (2 red cards -> 9, etc.)
regardless of how the 3-substitution allowance (SUB-04) is otherwise used. Confirm this
against the rulebook during Phase 40's discuss-phase step before implementing.
