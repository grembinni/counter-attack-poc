# Phase 15: Team Identity - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-13
**Phase:** 15-team-identity
**Areas discussed:** Badge SVG art approach, TeamConfig data shape, Phase 15 scoreboard wiring, Jersey pattern architecture

---

## Badge SVG art approach

| Option                 | Description                                                                                   | Selected |
| ---------------------- | --------------------------------------------------------------------------------------------- | -------- |
| Simple geometric icons | Shield with geometric motif per team — star, paw, arch, diamond                               |          |
| Stylized silhouettes   | More expressive SVG paths — galaxy spiral, coyote head, arch with verticals, diagonal stripes |          |
| You decide             | Claude picks fidelity level per design brief                                                  |          |
| User uploads icons     | User provides PNG images; agent reformats/resizes as needed                                   | ✓        |

**User's choice:** Provided 4 PNG badge images directly in chat (Cosmos, City, Xolos, Crew — all circular designs with transparent backgrounds).
**Notes:** Images cannot be extracted from chat — user must drop PNG files into `packages/client/src/assets/badges/`. Badge name discrepancy: badge reads "COSMOS" but requirements say "Cozmos" — needs confirmation before coding.

---

## TeamConfig data shape

### Q1: Where should TeamConfig live?

| Option                    | Description                                                      | Selected |
| ------------------------- | ---------------------------------------------------------------- | -------- |
| New shared/teamConfig.ts  | Exports TeamConfig type + TEAM_CONFIGS record; badge client-only | ✓        |
| Inline in shared/types.ts | Add to existing types.ts — simpler but conceptually separate     |          |
| Client-only               | All team config client-side; server doesn't need it              |          |

**User's choice:** New shared/teamConfig.ts (recommended)

### Q2: What fields in TeamConfig?

| Option                                                | Description                                                  | Selected |
| ----------------------------------------------------- | ------------------------------------------------------------ | -------- |
| id + name + primaryColor + secondaryColor + badgeFile | Full contract for Phase 16 player cards and selection screen | ✓        |
| id + name + primaryColor only                         | Minimal; secondary color and badge filename live elsewhere   |          |

**User's choice:** Full 5-field contract (recommended)

---

## Phase 15 scoreboard wiring

### Q1: How to show badge in scoreboard without team selection?

| Option                             | Description                                                        | Selected |
| ---------------------------------- | ------------------------------------------------------------------ | -------- |
| Default pairing hardcoded          | TEAM_DEFAULTS constant; Cosmos=home, Xolos=away; Phase 16 replaces | ✓        |
| Add selectedTeams to GameState now | Touches server + shared types; Phase 16 just adds UI               |          |
| Defer scoreboard badge to Phase 16 | TEAM-06 deferred; Phase 15 only defines data                       |          |

**User's choice:** Default pairing hardcoded (recommended)

### Q2: Replace hardcoded colors now?

| Option                               | Description                                              | Selected |
| ------------------------------------ | -------------------------------------------------------- | -------- |
| Yes — replace with teamConfig lookup | PieceOverlay + GameBoard derive colors from TEAM_CONFIGS | ✓        |
| No — keep hardcoded for Phase 15     | Color refactor deferred to Phase 16                      |          |

**User's choice:** Yes — clean up all hardcoded hex colors now (recommended)

---

## Jersey pattern architecture

### Q1: Architecture for 4 jersey patterns?

| Option                                          | Description                                                     | Selected |
| ----------------------------------------------- | --------------------------------------------------------------- | -------- |
| 4 SVG patterns in PieceOverlay keyed by team id | Extends current inline approach; self-contained                 | ✓        |
| Per-team token component                        | New component per team; cleaner separation but 4 new components |          |
| You decide                                      | Claude picks based on existing pattern                          |          |

**User's choice:** 4 SVG patterns in PieceOverlay (recommended)

### Q2: GK special colors?

| Option                        | Description                                           | Selected |
| ----------------------------- | ----------------------------------------------------- | -------- |
| Keep purple/amber for all GKs | Board convention; no change                           |          |
| Team-specific GK color        | gkColor in TeamConfig; deviates from board convention |          |
| Keep but with pattern update  | Preserve convention; add visual interest              | ✓        |

**User's choice (free text):** "keep but give a style update i.e. make purple a purple/darkpurple checker and give yellow 2 orange verticals on the edges of the jersey"
**Notes:** Home GK = purple/dark-purple checker (#7c3aed/#4c1d95). Away GK = amber base with 2 narrow orange vertical stripes on left and right edges.

---

## Claude's Discretion

- Exact color hex values for team configs (D-04 in CONTEXT.md) — approximate values given, planner should refine against badge images.
- SVG checker tile size for Xolos jersey and home GK checker.
- Exact pixel coordinates for City jersey arch path.

## Deferred Ideas

- `selectedTeams` in GameState — Phase 16
- `gkColor` in TeamConfig — not added (board convention preserved)
- Badge on player card — Phase 16 (PLAY-02)
- Team selection screen — Phase 16 (SELECT-01)
