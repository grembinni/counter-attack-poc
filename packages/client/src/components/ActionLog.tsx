import type { ActionEvent, HexCoord } from '@counter-attack/shared';
import { useGameStore } from '../store/useGameStore.js';
import styles from './ActionLog.module.css';

// ─── Team colors (match PieceOverlay) ────────────────────────────────────────

const HOME_COLOR = '#1a56b0';
const AWAY_COLOR = '#c0392b';

function pieceColorOf(pieceId: string): string {
  return pieceId.startsWith('home') ? HOME_COLOR : AWAY_COLOR;
}

/** Bold, team-colored player label rendered inline. */
function P({ pieceId, prefix }: { pieceId: string; prefix: 'A' | 'D' }) {
  return (
    <span style={{ color: pieceColorOf(pieceId), fontWeight: 'bold' }}>
      {prefix}
      {pieceNum(pieceId)}
    </span>
  );
}

// ─── Display item types ───────────────────────────────────────────────────────

type MoveGroup = {
  kind: 'move_group';
  groupKey: string;
  prefix: string;
  prefixColor: string;
  pieceLabel: string;
  pieceColor: string;
  path: HexCoord[];
};

type EventItem = {
  kind: 'event';
  event: ActionEvent;
};

type DisplayItem = MoveGroup | EventItem;

// ─── Helpers ─────────────────────────────────────────────────────────────────

const SLOT_PREFIX: Record<string, string> = {
  ATTACKER_4: '[MOVE_A4]',
  DEFENDER_5: '[MOVE_D5]',
  ATTACKER_2: '[MOVE_A2]',
};

/** Extracts the 1-based player number from a piece ID, e.g. 'home-0' → '1', 'home-3' → '4'. */
function pieceNum(pieceId: string): string {
  const raw = /(\d+)$/.exec(pieceId)?.[1];
  return raw !== undefined ? String(Number(raw) + 1) : pieceId;
}

/**
 * Formats a heading score as "(die+stat)" or "(die+stat-penalty)" when penalty > 0.
 * penalty = die + stat - combined (from clamping / distance modifier).
 */
function fmtHeading(die: number, stat: number, combined: number): string {
  const penalty = die + stat - combined;
  return penalty > 0 ? `(${die}+${stat}-${penalty})` : `(${die}+${stat})`;
}

// ─── Consolidation ────────────────────────────────────────────────────────────

/**
 * Collapses consecutive MOVE events for the same (slot, piece) into a single
 * path entry. HP_MOVE events are similarly collapsed.
 * HP_REPOSITION events are suppressed — the path is shown via HP_MOVE entries.
 */
function consolidateEvents(events: readonly ActionEvent[]): DisplayItem[] {
  const items: DisplayItem[] = [];

  for (const event of events) {
    if (event.type === 'HP_REPOSITION') continue;

    if (event.type === 'MOVE') {
      const prefix = SLOT_PREFIX[event.slot] ?? '[MOVE]';
      const team = event.slot === 'DEFENDER_5' ? 'D' : 'A';
      const color = pieceColorOf(event.pieceId);
      const pieceLabel = `${team}${pieceNum(event.pieceId)}`;
      const groupKey = `${event.slot}:${event.pieceId}`;
      const last = items[items.length - 1];
      if (last?.kind === 'move_group' && last.groupKey === groupKey) {
        last.path.push(event.to);
      } else {
        items.push({
          kind: 'move_group',
          groupKey,
          prefix,
          prefixColor: color,
          pieceLabel,
          pieceColor: color,
          path: [event.from, event.to],
        });
      }
      continue;
    }

    if (event.type === 'HP_MOVE') {
      const prefix = event.slot === 'ATTACKER' ? '[MOVE_HP_A1]' : '[MOVE_HP_D1]';
      const team = event.slot === 'ATTACKER' ? 'A' : 'D';
      const color = pieceColorOf(event.pieceId);
      const pieceLabel = `${team}${pieceNum(event.pieceId)}`;
      const groupKey = `HP_${event.slot}:${event.pieceId}`;
      const last = items[items.length - 1];
      if (last?.kind === 'move_group' && last.groupKey === groupKey) {
        last.path.push(event.to);
      } else {
        items.push({
          kind: 'move_group',
          groupKey,
          prefix,
          prefixColor: color,
          pieceLabel,
          pieceColor: color,
          path: [event.from, event.to],
        });
      }
      continue;
    }

    items.push({ kind: 'event', event });
  }

  return items;
}

// ─── Event formatting ─────────────────────────────────────────────────────────

type Formatted = {
  prefix: string;
  prefixColor: string | null;
  content: React.ReactNode;
  isGoal: boolean;
};

function formatEvent(event: ActionEvent): Formatted {
  switch (event.type) {
    case 'MOVE':
      return {
        prefix: SLOT_PREFIX[event.slot] ?? '[MOVE]',
        prefixColor: pieceColorOf(event.pieceId),
        content: ` ${event.from.q},${event.from.r} → ${event.to.q},${event.to.r}`,
        isGoal: false,
      };
    case 'SLOT_ADVANCE':
      return {
        prefix: '[TURN]',
        prefixColor: null,
        content: ` ${event.from} → ${event.to ?? 'END'}`,
        isGoal: false,
      };
    case 'DICE_ROLL':
      return {
        prefix: '[DICE]',
        prefixColor: null,
        content: ` Rolled ${event.result}`,
        isGoal: false,
      };
    case 'STEAL_ATTEMPT': {
      const dColor = pieceColorOf(event.defenderId);
      return {
        prefix: event.result === 'SUCCESS' ? '[INTERCEPT ✓]' : '[INTERCEPT ✗]',
        prefixColor: dColor,
        content: (
          <>
            {' '}
            <P pieceId={event.defenderId} prefix="D" /> — {event.result} (die: {event.defenderDie},
            score: {event.defenderCombined})
          </>
        ),
        isGoal: false,
      };
    }
    case 'TACKLE_ATTEMPT': {
      const defStat = event.defenderCombined - event.defenderDie;
      const carrStat = event.carrierCombined - event.carrierDie;
      return {
        prefix: '[TACKLE]',
        prefixColor: pieceColorOf(event.defenderId),
        content: (
          <>
            {' '}
            {event.result} {'-> '}
            <P pieceId={event.defenderId} prefix="D" /> ({event.defenderDie}+{defStat}) vs{' '}
            <P pieceId={event.carrierId} prefix="A" /> ({event.carrierDie}+{carrStat})
          </>
        ),
        isGoal: false,
      };
    }
    case 'GOAL':
      return {
        prefix: '[GOAL]',
        prefixColor: event.scoringTeam === 'home' ? HOME_COLOR : AWAY_COLOR,
        content: ` ${event.scoringTeam.toUpperCase()} scored!`,
        isGoal: true,
      };
    case 'KICK_OFF':
      return { prefix: '[KICK OFF]', prefixColor: null, content: ' Match started', isGoal: false };
    case 'STANDARD_PASS':
      return {
        prefix: event.accurate ? '[PASS ✓]' : '[PASS ✗]',
        prefixColor: event.passerId ? pieceColorOf(event.passerId) : null, // D-27: team colour
        content: ` Standard  ${event.from.q},${event.from.r} → ${event.to.q},${event.to.r}`,
        isGoal: false,
      };
    case 'FIRST_TIME_PASS':
      return {
        prefix: event.accurate ? '[PASS ✓]' : '[PASS ✗]',
        prefixColor: event.passerId ? pieceColorOf(event.passerId) : null, // D-27: team colour
        content: ` First-time  ${event.from.q},${event.from.r} → ${event.to.q},${event.to.r}`,
        isGoal: false,
      };
    case 'HIGH_PASS':
      return {
        prefix:
          event.accurate === true ? '[HIGH ✓]' : event.accurate === false ? '[HIGH ✗]' : '[HIGH →]',
        prefixColor: event.passerId ? pieceColorOf(event.passerId) : null,
        content: `  ${event.from.q},${event.from.r} → ${event.to.q},${event.to.r}`,
        isGoal: false,
      };
    case 'LONG_BALL':
      return {
        prefix: event.accurate ? '[LONG ✓]' : '[LONG ✗]',
        prefixColor: null,
        content: `  ${event.from.q},${event.from.r} → ${event.to.q},${event.to.r}`,
        isGoal: false,
      };
    case 'SHOT_ATTEMPT':
      return {
        prefix: '[SHOT]',
        prefixColor: event.shooterId ? pieceColorOf(event.shooterId) : null,
        content: ` ${event.outcome}`,
        isGoal: event.outcome === 'GOAL',
      };
    case 'SNAPSHOT':
      return {
        prefix: '[SNAPSHOT]',
        prefixColor: event.shooterId ? pieceColorOf(event.shooterId) : null,
        content: ` ${event.shooterId}`,
        isGoal: false,
      };
    case 'HALF_TIME':
      return {
        prefix: '[HALF TIME]',
        prefixColor: null,
        content: ` Score: ${event.score.home}–${event.score.away}`,
        isGoal: false,
      };
    case 'FULL_TIME':
      return {
        prefix: '[FULL TIME]',
        prefixColor: null,
        content: ` Final: ${event.score.home}–${event.score.away}`,
        isGoal: false,
      };
    case 'HEADER': {
      const isTie = event.result === 'TIE';
      const isAttackerWin = event.result === 'ATTACKER_WIN';
      const prefix = isTie ? '[HEADER ~]' : isAttackerWin ? '[HEADER ✓]' : '[HEADER ✗]';
      const winLabel = isTie
        ? 'TIE → LOOSE BALL'
        : isAttackerWin
          ? 'ATTACKER WINS'
          : 'DEFENDER WINS';

      // Uncontested: one team (or both) didn't field a contestant — no dice
      const isContested = event.attackerDie !== null && event.defenderDie !== null;
      if (!isContested) {
        const contestantId = event.attackerId ?? event.defenderId ?? '';
        const rolePrefix: 'A' | 'D' = event.attackerId !== null ? 'A' : 'D';
        const prefixColor = contestantId ? pieceColorOf(contestantId) : null;
        return {
          prefix,
          prefixColor,
          content: (
            <>
              {' '}
              {winLabel} — <P pieceId={contestantId} prefix={rolePrefix} /> (uncontested)
            </>
          ),
          isGoal: false,
        };
      }

      // Contested duel: both teams fielded contestants
      const aScore = fmtHeading(
        event.attackerDie!,
        event.attackerHeading!,
        event.attackerCombined!,
      );
      const dScore = fmtHeading(
        event.defenderDie!,
        event.defenderHeading!,
        event.defenderCombined!,
      );
      const winnerColor = isTie
        ? null
        : isAttackerWin
          ? event.attackerId
            ? pieceColorOf(event.attackerId)
            : null
          : event.defenderId
            ? pieceColorOf(event.defenderId)
            : null;

      return {
        prefix,
        prefixColor: winnerColor,
        content: (
          <>
            {' '}
            {winLabel} — <P pieceId={event.attackerId!} prefix="A" /> {aScore} vs{' '}
            <P pieceId={event.defenderId!} prefix="D" /> {dScore}
          </>
        ),
        isGoal: false,
      };
    }
    case 'HP_REPOSITION':
      return {
        prefix: `[HP ${event.slot}]`,
        prefixColor: null,
        content: event.pieceId ? ` ${event.pieceId} repositioned` : ` No repositioning`,
        isGoal: false,
      };
    case 'HP_ACCURACY':
      return {
        prefix: event.accurate ? '[HIGH ✓]' : '[HIGH ✗]',
        prefixColor: event.passerId ? pieceColorOf(event.passerId) : null,
        content: event.accurate ? ' ACCURATE -> CONTESTING HEADER' : ' Inaccurate — loose ball',
        isGoal: false,
      };
    case 'LOOSE_BALL_LAND':
      return {
        prefix: '[LOOSE BALL]',
        prefixColor: null,
        content: ` ${event.from.q},${event.from.r} → ${event.to.q},${event.to.r}`,
        isGoal: false,
      };
    case 'HP_MOVE': {
      const team = event.slot === 'ATTACKER' ? 'A' : 'D';
      return {
        prefix: event.slot === 'ATTACKER' ? '[MOVE_HP_A1]' : '[MOVE_HP_D1]',
        prefixColor: pieceColorOf(event.pieceId),
        content: (
          <>
            {' '}
            <P pieceId={event.pieceId} prefix={team} /> {event.from.q},{event.from.r} → {event.to.q}
            ,{event.to.r}
          </>
        ),
        isGoal: false,
      };
    }
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Action log panel: last 10 display items in reverse-chronological order.
 * Consecutive MOVE / HP_MOVE events for the same slot are merged into a single
 * path entry (e.g. [MOVE_A4] A3 23,3 → 22,4 → 21,4).
 * Prefixes are bold and team-colored; player labels are bold and team-colored.
 */
export function ActionLog() {
  const eventLog = useGameStore((s) => s.gameState.eventLog);

  const consolidated = consolidateEvents(eventLog);
  const recent = [...consolidated].reverse().slice(0, 10);

  return (
    <div className={styles.panel}>
      <div className={styles.panelHeader}>ACTION LOG</div>
      {recent.length === 0 ? (
        <p className={styles.empty}>No actions yet.</p>
      ) : (
        recent.map((item, index) => {
          if (item.kind === 'move_group') {
            const path = item.path.map((h) => `${h.q},${h.r}`).join(' → ');
            return (
              <div className={styles.entry} key={index}>
                <span
                  className={styles.prefix}
                  style={{ fontWeight: 'bold', color: item.prefixColor }}
                >
                  {item.prefix}
                </span>
                <span className={styles.content}>
                  {' '}
                  <span style={{ color: item.pieceColor, fontWeight: 'bold' }}>
                    {item.pieceLabel}
                  </span>{' '}
                  {path}
                </span>
              </div>
            );
          }
          const { prefix, prefixColor, content, isGoal } = formatEvent(item.event);
          return (
            <div className={styles.entry} key={index}>
              <span
                className={styles.prefix}
                style={{ fontWeight: 'bold', color: prefixColor ?? undefined }}
              >
                {prefix}
              </span>
              <span className={isGoal ? styles.goalContent : styles.content}>{content}</span>
            </div>
          );
        })
      )}
    </div>
  );
}
