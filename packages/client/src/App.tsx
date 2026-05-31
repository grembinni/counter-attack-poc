import { useEffect } from 'react';
import { useGameStore } from './store/useGameStore.js';
import { GameBoard } from './components/GameBoard.js';
import { LobbyScreen } from './components/LobbyScreen.js';
import styles from './App.module.css';
import { socket } from './socket.js';
import { ClientEvents, ServerEvents } from '@counter-attack/shared';
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
    // Emit room:create on connect — fires exactly once per actual connection event,
    // preventing the StrictMode double-invoke bug (CreateRoomScreen.useEffect fired twice).
    // Guard: only if still on CREATE_ROOM with no room yet.
    function onConnect() {
      const { screen: s, roomCode } = useGameStore.getState();
      if (s === 'CREATE_ROOM' && !roomCode) {
        socket.emit(ClientEvents.ROOM_CREATE);
      }
    }

    function onGameState(state: GameState) {
      setGameState(state);
      setDisconnectWarning(false);
      // Advance to board from WAITING (creator path) or JOIN_ROOM (joiner path).
      const s = useGameStore.getState().screen;
      if (s === 'WAITING' || s === 'JOIN_ROOM') {
        setScreen('GAME_BOARD');
      }
    }

    function onRoomJoined(code: string, slot: 1 | 2, token: string) {
      if (token) localStorage.setItem('ca_session_token', token);
      setRoomCode(code);
      setPlayerSlot(slot);
      const s = useGameStore.getState().screen;
      // Creator (slot 1): advance CREATE_ROOM → WAITING to show the room code.
      // Joiner (slot 2): stay on JOIN_ROOM — game:state will fire immediately and
      // advance to GAME_BOARD, avoiding a visible WAITING flash.
      if (slot === 1 && s === 'CREATE_ROOM') setScreen('WAITING');
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

    socket.on('connect', onConnect);
    socket.on(ServerEvents.GAME_STATE, onGameState);
    socket.on(ServerEvents.ROOM_JOINED, onRoomJoined);
    socket.on(ServerEvents.ROOM_ERROR, onRoomError);
    socket.on(ServerEvents.GAME_ERROR, onGameError);
    socket.on(ServerEvents.GAME_DISCONNECT_WARNING, onDisconnectWarning);

    socket.connect();

    // Fallback: if already connected (HMR reload or StrictMode remount where socket
    // persisted from the previous mount), the connect event won't fire again — call
    // onConnect directly so room:create is still emitted.
    if (socket.connected) {
      onConnect();
    }

    return () => {
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
