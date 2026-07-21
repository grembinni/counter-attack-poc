import { useEffect, useState } from 'react';
import { useGameStore } from './store/useGameStore.js';
import { GameBoard } from './components/GameBoard.js';
import { LobbyScreen } from './components/LobbyScreen.js';
import { GameSettingsScreen } from './components/GameSettingsScreen.js';
import { TeamSelectionScreen } from './components/TeamSelectionScreen.js';
import { UniformSelectionScreen } from './components/UniformSelectionScreen.js';
import { LineupAssignmentScreen } from './components/LineupAssignmentScreen.js';
import { formatSettingsSummary } from './constants/settingsSummary.js';
import styles from './App.module.css';
import { socket } from './socket.js';
import { ServerEvents, ClientEvents } from '@counter-attack/shared';
import type {
  DraftPoolId,
  FormationId,
  GameSpeed,
  GameState,
  TeamId,
  TeamType,
  UniformStyleId,
} from '@counter-attack/shared';

export function App() {
  const screen = useGameStore((s) => s.screen);
  const setScreen = useGameStore((s) => s.setScreen);
  const setGameState = useGameStore((s) => s.setGameState);
  const setPlayerSlot = useGameStore((s) => s.setPlayerSlot);
  const setRoomCode = useGameStore((s) => s.setRoomCode);
  const setDisconnectWarning = useGameStore((s) => s.setDisconnectWarning);
  const setRoomError = useGameStore((s) => s.setRoomError);
  const setGameError = useGameStore((s) => s.setGameError);
  // Phase 24: playerSlot read from store to determine own formation in onBothFormationsConfirmed
  const playerSlot = useGameStore((s) => s.playerSlot);

  // D-14: homePickedTeam is local state in App.tsx (not in Zustand store)
  const [homePickedTeam, setHomePickedTeam] = useState<TeamId | null>(null);
  // UX-07 (Phase 18.4): selectedSpeed is local state in App.tsx, co-located with homePickedTeam
  const [selectedSpeed, setSelectedSpeed] = useState<GameSpeed>('standard');
  // Phase 27: teamType/draftPools set only via GameSettingsScreen's confirm callback
  // (handleSettingsConfirm) or the ROOM_SETTINGS_CONFIRMED broadcast (joiner, host echo).
  // Threaded into formatSettingsSummary(...) for the read-only settings summary shown on
  // TeamSelectionScreen/UniformSelectionScreen (27-04, D-07/D-09).
  const [teamType, setTeamType] = useState<TeamType>('standard');
  const [draftPools, setDraftPools] = useState<DraftPoolId[]>([]);
  // Phase 22 D-15: homeConfirmedStyle is local state — received via UNIFORM_HOME_CONFIRMED
  const [homeConfirmedStyle, setHomeConfirmedStyle] = useState<UniformStyleId | null>(null);
  // Phase 24: lineup local state — mirrors homePickedTeam pattern (not in Zustand — Pitfall 7)
  const [lineupAssignment, setLineupAssignment] = useState<string[] | null>(null);
  const [lineupConfirmed, setLineupConfirmed] = useState(false);
  const [myFormationId, setMyFormationId] = useState<FormationId | null>(null);
  // Phase 24: own confirmed team — set on UNIFORM_CONFIRM so lineup screen has correct badge
  const [myConfirmedTeamId, setMyConfirmedTeamId] = useState<TeamId | null>(null);

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
      // Phase 27 D-01: host lands on the settings pre-step screen (was 'WAITING') — the host
      // explicitly transitions to WAITING themselves after ROOM_SETTINGS_CONFIRMED arrives.
      if (slot === 1 && (s === 'LANDING' || s === 'CREATE_ROOM')) setScreen('GAME_SETTINGS');
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
      // Phase 22: route straight to UNIFORM_SELECTION — single combined team+uniform screen (no tabs).
      setScreen('UNIFORM_SELECTION');
    }

    function onTeamHomePicked(teamId: TeamId) {
      setHomePickedTeam(teamId);
    }

    // Phase 27 (DRAFT-01/D-02/D-03): broadcast carrying the host's confirmed settings.
    // Host receives this as the echo of their own ROOM_SETTINGS_CONFIRM emit and moves off
    // GAME_SETTINGS to WAITING; joiner receives it at join-time and never sees GAME_SETTINGS.
    function onRoomSettingsConfirmed(
      speed: GameSpeed,
      confirmedTeamType: TeamType,
      pools: DraftPoolId[],
    ) {
      setSelectedSpeed(speed);
      setTeamType(confirmedTeamType);
      setDraftPools(pools);
      if (useGameStore.getState().screen === 'GAME_SETTINGS') setScreen('WAITING');
    }

    // Phase 22 D-13/D-15: uniform selection socket handlers (Pitfall 9 — every on has a matching off)
    function onUniformSelectionStart() {
      setScreen('UNIFORM_SELECTION');
    }

    function onUniformHomeConfirmed(teamId: TeamId, uniformStyle: UniformStyleId) {
      // Set homePickedTeam so away sees home's team struck out in UniformSelectionScreen (Phase 22).
      // IN-04 (Phase 27 review): formationId (3rd arg) is no longer consumed here — Phase 24
      // moved formation-for-lineup plumbing to BOTH_FORMATIONS_CONFIRMED/myFormationId below.
      setHomePickedTeam(teamId);
      setHomeConfirmedStyle(uniformStyle);
    }

    function onBothFormationsConfirmed(homeFormation: FormationId, awayFormation: FormationId) {
      // Phase 24: no longer sets a locked flag — instead tracks own formation for lineup screen.
      // playerSlot is read from store outside the effect; snapshot via getState() avoids stale closure.
      const slot = useGameStore.getState().playerSlot;
      setMyFormationId(slot === 1 ? homeFormation : awayFormation);
    }

    // Phase 24 D-21: LINEUP_ASSIGNMENT_READY — routes to lineup screen, resets confirm state
    function onLineupAssignmentReady(assignment: string[]) {
      setLineupAssignment(assignment);
      setLineupConfirmed(false);
      setScreen('LINEUP_ASSIGNMENT');
    }

    // Phase 24 D-21/D-22: LINEUP_ASSIGNMENT_UPDATED — server-authoritative swap result (supports repeated swaps)
    function onLineupAssignmentUpdated(assignment: string[]) {
      setLineupAssignment(assignment);
    }

    socket.on(ServerEvents.GAME_STATE, onGameState);
    socket.on(ServerEvents.ROOM_JOINED, onRoomJoined);
    socket.on(ServerEvents.ROOM_ERROR, onRoomError);
    socket.on(ServerEvents.GAME_ERROR, onGameError);
    socket.on(ServerEvents.GAME_DISCONNECT_WARNING, onDisconnectWarning);
    socket.on(ServerEvents.TEAM_SELECTION_START, onTeamSelectionStart);
    socket.on(ServerEvents.TEAM_HOME_PICKED, onTeamHomePicked);
    socket.on(ServerEvents.ROOM_SETTINGS_CONFIRMED, onRoomSettingsConfirmed);
    socket.on(ServerEvents.UNIFORM_SELECTION_START, onUniformSelectionStart);
    socket.on(ServerEvents.UNIFORM_HOME_CONFIRMED, onUniformHomeConfirmed);
    socket.on(ServerEvents.BOTH_FORMATIONS_CONFIRMED, onBothFormationsConfirmed);
    socket.on(ServerEvents.LINEUP_ASSIGNMENT_READY, onLineupAssignmentReady);
    socket.on(ServerEvents.LINEUP_ASSIGNMENT_UPDATED, onLineupAssignmentUpdated);

    socket.connect();

    return () => {
      socket.off(ServerEvents.GAME_STATE, onGameState);
      socket.off(ServerEvents.ROOM_JOINED, onRoomJoined);
      socket.off(ServerEvents.ROOM_ERROR, onRoomError);
      socket.off(ServerEvents.GAME_ERROR, onGameError);
      socket.off(ServerEvents.GAME_DISCONNECT_WARNING, onDisconnectWarning);
      socket.off(ServerEvents.TEAM_SELECTION_START, onTeamSelectionStart);
      socket.off(ServerEvents.TEAM_HOME_PICKED, onTeamHomePicked);
      socket.off(ServerEvents.ROOM_SETTINGS_CONFIRMED, onRoomSettingsConfirmed);
      socket.off(ServerEvents.UNIFORM_SELECTION_START, onUniformSelectionStart);
      socket.off(ServerEvents.UNIFORM_HOME_CONFIRMED, onUniformHomeConfirmed);
      socket.off(ServerEvents.BOTH_FORMATIONS_CONFIRMED, onBothFormationsConfirmed);
      socket.off(ServerEvents.LINEUP_ASSIGNMENT_READY, onLineupAssignmentReady);
      socket.off(ServerEvents.LINEUP_ASSIGNMENT_UPDATED, onLineupAssignmentUpdated);
    };
  }, []);

  // D-14: emits team:pick to server; called from TeamSelectionScreen onPick prop
  function handleTeamPick(teamId: TeamId) {
    socket.emit(ClientEvents.TEAM_PICK, teamId);
  }

  // Phase 27 (DRAFT-01/D-01/D-03): called from GameSettingsScreen's onConfirm; stores the
  // bundled settings locally and emits ROOM_SETTINGS_CONFIRM. The screen transition to
  // WAITING happens on the ROOM_SETTINGS_CONFIRMED echo (onRoomSettingsConfirmed), not here.
  function handleSettingsConfirm(settings: {
    speed: GameSpeed;
    teamType: TeamType;
    draftPools: DraftPoolId[];
  }) {
    setSelectedSpeed(settings.speed);
    setTeamType(settings.teamType);
    setDraftPools(settings.draftPools);
    socket.emit(ClientEvents.ROOM_SETTINGS_CONFIRM, settings);
  }

  // Phase 22 D-14 / Phase 23: emits uniform:confirm with formationId + jerseyType to server
  function handleUniformConfirm(
    teamId: TeamId,
    uniformStyle: UniformStyleId,
    formationId: FormationId,
    jerseyType: 'home' | 'away',
  ) {
    setMyConfirmedTeamId(teamId);
    socket.emit(ClientEvents.UNIFORM_CONFIRM, teamId, uniformStyle, formationId, jerseyType);
  }

  // Phase 24 D-19: emit LINEUP_SWAP when player drops a card onto another
  function handleLineupSwap(slotIndexA: number, slotIndexB: number) {
    socket.emit(ClientEvents.LINEUP_SWAP, { slotIndexA, slotIndexB });
  }

  // Phase 24 D-23/D-25: emit LINEUP_CONFIRM and set local confirmed state
  function handleLineupConfirm(confirmedOrder: string[]) {
    socket.emit(ClientEvents.LINEUP_CONFIRM, { confirmedOrder });
    setLineupConfirmed(true);
  }

  return (
    <div className={styles.app}>
      {screen === 'GAME_BOARD' || screen === 'REPLAY' ? (
        <GameBoard />
      ) : screen === 'LINEUP_ASSIGNMENT' ? (
        <LineupAssignmentScreen
          assignment={lineupAssignment!}
          formationId={myFormationId!}
          playerSlot={playerSlot!}
          myTeamId={myConfirmedTeamId!}
          onSwap={handleLineupSwap}
          onConfirm={handleLineupConfirm}
          lineupConfirmed={lineupConfirmed}
        />
      ) : screen === 'GAME_SETTINGS' ? (
        <GameSettingsScreen onConfirm={handleSettingsConfirm} />
      ) : screen === 'UNIFORM_SELECTION' ? (
        <UniformSelectionScreen
          homePickedTeam={homePickedTeam}
          homeConfirmedStyle={homeConfirmedStyle}
          onConfirm={handleUniformConfirm}
          selectedSpeed={selectedSpeed}
          settingsSummary={formatSettingsSummary(selectedSpeed, teamType, draftPools)}
        />
      ) : screen === 'TEAM_SELECTION' ? (
        <TeamSelectionScreen
          homePickedTeam={homePickedTeam}
          onPick={handleTeamPick}
          selectedSpeed={selectedSpeed}
          settingsSummary={formatSettingsSummary(selectedSpeed, teamType, draftPools)}
        />
      ) : (
        <LobbyScreen />
      )}
    </div>
  );
}
