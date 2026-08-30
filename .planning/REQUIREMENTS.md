# Requirements: Counter Attack POC — v1.8 Roster Interaction Overhaul & Rules Audit

**Defined:** 2026-08-30
**Core Value:** Two friends can open a browser, share a room code, and play a complete match of Counter Attack against each other in real time.

## v1.8 Requirements

Requirements for the v1.8 milestone. Each maps to roadmap phases.

### Roster Interaction

Replaces drag-and-drop with the app's existing click-to-select interaction model, applied to the mid-match roster screen's two modes (positioning and substitution).

- [ ] **ROSTER-01**: User can select a player card on the mid-match roster screen by clicking it (green outline = selected state)
- [ ] **ROSTER-02**: Selecting a player highlights all eligible swap/substitution targets in blue
- [ ] **ROSTER-03**: Clicking the selected player again deselects it and clears the blue eligible-target highlights
- [ ] **ROSTER-04**: Clicking an eligible blue target completes the swap (positioning mode) or stages the substitution (substitution mode), matching today's existing confirm flow
- [ ] **ROSTER-05**: Positioning-mode and substitution-mode eligibility/guard logic remain implemented as separate functions, not merged into one handler
- [ ] **ROSTER-06**: All native drag-and-drop code (drag state, handlers, types) removed from `LineupAssignmentScreen.tsx`, zero dead code per `knip`

### Permanent Jersey Numbers

Jersey numbers currently derive from formation/lineup slot and get re-derived at multiple reset points. This makes numbers a stable, permanent part of player identity.

- [ ] **NUMBER-01**: Each player is assigned a jersey number once at squad-build time, independent of formation/lineup slot
- [ ] **NUMBER-02**: A player's jersey number persists unchanged through repositioning, substitution, goal reset, and half-time reset
- [ ] **NUMBER-03**: The kickoff-striker anchor lookup no longer depends on `number === 9`; it uses a role-based lookup instead
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
| Pregame/draft-mode drag-and-drop carousel flows | Explicitly out of scope for v1.8 — only the mid-match roster screen's two modes are in scope |
| Fixing gaps found by the rules audit (AUDIT-01) | Audit produces a findings document only; fixes are scoped to a future cleanup milestone |
| A general interrupt/priority-stack engine for GK reactive moves | Not yet justified with only 3 interrupt types; GKSEQ resequencing is a targeted fix, not a general engine |
| AI / single-player mode | Not planned |
| Animations, mobile layout, sound effects, custom team/card editor, spectator mode | Long-standing project exclusions (see PROJECT.md) |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| ROSTER-01..06 | TBD | Pending |
| NUMBER-01..05 | TBD | Pending |
| GKSEQ-01..03 | TBD | Pending |
| FINALTHIRD-01..02 | TBD | Pending |
| BANNER-01..02 | TBD | Pending |
| AUDIT-01..03 | TBD | Pending |

**Coverage:**
- v1.8 requirements: 21 total
- Mapped to phases: 0 (pending roadmap creation)
- Unmapped: 21 ⚠️ (expected — roadmap not yet created)

---
*Requirements defined: 2026-08-30*
*Last updated: 2026-08-30 after initial definition*
