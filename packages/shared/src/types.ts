import type { TeamId } from './teamConfig.js';

export type HexCoord = { q: number; r: number };

export type PlayerPiece = {
  id: string;
  teamId: 'home' | 'away';
  position: HexCoord;
  pace: number;
  shooting: number;
  tackling: number;
  dribbling: number;
  heading: number;
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
};

export type BallState = {
  position: HexCoord;
  carrierId: string | null;
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
  | 'HP_ACCURACY'
  | 'HP_MOVE'
  | 'LOOSE_BALL_LAND'
  | 'DEFLECT_ATTEMPT'
  | 'GK_KICK'
  | 'GK_KICK_MOVE';

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
      attackerHeading: number | null;
      attackerCombined: number | null;
      defenderDie: number | null;
      defenderHeading: number | null;
      defenderCombined: number | null;
      timestamp: number;
    }
  | {
      type: 'HP_REPOSITION';
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
  | { type: 'LOOSE_BALL_LAND'; from: HexCoord; to: HexCoord; timestamp: number }
  | {
      type: 'GK_KICK';
      gkId: string;
      targetHex: HexCoord;
      accurate: boolean;
      kickDie: number;
      kickScore: number;
      timestamp: number;
    }
  | {
      type: 'GK_KICK_MOVE';
      slot: 'KICKER' | 'OPP';
      pieceId: string;
      from: HexCoord;
      to: HexCoord;
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
  // Phase 17 MOVE-06: free 6-hex move for players in opponent's final third
  | 'FREE_MOVE'
  | 'FIRST_TIME_PASS_MOVE' // D-03: repositioning phase after first-time pass target selected
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
  | 'SHOT';

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
   * D-15 / MOVE-06: set when the ball carrier crosses between final thirds.
   * Grants the scoring team a free 6-hex movement. Phase 5 enforces the grant.
   * null or absent when no free move is pending.
   */
  pendingFreeMove?: { team: 'home' | 'away'; hexesAllowed: number } | null;
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
   * MOVE-06 (Phase 17): piece IDs eligible for free 6-hex move (outfield players in opponent's third).
   * Set when entering FREE_MOVE phase; null outside FREE_MOVE.
   */
  freeMoveEligibleIds?: readonly string[] | null;
  /**
   * MOVE-06 (Phase 17): cumulative hexes used per piece during FREE_MOVE phase.
   * Key = pieceId; value = hexes moved so far (max 6).
   * null outside FREE_MOVE phase.
   */
  freeMoveUsedPace?: Readonly<Record<string, number>> | null;
  /**
   * PASS-02 (Phase 17): the piece ID of the player who made the First-time Pass.
   * Set when firstTimePassStep: 'ATTACKER' is entered so the handler can reject
   * attempts to move the passer. null outside this sub-state.
   */
  passerId?: string | null;
};
