import type { GameState, PlayerPiece } from './types.js';
import { PITCH_REGIONS } from './pitch.js';

/**
 * OFFSIDE-01 (D-21..D-24): pure, team-relative offside geometry helpers.
 *
 * Mirrors the existing half-boundary convention used by kick-off enforcement
 * (gameEngine.ts applyKickOffReady): home attacks toward higher q, away attacks
 * toward lower q, and `OFFSIDE_HALFWAY_Q` (the kickOffHex column, q=18) is the
 * half-field boundary — fixed across both halves.
 *
 * All helpers are pure (no I/O, no side effects) and unit-testable in isolation
 * from the FSM wiring that calls `evaluateOffside` at end-of-phase transitions
 * (gameEngine.ts applyEndTurn / applyFreeMoveEnd).
 */

/** Half-field boundary column — mirrors the kick-off centre hex's q coordinate. */
export const OFFSIDE_HALFWAY_Q = PITCH_REGIONS.kickOffHex.q;

/**
 * D-49 (rulebook correction): fixed, alternating free-kick repositioning stage sequence.
 * Index = `state.freeKickStageIndex`. `side` resolves to the actual team via
 * `state.freeKickAttackingTeam` ('kicking') or its opposite ('defending') — see
 * `freeKickStageTeam` below. `max` is the per-stage cap on DISTINCT NEW pieces touched
 * this stage (re-placing an already-counted piece is always free).
 *
 * Rulebook text (verbatim, quoted by the user from the physical rulebook):
 *   "Attacking team picks up and places 5 players. (4 for any field player, 1 spot for goalie)
 *    Defending team picks up and places 5 players. (4 for any field player, 1 spot for goalie)
 *    Attacking team picks up and places 3 players.
 *    Defending team picks up and places 2 players."
 *
 * Plan 25-06 correction: Stage 0 (kicking) and Stage 1 (defending) max reduced from 5 to 4.
 * The "1 spot for goalie" from the rulebook text is the kicker — a dedicated prior step
 * (freeKickKickerChosen sub-step) places the kicker on freeKickHex outside the budget.
 * The 4-move stage covers only field-player repositioning. Stage 2 and 3 are unchanged.
 */
export const FREE_KICK_STAGES = [
  { side: 'kicking', max: 4 },
  { side: 'defending', max: 4 },
  { side: 'kicking', max: 3 },
  { side: 'defending', max: 2 },
] as const;

/**
 * D-49: resolves the actual team ('home' | 'away') acting in a given free-kick stage,
 * given the team awarded the kick (`freeKickAttackingTeam`).
 */
export function freeKickStageTeam(
  stageIndex: 0 | 1 | 2 | 3,
  freeKickAttackingTeam: 'home' | 'away',
): 'home' | 'away' {
  const stage = FREE_KICK_STAGES[stageIndex];
  if (stage.side === 'kicking') return freeKickAttackingTeam;
  return freeKickAttackingTeam === 'home' ? 'away' : 'home';
}

/**
 * D-24: direction multiplier for a team's attacking direction along the q-axis.
 * home attacks toward higher q (+1); away attacks toward lower q (-1).
 */
export function attackingDirection(team: 'home' | 'away'): 1 | -1 {
  return team === 'home' ? 1 : -1;
}

/**
 * D-21 condition 1: true when `piece` is strictly past the half-field line in its
 * own team's attacking direction. Exactly on the halfway column (q===18) is NOT past.
 */
export function isPastHalfway(piece: PlayerPiece, team: 'home' | 'away'): boolean {
  const dir = attackingDirection(team);
  return (piece.position.q - OFFSIDE_HALFWAY_Q) * dir > 0;
}

/**
 * Generic "is `aheadQ` strictly ahead of `refQ` in `team`'s attacking direction" check.
 * Used both for "piece ahead of ball" (D-21 condition 2) and internally for opposing-
 * piece counting (D-21 condition 3 / D-24).
 */
export function isAheadOf(aheadQ: number, refQ: number, team: 'home' | 'away'): boolean {
  const dir = attackingDirection(team);
  return (aheadQ - refQ) * dir > 0;
}

/**
 * D-21 condition 3 / D-24: counts OTHER-team pieces (any role, GK included) positioned
 * equal-to-or-ahead of `piece` in `piece`'s own team's attacking direction.
 * "Equal-or-ahead" is the logical negation of "strictly behind" — i.e. NOT
 * isAheadOf(piece.q, opp.q, team) when checked from the opponent's q relative to piece's q.
 */
export function opposingPiecesEqualOrAhead(state: GameState, piece: PlayerPiece): number {
  const dir = attackingDirection(piece.teamId);
  return state.pieces.filter((opp) => {
    if (opp.teamId === piece.teamId) return false;
    // Equal-or-ahead in piece's attacking direction: (opp.q - piece.q) * dir >= 0
    return (opp.position.q - piece.position.q) * dir >= 0;
  }).length;
}

/**
 * D-21: true iff ALL three trigger conditions hold for `piece` right now:
 * (1) past halfway, (2) strictly ahead of the ball, (3) <=1 opposing piece equal-or-ahead.
 */
export function isOffsideNow(state: GameState, piece: PlayerPiece): boolean {
  const team = piece.teamId;
  const pastHalfway = isPastHalfway(piece, team);
  const aheadOfBall = isAheadOf(piece.position.q, state.ball.position.q, team);
  const opposingCount = opposingPiecesEqualOrAhead(state, piece);
  return pastHalfway && aheadOfBall && opposingCount <= 1;
}

/**
 * D-22: true iff the clear condition holds — the logical complement of D-21's
 * conditions 2 and 3 (condition 1, past-halfway, is irrelevant to clearing: D-22 is
 * "equal-or-behind ball OR >=2 opposing equal-or-ahead", independent of halfway status).
 *
 * D-40 (correction, 2026-06-20): the ball-position clear (D-22 condition (a),
 * equal-or-behind ball) only applies when the ball is in possession
 * (`state.ball.carrierId !== null`) by either team. While the ball is loose
 * (`carrierId === null`), ONLY the opposing-count clear (condition (b), >=2 opposing
 * equal-or-ahead) can clear a flag — a loose/bouncing ball's position cannot reprieve
 * an offside player via position alone. This does NOT affect `isOffsideNow`'s trigger
 * condition (D-21 condition 2, "ahead of the ball"), which still uses raw ball position
 * regardless of possession — only the clear/reset side gets this added guard.
 */
export function isClearedNow(state: GameState, piece: PlayerPiece): boolean {
  const team = piece.teamId;
  const opposingCount = opposingPiecesEqualOrAhead(state, piece);
  if (opposingCount >= 2) return true;
  // D-40: the ball-position clear only applies when the ball is possessed — a loose
  // ball cannot reprieve an offside flag via position alone.
  if (state.ball.carrierId === null) return false;
  const aheadOfBall = isAheadOf(piece.position.q, state.ball.position.q, team);
  return !aheadOfBall;
}

/**
 * D-23: returns the next sticky `offsidePieceIds` set — keeps already-flagged ids
 * unless `isClearedNow`, and adds every piece where `isOffsideNow` holds right now.
 * Order: stable, deduplicated (existing flagged ids first, in their existing order,
 * followed by any newly-flagged ids not already present).
 */
export function evaluateOffside(state: GameState): readonly string[] {
  const priorFlagged = state.offsidePieceIds ?? [];
  const piecesById = new Map(state.pieces.map((p) => [p.id, p] as const));

  const stillFlagged = priorFlagged.filter((id) => {
    const piece = piecesById.get(id);
    if (!piece) return false; // defensive: piece no longer exists
    return !isClearedNow(state, piece);
  });

  const newlyFlagged = state.pieces
    .filter((p) => !stillFlagged.includes(p.id) && isOffsideNow(state, p))
    .map((p) => p.id);

  return [...stillFlagged, ...newlyFlagged];
}

/**
 * OFFSIDE-02: transforms a possession-gain (or ball-touch, D-41) state into the
 * FREE_KICK_SETUP restart when the relevant offender is flagged offside.
 *
 * Two entry points (D-26 implicit, D-41 explicit):
 *
 * - **Implicit (no `explicitOffenderId`):** candidate offender is `state.ball.carrierId`.
 *   Only fires when the ball is actually possessed (`carrierId !== null`) AND that piece
 *   is in `state.offsidePieceIds`. This is the original D-26 "gains possession" trigger —
 *   covers any pass pickup, loose-ball pickup, won header, successful steal, or successful
 *   tackle (all of these always leave the acting/winning piece as the new ball carrier).
 * - **Explicit (`explicitOffenderId` provided):** candidate offender is the named piece id,
 *   regardless of `state.ball.carrierId` (which may be null — e.g. a shot deflection that
 *   intentionally leaves the ball loose). This is the D-41 extension: the foul also fires
 *   when a flagged-offside player REDIRECTS the ball during a contest (header, deflection,
 *   steal, tackle) even if the action doesn't end with that player in clean possession.
 *   The `state.ball.carrierId !== null` guard is skipped on this path — the caller already
 *   knows who touched the ball even though the ball itself ends up carrierless.
 *
 * On fire: transitions to FREE_KICK_SETUP with `freeKickHex` = offender's CURRENT position
 * (D-27 — the foul spot is the offender's position at the moment of the foul, not the
 * ball's position, so this generalizes cleanly to the explicit-offender/loose-ball case
 * with no special-casing), `freeKickAttackingTeam` = the non-offending team (D-28),
 * `attackingTeam`/`activeTeam` = that team, ball loose at the foul spot, the offender
 * removed from `offsidePieceIds` (the foul resolves that piece's offside state; any other
 * flagged pieces persist), and the D-49 staged-repositioning sequence initialized at
 * stage 0 (`freeKickStageIndex: 0`, `freeKickPlacedPieceIds: []`).
 *
 * When the candidate offender is not flagged (or, on the implicit path, the ball isn't
 * possessed) — returns `state` unchanged (referential identity).
 */
export function triggerOffsideFoul(state: GameState, explicitOffenderId?: string): GameState {
  const offenderId = explicitOffenderId ?? state.ball.carrierId;
  if (explicitOffenderId === undefined && state.ball.carrierId === null) {
    return state;
  }
  if (offenderId === null || offenderId === undefined) {
    return state;
  }

  const flagged = state.offsidePieceIds ?? [];
  if (!flagged.includes(offenderId)) {
    return state;
  }

  const offender = state.pieces.find((p) => p.id === offenderId);
  if (!offender) {
    return state;
  }

  const otherTeam: 'home' | 'away' = offender.teamId === 'home' ? 'away' : 'home';

  return {
    ...state,
    phase: 'FREE_KICK_SETUP',
    freeKickHex: offender.position,
    freeKickAttackingTeam: otherTeam,
    attackingTeam: otherTeam,
    activeTeam: otherTeam,
    ball: { position: offender.position, carrierId: null },
    offsidePieceIds: flagged.filter((id) => id !== offenderId),
    // D-49: staged repositioning sequence starts at stage 0 (kicking team, up to 5).
    freeKickStageIndex: 0,
    freeKickPlacedPieceIds: [],
    // D-54/D-56: movedPieceIds is repurposed during free-kick setup to permanently lock
    // the kicker (D-54) and each stage's placed pieces (D-56) using the SAME generic
    // 'activated' rendering mechanism MOVEMENT/MOVE-06 already use. Since the foul can
    // fire mid-MOVEMENT-phase (carrying stale movedPieceIds from whatever phase preceded
    // it), reset to [] on entry so free-kick setup always starts with a clean lock state.
    movedPieceIds: [],
    // BUG-18 (Phase 18.3): clear lastDiceRoll on FREE_KICK_SETUP entry so canUndo's
    // guard (`if (lastDiceRoll) return false`) does not block Undo in this phase.
    lastDiceRoll: null,
  };
}
