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

/** Create Room sub-screen. */
function CreateRoomScreen() {
  const setScreen = useGameStore((s) => s.setScreen);
  const roomCode = useGameStore((s) => s.roomCode);

  useEffect(() => {
    socket.emit(ClientEvents.ROOM_CREATE);
  }, []);

  return (
    <>
      <h1 className={styles.heading}>Create Room</h1>
      <p className={styles.body}>Share this code with your opponent.</p>
      <div className={styles.roomCode}>
        {roomCode ?? <span style={{ color: '#a0a0a0', fontWeight: 400 }}>Generating…</span>}
      </div>
      <CopyButton code={roomCode} />
      <button className={styles.subLink} onClick={() => setScreen('JOIN_ROOM')}>
        Or join an existing room &rarr;
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

  function handleSubmit() {
    if (input.length === 0) return;
    setRoomError(null);
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
      />
      {roomError && <span className={styles.errorText}>{mapError(roomError)}</span>}
      <button className={styles.ctaButton} disabled={input.length === 0} onClick={handleSubmit}>
        Join Game
      </button>
      <button className={styles.subLink} onClick={() => setScreen('CREATE_ROOM')}>
        Or create a new room &rarr;
      </button>
    </>
  );
}

/** Waiting for opponent sub-screen. */
function WaitingScreen() {
  const roomCode = useGameStore((s) => s.roomCode);

  return (
    <>
      <h1 className={styles.heading}>Waiting for opponent...</h1>
      <p className={styles.body}>Share this code to invite someone:</p>
      <div className={styles.roomCode}>{roomCode ?? 'Loading…'}</div>
      <CopyButton code={roomCode} />
      <div className={styles.dots}>
        <span className={styles.dot} style={{ animationDelay: '0s' }} />
        <span className={styles.dot} style={{ animationDelay: '0.2s' }} />
        <span className={styles.dot} style={{ animationDelay: '0.4s' }} />
      </div>
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
        {screen === 'JOIN_ROOM' ? (
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
