import { useGameStore } from '../store/useGameStore.js';
import styles from './DisconnectBanner.module.css';

/**
 * Fixed full-width banner shown when opponent disconnects (D-13).
 * Reads disconnectWarning from Zustand; auto-dismisses when App.tsx
 * receives the next game:state and calls setDisconnectWarning(false).
 */
export function DisconnectBanner() {
  const disconnectWarning = useGameStore((s) => s.disconnectWarning);
  if (!disconnectWarning) return null;

  return (
    <div className={styles.banner} role="alert">
      Opponent disconnected. Waiting for them to reconnect… (90s)
    </div>
  );
}
