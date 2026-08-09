import { useEffect, useRef, useState } from 'react';
import type { ActionEvent, GamePhase } from '@counter-attack/shared';
import { useGameStore } from '../store/useGameStore.js';
import styles from './EventBanner.module.css';

/**
 * 38-15 defect 4 / 38-19: phase-keyed restart banner table.
 *
 * Keyed by each restart's ENTRY phase — exactly one row per restart family. Adding a second
 * phase value from the same family (e.g. a later stage of the corner-kick sequence) would
 * double-fire a banner on the intra-family transition, so this table must stay one-entry-
 * per-family (T-38-66).
 *
 * Phase-driven rather than event-driven: the Free Kick award emits no `ActionEvent` at all
 * (`triggerOffsideFoul` appends nothing to `eventLog`), so an event-keyed table could not cover
 * all four restarts uniformly. A phase-entry table is also immune to the STATE.md v1.6 pitfall
 * "EventBanner only inspects the last new event per broadcast" — this effect never inspects
 * events at all.
 *
 * Penalty Kick (the fifth restart named by 38-15 defect 4) has no `GamePhase` entry point yet —
 * it is Phase 39 scope (see .planning/phases/38-corner-kick/deferred-items.md, "From Plan 38-19
 * (restart banners)"). Adding it later is exactly one row in this table.
 */
export const RESTART_BANNERS: Partial<Record<GamePhase, string>> = {
  THROW_IN_SETUP: 'Throw In!',
  GOAL_KICK_SETUP_GK: 'Goal Kick!',
  CORNER_KICK_GK_SETUP_ATTACKING: 'Corner Kick!',
  FREE_KICK_SETUP: 'Free Kick!',
};

/**
 * Maps a qualifying ActionEvent to its banner message, variant, and display duration.
 * Returns null when the event does not warrant a banner.
 *
 * Qualifying events (UX-14):
 *   GOAL                           -> 'GOOOOOAL!!!'          (goal variant,    1000ms)
 *   STEAL_ATTEMPT result=SUCCESS   -> 'INTERCEPTION!!'       (notable variant, 1000ms)
 *   TACKLE_ATTEMPT result=SUCCESS  -> 'Tackle! Turnover!'    (notable variant, 1000ms)
 *   LOOSE_BALL_LAND                -> 'Loose Ball.'          (notable variant, 1000ms)
 *   HP_ACCURACY accurate=true      -> 'Accurate Pass!'       (notable variant, 1500ms)
 *   HP_ACCURACY accurate=false     -> 'Loose Ball!'          (notable variant, 1500ms)
 */
function getBannerMessage(
  event: ActionEvent,
): { message: string; variant: 'goal' | 'notable'; duration: number } | null {
  if (event.type === 'GOAL') {
    return { message: 'GOOOOOAL!!!', variant: 'goal', duration: 1000 };
  }
  if (event.type === 'STEAL_ATTEMPT' && event.result === 'SUCCESS') {
    return { message: 'INTERCEPTION!!', variant: 'notable', duration: 1000 };
  }
  if (event.type === 'TACKLE_ATTEMPT' && event.result === 'SUCCESS') {
    return { message: 'Tackle! Turnover!', variant: 'notable', duration: 1000 };
  }
  if (event.type === 'LOOSE_BALL_LAND') {
    return { message: 'Loose Ball.', variant: 'notable', duration: 1000 };
  }
  // D-20 (Phase 25): pass accuracy result notification — replaces push-button confirmation.
  // Exact wording from user specification: 'Accurate Pass!' or 'Loose Ball!'.
  // Holds for 1500ms (longer than other banners) to give players time to register the result
  // before the game auto-advances to the header contestant selection.
  if (event.type === 'HP_ACCURACY') {
    return {
      message: event.accurate ? 'Accurate Pass!' : 'Loose Ball!',
      variant: 'notable',
      duration: 1500,
    };
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
  const phase = useGameStore((s) => s.gameState.phase);

  // Ref tracks the last eventLog length we processed — prevents re-firing
  // the same event on unrelated re-renders (D-03 lastPieceRef pattern).
  const lastProcessedLengthRef = useRef<number>(eventLog.length);

  // 38-19: ref tracks the last phase we processed, initialised to the current phase on first
  // render — mirrors lastProcessedLengthRef's mount-safety so a mount into a restart phase
  // (e.g. a reconnect snapshot landing mid-restart) never fires a banner (T-38-64/threat register
  // "reconnect snapshot to banner").
  const prevPhaseRef = useRef<GamePhase>(phase);

  const [active, setActive] = useState<{
    message: string;
    variant: 'goal' | 'notable';
    duration: number;
  } | null>(null);

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

  // 38-19: phase-entry diff-and-trigger, mirroring the eventLog effect above. Fires at most once
  // per restart entry — edge-detected against prevPhaseRef, not re-fired on every broadcast while
  // the restart phase is active (T-38-64). The ref advances unconditionally, whether or not a
  // banner fired, matching the existing effect's discipline.
  useEffect(() => {
    if (phase === prevPhaseRef.current) return;
    const message = RESTART_BANNERS[phase];
    prevPhaseRef.current = phase;
    if (message !== undefined) {
      setActive({ message, variant: 'notable', duration: 1000 });
    }
  }, [phase]);

  // Auto-dismiss timer: clear the banner after the variant-specific duration.
  // HP_ACCURACY uses 1500ms (D-20 / UX-15); all other events use 1000ms.
  // The `animationDuration` inline style keeps the CSS bannerFade animation aligned with the
  // timer so the fade-out completes at the same moment the DOM element is removed.
  useEffect(() => {
    if (active === null) return;
    const timerId = setTimeout(() => {
      setActive(null);
    }, active.duration);
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
      style={{ animationDuration: `${active.duration}ms` }}
    >
      {active.message}
    </div>
  );
}
