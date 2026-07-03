/**
 * Team selection screen — shown to both players after slot-2 joins.
 * Home player picks first; away player sees struck-out home card + 3 active cards.
 * PLAY-03: exactly 4 team cards (no Free Agent card).
 * SELECT-01: home-first turn order enforced server-side; client disables cards for waiting player.
 * UX-07 (Phase 18.4): home player may choose Slow/Standard/Fast game speed (default Standard).
 * D-10/D-11/D-12/D-13/D-14: component shape, badge variants, turn order, full-size badges.
 */
import { useGameStore } from '../store/useGameStore.js';
import { TEAM_CONFIGS } from '@counter-attack/shared';
import type { GameSpeed, TeamId } from '@counter-attack/shared';
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

/** UX-07: speed options with display labels, icons, and per-speed CSS color classes. */
const SPEED_OPTIONS: { value: GameSpeed; label: string; icon: string; colorClass: string }[] = [
  { value: 'slow', label: 'Slow', icon: '🐢', colorClass: 'speedColorSlow' },
  { value: 'standard', label: 'Standard', icon: '⚽', colorClass: 'speedColorStandard' },
  { value: 'fast', label: 'Fast', icon: '⚡', colorClass: 'speedColorFast' },
];

type Props = {
  /** The team that home player has already picked, or null if home hasn't picked yet. */
  homePickedTeam: TeamId | null;
  /** Called when the active player clicks a team card. */
  onPick: (teamId: TeamId) => void;
  /** UX-07: current selected game speed (home-player controlled). */
  selectedSpeed: GameSpeed;
  /** UX-07: called when home player changes game speed. */
  onSpeedChange: (speed: GameSpeed) => void;
};

/**
 * 2×2 grid of team selection cards with a game-speed selector for the home player.
 * Props are kept in App.tsx local state (D-14 — homePickedTeam not in Zustand).
 */
export function TeamSelectionScreen({
  homePickedTeam,
  onPick,
  selectedSpeed,
  onSpeedChange,
}: Props) {
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
      {/* UX-07: speed selector — home player controls it (locked once they pick a team);
           visitor sees only the currently selected speed as a label. */}
      <div className={styles.speedSelector}>
        <span className={styles.statusLine}>Match speed:</span>
        {iAmHome ? (
          <div className={styles.speedOptions}>
            {SPEED_OPTIONS.map(({ value, label, icon, colorClass }) => (
              <button
                key={value}
                disabled={homePickedTeam !== null}
                className={
                  value === selectedSpeed
                    ? `${styles.speedOptionActive} ${styles[colorClass]}`
                    : `${styles.speedOption} ${styles[colorClass]}`
                }
                onClick={() => onSpeedChange(value)}
                aria-pressed={value === selectedSpeed}
              >
                <span className={styles.speedIcon}>{icon}</span>
                {label}
              </button>
            ))}
          </div>
        ) : (
          <span
            className={`${styles.speedOptionActive} ${styles[SPEED_OPTIONS.find((o) => o.value === selectedSpeed)?.colorClass ?? 'speedColorStandard']}`}
          >
            <span className={styles.speedIcon}>
              {SPEED_OPTIONS.find((o) => o.value === selectedSpeed)?.icon}
            </span>
            {SPEED_OPTIONS.find((o) => o.value === selectedSpeed)?.label ?? selectedSpeed}
          </span>
        )}
      </div>
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
              style={{
                borderColor: TEAM_CONFIGS[teamId].primaryColor,
                background: TEAM_CONFIGS[teamId].primaryColor,
              }}
              onClick={() => onPick(teamId)}
            >
              <span
                style={{
                  display: 'inline-flex',
                  width: 110,
                  height: 110,
                  borderRadius: '50%',
                  overflow: 'hidden',
                  flexShrink: 0,
                }}
              >
                <img
                  src={FULL_BADGE_MAP[teamId]}
                  alt={`${TEAM_CONFIGS[teamId].name} badge`}
                  width={110}
                  height={110}
                  style={{ display: 'block', objectFit: 'cover' }}
                />
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
