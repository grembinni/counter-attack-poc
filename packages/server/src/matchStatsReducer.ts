import type { ActionEvent, MatchStats, PlayerPiece } from '@counter-attack/shared';
import { EMPTY_MATCH_STATS } from '@counter-attack/shared';

/**
 * Phase 45 Plan 03 (STATS-04, STATS-05, STATS-06, STATS-09): the single pure reducer
 * that folds newly-appended `eventLog` events plus one possession delta into
 * `MatchStats`.
 *
 * Covers: possession minutes (D-05), completed open-play passes (PD-08), tackle/steal
 * attempts + successes (D-06 denominator/numerator, with declines excluded per D-07),
 * and fouls/yellow-cards/red-cards (PD-10 second-yellow double count).
 *
 * `shots` and `xg` are NOT owned by this reducer — plan 45-02's inline capture at each
 * shot-resolution branch is their single owner. This reducer only ever passes those two
 * members through byte-identically from the seed `MatchStats`. This is the single most
 * likely wrong edit a future maintainer could make here: do NOT add a `shots`/`xg`
 * branch to the switch below.
 *
 * Called from exactly one site: `roomStore.ts`'s `broadcastState`, once per broadcast,
 * on the `eventLog` slice appended since the previous broadcast (PD-11, PD-12, PD-13).
 */

/**
 * PD-08: the pass `ActionEvent` types this reducer treats as "completed pass"
 * candidates via a plain `accurate === true` flag check — i.e. `STANDARD_PASS`,
 * `FIRST_TIME_PASS`, and `LONG_BALL`. `HP_ACCURACY` (the High Pass completion event)
 * and `HEADED_PASS` (whose completion test is carrier-team matching, not an `accurate`
 * flag) are handled by their own dedicated switch branches below since they don't share
 * this shape — this array exists purely so the "which pass types count" definition is
 * adjustable in one documented place; the switch's case labels below must be kept in
 * sync with it by hand (TypeScript discriminated-union `case` labels cannot be derived
 * from a runtime array).
 *
 * Deliberately excluded from this list and from the reducer entirely: `HIGH_PASS` (a
 * declare-time log entry, always `accurate: null` at declare time — counting it would
 * double-count every completed high pass alongside its `HP_ACCURACY` completion),
 * `GK_KICK`, `GK_PUNT`, `THROW_IN_PLACE`, `GOAL_KICK`, and `CORNER_KICK_ACCURACY`
 * (goalkeeper distribution and dead-ball restarts are not open-play passes in the sense
 * every soccer stats UI means, and Counter Attack's own rules treat them as distinct
 * restart mechanics).
 */
export const COUNTED_ACCURATE_PASS_TYPES = [
  'STANDARD_PASS',
  'FIRST_TIME_PASS',
  'LONG_BALL',
] as const;

type TeamCounter = { home: number; away: number };

function cloneCounter(counter: TeamCounter): TeamCounter {
  return { home: counter.home, away: counter.away };
}

/**
 * Resolves a piece id to its team, or `null` when the id is missing/unresolvable.
 * PD-09: unresolvable ids are skipped silently by every caller of this helper — this is
 * a display-only statistic and a hard failure here would take down a live broadcast.
 */
function lookupTeam(
  pieceId: string | null | undefined,
  pieces: readonly PlayerPiece[],
): 'home' | 'away' | null {
  if (!pieceId) return null;
  const piece = pieces.find((p) => p.id === pieceId);
  return piece ? piece.teamId : null;
}

export function foldMatchStats(
  current: MatchStats | undefined,
  newEvents: readonly ActionEvent[],
  pieces: readonly PlayerPiece[],
  possession: { team: 'home' | 'away'; actionCountDelta: number },
): MatchStats {
  const base = current ?? EMPTY_MATCH_STATS;

  const possessionActionCount = cloneCounter(base.possessionActionCount);
  const passesCompleted = cloneCounter(base.passesCompleted);
  const tackleStealAttempts = cloneCounter(base.tackleStealAttempts);
  const tackleStealSuccesses = cloneCounter(base.tackleStealSuccesses);
  const fouls = cloneCounter(base.fouls);
  const yellowCards = cloneCounter(base.yellowCards);
  const redCards = cloneCounter(base.redCards);

  // Possession is supplied by the caller, never derived from an event — see the
  // module doc and PD-09/Pitfall-5: the post-action state (e.g. after a successful
  // steal flips attackingTeam) has the WRONG team for this purpose.
  const clampedDelta = Math.max(0, possession.actionCountDelta);
  possessionActionCount[possession.team] += clampedDelta;

  for (const event of newEvents) {
    switch (event.type) {
      // PD-08 — keep in sync with COUNTED_ACCURATE_PASS_TYPES above.
      case 'STANDARD_PASS':
      case 'FIRST_TIME_PASS': {
        if (event.accurate === true) {
          const team = lookupTeam(event.passerId, pieces);
          if (team) passesCompleted[team] += 1;
        }
        break;
      }
      case 'LONG_BALL': {
        // PD-09: the declared LONG_BALL variant carries no `passerId` field even though
        // gameEngine.ts's PASS case constructs one at runtime via a computed
        // `deliveredPassType` literal — narrowing on LONG_BALL and reading `.passerId`
        // is a type error against the declared shared type. Use `ballAfter.carrierId`
        // instead; do not widen the shared type to work around this.
        if (event.accurate === true) {
          const team = lookupTeam(event.ballAfter.carrierId, pieces);
          if (team) passesCompleted[team] += 1;
        }
        break;
      }
      case 'HP_ACCURACY': {
        if (event.accurate === true) {
          const team = lookupTeam(event.passerId, pieces);
          if (team) passesCompleted[team] += 1;
        }
        break;
      }
      case 'HEADED_PASS': {
        // Completion test: the ball landed on a TEAMMATE, not an `accurate` flag —
        // HEADED_PASS has no such field (see interface_contract in 45-03-PLAN.md).
        const passerTeam = lookupTeam(event.passerId, pieces);
        const carrierTeam = lookupTeam(event.ballAfter.carrierId, pieces);
        if (passerTeam !== null && carrierTeam !== null && passerTeam === carrierTeam) {
          passesCompleted[passerTeam] += 1;
        }
        break;
      }
      case 'STEAL_ATTEMPT':
      case 'TACKLE_ATTEMPT': {
        const team = lookupTeam(event.defenderId, pieces);
        if (team) {
          tackleStealAttempts[team] += 1;
          if (event.result === 'SUCCESS') tackleStealSuccesses[team] += 1;
        }
        break;
      }
      // D-07: TACKLE_STEAL_DECLINED intentionally has NO case — a declined offer is not
      // an attempt and must not increment any counter. Falls through to `default`.
      case 'FOUL_CALLED': {
        const team = lookupTeam(event.defenderId, pieces);
        if (team) fouls[team] += 1;
        break;
      }
      case 'BOOKING_CHECK': {
        const team = lookupTeam(event.defenderId, pieces);
        if (team) {
          // PD-10: resolveBooking's second-yellow return is { card: 'red', secondYellow:
          // true } — a second yellow is BOTH a yellow and a red in real football
          // statistics, so without this OR clause the yellow count would understate.
          if (event.card === 'yellow' || event.secondYellow === true) {
            yellowCards[team] += 1;
          }
          if (event.card === 'red') {
            redCards[team] += 1;
          }
        }
        break;
      }
      default:
        // Every other ActionEventType (MOVE, SLOT_ADVANCE, DICE_ROLL, GOAL,
        // SHOT_ATTEMPT, PENALTY_KICK, SUBSTITUTION, GK_KICK, GK_PUNT, THROW_IN_PLACE,
        // GOAL_KICK, CORNER_KICK_ACCURACY, TACKLE_STEAL_DECLINED, and the rest of the
        // union) changes nothing here.
        break;
    }
  }

  return {
    possessionActionCount,
    passesCompleted,
    tackleStealAttempts,
    tackleStealSuccesses,
    // shots/xg pass through byte-identically — owned exclusively by plan 45-02.
    shots: base.shots,
    xg: base.xg,
    fouls,
    yellowCards,
    redCards,
  };
}
