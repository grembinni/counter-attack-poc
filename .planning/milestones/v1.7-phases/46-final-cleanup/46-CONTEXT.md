# Phase 46: Final Cleanup - Context

**Gathered:** 2026-08-28
**Status:** Ready for planning

<domain>
## Phase Boundary

A milestone-closing audit-and-cleanup pass across the whole v1.7 UI Consistency, Substitution Rework & Match Summary milestone. Covers: a gameplay consistency audit (functional gaps, dead-ball hex highlighting, movement-hex color/interaction consistency), phase help-text completeness and response-trigger language clarity, kicker/thrower selection alignment across every restart type, pitch/roster/bench card layout alignment, collapsing redundant single-action multi-step flows, and dead-code removal. Requirements: CLEANUP-05 through CLEANUP-13 (all currently `[ ]` unchecked in REQUIREMENTS.md — this phase is what satisfies them).

</domain>

<decisions>
## Implementation Decisions

### Audit scope and depth
- **D-01:** No specific named examples of redundant single-action flows or movement-hex color inconsistencies were provided by the user — the research/planning step must scan the codebase itself to find them (grep for the 5 restart setup panels, movement-pattern branches, and multi-step phase UIs) rather than relying on a user-supplied list.
- **D-02:** New specific under CLEANUP-06/09: valid-move hex tint color should be visually consistent across different movement pattern types (not just the dead-ball-hex highlighting already named in CLEANUP-06) — same "single source of truth" spirit as the existing `HIGHLIGHT_STYLES`/`RING_STYLES` table in `HexCell.tsx` (built in Phase 33, documented in `docs/HIGHLIGHT-REFERENCE.md`).
- **D-03:** Consolidation depth (CLEANUP-09/10) is left to planner/executor judgment — no user mandate for a deep structural refactor (e.g., extending the v1.6 `RESTART_STAGES`-style shared module across all 5 restart panels) vs. surface-level interaction fixes. Default to fixing genuine duplication without speculative refactor, per project convention.
- **D-04:** Card/pitch/roster/bench layout alignment (CLEANUP-11) scope is unchanged from the roadmap wording — icon position itself is already unified (Phase 41's `CardInjuryBadge`); this phase covers whatever else the audit finds misaligned (sizing, spacing, borders, shown info) across `LineupAssignmentScreen.tsx`, `BenchCarousel.tsx`, and pitch piece rendering.

### Folded Todos
- **"No auto-reselect after interrupt prompt"** (`.planning/todos/pending/2026-08-23-ux-no-auto-reselect-after-interrupt-prompt-resumes.md`) — after a `TACKLE_STEAL_PROMPT`/`GK_DIVE_AT_FEET_PROMPT`/`GK_BOX_ENTRY_PROMPT`/`FOUL_CHOICE` interrupt resumes to `MOVE`, the piece isn't auto-reselected with its movement ring even with moves remaining. Root cause already identified (`setGameState`'s `phaseChanged` clear in `useGameStore.ts` has no resume-detection exception) and a fix approach is already sketched in the todo. Folded as-is — low implementation risk, directly a "gameplay consistency" gap (CLEANUP-05).
- **"PK kicker-selection pattern diverges from FK"** (`.planning/todos/pending/2026-08-28-debt-pk-kicker-selection-pattern-diverges-from-fk.md`) — Penalty Kick and Free Kick setup use different sequences for choosing kicker vs. kick location; should follow one common pattern (select kicker, then select kick/ball location). This is the todo's own author noting it as a specific instance of CLEANUP-10 (kicker/thrower selection alignment) — folded directly into that requirement's scope, no separate implementation needed beyond ensuring PK is covered.
- **"Move Speed setting into Advanced Settings drawer"** (`.planning/todos/pending/2026-08-28-debt-move-speed-setting-to-advanced-settings.md`) — the game-speed control in `GameSettingsScreen.tsx` currently lives outside the Phase 44 Advanced Settings drawer; move it in alongside the other toggles, following that drawer's existing disclosure pattern. Fits CLEANUP-05 (consistency audit) / general milestone-closing polish.

### New in-scope item — hardcoded placeholder bench (explicit scope-guardrail override)
- **D-05:** User explicitly acknowledged this is new capability, not a bug fix, and explicitly asked for it to be included in Phase 46 anyway as a **simple patch** — this is a deliberate, informed scope addition, not an oversight.
- **D-06:** Today, every non-Draft-mode squad in `PLAYER_POOL` (`packages/shared/src/teams.ts`) holds exactly 11 players. `roomHandlers.ts` (~lines 979-993) documents this as deliberate: `confirmedHomeBench`/`confirmedAwayBench` come out empty for standard rooms, and the empty case is intentionally NOT special-cased ("no substitute is generated... until a future phase expands rosters" — comment references decision D-12). Phase 46 is that future phase, but only via the minimal patch below — NOT full per-team roster authoring.
- **D-07:** Build **two generic hardcoded bench rosters** — one "home bench," one "away bench" — NOT per-team-authored data for each of the 4 original teams (Cozmos, Xolos, City, Crew) or all 12 teams. Each bench has exactly 5 placeholder players, one per existing `role` value: `GK`, `DEF`, `MID`, `FWD`, `ST` (matches `PlayerPiece.role` type exactly, `packages/shared/src/types.ts:42`).
- **D-08:** These two generic benches are injected for standard (non-Draft) mode only, after players have chosen teams — i.e., at the same point `confirmedHomeBench`/`confirmedAwayBench` are currently built in `roomHandlers.ts` (~line 979 `else` branch), replacing the always-empty array with the hardcoded 5-player list.
- **D-09:** This is explicitly a placeholder/simple patch. The user will expand real per-team roster depth (so every pre-built team has its own authored bench) in a later milestone — do not over-build this into a data-driven or per-team system now.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope source
- `.planning/ROADMAP.md` (Phase 46 section, "Final Cleanup") — goal, success criteria, requirement IDs
- `.planning/REQUIREMENTS.md` (`### Final Cleanup` section, CLEANUP-05..13) — the locked requirement list this phase satisfies

### Folded todos (full problem/root-cause detail — read before planning the corresponding fix)
- `.planning/todos/pending/2026-08-23-ux-no-auto-reselect-after-interrupt-prompt-resumes.md` — auto-reselect fix, root cause and suggested approach already documented
- `.planning/todos/pending/2026-08-28-debt-pk-kicker-selection-pattern-diverges-from-fk.md` — PK/FK pattern alignment, cross-references CLEANUP-10 directly
- `.planning/todos/pending/2026-08-28-debt-move-speed-setting-to-advanced-settings.md` — speed control relocation into Phase 44's Advanced drawer

### Reviewed-but-deferred todos (do NOT fold into this phase — see Deferred below)
- `.planning/todos/pending/2026-07-02-bug-kickoff-setup-persistent-light-shading-on-shot-path-hexes.md`
- `.planning/todos/pending/2026-08-09-bug-offside-ring-after-goal.md`

### Bench-patch implementation area
- `packages/server/src/roomHandlers.ts` (~lines 960-993) — where `confirmedHomeBench`/`confirmedAwayBench` are currently built empty for standard rooms; the D-12 "expected behavior, not a gap" comment being explicitly superseded by D-05..D-09 above
- `packages/shared/src/teams.ts` — `PLAYER_POOL` (currently 11 players per squad), `getSquadPlayers`
- `packages/shared/src/types.ts:42` — `PlayerPiece.role: 'GK' | 'DEF' | 'MID' | 'FWD' | 'ST'` (the 5 roles the 2 hardcoded benches must cover)
- `packages/shared/src/types.ts` — `BenchEntry` shape (`playerId`, `jerseyNumber`, `status`)

### Prior-milestone standardization patterns to reuse, not duplicate
- `docs/HIGHLIGHT-REFERENCE.md` + `HIGHLIGHT_STYLES`/`RING_STYLES` in `HexCell.tsx` (Phase 33) — single source of truth for hex tint/ring colors; movement-hex color consistency (D-02) should extend this table, not create a parallel one
- `packages/client/src/components/CardInjuryBadge.tsx` (Phase 41) — the shared card/injury component already unifying pitch/player-stats/roster/bench icon display; CLEANUP-11's remaining layout-alignment work builds on top of this, doesn't replace it

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `HIGHLIGHT_STYLES`/`RING_STYLES` (`HexCell.tsx`) — extend for movement-hex color consistency (D-02) rather than introducing new color logic
- `CardInjuryBadge.tsx` — already-shared card/injury display component; card layout alignment (CLEANUP-11) is additive polish on top of this, not a redo
- Five restart setup panel components exist as separate files: `FreeKickSetupPanel.tsx`, `PenaltyKickSetupPanel.tsx`, `CornerKickSetupPanel.tsx`, `GoalKickSetupPanel.tsx`, `ThrowInSetupPanel.tsx`, plus `KickOffSetupPanel.tsx` — the audit for CLEANUP-10 (kicker/thrower alignment) needs to compare interaction sequences across all of these, not just PK vs FK

### Established Patterns
- v1.6 `RESTART_STAGES`-style staged-repositioning module (mentioned in ROADMAP decisions) is the existing precedent for "generalize instead of copy-paste" when restart flows share structure — relevant if CLEANUP-09/10 consolidation goes beyond surface-level fixes
- `subsUsed`-style never-reset-at-half-time field pattern is the project's established idiom for persistent match-long counters — relevant if the bench patch needs any lifecycle-persistence consideration (unlikely, since bench composition is fixed at match start, not counted)

### Integration Points
- Bench injection point: `roomHandlers.ts` standard-room branch (~line 979), same place `confirmedHomeBench`/`confirmedAwayBench` are currently built empty
- `useGameStore.ts`'s `setGameState` `phaseChanged` clearing logic is the integration point for the folded auto-reselect todo

</code_context>

<specifics>
## Specific Ideas

- The two hardcoded placeholder benches must contain exactly one player per role: GK, DEF, MID, FWD, ST — matching the user's own listed breakdown, which happens to match the existing `PlayerPiece.role` enum exactly.
- "Roughly equal home and away" bench — same size (5) and same role composition on both sides; no asymmetry requested.
- This is explicitly the smallest viable patch; full per-team roster/bench authoring is a deliberately separate, later-milestone concern (do not scope-expand into it now).

</specifics>

<deferred>
## Deferred Ideas

### Reviewed Todos (not folded)
- **"BUG-23: KICK_OFF_SETUP stale shot-path shading"** (`.planning/todos/pending/2026-07-02-bug-kickoff-setup-persistent-light-shading-on-shot-path-hexes.md`) — persistent light shading on hexes matching a prior shot path during `KICK_OFF_SETUP`. Deep static analysis already ruled out every traced code path across 4 prior milestone closes without finding the root cause; would need live console-log instrumentation to diagnose. User declined to fold this in — open-ended investigation risk not appropriate for a cleanup phase. Remains pending for a future phase.
- **"Offside rings persist after goal reset"** (`.planning/todos/pending/2026-08-09-bug-offside-ring-after-goal.md`) — offside rings still render after a goal resets positions for kickoff, despite server-side code provably clearing `offsidePieceIds` on every live scoring path. Same "server clears it, client still renders it" signature as BUG-23 above — flagged as a possible shared root cause but unconfirmed. User declined to fold this in for the same reason (open-ended investigation risk). Remains pending for a future phase.

</deferred>

---

*Phase: 46-Final Cleanup*
*Context gathered: 2026-08-28*
