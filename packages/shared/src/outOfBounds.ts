/**
 * Out-of-bounds classification utilities for the Counter Attack pitch.
 *
 * OOB-01: the ball leaving the pitch is classified as sideline (throw-in),
 * attacking byline (corner kick — Phase 38 scope), or defending byline (goal kick).
 * OOB-02/OOB-04: pure geometry + last-toucher classification, no engine state.
 * D-05: an ambiguous double-boundary exit (both q and r out of range, i.e. a
 * corner of the bounding rectangle) defaults to BYLINE — q is checked first.
 *
 * These functions are pure and side-effect free, mirroring `scoreUtils.ts`
 * (`computeCombinedScore`/`computeLooseBall`): no I/O, no engine state, safe to
 * import from both `packages/server` and `packages/client`. Phase 38's Corner
 * Kick extension consumes `classifyOutOfBounds`'s existing `'CORNER_KICK'`
 * branch without needing to touch this file's logic (see the JSDoc on
 * `classifyOutOfBounds` below).
 */

import type { HexCoord } from './types.js';
import { isPitchHex } from './pitch.js';
import { hexesInRange, hexDistance } from './hex.js';

/** Pitch bounds, single source of truth for this module (mirrors pitch.ts's 37x26 grid). */
const MAX_Q = 36;
const MAX_R = 25;

/**
 * Which boundary the ball crossed when it left the pitch, or `null` if it is
 * still on the pitch. `null` is a defensive branch — callers should only
 * invoke this on a hex already known/suspected to be out of bounds.
 */
export type OutOfBoundsExit = 'SIDELINE' | 'BYLINE' | null;

/** The restart type awarded when the ball goes out of bounds. */
export type OutOfBoundsRestart = 'THROW_IN' | 'GOAL_KICK' | 'CORNER_KICK';

/**
 * Classifies which pitch boundary `hex` is beyond.
 *
 * D-05: `qOut` is checked FIRST, so a hex that is out of bounds on both axes
 * (a corner of the bounding rectangle) resolves to `'BYLINE'`, never
 * `'SIDELINE'`. Do not hardcode a second copy of the pitch bounds anywhere
 * else in this file — always reference `MAX_Q`/`MAX_R`.
 *
 * 37-14 (gap-closure wave 12, user-redefined scope): the row test (`rOut`)
 * is now parity-aware for the `r=0` edge. In addition to the plain
 * `hex.r < 0 || hex.r > MAX_R` rectangle test, a hex with `hex.q` still
 * within `[0, MAX_Q]` (i.e. `qOut` is false) is ALSO `rOut` when it fails
 * `isPitchHex` — this is currently only the 19 even-q `r=0` hexes excluded
 * from `PITCH_HEXES` per Plan 37-14 (see pitch.ts doc comment). This check
 * is additive to, not a replacement for, the existing rectangle test, and
 * `qOut` is still evaluated/short-circuited first so the D-05 corner-
 * defaults-to-BYLINE rule is unchanged. No `r=25` hex is affected — every
 * `r=25` hex remains a pitch hex and is therefore never `rOut` via this path.
 */
export function classifyExit(hex: HexCoord): OutOfBoundsExit {
  const qOut = hex.q < 0 || hex.q > MAX_Q;
  const rOut = hex.r < 0 || hex.r > MAX_R || (!qOut && !isPitchHex(hex));
  if (!qOut && !rOut) return null; // still on pitch — defensive branch
  if (qOut) return 'BYLINE'; // D-05: ambiguous double-boundary defaults to byline
  return 'SIDELINE';
}

/**
 * Returns which team's goal line the ball crossed when exiting past a byline,
 * or `null` when the hex is not beyond a byline (e.g. a sideline exit).
 *
 * This answers "whose goal line did the ball cross", which is NOT the same
 * question as "who last touched the ball" (`lastTouchedByTeam`). q=0 is
 * `PITCH_REGIONS.homeGoal`'s column, so a negative-q exit is beyond home's
 * own goal line.
 */
export function bylineOwner(hex: HexCoord): 'home' | 'away' | null {
  if (hex.q < 0) return 'home';
  if (hex.q > MAX_Q) return 'away';
  return null;
}

/**
 * Classifies the restart type awarded for a ball that has gone out of bounds.
 *
 * `'SIDELINE'` always returns `'THROW_IN'`.
 *
 * `'BYLINE'` returns `'CORNER_KICK'` when the last toucher was a defender of
 * that goal line (`lastTouchedByTeam === bylineOwnerTeam`) — OOB-03, Phase 38
 * scope — otherwise `'GOAL_KICK'` (the attacker touched last, or the ball was
 * never touched at all, e.g. an off-target shot — OOB-04).
 *
 * Phase 37 callers must NOT route a `'CORNER_KICK'` result into a restart
 * flow — Plan 37-04 owns that decision and Phase 37 has no Corner Kick
 * implementation yet. Phase 38 only needs to add the consumer branch that
 * acts on `'CORNER_KICK'`; it must never edit this function's logic.
 */
export function classifyOutOfBounds(
  exit: 'SIDELINE' | 'BYLINE',
  lastTouchedByTeam: 'home' | 'away' | null,
  bylineOwnerTeam: 'home' | 'away' | null,
): OutOfBoundsRestart {
  if (exit === 'SIDELINE') return 'THROW_IN';
  if (lastTouchedByTeam !== null && lastTouchedByTeam === bylineOwnerTeam) {
    return 'CORNER_KICK';
  }
  return 'GOAL_KICK';
}

/**
 * Resolves a guaranteed-free hex for throw-in placement.
 *
 * Returns `preferred` unchanged when it is unoccupied. Otherwise scans
 * `hexesInRange(preferred, radius)` for `radius` 1..6, filtering to on-pitch,
 * unoccupied hexes, and returns the candidate with the smallest
 * `hexDistance(preferred, candidate)`, tie-broken by ascending `q` then
 * ascending `r` for determinism. If nothing is found within radius 6,
 * `preferred` is returned unchanged as a documented last-resort fallback —
 * this guarantees Plan 37-05's placement step can never dead-end on an
 * occupied exit hex.
 */
export function resolveThrowInHex(
  preferred: HexCoord,
  pieces: readonly { position: HexCoord }[],
): HexCoord {
  const isOccupied = (hex: HexCoord): boolean =>
    pieces.some((p) => p.position.q === hex.q && p.position.r === hex.r);

  if (!isOccupied(preferred)) return preferred;

  for (let radius = 1; radius <= 6; radius++) {
    const candidates = hexesInRange(preferred, radius).filter(
      (hex) => isPitchHex(hex) && !isOccupied(hex),
    );
    if (candidates.length === 0) continue;

    candidates.sort((a, b) => {
      const da = hexDistance(preferred, a);
      const db = hexDistance(preferred, b);
      if (da !== db) return da - db;
      if (a.q !== b.q) return a.q - b.q;
      return a.r - b.r;
    });

    return candidates[0]!;
  }

  // Last-resort fallback: nothing free within radius 6 — return preferred unchanged.
  return preferred;
}
