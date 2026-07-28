# Requirements: Counter Attack POC

**Defined:** 2026-07-22
**Core Value:** Two friends can open a browser, share a room code, and play a complete match of Counter Attack against each other in real time.

## v1.5 Requirements

### Visual Theme (THEME)

- [x] **THEME-01**: The deep-blue color scheme is replaced with a broadcast-sports palette (dark charcoal/graphite base, crisp white text, single team-color accent) applied across every screen — lobby, settings, team/draft selection, and the in-game board
- [x] **THEME-02**: All chrome colors (panels, buttons, borders, text) are driven by a single CSS custom-property token file; no hardcoded hex/rgba literals remain in chrome-related CSS Modules
- [x] **THEME-03**: The single accent color per view is derived from the active team's `TEAM_CONFIGS.palette.uiColor` via one runtime CSS variable, not per-component lookups
- [x] **THEME-04**: All team-accent colors pass WCAG AA contrast against the new charcoal/white base, verified via an automated contrast check

### Hex Highlight & Ring Standardization (HILITE)

- [x] **HILITE-01**: Every hex-tint and piece-selection-ring color is defined in one single source-of-truth table, extending `HIGHLIGHT_STYLES` to cover all real highlight cases (including the currently ad-hoc GK-kick-target, pass-target, tackle-risk, and ball-position overlays that live as inline literals in `HexGrid.tsx` today)
- [x] **HILITE-02**: Red is used for exactly one meaning app-wide (rule violation / offside); the goal-line shot-target highlight is moved to a different color so a positive scoring opportunity is never signaled by the same color as a rule violation
- [x] **HILITE-03**: The "selected" piece ring and "already acted" piece ring are visually distinct from each other. Resolution changed during Task 3 human-verify: rather than keep a separate "already-moved-this-stage" grey mechanism alongside the existing orange-ring-+-red-X `activated` state (a one-off styling variant scoped to a single phase), the grey mechanism was removed entirely — the single `activated` (orange) state, already distinct from `active` (green), now covers every already-acted case app-wide, consistent with this phase's goal.
- [x] **HILITE-04**: A dedicated ball-location marker highlights the hex containing the ball during response phases (headers, kicks), rendered as a standalone always-on-top overlay rather than competing inside the mutually-exclusive hex-highlight priority order
- [x] **HILITE-05**: The full highlight/ring color mapping is documented as a single reference so future additions follow the same system

### ActionPanel & Log Standardization (PANEL)

- [x] **PANEL-01**: ActionPanel and ActionLog help text follows one consistent format and tone across every game phase
- [ ] **PANEL-02**: No component in the ActionPanel/ActionLog area uses a border for framing
- [ ] **PANEL-03**: All ActionPanel buttons share consistent sizing, color-state logic, and interaction behavior across phases
- [x] **PANEL-04**: Terminology and phrasing are consistent across all ActionPanel/ActionLog states

### Code Cleanup (CLEANUP)

- [x] **CLEANUP-01**: Dead code (unused fields, functions, exports) is identified and removed across shared/server/client, verified via an automated dead-code-detection tool
- [x] **CLEANUP-02**: Duplicated logic (e.g. repeated `TEAM_CONFIGS` color lookups, repeated team-slot derivation) is consolidated into shared helper functions/hooks
- [x] **CLEANUP-03**: Zustand store selectors are reviewed for staleness and inefficiency (e.g. stale dependency arrays, redundant derived-state computation)
- [x] **CLEANUP-04**: React Hook dependency correctness is enforced via lint tooling across the client package

### Bug Fixes (BUG)

- [x] **BUG-30**: Replay reconstructs all player positions at kickoff so the board resets correctly after a goal is scored
- [x] **BUG-31**: The eligible-players-remaining message and End Turn button color update the moment a player starts a move (not only once fully activated), and correctly reflect state after an Undo
- [x] **BUG-32**: The goalkeeper cannot be selected as an eligible deflection responder
- [ ] **BUG-33**: The Game Settings screen has a Back control that returns the host to the Landing screen and tears the just-created room down server-side immediately, rather than leaving the room code joinable until the ~90s disconnect grace timer expires
- [ ] **BUG-34**: Draft packs never contain duplicate players — a player appears in at most one pack across all 6 rounds / 12 packs of a single match (match-wide uniqueness, superseding Phase 30's per-round-only rule)
- [ ] **BUG-35**: A short pack slot is filled by cascading DOWN through tiers within the already-selected pool(s) before any cross-pool reach, and cross-pool fallback contributes common-tier cards only — no rare/chase/uncommon card from a non-selected pool is ever offered
- [ ] **BUG-36**: When a shot is blocked by a shooter/goalkeeper duel tie, the resulting loose ball is pathed from the goalkeeper's dive-adjusted hex, not the shooter's hex
- [ ] **BUG-37**: Undo cannot revert state to before a resolved dice-roll action (tackle/steal attempt) within the current move, while remaining available for steps taken after it

## Future Requirements

### Response Activation (carried forward from v1.4, deferred again)

- **RESP-01 through RESP-09**: Response-move (header/deflect/final-third/dive/keeper-ball-in-box) single-selection activation model with eligibility gating, range-hex highlighting, and auto-skip. Still not scheduled — see `.planning/v1.4-MILESTONE-AUDIT.md`.

### Rule Expansion (raised during v1.5 scoping, deferred)

- **OOB-01+**: Out-of-bounds and restart-of-play mechanics — throw-in, corner kick, goal kick — feature-flagged toggle at game creation
- **REF-01+**: Referees, fouls, bookings (yellow/red cards), substitutions — free-kick/penalty-kick consequences — feature-flagged toggle at game creation
- **STATS-01+**: Game-stats overlay — possession, tackles, shots, goals, xG, interceptions, saves

## Out of Scope

| Feature                                                      | Reason                                                                                                 |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------ |
| New UI framework or component library                        | This is a refresh on the existing React + CSS Modules stack, not a rewrite                             |
| Replacing SVG rendering, Zustand, or React itself            | Out of scope for a UX/cleanup milestone; these are validated, working choices                          |
| User-toggleable colorblind mode / alternate palettes         | Needs real demand signal first; depends on this milestone's default palette being collision-free       |
| Full custom theme/color picker for board highlights          | Scope creep for a 2-player POC                                                                         |
| RESP-01..09 (response-move activation model)                 | Explicitly deferred again during v1.5 scoping — see Future Requirements                                |
| Out-of-bounds/restarts, fouls/cards/subs, game-stats overlay | Raised during v1.5 scoping as lower priority; deferred to a future milestone — see Future Requirements |

## Traceability

| Requirement | Phase                                                | Status   |
| ----------- | ---------------------------------------------------- | -------- |
| THEME-01    | Phase 34 — Visual Theme Restyle                      | Complete |
| THEME-02    | Phase 34 — Visual Theme Restyle                      | Complete |
| THEME-03    | Phase 33 — Design Tokens & Highlight Standardization | Complete |
| THEME-04    | Phase 34 — Visual Theme Restyle                      | Complete |
| HILITE-01   | Phase 33 — Design Tokens & Highlight Standardization | Complete |
| HILITE-02   | Phase 33 — Design Tokens & Highlight Standardization | Complete |
| HILITE-03   | Phase 33 — Design Tokens & Highlight Standardization | Complete |
| HILITE-04   | Phase 33 — Design Tokens & Highlight Standardization | Complete |
| HILITE-05   | Phase 33 — Design Tokens & Highlight Standardization | Complete |
| PANEL-01    | Phase 35 — ActionPanel & Log Standardization         | Complete |
| PANEL-02    | Phase 35 — ActionPanel & Log Standardization         | Pending  |
| PANEL-03    | Phase 35 — ActionPanel & Log Standardization         | Pending  |
| PANEL-04    | Phase 35 — ActionPanel & Log Standardization         | Complete |
| CLEANUP-01  | Phase 32 — Code Cleanup                              | Complete |
| CLEANUP-02  | Phase 32 — Code Cleanup                              | Complete |
| CLEANUP-03  | Phase 32 — Code Cleanup                              | Complete |
| CLEANUP-04  | Phase 32 — Code Cleanup                              | Complete |
| BUG-30      | Phase 31 — Bug Fixes                                 | Complete |
| BUG-31      | Phase 31 — Bug Fixes                                 | Complete |
| BUG-32      | Phase 31 — Bug Fixes                                 | Complete |
| BUG-33      | Phase 36 — Bug Fixes                                 | Pending  |
| BUG-34      | Phase 36 — Bug Fixes                                 | Pending  |
| BUG-35      | Phase 36 — Bug Fixes                                 | Pending  |
| BUG-36      | Phase 36 — Bug Fixes                                 | Pending  |
| BUG-37      | Phase 36 — Bug Fixes                                 | Pending  |

**Coverage:**

- v1.5 requirements: 25 total
- Mapped to phases: 25/25 (100%)
- Unmapped: 0 ✓

---

_Requirements defined: 2026-07-22_
_Last updated: 2026-07-28 — BUG-33..BUG-37 minted during Phase 36 planning; 6 phases (31-36) map all 25 v1.5 requirements with no orphans_
