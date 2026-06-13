/** Client-only positional-to-TeamId map. D-05 (Phase 15 CONTEXT.md).
 * Maps 'home' | 'away' positional roles to a TeamId.
 * NOT in GameState — replaced by Phase 16 dynamic team selection.
 * Module-level constant (not inside a component) to avoid re-creation per render.
 */
import type { TeamId } from '@counter-attack/shared';

export const TEAM_DEFAULTS: Record<'home' | 'away', TeamId> = {
  home: 'city',
  away: 'crew',
};
