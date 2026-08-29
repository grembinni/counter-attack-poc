import { useGameStore } from '../store/useGameStore.js';
import { MatchScoreRow } from './MatchScoreRow.js';
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
 * Checkpoint 45-05-04 fix, round 1 (deviation, "info popup is not the same
 * as halftime as specified - include scoreboard in both"): this modal's
 * fixed, full-viewport backdrop (`.matchSummaryOverlay`, `position: fixed;
 * inset: 0;`) covers `GameBoard.tsx`'s persistent top-band scoreboard,
 * unlike the HALF_TIME/FULL_TIME overlay (`position: absolute` scoped to
 * `.pitchContainer` only, D-13 in 45-CONTEXT.md), which leaves it visible.
 * A score row is added directly below the title so both surfaces show live
 * score info — matching the HALF_TIME/FULL_TIME overlay's own untouched
 * score-row header (D-10), without touching `MatchSummaryContent` (which
 * stays D-11's single shared stats-only block, consumed identically by
 * both surfaces).
 *
 * Checkpoint 45-05-04 fix, round 2 (deviation, developer feedback verbatim:
 * "use the original size and display of the half time score on the
 * realtime pop - why are they 2 different elements... let me know if there
 * is a reason these are different despite the design push to use the same
 * element"): round 1 shipped a smaller, improvised score row (40px badges,
 * a locally-scoped 32px numeral) instead of reusing the HALF_TIME/FULL_TIME
 * overlay's own big score row (150px badges, 120px numerals). There was no
 * spec or technical constraint forcing that difference — 45-CONTEXT.md's
 * D-10 only constrains the HALF_TIME/FULL_TIME overlay's own header, never
 * the standalone modal's; it was an unstated judgment call. Both surfaces
 * now render the identical `MatchScoreRow` shell (see MatchScoreRow.tsx).
 * This modal's centre content is the live match clock (`actionCount`
 * formatted the same "MM:00" way GameBoard.tsx's own persistent `.clockRow`
 * already does, CLOCK-01) — the most natural choice per the coordinator's
 * guidance, since this modal can open at any point mid-match (not just at
 * a phase boundary like HALF_TIME/FULL_TIME) and the fixed backdrop hides
 * that persistent clock while the modal is open.
 */
export function MatchSummaryModal({ onClose }: { onClose: () => void }) {
  const actionCount = useGameStore((s) => s.gameState.actionCount);
  // CLOCK-01 (D-08/D-09, Phase 13): MM:00 format from actionCount — mirrors
  // GameBoard.tsx's own `clockDisplay` derivation verbatim (event-driven,
  // no client-side timer).
  const clockDisplay = String(actionCount).padStart(2, '0') + ':00';

  return (
    <div className={styles.matchSummaryOverlay}>
      <div className={styles.matchSummaryCard}>
        <div className={styles.header}>
          <span className={styles.title}>MATCH SUMMARY</span>
        </div>

        <MatchScoreRow center={<span className={styles.clockText}>{clockDisplay}</span>} />

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
