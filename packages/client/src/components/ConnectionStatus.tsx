import { useState, useEffect } from 'react';
import { socket } from '../socket.js';
import styles from './ConnectionStatus.module.css';

type Status = 'connected' | 'reconnecting' | 'disconnected';

const STATUS_COLOR: Record<Status, string> = {
  connected: '#22c55e',
  reconnecting: '#eab308',
  disconnected: '#ef4444',
};

const STATUS_LABEL: Record<Status, string> = {
  connected: 'Connected',
  reconnecting: 'Reconnecting…',
  disconnected: 'Disconnected',
};

/**
 * Three-state socket connection indicator (D-12).
 * Uses local React state — connection status is ephemeral UI, not game state.
 * CRITICAL: reconnect_attempt is a Manager event on socket.io, NOT a socket event (RESEARCH Pitfall 6).
 */
export function ConnectionStatus() {
  const [status, setStatus] = useState<Status>('disconnected');

  useEffect(() => {
    function onConnect() {
      setStatus('connected');
    }
    function onDisconnect() {
      setStatus('disconnected');
    }
    function onReconnectAttempt() {
      setStatus('reconnecting');
    }

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.io.on('reconnect_attempt', onReconnectAttempt);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.io.off('reconnect_attempt', onReconnectAttempt);
    };
  }, []);

  return (
    <div className={styles.container}>
      <span
        className={styles.dot}
        style={{ background: STATUS_COLOR[status] }}
        aria-hidden="true"
      />
      <span className={styles.label}>{STATUS_LABEL[status]}</span>
    </div>
  );
}
