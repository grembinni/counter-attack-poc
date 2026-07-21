import type { DraftPoolId, GameSpeed, TeamType } from '@counter-attack/shared';
import { SPEED_OPTIONS } from './speedOptions.js';

/**
 * Phase 27 (DRAFT-02/DRAFT-03, D-07/D-09): shared label map for draft pool copy, reused by
 * `formatSettingsSummary` and (independently) `GameSettingsScreen.tsx`'s own checkbox labels.
 */
export const DRAFT_POOL_LABELS: Record<DraftPoolId, string> = {
  original: 'Original',
  mls: 'MLS',
  international: 'International',
  legends: 'Legends',
  icons: 'Icons',
};

/**
 * Phase 27 (D-07/D-09): computes the single read-only settings-summary line shown on
 * UniformSelectionScreen/TeamSelectionScreen in place of the interactive speed picker.
 * - Standard mode: returns null — the screens fall back to the plain read-only speed label.
 * - Draft mode: returns "Speed: {icon} {Label}  ·  Team Type: Draft  ·  Draft Pool: {Pool1, Pool2, ...}"
 *   per the UI-SPEC Copywriting Contract. Screens never touch DraftPoolId formatting themselves.
 */
export function formatSettingsSummary(
  speed: GameSpeed,
  teamType: TeamType,
  draftPools: DraftPoolId[],
): string | null {
  if (teamType === 'standard') return null;

  const option = SPEED_OPTIONS.find((o) => o.value === speed);
  const speedLabel = `${option?.icon ?? ''} ${option?.label ?? speed}`.trim();
  const poolLabel = draftPools.map((pool) => DRAFT_POOL_LABELS[pool]).join(', ');

  // U+2002 EN SPACE (not a plain ASCII space) around the separator so the extra
  // breathing room between summary segments survives HTML whitespace collapsing.
  const SEP = ' · ';
  return [`Speed: ${speedLabel}`, 'Team Type: Draft', `Draft Pool: ${poolLabel}`].join(SEP);
}
