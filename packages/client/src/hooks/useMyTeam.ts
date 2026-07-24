import { useGameStore } from '../store/useGameStore.js';

/**
 * Pure — callable from useGameStore.ts's own action bodies via
 * `deriveMyTeam(get().playerSlot)`, which run outside React render and
 * CANNOT call hooks. Canonical null-safe semantics (matches
 * HexGrid.tsx/ActionPanel.tsx/GameBoard.tsx's existing form): a null
 * playerSlot yields null, never a silently-coerced default team.
 */
export function deriveMyTeam(playerSlot: 1 | 2 | null): 'home' | 'away' | null {
  return playerSlot === 1 ? 'home' : playerSlot === 2 ? 'away' : null;
}

/**
 * Hook wrapper for component bodies — subscribes to the narrowest slice
 * (locked per-slice-selector convention) rather than the whole store.
 */
export function useMyTeam(): 'home' | 'away' | null {
  const playerSlot = useGameStore((s) => s.playerSlot);
  return deriveMyTeam(playerSlot);
}
