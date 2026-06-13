# Phase 16: Player Roster & Team Selection - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-13
**Phase:** 16-player-roster-team-selection
**Areas discussed:** Player data source, PlayerPiece type shape, Team selection flow, Selected teams in state

---

## Player Data Source

| Option                                      | Description                                                                    | Selected |
| ------------------------------------------- | ------------------------------------------------------------------------------ | -------- |
| I'll provide the CSV now                    | Drop the CSV into the repo. Write a build-time parser or one-time seed script. | ✓        |
| I'll define squads manually                 | Skip the CSV — hardcode squad arrays directly in teams.ts.                     |          |
| CSV exists elsewhere — I'll point you to it | File lives outside the repo; read it to generate squads.                       |          |

**User's choice:** Provide the CSV now.

---

### CSV location

| Option                                    | Description                                                                                                           | Selected |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | -------- |
| Check it in, write a one-time seed script | Store at packages/shared/src/data/. pnpm run seed:rosters parses CSV → writes teams.ts. CSV stays as source of truth. | ✓        |
| Check it in, parse at build time          | Inline module-level parser in teams.ts — no script step.                                                              |          |
| Don't check it in — paste data            | Read CSV content, generate TypeScript by hand, never commit raw CSV.                                                  |          |

**User's choice:** Seed script approach. CSV checked in; script generates teams.ts.
**Notes:** User then revealed CSVs were already checked in as per-team files (cosmos_players.csv, xolos_players.csv, city_players.csv, crew_players.csv, fa_players.csv) at packages/shared/src/data/.

---

### CSV columns

**User provided column headers directly:**
`Player, Team, Nationality, Position, Pace, Dribbling, Heading, Highpass, Resilience, Shooting, Tackling, Arial Ability, Saving, Handling`

**Notes:**

- "Arial Ability" is a typo for "Aerial Ability" — must map to `aerialAbility`
- Saving/Handling are empty for outfield players (map to 0)
- No jersey number column — assigned sequentially (GK=1, rest 2–11)
- Team values: "Cozmos" / "CITY" / "Crew" / "Xolos" / "FA" → normalized to TeamId

---

## PlayerPiece Type Shape

### Core fields

| Option                                                  | Description                                                                        | Selected |
| ------------------------------------------------------- | ---------------------------------------------------------------------------------- | -------- |
| Add firstName, lastName, number to PlayerPiece          | Replace name: string with separate fields. All consumers get real player identity. | ✓        |
| Add number, split name on display only                  | Keep name: string (full name), add number: number. Fragile for multi-word names.   |          |
| Add firstName, lastName, number + keep name as fallback | Most defensive but redundant.                                                      |          |

**User's choice:** Add `firstName`, `lastName`, `number` — clean split with no fallback.

---

### Nationality & name field fate

| Option                                                            | Description                                            | Selected |
| ----------------------------------------------------------------- | ------------------------------------------------------ | -------- |
| Drop name, add firstName + lastName + number only                 | Nationality not in PlayerPiece.                        |          |
| Drop name, add firstName + lastName + number + nationality        | Remove name, add all four fields.                      | ✓        |
| Keep name as full display name, add firstName + lastName + number | Keeps name for existing code — reduces refactor scope. |          |

**User's choice:** Drop `name`, add `firstName`, `lastName`, `number`, `nationality`. Full type replacement.

---

### Jersey number assignment

| Option                                        | Description                                                        | Selected |
| --------------------------------------------- | ------------------------------------------------------------------ | -------- |
| Sequential by position within each team squad | GK=#1, then DEF/MID/FWD/ST numbered 2–11 in squad order.           | ✓        |
| Preserve current 1-based piece index          | number = piece index + 1, same as MiniTokenBadge derivation today. |          |
| I'll specify numbers per player               | Manual control — mapping provided separately.                      |          |

**User's choice:** Sequential by position.

---

## Team Selection Flow

### Screen placement

| Option                                                  | Description                                                                                                         | Selected |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | -------- |
| New TEAM_SELECTION screen — server gates the game start | Add Screen = 'TEAM_SELECTION'. Server emits team:selection-start instead of game state. Server enforces turn order. | ✓        |
| Extend WAITING screen with in-place selection UI        | No new Screen. Both-ready event triggers selection panel client-side.                                               |          |
| LOBBY game phase before KICK_OFF                        | Add LOBBY to GameState. buildInitialGameState creates LOBBY state; handler transitions to KICK_OFF.                 |          |

**User's choice:** New TEAM_SELECTION screen with server-gated flow.

---

### Away player experience during home's pick

| Option                                                                | Description                                                                                                 | Selected |
| --------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | -------- |
| Both see 4 team cards; home active, away disabled until home confirms | Same layout. Away sees greyed cards. After home picks, chosen team struck-out, 3 remaining active for away. | ✓        |
| Home sees picker; away sees waiting message                           | Different UI states per player.                                                                             |          |
| Sequential reveal — both see current turn's picker                    | Away can't interact at all during home's turn.                                                              |          |

**User's choice:** Both see 4 cards simultaneously; interactivity differs by turn.

---

### Team card contents

**User's choice (free text):** "badge (large) use the -full image for the team + Team name + primary color accent"

**Notes:** Full-size badge images (`{teamid}-full.png`) already present in repo as untracked files. Regular `{teamid}.png` continues in scoreboard. Primary color accent on card border/background tint.

---

## Selected Teams in State

### Where selectedTeams lives

| Option                                                               | Description                                                                                         | Selected |
| -------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- | -------- |
| In GameState (server-authoritative)                                  | Add selectedTeams to GameState. Every snapshot carries it. Aligns with server-authoritative design. | ✓        |
| In a separate pre-game room field, then embedded in initial snapshot | Room stores selections temporarily; buildInitialGameState receives them as param.                   |          |
| Client-only (Zustand store)                                          | Server emits events; clients update local store. Riskier for reconnection.                          |          |

**User's choice:** In GameState — server-authoritative, full-snapshot broadcast.

---

### TEAM_DEFAULTS replacement

| Option                                             | Description                                                                      | Selected |
| -------------------------------------------------- | -------------------------------------------------------------------------------- | -------- |
| Read gameState.selectedTeams from Zustand directly | Delete teamDefaults.ts. Components read s.gameState.selectedTeams[piece.teamId]. |          |
| Keep teamDefaults.ts but hydrate from gameState    | Smaller refactor footprint.                                                      |          |
| Add a Zustand selector abstraction                 | useSelectedTeams() hook.                                                         |          |
| You decide                                         | User deferred to Claude.                                                         | ✓        |

**User's choice:** Deferred to Claude.

---

## Claude's Discretion

- **TEAM_DEFAULTS replacement approach:** Delete `teamDefaults.ts`. Components read `gameState.selectedTeams[piece.teamId]` directly via per-component Zustand selector (`useGameStore(s => s.gameState.selectedTeams)`). No new hook abstraction — consistent with existing per-slice selector pattern.

## Deferred Ideas

- Free Agent selection in future match modes (v2+)
- Real jersey numbers via CSV column (future pass)
- Reconnection during TEAM_SELECTION phase
- Rematch with same teams
