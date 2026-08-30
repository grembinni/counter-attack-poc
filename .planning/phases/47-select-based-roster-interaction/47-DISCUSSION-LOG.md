# Phase 47: Select-Based Roster Interaction - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-30
**Phase:** 47-select-based-roster-interaction
**Areas discussed:** Card selection visuals, Substitution selection order, GK selectability, Component structure (incl. scope expansion)

---

## Card Selection Visuals

| Option | Description | Selected |
|--------|-------------|----------|
| Reuse HIGHLIGHT-REFERENCE.md tokens | Same green/blue tokens the pitch uses for selected/eligible | ✓ |
| New roster-local color pair | Separate green/blue scoped to LineupAssignmentScreen.module.css | |
| Repurpose existing drag-state classes | Recolor statCardDragging/statCardDropTarget | |

**User's choice:** Reuse HIGHLIGHT-REFERENCE.md tokens.

| Option | Description | Selected |
|--------|-------------|----------|
| No-op, selection stays | Clicking an ineligible card does nothing; matches pitch exactly | ✓ |
| Clicking any other selectable card re-selects it | More forgiving, diverges from pitch convention | |

**User's choice:** No-op, selection stays.

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, same blue highlight | SENT OFF slot always highlighted like any eligible target | |
| No highlight, but still clickable | Left plain but still functions as a target | |

**User's choice (free text):** "yes only for repositioning, not for subs" — blue highlight applies in positioning/reposition mode only; SENT OFF is never a valid or highlighted substitution target.

---

## Substitution Selection Order

| Option | Description | Selected |
|--------|-------------|----------|
| Bench-first only | Mirrors today's drag exactly — bench card selected first | ✓ |
| Either order | Either side can initiate selection | |

**User's choice:** Bench-first only.

| Option | Description | Selected |
|--------|-------------|----------|
| Switches selection to the new bench card | Clicking a different eligible bench card re-selects it | ✓ |
| No-op, first selection stays | Must explicitly deselect first | |

**User's choice:** Switches selection to the new bench card.

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, same rule everywhere | Positioning mode also allows switching between selectable cards | |
| No, positioning mode differs | Positioning mode keeps strict deselect-first behavior | ✓ |

**User's choice:** No, positioning mode differs — the "switches selection" behavior is bench-substitution-specific.

---

## GK Selectability

| Option | Description | Selected |
|--------|-------------|----------|
| Keep GK permanently unselectable | Same rule/reason as today's drag lock | ✓ |
| Make GK selectable now that it's click-based | New capability, not scoped in ROSTER-01..06 | |

**User's choice:** Keep GK permanently unselectable.

---

## Component Structure (Scope Expansion)

| Option | Description | Selected |
|--------|-------------|----------|
| Keep one dual-mode LineupStatCard | Gate drag behind pregame/draft, click behind midmatch | (superseded — see below) |
| Extract a separate midmatch-only card component | Split components per interaction model | |

**User's initial free-text response:** "draft should be select mode too, drag and drop should be retired for all phases. In draft top row should behave like the bench for subbing."

**Claude flagged this as scope creep** — REQUIREMENTS.md's Out-of-Scope table explicitly excluded "Pregame/draft-mode drag-and-drop carousel flows" from v1.8, and ROSTER-01..06 only covered the mid-match roster screen. Asked for explicit confirmation before proceeding.

| Option | Description | Selected |
|--------|-------------|----------|
| Expand Phase 47 scope now | Widen to all three surfaces; update REQUIREMENTS.md/ROADMAP.md | ✓ |
| Keep Phase 47 as mid-match only; defer the rest | Ship ROSTER-01..06 as scoped, defer the rest | |

**User's choice:** Expand Phase 47 scope now.

**Follow-up:** Confirmed draft-mode click-select generalizes exactly from the mid-match vocabulary (pack = bench-first substitution pattern; filled slot/bench = positioning-swap pattern), with all GK-slot and swap-vs-move semantics unchanged.

| Option | Description | Selected |
|--------|-------------|----------|
| One shared click-select component | One LineupStatCard across all surfaces, eligibility functions stay separate | ✓ |
| Split per surface anyway | Separate components per surface despite shared interaction model | |

**User's choice:** One shared click-select component.

**Notes:** This scope expansion resulted in edits to `.planning/REQUIREMENTS.md` (added ROSTER-07/ROSTER-08, removed the pregame/draft-mode drag-and-drop Out-of-Scope line, updated traceability/coverage to 23/23) and `.planning/ROADMAP.md` Phase 47 (widened Goal and added success criteria 6–7). Full rationale recorded in `47-CONTEXT.md`.

---

## Claude's Discretion

- Exact CSS class naming/structure for the new shared selection-visual treatment.
- Whether selection state is one shared `useState` shape or per-surface state, as long as observable behavior and ROSTER-05's function-separation requirement hold.
- Keyboard/accessibility affordances beyond click (not raised in discussion).

## Deferred Ideas

None — the scope-expansion idea was folded into this phase rather than deferred.
