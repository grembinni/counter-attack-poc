import type { PlayerPiece } from './types.js';

// Hardcoded squads for Phase 4. Attribute values use a 1–10 scale with role conventions:
//   GK:  high Saving (8–10) / Handling (7–9); low Pace (2–4) / Shooting (1–2)
//   DEF: high Tackling (7–9); moderate Pace/Heading; low Saving/Handling
//   MID: balanced across all attributes (5–7)
//   FWD: high Pace (7–9) / Shooting (7–9); low Tackling (1–3) / Saving (1)
//
// Starting positions use the real 37×26 board (q 0–36, r 0–25). D-01 (Phase 7.1).
// Home half: GK q=1, DEF q=5, MID q=9-10, FWD q=14-15. Away mirrors: q_away = 36 - q_home.
// r-values spread symmetrically about r=12.5 (board centre) to cover the full pitch height:
//   DEF r=3,8,17,22  MID r=5,13,21  FWD r=9,13,17  GK r=13

/** Home squad: 11 players, ids 'home-0'..'home-10'. TEAM-01, TEAM-02. */
export const HOME_SQUAD: readonly PlayerPiece[] = [
  {
    id: 'home-0',
    teamId: 'home',
    name: 'Home GK',
    role: 'GK',
    position: { q: 1, r: 13 },
    pace: 2,
    shooting: 1,
    tackling: 4,
    dribbling: 3,
    heading: 5,
    saving: 9,
    handling: 8,
    resilience: 7,
    aerialAbility: 8,
    highPass: 0, // D-04: GKs use High Pass rules for kicks via GK kick accuracy (not highPass attribute)
  },
  {
    id: 'home-1',
    teamId: 'home',
    name: 'Home DEF 1',
    role: 'DEF',
    position: { q: 5, r: 3 },
    pace: 5,
    shooting: 3,
    tackling: 8,
    dribbling: 4,
    heading: 7,
    saving: 2,
    handling: 0, // D-06: outfielders have handling: 0
    resilience: 7,
    aerialAbility: 0, // D-05: outfielders have aerialAbility: 0
    highPass: 4, // D-07: DEF range 3–5
  },
  {
    id: 'home-2',
    teamId: 'home',
    name: 'Home DEF 2',
    role: 'DEF',
    position: { q: 5, r: 8 },
    pace: 4,
    shooting: 2,
    tackling: 9,
    dribbling: 3,
    heading: 8,
    saving: 1,
    handling: 0, // D-06
    resilience: 8,
    aerialAbility: 0, // D-05
    highPass: 4, // D-07: DEF range 3–5
  },
  {
    id: 'home-3',
    teamId: 'home',
    name: 'Home DEF 3',
    role: 'DEF',
    position: { q: 5, r: 17 },
    pace: 5,
    shooting: 3,
    tackling: 8,
    dribbling: 4,
    heading: 7,
    saving: 2,
    handling: 0, // D-06
    resilience: 7,
    aerialAbility: 0, // D-05
    highPass: 4, // D-07: DEF range 3–5
  },
  {
    id: 'home-4',
    teamId: 'home',
    name: 'Home DEF 4',
    role: 'DEF',
    position: { q: 5, r: 22 },
    pace: 6,
    shooting: 4,
    tackling: 7,
    dribbling: 5,
    heading: 6,
    saving: 2,
    handling: 0, // D-06
    resilience: 6,
    aerialAbility: 0, // D-05
    highPass: 4, // D-07: DEF range 3–5
  },
  {
    id: 'home-5',
    teamId: 'home',
    name: 'Home MID 1',
    role: 'MID',
    position: { q: 9, r: 5 },
    pace: 6,
    shooting: 5,
    tackling: 6,
    dribbling: 6,
    heading: 5,
    saving: 2,
    handling: 0, // D-06
    resilience: 6,
    aerialAbility: 0, // D-05
    highPass: 6, // D-07: MID range 5–7
  },
  {
    id: 'home-6',
    teamId: 'home',
    name: 'Home MID 2',
    role: 'MID',
    position: { q: 10, r: 13 },
    pace: 7,
    shooting: 6,
    tackling: 5,
    dribbling: 7,
    heading: 5,
    saving: 1,
    handling: 0, // D-06
    resilience: 6,
    aerialAbility: 0, // D-05
    highPass: 7, // D-07: MID range 5–7 (playmaker)
  },
  {
    id: 'home-7',
    teamId: 'home',
    name: 'Home MID 3',
    role: 'MID',
    position: { q: 9, r: 21 },
    pace: 6,
    shooting: 5,
    tackling: 6,
    dribbling: 6,
    heading: 6,
    saving: 2,
    handling: 0, // D-06
    resilience: 7,
    aerialAbility: 0, // D-05
    highPass: 6, // D-07: MID range 5–7
  },
  {
    id: 'home-8',
    teamId: 'home',
    name: 'Home FWD 1',
    role: 'FWD',
    position: { q: 14, r: 9 },
    pace: 8,
    shooting: 7,
    tackling: 2,
    dribbling: 7,
    heading: 5,
    saving: 1,
    handling: 0, // D-06
    resilience: 5,
    aerialAbility: 0, // D-05
    highPass: 5, // D-07: FWD range 4–6
  },
  {
    id: 'home-9',
    teamId: 'home',
    name: 'Home FWD 2',
    role: 'FWD',
    position: { q: 14, r: 13 },
    pace: 9,
    shooting: 9,
    tackling: 1,
    dribbling: 8,
    heading: 6,
    saving: 1,
    handling: 0, // D-06
    resilience: 6,
    aerialAbility: 0, // D-05
    highPass: 5, // D-07: FWD range 4–6
  },
  {
    id: 'home-10',
    teamId: 'home',
    name: 'Home FWD 3',
    role: 'FWD',
    position: { q: 14, r: 17 },
    pace: 8,
    shooting: 8,
    tackling: 2,
    dribbling: 7,
    heading: 5,
    saving: 1,
    handling: 0, // D-06
    resilience: 5,
    aerialAbility: 0, // D-05
    highPass: 5, // D-07: FWD range 4–6
  },
];

/** Away squad: 11 players, ids 'away-0'..'away-10'. TEAM-01, TEAM-02. */
export const AWAY_SQUAD: readonly PlayerPiece[] = [
  {
    id: 'away-0',
    teamId: 'away',
    name: 'Away GK',
    role: 'GK',
    position: { q: 35, r: 13 },
    pace: 3,
    shooting: 1,
    tackling: 5,
    dribbling: 4,
    heading: 6,
    saving: 10,
    handling: 9,
    resilience: 7,
    aerialAbility: 8,
    highPass: 0, // D-04: GKs have highPass: 0
  },
  {
    id: 'away-1',
    teamId: 'away',
    name: 'Away DEF 1',
    role: 'DEF',
    position: { q: 31, r: 3 },
    pace: 5,
    shooting: 3,
    tackling: 8,
    dribbling: 4,
    heading: 7,
    saving: 2,
    handling: 0, // D-06
    resilience: 7,
    aerialAbility: 0, // D-05
    highPass: 4, // D-07: DEF range 3–5
  },
  {
    id: 'away-2',
    teamId: 'away',
    name: 'Away DEF 2',
    role: 'DEF',
    position: { q: 31, r: 8 },
    pace: 4,
    shooting: 2,
    tackling: 9,
    dribbling: 3,
    heading: 8,
    saving: 1,
    handling: 0, // D-06
    resilience: 8,
    aerialAbility: 0, // D-05
    highPass: 4, // D-07: DEF range 3–5
  },
  {
    id: 'away-3',
    teamId: 'away',
    name: 'Away DEF 3',
    role: 'DEF',
    position: { q: 31, r: 17 },
    pace: 5,
    shooting: 3,
    tackling: 8,
    dribbling: 4,
    heading: 7,
    saving: 2,
    handling: 0, // D-06
    resilience: 7,
    aerialAbility: 0, // D-05
    highPass: 4, // D-07: DEF range 3–5
  },
  {
    id: 'away-4',
    teamId: 'away',
    name: 'Away DEF 4',
    role: 'DEF',
    position: { q: 31, r: 22 },
    pace: 6,
    shooting: 4,
    tackling: 7,
    dribbling: 5,
    heading: 6,
    saving: 2,
    handling: 0, // D-06
    resilience: 6,
    aerialAbility: 0, // D-05
    highPass: 4, // D-07: DEF range 3–5
  },
  {
    id: 'away-5',
    teamId: 'away',
    name: 'Away MID 1',
    role: 'MID',
    position: { q: 27, r: 5 },
    pace: 6,
    shooting: 5,
    tackling: 6,
    dribbling: 6,
    heading: 5,
    saving: 2,
    handling: 0, // D-06
    resilience: 6,
    aerialAbility: 0, // D-05
    highPass: 6, // D-07: MID range 5–7
  },
  {
    id: 'away-6',
    teamId: 'away',
    name: 'Away MID 2',
    role: 'MID',
    position: { q: 26, r: 13 },
    pace: 7,
    shooting: 6,
    tackling: 5,
    dribbling: 7,
    heading: 5,
    saving: 1,
    handling: 0, // D-06
    resilience: 6,
    aerialAbility: 0, // D-05
    highPass: 7, // D-07: MID range 5–7 (playmaker)
  },
  {
    id: 'away-7',
    teamId: 'away',
    name: 'Away MID 3',
    role: 'MID',
    position: { q: 27, r: 21 },
    pace: 6,
    shooting: 5,
    tackling: 6,
    dribbling: 6,
    heading: 6,
    saving: 2,
    handling: 0, // D-06
    resilience: 7,
    aerialAbility: 0, // D-05
    highPass: 6, // D-07: MID range 5–7
  },
  {
    id: 'away-8',
    teamId: 'away',
    name: 'Away FWD 1',
    role: 'FWD',
    position: { q: 22, r: 9 },
    pace: 8,
    shooting: 7,
    tackling: 2,
    dribbling: 7,
    heading: 5,
    saving: 1,
    handling: 0, // D-06
    resilience: 5,
    aerialAbility: 0, // D-05
    highPass: 5, // D-07: FWD range 4–6
  },
  {
    id: 'away-9',
    teamId: 'away',
    name: 'Away FWD 2',
    role: 'FWD',
    position: { q: 22, r: 13 },
    pace: 9,
    shooting: 9,
    tackling: 1,
    dribbling: 8,
    heading: 6,
    saving: 1,
    handling: 0, // D-06
    resilience: 6,
    aerialAbility: 0, // D-05
    highPass: 5, // D-07: FWD range 4–6
  },
  {
    id: 'away-10',
    teamId: 'away',
    name: 'Away FWD 3',
    role: 'FWD',
    position: { q: 22, r: 17 },
    pace: 8,
    shooting: 8,
    tackling: 2,
    dribbling: 7,
    heading: 5,
    saving: 1,
    handling: 0, // D-06
    resilience: 5,
    aerialAbility: 0, // D-05
    highPass: 5, // D-07: FWD range 4–6
  },
];
