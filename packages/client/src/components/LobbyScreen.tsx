import { useState, useEffect } from 'react';
import { useGameStore } from '../store/useGameStore.js';
import { socket } from '../socket.js';
import { ClientEvents } from '@counter-attack/shared';
import styles from './LobbyScreen.module.css';

/** Copy Code button with 2-second "Copied!" feedback. */
function CopyButton({ code }: { code: string | null }) {
  const [label, setLabel] = useState<'Copy Code' | 'Copied!'>('Copy Code');

  function handleClick() {
    void navigator.clipboard?.writeText(code ?? '').catch(() => undefined);
    setLabel('Copied!');
    setTimeout(() => {
      setLabel('Copy Code');
    }, 2000);
  }

  return (
    <button className={styles.ctaButton} onClick={handleClick}>
      {label}
    </button>
  );
}

/** Landing page — entry point shown to new visitors. */
function LandingScreen() {
  const setScreen = useGameStore((s) => s.setScreen);
  return (
    <>
      <h1 className={styles.landingTitle}>Counter Attack</h1>
      <p className={styles.landingSubtitle}>Real-time 2-player hex football strategy</p>
      <div className={styles.buttonRow}>
        <button className={styles.ctaButton} onClick={() => socket.emit(ClientEvents.ROOM_CREATE)}>
          Create Game
        </button>
        <button className={styles.ctaButton} onClick={() => setScreen('JOIN_ROOM')}>
          Join Game
        </button>
      </div>
    </>
  );
}

/** Create Room sub-screen. */
function CreateRoomScreen() {
  const setScreen = useGameStore((s) => s.setScreen);
  const roomCode = useGameStore((s) => s.roomCode);

  if (!roomCode) {
    return (
      <>
        <h1 className={styles.heading}>Create Room</h1>
        <p className={styles.body}>Generate a room code to share with your opponent.</p>
        <button className={styles.ctaButton} onClick={() => socket.emit(ClientEvents.ROOM_CREATE)}>
          Generate Room Code
        </button>
        <button className={styles.subLink} onClick={() => setScreen('LANDING')}>
          &larr; Back
        </button>
      </>
    );
  }

  return (
    <>
      <h1 className={styles.heading}>Create Room</h1>
      <p className={styles.body}>Share this code with your opponent.</p>
      <div className={styles.roomCode}>{roomCode}</div>
      <CopyButton code={roomCode} />
      <button className={styles.subLink} onClick={() => setScreen('LANDING')}>
        &larr; Back
      </button>
    </>
  );
}

/** Join Room sub-screen. */
function JoinRoomScreen() {
  const setScreen = useGameStore((s) => s.setScreen);
  const roomError = useGameStore((s) => s.roomError);
  const setRoomError = useGameStore((s) => s.setRoomError);
  const [input, setInput] = useState('');
  const [isJoining, setIsJoining] = useState(false);

  useEffect(() => {
    if (roomError) setIsJoining(false);
  }, [roomError]);

  function handleSubmit() {
    if (input.length === 0 || isJoining) return;
    setRoomError(null);
    setIsJoining(true);
    socket.emit(ClientEvents.ROOM_JOIN, input);
  }

  function mapError(reason: string): string {
    if (reason === 'NOT_FOUND' || reason === 'INVALID_CODE') {
      return 'Room not found. Check the code and try again.';
    }
    if (reason === 'NOT_WAITING' || reason === 'FULL' || reason === 'ALREADY_IN_ROOM') {
      return 'This room is already in progress.';
    }
    return 'Could not join room. Try again.';
  }

  return (
    <>
      <h1 className={styles.heading}>Join Room</h1>
      <p className={styles.body}>Enter the room code from your opponent.</p>
      <input
        className={styles.input}
        type="text"
        placeholder="Room code"
        maxLength={5}
        value={input}
        onChange={(e) => setInput(e.target.value.toUpperCase())}
        onKeyDown={(e) => {
          if (e.key === 'Enter') handleSubmit();
        }}
      />
      {roomError && <span className={styles.errorText}>{mapError(roomError)}</span>}
      <button
        className={styles.ctaButton}
        disabled={input.length === 0 || isJoining}
        onClick={handleSubmit}
      >
        {isJoining ? 'Joining...' : 'Join Game'}
      </button>
      <button className={styles.subLink} onClick={() => setScreen('LANDING')}>
        &larr; Back
      </button>
    </>
  );
}

/** Waiting for opponent sub-screen. */
function WaitingScreen() {
  const setScreen = useGameStore((s) => s.setScreen);
  const roomCode = useGameStore((s) => s.roomCode);

  return (
    <>
      <h1 className={styles.heading}>Waiting for opponent...</h1>
      <p className={styles.body}>Share the code above with your opponent.</p>
      <div className={styles.roomCode}>{roomCode ?? 'Loading…'}</div>
      <CopyButton code={roomCode} />
      <div className={styles.dots}>
        <span className={styles.dot} style={{ animationDelay: '0s' }} />
        <span className={styles.dot} style={{ animationDelay: '0.2s' }} />
        <span className={styles.dot} style={{ animationDelay: '0.4s' }} />
      </div>
      <button className={styles.subLink} onClick={() => setScreen('LANDING')}>
        &larr; Back
      </button>
    </>
  );
}

/**
 * Lobby screen: renders Create Room, Join Room, or Waiting sub-screen
 * based on the Zustand `screen` field (D-12, D-13).
 */
export function LobbyScreen() {
  const screen = useGameStore((s) => s.screen);

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        {screen === 'LANDING' ? (
          <LandingScreen />
        ) : screen === 'JOIN_ROOM' ? (
          <JoinRoomScreen />
        ) : screen === 'WAITING' ? (
          <WaitingScreen />
        ) : (
          <CreateRoomScreen />
        )}
      </div>
    </div>
  );
}
