import type { PlayerPiece } from './types.js';

// Hardcoded squads on the 1-6 attribute scale (D-01, D-03 — Phase 8.1).
// Formation: 3-2-4-1 (3 DEF, 2 MID, 4 FWD, 1 ST).
// Role conventions (all role-relevant attributes in [1,6]):
//   GK:  high Saving (5–6) / Handling (5–6) / AerialAbility (4–6); moderate Pace (2–3) / Resilience (4–5)
//        highPass: 0 (D-04: GKs use GK kick accuracy rule, not highPass attribute)
//        shooting: 1 (minimum valid — GKs can technically shoot)
//   DEF: high Tackling (5–6); moderate Pace/Heading/Resilience (4–6); low Shooting (2–4)
//        saving: 0, handling: 0, aerialAbility: 0 (GK-only, 0 = not applicable)
//        highPass: 2–4 (adjusted 1-6 range per Pitfall 7)
//   MID: balanced across all outfield attributes (4–6)
//        saving: 0, handling: 0, aerialAbility: 0
//        highPass: 3–5
//   FWD: high Pace (5–6) / Shooting (5–6); low Tackling (1–4)
//        saving: 0, handling: 0, aerialAbility: 0
//        highPass: 3–5
//   ST:  striker — same attribute profile as FWD; positional special case only
//        saving: 0, handling: 0, aerialAbility: 0
//        highPass: 2–5
//
// Tier distribution per squad: 1/2/3/3/2 (Tier 1=34+, Tier 2=32-33, Tier 3=30-31,
//   Tier 4=28-29, Tier 5=26-27). D-03. Tier total = sum of all 9 ATTRS (D-02).
//
// Starting positions use the real 37×26 board (q 0–36, r 0–25). D-01 (Phase 7.1).
// Home half: GK q=1, DEF q=6, MID q=10, FWD q=15, ST q=18 (kickoff) or q=15 (defending).
// Away mirrors (within the MATCH-06 q∈[6,20] band for DEF/MID):
//   Away DEF q=20 (band max, mirroring home DEF at band min q=6).
//   Away MID q=16 (band mirror of home MID: 6+20-10=16).
//   Away FWD q=21, Away GK q=35.
// r-values: DEF r=4,13,22  MID r=9,17  FWD r=4,9,17,22  ST r=13 (centre or edge of circle).
// MATCH-06 / D-01 (Phase 14): All DEF and MID pieces must start with q∈[6,20] (inclusive).
//   This applies to both initial placement (buildInitialGameState) and half-time reset
//   (applyHalfTimeStart), since both read the same HOME_SQUAD/AWAY_SQUAD source.
// ST position is overridden in buildInitialGameState based on the coin-flip result:
//   attacking ST → {q:18,r:13} (kickoff hex); defending ST → {q:14,r:13} or {q:22,r:13} (just outside circle).

/** Home squad: 11 players, ids 'home-0'..'home-10'. TEAM-01, TEAM-02.
 *  3-2-4-1 formation.
 *  Tier distribution: T1=home-1(DEF), T2=home-0(GK)+home-5(MID),
 *  T3=home-2(DEF)+home-6(MID)+home-8(FWD), T4=home-3(DEF)+home-7(FWD)+home-9(FWD),
 *  T5=home-4(ST)+home-10(FWD). D-03.
 */
export const HOME_SQUAD: readonly PlayerPiece[] = [
  {
    // Tier 2 GK — total: 2+1+3+2+3+6+6+5+5 = 33
    id: 'home-0',
    teamId: 'home',
    name: 'Home GK',
    role: 'GK',
    position: { q: 1, r: 13 },
    pace: 2,
    shooting: 1,
    tackling: 3,
    dribbling: 2,
    heading: 3,
    saving: 6,
    handling: 6,
    resilience: 5,
    aerialAbility: 5,
    highPass: 0, // D-04: GKs use GK kick accuracy rule, not highPass attribute
  },
  {
    // Tier 1 DEF — total: 6+5+6+5+6+0+0+6+0 = 34
    id: 'home-1',
    teamId: 'home',
    name: 'Home DEF 1',
    role: 'DEF',
    position: { q: 6, r: 4 },
    pace: 6,
    shooting: 5,
    tackling: 6,
    dribbling: 5,
    heading: 6,
    saving: 0,
    handling: 0, // D-06: outfielders have handling: 0
    resilience: 6,
    aerialAbility: 0, // D-05: outfielders have aerialAbility: 0
    highPass: 3, // DEF range 2–4
  },
  {
    // Tier 3 DEF — total: 5+3+6+4+6+0+0+6+0 = 30
    id: 'home-2',
    teamId: 'home',
    name: 'Home DEF 2',
    role: 'DEF',
    position: { q: 6, r: 13 },
    pace: 5,
    shooting: 3,
    tackling: 6,
    dribbling: 4,
    heading: 6,
    saving: 0,
    handling: 0, // D-06
    resilience: 6,
    aerialAbility: 0, // D-05
    highPass: 3, // DEF range 2–4
  },
  {
    // Tier 4 DEF — total: 5+3+5+4+6+0+0+5+0 = 28
    id: 'home-3',
    teamId: 'home',
    name: 'Home DEF 3',
    role: 'DEF',
    position: { q: 6, r: 22 },
    pace: 5,
    shooting: 3,
    tackling: 5,
    dribbling: 4,
    heading: 6,
    saving: 0,
    handling: 0, // D-06
    resilience: 5,
    aerialAbility: 0, // D-05
    highPass: 3, // DEF range 2–4
  },
  {
    // Tier 5 ST — total: 4+3+5+3+6+0+0+5+0 = 26
    // Position overridden in buildInitialGameState: kickoff hex if attacking, home-side circle edge if defending.
    id: 'home-4',
    teamId: 'home',
    name: 'Home ST',
    role: 'ST',
    position: { q: 18, r: 13 }, // default: attacking (kickoff hex); overridden by coin flip
    pace: 4,
    shooting: 3,
    tackling: 5,
    dribbling: 3,
    heading: 6,
    saving: 0,
    handling: 0, // D-06
    resilience: 5,
    aerialAbility: 0, // D-05
    highPass: 2, // ST range 2–5
  },
  {
    // Tier 2 MID — total: 5+5+5+6+6+0+0+5+0 = 32
    id: 'home-5',
    teamId: 'home',
    name: 'Home MID 1',
    role: 'MID',
    position: { q: 10, r: 9 },
    pace: 5,
    shooting: 5,
    tackling: 5,
    dribbling: 6,
    heading: 6,
    saving: 0,
    handling: 0, // D-06
    resilience: 5,
    aerialAbility: 0, // D-05
    highPass: 5, // MID range 3–5
  },
  {
    // Tier 3 MID — total: 5+5+5+5+5+0+0+5+0 = 30
    id: 'home-6',
    teamId: 'home',
    name: 'Home MID 2',
    role: 'MID',
    position: { q: 10, r: 17 },
    pace: 5,
    shooting: 5,
    tackling: 5,
    dribbling: 5,
    heading: 5,
    saving: 0,
    handling: 0, // D-06
    resilience: 5,
    aerialAbility: 0, // D-05
    highPass: 4, // MID range 3–5
  },
  {
    // Tier 4 FWD — total: 5+4+5+5+4+0+0+5+0 = 28
    id: 'home-7',
    teamId: 'home',
    name: 'Home FWD 1',
    role: 'FWD',
    position: { q: 15, r: 4 },
    pace: 5,
    shooting: 4,
    tackling: 5,
    dribbling: 5,
    heading: 4,
    saving: 0,
    handling: 0, // D-06
    resilience: 5,
    aerialAbility: 0, // D-05
    highPass: 3, // FWD range 3–5
  },
  {
    // Tier 3 FWD — total: 6+6+2+6+5+0+0+5+0 = 30
    id: 'home-8',
    teamId: 'home',
    name: 'Home FWD 2',
    role: 'FWD',
    position: { q: 15, r: 9 },
    pace: 6,
    shooting: 6,
    tackling: 2,
    dribbling: 6,
    heading: 5,
    saving: 0,
    handling: 0, // D-06
    resilience: 5,
    aerialAbility: 0, // D-05
    highPass: 4, // FWD range 3–5
  },
  {
    // Tier 4 FWD — total: 5+6+2+5+5+0+0+5+0 = 28
    id: 'home-9',
    teamId: 'home',
    name: 'Home FWD 3',
    role: 'FWD',
    position: { q: 15, r: 17 },
    pace: 5,
    shooting: 6,
    tackling: 2,
    dribbling: 5,
    heading: 5,
    saving: 0,
    handling: 0, // D-06
    resilience: 5,
    aerialAbility: 0, // D-05
    highPass: 4, // FWD range 3–5
  },
  {
    // Tier 5 FWD — total: 5+5+2+5+4+0+0+5+0 = 26
    id: 'home-10',
    teamId: 'home',
    name: 'Home FWD 4',
    role: 'FWD',
    position: { q: 15, r: 22 },
    pace: 5,
    shooting: 5,
    tackling: 2,
    dribbling: 5,
    heading: 4,
    saving: 0,
    handling: 0, // D-06
    resilience: 5,
    aerialAbility: 0, // D-05
    highPass: 3, // FWD range 3–5
  },
];

/** Away squad: 11 players, ids 'away-0'..'away-10'. TEAM-01, TEAM-02.
 *  3-2-4-1 formation.
 *  Tier distribution: T1=away-8(FWD), T2=away-1(DEF)+away-5(MID),
 *  T3=away-0(GK)+away-2(DEF)+away-6(MID), T4=away-3(DEF)+away-7(FWD)+away-9(FWD),
 *  T5=away-4(ST)+away-10(FWD). D-03.
 */
export const AWAY_SQUAD: readonly PlayerPiece[] = [
  {
    // Tier 3 GK — total: 2+1+3+2+3+6+5+4+5 = 31
    id: 'away-0',
    teamId: 'away',
    name: 'Away GK',
    role: 'GK',
    position: { q: 35, r: 13 },
    pace: 2,
    shooting: 1,
    tackling: 3,
    dribbling: 2,
    heading: 3,
    saving: 6,
    handling: 5,
    resilience: 4,
    aerialAbility: 5,
    highPass: 0, // D-04: GKs have highPass: 0
  },
  {
    // Tier 2 DEF — total: 5+4+6+5+6+0+0+6+0 = 32
    id: 'away-1',
    teamId: 'away',
    name: 'Away DEF 1',
    role: 'DEF',
    position: { q: 20, r: 4 },
    pace: 5,
    shooting: 4,
    tackling: 6,
    dribbling: 5,
    heading: 6,
    saving: 0,
    handling: 0, // D-06
    resilience: 6,
    aerialAbility: 0, // D-05
    highPass: 4, // DEF range 2–4
  },
  {
    // Tier 3 DEF — total: 5+3+6+4+6+0+0+6+0 = 30
    id: 'away-2',
    teamId: 'away',
    name: 'Away DEF 2',
    role: 'DEF',
    position: { q: 20, r: 13 },
    pace: 5,
    shooting: 3,
    tackling: 6,
    dribbling: 4,
    heading: 6,
    saving: 0,
    handling: 0, // D-06
    resilience: 6,
    aerialAbility: 0, // D-05
    highPass: 3, // DEF range 2–4
  },
  {
    // Tier 4 DEF — total: 5+3+5+4+6+0+0+5+0 = 28
    id: 'away-3',
    teamId: 'away',
    name: 'Away DEF 3',
    role: 'DEF',
    position: { q: 20, r: 22 },
    pace: 5,
    shooting: 3,
    tackling: 5,
    dribbling: 4,
    heading: 6,
    saving: 0,
    handling: 0, // D-06
    resilience: 5,
    aerialAbility: 0, // D-05
    highPass: 3, // DEF range 2–4
  },
  {
    // Tier 5 ST — total: 4+3+5+3+6+0+0+5+0 = 26
    // Position overridden in buildInitialGameState: kickoff hex if attacking, away-side circle edge if defending.
    id: 'away-4',
    teamId: 'away',
    name: 'Away ST',
    role: 'ST',
    position: { q: 22, r: 13 }, // default: defending (away-side, just outside centre circle); overridden by coin flip
    pace: 4,
    shooting: 3,
    tackling: 5,
    dribbling: 3,
    heading: 6,
    saving: 0,
    handling: 0, // D-06
    resilience: 5,
    aerialAbility: 0, // D-05
    highPass: 2, // ST range 2–5
  },
  {
    // Tier 2 MID — total: 6+5+5+6+5+0+0+5+0 = 32
    id: 'away-5',
    teamId: 'away',
    name: 'Away MID 1',
    role: 'MID',
    position: { q: 16, r: 9 },
    pace: 6,
    shooting: 5,
    tackling: 5,
    dribbling: 6,
    heading: 5,
    saving: 0,
    handling: 0, // D-06
    resilience: 5,
    aerialAbility: 0, // D-05
    highPass: 5, // MID range 3–5
  },
  {
    // Tier 3 MID — total: 5+5+5+5+5+0+0+5+0 = 30
    id: 'away-6',
    teamId: 'away',
    name: 'Away MID 2',
    role: 'MID',
    position: { q: 16, r: 17 },
    pace: 5,
    shooting: 5,
    tackling: 5,
    dribbling: 5,
    heading: 5,
    saving: 0,
    handling: 0, // D-06
    resilience: 5,
    aerialAbility: 0, // D-05
    highPass: 4, // MID range 3–5
  },
  {
    // Tier 4 FWD — total: 5+4+4+5+5+0+0+5+0 = 28
    id: 'away-7',
    teamId: 'away',
    name: 'Away FWD 1',
    role: 'FWD',
    position: { q: 21, r: 4 },
    pace: 5,
    shooting: 4,
    tackling: 4,
    dribbling: 5,
    heading: 5,
    saving: 0,
    handling: 0, // D-06
    resilience: 5,
    aerialAbility: 0, // D-05
    highPass: 3, // FWD range 3–5
  },
  {
    // Tier 1 FWD — total: 6+6+4+6+6+0+0+6+0 = 34
    id: 'away-8',
    teamId: 'away',
    name: 'Away FWD 2',
    role: 'FWD',
    position: { q: 21, r: 9 },
    pace: 6,
    shooting: 6,
    tackling: 4,
    dribbling: 6,
    heading: 6,
    saving: 0,
    handling: 0, // D-06
    resilience: 6,
    aerialAbility: 0, // D-05
    highPass: 5, // FWD range 3–5
  },
  {
    // Tier 4 FWD — total: 6+5+2+5+5+0+0+5+0 = 28
    id: 'away-9',
    teamId: 'away',
    name: 'Away FWD 3',
    role: 'FWD',
    position: { q: 21, r: 17 },
    pace: 6,
    shooting: 5,
    tackling: 2,
    dribbling: 5,
    heading: 5,
    saving: 0,
    handling: 0, // D-06
    resilience: 5,
    aerialAbility: 0, // D-05
    highPass: 4, // FWD range 3–5
  },
  {
    // Tier 5 FWD — total: 5+5+2+5+4+0+0+5+0 = 26
    id: 'away-10',
    teamId: 'away',
    name: 'Away FWD 4',
    role: 'FWD',
    position: { q: 21, r: 22 },
    pace: 5,
    shooting: 5,
    tackling: 2,
    dribbling: 5,
    heading: 4,
    saving: 0,
    handling: 0, // D-06
    resilience: 5,
    aerialAbility: 0, // D-05
    highPass: 3, // FWD range 3–5
  },
];
