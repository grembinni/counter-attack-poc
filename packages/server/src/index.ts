import type { HexCoord, GameState } from '@counter-attack/shared';
import { PITCH_HEXES, ClientEvents } from '@counter-attack/shared';

// Suppress unused type import warnings — these prove type resolution works (ARCH-02).
const _gc: GameState | null = null;
const _hc: HexCoord | null = null;
void _gc;
void _hc;

export function bootstrap(): void {
  console.log(
    'Counter Attack server placeholder. Pitch hexes:',
    PITCH_HEXES.length,
    'first client event:',
    ClientEvents.ROOM_CREATE,
  );
}

bootstrap();
