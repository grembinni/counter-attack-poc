/**
 * GameSettingsScreen — Phase 27 DRAFT-01/D-01/D-04/D-05/D-06.
 * Host-only pre-step settings screen rendered immediately after Create Room, before a
 * joiner is required. Bundles Match Speed + Team Type (Standard/Draft) + Draft Pool
 * selection into a single onConfirm callback (D-03: settings lock together atomically).
 * All field state is local useState — mirrors UniformSelectionScreen's local-state +
 * single-bundled-confirm shape.
 */
import { useEffect, useState } from 'react';
import { SELECTABLE_DRAFT_POOLS } from '@counter-attack/shared';
import type { GameSpeed, TeamType, DraftPoolId } from '@counter-attack/shared';
import { SPEED_OPTIONS } from '../constants/speedOptions.js';
import { DRAFT_POOL_LABELS } from '../constants/settingsSummary.js';
import { useGameStore } from '../store/useGameStore.js';
import styles from './GameSettingsScreen.module.css';

/** All 5 draft pools shown in the checkbox list; disabled-state derived from SELECTABLE_DRAFT_POOLS (D-04). */
const ALL_DRAFT_POOLS: DraftPoolId[] = ['original', 'mls', 'international', 'legends', 'icons'];

type Props = {
  /** Called once with the bundled settings when the host clicks Confirm Settings. */
  onConfirm: (settings: {
    speed: GameSpeed;
    teamType: TeamType;
    draftPools: DraftPoolId[];
    /** OOB-05/GOALKICK-06 (Phase 37): out-of-bounds detection + restart set toggle. */
    outOfBounds: boolean;
  }) => void;
  /**
   * BUG-33 (Phase 36) / D-01..D-05: called when the host clicks Back. Returns the host
   * to the Landing screen and tears the already-created room down server-side.
   */
  onBack: () => void;
};

export function GameSettingsScreen({ onConfirm, onBack }: Props) {
  const [speed, setSpeed] = useState<GameSpeed>('standard');
  const [teamType, setTeamType] = useState<TeamType>('standard');
  // D-05: Original pre-checked by default when Draft mode is first selected.
  const [draftPools, setDraftPools] = useState<DraftPoolId[]>(['original']);
  // GOALKICK-06 / OOB-05 (Phase 37): default off, matching the server-side safe default.
  const [outOfBounds, setOutOfBounds] = useState<boolean>(false);
  // WR-03 (Phase 27 review): guard against a rapid double-click firing
  // ROOM_SETTINGS_CONFIRM twice before the ROOM_SETTINGS_CONFIRMED echo routes the
  // screen away — mirrors UniformSelectionScreen's hasConfirmed pattern.
  const [hasConfirmed, setHasConfirmed] = useState(false);

  // CR-03 (Phase 36 review): a server-side confirm rejection (e.g. DRAFT_SUPPLY_EXHAUSTED)
  // never emits ROOM_SETTINGS_CONFIRMED, so hasConfirmed being set unconditionally in
  // handleConfirm left the host stuck with no Confirm button and no error shown. Read
  // gameError like every sibling pre-game panel (ActionPanel, FreeKickSetupPanel,
  // LineupAssignmentScreen) and reset hasConfirmed so the host can retry.
  const gameError = useGameStore((s) => s.gameError);

  useEffect(() => {
    if (gameError) setHasConfirmed(false);
  }, [gameError]);

  function toggleDraftPool(poolId: DraftPoolId) {
    // D-04: Legends/Icons are non-interactive — SELECTABLE_DRAFT_POOLS is the single
    // source of truth for which pools may be toggled (not a hardcoded id check).
    if (!SELECTABLE_DRAFT_POOLS.includes(poolId)) return;
    setDraftPools((prev) =>
      prev.includes(poolId)
        ? prev.filter((p) => p !== poolId)
        : // IN-02 (Phase 27 review): keep the array in canonical ALL_DRAFT_POOLS order
          // (not click order) so the settings summary always reads e.g. "MLS,
          // International" instead of the order the host happened to click checkboxes in.
          [...prev, poolId].sort((a, b) => ALL_DRAFT_POOLS.indexOf(a) - ALL_DRAFT_POOLS.indexOf(b)),
    );
  }

  // D-06: Confirm is disabled whenever zero of the three enabled pools are checked.
  const confirmDisabled = teamType === 'draft' && draftPools.length === 0;

  function handleConfirm() {
    setHasConfirmed(true);
    onConfirm({
      speed,
      teamType,
      draftPools: teamType === 'draft' ? draftPools : [],
      outOfBounds,
    });
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <h2 className={styles.heading}>Game Settings</h2>

        <div className={styles.section}>
          <span className={styles.sectionLabel}>Match Speed</span>
          <div className={styles.speedOptions}>
            {SPEED_OPTIONS.map(({ value, label, icon, colorClass }) => (
              <button
                key={value}
                type="button"
                className={
                  value === speed
                    ? `${styles.speedOptionActive} ${styles[colorClass]}`
                    : `${styles.speedOption} ${styles[colorClass]}`
                }
                onClick={() => setSpeed(value)}
                aria-pressed={value === speed}
              >
                <span className={styles.speedIcon}>{icon}</span>
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className={styles.section}>
          <span className={styles.sectionLabel}>Team Type</span>
          <div role="tablist" className={styles.tabs}>
            <button
              type="button"
              role="tab"
              aria-selected={teamType === 'standard'}
              className={teamType === 'standard' ? styles.tabActive : styles.tab}
              onClick={() => setTeamType('standard')}
            >
              Standard
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={teamType === 'draft'}
              className={teamType === 'draft' ? styles.tabActive : styles.tab}
              onClick={() => setTeamType('draft')}
            >
              Draft
            </button>
          </div>
        </div>

        <div className={styles.section}>
          <span className={styles.sectionLabel}>Restarts</span>
          <label className={styles.poolRow}>
            <input
              type="checkbox"
              checked={outOfBounds}
              onChange={() => setOutOfBounds((v) => !v)}
            />
            Out-of-Bounds / Restarts
          </label>
        </div>

        {teamType === 'draft' && (
          <div className={styles.section}>
            <span className={styles.sectionLabel}>Draft Pool</span>
            <div className={styles.poolList}>
              {ALL_DRAFT_POOLS.map((poolId) => {
                const disabled = !SELECTABLE_DRAFT_POOLS.includes(poolId);
                const checked = draftPools.includes(poolId);
                return (
                  <label
                    key={poolId}
                    className={disabled ? styles.poolRowDisabled : styles.poolRow}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={disabled}
                      onChange={() => toggleDraftPool(poolId)}
                    />
                    {DRAFT_POOL_LABELS[poolId]}
                    {disabled && <span className={styles.comingSoon}> (coming soon)</span>}
                  </label>
                );
              })}
            </div>
          </div>
        )}

        {!hasConfirmed && (
          <button
            type="button"
            className={styles.ctaButton}
            disabled={confirmDisabled}
            onClick={handleConfirm}
          >
            Confirm Settings
          </button>
        )}

        {gameError && <span className={styles.errorText}>{gameError}</span>}

        <button type="button" className={styles.subLink} onClick={onBack}>
          &larr; Back
        </button>
      </div>
    </div>
  );
}
