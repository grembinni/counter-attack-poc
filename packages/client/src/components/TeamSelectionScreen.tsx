/**
 * Team selection screen — shown to both players after slot-2 joins.
 * Home player picks first; away player sees struck-out home card + active cards.
 * LEAGUE-01: two-tab layout (MLS / International); MLS default on mount.
 * LEAGUE-02: away player auto-switches to the tab containing home's picked team.
 * SELECT-01: home-first turn order enforced server-side; client disables cards for waiting player.
 * UX-07 (Phase 18.4): home player may choose Slow/Standard/Fast game speed (default Standard).
 * D-10/D-11/D-12/D-13/D-14: component shape, badge variants, turn order, full-size badges.
 */
import { useState, useEffect } from 'react';
import { useGameStore } from '../store/useGameStore.js';
import { TEAM_CONFIGS } from '@counter-attack/shared';
import type { GameSpeed, TeamId } from '@counter-attack/shared';
import { SPEED_OPTIONS } from '../constants/speedOptions.js';
import styles from './TeamSelectionScreen.module.css';

// D-13: static Vite imports for full-size badge variants — content-hashed at build time.
// These are used ONLY on the TeamSelectionScreen; regular {teamid}.png stays in TeamBadge.
import cityFullBadge from '../assets/badges/city-full.png';
import crewFullBadge from '../assets/badges/crew-full.png';
// Phase 21: 10 new static Vite imports (content-hashed at build time):
import laFullBadge from '../assets/badges/la-full.png';
import miamiFullBadge from '../assets/badges/miami-full.png';
import nashvilleFullBadge from '../assets/badges/nashville-full.png';
import seattleFullBadge from '../assets/badges/seattle-full.png';
import canadaFullBadge from '../assets/badges/canada-full.png';
import englandFullBadge from '../assets/badges/england-full.png';
import franceFullBadge from '../assets/badges/france-full.png';
import mexicoFullBadge from '../assets/badges/mexico-full.png';
import spainFullBadge from '../assets/badges/spain-full.png';
import usFullBadge from '../assets/badges/us-full.png';

/** D-11: MLS tab order — originals first (city, crew), then alphabetical new MLS teams. */
const MLS_TEAMS: TeamId[] = ['city', 'crew', 'la', 'miami', 'nashville', 'seattle'];

/** D-12: International tab order — alphabetical. */
const INTL_TEAMS: TeamId[] = ['canada', 'england', 'france', 'mexico', 'spain', 'us'];

/** Maps TeamId to full-size badge Vite import URL (80×80 display). */
const FULL_BADGE_MAP: Record<TeamId, string> = {
  city: cityFullBadge,
  crew: crewFullBadge,
  la: laFullBadge,
  miami: miamiFullBadge,
  nashville: nashvilleFullBadge,
  seattle: seattleFullBadge,
  canada: canadaFullBadge,
  england: englandFullBadge,
  france: franceFullBadge,
  mexico: mexicoFullBadge,
  spain: spainFullBadge,
  us: usFullBadge,
};

type Props = {
  /** The team that home player has already picked, or null if home hasn't picked yet. */
  homePickedTeam: TeamId | null;
  /** Called when the active player clicks a team card. */
  onPick: (teamId: TeamId) => void;
  /** UX-07: current selected game speed (read-only display; set only on GameSettingsScreen). */
  selectedSpeed: GameSpeed;
  /**
   * Phase 27 (D-07/D-09): pre-computed read-only settings line — null in Standard mode
   * (falls back to the plain speed label), a single "Speed | Team Type | Draft Pool" line
   * in Draft mode. Computed once in App.tsx via formatSettingsSummary — this component
   * never touches DraftPoolId formatting.
   */
  settingsSummary: string | null;
};

/**
 * Two-tab team selection screen (MLS / International) with 6 cards per tab.
 * Props are kept in App.tsx local state (D-14 — homePickedTeam not in Zustand).
 * Tab state is local React useState (D-14 — not Zustand; UI-only, not game state).
 */
export function TeamSelectionScreen({
  homePickedTeam,
  onPick,
  selectedSpeed,
  settingsSummary,
}: Props) {
  const playerSlot = useGameStore((s) => s.playerSlot);

  // D-11: home-first turn order
  const isHomeTurn = homePickedTeam === null;
  const iAmHome = playerSlot === 1;
  const iAmActive = isHomeTurn ? iAmHome : !iAmHome;

  const heading = isHomeTurn ? 'Home: choose your team' : 'Away: choose your team';
  const showWaiting = !iAmActive && isHomeTurn;

  // WR-03: compute once — avoids three repeated SPEED_OPTIONS.find() calls in the visitor branch.
  const selectedOption = SPEED_OPTIONS.find((o) => o.value === selectedSpeed);

  // D-13: Tab state is LOCAL React state — NOT Zustand (D-14 decision).
  // Default tab is MLS (D-13 / LEAGUE-01).
  const [activeLeague, setActiveLeague] = useState<'mls' | 'international'>('mls');

  // LEAGUE-02: Auto-switch only fires for the away player when home picks a team.
  // Guard by !iAmActive to prevent home player's tab jumping after their own pick (Pitfall 5).
  useEffect(() => {
    if (homePickedTeam !== null && !iAmActive) {
      const isInMls = MLS_TEAMS.includes(homePickedTeam);
      setActiveLeague(isInMls ? 'mls' : 'international');
    }
  }, [homePickedTeam, iAmActive]);

  const visibleTeams = activeLeague === 'mls' ? MLS_TEAMS : INTL_TEAMS;

  return (
    <div className={styles.screen}>
      <h2 className={styles.heading}>{heading}</h2>
      {showWaiting && <p className={styles.statusLine}>Waiting for home player to choose...</p>}
      {/* Phase 27 (D-07/D-09): speed is now set only on GameSettingsScreen — this section is
           always a read-only element: the plain speed label (Standard) or the single settings
           summary line (Draft), which stands alone with no "Match speed:" prefix. */}
      <div className={styles.speedSelector}>
        {settingsSummary !== null ? (
          <span className={styles.speedOptionActive}>{settingsSummary}</span>
        ) : (
          <>
            <span className={styles.statusLine}>Match speed:</span>
            <span
              className={`${styles.speedOptionActive} ${styles[selectedOption?.colorClass ?? 'speedColorStandard']}`}
            >
              <span className={styles.speedIcon}>{selectedOption?.icon}</span>
              {selectedOption?.label ?? selectedSpeed}
            </span>
          </>
        )}
      </div>
      {/* LEAGUE-01: Tab bar — MLS default (D-13); tab state is local React useState (D-14) */}
      <div role="tablist" className={styles.tabs}>
        <button
          role="tab"
          aria-selected={activeLeague === 'mls'}
          className={activeLeague === 'mls' ? styles.tabActive : styles.tab}
          onClick={() => setActiveLeague('mls')}
        >
          MLS
        </button>
        <button
          role="tab"
          aria-selected={activeLeague === 'international'}
          className={activeLeague === 'international' ? styles.tabActive : styles.tab}
          onClick={() => setActiveLeague('international')}
        >
          International
        </button>
      </div>
      {/* D-12: 3-column grid — SELECT-01, LEAGUE-01 */}
      <div className={styles.grid} role="tabpanel">
        {visibleTeams.map((teamId) => {
          const isStruckOut = teamId === homePickedTeam;
          const isDisabled = !iAmActive || isStruckOut;
          return (
            <button
              key={teamId}
              disabled={isDisabled}
              className={isStruckOut ? styles.cardStruckOut : styles.card}
              style={{
                borderColor: TEAM_CONFIGS[teamId].palette.homePrime,
                background: TEAM_CONFIGS[teamId].palette.homePrime,
              }}
              onClick={() => onPick(teamId)}
            >
              <span
                style={{
                  display: 'inline-flex',
                  width: 80,
                  height: 80,
                  borderRadius: '50%',
                  overflow: 'hidden',
                  flexShrink: 0,
                }}
              >
                <img
                  src={FULL_BADGE_MAP[teamId]}
                  alt={`${TEAM_CONFIGS[teamId].name} badge`}
                  width={80}
                  height={80}
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
