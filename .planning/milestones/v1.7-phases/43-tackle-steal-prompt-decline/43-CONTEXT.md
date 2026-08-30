# Phase 43: Tackle/Steal Prompt & Decline - Context

**Gathered:** 2026-08-23
**Status:** Ready for planning

<domain>
## Phase Boundary

A new game-creation toggle (default on) inserts a decline prompt before a tackle/steal attempt resolves. With the toggle on, the defending manager sees an Attempt/Decline choice for each eligible defender before dice are rolled; declining doesn't count as an attempt and keeps that defender's risk ring active so the same opportunity can be re-offered on a later move step within the same movement phase. With the toggle off, tackle/steal duels resolve immediately exactly as they do today. This phase does not touch the Referee Leniency/Advanced-drawer work (Phase 44) or match-summary stat tracking (Phase 45), though its decline mechanic changes what "an attempt" means for Phase 45's tackle/steal success-rate stat.

</domain>

<decisions>
## Implementation Decisions

### Multiple Eligible Defenders

- **D-01:** When a `STEAL_ATTEMPT`'s `defenders[]` array (`moveValidator.ts`) has 2+ eligible defenders in ZoI range on the same move step, the defending manager gets **sequential per-defender prompts**, not one combined prompt for the group — Attempt/Decline for defender A, then defender B, etc.
- **D-02:** The sequence is ordered **by tackling stat, highest first** — the defender most likely to succeed is prompted first.
- **D-03:** A **failed** attempt does NOT end the sequence — the next eligible defender in order still gets prompted. The sequence only ends when **possession changes** (a successful steal/tackle) or **a foul triggers a stoppage for a kick**. This means multiple duels (multiple dice rolls) can stack on a single move step as long as the ball carrier keeps possession and play isn't otherwise halted.
- Declining still applies per-defender: a decline on defender A doesn't skip defender B's prompt, and does not consume defender A's later eligibility (TACKLE-03).

### Declined-but-Live Ring Styling

- **D-04:** A declined-but-still-eligible risk ring shares the **same visual treatment** as a never-yet-offered risk ring (the existing amber `risk` ring per `docs/HIGHLIGHT-REFERENCE.md`) — no distinct visual state for "already declined once" in this phase. Research's suggested distinct-treatment nice-to-have is explicitly deferred, not adopted.

### Prompt Copy & Framing

- **D-05:** Button labels, prompt copy, and the waiting-manager message for the new `TackleStealPromptPanel` are Claude's/planner's discretion — match the existing `GkDiveAtFeetPromptPanel`/`FoulChoicePanel` two-button family's tone and structure exactly; no new copy pattern to invent.

### Claude's Discretion

- Exact `GameState` field shapes for the new prompt phase, sibling decline-exclusion fields (`stealDeclinedByIds`/`tackleDeclinedByIds` distinct from `stealAttemptedByIds`/`tackleAttemptedByIds`), and the resume-snapshot mechanics — per research's ARCHITECTURE.md recommendation, mirroring `GkDiveAtFeetPromptPanel`'s established `gkDiveAtFeetTeam`/`gkDiveAtFeetResume` pattern.
- The new `ActionEventType` for declines (e.g. `TACKLE_STEAL_PROMPT_DECLINED`) and its Undo/Replay registration (per Pitfall #9: very likely NOT an Undo boundary, mirroring `GK_DIVE_AT_FEET_DECLINED`'s omission).
- Whether declines are visibly logged in ActionLog to both managers — established precedent from `GK_DIVE_AT_FEET_DECLINED` (which IS logged, `ActionLog.tsx:1157-1160`) should be followed for consistency; not re-litigated in this discussion.
- The full reset-policy table across the ~30 existing `stealAttemptedByIds`/`tackleAttemptedByIds` reset call sites (Pitfall #8) — needs a site-by-site decision at planning time, not a vision call.

</decisions>

<canonical_refs>

## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & Roadmap

- `.planning/REQUIREMENTS.md` §"Tackle/Steal Prompt & Decline" — TACKLE-01 through TACKLE-04 (lines 46-49)
- `.planning/ROADMAP.md` §"Phase 43: Tackle/Steal Prompt & Decline" (lines 258-269) — goal, success criteria, sequencing note (independent of 41-42, sequenced before Phase 44's settings drawer)
- `.planning/STATE.md` — "Key Pitfalls to Avoid" (Pitfall notes on `isActivePiece`/red-card exclusion precedent) and "Open Questions" entry for Phase 43 (state-machine field shape deferred to planning)

### Research (v1.7 milestone-level, written 2026-08-21) — ground this phase's technical shape in detail

- `.planning/research/ARCHITECTURE.md` §"Feature 5 — Tackle/Steal Prompt-and-Decline Toggle" (lines 170-186) — confirmed current-state analysis (duels resolve atomically inside `GAME_MOVE`, no existing prompt concept), recommended new-`GamePhase` approach mirroring `GK_DIVE_AT_FEET_PROMPT`/`GkDiveAtFeetPromptPanel`, exact new `GameState` fields, new client event shape, and build-order note
- `.planning/research/PITFALLS.md` — Pitfall #7 (moveValidator ZoI opponent list missing red-card exclusion — confirmed live bug, must be fixed alongside or before this phase since it shares the same defender-list code path), Pitfall #8 (declined-state must NOT overload `stealAttemptedByIds`/`tackleAttemptedByIds` — needs a sibling field with its own ~30-site reset-policy table), Pitfall #9 (new decline `ActionEventType` needs explicit Undo/Replay/isBoundary registration decisions)
- `.planning/research/FEATURES.md` §"5. Tackle/Steal Decline-and-Retry Mechanic" (lines 102-112) — no direct soccer-game precedent; nearest analogue is turn-based tactics "reserved action"/overwatch pattern; recommends reusing the existing risk-ring vocabulary (see D-04); explicitly flags configurable decline thresholds as an anti-feature (binary toggle only)
- `.planning/research/SUMMARY.md` §"Phase 4: Tackle/Steal Prompt-and-Decline Toggle" (lines 101-106) — build-order rationale, delivery list, pitfalls avoided
- `docs/HIGHLIGHT-REFERENCE.md` (lines 24, 48, 56, 63-64) — the single source-of-truth ring/highlight vocabulary; the existing `risk` ring entry this phase reuses per D-04

### Existing Code (confirmed via direct read during research and this discussion)

- `packages/shared/src/moveValidator.ts` (lines 40-42, 92-140) — `STEAL_ATTEMPT` effect carries `defenders: PlayerPiece[]` (plural — the multi-defender case D-01/D-02/D-03 addresses); `TACKLE_ATTEMPT` effect carries a single `carrierId`; the two effects are mutually exclusive (carrier-moving vs. non-carrier-moving)
- `packages/client/src/components/GkDiveAtFeetPromptPanel.tsx` — the two-button deciding-team/waiting-message pattern `TackleStealPromptPanel.tsx` should mirror structurally (D-05)
- `packages/client/src/components/ActionLog.tsx` (lines 1157-1160) — `GK_DIVE_AT_FEET_DECLINED` formatting precedent confirming declines ARE logged visibly to both managers today

</canonical_refs>

<code_context>

## Existing Code Insights

### Reusable Assets

- `GkDiveAtFeetPromptPanel.tsx` — structural template for the new `TackleStealPromptPanel.tsx` (deciding-team buttons, waiting-message branch for the non-deciding manager).
- `docs/HIGHLIGHT-REFERENCE.md`'s existing `risk` ring token — reused unchanged for declined-but-live state (D-04), no new ring variant needed.
- `subsUsed`/`addedTimeBonus` sibling-field precedent (`types.ts:1729-1744`) — the established pattern for adding a new tracking field instead of overloading an existing one, directly applicable to the new decline-exclusion fields (Pitfall #8).

### Established Patterns

- Two-button decision-prompt family (`FoulChoicePanel`/`GkDiveAtFeetPromptPanel`): deciding-team field + resume snapshot + waiting-message branch + paired `*_DECLINED` event — this is the template Feature 5 extends (SUMMARY.md line 59).
- New-`ActionEventType`/new-`GamePhase` registration checklist (`formatEvent`, `REPLAY_ELIGIBLE_TYPES`, `applyUndo`'s `isBoundary` disjunction, `PHASE_LABEL` map, `STOPPAGE_PHASES`) — this project has shipped the "invisible to Undo/Replay unless registered everywhere" bug class twice already (BUG-30/31, BUG-37); budget for it explicitly.
- Exclude-by-flag (not remove-by-splice) convention for red-carded/inactive pieces — `moveValidator.ts`'s ZoI opponent list currently lacks this exclusion (Pitfall #7); worth fixing in the same pass since the sequential per-defender ordering (D-01/D-02) will iterate the same defender list.

### Integration Points

- `moveValidator.ts`'s `STEAL_ATTEMPT`/`TACKLE_ATTEMPT` effect computation is the entry point the new prompt phase intercepts — `applyMove` enters the new `GamePhase` instead of auto-resolving, gated on the new `tackleStealDeclineEnabled` toggle (mirrors `outOfBoundsEnabled`'s client-default-on/server-default-off split).
- The new toggle threads through the same Settings→Room→`buildInitialGameState` pipeline as the existing Fouls/Booking/Injury/Out-of-Bounds toggles, and will need to appear inside Phase 44's Advanced settings drawer (dependency noted in ROADMAP.md).

</code_context>

<specifics>
## Specific Ideas

- The sequential-prompt sequencing rule (D-03) is a specific, non-obvious rule: "keep prompting through the eligible-defender list until possession changes or a foul halts play for a kick" — a failed attempt alone does not stop the sequence. This is the single most implementation-critical decision from this discussion and should be treated as a first-class rule in the planner's state-machine design, not an afterthought.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope. The distinct declined-ring visual treatment was considered (per research's nice-to-have) and explicitly declined for v1 (D-04), not deferred as a future idea to revisit.

### Reviewed Todos (not folded)

- `2026-07-02-bug-kickoff-setup-persistent-light-shading-on-shot-path-hexes.md` — weak keyword-only match (score 0.6); a `KICK_OFF_SETUP` rendering bug unrelated to tackle/steal decline. Not folded; remains tagged to Phase 46 (Final Cleanup).
- `2026-08-09-bug-offside-ring-after-goal.md` — weak keyword-only match (score 0.6); an offside-ring rendering bug unrelated to tackle/steal decline. Not folded; remains tagged to Phase 46 (Final Cleanup).

</deferred>

---

_Phase: 43-tackle-steal-prompt-decline_
_Context gathered: 2026-08-23_
