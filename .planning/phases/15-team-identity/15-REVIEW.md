---
phase: 15-team-identity
reviewed: 2026-06-13T14:19:41Z
depth: standard
files_reviewed: 13
files_reviewed_list:
  - packages/client/src/components/ActionLog.tsx
  - packages/client/src/components/GameBoard.test.tsx
  - packages/client/src/components/GameBoard.tsx
  - packages/client/src/components/PieceOverlay.test.tsx
  - packages/client/src/components/PieceOverlay.tsx
  - packages/client/src/components/PlayerStatsPanel.test.tsx
  - packages/client/src/components/PlayerStatsPanel.tsx
  - packages/client/src/components/TeamBadge.tsx
  - packages/client/src/teamDefaults.ts
  - packages/client/src/vite-env.d.ts
  - packages/shared/src/index.ts
  - packages/shared/src/teamConfig.test.ts
  - packages/shared/src/teamConfig.ts
findings:
  critical: 0
  warning: 5
  info: 4
  total: 9
status: issues_found
---

# Phase 15: Code Review Report

**Reviewed:** 2026-06-13T14:19:41Z
**Depth:** standard
**Files Reviewed:** 13
**Status:** issues_found

## Summary

Phase 15 introduces team identity: `TeamConfig`/`TeamId` types and `TEAM_CONFIGS` record in shared, `TeamBadge` component (PNG badge via Vite static import), `TEAM_DEFAULTS` positional map, jersey patterns in `PieceOverlay`, and `MiniTokenBadge` in `PlayerStatsPanel`. `GameBoard` absorbs the scoreboard with team badges and a player card. `ActionLog` derives team colors from `TEAM_CONFIGS` instead of hardcoded literals.

The core data model (`teamConfig.ts`) is clean and well-tested. `TeamBadge` and `TEAM_DEFAULTS` are minimal and correct. The main defects are concentrated in `ActionLog.tsx` (raw piece-ID surfaced to users, a non-null assertion against a nullable field, and a null-state crash path in uncontested headers) and `GameBoard.tsx` (connection indicator always shows "Connected"). `MiniTokenBadge` renders the wrong visual pattern for xolos/city/crew teams (functional but misleading).

## Warnings

### WR-01: `SHOT_ATTEMPT` — non-null assertion on `gkScore` is unsound when `shooterScore` is non-null

**File:** `packages/client/src/components/ActionLog.tsx:287,294`
**Issue:** The contested-shot branches at lines 287 and 294 compute `gkRawStat` using `event.gkScore!`. The `SHOT_ATTEMPT` type declares `gkScore: number | null`; the only guard is `event.shooterScore === null` (line 281) and `event.handlingDie !== null` (line 284), neither of which proves `gkScore` is non-null. If the server emits a `SHOT_ATTEMPT` where `shooterScore` is a number but `gkScore` is still `null` (e.g., an edge case in the no-duel path where `shooterScore` was accidentally populated), the subtraction `event.gkScore! - event.gkDie - event.gkPenaltyTotal` produces `NaN` and the rendered log entry will display `NaN` characters to the user.
**Fix:** Add an explicit null guard before reaching those branches:

```typescript
// Replace the else-if and else branches with:
} else if (event.gkScore === null) {
  // Defensive: gkScore unexpectedly null in a duel path — show partial info
  shotContent = ` ${event.outcome} — shooter: (${event.shooterDie}+...)`;
} else if (event.handlingDie !== null) {
  const gkRawStat = event.gkScore - event.gkDie - event.gkPenaltyTotal;
  // ... rest unchanged
} else {
  const gkRawStat = event.gkScore - event.gkDie - event.gkPenaltyTotal;
  // ... rest unchanged
}
```

### WR-02: `HEADER` uncontested path — `<P>` component called with empty-string `pieceId` when both `attackerId` and `defenderId` are null

**File:** `packages/client/src/components/ActionLog.tsx:339,348`
**Issue:** At line 339, `contestantId` is derived as `event.attackerId ?? event.defenderId ?? ''`. When both IDs are null (a scenario the type allows — both are `string | null`), `contestantId` is `''`. Line 348 then calls `<P pieceId={contestantId} prefix={rolePrefix} />`. Inside `P`, `pieceColorOf("")` runs `"".startsWith('home')` → `false` → resolves the 'away' color, then `pieceNum("")` computes `Number("") + 1 = 1` and renders "D1". The rendered log entry shows a spurious "D1" piece reference in an "uncontested" header where no player participated, silently misleading the user.
**Fix:** Guard the render when both IDs are null:

```typescript
const contestantId = event.attackerId ?? event.defenderId ?? null;
const prefixColor = contestantId ? pieceColorOf(contestantId) : null;
const rolePrefix: 'A' | 'D' = event.attackerId !== null ? 'A' : 'D';
return {
  prefix,
  prefixColor,
  content: (
    <>
      {' '}
      {winLabel} —{' '}
      {contestantId
        ? <><P pieceId={contestantId} prefix={rolePrefix} /> (uncontested)</>
        : '(no contestants)'}
    </>
  ),
  isGoal: false,
};
```

### WR-03: `HEADER` contested path — non-null assertions on `attackerId!`/`defenderId!` are unsound

**File:** `packages/client/src/components/ActionLog.tsx:382,383`
**Issue:** In the contested branch (reached when `attackerDie !== null && defenderDie !== null`), lines 382–383 use `event.attackerId!` and `event.defenderId!`. However, `attackerId` and `defenderId` are typed `string | null`; the dice being non-null is not a TypeScript or runtime guarantee that the IDs are also non-null. If the server emits a contested header with dice rolls but a null ID (a bug that the type system permits), `pieceColorOf(null!)` crashes with a `TypeError: Cannot read properties of null`.
**Fix:** Either guard the IDs or add a runtime check before this branch:

```typescript
if (!event.attackerId || !event.defenderId) {
  // Defensive fallback — should not happen in a contested header
  return {
    prefix,
    prefixColor: null,
    content: ` ${winLabel} (contested — ID missing)`,
    isGoal: false,
  };
}
// ... then use event.attackerId and event.defenderId without !
```

### WR-04: `MiniTokenBadge` — all outfield teams render identical stripe pattern regardless of team identity

**File:** `packages/client/src/components/PlayerStatsPanel.tsx:51-65`
**Issue:** The single pattern block at lines 51–65 renders a horizontal white stripe over the primary color for every outfield team. The pattern ID is correctly keyed per team (`mini-cosmos-jersey-*`, `mini-xolos-jersey-*`, etc.), but the content is always the cosmos-style stripe (a wide horizontal bar). For xolos (checker), city (vertical gold stripe), and crew (diagonal stripe), the mini-token in the stats panel shows the wrong jersey visual. The comment on line 62 makes this explicit: `{/* Horizontal white stripe across centre — matches scaled cosmos jersey */}`. The tests only assert on `id` and `fill="url(#...)"`, so this incorrectness is untested.
**Fix:** Extend the pattern block with team-specific sub-patterns, mirroring `PieceOverlay.tsx`:

```tsx
{!isGK && (
  <defs>
    {teamId === 'cosmos' && (
      <pattern id={jerseyPatId} x={...} y={...} width={18} height={18} patternUnits="userSpaceOnUse">
        <rect width={18} height={18} fill="#1e3a8a" />
        <rect x={0} y={6} width={18} height={6} fill="#ffffff" fillOpacity={0.4} />
      </pattern>
    )}
    {teamId === 'xolos' && (
      <pattern id={jerseyPatId} x={...} y={...} width={12} height={12} patternUnits="userSpaceOnUse">
        <rect width={12} height={12} fill="#ea580c" />
        <rect x={0} y={0} width={6} height={6} fill="#6b7280" fillOpacity={0.7} />
        <rect x={6} y={6} width={6} height={6} fill="#6b7280" fillOpacity={0.7} />
      </pattern>
    )}
    {/* ... city, crew similarly */}
  </defs>
)}
```

### WR-05: Connection indicator dot always shows green — never reflects actual socket state

**File:** `packages/client/src/components/GameBoard.tsx:220-229`
**Issue:** The green dot rendered in the scoreboard centre cell (lines 220–229) has a hardcoded `background: '#27ae60'` and `title="Connected"`. It never reads `disconnectWarning` or any socket connection state. When the socket is disconnected (e.g., the `DisconnectBanner` is showing), the dot still shows green, giving contradictory signals to the user.
**Fix:** Read `disconnectWarning` from the store and change the dot color conditionally:

```tsx
const disconnectWarning = useGameStore((s) => s.disconnectWarning);
// ...
<div
  style={{
    width: 8,
    height: 8,
    borderRadius: '50%',
    background: disconnectWarning ? '#e74c3c' : '#27ae60',
    flexShrink: 0,
  }}
  title={disconnectWarning ? 'Disconnected' : 'Connected'}
/>;
```

## Info

### IN-01: `SNAPSHOT` event content renders raw piece ID instead of formatted player label

**File:** `packages/client/src/components/ActionLog.tsx:309`
**Issue:** `content: \` ${event.shooterId}\``outputs the raw piece ID (e.g.,`home-9`) to the action log. Every other shooter-type event in `ActionLog`uses`<P>`for a team-colored, number-formatted label. This inconsistency means snapshot events appear as`[SNAPSHOT] home-9`while shot events show`[SHOT] GOAL — (5+4=9) vs (3+6=9)`.
**Fix:**

```tsx
case 'SNAPSHOT':
  return {
    prefix: '[SNAPSHOT]',
    prefixColor: event.shooterId ? pieceColorOf(event.shooterId) : null,
    content: <> <P pieceId={event.shooterId} prefix="A" /></>,
    isGoal: false,
  };
```

### IN-02: `LONG_BALL` event log entry has no passer/team color — inconsistent with all other pass types

**File:** `packages/client/src/components/ActionLog.tsx:268-274`
**Issue:** The `LONG_BALL` event type has no `passerId` field in the shared type (`packages/shared/src/types.ts:140-146`), so `prefixColor: null` is structurally correct. However, unlike `STANDARD_PASS`, `FIRST_TIME_PASS`, and `HIGH_PASS` (which all have `passerId` and show team color), `LONG_BALL` entries render without any team-color indicator. If a `passerId` field is ever added to the `LONG_BALL` event type, `ActionLog.tsx` will also need updating.
**Fix:** No code change needed unless `LONG_BALL` type gains a `passerId`. Track as a cross-cutting concern when that type evolves.

### IN-03: `formatEvent` has a dead `GK_KICK_MOVE` case that can never be reached from the render path

**File:** `packages/client/src/components/ActionLog.tsx:442-456`
**Issue:** `consolidateEvents` intercepts all `GK_KICK_MOVE` events and emits them as `move_group` display items (with `continue` at line 122). The `ActionLog` render loop at lines 480–513 handles `move_group` items before falling through to `formatEvent`. Therefore, `formatEvent`'s `case 'GK_KICK_MOVE'` at line 442 is unreachable dead code. TypeScript requires exhaustiveness coverage of the union which explains its presence, but it is never executed at runtime.
**Fix:** No functional change needed. Consider adding a comment clarifying that `consolidateEvents` absorbs this type before `formatEvent` sees it, to prevent future confusion.

### IN-04: `list key={index}` used for action log entries — suppresses React reconciliation warnings but allows stale renders

**File:** `packages/client/src/components/ActionLog.tsx:484,503`
**Issue:** Both rendered item types use `key={index}` on the `recent` array (which is already reversed). If entries are inserted or removed from the middle of the log, React will reuse DOM nodes by position rather than identity. For a log displayed to users (not animated), this is low risk, but it can cause stale content to flash briefly during rapid state updates. Using a content-derived key (e.g., event timestamp or `groupKey`) would be more stable.
**Fix:**

```tsx
// For move_group:
key={item.groupKey}
// For event items:
key={`${item.event.type}-${item.event.timestamp}`}
```

---

_Reviewed: 2026-06-13T14:19:41Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
