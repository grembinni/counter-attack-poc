# Requirements: Counter Attack POC — v1.7

**Defined:** 2026-08-21
**Core Value:** Two friends can open a browser, share a room code, and play a complete match of Counter Attack against each other in real time.

## v1.7 Requirements

Requirements for the "UI Consistency, Substitution Rework & Match Summary" milestone. Each maps to roadmap phases.

### Referee Leniency

- [x] **REFEREE-01**: Host can toggle a manual Referee Leniency override at game creation, default off
- [x] **REFEREE-02**: When enabled, host selects a Leniency value in range 2–5 via an up/down stepper, defaulting to a mid value
- [x] **REFEREE-03**: When the override is off (default), Leniency is randomly assigned 2–5 at match start (narrowed from the previous 1–6 roll)
- [x] **REFEREE-04**: The manual override value drives both the booking threshold and the added-time calculation identically to the existing random roll (kept coupled per explicit decision); UI copy notes that a stricter Leniency setting also affects added time

### Card & Injury Iconography

- [x] **ICON-01**: A single shared card/injury badge component replaces the three independently-implemented treatments (pitch piece overlay, player-stats card, roster/lineup card)
- [x] **ICON-02**: Card and injury status render with identical iconography and identical relative position (between name and flag, or immediately after flag) on the player card, pitch card, roster card, and bench card
- [x] **ICON-03**: Bench card gains card/injury status display for the first time (previously showed neither)

### Advanced Settings Drawer

- [x] **SETTINGS-05**: Game-creation match-rule toggles are grouped under a collapsed-by-default "Advanced" section
- [x] **SETTINGS-06**: Within the Advanced section, toggles are laid out in a two-column (left/right) grid rather than a single vertical stack
- [x] **SETTINGS-07**: The existing Fouls-dependency grey-out behavior (Booking/Injury disabled when Fouls is off) continues to work correctly inside the new layout, driven by one shared derivation used at both render time and confirm time

### Substitution UX Overhaul

- [x] **SUB-08**: The mid-match roster screen defaults to a player-positioning mode — on-field players can be dragged to swap formation positions with each other
- [x] **SUB-09**: Position-swap dragging is disabled while any other game action is selected/pending
- [x] **SUB-10**: Bench players are not selectable or draggable in positioning mode
- [x] **SUB-11**: A substitution action button enters substitution mode; it is disabled once a team has used all 3 substitutions
- [x] **SUB-12**: In substitution mode, the action button is replaced with a Cancel button that reverts to default positioning mode without applying a substitution
- [x] **SUB-13**: Only one substitution can be staged per action — dragging a field or bench player onto a target player stages exactly one swap
- [x] **SUB-14**: Staging a substitution shows a confirmation popup naming the player coming off and the player coming on (mirroring the existing early-movement-end confirmation pattern)
- [x] **SUB-15**: Confirming the popup applies the substitution and returns to default positioning mode; cancelling the popup stays in substitution mode with the pending selection reset
- [x] **SUB-16**: A green Resume button replaces the small close (X) control used to return to the game from the roster screen
- [x] **SUB-17**: The side banner background — not just its text — turns green when that team's roster screen is in an editable state
- [x] **SUB-18**: A red-carded player displays on the bench as a red-card marker; their formation slot can still be repositioned but is never rendered with a player on the pitch, and can never be the target of a substitution
- [x] **BUG-38**: A red-carded player is removed from the field completely, not merely hidden or excluded interaction-by-interaction — their frozen position must stop blocking movement/occupancy and stop appearing in any gameplay computation (targeting, ZoI, movement-path blocking, deflection eligibility, or any other pitch-occupancy check), matching the confirmed live defects where a red-carded piece remains eligible in `DEFLECT_ATTEMPT` defender-input building (`gameHandlers.ts`) and the Zone-of-Influence opponent list (`moveValidator.ts`), plus any other site an audit finds still treating them as on-pitch

### Tackle/Steal Prompt & Decline

- [x] **TACKLE-01**: A new game-creation toggle prompts the defender before a tackle/steal attempt, default on
- [x] **TACKLE-02**: When enabled and a tackle/steal opportunity arises, the defending manager can decline it without it counting as an attempt
- [x] **TACKLE-03**: A declined opportunity keeps its risk ring active so the same defender can be prompted again on a later move step, until the opportunity genuinely expires (ball carrier moves out of range, or the movement phase ends)
- [x] **TACKLE-04**: When the toggle is off, tackle/steal duels resolve immediately as they do today, with no decline prompt

### Game Summary Popup

- [ ] **STATS-01**: An (i) icon on the scoreboard opens a match summary popup at any time during the match
- [ ] **STATS-02**: The popup remains reachable at half-time and full-time in addition to the existing half-time/full-time display
- [ ] **STATS-03**: The popup shows a settings/toggle recap, including the referee Leniency setting
- [ ] **STATS-04**: The popup shows possession as a percentage of elapsed match minutes, per team
- [ ] **STATS-05**: The popup shows total completed passes per team
- [ ] **STATS-06**: The popup shows successful tackles + steals per team, and tackle/steal success percentage
- [ ] **STATS-07**: The popup shows total shots per team
- [ ] **STATS-08**: The popup shows accumulated xG per team, computed per shot via the specified formula (inputs: defenders in the goal box, defenders in the penalty box, shot-hex X/Y distance from goal center)
- [ ] **STATS-09**: The popup shows fouls, yellow cards, and red cards per team

### Final Cleanup

- [ ] **CLEANUP-05**: A gameplay consistency audit closes identified gaps in expected functions
- [ ] **CLEANUP-06**: When the ball is dead and players are being selected/moved, the ball's hex is consistently highlighted across every such phase
- [ ] **CLEANUP-07**: Phase help/info text is reviewed so every step of a multi-step phase is described
- [ ] **CLEANUP-08**: Response-move trigger language is clarified (e.g., naming what triggered a final-third movement)
- [ ] **CLEANUP-09**: Duplicate movement-pattern logic is consolidated
- [ ] **CLEANUP-10**: Kicker/thrower selection interaction is aligned across all restart types
- [ ] **CLEANUP-11**: Pitch card, roster card, and bench card layout/design is aligned
- [ ] **CLEANUP-12**: Redundant multi-step flows are collapsed to a single step where only one action is ever taken
- [ ] **CLEANUP-13**: Dead code identified during this milestone is removed

## Future Requirements

Deferred to future releases. Tracked but not in current roadmap.

### Response Activation

- **RESP-01..09**: Response-move (header/deflect/final-third/dive/keeper-ball-in-box) single-selection activation model — deferred again, now across four consecutive milestones (v1.4, v1.5, v1.6, v1.7)

### Fouls

- **NUTMEG-01+**: Nutmeg as its own distinct move, separate from the existing steal-attempt mechanic — raised during v1.6 scoping, still undesigned

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature                                                         | Reason                                                                                                                                                      |
| --------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Heat maps, pass-network diagrams, shot maps, per-player ratings | Requires new positional-history aggregation infrastructure and a charting library; over-scoped for a 2-player POC's match summary                           |
| Referee Leniency override outside 2–5                           | 1 and 6 are the auto-strict/auto-lenient extremes that make the manual toggle pointless if selectable                                                       |
| Undo/redo for a confirmed substitution                          | Subs are capped at 3/match with no reset; re-opening a completed sub reintroduces the roster-integrity problem `applyRosterContinuity` was built to prevent |
| AI-suggested substitutions / tactical-instructions system       | No AI/single-player mode in this project                                                                                                                    |
| Persistent always-visible stats HUD strip                       | Competes with the existing top-band scoreboard for space; duplicates the requested on-demand (i)-icon pattern                                               |
| Configurable tackle/steal decline thresholds                    | The requirement is a binary toggle only                                                                                                                     |
| Decoupling Referee Leniency from added-time calculation         | Explicitly kept coupled — documented in UI copy instead                                                                                                     |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement     | Phase    | Status   |
| --------------- | -------- | -------- |
| ICON-01..03     | Phase 41 | Complete |
| SUB-08..18      | Phase 42 | Complete |
| BUG-38          | Phase 42 | Complete |
| TACKLE-01..04   | Phase 43 | Complete |
| REFEREE-01..04  | Phase 44 | Complete |
| SETTINGS-05..07 | Phase 44 | Complete |
| STATS-01..09    | Phase 45 | Pending  |
| CLEANUP-05..13  | Phase 46 | Pending  |

**Coverage:**

- v1.7 requirements: 44 total (REFEREE 4, ICON 3, SETTINGS 3, SUB 11, BUG-38 1, TACKLE 4, STATS 9, CLEANUP 9 — corrects the initial 39-count estimate made before every category was fully itemized)
- Mapped to phases: 44/44
- Unmapped: 0 — no orphans

---

_Requirements defined: 2026-08-21_
_Last updated: 2026-08-21 after v1.7 roadmap creation (Phases 41–46, 44/44 requirements mapped, no orphans)_
