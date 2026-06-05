import { useEffect } from 'react';
import { useGameStore } from './store/useGameStore.js';
import { GameBoard } from './components/GameBoard.js';
import { LobbyScreen } from './components/LobbyScreen.js';
import { HalfTimeScreen } from './components/HalfTimeScreen.js';
import { FullTimeScreen } from './components/FullTimeScreen.js';
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
    function onGameState(state: GameState) {
      setGameState(state);
      setDisconnectWarning(false);
      // Phase 8: route to new screens by phase (D-28, D-30, D-31)
      if (state.phase === 'HALF_TIME') {
        setScreen('HALF_TIME');
      } else if (state.phase === 'FULL_TIME') {
        setScreen('FULL_TIME');
      } else if (state.phase === 'REPLAY') {
        setScreen('REPLAY');
      } else {
        // Covers KICK_OFF_SETUP, KICK_OFF, MOVEMENT, PASS, SHOT, etc. — pitch stays visible
        const s = useGameStore.getState().screen;
        if (s !== 'GAME_BOARD') setScreen('GAME_BOARD');
      }
    }

    function onRoomJoined(code: string, slot: 1 | 2, token: string) {
      setRoomCode(code);
      if (token) {
        // Non-empty token means this is OUR join confirmation — store credential and slot.
        // Empty token is a notification that the OTHER player joined; do not overwrite our slot.
        sessionStorage.setItem('ca_session_token', token);
        setPlayerSlot(slot);
      }
      const s = useGameStore.getState().screen;
      if (slot === 1 && s === 'CREATE_ROOM') setScreen('WAITING');
    }

    function onRoomError(reason: string) {
      if (reason === 'SESSION_EXPIRED') {
        sessionStorage.removeItem('ca_session_token');
        setScreen('CREATE_ROOM');
        return;
      }
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

    socket.connect();

    return () => {
      socket.off(ServerEvents.GAME_STATE, onGameState);
      socket.off(ServerEvents.ROOM_JOINED, onRoomJoined);
      socket.off(ServerEvents.ROOM_ERROR, onRoomError);
      socket.off(ServerEvents.GAME_ERROR, onGameError);
      socket.off(ServerEvents.GAME_DISCONNECT_WARNING, onDisconnectWarning);
    };
  }, []);

  return (
    <div className={styles.app}>
      {screen === 'GAME_BOARD' ? (
        <GameBoard />
      ) : screen === 'HALF_TIME' ? (
        <HalfTimeScreen />
      ) : screen === 'FULL_TIME' ? (
        <FullTimeScreen />
      ) : screen === 'REPLAY' ? (
        // REPLAY phase uses the board layout so pieces are visible; ReplayPanel in sidebar (08-06)
        <GameBoard />
      ) : (
        <LobbyScreen />
      )}
    </div>
  );
}
