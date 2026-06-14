/**
 * Team selection screen — shown to both players after slot-2 joins.
 * Home player picks first; away player sees struck-out home card + 3 active cards.
 * PLAY-03: exactly 4 team cards (no Free Agent card).
 * SELECT-01: home-first turn order enforced server-side; client disables cards for waiting player.
 * D-10/D-11/D-12/D-13/D-14: component shape, badge variants, turn order, full-size badges.
 */
import { useGameStore } from '../store/useGameStore.js';
import { TEAM_CONFIGS } from '@counter-attack/shared';
import type { TeamId } from '@counter-attack/shared';
import styles from './TeamSelectionScreen.module.css';

// D-13: static Vite imports for full-size badge variants — content-hashed at build time.
// These are used ONLY on the TeamSelectionScreen; regular {teamid}.png stays in TeamBadge.
import cosmosFullBadge from '../assets/badges/cosmos-full.png';
import xolosFullBadge from '../assets/badges/xolos-full.png';
import cityFullBadge from '../assets/badges/city-full.png';
import crewFullBadge from '../assets/badges/crew-full.png';

/** PLAY-03: exactly 4 selectable teams (never includes Free Agents). */
const ALL_TEAMS: TeamId[] = ['cosmos', 'xolos', 'city', 'crew'];

/** Maps TeamId to full-size badge Vite import URL (110×110 display). */
const FULL_BADGE_MAP: Record<TeamId, string> = {
  cosmos: cosmosFullBadge,
  xolos: xolosFullBadge,
  city: cityFullBadge,
  crew: crewFullBadge,
};

type Props = {
  /** The team that home player has already picked, or null if home hasn't picked yet. */
  homePickedTeam: TeamId | null;
  /** Called when the active player clicks a team card. */
  onPick: (teamId: TeamId) => void;
};

/**
 * 2×2 grid of team selection cards.
 * Props are kept in App.tsx local state (D-14 — homePickedTeam not in Zustand).
 */
export function TeamSelectionScreen({ homePickedTeam, onPick }: Props) {
  const playerSlot = useGameStore((s) => s.playerSlot);

  // D-11: home-first turn order
  const isHomeTurn = homePickedTeam === null;
  const iAmHome = playerSlot === 1;
  const iAmActive = isHomeTurn ? iAmHome : !iAmHome;

  const heading = isHomeTurn ? 'Home: choose your team' : 'Away: choose your team';
  const showWaiting = !iAmActive && isHomeTurn;

  return (
    <div className={styles.screen}>
      <h2 className={styles.heading}>{heading}</h2>
      {showWaiting && <p className={styles.statusLine}>Waiting for home player to choose...</p>}
      {/* D-12: 2×2 grid — SELECT-01 */}
      <div className={styles.grid}>
        {ALL_TEAMS.map((teamId) => {
          const isStruckOut = teamId === homePickedTeam;
          const isDisabled = !iAmActive || isStruckOut;
          return (
            <button
              key={teamId}
              disabled={isDisabled}
              className={isStruckOut ? styles.cardStruckOut : styles.card}
              style={{ borderColor: TEAM_CONFIGS[teamId].primaryColor }}
              onClick={() => onPick(teamId)}
            >
              <img
                src={FULL_BADGE_MAP[teamId]}
                alt={`${TEAM_CONFIGS[teamId].name} badge`}
                width={110}
                height={110}
                style={{ objectFit: 'contain' }}
              />
              <span className={isStruckOut ? styles.teamNameStruckOut : styles.teamName}>
                {TEAM_CONFIGS[teamId].name}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
