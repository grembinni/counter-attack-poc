import type { ActionEvent } from '@counter-attack/shared';
import { useGameStore } from '../store/useGameStore.js';
import styles from './ActionLog.module.css';

/**
 * Formats an ActionEvent as a human-readable string.
 * Uses JSX string interpolation only — never dangerouslySetInnerHTML (T-06-06).
 * Switch is exhaustive over all 6 ActionEvent types.
 */
function formatEvent(event: ActionEvent): { prefix: string; content: string; isGoal: boolean } {
  switch (event.type) {
    case 'MOVE':
      return {
        prefix: '[MOVE]',
        content: ` ${event.pieceId} (${event.slot}) ${event.from.q},${event.from.r} → ${event.to.q},${event.to.r}`,
        isGoal: false,
      };
    case 'SLOT_ADVANCE':
      return {
        prefix: '[SLOT]',
        content: ` ${event.from} → ${event.to ?? 'END'}`,
        isGoal: false,
      };
    case 'DICE_ROLL':
      return {
        prefix: '[DICE]',
        content: ` Rolled ${event.result}`,
        isGoal: false,
      };
    case 'STEAL_ATTEMPT':
      return {
        prefix: '[STEAL]',
        content: ` ${event.defenderId} — ${event.result}`,
        isGoal: false,
      };
    case 'GOAL':
      return {
        prefix: '[GOAL]',
        content: ` ${event.scoringTeam.toUpperCase()} scored!`,
        isGoal: true,
      };
    case 'KICK_OFF':
      return {
        prefix: '[KICK OFF]',
        content: ' Match started',
        isGoal: false,
      };
  }
}

/**
 * Action log panel: last 10 ActionEvents in reverse-chronological order.
 * UI-SPEC §Action Log Spec. GOAL entries use #e8a020.
 */
export function ActionLog() {
  const eventLog = useGameStore((s) => s.gameState.eventLog);

  const recentEvents = [...eventLog].reverse().slice(0, 10);

  return (
    <div className={styles.panel}>
      <div className={styles.panelHeader}>ACTION LOG</div>
      {recentEvents.length === 0 ? (
        <p className={styles.empty}>No actions yet.</p>
      ) : (
        recentEvents.map((event, index) => {
          const { prefix, content, isGoal } = formatEvent(event);
          return (
            <div className={styles.entry} key={index}>
              <span className={styles.prefix}>{prefix}</span>
              <span className={isGoal ? styles.goalContent : styles.content}>{content}</span>
            </div>
          );
        })
      )}
    </div>
  );
}
