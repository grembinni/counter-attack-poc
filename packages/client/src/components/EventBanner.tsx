import { useCallback, useEffect, useRef, useState } from 'react';
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
 * Penalty Kick (the fifth restart named by 38-15 defect 4) is now covered by the
 * `PENALTY_KICK_SETUP_ATTACKING` row below (Plan 39-04) — see
 * .planning/phases/38-corner-kick/deferred-items.md, "From Plan 38-19 (restart banners)" for the
 * original deferral note. Per the one-entry-per-family invariant (T-38-66) above, only the
 * attacking-setup entry phase is registered — NOT `PENALTY_KICK_SETUP_DEFENDING`,
 * `PENALTY_KICK_TAKER_SELECT`, or `PENALTY_KICK`.
 */
export const RESTART_BANNERS: Partial<Record<GamePhase, string>> = {
  THROW_IN_SETUP: 'Throw In!',
  GOAL_KICK_SETUP_GK: 'Goal Kick!',
  CORNER_KICK_GK_SETUP_ATTACKING: 'Corner Kick!',
  FREE_KICK_SETUP: 'Free Kick!',
  PENALTY_KICK_SETUP_ATTACKING: 'Penalty Kick!',
};

/**
 * Banner payload. `cardColor`/`dogso` are only set for BOOKING_CHECK-derived banners
 * (Plan 39-04, D-03) — every other banner variant leaves them undefined.
 */
type Banner = {
  message: string;
  variant: 'goal' | 'notable';
  duration: number;
  cardColor?: 'yellow' | 'red';
  dogso?: boolean;
};

/**
 * Maps a qualifying ActionEvent to its banner message, variant, and display duration.
 * Returns null when the event does not warrant a banner.
 *
 * `pieceName` resolves a piece id to its display name — built by the component from a
 * `gameState.pieces` store selector (mirroring ActionLog.tsx's `pieceName` pattern) and passed
 * in here since this function is module-scope and cannot call hooks itself.
 *
 * Qualifying events (UX-14, extended by Plan 39-04 for D-02/D-03):
 *   GOAL                           -> 'GOOOOOAL!!!'                (goal variant,    1000ms)
 *   STEAL_ATTEMPT result=SUCCESS   -> 'INTERCEPTION!!'             (notable variant, 1000ms)
 *   TACKLE_ATTEMPT result=SUCCESS  -> 'Tackle! Turnover!'          (notable variant, 1000ms)
 *   LOOSE_BALL_LAND                -> 'Loose Ball.'                (notable variant, 1000ms)
 *   HP_ACCURACY accurate=true      -> 'Accurate Pass!'             (notable variant, 1500ms)
 *   HP_ACCURACY accurate=false     -> 'Loose Ball!'                (notable variant, 1500ms)
 *   FOUL_CALLED                    -> 'Foul!'                      (notable variant, 1000ms — always)
 *   INJURY_CHECK injured=true      -> '<name> is Injured!'         (notable variant, 1000ms)
 *   INJURY_CHECK injured=false     -> null (no impact on play, D-02)
 *   BOOKING_CHECK card='none'      -> null (no impact on play, D-02)
 *   BOOKING_CHECK card='yellow'    -> '<name> — Yellow Card'       (notable variant, 1000ms, cardColor: 'yellow')
 *   BOOKING_CHECK card='red', 2nd  -> '<name> — Red Card (2nd Yellow)' (cardColor: 'red')
 *   BOOKING_CHECK card='red'       -> '<name> — Red Card'          (cardColor: 'red')
 *   (any BOOKING_CHECK, professional=true also sets dogso: true — D-03)
 */
function getBannerMessage(event: ActionEvent, pieceName: (id: string) => string): Banner | null {
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
  // Plan 39-04 (D-02): a foul always shows a banner, regardless of outcome.
  if (event.type === 'FOUL_CALLED') {
    return { message: 'Foul!', variant: 'notable', duration: 1000 };
  }
  // Plan 39-04 (D-02): injury banner fires only when the check actually injures.
  if (event.type === 'INJURY_CHECK') {
    if (!event.injured) return null;
    return {
      message: `${pieceName(event.victimId)} is Injured!`,
      variant: 'notable',
      duration: 1000,
    };
  }
  // Plan 39-04 (D-02/D-03): booking banner fires only when a card is actually issued.
  if (event.type === 'BOOKING_CHECK') {
    if (event.card === 'none') return null;
    const name = pieceName(event.defenderId);
    const message =
      event.card === 'yellow'
        ? `${name} — Yellow Card`
        : event.secondYellow
          ? `${name} — Red Card (2nd Yellow)`
          : `${name} — Red Card`;
    return {
      message,
      variant: 'notable',
      duration: 1000,
      cardColor: event.card,
      dogso: event.professional,
    };
  }
  return null;
}

/**
 * UX-14: Transient centered banner for key match events.
 *
 * Subscribes to gameState.eventLog via a Zustand selector.
 * Uses a ref (lastProcessedLengthRef) to track the last-seen eventLog length
 * so each event is processed at most once — mirroring GameBoard.tsx's
 * lastPieceRef D-03 "ref tracks last seen value" pattern.
 *
 * Plan 39-04 (Pitfall 1 fix): a single broadcast can append multiple qualifying events
 * (e.g. FOUL_CALLED + INJURY_CHECK + BOOKING_CHECK). Every newly-appended event is mapped
 * to a banner and queued in `queueRef` (a ref, not state, so enqueueing alone never triggers
 * an extra render — T-39-04-02 caps the queue at 5 entries, the max a single foul broadcast
 * can produce). The auto-dismiss effect drains the queue: when the active banner's timer
 * fires, it pulls the next queued banner instead of simply going idle.
 *
 * Auto-dismisses after each banner's own duration (1000ms for most variants, 1500ms for
 * HP_ACCURACY). Returns null when no banner is active.
 */
export function EventBanner() {
  const eventLog = useGameStore((s) => s.gameState.eventLog);
  const phase = useGameStore((s) => s.gameState.phase);
  const pieces = useGameStore((s) => s.gameState.pieces);

  // Plan 39-04: resolves a piece id to its display name for the foul/injury/booking banner
  // text — mirrors ActionLog.tsx's pieceName store-lookup pattern. getBannerMessage is
  // module-scope and cannot call hooks, so this resolver is built here and passed in.
  const pieceName = useCallback(
    (id: string): string => {
      const piece = pieces.find((p) => p.id === id);
      if (piece === undefined) return id;
      return piece.lastName ? `${piece.firstName} ${piece.lastName}` : piece.firstName;
    },
    [pieces],
  );

  // Ref tracks the last eventLog length we processed — prevents re-firing
  // the same event on unrelated re-renders (D-03 lastPieceRef pattern).
  const lastProcessedLengthRef = useRef<number>(eventLog.length);

  // 38-19: ref tracks the last phase we processed, initialised to the current phase on first
  // render — mirrors lastProcessedLengthRef's mount-safety so a mount into a restart phase
  // (e.g. a reconnect snapshot landing mid-restart) never fires a banner (T-38-64/threat register
  // "reconnect snapshot to banner").
  const prevPhaseRef = useRef<GamePhase>(phase);

  // Plan 39-04: ordered queue of banners awaiting display. A ref (not state) so pushing onto
  // it never triggers a render by itself — only setActive does. T-39-04-02: capped at 5.
  const queueRef = useRef<Banner[]>([]);

  const [active, setActive] = useState<Banner | null>(null);

  // debug fix foul-banner-sequence-not-pausing: mirrors `active` but is updated SYNCHRONOUSLY
  // at the exact moment a banner is shown or cleared (dequeue in the eventLog effect, the
  // phase-entry effect, and the auto-dismiss timer below). The eventLog effect and the
  // phase-entry effect both need to answer "is a banner active right now?" — reading the
  // `active` REACT-STATE closure is unsafe here because when a single broadcast simultaneously
  // (a) appends a qualifying event AND (b) transitions phase into a RESTART_BANNERS phase, both
  // effects run in the SAME commit and see the SAME stale `active` snapshot. Two plain
  // (non-functional) setActive calls in that commit mean the LAST one silently overwrites the
  // first — the first banner is lost even though it was already dequeued from queueRef. Routing
  // both effects' decisions through this ref instead makes "show now vs. enqueue" correct
  // regardless of effect execution order within a commit.
  const activeRef = useRef<Banner | null>(null);

  // Diff-and-trigger: runs in an effect on eventLog change so setActive is
  // never called during render. The ref is advanced even when no banner fires
  // so the same events are never re-processed on subsequent effect invocations.
  useEffect(() => {
    if (eventLog.length <= lastProcessedLengthRef.current) return;
    const newEvents = eventLog.slice(lastProcessedLengthRef.current);
    // Always advance the ref regardless of whether a banner fired —
    // ensures we don't re-process the same events on the next render.
    lastProcessedLengthRef.current = eventLog.length;
    const banners = newEvents
      .map((event) => getBannerMessage(event, pieceName))
      .filter((banner): banner is Banner => banner !== null);
    if (banners.length === 0) return;
    // T-39-04-02: cap the queue at 5 entries and drop overflow.
    queueRef.current = [...queueRef.current, ...banners].slice(0, 5);
    if (activeRef.current === null) {
      const next = queueRef.current.shift();
      if (next !== undefined) {
        activeRef.current = next;
        setActive(next);
      }
    }
  }, [eventLog, pieceName]);

  // 38-19: phase-entry diff-and-trigger, mirroring the eventLog effect above. Fires at most once
  // per restart entry — edge-detected against prevPhaseRef, not re-fired on every broadcast while
  // the restart phase is active (T-38-64). The ref advances unconditionally, whether or not a
  // banner fired, matching the existing effect's discipline. Plan 39-04: enqueues through the
  // SAME queue as event-derived banners so a restart banner never overwrites a mid-sequence
  // foul banner — it simply waits its turn. Branches on `activeRef` (not the `active` state
  // closure) for the same same-commit race reason documented on activeRef's declaration above.
  useEffect(() => {
    if (phase === prevPhaseRef.current) return;
    const message = RESTART_BANNERS[phase];
    prevPhaseRef.current = phase;
    if (message === undefined) return;
    const banner: Banner = { message, variant: 'notable', duration: 1000 };
    if (activeRef.current === null) {
      activeRef.current = banner;
      setActive(banner);
    } else {
      queueRef.current = [...queueRef.current, banner].slice(0, 5);
    }
  }, [phase]);

  // Auto-dismiss timer: clear the banner after its own duration, then pull the next queued
  // banner (if any) instead of simply going idle (Plan 39-04 queue drain).
  // HP_ACCURACY uses 1500ms (D-20 / UX-15); all other events use 1000ms.
  // The `animationDuration` inline style keeps the CSS bannerFade animation aligned with the
  // timer so the fade-out completes at the same moment the DOM element is removed.
  // activeRef is updated synchronously here too, in lockstep with setActive, so the eventLog and
  // phase-entry effects always see the current value even before this component re-renders.
  useEffect(() => {
    if (active === null) return;
    const timerId = setTimeout(() => {
      const next = queueRef.current.shift() ?? null;
      activeRef.current = next;
      setActive(next);
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
      {active.cardColor !== undefined && (
        <span data-testid="card-badge" data-card={active.cardColor} className={styles.cardBadge} />
      )}
      {active.dogso === true && <span className={styles.dogsoLabel}>DOGSO</span>}
      {active.message}
    </div>
  );
}
