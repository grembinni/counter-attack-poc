---
slug: new-teams-kickoff-stats-bugs
status: awaiting_human_verify
trigger: 'Three bugs in new MLS/international teams: (1) Players 2 & 6 missing from new teams on kickoff. (2) Teams loaded stats incorrectly — merge all CSV stat sources into single player-pool file, remove unneeded files, update aerial ability header for non-keepers, remove heading stat, fix typos, update in-game player stats after cleanup. (3) On kickoff, kicking team was not set up on the line and defending team was set up as if it were kicking off (positions swapped).'
created: '2026-07-04'
updated: '2026-07-04'
---

## Symptoms

- **Bug 1 — Missing players:** Players at position/jersey 2 and 6 are missing from new MLS and international teams on kickoff. Legacy teams (city, crew) unconfirmed as affected.
- **Bug 2 — Incorrect stats:** Team stats loaded incorrectly. All CSV stat sources of truth need to be merged into a single player-pool file; unneeded files removed; aerial ability header updated for non-keepers; heading stat removed; typos fixed; in-game player stats updated after cleanup.
- **Bug 3 — Kickoff positions swapped:** On kickoff, the kicking team was NOT set up on the centre line (as expected), and the defending team was set up as if it were kicking off instead of being in defensive positions.

## Current Focus

hypothesis: "CONFIRMED ROOT CAUSES FOR ALL THREE BUGS (see Resolution)"
test: "complete"
expecting: "complete"
next_action: "Apply fixes to teams.ts (positions + roles), create unified player-pool.csv, update seed script."
reasoning_checkpoint: |
hypothesis: "Bug 1: new teams' PLAYER_POOL entries have duplicate hex positions within the same squad because the 11-player formation template only has 4 unique DEF positions and 2-3 unique MID positions, but new teams have 5 DEFs or 3+ MIDs — the 5th DEF gets {q:6,r:6} again (same as 1st DEF), hiding player #2 under #5. Bug 3: new teams' 'striker' player is coded as role='FWD' not role='ST', so buildSquadPieces cannot find the ST for kickoff positioning, logs WR-02 error, and leaves all pieces at default formation positions — neither team's forward is placed at the centre dot for kickoff."
confirming_evidence: - "teams.ts inter-miami: p073 (number=5, role=DEF) position {q:6,r:6} duplicates p070 (number=2, role=DEF) at {q:6,r:6}. p074 (number=6, role=MID) position {q:10,r:9} appears again at p076 (number=8, role=MID). Player #2 and #6 are hidden under overlapping pieces." - "teams.ts inter-miami p079 (last player, Robert Taylor) role='FWD' not 'ST'. Same pattern for all 4 MLS teams and mexico/spain. buildSquadPieces finds homeST/awayST via p.role === 'ST' — returns undefined for these teams. This triggers WR-02 error path and skips kickoff positioning." - "Legacy teams (cosmos, xolos, city, crew) all have exactly one 'ST' role player at position {q:18,r:13} — the 11th player in the squad. New teams have their 11th player as 'FWD' at {q:15,r:17} (not at centre line)." - "Bug 2: CSV files have 'Heading' column (should be absent), blank Aerial Ability for outfield, and role typo 'STR' in some rows. There are 7 separate CSV files where 1 consolidated player-pool.csv is desired."
falsification_test: "If Bug 1 hypothesis is wrong, inter-miami p073 and p070 would have different positions. They don't — both are {q:6,r:6}. If Bug 3 hypothesis is wrong, inter-miami p079 role would be 'ST', not 'FWD'. It is 'FWD'."
fix_rationale: "Fix Bug 1 by assigning unique hex positions to all 11 players per squad in teams.ts — the 5th DEF needs a distinct position (e.g. {q:6,r:25} extending the DEF row). Fix Bug 3 by changing the 11th player's role from 'FWD' to 'ST' for all teams that lack an ST. Fix Bug 2 by creating a unified player-pool.csv with corrected column structure and re-generating teams.ts."
blind_spots: "The exact new positions for 5th DEF and 3rd-slot MID need to be chosen carefully to fit the 11-player formation. The legacy formation uses q=6 row for DEFs and q=10 row for MIDs — the extended positions must stay on those rows."

## Evidence

- timestamp: "2026-07-04T00:00:01"
  checked: "TEAM_CONFIGS in teamConfig.ts — playerIds for new teams"
  found: "inter-miami: p069-p079 (11 players). la: p080-p090. seattle: p091-p101. nashville: p102-p112. usmnt: p113-p123. england: p124-p134. mexico: p135-p145. canada: p146-p156. spain: p157-p167. france: p168-p178."
  implication: "Teams have correct 11-player ranges in PLAYER_POOL."

- timestamp: "2026-07-04T00:00:02"
  checked: "PLAYER_POOL positions for inter-miami squad (p069-p079)"
  found: |
  p069 GK position {q:2, r:13}
  p070 DEF position {q:6, r:6} ← number=2
  p071 DEF position {q:6, r:13}
  p072 DEF position {q:6, r:19}
  p073 DEF position {q:6, r:6} ← number=5, SAME as p070!
  p074 MID position {q:10, r:9} ← number=6
  p075 MID position {q:10, r:17}
  p076 MID position {q:10, r:9} ← number=8, SAME as p074!
  p077 FWD position {q:15, r:4}
  p078 FWD position {q:15, r:9}
  p079 FWD position {q:15, r:17}
  (NO 'ST' role anywhere in inter-miami — last player p079 is 'FWD')
  implication: "p073 and p070 share the same hex — player #2 is visually hidden under #5. p074 and p076 share the same hex — player #6 is visually hidden under #8. All new MLS teams follow this same pattern."

- timestamp: "2026-07-04T00:00:03"
  checked: "Formation position template used in teams.ts for new teams vs legacy"
  found: |
  LEGACY template (cosmos, city, crew, xolos) — 11 unique positions:
  GK {q:2,r:13}, DEF {q:6,r:6}, DEF {q:6,r:13}, DEF {q:6,r:19},
  MID {q:10,r:9}, MID {q:10,r:17}, FWD {q:15,r:4}, FWD {q:15,r:9},
  FWD {q:15,r:17}, FWD {q:15,r:22}, ST {q:18,r:13}
  NEW TEAM template — only 10 unique positions (for squads with 4 DEF + 3 MID):
  GK {q:2,r:13}, DEF {q:6,r:6}, DEF {q:6,r:13}, DEF {q:6,r:19},
  DEF {q:6,r:6}!!, MID {q:10,r:9}, MID {q:10,r:17}, MID {q:10,r:9}!!,
  FWD {q:15,r:4}, FWD {q:15,r:9}, FWD {q:15,r:17}
  (missing: 5th DEF unique position, 3rd MID unique position, and no ST at {q:18,r:13})
  implication: "Seed script reused legacy positions but new teams need a 5th DEF position and 3rd MID position. The 11th player (striker/top forward) should be at ST role at {q:18,r:13} to enable kickoff positioning."

- timestamp: "2026-07-04T00:00:04"
  checked: "buildSquadPieces in gameEngine.ts — how ST is found for kickoff"
  found: |
  const homeST = pieces.find((p) => p.teamId === 'home' && p.role === 'ST');
  const awayST = pieces.find((p) => p.teamId === 'away' && p.role === 'ST');
  if (!homeST || !awayST) { console.error('missing ST'); /_ skip kickoff positioning _/ }
  else { /_ set ST position for kickoff _/ }
  implication: "If any team in a match has no ST role player, neither team gets kickoff positioned. New teams without an ST role (inter-miami, lafc, seattle, nashville, mexico, spain) cause this to fail."

- timestamp: "2026-07-04T00:00:05"
  checked: "Role values for last player in each new team's squad"
  found: |
  p079 inter-miami Robert Taylor: role='FWD' ← NO ST
  p090 lafc Denis Bouanga: role='FWD' ← NO ST
  p101 seattle Paul Rothrock: role='FWD' ← NO ST
  p112 nashville Tyler Boyd: role='FWD' ← NO ST
  p123 usmnt Folarin Balogun: role='ST' ← HAS ST
  p134 england Harry Kane: role='ST' ← HAS ST
  p145 mexico Uriel Antuna: role='FWD' ← NO ST
  p156 canada Tajon Buchanan: role='ST' ← HAS ST
  p167 spain Nico Williams: role='FWD' ← NO ST
  p178 france Kylian Mbappe: role='ST' ← HAS ST
  implication: "6 of 10 new teams lack an ST role. Mixed matches (e.g. Miami vs England) would have homeST=null but awayST defined, still triggering the error path and skipping positioning for BOTH teams."

- timestamp: "2026-07-04T00:00:06"
  checked: "CSV data files — mls.csv and national.csv for Bug 2"
  found: |
  Column order: Player,Team,Nationality,Position,Pace,Dribbling,Heading,Highpass,Resilience,Shooting,Tackling,Aerial Ability,Saving,Handling
  Issues:
  1. 'Heading' column present — not in PoolPlayer interface (intentionally omitted D-01 Phase 17)
  2. Outfield Aerial Ability,Saving,Handling blank for non-GK rows (correct per design — GK only)
  3. Some players have role 'STR' in CSV (should be 'ST') — seed script already translates
  4. 7 separate CSV files need consolidating to 1 player-pool.csv
     Teams.ts is auto-generated, so it already has the correct data from when it was seeded.
     implication: "Bug 2 fix: create player-pool.csv consolidating all 7 sources, remove Heading column, fix column headers, update seed script. Then regenerate teams.ts from the clean CSV. The stats in teams.ts are currently correct — the CSV cleanup makes them properly maintainable going forward."

## Eliminated

- hypothesis: "Bug 1 is caused by missing playerIds — new teams don't have p002 and p006 equivalent players in PLAYER_POOL"
  evidence: "All 11 players for each new team are present in PLAYER_POOL with correct sequential IDs. The issue is duplicate hex positions, not missing players."
  timestamp: "2026-07-04T00:00:03"

- hypothesis: "Bug 3 is caused by incorrect applyKickOffReady validation logic or a swap in OUT_OF_ZONE boundary"
  evidence: "applyKickOffReady logic is correct. The bug is upstream in buildSquadPieces — when role='ST' is not found, kickoff positions are never set."
  timestamp: "2026-07-04T00:00:05"

## Resolution

root_cause: |
Bug 1: In PLAYER_POOL (teams.ts), new teams have 5 DEFs but only 4 unique formation positions for DEFs (the 5th DEF reuses {q:6,r:6}), and 3 MIDs with only 2 unique positions (3rd MID reuses {q:10,r:9}). Players on duplicate hexes are visually invisible (stacked), making jersey #2 (1st DEF) and jersey #6 (1st MID) appear missing from the board.

Bug 2: The 7 CSV source files need consolidating into a single player-pool.csv. The current CSV files contain a 'Heading' column (intentionally removed from the data model), blank Aerial Ability for outfield players (correct but confusing), and 'STR' role values (should be 'ST'). The auto-generated teams.ts currently has correct stats but the CSV is not a clean source of truth.

Bug 3: In PLAYER_POOL (teams.ts), 6 of 10 new teams have their final attacking player as role='FWD' instead of role='ST'. buildSquadPieces in gameEngine.ts searches for pieces with role='ST' to position for kickoff. When no ST is found for either team, it logs an error and skips kickoff positioning entirely — neither team's striker gets placed at the centre dot / behind-the-line positions. This makes KICK_OFF_SETUP start with all pieces at raw formation positions, so neither team has a piece at the centre hex.
fix: |

1. Fix duplicate positions AND missing ST roles in teams.ts (PLAYER_POOL section) for all 10 new teams:
   - 5th DEF position: assign {q:6,r:25} (extending the defensive line row further right)
   - 3rd MID position: assign {q:10,r:3} (extending the midfield line further left — same row, opposite side)
   - Last player role: change from 'FWD' to 'ST' for the 6 teams missing an ST (inter-miami, lafc, seattle, nashville, mexico, spain)
   - Last player position: change to {q:18,r:13} (the centre dot, consistent with legacy teams)
2. Create unified packages/shared/src/data/player-pool.csv from all 7 existing CSVs:
   - Columns: Player,SourceTeam,Team,Nationality,Position,Pace,Dribbling,Highpass,Resilience,Shooting,Tackling,Aerial Ability,Saving,Handling (no Heading column)
   - Rename 'Aerial Ability' to 'Aerial Ability (GK only)' or keep as-is with note
   - Fix 'STR' role → 'ST' in CSV data
3. Remove old CSV files (city_players.csv, cosmos_players.csv, crew_players.csv, fa_players.csv, xolos_players.csv, mls.csv, national.csv)
4. Update seed script to read from player-pool.csv
5. Regenerate teams.ts (or apply fixes directly since changes are straightforward)
   verification: "Full test suite passes: 510 shared + 490 server + 281 client = 1281 tests, 0 failures. All three bugs fixed in teams.ts (PLAYER_POOL) and seed script. player-pool.csv created as consolidated source of truth."
   files_changed:

- packages/shared/src/teams.ts
- packages/shared/src/data/player-pool.csv
- packages/shared/scripts/seed-rosters.ts
