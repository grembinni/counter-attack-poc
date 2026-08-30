---
phase: 45-game-summary-popup
reviewed: 2026-08-28T00:00:00Z
depth: standard
files_reviewed: 26
files_reviewed_list:
  - packages/client/src/components/ActionPanel.test.tsx
  - packages/client/src/components/ActionPanel.tsx
  - packages/client/src/components/FreeKickSetupPanel.test.tsx
  - packages/client/src/components/FreeKickSetupPanel.tsx
  - packages/client/src/components/GameBoard.matchSummary.test.tsx
  - packages/client/src/components/GameBoard.module.css
  - packages/client/src/components/GameBoard.tsx
  - packages/client/src/components/MatchScoreRow.module.css
  - packages/client/src/components/MatchScoreRow.tsx
  - packages/client/src/components/MatchSummaryContent.module.css
  - packages/client/src/components/MatchSummaryContent.test.tsx
  - packages/client/src/components/MatchSummaryContent.tsx
  - packages/client/src/components/MatchSummaryModal.module.css
  - packages/client/src/components/MatchSummaryModal.tsx
  - packages/server/src/__tests__/gameEngine.matchStats.test.ts
  - packages/server/src/__tests__/matchStats.integration.test.ts
  - packages/server/src/__tests__/matchStatsReducer.test.ts
  - packages/server/src/__tests__/refereeLeniency.integration.test.ts
  - packages/server/src/__tests__/roomStore.test.ts
  - packages/server/src/gameEngine.ts
  - packages/server/src/gameHandlers.ts
  - packages/server/src/matchStatsReducer.ts
  - packages/server/src/roomStore.ts
  - packages/shared/src/index.ts
  - packages/shared/src/matchStats.test.ts
  - packages/shared/src/matchStats.ts
  - packages/shared/src/types.ts
findings:
  critical: 0
  warning: 2
  info: 1
  total: 3
status: issues_found
---

# Phase 45: Code Review Report

**Reviewed:** 2026-08-28
**Depth:** standard
**Files Reviewed:** 26
**Status:** issues_found

## Summary

Phase 45 (Game Summary Popup) adds whole-match statistics (`MatchStats`, `computeShotXg`,
`recordShotInStats`, `foldMatchStats`) plus the client-side popup/embedded-summary UI
(`MatchSummaryContent`, `MatchSummaryModal`, `MatchScoreRow`) and two small unrelated
checkpoint fixes to `ActionPanel.tsx`/`FreeKickSetupPanel.tsx`.

I traced the full data path end-to-end: `computeShotXg`'s formula and clamping, the seven
independent shot/xG capture call sites (`applyRoll`'s `SHOT` case, `applyPenaltyKickDuel`,
and five handler-level sites in `gameHandlers.ts`), `foldMatchStats`'s per-event-type
switch, `roomStore.ts`'s `broadcastState` fold-and-baseline bookkeeping (including the
undo-shrink/TACKLE_STEAL_PROMPT edge cases), `buildReplayFrames`'s carry-forward of the
frozen final `matchStats` through every replay frame, and the client rendering
(`DivergingRow`/`PossessionRow`/settings recap). This is unusually well-documented and
unusually thoroughly tested code (every capture site has a named regression test, and the
reducer has a dedicated unit suite covering the D-07 decline-exclusion and Pitfall-5
pre-action-possession-attribution edge cases) — I did not find a data-integrity or
correctness defect in this logic after independently re-deriving the expected values for
several of the trickier branches (crowded six-yard-box GOAL branch, no-double-count
snapshot flow, half-time-boundary counter persistence).

What I did find: one maintainability risk (real, provable duplication across the seven
shot-capture call sites) and one accessibility inconsistency introduced by this phase's
own new code (a codebase convention — `aria-label` on icon-only buttons — that the phase's
own xG info-icon button follows correctly, but the phase's own scoreboard match-summary
icon button does not). A third, cosmetic rounding item is included as Info.

## Warnings

### WR-01: Seven near-identical shot/xG capture call sites, no shared helper

**File:** `packages/server/src/gameEngine.ts:5062-5073`, `packages/server/src/gameEngine.ts:8344-8354`, `packages/server/src/gameHandlers.ts:1357-1374`, `packages/server/src/gameHandlers.ts:1421-1435`, `packages/server/src/gameHandlers.ts:2476-2493`, `packages/server/src/gameHandlers.ts:2540-2552`, `packages/server/src/gameHandlers.ts:4101-4114`

**Issue:** The identical `computeShotXg(...)` → `recordShotInStats(state.matchStats, team, xg)`
pattern (plus, in five of the seven sites, an `undefined`-shooter ternary guard) is
hand-copied at seven separate call sites across two files, instead of being extracted into
one shared helper (e.g. `captureShotStats(state, shooter, team, defendingPieces)`). This is
exactly the kind of duplication the codebase's own comments elsewhere warn about (e.g.
`matchStatsReducer.ts`'s "the single most likely wrong edit a future maintainer could
make"): every one of the seven sites is *currently* correct (verified independently, and
each has a named `S1`-`S7` regression test in `gameEngine.matchStats.test.ts`), but any
future eighth shot-resolution site (a new restart type, a new deflection branch, etc.) has
no compiler or lint signal forcing it to remember the same two-line capture pattern — it
can silently omit the capture and under-count shots/xG for that new code path with no
failing test to catch it, since there is no single choke point all shot resolutions must
pass through.

**Fix:** Extract a shared helper, e.g.:
```ts
// matchStats.ts (shared) or a small server-only wrapper
export function captureShotStats(
  matchStats: MatchStats | undefined,
  shooter: PlayerPiece | undefined,
  team: 'home' | 'away',
  defendingPieces: readonly PlayerPiece[],
): MatchStats {
  if (!shooter) return matchStats ?? EMPTY_MATCH_STATS;
  return recordShotInStats(matchStats, team, computeShotXg(shooter.position, team, defendingPieces));
}
```
and replace all seven call sites with a single call, so a future shot-resolution site only
has to remember to call the one helper.

### WR-02: Match-summary scoreboard icon button omits `aria-label`, inconsistent with this phase's own xG info-icon button and with GameBoard.tsx's existing convention

**File:** `packages/client/src/components/GameBoard.tsx:433-440`
**Issue:** The new "(i) View match summary" button has only a `title` attribute:
```tsx
<button
  type="button"
  className={styles.matchSummaryIconButton}
  title="View match summary"
  onClick={() => setMatchSummaryOpen(true)}
>
  i
</button>
```
`title` is not reliably exposed to screen readers as an accessible name (support is
inconsistent across browsers/AT, and it is not read by default on focus in several common
combinations), so this button's accessible name effectively falls back to its visible text
content — the single letter "i" — announced with no context. This is a real regression in
consistency introduced by this same phase: `MatchSummaryContent.tsx`'s own xG info-icon
button, added in the same feature, correctly pairs `aria-label="About Expected Goals (xG)"`
with `title` (and `GameBoard.tsx` itself already has three other icon-only buttons using
`aria-label` — "Open log", "Close log", "Open substitutions"/"View roster" — so this is
also inconsistent with the file's own pre-existing pattern, not a new convention being
introduced).

**Fix:**
```tsx
<button
  type="button"
  className={styles.matchSummaryIconButton}
  title="View match summary"
  aria-label="View match summary"
  onClick={() => setMatchSummaryOpen(true)}
>
  i
</button>
```

## Info

### IN-01: `PossessionRow` rounds home%/away% independently before computing the remainder, which can make the three segments' displayed percentages disagree slightly with their rendered widths

**File:** `packages/client/src/components/MatchSummaryContent.tsx:156-159`
**Issue:**
```ts
const homePct = actionCount === 0 ? 0 : Math.round((homeActionCount / actionCount) * 100);
const awayPct = actionCount === 0 ? 0 : Math.round((awayActionCount / actionCount) * 100);
const remainderPct = Math.max(0, 100 - homePct - awayPct);
```
`homePct` and `awayPct` are each independently rounded to the nearest integer, then the
neutral "remainder" segment is derived by subtracting both from 100 and flooring at 0.
Because rounding is applied per-side rather than once at the end (e.g. via a
largest-remainder allocation), `homePct + awayPct` can exceed 100 in edge cases (e.g.
`home=1, away=1, actionCount=3` → both round to 33%, sum 66%, fine; but other integer
combinations exist where two independently-rounded halves sum to 101). When that happens,
`remainderPct` floors at 0 while the two visible segments together occupy slightly more
than 100% of the (overflow-hidden) bar — the two displayed pill percentages therefore don't
always exactly reconcile with what's visually filled. This is a cosmetic, sub-1%
discrepancy, not a data-integrity issue (the underlying `matchStats` counters are exact).

**Fix:** Use a single rounding pass, e.g. round `homePct`, derive `awayPct = Math.round(...)`
only after confirming `homePct + rawAwayPct <= 100`, or use a largest-remainder-method
helper so the three segments always sum to exactly 100.

---

_Reviewed: 2026-08-28_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
