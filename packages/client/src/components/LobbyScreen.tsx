import { useState } from 'react';
import { useGameStore } from '../store/useGameStore.js';
import styles from './LobbyScreen.module.css';

const MOCK_CODE = 'MOCK42';

/** Copy Code button with 2-second "Copied!" feedback. */
function CopyButton() {
  const [label, setLabel] = useState<'Copy Code' | 'Copied!'>('Copy Code');

  function handleClick() {
    void navigator.clipboard.writeText(MOCK_CODE);
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

  return (
    <>
      <h1 className={styles.heading}>Create Room</h1>
      <p className={styles.body}>Share this code with your opponent.</p>
      <div className={styles.roomCode}>{MOCK_CODE}</div>
      <CopyButton />
      <button className={styles.subLink} onClick={() => setScreen('JOIN_ROOM')}>
        Or join an existing room &rarr;
      </button>
      <button className={styles.ctaButton} onClick={() => setScreen('GAME_BOARD')}>
        View Game Board &rarr;
      </button>
    </>
  );
}

/** Join Room sub-screen. */
function JoinRoomScreen() {
  const setScreen = useGameStore((s) => s.setScreen);
  const [input, setInput] = useState('');

  function handleSubmit() {
    if (input.length === 0) return;
    setScreen('WAITING');
  }

  return (
    <>
      <h1 className={styles.heading}>Join Room</h1>
      <p className={styles.body}>Enter the room code from your opponent.</p>
      <input
        className={styles.input}
        type="text"
        placeholder="Room code"
        maxLength={6}
        value={input}
        onChange={(e) => setInput(e.target.value.toUpperCase())}
      />
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
  return (
    <>
      <h1 className={styles.heading}>Waiting for opponent...</h1>
      <p className={styles.body}>Share this code to invite someone:</p>
      <div className={styles.roomCode}>{MOCK_CODE}</div>
      <CopyButton />
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
