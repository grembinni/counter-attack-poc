/**
 * D-16-01: Single source-of-truth mapping from a server `GAME_ERROR` wire code to a
 * plain-English sentence written for a non-technical player. `packages/client/src/utils/`
 * already holds exactly this kind of shared presentational helper (`ctaColorClass.ts`, with
 * its own colocated test), so this module mirrors that file's shape and test style: a pure
 * function, no React/Zustand dependency, no CSS-module import.
 *
 * 37-UAT.md's Test 8 diagnosis found no unguarded crash behind the reported "grid gives
 * errors" report — every legitimate rejection during a restart reposition window (off-pitch,
 * non-adjacent, occupied, budget exhausted, ineligible, wrong team) was being displayed to the
 * player as the raw server wire code the UAT reporter actually saw on screen, 'OFF_PITCH', or
 * one of its siblings ('MOVE_INVALID', 'WRONG_TEAM', …). This module is the fix:
 * `restartErrorMessage()` is wired into every restart-setup panel's `gameError` banner so a
 * raw code can never reach the DOM there again.
 *
 * The wire codes mapped below were enumerated by running
 * `grep -o "GAME_ERROR, '[A-Z_]*'" packages/server/src/gameHandlers.ts | sort -u` against
 * `packages/server/src/gameHandlers.ts`, plus the five `ApplyMoveResult.reason` union members
 * defined at `packages/server/src/gameEngine.ts` (`WRONG_SLOT`, `WRONG_TEAM`, `PIECE_NOT_FOUND`,
 * `MOVE_INVALID`, `WRONG_PHASE`) — `ApplyMoveResult.detail` values are NOT emitted to the
 * client (confirmed by the pre-existing comment at `goalKick.integration.test.ts:615-618`), so
 * `detail`-only codes such as `GOAL_KICK_PACE_EXHAUSTED`, `OUT_OF_RANGE`, `NOT_ELIGIBLE` and
 * `FREE_MOVE_EXHAUSTED` never reach this function and are intentionally absent from the map —
 * `MOVE_INVALID`'s sentence is written to cover the whole family they stand in for. This grep
 * must be re-run and the map re-checked whenever a new `GAME_ERROR` code is added on the
 * server.
 *
 * `gameError` is typed `string | null` at `useGameStore.ts` — an open string, not a closed
 * TypeScript union — because handlers emit both literal string codes and `result.reason`
 * values. `restartErrorMessage()` is therefore total over `string | null`: unknown codes fall
 * back to `GENERIC_MESSAGE` rather than leaking the raw token or rendering a blank banner (a
 * blank banner would be a worse regression than the raw code).
 */

/**
 * Wire-code -> player-facing sentence. Exported (not module-private) so tests can iterate
 * every entry and assert the shared formatting invariants (leading capital, trailing period,
 * no underscore, no long all-caps token) without duplicating the key list — a future addition
 * that forgets to write real copy cannot leak a raw wire code by accident.
 */
export const RESTART_ERROR_MESSAGES: Readonly<Record<string, string>> = {
  // ApplyMoveResult.reason union (gameEngine.ts) — the five codes every applyMove-family
  // handler can emit.
  WRONG_SLOT: "It isn't time for that action yet.",
  WRONG_TEAM: "That piece isn't yours to move.",
  PIECE_NOT_FOUND: 'That player could not be found.',
  MOVE_INVALID: "That move isn't allowed right now.",
  WRONG_PHASE: "It isn't time for that action yet.",

  // Remaining literal GAME_ERROR codes discovered in gameHandlers.ts.
  OFF_PITCH: 'That hex is off the pitch.',
  NOT_YOUR_PIECE: "That piece isn't yours to move.",
  INVALID_SEQUENCE: "It isn't time for that action yet.",
  OCCUPIED: 'Another player is already standing there.',
  INVALID_TARGET: "That isn't a valid target for this action.",
  MISSING_TARGET: 'Choose a target before continuing.',
  WRONG_PIECE: 'A different player must be used for this action.',
  INVALID_CHOICE: "That isn't a valid choice right now.",
  MISSING_PASS_TYPE: 'Choose a pass type before continuing.',
  DUEL_ALREADY_RESOLVED: 'That contest has already been decided.',
  HEADER_NOT_CONFIRMED: 'Confirm the header result before continuing.',
  INVALID_CONTESTANT: "That player can't contest this header.",
  KICKOFF_STANDARD_PASS_ONLY: 'Only a standard pass is allowed at kick-off.',
  NOT_KICK_OFF_TEAM: "It isn't your team's kick-off.",

  // 38-18 (D-GAP-03/T-38-61): the new corner-reposition rejection reason below is emitted by
  // both `applyCornerKickReposition` and `applyCornerKickFinalMove`. Re-running the grep this
  // module's header comment mandates, plus a scan of every `ApplyCornerKick*Result` reason
  // union in gameEngine.ts, additionally surfaced four PRE-EXISTING unmapped codes that were
  // already leaking to the DOM as raw wire tokens before this plan: NOT_ELIGIBLE, NOT_ADJACENT,
  // STAGE_LIMIT_REACHED (corner reposition/final-move guards) and NOT_GOALKEEPER
  // (`applyCornerKickGkPlace`). The pre-kick 3-hex cap's rejection reason also scanned as
  // unmapped — it remains a real, still-emitted reason for CORNER-06 (`applyCornerKickFinalMove`)
  // even though 38-17 removes it from the reposition-window result union. All six are added
  // below.
  PIECE_LOCKED: 'That player has already been repositioned for this corner.',
  NOT_ELIGIBLE: 'That player cannot be moved in this step.',
  NOT_ADJACENT: 'Choose a hex next to that player.',
  STAGE_LIMIT_REACHED: 'The player limit for this round has been reached.',
  NOT_GOALKEEPER: 'Only a goalkeeper can do that.',
  PACE_EXHAUSTED: 'That player has already moved the maximum distance allowed.',

  // 38-20: the permanent defender exclusion-zone rejection shared by
  // applyCornerKickGkPlace/applyCornerKickReposition/applyCornerKickFinalMove. Plan 38-28
  // removed the two clear-out-only rejection codes this map used to carry, alongside the
  // deleted automatic clear-out phase — those wire codes can no longer be emitted.
  CORNER_EXCLUSION_ZONE: 'Defenders cannot be positioned within three hexes of the corner.',

  // 39-18 (UAT gap 1): re-running this module's mandated grep for the new server-side
  // CONTINUE_NOT_ALLOWED reason (added to ApplyFoulChoiceResult by applyFoulChoice and
  // forwarded verbatim to GAME_ERROR by the existing GAME_FOUL_CHOICE handler) surfaced
  // no other newly unmapped codes. Added below.
  CONTINUE_NOT_ALLOWED: 'That side already has the ball back, so play cannot continue.',
};

/**
 * D-16-02: fallback for any code not present in `RESTART_ERROR_MESSAGES` — the wire protocol
 * is an open `string` at the client boundary, so a `Record` lookup miss must still produce
 * readable text, never the raw token and never an empty string.
 */
const GENERIC_MESSAGE = "That action couldn't be completed. Try a different move.";

/**
 * Converts a server `GAME_ERROR` wire code into a plain-English sentence.
 *
 * @param code - The raw wire code from `useGameStore`'s `gameError` field, or `null`.
 * @returns The mapped sentence, `GENERIC_MESSAGE` for an unrecognised non-empty code, or
 *   `null` for `null`/empty input — callers render nothing at all for `null` rather than an
 *   empty banner.
 */
export function restartErrorMessage(code: string | null): string | null {
  if (!code) return null;
  return RESTART_ERROR_MESSAGES[code] ?? GENERIC_MESSAGE;
}
