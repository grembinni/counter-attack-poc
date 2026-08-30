# Phase 46: Final Cleanup - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-28
**Phase:** 46-Final Cleanup
**Areas discussed:** Todo folding, Bench-patch clarification, Redundant single-action flows, Dead-ball highlight gaps, Consolidation depth, Card/pitch/roster/bench layout alignment, Audit specificity

---

## Todo Folding

| Todo | Description | Selected |
|------|-------------|----------|
| Two long-standing rendering bugs (BUG-23 shot-path shading + offside-ring-after-goal) | Same "server clears it, client still renders it" signature, unconfirmed root cause after deep static analysis across multiple milestones | |
| No auto-reselect after interrupt prompt | Moved piece not reselected with movement ring after tackle/steal/GK-dive/box-entry/foul-choice prompts resume play; root cause identified, fix sketched | ✓ |
| PK kicker-selection pattern diverges from FK | Different sequences for choosing kicker vs. kick location; explicitly cross-referenced to CLEANUP-10 | ✓ |
| Move Speed setting into Advanced Settings drawer | Speed control lives outside Phase 44's Advanced drawer | ✓ |

**User's choice:** Fold the auto-reselect fix, PK/FK pattern alignment, and speed-setting relocation. Explicitly declined to fold the two rendering-bug todos.
**Notes:** User also raised a new item not on the list: "random common subs for bench on pre-built teams" — see Bench Patch below.

---

## Bench Patch Clarification

Follow-up question: is the bench-subs idea a fix to an existing gap, or new capability?

**User's choice:** "Its new feature but I want a simple patch now. Hard code a roughly equal home and away bench from original players."

Follow-up: scope confirmation (4 original teams × 5 roles vs. all 12 teams vs. custom).

**User's choice:** "just 2 benches - 1 for the home team, 1 for the away team - added to pre-built teams after player have chosen teams. I will increase standard team sizes in a later milestone"

**Notes:** This is a deliberate, informed override of the phase's own cleanup-only scope guardrail — user explicitly acknowledged it's new capability and asked for it anyway as a minimal placeholder. Captured as D-05..D-09 in CONTEXT.md. Confirmed against code: `roomHandlers.ts` currently builds empty benches for standard-mode rooms by design (documented D-12 "expected behavior, not a gap").

---

## Discuss Area Selection

All 4 presented areas selected: Redundant single-action flows (CLEANUP-12), Dead-ball highlight gaps (CLEANUP-06), Consolidation depth (CLEANUP-09/10), Card/pitch/roster/bench layout alignment (CLEANUP-11).

**User's choice:** Selected all 4, then pasted the full phase scope checklist (closely matching ROADMAP.md's Phase 46 description) asking for review of any new categories.
**Notes:** Cross-checked against REQUIREMENTS.md CLEANUP-05..13 — no new capability beyond what's already scoped, with one added specific: valid-move hex tint color should be consistent across different movement pattern types (captured as D-02).

---

## Specific Examples (redundant flows / color inconsistencies)

| Option | Description | Selected |
|--------|-------------|----------|
| Let the audit find them | No specific examples in mind — research step scans the codebase | ✓ |
| I have specific examples | User lists specific flows/hexes directly | |

**User's choice:** Let the audit find them.
**Notes:** No named examples provided for CLEANUP-12 redundant flows or CLEANUP-09 color inconsistencies — planning/research must locate these via codebase scan (grep the 5 restart panels, movement-pattern branches, multi-step phase UIs).

---

## Claude's Discretion

- Consolidation depth (CLEANUP-09/10): whether to do surface-level interaction fixes or a deeper shared-module refactor across all 5 restart panels — no explicit user mandate either way; default to fixing genuine duplication without speculative refactor.
- Exact stat values/attributes for the 2 hardcoded placeholder bench players per role — not specified; should be reasonable placeholders consistent with existing squad attribute ranges.

## Deferred Ideas

- BUG-23 (KICK_OFF_SETUP stale shot-path shading) and the offside-ring-after-goal bug — both reviewed, both explicitly declined for folding into Phase 46 due to open-ended investigation risk. Remain in `.planning/todos/pending/` for a future phase.
