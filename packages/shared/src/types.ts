import type { TeamId } from './teamConfig.js';
import type { UniformStyleId } from './uniformStyles.js';
import type { FormationId } from './formations.js';
/**
 * DRAFT-06..10 (Phase 29): type-only import from draftEngine.ts (Phase 28). draftEngine.ts
 * imports DraftPoolId/DraftTier/TIER_STAT_THRESHOLDS/etc. (values) from this file — this
 * import stays `import type` only (verbatimModuleSyntax erases it at compile time) so no
 * runtime circular dependency is introduced between types.ts and draftEngine.ts.
 */
import type { TieredPoolPlayer, DraftPack } from './draftEngine.js';

export type HexCoord = { q: number; r: number };

export type PlayerPiece = {
  id: string;
  teamId: 'home' | 'away';
  position: HexCoord;
  pace: number;
  shooting: number;
  tackling: number;
  dribbling: number;
  saving: number;
  handling: number;
  resilience: number;
  aerialAbility: number;
  /**
   * D-04 (Phase 5): High Pass accuracy attribute.
   * Outfielders: meaningful value (3–8 by position/role).
   * GKs: 0 — GKs use High Pass mechanics for kicks but have low accuracy by design.
   * Context string values for lastDiceRoll: 'PASS_ACCURACY' | 'SHOT_DUEL' | 'HEADING_DUEL' | 'LOOSE_BALL' | 'GK_KICK'
   */
  highPass: number;
  /** D-06 (Phase 16): first name from CSV roster. */
  firstName: string;
  /** D-06 (Phase 16): last name from CSV roster. */
  lastName: string;
  /** D-04 (Phase 16): jersey number (GK = 1; others 2–11 in ROLE_ORDER). */
  number: number;
  /** D-06 (Phase 16): player nationality from CSV roster. */
  nationality: string;
  /** Positional role. TEAM-02 */
  role: 'GK' | 'DEF' | 'MID' | 'FWD' | 'ST';
  /**
   * v1.6 (Phase 39): number of times this player has been injured this match.
   * 0 = uninjured, 1 = injured once (INJURY-01), 2+ = further injuries (INJURY-03,
   * forces an immediate substitution). Optional so no existing PlayerPiece
   * construction site breaks. This is a COUNTER for INJURY-03/CARD-02 bookkeeping
   * and badge rendering only — it is NOT a live modifier. INJURY-02's "-1 to all
   * attributes, floored at 1" is applied by MUTATING the stored numeric attributes
   * (pace/shooting/tackling/dribbling/saving/handling/resilience/aerialAbility/
   * highPass) at injury time, not via a computeCombinedScore penalty-array entry —
   * `pace` is a movement budget consumed directly by moveValidator/applyMove and is
   * never an input to computeCombinedScore, so a penalty-array approach cannot
   * satisfy INJURY-02's literal "all attributes" requirement. Stored mutation is
   * also safe against Undo because applyUndo already treats a resolved
   * TACKLE_ATTEMPT/STEAL_ATTEMPT as an unconditional boundary (gameEngine.ts
   * ~1646), so Undo can never cross back over the roll that caused the injury.
   */
  injuryCount?: number;
  /** v1.6 (Phase 39 / CARD-01..04): accumulated yellow cards this match. A second yellow becomes a red (secondYellow). */
  yellowCards?: 0 | 1 | 2;
  /** v1.6 (Phase 39 / CARD-02..04): true once this player has been sent off (straight red or second yellow). */
  redCarded?: boolean;
};

export type BallState = {
  position: HexCoord;
  carrierId: string | null;
  /**
   * OOB-01/D-06: the piece that last made contact with the ball, and its team.
   * The single source of truth for out-of-bounds restart classification
   * (`classifyOutOfBounds` in `outOfBounds.ts`) — determines whether a byline
   * exit is a corner kick or a goal kick.
   *
   * Updated on EVERY contact: carrier changes, deflections, header contact,
   * GK saves/parries/punts, and loose-ball landings on an occupied hex — even
   * when that contact never grants `carrierId` (e.g. a kicker mid-flight, or
   * a deflecting piece that doesn't gain possession).
   *
   * Required (not `?:`) so the compiler forces every `BallState` construction
   * site to supply a value — a silently-missed site is a wrong-team restart
   * award, not a crash. Must never be derived retroactively from an
   * `eventLog` scan; it is written forward, at the moment of contact, only.
   */
  lastTouchedBy: { pieceId: string; teamId: 'home' | 'away' } | null;
};

/**
 * Named type for the 4-5-2 movement sub-phase sequence.
 * Exported so ActionEvent and gameEngine can reference it directly. D-07/A1.
 */
export type MovementSlot = 'ATTACKER_4' | 'DEFENDER_5' | 'ATTACKER_2';

/**
 * Referee card leniency attribute. Assigned randomly at match start.
 * Range 1–6 (matches dice face range per MATCH-02). TEAM-03.
 */
export type RefereeCard = {
  leniency: number;
};

/** Discriminant string literals for ActionEvent union. D-07. */
export type ActionEventType =
  | 'MOVE'
  | 'SLOT_ADVANCE'
  | 'DICE_ROLL'
  | 'STEAL_ATTEMPT'
  | 'TACKLE_ATTEMPT'
  | 'GOAL'
  | 'KICK_OFF'
  // Phase 8 additions (D-08 / Claude's Discretion): new action event types for replay coverage
  | 'HIGH_PASS'
  | 'LONG_BALL'
  | 'STANDARD_PASS'
  | 'FIRST_TIME_PASS'
  | 'SHOT_ATTEMPT'
  | 'SNAPSHOT'
  | 'HALF_TIME'
  | 'FULL_TIME'
  | 'HEADER'
  | 'HP_REPOSITION'
  | 'FTP_REPOSITION' // D-03: first-time pass repositioning slot boundary (mirrors HP_REPOSITION)
  | 'HP_ACCURACY'
  | 'HP_MOVE'
  | 'FTP_MOVE' // D-03: piece repositioning move during FIRST_TIME_PASS_MOVE phase
  | 'LOOSE_BALL_LAND'
  | 'DEFLECT_ATTEMPT'
  | 'GK_KICK'
  | 'GK_KICK_MOVE'
  | 'HEADED_PASS'
  | 'GK_PUNT'
  // BUG-17 (Phase 18.3): kick-off formation repositioning — mirrors MOVE shape but no
  // ball component (ball stays at centre hex during KICK_OFF_SETUP). Added so
  // buildReplayFrames can reconstruct formation resets after a goal.
  | 'KICK_OFF_SETUP'
  // BUG-18 (Phase 18.3): move event types for newly Undo-enabled phases. Required so
  // applyUndo can locate and reverse a piece's most recent move in each phase.
  | 'SNAP_DEFLECT_MOVE' // SNAPSHOT_DEFLECT: defender repositions up to 2 hexes
  | 'FK_SETUP_MOVE' // FREE_KICK_SETUP: team repositions a piece during staged setup
  // Plan 25-06: kicker selection and stage-advance boundary events for FREE_KICK_SETUP.
  // FK_KICKER_CHOSEN fires once when the kicker is placed on freeKickHex (stage 0 entry).
  // FK_STAGE_ADVANCE fires at each inter-stage transition (applyFreeKickReady stageIndex < 3).
  // Both act as slot boundaries for applyUndo — see applyUndo boundary scan.
  | 'FK_KICKER_CHOSEN' // kicker placement confirmed; undo boundary for FREE_KICK_SETUP
  | 'FK_STAGE_ADVANCE' // inter-stage transition; undo boundary for FREE_KICK_SETUP
  // Phase 37 (37-02): out-of-bounds detection + throw-in + goal-kick action event types.
  // OOB-05/THROWIN-03/GOALKICK-01/GOALKICK-03/GOALKICK-06.
  | 'OUT_OF_BOUNDS' // ball exited the pitch; records exit kind + awarded restart
  | 'THROW_IN_PLACE' // thrower placed at the throw-in hex
  | 'GOAL_KICK_WINDOW_ADVANCE' // goal-kick reposition window (GK team -> opponent) boundary
  | 'GOAL_KICK_CHOICE' // GK chose kick vs. standard pass restart
  | 'GOAL_KICK_MOVE' // 1-player-per-team repositioning while the goal kick travels
  | 'GOAL_KICK' // goal-kick accuracy roll resolution. Deliberately its own type, not DICE_ROLL
  // (see STATE.md pitfall: reusing DICE_ROLL reactivates a dormant full-slot Undo lockout).
  // Phase 38 (38-01): Corner Kick action event types. D-07/D-08 own dedicated phase chain,
  // structurally independent of GK_RESTART and the GOAL_KICK_* chain (D-07). Deliberately
  // NOT DICE_ROLL — same pitfall as GOAL_KICK above.
  | 'CORNER_KICK_GK_PLACE' // GK placement during the two corner-kick GK reposition windows
  | 'CORNER_KICK_TAKER_PLACED' // corner-taker placed at the fixed corner hex (CORNER-02)
  | 'CORNER_KICK_STAGE_ADVANCE' // inter-stage transition among the 6 CORNER-03 stages
  | 'CORNER_KICK_MOVE' // 1-player-per-team repositioning while the corner kick travels
  | 'CORNER_KICK_ACCURACY' // corner-kick High/Low accuracy roll resolution (CORNER-04)
  // Gap-closure round 2 (38-16, 38-15 defect 3): mandatory pre-corner clear-out movement.
  | 'CORNER_KICK_CLEAR_OUT_MOVE' // 1-player-per-team clear-out step during CORNER_KICK_CLEAR_OUT
  // Phase 39 (39-01): Fouls, Cards, Injuries & Penalty Kicks action event types. None of
  // these may be collapsed into the generic 'DICE_ROLL' type (STATE.md v1.6 pitfall —
  // reusing DICE_ROLL reactivates a dormant full-slot Undo lockout).
  | 'FOUL_CALLED' // a tackle/nutmeg/steal/GK-dive-at-feet duel roll of 1 called a foul
  | 'INJURY_CHECK' // FOUL-04/INJURY-01..03: injury roll always fires after a foul
  | 'BOOKING_CHECK' // FOUL-04/CARD-01..04: booking roll always fires after a foul
  | 'FOUL_CHOICE_MADE' // FOUL-03: fouled attacker's continue-play vs. restart choice
  | 'GK_DIVE_AT_FEET' // GKDIVE-01..05: GK-dive-at-feet duel resolution
  | 'GK_DIVE_AT_FEET_DECLINED' // GKDIVE-02/D-07: GK's team declined the dive-at-feet offer
  | 'GK_BOX_ENTRY_MOVE' // D-10: GK's repositioning move during GK_BOX_ENTRY_MOVE
  | 'PENALTY_KICK_WINDOW_ADVANCE' // PEN-02/D-08: attacking->defending reposition window boundary
  | 'PENALTY_KICK_TAKER_PLACED' // PEN-02: penalty-taker placed at the penalty spot
  | 'PENALTY_KICK' // PEN-01: the penalty-kick duel resolution
  | 'SECOND_HALF_CONFIRM'; // D-16: each manager's confirmation to start the second half

/**
 * Discriminated union of all recordable game actions. D-07, D-08.
 * Appended to GameState.eventLog after each action.
 * Used for undo (D-09, D-10) and end-of-game replay (D-11).
 */
export type ActionEvent =
  | {
      type: 'MOVE';
      pieceId: string;
      from: HexCoord;
      to: HexCoord;
      slot: MovementSlot;
      timestamp: number;
      ballAfter: { position: HexCoord; carrierId: string | null };
    }
  | { type: 'SLOT_ADVANCE'; from: MovementSlot; to: MovementSlot | null; timestamp: number }
  | {
      type: 'DICE_ROLL';
      result: number;
      timestamp: number;
      ballAfter: { position: HexCoord; carrierId: string | null };
    }
  | {
      type: 'STEAL_ATTEMPT';
      defenderId: string;
      result: 'SUCCESS' | 'FAIL';
      defenderDie: number;
      defenderCombined: number;
      timestamp: number;
      ballAfter: { position: HexCoord; carrierId: string | null };
    }
  | {
      type: 'TACKLE_ATTEMPT';
      defenderId: string;
      carrierId: string;
      defenderDie: number;
      carrierDie: number;
      defenderCombined: number;
      carrierCombined: number;
      result: 'SUCCESS' | 'FAIL';
      timestamp: number;
      ballAfter: { position: HexCoord; carrierId: string | null };
    }
  | {
      type: 'GOAL';
      scoringTeam: 'home' | 'away';
      /** ID of the piece that scored — shown in the ActionLog as "[SHOT] # Name SCORED!". */
      scorerId: string;
      timestamp: number;
      ballAfter: { position: HexCoord; carrierId: string | null };
      /**
       * D-01: full post-kickoff-reset piece array (BUG-30). Optional so pre-existing GOAL
       * construction sites that were not touched by this fix (e.g. the GK-out-of-range
       * auto-GOAL branches in gameHandlers.ts) remain valid — buildReplayFrames only applies
       * this field when present.
       */
      piecesAfter?: PlayerPiece[];
    }
  | {
      type: 'HALF_TIME_KICKOFF_RESET';
      /**
       * D-02: same defect class as BUG-30 — the HALF_TIME → KICK_OFF_SETUP piece-formation
       * reset (gameEngine.ts applyHalfTimeStart) has no ActionEvent to hang replay
       * reconstruction on. This event fills that gap.
       */
      piecesAfter: PlayerPiece[];
      timestamp: number;
      ballAfter: { position: HexCoord; carrierId: string | null };
    }
  | {
      type: 'KICK_OFF';
      timestamp: number;
      ballAfter: { position: HexCoord; carrierId: string | null };
    }
  // Phase 8 additions — new action subtypes for replay coverage (Claude's Discretion, 08-CONTEXT.md)
  | {
      type: 'HIGH_PASS';
      passerId: string;
      from: HexCoord;
      to: HexCoord;
      accurate: boolean | null;
      timestamp: number;
      ballAfter: { position: HexCoord; carrierId: string | null };
    }
  | {
      type: 'LONG_BALL';
      from: HexCoord;
      to: HexCoord;
      accurate: boolean;
      timestamp: number;
      ballAfter: { position: HexCoord; carrierId: string | null };
    }
  | {
      type: 'STANDARD_PASS';
      /** D-27: passer piece ID for team-colour prefix in ActionLog. */
      passerId: string;
      from: HexCoord;
      to: HexCoord;
      accurate: boolean;
      timestamp: number;
      ballAfter: { position: HexCoord; carrierId: string | null };
    }
  | {
      type: 'FIRST_TIME_PASS';
      /** D-27: passer piece ID for team-colour prefix in ActionLog. */
      passerId: string;
      from: HexCoord;
      to: HexCoord;
      accurate: boolean;
      timestamp: number;
      ballAfter: { position: HexCoord; carrierId: string | null };
    }
  | {
      type: 'SHOT_ATTEMPT';
      shooterId: string;
      /** ID of the GK in the shot duel — enables rendering the GK as a named label. */
      gkId: string;
      targetHex: HexCoord;
      outcome: 'GOAL' | 'SAVE' | 'LOOSE_BALL';
      /** Raw shooter die value. */
      shooterDie: number;
      /** Shooter combined score (die + shooting + penalties). null when no duel ran (auto-miss or unsaveable). */
      shooterScore: number | null;
      /** Raw GK die value. */
      gkDie: number;
      /** GK combined score (die + saving + penalties). null when no duel ran. */
      gkScore: number | null;
      /** Handling die, present only when GK won the shot duel and a handling check ran. */
      handlingDie: number | null;
      /** GK's handling attribute, present when handlingDie is non-null. */
      gkHandling: number | null;
      /** Net clamped penalty applied to shooter (0, -1, or -2). 0 when no duel ran. */
      shooterPenaltyTotal: number;
      /** Net clamped penalty applied to GK (0, -1, or -2). 0 when no duel ran. */
      gkPenaltyTotal: number;
      timestamp: number;
      ballAfter: { position: HexCoord; carrierId: string | null };
    }
  | {
      type: 'DEFLECT_ATTEMPT';
      defenderId: string;
      band: 'A' | 'B';
      die: number;
      tackling: number;
      result: 'DEFLECTED' | 'NO_DEFLECT';
      timestamp: number;
    }
  | {
      type: 'SNAPSHOT';
      shooterId: string;
      timestamp: number;
      ballAfter: { position: HexCoord; carrierId: string | null };
    }
  | {
      type: 'HALF_TIME';
      half: 1;
      score: { home: number; away: number };
      timestamp: number;
      ballAfter: { position: HexCoord; carrierId: string | null };
    }
  | {
      type: 'FULL_TIME';
      score: { home: number; away: number };
      timestamp: number;
      ballAfter: { position: HexCoord; carrierId: string | null };
    }
  | {
      type: 'HEADER';
      /** Attacking team's contestant piece ID, or null if the attacking team declined. */
      attackerId: string | null;
      /** Defending team's contestant piece ID, or null if the defending team declined. */
      defenderId: string | null;
      result: 'ATTACKER_WIN' | 'DEFENDER_WIN' | 'TIE';
      /** Dice and stats — null for uncontested headers (no dice rolled). */
      attackerDie: number | null;
      attackerAerialAbility: number | null;
      attackerCombined: number | null;
      defenderDie: number | null;
      defenderAerialAbility: number | null;
      defenderCombined: number | null;
      timestamp: number;
    }
  | {
      type: 'HP_REPOSITION';
      slot: 'ATTACKER' | 'DEFENDER';
      pieceId: string | null;
      timestamp: number;
    }
  | {
      type: 'FTP_REPOSITION'; // D-03: first-time pass repositioning slot boundary (mirrors HP_REPOSITION)
      slot: 'ATTACKER' | 'DEFENDER';
      pieceId: string | null;
      timestamp: number;
    }
  | { type: 'HP_ACCURACY'; passerId: string; accurate: boolean; timestamp: number }
  | {
      type: 'HP_MOVE';
      slot: 'ATTACKER' | 'DEFENDER';
      pieceId: string;
      from: HexCoord;
      to: HexCoord;
      timestamp: number;
    }
  | {
      type: 'FTP_MOVE'; // D-03: piece repositioning move during FIRST_TIME_PASS_MOVE phase
      slot: 'ATTACKER' | 'DEFENDER';
      pieceId: string;
      from: HexCoord;
      to: HexCoord;
      timestamp: number;
    }
  | {
      type: 'LOOSE_BALL_LAND';
      from: HexCoord;
      to: HexCoord;
      /**
       * D-15 (Phase 39): the scatter direction die, mapped to a compass label by
       * ActionLog's LOOSE_BALL_DIRECTION_LABELS (1=E, 2=NE, 3=NW, 4=W, 5=SW, 6=SE).
       * Required (not optional) so the compiler flags any construction site that
       * omits it — there is exactly one construction site (gameEngine.ts ~3439).
       */
      direction: 1 | 2 | 3 | 4 | 5 | 6;
      /** D-15 (Phase 39): the scatter distance die (hexes travelled). Required for the same reason as `direction`. */
      distance: 1 | 2 | 3 | 4 | 5 | 6;
      timestamp: number;
      ballAfter: { position: HexCoord; carrierId: string | null };
    }
  | {
      type: 'GK_KICK';
      gkId: string;
      targetHex: HexCoord;
      accurate: boolean;
      kickDie: number;
      kickScore: number;
      timestamp: number;
      ballAfter: { position: HexCoord; carrierId: string | null };
    }
  | {
      type: 'GK_KICK_MOVE';
      slot: 'KICKER' | 'OPP';
      pieceId: string;
      from: HexCoord;
      to: HexCoord;
      timestamp: number;
    }
  | {
      type: 'HEADED_PASS';
      passerId: string;
      from: HexCoord;
      to: HexCoord;
      timestamp: number;
      ballAfter: { position: HexCoord; carrierId: string | null };
    }
  | {
      type: 'GK_PUNT';
      passerId: string;
      from: HexCoord;
      to: HexCoord;
      timestamp: number;
      ballAfter: { position: HexCoord; carrierId: string | null };
    }
  // BUG-17 (Phase 18.3): formation repositioning during KICK_OFF_SETUP.
  // Mirrors MOVE's pieceId/from/to shape; no slot/ballAfter (ball stays at centre).
  | {
      type: 'KICK_OFF_SETUP';
      pieceId: string;
      from: HexCoord;
      to: HexCoord;
      timestamp: number;
    }
  // BUG-18 (Phase 18.3): move events for newly Undo-enabled phases. Shape mirrors
  // HP_MOVE/FTP_MOVE/GK_KICK_MOVE — pieceId + from + to for applyUndo reversal.
  | {
      type: 'SNAP_DEFLECT_MOVE';
      pieceId: string;
      from: HexCoord;
      to: HexCoord;
      timestamp: number;
    }
  | {
      type: 'FK_SETUP_MOVE';
      /** Stage index in the FREE_KICK_SETUP sequence at the time of the move. */
      stageIndex: number;
      pieceId: string;
      from: HexCoord;
      to: HexCoord;
      timestamp: number;
    }
  // Plan 25-06: boundary events for FREE_KICK_SETUP undo gating.
  | {
      /** Kicker placement confirmed — marks the end of the kicker-select sub-step. */
      type: 'FK_KICKER_CHOSEN';
      kickerPieceId: string;
      hex: HexCoord;
      timestamp: number;
    }
  | {
      /** Inter-stage transition — marks the end of one repositioning stage. */
      type: 'FK_STAGE_ADVANCE';
      fromStageIndex: 0 | 1 | 2;
      timestamp: number;
    }
  // Phase 37 (37-02): out-of-bounds detection + throw-in + goal-kick action events.
  | {
      /** OOB-05: the ball left the pitch; records exit geometry + which restart was awarded. */
      type: 'OUT_OF_BOUNDS';
      exitHex: HexCoord;
      kind: 'SIDELINE' | 'BYLINE';
      restart: 'THROW_IN' | 'GOAL_KICK' | 'CORNER_KICK';
      awardedTo: 'home' | 'away';
      lastTouchedByPieceId: string | null;
      timestamp: number;
      ballAfter: { position: HexCoord; carrierId: string | null };
    }
  | {
      /**
       * THROWIN-02: thrower placement at the exit hex. `from`/`to` mirror KICK_OFF_SETUP's
       * shape so replay reconstruction can treat it as a MOVE-like event.
       */
      type: 'THROW_IN_PLACE';
      pieceId: string;
      from: HexCoord;
      to: HexCoord;
      timestamp: number;
      ballAfter: { position: HexCoord; carrierId: string | null };
    }
  | {
      /** GOALKICK-02: undo boundary between the GK-team and opponent reposition windows. Mirrors FK_STAGE_ADVANCE. */
      type: 'GOAL_KICK_WINDOW_ADVANCE';
      fromWindow: 'GK_TEAM' | 'OPPONENT';
      timestamp: number;
    }
  | {
      /** GOALKICK-03: GK's kick-vs-standard-pass restart choice. */
      type: 'GOAL_KICK_CHOICE';
      gkId: string;
      choice: 'kick' | 'standard';
      timestamp: number;
    }
  | {
      /** GOALKICK-05: 1-player-per-team repositioning while the goal kick travels. Byte-for-byte the GK_KICK_MOVE shape. */
      type: 'GOAL_KICK_MOVE';
      slot: 'KICKER' | 'OPP';
      pieceId: string;
      from: HexCoord;
      to: HexCoord;
      timestamp: number;
    }
  | {
      /**
       * GOALKICK-05: goal-kick accuracy roll resolution. Byte-for-byte the GK_KICK shape.
       * Deliberately its own type, not DICE_ROLL (STATE.md pitfall: DICE_ROLL reactivates a
       * dormant full-slot Undo lockout).
       */
      type: 'GOAL_KICK';
      gkId: string;
      targetHex: HexCoord;
      accurate: boolean;
      kickDie: number;
      kickScore: number;
      timestamp: number;
      ballAfter: { position: HexCoord; carrierId: string | null };
    }
  // Phase 38 (38-01): Corner Kick action events. D-07/D-08: own dedicated chain, no reuse
  // of the GK_RESTART or GOAL_KICK_* phase chains; only pure helpers are shared.
  | {
      /**
       * CORNER-01: GK placement during the two corner-kick GK reposition windows
       * (attacking GK first, then defending GK). Mirrors THROW_IN_PLACE's from/to shape
       * minus ballAfter — the ball does not move during GK placement.
       */
      type: 'CORNER_KICK_GK_PLACE';
      pieceId: string;
      side: 'ATTACKING' | 'DEFENDING';
      from: HexCoord;
      to: HexCoord;
      timestamp: number;
    }
  | {
      /**
       * CORNER-02: the corner-taker is placed at the fixed corner hex. Byte-for-byte
       * THROW_IN_PLACE's shape (from/to + ballAfter — the ball moves with the taker).
       */
      type: 'CORNER_KICK_TAKER_PLACED';
      pieceId: string;
      from: HexCoord;
      to: HexCoord;
      timestamp: number;
      ballAfter: { position: HexCoord; carrierId: string | null };
    }
  | {
      /**
       * CORNER-03: inter-stage transition among the 6 alternating reposition stages.
       * Mirrors GOAL_KICK_WINDOW_ADVANCE / FK_STAGE_ADVANCE's undo-boundary shape.
       */
      type: 'CORNER_KICK_STAGE_ADVANCE';
      fromStageIndex: 0 | 1 | 2 | 3 | 4 | 5;
      timestamp: number;
    }
  | {
      /**
       * CORNER-06: 1-player-per-team repositioning while the corner kick travels.
       * Byte-for-byte the GOAL_KICK_MOVE shape with the ATTACKER/DEFENDER slot literal.
       */
      type: 'CORNER_KICK_MOVE';
      slot: 'ATTACKER' | 'DEFENDER';
      pieceId: string;
      from: HexCoord;
      to: HexCoord;
      timestamp: number;
    }
  | {
      /**
       * CORNER-04/CORNER-05: corner-kick High/Low accuracy roll resolution. Mirrors the
       * GOAL_KICK shape with `gkId` renamed to `takerId` plus the High/Low discriminator.
       * Deliberately its own type, not DICE_ROLL (same pitfall as GOAL_KICK above).
       */
      type: 'CORNER_KICK_ACCURACY';
      takerId: string;
      passType: 'HIGH' | 'LOW';
      targetHex: HexCoord;
      accurate: boolean;
      kickDie: number;
      kickScore: number;
      timestamp: number;
      ballAfter: { position: HexCoord; carrierId: string | null };
    }
  | {
      /**
       * CORNER-01 (38-15 defect 3, 38-16): mandatory pre-corner clear-out step. Byte-for-byte
       * `CORNER_KICK_MOVE`'s shape (no `ballAfter` — the ball does not move during clear-out,
       * exactly like `CORNER_KICK_GK_PLACE`).
       */
      type: 'CORNER_KICK_CLEAR_OUT_MOVE';
      slot: 'ATTACKER' | 'DEFENDER';
      pieceId: string;
      from: HexCoord;
      to: HexCoord;
      timestamp: number;
    }
  // Phase 39 (39-01): Fouls, Cards, Injuries & Penalty Kicks action events.
  | {
      /** FOUL-01..05: a tackle/nutmeg/steal/GK-dive-at-feet duel roll of 1 called a foul. */
      type: 'FOUL_CALLED';
      defenderId: string;
      victimId: string;
      hex: HexCoord;
      source: 'TACKLE' | 'STEAL' | 'GK_DIVE_AT_FEET';
      defenderDie: number;
      professional: boolean;
      timestamp: number;
    }
  | {
      /** INJURY-01..03: injury roll always fires after a foul, regardless of the FOUL_CHOICE_MADE outcome. */
      type: 'INJURY_CHECK';
      victimId: string;
      die: number;
      resilience: number;
      injured: boolean;
      injuryCount: number;
      timestamp: number;
    }
  | {
      /** CARD-01..04: booking roll always fires after a foul, regardless of the FOUL_CHOICE_MADE outcome. */
      type: 'BOOKING_CHECK';
      defenderId: string;
      die: number;
      leniency: number;
      card: 'none' | 'yellow' | 'red';
      secondYellow: boolean;
      professional: boolean;
      timestamp: number;
    }
  | {
      /** FOUL-03/D-01: the fouled attacker's continue-play vs. take-the-restart choice. */
      type: 'FOUL_CHOICE_MADE';
      team: 'home' | 'away';
      choice: 'continue' | 'restart';
      restart: 'FREE_KICK' | 'PENALTY' | null;
      timestamp: number;
    }
  | {
      /** GKDIVE-01..05: GK-dive-at-feet duel resolution. */
      type: 'GK_DIVE_AT_FEET';
      gkId: string;
      carrierId: string;
      gkDie: number;
      carrierDie: number;
      gkCombined: number;
      carrierCombined: number;
      distance: number;
      savingPenalty: number;
      result: 'SUCCESS' | 'FAIL';
      timestamp: number;
      ballAfter: { position: HexCoord; carrierId: string | null };
      /** 39-UAT gap 3: the goalkeeper's pre-dive hex. */
      diveFrom: HexCoord;
      /** 39-UAT gap 3: the manager-chosen landing hex the goalkeeper's piece moves to. */
      diveTo: HexCoord;
    }
  | {
      /** GKDIVE-02/D-07: GK's team declined the dive-at-feet offer. */
      type: 'GK_DIVE_AT_FEET_DECLINED';
      gkId: string;
      carrierId: string;
      timestamp: number;
    }
  | {
      /** D-10: GK's repositioning move during GK_BOX_ENTRY_MOVE. */
      type: 'GK_BOX_ENTRY_MOVE';
      gkId: string;
      from: HexCoord;
      to: HexCoord;
      timestamp: number;
    }
  | {
      /** PEN-02/D-08: attacking->defending reposition window boundary. Mirrors GOAL_KICK_WINDOW_ADVANCE. */
      type: 'PENALTY_KICK_WINDOW_ADVANCE';
      from: 'ATTACKING' | 'DEFENDING';
      timestamp: number;
    }
  | {
      /** PEN-02: penalty-taker placed at the penalty spot. */
      type: 'PENALTY_KICK_TAKER_PLACED';
      pieceId: string;
      hex: HexCoord;
      timestamp: number;
    }
  | {
      /** PEN-01: the penalty-kick duel resolution — attacker vs. GK, GK dice penalty applied separately (-2). */
      type: 'PENALTY_KICK';
      takerId: string;
      gkId: string;
      takerDie: number;
      gkDie: number;
      takerCombined: number;
      gkCombined: number;
      result: 'GOAL' | 'SAVED' | 'TIE';
      timestamp: number;
      ballAfter: { position: HexCoord; carrierId: string | null };
    }
  | {
      /** D-16: each manager's confirmation to start the second half. */
      type: 'SECOND_HALF_CONFIRM';
      team: 'home' | 'away';
      bothConfirmed: boolean;
      timestamp: number;
    };

export type GamePhase =
  | 'LOBBY'
  | 'KICK_OFF'
  | 'KICK_OFF_SETUP' // Phase 8 (D-23): free repositioning before each kick-off; added here
  | 'MOVE'
  | 'PASS'
  | 'SNAPSHOT_TARGET' // new: shot declared, awaiting GK dive
  | 'GK_DIVE' // new: GK's team repositions GK interactively
  | 'SNAPSHOT_DEFLECT' // new: opponent moves 1 player before snapshot resolves
  | 'SHOT'
  | 'HEADER'
  | 'SNAPSHOT'
  | 'LOOSE_BALL'
  | 'HIGH_PASS_MOVE' // Pre-accuracy repositioning phase for high pass
  | 'GK_RESTART'
  | 'GK_QUICK_THROW' // GK selects target hex for unblockable, uninterceptable throw
  | 'GK_KICK_TARGET' // GK's team selects kick destination (not into opponent's final third)
  | 'GK_KICK_MOVE' // both teams reposition 1 player ≤3 hexes while ball is in air
  // Phase 17 MOVE-06 (corrected design, D-33..D-38): two sequential sub-phases for the
  // ball-zone-triggered free 6-hex move — attacking team moves first, then defending team.
  | 'FREE_MOVE_ATTACK'
  | 'FREE_MOVE_DEFENSE'
  | 'FIRST_TIME_PASS_MOVE' // D-03: repositioning phase after first-time pass target selected
  // OFFSIDE-02 (Phase 17 D-29): both-teams repositioning before an offside free kick is taken.
  | 'FREE_KICK_SETUP'
  // Phase 37 (37-02) / D-01: Throw-In and Goal Kick phases. Genuinely new phase values,
  // NOT aliases of the GK_RESTART chain — GOALKICK-01 requires Goal Kick to be structurally
  // independent of the existing GK-catch/save restart chain.
  | 'THROW_IN_SETUP' // THROWIN-01/02: thrower placement at the exit hex
  // GOALKICK-02: two sequential reposition windows (GK's team first, then the opponent),
  // modelled on the existing FREE_MOVE_ATTACK/FREE_MOVE_DEFENSE two-phase-value precedent.
  | 'GOAL_KICK_SETUP_GK'
  | 'GOAL_KICK_SETUP_OPPONENT'
  | 'GOAL_KICK_CHOICE' // GOALKICK-03: GK chooses kick vs. standard pass
  | 'GOAL_KICK_TARGET' // GOALKICK-04/05: GK's team selects kick destination
  | 'GOAL_KICK_MOVE' // GOALKICK-05: both teams reposition 1 player <=3 hexes while the kick travels
  // Phase 38 (38-01) / D-07/D-08: Corner Kick phases. Genuinely new phase values, NOT
  // aliases of GK_RESTART or the GOAL_KICK_* chain — CORNER-01 requires Corner Kick to be
  // structurally independent, reusing only pure helpers (mirrors the Phase 37 GOALKICK-01
  // precedent for keeping restart flows structurally separate).
  | 'CORNER_KICK_GK_SETUP_ATTACKING' // CORNER-01: attacking GK repositions first
  | 'CORNER_KICK_GK_SETUP_DEFENDING' // CORNER-01: defending GK repositions second
  | 'CORNER_KICK_TAKER_SELECT' // CORNER-02: attacking manager selects the corner-taker
  | 'CORNER_KICK_REPOSITION' // CORNER-03: 6 alternating stages, attacking first, 2 pieces max per stage
  | 'CORNER_KICK_FINAL_SETUP' // CORNER-06: 1-player-per-team pre-kick reposition window
  // Phase 39 (39-01): Fouls, Cards, Injuries & Penalty Kicks phases. New GamePhase values —
  // genuinely new, not aliases of any existing chain.
  | 'FOUL_CHOICE' // FOUL-03: fouled attacker chooses continue-play vs. take the restart
  | 'GK_DIVE_AT_FEET_PROMPT' // GKDIVE-02/D-07: GK's team offered the dive-at-feet duel
  | 'GK_DIVE_AT_FEET_TARGET' // 39-UAT gap 3: destination-hex step the GK manager takes after accepting the dive
  | 'GK_BOX_ENTRY_PROMPT' // D-10: GK's team offered the box-entry response
  | 'GK_BOX_ENTRY_MOVE' // D-10: GK moves in response to a box-entry attacker
  | 'PENALTY_KICK_SETUP_ATTACKING' // PEN-02/D-08: attacking team repositions before the penalty
  | 'PENALTY_KICK_SETUP_DEFENDING' // PEN-02/D-08: defending team repositions before the penalty
  | 'PENALTY_KICK_TAKER_SELECT' // PEN-02: attacking manager selects the penalty-taker
  | 'PENALTY_KICK' // PEN-01: the penalty-kick duel itself
  | 'HALF_TIME'
  | 'FULL_TIME'
  | 'REPLAY';

/**
 * D-06: Records the type of the last completed action in the current sequence.
 * Used by the server to validate the proposed next action against ELIGIBLE_NEXT_ACTIONS (D-07/D-08).
 * null at match start, after each kick-off reset, and after goal scored.
 * Set to 'SUCCESSFUL_TACKLE' when a steal ends the Movement Phase early (D-14).
 * Set to 'DEFLECTION' when LOOSE_BALL resolves from any source (D-20).
 */
export type LastActionType =
  | 'MOVEMENT_PHASE'
  | 'SUCCESSFUL_TACKLE'
  | 'STANDARD_PASS'
  | 'FIRST_TIME_PASS'
  | 'HIGH_PASS'
  | 'LONG_BALL'
  | 'HEADER'
  | 'DEFLECTION'
  | 'SNAPSHOT'
  | 'SHOT'
  // OFFSIDE-02 (Phase 17 D-32): set when an offside free kick is taken — restricts the
  // next action to STANDARD_PASS/HIGH_PASS/LONG_BALL/SHOT via its ELIGIBLE_NEXT_ACTIONS row.
  | 'FREE_KICK_RESTART'
  // Phase 37 (37-02) / THROWIN-03 / D-09: throw-in's two-movement-phase model. Set after
  // Movement Phase 1 (THROW_IN_MOVEMENT_1) and after Movement Phase 2 (THROW_IN_MOVEMENT_2,
  // the D-09 hard cap — its ELIGIBLE_NEXT_ACTIONS row deliberately omits MOVEMENT).
  | 'THROW_IN_MOVEMENT_1'
  | 'THROW_IN_MOVEMENT_2'
  // GOALKICK-03: set when the GK chooses the Standard Pass restart branch. Mirrors the
  // existing FREE_KICK_RESTART row's purpose (restricted eligibility set).
  | 'GOAL_KICK_RESTART'
  // CORNER-04/CORNER-05 (Phase 38): set when the corner-kick final-setup window ends and the
  // taker is ready to kick — restricts the next action to STANDARD_PASS/HIGH_PASS (Low/High).
  // The PERSISTENT `cornerKickTeam` field — not this value — is what gates the Low-option
  // accuracy check, because the GAME_ROLL handler overwrites `lastActionType` with the
  // chosen passType before `applyRoll` runs (same pitfall documented on GOAL_KICK_RESTART's
  // sibling THROW_IN_MOVEMENT_2 row).
  | 'CORNER_KICK_RESTART';

/**
 * UX-07 (Phase 18.4): Game speed selection — controls how many match-clock minutes
 * elapse per completed MOVE action.
 */
export type GameSpeed = 'slow' | 'standard' | 'fast';

/**
 * UX-07 (Phase 18.4): Clock minutes added per completed MOVE action per speed setting.
 * slow = +1 min, standard = +2 min, fast = +3 min.
 */
export const GAME_SPEED_MINUTES: Record<GameSpeed, number> = {
  slow: 1,
  standard: 2,
  fast: 3,
};

/** DRAFT-01/02/03 (Phase 27): team type selected on the pre-game settings screen. */
export type TeamType = 'standard' | 'draft';

/**
 * DRAFT-01 (Phase 27): selectable draft player pools. Legends/Icons exist in the type
 * for forward-compat with DRAFT-11 but are NOT selectable in this phase (D-04) — the
 * server-side allow-list for the confirm handler must reject them even though the
 * client renders their (disabled) checkboxes.
 */
export type DraftPoolId = 'original' | 'mls' | 'international' | 'legends' | 'icons';

/**
 * DRAFT-01 (Phase 27), D-08 (Phase 30): pools selectable for a draft session. Widened to
 * all 5 `DraftPoolId` values — Legends/Icons are now enabled (DRAFT-11). This is the
 * single source of truth for both the client's checkbox disabled-state and the
 * server-side `ROOM_SETTINGS_CONFIRM` allow-list validation (ASVS V5 Input Validation) —
 * a modified client cannot select any pool outside this list.
 */
export const SELECTABLE_DRAFT_POOLS: readonly DraftPoolId[] = [
  'original',
  'mls',
  'international',
  'legends',
  'icons',
] as const;

/**
 * DRAFT-04 (Phase 28), D-05 (Phase 30): rarity tier assigned to a pooled player. Narrowed
 * to 4 values — the prior 5th reserved GK-only tier value is removed entirely (D-05): GK
 * cards are classified by the identical fixed-threshold rule as outfield cards (D-04). GK
 * remains a distinct pack-composition/dealing category (D-07) but is no longer a rarity tier.
 */
export type DraftTier = 'chase' | 'rare' | 'uncommon' | 'common';

/**
 * DRAFT-04 (Phase 30), D-03: fixed absolute total-stat thresholds used by `classifyTier`
 * (packages/shared/src/draftEngine.ts) — replaces the old session-relative percentile
 * bounds model (removed). A player's tier is now a pure function of their own total stat,
 * with no population/ranking context needed: `chase` when totalStat >= 32, `rare` when
 * totalStat === 31, `uncommon` when totalStat is 29-30, else `common`.
 */
export const TIER_STAT_THRESHOLDS: Readonly<Record<'chase' | 'rare' | 'uncommon', number>> = {
  chase: 32,
  rare: 31,
  uncommon: 29,
} as const;

/**
 * DRAFT-05 (Phase 30), D-19: a tier-slot need within one pack. 'chaseOrRare' is a virtual
 * combined bucket — filled by merging chase+rare candidates into one shuffled draw pool
 * for that slot (an unbiased mix, D-25), NOT by preferring one tier over the other.
 */
export type PackSlot =
  | { tier: 'common' | 'uncommon' | 'chase' | 'rare'; count: number }
  | { tier: 'chaseOrRare'; count: number };

/**
 * DRAFT-05 (Phase 30), D-12..D-19: per-round pack configuration. Round 1 is a dedicated
 * GK-only round (D-12, D-07); rounds 2-6 deal tiered packs per `slots`. Replaces the old
 * flat uniform-composition model (removed) — pack composition and pick count now vary by
 * round instead of being uniform across the whole match.
 */
export type RoundConfig =
  | { round: number; kind: 'gk'; cardsPerPack: 4; picks: 2 }
  | { round: number; kind: 'tiered'; cardsPerPack: 4; picks: 3; slots: PackSlot[] };

/**
 * DRAFT-05 (Phase 30), D-12..D-16: the full 6-round draft structure. Round 1: 2 GK picks
 * (D-12). Rounds 2-3: 3 all-common picks each (D-13). Round 4: 3 picks, 2 uncommon + 2
 * common per pack (D-14). Rounds 5-6: 3 picks each, 1 chaseOrRare + 1 uncommon + 2 common
 * per pack (D-15). Total picks per player across all 6 rounds sums to 17 (D-16).
 */
export const DRAFT_ROUNDS: readonly RoundConfig[] = [
  { round: 1, kind: 'gk', cardsPerPack: 4, picks: 2 },
  { round: 2, kind: 'tiered', cardsPerPack: 4, picks: 3, slots: [{ tier: 'common', count: 4 }] },
  { round: 3, kind: 'tiered', cardsPerPack: 4, picks: 3, slots: [{ tier: 'common', count: 4 }] },
  {
    round: 4,
    kind: 'tiered',
    cardsPerPack: 4,
    picks: 3,
    slots: [
      { tier: 'uncommon', count: 2 },
      { tier: 'common', count: 2 },
    ],
  },
  {
    round: 5,
    kind: 'tiered',
    cardsPerPack: 4,
    picks: 3,
    slots: [
      { tier: 'chaseOrRare', count: 1 },
      { tier: 'uncommon', count: 1 },
      { tier: 'common', count: 2 },
    ],
  },
  {
    round: 6,
    kind: 'tiered',
    cardsPerPack: 4,
    picks: 3,
    slots: [
      { tier: 'chaseOrRare', count: 1 },
      { tier: 'uncommon', count: 1 },
      { tier: 'common', count: 2 },
    ],
  },
] as const;

/** DRAFT-05 (Phase 30), D-16: total rounds in the draft structure (6). */
export const DRAFT_ROUND_COUNT = DRAFT_ROUNDS.length;

/** DRAFT-05 (Phase 30): packs dealt per round — one per side. */
export const PACKS_PER_ROUND = 2;

/**
 * DRAFT-06/07 (Phase 29), D-01: the three player-facing picking sub-steps within one
 * draft cycle. SWAP / SWAP_BACK / NEW_PACK are automatic server-driven transitions
 * between sub-steps, not player-facing sub-steps themselves.
 */
export type DraftSubStep = 'PICK1' | 'PICK2' | 'PICK3';

/**
 * DRAFT-06 (Phase 29), D-05: the drop target of a draft pick — a specific lineup slot
 * (0..10) or the bench (append). Sent by the client as part of DraftPickPayload.
 */
export type DraftDestination = { type: 'slot'; slotIndex: number } | { type: 'bench' };

/**
 * DRAFT-06 (Phase 29), D-08: addresses an already-placed drafted card for rearrangement
 * (lineup <-> bench, or lineup <-> lineup). Distinct from DraftDestination — a slot ref
 * also needs to identify a *source* bench card by its index (benchIndex), whereas a
 * destination bench drop is always an append with no index needed.
 */
export type DraftSlotRef =
  | { type: 'slot'; slotIndex: number }
  | { type: 'bench'; benchIndex: number };

/** DRAFT-06/07 (Phase 29): DRAFT_PICK client payload — drafts `cardId` and places it at `destination`. */
export type DraftPickPayload = { cardId: string; destination: DraftDestination };

/**
 * DRAFT-06 (Phase 29), D-08/D-10: DRAFT_REARRANGE client payload — moves an already-drafted
 * card between `from` and `to`. Never advances cycle/sub-step state (D-10) — only dragging a
 * card off the draft-pack row counts as "the pick".
 */
export type DraftRearrangePayload = { from: DraftSlotRef; to: DraftSlotRef };

/**
 * DRAFT-06..10 (Phase 29), D-16 (Phase 30): the full server-authoritative draft session
 * state for one room, covering both players' packs, drafted ids, lineup/bench state, and
 * round progress. Stored as `Room.draftSession` (packages/server/src/roomStore.ts) — never
 * sent to a client directly; each player receives only their own privacy-scoped
 * `DraftClientView` (D-14).
 */
export type DraftSession = {
  /** 0 before the first pack is opened; 1..6 during the six draft rounds (D-12..D-16, Phase 30). */
  round: number;
  /** Current player-facing picking sub-step within the active round (D-01). */
  subStep: DraftSubStep;
  /** All 12 pre-generated packs for this match (D-12..D-16, Phase 30) — the single source of truth for card contents. */
  draftPacks: DraftPack[];
  /** Indices into draftPacks assigned to home, one per round in sequential open order (D-12..D-16, Phase 30). Length 6. */
  homePackOrder: number[];
  /** Indices into draftPacks assigned to away, one per round in sequential open order (D-12..D-16, Phase 30). Length 6. */
  awayPackOrder: number[];
  /** Home player's currently-visible pack contents (D-14 — never sent to away). */
  homeCurrentPack: TieredPoolPlayer[];
  /** Away player's currently-visible pack contents (D-14 — never sent to home). */
  awayCurrentPack: TieredPoolPlayer[];
  /** Accumulates to 17 entries by draft end (D-16, Phase 30). */
  homeDraftedIds: string[];
  /** Accumulates to 17 entries by draft end (D-16, Phase 30). */
  awayDraftedIds: string[];
  /**
   * Picks left in the current sub-step for home — varies by round (D-12..D-16, Phase 30:
   * round 1 has 2 total picks, rounds 2-6 have 3 each). Decrements on each DRAFT_PICK;
   * sub-step/round advances only once both players reach 0 (D-03 mutual-wait gate).
   */
  homePicksRemaining: number;
  /** Picks left in the current sub-step for away — mirrors homePicksRemaining. */
  awayPicksRemaining: number;
  /** 11 entries; null = empty formation slot (D-11/D-22). Index i maps to the formation's slot i. */
  homeLineupSlots: (string | null)[];
  /** 11 entries; null = empty formation slot (D-11/D-22). */
  awayLineupSlots: (string | null)[];
  /** Dynamic length — grows as home drafts cards not placed into a lineup slot (D-09). */
  homeBenchIds: string[];
  /** Dynamic length — grows as away drafts cards not placed into a lineup slot (D-09). */
  awayBenchIds: string[];
  /** Filled at draft-complete: playerId -> random unused jersey number 15-99 (D-15/D-16). */
  homeBenchNumbers: Record<string, number>;
  /** Filled at draft-complete: playerId -> random unused jersey number 15-99 (D-15/D-16). */
  awayBenchNumbers: Record<string, number>;
  /** True once all 17 picks are resolved for both players (D-16, Phase 30 — draft-pack row disappears). */
  draftComplete: boolean;
};

/**
 * DRAFT-06..10 (Phase 29), D-14: the per-socket private payload for DRAFT_STATE_UPDATED.
 * Structurally excludes any home/away pair or opponent-pack field — `currentPack` is always
 * THIS receiving player's pack only, never the opponent's (T-29-PRIV: privacy enforced by
 * the type shape itself, not just by emit discipline).
 */
export type DraftClientView = {
  round: number;
  subStep: DraftSubStep;
  /** THIS player's pack only — never the opponent's (D-14). */
  currentPack: TieredPoolPlayer[];
  picksRemaining: number;
  /** True once this player has used all picksRemaining for the current sub-step and is waiting on the opponent (D-03/D-12). */
  waitingForOpponent: boolean;
  lineupSlots: (string | null)[];
  benchIds: string[];
  benchNumbers: Record<string, number>;
  draftComplete: boolean;
};

export type GameState = {
  roomCode: string;
  phase: GamePhase;
  activeTeam: 'home' | 'away';
  pieces: readonly PlayerPiece[];
  ball: BallState;
  score: { home: number; away: number };
  actionCount: number;
  half: 1 | 2;
  /** D-08: Typed action event log. Replaces readonly unknown[] placeholder. */
  eventLog: readonly ActionEvent[];
  /** TEAM-03: Referee card drawn at match start. leniency range 1–6. */
  refereeCard: RefereeCard;
  /** A1: Team currently in possession / attacking. Set at KICK_OFF, constant through Movement Phase. */
  attackingTeam: 'home' | 'away';
  /**
   * D-08: Movement-phase tracking fields.
   * Default values when outside MOVEMENT phase: `[]`, `{}`, `null`.
   *
   * - movedPieceIds: IDs of pieces that have completed their movement in the
   *   current Movement Phase. Empty (`[]`) outside MOVEMENT phase.
   * - paceUsedByPieceId: Cumulative hexes moved per piece in the current
   *   Movement Phase. Empty (`{}`) outside MOVEMENT phase.
   * - movementSlot: Which 4-5-2 sub-phase is currently active.
   *   `null` outside MOVEMENT phase.
   */
  movedPieceIds: readonly string[];
  paceUsedByPieceId: Readonly<Record<string, number>>;
  movementSlot: MovementSlot | null;
  /**
   * MOVE-06 (Phase 17, corrected design D-33): which final third the ball currently
   * occupies. Always present (never optional) — every state-construction site must
   * initialize it. Compared against the post-action zone in `applyFreeMoveZoneCheck`
   * (centrally invoked from `broadcastState`) to detect a fresh entry into a final
   * third, which triggers the FREE_MOVE_ATTACK/FREE_MOVE_DEFENSE sequence.
   */
  ballZone: 'home' | 'middle' | 'away';
  /**
   * D-11 / Phase 5: Dice rolls from the most recent dice action.
   * Embedded in GameState so both clients see the rolls before rendering the outcome.
   * null when no dice have been rolled yet (KICK_OFF, LOBBY phases).
   * Context string values: 'PASS_ACCURACY' | 'SHOT_DUEL' | 'HEADING_DUEL' | 'LOOSE_BALL' | 'GK_KICK'
   */
  lastDiceRoll?: {
    rolls: number[]; // ordered dice values; length varies by context (1–3)
    context: string;
  } | null;
  // Phase 8 additions — match lifecycle fields (D-06, D-27, D-31)
  /** D-06: null until actionCount first crosses 45; set once per half via inline dice roll (D-05). */
  addedTime: number | null;
  /** D-06: null at match start and after kick-off reset; updated after every action. */
  lastActionType: LastActionType | null;
  /** D-06: team that kicked off the first half; determines second-half kick-off assignment (D-26). */
  kickOffTeam: 'home' | 'away';
  /**
   * D-27 / MATCH-03: true from KICK_OFF_SETUP → KICK_OFF → MOVEMENT transition until the first
   * accurate Standard Pass originating from the centre hex resolves. While true, the server must
   * reject any ball action that is not a Standard Pass from kickOffHex. Cleared to false after the
   * first accurate Standard Pass resolves.
   */
  kickOffActive: boolean;
  /** Phase 16 D-15: teams selected before match start, embedded in every GameState snapshot. */
  selectedTeams: { home: TeamId; away: TeamId };
  /** Phase 22 D-16: uniform styles selected before match start, embedded in every GameState snapshot. */
  selectedUniformStyles: { home: UniformStyleId; away: UniformStyleId };
  /** Jersey variant each team is wearing — 'home' = home kit colors, 'away' = away kit colors. Defaults to home→home, away→away when absent. */
  selectedJerseyTypes?: { home: 'home' | 'away'; away: 'home' | 'away' };
  /** Phase 23 D-11: formations selected before match start, embedded in every GameState snapshot. Set after Phase 24 lineup assignment. */
  selectedFormation?: { home: FormationId; away: FormationId };
  /**
   * UX-07 (Phase 18.4): Selected game speed — drives the per-MOVE clock increment
   * via GAME_SPEED_MINUTES[gameSpeed]. Set by home player before match start; defaults
   * to 'standard'.
   */
  gameSpeed: GameSpeed;
  /** D-31: 1-based replay frame position carried on REPLAY-phase frames only; absent outside replay. */
  replayIndex?: number;
  /** D-31: total replay frame count carried on REPLAY-phase frames only; absent outside replay. */
  replayTotal?: number;
  /**
   * SNAP-02: GK saving penalty for the current snapshot shot.
   * 0  = snapshot active, GK within 1 hex of target (no penalty).
   * -1 = GK at exactly 2 hexes from target.
   * -2 = GK at exactly 3 hexes from target.
   * undefined = not a snapshot shot (regular shot rules apply).
   * Cleared to undefined after the shot resolves.
   */
  snapshotGkPenalty?: number | null;
  /**
   * D-10 (Phase 8.2): Target hex for the in-flight Long/High pass.
   * Set by the GAME_ROLL handler before applyRoll; consumed and cleared by the applyRoll PASS branch.
   * null or absent outside the PASS phase accuracy-check sequence.
   */
  passTargetHex?: HexCoord | null;
  /**
   * D-17 (Phase 8.2): Per-team selected contestant piece IDs during HEADER phase.
   * home/away are arrays of piece IDs; empty array means the team declined (no contestant).
   * null or absent outside the HEADER phase.
   */
  headerContestants?: { home: string[]; away: string[] } | null;
  /**
   * D-17 (Phase 8.2): Confirmation flags for header contestant selection.
   * true once a team submits its contestant; GAME_ROLL for HEADER requires both true.
   * null or absent outside the HEADER phase.
   */
  headerConfirmed?: { home: boolean; away: boolean } | null;
  /**
   * D-21 / HEAD-05 (Phase 8.2): IDs of pieces that contested a header this sequence.
   * These pieces are excluded from the subsequent Movement Phase.
   * Cleared to empty array in applyStartMovement.
   */
  contestedPieceIds?: readonly string[];
  /**
   * Plan 31-06 (BUG-31 family, folded header-winner-eligibility todo): piece ids carried
   * from a header resolution into the next Movement Phase. Populated by
   * applyResolveHeaderTarget's non-goal branches (the header-duel winner's id, since it
   * has already acted this turn) and merged into `movedPieceIds` by applyStartMovement
   * (not cleared there — merged) — then cleared itself so the header winner stays spent
   * for exactly one Movement Phase, not indefinitely. Absent/empty on every other state.
   */
  carriedMovedPieceIds?: readonly string[];
  /**
   * D-11 (Phase 8.2): Dice pre-rolled by the GAME_ROLL handler for each interceptor
   * in validatePass's interceptors list. Consumed and cleared by the applyRoll PASS branch
   * interception loop. Absent or empty when no interception roll is pending.
   */
  preGeneratedInterceptionDice?: number[];
  /**
   * HIGH_PASS_MOVE phase: which team's repositioning slot is active.
   * 'ATTACKER' → attacking team moves first; 'DEFENDER' → defending team moves.
   * null or absent outside HIGH_PASS_MOVE phase.
   */
  highPassMovementSlot?: 'ATTACKER' | 'DEFENDER' | null;
  /**
   * HIGH_PASS_MOVE phase: the piece ID chosen for this team's repositioning slot.
   * Locked to the first piece moved; subsequent moves must use the same piece.
   * null if no piece has been moved yet in the current slot.
   */
  highPassMovedPieceId?: string | null;
  /**
   * HIGH_PASS_MOVE phase: cumulative hexes moved by highPassMovedPieceId in the current slot.
   * Capped at 3. Reset to 0 at each slot transition.
   */
  highPassPaceUsed?: number;
  /**
   * HIGH_PASS_MOVE phase: the piece ID of the player who kicked the high pass.
   * Preserved so applyRoll can look up the kicker's highPass stat after ball.carrierId is cleared.
   * null or absent outside HIGH_PASS_MOVE phase.
   */
  highPassCarrierId?: string | null;
  /** Phase 10 HEAD-03: target hex selected by header attacker; null outside HEADER phase. */
  headerTargetHex?: HexCoord | null;
  /**
   * RULE-01 (Phase 11): true when high-pass accuracy roll has resolved but the
   * attacker has not yet acknowledged the result. Contestant selection UI is
   * suppressed until this flag clears. null or absent outside HEADER phase.
   */
  headerAccuracyRollPending?: boolean | null;
  /**
   * RULE-02 (Phase 11): winner of the heading duel.
   * Set in GAME_HEADER_CONTESTANT when both teams confirm and duel auto-fires.
   * Used by GAME_HEADER_TARGET to validate the submitting team.
   * null or absent outside HEADER phase after duel resolves.
   */
  headerDuelWinner?: 'home' | 'away' | null;
  /** ID of the winning contestant piece during HEADER target selection. Cleared when target resolves. */
  headerWinnerId?: string | null;
  /** Phase 10 SNAPSHOT_TARGET: goal hex the shooter declared. */
  shotTargetHex?: HexCoord | null;
  /** Phase 10 GK_DIVE: GK's current position during GK_DIVE phase. */
  gkDivePosition?: HexCoord | null;
  /** Phase 10 D-29: piece IDs that already attempted a steal this movement phase. */
  stealAttemptedByIds?: readonly string[];
  /** Phase 10 D-29: piece IDs that already attempted a tackle this movement phase. */
  tackleAttemptedByIds?: readonly string[];
  /** Phase 10 SNAPSHOT_DEFLECT: ID of the first piece moved during snap deflection. */
  snapDeflectMovedPieceId?: string | null;
  /** Phase 10 SNAPSHOT_DEFLECT: number of hexes moved so far during snap deflection (max 2). */
  snapDeflectPaceUsed?: number;
  /** Last resolved shot path (shooter → goal hex). Cleared on next non-shot action. */
  lastShotPath?: HexCoord[] | null;
  /**
   * GK_KICK_TARGET / GK_KICK_MOVE: destination hex selected by the GK's team.
   * null outside GK kick phases.
   */
  gkKickTargetHex?: HexCoord | null;
  /**
   * GK_KICK_MOVE: piece ID of the GK who kicked. Saved before ball.carrierId is cleared
   * so the accuracy stat (highPass) can be looked up after repositioning.
   * null outside GK kick phases.
   */
  gkKickGkId?: string | null;
  /**
   * GK_KICK_MOVE: whose repositioning slot is active.
   * 'KICKER' → GK's team moves first; 'OPP' → opponent moves.
   * null outside GK_KICK_MOVE phase.
   */
  gkKickMovementSlot?: 'KICKER' | 'OPP' | null;
  /**
   * GK_KICK_MOVE: piece ID locked in for this team's repositioning slot.
   * null if no piece has moved yet in the current slot.
   */
  gkKickMovedPieceId?: string | null;
  /**
   * GK_KICK_MOVE: cumulative hexes moved by gkKickMovedPieceId in the current slot.
   * Capped at 3. Reset to 0 at each slot transition.
   */
  gkKickPaceUsed?: number;
  /**
   * PASS-02 (Phase 17): path of an in-flight First-time Pass.
   * Array of hex coords from passer to target, computed by hexLine().
   * null outside FIRST_TIME_PASS attacker-step sub-state.
   */
  firstTimePassPath?: readonly HexCoord[] | null;
  /**
   * PASS-02 (Phase 17): sub-step within First-time Pass flow.
   * 'ATTACKER' = attacker may reposition 1 non-passer player ≤1 hex.
   * null outside this sub-state.
   */
  firstTimePassStep?: 'ATTACKER' | null;
  /**
   * D-03 (Phase 17.1): FIRST_TIME_PASS_MOVE repositioning slot.
   * 'ATTACKER' → attacking team's slot; 'DEFENDER' → defending team's slot.
   * null outside FIRST_TIME_PASS_MOVE phase.
   */
  firstTimePassMovementSlot?: 'ATTACKER' | 'DEFENDER' | null;
  /**
   * D-03 (Phase 17.1): piece ID locked in for the current FIRST_TIME_PASS_MOVE slot.
   * null if no piece has been moved yet in the current slot.
   */
  firstTimePassMovedPieceId?: string | null;
  /**
   * D-03 (Phase 17.1): cumulative hexes moved in the current FIRST_TIME_PASS_MOVE slot.
   * Capped at 1. Reset to 0 at each slot transition.
   */
  firstTimePassPaceUsed?: number;
  /**
   * D-03 (Phase 17.1-16): the piece ID of the player who made the first-time pass.
   * Preserved so the server and client can exclude the passer from repositioning onto /
   * receiving back their own pass during FIRST_TIME_PASS_MOVE (cycle-4 verifier self-pass
   * finding — the original passer must not be able to reclaim their own pass).
   * Mirrors highPassCarrierId in type and lifecycle: set at the FIRST_TIME_PASS transition,
   * preserved across FTP_MOVE undo (the pass is still in flight), cleared to null only at
   * FTP ball delivery. null or absent outside FIRST_TIME_PASS_MOVE.
   */
  firstTimePassCarrierId?: string | null;
  /**
   * MOVE-06 (Phase 17, corrected design D-34/D-38): piece IDs eligible for the free
   * 6-hex move, split by sub-phase. Both teams' lists are precomputed together at
   * trigger time — "attack" = the team in `attackingTeam`, "defense" = the other team.
   * Includes ALL pieces (both teams, GK included) positioned in the opposite final
   * third at the moment the trigger fired. null outside FREE_MOVE_ATTACK/FREE_MOVE_DEFENSE.
   */
  freeMoveEligibleIds?: { attack: readonly string[]; defense: readonly string[] } | null;
  /**
   * MOVE-06 (Phase 17): cumulative hexes used per piece during the FREE_MOVE_ATTACK/
   * FREE_MOVE_DEFENSE sub-phases. Key = pieceId; value = hexes moved so far (max 6).
   * Shared across both sub-phases (keyed by piece id; no two pieces share an id).
   * null outside FREE_MOVE_ATTACK/FREE_MOVE_DEFENSE.
   */
  freeMoveUsedPace?: Readonly<Record<string, number>> | null;
  /**
   * OFFSIDE-01 (D-23): sticky set of piece IDs currently flagged offside. Re-evaluated
   * at every end-of-phase where pieces can move; persists until each piece's D-22 clear
   * condition holds. Default [] at match start and after every reset/kick-off.
   */
  offsidePieceIds?: readonly string[];
  /**
   * OFFSIDE-02 (Phase 17 D-27): the restart hex for an offside free kick — the offending
   * player's position at the moment the foul triggered (NOT the ball's position).
   * null outside the FREE_KICK_SETUP flow.
   */
  freeKickHex?: HexCoord | null;
  /**
   * OFFSIDE-02 (Phase 17 D-28): the team AWARDED the free kick — i.e. the team that did
   * NOT commit the offside foul. null outside the FREE_KICK_SETUP flow.
   */
  freeKickAttackingTeam?: 'home' | 'away' | null;
  /**
   * OFFSIDE-02 (Phase 17 D-49, rulebook-correction rework): which of the four fixed,
   * alternating free-kick repositioning stages is currently active —
   * 0 = kicking team, up to 5; 1 = conceding team, up to 5;
   * 2 = kicking team, up to 3 (their LAST turn — D-51 kicker-hex check fires here);
   * 3 = conceding team, up to 2 (D-50 2-hex check fires here too, as it does at stage 1).
   * Indexes into the FREE_KICK_STAGES lookup table (offside.ts). null outside FREE_KICK_SETUP.
   */
  freeKickStageIndex?: 0 | 1 | 2 | 3 | null;
  /**
   * OFFSIDE-02 (Phase 17 D-49): piece IDs already counted toward the CURRENT stage's
   * placement cap — i.e. distinct pieces the active stage's team has touched this stage.
   * Re-placing an already-counted piece is free (doesn't consume another cap slot).
   * Reset to [] at the start of every new stage (including stage 0's initialization by
   * triggerOffsideFoul). null outside FREE_KICK_SETUP.
   */
  freeKickPlacedPieceIds?: readonly string[] | null;
  /**
   * Plan 25-06 (OFFSIDE-02 fix): kicker-select sub-step gate.
   * null  — outside FREE_KICK_SETUP.
   * false — FREE_KICK_SETUP entered; kicking team must place a piece on freeKickHex
   *          before any other repositioning moves are legal.
   * true  — kicker has been placed on freeKickHex; normal 4-move repositioning
   *          stages proceed.
   *
   * Initialized to false by triggerOffsideFoul; set to true when the first
   * FK_KICKER_CHOSEN event is emitted; cleared to null at FREE_KICK_SETUP exit.
   * Uses `?: boolean | null` (matching the optional pattern of other freeKick fields)
   * so existing spread patterns do not break.
   */
  freeKickKickerChosen?: boolean | null;
  /**
   * MOVE-06 (Phase 17, corrected design D-36): snapshots the phase and activeTeam that
   * were already computed as "next" by the action that triggered the free-move sequence
   * (captured BEFORE the overlay sets phase to FREE_MOVE_ATTACK/FREE_MOVE_DEFENSE).
   * Restored when FREE_MOVE_DEFENSE ends (or is skipped because its eligible list was
   * empty). null outside the FREE_MOVE_ATTACK/FREE_MOVE_DEFENSE sequence.
   */
  freeMoveResume?: { phase: GamePhase; activeTeam: 'home' | 'away' } | null;
  /**
   * PASS-02 (Phase 17): the piece ID of the player who made the First-time Pass.
   * Set when firstTimePassStep: 'ATTACKER' is entered so the handler can reject
   * attempts to move the passer. null outside this sub-state.
   */
  passerId?: string | null;
  /**
   * OOB-05/GOALKICK-06 (Phase 37): game-creation toggle for out-of-bounds detection and its
   * restart set (throw-in/goal-kick). Absent or `false` means the toggle is OFF and the
   * pre-existing clamp-to-boundary behaviour must run byte-for-byte unchanged. Every read
   * site must test `state.outOfBoundsEnabled === true`, never truthiness of a possibly-
   * undefined value.
   */
  outOfBoundsEnabled?: boolean;
  /** THROWIN-01/02 (Phase 37): the exit hex where the throw-in is taken. null outside THROW_IN_SETUP/movement. */
  throwInHex?: HexCoord | null;
  /** THROWIN-01 (Phase 37): the team awarded the throw-in. null outside the throw-in sequence. */
  throwInTeam?: 'home' | 'away' | null;
  /**
   * THROWIN-03/D-09 (Phase 37): counts COMPLETED Movement Phases during the throw-in
   * sequence — `0` right after placement, `1` after Movement Phase 1, `2` after Movement
   * Phase 2 (D-09 hard cap: no third Movement Phase). null outside the throw-in sequence.
   */
  throwInPhasesTaken?: 0 | 1 | 2 | null;
  /** GOALKICK-01..06 (Phase 37): the team taking the goal kick. null outside the goal-kick sequence. */
  goalKickTeam?: 'home' | 'away' | null;
  /** GOALKICK-01..06 (Phase 37): the GK piece ID taking the goal kick. null outside the goal-kick sequence. */
  goalKickGkId?: string | null;
  /**
   * GOALKICK-02 (Phase 37): piece IDs eligible for the two sequential 6-hex reposition
   * windows (GK's team first, then the opponent) — copied from `freeMoveEligibleIds`'s
   * shape (NOT `FREE_KICK_STAGES`' distinct-piece-count budget). null outside
   * GOAL_KICK_SETUP_GK/GOAL_KICK_SETUP_OPPONENT.
   */
  goalKickEligibleIds?: { gkTeam: readonly string[]; opponent: readonly string[] } | null;
  /**
   * GOALKICK-02 (Phase 37): cumulative hexes used per piece during the goal-kick reposition
   * windows. Key = pieceId; value = hexes moved so far (max 6). Copied from
   * `freeMoveUsedPace`'s shape. null outside GOAL_KICK_SETUP_GK/GOAL_KICK_SETUP_OPPONENT.
   */
  goalKickUsedPace?: Readonly<Record<string, number>> | null;
  /** GOALKICK-04/05 (Phase 37): destination hex selected during GOAL_KICK_TARGET. null outside the goal-kick sequence. */
  goalKickTargetHex?: HexCoord | null;
  /**
   * GOALKICK-05 (Phase 37): whose repositioning slot is active during GOAL_KICK_MOVE.
   * 'KICKER' -> GK's team moves first; 'OPP' -> opponent moves. Copied from
   * `gkKickMovementSlot`'s shape. null outside GOAL_KICK_MOVE.
   */
  goalKickMoveSlot?: 'KICKER' | 'OPP' | null;
  /**
   * GOALKICK-05 (Phase 37): piece ID locked in for the current GOAL_KICK_MOVE slot. Copied
   * from `gkKickMovedPieceId`'s shape. null if no piece has moved yet in the current slot.
   */
  goalKickMovedPieceId?: string | null;
  /**
   * GOALKICK-05 (Phase 37): cumulative hexes moved by `goalKickMovedPieceId` in the current
   * GOAL_KICK_MOVE slot. Capped at 3. Copied from `gkKickPaceUsed`'s shape. Reset to 0 at
   * each slot transition.
   */
  goalKickPaceUsed?: number;
  /**
   * CORNER-01/CORNER-02 (Phase 38): the ATTACKING team awarded the corner kick — mirrors
   * `throwInTeam`/`goalKickTeam`. Persistent through to kick resolution; the persistent
   * value (not `lastActionType`) is what gates the Low-option accuracy check (see
   * `LastActionType.CORNER_KICK_RESTART`'s JSDoc). null outside the corner-kick sequence.
   */
  cornerKickTeam?: 'home' | 'away' | null;
  /**
   * CORNER-01 (Phase 38): the occupancy-resolved fixed corner hex, computed once at
   * trigger time from `CORNER_KICK_HEX` (`outOfBounds.ts`) via `resolveThrowInHex`.
   * Mirrors `throwInHex`. null outside the corner-kick sequence.
   */
  cornerKickHex?: HexCoord | null;
  /**
   * CORNER-02 (Phase 38): the piece ID chosen as corner-taker. null before selection or
   * outside the corner-kick sequence.
   */
  cornerKickTakerId?: string | null;
  /**
   * CORNER-02 (Phase 38): piece IDs eligible to be selected as corner-taker, precomputed
   * once at trigger time. Mirrors `goalKickEligibleIds`'s two-key shape. null outside
   * CORNER_KICK_TAKER_SELECT.
   */
  cornerKickEligibleIds?: { attacking: readonly string[]; defending: readonly string[] } | null;
  /**
   * CORNER-03 (Phase 38): index into `CORNER_KICK_STAGES` (`offside.ts`) — 0..5. Mirrors
   * `freeKickStageIndex`. null outside CORNER_KICK_REPOSITION.
   */
  cornerKickStageIndex?: 0 | 1 | 2 | 3 | 4 | 5 | null;
  /**
   * CORNER-03 (Phase 38): distinct piece IDs touched THIS stage, cap 2 per
   * `CORNER_KICK_STAGES[stageIndex].max`. Resets to `[]` at each stage transition. Mirrors
   * `freeKickPlacedPieceIds`. null outside CORNER_KICK_REPOSITION.
   */
  cornerKickStagePlacedIds?: readonly string[] | null;
  /**
   * CORNER-03 (Phase 38): cumulative hexes moved per piece across the corner-kick
   * reposition window, cap 6 per piece. Mirrors `goalKickUsedPace`'s shape. Pitfall-4
   * divergence (see `CORNER_KICK_STAGES`'s JSDoc in `offside.ts`): this field persists
   * across all 6 stages — it is NOT reset per stage, unlike `cornerKickStagePlacedIds`
   * above. null outside CORNER_KICK_REPOSITION.
   */
  cornerKickUsedPace?: Readonly<Record<string, number>> | null;
  /**
   * CORNER-06 (Phase 38): whose repositioning slot is active during CORNER_KICK_FINAL_SETUP.
   * 'ATTACKER' -> attacking team moves first; 'DEFENDER' -> defending team moves. Mirrors
   * `goalKickMoveSlot`'s shape. null outside CORNER_KICK_FINAL_SETUP.
   */
  cornerKickMoveSlot?: 'ATTACKER' | 'DEFENDER' | null;
  /**
   * CORNER-06 (Phase 38): piece ID locked in for the current CORNER_KICK_FINAL_SETUP slot.
   * Mirrors `goalKickMovedPieceId`. null if no piece has moved yet in the current slot.
   */
  cornerKickMovedPieceId?: string | null;
  /**
   * CORNER-06 (Phase 38): cumulative hexes moved by `cornerKickMovedPieceId` in the current
   * CORNER_KICK_FINAL_SETUP slot. Capped at 3. Mirrors `goalKickPaceUsed`. Reset to 0 at
   * each slot transition.
   */
  cornerKickPaceUsed?: number;
  /**
   * CORNER-03 (Phase 38 gap-closure round 2, 38-16, 38-15 defect 2): distinct piece IDs that
   * have been moved at least one hex during the `CORNER_KICK_REPOSITION` window and are
   * therefore "activated". Divergence from `cornerKickStagePlacedIds` (which resets to `[]`
   * at every stage transition): this set PERSISTS across all six stages and is what makes
   * CORNER-03's "up to 6 players" a count of six DISTINCT pieces per side. Cleared to `null`
   * on entry to `CORNER_KICK_FINAL_SETUP` so the pre-kick 3-hex move may use any eligible
   * piece, including one already repositioned. null outside CORNER_KICK_REPOSITION.
   */
  cornerKickActivatedIds?: readonly string[] | null;
  /**
   * D-GAP-02 (Phase 38 gap-closure round 2, 38-16): the goalkeeper who spilled a save and
   * thereby caused the current `LOOSE_BALL`. This is the ONLY signal that distinguishes a
   * spill-caused loose ball from the SHOT duel-tie loose ball (both set
   * `ball.lastTouchedBy` to the keeper); D-GAP-02's direction-only corner award is gated on
   * it. Must be nulled at every `LOOSE_BALL` resolution and in the corner-kick teardown.
   */
  gkSpillKeeperId?: string | null;
  /**
   * SETTINGS-01 (Phase 39): game-creation toggle for the Fouls system (FOUL-01..05).
   * Absent or `false` means the toggle is OFF. Every read site must test
   * `=== true`, mirroring the existing `outOfBoundsEnabled` comment above.
   */
  foulsEnabled?: boolean;
  /**
   * SETTINGS-02 (Phase 39): game-creation toggle for Bookings (CARD-01..04).
   * Absent or `false` means the toggle is OFF. Every read site must test `=== true`.
   */
  bookingEnabled?: boolean;
  /**
   * SETTINGS-03 (Phase 39): game-creation toggle for Injuries (INJURY-01..04).
   * Absent or `false` means the toggle is OFF. Every read site must test `=== true`.
   */
  injuryEnabled?: boolean;
  /** FOUL-01..05 (Phase 39): the defending player who committed the foul. null outside the foul sequence. */
  foulDefenderId?: string | null;
  /** FOUL-01..05 (Phase 39): the attacking player who was fouled. null outside the foul sequence. */
  foulVictimId?: string | null;
  /** FOUL-01..05 (Phase 39): the hex where the foul occurred (restart spot for FREE_KICK). null outside the foul sequence. */
  foulHex?: HexCoord | null;
  /** FOUL-01..05 (Phase 39): which duel type triggered the foul. null outside the foul sequence. */
  foulSource?: 'TACKLE' | 'STEAL' | 'GK_DIVE_AT_FEET' | null;
  /**
   * FOUL-03 (Phase 39): snapshots the phase/team/movementSlot/lastActionType that were
   * active immediately before the foul interrupted play, so a "continue play" choice can
   * resume exactly where the duel left off. Shape modelled on the existing `freeMoveResume`
   * field. null outside the foul sequence.
   */
  foulResume?: {
    phase: GamePhase;
    activeTeam: 'home' | 'away';
    attackingTeam: 'home' | 'away';
    movementSlot: MovementSlot | null;
    lastActionType: LastActionType | null;
  } | null;
  /**
   * 39-18 (UAT gap 1): set at the instant a foul is called — `true` when the duel that
   * produced the foul itself SUCCEEDED (possession already changed hands, so there is no
   * play left to continue), `false` otherwise. Read by `applyFoulChoice` to reject
   * `'continue'` when `true`. Cleared to `null` by `applyFoulChoice` on both the
   * `'continue'` and `'restart'` branches. null outside the foul sequence.
   */
  foulDuelSucceeded?: boolean | null;
  /**
   * GKDIVE-01..05/D-09 (Phase 39): SHARED once-per-movement-cycle (4-5-2) cap with the
   * existing shot-block GK_DIVE mechanic — reset at every fresh movement-cycle start
   * (39-12's `enterGkDiveOrSkip`/`applyStartMovement` et al.), NOT once per half.
   * null outside the dive-at-feet sequence.
   */
  gkDiveAtFeetUsedByTeam?: { home: boolean; away: boolean } | null;
  /** GKDIVE-01..05 (Phase 39): the team whose GK is offered the dive-at-feet duel. null outside the sequence. */
  gkDiveAtFeetTeam?: 'home' | 'away' | null;
  /** GKDIVE-01..05 (Phase 39): the GK piece ID offered the dive-at-feet duel. null outside the sequence. */
  gkDiveAtFeetGkId?: string | null;
  /** GKDIVE-01..05 (Phase 39): the ball-carrying attacker's piece ID targeted by the dive. null outside the sequence. */
  gkDiveAtFeetCarrierId?: string | null;
  /** GKDIVE-01..05 (Phase 39): hex distance between the GK and the carrier at offer time (drives the -1 at 3 hexes penalty). null outside the sequence. */
  gkDiveAtFeetDistance?: number | null;
  /**
   * GKDIVE-01..05 (Phase 39): snapshots phase/activeTeam/movementSlot to resume play after
   * the dive-at-feet duel resolves or is declined. null outside the sequence.
   */
  gkDiveAtFeetResume?: {
    phase: GamePhase;
    activeTeam: 'home' | 'away';
    movementSlot: MovementSlot | null;
  } | null;
  /**
   * D-10/D-11 (Phase 39): once-per-team-per-half cap for the box-entry response.
   * INDEPENDENT of the D-09 `gkDiveAtFeetUsedByTeam` cap above — a team may use both the
   * dive-at-feet duel AND the box-entry response in the same half.
   */
  gkBoxEntryUsedByTeam?: { home: boolean; away: boolean } | null;
  /** D-10 (Phase 39): the team whose GK is offered the box-entry response. null outside the sequence. */
  gkBoxEntryTeam?: 'home' | 'away' | null;
  /**
   * D-10 (Phase 39): snapshots phase/activeTeam/movementSlot to resume play after the
   * box-entry response resolves or is declined. null outside the sequence.
   */
  gkBoxEntryResume?: {
    phase: GamePhase;
    activeTeam: 'home' | 'away';
    movementSlot: MovementSlot | null;
  } | null;
  /** PEN-01..03 (Phase 39): the team taking the penalty kick (the KICKING team). null outside the penalty sequence. */
  penaltyKickTeam?: 'home' | 'away' | null;
  /** PEN-01..03 (Phase 39): the penalty spot hex (from `PENALTY_SPOT`, keyed by the defending team). null outside the sequence. */
  penaltyKickSpot?: HexCoord | null;
  /** PEN-02 (Phase 39): piece IDs eligible to reposition/be selected as taker, precomputed at trigger time. null outside the sequence. */
  penaltyKickEligibleIds?: { attacking: readonly string[]; defending: readonly string[] } | null;
  /** PEN-02 (Phase 39): cumulative hexes used per piece during the penalty reposition windows. null outside the sequence. */
  penaltyKickUsedPace?: Readonly<Record<string, number>> | null;
  /** PEN-02 (Phase 39): the piece ID chosen as penalty-taker. null before selection or outside the sequence. */
  penaltyKickTakerId?: string | null;
  /**
   * D-16 (Phase 39): each manager's confirmation to start the second half. Deliberately
   * copies `headerConfirmed`'s GameState-scoped `{home, away}` shape, NOT `LINEUP_CONFIRM`'s
   * Room-scoped flags — half-time is mid-match, and `Room` fields have no path into
   * `broadcastState` (RESEARCH.md Pitfall 4). null outside the half-time transition.
   */
  secondHalfConfirmed?: { home: boolean; away: boolean } | null;
};
