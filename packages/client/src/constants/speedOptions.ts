import type { GameSpeed } from '@counter-attack/shared';

/**
 * Phase 27 (rule of three): extracted shared source for the game-speed picker options,
 * previously duplicated verbatim in TeamSelectionScreen.tsx and UniformSelectionScreen.tsx.
 * GameSettingsScreen.tsx is now the only interactive consumer; the other two screens use
 * the read-only subheader variant (D-07/D-09).
 */
export const SPEED_OPTIONS: {
  value: GameSpeed;
  label: string;
  icon: string;
  colorClass: string;
}[] = [
  { value: 'slow', label: 'Slow', icon: '🐢', colorClass: 'speedColorSlow' },
  { value: 'standard', label: 'Standard', icon: '⚽', colorClass: 'speedColorStandard' },
  { value: 'fast', label: 'Fast', icon: '⚡', colorClass: 'speedColorFast' },
];
