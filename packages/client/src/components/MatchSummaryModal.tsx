import { MatchSummaryContent } from './MatchSummaryContent.js';
import styles from './MatchSummaryModal.module.css';

/**
 * `MatchSummaryModal` — Phase 45 (Game Summary Popup, plan 45-05): standalone
 * on-demand modal chrome wrapping the single shared `MatchSummaryContent`
 * block (D-11 — never a forked copy). This component holds no state of its
 * own; the open/closed boolean lives in `GameBoard.tsx` (task 45-05-02),
 * mirroring how `subOpen` is owned by `GameBoard` rather than by the
 * substitution panel it renders.
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
 * T-45-18/T-45-19: two explicit dismiss controls exist (the `×` and the
 * footer `Close`), both wired to the same `onClose`. There is deliberately
 * no backdrop-click-to-dismiss handler — a stray click on the backdrop
 * during a live match should not silently close a panel the player may
 * still be reading, and the two deliberate exits already cover dismissal.
 */
export function MatchSummaryModal({ onClose }: { onClose: () => void }) {
  return (
    <div className={styles.matchSummaryOverlay}>
      <div className={styles.matchSummaryCard}>
        <div className={styles.header}>
          <span className={styles.title}>MATCH SUMMARY</span>
          <button
            type="button"
            className={styles.closeIconButton}
            aria-label="Close match summary"
            onClick={onClose}
          >
            &times;
          </button>
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
