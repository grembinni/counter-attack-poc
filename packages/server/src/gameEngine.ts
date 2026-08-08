/**
 * Pure-function game engine for Counter Attack.
 *
 * Provides all FSM transitions and state mutations as socket.io-free functions.
 * The server is the sole authority for all game logic — no client can influence
 * state transitions except by sending events that are re-validated here.
 *
 * ARCH-01: server-authoritative state — all transitions validated server-side.
 * D-12: buildInitialGameState called from roomHandlers after both teams picked (Phase 16).
 * D-13: attackingTeam assigned via coin flip using crypto.randomInt (never client-supplied).
 * D-14: FSM starts at KICK_OFF; applyStartMovement transitions to MOVEMENT.
 * TEAM-03: refereeCard assigned randomly at match start via crypto.randomInt(1, 7).
 */

import { randomInt } from 'crypto';
import type {
  GameState,
  GamePhase,
  GameSpeed,
  MovementSlot,
  ActionEvent,
  HexCoord,
  LastActionType,
  PlayerPiece,
  FormationSlot,
  SlotRole,
  PoolPlayer,
} from '@counter-attack/shared';
import type { TeamId } from '@counter-attack/shared';
import type { UniformStyleId } from '@counter-attack/shared';
import type { FormationId } from '@counter-attack/shared';
import {
  FORMATIONS,
  GAME_SPEED_MINUTES,
  getSquadPlayers,
  PITCH_REGIONS,
  PITCH_HEXES,
  GOAL_R_VALUES,
  isInRegion,
  isPitchHex,
  validateMove,
  computeCombinedScore,
  computeLooseBall,
  validatePass,
  validatePassAccuracy,
  validateShotDuel,
  validateHandlingCheck,
  validateGKDive,
  validateHeading,
  hexDistance,
  hexLine,
  computeBallZone,
  evaluateOffside,
  FREE_KICK_STAGES,
  freeKickStageTeam,
  cornerKickStageTeam,
  CORNER_KICK_STAGES,
  triggerOffsideFoul,
  classifyExit,
  bylineOwner,
  classifyOutOfBounds,
  resolveThrowInHex,
  GOAL_KICK_RESTART_HEX,
  CORNER_KICK_HEX,
} from '@counter-attack/shared';
import { ELIGIBLE_NEXT_ACTIONS } from '@counter-attack/shared';
// Note: HOME_SQUAD / AWAY_SQUAD are no longer used — replaced by getSquadPlayers runtime lookup (Phase 19).

// No socket.io imports — pure functions only (ARCH-01, established Phase 2/3 pattern).

/** 4-5-2 Movement Phase slot sequence. Used by advanceMovementSlot. D-03/D-04. */
const SLOT_SEQUENCE: readonly MovementSlot[] = ['ATTACKER_4', 'DEFENDER_5', 'ATTACKER_2'];

// BUG-14 (Phase 18.3): TESTING_PACE_OVERRIDE was previously used in applyMove to cap pace
// for test scenarios. Removed along with paceExhausted/effectivePace when the eager lock
// was removed. Pace enforcement is now handled entirely by validateMove (in moveValidator.ts).

/**
 * D-20 (IN-01): hoisted to module-level const — avoids reallocating the Set on every
 * applySnapshot call. Used in the SNAP-01 trigger (b) guard in applySnapshot.
 *
 * D-16 (WR-01): 'HIGH_PASS' intentionally excluded — after a HIGH_PASS, the phase
 * transitions to HEADER, never directly to PASS, so `phase === 'PASS'` with
 * `lastActionType === 'HIGH_PASS'` is impossible at runtime. Keeping it would be dead
 * code and could mask a regression if the FSM is changed.
 */
/**
 * BUG-12 feature toggle: when false (default), the FIRST_TIME_PASS_MOVE repositioning
 * sub-phase is skipped — the ball is delivered directly at targetHex and the next phase
 * proceeds as for a grounded pass. All FIRST_TIME_PASS_MOVE phase/handler code remains
 * intact; flipping this to true restores the repositioning flow.
 */
const FTP_MOVE_ENABLED = false;

const SNAPSHOT_ELIGIBLE_PASS_TYPES: ReadonlySet<LastActionType> = new Set([
  'STANDARD_PASS',
  'FIRST_TIME_PASS',
  // HIGH_PASS intentionally omitted (D-16): HIGH_PASS → HEADER, never → PASS directly
  'LONG_BALL',
  'HEADER',
  'DEFLECTION',
  'SUCCESSFUL_TACKLE',
  'MOVEMENT_PHASE',
]);

// ---------------------------------------------------------------------------
// computeAutoAssignment — Phase 24 ASSIGN-01
// ---------------------------------------------------------------------------

/**
 * Anchor roles are filled in Pass 2 before flex roles (Pass 3). D-02.
 * DEF-center, MID-central, FWD-central are anchor roles.
 */
const ANCHOR_ROLES: readonly SlotRole[] = ['DEF-center', 'MID-central', 'FWD-central'];

/**
 * Score a player for a specific formation slot role using the D-04 weighted formulas.
 *
 * Exported for direct unit testing in gameEngine.phase24.test.ts.
 * No randomness — pure function of player stats and role label.
 *
 * FWD-wing note (resolved assumption A1): `role === 'ST'` does NOT receive the +3 wing bonus.
 * Strikers are pulled central by the FWD-central +4 bonus instead (literal D-04 wording).
 */
export function scoreForRole(player: PoolPlayer, slotRole: SlotRole): number {
  const r = player.role;
  switch (slotRole) {
    case 'FWD-central':
      // D-04: shooting + aerialAbility + (2 if role=FWD) + (4 if role=ST)
      return player.shooting + player.aerialAbility + (r === 'FWD' ? 2 : 0) + (r === 'ST' ? 4 : 0);
    case 'FWD-wing':
      // D-04: dribbling + highPass + (3 if role=FWD) + (2 if role=MID)
      // ST intentionally excluded from the +3 bonus (A1 resolved).
      return player.dribbling + player.highPass + (r === 'FWD' ? 3 : 0) + (r === 'MID' ? 2 : 0);
    case 'DEF-center':
      // D-04: tackling + aerialAbility + (2 if role=DEF)
      return player.tackling + player.aerialAbility + (r === 'DEF' ? 2 : 0);
    case 'DEF-back':
      // D-04: tackling + pace + (2 if role=DEF)
      return player.tackling + player.pace + (r === 'DEF' ? 2 : 0);
    case 'MID-central':
      // D-04: dribbling + tackling + pace + shooting + (3 if role=MID)
      return (
        player.dribbling + player.tackling + player.pace + player.shooting + (r === 'MID' ? 3 : 0)
      );
    case 'MID-wing':
      // D-04: dribbling + highPass + (3 if role=FWD) + (2 if role=MID)
      // Identical formula to FWD-wing per Phase 23 deferred design.
      return player.dribbling + player.highPass + (r === 'FWD' ? 3 : 0) + (r === 'MID' ? 2 : 0);
    case 'GK':
      // GK is locked in Pass 1; never scored here.
      return 0;
  }
}

/**
 * Pick the best available player for a given slot role.
 * Sorts by score descending, then by original squad index ascending for tie-breaking (D-05).
 * Never uses Math.random — fully deterministic.
 *
 * IMPORTANT: returns the same object reference as found in `available` (not a spread copy)
 * so that the caller's `available.indexOf(best)` + `splice` correctly removes it.
 */
function pickBest(
  available: Array<{ player: PoolPlayer; origIdx: number }>,
  slotRole: SlotRole,
): { player: PoolPlayer; origIdx: number } {
  // Shallow copy preserves object identity — sorted[0] IS the same reference as in available.
  return [...available].sort((a, b) => {
    const sa = scoreForRole(a.player, slotRole);
    const sb = scoreForRole(b.player, slotRole);
    // Higher score wins; on tie, prefer lower origIdx (D-05: source-team array order).
    return sb !== sa ? sb - sa : a.origIdx - b.origIdx;
  })[0]!;
}

/**
 * Assign 11 squad players to 11 formation slots using weighted stat scoring. ASSIGN-01.
 *
 * Three-pass greedy strategy (D-01/D-02/D-03):
 *   Pass 1 — Lock the GK (role === 'GK') to slot index 0.
 *   Pass 2 — Fill ANCHOR_ROLES slots from remaining players, in slot index order.
 *   Pass 3 — Fill all remaining (flex) slots from remaining players.
 *
 * Tie-breaking: prefer the player with the lower original squad index (D-05).
 * No randomness — identical squad always produces identical assignment (T-24-06).
 *
 * @param squad  - All players eligible for selection (typically getSquadPlayers(teamId)).
 * @param slots  - The formation's slot definitions (readonly; not mutated).
 * @returns      - PoolPlayer[] with one entry per slot in the same order as `slots`.
 */
export function computeAutoAssignment(
  squad: PoolPlayer[],
  slots: readonly FormationSlot[],
): PoolPlayer[] {
  const result: (PoolPlayer | null)[] = new Array<PoolPlayer | null>(slots.length).fill(null);
  // Track original squad indices for deterministic tie-breaking (D-05).
  const available: Array<{ player: PoolPlayer; origIdx: number }> = squad.map((p, i) => ({
    player: p,
    origIdx: i,
  }));

  // --- Pass 1: Lock GK to slot 0 (D-01) ---
  const gkEntry = available.find((e) => e.player.role === 'GK');
  if (gkEntry) {
    result[0] = gkEntry.player;
    available.splice(available.indexOf(gkEntry), 1);
  }

  // --- Pass 2: Fill anchor roles (D-02) ---
  for (let i = 1; i < slots.length; i++) {
    if (!ANCHOR_ROLES.includes(slots[i]!.slotRole)) continue;
    const best = pickBest(available, slots[i]!.slotRole);
    result[i] = best.player;
    available.splice(available.indexOf(best), 1);
  }

  // --- Pass 3: Fill flex roles (D-03) ---
  for (let i = 1; i < slots.length; i++) {
    if (result[i] !== null) continue; // already filled in pass 2
    const best = pickBest(available, slots[i]!.slotRole);
    result[i] = best.player;
    available.splice(available.indexOf(best), 1);
  }

  return result as PoolPlayer[];
}

// ---------------------------------------------------------------------------
// buildInitialGameState
// ---------------------------------------------------------------------------

/**
 * Builds the real initial GameState after both teams are selected.
 *
 * D-12 (updated Phase 16): called from roomHandlers TEAM_PICK handler once both teams are chosen.
 * D-13: attackingTeam determined by server-side coin flip — never client-supplied.
 * D-14: phase starts at 'KICK_OFF_SETUP'; no player event needed to reach this state.
 * D-15: selectedTeams embedded in every subsequent snapshot.
 * D-16: away pieces mirrored via q_away = 36 - q_home; ids re-prefixed home- → away-.
 * TEAM-01: all 22 players (11 home + 11 away) placed at starting positions.
 * TEAM-03: refereeCard.leniency is randomly assigned in range 1–6 at match start.
 */
/**
 * Builds a full 22-piece array for both squads at their formation start positions,
 * with the striker positioned for kick-off based on which team is attacking.
 * Extracted to eliminate duplication between buildInitialGameState and buildKickOffPieces.
 */
function buildSquadPieces(
  attackingTeam: 'home' | 'away',
  selectedTeams: { home: TeamId; away: TeamId },
  selectedFormation: { home: FormationId; away: FormationId },
  /** Phase 24 D-11: explicit player ordering for home; falls back to getSquadPlayers when absent. */
  confirmedHomeOrder?: PoolPlayer[],
  /** Phase 24 D-11: explicit player ordering for away; falls back to getSquadPlayers when absent. */
  confirmedAwayOrder?: PoolPlayer[],
): PlayerPiece[] {
  const homeSlots = FORMATIONS[selectedFormation.home].slots;
  const awaySlots = FORMATIONS[selectedFormation.away].slots;
  // Use confirmed ordering when provided (Phase 24 LINEUP_CONFIRM path); fall back to default
  // squad order so that all existing callers (buildKickOffPieces) remain unchanged (Pitfall 8).
  const homePlayers = confirmedHomeOrder ?? getSquadPlayers(selectedTeams.home);
  const awayPlayers = confirmedAwayOrder ?? getSquadPlayers(selectedTeams.away);
  const homeSquad = homePlayers.map((p, i) => ({
    ...p,
    teamId: 'home' as const,
    id: `home-${i}`,
    position: { ...homeSlots[i]!.position }, // spread — never mutate the readonly slot (T-23-01)
    number: homeSlots[i]!.jerseyNumber,
  }));
  const awaySquad = awayPlayers.map((p, i) => ({
    ...p,
    teamId: 'away' as const,
    id: `away-${i}`,
    position: { q: 36 - awaySlots[i]!.position.q, r: awaySlots[i]!.position.r }, // away mirror
    number: awaySlots[i]!.jerseyNumber,
  }));
  const pieces = [...homeSquad, ...awaySquad];

  // Kick-off +4 shift: kicking team outfield pieces move 4 hexes toward the centre.
  // GK is exempt; non-kicking team positions are unchanged (CONTEXT D-16).
  for (const piece of pieces) {
    if (piece.teamId !== attackingTeam) continue;
    if (piece.role === 'GK') continue;
    if (attackingTeam === 'home') {
      piece.position = { q: piece.position.q + 4, r: piece.position.r };
    } else {
      piece.position = { q: piece.position.q - 4, r: piece.position.r };
    }
  }

  // Anchor jersey-#9 of the kicking team to the kick-off hex (Pitfall 2: use number, not role).
  const kickingStriker = pieces.find((p) => p.teamId === attackingTeam && p.number === 9);
  if (!kickingStriker) {
    // WR-02: Log diagnostic if striker absent — game proceeds with pieces at formation positions.
    console.error(
      `buildSquadPieces: missing jersey-#9 for attacking team=${attackingTeam} (selectedTeams: ${JSON.stringify(selectedTeams)})`,
    );
  } else {
    kickingStriker.position = { ...PITCH_REGIONS.kickOffHex };
  }

  // Forward-line wing-forward shift: defending team only.
  // Attacking team's forward line is already at q:14+4=q:18 (halfway) — adding more would be illegal.
  // Finds the top (min r) and bottom (max r) pieces on the defending team's forward q column
  // and advances each by 2 hexes toward the centre.
  const defendingTeam: 'home' | 'away' = attackingTeam === 'home' ? 'away' : 'home';
  const defendingFwdQ = defendingTeam === 'home' ? 14 : 22; // home fwd at q:14; away mirror: 36-14=22
  const fwdDir = defendingTeam === 'home' ? 1 : -1;
  const defendingFwdLine = pieces
    .filter((p) => p.teamId === defendingTeam && p.position.q === defendingFwdQ)
    .sort((a, b) => a.position.r - b.position.r);
  if (defendingFwdLine.length >= 2) {
    defendingFwdLine[0]!.position = {
      q: defendingFwdLine[0]!.position.q + 2 * fwdDir,
      r: defendingFwdLine[0]!.position.r,
    };
    const last = defendingFwdLine[defendingFwdLine.length - 1]!;
    last.position = { q: last.position.q + 2 * fwdDir, r: last.position.r };
  }

  return pieces;
}

export function buildInitialGameState(
  roomCode: string,
  selectedTeams: { home: TeamId; away: TeamId },
  gameSpeed: GameSpeed = 'standard',
  selectedUniformStyles: { home: UniformStyleId; away: UniformStyleId },
  selectedFormation: { home: FormationId; away: FormationId } = { home: '4-4-2', away: '4-4-2' },
  selectedJerseyTypes: { home: 'home' | 'away'; away: 'home' | 'away' } = {
    home: 'home',
    away: 'away',
  },
  /** Phase 24 D-11: explicit player ordering for home team, produced by LINEUP_CONFIRM handler. */
  confirmedHomeOrder?: PoolPlayer[],
  /** Phase 24 D-11: explicit player ordering for away team, produced by LINEUP_CONFIRM handler. */
  confirmedAwayOrder?: PoolPlayer[],
  /**
   * GOALKICK-06 / OOB-05 (Phase 37): Out-of-Bounds/Restarts toggle baked into GameState
   * at match start from Room.outOfBoundsEnabled. Defaults to `false` — the disabled path
   * is the safe default so existing boundary-clamp behaviour is unchanged when the
   * toggle is off.
   */
  outOfBoundsEnabled: boolean = false,
): GameState {
  const attackingTeam: 'home' | 'away' = randomInt(0, 2) === 0 ? 'home' : 'away'; // D-13 coin flip

  const pieces = buildSquadPieces(
    attackingTeam,
    selectedTeams,
    selectedFormation,
    confirmedHomeOrder,
    confirmedAwayOrder,
  );

  return {
    roomCode,
    phase: 'KICK_OFF_SETUP', // D-23: both teams reposition before kick-off; ready confirms advance
    activeTeam: attackingTeam,
    attackingTeam,
    pieces, // TEAM-01: all 22 loaded at match start; ST positioned by coin flip
    ball: { position: PITCH_REGIONS.kickOffHex, carrierId: null, lastTouchedBy: null }, // fresh match state — nobody has touched the ball yet
    score: { home: 0, away: 0 },
    actionCount: 0,
    half: 1,
    eventLog: [],
    refereeCard: { leniency: randomInt(1, 7) }, // TEAM-03: random 1–6
    movedPieceIds: [],
    paceUsedByPieceId: {},
    movementSlot: null,
    // MOVE-06 (Phase 17, corrected design D-33): kick-off hex {q:18,r:13} is in
    // middleThird — ballZone starts 'middle'.
    ballZone: 'middle',
    // Phase 8 additions (D-06)
    addedTime: null, // null until actionCount first crosses 45
    lastActionType: null, // null at match start; updated after every action
    kickOffTeam: attackingTeam, // coin-flip winner kicks off (D-06, D-26)
    kickOffActive: false,
    selectedTeams, // D-15: embedded in every subsequent snapshot
    selectedUniformStyles, // Phase 22 D-17: home/away kit choices embedded in every snapshot
    selectedJerseyTypes, // jersey variant (home/away kit) each team is wearing
    selectedFormation, // Phase 23 D-11: formation choices embedded in every snapshot
    gameSpeed, // UX-07 (Phase 18.4): drives per-MOVE clock increment
    outOfBoundsEnabled, // GOALKICK-06 / OOB-05 (Phase 37): Out-of-Bounds/Restarts toggle
  };
}

/**
 * Returns a fresh pieces array at formation start positions for the given kick-off team.
 * Used after a goal to reset all players to their default positions.
 *
 * A4 (Phase 16): now takes selectedTeams so post-goal resets keep the correct squads.
 * D-16: away pieces mirrored via q_away = 36 - q_home; ids re-prefixed home- → away-.
 */
export function buildKickOffPieces(
  attackingTeam: 'home' | 'away',
  selectedTeams: { home: TeamId; away: TeamId },
  selectedFormation: { home: FormationId; away: FormationId } = { home: '4-4-2', away: '4-4-2' },
) {
  return buildSquadPieces(attackingTeam, selectedTeams, selectedFormation);
}

// ---------------------------------------------------------------------------
// advanceMovementSlot
// ---------------------------------------------------------------------------

/**
 * Computes the next slot and phase when the current slot ends.
 *
 * D-03: slot sequence is ATTACKER_4 → DEFENDER_5 → ATTACKER_2.
 * D-04: after ATTACKER_2, the phase transitions to PASS automatically.
 *
 * Uses the explicit SLOT_SEQUENCE array — no if/else slot chains (STATE.md locked decision).
 */
export function advanceMovementSlot(state: GameState): {
  nextSlot: MovementSlot | null;
  nextPhase: GamePhase;
} {
  const idx = SLOT_SEQUENCE.indexOf(state.movementSlot!);
  if (idx === SLOT_SEQUENCE.length - 1) {
    return { nextSlot: null, nextPhase: 'PASS' }; // D-04: ATTACKER_2 → PASS (CHOOSE_ACTION rename deferred)
  }
  return { nextSlot: SLOT_SEQUENCE[idx + 1]!, nextPhase: 'MOVE' }; // D-03
}

// ---------------------------------------------------------------------------
// applyStartMovement
// ---------------------------------------------------------------------------

/** Discriminated union result for applyStartMovement. */
export type ApplyStartMovementResult =
  | { ok: false; reason: 'WRONG_PHASE' }
  | { ok: true; state: GameState };

/**
 * Transitions the FSM from KICK_OFF → MOVEMENT/ATTACKER_4.
 *
 * D-14: the wire path that makes the Movement Phase reachable.
 * T-4-05: the handler (Wave 3) restricts this event to the attacking team's socket;
 *         the engine rejects it outside KICK_OFF phase.
 *
 * WR-04: activeTeam validation is intentionally enforced at the handler layer
 *         (T-4-05), not here. The engine trusts that the handler has already
 *         confirmed the caller is the activeTeam before invoking this function.
 *         This is a deliberate architectural choice — the engine remains a pure
 *         state-transition function, not an authorization boundary.
 *
 * Appends a KICK_OFF ActionEvent to mark the kick-off→movement edge.
 */
export function applyStartMovement(state: GameState): ApplyStartMovementResult {
  if (state.phase !== 'KICK_OFF' && state.phase !== 'PASS' && state.phase !== 'LOOSE_BALL') {
    return { ok: false, reason: 'WRONG_PHASE' };
  }

  // From KICK_OFF: find the piece standing on the ball's position (the kicker) and assign them
  // the ball so the carrier is set before movement begins.
  // From CHOOSE_ACTION (after steal/tackle): ball.carrierId is already correct — leave ball state as-is.
  // From LOOSE_BALL: ball.carrierId is null — leave as-is; pickup happens in applyMove.
  let newBall = state.ball;
  if (state.phase === 'KICK_OFF') {
    const kicker = state.pieces.find(
      (p) => p.position.q === state.ball.position.q && p.position.r === state.ball.position.r,
    );
    if (kicker) newBall = { ...state.ball, carrierId: kicker.id };
  }

  return {
    ok: true,
    state: {
      ...state,
      phase: 'MOVE',
      movementSlot: 'ATTACKER_4',
      activeTeam: state.attackingTeam,
      ball: newBall,
      eventLog: state.eventLog,
      // Always reset movement tracking here — CHOOSE_ACTION state normally carries [] but defensive
      // paths (snapshot miss → LOOSE_BALL → CHOOSE_ACTION) can carry stale ids from the prior slot.
      // Plan 31-06 (BUG-31 family): merge in any carried header-winner spent ids so the winner
      // stays unselectable for exactly this one Movement Phase, then clear the carry below.
      movedPieceIds: [...(state.carriedMovedPieceIds ?? [])],
      paceUsedByPieceId: {},
      // Plan 31-06: the carry is consumed above — clear it so it does not persist beyond this
      // single Movement Phase transition.
      carriedMovedPieceIds: [],
      // D-21 / HEAD-05: clear contestedPieceIds after one Movement Phase so the exclusion
      // applies to exactly one movement sequence. applyMove checks contestedPieceIds to
      // reject contested pieces at move-time (Pitfall 6 — cleared here, not in HEADER branch).
      contestedPieceIds: [],
      stealAttemptedByIds: [], // D-29: reset per-phase steal tracking at Movement Phase start
      tackleAttemptedByIds: [], // D-29: reset per-phase tackle tracking at Movement Phase start
      // BUG-18 (Phase 18.3): clear lastDiceRoll so canUndo's guard (`if (lastDiceRoll) return
      // false`) does not block Undo in the MOVE phase. applyStartMovement is the dominant entry
      // point into MOVE (from PASS/KICK_OFF/LOOSE_BALL). Mirror the existing GK_RESTART
      // 'movement' branch (~line 2470) which already does this correctly.
      lastDiceRoll: null,
    },
  };
}

// ---------------------------------------------------------------------------
// applyFreeMove
// ---------------------------------------------------------------------------

/**
 * Handles a single-step piece move during the MOVE-06 FREE_MOVE_ATTACK/FREE_MOVE_DEFENSE
 * sub-phases (Phase 17, corrected design D-34/D-35).
 *
 * Each piece in the active sub-phase's eligible list (`freeMoveEligibleIds.attack` for
 * FREE_MOVE_ATTACK, `.defense` for FREE_MOVE_DEFENSE) gets an independent 6-hex
 * allowance — not a shared pool. A step is rejected if the piece is not eligible for the
 * CURRENT sub-phase, belongs to the wrong team, isn't a single adjacent hex, lands on an
 * occupied hex, or would push the piece's cumulative `freeMoveUsedPace` beyond 6.
 * Standard adjacency/occupancy rules (mirroring MOVEMENT) apply unchanged.
 */
function applyFreeMove(state: GameState, pieceId: string, to: HexCoord): ApplyMoveResult {
  const piece = state.pieces.find((p) => p.id === pieceId);
  if (!piece) return { ok: false, reason: 'PIECE_NOT_FOUND' };

  if (piece.teamId !== state.activeTeam) {
    return { ok: false, reason: 'WRONG_TEAM' };
  }

  const eligibleIds =
    state.phase === 'FREE_MOVE_ATTACK'
      ? (state.freeMoveEligibleIds?.attack ?? [])
      : (state.freeMoveEligibleIds?.defense ?? []);
  if (!eligibleIds.includes(pieceId)) {
    return { ok: false, reason: 'MOVE_INVALID', detail: 'NOT_ELIGIBLE' };
  }
  // Already activated this sub-phase (exhausted its 6 hexes, or abandoned when the player
  // switched to a different piece) — mirrors regular MOVEMENT's movedPieceIds lock (UX-parity
  // fix: previously-active free-move pieces never showed the "activated" state or became
  // unselectable like they do in regular MOVEMENT).
  if (state.movedPieceIds.includes(pieceId)) {
    return { ok: false, reason: 'MOVE_INVALID', detail: 'FREE_MOVE_EXHAUSTED' };
  }

  // Standard adjacency/occupancy validation (mirrors MOVEMENT's validateMove checks 2+3).
  if (hexDistance(piece.position, to) !== 1) {
    return { ok: false, reason: 'MOVE_INVALID', detail: 'OUT_OF_RANGE' };
  }
  // T-37-66 (Plan 37-15, closing the sibling threat 37-13 accepted and required be
  // carried): mirrors applyGoalKickReposition's isPitchHex guard verbatim in shape
  // and comment style. Adjacency is checked first so a distant off-pitch hex still
  // returns OUT_OF_RANGE; OFF_PITCH precedes OCCUPIED because no piece can ever
  // occupy an off-pitch hex, so the two checks are mutually exclusive.
  if (!isPitchHex(to)) {
    return { ok: false, reason: 'MOVE_INVALID', detail: 'OFF_PITCH' };
  }
  if (state.pieces.some((p) => p.position.q === to.q && p.position.r === to.r)) {
    return { ok: false, reason: 'MOVE_INVALID', detail: 'OCCUPIED' };
  }

  const stepDistance = 1; // single-step adjacency already enforced above
  const usedSoFar = (state.freeMoveUsedPace ?? {})[pieceId] ?? 0;
  if (usedSoFar + stepDistance > 6) {
    return { ok: false, reason: 'MOVE_INVALID', detail: 'FREE_MOVE_EXHAUSTED' };
  }

  const newUsed = usedSoFar + stepDistance;
  // BUG-14 (Phase 18.3): paceExhausted is no longer used to lock the piece into
  // movedPieceIds. Locking defers to the abandonedIds sweep (isNewActivation check below).
  // Mirrors regular MOVEMENT's abandonment rule (see applyMove's paceUsedByPieceId handling
  // above): starting a brand-new activation on this piece (usedSoFar === 0) abandons any
  // OTHER piece that has an in-progress, unfinished free-move activation (has a
  // freeMoveUsedPace entry but isn't yet in movedPieceIds) — the player chose to move on, so
  // the previous unit is locked in as activated even though it didn't use its full 6 hexes.
  const isNewActivation = usedSoFar === 0;
  const abandonedIds = isNewActivation
    ? Object.keys(state.freeMoveUsedPace ?? {}).filter(
        (id) => id !== pieceId && !state.movedPieceIds.includes(id),
      )
    : [];
  const newMovedPieceIds = new Set(state.movedPieceIds);
  for (const id of abandonedIds) newMovedPieceIds.add(id);
  // BUG-14 (Phase 18.3): mirrors the fix in computeMovedPieceIds — do NOT add pieceId
  // purely because paceExhausted. The abandonedIds sweep above locks the piece once a
  // DIFFERENT piece is activated (isNewActivation), preserving Snapshot availability
  // for as long as the exhausted-pace piece remains the actively-selected piece.

  const newPieces = state.pieces.map((p) => (p.id === pieceId ? { ...p, position: to } : p));
  const moveEvent: ActionEvent = {
    type: 'MOVE',
    pieceId,
    from: piece.position,
    to,
    // FREE_MOVE has no movementSlot (it's not part of the 4-5-2 sequence); ATTACKER_2 is
    // the closest semantic match (independent per-piece activation, no steal/tackle effects).
    slot: 'ATTACKER_2',
    timestamp: Date.now(),
    // Ball unchanged during FREE_MOVE — narrow to {position, carrierId} (ballAfter never
    // carries lastTouchedBy, per Task 2 design note).
    ballAfter: { position: state.ball.position, carrierId: state.ball.carrierId },
  };

  return {
    ok: true,
    state: {
      ...state,
      pieces: newPieces,
      eventLog: [...state.eventLog, moveEvent],
      freeMoveUsedPace: {
        ...(state.freeMoveUsedPace ?? {}),
        [pieceId]: newUsed,
      },
      movedPieceIds: [...newMovedPieceIds],
    },
  };
}

// ---------------------------------------------------------------------------
// checkHalfEndOnTackle
// ---------------------------------------------------------------------------

/**
 * GAP-2 (CR-01): checks whether a tackle/steal success has pushed the clock past halfEnd.
 *
 * Called from the three tackle/steal success return paths in applyMove to mirror the
 * half-end logic in applyEndTurn (lines 921-932). Does NOT re-roll addedTime — the
 * "set once per half" invariant is owned by applyEndTurn; here we only READ state.addedTime.
 *
 * Returns 'HALF_TIME' (half 1) or 'FULL_TIME' (half 2) when the clock crosses halfEnd;
 * returns null when addedTime is not yet set (not in added time) or threshold not reached.
 */
export function checkHalfEndOnTackle(
  state: GameState,
  newActionCount: number,
): 'HALF_TIME' | 'FULL_TIME' | null {
  const HALF_LENGTH = state.half * 45;
  const addedTime = state.addedTime;
  if (addedTime === null) return null; // not yet in added time — no half-end possible mid-tackle
  const halfEnd = HALF_LENGTH + addedTime;
  if (newActionCount < halfEnd) return null;
  return state.half === 1 ? 'HALF_TIME' : 'FULL_TIME';
}

// THROWIN-03/CR-01: single shared teardown literal for a throw-in context.
// Every early return that ends a Movement Phase without routing through
// applyEndTurn (tackle success, steal success, defending-team loose-ball
// pickup — all "break in play" outcomes) MUST spread this so a stale
// throwInHex/throwInTeam/throwInPhasesTaken cannot survive to re-arm
// applyEndTurn's throw-in branch on a later, unrelated Movement Phase.
// Not exported: nothing outside this module needs it.
const THROW_IN_TEARDOWN = {
  throwInHex: null,
  throwInTeam: null,
  throwInPhasesTaken: null,
} as const;

// CORNER-04/T-38-14 (Phase 38, 38-04): single shared teardown literal for a corner-kick
// context. Every branch in applyRoll's PASS case that resolves a corner kick (accurate or
// inaccurate, High or Low) MUST spread this so a stale cornerKick* field cannot survive to
// mis-gate a later, unrelated STANDARD_PASS (T-38-14). Applied UNCONDITIONALLY at every PASS
// resolving return (not just the corner-specific branches) — spreading already-null fields is
// a harmless no-op for a non-corner pass, and a single unconditional teardown is simpler and
// safer than three conditional variants (Pitfall-3 audit, Task 3). Not exported: nothing
// outside this module needs it.
const CORNER_KICK_TEARDOWN = {
  cornerKickTeam: null,
  cornerKickHex: null,
  cornerKickTakerId: null,
  cornerKickEligibleIds: null,
  cornerKickStageIndex: null,
  cornerKickStagePlacedIds: null,
  cornerKickUsedPace: null,
  cornerKickMoveSlot: null,
  cornerKickMovedPieceId: null,
  cornerKickPaceUsed: 0,
} as const;

// ---------------------------------------------------------------------------
// applyMove
// ---------------------------------------------------------------------------

/**
 * Discriminated union result for applyMove.
 *
 * 'WRONG_PHASE' (Plan 37-08 / GOALKICK-02) widens this union so
 * `applyGoalKickReposition` can reuse it verbatim — its phase guard rejects
 * outside GOAL_KICK_SETUP_GK/GOAL_KICK_SETUP_OPPONENT, which is a phase-family
 * mismatch, not a movement-slot mismatch (WRONG_SLOT is reserved for the
 * regular MOVEMENT phase's movementSlot invariant). Recorded as a deviation
 * in 37-08-SUMMARY.md per the plan's explicit instruction.
 */
export type ApplyMoveResult =
  | {
      ok: false;
      reason: 'WRONG_SLOT' | 'WRONG_TEAM' | 'PIECE_NOT_FOUND' | 'MOVE_INVALID' | 'WRONG_PHASE';
      detail?: string;
    }
  | { ok: true; state: GameState };

/**
 * Applies a piece movement action.
 *
 * Guard precedence (T-4-01, D-01, D-06):
 * 1. WRONG_SLOT — phase must be MOVEMENT and movementSlot must be set
 * 2. PIECE_NOT_FOUND — pieceId must match a piece in state.pieces
 * 3. WRONG_TEAM — piece must belong to the team that acts in the current slot
 * 4. MOVE_INVALID — validateMove must accept the move
 *
 * On success: repositions the piece, increments paceUsedByPieceId, appends MOVE event.
 * MOVE-06 (corrected design): the ball-zone-triggered free-move check no longer lives here —
 * `applyFreeMoveZoneCheck` runs centrally in `broadcastState` after every resolved action,
 * comparing the post-action ball position's zone against `state.ballZone` (D-33).
 * T-4-03: MOVE event records server-derived from-coord — never the client's claimed position.
 * D-01: movementSlot is NOT auto-advanced on move success; applyEndTurn advances it.
 *
 * @param state  - Current game state (phase must be MOVEMENT)
 * @param pieceId - ID of the piece to move
 * @param to     - Destination hex coordinate
 * @param dice   - Optional pre-generated dice (injected for determinism — D-08/D-12).
 *                 stealDie: used for STEAL_ATTEMPT resolution.
 *                 tackleDie: used for TACKLE_ATTEMPT defender roll.
 *                 carrierDie: used for TACKLE_ATTEMPT carrier roll.
 *                 Defaults to 3 (mid-range) when omitted — backward-compatible fallback.
 */
export function applyMove(
  state: GameState,
  pieceId: string,
  to: HexCoord,
  dice?: { stealDie: number; tackleDie: number; carrierDie: number },
): ApplyMoveResult {
  // MOVE-06 (Phase 17, corrected design D-34/D-35): FREE_MOVE_ATTACK/FREE_MOVE_DEFENSE
  // sub-phases — each eligible piece (both teams, GK included) gets an independent
  // 6-hex allowance tracked in freeMoveUsedPace. Handled before the MOVEMENT-only phase
  // guard below since these sub-phases have no movementSlot.
  if (state.phase === 'FREE_MOVE_ATTACK' || state.phase === 'FREE_MOVE_DEFENSE') {
    return applyFreeMove(state, pieceId, to);
  }

  // 1. Phase guard
  if (state.phase !== 'MOVE' || state.movementSlot === null) {
    return { ok: false, reason: 'WRONG_SLOT' };
  }

  // 2. Piece lookup
  const piece = state.pieces.find((p) => p.id === pieceId);
  if (!piece) return { ok: false, reason: 'PIECE_NOT_FOUND' };

  // 2.5. HEAD-05 / D-21: reject contested pieces from the Movement Phase following a header.
  // contestedPieceIds is cleared in applyStartMovement after one Movement Phase,
  // but may be injected on state by tests or carried from a non-standard path.
  if ((state.contestedPieceIds ?? []).includes(pieceId)) {
    return { ok: false, reason: 'MOVE_INVALID', detail: 'CONTESTED_PIECE' };
  }

  // 3. Team guard (T-4-01) — use state.activeTeam (authoritative after D-30 pickup mid-slot)
  if (piece.teamId !== state.activeTeam) {
    return { ok: false, reason: 'WRONG_TEAM' };
  }

  // 4. Delegate to validator
  const result = validateMove(state, piece, to);
  if (!result.ok) {
    return { ok: false, reason: 'MOVE_INVALID', detail: result.reason };
  }

  // 5. Build new state via spread (immutable — never mutate readonly arrays, RESEARCH Pitfall 1)
  const newPieces = state.pieces.map((p) => (p.id === pieceId ? { ...p, position: to } : p));

  // movedPieceIds tracking: a piece is "spent" when its pace is exhausted after this step.
  // When a NEW activation starts (paceUsed was 0), any other mid-activation piece is abandoned
  // and also added to movedPieceIds (the player chose to stop them early).
  const currentPaceUsed = state.paceUsedByPieceId[pieceId] ?? 0;
  const newPaceForPiece = currentPaceUsed + 1;
  const isNewActivation = currentPaceUsed === 0;
  // BUG-14 (Phase 18.3): paceExhausted and effectivePace removed — they were only used
  // to eagerly lock the carrier into movedPieceIds. Piece locking now defers to the
  // abandonedIds sweep (when a DIFFERENT piece is next activated — see computeMovedPieceIds).
  // The ATTACKER_2 pace cap (2 hexes) is still enforced inside validateMove independently.
  const abandonedIds = isNewActivation
    ? Object.keys(state.paceUsedByPieceId).filter(
        (id) => id !== pieceId && !state.movedPieceIds.includes(id),
      )
    : [];
  const computeMovedPieceIds = (forceIncludeSelf = false): string[] => {
    const ids = new Set(state.movedPieceIds);
    for (const id of abandonedIds) ids.add(id);
    // BUG-14 (Phase 18.3): do NOT add pieceId here purely because paceExhausted — that
    // eagerly locks the carrier out of Snapshot while they are still the selected piece.
    // The abandonedIds sweep (above) already handles locking: a piece is only added to
    // movedPieceIds when the player next activates a DIFFERENT piece (isNewActivation).
    // forceIncludeSelf is still respected — it is used to stage end-of-slot slot-advance.
    if (forceIncludeSelf) ids.add(pieceId);
    return [...ids];
  };

  const ballAfterMove: { position: HexCoord; carrierId: string | null } =
    state.ball.carrierId === pieceId
      ? { position: to, carrierId: pieceId }
      : state.ball.carrierId === null &&
          to.q === state.ball.position.q &&
          to.r === state.ball.position.r
        ? { position: to, carrierId: pieceId }
        : { position: state.ball.position, carrierId: state.ball.carrierId };
  const moveEvent: ActionEvent = {
    type: 'MOVE',
    pieceId,
    from: piece.position, // server-derived — T-4-03; client from-coord is never trusted
    to,
    slot: state.movementSlot,
    timestamp: Date.now(),
    ballAfter: ballAfterMove,
  };

  let newEventLog: readonly ActionEvent[] = [...state.eventLog, moveEvent];

  // D-13/D-14 ball position fix: if the moving piece is the carrier, track ball to `to`.
  // Computed here for all non-contest paths; overridden on contest success paths below.
  const newBall = state.ball.carrierId === pieceId ? { ...state.ball, position: to } : state.ball;

  // Loose ball pickup: piece steps onto the hex where the ball is loose (no carrier).
  // D-30: grants possession to the moving piece WITHOUT ending the movement action (same-team only).
  // The piece retains its remaining pace; paceUsedByPieceId is updated for this step only.
  // Phase stays MOVEMENT so the piece can continue moving (action is not ended).
  // attackingTeam updates to the picking-up piece's team immediately (possession change).
  // Exception: if the picking-up piece belongs to the defending team (DEFENDER_5 slot),
  // possession has changed sides — end movement and transition to PASS.
  if (
    state.ball.carrierId === null &&
    to.q === state.ball.position.q &&
    to.r === state.ball.position.r
  ) {
    const newPickupAttackingTeam = piece.teamId;

    if (piece.teamId !== state.attackingTeam) {
      // Defending team picked up a loose ball — possession changes, movement phase ends.
      return {
        ok: true,
        state: {
          ...state,
          pieces: newPieces,
          ball: {
            position: to,
            carrierId: pieceId,
            lastTouchedBy: { pieceId, teamId: piece.teamId },
          },
          attackingTeam: newPickupAttackingTeam,
          activeTeam: newPickupAttackingTeam,
          phase: 'PASS',
          movementSlot: null,
          movedPieceIds: [],
          paceUsedByPieceId: {},
          lastActionType: 'DEFLECTION',
          stealAttemptedByIds: [], // D-02: reset at every 'PASS' transition
          tackleAttemptedByIds: [], // D-02
          eventLog: newEventLog,
          // THROWIN-03/CR-01: a break-in-play early return must not leave a throw-in context behind.
          ...THROW_IN_TEARDOWN,
        },
      };
    }

    return {
      ok: true,
      state: {
        ...state,
        pieces: newPieces,
        ball: {
          position: to,
          carrierId: pieceId,
          lastTouchedBy: { pieceId, teamId: piece.teamId },
        },
        attackingTeam: newPickupAttackingTeam,
        activeTeam: newPickupAttackingTeam,
        // D-30: stay in MOVE — do NOT transition to CHOOSE_ACTION or reset pace/slots
        phase: 'MOVE',
        movementSlot: state.movementSlot,
        movedPieceIds: computeMovedPieceIds(), // spent only if pace exhausted after this step
        paceUsedByPieceId: {
          ...state.paceUsedByPieceId,
          [pieceId]: newPaceForPiece,
        },
        eventLog: newEventLog,
        lastActionType: state.lastActionType, // preserve; pickup mid-movement doesn't change action type
      },
    };
  }

  // D-29: track per-attempt ids for steal/tackle — updated in the relevant branches
  // and threaded through all ok:true return paths.
  let newStealAttemptedByIds: readonly string[] = state.stealAttemptedByIds ?? [];
  let newTackleAttemptedByIds: readonly string[] = state.tackleAttemptedByIds ?? [];

  // Handle STEAL_ATTEMPT effect (D-06/D-07/D-08)
  let stealSuccess = false;
  let stealDefenderId: string | undefined;
  if ('effect' in result && result.effect.type === 'STEAL_ATTEMPT') {
    // Resolve defender first so we can use their ID for all tracking (not the carrier's).
    const die = dice?.stealDie ?? 3;
    const defender = result.effect.defenders[0];
    stealDefenderId = defender!.id;

    // D-29: reject if this defender already attempted a steal this movement phase
    if (newStealAttemptedByIds.includes(stealDefenderId)) {
      return { ok: false, reason: 'MOVE_INVALID', detail: 'ALREADY_ATTEMPTED' };
    }

    // D-06: combined score >= 10 threshold; die===6 is always SUCCESS regardless of combined (D-06)
    const combined = computeCombinedScore(defender!.tackling, die, []);
    const stealResult: 'SUCCESS' | 'FAIL' = die === 6 || combined >= 10 ? 'SUCCESS' : 'FAIL';
    stealSuccess = stealResult === 'SUCCESS';
    const stealEvent: ActionEvent = {
      type: 'STEAL_ATTEMPT',
      defenderId: stealDefenderId,
      result: stealResult,
      defenderDie: die,
      defenderCombined: combined,
      timestamp: Date.now(),
      ballAfter:
        stealResult === 'SUCCESS'
          ? { position: to, carrierId: stealDefenderId }
          : { position: to, carrierId: pieceId },
    };
    newEventLog = [...newEventLog, stealEvent];
    // D-29: record the DEFENDER (not carrier) as having attempted a steal this phase
    newStealAttemptedByIds = [...newStealAttemptedByIds, stealDefenderId];
  }

  // Handle TACKLE_ATTEMPT effect (D-11/D-12)
  // Fires when a defender (different team than carrier) moves adjacent to the carrier.
  let tackleSuccess = false;
  if ('effect' in result && result.effect.type === 'TACKLE_ATTEMPT') {
    // D-29: reject if this piece already attempted a tackle this movement phase
    if (newTackleAttemptedByIds.includes(pieceId)) {
      return { ok: false, reason: 'MOVE_INVALID', detail: 'ALREADY_ATTEMPTED' };
    }

    const defDie = dice?.tackleDie ?? 3;
    const carDie = dice?.carrierDie ?? 3;
    const carrierId = result.effect.carrierId;
    const carrier = state.pieces.find((p) => p.id === carrierId);
    // Defensive: carrier must exist (moveValidator already verified, but belt-and-suspenders)
    if (carrier !== undefined) {
      const defCombined = computeCombinedScore(piece.tackling, defDie, []);
      const carCombined = computeCombinedScore(carrier.dribbling, carDie, []);
      // D-09: defender wins on tie (defCombined >= carCombined → SUCCESS)
      const tackleResult: 'SUCCESS' | 'FAIL' = defCombined >= carCombined ? 'SUCCESS' : 'FAIL';
      tackleSuccess = tackleResult === 'SUCCESS';
      // Compute ballAfter for replay: on SUCCESS ball moves to tackler; on FAIL ball stays.
      const tackleBallAfter =
        tackleResult === 'SUCCESS'
          ? { position: to, carrierId: pieceId }
          : { position: state.ball.position, carrierId: state.ball.carrierId };
      const tackleEvent: ActionEvent = {
        type: 'TACKLE_ATTEMPT',
        defenderId: pieceId,
        carrierId,
        defenderDie: defDie,
        carrierDie: carDie,
        defenderCombined: defCombined,
        carrierCombined: carCombined,
        result: tackleResult,
        timestamp: Date.now(),
        ballAfter: tackleBallAfter,
      };
      newEventLog = [...newEventLog, tackleEvent];
      // D-29: record that this piece has now attempted a tackle this phase (success or fail)
      newTackleAttemptedByIds = [...newTackleAttemptedByIds, pieceId];

      if (tackleSuccess) {
        // D-11: on SUCCESS, defender moves to `to`, ball possession transferred to defender.
        // Phase ends immediately — new attacking team chooses next action from CHOOSE_ACTION phase
        // (ELIGIBLE_NEXT_ACTIONS['SUCCESSFUL_TACKLE']: MOVEMENT, STANDARD_PASS, HIGH_PASS, LONG_BALL, SNAPSHOT).
        // D-06/Task 2: successful tackle turnover — the tackling defender is the new last toucher.
        const tackleSuccessBall = {
          ...state.ball,
          position: to,
          carrierId: pieceId,
          lastTouchedBy: { pieceId, teamId: piece.teamId },
        };
        // REPLAY-06 (18.1-01, Pitfall 3): the MOVE event appended above carries a stale
        // pre-contest ballAfter snapshot. Rewrite it to the post-tackle ball state (immutably —
        // never mutate state.eventLog/newEventLog in place) so the MOVE event's own replay frame
        // already shows the tackler as carrier instead of the stale carrier.
        // Task 2 note: ballAfter intentionally stays the narrow {position, carrierId} shape —
        // do not leak lastTouchedBy onto ActionEvent.ballAfter (replay doesn't need it).
        const correctedMoveEvent: ActionEvent = {
          ...moveEvent,
          ballAfter: {
            position: tackleSuccessBall.position,
            carrierId: tackleSuccessBall.carrierId,
          },
        };
        const tackleCorrectedEventLog = newEventLog.map((e) =>
          e === moveEvent ? correctedMoveEvent : e,
        );
        // OFFSIDE-01/D-39: a successful tackle is a "break in play" — MOVEMENT ends early
        // here, so evaluate offside now using the post-tackle piece positions and ball state.
        // GAP-2 (CR-01): check half-end boundary before returning; mirrors applyEndTurn logic.
        const tackleNewActionCount = state.actionCount + GAME_SPEED_MINUTES[state.gameSpeed];
        const tackleEndPhase = checkHalfEndOnTackle(state, tackleNewActionCount);
        return {
          ok: true,
          state: {
            ...state,
            phase: tackleEndPhase ?? 'PASS',
            pieces: newPieces,
            attackingTeam: piece.teamId,
            activeTeam: piece.teamId,
            movementSlot: null,
            movedPieceIds: [],
            paceUsedByPieceId: {},
            ball: tackleSuccessBall,
            eventLog: tackleCorrectedEventLog,
            lastActionType: 'SUCCESSFUL_TACKLE',
            // UX-07 (Phase 18.4): clock increment is speed-derived at MOVE-completion
            actionCount: tackleNewActionCount,
            stealAttemptedByIds: [], // D-02: reset at every 'PASS' transition
            tackleAttemptedByIds: [], // D-02
            offsidePieceIds: evaluateOffside({
              ...state,
              pieces: newPieces,
              ball: tackleSuccessBall,
            }),
            // THROWIN-03/CR-01: a break-in-play early return must not leave a throw-in context behind.
            ...THROW_IN_TEARDOWN,
          },
        };
      }
      // FAIL: defender moves to `to` (newPieces already reflects this), carrier keeps ball.
      // Only the moving defender gets a tackle attempt — stationary adjacent defenders do not
      // auto-tackle. Movement phase continues; the carrier retains possession.
      return {
        ok: true,
        state: {
          ...state,
          pieces: newPieces,
          movedPieceIds: computeMovedPieceIds(), // spent only if pace exhausted
          paceUsedByPieceId: {
            ...state.paceUsedByPieceId,
            [pieceId]: newPaceForPiece,
          },
          ball: state.ball,
          eventLog: newEventLog,
          tackleAttemptedByIds: newTackleAttemptedByIds, // D-29
        },
      };
    }
  }

  if (stealSuccess) {
    // Phase ends immediately — new attacking team chooses next action from CHOOSE_ACTION phase
    // (ELIGIBLE_NEXT_ACTIONS['SUCCESSFUL_TACKLE']: MOVEMENT, STANDARD_PASS, HIGH_PASS, LONG_BALL, SNAPSHOT).
    const newOwnerTeam =
      state.pieces.find((p) => p.id === stealDefenderId)?.teamId ?? state.activeTeam;
    // D-06/Task 2: successful steal turnover — the stealing defender is the new last toucher.
    const stealSuccessBall = {
      ...state.ball,
      position: to,
      carrierId: stealDefenderId!,
      lastTouchedBy: { pieceId: stealDefenderId!, teamId: newOwnerTeam },
    };
    // REPLAY-06 (18.1-01, Pitfall 3): the MOVE event appended above carries a stale
    // pre-contest ballAfter snapshot. Rewrite it to the post-steal ball state (immutably —
    // never mutate state.eventLog/newEventLog in place) so the MOVE event's own replay frame
    // already shows the defender as carrier instead of the stale carrier.
    // Task 2 note: ballAfter intentionally stays the narrow {position, carrierId} shape —
    // do not leak lastTouchedBy onto ActionEvent.ballAfter (replay doesn't need it).
    const correctedMoveEvent: ActionEvent = {
      ...moveEvent,
      ballAfter: { position: stealSuccessBall.position, carrierId: stealSuccessBall.carrierId },
    };
    const stealCorrectedEventLog = newEventLog.map((e) =>
      e === moveEvent ? correctedMoveEvent : e,
    );
    // OFFSIDE-01/D-39: a successful steal is also a "break in play" — MOVEMENT ends early
    // here, so evaluate offside now using the post-steal piece positions and ball state.
    // GAP-2 (CR-01): check half-end boundary before returning; mirrors applyEndTurn logic.
    const stealNewActionCount = state.actionCount + GAME_SPEED_MINUTES[state.gameSpeed];
    const stealEndPhase = checkHalfEndOnTackle(state, stealNewActionCount);
    return {
      ok: true,
      state: {
        ...state,
        phase: stealEndPhase ?? 'PASS',
        pieces: newPieces,
        attackingTeam: newOwnerTeam,
        activeTeam: newOwnerTeam,
        movementSlot: null,
        movedPieceIds: [],
        paceUsedByPieceId: {},
        ball: stealSuccessBall,
        eventLog: stealCorrectedEventLog,
        lastActionType: 'SUCCESSFUL_TACKLE',
        // UX-07 (Phase 18.4): clock increment is speed-derived at MOVE-completion
        actionCount: stealNewActionCount,
        stealAttemptedByIds: [], // D-02: reset at every 'PASS' transition
        tackleAttemptedByIds: [], // D-02
        offsidePieceIds: evaluateOffside({ ...state, pieces: newPieces, ball: stealSuccessBall }),
        // THROWIN-03/CR-01: a break-in-play early return must not leave a throw-in context behind.
        ...THROW_IN_TEARDOWN,
      },
    };
  }

  // Normal move (includes steal FAIL fall-through)
  return {
    ok: true,
    state: {
      ...state,
      pieces: newPieces,
      movedPieceIds: computeMovedPieceIds(), // spent only when pace fully exhausted
      paceUsedByPieceId: {
        ...state.paceUsedByPieceId,
        [pieceId]: newPaceForPiece,
      },
      ball: newBall,
      eventLog: newEventLog,
      stealAttemptedByIds: newStealAttemptedByIds, // D-29: propagate (may have been updated)
    },
  };
}

// ---------------------------------------------------------------------------
// applyEndTurn
// ---------------------------------------------------------------------------

/** Discriminated union result for applyEndTurn. */
export type ApplyEndTurnResult =
  | { ok: false; reason: 'WRONG_SLOT' | 'WRONG_TEAM' }
  | { ok: true; state: GameState };

/**
 * Advances the 4-5-2 FSM to the next movement slot (or transitions to PASS).
 *
 * D-03: advances ATTACKER_4 → DEFENDER_5 → ATTACKER_2 in order.
 * D-04: ATTACKER_2 → transitions phase to 'PASS' with movementSlot null.
 * D-04/MATCH-01: at ATTACKER_2→null, clock increments by 3 minutes.
 * D-05/MATCH-02: when actionCount first reaches 45, addedTime is set inline (injected roll).
 * Pitfall 5: half===1 → HALF_TIME; half===2 → FULL_TIME at threshold.
 * Pitfall 1: addedTimeRoll is injected by the caller — never call randomInt here.
 *
 * Resets movedPieceIds and paceUsedByPieceId for the new slot.
 * Appends a SLOT_ADVANCE ActionEvent.
 *
 * @param state          - Current game state (phase must be MOVEMENT)
 * @param options        - Optional injection: addedTimeRoll (pre-rolled d6 for added time at half 45)
 */
export function applyEndTurn(
  state: GameState,
  options?: { addedTimeRoll?: number },
): ApplyEndTurnResult {
  if (state.phase !== 'MOVE' || state.movementSlot === null) {
    return { ok: false, reason: 'WRONG_SLOT' };
  }

  // OFFSIDE-01/D-39 (corrected 2026-06-20): offside is evaluated ONLY at the true end of
  // MOVEMENT (the nextSlot===null returns below: HALF_TIME/FULL_TIME, GK_RESTART, normal
  // ATTACKER_2->PASS) — NOT at the two intermediate slot-to-slot transitions
  // (ATTACKER_4->DEFENDER_5, DEFENDER_5->ATTACKER_2). None of this function's returns
  // mutate piece positions (pieces already moved via applyMove), so a single
  // evaluateOffside(state) call covers all three full-MOVEMENT-end returns below.
  const nextOffside = evaluateOffside(state);

  const { nextSlot, nextPhase } = advanceMovementSlot(state);

  const slotAdvanceEvent: ActionEvent = {
    type: 'SLOT_ADVANCE',
    from: state.movementSlot,
    to: nextSlot,
    timestamp: Date.now(),
  };

  const nextActiveTeam: 'home' | 'away' =
    nextSlot === null
      ? state.activeTeam // PASS phase — keep current activeTeam until handler sets it
      : nextSlot === 'DEFENDER_5'
        ? state.attackingTeam === 'home'
          ? 'away'
          : 'home'
        : state.attackingTeam;

  // Phase 8 clock hook (D-04/MATCH-01): at ATTACKER_2→null transition, speed-derived min per cycle.
  // UX-07 (Phase 18.4): replaces fixed +3 with GAME_SPEED_MINUTES[state.gameSpeed] (1/2/3).
  if (nextSlot === null) {
    const newActionCount = state.actionCount + GAME_SPEED_MINUTES[state.gameSpeed];

    // D-05/MATCH-02: roll added time inline when half ends (45 for h1, 90 for h2)
    // Guard: only set addedTime once per half (Pitfall 3 — prevents re-roll)
    const HALF_LENGTH = state.half * 45;
    let newAddedTime = state.addedTime;
    if (newActionCount >= HALF_LENGTH && state.addedTime === null) {
      // Injected roll (Pitfall 1 — never call randomInt here; caller injects via options)
      const roll = options?.addedTimeRoll ?? 3; // default 3 for backward compatibility
      newAddedTime = roll + state.refereeCard.leniency;
    }

    // Pitfall 5: check HALF_TIME vs FULL_TIME by half
    const halfEnd = HALF_LENGTH + (newAddedTime ?? 0);
    if (newActionCount >= halfEnd) {
      const endPhase: GamePhase = state.half === 1 ? 'HALF_TIME' : 'FULL_TIME';
      return {
        ok: true,
        state: {
          ...state,
          phase: endPhase,
          movementSlot: null,
          activeTeam: nextActiveTeam,
          eventLog: [...state.eventLog, slotAdvanceEvent],
          movedPieceIds: [],
          paceUsedByPieceId: {},
          actionCount: newActionCount,
          addedTime: newAddedTime,
          lastActionType: 'MOVEMENT_PHASE',
          offsidePieceIds: nextOffside, // OFFSIDE-01 (D-23): sticky re-evaluation at phase end
          lastShotPath: null, // prevent stale shot-path tint from bleeding into HALF_TIME screen
          // THROWIN-03/D-09: a throw-in context cannot survive across a half boundary.
          ...THROW_IN_TEARDOWN,
        },
      };
    }

    // D-06 (Phase 17.1): GK carrier in own penalty area → GK_RESTART instead of 'PASS'.
    // Must run BEFORE the normal 'PASS' branch so the GK can use GK_RESTART actions.
    const carrier = state.ball.carrierId
      ? state.pieces.find((p) => p.id === state.ball.carrierId)
      : null;
    if (carrier?.role === 'GK') {
      const ownArea: keyof typeof PITCH_REGIONS =
        carrier.teamId === 'home' ? 'homePenaltyArea' : 'awayPenaltyArea';
      if (isInRegion(carrier.position, ownArea)) {
        return {
          ok: true,
          state: {
            ...state,
            phase: 'GK_RESTART',
            movementSlot: null,
            activeTeam: carrier.teamId,
            eventLog: [...state.eventLog, slotAdvanceEvent],
            movedPieceIds: [],
            paceUsedByPieceId: {},
            actionCount: newActionCount,
            addedTime: newAddedTime,
            stealAttemptedByIds: [], // D-02: reset on phase transition
            tackleAttemptedByIds: [], // D-02
            offsidePieceIds: nextOffside, // OFFSIDE-01 (D-23): sticky re-evaluation at phase end
            // THROWIN-03/D-09: a throw-in context cannot survive into a GK restart.
            ...THROW_IN_TEARDOWN,
          },
        };
      }
    }

    // THROWIN-03/D-09 (Plan 37-05 Task 2): count completed Movement Phases during a
    // throw-in sequence and drive the per-step choice model. Fires only while a
    // throw-in is in progress (throwInPhasesTaken < 2) AND the ball is still held by
    // the throwing team (carrier resolved above, shared with the GK-restart branch).
    // Possession loss (steal/tackle) or no carrier at all means the branch must NOT
    // fire — the throw-in context is cleared instead and the generic MOVEMENT_PHASE
    // return below applies, so the team now in possession gets normal pass options.
    //
    // THROWIN-03/CR-01 (D-11-02/D-11-03): `carrier.teamId === state.throwInTeam` alone is
    // a coincidence check — the ball can return to the throwing team through two unrelated
    // turnovers, re-arming this branch on a Movement Phase that has nothing to do with the
    // throw-in. `state.lastActionType` adds a second, independent signal: applyThrowInPlace
    // sets it to null for Movement Phase 1, this branch sets it to THROW_IN_MOVEMENT_1 for
    // Movement Phase 2, and applyStartMovement preserves it across the Movement-Phase
    // boundary — BUT the pre-existing D-17 (WR-02) intermediate-slot-transition reset
    // (this function's non-ATTACKER_2-slot return, above) unconditionally overwrites
    // lastActionType to 'MOVEMENT_PHASE' at every ATTACKER_4->DEFENDER_5 and
    // DEFENDER_5->ATTACKER_2 step — including mid-throw-in. Since movementSlot can only
    // reach ATTACKER_2 (the slot this nextSlot===null block fires from) via that
    // DEFENDER_5->ATTACKER_2 transition, `state.lastActionType` is 'MOVEMENT_PHASE' at
    // this point on EVERY real FSM traversal, whether the phase is a genuine throw-in
    // continuation or not — so 'MOVEMENT_PHASE' must be accepted alongside null and
    // THROW_IN_MOVEMENT_1, or the legitimate clean throw-in path breaks entirely
    // (caught by throwIn.integration.test.ts T-37-19/T-37-20 during 37-11 execution).
    // What this clause still excludes — and the only thing it CAN exclude, given D-17
    // always scrubs a turnover marker at the first subsequent intermediate transition
    // before this check ever runs — is a hypothetical caller that invokes applyEndTurn
    // directly on a state already sitting in ATTACKER_2 with a stale SUCCESSFUL_TACKLE/
    // DEFLECTION lastActionType, bypassing the normal intermediate-transition codepath
    // (e.g. a future refactor, or test/replay tooling). This clause is deliberately NOT
    // paired to throwInPhasesTaken (D-11-03) — null pairs with phasesTaken 0 in the common
    // case, but a stale phasesTaken:1 with lastActionType:null must still be allowed to
    // pass (pre-existing test at line ~583). THROW_IN_MOVEMENT_2 is intentionally absent
    // here because throwInPhasesTaken would then be 2, already excluded by the `< 2` clause.
    const throwInStillValid =
      state.throwInPhasesTaken !== null &&
      state.throwInPhasesTaken !== undefined &&
      state.throwInPhasesTaken < 2 &&
      carrier != null &&
      carrier.teamId === state.throwInTeam &&
      (state.lastActionType === null ||
        state.lastActionType === 'THROW_IN_MOVEMENT_1' ||
        state.lastActionType === 'MOVEMENT_PHASE');

    if (throwInStillValid) {
      // Narrowed by throwInStillValid above; TypeScript can't see through the const
      // boolean, so re-assert non-null here for the arithmetic below.
      const phasesTaken = state.throwInPhasesTaken as 0 | 1;
      const nextLastActionType = phasesTaken === 0 ? 'THROW_IN_MOVEMENT_1' : 'THROW_IN_MOVEMENT_2';
      return {
        ok: true,
        state: {
          ...state,
          phase: 'PASS',
          movementSlot: nextSlot,
          activeTeam: nextActiveTeam,
          lastActionType: nextLastActionType,
          throwInPhasesTaken: (phasesTaken + 1) as 1 | 2,
          eventLog: [...state.eventLog, slotAdvanceEvent],
          movedPieceIds: [],
          paceUsedByPieceId: {},
          actionCount: newActionCount,
          addedTime: newAddedTime,
          stealAttemptedByIds: [],
          tackleAttemptedByIds: [],
          offsidePieceIds: nextOffside, // OFFSIDE-01 (D-23): sticky re-evaluation at phase end
        },
      };
    }

    // THROWIN-03/CR-01: THROW_IN_TEARDOWN is now the single shared literal that clears
    // the throw-in fields, used module-wide by both this generic return and applyMove's
    // break-in-play early returns (tackle/steal success, defending-team pickup) — not a
    // local const scoped to applyEndTurn alone.

    // MOVE-06 (corrected design): applyEndTurn no longer special-cases a pending free
    // move here — the ball-zone-triggered FREE_MOVE_ATTACK/FREE_MOVE_DEFENSE overlay is
    // applied centrally by `applyFreeMoveZoneCheck` (called from `broadcastState` after
    // every resolved action, D-33). applyEndTurn computes its normal next phase exactly
    // as if MOVE-06 didn't exist.

    // Normal ATTACKER_2→PASS transition with clock updates
    return {
      ok: true,
      state: {
        ...state,
        phase: nextPhase,
        movementSlot: nextSlot,
        activeTeam: nextActiveTeam,
        eventLog: [...state.eventLog, slotAdvanceEvent],
        movedPieceIds: [],
        paceUsedByPieceId: {},
        actionCount: newActionCount,
        addedTime: newAddedTime,
        lastActionType: 'MOVEMENT_PHASE',
        stealAttemptedByIds: [], // D-02: reset at every 'PASS' transition
        tackleAttemptedByIds: [], // D-02
        offsidePieceIds: nextOffside, // OFFSIDE-01 (D-23): sticky re-evaluation at phase end
        ...THROW_IN_TEARDOWN,
      },
    };
  }

  // Non-ATTACKER_2 slot transition (ATTACKER_4→DEFENDER_5 or DEFENDER_5→ATTACKER_2)
  // movedPieceIds is preserved across intermediate slot boundaries so players
  // moved in ATTACKER_4 cannot be reused in ATTACKER_2 (D-12).
  // paceUsedByPieceId is reset so the new slot can track its own activations.
  //
  // Any piece with paceUsed > 0 that was not yet exhausted (not in movedPieceIds) is
  // locked in now — ending the slot consumes the activation whether or not max pace was used.
  //
  // OFFSIDE-01/D-39: intermediate slot transitions do NOT re-evaluate offside — the sticky
  // `offsidePieceIds` carries forward unchanged via the `...state` spread below. Offside is
  // only evaluated at the true end of MOVEMENT (see `nextOffside` above) or at a
  // break-in-play (successful tackle/steal in applyMove).
  const lockedOnEndSlot = Object.keys(state.paceUsedByPieceId).filter(
    (id) => !state.movedPieceIds.includes(id),
  );
  return {
    ok: true,
    state: {
      ...state,
      phase: nextPhase,
      movementSlot: nextSlot,
      activeTeam: nextActiveTeam,
      eventLog: [...state.eventLog, slotAdvanceEvent],
      movedPieceIds: [...state.movedPieceIds, ...lockedOnEndSlot],
      paceUsedByPieceId: {}, // reset — new slot counts activations from zero
      lastActionType: 'MOVEMENT_PHASE', // D-17 (WR-02): reset for intermediate slot transitions
    },
  };
}

// ---------------------------------------------------------------------------
// applyFreeMoveEnd
// ---------------------------------------------------------------------------

/**
 * Ends the active MOVE-06 free-move sub-phase (Phase 17, corrected design D-35/D-36) —
 * fired by the active team's End Turn.
 *
 * - FREE_MOVE_ATTACK: if the defense eligible list is non-empty, hands off to
 *   FREE_MOVE_DEFENSE (flips activeTeam to the other team; keeps freeMoveEligibleIds/
 *   freeMoveUsedPace as-is since defense pieces haven't moved yet). Otherwise restores
 *   from freeMoveResume and clears the free-move tracking fields.
 * - FREE_MOVE_DEFENSE: always restores phase/activeTeam from freeMoveResume and clears
 *   the free-move tracking fields (freeMoveResume/freeMoveEligibleIds/freeMoveUsedPace).
 */
export function applyFreeMoveEnd(state: GameState): { ok: true; state: GameState } {
  // OFFSIDE-01 (D-23): pieces may have moved during the sub-phase that is ending (either
  // FREE_MOVE_ATTACK or FREE_MOVE_DEFENSE) — re-evaluate the sticky flag at every return.
  const nextOffside = evaluateOffside(state);

  if (state.phase === 'FREE_MOVE_ATTACK') {
    const defenseIds = state.freeMoveEligibleIds?.defense ?? [];
    if (defenseIds.length > 0) {
      return {
        ok: true,
        state: {
          ...state,
          phase: 'FREE_MOVE_DEFENSE',
          activeTeam: state.attackingTeam === 'home' ? 'away' : 'home',
          // Defending team's sub-phase starts fresh, independent of which attacking pieces
          // were activated/abandoned during FREE_MOVE_ATTACK (UX-parity fix).
          movedPieceIds: [],
          offsidePieceIds: nextOffside,
        },
      };
    }
    // Defense list empty — skip straight to the resume phase.
    return {
      ok: true,
      state: {
        ...state,
        phase: state.freeMoveResume?.phase ?? 'PASS',
        activeTeam: state.freeMoveResume?.activeTeam ?? state.activeTeam,
        freeMoveResume: null,
        freeMoveEligibleIds: null,
        freeMoveUsedPace: null,
        // Resumed phase is always a fresh phase boundary — must not inherit free-move
        // activation bookkeeping (UX-parity fix).
        movedPieceIds: [],
        offsidePieceIds: nextOffside,
      },
    };
  }

  // FREE_MOVE_DEFENSE (or defensive fallback): always restore from freeMoveResume.
  return {
    ok: true,
    state: {
      ...state,
      phase: state.freeMoveResume?.phase ?? 'PASS',
      activeTeam: state.freeMoveResume?.activeTeam ?? state.activeTeam,
      freeMoveResume: null,
      freeMoveEligibleIds: null,
      freeMoveUsedPace: null,
      // Resumed phase is always a fresh phase boundary — must not inherit free-move
      // activation bookkeeping (UX-parity fix).
      movedPieceIds: [],
      offsidePieceIds: nextOffside,
    },
  };
}

// ---------------------------------------------------------------------------
// applyFreeMoveZoneCheck
// ---------------------------------------------------------------------------

/**
 * T-37-15 (Phase 37, 37-04): phases the ball-zone free-move interrupt must never overlay.
 * `HALF_TIME`/`FULL_TIME`/`FREE_MOVE_ATTACK`/`FREE_MOVE_DEFENSE` are the pre-Phase-37
 * exclusions (D-37, see below); the six Phase-37 restart phases are added so a throw-in
 * or goal-kick awarded near a final third can never be hijacked mid-sequence — the
 * centrally-invoked zone check would otherwise overlay FREE_MOVE_ATTACK/DEFENSE on top
 * of a restart phase, and `freeMoveResume` would then try to restore a restart phase it
 * has no way to correctly resume. Module-level so it stays greppable.
 *
 * Plan 38-05 (Rule 2 — missing critical functionality, discovered while wiring the
 * Corner Kick socket surface): the five `CORNER_KICK_*` phases are added here for the
 * identical reason as the Phase 37 restart phases above. A corner is, by definition,
 * always awarded and taken from right next to a byline — i.e. always inside one of the
 * two final thirds — so every corner-kick phase would otherwise be hijacked by this
 * check on its very first broadcast. This constant was left un-extended by 38-01..38-04
 * (their scope was the engine's own corner sequence, not this cross-cutting interrupt);
 * this plan is the first to actually exercise the corner phases through `broadcastState`.
 */
const ZONE_CHECK_EXEMPT_PHASES: ReadonlySet<GamePhase> = new Set<GamePhase>([
  'HALF_TIME',
  'FULL_TIME',
  'FREE_MOVE_ATTACK',
  'FREE_MOVE_DEFENSE',
  'THROW_IN_SETUP',
  'GOAL_KICK_SETUP_GK',
  'GOAL_KICK_SETUP_OPPONENT',
  'GOAL_KICK_CHOICE',
  'GOAL_KICK_TARGET',
  'GOAL_KICK_MOVE',
  'CORNER_KICK_GK_SETUP_ATTACKING',
  'CORNER_KICK_GK_SETUP_DEFENDING',
  'CORNER_KICK_TAKER_SELECT',
  'CORNER_KICK_REPOSITION',
  'CORNER_KICK_FINAL_SETUP',
]);

/**
 * MOVE-06 (Phase 17, corrected design D-33..D-37): the centralized ball-zone-triggered
 * free-move check. Called from `broadcastState` (roomStore.ts) after every resolved
 * action — the single ARCH-04 entry point — so the trigger fires after literally any
 * action with zero per-handler changes elsewhere.
 *
 * Rulebook text (verbatim): "If the ball is in one final third and any action has come
 * to an end, all players in the opposite final third get a free move of 6 hexes each.
 * Attacking team moves first."
 *
 * - D-37: does not fire while phase is HALF_TIME, FULL_TIME, or already one of
 *   FREE_MOVE_ATTACK/FREE_MOVE_DEFENSE (no sensible resume phase to interrupt).
 * - T-37-15: does not fire during any of the six Phase-37 restart phases either — see
 *   ZONE_CHECK_EXEMPT_PHASES above.
 * - D-33: trigger fires only when the post-action ball zone differs from the stored
 *   `state.ballZone` AND the new zone is 'home' or 'away' (a fresh entry into a final
 *   third — including a direct home↔away jump with no intervening middle action).
 * - D-34: eligible pieces are ALL pieces of both teams (GK included) in the OPPOSITE
 *   final third from the ball's new zone, split into attack/defense relative to
 *   `state.attackingTeam`.
 * - D-35/D-36: if both lists are non-empty, snapshots `{phase, activeTeam}` into
 *   freeMoveResume and overlays FREE_MOVE_ATTACK (or FREE_MOVE_DEFENSE if the attack
 *   list is empty) on top of whatever phase the triggering action already produced.
 *   If both lists are empty, stays on the triggering phase with ballZone updated.
 */
export function applyFreeMoveZoneCheck(state: GameState): GameState {
  if (ZONE_CHECK_EXEMPT_PHASES.has(state.phase)) {
    return state;
  }

  // BUG-20 (Phase 18.3 D-20): Defer the FREE_MOVE interrupt while a MOVE slot is in
  // progress or while a HEADER is resolving. The D-33 zone-crossing trigger condition
  // (newZone !== ballZone) is preserved — the crossing will still be detected at the
  // next clean phase boundary. We intentionally do NOT update ballZone here so that
  // the stale value re-triggers the zone check when the slot/header resolves.
  if (state.phase === 'MOVE' && state.movementSlot !== null) {
    return state; // MOVE slot in progress — defer free-move interrupt
  }
  if (state.phase === 'HEADER') {
    return state; // HEADER in progress — defer free-move interrupt
  }

  const newZone = computeBallZone(state.ball.position);

  if (newZone === state.ballZone || newZone === 'middle') {
    return { ...state, ballZone: newZone };
  }

  // Fresh entry into a final third (D-33) — the opposite final third gets the free move.
  const oppositeThird = newZone === 'home' ? 'awayThird' : 'homeThird';
  const eligiblePieces = state.pieces.filter((p) => isInRegion(p.position, oppositeThird));
  const attackIds = eligiblePieces.filter((p) => p.teamId === state.attackingTeam).map((p) => p.id);
  const defenseIds = eligiblePieces
    .filter((p) => p.teamId !== state.attackingTeam)
    .map((p) => p.id);

  if (attackIds.length === 0 && defenseIds.length === 0) {
    // Nobody to move — stay on whatever phase the triggering action already produced.
    return { ...state, ballZone: newZone };
  }

  return {
    ...state,
    ballZone: newZone,
    freeMoveResume: { phase: state.phase, activeTeam: state.activeTeam },
    phase: attackIds.length > 0 ? 'FREE_MOVE_ATTACK' : 'FREE_MOVE_DEFENSE',
    activeTeam:
      attackIds.length > 0 ? state.attackingTeam : state.attackingTeam === 'home' ? 'away' : 'home',
    freeMoveEligibleIds: { attack: attackIds, defense: defenseIds },
    freeMoveUsedPace: {},
    // Fresh sub-phase boundary — must not inherit stale movedPieceIds from whatever phase/
    // action preceded this trigger (UX-parity fix latent-bug closure: without this reset, a
    // piece left in movedPieceIds from the prior phase would be incorrectly locked out of
    // FREE_MOVE_ATTACK/DEFENSE from the start).
    movedPieceIds: [],
    // BUG-18 (Phase 18.3): clear lastDiceRoll on FREE_MOVE entry so canUndo is not
    // blocked by a stale dice value from the action that triggered the zone change.
    lastDiceRoll: null,
  };
}

// ---------------------------------------------------------------------------
// applyRestartMovement
// ---------------------------------------------------------------------------

/** Resets the movement phase back to ATTACKER_4, clearing movedPieceIds and pace tracking.
 *  Used for "Start New Movement Phase" — allows the attacking team to replay the full
 *  4-5-2 movement sequence from scratch within the same turn. */
export function applyRestartMovement(
  state: GameState,
): { ok: false; reason: 'WRONG_PHASE' } | { ok: true; state: GameState } {
  if (state.phase !== 'MOVE') return { ok: false, reason: 'WRONG_PHASE' };
  return {
    ok: true,
    state: {
      ...state,
      movementSlot: 'ATTACKER_4',
      activeTeam: state.attackingTeam,
      movedPieceIds: [],
      paceUsedByPieceId: {},
    },
  };
}

// ---------------------------------------------------------------------------
// applyUndo
// ---------------------------------------------------------------------------

/** Discriminated union result for applyUndo. */
export type ApplyUndoResult =
  | { ok: false; reason: 'UNDO_LOCKED' | 'NOTHING_TO_UNDO' }
  | { ok: true; state: GameState };

/**
 * Reverses the last MOVE event in the current movement slot.
 *
 * D-09: undo is locked if a SLOT_ADVANCE or DICE_ROLL exists since the last slot boundary.
 * D-10: reverses the last MOVE — restores piece position and decrements paceUsedByPieceId.
 *
 * Slot boundaries: SLOT_ADVANCE (normal end-of-slot) OR KICK_OFF (applyStartMovement marker,
 * used after steal/tackle so undo cannot cross into the pre-possession-change move history).
 *
 * BUG-37 (Phase 36) / D-13: a resolved TACKLE_ATTEMPT or STEAL_ATTEMPT is also an undo floor —
 * once either has resolved (SUCCESS or FAIL) within the current move, Undo cannot cross back
 * over it into the pre-contest move history (re-rolling a committed dice outcome). This is a
 * CLAMP, not a lockout: steps taken AFTER the resolved attempt remain undoable normally. The
 * terms below are added unconditionally (no phase guard) to the boundary-floor disjunction —
 * NOT to the separate `currentSlotEvents.some(... 'DICE_ROLL')` lockout check a few lines below,
 * which is a different mechanism that would make Undo unavailable for the rest of the slot.
 */
export function applyUndo(state: GameState): ApplyUndoResult {
  // Find the index of the last slot boundary (SLOT_ADVANCE, KICK_OFF, HP_REPOSITION, FTP_REPOSITION,
  // or a resolved TACKLE_ATTEMPT/STEAL_ATTEMPT)
  // BUG-03 (Phase 17 D-06): also treat HP_REPOSITION as a slot boundary in HIGH_PASS_MOVE
  // D-03 (Phase 17.1): treat FTP_REPOSITION as a slot boundary in FIRST_TIME_PASS_MOVE
  // Plan 25-06: treat FK_KICKER_CHOSEN and FK_STAGE_ADVANCE as slot boundaries in FREE_KICK_SETUP
  //   so that Undo cannot reach across kicker-selection or stage transitions.
  // BUG-37 (Phase 36) / D-13: treat a resolved TACKLE_ATTEMPT or STEAL_ATTEMPT as a boundary,
  //   unconditionally (no phase guard) — Undo cannot cross back over a committed dice outcome.
  const lastSlotAdvanceIdx = state.eventLog.reduce<number>((acc, evt, idx) => {
    const isBoundary =
      evt.type === 'SLOT_ADVANCE' ||
      evt.type === 'KICK_OFF' ||
      evt.type === 'TACKLE_ATTEMPT' ||
      evt.type === 'STEAL_ATTEMPT' ||
      (state.phase === 'HIGH_PASS_MOVE' && evt.type === 'HP_REPOSITION') ||
      (state.phase === 'FIRST_TIME_PASS_MOVE' && evt.type === 'FTP_REPOSITION') ||
      (state.phase === 'FREE_KICK_SETUP' &&
        (evt.type === 'FK_KICKER_CHOSEN' || evt.type === 'FK_STAGE_ADVANCE')) ||
      // GOALKICK-02 (Phase 37, 37-02): Undo can never cross from the opponent's reposition
      // window back into the kicking team's window.
      ((state.phase === 'GOAL_KICK_SETUP_GK' || state.phase === 'GOAL_KICK_SETUP_OPPONENT') &&
        evt.type === 'GOAL_KICK_WINDOW_ADVANCE') ||
      // CORNER-03/CORNER-06 (Phase 38, 38-04): Undo may never cross a stage handoff back
      // into the opposing manager's completed round, nor un-place the corner-taker.
      (state.phase === 'CORNER_KICK_REPOSITION' &&
        (evt.type === 'CORNER_KICK_STAGE_ADVANCE' || evt.type === 'CORNER_KICK_TAKER_PLACED')) ||
      (state.phase === 'CORNER_KICK_FINAL_SETUP' && evt.type === 'CORNER_KICK_STAGE_ADVANCE');
    return isBoundary ? idx : acc;
  }, -1);

  const currentSlotEvents = state.eventLog.slice(lastSlotAdvanceIdx + 1);

  // D-09: locked if any SLOT_ADVANCE or DICE_ROLL in the current slot's events
  if (currentSlotEvents.some((e) => e.type === 'SLOT_ADVANCE' || e.type === 'DICE_ROLL')) {
    return { ok: false, reason: 'UNDO_LOCKED' };
  }

  // CR-01 (17.1-11): the move-type to search for is phase-aware — gameHandlers.ts emits
  // HP_MOVE during HIGH_PASS_MOVE and FTP_MOVE during FIRST_TIME_PASS_MOVE, never MOVE.
  // BUG-18 (Phase 18.3): extended for GK_KICK_MOVE, SNAPSHOT_DEFLECT, FREE_MOVE_*, FREE_KICK_SETUP.
  const moveTypeForPhase =
    state.phase === 'HIGH_PASS_MOVE'
      ? 'HP_MOVE'
      : state.phase === 'FIRST_TIME_PASS_MOVE'
        ? 'FTP_MOVE'
        : state.phase === 'GK_KICK_MOVE'
          ? 'GK_KICK_MOVE'
          : state.phase === 'SNAPSHOT_DEFLECT'
            ? 'SNAP_DEFLECT_MOVE'
            : state.phase === 'FREE_KICK_SETUP'
              ? 'FK_SETUP_MOVE'
              : state.phase === 'GOAL_KICK_MOVE'
                ? 'GOAL_KICK_MOVE' // GOALKICK-05 (Phase 37, 37-02)
                : // CR-01 (38-10, gap closure): applyCornerKickFinalMove emits CORNER_KICK_MOVE,
                  // never MOVE, so the 'MOVE' default below would never match and Undo would
                  // silently no-op (38-REVIEW.md CR-01).
                  state.phase === 'CORNER_KICK_FINAL_SETUP'
                  ? 'CORNER_KICK_MOVE'
                  : 'MOVE'; // covers MOVE, FREE_MOVE_ATTACK, FREE_MOVE_DEFENSE, GOAL_KICK_SETUP_GK/OPPONENT (applyMove emits MOVE)

  // Find the last MOVE (or phase-appropriate HP_MOVE/FTP_MOVE) in the current slot
  const lastMoveRelIdx = currentSlotEvents.reduce<number>((acc, evt, idx) => {
    return evt.type === moveTypeForPhase ? idx : acc;
  }, -1);

  if (lastMoveRelIdx === -1) {
    // No MOVE in current slot — check if prior-slot moves are locked (slot boundary crossed)
    const hasPriorMoves = state.eventLog
      .slice(0, lastSlotAdvanceIdx + 1)
      .some((e) => e.type === moveTypeForPhase);
    // D-04 (Phase 26): FREE_KICK_SETUP cross-stage undo is impossible in all cases
    // (the FK_STAGE_ADVANCE boundary always blocks it), so NOTHING_TO_UNDO is the
    // correct response for an empty current stage — UNDO_LOCKED is misleading here
    // because there is no actionable "locked" state for the player to resolve.
    if (hasPriorMoves && state.phase !== 'FREE_KICK_SETUP') {
      return { ok: false, reason: 'UNDO_LOCKED' }; // D-09: moves exist but crossed a slot boundary
    }
    return { ok: false, reason: 'NOTHING_TO_UNDO' };
  }

  const moveToUndo = currentSlotEvents[lastMoveRelIdx] as Extract<
    ActionEvent,
    {
      type:
        | 'MOVE'
        | 'HP_MOVE'
        | 'FTP_MOVE'
        | 'GK_KICK_MOVE'
        | 'SNAP_DEFLECT_MOVE'
        | 'FK_SETUP_MOVE'
        | 'GOAL_KICK_MOVE' // GOALKICK-05 (Phase 37, 37-02)
        | 'CORNER_KICK_MOVE'; // CR-01 (38-10, gap closure)
    }
  >;

  // Reverse piece position (D-10)
  const newPieces = state.pieces.map((p) =>
    p.id === moveToUndo.pieceId ? { ...p, position: moveToUndo.from } : p,
  );

  // Decrement pace used for this piece
  const currentPace = state.paceUsedByPieceId[moveToUndo.pieceId] ?? 0;
  const newPaceUsed = { ...state.paceUsedByPieceId };
  if (currentPace > 1) {
    newPaceUsed[moveToUndo.pieceId] = currentPace - 1;
  } else {
    delete newPaceUsed[moveToUndo.pieceId];
  }

  // Always remove the piece from movedPieceIds when any of its moves is undone.
  // Previously only removed when paceUsed reached 0, which left the X marker on pieces
  // that were exhausted (e.g. 2/2 ATTACKER_2) even after one step was reversed.
  // The piece will be re-added to movedPieceIds if it reaches pace exhaustion again.
  const newMovedPieceIds = state.movedPieceIds.filter((id) => id !== moveToUndo.pieceId);

  // Remove the MOVE event from eventLog (D-10)
  const absoluteMoveIdx = lastSlotAdvanceIdx + 1 + lastMoveRelIdx;
  const newEventLog = [
    ...state.eventLog.slice(0, absoluteMoveIdx),
    ...state.eventLog.slice(absoluteMoveIdx + 1),
  ];

  // MOVE-06 (corrected design): no pendingFreeMove field to clear here anymore — undoing
  // a move simply moves the ball back, and the next broadcastState recomputes ballZone
  // via applyFreeMoveZoneCheck from the restored ball position (D-33).

  // Move ball back with the carrier when undoing their move
  const newBallAfterUndo =
    state.ball.carrierId === moveToUndo.pieceId
      ? { ...state.ball, position: moveToUndo.from }
      : state.ball;

  // Review-CR-01 (D-03, 17.1-14): undoing an FTP_MOVE/HP_MOVE must also unlock the
  // phase-specific repositioning slot — otherwise the stale lock/pace fields leave the
  // slot permanently dead-ended after a single Undo (only escape was End Turn). Mirrors
  // the canonical slot-clear shape at gameEngine.ts:1257-1258 and
  // gameHandlers.ts:693-694/721-722 (null / 0). Other phases are left untouched.
  // BUG-18 (Phase 18.3): extended for GK_KICK_MOVE (reset per-slot lock) and
  // SNAPSHOT_DEFLECT (reset snap-deflect tracking so the defender can move again).
  // FK_SETUP_MOVE: freeKickPlacedPieceIds is managed by applyFreeKickMove; Undo removes
  // the undone piece from the placed list so the stage budget is correctly restored.
  // Only release the single-piece lock when ALL steps for that piece have been undone
  // (newPaceUsed entry deleted). If the piece still has pace remaining, keep the lock
  // pointing at them so no other piece can be selected mid-move.
  // For phases that track pace in a dedicated field (*PaceUsed) rather than paceUsedByPieceId,
  // derive remaining pace from that field so the lock is preserved on partial undo.
  const stepDistance = hexDistance(moveToUndo.from, moveToUndo.to);
  const lockReset: Partial<GameState> =
    state.phase === 'FIRST_TIME_PASS_MOVE'
      ? (() => {
          const rem = Math.max(0, (state.firstTimePassPaceUsed ?? 0) - stepDistance);
          return rem > 0
            ? { firstTimePassPaceUsed: rem }
            : { firstTimePassMovedPieceId: null, firstTimePassPaceUsed: 0 };
        })()
      : state.phase === 'HIGH_PASS_MOVE'
        ? (() => {
            const rem = Math.max(0, (state.highPassPaceUsed ?? 0) - stepDistance);
            return rem > 0
              ? { highPassPaceUsed: rem }
              : { highPassMovedPieceId: null, highPassPaceUsed: 0 };
          })()
        : state.phase === 'GK_KICK_MOVE'
          ? (() => {
              const rem = Math.max(0, (state.gkKickPaceUsed ?? 0) - stepDistance);
              return rem > 0
                ? { gkKickPaceUsed: rem }
                : { gkKickMovedPieceId: null, gkKickPaceUsed: 0 };
            })()
          : state.phase === 'SNAPSHOT_DEFLECT'
            ? (() => {
                const rem = Math.max(0, (state.snapDeflectPaceUsed ?? 0) - stepDistance);
                return rem > 0
                  ? { snapDeflectPaceUsed: rem }
                  : { snapDeflectMovedPieceId: null, snapDeflectPaceUsed: 0 };
              })()
            : state.phase === 'FREE_KICK_SETUP'
              ? (() => {
                  // Detect kicker undo: a FK_KICKER_CHOSEN event exists with this piece ID.
                  // When true, also clear freeKickKickerChosen so the kicker-select sub-step
                  // re-activates and the kicker can be repositioned again.
                  const isKickerUndo = state.eventLog.some(
                    (e) => e.type === 'FK_KICKER_CHOSEN' && e.kickerPieceId === moveToUndo.pieceId,
                  );
                  return {
                    freeKickPlacedPieceIds: (state.freeKickPlacedPieceIds ?? []).filter(
                      (id) => id !== moveToUndo.pieceId,
                    ),
                    ...(isKickerUndo ? { freeKickKickerChosen: false } : {}),
                  };
                })()
              : state.phase === 'GOAL_KICK_MOVE'
                ? (() => {
                    // GOALKICK-05 (Phase 37, 37-02): mirrors the GK_KICK_MOVE branch exactly.
                    const rem = Math.max(0, (state.goalKickPaceUsed ?? 0) - stepDistance);
                    return rem > 0
                      ? { goalKickPaceUsed: rem }
                      : { goalKickMovedPieceId: null, goalKickPaceUsed: 0 };
                  })()
                : state.phase === 'GOAL_KICK_SETUP_GK' || state.phase === 'GOAL_KICK_SETUP_OPPONENT'
                  ? (() => {
                      // GOALKICK-02 (Phase 37, 37-02): decrement the per-piece 6-hex reposition
                      // budget; delete the key entirely once it reaches 0 (mirrors freeMoveUsedPace).
                      const currentUsed = state.goalKickUsedPace?.[moveToUndo.pieceId] ?? 0;
                      const rem = Math.max(0, currentUsed - stepDistance);
                      const nextUsedPace = { ...(state.goalKickUsedPace ?? {}) };
                      if (rem > 0) {
                        nextUsedPace[moveToUndo.pieceId] = rem;
                      } else {
                        delete nextUsedPace[moveToUndo.pieceId];
                      }
                      return { goalKickUsedPace: nextUsedPace };
                    })()
                  : state.phase === 'CORNER_KICK_FINAL_SETUP'
                    ? (() => {
                        // CR-01 (38-10, gap closure): mirrors the GOAL_KICK_MOVE branch's shape
                        // exactly — cornerKickPaceUsed is the CORNER_KICK_FINAL_SETUP-equivalent
                        // scalar pace field, and cornerKickMovedPieceId is its single-piece lock.
                        const rem = Math.max(0, (state.cornerKickPaceUsed ?? 0) - stepDistance);
                        return rem > 0
                          ? { cornerKickPaceUsed: rem }
                          : { cornerKickMovedPieceId: null, cornerKickPaceUsed: 0 };
                      })()
                    : state.phase === 'CORNER_KICK_REPOSITION'
                      ? (() => {
                          // CR-02 (38-10, gap closure): refund the per-piece running-total pace
                          // budget (mirrors the goalKickUsedPace arm above, field renamed), and
                          // separately release the piece's slot in the current stage's
                          // 2-distinct-piece cap (D-GAP-01) — driven by remaining current-stage
                          // MOVE events for this piece, NOT by the pace value reaching 0, because
                          // cornerKickUsedPace is a running total across all six stages (see
                          // applyCornerKickReposition's doc comment) and would only reach 0 for a
                          // piece touched in a single stage.
                          const currentUsed = state.cornerKickUsedPace?.[moveToUndo.pieceId] ?? 0;
                          const rem = Math.max(0, currentUsed - stepDistance);
                          const nextUsedPace = { ...(state.cornerKickUsedPace ?? {}) };
                          if (rem > 0) {
                            nextUsedPace[moveToUndo.pieceId] = rem;
                          } else {
                            delete nextUsedPace[moveToUndo.pieceId];
                          }

                          const remainingStageMovesForPiece = currentSlotEvents.filter(
                            (e, idx) =>
                              idx !== lastMoveRelIdx &&
                              e.type === 'MOVE' &&
                              e.pieceId === moveToUndo.pieceId,
                          ).length;
                          const nextStagePlacedIds =
                            remainingStageMovesForPiece === 0
                              ? (state.cornerKickStagePlacedIds ?? []).filter(
                                  (id) => id !== moveToUndo.pieceId,
                                )
                              : (state.cornerKickStagePlacedIds ?? null);

                          return {
                            cornerKickUsedPace: nextUsedPace,
                            cornerKickStagePlacedIds: nextStagePlacedIds,
                          };
                        })()
                      : {};

  return {
    ok: true,
    state: {
      ...state,
      pieces: newPieces,
      paceUsedByPieceId: newPaceUsed,
      movedPieceIds: newMovedPieceIds,
      eventLog: newEventLog,
      ball: newBallAfterUndo,
      ...lockReset,
    },
  };
}

// ---------------------------------------------------------------------------
// applyCancelMovement
// ---------------------------------------------------------------------------

/**
 * Discriminated union result for applyCancelMovement.
 * BUG-02 (Phase 17 D-03/D-04): cancel MOVEMENT phase before any piece has moved.
 */
export type ApplyCancelMovementResult =
  | { ok: false; reason: 'WRONG_PHASE' | 'PIECES_ALREADY_MOVED' }
  | { ok: true; state: GameState };

/**
 * Reverts the MOVEMENT phase back to PASS, consuming no movement slot.
 *
 * BUG-02 D-03: only cancellable when no piece has moved at all in the current slot
 * (paceUsedByPieceId is empty — Pitfall 5: movedPieceIds is NOT the right check).
 * BUG-02 D-04: pressing Cancel emits game:cancel_movement; server reverts to PASS.
 * BUG-02 D-05: no movement slot is consumed.
 */
export function applyCancelMovement(state: GameState): ApplyCancelMovementResult {
  if (state.phase !== 'MOVE') {
    return { ok: false, reason: 'WRONG_PHASE' };
  }
  // BUG-02 D-03: cancel only when no piece has started moving (Pitfall 5)
  if (Object.keys(state.paceUsedByPieceId).length > 0) {
    return { ok: false, reason: 'PIECES_ALREADY_MOVED' };
  }
  // D-04: revert to CHOOSE_ACTION — as if applyStartMovement was never called
  return {
    ok: true,
    state: {
      ...state,
      phase: 'PASS',
      movementSlot: null,
      movedPieceIds: [],
      paceUsedByPieceId: {},
      stealAttemptedByIds: [], // D-02: reset at every 'PASS' transition
      tackleAttemptedByIds: [], // D-02
    },
  };
}

// ---------------------------------------------------------------------------
// applyRoll
// ---------------------------------------------------------------------------

/** Discriminated union result for applyRoll. */
export type ApplyRollResult =
  | { ok: false; reason: 'WRONG_PHASE' | 'WRONG_TEAM' }
  | { ok: true; state: GameState };

/**
 * Applies a dice roll to the current state, dispatching by phase to the correct
 * resolution branch: PASS → accuracy check; SHOT → duel; HEADER → heading duel;
 * LOOSE_BALL → direction + distance.
 *
 * ARCH-01: applyRoll is pure — it does NOT call rollDice() itself. All dice must
 * be pre-generated by the caller (Task 3 handler) and passed in as ...dice.
 * This keeps the engine deterministic for unit tests.
 *
 * D-10: Single broadcast after every resolution; lastDiceRoll embedded on every ok:true return.
 * D-13: Shot and heading ties produce LOOSE_BALL.
 * D-19/D-20: Loose Ball uses two dice (direction + distance).
 * D-27/D-28: Heading duel — attacker vs nearest defender; GK aerial challenge on attacker win.
 *
 * @param state - Current game state (phase must be PASS | SHOT | HEADER | LOOSE_BALL)
 * @param dice - Pre-generated dice values (up to 3; different branches consume different counts)
 */
export function applyRoll(state: GameState, ...dice: number[]): ApplyRollResult {
  const [d1 = 3, d2 = 3, d3 = 3] = dice;

  switch (state.phase) {
    // -------------------------------------------------------------------------
    // PASS: per-type accuracy → ball delivery → interception loop → LOOSE_BALL on inaccurate
    //
    // D-05: per-type accuracy gate — HIGH_PASS and LONG_BALL require validatePassAccuracy;
    //       STANDARD_PASS and FIRST_TIME_PASS skip accuracy and always deliver the ball (D-01/D-02).
    // D-14: accurate pass delivers ball to passTargetHex; sets ball.carrierId to teammate or null.
    // D-11/D-12: adjacent defenders auto-roll for interception before delivery (PASS-01).
    // D-09/Pitfall 8: accurate STANDARD pass MUST NOT transition to SHOT; phase returns to PASS.
    // Time cost: +0 for FIRST_TIME_PASS; +1 for all other types.
    //
    // The handler (plan 08.2-04) is responsible for setting passTargetHex + lastActionType on
    // state BEFORE calling applyRoll. Engine returns WRONG_PHASE if passTargetHex is absent.
    // -------------------------------------------------------------------------
    case 'PASS': {
      const carrier = state.pieces.find((p) => p.id === state.ball.carrierId);
      if (!carrier) return { ok: false, reason: 'WRONG_PHASE' };

      // T-08.2-03: passTargetHex must be set by the handler before this branch runs.
      const targetHex = state.passTargetHex;
      if (targetHex == null) return { ok: false, reason: 'WRONG_PHASE' };

      // FIRST_TIME_PASS costs 0 min; all other pass types cost +1 min.
      const passTimeCost = state.lastActionType === 'FIRST_TIME_PASS' ? 0 : 1;

      // D-05: accuracy gate — HIGH_PASS and LONG_BALL require an accuracy check.
      // CORNER-04: a corner's Low option (STANDARD_PASS lastActionType with cornerKickTeam
      // set) is subject to the same 8+ combined-score accuracy check as High Pass. The
      // PERSISTENT `cornerKickTeam` field — not `lastActionType` — is the corner signal:
      // the GAME_ROLL handler overwrites `lastActionType` with the client's chosen passType
      // (STANDARD_PASS or HIGH_PASS) before applyRoll runs, so `lastActionType` alone cannot
      // distinguish a corner Low pass from an ordinary Standard Pass. `!= null` (loose) so
      // both `null` and `undefined` are handled, matching the optional field declaration.
      const requiresAccuracyCheck =
        state.lastActionType === 'HIGH_PASS' ||
        state.lastActionType === 'LONG_BALL' ||
        (state.cornerKickTeam != null && state.lastActionType === 'STANDARD_PASS');

      let accurate = true;
      if (requiresAccuracyCheck) {
        // CORNER-04: a corner Low pass (lastActionType === 'STANDARD_PASS') falls through
        // to the 'HIGH' default below — its threshold is 8, same as High Pass — never a
        // new accuracy type. A corner High pass IS 'HIGH_PASS' and also uses the default.
        let accuracyType: 'HIGH' | 'LONG_SAME_THIRD' | 'LONG_CROSS_THIRD' = 'HIGH';
        if (state.lastActionType === 'LONG_BALL') {
          const crossThird =
            (isInRegion(carrier.position, 'homeThird') && isInRegion(targetHex, 'awayThird')) ||
            (isInRegion(carrier.position, 'awayThird') && isInRegion(targetHex, 'homeThird'));
          accuracyType = crossThird ? 'LONG_CROSS_THIRD' : 'LONG_SAME_THIRD';
        }
        const accuracyResult = validatePassAccuracy(carrier, accuracyType, d1, []);
        accurate = accuracyResult.accurate;
      }

      if (!accurate) {
        // CORNER-04/T-38-15: a corner's own inaccurate roll (High or Low) gets a dedicated
        // CORNER_KICK_ACCURACY event and an early return — it must NOT fall through to the
        // inaccuratePassType cast below, which is only sound for HIGH_PASS/LONG_BALL because
        // STANDARD_PASS could never reach this branch before corners existed (Rule 1 bugfix:
        // that cast is unsound for a corner Low pass's STANDARD_PASS lastActionType).
        if (state.cornerKickTeam != null) {
          const cornerPassType: 'HIGH' | 'LOW' =
            state.lastActionType === 'HIGH_PASS' ? 'HIGH' : 'LOW';
          const cornerKickScore = computeCombinedScore(carrier.highPass, d1, []);
          let cornerInaccurateLog: readonly ActionEvent[] = [
            ...state.eventLog,
            {
              type: 'CORNER_KICK_ACCURACY',
              takerId: state.cornerKickTakerId ?? carrier.id,
              passType: cornerPassType,
              targetHex,
              accurate: false,
              kickDie: d1,
              kickScore: cornerKickScore,
              timestamp: Date.now(),
              ballAfter: { position: state.ball.position, carrierId: null },
            },
          ];
          if (cornerPassType === 'HIGH') {
            // Keep the existing HP_ACCURACY event too so the ActionLog's High Pass
            // narration (which reads HP_ACCURACY specifically) is unbroken.
            cornerInaccurateLog = [
              ...cornerInaccurateLog,
              {
                type: 'HP_ACCURACY' as const,
                passerId: state.highPassCarrierId ?? '',
                accurate: false,
                timestamp: Date.now(),
              },
            ];
          }
          return {
            ok: true,
            state: {
              ...state,
              phase: 'LOOSE_BALL',
              // Preserve the existing ball-position rule for the LOOSE_BALL return (High:
              // state.ball.position — treat corner Low the same as High since the corner
              // ball has not moved to the target).
              ball: {
                position: state.ball.position,
                carrierId: null,
                lastTouchedBy: { pieceId: carrier.id, teamId: carrier.teamId },
              },
              lastDiceRoll: { rolls: [d1], context: 'PASS_ACCURACY' },
              lastActionType: 'DEFLECTION',
              actionCount: state.actionCount + passTimeCost,
              passTargetHex: null,
              eventLog: cornerInaccurateLog,
              // T-38-14: tear down every cornerKick* field now that the corner has resolved
              // (inaccurate) — the next STANDARD_PASS must not be accuracy-gated (Task 3).
              ...CORNER_KICK_TEARDOWN,
            },
          };
        }

        // D-05/PASS-05: inaccurate → LOOSE_BALL; ball stays at carrier position.
        // HIGH_PASS: event was already logged at target selection (accurate: null); don't re-log.
        const inaccuratePassType = state.lastActionType as 'HIGH_PASS' | 'LONG_BALL';
        const inaccurateLog: readonly ActionEvent[] =
          inaccuratePassType === 'HIGH_PASS'
            ? [
                ...state.eventLog,
                {
                  type: 'HP_ACCURACY' as const,
                  passerId: state.highPassCarrierId ?? '',
                  accurate: false,
                  timestamp: Date.now(),
                },
              ]
            : [
                ...state.eventLog,
                {
                  type: inaccuratePassType,
                  from: carrier.position,
                  to: targetHex,
                  accurate: false,
                  timestamp: Date.now(),
                  ballAfter: { position: targetHex, carrierId: null },
                },
              ];
        return {
          ok: true,
          state: {
            ...state,
            phase: 'LOOSE_BALL',
            // HIGH_PASS: ball already at target (moved during repositioning); use state.ball.position.
            // LONG_BALL: ball stays at carrier until accuracy check — scatter from targetHex.
            ball: {
              position: inaccuratePassType === 'LONG_BALL' ? targetHex : state.ball.position,
              carrierId: null,
              // Kicker is the last toucher — the pass left them with no immediate receiver.
              lastTouchedBy: { pieceId: carrier.id, teamId: carrier.teamId },
            },
            lastDiceRoll: { rolls: [d1], context: 'PASS_ACCURACY' },
            lastActionType: 'DEFLECTION',
            actionCount: state.actionCount + passTimeCost,
            passTargetHex: null,
            eventLog: inaccurateLog,
          },
        };
      }

      // Accurate path: run the interception loop before delivery (D-11/D-12 / PASS-01).
      // Map lastActionType → validatePass passType.
      const passTypeMap: Record<string, 'STANDARD' | 'FIRST_TIME' | 'HIGH' | 'LONG'> = {
        STANDARD_PASS: 'STANDARD',
        FIRST_TIME_PASS: 'FIRST_TIME',
        HIGH_PASS: 'HIGH',
        LONG_BALL: 'LONG',
      };
      const validatePassType: 'STANDARD' | 'FIRST_TIME' | 'HIGH' | 'LONG' =
        (state.lastActionType && passTypeMap[state.lastActionType]) ?? 'STANDARD';

      const passResult = validatePass(
        state,
        carrier,
        carrier.position,
        targetHex,
        validatePassType,
      );
      // D-10: split interceptors into autoIntercepts (case 1: no roll) and rollIntercepts (case 3: threshold roll)
      const autoIntercepts = passResult.ok ? passResult.autoIntercepts : [];
      const rollIntercepts = passResult.ok ? passResult.rollIntercepts : [];

      // Resolve pass type before the interception loop so early returns can use it.
      const newLastActionType: LastActionType =
        state.lastActionType !== null &&
        (['STANDARD_PASS', 'HIGH_PASS', 'LONG_BALL', 'FIRST_TIME_PASS'] as string[]).includes(
          state.lastActionType,
        )
          ? state.lastActionType
          : 'STANDARD_PASS';

      // Log the pass attempt — HIGH_PASS was already logged at target selection (handler), skip it.
      const deliveredPassType = newLastActionType as
        | 'STANDARD_PASS'
        | 'HIGH_PASS'
        | 'LONG_BALL'
        | 'FIRST_TIME_PASS';
      // Look up the receiver at targetHex for ballAfter tracking on pass/interception events.
      const passTeammate = state.pieces.find(
        (p) =>
          p.teamId === carrier.teamId &&
          p.position.q === targetHex.q &&
          p.position.r === targetHex.r,
      );
      // CORNER-04/CORNER-05: log the corner's own accuracy roll BEFORE the per-type delivery
      // event below, so a High corner shows [accuracy check, HP_ACCURACY, ...] and a Low
      // corner shows [accuracy check, STANDARD_PASS delivery, ...] in the ActionLog. Mirrors
      // the inaccurate branch's CORNER_KICK_ACCURACY-then-HP_ACCURACY ordering above.
      let newEventLog: readonly ActionEvent[] = state.eventLog;
      if (state.cornerKickTeam != null) {
        const cornerPassType: 'HIGH' | 'LOW' = deliveredPassType === 'HIGH_PASS' ? 'HIGH' : 'LOW';
        const cornerKickScore = computeCombinedScore(carrier.highPass, d1, []);
        newEventLog = [
          ...newEventLog,
          {
            type: 'CORNER_KICK_ACCURACY',
            takerId: state.cornerKickTakerId ?? carrier.id,
            passType: cornerPassType,
            targetHex,
            accurate: true,
            kickDie: d1,
            kickScore: cornerKickScore,
            timestamp: Date.now(),
            ballAfter: { position: targetHex, carrierId: passTeammate?.id ?? null },
          },
        ];
      }
      if (deliveredPassType === 'HIGH_PASS') {
        newEventLog = [
          ...newEventLog,
          {
            type: 'HP_ACCURACY' as const,
            passerId: state.highPassCarrierId ?? '',
            accurate: true,
            timestamp: Date.now(),
          },
        ];
      } else {
        const passAttemptEvent: ActionEvent = {
          type: deliveredPassType,
          // D-27: include passer ID for team-colour prefix in ActionLog
          passerId: carrier.id,
          from: carrier.position,
          to: targetHex,
          accurate: true,
          timestamp: Date.now(),
          ballAfter: { position: targetHex, carrierId: passTeammate?.id ?? null },
        };
        newEventLog = [...newEventLog, passAttemptEvent];
      }

      // BUG-01 (Phase 17 D-01): header passes are unblockable — skip interception entirely.
      // When the carrier just won a header (lastActionType==='HEADER'), their FIRST_TIME_PASS
      // cannot be intercepted. Any other pass type runs the interception loop as normal.
      const isHeaderPass = state.lastActionType === 'HEADER';
      // CR-02-new (Phase 17.1 D-03): a first-time pass must always reach FIRST_TIME_PASS_MOVE
      // below, even when aimed near a defender — passValidator groups FIRST_TIME with STANDARD
      // for interception-list population (passValidator.ts:140), so autoIntercepts/rollIntercepts
      // can be non-empty for an FTP target. Bypass the loop for FIRST_TIME_PASS too; the
      // no-interception delivery is part of the FTP design (D-03), not a regression.
      const isFirstTimePass = newLastActionType === 'FIRST_TIME_PASS';
      // Assumption A2 (38-RESEARCH.md) — CORRECTED by the Phase 38 human-verification
      // checkpoint (38-09-SUMMARY.md, A2 verdict CORRECTED (partial); narrowed here in
      // gap-closure plan 38-13): only a High Pass corner is non-interceptable — it flies
      // directly into the box, mirroring HIGH_PASS/LONG_BALL's fly-over behaviour. A Low
      // Pass corner IS interceptable — it is a grounded pass a defender can step in front
      // of, same as an ordinary Standard Pass. `newLastActionType` (not `state.lastActionType`)
      // is used so this flag agrees with `deliveredPassType` used elsewhere in this block.
      const isCornerKickHighDelivery =
        state.cornerKickTeam != null && newLastActionType === 'HIGH_PASS';
      if (!isHeaderPass && !isFirstTimePass && !isCornerKickHighDelivery) {
        // D-10 case 1: autoIntercepts — destination hex was defender's hex; immediate interception, no dice.
        for (const interceptor of autoIntercepts) {
          const interceptionEvent: ActionEvent = {
            type: 'STEAL_ATTEMPT',
            defenderId: interceptor.id,
            result: 'SUCCESS',
            defenderDie: 0, // no dice roll for auto-intercept
            defenderCombined: 0,
            timestamp: Date.now(),
            ballAfter: { position: interceptor.position, carrierId: interceptor.id },
          };
          newEventLog = [...newEventLog, interceptionEvent];
          // Immediate possession transfer — first auto-interceptor wins.
          return {
            ok: true,
            state: {
              ...state,
              phase: 'PASS',
              ball: {
                position: interceptor.position,
                carrierId: interceptor.id,
                lastTouchedBy: { pieceId: interceptor.id, teamId: interceptor.teamId },
              },
              attackingTeam: interceptor.teamId,
              activeTeam: interceptor.teamId,
              lastActionType: 'SUCCESSFUL_TACKLE',
              actionCount: state.actionCount + passTimeCost,
              passTargetHex: null,
              preGeneratedInterceptionDice: [],
              lastDiceRoll: { rolls: [d1], context: 'PASS_ACCURACY' },
              stealAttemptedByIds: [], // D-02: reset at every 'PASS' transition
              tackleAttemptedByIds: [], // D-02
              eventLog: newEventLog,
              // T-38-43/38-13: unconditional no-op for a non-corner pass; tears down an
              // auto-intercepted Low corner so the next STANDARD_PASS is not accuracy-gated.
              ...CORNER_KICK_TEARDOWN,
            },
          };
        }

        // D-10 case 3: rollIntercepts — ZoI defenders; die===6 || combined>=10 threshold.
        for (let i = 0; i < rollIntercepts.length; i++) {
          const interceptor = rollIntercepts[i]!;
          const die = state.preGeneratedInterceptionDice?.[i] ?? 3;
          const combined = computeCombinedScore(interceptor.tackling, die, []);
          const intercepted = die === 6 || combined >= 10;
          const interceptionEvent: ActionEvent = {
            type: 'STEAL_ATTEMPT',
            defenderId: interceptor.id,
            result: intercepted ? 'SUCCESS' : 'FAIL',
            defenderDie: die,
            defenderCombined: combined,
            timestamp: Date.now(),
            ballAfter: intercepted
              ? { position: interceptor.position, carrierId: interceptor.id }
              : { position: targetHex, carrierId: passTeammate?.id ?? null },
          };
          newEventLog = [...newEventLog, interceptionEvent];
          if (intercepted) {
            // D-11/D-12: interception — first success wins; transfer possession.
            return {
              ok: true,
              state: {
                ...state,
                phase: 'PASS',
                ball: {
                  position: interceptor.position,
                  carrierId: interceptor.id,
                  lastTouchedBy: { pieceId: interceptor.id, teamId: interceptor.teamId },
                },
                attackingTeam: interceptor.teamId,
                activeTeam: interceptor.teamId,
                lastActionType: 'SUCCESSFUL_TACKLE',
                actionCount: state.actionCount + passTimeCost,
                passTargetHex: null,
                preGeneratedInterceptionDice: [],
                lastDiceRoll: { rolls: [d1], context: 'PASS_ACCURACY' },
                stealAttemptedByIds: [], // D-02: reset at every 'PASS' transition
                tackleAttemptedByIds: [], // D-02
                eventLog: newEventLog,
                // T-38-43/38-13: unconditional no-op for a non-corner pass; tears down a
                // roll-intercepted Low corner so the next STANDARD_PASS is not accuracy-gated.
                ...CORNER_KICK_TEARDOWN,
              },
            };
          }
        }
      }

      // D-03 (Phase 17.1): FIRST_TIME_PASS → enter two-slot repositioning phase.
      // This check MUST run before the generic occupant-check below: a first-time pass is
      // virtually always aimed at a visible teammate's (occupied) hex, so if the occupant-check
      // ran first it would short-circuit and FIRST_TIME_PASS_MOVE would become unreachable in
      // real play (see .planning/debug/ftp-no-reposition-prompt.md).
      // Ball stays in flight (carrierId = null, position = targetHex) until both teams
      // have ended their repositioning turns, at which point the handler delivers the ball.
      // passTargetHex is preserved so the GAME_END_TURN handler knows where to deliver.
      //
      // BUG-12: FTP_MOVE_ENABLED gates whether the repositioning sub-phase is entered.
      // When false (default), ball is delivered directly at targetHex — mirroring the
      // STANDARD_PASS occupant-pickup/delivery path (BUG-04 included). The interception
      // bypass already applied above still holds for the direct-delivery path.
      if (newLastActionType === 'FIRST_TIME_PASS') {
        if (FTP_MOVE_ENABLED) {
          // Toggle ON: enter the two-slot repositioning phase (original behaviour).
          return {
            ok: true,
            state: {
              ...state,
              phase: 'FIRST_TIME_PASS_MOVE',
              // Ball in flight, no immediate receiver yet — kicker is the last toucher.
              ball: {
                position: targetHex,
                carrierId: null,
                lastTouchedBy: { pieceId: carrier.id, teamId: carrier.teamId },
              },
              lastDiceRoll: { rolls: [d1], context: 'PASS_ACCURACY' },
              lastActionType: 'FIRST_TIME_PASS',
              actionCount: state.actionCount + passTimeCost,
              // passTargetHex preserved — GAME_END_TURN delivers ball here after both slots
              passTargetHex: targetHex,
              preGeneratedInterceptionDice: [],
              firstTimePassMovementSlot: 'ATTACKER',
              firstTimePassMovedPieceId: null,
              firstTimePassPaceUsed: 0,
              // D-03 (Phase 17.1-16): record the passer's id so the GAME_MOVE handler and the
              // delivery occupant lookup can exclude them from repositioning onto / receiving
              // back their own pass (cycle-4 verifier self-pass-reclaim finding). Mirrors
              // highPassCarrierId: kickerId at gameHandlers.ts.
              firstTimePassCarrierId: carrier.id,
              activeTeam: state.attackingTeam,
              eventLog: newEventLog,
            },
          };
        }

        // Toggle OFF: deliver ball directly at targetHex.
        // BUG-04 parity: find ANY piece at targetHex (any team) — defender-occupied hex
        // results in possession transfer, mirroring the STANDARD_PASS occupant-pickup path.
        const ftpOccupant = state.pieces.find(
          (p) => p.position.q === targetHex.q && p.position.r === targetHex.r,
        );
        if (ftpOccupant) {
          const possessionChanges = ftpOccupant.teamId !== carrier.teamId;
          return {
            ok: true,
            state: {
              ...state,
              phase: 'PASS',
              ball: {
                position: ftpOccupant.position,
                carrierId: ftpOccupant.id,
                lastTouchedBy: { pieceId: ftpOccupant.id, teamId: ftpOccupant.teamId },
              },
              attackingTeam: possessionChanges ? ftpOccupant.teamId : state.attackingTeam,
              activeTeam: possessionChanges ? ftpOccupant.teamId : state.activeTeam,
              lastDiceRoll: { rolls: [d1], context: 'PASS_ACCURACY' },
              lastActionType: 'FIRST_TIME_PASS',
              actionCount: state.actionCount + passTimeCost,
              passTargetHex: null,
              preGeneratedInterceptionDice: [],
              stealAttemptedByIds: [], // D-02: reset at every 'PASS' transition
              tackleAttemptedByIds: [], // D-02
              eventLog: newEventLog,
            },
          };
        }
        // No occupant: ball delivered to empty targetHex (no carrier).
        return {
          ok: true,
          state: {
            ...state,
            phase: 'PASS',
            // No occupant: ball left the kicker with no immediate receiver.
            ball: {
              position: targetHex,
              carrierId: null,
              lastTouchedBy: { pieceId: carrier.id, teamId: carrier.teamId },
            },
            lastDiceRoll: { rolls: [d1], context: 'PASS_ACCURACY' },
            lastActionType: 'FIRST_TIME_PASS',
            actionCount: state.actionCount + passTimeCost,
            passTargetHex: null,
            preGeneratedInterceptionDice: [],
            stealAttemptedByIds: [], // D-02: reset at every 'PASS' transition
            tackleAttemptedByIds: [], // D-02
            eventLog: newEventLog,
          },
        };
      }

      // No interception: deliver ball to target hex.
      // BUG-04 (Phase 17 D-08/D-09/D-10): find ANY piece at targetHex (any team).
      // Applies to STANDARD_PASS, LONG_BALL — NOT HIGH_PASS (D-10) and NOT FIRST_TIME_PASS
      // (handled above, before this check, per D-03).
      // HIGH_PASS routes to the HEADER branch below, so we skip the occupant check for it.
      // If a piece occupies targetHex, they pick up the ball.
      // If that piece is on the opposing team, possession transfers to their team (D-09).
      if (newLastActionType !== 'HIGH_PASS') {
        const occupant = state.pieces.find(
          (p) => p.position.q === targetHex.q && p.position.r === targetHex.r,
        );
        if (occupant) {
          const possessionChanges = occupant.teamId !== carrier.teamId;
          return {
            ok: true,
            state: {
              ...state,
              phase: 'PASS',
              ball: {
                position: occupant.position,
                carrierId: occupant.id,
                lastTouchedBy: { pieceId: occupant.id, teamId: occupant.teamId },
              },
              attackingTeam: possessionChanges ? occupant.teamId : state.attackingTeam,
              activeTeam: possessionChanges ? occupant.teamId : state.activeTeam,
              lastDiceRoll: { rolls: [d1], context: 'PASS_ACCURACY' },
              lastActionType: newLastActionType,
              actionCount: state.actionCount + passTimeCost,
              passTargetHex: null,
              preGeneratedInterceptionDice: [],
              stealAttemptedByIds: [], // D-02: reset at every 'PASS' transition
              tackleAttemptedByIds: [], // D-02
              eventLog: newEventLog,
              // T-38-14: unconditional no-op for a non-corner pass; tears down a corner
              // Low delivery to an occupied target hex (Task 3).
              ...CORNER_KICK_TEARDOWN,
            },
          };
        }
      }

      // Find teammate at target (same teamId, matching q/r) — fallback for no-occupant path.
      const teammate = state.pieces.find(
        (p) =>
          p.teamId === carrier.teamId &&
          p.position.q === targetHex.q &&
          p.position.r === targetHex.r,
      );

      // After HIGH_PASS, transition to HEADER (or LOOSE_BALL if no eligible players).
      // All other pass types → PASS (neutral action choice).
      if (newLastActionType === 'HIGH_PASS') {
        // 5.1: check if any player from either team is within 2 hexes of the target
        const homeEligible = state.pieces.some(
          (p) => p.teamId === 'home' && hexDistance(p.position, targetHex) <= 2,
        );
        const awayEligible = state.pieces.some(
          (p) => p.teamId === 'away' && hexDistance(p.position, targetHex) <= 2,
        );

        if (!homeEligible && !awayEligible) {
          // No eligible players → ball falls loose at target (no header contest)
          return {
            ok: true,
            state: {
              ...state,
              phase: 'LOOSE_BALL',
              // Ball left the kicker with no immediate receiver — kicker is the last toucher.
              ball: {
                position: targetHex,
                carrierId: null,
                lastTouchedBy: { pieceId: carrier.id, teamId: carrier.teamId },
              },
              lastDiceRoll: { rolls: [d1], context: 'PASS_ACCURACY' },
              lastActionType: 'DEFLECTION',
              actionCount: state.actionCount + passTimeCost,
              passTargetHex: null,
              preGeneratedInterceptionDice: [],
              eventLog: newEventLog,
              // T-38-14: tears down a corner High delivery with no eligible header
              // contestants (Task 3); unconditional no-op for a non-corner High Pass.
              ...CORNER_KICK_TEARDOWN,
            },
          };
        }

        // 5.2: auto-confirm teams with no eligible players (they automatically decline)
        return {
          ok: true,
          state: {
            ...state,
            phase: 'HEADER',
            // Ball left the kicker with no immediate receiver — kicker is the last toucher.
            ball: {
              position: targetHex,
              carrierId: null,
              lastTouchedBy: { pieceId: carrier.id, teamId: carrier.teamId },
            },
            lastDiceRoll: { rolls: [d1], context: 'PASS_ACCURACY' },
            lastActionType: newLastActionType,
            actionCount: state.actionCount + passTimeCost,
            passTargetHex: null,
            preGeneratedInterceptionDice: [],
            eventLog: newEventLog,
            headerContestants: { home: [] as string[], away: [] as string[] },
            headerConfirmed: { home: !homeEligible, away: !awayEligible },
            headerTargetHex: null,
            headerAccuracyRollPending: true, // RULE-01 (Phase 11): gate contestant selection until attacker acks roll
            // T-38-14: tears down an accurate corner High kick entering HEADER (Task 3);
            // unconditional no-op for a non-corner High Pass.
            ...CORNER_KICK_TEARDOWN,
          },
        };
      }

      return {
        ok: true,
        state: {
          ...state,
          phase: 'PASS',
          ball: {
            position: targetHex,
            carrierId: teammate?.id ?? null,
            lastTouchedBy: teammate
              ? { pieceId: teammate.id, teamId: teammate.teamId }
              : { pieceId: carrier.id, teamId: carrier.teamId },
          },
          lastDiceRoll: { rolls: [d1], context: 'PASS_ACCURACY' },
          lastActionType: newLastActionType,
          actionCount: state.actionCount + passTimeCost,
          passTargetHex: null,
          preGeneratedInterceptionDice: [],
          stealAttemptedByIds: [], // D-02: reset at every 'PASS' transition
          tackleAttemptedByIds: [], // D-02
          eventLog: newEventLog,
          // T-38-14: tears down a corner Low delivery to an empty/teammate target hex
          // (Task 3); unconditional no-op for any non-corner pass type.
          ...CORNER_KICK_TEARDOWN,
        },
      };
    }

    // -------------------------------------------------------------------------
    // SHOT: shooter vs GK duel (SHOT-01/D-13/D-17); GOAL/LOOSE_BALL/SAVE/MISS
    // -------------------------------------------------------------------------
    case 'SHOT': {
      const shooter = state.pieces.find((p) => p.id === state.ball.carrierId);
      if (!shooter) return { ok: false, reason: 'WRONG_PHASE' };

      // Find the opposing GK (role:'GK' on the non-attacking team)
      const opposingTeam = state.attackingTeam === 'home' ? 'away' : 'home';
      const gk = state.pieces.find((p) => p.teamId === opposingTeam && p.role === 'GK');
      if (!gk) return { ok: false, reason: 'WRONG_PHASE' };

      // Pre-generate all dice upfront (Pitfall 4): shooterDice, gkDice, handlingDice
      const shooterDice = d1;
      const gkDice = d2;
      const handlingDice = d3;

      // SHOT-04: penalty determined by how far GK moved from their piece position (dive distance).
      // applyGKDive enforces ≤3 hexes, so !diveResult.saveable is dead code through the normal
      // path — kept for defence in depth.
      const gkEffectivePos = state.gkDivePosition ?? gk.position;
      const shotTarget = state.shotTargetHex ?? gk.position;
      const diveDistance = hexDistance(gk.position, gkEffectivePos);
      const diveResult = validateGKDive(gk, diveDistance);

      // After shot resolves, update GK piece position to where they actually are.
      // Prevents the GK snapping back to pre-dive position after phase transitions.
      const piecesWithGKPos =
        state.gkDivePosition != null
          ? state.pieces.map((p) => (p.id === gk.id ? { ...p, position: gkEffectivePos } : p))
          : state.pieces;

      // Shared dice roll record for all outcomes.
      const shotDiceRoll: { rolls: number[]; context: string } = {
        rolls: [shooterDice, gkDice, handlingDice],
        context: 'SHOT_DUEL',
      };

      // SHOT-04 unsaveable: GK ≥4 hexes from goal target — automatic GOAL (no duel).
      if (!diveResult.saveable) {
        const scoringTeam = state.attackingTeam;
        const newKickOffTeam: 'home' | 'away' = opposingTeam;
        const newScoreUnsaveable = { ...state.score, [scoringTeam]: state.score[scoringTeam] + 1 };
        // D-01 (BUG-30): hoisted so the exact same reset pieces feed both state.pieces and the
        // GOAL event's piecesAfter — mirrors the resetPieces hoist at applyHalfTimeStart:4442.
        const resetPieces = buildKickOffPieces(
          newKickOffTeam,
          state.selectedTeams,
          state.selectedFormation,
        );
        const shotAttemptGoal: ActionEvent = {
          type: 'SHOT_ATTEMPT',
          shooterId: shooter.id,
          gkId: gk.id,
          targetHex: shotTarget,
          outcome: 'GOAL',
          shooterDie: shooterDice,
          shooterScore: null, // no duel — GK out of range
          gkDie: gkDice,
          gkScore: null,
          handlingDie: null,
          gkHandling: null,
          shooterPenaltyTotal: 0,
          gkPenaltyTotal: 0,
          timestamp: Date.now(),
          ballAfter: { position: PITCH_REGIONS.kickOffHex, carrierId: null },
        };
        return {
          ok: true,
          state: {
            ...state,
            pieces: resetPieces,
            phase: 'KICK_OFF_SETUP',
            score: newScoreUnsaveable,
            attackingTeam: newKickOffTeam,
            activeTeam: newKickOffTeam,
            ball: { position: PITCH_REGIONS.kickOffHex, carrierId: null, lastTouchedBy: null }, // kick-off reset — fresh state
            lastDiceRoll: shotDiceRoll,
            lastActionType: null,
            lastShotPath: null,
            snapshotGkPenalty: null,
            // BUG-06 / D-47: a goal is a major dead-ball restart — clear ALL offside flags
            // so pieces are not shown as offside during the kick-off setup phase.
            offsidePieceIds: [],
            eventLog: [
              ...state.eventLog,
              shotAttemptGoal,
              {
                type: 'GOAL' as const,
                scoringTeam,
                scorerId: shooter.id,
                timestamp: Date.now(),
                ballAfter: { position: PITCH_REGIONS.kickOffHex, carrierId: null },
                piecesAfter: resetPieces, // D-01 (BUG-30)
              },
            ],
          },
        };
      }

      // GK saving penalty always comes from validateGKDive's distance-based result.
      // Snapshot shots go through GK_DIVE same as regular shots — no special-case needed.
      const gkSavingPenalty = diveResult.savingPenalty;
      const gkPenalties = [gkSavingPenalty];

      // D-19: shot costs +0 min; actionCount unchanged throughout SHOT branch
      const shooterPenalties: number[] = [];
      // Apply -1 if shooter is outside the opponent's penalty area (outside-area rule)
      const opponentPenaltyArea =
        state.attackingTeam === 'home' ? 'awayPenaltyArea' : 'homePenaltyArea';
      if (!isInRegion(shooter.position, opponentPenaltyArea)) {
        shooterPenalties.push(-1);
      }

      // Compute duel scores for event log (same formula as validateShotDuel → computeCombinedScore)
      const duelShooterScore = computeCombinedScore(
        shooter.shooting,
        shooterDice,
        shooterPenalties,
      );
      const duelGkScore = computeCombinedScore(gk.saving, gkDice, gkPenalties);
      // Effective (clamped) penalty = score − die − raw stat; will be 0, -1, or -2
      const shooterPenaltyTotal = duelShooterScore - shooterDice - shooter.shooting;
      const gkPenaltyTotal = duelGkScore - gkDice - gk.saving;

      const shotResultWithPenalty = validateShotDuel(
        shooter,
        gk,
        shooterDice,
        gkDice,
        shooterPenalties,
        gkPenalties,
      );

      if (shotResultWithPenalty.outcome === 'GOAL') {
        const scoringTeam = state.attackingTeam;
        const newKickOffTeam: 'home' | 'away' = opposingTeam;
        const newScore = { ...state.score, [scoringTeam]: state.score[scoringTeam] + 1 };
        // D-01 (BUG-30): hoisted so the exact same reset pieces feed both state.pieces and the
        // GOAL event's piecesAfter — mirrors the resetPieces hoist at applyHalfTimeStart:4442.
        const resetPieces = buildKickOffPieces(
          newKickOffTeam,
          state.selectedTeams,
          state.selectedFormation,
        );
        const shotAttemptGoal: ActionEvent = {
          type: 'SHOT_ATTEMPT',
          shooterId: shooter.id,
          gkId: gk.id,
          targetHex: shotTarget,
          outcome: 'GOAL',
          shooterDie: shooterDice,
          shooterScore: duelShooterScore,
          gkDie: gkDice,
          gkScore: duelGkScore,
          handlingDie: null,
          gkHandling: null,
          shooterPenaltyTotal,
          gkPenaltyTotal,
          timestamp: Date.now(),
          ballAfter: { position: PITCH_REGIONS.kickOffHex, carrierId: null },
        };
        return {
          ok: true,
          state: {
            ...state,
            pieces: resetPieces,
            phase: 'KICK_OFF_SETUP',
            score: newScore,
            attackingTeam: newKickOffTeam,
            activeTeam: newKickOffTeam,
            ball: { position: PITCH_REGIONS.kickOffHex, carrierId: null, lastTouchedBy: null }, // kick-off reset — fresh state
            lastDiceRoll: shotDiceRoll,
            lastActionType: null,
            lastShotPath: null,
            snapshotGkPenalty: null,
            // BUG-06 / D-47: a goal is a major dead-ball restart — clear ALL offside flags
            // so pieces are not shown as offside during the kick-off setup phase.
            offsidePieceIds: [],
            eventLog: [
              ...state.eventLog,
              shotAttemptGoal,
              {
                type: 'GOAL' as const,
                scoringTeam,
                scorerId: shooter.id,
                timestamp: Date.now(),
                ballAfter: { position: PITCH_REGIONS.kickOffHex, carrierId: null },
                piecesAfter: resetPieces, // D-01 (BUG-30)
              },
            ],
          },
        };
      }

      if (shotResultWithPenalty.outcome === 'LOOSE_BALL') {
        const shotAttempt: ActionEvent = {
          type: 'SHOT_ATTEMPT',
          shooterId: shooter.id,
          gkId: gk.id,
          targetHex: shotTarget,
          outcome: 'LOOSE_BALL',
          shooterDie: shooterDice,
          shooterScore: duelShooterScore,
          gkDie: gkDice,
          gkScore: duelGkScore,
          handlingDie: null,
          gkHandling: null,
          shooterPenaltyTotal,
          gkPenaltyTotal,
          timestamp: Date.now(),
          // BUG-36 (Phase 36/D-14): the ball is blocked at the keeper's dive-adjusted hex on a
          // duel tie, not left at the shooter's hex — matches the SAVE branches' gkEffectivePos usage below.
          ballAfter: { position: gkEffectivePos, carrierId: null },
        };
        return {
          ok: true,
          state: {
            ...state,
            pieces: piecesWithGKPos,
            phase: 'LOOSE_BALL',
            // BUG-36 (Phase 36/D-14): loose-ball scatter must originate from the keeper's
            // dive-adjusted hex, not the shooter's hex — matches the SAVE branches' gkEffectivePos usage below.
            // D-06: a duel tie means the GK blocked the shot without catching it — GK is the last toucher.
            ball: {
              position: gkEffectivePos,
              carrierId: null,
              lastTouchedBy: { pieceId: gk.id, teamId: gk.teamId },
            },
            lastDiceRoll: shotDiceRoll,
            lastActionType: 'DEFLECTION',
            lastShotPath: null, // RULE-03: clear stale shot path on LOOSE_BALL (tie)
            snapshotGkPenalty: null,
            eventLog: [...state.eventLog, shotAttempt],
          },
        };
      }

      // SAVE: run handling check (shotResult.outcome === 'SAVE', needsHandlingCheck: true)
      if (shotResultWithPenalty.outcome === 'SAVE') {
        const handling = validateHandlingCheck(gk, handlingDice);
        const saveOutcome = handling.caught ? 'SAVE' : 'LOOSE_BALL';
        const shotAttempt: ActionEvent = {
          type: 'SHOT_ATTEMPT',
          shooterId: shooter.id,
          gkId: gk.id,
          targetHex: shotTarget,
          outcome: saveOutcome,
          shooterDie: shooterDice,
          shooterScore: duelShooterScore,
          gkDie: gkDice,
          gkScore: duelGkScore,
          handlingDie: handlingDice,
          gkHandling: gk.handling,
          shooterPenaltyTotal,
          gkPenaltyTotal,
          timestamp: Date.now(),
          ballAfter: handling.caught
            ? { position: gkEffectivePos, carrierId: gk.id }
            : { position: gkEffectivePos, carrierId: null },
        };
        if (handling.caught) {
          return {
            ok: true,
            state: {
              ...state,
              pieces: piecesWithGKPos,
              phase: 'GK_RESTART',
              ball: {
                position: gkEffectivePos,
                carrierId: gk.id,
                lastTouchedBy: { pieceId: gk.id, teamId: gk.teamId },
              },
              activeTeam: gk.teamId,
              attackingTeam: gk.teamId,
              lastDiceRoll: shotDiceRoll,
              lastShotPath: null, // clear path — save resolved, GK has the ball
              snapshotGkPenalty: null,
              eventLog: [...state.eventLog, shotAttempt],
            },
          };
        } else {
          // 38-14 (closes Phase 17.1 D-07): a failed handling check spills the ball — it
          // becomes a real Loose Ball scattering from the keeper's dive-adjusted hex, not a
          // clean catch. The next LOOSE_BALL case's scatter walk (and its existing
          // triggerOutOfBoundsRestart call) classifies a byline-ward exit as a Corner Kick,
          // mirroring the SHOT duel-tie LOOSE_BALL branch above. Possession is NOT handed to
          // the spilling keeper's team — no activeTeam/attackingTeam reassignment here.
          return {
            ok: true,
            state: {
              ...state,
              pieces: piecesWithGKPos,
              phase: 'LOOSE_BALL',
              ball: {
                position: gkEffectivePos,
                carrierId: null,
                lastTouchedBy: { pieceId: gk.id, teamId: gk.teamId },
              },
              lastDiceRoll: shotDiceRoll,
              lastActionType: 'DEFLECTION',
              lastShotPath: null, // clear path — ball is loose
              snapshotGkPenalty: null,
              eventLog: [...state.eventLog, shotAttempt],
            },
          };
        }
      }

      // Exhaustive guard — TypeScript should narrow this to never; belt-and-suspenders
      return { ok: false, reason: 'WRONG_PHASE' };
    }

    // -------------------------------------------------------------------------
    // HEADER: reads per-team selected contestants from state.headerContestants (D-17)
    // Each contestant rolls their own die; team winner = highest (die + heading).
    // Intra-team tie: pick randomly. Cross-team tie: LOOSE_BALL.
    // GK aerial challenge deferred to 8.3 (D-22); attacker wins → PASS phase.
    // dice[] layout: [atk_0, atk_1, ..., def_0, def_1, ...]
    // -------------------------------------------------------------------------
    case 'HEADER': {
      const defenderTeam = state.attackingTeam === 'home' ? 'away' : 'home';

      const attackerContestantIds: string[] =
        state.attackingTeam === 'home'
          ? (state.headerContestants?.home ?? [])
          : (state.headerContestants?.away ?? []);
      const defenderContestantIds: string[] =
        defenderTeam === 'home'
          ? (state.headerContestants?.home ?? [])
          : (state.headerContestants?.away ?? []);

      const headerCleared = {
        headerContestants: null,
        headerConfirmed: null,
        headerTargetHex: null,
        headerAccuracyRollPending: null, // RULE-01 (Phase 11): clear on all HEADER terminal transitions
        headerDuelWinner: null, // RULE-02 (Phase 11): clear on all HEADER terminal transitions
      };

      // Build per-contestant results: each rolls their die from the pre-generated dice array.
      // dice[0..attackerCount-1] = attacker dice; dice[attackerCount..] = defender dice.
      type CR = { piece: (typeof state.pieces)[number]; die: number; raw: number };

      const buildResults = (ids: string[], offset: number): CR[] =>
        ids
          .map((id, i) => {
            const piece = state.pieces.find((p) => p.id === id);
            if (!piece) return null;
            const die = dice[offset + i] ?? 3;
            return { piece, die, raw: computeCombinedScore(piece.aerialAbility, die, []) };
          })
          .filter((r): r is CR => r !== null);

      // Pick team winner: highest combined score; deterministic tiebreak using injected die (D-21).
      // tieBreakerDie: a pre-generated die value passed by the handler for determinism (ARCH-01).
      // Index into tied[] by (tieBreakerDie - 1) % tied.length — pure, no Math.random.
      const pickWinner = (results: CR[], tieBreakerDie: number): CR | undefined => {
        if (results.length === 0) return undefined;
        const max = Math.max(...results.map((r) => r.raw));
        const tied = results.filter((r) => r.raw === max);
        return tied[(tieBreakerDie - 1) % tied.length];
      };

      const atkCount = attackerContestantIds.length;
      const attackerResults = buildResults(attackerContestantIds, 0);
      const defenderResults = buildResults(defenderContestantIds, atkCount);

      // D-21: tie-break dice follow all contestant dice in the ...dice spread.
      // atkTieDie is used when multiple attackers tie; defTieDie when multiple defenders tie.
      const atkTieDie = dice[atkCount + defenderContestantIds.length] ?? 1;
      const defTieDie = dice[atkCount + defenderContestantIds.length + 1] ?? 1;

      const attackerWinner = pickWinner(attackerResults, atkTieDie);
      const defenderWinner = pickWinner(defenderResults, defTieDie);

      // If attacker declined, fall back to ball carrier (they hold possession uncontested)
      const attackerFallback = state.pieces.find((p) => p.id === state.ball.carrierId);
      const attackerPiece =
        attackerWinner?.piece ?? (atkCount === 0 ? attackerFallback : undefined);
      const defenderPiece = defenderWinner?.piece;

      const fallbackRolls = [dice[0] ?? 3, dice[1] ?? 3];
      const allRolls = [...attackerResults, ...defenderResults].map((r) => r.die);
      const duelRolls = allRolls.length > 0 ? allRolls : fallbackRolls;

      // (c) Neither team selected → LOOSE_BALL from ball.position (D-19)
      if (atkCount === 0 && defenderContestantIds.length === 0) {
        return {
          ok: true,
          state: {
            ...state,
            phase: 'LOOSE_BALL',
            // Neither team contested the header — nobody touched the ball; carry forward.
            ball: {
              position: state.ball.position,
              carrierId: null,
              lastTouchedBy: state.ball.lastTouchedBy,
            },
            lastDiceRoll: { rolls: fallbackRolls, context: 'HEADING_DUEL' },
            lastActionType: 'HEADER',
            ...headerCleared,
          },
        };
      }

      // (b-def) Defender selected, attacker declined → defender wins uncontested
      if (atkCount === 0 && defenderPiece !== undefined) {
        return {
          ok: true,
          state: {
            ...state,
            phase: 'PASS',
            attackingTeam: defenderTeam,
            activeTeam: defenderTeam,
            ball: {
              position: defenderPiece.position,
              carrierId: defenderPiece.id,
              lastTouchedBy: { pieceId: defenderPiece.id, teamId: defenderPiece.teamId },
            },
            lastDiceRoll: { rolls: duelRolls, context: 'HEADING_DUEL' },
            lastActionType: 'HEADER',
            contestedPieceIds: defenderContestantIds,
            stealAttemptedByIds: [], // D-02: reset at every 'PASS' transition
            tackleAttemptedByIds: [], // D-02
            eventLog: [
              ...state.eventLog,
              {
                type: 'HEADER' as const,
                attackerId: null,
                defenderId: defenderPiece.id,
                result: 'DEFENDER_WIN' as const,
                attackerDie: null,
                attackerAerialAbility: null,
                attackerCombined: null,
                defenderDie: null,
                defenderAerialAbility: null,
                defenderCombined: null,
                timestamp: Date.now(),
              },
            ],
            ...headerCleared,
          },
        };
      }

      // (b) Attacker selected, defender declined → attacker wins uncontested (HEAD-02, no dice roll)
      if (defenderContestantIds.length === 0 || defenderPiece === undefined) {
        const winnerId = attackerPiece?.id ?? '';
        const winnerPiece = attackerPiece;
        const tgtHexB = state.headerTargetHex ?? null;
        const goalQB = state.attackingTeam === 'home' ? 36 : 0;
        const isGoalLineTargetB =
          tgtHexB !== null && tgtHexB.q === goalQB && tgtHexB.r >= 10 && tgtHexB.r <= 16;

        const headerEventB = {
          type: 'HEADER' as const,
          attackerId: winnerId,
          defenderId: null,
          result: 'ATTACKER_WIN' as const,
          attackerDie: null,
          attackerAerialAbility: null,
          attackerCombined: null,
          defenderDie: null,
          defenderAerialAbility: null,
          defenderCombined: null,
          timestamp: Date.now(),
        };

        if (isGoalLineTargetB) {
          const defendingTeamForGkB: 'home' | 'away' =
            state.attackingTeam === 'home' ? 'away' : 'home';
          const gkB = state.pieces.find((p) => p.teamId === defendingTeamForGkB && p.role === 'GK');
          const winnerPos = winnerPiece?.position ?? state.ball.position;
          const headerShotPathB = hexLine(winnerPos, tgtHexB);
          return {
            ok: true,
            state: {
              ...state,
              phase: 'GK_DIVE',
              lastActionType: 'SHOT',
              ball: {
                position: winnerPos,
                carrierId: winnerId,
                lastTouchedBy: winnerPiece
                  ? { pieceId: winnerPiece.id, teamId: winnerPiece.teamId }
                  : state.ball.lastTouchedBy,
              },
              shotTargetHex: tgtHexB,
              gkDivePosition: gkB?.position ?? state.ball.position,
              lastShotPath: headerShotPathB,
              contestedPieceIds: attackerContestantIds,
              lastDiceRoll: { rolls: duelRolls, context: 'HEADING_DUEL' },
              eventLog: [...state.eventLog, headerEventB],
              ...headerCleared,
              headerTargetHex: null,
            },
          };
        }

        const ballPositionB = tgtHexB ?? winnerPiece?.position ?? state.ball.position;
        return {
          ok: true,
          state: {
            ...state,
            phase: 'PASS',
            ball: {
              position: ballPositionB,
              carrierId: winnerId,
              lastTouchedBy: winnerPiece
                ? { pieceId: winnerPiece.id, teamId: winnerPiece.teamId }
                : state.ball.lastTouchedBy,
            },
            lastDiceRoll: { rolls: duelRolls, context: 'HEADING_DUEL' },
            lastActionType: 'HEADER',
            contestedPieceIds: attackerContestantIds,
            stealAttemptedByIds: [], // D-02: reset at every 'PASS' transition
            tackleAttemptedByIds: [], // D-02
            eventLog: [...state.eventLog, headerEventB],
            ...headerCleared,
            headerTargetHex: null,
          },
        };
      }

      // (a) Both selected — contested duel between each team's winner (D-17)
      if (!attackerPiece) return { ok: false, reason: 'WRONG_PHASE' };

      // Apply HEAD-01 distance penalty to the attacker winner
      const headResult = validateHeading(state, attackerPiece, state.ball.position, {
        previousActionWasHeadedPass: false,
        otherChallengerIds: [defenderPiece.id],
      });
      const penaltyMod = headResult.ok && headResult.contested ? headResult.penaltyModifier : 0;

      const attackerDie = attackerWinner!.die;
      const defenderDie = defenderWinner!.die;
      const attackerScore = computeCombinedScore(attackerPiece.aerialAbility, attackerDie, [
        penaltyMod,
      ]);
      const defenderScore = computeCombinedScore(defenderPiece.aerialAbility, defenderDie, []);

      const contestedIds = [...attackerContestantIds, ...defenderContestantIds];

      if (attackerScore > defenderScore) {
        // HEAD-03 (D-11/D-12): check if the header target is a goal-line hex for the attacker.
        // Goal-line: q=36 for home attack / q=0 for away attack, r∈[10..16] (A1 assumption).
        // If so → route to GK_DIVE (no outfield deflection — D-13 applies).
        // If not → headed pass to the target hex (if set) or attacker's position (fallback).
        const tgtHex = state.headerTargetHex ?? null;
        const goalQ = state.attackingTeam === 'home' ? 36 : 0;
        const isGoalLineTarget =
          tgtHex !== null && tgtHex.q === goalQ && tgtHex.r >= 10 && tgtHex.r <= 16;

        const headerEventEntry = {
          type: 'HEADER' as const,
          attackerId: attackerPiece.id,
          defenderId: defenderPiece.id,
          result: 'ATTACKER_WIN' as const,
          attackerDie,
          attackerAerialAbility: attackerPiece.aerialAbility,
          attackerCombined: attackerScore,
          defenderDie,
          defenderAerialAbility: defenderPiece.aerialAbility,
          defenderCombined: defenderScore,
          timestamp: Date.now(),
        };

        if (isGoalLineTarget) {
          // HEAD-03: goal-line header → GK_DIVE (same as declared shot flow).
          // D-13: no outfield path-deflection — only GK contests.
          const defendingTeamForGk: 'home' | 'away' =
            state.attackingTeam === 'home' ? 'away' : 'home';
          const gk = state.pieces.find((p) => p.teamId === defendingTeamForGk && p.role === 'GK');
          const headerShotPath = hexLine(attackerPiece.position, tgtHex);
          return {
            ok: true,
            state: {
              ...state,
              phase: 'GK_DIVE',
              lastActionType: 'SHOT',
              ball: {
                position: attackerPiece.position,
                carrierId: attackerPiece.id,
                lastTouchedBy: { pieceId: attackerPiece.id, teamId: attackerPiece.teamId },
              },
              shotTargetHex: tgtHex,
              gkDivePosition: gk?.position ?? state.ball.position,
              lastShotPath: headerShotPath,
              contestedPieceIds: contestedIds,
              lastDiceRoll: { rolls: duelRolls, context: 'HEADING_DUEL' },
              eventLog: [...state.eventLog, headerEventEntry],
              ...headerCleared,
              headerTargetHex: null,
            },
          };
        }

        // Not goal-line (or no target set): headed pass.
        // Ball goes to headerTargetHex if set; otherwise to attacker's position.
        // Quick-task 260621-b8f finding #2 (defense-in-depth mirror): this legacy contested-win
        // PASS branch is only reachable via direct applyRoll unit tests in the current handler
        // wiring (the live GAME_ROLL handler guards against re-firing the duel once
        // headerDuelWinner is set by GAME_HEADER_CONTESTANT), but mirror the HEADED_PASS append
        // here too for engine-level consistency in case this path is exercised directly.
        const ballPosition = tgtHex ?? attackerPiece.position;
        const headedPassEventLegacy: ActionEvent = {
          type: 'HEADED_PASS',
          passerId: attackerPiece.id,
          from: attackerPiece.position,
          to: ballPosition,
          ballAfter: { position: ballPosition, carrierId: attackerPiece.id },
          timestamp: Date.now(),
        };
        return {
          ok: true,
          state: {
            ...state,
            phase: 'PASS',
            ball: {
              position: ballPosition,
              carrierId: attackerPiece.id,
              lastTouchedBy: { pieceId: attackerPiece.id, teamId: attackerPiece.teamId },
            },
            lastDiceRoll: { rolls: duelRolls, context: 'HEADING_DUEL' },
            lastActionType: 'HEADER',
            contestedPieceIds: contestedIds,
            stealAttemptedByIds: [], // D-02: reset at every 'PASS' transition
            tackleAttemptedByIds: [], // D-02
            eventLog: [...state.eventLog, headerEventEntry, headedPassEventLegacy],
            ...headerCleared,
            headerTargetHex: null,
          },
        };
      } else if (attackerScore === defenderScore) {
        return {
          ok: true,
          state: {
            ...state,
            phase: 'LOOSE_BALL',
            // Header tie: attacking-team contestant is the last toucher (attackerPiece is defined here).
            ball: {
              position: state.ball.position,
              carrierId: null,
              lastTouchedBy: { pieceId: attackerPiece.id, teamId: attackerPiece.teamId },
            },
            lastDiceRoll: { rolls: duelRolls, context: 'HEADING_DUEL' },
            lastActionType: 'DEFLECTION', // D-23 (WR-03): HEADER tie → LOOSE_BALL = DEFLECTION
            contestedPieceIds: contestedIds,
            eventLog: [
              ...state.eventLog,
              {
                type: 'HEADER' as const,
                attackerId: attackerPiece.id,
                defenderId: defenderPiece.id,
                result: 'TIE' as const,
                attackerDie,
                attackerAerialAbility: attackerPiece.aerialAbility,
                attackerCombined: attackerScore,
                defenderDie,
                defenderAerialAbility: defenderPiece.aerialAbility,
                defenderCombined: defenderScore,
                timestamp: Date.now(),
              },
            ],
            ...headerCleared,
          },
        };
      } else {
        return {
          ok: true,
          state: {
            ...state,
            phase: 'PASS',
            attackingTeam: defenderTeam,
            activeTeam: defenderTeam,
            ball: {
              position: defenderPiece.position,
              carrierId: defenderPiece.id,
              lastTouchedBy: { pieceId: defenderPiece.id, teamId: defenderPiece.teamId },
            },
            lastDiceRoll: { rolls: duelRolls, context: 'HEADING_DUEL' },
            lastActionType: 'HEADER',
            contestedPieceIds: contestedIds,
            stealAttemptedByIds: [], // D-02: reset at every 'PASS' transition
            tackleAttemptedByIds: [], // D-02
            eventLog: [
              ...state.eventLog,
              {
                type: 'HEADER' as const,
                attackerId: attackerPiece.id,
                defenderId: defenderPiece.id,
                result: 'DEFENDER_WIN' as const,
                attackerDie,
                attackerAerialAbility: attackerPiece.aerialAbility,
                attackerCombined: attackerScore,
                defenderDie,
                defenderAerialAbility: defenderPiece.aerialAbility,
                defenderCombined: defenderScore,
                timestamp: Date.now(),
              },
            ],
            ...headerCleared,
          },
        };
      }
    }

    // -------------------------------------------------------------------------
    // LOOSE_BALL: direction + distance dice → trajectory walk → first occupied hex (D-19/D-20/D-21)
    //
    // D-23: if a piece occupies an intermediate trajectory hex, ball stops there.
    //        phase → 'PASS', lastActionType → 'DEFLECTION', attackingTeam unchanged.
    // D-24: if no piece on trajectory, ball lands at the computed landing hex with carrierId null.
    //        phase → 'PASS', lastActionType → 'DEFLECTION'.
    //
    // Note: ELIGIBLE_NEXT_ACTIONS['DEFLECTION'] enforces the movement restriction for the D-24
    // empty-landing case; we do NOT force phase='MOVE' here (locked decision D-23/D-24).
    // -------------------------------------------------------------------------
    case 'LOOSE_BALL': {
      const direction = d1 as 1 | 2 | 3 | 4 | 5 | 6;
      const distance = d2 as 1 | 2 | 3 | 4 | 5 | 6;

      // D-08: clamp scatter to last valid pitch hex using the corrected parity-aware
      // trajectory walk (computeLooseBall is the single source of truth for the
      // scatter path — no duplicated fixed-delta math here, see scoreUtils.ts).
      const from = state.ball.position;
      let clampedPos = from; // fallback: ball stays at current position if first step is off-pitch
      // OOB-05: exitInfo stays null unless outOfBoundsEnabled is exactly `true` — when the
      // toggle is off/absent, this loop's statement sequence is byte-for-byte identical to
      // the pre-Phase-37 clamp behaviour (the `break` still fires, nothing else changes).
      let exitInfo: { exitHex: HexCoord; lastInBoundsHex: HexCoord } | null = null;
      for (let step = 1; step <= distance; step++) {
        const next: HexCoord = computeLooseBall(from, direction, step as 1 | 2 | 3 | 4 | 5 | 6);
        if (isPitchHex(next)) {
          clampedPos = next;
        } else {
          if (state.outOfBoundsEnabled === true) {
            exitInfo = { exitHex: next, lastInBoundsHex: clampedPos };
          }
          break;
        }
      }

      // OOB-02/04/05: classify the exit and route to a restart when the toggle is on. A
      // `null` result (corner-kick, or a missing GK — see triggerOutOfBoundsRestart) falls
      // through to the untouched clamp/trajectory/landing code below, which is exactly
      // today's behaviour.
      if (exitInfo !== null) {
        const restartState = triggerOutOfBoundsRestart(
          { ...state, lastDiceRoll: { rolls: [d1, d2], context: 'LOOSE_BALL' } },
          exitInfo.exitHex,
          exitInfo.lastInBoundsHex,
        );
        if (restartState !== null) return { ok: true, state: restartState };
      }

      // OOB-05 preserved path: everything from here to the end of this case is the
      // pre-Phase-37 clamp/trajectory/landing logic, byte-for-byte unchanged. Do not edit
      // this block in a later plan — it is the OOB-05 "disabled path stays identical"
      // guarantee.
      // D-23/D-24: walk from ball position toward clamped landing, stopping at first occupied hex.
      // hexLine returns [start, ..., end]; slice(1) drops the start (ball is there, no carrier).
      const trajectory = hexLine(state.ball.position, clampedPos).slice(1);

      let finalPosition = clampedPos;
      let finalCarrierId: string | null = null;

      for (const hex of trajectory) {
        finalPosition = hex;
        const occupant = state.pieces.find((p) => p.position.q === hex.q && p.position.r === hex.r);
        if (occupant) {
          finalCarrierId = occupant.id;
          break;
        }
      }

      const looseBallLandEvent: ActionEvent = {
        type: 'LOOSE_BALL_LAND',
        from: state.ball.position,
        to: finalPosition,
        timestamp: Date.now(),
        ballAfter: { position: finalPosition, carrierId: finalCarrierId },
      };

      // If ball lands on a piece, that piece's team becomes the attacking team
      const looseBallCarrier = finalCarrierId
        ? state.pieces.find((p) => p.id === finalCarrierId)
        : null;
      const newAttackingTeam = looseBallCarrier ? looseBallCarrier.teamId : state.attackingTeam;

      return {
        ok: true,
        state: {
          ...state,
          phase: 'PASS', // D-23/D-24: LOOSE_BALL resolves to CHOOSE_ACTION (not MOVE)
          // Scatter landed on an occupant → that piece is the last toucher; otherwise carry forward.
          ball: {
            position: finalPosition,
            carrierId: finalCarrierId,
            lastTouchedBy: looseBallCarrier
              ? { pieceId: looseBallCarrier.id, teamId: looseBallCarrier.teamId }
              : state.ball.lastTouchedBy,
          },
          attackingTeam: newAttackingTeam,
          activeTeam: newAttackingTeam,
          lastDiceRoll: { rolls: [d1, d2], context: 'LOOSE_BALL' },
          lastActionType: 'DEFLECTION', // D-20/D-23/D-24: LOOSE_BALL resolves → DEFLECTION
          lastShotPath: null, // RULE-03: clear stale shot path — do not carry into CHOOSE_ACTION phase
          stealAttemptedByIds: [], // D-02: reset at every 'PASS' transition
          tackleAttemptedByIds: [], // D-02
          // actionCount unchanged (+0 for Deflection per D-03 table)
          eventLog: [...state.eventLog, looseBallLandEvent],
        },
      };
    }

    // -------------------------------------------------------------------------
    // Default: reject any other phase (Pitfall 8 — explicit, no silent no-op)
    // -------------------------------------------------------------------------
    default:
      return { ok: false, reason: 'WRONG_PHASE' };
  }
}

// ---------------------------------------------------------------------------
// triggerOutOfBoundsRestart
// ---------------------------------------------------------------------------

/**
 * OOB-02/OOB-03/OOB-04/THROWIN-01/THROWIN-05: classifies a ball exit (`exitHex`, the
 * first off-pitch hex on the scatter trajectory) and returns the fully-formed restart
 * state — `THROW_IN_SETUP` for a sideline exit, `GOAL_KICK_SETUP_GK` for a byline
 * exit after an attacking touch (or no touch at all), or `CORNER_KICK_GK_SETUP_ATTACKING`
 * for a byline exit after a defending touch (OOB-03, Phase 38).
 *
 * Returns `null` only on a defensive fallback (missing GK piece for a goal kick). The
 * caller must fall back to today's clamp-to-boundary behaviour on a `null` result —
 * this function never mutates or clamps anything itself.
 *
 * ARCH-01: pure and deterministic — never calls rollDice()/Math.random(). The
 * caller is solely responsible for gating this call behind
 * `state.outOfBoundsEnabled === true` (OOB-05); this function performs no toggle
 * check of its own.
 */
export function triggerOutOfBoundsRestart(
  state: GameState,
  exitHex: HexCoord,
  lastInBoundsHex: HexCoord,
): GameState | null {
  const exit = classifyExit(exitHex);
  if (exit === null) return null; // defensive: caller only invokes this on an off-pitch hex

  const owner = bylineOwner(exitHex);
  const restart = classifyOutOfBounds(exit, state.ball.lastTouchedBy?.teamId ?? null, owner);

  // Common reset block shared by every branch below — every restart is a fresh
  // phase boundary, so all Movement-sequence/dice/shot-path bookkeeping clears.
  const commonReset = {
    movementSlot: null,
    movedPieceIds: [],
    paceUsedByPieceId: {},
    stealAttemptedByIds: [],
    tackleAttemptedByIds: [],
    lastShotPath: null,
    lastActionType: null,
  } as const;

  if (restart === 'CORNER_KICK') {
    // OOB-03/CORNER-01 (Phase 38): `owner` is the BYLINE OWNER — the team whose
    // defender touched the ball last (that is exactly what routed classifyOutOfBounds
    // to 'CORNER_KICK'). A corner is awarded to the OPPOSITE team: team inversion is
    // load-bearing here and deliberately differs from the GOAL_KICK branch below,
    // where `owner` IS the awarded team. Do NOT copy that assignment for corners.
    if (owner === null) return null; // defensive: a BYLINE exit always has an owner
    const cornerKickTeam: 'home' | 'away' = owner === 'home' ? 'away' : 'home';

    // D-01/D-02: pick the nearer of the byline owner's two fixed corner hexes to the
    // ball's actual exit trajectory (lastInBoundsHex), tie-broken to 'top'. CORNER_KICK_HEX
    // is indexed by `owner` (the byline owner), never by `cornerKickTeam`.
    const cornerPair = CORNER_KICK_HEX[owner];
    const distTop = hexDistance(lastInBoundsHex, cornerPair.top);
    const distBottom = hexDistance(lastInBoundsHex, cornerPair.bottom);
    const preferredCornerHex = distBottom < distTop ? cornerPair.bottom : cornerPair.top;

    // No piece has been designated the corner-taker yet at trigger time, so the FULL
    // piece list (not GK-excluded, unlike the GOAL_KICK branch) is used for occupancy
    // resolution.
    const resolvedCornerHex = resolveThrowInHex(preferredCornerHex, state.pieces);

    const outOfBoundsEvent: ActionEvent = {
      type: 'OUT_OF_BOUNDS',
      exitHex,
      kind: exit,
      restart,
      awardedTo: cornerKickTeam,
      lastTouchedByPieceId: state.ball.lastTouchedBy?.pieceId ?? null,
      timestamp: Date.now(),
      ballAfter: { position: resolvedCornerHex, carrierId: null },
    };

    return {
      ...state,
      phase: 'CORNER_KICK_GK_SETUP_ATTACKING',
      cornerKickTeam,
      cornerKickHex: resolvedCornerHex,
      // Pitfall 3: explicitly null every cornerKick* field even though ...state spreads —
      // no stale value from a prior corner may survive into this one.
      cornerKickTakerId: null,
      cornerKickEligibleIds: null,
      cornerKickStageIndex: null,
      cornerKickStagePlacedIds: null,
      cornerKickUsedPace: null,
      cornerKickMoveSlot: null,
      cornerKickMovedPieceId: null,
      cornerKickPaceUsed: 0,
      attackingTeam: cornerKickTeam,
      activeTeam: cornerKickTeam,
      ball: {
        position: resolvedCornerHex,
        carrierId: null,
        lastTouchedBy: state.ball.lastTouchedBy,
      },
      eventLog: [...state.eventLog, outOfBoundsEvent],
      ...commonReset,
    };
  }

  if (restart === 'THROW_IN') {
    // OOB-02: awarded to the team that did NOT last touch the ball; an untouched
    // ball is awarded against the current attackingTeam.
    const throwInTeam: 'home' | 'away' =
      state.ball.lastTouchedBy !== null
        ? state.ball.lastTouchedBy.teamId === 'home'
          ? 'away'
          : 'home'
        : state.attackingTeam === 'home'
          ? 'away'
          : 'home';

    const throwInHex = resolveThrowInHex(lastInBoundsHex, state.pieces);

    const outOfBoundsEvent: ActionEvent = {
      type: 'OUT_OF_BOUNDS',
      exitHex,
      kind: exit,
      restart,
      awardedTo: throwInTeam,
      lastTouchedByPieceId: state.ball.lastTouchedBy?.pieceId ?? null,
      timestamp: Date.now(),
      ballAfter: { position: throwInHex, carrierId: null },
    };

    return {
      ...state,
      phase: 'THROW_IN_SETUP',
      throwInHex,
      throwInTeam,
      throwInPhasesTaken: 0,
      attackingTeam: throwInTeam,
      activeTeam: throwInTeam,
      ball: { position: throwInHex, carrierId: null, lastTouchedBy: state.ball.lastTouchedBy },
      eventLog: [...state.eventLog, outOfBoundsEvent],
      ...commonReset,
    };
  }

  // restart === 'GOAL_KICK' (OOB-04): owner is the team whose goal line was
  // crossed — that team IS the defending team at that byline, so it is also the
  // team awarded the goal kick.
  const goalKickTeam = owner;
  if (goalKickTeam === null) return null; // defensive: a BYLINE exit always has an owner
  const gk = state.pieces.find((p) => p.teamId === goalKickTeam && p.role === 'GK');
  if (!gk) return null; // defensive fallback to clamp — no GK piece found for that team

  // Plan 37-15 (closes 37-UAT.md Test 7 MAJOR): the restart is a fixed
  // byline-centre hex per team (GOAL_KICK_RESTART_HEX), NOT the goalkeeper's
  // live position. 37-04-PLAN.md:109 originally instructed `gk.position`,
  // but the keeper moves freely during GK_DIVING/GK_KICK_MOVE/reposition
  // windows, so that live position routinely drifted far from goal — the
  // kick was effectively taken from wherever the keeper last happened to
  // stand. resolveThrowInHex (D-15-03) resolves the preferred restart hex
  // against the piece list with the keeper EXCLUDED, so the keeper's own
  // current position can never block its own destination; an occupied
  // restart hex resolves to the nearest free on-pitch hex instead of
  // double-stacking two pieces on one coordinate. D-15-04: both the ball
  // AND the goalkeeper piece move, so ball.carrierId and the carrier's
  // position can never disagree.
  const preferredRestartHex = GOAL_KICK_RESTART_HEX[goalKickTeam];
  const otherPieces = state.pieces.filter((p) => p.id !== gk.id);
  const resolvedRestartHex = resolveThrowInHex(preferredRestartHex, otherPieces);

  const repositionedPieces = state.pieces.map((p) =>
    p.id === gk.id ? { ...p, position: resolvedRestartHex } : p,
  );

  const outOfBoundsEvent: ActionEvent = {
    type: 'OUT_OF_BOUNDS',
    exitHex,
    kind: exit,
    restart,
    awardedTo: goalKickTeam,
    lastTouchedByPieceId: state.ball.lastTouchedBy?.pieceId ?? null,
    timestamp: Date.now(),
    ballAfter: { position: resolvedRestartHex, carrierId: gk.id },
  };

  return {
    ...state,
    phase: 'GOAL_KICK_SETUP_GK',
    pieces: repositionedPieces,
    goalKickTeam,
    goalKickGkId: gk.id,
    // Plan 37-08: GOALKICK-02 eligible lists are precomputed once, here, at trigger
    // time — never recomputed mid-window (mirrors freeMoveEligibleIds' contract).
    // D-15-05: computed from the POST-placement piece list so the keeper's
    // repositioned hex — not its pre-move hex — decides eligibility from the
    // very first frame of the reposition window.
    goalKickEligibleIds: computeGoalKickEligibleIds(repositionedPieces, goalKickTeam),
    goalKickUsedPace: {},
    // Plan 37-08: no stale value from a prior goal kick may survive into this one.
    goalKickTargetHex: null,
    goalKickMoveSlot: null,
    goalKickMovedPieceId: null,
    goalKickPaceUsed: 0,
    attackingTeam: goalKickTeam,
    activeTeam: goalKickTeam,
    ball: {
      position: resolvedRestartHex,
      carrierId: gk.id,
      lastTouchedBy: { pieceId: gk.id, teamId: goalKickTeam },
    },
    eventLog: [...state.eventLog, outOfBoundsEvent],
    ...commonReset,
  };
}

// ---------------------------------------------------------------------------
// applyCornerKickGkPlace
// ---------------------------------------------------------------------------

/** Discriminated union result for applyCornerKickGkPlace. */
export type ApplyCornerKickGkPlaceResult =
  | {
      ok: false;
      reason:
        | 'WRONG_PHASE'
        | 'PIECE_NOT_FOUND'
        | 'NOT_GOALKEEPER'
        | 'WRONG_TEAM'
        | 'INVALID_TARGET';
    }
  | { ok: true; state: GameState };

/**
 * CORNER-01 (D-03/D-04): places a goalkeeper anywhere legal on-pitch during either
 * corner-kick GK reposition window. The ATTACKING (kicking) manager's goalkeeper
 * moves first (`CORNER_KICK_GK_SETUP_ATTACKING`), then the DEFENDING manager's
 * (`CORNER_KICK_GK_SETUP_DEFENDING`) — turn order derived from `phase`, never read
 * from `activeTeam` directly, so a stale `activeTeam` can never silently let the
 * wrong side move.
 *
 * Guard order mirrors applyThrowInPlace: phase guard first, then piece lookup,
 * then role check, then team ownership, then target legality — so the caller
 * always receives the most specific reason.
 *
 * Re-placing the same goalkeeper again within the same window is allowed and
 * overwrites its previous position (no lock/budget tracking for this action).
 */
export function applyCornerKickGkPlace(
  state: GameState,
  pieceId: string,
  to: HexCoord,
): ApplyCornerKickGkPlaceResult {
  if (
    state.phase !== 'CORNER_KICK_GK_SETUP_ATTACKING' &&
    state.phase !== 'CORNER_KICK_GK_SETUP_DEFENDING'
  ) {
    return { ok: false, reason: 'WRONG_PHASE' };
  }
  if (state.cornerKickTeam == null) {
    return { ok: false, reason: 'WRONG_PHASE' };
  }

  const piece = state.pieces.find((p) => p.id === pieceId);
  if (!piece) return { ok: false, reason: 'PIECE_NOT_FOUND' };

  if (piece.role !== 'GK') return { ok: false, reason: 'NOT_GOALKEEPER' };

  // D-03/D-04: acting team is derived from phase + the persistent cornerKickTeam —
  // never from activeTeam — so the attacking-then-defending turn order can never be
  // subverted by a stale/tampered activeTeam value.
  const actingTeam: 'home' | 'away' =
    state.phase === 'CORNER_KICK_GK_SETUP_ATTACKING'
      ? state.cornerKickTeam
      : state.cornerKickTeam === 'home'
        ? 'away'
        : 'home';
  if (piece.teamId !== actingTeam) return { ok: false, reason: 'WRONG_TEAM' };

  // Placement model (RESEARCH.md Assumption A1, uncapped): CORNER-01 states no hex
  // cap where CORNER-03/CORNER-06 both state one explicitly, so only on-pitch +
  // unoccupied is validated here — deliberately no hexDistance cap. If the rulebook
  // turns out to cap it, add `hexDistance(piece.position, to) > CAP` alongside the
  // isPitchHex check below.
  if (!isPitchHex(to)) return { ok: false, reason: 'INVALID_TARGET' };
  if (
    state.pieces.some((p) => p.id !== pieceId && p.position.q === to.q && p.position.r === to.r)
  ) {
    return { ok: false, reason: 'INVALID_TARGET' };
  }

  const side: 'ATTACKING' | 'DEFENDING' =
    state.phase === 'CORNER_KICK_GK_SETUP_ATTACKING' ? 'ATTACKING' : 'DEFENDING';

  const placeEvent: ActionEvent = {
    type: 'CORNER_KICK_GK_PLACE',
    pieceId,
    side,
    from: piece.position,
    to,
    timestamp: Date.now(),
  };

  return {
    ok: true,
    state: {
      ...state,
      pieces: state.pieces.map((p) => (p.id === pieceId ? { ...p, position: to } : p)),
      eventLog: [...state.eventLog, placeEvent],
    },
  };
}

// ---------------------------------------------------------------------------
// applyCornerKickGkWindowEnd
// ---------------------------------------------------------------------------

/** Discriminated union result for applyCornerKickGkWindowEnd. */
export type ApplyCornerKickGkWindowEndResult =
  | { ok: false; reason: 'WRONG_PHASE' }
  | { ok: true; state: GameState };

/**
 * CORNER-01 (D-03/D-04/D-06): ends the active GK-reposition window on the active
 * team's End Turn/Confirm.
 *
 * - From `CORNER_KICK_GK_SETUP_ATTACKING`: advances to
 *   `CORNER_KICK_GK_SETUP_DEFENDING`, flipping `activeTeam` to the defending team.
 * - From `CORNER_KICK_GK_SETUP_DEFENDING`: advances to `CORNER_KICK_TAKER_SELECT`,
 *   setting `activeTeam` back to `cornerKickTeam`.
 *
 * D-06: confirming with zero placements made in either window is explicitly legal —
 * this function performs no move validation of its own, it only advances the phase
 * and `activeTeam`. No event is appended: the individual `CORNER_KICK_GK_PLACE`
 * events already record every move, and there is no reversible-move boundary to
 * protect here (Undo does not reach these phases).
 */
export function applyCornerKickGkWindowEnd(state: GameState): ApplyCornerKickGkWindowEndResult {
  if (
    state.phase !== 'CORNER_KICK_GK_SETUP_ATTACKING' &&
    state.phase !== 'CORNER_KICK_GK_SETUP_DEFENDING'
  ) {
    return { ok: false, reason: 'WRONG_PHASE' };
  }
  if (state.cornerKickTeam == null) {
    return { ok: false, reason: 'WRONG_PHASE' };
  }
  const cornerKickTeam = state.cornerKickTeam;

  if (state.phase === 'CORNER_KICK_GK_SETUP_ATTACKING') {
    const defendingTeam: 'home' | 'away' = cornerKickTeam === 'home' ? 'away' : 'home';
    return {
      ok: true,
      state: {
        ...state,
        phase: 'CORNER_KICK_GK_SETUP_DEFENDING',
        activeTeam: defendingTeam,
      },
    };
  }

  // CORNER_KICK_GK_SETUP_DEFENDING -> CORNER_KICK_TAKER_SELECT (always).
  return {
    ok: true,
    state: {
      ...state,
      phase: 'CORNER_KICK_TAKER_SELECT',
      activeTeam: cornerKickTeam,
    },
  };
}

// ---------------------------------------------------------------------------
// applyCornerKickTakerSelect
// ---------------------------------------------------------------------------

/** Discriminated union result for applyCornerKickTakerSelect. */
export type ApplyCornerKickTakerSelectResult =
  | { ok: false; reason: 'WRONG_PHASE' | 'PIECE_NOT_FOUND' | 'WRONG_TEAM' }
  | { ok: true; state: GameState };

/**
 * CORNER-02 (D-01): the kicking manager designates any own on-pitch piece (including
 * the goalkeeper) as corner-taker. Copies `applyThrowInPlace`'s body shape: phase
 * guard, then piece lookup, then team ownership, then an unconditional teleport —
 * distance is irrelevant, this is a placement, not a move.
 *
 * Destination: `state.cornerKickHex` is re-resolved against the current piece list
 * EXCLUDING the taker itself (`resolveThrowInHex(state.cornerKickHex, state.pieces.filter(p
 * => p.id !== pieceId))`), so the taker's own current position can never block its own
 * destination — the same exclude-the-moving-piece reasoning the GOAL_KICK trigger branch
 * applies to the goalkeeper. This guards exactly the case where a goalkeeper was
 * repositioned onto the corner hex during CORNER-01. The re-resolved hex is written back
 * into `cornerKickHex` so downstream phases and the client read one consistent value.
 *
 * Ball and taker are set together in the same return literal so carrier position and
 * ball position can never diverge; `ball.lastTouchedBy` is set here too — load-bearing,
 * as it is the field a re-exit during this corner would classify against.
 *
 * Transitions to `CORNER_KICK_REPOSITION`, initializing the CORNER-03 window at stage 0
 * (attacking side moves first per `CORNER_KICK_STAGES`). `cornerKickEligibleIds` is left
 * `null` here — computed by 38-03's `computeCornerKickEligibleIds`, not this function.
 */
export function applyCornerKickTakerSelect(
  state: GameState,
  pieceId: string,
): ApplyCornerKickTakerSelectResult {
  if (state.phase !== 'CORNER_KICK_TAKER_SELECT') return { ok: false, reason: 'WRONG_PHASE' };
  if (state.cornerKickTeam == null || state.cornerKickHex == null) {
    return { ok: false, reason: 'WRONG_PHASE' };
  }

  const piece = state.pieces.find((p) => p.id === pieceId);
  if (!piece) return { ok: false, reason: 'PIECE_NOT_FOUND' };

  if (piece.teamId !== state.cornerKickTeam) return { ok: false, reason: 'WRONG_TEAM' };

  const cornerKickTeam = state.cornerKickTeam;
  const resolvedHex = resolveThrowInHex(
    state.cornerKickHex,
    state.pieces.filter((p) => p.id !== pieceId),
  );

  const takerPlacedEvent: ActionEvent = {
    type: 'CORNER_KICK_TAKER_PLACED',
    pieceId,
    from: piece.position,
    to: resolvedHex,
    timestamp: Date.now(),
    ballAfter: { position: resolvedHex, carrierId: pieceId },
  };

  const updatedPieces = state.pieces.map((p) =>
    p.id === pieceId ? { ...p, position: resolvedHex } : p,
  );

  return {
    ok: true,
    state: {
      ...state,
      phase: 'CORNER_KICK_REPOSITION',
      pieces: updatedPieces,
      cornerKickHex: resolvedHex,
      cornerKickTakerId: pieceId,
      // 38-03: computed once, at window entry, from the POST-placement piece list —
      // never recomputed mid-window (mirrors goalKickEligibleIds'/freeMoveEligibleIds'
      // contract).
      cornerKickEligibleIds: computeCornerKickEligibleIds(updatedPieces, cornerKickTeam, pieceId),
      cornerKickStageIndex: 0,
      cornerKickStagePlacedIds: [],
      cornerKickUsedPace: {},
      activeTeam: cornerKickTeam,
      ball: {
        position: resolvedHex,
        carrierId: pieceId,
        lastTouchedBy: { pieceId, teamId: cornerKickTeam },
      },
      eventLog: [...state.eventLog, takerPlacedEvent],
    },
  };
}

// ---------------------------------------------------------------------------
// computeCornerKickEligibleIds
// ---------------------------------------------------------------------------

/**
 * CORNER-03/CORNER-06 (Assumption A4, RESEARCH.md §5): computes both reposition-window
 * eligible id lists exactly once, at corner-taker-select time (wired into
 * `applyCornerKickTakerSelect`'s return, above), mirroring `computeGoalKickEligibleIds`'
 * precompute-once contract.
 *
 * Assumption A4: excludes every piece with `role === 'GK'` (both goalkeepers were already
 * positioned during CORNER-01) and excludes `cornerKickTakerId` (the taker is standing on
 * the ball). Every other on-pitch piece from both teams is eligible for CORNER-03's
 * alternating 6-hex window AND CORNER-06's pre-kick 3-hex window — the two windows reuse
 * the same eligible pools.
 */
export function computeCornerKickEligibleIds(
  pieces: readonly PlayerPiece[],
  cornerKickTeam: 'home' | 'away',
  cornerKickTakerId: string | null,
): { attacking: readonly string[]; defending: readonly string[] } {
  const eligible = pieces.filter((p) => p.role !== 'GK' && p.id !== cornerKickTakerId);
  return {
    attacking: eligible.filter((p) => p.teamId === cornerKickTeam).map((p) => p.id),
    defending: eligible.filter((p) => p.teamId !== cornerKickTeam).map((p) => p.id),
  };
}

// ---------------------------------------------------------------------------
// applyCornerKickReposition
// ---------------------------------------------------------------------------

/** CORNER-03 (D-05): per-piece cumulative hex budget across the entire reposition window. */
const CORNER_KICK_REPOSITION_PACE_CAP = 6;

/** Discriminated union result for applyCornerKickReposition. */
export type ApplyCornerKickRepositionResult =
  | {
      ok: false;
      reason:
        | 'WRONG_PHASE'
        | 'PIECE_NOT_FOUND'
        | 'WRONG_TEAM'
        | 'NOT_ELIGIBLE'
        | 'NOT_ADJACENT'
        | 'INVALID_TARGET'
        | 'PACE_EXHAUSTED'
        | 'STAGE_LIMIT_REACHED';
    }
  | { ok: true; state: GameState };

/**
 * CORNER-03 (D-05): single-hex-per-click repositioning during the CORNER_KICK_REPOSITION
 * window's 6 alternating stages (see `CORNER_KICK_STAGES`/`cornerKickStageTeam`,
 * `offside.ts`).
 *
 * D-05: this function structurally COPIES `applyGoalKickReposition`'s body (adjacency via
 * `hexDistance === 1`, `isPitchHex` guard, occupancy scan excluding the moving piece, and
 * cumulative-pace accumulation) — it does NOT call `applyGoalKickReposition`,
 * `applyFreeMove`, or `applyMove`, for the same reasoning `applyGoalKickReposition`'s own
 * doc comment gives for not calling `applyFreeMove`.
 *
 * Adds the one guard `applyGoalKickReposition` lacks, modelled on `applyFreeKickMove`'s
 * `PLACEMENT_LIMIT_REACHED`: at most 2 DISTINCT pieces may be touched per stage
 * (`cornerKickStagePlacedIds`) — re-touching an already-counted piece is always free of
 * the stage cap. This is tracked entirely separately from the per-piece 6-hex pace budget
 * (`cornerKickUsedPace`), which is a running total across ALL 6 stages, never reset
 * per-stage (Pitfall 4 — see `applyCornerKickStageEnd` below, which is where this
 * divergence actually matters).
 *
 * Acting team is derived from `cornerKickStageTeam(state.cornerKickStageIndex,
 * state.cornerKickTeam)` — never from `activeTeam` (T-38-10).
 */
export function applyCornerKickReposition(
  state: GameState,
  pieceId: string,
  to: HexCoord,
): ApplyCornerKickRepositionResult {
  if (state.phase !== 'CORNER_KICK_REPOSITION') return { ok: false, reason: 'WRONG_PHASE' };
  if (state.cornerKickStageIndex == null || state.cornerKickTeam == null) {
    return { ok: false, reason: 'WRONG_PHASE' };
  }

  const piece = state.pieces.find((p) => p.id === pieceId);
  if (!piece) return { ok: false, reason: 'PIECE_NOT_FOUND' };

  const cornerKickTeam = state.cornerKickTeam;
  const actingTeam = cornerKickStageTeam(state.cornerKickStageIndex, cornerKickTeam);
  if (piece.teamId !== actingTeam) {
    return { ok: false, reason: 'WRONG_TEAM' };
  }

  const eligibleIds =
    actingTeam === cornerKickTeam
      ? (state.cornerKickEligibleIds?.attacking ?? [])
      : (state.cornerKickEligibleIds?.defending ?? []);
  if (!eligibleIds.includes(pieceId)) {
    return { ok: false, reason: 'NOT_ELIGIBLE' };
  }

  if (hexDistance(piece.position, to) !== 1) {
    return { ok: false, reason: 'NOT_ADJACENT' };
  }
  if (!isPitchHex(to)) {
    return { ok: false, reason: 'INVALID_TARGET' };
  }
  if (state.pieces.some((p) => p.position.q === to.q && p.position.r === to.r)) {
    return { ok: false, reason: 'INVALID_TARGET' };
  }

  const usedSoFar = (state.cornerKickUsedPace ?? {})[pieceId] ?? 0;
  if (usedSoFar >= CORNER_KICK_REPOSITION_PACE_CAP) {
    return { ok: false, reason: 'PACE_EXHAUSTED' };
  }

  // WR-02 (38-12, gap closure): CORNER_KICK_STAGES is the single source of truth for each
  // stage's distinct-piece cap — CornerKickSetupPanel.tsx and useGameStore.ts both already
  // read stage.max from this table; the engine's own enforcement path must agree, or a future
  // edit to CORNER_KICK_STAGES could silently desync the server-enforced cap from what the
  // client displays (T-38-40).
  const stageMax = CORNER_KICK_STAGES[state.cornerKickStageIndex].max;
  const stagePlacedIds = state.cornerKickStagePlacedIds ?? [];
  const alreadyCountedThisStage = stagePlacedIds.includes(pieceId);
  if (!alreadyCountedThisStage && stagePlacedIds.length >= stageMax) {
    return { ok: false, reason: 'STAGE_LIMIT_REACHED' };
  }

  const newPieces = state.pieces.map((p) => (p.id === pieceId ? { ...p, position: to } : p));
  const newStagePlacedIds = alreadyCountedThisStage ? stagePlacedIds : [...stagePlacedIds, pieceId];

  // No per-move event appended here — the reposition windows reuse the existing GAME_MOVE
  // handler, which emits its own event (38-05 wires that); adding one here would double-log.
  return {
    ok: true,
    state: {
      ...state,
      pieces: newPieces,
      cornerKickUsedPace: {
        ...(state.cornerKickUsedPace ?? {}),
        [pieceId]: usedSoFar + 1,
      },
      cornerKickStagePlacedIds: newStagePlacedIds,
    },
  };
}

// ---------------------------------------------------------------------------
// applyCornerKickStageEnd
// ---------------------------------------------------------------------------

/** Discriminated union result for applyCornerKickStageEnd. */
export type ApplyCornerKickStageEndResult =
  | { ok: false; reason: 'WRONG_PHASE' | 'WRONG_TEAM' }
  | { ok: true; state: GameState };

/**
 * CORNER-03 (D-06): ends the CURRENTLY-active stage of the CORNER_KICK_REPOSITION window
 * for `team`. Takes the confirming team as an explicit parameter exactly as
 * `applyFreeKickReady` does, so the handler passes `socketTeam(socket)` and the engine —
 * not the handler — owns the stage-team comparison.
 *
 * Guards: phase must be `CORNER_KICK_REPOSITION`; `team` must equal
 * `cornerKickStageTeam(state.cornerKickStageIndex, state.cornerKickTeam)`.
 *
 * PITFALL 4 — the single most important line in this function: `cornerKickUsedPace` is
 * spread forward UNCHANGED on EVERY advance. It is never reset, never cleared per stage,
 * and this function deliberately does NOT port `applyFreeKickReady`'s behaviour of folding
 * the stage's touched pieces into a permanent `movedPieceIds` lock — Corner's 6-hex budget
 * is a per-piece TOTAL across the whole window, not a per-round allowance, so a
 * permanently-locked piece here would be a rules violation. Do not "fix" this to match
 * `applyFreeKickReady`.
 *
 * Confirming with zero pieces moved this stage is legal (D-06) — there is no minimum-move
 * guard.
 */
export function applyCornerKickStageEnd(
  state: GameState,
  team: 'home' | 'away',
): ApplyCornerKickStageEndResult {
  if (state.phase !== 'CORNER_KICK_REPOSITION') return { ok: false, reason: 'WRONG_PHASE' };
  if (state.cornerKickStageIndex == null || state.cornerKickTeam == null) {
    return { ok: false, reason: 'WRONG_PHASE' };
  }

  const stageIndex = state.cornerKickStageIndex;
  const cornerKickTeam = state.cornerKickTeam;
  const activeTeamForStage = cornerKickStageTeam(stageIndex, cornerKickTeam);
  if (team !== activeTeamForStage) {
    return { ok: false, reason: 'WRONG_TEAM' };
  }

  const stageAdvanceEvent: ActionEvent = {
    type: 'CORNER_KICK_STAGE_ADVANCE',
    fromStageIndex: stageIndex,
    timestamp: Date.now(),
  };

  if (stageIndex < 5) {
    const nextIndex = (stageIndex + 1) as 0 | 1 | 2 | 3 | 4 | 5;
    return {
      ok: true,
      state: {
        ...state,
        cornerKickStageIndex: nextIndex,
        cornerKickStagePlacedIds: [],
        activeTeam: cornerKickStageTeam(nextIndex, cornerKickTeam),
        // Pitfall 4: cornerKickUsedPace is intentionally NOT touched here — see doc
        // comment above.
        eventLog: [...state.eventLog, stageAdvanceEvent],
      },
    };
  }

  // stageIndex === 5 (terminal): transition into CORNER-06's pre-kick window.
  return {
    ok: true,
    state: {
      ...state,
      phase: 'CORNER_KICK_FINAL_SETUP',
      cornerKickStageIndex: null,
      cornerKickStagePlacedIds: null,
      cornerKickMoveSlot: 'ATTACKER',
      cornerKickMovedPieceId: null,
      cornerKickPaceUsed: 0,
      activeTeam: cornerKickTeam,
      // cornerKickUsedPace is left set (no longer read past this point, but nulling it
      // here would make an Undo across the boundary lossy). cornerKickEligibleIds is left
      // in place — CORNER-06 reuses the same eligible pools (Assumption A4).
      eventLog: [...state.eventLog, stageAdvanceEvent],
    },
  };
}

// ---------------------------------------------------------------------------
// applyCornerKickFinalMove
// ---------------------------------------------------------------------------

/** CORNER-06 (D-05-analog): per-slot cumulative hex budget in CORNER_KICK_FINAL_SETUP. */
const CORNER_KICK_FINAL_PACE_CAP = 3;

/** Discriminated union result for applyCornerKickFinalMove. */
export type ApplyCornerKickFinalMoveResult =
  | {
      ok: false;
      reason:
        | 'WRONG_PHASE'
        | 'PIECE_NOT_FOUND'
        | 'WRONG_TEAM'
        | 'NOT_ELIGIBLE'
        | 'PIECE_LOCKED'
        | 'NOT_ADJACENT'
        | 'INVALID_TARGET'
        | 'PACE_EXHAUSTED';
    }
  | { ok: true; state: GameState };

/**
 * CORNER-06: single-hex-per-click repositioning during the CORNER_KICK_FINAL_SETUP
 * pre-kick window's two slots (ATTACKER, then DEFENDER).
 *
 * `applyCornerKickReposition`'s body with three changes: (1) the pace cap is
 * `CORNER_KICK_FINAL_PACE_CAP`, read from the scalar `cornerKickPaceUsed` rather than the
 * per-piece `cornerKickUsedPace` record; (2) the stage-distinct-piece-count guard is
 * replaced by a single-piece lock (`cornerKickMovedPieceId !== null &&
 * cornerKickMovedPieceId !== pieceId` -> `PIECE_LOCKED`); (3) the acting team comes from
 * `cornerKickMoveSlot` (`'ATTACKER'` -> `state.cornerKickTeam`, `'DEFENDER'` -> its
 * opposite) rather than from `cornerKickStageTeam`. Eligibility still reads
 * `cornerKickEligibleIds` so goalkeepers and the corner-taker stay excluded (Assumption
 * A4). Does NOT call `applyCornerKickReposition`.
 */
export function applyCornerKickFinalMove(
  state: GameState,
  pieceId: string,
  to: HexCoord,
): ApplyCornerKickFinalMoveResult {
  if (state.phase !== 'CORNER_KICK_FINAL_SETUP') return { ok: false, reason: 'WRONG_PHASE' };
  if (state.cornerKickMoveSlot == null || state.cornerKickTeam == null) {
    return { ok: false, reason: 'WRONG_PHASE' };
  }

  const piece = state.pieces.find((p) => p.id === pieceId);
  if (!piece) return { ok: false, reason: 'PIECE_NOT_FOUND' };

  const cornerKickTeam = state.cornerKickTeam;
  const actingTeam: 'home' | 'away' =
    state.cornerKickMoveSlot === 'ATTACKER'
      ? cornerKickTeam
      : cornerKickTeam === 'home'
        ? 'away'
        : 'home';
  if (piece.teamId !== actingTeam) {
    return { ok: false, reason: 'WRONG_TEAM' };
  }

  const eligibleIds =
    actingTeam === cornerKickTeam
      ? (state.cornerKickEligibleIds?.attacking ?? [])
      : (state.cornerKickEligibleIds?.defending ?? []);
  if (!eligibleIds.includes(pieceId)) {
    return { ok: false, reason: 'NOT_ELIGIBLE' };
  }

  if (state.cornerKickMovedPieceId != null && state.cornerKickMovedPieceId !== pieceId) {
    return { ok: false, reason: 'PIECE_LOCKED' };
  }

  if (hexDistance(piece.position, to) !== 1) {
    return { ok: false, reason: 'NOT_ADJACENT' };
  }
  if (!isPitchHex(to)) {
    return { ok: false, reason: 'INVALID_TARGET' };
  }
  if (state.pieces.some((p) => p.position.q === to.q && p.position.r === to.r)) {
    return { ok: false, reason: 'INVALID_TARGET' };
  }

  const usedSoFar = state.cornerKickPaceUsed ?? 0;
  if (usedSoFar >= CORNER_KICK_FINAL_PACE_CAP) {
    return { ok: false, reason: 'PACE_EXHAUSTED' };
  }

  const newPieces = state.pieces.map((p) => (p.id === pieceId ? { ...p, position: to } : p));
  const moveEvent: ActionEvent = {
    type: 'CORNER_KICK_MOVE',
    slot: state.cornerKickMoveSlot,
    pieceId,
    from: piece.position,
    to,
    timestamp: Date.now(),
  };

  return {
    ok: true,
    state: {
      ...state,
      pieces: newPieces,
      cornerKickMovedPieceId: pieceId,
      cornerKickPaceUsed: usedSoFar + 1,
      eventLog: [...state.eventLog, moveEvent],
    },
  };
}

// ---------------------------------------------------------------------------
// applyCornerKickFinalSetupEnd
// ---------------------------------------------------------------------------

/** Discriminated union result for applyCornerKickFinalSetupEnd. */
export type ApplyCornerKickFinalSetupEndResult =
  | { ok: false; reason: 'WRONG_PHASE' }
  | { ok: true; state: GameState };

/**
 * CORNER-06: ends the active CORNER_KICK_FINAL_SETUP slot. Mirrors
 * `applyGoalKickMoveEnd`'s slot-flip-then-resolve shape, minus its accuracy roll — Corner's
 * kick has NOT been taken yet at this point (the High/Low choice comes next, in a later
 * plan), unlike Goal Kick where the ball is already travelling. Takes no die parameter and
 * performs no dice work at all.
 *
 * `ATTACKER` slot's end: flips `cornerKickMoveSlot` to `DEFENDER`, resets
 * `cornerKickMovedPieceId`/`cornerKickPaceUsed`, sets `activeTeam` to the defending team.
 *
 * `DEFENDER` slot's end: transitions to the generic `PASS` phase with
 * `lastActionType: 'CORNER_KICK_RESTART'` (its `ELIGIBLE_NEXT_ACTIONS` row restricts the
 * next action to `STANDARD_PASS`/`HIGH_PASS`), `attackingTeam`/`activeTeam` set to
 * `cornerKickTeam`, and all three `cornerKickMoveSlot`/`cornerKickMovedPieceId`/
 * `cornerKickPaceUsed` fields cleared.
 *
 * PITFALL 3 — `cornerKickTeam`, `cornerKickHex` and `cornerKickTakerId` are explicitly
 * carried into the terminal return, not merely assumed to survive the `...state` spread:
 * they are the signal a later accuracy-resolution plan reads AFTER `lastActionType` has
 * been overwritten by the client's chosen passType.
 *
 * `ball.carrierId` is untouched by this function — it has carried the corner-taker since
 * `applyCornerKickTakerSelect` and remains so across both slots and into `PASS`.
 */
export function applyCornerKickFinalSetupEnd(state: GameState): ApplyCornerKickFinalSetupEndResult {
  if (state.phase !== 'CORNER_KICK_FINAL_SETUP') return { ok: false, reason: 'WRONG_PHASE' };
  if (state.cornerKickMoveSlot == null || state.cornerKickTeam == null) {
    return { ok: false, reason: 'WRONG_PHASE' };
  }

  const cornerKickTeam = state.cornerKickTeam;

  if (state.cornerKickMoveSlot === 'ATTACKER') {
    const defendingTeam: 'home' | 'away' = cornerKickTeam === 'home' ? 'away' : 'home';
    return {
      ok: true,
      state: {
        ...state,
        cornerKickMoveSlot: 'DEFENDER',
        cornerKickMovedPieceId: null,
        cornerKickPaceUsed: 0,
        activeTeam: defendingTeam,
      },
    };
  }

  // DEFENDER slot's end: finalize into the generic PASS phase.
  return {
    ok: true,
    state: {
      ...state,
      phase: 'PASS',
      lastActionType: 'CORNER_KICK_RESTART',
      attackingTeam: cornerKickTeam,
      activeTeam: cornerKickTeam,
      passTargetHex: null,
      cornerKickMoveSlot: null,
      cornerKickMovedPieceId: null,
      cornerKickPaceUsed: 0,
      // Pitfall 3: explicitly carried forward — see doc comment above.
      cornerKickTeam,
      cornerKickHex: state.cornerKickHex ?? null,
      cornerKickTakerId: state.cornerKickTakerId ?? null,
    },
  };
}

// ---------------------------------------------------------------------------
// applyThrowInPlace
// ---------------------------------------------------------------------------

/** Discriminated union result for applyThrowInPlace. */
export type ApplyThrowInPlaceResult =
  | { ok: false; reason: 'WRONG_PHASE' | 'PIECE_NOT_FOUND' | 'WRONG_TEAM' }
  | { ok: true; state: GameState };

/**
 * THROWIN-02: places the throwing team's chosen piece (and the ball) at the
 * server-owned `state.throwInHex`, then starts a real Movement Phase 1
 * (`phase: 'MOVE'`, `movementSlot: 'ATTACKER_4'`) — not a bespoke reposition
 * step. Movement Phase 1 is mandatory (D-09): no throw option exists before it
 * completes, because this function never transitions to 'PASS'.
 *
 * Guard order mirrors applyGKKickTarget: phase/context guard first, then piece
 * lookup, then team ownership — so a caller always gets the most specific
 * failure reason.
 *
 * This is a teleport, not a move: the chosen piece is repositioned to
 * `throwInHex` regardless of distance (THROWIN-02 places the thrower at the
 * exit hex). `resolveThrowInHex` (Plan 37-01/37-04) already guarantees
 * `throwInHex` is unoccupied, so no validateMove call or pace consumption is
 * needed here.
 *
 * @param state   - Current game state (phase must be THROW_IN_SETUP with throwInHex/throwInTeam set)
 * @param pieceId - The throwing team's piece chosen to take the throw
 */
export function applyThrowInPlace(state: GameState, pieceId: string): ApplyThrowInPlaceResult {
  if (state.phase !== 'THROW_IN_SETUP') return { ok: false, reason: 'WRONG_PHASE' };
  if (state.throwInHex == null || state.throwInTeam == null) {
    return { ok: false, reason: 'WRONG_PHASE' };
  }

  const piece = state.pieces.find((p) => p.id === pieceId);
  if (!piece) return { ok: false, reason: 'PIECE_NOT_FOUND' };

  if (piece.teamId !== state.throwInTeam) return { ok: false, reason: 'WRONG_TEAM' };

  const throwInHex = state.throwInHex;
  const throwInTeam = state.throwInTeam;

  const throwInPlaceEvent: ActionEvent = {
    type: 'THROW_IN_PLACE',
    pieceId,
    from: piece.position,
    to: throwInHex,
    timestamp: Date.now(),
    ballAfter: { position: throwInHex, carrierId: pieceId },
  };

  return {
    ok: true,
    state: {
      ...state,
      phase: 'MOVE',
      movementSlot: 'ATTACKER_4',
      attackingTeam: throwInTeam,
      activeTeam: throwInTeam,
      pieces: state.pieces.map((p) => (p.id === pieceId ? { ...p, position: throwInHex } : p)),
      ball: {
        position: throwInHex,
        carrierId: pieceId,
        lastTouchedBy: { pieceId, teamId: throwInTeam },
      },
      // Fresh-Movement-Phase reset set — mirrors applyStartMovement's reset literal
      // (gameEngine.ts:447 area) as the source of truth. applyStartMovement itself is
      // NOT called: it guards on phase KICK_OFF/PASS/LOOSE_BALL and would reject
      // THROW_IN_SETUP; widening that guard would let a client start a movement phase
      // from a restart setup screen, which is not desired.
      movedPieceIds: [],
      paceUsedByPieceId: {},
      contestedPieceIds: [],
      stealAttemptedByIds: [],
      tackleAttemptedByIds: [],
      carriedMovedPieceIds: [],
      lastDiceRoll: null,
      lastActionType: null,
      // throwInHex/throwInTeam are preserved; throwInPhasesTaken stays 0 — the
      // counter is incremented by applyEndTurn's throw-in branch (Task 2), not here.
      throwInHex,
      throwInTeam,
      throwInPhasesTaken: 0,
      eventLog: [...state.eventLog, throwInPlaceEvent],
    },
  };
}

// ---------------------------------------------------------------------------
// computeGoalKickEligibleIds
// ---------------------------------------------------------------------------

/**
 * GOALKICK-02: computes both goal-kick reposition-window eligible lists at
 * trigger time (called from `triggerOutOfBoundsRestart`'s GOAL_KICK branch).
 *
 * A piece is eligible if its position AT TRIGGER TIME is in either final
 * third — `isInRegion(p.position, 'homeThird') || isInRegion(p.position,
 * 'awayThird')`, equivalently `computeBallZone(p.position) !== 'middle'` —
 * regardless of which team's third it is standing in. This is the literal
 * reading of GOALKICK-02's text ("both final-thirds' players may
 * reposition"), per 37-CONTEXT.md / 37-08-PLAN.md's decision log: it is
 * deliberately broader than RESEARCH.md's narrower "each team's own final
 * third" suggestion, which is NOT adopted here.
 *
 * Eligible pieces are partitioned by team into `gkTeam`/`opponent` — never
 * recomputed after this call, mirroring `freeMoveEligibleIds`' precompute-
 * both-teams-at-trigger-time contract (see `applyFreeMoveZoneCheck`), so a
 * piece that walks OUT of a final third mid-window keeps its remaining
 * 6-hex budget, and a piece that walks IN during the window does not gain
 * a fresh one.
 */
export function computeGoalKickEligibleIds(
  pieces: readonly PlayerPiece[],
  goalKickTeam: 'home' | 'away',
): { gkTeam: readonly string[]; opponent: readonly string[] } {
  const eligible = pieces.filter(
    (p) => isInRegion(p.position, 'homeThird') || isInRegion(p.position, 'awayThird'),
  );
  return {
    gkTeam: eligible.filter((p) => p.teamId === goalKickTeam).map((p) => p.id),
    opponent: eligible.filter((p) => p.teamId !== goalKickTeam).map((p) => p.id),
  };
}

// ---------------------------------------------------------------------------
// applyGoalKickReposition
// ---------------------------------------------------------------------------

/**
 * GOALKICK-02: single-hex-per-click repositioning during the GOAL_KICK_SETUP_GK
 * / GOAL_KICK_SETUP_OPPONENT reposition windows.
 *
 * D-01: this function structurally copies `applyFreeMove`'s body (adjacency,
 * occupancy, per-piece budget accumulation, the `movedPieceIds` exhaustion
 * lock, and the `abandonedIds` sweep) — it does NOT call `applyFreeMove`,
 * `applyMove`, `applyGKRestart`, `applyGKKickTarget`, or read any `gkKick*`
 * field. Copying the shape is required; calling those functions/fields is
 * forbidden.
 *
 * Budget model: per-piece, 6 hexes each, tracked in `goalKickUsedPace` keyed
 * by piece id (the `freeMoveUsedPace` shape) — NOT the FREE_KICK_STAGES
 * distinct-piece-count model.
 */
export function applyGoalKickReposition(
  state: GameState,
  pieceId: string,
  to: HexCoord,
): ApplyMoveResult {
  if (state.phase !== 'GOAL_KICK_SETUP_GK' && state.phase !== 'GOAL_KICK_SETUP_OPPONENT') {
    return { ok: false, reason: 'WRONG_PHASE' };
  }

  const piece = state.pieces.find((p) => p.id === pieceId);
  if (!piece) return { ok: false, reason: 'PIECE_NOT_FOUND' };

  if (piece.teamId !== state.activeTeam) {
    return { ok: false, reason: 'WRONG_TEAM' };
  }

  const eligibleIds =
    state.phase === 'GOAL_KICK_SETUP_GK'
      ? (state.goalKickEligibleIds?.gkTeam ?? [])
      : (state.goalKickEligibleIds?.opponent ?? []);
  if (!eligibleIds.includes(pieceId)) {
    return { ok: false, reason: 'MOVE_INVALID', detail: 'NOT_ELIGIBLE' };
  }
  // Already activated this window (exhausted its 6 hexes, or abandoned when the
  // player switched to a different piece) — mirrors applyFreeMove's movedPieceIds
  // lock (UX-parity: an already-activated piece shows the "activated" state and
  // becomes unselectable, same as regular MOVEMENT/FREE_MOVE).
  if (state.movedPieceIds.includes(pieceId)) {
    return { ok: false, reason: 'MOVE_INVALID', detail: 'GOAL_KICK_PACE_EXHAUSTED' };
  }

  // Standard adjacency/occupancy validation (mirrors applyFreeMove's checks 2+3).
  if (hexDistance(piece.position, to) !== 1) {
    return { ok: false, reason: 'MOVE_INVALID', detail: 'OUT_OF_RANGE' };
  }
  // GOALKICK-02 (37-13, closes the 37-VERIFICATION.md 2026-08-04 BLOCKER): eligibility
  // for both reposition windows is homeThird (q<=10) or awayThird (q>=26) — so a piece
  // sitting on the q=0/q=36 column or the r=0/r=25 row (an ordinary goalkeeper/defender
  // position, not a contrived edge case) is one adjacent-hex click from an off-grid
  // coordinate. An off-grid piece has no recovery path (every subsequent click is still
  // "adjacent to current position", so it can be walked arbitrarily far within its own
  // 6-hex budget) and silently poisons offside/ZoI/every hexDistance-based rule for the
  // rest of the match while disappearing from the rendered SVG grid. This mirrors the
  // sibling applyGoalKickTarget's on-pitch guard in this same file. The client's own
  // PITCH_HEXES filter (useGameStore.computeFreeMoveValidHexes) is a convenience, never
  // the server's defense.
  //
  // Placement (D-13-03): adjacency is checked first so a distant off-pitch hex still
  // returns OUT_OF_RANGE; OFF_PITCH precedes OCCUPIED because no piece can ever occupy
  // an off-pitch hex, so the two checks are mutually exclusive.
  if (!isPitchHex(to)) {
    return { ok: false, reason: 'MOVE_INVALID', detail: 'OFF_PITCH' };
  }
  if (state.pieces.some((p) => p.position.q === to.q && p.position.r === to.r)) {
    return { ok: false, reason: 'MOVE_INVALID', detail: 'OCCUPIED' };
  }

  const stepDistance = 1; // single-step adjacency already enforced above
  const usedSoFar = (state.goalKickUsedPace ?? {})[pieceId] ?? 0;
  if (usedSoFar + stepDistance > 6) {
    return { ok: false, reason: 'MOVE_INVALID', detail: 'GOAL_KICK_PACE_EXHAUSTED' };
  }

  const newUsed = usedSoFar + stepDistance;
  // Mirrors applyFreeMove's abandonment sweep: starting a brand-new activation on
  // this piece (usedSoFar === 0) locks in any OTHER piece with an in-progress,
  // unfinished activation (has a goalKickUsedPace entry but isn't yet in
  // movedPieceIds) — the player chose to move on, so the previous unit is
  // activated even though it didn't use its full 6 hexes.
  const isNewActivation = usedSoFar === 0;
  const abandonedIds = isNewActivation
    ? Object.keys(state.goalKickUsedPace ?? {}).filter(
        (id) => id !== pieceId && !state.movedPieceIds.includes(id),
      )
    : [];
  const newMovedPieceIds = new Set(state.movedPieceIds);
  for (const id of abandonedIds) newMovedPieceIds.add(id);

  const newPieces = state.pieces.map((p) => (p.id === pieceId ? { ...p, position: to } : p));
  const moveEvent: ActionEvent = {
    type: 'MOVE',
    pieceId,
    from: piece.position,
    to,
    // GOAL_KICK_SETUP has no movementSlot (not part of the 4-5-2 sequence); ATTACKER_2
    // is the closest semantic match (independent per-piece activation, no steal/tackle
    // effects) — reusing the MOVE event type is what lets applyUndo's default
    // moveTypeForPhase branch (registered in Plan 37-02) work without a new event type.
    slot: 'ATTACKER_2',
    timestamp: Date.now(),
    // Ball unchanged during the reposition windows.
    ballAfter: { position: state.ball.position, carrierId: state.ball.carrierId },
  };

  return {
    ok: true,
    state: {
      ...state,
      pieces: newPieces,
      eventLog: [...state.eventLog, moveEvent],
      goalKickUsedPace: {
        ...(state.goalKickUsedPace ?? {}),
        [pieceId]: newUsed,
      },
      movedPieceIds: [...newMovedPieceIds],
    },
  };
}

// ---------------------------------------------------------------------------
// applyGoalKickWindowEnd
// ---------------------------------------------------------------------------

/** Discriminated union result for applyGoalKickWindowEnd. */
export type ApplyGoalKickWindowEndResult =
  | { ok: false; reason: 'WRONG_PHASE' }
  | { ok: true; state: GameState };

/**
 * GOALKICK-02: ends the active reposition window on the active team's End Turn.
 *
 * - From GOAL_KICK_SETUP_GK: if the opponent's eligible list is non-empty, hands
 *   off to GOAL_KICK_SETUP_OPPONENT (flips activeTeam, resets movedPieceIds for
 *   the second window, preserves goalKickUsedPace unchanged — it is keyed by
 *   piece id so the two windows cannot collide). Otherwise the opponent window
 *   is skipped (D-01/GOALKICK-02: "a window with an empty eligible list is
 *   skipped rather than presenting a dead panel") and this falls straight
 *   through to the GOAL_KICK_CHOICE return below.
 * - From GOAL_KICK_SETUP_OPPONENT: always returns GOAL_KICK_CHOICE.
 *
 * D-01: structurally mirrors applyGKRestart's choice-branch return shape
 * (phase + attackingTeam + activeTeam + lastDiceRoll: null + lastActionType)
 * and applyFreeMoveEnd's "hand off or skip, then restore" shape — it does NOT
 * call either function.
 */
export function applyGoalKickWindowEnd(state: GameState): ApplyGoalKickWindowEndResult {
  if (state.phase !== 'GOAL_KICK_SETUP_GK' && state.phase !== 'GOAL_KICK_SETUP_OPPONENT') {
    return { ok: false, reason: 'WRONG_PHASE' };
  }
  // Defensive: both reposition phases require goalKickTeam to be set (invariant
  // established by triggerOutOfBoundsRestart) — malformed state falls back to
  // WRONG_PHASE rather than a runtime crash, mirroring applyThrowInPlace's
  // null-context guard.
  if (state.goalKickTeam == null) {
    return { ok: false, reason: 'WRONG_PHASE' };
  }
  const goalKickTeam = state.goalKickTeam;

  // GOALKICK-02: pieces may have moved during the window that is ending —
  // re-evaluate the sticky offside flag on every return, mirroring
  // applyFreeMoveEnd's contract (computed once, spread into every return).
  const nextOffside = evaluateOffside(state);

  if (state.phase === 'GOAL_KICK_SETUP_GK') {
    const opponentIds = state.goalKickEligibleIds?.opponent ?? [];
    if (opponentIds.length > 0) {
      const opponentTeam: 'home' | 'away' = goalKickTeam === 'home' ? 'away' : 'home';
      const advanceEvent: ActionEvent = {
        type: 'GOAL_KICK_WINDOW_ADVANCE',
        fromWindow: 'GK_TEAM',
        timestamp: Date.now(),
      };
      return {
        ok: true,
        state: {
          ...state,
          phase: 'GOAL_KICK_SETUP_OPPONENT',
          activeTeam: opponentTeam,
          // The second team's pieces have not moved yet — fresh movedPieceIds.
          // goalKickUsedPace is preserved unchanged (keyed by piece id).
          movedPieceIds: [],
          offsidePieceIds: nextOffside,
          eventLog: [...state.eventLog, advanceEvent],
        },
      };
    }
    // Opponent list empty — skip straight to GOAL_KICK_CHOICE (still emitting the
    // GOAL_KICK_WINDOW_ADVANCE event so Undo's boundary scan sees the transition).
    const advanceEvent: ActionEvent = {
      type: 'GOAL_KICK_WINDOW_ADVANCE',
      fromWindow: 'GK_TEAM',
      timestamp: Date.now(),
    };
    return {
      ok: true,
      state: {
        ...state,
        phase: 'GOAL_KICK_CHOICE',
        activeTeam: goalKickTeam,
        attackingTeam: goalKickTeam,
        movedPieceIds: [],
        paceUsedByPieceId: {},
        goalKickEligibleIds: null,
        goalKickUsedPace: null,
        lastDiceRoll: null,
        offsidePieceIds: nextOffside,
        eventLog: [...state.eventLog, advanceEvent],
      },
    };
  }

  // GOAL_KICK_SETUP_OPPONENT -> GOAL_KICK_CHOICE (always).
  const advanceEvent: ActionEvent = {
    type: 'GOAL_KICK_WINDOW_ADVANCE',
    fromWindow: 'OPPONENT',
    timestamp: Date.now(),
  };
  return {
    ok: true,
    state: {
      ...state,
      phase: 'GOAL_KICK_CHOICE',
      activeTeam: goalKickTeam,
      attackingTeam: goalKickTeam,
      movedPieceIds: [],
      paceUsedByPieceId: {},
      goalKickEligibleIds: null,
      goalKickUsedPace: null,
      lastDiceRoll: null,
      offsidePieceIds: nextOffside,
      eventLog: [...state.eventLog, advanceEvent],
    },
  };
}

// ---------------------------------------------------------------------------
// applyGoalKickChoice
// ---------------------------------------------------------------------------

/** Discriminated union result for applyGoalKickChoice. */
export type ApplyGoalKickChoiceResult =
  | { ok: false; reason: 'WRONG_PHASE' | 'INVALID_CHOICE' | 'PIECE_NOT_FOUND' }
  | { ok: true; state: GameState };

/**
 * GOALKICK-03: the goalkeeper's team chooses 'kick' or 'standard' once both
 * reposition windows have closed (phase GOAL_KICK_CHOICE).
 *
 * - 'standard' (GOALKICK-03/04: "uses the existing Standard Pass mechanic
 *   unmodified") — hands the ball to the GK and transitions to PASS with
 *   `lastActionType: 'GOAL_KICK_RESTART'`, restricting the next action to a
 *   Standard Pass (see the GOAL_KICK_RESTART row in actionSequence.ts) — from
 *   there the existing, unmodified pass pipeline takes over with its normal
 *   11-hex range. All goal-kick fields are cleared (fresh sequence).
 * - 'kick' — transitions to GOAL_KICK_TARGET; ball stays with the GK
 *   (Plan 37-09 owns target selection + the accuracy roll + travel movement).
 *   goalKickTeam/goalKickGkId are preserved for that plan.
 *
 * D-01: structurally mirrors the GK-restart choice handler's validation
 * pattern — it does NOT call applyGKRestart or read any gkKick* field.
 */
export function applyGoalKickChoice(
  state: GameState,
  choice: 'kick' | 'standard',
): ApplyGoalKickChoiceResult {
  if (state.phase !== 'GOAL_KICK_CHOICE') {
    return { ok: false, reason: 'WRONG_PHASE' };
  }

  // ASVS V5 — validated here as well as in the handler, mirroring the GK-restart
  // choice handler's double-validation precedent (never trust client input).
  if (choice !== 'kick' && choice !== 'standard') {
    return { ok: false, reason: 'INVALID_CHOICE' };
  }

  const gk = state.pieces.find((p) => p.id === state.goalKickGkId);
  if (!gk) return { ok: false, reason: 'PIECE_NOT_FOUND' };

  const choiceEvent: ActionEvent = {
    type: 'GOAL_KICK_CHOICE',
    gkId: gk.id,
    choice,
    timestamp: Date.now(),
  };

  if (choice === 'standard') {
    return {
      ok: true,
      state: {
        ...state,
        phase: 'PASS',
        ball: {
          position: gk.position,
          carrierId: gk.id,
          lastTouchedBy: { pieceId: gk.id, teamId: gk.teamId },
        },
        attackingTeam: gk.teamId,
        activeTeam: gk.teamId,
        lastActionType: 'GOAL_KICK_RESTART',
        lastDiceRoll: null,
        stealAttemptedByIds: [],
        tackleAttemptedByIds: [],
        goalKickTeam: null,
        goalKickGkId: null,
        goalKickEligibleIds: null,
        goalKickUsedPace: null,
        goalKickTargetHex: null,
        goalKickMoveSlot: null,
        goalKickMovedPieceId: null,
        goalKickPaceUsed: 0,
        eventLog: [...state.eventLog, choiceEvent],
      },
    };
  }

  // 'kick' branch: ball stays with the GK; Plan 37-09 owns target selection.
  return {
    ok: true,
    state: {
      ...state,
      phase: 'GOAL_KICK_TARGET',
      attackingTeam: gk.teamId,
      activeTeam: gk.teamId,
      lastDiceRoll: null,
      lastActionType: null,
      eventLog: [...state.eventLog, choiceEvent],
    },
  };
}

// ---------------------------------------------------------------------------
// applyGoalKickTarget
// ---------------------------------------------------------------------------

/** Discriminated union result for applyGoalKickTarget. */
export type ApplyGoalKickTargetResult =
  | { ok: false; reason: 'WRONG_PHASE' | 'PIECE_NOT_FOUND' | 'OFF_PITCH' | 'INVALID_TARGET' }
  | { ok: true; state: GameState };

/**
 * GOALKICK-05: records the goal-kick target and transitions to GOAL_KICK_MOVE.
 *
 * D-01: structurally mirrors applyGKKickTarget's shape (phase-guard, GK lookup,
 * isPitchHex/own-hex checks, GK_KICK_MOVE-style state literal) but does NOT call
 * applyGKKickTarget/applyGKRestart and does NOT read any gkKick* field — the GK is
 * resolved via the goal-kick-specific `goalKickGkId`, which keeps working after the
 * ball leaves the goalkeeper's hands (unlike ball.carrierId).
 *
 * GOALKICK-05: "the Kick targets a teammate's head" — the target hex must be
 * occupied by an outfield teammate of the goalkeeper. This is what guarantees the
 * mandatory-header outcome (applyGoalKickMoveEnd's accurate branch) is reachable by
 * construction: a client cannot aim at empty space to dodge the header contest.
 *
 * `validatePass` is deliberately not called — a goal kick has no path-blocking or
 * interception concept (D-01 / RESEARCH.md Assumption A4).
 */
export function applyGoalKickTarget(
  state: GameState,
  targetHex: HexCoord,
): ApplyGoalKickTargetResult {
  if (state.phase !== 'GOAL_KICK_TARGET') {
    return { ok: false, reason: 'WRONG_PHASE' };
  }

  const gk = state.pieces.find((p) => p.id === state.goalKickGkId);
  if (!gk) return { ok: false, reason: 'PIECE_NOT_FOUND' };

  if (!isPitchHex(targetHex)) return { ok: false, reason: 'OFF_PITCH' };

  if (targetHex.q === gk.position.q && targetHex.r === gk.position.r) {
    return { ok: false, reason: 'INVALID_TARGET' };
  }

  // GOALKICK-05: "the Kick targets a teammate's head" — reject anything that is not
  // an outfield teammate of the goalkeeper standing exactly on the target hex.
  const receiver = state.pieces.find(
    (p) =>
      p.teamId === state.goalKickTeam &&
      p.id !== gk.id &&
      p.position.q === targetHex.q &&
      p.position.r === targetHex.r,
  );
  if (!receiver) return { ok: false, reason: 'INVALID_TARGET' };

  return {
    ok: true,
    state: {
      ...state,
      phase: 'GOAL_KICK_MOVE',
      // D-06/OOB-01: the goalkeeper is a real contact — clearing carrierId puts the
      // ball visibly in the air for both managers while the travel window plays out.
      ball: {
        position: targetHex,
        carrierId: null,
        lastTouchedBy: { pieceId: gk.id, teamId: gk.teamId },
      },
      goalKickTargetHex: targetHex,
      goalKickMoveSlot: 'KICKER',
      goalKickMovedPieceId: null,
      goalKickPaceUsed: 0,
      attackingTeam: gk.teamId,
      activeTeam: gk.teamId,
      // BUG-18 parity: clear lastDiceRoll on travel-window entry so a stale dice
      // result from an earlier phase cannot block Undo.
      lastDiceRoll: null,
      lastActionType: null,
      // Target selection emits no event — the GOAL_KICK delivery event's targetHex
      // field (applyGoalKickMoveEnd) is the audit record for this action.
    },
  };
}

// ---------------------------------------------------------------------------
// applyGoalKickMoveEnd
// ---------------------------------------------------------------------------

/** Discriminated union result for applyGoalKickMoveEnd. */
export type ApplyGoalKickMoveEndResult =
  | { ok: false; reason: 'WRONG_PHASE' | 'PIECE_NOT_FOUND' | 'MISSING_TARGET' }
  | { ok: true; state: GameState };

/**
 * GOALKICK-05: owns BOTH halves of the GOAL_KICK_MOVE travel window so the whole
 * thing is unit-testable without mocking randomness.
 *
 * - KICKER slot: hands the travel-movement slot to the opponent. `kickDie` is
 *   deliberately ignored here — the handler generates a die unconditionally so
 *   this function's signature stays total and deterministic under test, and
 *   discarding one crypto.randomInt draw has no gameplay effect (nothing
 *   surfaces it).
 * - OPP slot: resolves the kick's accuracy via computeCombinedScore(gk.highPass,
 *   kickDie, []) — NOT the inline `kickDie + gk.highPass` the GK_KICK_MOVE
 *   handler uses (D-02: the shared function is the single source of the
 *   DICE-04 penalty clamp). An accurate kick (combined score >= 8, GOALKICK-03)
 *   with an eligible header contest enters HEADER (copying the HIGH_PASS ->
 *   HEADER eligibility check verbatim); with no eligible header it falls to
 *   LOOSE_BALL. An inaccurate kick always falls to LOOSE_BALL (GOALKICK-04) —
 *   which then scatters through applyRoll's out-of-bounds-aware LOOSE_BALL
 *   clamp (Plan 37-04), giving "follows the existing Loose Ball rules,
 *   including out-of-bounds reclassification" for free.
 *
 * D-01: does not call applyGKKickTarget/applyGKRestart or read any gkKick* field.
 * ARCH-01: never calls rollDice()/Math.random() — kickDie is injected by the caller.
 *
 * ballAfter.carrierId is null on BOTH branches — unlike the GK_KICK analog, an
 * accurate goal kick lands in a header contest rather than being caught by a
 * receiver, so nobody carries the ball at resolution time.
 */
export function applyGoalKickMoveEnd(
  state: GameState,
  kickDie: number,
): ApplyGoalKickMoveEndResult {
  if (state.phase !== 'GOAL_KICK_MOVE') return { ok: false, reason: 'WRONG_PHASE' };

  // Pieces may have repositioned during either travel-movement slot — re-evaluate
  // offside on every return, mirroring applyEndTurn/applyGoalKickWindowEnd's contract.
  const nextOffside = evaluateOffside(state);

  // ---- KICKER slot: hand the travel-movement slot to the opponent ----
  if (state.goalKickMoveSlot === 'KICKER') {
    const oppTeam: 'home' | 'away' = state.goalKickTeam === 'home' ? 'away' : 'home';
    return {
      ok: true,
      state: {
        ...state,
        goalKickMoveSlot: 'OPP',
        activeTeam: oppTeam,
        goalKickMovedPieceId: null,
        goalKickPaceUsed: 0,
        offsidePieceIds: nextOffside,
      },
    };
  }

  // ---- OPP slot: resolve the kick's accuracy ----
  const gk = state.pieces.find((p) => p.id === state.goalKickGkId);
  if (!gk) return { ok: false, reason: 'PIECE_NOT_FOUND' };

  const targetHex = state.goalKickTargetHex;
  if (targetHex === null || targetHex === undefined) {
    return { ok: false, reason: 'MISSING_TARGET' };
  }

  const kickScore = computeCombinedScore(gk.highPass, kickDie, []);
  const accurate = kickScore >= 8; // GOALKICK-03 threshold

  const kickEvent: ActionEvent = {
    type: 'GOAL_KICK',
    gkId: gk.id,
    targetHex,
    accurate,
    kickDie,
    kickScore,
    timestamp: Date.now(),
    // ballAfter.carrierId is null on BOTH branches (see doc comment above) — an
    // accurate goal kick lands in a header contest, not a receiver's hands.
    ballAfter: { position: targetHex, carrierId: null },
  };

  // Shared teardown applied to both OPP-slot returns — clears every goal-kick
  // field so the sequence is fresh for the next goal kick.
  const teardown = {
    goalKickTeam: null,
    goalKickGkId: null,
    goalKickTargetHex: null,
    goalKickMoveSlot: null,
    goalKickMovedPieceId: null,
    goalKickPaceUsed: 0,
    goalKickEligibleIds: null,
    goalKickUsedPace: null,
    lastDiceRoll: { rolls: [kickDie], context: 'GOAL_KICK' },
    lastShotPath: null,
    actionCount: state.actionCount + 1,
    eventLog: [...state.eventLog, kickEvent],
    attackingTeam: gk.teamId,
    activeTeam: gk.teamId,
    offsidePieceIds: nextOffside,
  };

  if (accurate) {
    // Copied verbatim from the HIGH_PASS -> HEADER eligibility check (D-02).
    const homeEligible = state.pieces.some(
      (p) => p.teamId === 'home' && hexDistance(p.position, targetHex) <= 2,
    );
    const awayEligible = state.pieces.some(
      (p) => p.teamId === 'away' && hexDistance(p.position, targetHex) <= 2,
    );

    if (!homeEligible && !awayEligible) {
      // No eligible header contestants — ball falls loose at the target (GOALKICK-04
      // reuses the same "no eligible players" LOOSE_BALL fallback as a High Pass).
      return {
        ok: true,
        state: {
          ...state,
          ...teardown,
          phase: 'LOOSE_BALL',
          ball: {
            position: targetHex,
            carrierId: null,
            lastTouchedBy: { pieceId: gk.id, teamId: gk.teamId },
          },
          lastActionType: 'DEFLECTION',
        },
      };
    }

    return {
      ok: true,
      state: {
        ...state,
        ...teardown,
        phase: 'HEADER',
        ball: {
          position: targetHex,
          carrierId: null,
          lastTouchedBy: { pieceId: gk.id, teamId: gk.teamId },
        },
        // Deliberate: the delivery genuinely is a High Pass per GOALKICK-03, and
        // entering the existing HEADER machinery in exactly the state it already
        // expects (contestant selection, RULE-01 accuracy acknowledgement) means
        // zero new header-resolution code is needed.
        lastActionType: 'HIGH_PASS',
        headerContestants: { home: [] as string[], away: [] as string[] },
        headerConfirmed: { home: !homeEligible, away: !awayEligible },
        headerTargetHex: null,
        headerAccuracyRollPending: true,
      },
    };
  }

  // Inaccurate (GOALKICK-04): loose ball at the target hex. The follow-up scatter
  // runs through applyRoll's LOOSE_BALL case, which Plan 37-04 made out-of-bounds-
  // aware — an inaccurate goal kick that scatters off the pitch is reclassified
  // with zero extra code here.
  return {
    ok: true,
    state: {
      ...state,
      ...teardown,
      phase: 'LOOSE_BALL',
      ball: {
        position: targetHex,
        carrierId: null,
        lastTouchedBy: { pieceId: gk.id, teamId: gk.teamId },
      },
      lastActionType: 'DEFLECTION',
    },
  };
}

// ---------------------------------------------------------------------------
// applyGKRestart
// ---------------------------------------------------------------------------

/** Discriminated union result for applyGKRestart. */
export type ApplyGKRestartResult =
  | { ok: false; reason: 'WRONG_PHASE' | 'WRONG_TEAM' | 'INVALID_CHOICE' }
  | { ok: true; state: GameState };

/**
 * Applies a GK restart choice after the goalkeeper catches the ball (SHOT-05).
 *
 * The GK's team chooses one of three options when `GameState.phase === 'GK_RESTART'`:
 * - 'kick': High Pass accuracy check (GK's highPass attribute); accurate → MOVEMENT with
 *   ball held by GK; inaccurate → Loose Ball from GK position, MOVEMENT.
 * - 'throw': uninterceptable delivery; v1 = movement-phase start with ball held by GK.
 *   targetHex delivery (D-25 full intent) deferred to Phase 7. Intentionally equivalent
 *   to 'movement' in engine state today — kept distinct for Phase 7 extension point.
 * - 'movement': GK's team starts a Movement Phase immediately (no dice needed, D-26).
 *
 * ARCH-01: applyGKRestart is pure — it does NOT call rollDice() itself. The rollDie
 * function is injected by the caller (handler passes rollDice) so the engine stays
 * deterministic for unit tests.
 *
 * D-22: triggered by the game:gk-restart Socket.io event.
 * D-23: team guard is the handler's responsibility (controlsGKTeam); engine trusts
 *       the GK piece is correct via ball.carrierId lookup.
 * D-24: kick uses validatePassAccuracy(gk, 'HIGH', rollDie(), []) — GK's highPass
 *       attribute means kicks are almost always inaccurate, making throw/movement
 *       meaningful alternatives. Range restriction (no kick into opposite final third)
 *       is deferred per CONTEXT.md Deferred Ideas.
 * D-25: throw sets ball.carrierId = gk.id (no separate accuracy roll; no targetHex in v1).
 * D-26: movement transitions phase to MOVEMENT with attackingTeam = GK's team.
 *
 * @param state   - Current game state (phase must be GK_RESTART)
 * @param choice  - One of 'kick' | 'throw' | 'movement'
 * @param rollDie - Injected d6 function; called 1 time for kick accuracy + 2 more on inaccurate
 */
export function applyGKRestart(
  state: GameState,
  choice: 'kick' | 'throw' | 'movement',
  _rollDie: () => number,
): ApplyGKRestartResult {
  // 1. Phase guard (D-23)
  if (state.phase !== 'GK_RESTART') {
    return { ok: false, reason: 'WRONG_PHASE' };
  }

  // 2. Validate choice (ASVS V5 — never trust client input; validated here and in handler)
  if (choice !== 'kick' && choice !== 'throw' && choice !== 'movement') {
    return { ok: false, reason: 'INVALID_CHOICE' };
  }

  // 3. Look up the GK piece via ball.carrierId (Open Question 3 resolution: derive GK team
  //    from ball ownership rather than storing a separate gkTeam field)
  const gk = state.pieces.find((p) => p.id === state.ball.carrierId);
  if (!gk) {
    // Defensive: GK_RESTART requires a ball carrier; malformed state
    return { ok: false, reason: 'WRONG_PHASE' };
  }

  const gkTeam = gk.teamId;

  // ---- 'movement' branch (D-26) ----
  // D-21: GK movement = +0 min; lastActionType = null (fresh sequence)
  if (choice === 'movement') {
    return {
      ok: true,
      state: {
        ...state,
        phase: 'MOVE',
        movementSlot: 'ATTACKER_4',
        movedPieceIds: [],
        paceUsedByPieceId: {},
        attackingTeam: gkTeam,
        activeTeam: gkTeam,
        // Ball stays with GK (carrierId unchanged)
        lastDiceRoll: null,
        lastActionType: null, // D-21: GK movement = fresh sequence
        // actionCount unchanged (+0 per D-03 table)
      },
    };
  }

  // ---- 'throw' branch (D-25) ----
  // Transitions to GK_QUICK_THROW phase: GK's team selects a target hex (≤11 hexes, no blocking, no interception).
  // applyQuickThrow handles the actual delivery once the target is chosen.
  if (choice === 'throw') {
    return {
      ok: true,
      state: {
        ...state,
        phase: 'GK_QUICK_THROW',
        attackingTeam: gkTeam,
        activeTeam: gkTeam,
        lastDiceRoll: null,
        lastActionType: null,
      },
    };
  }

  // ---- 'kick' branch ----
  // GK kick: transition to GK_KICK_TARGET so the GK's team selects a destination hex.
  // Accuracy check + repositioning phase happen after target selection (GK_KICK_MOVE).
  return {
    ok: true,
    state: {
      ...state,
      phase: 'GK_KICK_TARGET',
      attackingTeam: gkTeam,
      activeTeam: gkTeam,
      lastDiceRoll: null,
      lastActionType: null,
    },
  };
}

// ---------------------------------------------------------------------------
// applyGKKickTarget
// ---------------------------------------------------------------------------

/** Discriminated union result for applyGKKickTarget. */
export type ApplyGKKickTargetResult =
  | { ok: false; reason: 'WRONG_PHASE' | 'INVALID_TARGET' | 'OFF_PITCH' }
  | { ok: true; state: GameState };

/**
 * Records the GK's chosen kick destination and transitions to GK_KICK_MOVE.
 *
 * Rules:
 * - Phase must be GK_KICK_TARGET.
 * - Target must be on the pitch and not inside the opponent's final third
 *   (home GK: cannot target awayThird q≥26; away GK: cannot target homeThird q≤10).
 * - Cannot target the GK's own hex.
 * - Ball.carrierId is cleared (ball in air); gkKickGkId preserves the GK's ID for
 *   the accuracy stat lookup after repositioning.
 * - Both teams then reposition 1 piece ≤3 hexes (GK_KICK_MOVE phase).
 */
export function applyGKKickTarget(state: GameState, targetHex: HexCoord): ApplyGKKickTargetResult {
  if (state.phase !== 'GK_KICK_TARGET') return { ok: false, reason: 'WRONG_PHASE' };

  const gk = state.pieces.find((p) => p.id === state.ball.carrierId);
  if (!gk) return { ok: false, reason: 'WRONG_PHASE' };

  if (!isPitchHex(targetHex)) return { ok: false, reason: 'OFF_PITCH' };

  // Cannot kick to own hex
  if (targetHex.q === gk.position.q && targetHex.r === gk.position.r) {
    return { ok: false, reason: 'INVALID_TARGET' };
  }

  // Cannot kick into the opponent's final third
  const restrictedRegion = gk.teamId === 'home' ? 'awayThird' : ('homeThird' as const);
  if (isInRegion(targetHex, restrictedRegion)) {
    return { ok: false, reason: 'INVALID_TARGET' };
  }

  // Quick-task 260621-b8f finding #4: the punt previously emitted no event at all — only
  // the quick-throw path (applyQuickThrow's STANDARD_PASS) logged a delivery. Emit a
  // GK_PUNT event (pass-format, no accuracy field — a punt is always delivered) so the
  // ActionLog can render a [PUNT] entry.
  const puntEvent: ActionEvent = {
    type: 'GK_PUNT',
    passerId: gk.id,
    from: gk.position,
    to: targetHex,
    ballAfter: { position: targetHex, carrierId: null },
    timestamp: Date.now(),
  };

  return {
    ok: true,
    state: {
      ...state,
      phase: 'GK_KICK_MOVE',
      // ball moves to target — visible to both teams. GK is the last toucher (punt in flight).
      ball: {
        position: targetHex,
        carrierId: null,
        lastTouchedBy: { pieceId: gk.id, teamId: gk.teamId },
      },
      gkKickTargetHex: targetHex,
      gkKickGkId: gk.id,
      gkKickMovementSlot: 'KICKER',
      gkKickMovedPieceId: null,
      gkKickPaceUsed: 0,
      eventLog: [...state.eventLog, puntEvent],
      // BUG-18 (Phase 18.3): clear lastDiceRoll on GK_KICK_MOVE entry so canUndo
      // is not blocked by a stale dice result from the preceding accuracy check.
      lastDiceRoll: null,
    },
  };
}

// ---------------------------------------------------------------------------
// applyQuickThrow
// ---------------------------------------------------------------------------

/** Discriminated union result for applyQuickThrow. */
export type ApplyQuickThrowResult =
  | { ok: false; reason: 'WRONG_PHASE' | 'RANGE_EXCEEDED' | 'INVALID_TARGET' }
  | { ok: true; state: GameState };

/**
 * Resolves a quick throw: GK delivers ball to targetHex (unblocked, uninterceptable).
 *
 * Rules:
 * - Phase must be GK_QUICK_THROW (set by applyGKRestart 'throw' branch).
 * - Distance ≤ 11 hexes (standard pass range); cannot throw to own hex.
 * - No path blocking check, no interception.
 * - Ball moves to targetHex; receiver = GK's team piece at that hex (if any).
 * - Transitions to PASS phase for GK's team; lastActionType = 'STANDARD_PASS'.
 * - actionCount unchanged (+0, same as standard throw per D-03).
 */
export function applyQuickThrow(state: GameState, targetHex: HexCoord): ApplyQuickThrowResult {
  if (state.phase !== 'GK_QUICK_THROW') return { ok: false, reason: 'WRONG_PHASE' };

  const gk = state.pieces.find((p) => p.id === state.ball.carrierId);
  if (!gk) return { ok: false, reason: 'WRONG_PHASE' };

  const dist = hexDistance(gk.position, targetHex);
  if (dist === 0 || dist > 11) return { ok: false, reason: 'RANGE_EXCEEDED' };

  if (!isPitchHex(targetHex)) return { ok: false, reason: 'INVALID_TARGET' };

  // Find a teammate at the target hex to become the new carrier.
  // TODO: if an OPPOSING player occupies targetHex, they should immediately gain possession
  // (change of possession; ball.carrierId = opponent piece, attackingTeam flips). Currently
  // the ball lands as a loose ball (carrierId: null) and the opponent never gets possession.
  // Fix: also search for an opponent piece at targetHex; if found, set carrierId to that piece
  // and flip attackingTeam/activeTeam to the opponent's team before transitioning to PASS.
  const receiver = state.pieces.find(
    (p) => p.teamId === gk.teamId && p.position.q === targetHex.q && p.position.r === targetHex.r,
  );

  const throwEvent: ActionEvent = {
    type: 'STANDARD_PASS',
    passerId: gk.id,
    from: gk.position,
    to: targetHex,
    accurate: true,
    timestamp: Date.now(),
    ballAfter: { position: targetHex, carrierId: receiver?.id ?? null },
  };

  return {
    ok: true,
    state: {
      ...state,
      phase: 'PASS',
      ball: {
        position: targetHex,
        carrierId: receiver?.id ?? null,
        lastTouchedBy: receiver
          ? { pieceId: receiver.id, teamId: receiver.teamId }
          : { pieceId: gk.id, teamId: gk.teamId },
      },
      attackingTeam: gk.teamId,
      activeTeam: gk.teamId,
      lastActionType: 'STANDARD_PASS',
      lastDiceRoll: null,
      stealAttemptedByIds: [], // D-02: reset at every 'PASS' transition
      tackleAttemptedByIds: [], // D-02
      eventLog: [...state.eventLog, throwEvent],
    },
  };
}

// ---------------------------------------------------------------------------
// applySnapshot
// ---------------------------------------------------------------------------

/**
 * Discriminated union result for applySnapshot.
 * SNAP-01: rejects if conditions are not met.
 * SNAP-02: on success, transitions to SHOT with -1 penalty marker.
 */
export type ApplySnapshotResult =
  | { ok: false; reason: 'WRONG_PHASE' | 'NOT_IN_PENALTY_AREA' | 'INVALID_SEQUENCE' }
  | { ok: true; state: GameState };

/**
 * Declares a Snapshot shot from the current game state.
 *
 * SNAP-01: Valid when:
 *   (a) phase === 'MOVE' AND ball-carrier is in the opponent's penalty area, OR
 *   (b) immediately after an accurate pass (lastActionType is a pass type) AND phase === 'PASS'
 *
 * SNAP-02: On success, transitions to phase 'SHOT' with snapshotPenalty: true.
 *   The SHOT branch in applyRoll applies the -1 dice penalty (T-08-04: server-authoritative).
 *
 * SNAP-03: All standard shot rules apply — handled entirely in applyRoll SHOT branch.
 *
 * D-18: Snapshot costs +0 min; actionCount unchanged.
 *
 * T-08-04 (Tampering): The snapshot penalty marker is set server-side and consumed
 *   server-side — the client cannot omit or bypass it.
 *
 * Validation order (fail-fast):
 * 1. Sequence guard (INVALID_SEQUENCE) — check ELIGIBLE_NEXT_ACTIONS
 * 2. Phase/position guard (WRONG_PHASE | NOT_IN_PENALTY_AREA)
 */
export function applySnapshot(state: GameState): ApplySnapshotResult {
  // 1. Sequence guard: if lastActionType is set, verify SNAPSHOT is eligible
  if (state.lastActionType !== null) {
    const eligible = ELIGIBLE_NEXT_ACTIONS[state.lastActionType];
    if (!eligible.has('SNAPSHOT')) {
      return { ok: false, reason: 'INVALID_SEQUENCE' };
    }
  }

  // Pass types eligible for immediately-post-pass SNAP-01 trigger (D-16/D-20: module-level const)
  const passTypes = SNAPSHOT_ELIGIBLE_PASS_TYPES;

  // 2. Phase/position guard
  if (state.phase === 'MOVE') {
    // SNAP-01 trigger (a): ball-carrier must be in the opponent's penalty area
    const carrier = state.pieces.find((p) => p.id === state.ball.carrierId);
    if (!carrier) {
      return { ok: false, reason: 'WRONG_PHASE' };
    }

    // Determine opponent's penalty area based on attacking team
    const penaltyRegion = state.attackingTeam === 'home' ? 'awayPenaltyArea' : 'homePenaltyArea';

    if (!isInRegion(carrier.position, penaltyRegion)) {
      return { ok: false, reason: 'NOT_IN_PENALTY_AREA' };
    }

    // Carrier must be within 6 hexes of the goal line — mirrors client canSnapshot guard.
    const goalQ = state.attackingTeam === 'home' ? 36 : 0;
    const inSnapRange = GOAL_R_VALUES.some(
      (r) => hexDistance(carrier.position, { q: goalQ, r }) <= 6,
    );
    if (!inSnapRange) {
      return { ok: false, reason: 'NOT_IN_PENALTY_AREA' };
    }

    // Valid MOVE snapshot — attacker must declare goal hex (SNAPSHOT_TARGET), then opponent deflects
    return {
      ok: true,
      state: {
        ...state,
        phase: 'SNAPSHOT_TARGET',
        lastActionType: 'SNAPSHOT', // D-18
        snapshotGkPenalty: 0, // SNAP-02: penalty determined by GK distance in SNAPSHOT_DEFLECT
        // actionCount unchanged (+0 per D-18)
      },
    };
  }

  if (state.phase === 'PASS') {
    // SNAP-01 trigger (b): immediately after an accurate pass (PASS phase = accurate pass resolved)
    // Carrier must also be in the opponent's penalty area (mirrors trigger (a) position requirement)
    if (state.lastActionType !== null && passTypes.has(state.lastActionType)) {
      const carrier = state.pieces.find((p) => p.id === state.ball.carrierId);
      if (!carrier) {
        return { ok: false, reason: 'WRONG_PHASE' };
      }
      const penaltyRegion = state.attackingTeam === 'home' ? 'awayPenaltyArea' : 'homePenaltyArea';
      if (!isInRegion(carrier.position, penaltyRegion)) {
        return { ok: false, reason: 'NOT_IN_PENALTY_AREA' };
      }
      // Carrier must be within 6 hexes of the goal line — mirrors client canSnapshot guard.
      const goalQ = state.attackingTeam === 'home' ? 36 : 0;
      const inSnapRange = GOAL_R_VALUES.some(
        (r) => hexDistance(carrier.position, { q: goalQ, r }) <= 6,
      );
      if (!inSnapRange) {
        return { ok: false, reason: 'NOT_IN_PENALTY_AREA' };
      }
      return {
        ok: true,
        state: {
          ...state,
          phase: 'SNAPSHOT_TARGET',
          lastActionType: 'SNAPSHOT', // D-18
          snapshotGkPenalty: 0, // SNAP-02
          // actionCount unchanged
        },
      };
    }
    // In PASS phase but lastActionType not a pass type → invalid
    return { ok: false, reason: 'WRONG_PHASE' };
  }

  // Any other phase is not valid for a snapshot
  return { ok: false, reason: 'WRONG_PHASE' };
}

// ---------------------------------------------------------------------------
// computeHeaderDuelDetail (RULE-02, Phase 11 — called from GAME_HEADER_CONTESTANT handler)
// ---------------------------------------------------------------------------

/**
 * Full detail of a computed heading duel — winner plus the dice/aerial values needed to
 * build a HEADER ActionEvent. Returned by `computeHeaderDuelDetail`.
 */
export type HeaderDuelDetail = {
  winner: 'home' | 'away' | null;
  attackerId: string | null;
  defenderId: string | null;
  attackerDie: number | null;
  attackerAerialAbility: number | null;
  attackerCombined: number | null;
  defenderDie: number | null;
  defenderAerialAbility: number | null;
  defenderCombined: number | null;
};

/**
 * Computes the heading duel winner AND the full dice/aerial detail from pre-generated dice,
 * without transitioning phase. Used by GAME_HEADER_CONTESTANT handler (D-03/Rule 1 fix) to
 * fire the duel when both teams confirm, store the result in headerDuelWinner, and emit a
 * HEADER ActionEvent for the contested-winner branch — while keeping phase = 'HEADER' so the
 * winning team can still select a target hex via GAME_HEADER_TARGET.
 *
 * `winner` is 'home' | 'away' or null when the duel is a tie (LOOSE_BALL path deferred to
 * GAME_HEADER_TARGET resolution).
 *
 * ARCH-01: dice must be pre-generated by the caller. This function is pure (no randomness).
 *
 * @param state - Current game state (phase must be 'HEADER')
 * @param dice  - Pre-generated dice array: [atk_0, atk_1, ..., def_0, def_1, ..., atkTie, defTie]
 */
export function computeHeaderDuelDetail(state: GameState, dice: number[]): HeaderDuelDetail {
  const defenderTeam: 'home' | 'away' = state.attackingTeam === 'home' ? 'away' : 'home';

  const attackerContestantIds: string[] =
    state.attackingTeam === 'home'
      ? (state.headerContestants?.home ?? [])
      : (state.headerContestants?.away ?? []);
  const defenderContestantIds: string[] =
    defenderTeam === 'home'
      ? (state.headerContestants?.home ?? [])
      : (state.headerContestants?.away ?? []);

  type CR = { piece: (typeof state.pieces)[number]; die: number; raw: number };

  const buildResults = (ids: string[], offset: number): CR[] =>
    ids
      .map((id, i) => {
        const piece = state.pieces.find((p) => p.id === id);
        if (!piece) return null;
        const die = dice[offset + i] ?? 3;
        return { piece, die, raw: computeCombinedScore(piece.aerialAbility, die, []) };
      })
      .filter((r): r is CR => r !== null);

  const pickWinner = (results: CR[], tieBreakerDie: number): CR | undefined => {
    if (results.length === 0) return undefined;
    const max = Math.max(...results.map((r) => r.raw));
    const tied = results.filter((r) => r.raw === max);
    return tied[(tieBreakerDie - 1) % tied.length];
  };

  const atkCount = attackerContestantIds.length;
  const attackerResults = buildResults(attackerContestantIds, 0);
  const defenderResults = buildResults(defenderContestantIds, atkCount);

  const atkTieDie = dice[atkCount + defenderContestantIds.length] ?? 1;
  const defTieDie = dice[atkCount + defenderContestantIds.length + 1] ?? 1;

  const attackerWinner = pickWinner(attackerResults, atkTieDie);
  const defenderWinner = pickWinner(defenderResults, defTieDie);

  const noDetail: HeaderDuelDetail = {
    winner: null,
    attackerId: null,
    defenderId: null,
    attackerDie: null,
    attackerAerialAbility: null,
    attackerCombined: null,
    defenderDie: null,
    defenderAerialAbility: null,
    defenderCombined: null,
  };

  // Neither team has a contestant — can't determine winner
  if (atkCount === 0 && defenderContestantIds.length === 0) return noDetail;

  // Only defender — defender wins uncontested (no dice detail; mirrors applyRoll HEADER (b-def))
  if (atkCount === 0 && defenderWinner !== undefined) {
    return { ...noDetail, winner: defenderTeam };
  }

  // Only attacker — attacker wins uncontested (no dice detail; mirrors applyRoll HEADER (b))
  if (defenderContestantIds.length === 0 || defenderWinner === undefined) {
    return { ...noDetail, winner: state.attackingTeam };
  }

  if (!attackerWinner) return { ...noDetail, winner: defenderTeam };

  // Contested: apply HEAD-01 distance penalty to attacker (mirrors applyRoll HEADER branch)
  const headResult = validateHeading(state, attackerWinner.piece, state.ball.position, {
    previousActionWasHeadedPass: false,
    otherChallengerIds: [defenderWinner.piece.id],
  });
  const penaltyMod = headResult.ok && headResult.contested ? headResult.penaltyModifier : 0;
  const adjustedAtk = computeCombinedScore(attackerWinner.piece.aerialAbility, attackerWinner.die, [
    penaltyMod,
  ]);
  const adjustedDef = computeCombinedScore(
    defenderWinner.piece.aerialAbility,
    defenderWinner.die,
    [],
  );

  const detailBase: HeaderDuelDetail = {
    winner: null,
    attackerId: attackerWinner.piece.id,
    defenderId: defenderWinner.piece.id,
    attackerDie: attackerWinner.die,
    attackerAerialAbility: attackerWinner.piece.aerialAbility,
    attackerCombined: adjustedAtk,
    defenderDie: defenderWinner.die,
    defenderAerialAbility: defenderWinner.piece.aerialAbility,
    defenderCombined: adjustedDef,
  };

  if (adjustedAtk > adjustedDef) return { ...detailBase, winner: state.attackingTeam };
  if (adjustedAtk < adjustedDef) return { ...detailBase, winner: defenderTeam };
  return { ...detailBase, winner: null }; // tie → LOOSE_BALL path (caller handles)
}

/**
 * Resolves the actual winning PIECE for a header duel, given the winning team.
 * Extracted from applyResolveHeaderTarget's step 3 as a standalone, reusable resolution
 * algorithm (originally shared with a pre-resolution offside short-circuit in the
 * GAME_HEADER_CONTESTANT handler under D-52 — since superseded by D-57, which checks
 * ALL nominated contestants for an offside flag BEFORE the duel is even resolved, so a
 * winner-only check here is no longer needed for that purpose. Kept as its own function
 * since applyResolveHeaderTarget still needs it to resolve the winning piece for target
 * validation, D-06).
 *
 * Mirrors `pickWinner` in `computeHeaderDuelWinner` — picks the highest-`aerialAbility`
 * contestant nominated by `winnerTeam`, not index [0] (which would ignore intra-team
 * tiebreaks when multiple contestants were nominated). Falls back to the current ball
 * carrier when `winnerTeam` nominated no contestant (uncontested case).
 */
export function resolveHeaderWinnerPiece(
  state: GameState,
  winnerTeam: 'home' | 'away',
): PlayerPiece | null {
  const winnerContestantIds =
    winnerTeam === 'home'
      ? (state.headerContestants?.home ?? [])
      : (state.headerContestants?.away ?? []);
  const winnerContestantId = winnerContestantIds.reduce<string | undefined>((bestId, id) => {
    const p = state.pieces.find((x) => x.id === id);
    const best = bestId ? state.pieces.find((x) => x.id === bestId) : undefined;
    return !p ? bestId : !best || p.aerialAbility > best.aerialAbility ? id : bestId;
  }, undefined);
  const winnerPiece = state.pieces.find((p) => p.id === winnerContestantId);

  // Fallback: if no contestant, use ball carrier (uncontested case)
  return winnerPiece ?? state.pieces.find((p) => p.id === state.ball.carrierId) ?? null;
}

// ---------------------------------------------------------------------------
// applyResolveHeaderTarget (RULE-02, Phase 11)
// ---------------------------------------------------------------------------

/**
 * Discriminated union result for applyResolveHeaderTarget.
 * RULE-02: validates target hex against winning contestant's position (D-06).
 */
export type ApplyResolveHeaderTargetResult =
  | { ok: false; reason: 'WRONG_PHASE' | 'DUEL_NOT_RESOLVED' | 'INVALID_TARGET' }
  | { ok: true; state: GameState };

/**
 * Resolves the header target hex selection after the duel winner is known (RULE-02, D-04–D-06).
 *
 * Called by GAME_HEADER_TARGET handler (Task 3) after the duel auto-fires in GAME_HEADER_CONTESTANT.
 * This function reads the pre-resolved `headerDuelWinner` and transitions to PASS or GK_DIVE
 * WITHOUT re-rolling dice — the duel already resolved in the handler.
 *
 * Guard sequence (fail-fast):
 * 1. WRONG_PHASE — phase must be 'HEADER'
 * 2. DUEL_NOT_RESOLVED — headerDuelWinner must be set
 * 3. INVALID_TARGET — targetHex must be within 6 hexes of the winning contestant's position (D-06)
 *
 * Transition routing mirrors the applyRoll HEADER branch (HEAD-03):
 * - If targetHex is a goal-line hex for the attacking team → GK_DIVING
 * - Otherwise → PASS with ball placed at targetHex and winner as carrier
 *
 * @param state     - Current game state (phase must be 'HEADER', headerDuelWinner must be set)
 * @param targetHex - The hex the winning team is heading toward
 */
export function applyResolveHeaderTarget(
  state: GameState,
  targetHex: HexCoord,
): ApplyResolveHeaderTargetResult {
  // 1. Phase guard
  if (state.phase !== 'HEADER') {
    return { ok: false, reason: 'WRONG_PHASE' };
  }

  // 2. Duel must already be resolved (RULE-02, D-04)
  if (!state.headerDuelWinner) {
    return { ok: false, reason: 'DUEL_NOT_RESOLVED' };
  }

  const winnerTeam = state.headerDuelWinner;

  // 3. Resolve the winning contestant's piece (D-04) via resolveHeaderWinnerPiece.
  const resolvedWinner = resolveHeaderWinnerPiece(state, winnerTeam);

  const referencePosition = resolvedWinner?.position ?? state.ball.position;

  // 4. D-06: validate targetHex within 6 hexes of the winning contestant's position
  if (hexDistance(referencePosition, targetHex) > 6) {
    return { ok: false, reason: 'INVALID_TARGET' };
  }

  const headerCleared = {
    headerContestants: null,
    headerConfirmed: null,
    headerTargetHex: null,
    headerAccuracyRollPending: null,
    headerDuelWinner: null,
    headerWinnerId: null,
  };

  // 5. Route to GK_DIVE if the target is a goal-line hex for the attacking team (HEAD-03)
  // Use winnerTeam (captured before headerCleared is constructed) as the effective attacker.
  // Re-reading state.headerDuelWinner here would be null after the headerCleared spread is applied.
  const goalQ = winnerTeam === 'home' ? 36 : 0;
  const isGoalLineTarget = targetHex.q === goalQ && targetHex.r >= 10 && targetHex.r <= 16;

  const defenderTeamForGk: 'home' | 'away' = winnerTeam === 'home' ? 'away' : 'home';
  const contestedIds = [
    ...(state.headerContestants?.home ?? []),
    ...(state.headerContestants?.away ?? []),
  ];

  if (isGoalLineTarget) {
    const gk = state.pieces.find((p) => p.teamId === defenderTeamForGk && p.role === 'GK');
    const winnerPos = resolvedWinner?.position ?? state.ball.position;
    const headerShotPath = hexLine(winnerPos, targetHex);
    return {
      ok: true,
      state: {
        ...state,
        phase: 'GK_DIVE',
        lastActionType: 'SHOT',
        ball: {
          position: winnerPos,
          carrierId: resolvedWinner?.id ?? null,
          lastTouchedBy: resolvedWinner
            ? { pieceId: resolvedWinner.id, teamId: resolvedWinner.teamId }
            : state.ball.lastTouchedBy,
        },
        shotTargetHex: targetHex,
        gkDivePosition: gk?.position ?? state.ball.position,
        lastShotPath: headerShotPath,
        contestedPieceIds: contestedIds,
        attackingTeam: winnerTeam,
        activeTeam: defenderTeamForGk,
        ...headerCleared,
      },
    };
  }

  // Not goal-line: check who (if anyone) occupies targetHex.
  // Winner piece stays at its original position — only the ball moves.
  const occupant = state.pieces.find(
    (p) => p.position.q === targetHex.q && p.position.r === targetHex.r,
  );

  const headedPassEvent: ActionEvent = {
    type: 'HEADED_PASS',
    passerId: resolvedWinner?.id ?? '',
    from: referencePosition,
    to: targetHex,
    ballAfter: { position: targetHex, carrierId: occupant?.id ?? null },
    timestamp: Date.now(),
  };

  if (occupant) {
    // A player is at targetHex — they receive the ball.
    // If it's a teammate: winnerTeam keeps attacking.
    // If it's an opponent: possession changes, that team now attacks.
    const receiverTeam = occupant.teamId;
    const occupantBall = {
      position: targetHex,
      carrierId: occupant.id,
      lastTouchedBy: { pieceId: occupant.id, teamId: occupant.teamId },
    };
    return {
      ok: true,
      state: {
        ...state,
        phase: 'PASS',
        attackingTeam: receiverTeam,
        activeTeam: receiverTeam,
        ball: occupantBall,
        lastActionType: 'HEADER',
        contestedPieceIds: contestedIds,
        stealAttemptedByIds: [],
        tackleAttemptedByIds: [],
        // Re-evaluate offside with current piece positions (post-HIGH_PASS_MOVE repositioning)
        // so triggerOffsideFoul in the handler works against fresh data — mirrors applyEndTurn.
        offsidePieceIds: evaluateOffside({
          ...state,
          attackingTeam: receiverTeam,
          ball: occupantBall,
        }),
        eventLog: [...state.eventLog, headedPassEvent],
        ...headerCleared,
        // Folded header-winner todo (2026-07-12-bug-header-winner-piece-ineligible-next-phase.md):
        // the header winner has already acted this turn — mark it spent for the next MOVE phase.
        movedPieceIds: resolvedWinner
          ? [...state.movedPieceIds, resolvedWinner.id]
          : state.movedPieceIds,
        // Plan 31-06 (BUG-31 family): applyStartMovement is the only PASS -> MOVE transition and
        // it unconditionally resets movedPieceIds, defeating the append above before the Movement
        // Phase begins. Carry the winner id through this dedicated field so applyStartMovement can
        // merge it back in.
        carriedMovedPieceIds: resolvedWinner
          ? [resolvedWinner.id]
          : (state.carriedMovedPieceIds ?? []),
      },
    };
  }

  // Empty hex: loose ball — go to PASS (carrierId=null) so the ActionPanel shows the
  // "Loose Ball — Move" gate. The player must explicitly start movement, matching the
  // regular loose-ball UX (standard pass landing on empty hex).
  // Empty hex: the header winner touched the ball last, even though nobody carries it now.
  const looseBall = {
    position: targetHex,
    carrierId: null,
    lastTouchedBy: resolvedWinner
      ? { pieceId: resolvedWinner.id, teamId: resolvedWinner.teamId }
      : state.ball.lastTouchedBy,
  };
  return {
    ok: true,
    state: {
      ...state,
      phase: 'PASS',
      attackingTeam: winnerTeam,
      activeTeam: winnerTeam,
      ball: looseBall,
      lastActionType: 'HEADER',
      contestedPieceIds: contestedIds,
      stealAttemptedByIds: [],
      tackleAttemptedByIds: [],
      // Re-evaluate offside with current piece positions (post-HIGH_PASS_MOVE repositioning).
      offsidePieceIds: evaluateOffside({ ...state, attackingTeam: winnerTeam, ball: looseBall }),
      eventLog: [...state.eventLog, headedPassEvent],
      ...headerCleared,
      // Folded header-winner todo (2026-07-12-bug-header-winner-piece-ineligible-next-phase.md):
      // the header winner has already acted this turn — mark it spent for the next MOVE phase.
      movedPieceIds: resolvedWinner
        ? [...state.movedPieceIds, resolvedWinner.id]
        : state.movedPieceIds,
      // Plan 31-06 (BUG-31 family): applyStartMovement is the only PASS -> MOVE transition and
      // it unconditionally resets movedPieceIds, defeating the append above before the Movement
      // Phase begins. Carry the winner id through this dedicated field so applyStartMovement can
      // merge it back in.
      carriedMovedPieceIds: resolvedWinner
        ? [resolvedWinner.id]
        : (state.carriedMovedPieceIds ?? []),
    },
  };
}

// ---------------------------------------------------------------------------
// computeShotPathDeflection (D-03 pure helper)
// ---------------------------------------------------------------------------

/**
 * Defender-set types for shot path deflection (D-03).
 * Set A = defenders on the shot path (hexLine); Set B = defenders within 1 hex of path but not on it.
 */
export type DefenderDeflectionInput = {
  /** Piece ID of the deflecting defender. */
  defenderId: string;
  /** Position of the defending piece. */
  defenderPosition: HexCoord;
  /** Pre-generated die value for this defender's deflection attempt. */
  die: number;
  /** Tackling attribute of the defending piece. */
  tackling: number;
  /** Whether this defender is in-path (Set A) or adjacent-to-path (Set B). */
  band: 'A' | 'B';
};

/**
 * Result of the shot path deflection step.
 * If a deflection occurs, returns the deflecting defender's position for Loose Ball.
 * If no deflection, returns null — caller proceeds to shooter-vs-GK duel.
 */
export type ShotPathDeflectionResult =
  | { deflected: true; deflectorPosition: HexCoord; deflectorId: string }
  | { deflected: false };

/**
 * Computes the shot path deflection step for regular shot resolution (D-03).
 *
 * Evaluates each defender in input order; first deflection wins.
 *
 * Deflection thresholds (D-03):
 * - Set A (in-path):            die === 5 || die === 6 || (die + tackling >= 10)
 * - Set B (within 1 hex path):  die === 6             || (die + tackling >= 10)
 *
 * T-10-07: Dice are injected — this function does NOT call rollDice/Math.random.
 *
 * D-13 (HEAD-03): Headed goal attempts skip this step entirely — only GK contests.
 *
 * @param defenders - Ordered list of defenders with pre-generated dice (handler provides)
 */
export function computeShotPathDeflection(
  defenders: DefenderDeflectionInput[],
): ShotPathDeflectionResult {
  for (const def of defenders) {
    const deflects =
      def.band === 'A'
        ? def.die === 5 || def.die === 6 || def.die + def.tackling >= 10
        : def.die === 6 || def.die + def.tackling >= 10;

    if (deflects) {
      return {
        deflected: true,
        deflectorPosition: def.defenderPosition,
        deflectorId: def.defenderId,
      };
    }
  }
  return { deflected: false };
}

// ---------------------------------------------------------------------------
// applyDeclareShot
// ---------------------------------------------------------------------------

/**
 * Discriminated union result for applyDeclareShot.
 * T-10-05/T-10-06: goal hex is server-re-validated; never trust client coordinates.
 */
export type ApplyDeclareShotResult =
  | { ok: false; reason: 'WRONG_PHASE' | 'INVALID_SEQUENCE' | 'INVALID_TARGET' }
  | { ok: true; state: GameState };

/**
 * Transitions the FSM from PASS → GK_DIVE after the shooter declares a goal hex.
 *
 * D-01/D-02: Two-step shot flow: shooter clicks goal hex → server validates and
 * enters GK_DIVE so the GK's team can reposition before auto-resolution.
 * D-05: shotTargetHex recorded for event log; not consumed by dice resolution.
 *
 * Guard sequence (fail-fast):
 * 1. WRONG_PHASE — phase must be 'PASS'
 * 2. INVALID_SEQUENCE — SHOT must be in ELIGIBLE_NEXT_ACTIONS[lastActionType]
 * 3. INVALID_TARGET — goalHex must be a goal-line hex for attackingTeam
 *    (q=36, r∈[10..16] for home; q=0, r∈[10..16] for away) — A1 assumption
 *
 * T-10-06: PITCH_HEXES membership and goal-line bounds checked server-side.
 *
 * @param state    - Current game state (phase must be 'PASS')
 * @param goalHex  - The goal hex the shooter is targeting
 */
export function applyDeclareShot(state: GameState, goalHex: HexCoord): ApplyDeclareShotResult {
  // 1. Phase guard
  if (state.phase !== 'PASS' && state.phase !== 'SNAPSHOT_TARGET') {
    return { ok: false, reason: 'WRONG_PHASE' };
  }

  // Goal-line hex validation (T-10-05 / A1 assumption: r∈[10..16] at goal q)
  // Home attacks toward away goal (q=36); away attacks toward home goal (q=0).
  const goalQ = state.attackingTeam === 'home' ? 36 : 0;
  if (goalHex.q !== goalQ || goalHex.r < 10 || goalHex.r > 16) {
    return { ok: false, reason: 'INVALID_TARGET' };
  }

  const defendingTeam: 'home' | 'away' = state.attackingTeam === 'home' ? 'away' : 'home';

  // SNAPSHOT_TARGET from snapshot context: set target then give defender deflection move
  if (state.phase === 'SNAPSHOT_TARGET') {
    const snapShooter = state.pieces.find((p) => p.id === state.ball.carrierId);
    if (!snapShooter || hexDistance(snapShooter.position, goalHex) > 6) {
      return { ok: false, reason: 'INVALID_TARGET' };
    }
    const snapShotPath = hexLine(snapShooter.position, goalHex);
    return {
      ok: true,
      state: {
        ...state,
        phase: 'SNAPSHOT_DEFLECT',
        shotTargetHex: goalHex,
        activeTeam: defendingTeam, // defender's turn to deflect
        snapDeflectMovedPieceId: null,
        snapDeflectPaceUsed: 0,
        lastShotPath: snapShotPath,
        // BUG-18 (Phase 18.3): clear lastDiceRoll on SNAPSHOT_DEFLECT entry so
        // canUndo is not blocked by a stale dice value from the accuracy check.
        lastDiceRoll: null,
      },
    };
  }

  // 2. Sequence guard: SHOT must be eligible from the current lastActionType (PASS phase only)
  if (state.lastActionType !== null) {
    const eligible = ELIGIBLE_NEXT_ACTIONS[state.lastActionType];
    if (!eligible.has('SHOT')) {
      return { ok: false, reason: 'INVALID_SEQUENCE' };
    }
  }

  // Find the defending GK (role:'GK' on the non-attacking team)
  const gk = state.pieces.find((p) => p.teamId === defendingTeam && p.role === 'GK');
  if (!gk) {
    return { ok: false, reason: 'INVALID_TARGET' };
  }

  // D-02: Transition directly to GK_DIVE (single hop rather than SNAPSHOT_TARGET + GK_DIVE).
  // Records shotTargetHex and seeds gkDivePosition from GK's current position.
  // Set lastShotPath immediately so both clients see the trajectory before GK dives.
  const shooter = state.pieces.find((p) => p.id === state.ball.carrierId);

  // D-09: regular shot range gate — goal hex must be within 11 hexes of the shooter.
  if (!shooter || hexDistance(shooter.position, goalHex) > 11) {
    return { ok: false, reason: 'INVALID_TARGET' };
  }

  const earlyPath = hexLine(shooter.position, goalHex);
  return {
    ok: true,
    state: {
      ...state,
      phase: 'GK_DIVE',
      lastActionType: 'SHOT', // marks that a shot was declared
      shotTargetHex: goalHex,
      gkDivePosition: gk.position, // GK's starting position — used as cumulative dive reference
      lastShotPath: earlyPath,
    },
  };
}

// ---------------------------------------------------------------------------
// applyGKDive
// ---------------------------------------------------------------------------

/**
 * Discriminated union result for applyGKDive.
 * T-10-06: all GK dive coordinates are re-validated server-side.
 */
export type ApplyGKDiveResult =
  | { ok: false; reason: 'WRONG_PHASE' | 'NOT_ON_PATH' | 'TOO_FAR' | 'OFF_PITCH' }
  | { ok: true; state: GameState };

/**
 * Repositions the GK during the GK_DIVE interactive phase.
 *
 * D-04 / SHOT-04: GK may dive to any hex on the shot path within 3 hexes of their piece position.
 * Diving 3 hexes: -1 Saving penalty applied at resolution time via validateGKDive.
 * GK out-of-range (no reachable path hex) is handled upstream at GAME_SHOT time — not here.
 *
 * Guard sequence (fail-fast):
 * 1. WRONG_PHASE — phase must be 'GK_DIVE'
 * 2. NOT_ON_PATH — `to` must be on hexLine(shooter.position, shotTargetHex)
 * 3. TOO_FAR — hexDistance from GK's piece position to `to` must be ≤ 3
 * 4. OFF_PITCH — `to` must be a valid pitch hex (isPitchHex)
 *
 * @param state - Current game state (phase must be 'GK_DIVE')
 * @param to    - Target hex for the GK dive
 */
export function applyGKDive(state: GameState, to: HexCoord): ApplyGKDiveResult {
  // 1. Phase guard
  if (state.phase !== 'GK_DIVE') {
    return { ok: false, reason: 'WRONG_PHASE' };
  }

  // Find the defending GK
  const defendingTeam: 'home' | 'away' = state.attackingTeam === 'home' ? 'away' : 'home';
  const gk = state.pieces.find((p) => p.teamId === defendingTeam && p.role === 'GK');
  if (!gk) {
    return { ok: false, reason: 'WRONG_PHASE' };
  }

  // 2. Shot-path membership: GK may only dive to a hex on the shot trajectory.
  // For a regular shot ball.carrierId is the shooter; for a header-at-goal it is null
  // (ball was in the air) — fall back to ball.position as the shot origin.
  const shotTarget = state.shotTargetHex;
  if (!shotTarget) {
    return { ok: false, reason: 'WRONG_PHASE' };
  }
  const shooterPiece = state.ball.carrierId
    ? state.pieces.find((p) => p.id === state.ball.carrierId)
    : null;
  const shotOrigin = shooterPiece?.position ?? state.ball.position;
  const pathHexes = hexLine(shotOrigin, shotTarget);
  if (!pathHexes.some((h) => h.q === to.q && h.r === to.r)) {
    return { ok: false, reason: 'NOT_ON_PATH' };
  }

  // 3. Distance guard: GK can dive at most 3 hexes from their piece position.
  const cumulativeDistance = hexDistance(gk.position, to);
  if (cumulativeDistance > 3) {
    return { ok: false, reason: 'TOO_FAR' };
  }

  // 4. Pitch boundary guard (T-10-06)
  if (!isPitchHex(to)) {
    return { ok: false, reason: 'OFF_PITCH' };
  }

  // Update gkDivePosition to the new position
  return {
    ok: true,
    state: {
      ...state,
      gkDivePosition: to,
    },
  };
}

// ---------------------------------------------------------------------------
// applyKickOffReady
// ---------------------------------------------------------------------------

/**
 * Discriminated union result for applyKickOffReady.
 * MATCH-03: validates kick-off setup placement rules for one team.
 */
export type ApplyKickOffReadyResult =
  | {
      ok: false;
      reason: 'WRONG_PHASE' | 'CENTRE_HEX_EMPTY' | 'OUT_OF_ZONE' | 'IN_CENTRE_CIRCLE';
    }
  | { ok: true; state: GameState };

/**
 * Validates a team's kick-off setup placement and records them as ready.
 *
 * MATCH-03 / D-23 / D-24 / D-25: Server-side placement rule enforcement.
 * Returns ok:true with state unchanged — the both-ready → KICK_OFF transition
 * is owned by the handler (via Room.readyPlayers per Pattern 4 in PATTERNS.md).
 *
 * Guard sequence (fail-fast):
 * 1. WRONG_PHASE — phase must be 'KICK_OFF_SETUP'
 * 2. OUT_OF_ZONE — all of team's pieces must be in team's own half
 * 3. CENTRE_HEX_EMPTY — attacking team must have exactly one piece on kickOffHex {q:18,r:13}
 * 4. IN_CENTRE_CIRCLE — defending team must have no piece inside the centre circle
 *
 * Half boundaries (D-23):
 *   home (attackingTeam='home'): own half = q <= 18 (kickOffHex.q)
 *   away (attackingTeam='away'): own half = q >= 18 (kickOffHex.q)
 *
 * T-08-06 (Tampering): All placement checks are server-side; client zone tinting is UX-only.
 *
 * @param state - Current game state (phase must be KICK_OFF_SETUP)
 * @param team  - Which team's placement to validate ('home' | 'away')
 */
export function applyKickOffReady(
  state: GameState,
  team: 'home' | 'away',
): ApplyKickOffReadyResult {
  // 1. Phase guard
  if (state.phase !== 'KICK_OFF_SETUP') {
    return { ok: false, reason: 'WRONG_PHASE' };
  }

  const kickOffHex = PITCH_REGIONS.kickOffHex; // {q:18, r:13}
  const teamPieces = state.pieces.filter((p) => p.teamId === team);
  const isAttacking = team === state.attackingTeam;

  // 2. OUT_OF_ZONE: attacking team must stay in their own half (up to and including q=18).
  // The defending team has no half-boundary restriction at kick-off; they are only restricted
  // from the centre circle (rule 4 below). Applying OUT_OF_ZONE to defenders was asymmetric
  // and incorrectly rejected defending-away pieces at q=18 (WR-02).
  if (isAttacking) {
    for (const piece of teamPieces) {
      if (team === 'home') {
        if (piece.position.q > kickOffHex.q) return { ok: false, reason: 'OUT_OF_ZONE' };
      } else {
        if (piece.position.q < kickOffHex.q) return { ok: false, reason: 'OUT_OF_ZONE' };
      }
    }
  }

  if (isAttacking) {
    // 3. CENTRE_HEX_EMPTY: attacking team must have exactly one piece on kickOffHex (D-25)
    const onCentreHex = teamPieces.some(
      (p) => p.position.q === kickOffHex.q && p.position.r === kickOffHex.r,
    );
    if (!onCentreHex) {
      return { ok: false, reason: 'CENTRE_HEX_EMPTY' };
    }
  } else {
    // 4. IN_CENTRE_CIRCLE: defending team must have no piece inside the centre circle (D-23)
    for (const piece of teamPieces) {
      if (isInRegion(piece.position, 'centreCircle')) {
        return { ok: false, reason: 'IN_CENTRE_CIRCLE' };
      }
    }
  }

  // All placement rules satisfied — return ok:true with state unchanged.
  // The handler (08-04) tracks both-ready via Room.readyPlayers and triggers KICK_OFF transition.
  return { ok: true, state };
}

// ---------------------------------------------------------------------------
// applyOffsideFoulWithRelocation (D-53 — auto-relocate trapped defenders)
// ---------------------------------------------------------------------------

/**
 * D-59 (BUG FIX — supersedes D-53's offender exclusion + refines the relocation target
 * algorithm): the OWN goal-line hex set for `team` — the goal that team DEFENDS, the
 * OPPOSITE of `goalQ`'s "goal a team attacks/shoots at" convention used elsewhere (e.g.
 * `applyDeclareShot`'s `goalQ = attackingTeam === 'home' ? 36 : 0`). Home defends q=0,
 * away defends q=36; both use r∈[10..16] (the same goal-line R range used throughout).
 */
function ownGoalLineHexes(team: 'home' | 'away'): HexCoord[] {
  const ownGoalQ = team === 'home' ? 0 : 36;
  const hexes: HexCoord[] = [];
  for (let r = 10; r <= 16; r++) {
    hexes.push({ q: ownGoalQ, r });
  }
  return hexes;
}

/**
 * D-53 (Free Kick Setup — Round 2 Corrections), refined by D-59 (BUG FIX — see below):
 * server-side wrapper around the shared `triggerOffsideFoul` (packages/shared/src/offside.ts).
 * `offside.ts` is an environment-agnostic pure-helpers module with zero Node-only imports
 * (no `crypto`) — this relocation needs `crypto.randomInt` (never `Math.random`, mirroring
 * the `attackingTeam` coin-flip pattern in `createInitialState` above), so the relocation
 * step lives here, server-side, rather than inside `triggerOffsideFoul` itself. This
 * keeps `offside.ts` importable from the client bundle without a Node polyfill.
 *
 * ALL six `triggerOffsideFoul` call sites in gameHandlers.ts route through this wrapper
 * instead of calling the shared function directly, so the relocation always happens as
 * part of the SAME foul-trigger transition, before stage 0 ever becomes interactive to
 * either team.
 *
 * Behavior: calls `triggerOffsideFoul(state, explicitOffenderId)`. If the foul actually
 * fired (phase became 'FREE_KICK_SETUP' — referential/phase check, since a no-op returns
 * `state` unchanged), finds every CONCEDING-team piece (the team that conceded the foul —
 * i.e. NOT `freeKickAttackingTeam`) within 2 hexes of the new `freeKickHex` — INCLUDING the
 * offender themselves (D-59) — and relocates each, one at a time. Processing one piece at
 * a time and accumulating an occupied-hex set (every OTHER piece's position + any
 * already-relocated piece's NEW position) ensures no two relocated pieces ever collide.
 * This is a one-time relocation at the moment the foul triggers, not an ongoing
 * correction — the defending team may freely move any of these (or other) pieces during
 * their own subsequent stages.
 *
 * D-59 (BUG FIX — game-stalling bug, supersedes D-53's offender exclusion): D-53 originally
 * excluded the offender from this relocation sweep, reasoning that the foul spot IS the
 * offender's position (D-27) and relocating them would "displace the historical foul-spot
 * marker." This was wrong and stalled the game: the offender is a CONCEDING-team piece
 * sitting at distance 0 from `freeKickHex` (trivially within 2), and the KICKING team must
 * place one of their OWN pieces on that exact same hex (D-31/D-54) — so long as the
 * offender remains there, the kicking team can never legally complete the mandatory
 * kicker-first placement (rejected with OCCUPIED at the gameHandlers.ts level), and the
 * game gets permanently stuck. The offender is now included in the same relocation sweep
 * as every other trapped piece — nothing occupies `freeKickHex` once this transition
 * completes (the ball itself stays there per D-27 — only pieces move).
 *
 * D-59 also refines the per-piece relocation TARGET algorithm (applies to every relocated
 * piece, offender included): instead of going straight to a uniformly-random `>=3`-hexes-
 * away pick, first try the 4 hexes at EXACTLY distance 3 from `freeKickHex` that are
 * closest to the relocating piece's OWN goal line (the goal that piece's team defends —
 * see `ownGoalLineHexes` above), tried in closest-first order, skipping any that are
 * occupied (by another piece's current position, or an earlier relocation in this same
 * pass). Falls back to D-53's original uniformly-random `>=3` selection only when all 4
 * preferred hexes are unavailable. This keeps relocated defenders tactically sensible
 * (pushed back toward their own goal) instead of scattering them randomly by default.
 *
 * @param state              - Current game state (pre-foul)
 * @param explicitOffenderId - Optional named-offender id (D-41) — forwarded unchanged
 */
export function applyOffsideFoulWithRelocation(
  state: GameState,
  explicitOffenderId?: string,
): GameState {
  const afterFoul = triggerOffsideFoul(state, explicitOffenderId);

  // No-op: the foul didn't fire (offender not flagged, or no ball-carrier on the
  // implicit path) — triggerOffsideFoul returns `state` unchanged in that case.
  if (afterFoul.phase !== 'FREE_KICK_SETUP' || !afterFoul.freeKickHex) {
    return afterFoul;
  }

  const freeKickHex = afterFoul.freeKickHex;
  const concedingTeam: 'home' | 'away' =
    afterFoul.freeKickAttackingTeam === 'home' ? 'away' : 'home';

  // D-59: the offender is NO LONGER excluded — every conceding-team piece within 2 hexes
  // of freeKickHex is trapped, including the offender (always at distance 0).
  const trappedIds = afterFoul.pieces
    .filter((p) => p.teamId === concedingTeam && hexDistance(p.position, freeKickHex) <= 2)
    .map((p) => p.id);

  if (trappedIds.length === 0) {
    return afterFoul;
  }

  // Occupied-hex set: starts with every piece's CURRENT position (string-keyed for O(1)
  // structural-equality checks — PITCH-02 convention, never Array.includes on HexCoord).
  const hexKey = (h: HexCoord): string => `${h.q},${h.r}`;
  const occupied = new Set(afterFoul.pieces.map((p) => hexKey(p.position)));

  // Ring-3 candidates (D-59): all on-pitch hexes at EXACTLY distance 3 from freeKickHex.
  // Computed once — the occupancy filter is re-applied per piece below since the occupied
  // set mutates across iterations.
  const ring3Hexes = PITCH_HEXES.filter((h) => isPitchHex(h) && hexDistance(h, freeKickHex) === 3);

  let pieces = afterFoul.pieces;
  for (const pieceId of trappedIds) {
    const piece = pieces.find((p) => p.id === pieceId);
    if (!piece) continue; // defensive

    // Free this piece's OWN current hex before picking its destination — it's about to
    // vacate it, and a single trapped piece must not be blocked from candidacy by itself.
    occupied.delete(hexKey(piece.position));

    // D-59: prefer the 4 ring-3 hexes closest to this piece's OWN goal line, closest-first,
    // skipping any currently occupied.
    const ownGoalHexes = ownGoalLineHexes(piece.teamId);
    const preferredOrder = [...ring3Hexes].sort((a, b) => {
      const distA = Math.min(...ownGoalHexes.map((g) => hexDistance(a, g)));
      const distB = Math.min(...ownGoalHexes.map((g) => hexDistance(b, g)));
      return distA - distB;
    });
    const preferredCandidates = preferredOrder.slice(0, 4).filter((h) => !occupied.has(hexKey(h)));

    let destination: HexCoord | undefined = preferredCandidates[0];

    if (!destination) {
      // Fallback: D-53's original behavior — random unoccupied on-pitch hex >=3 away.
      const fallbackCandidates = PITCH_HEXES.filter(
        (h) => isPitchHex(h) && hexDistance(h, freeKickHex) >= 3 && !occupied.has(hexKey(h)),
      );

      if (fallbackCandidates.length === 0) {
        // Defensive: no legal destination exists (should not happen on a 962-hex pitch
        // with only 22 pieces) — leave this piece in place rather than crash.
        occupied.add(hexKey(piece.position));
        continue;
      }

      destination = fallbackCandidates[randomInt(0, fallbackCandidates.length)]!;
    }

    pieces = pieces.map((p) => (p.id === pieceId ? { ...p, position: destination } : p));
    occupied.add(hexKey(destination));
  }

  return { ...afterFoul, pieces };
}

// ---------------------------------------------------------------------------
// applyFreeKickMove (OFFSIDE-02, D-49 staged rework)
// ---------------------------------------------------------------------------

/** Discriminated union result for applyFreeKickMove. */
export type ApplyFreeKickMoveResult =
  | {
      ok: false;
      reason:
        | 'WRONG_PHASE'
        | 'WRONG_TEAM'
        | 'PLACEMENT_LIMIT_REACHED'
        | 'KICKER_NOT_YET_PLACED'
        | 'PIECE_LOCKED'
        // Plan 25-06: kicker-select sub-step error codes.
        | 'WRONG_PIECE' // non-kicking-team piece selected during kicker-select sub-step
        | 'KICKER_PLACEMENT_REQUIRED'; // destination is not freeKickHex during kicker-select
    }
  | { ok: true; state: GameState };

/**
 * Repositions a single piece during the active FREE_KICK_SETUP stage (D-49, D-54).
 *
 * Guard sequence (fail-fast):
 * 1. WRONG_PHASE — phase must be FREE_KICK_SETUP with a valid freeKickHex/stageIndex
 * 2. WRONG_TEAM — `pieceId` must belong to the CURRENTLY-active stage's team
 *    (resolved via `freeKickStageTeam(stageIndex, freeKickAttackingTeam)`)
 * 3. PIECE_LOCKED — `pieceId` must not already be in `movedPieceIds` (D-54/D-56: the
 *    kicker is locked the instant it lands on `freeKickHex`; any piece locked in at a
 *    prior stage's end is permanently locked for the rest of free-kick setup).
 * 4. KICKER_NOT_YET_PLACED (D-54, stage 0 / kicking-team side only — supersedes the old
 *    D-51 end-of-stage-2 check): until a kicking-team piece is on `freeKickHex`, the ONLY
 *    legal move for the kicking team is moving a piece ONTO `freeKickHex`. Any attempt to
 *    move a piece to a DIFFERENT hex while no kicking-team piece is yet on `freeKickHex`
 *    is rejected — there is no other legal move available until the kicker is placed.
 *    This guard only applies on the kicking team's stages (0 and 2); the defending team's
 *    stages are never gated on the kicker.
 * 5. PLACEMENT_LIMIT_REACHED — if `pieceId` is not already in `freeKickPlacedPieceIds`
 *    AND the set's size already equals the current stage's `max`, reject. Re-placing an
 *    already-counted piece is always allowed (free, doesn't consume another slot). The
 *    kicker-placement move itself (guard 4's destination) never reaches this check — it
 *    short-circuits to a dedicated success branch that doesn't touch the budget (D-54:
 *    kicker placement does NOT consume any of the stage's "up to N" budget).
 *
 * Destination legality (D-29/D-30 — UNCHANGED from the prior simultaneous model):
 * kicking-team stages have no restriction; defending-team stages must stay >2 hexes from
 * `freeKickHex` — checked here for early feedback, and authoritatively re-checked at
 * stage-end (applyFreeKickStageEnd) regardless of this check's outcome.
 *
 * On success (general budget path): repositions the piece and, if newly counted this
 * stage, adds its id to `freeKickPlacedPieceIds`.
 * On success (kicker-placement path, D-54): repositions the piece onto `freeKickHex` and
 * adds its id directly to `movedPieceIds` (NOT `freeKickPlacedPieceIds`) — permanently
 * locked, doesn't consume the budget, and immediately renders as 'activated' via the
 * existing generic `movedPieceIds.includes(piece.id)` mechanism (no new client code).
 *
 * @param state   - Current game state (phase must be FREE_KICK_SETUP)
 * @param pieceId - ID of the piece to reposition
 * @param to      - Destination hex coordinate
 */
export function applyFreeKickMove(
  state: GameState,
  pieceId: string,
  to: HexCoord,
): ApplyFreeKickMoveResult {
  const stageIndex = state.freeKickStageIndex;
  const freeKickHex = state.freeKickHex;
  const kickingTeam = state.freeKickAttackingTeam;
  if (
    state.phase !== 'FREE_KICK_SETUP' ||
    !freeKickHex ||
    stageIndex === null ||
    stageIndex === undefined ||
    !kickingTeam
  ) {
    return { ok: false, reason: 'WRONG_PHASE' };
  }

  const piece = state.pieces.find((p) => p.id === pieceId);
  if (!piece) {
    return { ok: false, reason: 'WRONG_TEAM' };
  }

  // Plan 25-06: kicker-select sub-step — fires when freeKickKickerChosen is explicitly false
  // (the kicking-team must place their kicker on freeKickHex before any other setup moves).
  // When freeKickKickerChosen is true or null/undefined (states created before this fix,
  // treated as already chosen), the existing stage-gated placement logic runs unchanged.
  if (state.freeKickKickerChosen === false) {
    // Only kicking-team pieces may be selected during kicker-select.
    if (piece.teamId !== kickingTeam) {
      return { ok: false, reason: 'WRONG_PIECE' };
    }
    // Destination must be freeKickHex.
    if (to.q !== freeKickHex.q || to.r !== freeKickHex.r) {
      return { ok: false, reason: 'KICKER_PLACEMENT_REQUIRED' };
    }
    // Valid kicker placement: move piece to freeKickHex, emit FK_KICKER_CHOSEN event,
    // set freeKickKickerChosen: true, lock kicker in movedPieceIds (D-54 — permanent,
    // doesn't consume the stage budget).
    const newPieces = state.pieces.map((p) => (p.id === pieceId ? { ...p, position: to } : p));
    const kickerChosenEvent: ActionEvent = {
      type: 'FK_KICKER_CHOSEN',
      kickerPieceId: pieceId,
      hex: freeKickHex,
      timestamp: Date.now(),
    };
    // Emit FK_SETUP_MOVE AFTER FK_KICKER_CHOSEN so applyUndo can find and reverse
    // the kicker placement. FK_KICKER_CHOSEN acts as the undo boundary; the
    // FK_SETUP_MOVE sits after it and is the target of the Undo operation.
    const kickerMoveEvent: ActionEvent = {
      type: 'FK_SETUP_MOVE',
      stageIndex: stageIndex ?? 0,
      pieceId,
      from: piece.position,
      to,
      timestamp: Date.now(),
    };
    return {
      ok: true,
      state: {
        ...state,
        pieces: newPieces,
        movedPieceIds: [...state.movedPieceIds, pieceId],
        freeKickKickerChosen: true,
        eventLog: [...state.eventLog, kickerChosenEvent, kickerMoveEvent],
      },
    };
  }

  const stage = FREE_KICK_STAGES[stageIndex];
  const activeTeamForStage = freeKickStageTeam(stageIndex, kickingTeam);
  if (piece.teamId !== activeTeamForStage) {
    return { ok: false, reason: 'WRONG_TEAM' };
  }

  const movedIds = state.movedPieceIds;
  if (movedIds.includes(pieceId)) {
    // D-54/D-56: permanently locked — either the kicker (locked on placement) or a piece
    // locked in at the end of a prior stage. Never selectable/movable again.
    return { ok: false, reason: 'PIECE_LOCKED' };
  }

  // D-54: mandatory kicker-first placement — kicking-team stages only (0 and 2).
  // With freeKickKickerChosen now tracked explicitly, this guard is a no-op when
  // freeKickKickerChosen === true (kicker already placed via the kicker-select sub-step above).
  // For backward-compat states where freeKickKickerChosen is null/undefined, the original
  // hex-scan check still fires as a fallback.
  if (stage.side === 'kicking') {
    const kickerAlreadyPlaced =
      state.freeKickKickerChosen === true ||
      state.pieces.some(
        (p) =>
          p.teamId === kickingTeam &&
          p.position.q === freeKickHex.q &&
          p.position.r === freeKickHex.r,
      );
    if (!kickerAlreadyPlaced) {
      const movingOntoFreeKickHex = to.q === freeKickHex.q && to.r === freeKickHex.r;
      if (!movingOntoFreeKickHex) {
        return { ok: false, reason: 'KICKER_NOT_YET_PLACED' };
      }
      // Kicker placement fallback (backward compat — freeKickKickerChosen is null/undefined):
      // doesn't consume the stage budget — locks directly into movedPieceIds.
      const newPieces = state.pieces.map((p) => (p.id === pieceId ? { ...p, position: to } : p));
      // BUG-18 (Phase 18.3): log FK_SETUP_MOVE so applyUndo can reverse kicker placement.
      const kickerPlaceEvent: ActionEvent = {
        type: 'FK_SETUP_MOVE',
        stageIndex: stageIndex ?? 0,
        pieceId,
        from: piece.position,
        to,
        timestamp: Date.now(),
      };
      return {
        ok: true,
        state: {
          ...state,
          pieces: newPieces,
          movedPieceIds: [...movedIds, pieceId],
          eventLog: [...state.eventLog, kickerPlaceEvent],
        },
      };
    }
  }

  const placedIds = state.freeKickPlacedPieceIds ?? [];
  const alreadyCounted = placedIds.includes(pieceId);
  if (!alreadyCounted && placedIds.length >= stage.max) {
    return { ok: false, reason: 'PLACEMENT_LIMIT_REACHED' };
  }

  const newPieces = state.pieces.map((p) => (p.id === pieceId ? { ...p, position: to } : p));
  const newPlacedIds = alreadyCounted ? placedIds : [...placedIds, pieceId];
  // BUG-18 (Phase 18.3): log FK_SETUP_MOVE so applyUndo can reverse regular placement.
  const fkSetupMoveEvent: ActionEvent = {
    type: 'FK_SETUP_MOVE',
    stageIndex: stageIndex ?? 0,
    pieceId,
    from: piece.position,
    to,
    timestamp: Date.now(),
  };

  return {
    ok: true,
    state: {
      ...state,
      pieces: newPieces,
      freeKickPlacedPieceIds: newPlacedIds,
      eventLog: [...state.eventLog, fkSetupMoveEvent],
    },
  };
}

// ---------------------------------------------------------------------------
// applyFreeKickReady / applyFreeKickStageEnd (OFFSIDE-02, D-49/D-50/D-51 staged rework)
// ---------------------------------------------------------------------------

/**
 * Discriminated union result for applyFreeKickReady.
 * OFFSIDE-02 (D-49 staged rework): validates and applies a stage-end attempt for one team.
 */
export type ApplyFreeKickReadyResult =
  | {
      ok: false;
      // D-54 (supersedes D-51): KICKER_HEX_EMPTY removed — the kicker-placed requirement
      // is now enforced up front in applyFreeKickMove (KICKER_NOT_YET_PLACED), not at
      // stage-end.
      reason: 'WRONG_PHASE' | 'NOT_YOUR_STAGE' | 'DEFENDER_TOO_CLOSE';
    }
  | { ok: true; state: GameState };

/**
 * Ends the CURRENTLY-active free-kick repositioning stage for `team` (D-49 staged rework
 * — replaces the prior simultaneous both-Ready handshake entirely; `applyFreeKickReady`'s
 * name is kept since `GAME_FREE_KICK_READY` still means "I'm done with my stage," but the
 * semantics are now single-team-at-a-time, not dual-confirm).
 *
 * Guard sequence (fail-fast):
 * 1. WRONG_PHASE — phase must be 'FREE_KICK_SETUP' with valid freeKickHex/stageIndex
 * 2. NOT_YOUR_STAGE — `team` must be the CURRENTLY-active stage's team (resolved via
 *    `freeKickStageTeam`); an inactive team's stage-end attempt is rejected. This is the
 *    new reason literal replacing the dual-Ready handshake — only the active team's
 *    confirm is meaningful now.
 * 3. DEFENDER_TOO_CLOSE — when ending one of the DEFENDING team's stages (index 1 or 3),
 *    the team must have no piece within 2 hexes of `freeKickHex` (D-30/D-50 — authoritative,
 *    continuous check at the end of EACH defending stage, regardless of any move-time check).
 *
 * D-54 (supersedes D-51): the KICKER_HEX_EMPTY check formerly here (validated at the end
 * of the kicking team's LAST stage, index 2) is REMOVED — the kicker-on-freeKickHex
 * requirement is now enforced up front, as a mandatory first move in stage 0, by
 * `applyFreeKickMove`'s KICKER_NOT_YET_PLACED guard. By the time a kicking-team stage can
 * ever end, a kicking-team piece is already permanently locked on `freeKickHex` (added to
 * `movedPieceIds` at placement time) — there is nothing left to validate here.
 *
 * On success:
 * - stageIndex < 3: advances to stageIndex + 1. D-56: merges the CURRENT stage's
 *   `freeKickPlacedPieceIds` into `movedPieceIds` (locking them in as 'activated' for the
 *   rest of free-kick setup) BEFORE resetting `freeKickPlacedPieceIds` to `[]` for the
 *   next stage.
 * - stageIndex === 3 (last stage): finalizes the kick — transitions to PASS with the
 *   kicking-team piece on freeKickHex assigned as ball carrier, attackingTeam/activeTeam
 *   set to the kicking team, lastActionType: 'FREE_KICK_RESTART', offsidePieceIds: []
 *   (D-47/D-43), clears freeKickHex/freeKickAttackingTeam/freeKickStageIndex/
 *   freeKickPlacedPieceIds to null, and clears `movedPieceIds: []` (D-56: movedPieceIds is
 *   otherwise a MOVEMENT-phase-scoped field and should start clean for the subsequent
 *   PASS phase — leftover free-kick-setup activation state must not bleed forward).
 *
 * @param state - Current game state (phase must be FREE_KICK_SETUP)
 * @param team  - The team attempting to end its current stage ('home' | 'away')
 */
export function applyFreeKickReady(
  state: GameState,
  team: 'home' | 'away',
): ApplyFreeKickReadyResult {
  // 1. Phase guard
  const stageIndex = state.freeKickStageIndex;
  const freeKickHex = state.freeKickHex;
  const kickingTeam = state.freeKickAttackingTeam;
  if (
    state.phase !== 'FREE_KICK_SETUP' ||
    !freeKickHex ||
    stageIndex === null ||
    stageIndex === undefined ||
    !kickingTeam
  ) {
    return { ok: false, reason: 'WRONG_PHASE' };
  }

  // 2. NOT_YOUR_STAGE: only the currently-active stage's team may end it.
  const activeTeamForStage = freeKickStageTeam(stageIndex, kickingTeam);
  if (team !== activeTeamForStage) {
    return { ok: false, reason: 'NOT_YOUR_STAGE' };
  }

  const stage = FREE_KICK_STAGES[stageIndex];
  const teamPieces = state.pieces.filter((p) => p.teamId === team);

  if (stage.side === 'defending') {
    // 3. DEFENDER_TOO_CLOSE: D-30/D-50 — checked continuously, at the end of EACH
    //    defending stage (index 1 and 3), not just once.
    for (const piece of teamPieces) {
      if (hexDistance(piece.position, freeKickHex) <= 2) {
        return { ok: false, reason: 'DEFENDER_TOO_CLOSE' };
      }
    }
  }

  // D-56: merge this stage's freeKickPlacedPieceIds into movedPieceIds — locks them in
  // as 'activated' for the rest of free-kick setup (the green "moved this stage" ring
  // naturally stops applying once freeKickPlacedPieceIds resets to [] below).
  const stagePlacedIds = state.freeKickPlacedPieceIds ?? [];
  const mergedMovedPieceIds = Array.from(new Set([...state.movedPieceIds, ...stagePlacedIds]));

  // All checks passed for this stage — advance or finalize.
  if (stageIndex < 3) {
    // Plan 25-06: emit FK_STAGE_ADVANCE as a stage boundary event so applyUndo
    // cannot reach across stage boundaries (FK_STAGE_ADVANCE acts as a slot boundary).
    const stageAdvanceEvent: ActionEvent = {
      type: 'FK_STAGE_ADVANCE',
      fromStageIndex: stageIndex as 0 | 1 | 2,
      timestamp: Date.now(),
    };
    return {
      ok: true,
      state: {
        ...state,
        freeKickStageIndex: (stageIndex + 1) as 0 | 1 | 2 | 3,
        // Plan 25-06: reset kicker-select flag for stage 2 (kicking team again) so the
        // client can detect we're back in "regular placement" mode.  The kicker is already
        // locked in movedPieceIds from stage 0, so the kicker-select sub-step does not
        // re-fire — freeKickKickerChosen stays true after stage 0.
        eventLog: [...state.eventLog, stageAdvanceEvent],
        freeKickPlacedPieceIds: [],
        movedPieceIds: mergedMovedPieceIds,
      },
    };
  }

  // stageIndex === 3: last stage — finalize the kick.
  const kicker = state.pieces.find(
    (p) =>
      p.teamId === kickingTeam && p.position.q === freeKickHex.q && p.position.r === freeKickHex.r,
  );
  return {
    ok: true,
    state: {
      ...state,
      phase: 'PASS',
      ball: kicker
        ? {
            position: kicker.position,
            carrierId: kicker.id,
            lastTouchedBy: { pieceId: kicker.id, teamId: kicker.teamId },
          }
        : state.ball,
      attackingTeam: kickingTeam,
      activeTeam: kickingTeam,
      lastActionType: 'FREE_KICK_RESTART',
      freeKickHex: null,
      freeKickAttackingTeam: null,
      freeKickStageIndex: null,
      freeKickPlacedPieceIds: null,
      // Plan 25-06: clear kicker-select flag on exit.
      freeKickKickerChosen: null,
      // D-43/D-47: a major dead-ball restart clears ALL offside flags, not just the
      // original offender's.
      offsidePieceIds: [],
      // D-56: movedPieceIds is otherwise a MOVEMENT-phase-scoped field — clear it here so
      // leftover free-kick-setup activation state (including the locked kicker) doesn't
      // bleed into the subsequent PASS phase.
      movedPieceIds: [],
    },
  };
}

// ---------------------------------------------------------------------------
// applyHalfTimeStart
// ---------------------------------------------------------------------------

/**
 * Discriminated union result for applyHalfTimeStart.
 * MATCH-04: second-half transition from HALF_TIME.
 */
export type ApplyHalfTimeStartResult =
  | { ok: false; reason: 'WRONG_PHASE' }
  | { ok: true; state: GameState };

/**
 * Transitions the FSM from HALF_TIME to KICK_OFF_SETUP for the second half.
 *
 * MATCH-04 / D-26 / D-28 / D-29: Second-half start procedure.
 *
 * Resets applied:
 * - attackingTeam = opposite of kickOffTeam (D-26: opposing team kicks off second half)
 * - half = 2 (D-29)
 * - actionCount = 45 (D-29: clock starts at 45 for the second half)
 * - addedTime = null (D-29)
 * - phase = 'KICK_OFF_SETUP' (D-10: begins repositioning before second-half kick-off)
 * - lastActionType = null (D-10: fresh action sequence at kick-off)
 * - pieces = 3-2-4-1 formation starting positions from teams.ts (Pitfall 6 reset; "4-5-2" is the movement sequence, not the formation)
 *
 * The handler (08-04) enforces that only the non-kick-off team can trigger this.
 *
 * @param state - Current game state (phase must be HALF_TIME)
 */
export function applyHalfTimeStart(state: GameState): ApplyHalfTimeStartResult {
  // Phase guard
  if (state.phase !== 'HALF_TIME') {
    return { ok: false, reason: 'WRONG_PHASE' };
  }

  // D-26: second half kick-off by the team that did NOT kick off in the first half
  const newAttackingTeam: 'home' | 'away' = state.kickOffTeam === 'home' ? 'away' : 'home';

  // Reset pieces to formation starting positions using selectedTeams (Phase 16, Pitfall 6; "4-5-2" = movement sequence)
  const resetPieces = buildKickOffPieces(
    newAttackingTeam,
    state.selectedTeams,
    state.selectedFormation,
  );

  // D-02 (same defect class as BUG-30): this atomic piece-formation reset previously had no
  // ActionEvent to hang replay reconstruction on, so buildReplayFrames could never show it —
  // the second-half replay would carry forward stale first-half final positions indefinitely.
  const halfTimeResetEvent: ActionEvent = {
    type: 'HALF_TIME_KICKOFF_RESET' as const,
    piecesAfter: resetPieces,
    ballAfter: { position: PITCH_REGIONS.kickOffHex, carrierId: null },
    timestamp: Date.now(),
  };

  return {
    ok: true,
    state: {
      ...state,
      phase: 'KICK_OFF_SETUP', // D-10: setup before second-half kick-off
      attackingTeam: newAttackingTeam, // D-26
      activeTeam: newAttackingTeam,
      half: 2, // D-29
      actionCount: 45, // D-29: second half clock starts at 45
      addedTime: null, // D-29
      lastActionType: null, // D-10: fresh sequence
      kickOffActive: false,
      movedPieceIds: [],
      paceUsedByPieceId: {},
      movementSlot: null,
      pieces: resetPieces, // Pitfall 6: reset to formation starting positions
      ball: { position: PITCH_REGIONS.kickOffHex, carrierId: null, lastTouchedBy: null }, // reset ball to centre hex — half-time reset, fresh state
      lastDiceRoll: null,
      lastShotPath: null, // clear any residual shot path from first half
      offsidePieceIds: [], // clear stale first-half offside flags
      // MOVE-06 (Phase 17, corrected design D-33): kick-off hex is in middleThird —
      // ballZone resets to 'middle' for the fresh second-half kick-off.
      ballZone: 'middle',
      eventLog: [...state.eventLog, halfTimeResetEvent], // D-02
    },
  };
}

// ---------------------------------------------------------------------------
// buildReplayFrames
// ---------------------------------------------------------------------------

/** Non-SLOT_ADVANCE event types that produce replay frames (D-32). */
const REPLAY_ELIGIBLE_TYPES = new Set<string>([
  'MOVE',
  'DICE_ROLL',
  'STEAL_ATTEMPT',
  'TACKLE_ATTEMPT',
  'GOAL',
  // D-02: second-half kickoff formation reset (same defect class as BUG-30/GOAL).
  'HALF_TIME_KICKOFF_RESET',
  'KICK_OFF',
  'HIGH_PASS',
  'LONG_BALL',
  'STANDARD_PASS',
  'FIRST_TIME_PASS',
  'SHOT_ATTEMPT',
  'SNAPSHOT',
  'HALF_TIME',
  'FULL_TIME',
  // REPLAY-06 (18.1-01, Pitfall 4): HEADED_PASS and GK_PUNT added with ballAfter populated.
  // HEADER is intentionally excluded (carries no ballAfter by design).
  'HEADED_PASS',
  'GK_PUNT',
  // REPLAY-07: GK_KICK ball delivery — carries ballAfter (position: targetHex, carrierId:
  // receiver.id | null); construction at gameHandlers.ts ~line 823.
  'GK_KICK',
  // REPLAY-08: LOOSE_BALL_LAND scatter resolution — carries ballAfter (position: finalPosition,
  // carrierId: finalCarrierId | null); construction at gameEngine.ts ~line 2754.
  'LOOSE_BALL_LAND',
  // BUG-17 (Phase 18.3): kick-off formation repositioning. Handled like MOVE (piece
  // repositioning, no ball change). buildReplayFrames treats it as a MOVE-like event.
  'KICK_OFF_SETUP',
  // Phase 37 (37-02): out-of-bounds/throw-in/goal-kick events that carry ballAfter.
  // GOAL_KICK_MOVE, GOAL_KICK_CHOICE, and GOAL_KICK_WINDOW_ADVANCE are deliberately
  // excluded — they carry no ballAfter, matching the existing GK_KICK_MOVE exclusion.
  'OUT_OF_BOUNDS',
  'THROW_IN_PLACE',
  'GOAL_KICK',
  // Phase 38 (38-04): corner-kick events that carry ballAfter. CORNER_KICK_STAGE_ADVANCE,
  // CORNER_KICK_GK_PLACE and CORNER_KICK_MOVE are deliberately excluded — none carry
  // ballAfter, matching the existing GOAL_KICK_MOVE exclusion above.
  // WR-01 (38-12, gap closure): CORNER_KICK_GK_PLACE and CORNER_KICK_MOVE remain excluded
  // from this eligible set (still emit no frame of their own) but are now piece-position-
  // tracked (current.pieces updated directly, not via moveGroup — see the event-loop branch
  // below for why), so a goalkeeper/player who repositions no longer teleports back to a
  // stale hex on every subsequent frame.
  'CORNER_KICK_TAKER_PLACED',
  'CORNER_KICK_ACCURACY',
]);

/**
 * Reconstructs a sequence of GameState frames from the event log for replay.
 *
 * REPLAY-02 / REPLAY-03 / D-31 / D-32: Deterministic state reconstruction.
 *
 * - Starts from buildInitialGameState seeded with finalState.kickOffTeam and roomCode.
 * - Iterates finalState.eventLog.
 * - Emits a snapshot GameState frame (with phase='REPLAY') for each replay-eligible event.
 * - Skips SLOT_ADVANCE events — they produce no board change and no frame (D-32).
 * - Pure function: no setInterval here — the handler (08-04) owns timing.
 * - Deterministic: same eventLog always yields identical frame sequence (REPLAY-03).
 *
 * Implementation note (A2 from RESEARCH.md):
 * Rather than re-running full engine transitions (which would require injecting dice
 * from the eventLog — complex and fragile), we reconstruct the visible board state
 * incrementally by applying MOVE events (repositioning pieces) and resetting on GOAL/KICK_OFF.
 * DICE_ROLL, STEAL_ATTEMPT, and other events carry their result in the eventLog for display.
 * This matches the replay goal: showing board state changes, not re-simulating dice.
 *
 * @param finalState - The final (FULL_TIME or later) game state containing the complete eventLog.
 * @returns Array of GameState frames — one per replay-eligible event, all tagged phase='REPLAY'.
 */
export function buildReplayFrames(finalState: GameState): GameState[] {
  const frames: GameState[] = [];

  // Seed the reconstruction from the initial game state using the same kickOffTeam assignment.
  // We override the coin-flip by using a deterministic seed approach:
  // buildInitialGameState uses randomInt for attackingTeam, so we cannot call it directly
  // and expect determinism. Instead, we build a seeded initial state manually.
  // A2 (RESEARCH.md): kickOffTeam is recorded in finalState; use it to seed the initial attackingTeam.
  // Phase 16: use buildKickOffPieces with finalState.selectedTeams for correct squad positions.
  let current: GameState = {
    roomCode: finalState.roomCode,
    phase: 'KICK_OFF',
    activeTeam: finalState.kickOffTeam,
    attackingTeam: finalState.kickOffTeam,
    pieces: buildKickOffPieces(
      finalState.kickOffTeam,
      finalState.selectedTeams,
      finalState.selectedFormation,
    ),
    ball: { position: PITCH_REGIONS.kickOffHex, carrierId: null, lastTouchedBy: null }, // fresh replay seed state — nobody has touched the ball yet
    score: { home: 0, away: 0 },
    actionCount: 0,
    half: 1,
    eventLog: [],
    refereeCard: finalState.refereeCard,
    movedPieceIds: [],
    paceUsedByPieceId: {},
    movementSlot: null,
    // MOVE-06 (Phase 17, corrected design D-33): kick-off hex is in middleThird.
    ballZone: 'middle',
    addedTime: null,
    lastActionType: null,
    kickOffTeam: finalState.kickOffTeam,
    kickOffActive: false,
    selectedTeams: finalState.selectedTeams, // D-15: carry team selection into replay frames
    selectedUniformStyles: finalState.selectedUniformStyles, // Phase 22 D-17: carry uniform styles into replay frames
    gameSpeed: finalState.gameSpeed, // UX-07 (Phase 18.4): carry speed into replay frames
    outOfBoundsEnabled: finalState.outOfBoundsEnabled ?? false, // GOALKICK-06 / OOB-05 (Phase 37): carry the toggle into replay frames
  };

  // REPLAY-05: accumulate consecutive MOVE events per pieceId so an entire movement phase
  // replays as K simultaneous step-frames (K = max steps any piece took in the phase).
  // A piece with fewer than K steps holds its final hex on the remaining step-frames.
  type MoveStep = { to: HexCoord; ballAfter: { position: HexCoord; carrierId: string | null } };
  const moveGroup = new Map<string, MoveStep[]>();

  function flushMoveGroup() {
    if (moveGroup.size === 0) return;
    const paths = [...moveGroup.entries()];
    let K = 0;
    for (const [, steps] of paths) {
      if (steps.length > K) K = steps.length;
    }
    let stepBall = current.ball;
    for (let n = 1; n <= K; n++) {
      const steppedPieces = current.pieces.map((p) => {
        const path = moveGroup.get(p.id);
        if (!path) return p;
        const stepIdx = Math.min(n, path.length) - 1;
        return { ...p, position: path[stepIdx]!.to };
      });
      // Apply ballAfter from pieces that actually step at tick n.
      // Prefer the ball-carrier's ballAfter to avoid overwriting with a non-carrier's value
      // when two pieces have unequal path lengths (CR-02: insertion-order last-writer bias fix).
      let ballUpdated = false;
      for (const [, path] of paths) {
        if (n <= path.length) {
          const candidate = path[n - 1]!.ballAfter;
          // prefer carrier's ballAfter; otherwise accept any piece that stepped at this tick
          if (!ballUpdated || candidate.carrierId !== null) {
            // Replay reconstruction does not need per-step toucher fidelity (D-06 exemption,
            // Task 2 plan note) — carry the existing lastTouchedBy forward unchanged.
            stepBall = { ...candidate, lastTouchedBy: current.ball.lastTouchedBy };
            ballUpdated = true;
          }
        }
      }
      frames.push({
        ...current,
        pieces: steppedPieces,
        ball: stepBall,
        phase: 'REPLAY',
        score: { ...current.score },
      });
    }
    // Commit final piece positions and ball state into current for subsequent events
    const finalPieces = current.pieces.map((p) => {
      const path = moveGroup.get(p.id);
      if (!path) return p;
      return { ...p, position: path[path.length - 1]!.to };
    });
    current = { ...current, pieces: finalPieces, ball: stepBall };
    moveGroup.clear();
  }

  for (const event of finalState.eventLog) {
    // SLOT_ADVANCE and DEFLECT_ATTEMPT events produce no standalone board change — skip.
    // SLOT_ADVANCE: internal FSM transition, no visual change (D-32).
    // DEFLECT_ATTEMPT: recorded during shot handling; not in REPLAY_ELIGIBLE_TYPES and must
    //   not trigger a premature flushMoveGroup when it appears mid-movement-group (WR-03).
    // Phase 37 (37-02): GOAL_KICK_WINDOW_ADVANCE/GOAL_KICK_CHOICE/GOAL_KICK_MOVE carry no
    //   ballAfter and must not prematurely flush an in-progress move group (same WR-03
    //   rationale as DEFLECT_ATTEMPT above).
    if (
      event.type === 'SLOT_ADVANCE' ||
      event.type === 'DEFLECT_ATTEMPT' ||
      event.type === 'GOAL_KICK_WINDOW_ADVANCE' ||
      event.type === 'GOAL_KICK_CHOICE' ||
      event.type === 'GOAL_KICK_MOVE'
    ) {
      continue;
    }

    if (event.type === 'MOVE') {
      // Accumulate into moveGroup for batched simultaneous step-frame emit (REPLAY-05)
      const existing = moveGroup.get(event.pieceId) ?? [];
      existing.push({ to: event.to, ballAfter: event.ballAfter });
      moveGroup.set(event.pieceId, existing);
      continue;
    }

    // BUG-17 (Phase 18.3): KICK_OFF_SETUP repositioning — treated like MOVE (piece reposition,
    // no ball movement since the ball stays at centre hex during pre-kick-off formation).
    // Accumulate in moveGroup so consecutive repositions animate as batched step-frames.
    if (event.type === 'KICK_OFF_SETUP') {
      const existing = moveGroup.get(event.pieceId) ?? [];
      existing.push({ to: event.to, ballAfter: current.ball }); // ball unchanged
      moveGroup.set(event.pieceId, existing);
      continue;
    }

    // THROWIN-02 (Phase 37, 37-02): thrower placement — mirrors the KICK_OFF_SETUP branch
    // immediately above so the thrower's placement animates like a move.
    if (event.type === 'THROW_IN_PLACE') {
      const existing = moveGroup.get(event.pieceId) ?? [];
      existing.push({ to: event.to, ballAfter: event.ballAfter });
      moveGroup.set(event.pieceId, existing);
      continue;
    }

    // CORNER-02 (Phase 38, 38-04): corner-taker placement — byte-for-byte the THROW_IN_PLACE
    // shape (pieceId, to, ballAfter), so it animates the same way (piece walks to the corner
    // flag as the ball moves with them).
    if (event.type === 'CORNER_KICK_TAKER_PLACED') {
      const existing = moveGroup.get(event.pieceId) ?? [];
      existing.push({ to: event.to, ballAfter: event.ballAfter });
      moveGroup.set(event.pieceId, existing);
      continue;
    }

    // WR-01 (38-12, gap closure): CORNER_KICK_GK_PLACE (either corner GK reposition window)
    // and CORNER_KICK_MOVE (CORNER_KICK_FINAL_SETUP pre-kick reposition) update `current.pieces`
    // directly rather than accumulating into `moveGroup`. This is a deliberate departure from
    // the KICK_OFF_SETUP/THROW_IN_PLACE/CORNER_KICK_TAKER_PLACED arms above: those three types
    // are all members of REPLAY_ELIGIBLE_TYPES, so `flushMoveGroup()` unconditionally emitting a
    // frame per accumulated step is correct for them. CORNER_KICK_GK_PLACE/CORNER_KICK_MOVE are
    // deliberately NOT in REPLAY_ELIGIBLE_TYPES — routing them through `moveGroup` would still
    // produce a frame the next time the group flushes (flushMoveGroup pushes a frame for every
    // pending step regardless of the originating event's eligibility), violating "emits no frame
    // of its own" and regressing the existing test asserting a log of only
    // CORNER_KICK_STAGE_ADVANCE/CORNER_KICK_GK_PLACE/CORNER_KICK_MOVE produces zero frames.
    // Mutating `current.pieces` here (like the GOAL/HALF_TIME_KICKOFF_RESET/KICK_OFF board-
    // mutation branches below) keeps the position correction visible to every later frame —
    // whether that frame comes from a still-in-progress `moveGroup` flush (which reads
    // `current.pieces` as its base for untouched pieces) or from a later REPLAY_ELIGIBLE_TYPES
    // event — without ever pushing a frame itself and without touching `current.ball` or
    // flushing an in-progress `moveGroup`.
    if (event.type === 'CORNER_KICK_GK_PLACE' || event.type === 'CORNER_KICK_MOVE') {
      current = {
        ...current,
        pieces: current.pieces.map((p) =>
          p.id === event.pieceId ? { ...p, position: event.to } : p,
        ),
      };
      continue;
    }

    // Non-MOVE, non-SLOT_ADVANCE event: flush accumulated movement phase before handling
    flushMoveGroup();

    // Apply board mutations
    if (event.type === 'GOAL') {
      // Score increment — ball position is updated via universal ballAfter below
      const newScore = {
        ...current.score,
        [event.scoringTeam]: current.score[event.scoringTeam] + 1,
      };
      current = { ...current, score: newScore };
      // D-01 (BUG-30): reconstruct every piece at the new kickoff formation, the same way
      // ballAfter is applied universally below. Optional — construction sites that don't
      // populate it (see types.ts comment) leave pieces unchanged, same as before this fix.
      if (event.piecesAfter) {
        current = { ...current, pieces: event.piecesAfter };
      }
    } else if (event.type === 'HALF_TIME_KICKOFF_RESET') {
      // D-02: reconstruct every piece at the second-half kickoff formation.
      current = { ...current, pieces: event.piecesAfter };
    } else if (event.type === 'KICK_OFF') {
      current = { ...current, movementSlot: 'ATTACKER_4' };
    }

    // Universal ball position update — driven by ballAfter on replay-eligible events (REPLAY-06)
    // ballAfter is deliberately NOT widened to carry lastTouchedBy (Task 2 plan note: replay
    // reconstruction does not need toucher fidelity) — carry the existing value forward.
    if ('ballAfter' in event) {
      current = {
        ...current,
        ball: { ...event.ballAfter, lastTouchedBy: current.ball.lastTouchedBy },
      };
    }

    if (REPLAY_ELIGIBLE_TYPES.has(event.type)) {
      frames.push({
        ...current,
        phase: 'REPLAY',
        score: { ...current.score },
      });
    }
  }

  // Final flush if the log ends with MOVE events
  flushMoveGroup();

  return frames;
}
