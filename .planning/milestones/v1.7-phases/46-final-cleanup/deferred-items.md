# Phase 46 — Deferred Items

Items found during Plan 46-06's dead-code sweep that are out of this plan's scope
per the Scope Boundary rule (pre-existing, not caused by Phase 46's changes) and
were logged rather than fixed.

## `packages/shared/src/teams.ts` header breakdown math (pre-existing, not Phase-46-caused)

**File:** `packages/shared/src/teams.ts` line 46
**Found during:** Plan 46-06, Task 1 dead-code sweep (residue class 4 — documentation
counts that drift from the code they describe)

The header comment reads:

```
198 total players: 4 legacy squads (44) + free agents (24) + MLS (44) + national (66).
```

The leading total (`198`) correctly matches `PLAYER_POOL.length` (verified: 198 `{`
player-object entries in the array) — this is the specific count the Plan 46-06
acceptance criterion checks, and it passes.

However, the parenthetical breakdown itself does not sum to the stated total:
`44 + 24 + 44 + 66 = 178`, not `198` (and not `188` or `178` either, at any point in
this file's history — `git log -p` shows the breakdown text has been byte-identical
since the file's very first non-stub commit, while only the leading number was bumped
178 → 188 → 198 across three separate phases as the pool grew). This is a genuinely
pre-existing drift that predates Phase 46 by multiple milestones — Phase 46's own
change (46-04, PLAYER_POOL 188 → 198) mechanically followed the exact same historical
pattern of bumping only the leading number, consistent with how the prior two
increments were done, and did not introduce any new drift beyond what already existed.

Per the Scope Boundary rule ("Only auto-fix issues DIRECTLY caused by the current
task's changes. Pre-existing warnings... are out of scope... Log out-of-scope
discoveries to `deferred-items.md`... Do NOT fix them."), this is logged here rather
than corrected in Plan 46-06. A future data-model touch to `teams.ts` (or a dedicated
doc-accuracy pass) should recompute the real category breakdown from the CSV source
data rather than re-guessing it.

**Disposition:** deferred, not fixed. Does not block Phase 46 close — the plan's own
acceptance criterion (leading total matches `PLAYER_POOL.length`) is satisfied.
