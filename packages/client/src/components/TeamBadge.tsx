/** TeamBadge — renders a team's PNG badge via a static Vite import.
 * D-07 (Phase 15 CONTEXT.md): replaces TeamShieldIcon in the scoreboard.
 * Default size 28px (scoreboard usage); size prop supports Phase 16 reuse.
 * BADGE_MAP uses static imports so Vite content-hashes the URLs at build time.
 * Do NOT use teamConfig.badgeFile as the img src (Pitfall 3 — bypasses Vite).
 */
import cosmosBadge from '../assets/badges/cosmos.png';
import xolosBadge from '../assets/badges/xolos.png';
import cityBadge from '../assets/badges/city.png';
import crewBadge from '../assets/badges/crew.png';
import type { TeamId } from '@counter-attack/shared';

const BADGE_MAP: Record<TeamId, string> = {
  cosmos: cosmosBadge,
  xolos: xolosBadge,
  city: cityBadge,
  crew: crewBadge,
};

export function TeamBadge({ teamId, size = 28 }: { teamId: TeamId; size?: number }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: size,
        height: size,
        borderRadius: '50%',
        background: '#ffffff',
        flexShrink: 0,
        overflow: 'hidden',
      }}
    >
      <img
        src={BADGE_MAP[teamId]}
        alt={`${teamId} badge`}
        width={size}
        height={size}
        style={{ display: 'block', objectFit: 'contain' }}
      />
    </span>
  );
}
