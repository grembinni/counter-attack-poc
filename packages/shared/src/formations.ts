/** Formation system for Counter Attack.
 * Defines the 4 formation identifiers, slot roles, slot data, and the FORMATIONS registry.
 * No React/JSX imports — shared package must not reference the JSX runtime.
 * Phase 23 D-13: FormationId, SlotRole, FormationSlot, FORMATIONS.
 */

import type { HexCoord } from './types.js';

/** 4-member string union of all supported formation identifiers. Phase 23 D-13. */
export type FormationId = '4-4-2' | '5-3-2' | '4-3-3' | '3-4-3';

/** Role of a formation slot — drives Phase 24 auto-assignment scoring weights. Phase 23 D-13. */
export type SlotRole =
  | 'GK'
  | 'DEF-center'
  | 'DEF-back'
  | 'MID-central'
  | 'MID-wing'
  | 'FWD-central'
  | 'FWD-wing';

/** A single player slot within a formation. Phase 23 D-13.
 * `position` is the home-side hex coordinate; away positions are mirrored at runtime (q_away = 36 - q_home).
 * `jerseyNumber` is the tactical jersey number assigned to this slot (1–11 per D-14). */
export interface FormationSlot {
  /** Standard football abbreviation, e.g. 'GK', 'RB', 'RCB', 'CM', 'ST'. */
  slotId: string;
  slotRole: SlotRole;
  /** Home-side hex coordinate. Away mirror applied in buildSquadPieces. */
  position: HexCoord;
  /** Tactical jersey number 1–11, unique within formation. D-14. */
  jerseyNumber: number;
}

/**
 * FORMATIONS registry — 4 formations × 11 slots = 44 hand-authored slot positions.
 * Slot index 0 is always GK at { q: 2, r: 13 }.
 * Positions are home-side; away mirror (q_away = 36 - q_home) is applied in buildSquadPieces.
 * Mutation is prevented via `readonly FormationSlot[]`; T-23-01.
 * Phase 23 D-01 through D-04 for hex positions, D-14 for jersey numbers.
 */
export const FORMATIONS = {
  '4-4-2': {
    description: 'Balanced. Compact midfield with two mobile strikers.',
    slots: [
      { slotId: 'GK', slotRole: 'GK', position: { q: 2, r: 13 }, jerseyNumber: 1 },
      { slotId: 'RB', slotRole: 'DEF-back', position: { q: 6, r: 5 }, jerseyNumber: 2 },
      { slotId: 'RCB', slotRole: 'DEF-center', position: { q: 6, r: 10 }, jerseyNumber: 4 },
      { slotId: 'LCB', slotRole: 'DEF-center', position: { q: 6, r: 16 }, jerseyNumber: 5 },
      { slotId: 'LB', slotRole: 'DEF-back', position: { q: 6, r: 21 }, jerseyNumber: 3 },
      { slotId: 'RM', slotRole: 'MID-wing', position: { q: 10, r: 5 }, jerseyNumber: 7 },
      { slotId: 'RCM', slotRole: 'MID-central', position: { q: 10, r: 10 }, jerseyNumber: 6 },
      { slotId: 'LCM', slotRole: 'MID-central', position: { q: 10, r: 16 }, jerseyNumber: 8 },
      { slotId: 'LM', slotRole: 'MID-wing', position: { q: 10, r: 21 }, jerseyNumber: 11 },
      { slotId: 'RF', slotRole: 'FWD-wing', position: { q: 14, r: 9 }, jerseyNumber: 10 },
      { slotId: 'ST', slotRole: 'FWD-central', position: { q: 14, r: 17 }, jerseyNumber: 9 },
    ] as readonly FormationSlot[],
  },
  '5-3-2': {
    description: 'Defensive. Five-man backline with narrow midfield.',
    slots: [
      { slotId: 'GK', slotRole: 'GK', position: { q: 2, r: 13 }, jerseyNumber: 1 },
      { slotId: 'RB', slotRole: 'DEF-back', position: { q: 8, r: 5 }, jerseyNumber: 2 },
      { slotId: 'RCB', slotRole: 'DEF-center', position: { q: 6, r: 9 }, jerseyNumber: 4 },
      { slotId: 'CB', slotRole: 'DEF-center', position: { q: 6, r: 13 }, jerseyNumber: 6 },
      { slotId: 'LCB', slotRole: 'DEF-center', position: { q: 6, r: 17 }, jerseyNumber: 5 },
      { slotId: 'LB', slotRole: 'DEF-back', position: { q: 8, r: 21 }, jerseyNumber: 3 },
      { slotId: 'RCM', slotRole: 'MID-central', position: { q: 10, r: 6 }, jerseyNumber: 8 },
      { slotId: 'CM', slotRole: 'MID-central', position: { q: 10, r: 13 }, jerseyNumber: 7 },
      { slotId: 'LCM', slotRole: 'MID-central', position: { q: 10, r: 19 }, jerseyNumber: 11 },
      { slotId: 'RF', slotRole: 'FWD-wing', position: { q: 14, r: 9 }, jerseyNumber: 10 },
      { slotId: 'ST', slotRole: 'FWD-central', position: { q: 14, r: 17 }, jerseyNumber: 9 },
    ] as readonly FormationSlot[],
  },
  '4-3-3': {
    description: 'Attacking. Three forwards press high and stretch the defence.',
    slots: [
      { slotId: 'GK', slotRole: 'GK', position: { q: 2, r: 13 }, jerseyNumber: 1 },
      { slotId: 'RB', slotRole: 'DEF-back', position: { q: 6, r: 5 }, jerseyNumber: 2 },
      { slotId: 'RCB', slotRole: 'DEF-center', position: { q: 6, r: 10 }, jerseyNumber: 4 },
      { slotId: 'LCB', slotRole: 'DEF-center', position: { q: 6, r: 16 }, jerseyNumber: 5 },
      { slotId: 'LB', slotRole: 'DEF-back', position: { q: 6, r: 21 }, jerseyNumber: 3 },
      { slotId: 'RCM', slotRole: 'MID-central', position: { q: 10, r: 6 }, jerseyNumber: 8 },
      { slotId: 'CM', slotRole: 'MID-central', position: { q: 10, r: 13 }, jerseyNumber: 6 },
      { slotId: 'LCM', slotRole: 'MID-central', position: { q: 10, r: 19 }, jerseyNumber: 7 },
      { slotId: 'RF', slotRole: 'FWD-wing', position: { q: 14, r: 6 }, jerseyNumber: 10 },
      { slotId: 'ST', slotRole: 'FWD-central', position: { q: 14, r: 13 }, jerseyNumber: 9 },
      { slotId: 'LF', slotRole: 'FWD-wing', position: { q: 14, r: 19 }, jerseyNumber: 11 },
    ] as readonly FormationSlot[],
  },
  '3-4-3': {
    description: 'High press. Midfield dominance with a three-man attack.',
    slots: [
      { slotId: 'GK', slotRole: 'GK', position: { q: 2, r: 13 }, jerseyNumber: 1 },
      { slotId: 'RB', slotRole: 'DEF-back', position: { q: 6, r: 6 }, jerseyNumber: 2 },
      { slotId: 'CB', slotRole: 'DEF-center', position: { q: 6, r: 13 }, jerseyNumber: 4 },
      { slotId: 'LB', slotRole: 'DEF-back', position: { q: 6, r: 19 }, jerseyNumber: 3 },
      { slotId: 'RM', slotRole: 'MID-wing', position: { q: 10, r: 5 }, jerseyNumber: 7 },
      { slotId: 'RCM', slotRole: 'MID-central', position: { q: 10, r: 10 }, jerseyNumber: 6 },
      { slotId: 'LCM', slotRole: 'MID-central', position: { q: 10, r: 16 }, jerseyNumber: 8 },
      { slotId: 'LM', slotRole: 'MID-wing', position: { q: 10, r: 21 }, jerseyNumber: 11 },
      { slotId: 'RF', slotRole: 'FWD-wing', position: { q: 14, r: 6 }, jerseyNumber: 10 },
      { slotId: 'ST', slotRole: 'FWD-central', position: { q: 14, r: 13 }, jerseyNumber: 9 },
      { slotId: 'LF', slotRole: 'FWD-wing', position: { q: 14, r: 19 }, jerseyNumber: 5 },
    ] as readonly FormationSlot[],
  },
} satisfies Record<FormationId, { slots: readonly FormationSlot[]; description: string }>;
