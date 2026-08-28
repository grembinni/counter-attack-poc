import { useGameStore } from '../store/useGameStore.js';
import { TeamBadge } from './TeamBadge.js';
import { MatchSummaryContent } from './MatchSummaryContent.js';
import styles from './MatchSummaryModal.module.css';

/**
 * `MatchSummaryModal` — Phase 45 (Game Summary Popup, plan 45-05): standalone
 * on-demand modal chrome wrapping the single shared `MatchSummaryContent`
 * block (D-11 — never a forked copy). This component holds no state of its
 * own beyond the score/team reads below; the open/closed boolean lives in
 * `GameBoard.tsx` (task 45-05-02), mirroring how `subOpen` is owned by
 * `GameBoard` rather than by the substitution panel it renders.
 *
 * T-45-17: this component imports nothing from `../socket.js` and emits no
 * socket event — opening and closing the summary is purely local UI, exactly
 * as opening the substitution panel is. Pinned by a named test in
 * `GameBoard.matchSummary.test.tsx` asserting the socket mock's `emit` is
 * never called when the scoreboard icon is clicked.
 *
 * Critical rendering constraint (interface_contract, 45-05-PLAN.md): the
 * `--home-accent`/`--away-accent`/`--team-accent` custom properties are
 * injected on `GameBoard.tsx`'s root element and inherit through the DOM
 * tree, not the layout tree. `position: fixed` on `.matchSummaryOverlay` is
 * therefore safe — but this component MUST be rendered as a DOM descendant
 * of that root. It is deliberately NOT rendered through a React portal to
 * `document.body`.
 *
 * Checkpoint 45-05-04 fix (deviation — developer-requested during live
 * verification, "popup has x in corner remove"): the corner `×` dismiss
 * control has been REMOVED. T-45-18's original mitigation described two
 * explicit dismiss controls (`×` and footer `Close`); this now relies on
 * the single, always-visible footer `Close` button, pinned outside the
 * scroll region so it can never be scrolled out of reach. There is
 * deliberately still no backdrop-click-to-dismiss handler — a stray click
 * on the backdrop during a live match should not silently close a panel
 * the player may still be reading.
 *
 * Checkpoint 45-05-04 fix (deviation, "info popup is not the same as
 * halftime as specified - include scoreboard in both"): this modal's fixed,
 * full-viewport backdrop (`.matchSummaryOverlay`, `position: fixed; inset:
 * 0;`) covers `GameBoard.tsx`'s persistent top-band scoreboard, unlike the
 * HALF_TIME/FULL_TIME overlay (`position: absolute` scoped to
 * `.pitchContainer` only, D-13 in 45-CONTEXT.md), which leaves it visible.
 * A compact score row (team badges + score numerals) is added directly
 * below the title so both surfaces show live score info — matching the
 * HALF_TIME/FULL_TIME overlay's own untouched score-row header (D-10),
 * without touching `MatchSummaryContent` (which stays D-11's single shared
 * stats-only block, consumed identically by both surfaces).
 */
export function MatchSummaryModal({ onClose }: { onClose: () => void }) {
  const score = useGameStore((s) => s.gameState.score);
  const selectedTeams = useGameStore((s) => s.gameState.selectedTeams);

  return (
    <div className={styles.matchSummaryOverlay}>
      <div className={styles.matchSummaryCard}>
        <div className={styles.header}>
          <span className={styles.title}>MATCH SUMMARY</span>
        </div>

        <div className={styles.scoreboardRow}>
          <span className={`${styles.scoreNumeral} ${styles.accentHome}`}>{score.home}</span>
          <TeamBadge teamId={selectedTeams['home']} size={40} />
          <TeamBadge teamId={selectedTeams['away']} size={40} />
          <span className={`${styles.scoreNumeral} ${styles.accentAway}`}>{score.away}</span>
        </div>

        <div className={styles.scrollBody}>
          <MatchSummaryContent />
        </div>

        <div className={styles.footer}>
          <button type="button" className={styles.footerButton} onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
