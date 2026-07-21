import { randomInt } from 'crypto';
import { generateDraftPacks } from '@counter-attack/shared';
import type { DraftPoolId, DraftPack, TieredPoolPlayer } from '@counter-attack/shared';

/**
 * Server-authoritative draft pack generation (DRAFT-04/DRAFT-05, threat model
 * T-28-04-FAIR).
 *
 * Pack generation decides which players are draftable, so it must run only on the
 * server with a randomness source neither client can predict or influence. Per the
 * project convention (`diceUtils.ts`, `gameEngine.ts`) and the phase threat model, that
 * source is Node's cryptographically secure `randomInt` — never the insecure built-in
 * pseudo-random helper, and never a client-supplied seed or value.
 *
 * The shared `draftEngine.ts` module is deliberately randomness-agnostic (client-safe,
 * pure) — this module is where the real CSPRNG is bound in. `generateMatchPacks` is the
 * single authoritative entry point: Phase 29's `ROOM_SETTINGS_CONFIRM` handler will call
 * `generateMatchPacks(room.draftPools)` once per match after `teamType: 'draft'` is
 * locked in. No socket wiring, room-state mutation, or persistence lives here — that is
 * Phase 29 scope.
 */
export function generateMatchPacks(selectedPools: DraftPoolId[]): {
  pool: TieredPoolPlayer[];
  packs: DraftPack[];
} {
  return generateDraftPacks(selectedPools, randomInt);
}
