---
status: complete
phase: quick-260621-hnd
plan: 01
subsystem: client-action-log
tags: [actionlog, ui-cleanup, d-a-role-letters]
dependency-graph:
  requires: []
  provides: [actionlog-no-role-letters, snapshot-name-resolution]
  affects: [packages/client/src/components/ActionLog.tsx]
tech-stack:
  added: []
  patterns: [PNamed-component-direct-render, jsx-fragment-leading-space-idiom]
key-files:
  created: []
  modified:
    - packages/client/src/components/ActionLog.tsx
    - packages/client/src/components/ActionLog.test.tsx
decisions:
  - Removed the now-fully-unused `event.shooterId ?` ternary for SNAPSHOT's prefixColor since shooterId is non-nullable string (types.ts confirmed); simplified to a direct pieceColorOf(event.shooterId) call to avoid a dead-fallback pattern
metrics:
  duration: ~12min
  completed: 2026-06-21
---

# Quick Task 260621-hnd: Remove Remaining D/A Role-Letter Prefixes Summary

Removed the last four `prefix="D"`/`prefix={rolePrefix}` role-letter props from ActionLog's
duel/header log lines and fixed the SNAPSHOT case, which was the only `formatEvent` branch
still leaking a raw piece-id string (`home-N`/`away-N`) into visible log text instead of
resolving a player name.

## What Was Built

**Task 1 — `packages/client/src/components/ActionLog.tsx`:**

- Removed `prefix="D"` from the DEFLECT_ATTEMPT case's `<PNamed pieceId={event.defenderId} />`.
- Removed `prefix="D"` from both STEAL_ATTEMPT branches (auto-intercept and regular roll) —
  `<PNamed pieceId={event.defenderId} />` in each.
- Removed `prefix={rolePrefix}` from the uncontested HEADER branch's `<PNamed pieceId={contestantId} />`
  and deleted the now-dead `const rolePrefix: 'A' | 'D' = ...` declaration (confirmed no other
  consumer in the branch before deleting, per plan instruction — avoided the eslint
  no-unused-vars failure this repo's quick tasks have hit before).
- Fixed SNAPSHOT: replaced the raw template string `` ` ${event.shooterId}` `` (rendered literal
  `home-9`/`away-0` text) with the JSX-fragment-with-leading-space idiom used by every sibling
  case: `<>{' '}<PNamed pieceId={event.shooterId} /></>`. Since `shooterId` is confirmed
  non-nullable `string` in `types.ts`, no fallback ternary was added — `prefixColor` was
  simplified from `event.shooterId ? pieceColorOf(event.shooterId) : null` to a direct
  `pieceColorOf(event.shooterId)` call for the same reason.

**Task 2 — `packages/client/src/components/ActionLog.test.tsx`:**

- Fixed the stale STEAL_ATTEMPT test: updated the regex from `/D #\d+\s+\S+/` to `/#\d+\s+\S+/`
  and replaced the now-incorrect "keeps its D role prefix" comment with a note that the D
  prefix was dropped in this quick task.
- Added a new `describe` block ("ActionLog — quick-task 260621-hnd: remaining D/A removal +
  SNAPSHOT name resolution") with three new tests:
  - Uncontested HEADER: asserts the contestant renders as `#<num> <name>` with no leading
    role letter (`not.toMatch(/\b[AD] #\d/)`).
  - DEFLECT_ATTEMPT (previously no coverage): asserts the defender name renders with no
    leading role letter, and the `[DEFLECT` prefix is present.
  - SNAPSHOT (previously no coverage): asserts the resolved player name (`Nicolae Rusu`)
    renders and the raw `home-9` id string does not appear in visible text.

No `packages/shared` edits were made (confirmed during planning — `shooterId` already
non-nullable `string`), so no shared-package rebuild was required for the code changes
themselves. A one-time `pnpm install` + `pnpm --filter @counter-attack/shared build` was run
at the start of this session because `node_modules` and `packages/shared/dist` were missing
in this fresh worktree — expected one-time setup, not a deviation.

## Deviations from Plan

None — plan executed exactly as written. The only adjustment was a minor simplification of
the SNAPSHOT `prefixColor` ternary to a direct call (since the value is non-nullable), which
is the same "no dead fallback" principle the plan explicitly called out for the `content`
field — applied consistently to the adjacent `prefixColor` line for symmetry.

## Verification

- `pnpm -r typecheck` — passes (shared/server/client all clean).
- `pnpm --filter @counter-attack/client test -- ActionLog` — 23/23 tests pass (20 pre-existing
  - 3 new; 1 corrected).
- Grep confirms zero `prefix="D"` / `prefix={rolePrefix}` remain in ActionLog.tsx.
- Grep confirms all explicitly out-of-scope items are untouched: `[GK_KICK_O]` prefix, the `P`
  component's `prefix="GK"`/`prefix={team}`/`prefix={ftpTeam}` role-letter props (GK_KICK,
  GK_KICK_MOVE, HP_MOVE, FTP_MOVE), TACKLE_ATTEMPT, contested HEADER, and GOAL cases.

## Self-Check

- `packages/client/src/components/ActionLog.tsx` — FOUND (modified)
- `packages/client/src/components/ActionLog.test.tsx` — FOUND (modified)
- Commit `21aa524` (Task 1) — FOUND in git log
- Commit `74af1f3` (Task 2) — FOUND in git log

## Self-Check: PASSED
