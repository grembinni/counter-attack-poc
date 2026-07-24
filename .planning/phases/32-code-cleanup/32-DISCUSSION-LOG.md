# Phase 32: Code Cleanup - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-24
**Phase:** 32-Code Cleanup
**Areas discussed:** Dead-code detection tool, Shared helper consolidation scope, Zustand selector review deliverable, React Hook lint rollout

---

## Dead-code detection tool

| Option     | Description                                                                 | Selected |
| ---------- | --------------------------------------------------------------------------- | -------- |
| knip       | Modern, pnpm-workspace-aware, catches unused exports/files/deps in one pass | ✓        |
| ts-prune   | Older, narrower — only unused TS exports, no monorepo awareness             |          |
| You decide | Claude picks during research/planning                                       |          |

**User's choice:** knip

| Option                 | Description                             | Selected |
| ---------------------- | --------------------------------------- | -------- |
| One-time pass only     | Run once, fix, remove                   |          |
| Permanent CI/lint gate | Add as devDependency + script + CI step | ✓        |
| You decide             |                                         |          |

**User's choice:** Permanent CI/lint gate
**Notes:** Scouted `.github/workflows/ci.yml` — no lint or dead-code step exists today (install → shared build → typecheck → test → build). Lint is currently enforced only via `.husky/pre-commit` + `lint-staged` (per-file `eslint --fix`). knip does whole-project analysis, so it needs its own CI step rather than fitting the lint-staged pattern.

---

## Shared helper consolidation scope

| Option                  | Description                                                | Selected |
| ----------------------- | ---------------------------------------------------------- | -------- |
| New client hooks        | useTeamAccentColor/useMyTeam in packages/client/src/hooks/ | ✓        |
| Plain utility functions | Non-hook functions in a shared utils file                  |          |
| You decide              |                                                            |          |

**User's choice:** New client hooks

| Option               | Description                                             | Selected |
| -------------------- | ------------------------------------------------------- | -------- |
| All call sites       | Migrate all 3 palette.uiColor + all 8 myTeam call sites | ✓        |
| Worst offenders only | Migrate only the most duplicated/error-prone sites      |          |
| You decide           |                                                         |          |

**User's choice:** All call sites
**Notes:** Scout confirmed exact file lists: `palette.uiColor` in ActionLog.tsx, GameBoard.tsx, PieceOverlay.tsx; `myTeam` in HexGrid.tsx, HexGrid.test.tsx, ActionPanel.tsx, useGameStore.ts, GameBoard.tsx, FreeKickSetupPanel.tsx, useGameStore.rule11.test.ts, KickOffSetupPanel.tsx.

---

## Zustand selector review deliverable

| Option               | Description                           | Selected |
| -------------------- | ------------------------------------- | -------- |
| Standalone doc       | Markdown doc cataloging each selector | ✓        |
| Inline code comments | Annotate useGameStore.ts directly     |          |
| You decide           |                                       |          |

**User's choice:** Standalone doc

| Option                   | Description                                                 | Selected |
| ------------------------ | ----------------------------------------------------------- | -------- |
| Fix in this phase        | Fix stale deps/redundant recomputation found, then document | ✓        |
| Document only, fix later | Catalog issues, defer fixes                                 |          |
| You decide               |                                                             |          |

**User's choice:** Fix in this phase
**Notes:** useGameStore.ts is 952 lines; CLEANUP-03 success criteria reads as a fixed end-state, not just a findings list.

---

## React Hook lint rollout

| Option                   | Description                               | Selected |
| ------------------------ | ----------------------------------------- | -------- |
| Fix everything           | Enable rule at 'error', fix every finding | ✓        |
| Enable as warnings first | 'warn' level, fix as fast-follow          |          |
| You decide               |                                           |          |

**User's choice:** Fix everything
**Notes:** Confirmed via scout — no `eslint-plugin-react-hooks` anywhere today (root `eslint.config.js` or any `package.json`), zero existing eslint-disable suppressions for hook rules.

| Option                 | Description                                                                                 | Selected     |
| ---------------------- | ------------------------------------------------------------------------------------------- | ------------ |
| Scoped disable allowed | Targeted eslint-disable-next-line with explanatory comment OK for genuine intentional cases | ✓ (modified) |
| No suppressions at all | Every effect restructured, zero disables                                                    |              |
| You decide             |                                                                                             |              |

**User's choice (free text):** "scoped disable allowed but make review of justifications part of post phase UAT"
**Notes:** Suppressions are permitted, but each disable comment's justification must be specifically scrutinized during this phase's verification/UAT step, not accepted at face value during implementation.

---

## Claude's Discretion

- Exact `knip.json` config shape (workspace entry points, ignore patterns)
- Whether `useTeamAccentColor`/`useMyTeam` are one hook file or split across files

## Deferred Ideas

None raised outside phase scope. Todo cross-reference reviewed 3 pending todos, folded none:

- `2026-06-21-bug-gk-kick-ball-delivery-invisible-during-replay.md` — found stale/already resolved (REPLAY-07), recommend archiving
- `2026-07-02-bug-kickoff-setup-persistent-light-shading-on-shot-path-hexes.md` — already deferred to Phase 33/34 per 31-CONTEXT.md
- `csv-consolidation-player-pool.md` — unrelated data-pipeline idea, remains unassigned backlog
