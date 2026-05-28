import type { HexCoord, GameState, PlayerPiece } from '@counter-attack/shared';
import { hexDistance, ClientEvents } from '@counter-attack/shared';

// Unused type imports prove resolution works — all five required Phase 1 types
// are importable from the client side (ROADMAP success criterion 2).
const _gs: GameState | null = null;
const _pp: PlayerPiece | null = null;
void _gs;
void _pp;

const origin: HexCoord = { q: 0, r: 0 };
const target: HexCoord = { q: 3, r: 0 };
const distance: number = hexDistance(origin, target);

export function placeholder(): void {
  console.log(
    'Counter Attack client placeholder. Distance 0->3:',
    distance,
    'create event:',
    ClientEvents.ROOM_CREATE,
  );
}
