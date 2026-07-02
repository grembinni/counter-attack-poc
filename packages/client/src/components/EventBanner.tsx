import { useEffect, useRef, useState } from 'react';
import type { ActionEvent } from '@counter-attack/shared';
import { useGameStore } from '../store/useGameStore.js';
import styles from './EventBanner.module.css';

/**
 * Maps a qualifying ActionEvent to its banner message and variant.
 * Returns null when the event does not warrant a banner.
 *
 * Qualifying events (UX-14):
 *   GOAL                           -> 'GOOOOOAL!!!'          (goal variant)
 *   STEAL_ATTEMPT result=SUCCESS   -> 'INTERCEPTION!!'       (notable variant)
 *   TACKLE_ATTEMPT result=SUCCESS  -> 'Tackle! Turnover!'    (notable variant)
 *   LOOSE_BALL_LAND                -> 'Loose Ball.'          (notable variant)
 */
function getBannerMessage(
  event: ActionEvent,
): { message: string; variant: 'goal' | 'notable' } | null {
  if (event.type === 'GOAL') {
    return { message: 'GOOOOOAL!!!', variant: 'goal' };
  }
  if (event.type === 'STEAL_ATTEMPT' && event.result === 'SUCCESS') {
    return { message: 'INTERCEPTION!!', variant: 'notable' };
  }
  if (event.type === 'TACKLE_ATTEMPT' && event.result === 'SUCCESS') {
    return { message: 'Tackle! Turnover!', variant: 'notable' };
  }
  if (event.type === 'LOOSE_BALL_LAND') {
    return { message: 'Loose Ball.', variant: 'notable' };
  }
  return null;
}

/**
 * UX-14: Transient centered banner for key match events.
 *
 * Subscribes to gameState.eventLog via a Zustand selector.
 * Uses a ref (lastProcessedLengthRef) to track the last-seen eventLog length
 * so each event fires the banner at most once — mirroring GameBoard.tsx's
 * lastPieceRef D-03 "ref tracks last seen value" pattern.
 *
 * Auto-dismisses after 1000ms (fade-in 100ms / hold 800ms / fade-out 100ms).
 * Returns null when no banner is active.
 */
export function EventBanner() {
  const eventLog = useGameStore((s) => s.gameState.eventLog);

  // Ref tracks the last eventLog length we processed — prevents re-firing
  // the same event on unrelated re-renders (D-03 lastPieceRef pattern).
  const lastProcessedLengthRef = useRef<number>(eventLog.length);

  const [active, setActive] = useState<{ message: string; variant: 'goal' | 'notable' } | null>(
    null,
  );

  // Diff-and-trigger: runs in an effect on eventLog change so setActive is
  // never called during render. The ref is advanced even when no banner fires
  // so the same events are never re-processed on subsequent effect invocations.
  useEffect(() => {
    if (eventLog.length <= lastProcessedLengthRef.current) return;
    const tailEvent = eventLog[eventLog.length - 1];
    const banner = tailEvent !== undefined ? getBannerMessage(tailEvent) : null;
    // Always advance the ref regardless of whether a banner fired —
    // ensures we don't re-process the same events on the next render.
    lastProcessedLengthRef.current = eventLog.length;
    if (banner !== null) {
      setActive(banner);
    }
  }, [eventLog]);

  // Auto-dismiss timer: clear the banner after 1000ms (100ms in + 800ms hold + 100ms out).
  // The CSS animation handles the visual fade; this clears the DOM element entirely.
  useEffect(() => {
    if (active === null) return;
    const timerId = setTimeout(() => {
      setActive(null);
    }, 1000);
    return () => {
      clearTimeout(timerId);
    };
  }, [active]);

  if (active === null) return null;

  return (
    <div
      role="status"
      aria-live="assertive"
      className={`${styles.banner} ${active.variant === 'goal' ? styles.goal : styles.notable}`}
    >
      {active.message}
    </div>
  );
}
