# Phase 32: Code Cleanup - Context

**Gathered:** 2026-07-24
**Status:** Ready for planning

<domain>
## Phase Boundary

Dead code, duplicated color/team-slot lookups, and Zustand/hook inefficiencies are eliminated across the shared/server/client packages, verified by automated tooling (CLEANUP-01..04). This phase does NOT touch visual/color values themselves (that's Phase 33/34), and does NOT touch response-move activation logic (RESP-01..09, explicitly out of scope for all of v1.5).

Pending todos were cross-referenced against this phase's scope: none matched well. `2026-06-21-bug-gk-kick-ball-delivery-invisible-during-replay.md` is stale — REPLAY-07 (GK_KICK ballAfter + REPLAY_ELIGIBLE_TYPES) is already implemented and regression-tested in `gameEngine.ts`/`replay.integration.test.ts`; the pending file just was never archived. `2026-07-02-bug-kickoff-setup-persistent-light-shading-on-shot-path-hexes.md` was already reviewed and deferred to Phase 33/34 in 31-CONTEXT.md. `csv-consolidation-player-pool.md` is a data-pipeline idea, unrelated to code cleanup. No todos folded.

</domain>

<decisions>
## Implementation Decisions

### CLEANUP-01 — Dead-code detection tool

- **D-01:** Use **knip**, not ts-prune — modern, actively maintained, pnpm-workspace-aware (understands `packages/shared`/`server`/`client` as one project), catches unused exports/files/dependencies in one pass. Add as a permanent devDependency with a `knip.json`/`knip.ts` config at repo root, not a one-off audit script.
- **D-02:** Wire knip in as a **permanent gate**, not a one-time pass. Add a `pnpm knip` script and a step in `.github/workflows/ci.yml` (currently: install → shared build → typecheck → test → build, no lint/dead-code step at all today). Note: knip does whole-project analysis, so it does NOT fit the existing per-file `lint-staged` pre-commit pattern (`eslint --fix` on staged `*.{ts,tsx}`) — it needs its own CI step, separate from that hook.
- Confirmed already-dead via scout: `shootTargetHex` in `packages/client/src/store/useGameStore.ts` (declared line 69, only ever assigned `null` at lines 274/722/930, never read anywhere in the client) — this is the concrete example cited in ROADMAP.md's success criteria; knip must flag it and the fix removes it entirely.

### CLEANUP-02 — Shared helper consolidation

- **D-03:** New shared logic lives as **React hooks** in `packages/client/src/hooks/` (e.g. `useTeamAccentColor(teamId)`, `useMyTeam()`) — idiomatic given these call sites already compose with Zustand selectors, not plain utility functions.
- **D-04:** Consolidate **all** duplicated call sites now, not just the worst offenders — matches CLEANUP-02's wording ("consolidated into one shared helper/hook used everywhere they were previously inlined"). Confirmed duplication via scout:
  - `TEAM_CONFIGS[...].palette.uiColor` inlined in 3 files: `ActionLog.tsx`, `GameBoard.tsx`, `PieceOverlay.tsx`.
  - `myTeam`/team-slot resolution duplicated across 8 files: `HexGrid.tsx`, `HexGrid.test.tsx`, `ActionPanel.tsx`, `useGameStore.ts`, `GameBoard.tsx`, `FreeKickSetupPanel.tsx`, `useGameStore.rule11.test.ts`, `KickOffSetupPanel.tsx`.

### CLEANUP-03 — Zustand selector review

- **D-05:** Deliverable is a **standalone markdown doc** (e.g. `.planning/phases/32-code-cleanup/SELECTOR-REVIEW.md`) cataloging each selector in `useGameStore.ts` (952 lines), what it derives, and whether it's stale/redundant — not inline comments in the already-large store file.
- **D-06:** Any real problems the review finds (stale dependency arrays, redundant derived-state recomputation) must be **fixed in this phase**, not just logged for later — CLEANUP-03's success criteria ("confirmed by a documented selector review") reads as a fixed end-state, not a findings list.

### CLEANUP-04 — React Hook lint rollout

- **D-07:** No `eslint-plugin-react-hooks` exists anywhere today (confirmed: absent from root `eslint.config.js` and every `package.json`) and there are zero existing `eslint-disable` suppressions for hook rules to inherit. Enable the rule at **`error`** (not `warn`) scoped to the client package, and **fix every violation it surfaces** — matches CLEANUP-04's explicit "zero exhaustive-deps violations" bar.
- **D-08:** A genuine one-time-only effect with a deliberately incomplete dependency array MAY use a scoped `eslint-disable-next-line react-hooks/exhaustive-deps` with an explanatory comment — suppressions are not banned outright. However, **every suppression's justification must be specifically reviewed as part of this phase's post-implementation UAT/verification step** (not just accepted at face value during implementation) — the planner/verifier should treat "does each disable comment hold up under scrutiny" as an explicit checklist item, not an afterthought.

### Claude's Discretion

- Exact `knip.json` config shape (workspace entry points, ignore patterns) — pick based on what integrates cleanly with the existing pnpm workspace + `eslint.config.js allowDefaultProject` exclusions during planning.
- Whether `useTeamAccentColor`/`useMyTeam` are one hook file or split — judge by actual call-site shape once touching each of the 8 files.

</decisions>

<canonical_refs>

## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project/milestone context

- `.planning/PROJECT.md` — v1.5 milestone goal, current-state tech debt list
- `.planning/REQUIREMENTS.md` (lines 30-35) — CLEANUP-01..04 requirement definitions
- `.planning/ROADMAP.md` (lines 149-160) — Phase 32 goal, success criteria, dependency on Phase 31
- `.planning/phases/31-bug-fixes/31-CONTEXT.md` — prior-phase decisions; confirms `2026-07-02-bug-kickoff-setup-...` todo already deferred to Phase 33/34 (do not re-review)

### Existing tooling referenced during discussion

- `eslint.config.js` (repo root) — current flat config; no react-hooks plugin present; `allowDefaultProject` pattern to extend if knip/new configs need similar test-file exclusions
- `.github/workflows/ci.yml` — current CI pipeline (install → shared build → typecheck → test → build); no lint or dead-code step exists yet — CLEANUP-01's CI gate is a net-new step here
- `.husky/pre-commit` + root `package.json` `lint-staged` config — existing per-file eslint enforcement pattern; knip does NOT fit this model (whole-project analysis) and needs its own CI step instead

No other external specs/ADRs apply — requirements are fully captured in the Decisions section above.

</canonical_refs>

<code_context>

## Existing Code Insights

### Reusable Assets

- None directly reusable for the new hooks (`useTeamAccentColor`, `useMyTeam`) — these are genuinely new consolidation points, not replacements for existing helpers.

### Established Patterns

- Zustand per-slice selectors already used throughout `HexGrid.tsx` and friends (a prior-phase decision, see STATE.md "Decisions Locked" — "Zustand per-slice selectors in HexGrid (Pitfall 6) — prevents whole-component re-renders") — new hooks should follow this same selector-scoping discipline, not introduce whole-store subscriptions.
- `TEAM_CONFIGS[TEAM_DEFAULTS[...]]` is the established single color source of truth (Phase 15/18 decisions) — the new `useTeamAccentColor` hook wraps this existing lookup, it does not replace `TEAM_CONFIGS` itself.

### Integration Points

- `packages/client/src/store/useGameStore.ts` — `shootTargetHex` removal (CLEANUP-01) and the full selector review (CLEANUP-03) both center here.
- `packages/client/src/components/{ActionLog,GameBoard,PieceOverlay}.tsx` — `palette.uiColor` call sites to migrate to `useTeamAccentColor`.
- `packages/client/src/components/{HexGrid,ActionPanel,GameBoard,FreeKickSetupPanel,KickOffSetupPanel}.tsx` + `useGameStore.ts` — `myTeam` call sites to migrate to `useMyTeam`.
- `eslint.config.js`, `.github/workflows/ci.yml`, root `package.json` — where the new knip script/config and react-hooks plugin get wired in.

</code_context>

<specifics>
## Specific Ideas

No particular visual/UX references — this phase is pure code-quality/tooling work, not a design change. The one concrete example cited (`shootTargetHex`) is confirmed dead via direct code inspection during this discussion (see D-01).

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

### Reviewed Todos (not folded)

- **`2026-06-21-bug-gk-kick-ball-delivery-invisible-during-replay.md`** — reviewed during cross-reference check; found to be stale (already resolved as REPLAY-07 in a prior phase, confirmed via grep of `gameEngine.ts`/`replay.integration.test.ts`). Not folded — recommend the planner or a future quick task archive/delete this pending todo file since the underlying work is done.
- **`2026-07-02-bug-kickoff-setup-persistent-light-shading-on-shot-path-hexes.md`** — already reviewed and deferred to Phase 33/34 in 31-CONTEXT.md; re-confirmed as out of scope for Phase 32.
- **`csv-consolidation-player-pool.md`** — reviewed; a data-pipeline/CSV idea unrelated to code cleanup. Not folded; remains a low-priority backlog idea with no phase assignment.

</deferred>

---

_Phase: 32-Code Cleanup_
_Context gathered: 2026-07-24_
