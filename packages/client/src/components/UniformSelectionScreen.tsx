/**
 * UniformSelectionScreen — Phase 22 D-01/D-02/D-03, extended in Phase 23 D-05/D-06/D-07.
 * Combined team + formation + style selection screen. Replaces TeamSelectionScreen in the pre-game flow.
 * - All 12 teams flat (no tabs), MLS first then International (D-02).
 * - Formation section (4 cards) between team grid and style grid (Phase 23 D-05).
 * - All 18 style tiles always visible; neutral palette before team selection (D-05).
 * - defaultUniformStyle pre-selected on team pick (D-09 / UNIFORM-03).
 * - Single Confirm locks all three choices; away sees struck-out home card (D-04).
 * - After home confirms, away sees "Opponent confirmed" banner (D-11).
 */
import { useState, useEffect } from 'react';
import { useGameStore } from '../store/useGameStore.js';
import { TEAM_CONFIGS, UNIFORM_STYLE_META, FORMATIONS } from '@counter-attack/shared';
import type {
  GameSpeed,
  TeamId,
  TeamPalette,
  UniformStyleId,
  FormationId,
} from '@counter-attack/shared';
import { UNIFORM_STYLES } from '../styles/uniformStyles.js';
import styles from './UniformSelectionScreen.module.css';

// Phase 23 D-06: static Vite imports for formation PNG pitch diagrams — content-hashed at build time.
import formation442 from '../assets/formations/442.png';
import formation532 from '../assets/formations/532.png';
import formation433 from '../assets/formations/433.png';
import formation343 from '../assets/formations/343.png';

// D-13: static Vite imports for full-size badge variants — content-hashed at build time.
import cityFullBadge from '../assets/badges/city-full.png';
import crewFullBadge from '../assets/badges/crew-full.png';
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

const NEUTRAL_PALETTE: TeamPalette = {
  homePrime: '#555',
  homeAlt: '#888',
  homeFont: '#fff',
  awayPrime: '#555',
  awayAlt: '#888',
  awayFont: '#fff',
  uiColor: '#555',
};

/** D-02: MLS teams first, then International — flat layout, no tabs. */
const ALL_TEAMS: TeamId[] = [
  'city',
  'crew',
  'la',
  'miami',
  'nashville',
  'seattle', // MLS
  'canada',
  'england',
  'france',
  'mexico',
  'spain',
  'us', // International
];

/** All 18 uniform style IDs in registry order. */
const ALL_STYLE_IDS = Object.keys(UNIFORM_STYLES) as UniformStyleId[];

/** Phase 23 D-06: four formation cards in selection order (4-4-2 first per D-07 default). */
const FORMATION_OPTIONS: { id: FormationId; asset: string; label: string }[] = [
  { id: '4-4-2', asset: formation442, label: '4-4-2' },
  { id: '5-3-2', asset: formation532, label: '5-3-2' },
  { id: '4-3-3', asset: formation433, label: '4-3-3' },
  { id: '3-4-3', asset: formation343, label: '3-4-3' },
];

/** Maps TeamId to full-size badge Vite import URL. */
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

/** UX-07: speed options with display labels, icons, and per-speed CSS color classes. */
const SPEED_OPTIONS: { value: GameSpeed; label: string; icon: string; colorClass: string }[] = [
  { value: 'slow', label: 'Slow', icon: '🐢', colorClass: 'speedColorSlow' },
  { value: 'standard', label: 'Standard', icon: '⚽', colorClass: 'speedColorStandard' },
  { value: 'fast', label: 'Fast', icon: '⚡', colorClass: 'speedColorFast' },
];

type Props = {
  /** The team that home player has already picked (from TEAM_HOME_PICKED), or null. */
  homePickedTeam: TeamId | null;
  /** Set when home player has confirmed their team + style (UNIFORM_HOME_CONFIRMED), or null. */
  homeConfirmedStyle: UniformStyleId | null;
  /** Phase 23 D-12: formation chosen by home player on their confirm (for Phase 24 use). */
  homeConfirmedFormation: FormationId | null;
  /** Called when the active player clicks Confirm with their team + style + formation choices. */
  onConfirm: (teamId: TeamId, uniformStyle: UniformStyleId, formationId: FormationId) => void;
  /** UX-07: current selected game speed (home-player controlled). */
  selectedSpeed: GameSpeed;
  /** UX-07: called when home player changes game speed. */
  onSpeedChange: (speed: GameSpeed) => void;
};

/**
 * Combined team + uniform style selection screen (Phase 22).
 * Both team grid and style tile grid on one screen; one Confirm button locks both choices.
 */
export function UniformSelectionScreen({
  homePickedTeam,
  homeConfirmedStyle,
  homeConfirmedFormation: _homeConfirmedFormation,
  onConfirm,
  selectedSpeed,
  onSpeedChange,
}: Props) {
  const playerSlot = useGameStore((s) => s.playerSlot);

  const iAmHome = playerSlot === 1;
  // Away player is locked out until home has confirmed their team + style.
  const awayLocked = !iAmHome && homeConfirmedStyle === null;

  const [selectedTeam, setSelectedTeam] = useState<TeamId | null>(null);
  const [selectedStyle, setSelectedStyle] = useState<UniformStyleId | null>(null);
  // Phase 23 D-07: 4-4-2 pre-selected on mount; no useEffect — default is a constant.
  const [selectedFormation, setSelectedFormation] = useState<FormationId>('4-4-2');
  const [hasConfirmed, setHasConfirmed] = useState(false);

  // Step 1 = home choosing; step 2 = visitor choosing (after home confirms).
  const step = homeConfirmedStyle === null ? 1 : 2;
  const currentPlayerLabel = step === 1 ? 'HOME' : 'VISITOR';
  const isActiveNow = !hasConfirmed && !awayLocked;
  const youOrOpponent = (step === 1 && iAmHome) || (step === 2 && !iAmHome) ? 'YOU' : 'OPPONENT';
  const waitingForLabel = iAmHome ? 'Visitor' : 'Home';

  // D-09 / UNIFORM-03: pre-select team's defaultUniformStyle when a team is chosen.
  useEffect(() => {
    if (selectedTeam !== null) {
      setSelectedStyle(TEAM_CONFIGS[selectedTeam].defaultUniformStyle);
    }
  }, [selectedTeam]);

  // Style tiles render in the player's own color scheme: away uses awayPrime/awayAlt.
  const tileRenderPalette: TeamPalette = (() => {
    if (!selectedTeam) return NEUTRAL_PALETTE;
    const p = TEAM_CONFIGS[selectedTeam].palette;
    if (iAmHome) return p;
    return { ...p, homePrime: p.awayPrime, homeAlt: p.awayAlt, homeFont: p.awayFont };
  })();

  // WR-03: compute once for the speed selector visitor branch.
  const selectedOption = SPEED_OPTIONS.find((o) => o.value === selectedSpeed);

  return (
    <div className={styles.screen}>
      {/* MATCH SETUP heading — step + player + you/opponent */}
      <h2 className={styles.matchSetupHeading}>
        MATCH SETUP: STEP {step} &mdash; {currentPlayerLabel} PLAYER ({youOrOpponent})
      </h2>

      {/* Active/waiting status */}
      <p className={isActiveNow ? styles.statusActive : styles.statusWaiting}>
        {isActiveNow
          ? 'Make your selections now!'
          : `Waiting for ${waitingForLabel} Player to Lock in their Selection.`}
      </p>

      <p className={styles.browseNote}>You are browsing your Team, Formation, and Piece Style.</p>

      {/* 0 | MATCH SPEED */}
      <p className={styles.sectionLabel}>0 | MATCH SPEED</p>
      {iAmHome ? (
        <div className={styles.speedOptions}>
          {SPEED_OPTIONS.map(({ value, label, icon, colorClass }) => (
            <button
              key={value}
              disabled={hasConfirmed}
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
        <div className={styles.speedOptions}>
          <span
            className={`${styles.speedOptionActive} ${styles[selectedOption?.colorClass ?? 'speedColorStandard']}`}
          >
            <span className={styles.speedIcon}>{selectedOption?.icon}</span>
            {selectedOption?.label ?? selectedSpeed}
          </span>
        </div>
      )}

      {/* 1 | TEAM */}
      <p className={styles.sectionLabel}>1 | TEAM</p>
      <div className={styles.teamGrid}>
        {ALL_TEAMS.map((teamId) => {
          const isStruckOut = teamId === homePickedTeam;
          const isDisabled = isStruckOut || hasConfirmed || awayLocked;
          const bgColor = TEAM_CONFIGS[teamId].palette.homePrime;
          return (
            <button
              key={teamId}
              disabled={isDisabled}
              aria-pressed={teamId === selectedTeam}
              aria-label={TEAM_CONFIGS[teamId].name}
              className={
                isStruckOut
                  ? styles.teamCardStruckOut
                  : teamId === selectedTeam
                    ? styles.teamCardSelected
                    : styles.teamCard
              }
              style={{ background: bgColor }}
              onClick={() => {
                if (!isDisabled) setSelectedTeam(teamId);
              }}
            >
              <img
                src={FULL_BADGE_MAP[teamId]}
                alt={`${TEAM_CONFIGS[teamId].name} badge`}
                className={styles.teamBadge}
              />
            </button>
          );
        })}
      </div>

      {/* 2 | FORMATION */}
      <p className={styles.sectionLabel}>2 | FORMATION</p>
      <div className={styles.formationGrid}>
        {FORMATION_OPTIONS.map(({ id, asset, label }) => (
          <button
            key={id}
            disabled={hasConfirmed || awayLocked}
            aria-pressed={id === selectedFormation}
            aria-label={`${label} formation`}
            aria-disabled={hasConfirmed || awayLocked}
            className={
              id === selectedFormation ? styles.formationCardSelected : styles.formationCard
            }
            onClick={() => {
              if (!hasConfirmed && !awayLocked) setSelectedFormation(id);
            }}
          >
            <img src={asset} alt={`${label} formation diagram`} className={styles.formationImage} />
            <p className={styles.formationLabel}>{label}</p>
            <p className={styles.formationDescription}>{FORMATIONS[id].description}</p>
          </button>
        ))}
      </div>

      {/* 3 | STYLE */}
      <p className={styles.sectionLabel}>3 | STYLE</p>
      <div className={styles.styleGrid}>
        {ALL_STYLE_IDS.map((styleId, index) => {
          const n = index + 1;
          const isHomeStyle = !iAmHome && homeConfirmedStyle === styleId;
          const result = UNIFORM_STYLES[styleId]({
            cx: 40,
            cy: 40,
            R: 30,
            palette: tileRenderPalette,
            isGK: false,
            pieceId: `style-${n}`,
          });
          const accentColor = selectedTeam ? tileRenderPalette.homePrime : '#e0e0e0';
          const tileClass = isHomeStyle
            ? styles.styleTileStruckOut
            : styleId === selectedStyle
              ? styles.styleTileSelected
              : styles.styleTile;
          return (
            <button
              key={styleId}
              disabled={hasConfirmed || awayLocked || isHomeStyle}
              aria-pressed={styleId === selectedStyle}
              aria-label={UNIFORM_STYLE_META[styleId].name}
              className={tileClass}
              style={
                styleId === selectedStyle && !isHomeStyle
                  ? { borderColor: accentColor, boxShadow: `0 0 0 2px ${accentColor}` }
                  : undefined
              }
              onClick={() => !awayLocked && !isHomeStyle && setSelectedStyle(styleId)}
            >
              <svg width={80} height={80} xmlns="http://www.w3.org/2000/svg">
                <defs>{result.patternDef}</defs>
                <circle cx={40} cy={40} r={30} fill={result.fill} />
                {result.overlay}
                <text
                  x={40}
                  y={49}
                  textAnchor="middle"
                  fontSize={26}
                  fontWeight={700}
                  fill={selectedTeam ? tileRenderPalette.homeFont : '#fff'}
                  pointerEvents="none"
                >
                  {n}
                </text>
              </svg>
            </button>
          );
        })}
      </div>

      {/* Confirm button — yellow until team selected, green after */}
      {!hasConfirmed && (
        <button
          className={selectedTeam !== null ? styles.confirmButtonGreen : styles.confirmButtonYellow}
          disabled={selectedTeam === null || selectedStyle === null || awayLocked}
          aria-disabled={selectedTeam === null || selectedStyle === null || awayLocked}
          aria-label="Confirm selection"
          onClick={() => {
            if (selectedTeam && selectedStyle) {
              onConfirm(selectedTeam, selectedStyle, selectedFormation);
              setHasConfirmed(true);
            }
          }}
        >
          Confirm
        </button>
      )}
    </div>
  );
}
