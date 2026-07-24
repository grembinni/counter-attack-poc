import { TEAM_CONFIGS } from '@counter-attack/shared';
import type { TeamId } from '@counter-attack/shared';

/**
 * Pure — no Zustand/React dependency. Safe to call from anywhere, including
 * loops and non-component helper functions (e.g. ActionLog.tsx's
 * pieceColorOf/slotTeamColor, called from consolidateEvents/formatEvent's
 * per-event loops, where a hook call would violate Rules of Hooks).
 * Returns the fallback gray (`#888888`) when teamId is falsy or absent from
 * TEAM_CONFIGS.
 */
export function teamAccentColor(teamId: TeamId | undefined): string {
  if (!teamId) return '#888888';
  return TEAM_CONFIGS[teamId]?.palette.uiColor ?? '#888888';
}

/**
 * Thin hook wrapper — exists for call-site naming consistency with D-03 in
 * component bodies (e.g. GameBoard.tsx). Functionally identical to calling
 * teamAccentColor() directly: no store subscription, since TEAM_CONFIGS is a
 * static import, not reactive state.
 */
export function useTeamAccentColor(teamId: TeamId | undefined): string {
  return teamAccentColor(teamId);
}
