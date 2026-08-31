# Requirements: Counter Attack POC — v1.8 Roster Interaction Overhaul & Rules Audit

**Defined:** 2026-08-30
**Core Value:** Two friends can open a browser, share a room code, and play a complete match of Counter Attack against each other in real time.

## v1.8 Requirements

Requirements for the v1.8 milestone. Each maps to roadmap phases.

### Roster Interaction

Replaces drag-and-drop with the app's existing click-to-select interaction model, applied to the mid-match roster screen's two modes (positioning and substitution).

- [x] **ROSTER-01**: User can select a player card on the mid-match roster screen by clicking it (green outline = selected state)
- [x] **ROSTER-02**: Selecting a player highlights all eligible swap/substitution targets in blue
- [x] **ROSTER-03**: Clicking the selected player again deselects it and clears the blue eligible-target highlights
- [x] **ROSTER-04**: Clicking an eligible blue target completes the swap (positioning mode) or stages the substitution (substitution mode), matching today's existing confirm flow
- [x] **ROSTER-05**: Positioning-mode and substitution-mode eligibility/guard logic remain implemented as separate functions, not merged into one handler
- [x] **ROSTER-06**: All native drag-and-drop code (drag state, handlers, types) removed from `LineupAssignmentScreen.tsx`, zero dead code per `knip`
- [x] **ROSTER-07**: Standard pregame lineup screen's slot-swap flow (`LineupAssignmentScreen.tsx`, non-draft mode) replaces drag-and-drop with the same click-to-select model (green selected / blue eligible targets)
- [x] **ROSTER-08**: Draft-mode pack carousel and bench/slot rearrange (pick, slot↔slot, slot↔bench) replace drag-and-drop with click-to-select; the pack row behaves like the mid-match bench does in substitution mode (select pack card, eligible slots/bench highlight blue, click completes the pick)

### Permanent Jersey Numbers

Jersey numbers currently derive from formation/lineup slot and get re-derived at multiple reset points. This makes numbers a stable, permanent part of player identity.

- [x] **NUMBER-01**: Each player is assigned a jersey number once at squad-build time, independent of formation/lineup slot
- [ ] **NUMBER-02**: A player's jersey number persists unchanged through repositioning, substitution, goal reset, and half-time reset
- [x] **NUMBER-03**: The kickoff-striker anchor lookup no longer depends on `number === 9`; it uses a role-based lookup instead
- [ ] **NUMBER-04**: `applyRosterContinuity` preserves each player's permanent number across all reset call sites (goal-via-shot, goal-via-penalty, half-time, and any other reset site)
- [ ] **NUMBER-05**: Draft-mode bench players also receive a permanent number assigned once, not re-rolled

### GK Box-Entry-Before-Dive Resequencing

Today the GK box-entry reposition offer fires after the shot-blocking dive on an outside-the-box shot, which is pointless — it needs to fire before.

- [ ] **GKSEQ-01**: On an outside-the-box shot on goal, the defending GK's box-entry reposition offer resolves before the shot-blocking `GK_DIVING` dive, not after
- [ ] **GKSEQ-02**: The box-entry-before-dive offer fires at most once per shot (no double-offering)
- [ ] **GKSEQ-03**: Existing shot/header/corner/penalty/GK-catch regression suites remain green (no behavior change to those paths)

### Final-Third Confirm Fix

- [ ] **FINALTHIRD-01**: The end-turn confirm button is green (not warning-colored) when the only unmoved player is the goalkeeper
- [ ] **FINALTHIRD-02**: The "not all players moved" warning does not appear when the only unmoved player is the goalkeeper

### Foul→Injury→Booking Banner Sequencing

Reopens the paused v1.6 debug investigation. A prior fix (commit `0664573`) shipped clean but was confirmed by the user not to resolve the live symptom.

- [ ] **BANNER-01**: The foul → injury → booking event sequence displays each banner in order without skipping or overlapping, verified via a live two-browser session (not synthetic tests alone)
- [ ] **BANNER-02**: The confirmed-correct display order is resolved and locked in as a regression test

### Rules-Fidelity Gap Analysis

Audit-only deliverable — a findings document, not a set of fixes. Scopes a future cleanup milestone.

- [ ] **AUDIT-01**: A findings document cross-references rulebook v1.4.1 clauses against the current implementation, classifying each finding as gap / intentional-simplification / false-positive, reusing the `vX-MILESTONE-AUDIT.md` format
- [ ] **AUDIT-02**: Findings are cross-checked against PROJECT.md's existing Deferred/Out-of-Scope/Key-Decisions tables before being logged as new gaps
- [ ] **AUDIT-03**: The audit produces zero source-file diffs outside `.planning/` (documentation-only deliverable)

## Future Requirements

Deferred to future release. Tracked but not in current roadmap.

### Response Activation Model

- **RESP-01..09**: Response-move (header/deflect/final-third/dive/keeper-ball-in-box) single-selection activation model with eligibility gating, range-hex highlighting, and auto-skip. Deferred across six consecutive milestones (v1.4–v1.8). Research flagged that v1.8's click-to-select vocabulary may make this cheaper to build next time.

### Other Deferred Items

- **NUTMEG-01+**: Nutmeg as its own distinct move (separate from steal-attempt); not yet designed
- Reconnection grace period; rematch flow; chat; draft history/replay; async draft mode; substitution roster limit beyond 3

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Fixing gaps found by the rules audit (AUDIT-01) | Audit produces a findings document only; fixes are scoped to a future cleanup milestone |
| A general interrupt/priority-stack engine for GK reactive moves | Not yet justified with only 3 interrupt types; GKSEQ resequencing is a targeted fix, not a general engine |
| AI / single-player mode | Not planned |
| Animations, mobile layout, sound effects, custom team/card editor, spectator mode | Long-standing project exclusions (see PROJECT.md) |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| ROSTER-01 | Phase 47 | Complete |
| ROSTER-02 | Phase 47 | Complete |
| ROSTER-03 | Phase 47 | Complete |
| ROSTER-04 | Phase 47 | Complete |
| ROSTER-05 | Phase 47 | Complete |
| ROSTER-06 | Phase 47 | Complete |
| ROSTER-07 | Phase 47 | Complete |
| ROSTER-08 | Phase 47 | Complete |
| NUMBER-01 | Phase 48 | Complete |
| NUMBER-02 | Phase 48 | Pending |
| NUMBER-03 | Phase 48 | Complete |
| NUMBER-04 | Phase 48 | Pending |
| NUMBER-05 | Phase 48 | Pending |
| GKSEQ-01 | Phase 49 | Pending |
| GKSEQ-02 | Phase 49 | Pending |
| GKSEQ-03 | Phase 49 | Pending |
| FINALTHIRD-01 | Phase 49 | Pending |
| FINALTHIRD-02 | Phase 49 | Pending |
| BANNER-01 | Phase 50 | Pending |
| BANNER-02 | Phase 50 | Pending |
| AUDIT-01 | Phase 51 | Pending |
| AUDIT-02 | Phase 51 | Pending |
| AUDIT-03 | Phase 51 | Pending |

**Coverage:**

- v1.8 requirements: 23 total
- Mapped to phases: 23/23 ✓
- Unmapped: 0 — no orphans

**Phase grouping note:** GKSEQ-01..03 and FINALTHIRD-01..02 are both mapped to Phase 49 (combined). Both are small, independent, single-file-ish correctness fixes with no file overlap with each other or with Phases 47/48/50/51; research explicitly flagged FINALTHIRD as parallel-friendly filler work alongside GKSEQ, and standard granularity (4–6 phases, tightened 2026-05) disfavors a standalone 2-requirement phase. See `.planning/ROADMAP.md` Phase 49 for full rationale.

**Scope expansion note (Phase 47 discussion, 2026-08-30):** ROSTER-07/08 and the removal of the "Pregame/draft-mode drag-and-drop" Out-of-Scope line were added during `/gsd-discuss-phase 47`. The user explicitly widened Phase 47 from "mid-match roster screen only" to "retire drag-and-drop everywhere in `LineupAssignmentScreen.tsx`" — Standard pregame lineup swap and the draft-mode pack/bench/lineup carousel now also move to click-to-select, using the same green-selected/blue-eligible-target vocabulary as ROSTER-01..04. This also resolves a pre-existing inconsistency: ROADMAP.md's Phase 47 success criterion 5 already read "no drag-and-drop state, handlers, or types remain in `LineupAssignmentScreen.tsx`" (file-wide), which contradicted the Goal text's "mid-match only" framing and the old Out-of-Scope line. See `47-CONTEXT.md`.

---
*Requirements defined: 2026-08-30*
*Last updated: 2026-08-30 — Phase 47 discussion expanded scope to ROSTER-07/08 (draft-mode + Standard pregame click-select), 23/23 requirements mapped to Phases 47–51, no orphans*
