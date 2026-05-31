import { useGameStore } from './store/useGameStore.js';
import { GameBoard } from './components/GameBoard.js';
import { LobbyScreen } from './components/LobbyScreen.js';
import styles from './App.module.css';

/**
 * Root application component. Routes between lobby and game board screens
 * based on the Zustand `screen` field (D-12).
 * LobbyScreen handles CREATE_ROOM, JOIN_ROOM, and WAITING.
 * GameBoard handles GAME_BOARD.
 */
export function App() {
  const screen = useGameStore((s) => s.screen);

  return (
    <div className={styles.app}>{screen === 'GAME_BOARD' ? <GameBoard /> : <LobbyScreen />}</div>
  );
}
