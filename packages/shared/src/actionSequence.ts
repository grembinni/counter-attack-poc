/**
 * Action sequence eligibility table for Counter Attack.
 *
 * D-07: Phase 8 enforces the full action eligibility table from Counter Attack
 *       rulebook v1.4.1. `lastActionType` is stored in `GameState` and every
 *       server action handler validates the proposed next action against this
 *       table before accepting it.
 *
 * D-08: Corrected eligibility matrix. Each entry lists the valid next actions
 *       after a given `LastActionType`. Key rules:
 *       - HIGH_PASS must be followed by HEADER (only valid next action).
 *       - SHOT can only follow MOVEMENT_PHASE directly (not encoded here as a row;
 *         this table governs what is allowed AFTER each last action).
 *       - SNAPSHOT and SHOT are terminal — their outcomes always initiate a new
 *         sequence; their rows are empty sets.
 *
 * Security note (T-08-01): This constant is imported client-side for UX button
 * disabling only. Server-side import is the authoritative enforcement point
 * (plan 08-04). A tampered client constant cannot bypass server validation.
 *
 * Importable by both server (enforcement) and client (UI — disable buttons for
 * invalid actions). No I/O, no side effects — pure data.
 */
import type { LastActionType } from './types.js';

/**
 * Union of all action types that can be the NEXT action after a given lastActionType.
 * Distinct from LastActionType (which records what just happened); NextActionType
 * is the candidate action the player is proposing next.
 */
export type NextActionType =
  | 'MOVEMENT'
  | 'STANDARD_PASS'
  | 'FIRST_TIME_PASS'
  | 'HIGH_PASS'
  | 'LONG_BALL'
  | 'HEADER'
  | 'SNAPSHOT'
  | 'SHOT';

/**
 * D-08: Eligibility table mapping each LastActionType to the set of valid next actions.
 *
 * The Record type is exhaustive — TypeScript compile enforces that every LastActionType
 * key is present. ReadonlySet matches the PITCH_REGIONS pattern from pitch.ts.
 *
 * Table source: Counter Attack rulebook v1.4.1, action sequence section.
 */
export const ELIGIBLE_NEXT_ACTIONS: Record<LastActionType, ReadonlySet<NextActionType>> = {
  // Movement Phase → can start another movement, pass (Standard/High/Long), snapshot, or direct shot.
  // FT Pass and Header are not valid immediately after movement (require pass first).
  MOVEMENT_PHASE: new Set<NextActionType>([
    'MOVEMENT',
    'STANDARD_PASS',
    'HIGH_PASS',
    'LONG_BALL',
    'SNAPSHOT',
    'SHOT',
  ]),

  // Successful Tackle → same as after Movement Phase, except no direct SHOT allowed.
  // The newly-possessing team starts from tackle position — no shot opportunity without build-up.
  SUCCESSFUL_TACKLE: new Set<NextActionType>([
    'MOVEMENT',
    'STANDARD_PASS',
    'HIGH_PASS',
    'LONG_BALL',
    'SNAPSHOT',
  ]),

  // Standard Pass → ball receiver can start movement, chain a First-time Pass, or snapshot.
  // No second Standard Pass, no High Pass, no Long Ball, no Header, no direct Shot.
  STANDARD_PASS: new Set<NextActionType>(['MOVEMENT', 'FIRST_TIME_PASS', 'SNAPSHOT']),

  // First-time Pass → limited follow-up: movement or snapshot only.
  FIRST_TIME_PASS: new Set<NextActionType>(['MOVEMENT', 'SNAPSHOT']),

  // High Pass → MUST be followed by a Header — no other valid next action (D-08 key rule).
  HIGH_PASS: new Set<NextActionType>(['HEADER']),

  // Long Ball → can be headed or the team can start movement.
  LONG_BALL: new Set<NextActionType>(['MOVEMENT', 'HEADER']),

  // Header → winner can move, chain a first-time pass, long ball, or snapshot. No standard pass.
  HEADER: new Set<NextActionType>(['MOVEMENT', 'FIRST_TIME_PASS', 'LONG_BALL', 'SNAPSHOT']),

  // Deflection (Loose Ball) → movement, first-time pass, long ball, or snapshot.
  // No Standard Pass (ball is loose — must be reached first via movement).
  DEFLECTION: new Set<NextActionType>(['MOVEMENT', 'FIRST_TIME_PASS', 'LONG_BALL', 'SNAPSHOT']),

  // Snapshot → transitions directly to SHOT; no further actions from this row.
  // Shot outcomes (goal, miss, save, loose ball) always initiate a new sequence.
  SNAPSHOT: new Set<NextActionType>([]),

  // Shot → outcomes always reset the sequence; this row is never queried in practice.
  // Included for Record exhaustiveness so TypeScript enforces completeness.
  SHOT: new Set<NextActionType>([]),

  // OFFSIDE-02 (Phase 17 D-32): free kick from an offside foul — only Standard/High/Long
  // Pass and Shot (in range) are legal. No Movement, no First-time Pass, no Snapshot.
  FREE_KICK_RESTART: new Set<NextActionType>(['STANDARD_PASS', 'HIGH_PASS', 'LONG_BALL', 'SHOT']),
};
