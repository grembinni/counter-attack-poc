import type { MatchStats } from '@counter-attack/shared';
import { useGameStore } from '../store/useGameStore.js';
import styles from './MatchSummaryContent.module.css';

type TeamPair = { home: number; away: number };

/**
 * Reads a single `MatchStats` member with a `?? 0` default on each side, per
 * this plan's interface contract — `matchStats` itself may be entirely
 * undefined (no shots/passes/etc. yet), in which case every row must still
 * render 0/0 rather than throw.
 */
function readPair(stats: MatchStats | undefined, key: keyof MatchStats): TeamPair {
  const pair = stats?.[key];
  return { home: pair?.home ?? 0, away: pair?.away ?? 0 };
}

/**
 * Standard diverging stat row (7 of the 8 rows; the possession row is its own
 * dedicated markup in this component, per 45-UI-SPEC.md's Possession special
 * case). `home`/`away` drive the bar's proportional split; `homeDisplay`/
 * `awayDisplay` optionally override the rendered numeral text (used by the
 * Tackles & Steals row's "{count} ({percent}%)" format) without affecting the
 * bar math, which always uses the raw `home`/`away` counts.
 */
function DivergingRow({
  label,
  home,
  away,
  homeDisplay,
  awayDisplay,
  homeValueClassName,
  awayValueClassName,
}: {
  label: string;
  home: number;
  away: number;
  homeDisplay?: string;
  awayDisplay?: string;
  homeValueClassName?: string | undefined;
  awayValueClassName?: string | undefined;
}) {
  const total = home + away;
  const noData = total === 0;
  const homeShare = noData ? 0 : home / total;
  const homePct = homeShare * 100;
  const awayPct = (1 - homeShare) * 100;

  return (
    <div className={styles.statRow}>
      <div className={styles.statRowText}>
        <span className={`${styles.statRowValue} ${homeValueClassName ?? styles.valueHome}`}>
          {homeDisplay ?? home}
        </span>
        <span className={styles.statRowLabel}>{label}</span>
        <span className={`${styles.statRowValue} ${awayValueClassName ?? styles.valueAway}`}>
          {awayDisplay ?? away}
        </span>
      </div>
      {noData ? (
        <div className={styles.barTrackNoData} />
      ) : (
        <div className={styles.barTrack}>
          <div className={`${styles.barHalf} ${styles.barHalfLeft}`}>
            <div className={styles.barSegmentHome} style={{ width: `${homePct}%` }} />
          </div>
          <div className={`${styles.barHalf} ${styles.barHalfRight}`}>
            <div className={styles.barSegmentAway} style={{ width: `${awayPct}%` }} />
          </div>
        </div>
      )}
    </div>
  );
}

/** STATS-06: whole-number success percentage, 0 attempts => 0 (PD-15). */
function tackleSuccessPercent(successes: number, attempts: number): number {
  return attempts === 0 ? 0 : Math.round((successes / attempts) * 100);
}

/**
 * `MatchSummaryContent` — the single reusable match-summary block (D-11)
 * consumed both by the standalone on-demand modal (plan 45-05) and appended
 * inside the existing HALF_TIME/FULL_TIME overlay. Strictly presentational:
 * every number comes from server-broadcast `GameState.matchStats`; this
 * component computes only pure display ratios (percentages, bar-segment
 * widths) — never an authoritative value (PD-18).
 */
export function MatchSummaryContent() {
  // Per-slice selectors only (STATE.md Pitfall 6) — mirrors GameBoard.tsx's style.
  const matchStats = useGameStore((s) => s.gameState.matchStats);
  const foulsEnabled = useGameStore((s) => s.gameState.foulsEnabled);
  const bookingEnabled = useGameStore((s) => s.gameState.bookingEnabled);
  const injuryEnabled = useGameStore((s) => s.gameState.injuryEnabled);
  const outOfBoundsEnabled = useGameStore((s) => s.gameState.outOfBoundsEnabled);
  const tackleStealDeclineEnabled = useGameStore((s) => s.gameState.tackleStealDeclineEnabled);
  const refereeCard = useGameStore((s) => s.gameState.refereeCard);

  // D-12/D-13/PD-17: six parenthetical toggle:state pairs, declared once as a
  // local array rather than hand-written six times. Every optional boolean is
  // read with `=== true`, never bare truthiness (existing codebase convention
  // documented on each field's own doc comment in types.ts).
  const refereeMode = refereeCard.wasManualOverride === true ? 'Manual' : 'Auto';
  const recapItems: { key: string; text: string }[] = [
    { key: 'fouls', text: `(Fouls: ${foulsEnabled === true ? 'Active' : 'Off'})` },
    { key: 'booking', text: `(Booking: ${bookingEnabled === true ? 'Active' : 'Off'})` },
    { key: 'injury', text: `(Injury: ${injuryEnabled === true ? 'Active' : 'Off'})` },
    {
      key: 'outOfBounds',
      text: `(Out-of-Bounds: ${outOfBoundsEnabled === true ? 'Active' : 'Off'})`,
    },
    {
      key: 'refereeLeniency',
      text: `(Referee Leniency: ${refereeMode} — ${refereeCard.leniency})`,
    },
    {
      key: 'tackleStealDecline',
      text: `(Tackle/Steal Decline: ${tackleStealDeclineEnabled === true ? 'On' : 'Off'})`,
    },
  ];

  const passesCompleted = readPair(matchStats, 'passesCompleted');
  const tackleStealAttempts = readPair(matchStats, 'tackleStealAttempts');
  const tackleStealSuccesses = readPair(matchStats, 'tackleStealSuccesses');
  const shots = readPair(matchStats, 'shots');
  const xg = readPair(matchStats, 'xg');
  const fouls = readPair(matchStats, 'fouls');
  const yellowCards = readPair(matchStats, 'yellowCards');
  const redCards = readPair(matchStats, 'redCards');

  return (
    <div className={styles.root}>
      <div className={styles.settingsSection}>
        <div className={styles.sectionLabel}>SETTINGS</div>
        <div className={styles.recapRow}>
          {recapItems.map((item) => (
            <span key={item.key}>{item.text}</span>
          ))}
        </div>
      </div>

      <hr className={styles.divider} />

      <div className={styles.statRows}>
        <DivergingRow
          label="PASSES COMPLETED"
          home={passesCompleted.home}
          away={passesCompleted.away}
        />
        <DivergingRow
          label="TACKLES & STEALS"
          home={tackleStealSuccesses.home}
          away={tackleStealSuccesses.away}
          homeDisplay={`${tackleStealSuccesses.home} (${tackleSuccessPercent(tackleStealSuccesses.home, tackleStealAttempts.home)}%)`}
          awayDisplay={`${tackleStealSuccesses.away} (${tackleSuccessPercent(tackleStealSuccesses.away, tackleStealAttempts.away)}%)`}
        />
        <DivergingRow label="SHOTS" home={shots.home} away={shots.away} />
        <DivergingRow label="EXPECTED GOALS (XG)" home={xg.home} away={xg.away} />
        <DivergingRow label="FOULS" home={fouls.home} away={fouls.away} />
        <DivergingRow
          label="YELLOW CARDS"
          home={yellowCards.home}
          away={yellowCards.away}
          homeValueClassName={styles.valueCardYellow}
          awayValueClassName={styles.valueCardYellow}
        />
        <DivergingRow
          label="RED CARDS"
          home={redCards.home}
          away={redCards.away}
          homeValueClassName={styles.valueCardRed}
          awayValueClassName={styles.valueCardRed}
        />
      </div>
    </div>
  );
}
