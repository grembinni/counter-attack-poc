import { useEffect } from 'react';
import { useGameStore } from './store/useGameStore.js';
import { GameBoard } from './components/GameBoard.js';
import { LobbyScreen } from './components/LobbyScreen.js';
import styles from './App.module.css';
import { socket } from './socket.js';
import { ServerEvents } from '@counter-attack/shared';
import type { GameState } from '@counter-attack/shared';

export function App() {
  const screen = useGameStore((s) => s.screen);
  const setScreen = useGameStore((s) => s.setScreen);
  const setGameState = useGameStore((s) => s.setGameState);
  const setPlayerSlot = useGameStore((s) => s.setPlayerSlot);
  const setRoomCode = useGameStore((s) => s.setRoomCode);
  const setDisconnectWarning = useGameStore((s) => s.setDisconnectWarning);
  const setRoomError = useGameStore((s) => s.setRoomError);
  const setGameError = useGameStore((s) => s.setGameError);

  useEffect(() => {
    socket.connect();

    function onGameState(state: GameState) {
      setGameState(state);
      setDisconnectWarning(false);
      if (useGameStore.getState().screen === 'WAITING') {
        setScreen('GAME_BOARD');
      }
    }

    function onRoomJoined(code: string, slot: 1 | 2, token: string) {
      if (token) localStorage.setItem('ca_session_token', token);
      setRoomCode(code);
      setPlayerSlot(slot);
      const currentScreen = useGameStore.getState().screen;
      if (currentScreen === 'CREATE_ROOM' || currentScreen === 'JOIN_ROOM') setScreen('WAITING');
    }

    function onRoomError(reason: string) {
      setRoomError(reason);
    }

    function onGameError(reason: string) {
      setGameError(reason);
    }

    function onDisconnectWarning() {
      setDisconnectWarning(true);
    }

    socket.on(ServerEvents.GAME_STATE, onGameState);
    socket.on(ServerEvents.ROOM_JOINED, onRoomJoined);
    socket.on(ServerEvents.ROOM_ERROR, onRoomError);
    socket.on(ServerEvents.GAME_ERROR, onGameError);
    socket.on(ServerEvents.GAME_DISCONNECT_WARNING, onDisconnectWarning);

    return () => {
      socket.off(ServerEvents.GAME_STATE, onGameState);
      socket.off(ServerEvents.ROOM_JOINED, onRoomJoined);
      socket.off(ServerEvents.ROOM_ERROR, onRoomError);
      socket.off(ServerEvents.GAME_ERROR, onGameError);
      socket.off(ServerEvents.GAME_DISCONNECT_WARNING, onDisconnectWarning);
    };
  }, []);

  return (
    <div className={styles.app}>{screen === 'GAME_BOARD' ? <GameBoard /> : <LobbyScreen />}</div>
  );
}
