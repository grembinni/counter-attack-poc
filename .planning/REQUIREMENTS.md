# Requirements: Counter Attack POC

**Defined:** 2026-07-12
**Core Value:** Two friends can open a browser, share a room code, and play a complete match of Counter Attack against each other in real time.

## v1.4 Requirements

### Response Activation (RESP)

- [ ] **RESP-01**: Attacker/defender response moves (header, deflect, final third, dive, keeper ball in box) use a consistent single-selection activation model like keeper dive
- [ ] **RESP-02**: Response move range hexes are shown in white; hexes that incur a challenge penalty display a −1 indicator
- [ ] **RESP-03**: Deflect response only activates eligible players who can legally move onto or adjacent to the shot path
- [ ] **RESP-04**: Header response only activates eligible players who can move to finish within heading range of the ball
- [ ] **RESP-05**: Final third response shows a 6-hex ring around the ball as valid response hexes
- [ ] **RESP-06**: Final third response auto-repositions the keeper to their starting position and excludes them from the eligible-player count; helper text notes the repositioning
- [ ] **RESP-07**: Dive response only presents valid dive hexes (no out-of-range options)
- [ ] **RESP-08**: When no eligible players are in range for any response move, the server auto-skips the response phase and logs the fact
- [ ] **RESP-09**: A highlight is shown on the hex containing the ball during response phases (headers, kicks) to improve visibility

### Bug Fixes (BUG)

- [x] **BUG-24**: Undo is restricted to moves made in the current phase — undo from a previous turn is not possible; undo button is disabled if no moves have been taken in the current phase or if all moves in the current phase have already been undone
- [x] **BUG-25**: The Move End Turn button is yellow while move options remain; it becomes green only when all move options are exhausted
- [x] **BUG-26**: Clicking an opponent's activated player opens the stats panel for that player
- [x] **BUG-27**: Deflection log entry uses correct format (e.g. `failed to deflect — [reason]`)
- [x] **BUG-28**: Header duel resolves to a valid goal-side target hex when attacker wins
- [x] **BUG-29**: Standard shot range validation uses the correct distance calculation to determine whether a shot is in range

### Draft Mode (DRAFT)

- [x] **DRAFT-01**: Game creation includes a pre-step screen for game settings: speed selector, team type (Standard / Draft), and — if Draft selected — player pool checkboxes (Original, MLS, International, Legends, Icons; at least one of the first three required)
- [x] **DRAFT-02**: In Standard mode the existing team-selection flow is unchanged; the speed setting moves off the team-selection page to the settings pre-step
- [x] **DRAFT-03**: In Draft mode, team-selection flow is the same as Standard but with a settings summary line (Speed | Team type | Draft pool) replacing the speed picker
- [x] **DRAFT-04**: Player pool is classified by total stat count into five tiers — Keeper (own pool), Chase (top 90–100%), Rare (80–89%), Uncommon (60–79%), Common (below 60%); all percentage boundaries are configurable constants
- [x] **DRAFT-05**: Packs are generated from the selected player pool: each pack is 7 cards with a configurable per-rarity composition (default: 1 chase, 1 rare, 1 uncommon, 3 common, 1 keeper); composition counts are configurable constants
- [ ] **DRAFT-06**: Draft screen appears between team/formation selection and lineup; displays a carousel of 7 cards above the lineup grid
- [x] **DRAFT-07**: Pick-and-swap draft flow per cycle: pick 1 card → swap packs; pick 2 cards → swap packs; pick 1 card → open new pack; repeat for 4 cycles (16 cards drafted per player)
- [x] **DRAFT-08**: On the 4th draft cycle, if a player has not yet selected a keeper after their first pick, a keeper is automatically selected as their second pick; the pack passed has one fewer card; in the next pick phase that player selects 1 card instead of 2
- [x] **DRAFT-09**: Bench is dynamically sized to hold all drafted cards not placed in the 11-player starting lineup; bench uses the same card-carousel display as the draft stage
- [x] **DRAFT-10**: After draft is complete, the lineup screen auto-positions and auto-numbers all drafted players by total stat; team badge and colors are applied to all player cards; overflow players are placed on the bench with a random unused number in the 15-99 range (D-16: random 15-99, supersedes the earlier "sequential" wording)

## Future Requirements

### Response Activation

- **RESP-10**: Challenge penalty magnitudes are dynamically computed from actual piece stats (v1.4 uses static −1 indicator)

### Draft Mode

- **DRAFT-11**: Legends and Icons player pools (additional rarity tiers above Chase)
- **DRAFT-12**: Draft history / replay — review what each player picked each round
- **DRAFT-13**: Async draft mode — players can pick on their own schedule rather than both active simultaneously

## Out of Scope

| Feature                                   | Reason                                                                                       |
| ----------------------------------------- | -------------------------------------------------------------------------------------------- |
| BUG-23 (KICK_OFF_SETUP shot-path shading) | Root cause requires console.log instrumentation session — deferred to standalone debug spike |
| AI / single-player draft opponent         | Not planned                                                                                  |
| Card trading between players post-draft   | Out of scope for v1                                                                          |
| Custom player pool upload                 | Hardcoded pools only                                                                         |
| Draft spectator view                      | Not planned                                                                                  |

## Traceability

| Requirement | Phase    | Status   |
| ----------- | -------- | -------- |
| BUG-24      | Phase 26 | Complete |
| BUG-25      | Phase 26 | Complete |
| BUG-26      | Phase 26 | Complete |
| BUG-27      | Phase 26 | Complete |
| BUG-28      | Phase 26 | Complete |
| BUG-29      | Phase 26 | Complete |
| RESP-01     | Phase 27 | Pending  |
| RESP-02     | Phase 27 | Pending  |
| RESP-03     | Phase 27 | Pending  |
| RESP-04     | Phase 27 | Pending  |
| RESP-05     | Phase 27 | Pending  |
| RESP-06     | Phase 27 | Pending  |
| RESP-07     | Phase 27 | Pending  |
| RESP-08     | Phase 27 | Pending  |
| RESP-09     | Phase 27 | Pending  |
| DRAFT-01    | Phase 27 | Complete |
| DRAFT-02    | Phase 27 | Complete |
| DRAFT-03    | Phase 27 | Complete |
| DRAFT-04    | Phase 28 | Complete |
| DRAFT-05    | Phase 28 | Complete |
| DRAFT-06    | Phase 30 | Pending  |
| DRAFT-07    | Phase 30 | Complete |
| DRAFT-08    | Phase 30 | Complete |
| DRAFT-09    | Phase 30 | Complete |
| DRAFT-10    | Phase 30 | Complete |

**Coverage:**

- v1.4 requirements: 25 total
- Mapped to phases: 25 (all mapped)
- Unmapped: 0

---

_Requirements defined: 2026-07-12_
_Last updated: 2026-07-12 — traceability mapped to Phases 26–30_
