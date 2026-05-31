import { HexGrid } from './HexGrid.js';
import styles from './GameBoard.module.css';

/**
 * Full game board layout: header bar, pitch container (HexGrid), and right sidebar.
 * Sidebar contains placeholder panels for TurnIndicator and ActionLog — implemented in Plan 06-03.
 * Layout spec: UI-SPEC §Layout Spec (header 48px, pitch flex:1, sidebar 280px).
 */
export function GameBoard() {
  return (
    <div className={styles.gameBoard}>
      <header className={styles.header}>
        <span>Counter Attack</span>
      </header>
      <main className={styles.gameLayout}>
        <div className={styles.pitchContainer}>
          <HexGrid />
        </div>
        <aside className={styles.sidebar}>
          <div className={styles.turnIndicatorPlaceholder}>Turn Indicator (coming in Plan 03)</div>
          <div className={styles.actionLogPlaceholder}>Action Log (coming in Plan 03)</div>
        </aside>
      </main>
    </div>
  );
}
