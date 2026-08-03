/**
 * Shared test-only helpers for server integration tests.
 *
 * Phase 27 code review (WR-05): the ROOM_SETTINGS_CONFIRM "unblock
 * TEAM_SELECTION_START under the settings-confirmed gate" boilerplate below was
 * duplicated verbatim across 10 `setupRoom`/`setupThroughUniformConfirm`-style
 * helpers. Unlike the other per-file test scaffolding (server lifecycle,
 * `oncePromise`, `waitForConnect`, `createClient` — deliberately copied verbatim
 * per file so each integration-test file stays self-contained), this fixture's
 * payload shape has no reason to vary between call sites, so it is factored out
 * here instead.
 */
import type { Socket } from 'socket.io-client';
import type { ClientToServerEvents, ServerToClientEvents } from '@counter-attack/shared';
import { ClientEvents, ServerEvents } from '@counter-attack/shared';

/**
 * Confirms default room settings (standard speed, standard team type, no draft
 * pools) from `clientA`, who must be the host (slot 1). Resolves once the
 * ROOM_SETTINGS_CONFIRMED echo round-trips back.
 *
 * T-27-05/Pitfall 1: TEAM_SELECTION_START is gated on settings-confirmed AND
 * slot-2-joined — call this before the joiner arrives so the standard
 * join-then-team-selection-start flow still holds under the both-conditions gate.
 */
export function confirmDefaultRoomSettings(
  clientA: Socket<ServerToClientEvents, ClientToServerEvents>,
  timeoutMs = 1000,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Timed out waiting for ROOM_SETTINGS_CONFIRMED after ${timeoutMs}ms`));
    }, timeoutMs);
    clientA.once(ServerEvents.ROOM_SETTINGS_CONFIRMED, () => {
      clearTimeout(timer);
      resolve();
    });
    clientA.emit(ClientEvents.ROOM_SETTINGS_CONFIRM, {
      speed: 'standard',
      teamType: 'standard',
      draftPools: [],
      outOfBounds: false,
    });
  });
}
