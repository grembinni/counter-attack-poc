import type { ActionEvent, HexCoord, MovementSlot } from '@counter-attack/shared';
import { TEAM_CONFIGS } from '@counter-attack/shared';
import { useGameStore } from '../store/useGameStore.js';
import {
  teamAccentColor,
  deriveAaAccentColor,
  AA_REFERENCE_BG_HEX,
  AA_REFERENCE_FG_HEX,
} from '../hooks/useTeamColors.js';
import styles from './ActionLog.module.css';

// ─── Team colors (D-06/D-17: derive from selectedTeams via the pure teamAccentColor) ─

/**
 * WR-06: AA-safe wrapper around the pure teamAccentColor(). This module runs
 * inside consolidateEvents/formatEvent's per-event loops (not component
 * render), so it can't use the useTeamAccentColorAA hook (Rules of Hooks) —
 * but deriveAaAccentColor is a plain function, so it can be called directly
 * here instead of rendering the raw, never-validated teamAccentColor() value.
 * Validates against the same reference colors useTeamAccentColorAA() uses at
 * runtime (see useTeamColors.ts) — ActionLog's own panel background
 * (--color-bg-surface, #1c1c1c) is darker than the shared reference
 * (--color-bg-surface-alt, #262626), so a color clearing AA against the
 * lighter shared reference also clears it here; reusing the shared constants
 * keeps a single source of truth instead of re-deriving a third reference.
 */
function aaTeamAccentColor(teamId: Parameters<typeof teamAccentColor>[0]): string {
  return deriveAaAccentColor(teamAccentColor(teamId), AA_REFERENCE_BG_HEX, AA_REFERENCE_FG_HEX);
}

/**
 * Reads selectedTeams from store state (not a subscription — safe in module-level
 * helpers). Calls the PURE teamAccentColor (never the useTeamAccentColor hook) — this
 * function runs inside consolidateEvents/formatEvent's per-event loops, not component
 * render, so a hook call here would violate Rules of Hooks (Pitfall 1).
 */
function pieceColorOf(pieceId: string): string {
  const state = useGameStore.getState();
  const selectedTeams = state.gameState?.selectedTeams;
  if (!selectedTeams) return aaTeamAccentColor(undefined);
  const positional = pieceId.startsWith('home') ? 'home' : 'away';
  const teamId = selectedTeams[positional];
  return aaTeamAccentColor(teamId);
}

/**
 * Phase 37 (37-02): resolves the display name for a positional team ('home'/'away') —
 * used by OUT_OF_BOUNDS to name the awarded team. Falls back to "Home"/"Away" when
 * selectedTeams is not yet populated.
 */
function teamDisplayName(positional: 'home' | 'away'): string {
  const selectedTeams = useGameStore.getState().gameState?.selectedTeams;
  const fallback = positional === 'home' ? 'Home' : 'Away';
  if (!selectedTeams) return fallback;
  return TEAM_CONFIGS[selectedTeams[positional]]?.name ?? fallback;
}

/**
 * D-01: Resolves a piece's display name as `{firstName} {lastName}` from
 * gameState.pieces. Falls back to the pieceNum-style label (passed in by the
 * caller) when the piece is not found in the current pieces array.
 */
function pieceName(pieceId: string, fallback: string): string {
  const pieces = useGameStore.getState().gameState.pieces;
  const piece = pieces.find((p) => p.id === pieceId);
  if (piece === undefined) return fallback;
  return piece.lastName ? `${piece.firstName} ${piece.lastName}` : piece.firstName;
}

/**
 * Resolves the team primary color for whichever positional side (home/away)
 * owns a given MOVE slot — used by SLOT_ADVANCE, which has no single pieceId
 * to derive a color from via `pieceColorOf`. `ATTACKER_4`/`ATTACKER_2` use the
 * current `attackingTeam`; `DEFENDER_5` uses the other side.
 */
function slotTeamColor(slot: MovementSlot): string {
  const gameState = useGameStore.getState().gameState;
  const selectedTeams = gameState?.selectedTeams;
  if (!selectedTeams) return aaTeamAccentColor(undefined);
  const attackingTeam = gameState.attackingTeam;
  const positional: 'home' | 'away' =
    slot === 'DEFENDER_5' ? (attackingTeam === 'home' ? 'away' : 'home') : attackingTeam;
  const teamId = selectedTeams[positional];
  return aaTeamAccentColor(teamId);
}

/** Bold, team-colored player label rendered inline. */
function P({ pieceId, prefix }: { pieceId: string; prefix: string }) {
  return (
    <span style={{ color: pieceColorOf(pieceId), fontWeight: 'bold' }}>
      {prefix} #{pieceNum(pieceId)}
    </span>
  );
}

/**
 * Bold, team-colored player label rendered as "#{number} {Name}" — the
 * move-log convention (D-01) extended to duel-style entries.
 * `prefix`, when provided, renders before the number (e.g. "D #7 Jane Doe")
 * to preserve the existing A/D role semantics used by duel branches.
 * Falls back to just the number when the piece is unknown (pieceName
 * already handles the fallback via its second argument).
 */
function PNamed({ pieceId, prefix }: { pieceId: string; prefix?: string }) {
  const num = pieceNum(pieceId);
  const name = pieceName(pieceId, num);
  return (
    <span style={{ color: pieceColorOf(pieceId), fontWeight: 'bold' }}>
      {prefix ? `${prefix} ` : ''}#{num} {name}
    </span>
  );
}

// ─── Display item types ───────────────────────────────────────────────────────

type MoveGroup = {
  kind: 'move_group';
  groupKey: string;
  prefix: string;
  prefixColor: string;
  pieceId: string;
  pieceLabel: string;
  pieceColor: string;
  path: HexCoord[];
};

type EventItem = {
  kind: 'event';
  event: ActionEvent;
  /**
   * Quick-task 260621-b8f finding #3: SHOT_ATTEMPT events with a handling sub-check
   * previously rendered the duel AND handling check as one merged log entry. This
   * discriminator lets consolidateEvents push TWO EventItems sharing the same
   * underlying SHOT_ATTEMPT event — one for the duel portion, one for the handling
   * portion — while formatEvent renders only the relevant slice for each.
   * undefined for all other event types and for non-handling SHOT_ATTEMPT events
   * (those still render as a single entry, unchanged).
   */
  subKind?: 'duel' | 'handling';
};

type DisplayItem = MoveGroup | EventItem;

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Maps a MovementSlot to its scoreboard-matching numbered suffix digit
 * ('4' / '5' / '2'). Mirrors GameBoard.tsx's MOVE_SLOT_SUFFIX (the canonical
 * source) so ActionLog's MOVE-event labels never drift from the scoreboard's
 * `MOVE N` phase label.
 */
const MOVE_SLOT_DIGIT: Record<MovementSlot, string> = {
  ATTACKER_4: '4',
  DEFENDER_5: '5',
  ATTACKER_2: '2',
};

/** Returns the scoreboard-matching numbered digit for a MOVE slot (e.g. '4'). */
function moveSlotLabel(slot: MovementSlot): string {
  return MOVE_SLOT_DIGIT[slot];
}

const SLOT_PREFIX: Record<string, string> = {
  ATTACKER_4: `[MOVE ${moveSlotLabel('ATTACKER_4')}]`,
  DEFENDER_5: `[MOVE ${moveSlotLabel('DEFENDER_5')}]`,
  ATTACKER_2: `[MOVE ${moveSlotLabel('ATTACKER_2')}]`,
};

/** D-11: sentence-case label map for the shared SUCCESS/FAIL binary-outcome enum. */
const RESULT_LABEL: Record<'SUCCESS' | 'FAIL', string> = {
  SUCCESS: 'Success',
  FAIL: 'Failed',
};

/** D-11: sentence-case label map for the SHOT_ATTEMPT outcome enum. */
const SHOT_OUTCOME_LABEL: Record<'GOAL' | 'SAVE' | 'LOOSE_BALL', string> = {
  GOAL: 'Goal',
  SAVE: 'Save',
  LOOSE_BALL: 'Loose ball (tie)',
};

/** D-11: sentence-case label map for the HEADER duel result enum. */
const HEADER_RESULT_LABEL: Record<'ATTACKER_WIN' | 'DEFENDER_WIN' | 'TIE', string> = {
  ATTACKER_WIN: 'Attacker wins',
  DEFENDER_WIN: 'Defender wins',
  TIE: 'Tie → loose ball',
};

/**
 * BUG-19: Resolves a piece's jersey number from gameState.pieces via store lookup,
 * mirroring pieceName()'s lookup pattern exactly. Falls back to the raw pieceId string
 * on miss (graceful degradation — never throws).
 */
function pieceNum(pieceId: string): string {
  const pieces = useGameStore.getState().gameState.pieces;
  const piece = pieces.find((p) => p.id === pieceId);
  return piece !== undefined ? String(piece.number) : pieceId;
}

/**
 * D-12: Shared spelled-out stat+roll+penalty formatter used uniformly by
 * SHOT_ATTEMPT, TACKLE_ATTEMPT, STEAL_ATTEMPT, and HEADER. Always renders the
 * `- {penalty}` term (including `- 0`) — never a compact parenthetical, never
 * an omitted penalty term.
 */
function fmtStatRoll(
  statName: string,
  statValue: number,
  roll: number,
  penalty: number,
  combined: number,
): string {
  // Math.abs is intentional display normalization: attackerPenalty (computed as
  // die + stat - combined) may be zero or negative when the attacker gets a bonus
  // (combined > die + stat). We always render "- N" for display consistency.
  return `${statName} ${statValue} + ${roll} - ${Math.abs(penalty)} = ${combined}`;
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
    if (event.type === 'HP_REPOSITION' || event.type === 'FTP_REPOSITION') continue;

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
          pieceId: event.pieceId,
          pieceLabel,
          pieceColor: color,
          path: [event.from, event.to],
        });
      }
      continue;
    }

    if (event.type === 'GK_KICK_MOVE') {
      const prefix =
        event.slot === 'KICKER' ? '[KEEPER KICK RESULT]' : '[KEEPER KICK RESPONSE MOVE]';
      const team = event.slot === 'KICKER' ? 'K' : 'O';
      const color = pieceColorOf(event.pieceId);
      const pieceLabel = `${team}${pieceNum(event.pieceId)}`;
      const groupKey = `GKK_${event.slot}:${event.pieceId}`;
      const last = items[items.length - 1];
      if (last?.kind === 'move_group' && last.groupKey === groupKey) {
        last.path.push(event.to);
      } else {
        items.push({
          kind: 'move_group',
          groupKey,
          prefix,
          prefixColor: color,
          pieceId: event.pieceId,
          pieceLabel,
          pieceColor: color,
          path: [event.from, event.to],
        });
      }
      continue;
    }

    if (event.type === 'HP_MOVE') {
      const prefix = '[HIGH PASS MOVE 1]';
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
          pieceId: event.pieceId,
          pieceLabel,
          pieceColor: color,
          path: [event.from, event.to],
        });
      }
      continue;
    }

    // Quick-task 260621-b8f finding #3: a SHOT_ATTEMPT that ran a handling sub-check
    // (GK won the duel, then a separate handling roll decided caught vs spilled) must
    // produce TWO log entries — the duel and the handling check — not one merged entry.
    if (event.type === 'SHOT_ATTEMPT' && event.handlingDie !== null) {
      items.push({ kind: 'event', event, subKind: 'duel' });
      items.push({ kind: 'event', event, subKind: 'handling' });
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

function formatEvent(event: ActionEvent, subKind?: 'duel' | 'handling'): Formatted {
  switch (event.type) {
    case 'MOVE':
      return {
        prefix: SLOT_PREFIX[event.slot] ?? '[MOVE]',
        prefixColor: pieceColorOf(event.pieceId),
        content: ` ${event.from.q},${event.from.r} → ${event.to.q},${event.to.r}`,
        isGoal: false,
      };
    case 'SLOT_ADVANCE': {
      const fromColor = slotTeamColor(event.from);
      const fromLabel = `[MOVE ${moveSlotLabel(event.from)}]`;
      const toLabel = event.to !== null ? `[MOVE ${moveSlotLabel(event.to)}]` : '[END]';
      const toColor = event.to !== null ? slotTeamColor(event.to) : null;
      return {
        prefix: '',
        prefixColor: null,
        content: (
          <>
            {' '}
            <span style={{ color: fromColor, fontWeight: 'bold' }}>{fromLabel}</span>
            {' → '}
            <span style={{ color: toColor ?? undefined, fontWeight: 'bold' }}>{toLabel}</span>
          </>
        ),
        isGoal: false,
      };
    }
    case 'DICE_ROLL':
      // D-12: DICE_ROLL is exempt — no stat+roll+penalty triple exists here.
      return {
        prefix: '[DICE]',
        prefixColor: null,
        content: ` Rolled ${event.result}`,
        isGoal: false,
      };
    case 'DEFLECT_ATTEMPT': {
      const deflected = event.result === 'DEFLECTED';
      const dColor = pieceColorOf(event.defenderId);
      // Preserve the existing rule: the Tackling bonus only applies on close-range
      // (Set A) attempts with a die roll under 5; otherwise the bare die decides.
      const hasBonus = event.band === 'A' && event.die < 5;
      const rollStr = hasBonus
        ? `die ${event.die} + Tackling ${event.tackling} = ${event.die + event.tackling}`
        : `die ${event.die}`;
      const rangeLabel = event.band === 'A' ? 'close range' : 'long range';
      return {
        prefix: deflected ? '[DEFLECT ✓]' : '[DEFLECT ✗]',
        prefixColor: dColor,
        content: (
          <>
            {' '}
            <PNamed pieceId={event.defenderId} />{' '}
            {deflected ? 'deflected the shot' : 'failed to deflect'} — {rangeLabel}, {rollStr}
          </>
        ),
        isGoal: false,
      };
    }
    case 'STEAL_ATTEMPT': {
      const dColor = pieceColorOf(event.defenderId);
      // D-13 (TODO-STEAL-DETAIL): auto-intercept sentinel — defenderDie===0 &&
      // defenderCombined===0 means no dice were rolled (gameEngine.ts ~line 1452,
      // destination hex was the defender's own hex). Render an explicit no-roll
      // label instead of a misleading "Tackling 0 + 0 - 0 = 0" line.
      const isAutoIntercept = event.defenderDie === 0 && event.defenderCombined === 0;
      if (isAutoIntercept) {
        return {
          prefix: event.result === 'SUCCESS' ? '[INTERCEPT ✓]' : '[INTERCEPT ✗]',
          prefixColor: dColor,
          content: (
            <>
              {' '}
              {RESULT_LABEL[event.result]} {'→ '}
              <PNamed pieceId={event.defenderId} /> — auto-intercept (no roll)
            </>
          ),
          isGoal: false,
        };
      }
      // D-12: STEAL_ATTEMPT carries no penalty field — always 0.
      const defStat = event.defenderCombined - event.defenderDie;
      const dStr = fmtStatRoll('Tackling', defStat, event.defenderDie, 0, event.defenderCombined);
      return {
        prefix: event.result === 'SUCCESS' ? '[INTERCEPT ✓]' : '[INTERCEPT ✗]',
        prefixColor: dColor,
        content: (
          <>
            {' '}
            {RESULT_LABEL[event.result]} {'→ '}
            <PNamed pieceId={event.defenderId} /> ({dStr}) — intercept if die 6 or total ≥ 10
          </>
        ),
        isGoal: false,
      };
    }
    case 'TACKLE_ATTEMPT': {
      const defStat = event.defenderCombined - event.defenderDie;
      const carrStat = event.carrierCombined - event.carrierDie;
      // D-12: TACKLE_ATTEMPT carries no penalty field — always 0.
      const defStr = fmtStatRoll('Tackling', defStat, event.defenderDie, 0, event.defenderCombined);
      const carrStr = fmtStatRoll(
        'Dribbling',
        carrStat,
        event.carrierDie,
        0,
        event.carrierCombined,
      );
      return {
        prefix: event.result === 'SUCCESS' ? '[TACKLE ✓]' : '[TACKLE ✗]',
        prefixColor: pieceColorOf(event.defenderId),
        content: (
          <>
            {' '}
            {RESULT_LABEL[event.result]} {'→ '}
            <PNamed pieceId={event.defenderId} /> ({defStr}) vs <PNamed pieceId={event.carrierId} />{' '}
            ({carrStr})
          </>
        ),
        isGoal: false,
      };
    }
    case 'GOAL':
      return {
        prefix: '[SHOT]',
        prefixColor: pieceColorOf(event.scorerId),
        content: (
          <>
            {' '}
            <PNamed pieceId={event.scorerId} /> Scored!
          </>
        ),
        isGoal: true, // was false — GOAL events must return true
      };
    case 'KICK_OFF':
      return { prefix: '[KICK OFF]', prefixColor: null, content: ' Match started', isGoal: false };
    case 'HALF_TIME_KICKOFF_RESET':
      // D-02 (BUG-30 defect class): formation reset before the second-half kick-off. Logged
      // for replay reconstruction only — no meaningful per-piece display, mirrors KICK_OFF_SETUP.
      return {
        prefix: '[KICK OFF]',
        prefixColor: null,
        content: ' Second half — teams reset to formation',
        isGoal: false,
      };
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
    case 'SHOT_ATTEMPT': {
      let shotContent: React.ReactNode;
      const shooterLabel = event.shooterId ? (
        <PNamed pieceId={event.shooterId} />
      ) : (
        'unknown shooter'
      );
      const shotPrefix = event.outcome === 'GOAL' ? '[SHOT ✓]' : '[SHOT ✗]';
      const shotPrefixColor = event.shooterId ? pieceColorOf(event.shooterId) : null;

      if (event.shooterScore === null) {
        // No duel ran: keeper out of range — automatic goal
        shotContent = (
          <>
            {' '}
            {shooterLabel} Goal — keeper out of range (die:{event.shooterDie})
          </>
        );
      } else if (event.handlingDie !== null) {
        // Quick-task 260621-b8f finding #3: GK won the duel; handling check ran.
        // consolidateEvents pushes TWO EventItems for this case (subKind 'duel' then
        // 'handling') — render only the requested slice as its own log entry.
        const shooterRawStat = event.shooterScore - event.shooterDie - event.shooterPenaltyTotal;
        const gkRawStat = event.gkScore! - event.gkDie - event.gkPenaltyTotal;
        const outcomeLabel = SHOT_OUTCOME_LABEL[event.outcome];
        const shooterStr = fmtStatRoll(
          'Shooting',
          shooterRawStat,
          event.shooterDie,
          event.shooterPenaltyTotal,
          event.shooterScore,
        );
        const gkStr = fmtStatRoll(
          'Saving',
          gkRawStat,
          event.gkDie,
          event.gkPenaltyTotal,
          event.gkScore!,
        );

        if (subKind === 'handling') {
          // D-04: the keeper is the acting player here — caught (SAVE) is the success
          // glyph, spilled is the fail glyph. Derived from the same handlingResult
          // condition rather than re-testing event.outcome twice.
          const handlingResult = event.outcome === 'SAVE' ? 'caught' : 'spilled';
          const handlingPrefix = handlingResult === 'caught' ? '[HANDLING ✓]' : '[HANDLING ✗]';
          return {
            prefix: handlingPrefix,
            prefixColor: shotPrefixColor,
            content: (
              <>
                {' '}
                handling: {event.handlingDie} vs {event.gkHandling} ({handlingResult})
              </>
            ),
            isGoal: false,
          };
        }

        // subKind === 'duel' (or undefined — defensive fallback to the duel-only line)
        return {
          prefix: shotPrefix,
          prefixColor: shotPrefixColor,
          content: (
            <>
              {' '}
              {outcomeLabel} {'→ '}
              {shooterLabel} ({shooterStr}) vs <PNamed pieceId={event.gkId} /> ({gkStr})
            </>
          ),
          isGoal: false,
        };
      } else {
        // Regular duel outcome (GOAL or LOOSE_BALL)
        const shooterRawStat = event.shooterScore - event.shooterDie - event.shooterPenaltyTotal;
        const gkRawStat = event.gkScore! - event.gkDie - event.gkPenaltyTotal;
        const outcomeLabel = SHOT_OUTCOME_LABEL[event.outcome];
        const shooterStr = fmtStatRoll(
          'Shooting',
          shooterRawStat,
          event.shooterDie,
          event.shooterPenaltyTotal,
          event.shooterScore,
        );
        const gkStr = fmtStatRoll(
          'Saving',
          gkRawStat,
          event.gkDie,
          event.gkPenaltyTotal,
          event.gkScore!,
        );
        shotContent = (
          <>
            {' '}
            {outcomeLabel} {'→ '}
            {shooterLabel} ({shooterStr}) vs <PNamed pieceId={event.gkId} /> ({gkStr})
          </>
        );
      }
      return {
        prefix: shotPrefix,
        prefixColor: shotPrefixColor,
        content: shotContent,
        isGoal: false,
      };
    }
    case 'SNAPSHOT':
      return {
        prefix: '[SNAPSHOT]',
        prefixColor: pieceColorOf(event.shooterId),
        content: (
          <>
            {' '}
            <PNamed pieceId={event.shooterId} />
          </>
        ),
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
      const winLabel = HEADER_RESULT_LABEL[event.result];

      // Uncontested: one team (or both) didn't field a contestant — no dice
      const isContested = event.attackerDie !== null && event.defenderDie !== null;
      if (!isContested) {
        const contestantId = event.attackerId ?? event.defenderId ?? '';
        const prefixColor = contestantId ? pieceColorOf(contestantId) : null;
        return {
          prefix,
          prefixColor,
          content: (
            <>
              {' '}
              {winLabel} — <PNamed pieceId={contestantId} /> (uncontested)
            </>
          ),
          isGoal: false,
        };
      }

      // Contested duel: both teams fielded contestants
      // D-12: penalty = die + stat - combined (mirrors the prior heading-score derivation)
      const attackerPenalty =
        event.attackerDie! + event.attackerAerialAbility! - event.attackerCombined!;
      const defenderPenalty =
        event.defenderDie! + event.defenderAerialAbility! - event.defenderCombined!;
      const aScore = fmtStatRoll(
        'Aerial',
        event.attackerAerialAbility!,
        event.attackerDie!,
        attackerPenalty,
        event.attackerCombined!,
      );
      const dScore = fmtStatRoll(
        'Aerial',
        event.defenderAerialAbility!,
        event.defenderDie!,
        defenderPenalty,
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
            {winLabel} — <PNamed pieceId={event.attackerId!} /> {aScore} vs{' '}
            <PNamed pieceId={event.defenderId!} /> {dScore}
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
    case 'FTP_REPOSITION':
      return {
        prefix: `[FTP ${event.slot}]`,
        prefixColor: null,
        content: event.pieceId ? ` ${event.pieceId} repositioned` : ` No repositioning`,
        isGoal: false,
      };
    case 'HP_ACCURACY':
      return {
        prefix: event.accurate ? '[HIGH ✓]' : '[HIGH ✗]',
        prefixColor: event.passerId ? pieceColorOf(event.passerId) : null,
        content: event.accurate ? ' Accurate → contesting header' : ' Inaccurate — loose ball',
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
      return {
        prefix: '[HIGH PASS MOVE 1]',
        prefixColor: pieceColorOf(event.pieceId),
        content: (
          <>
            {' '}
            <PNamed pieceId={event.pieceId} /> {event.from.q},{event.from.r} → {event.to.q},
            {event.to.r}
          </>
        ),
        isGoal: false,
      };
    }
    case 'FTP_MOVE': {
      return {
        prefix: '[FIRST TIME PASS MOVE 1]',
        prefixColor: pieceColorOf(event.pieceId),
        content: (
          <>
            {' '}
            <PNamed pieceId={event.pieceId} /> {event.from.q},{event.from.r} → {event.to.q},
            {event.to.r}
          </>
        ),
        isGoal: false,
      };
    }
    case 'GK_KICK': {
      const gkColor = pieceColorOf(event.gkId);
      const accurate = event.accurate;
      return {
        prefix: accurate ? '[KEEPER KICK TARGET ✓]' : '[KEEPER KICK TARGET ✗]',
        prefixColor: gkColor,
        content: (
          <>
            {' '}
            <P pieceId={event.gkId} prefix="K" /> → {event.targetHex.q},{event.targetHex.r} — die:
            {event.kickDie}+{event.kickScore - event.kickDie}={event.kickScore}
            {accurate ? ' Accurate' : ' Inaccurate — loose ball'}
          </>
        ),
        isGoal: false,
      };
    }
    case 'GK_KICK_MOVE': {
      const team = event.slot === 'KICKER' ? 'K' : 'O';
      return {
        prefix: event.slot === 'KICKER' ? '[KEEPER KICK RESULT]' : '[KEEPER KICK RESPONSE MOVE]',
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
    case 'HEADED_PASS':
      // Quick-task 260621-b8f finding #2: delivery following a won header — no accuracy
      // check at this point (mirrors STANDARD_PASS's pass-log format, no accurate prefix).
      return {
        prefix: '[HEADER PASS]',
        prefixColor: pieceColorOf(event.passerId),
        content: ` Headed  ${event.from.q},${event.from.r} → ${event.to.q},${event.to.r}`,
        isGoal: false,
      };
    case 'GK_PUNT':
      // Quick-task 260621-b8f finding #4: GK punt delivery — always delivered (no accuracy
      // check at this point; mirrors STANDARD_PASS's pass-log format).
      return {
        prefix: '[PUNT]',
        prefixColor: pieceColorOf(event.passerId),
        content: ` Punt  ${event.from.q},${event.from.r} → ${event.to.q},${event.to.r}`,
        isGoal: false,
      };
    case 'KICK_OFF_SETUP':
      // BUG-17 (Phase 18.3): formation repositioning before kick-off. Logged for replay
      // visibility; not shown in the action log (no meaningful display needed).
      return {
        prefix: '[SETUP]',
        prefixColor: aaTeamAccentColor(undefined),
        content: ` Formation  ${event.from.q},${event.from.r} → ${event.to.q},${event.to.r}`,
        isGoal: false,
      };
    case 'SNAP_DEFLECT_MOVE':
      // BUG-18 (Phase 18.3): defender repositioning during SNAPSHOT_DEFLECT. D-04: renamed
      // from [DEFLECT] to [DEFLECT MOVE] — this is a glyph-free repositioning event with no
      // outcome, and the bare [DEFLECT] prefix collided visually with DEFLECT_ATTEMPT's
      // outcome-bearing [DEFLECT ✓]/[DEFLECT ✗] prefixes.
      return {
        prefix: '[DEFLECT MOVE]',
        prefixColor: aaTeamAccentColor(undefined),
        content: ` Deflect move  ${event.from.q},${event.from.r} → ${event.to.q},${event.to.r}`,
        isGoal: false,
      };
    case 'FK_SETUP_MOVE':
      // BUG-18 (Phase 18.3): piece repositioning during FREE_KICK_SETUP.
      return {
        prefix: '[FK]',
        prefixColor: aaTeamAccentColor(undefined),
        content: ` Setup move  ${event.from.q},${event.from.r} → ${event.to.q},${event.to.r}`,
        isGoal: false,
      };
    case 'FK_KICKER_CHOSEN':
      // Plan 25-06: undo boundary — kicker placed on free-kick hex.
      return {
        prefix: '[FK]',
        prefixColor: aaTeamAccentColor(undefined),
        content: ` Kicker selected`,
        isGoal: false,
      };
    case 'FK_STAGE_ADVANCE':
      // Plan 25-06: undo boundary — stage transition during FREE_KICK_SETUP.
      return {
        prefix: '[FK]',
        prefixColor: aaTeamAccentColor(undefined),
        content: ` Stage ${event.fromStageIndex + 1} → ${event.fromStageIndex + 2}`,
        isGoal: false,
      };
    case 'OUT_OF_BOUNDS': {
      // Phase 37 (37-02) / OOB-05: ball left the pitch; log exit kind + awarded restart.
      const restartLabel = event.restart === 'THROW_IN' ? 'Throw-In' : 'Goal Kick';
      const kindLabel = event.kind === 'SIDELINE' ? 'sideline' : 'byline';
      return {
        prefix: '[OUT]',
        prefixColor: aaTeamAccentColor(undefined),
        content: ` Ball out (${kindLabel}) at ${event.exitHex.q},${event.exitHex.r} — ${restartLabel} to ${teamDisplayName(event.awardedTo)}`,
        isGoal: false,
      };
    }
    case 'THROW_IN_PLACE':
      // THROWIN-02 (Phase 37): thrower placed at the throw-in hex.
      return {
        prefix: '[THROW-IN]',
        prefixColor: pieceColorOf(event.pieceId),
        content: (
          <>
            {' '}
            <PNamed pieceId={event.pieceId} /> placed at {event.to.q},{event.to.r}
          </>
        ),
        isGoal: false,
      };
    case 'GOAL_KICK_WINDOW_ADVANCE': {
      // GOALKICK-02 (Phase 37): undo boundary between the GK-team and opponent windows.
      const windowLabel = event.fromWindow === 'GK_TEAM' ? "Kicking team's" : "Defending team's";
      return {
        prefix: '[GOAL KICK]',
        prefixColor: aaTeamAccentColor(undefined),
        content: ` ${windowLabel} reposition window ended`,
        isGoal: false,
      };
    }
    case 'GOAL_KICK_CHOICE': {
      // GOALKICK-03 (Phase 37): GK's kick-vs-standard-pass restart choice.
      const choiceLabel = event.choice === 'kick' ? 'Kick' : 'Standard Pass';
      return {
        prefix: '[GOAL KICK]',
        prefixColor: pieceColorOf(event.gkId),
        content: (
          <>
            {' '}
            <PNamed pieceId={event.gkId} /> chose {choiceLabel}
          </>
        ),
        isGoal: false,
      };
    }
    case 'GOAL_KICK_MOVE': {
      // GOALKICK-05 (Phase 37): byte-for-byte the GK_KICK_MOVE format.
      const team = event.slot === 'KICKER' ? 'K' : 'O';
      return {
        prefix: event.slot === 'KICKER' ? '[GOAL KICK RESULT]' : '[GOAL KICK RESPONSE MOVE]',
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
    case 'GOAL_KICK': {
      // GOALKICK-05 (Phase 37): byte-for-byte the GK_KICK format.
      const gkColor = pieceColorOf(event.gkId);
      const accurate = event.accurate;
      return {
        prefix: accurate ? '[GOAL KICK TARGET ✓]' : '[GOAL KICK TARGET ✗]',
        prefixColor: gkColor,
        content: (
          <>
            {' '}
            <P pieceId={event.gkId} prefix="K" /> → {event.targetHex.q},{event.targetHex.r} — die:
            {event.kickDie}+{event.kickScore - event.kickDie}={event.kickScore}
            {accurate ? ' Accurate' : ' Inaccurate — loose ball'}
          </>
        ),
        isGoal: false,
      };
    }
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Action log panel: last 30 display items in reverse-chronological order.
 * Consecutive MOVE / HP_MOVE events for the same slot are merged into a single
 * path entry (e.g. [MOVE 4] A3 23,3 → 22,4 → 21,4).
 * Prefixes are bold and team-colored; player labels are bold and team-colored.
 */
export function ActionLog() {
  const eventLog = useGameStore((s) => s.gameState.eventLog);
  // D-17: subscribe to selectedTeams so ActionLog re-renders when teams change
  useGameStore((s) => s.gameState.selectedTeams);

  const consolidated = consolidateEvents(eventLog);
  const recent = [...consolidated].reverse().slice(0, 30);

  return (
    <div className={styles.panel}>
      {recent.length === 0 ? (
        <p className={styles.empty}>No actions yet.</p>
      ) : (
        recent.map((item, index) => {
          if (item.kind === 'move_group') {
            const path = item.path.map((h) => `${h.q},${h.r}`).join(' → ');
            // D-01: resolve display name from pieces by id; fall back to the
            // existing terse pieceLabel (e.g. 'A3') when the piece is not found.
            const name = pieceName(item.pieceId, item.pieceLabel);
            const num = pieceNum(item.pieceId);
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
                    #{num} {name}
                  </span>{' '}
                  | {path}
                </span>
              </div>
            );
          }
          const { prefix, prefixColor, content } = formatEvent(item.event, item.subKind);
          return (
            <div className={styles.entry} key={index}>
              <span
                className={styles.prefix}
                style={{ fontWeight: 'bold', color: prefixColor ?? undefined }}
              >
                {prefix}
              </span>
              <span className={styles.content}>{content}</span>
            </div>
          );
        })
      )}
    </div>
  );
}
