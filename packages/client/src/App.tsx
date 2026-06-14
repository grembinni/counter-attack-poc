import { useEffect, useState } from 'react';
import { useGameStore } from './store/useGameStore.js';
import { GameBoard } from './components/GameBoard.js';
import { LobbyScreen } from './components/LobbyScreen.js';
import { TeamSelectionScreen } from './components/TeamSelectionScreen.js';
import styles from './App.module.css';
import { socket } from './socket.js';
import { ServerEvents, ClientEvents } from '@counter-attack/shared';
import type { GameState, TeamId } from '@counter-attack/shared';

export function App() {
  const screen = useGameStore((s) => s.screen);
  const setScreen = useGameStore((s) => s.setScreen);
  const setGameState = useGameStore((s) => s.setGameState);
  const setPlayerSlot = useGameStore((s) => s.setPlayerSlot);
  const setRoomCode = useGameStore((s) => s.setRoomCode);
  const setDisconnectWarning = useGameStore((s) => s.setDisconnectWarning);
  const setRoomError = useGameStore((s) => s.setRoomError);
  const setGameError = useGameStore((s) => s.setGameError);

  // D-14: homePickedTeam is local state in App.tsx (not in Zustand store)
  const [homePickedTeam, setHomePickedTeam] = useState<TeamId | null>(null);

  useEffect(() => {
    function onGameState(state: GameState) {
      setGameState(state);
      setDisconnectWarning(false);
      // D-12 (Phase 13): HALF_TIME and FULL_TIME fall through to GAME_BOARD — overlays in GameBoard.
      if (state.phase === 'REPLAY') {
        setScreen('REPLAY');
      } else {
        // Covers KICK_OFF_SETUP, KICK_OFF, MOVEMENT, PASS, SHOT, HALF_TIME, FULL_TIME, etc.
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
      if (slot === 1 && (s === 'LANDING' || s === 'CREATE_ROOM')) setScreen('WAITING');
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

    // Phase 16 D-10/D-11: team selection socket handlers (Pitfall 9 — every on has a matching off)
    function onTeamSelectionStart() {
      setHomePickedTeam(null);
      setScreen('TEAM_SELECTION');
    }

    function onTeamHomePicked(teamId: TeamId) {
      setHomePickedTeam(teamId);
    }

    socket.on(ServerEvents.GAME_STATE, onGameState);
    socket.on(ServerEvents.ROOM_JOINED, onRoomJoined);
    socket.on(ServerEvents.ROOM_ERROR, onRoomError);
    socket.on(ServerEvents.GAME_ERROR, onGameError);
    socket.on(ServerEvents.GAME_DISCONNECT_WARNING, onDisconnectWarning);
    socket.on(ServerEvents.TEAM_SELECTION_START, onTeamSelectionStart);
    socket.on(ServerEvents.TEAM_HOME_PICKED, onTeamHomePicked);

    socket.connect();

    return () => {
      socket.off(ServerEvents.GAME_STATE, onGameState);
      socket.off(ServerEvents.ROOM_JOINED, onRoomJoined);
      socket.off(ServerEvents.ROOM_ERROR, onRoomError);
      socket.off(ServerEvents.GAME_ERROR, onGameError);
      socket.off(ServerEvents.GAME_DISCONNECT_WARNING, onDisconnectWarning);
      socket.off(ServerEvents.TEAM_SELECTION_START, onTeamSelectionStart);
      socket.off(ServerEvents.TEAM_HOME_PICKED, onTeamHomePicked);
    };
  }, []);

  // D-14: emits team:pick to server; called from TeamSelectionScreen onPick prop
  function handleTeamPick(teamId: TeamId) {
    socket.emit(ClientEvents.TEAM_PICK, teamId);
  }

  return (
    <div className={styles.app}>
      {screen === 'GAME_BOARD' || screen === 'REPLAY' ? (
        <GameBoard />
      ) : screen === 'TEAM_SELECTION' ? (
        <TeamSelectionScreen homePickedTeam={homePickedTeam} onPick={handleTeamPick} />
      ) : (
        <LobbyScreen />
      )}
    </div>
  );
}
