/** TeamBadge — renders a team's PNG badge via a static Vite import.
 * D-07 (Phase 15 CONTEXT.md): replaces TeamShieldIcon in the scoreboard.
 * Default size 28px (scoreboard usage); size prop supports Phase 16 reuse.
 * full=true: uses *-full.png crest in a white container so PNG white edges
 *   are invisible against the container background (alpha-channel workaround).
 * BADGE_MAP uses static imports so Vite content-hashes the URLs at build time.
 * Do NOT use teamConfig.badgeFile as the img src (Pitfall 3 — bypasses Vite).
 */
import cityBadge from '../assets/badges/city.png';
import crewBadge from '../assets/badges/crew.png';
import cityBadgeFull from '../assets/badges/city-full.png';
import crewBadgeFull from '../assets/badges/crew-full.png';
import type { TeamId } from '@counter-attack/shared';

const BADGE_MAP: Record<TeamId, string> = {
  city: cityBadge,
  crew: crewBadge,
};

const BADGE_MAP_FULL: Record<TeamId, string> = {
  city: cityBadgeFull,
  crew: crewBadgeFull,
};

export function TeamBadge({
  teamId,
  size = 28,
  full = false,
}: {
  teamId: TeamId;
  size?: number;
  full?: boolean;
}) {
  const src = full ? BADGE_MAP_FULL[teamId] : BADGE_MAP[teamId];

  if (full) {
    // Circular clip removes any white anti-alias fringing at the badge edge.
    // All four badge PNGs are circular designs so nothing is lost visually.
    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: size,
          height: size,
          borderRadius: '50%',
          overflow: 'hidden',
          flexShrink: 0,
          background: 'transparent',
        }}
      >
        <img
          src={src}
          alt={`${teamId} badge`}
          width={size}
          height={size}
          style={{ display: 'block', objectFit: 'cover' }}
        />
      </span>
    );
  }

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
        src={src}
        alt={`${teamId} badge`}
        width={size}
        height={size}
        style={{ display: 'block', objectFit: 'contain' }}
      />
    </span>
  );
}
