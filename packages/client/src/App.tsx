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
    function onConnect() {
      const { screen: s, roomCode } = useGameStore.getState();
      console.log('[socket] connect — screen:', s, 'roomCode:', roomCode);
    }

    function onGameState(state: GameState) {
      setGameState(state);
      setDisconnectWarning(false);
      const s = useGameStore.getState().screen;
      console.log('[socket] game:state — screen:', s, 'phase:', state.phase);
      if (s !== 'GAME_BOARD') {
        setScreen('GAME_BOARD');
      }
    }

    function onRoomJoined(code: string, slot: 1 | 2, token: string) {
      console.log('[socket] room:joined — code:', code, 'slot:', slot, 'hasToken:', !!token);
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
      console.log('[socket] room:error —', reason);
      setRoomError(reason);
    }

    function onGameError(reason: string) {
      console.log('[socket] game:error —', reason);
      setGameError(reason);
    }

    function onDisconnectWarning() {
      console.log('[socket] game:disconnect-warning');
      setDisconnectWarning(true);
    }

    // Debug: log every raw event arriving on the socket
    function onAnyEvent(event: string, ...args: unknown[]) {
      console.log('[socket] RAW EVENT:', event, args);
    }

    socket.onAny(onAnyEvent);
    socket.on('connect', onConnect);
    socket.on(ServerEvents.GAME_STATE, onGameState);
    socket.on(ServerEvents.ROOM_JOINED, onRoomJoined);
    socket.on(ServerEvents.ROOM_ERROR, onRoomError);
    socket.on(ServerEvents.GAME_ERROR, onGameError);
    socket.on(ServerEvents.GAME_DISCONNECT_WARNING, onDisconnectWarning);

    socket.connect();
    console.log('[socket] connect() called — already connected:', socket.connected);

    if (socket.connected) {
      onConnect();
    }

    return () => {
      socket.offAny(onAnyEvent);
      socket.off('connect', onConnect);
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
