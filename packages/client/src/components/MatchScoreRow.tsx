import type { ReactNode } from 'react';
import { useGameStore } from '../store/useGameStore.js';
import { TeamBadge } from './TeamBadge.js';
import styles from './MatchScoreRow.module.css';

/**
 * `MatchScoreRow` — Phase 45 (Game Summary Popup, plan 45-05), checkpoint
 * 45-05-04 round-2 fix: the single shared big score-row shell (score
 * numeral + 150px `TeamBadge` + caller-supplied centre content + 150px
 * `TeamBadge` + score numeral), extracted from `GameBoard.tsx`'s
 * HALF_TIME/FULL_TIME overlay so the standalone `MatchSummaryModal` renders
 * the IDENTICAL visual treatment — same numeral size, same badge size —
 * rather than a smaller improvised variant.
 *
 * Developer feedback (checkpoint 45-05-04, round 2, verbatim): "use the
 * original size and display of the half time score on the realtime pop -
 * why are they 2 different elements cant we use the same popup? ... let me
 * know if there is a reason these are different despite the design push to
 * use the same element". There was no spec (45-CONTEXT.md D-10 only
 * constrains the HALF_TIME/FULL_TIME overlay's own header, never the
 * standalone modal's) or technical constraint forcing a difference — the
 * prior round's compact variant was an unstated judgment call, not a hard
 * blocker. This component removes that divergence.
 *
 * Self-contained: reads `score`/`selectedTeams` from the store itself
 * (mirrors `MatchSummaryContent`'s "reads everything it needs from
 * useGameStore itself" convention) rather than requiring every caller to
 * thread them through as props. Only the centre content differs by call
 * site — HALF_TIME/FULL_TIME's own HALF TIME/90:00/result copy, or the
 * standalone modal's live clock — so it is the one caller-supplied prop.
 */
export function MatchScoreRow({ center }: { center: ReactNode }) {
  const score = useGameStore((s) => s.gameState.score);
  const selectedTeams = useGameStore((s) => s.gameState.selectedTeams);

  return (
    <div className={styles.scoreRow}>
      <span className={`${styles.scoreNumeral} ${styles.accentHome}`}>{score.home}</span>
      <TeamBadge teamId={selectedTeams['home']} size={150} full />
      <div className={styles.centerColumn}>{center}</div>
      <TeamBadge teamId={selectedTeams['away']} size={150} full />
      <span className={`${styles.scoreNumeral} ${styles.accentAway}`}>{score.away}</span>
    </div>
  );
}
