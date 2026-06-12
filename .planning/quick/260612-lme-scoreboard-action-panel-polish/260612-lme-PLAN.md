---
phase: quick-260612-lme
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - packages/client/src/components/GameBoard.tsx
  - packages/client/src/components/GameBoard.module.css
  - packages/client/src/components/ActionPanel.module.css
autonomous: true
requirements:
  - QUICK-260612-LME

must_haves:
  truths:
    - "ActionPanel 'Choose action' label is centred horizontally"
    - 'Scoreboard centre cell shows a green dot (8×8px, borderRadius 50%, #27ae60) next to the clock with no ConnectionStatus text'
    - 'Scoreboard clock is rendered at 26px font-size'
    - 'Phase summary line shows only teamName · phaseLabel — no moves-remaining fragment'
    - 'When phase is MOVEMENT, a two-line helper below the phase summary shows how many players and max hexes for the current slot'
  artifacts:
    - path: packages/client/src/components/GameBoard.tsx
      provides: 'Centre cell with dot+clock row, trimmed phase summary, MOVEMENT helper text'
    - path: packages/client/src/components/GameBoard.module.css
      provides: 'clockDisplay at 26px; clockRow flex helper; movementHelper text styles'
    - path: packages/client/src/components/ActionPanel.module.css
      provides: 'phaseLabel with text-align:center'
  key_links:
    - from: GameBoard.tsx scoreboardCentreCell
      to: GameBoard.module.css .clockRow
      via: className
      pattern: 'clockRow'
    - from: GameBoard.tsx phase === 'MOVEMENT' helper block
      to: SLOT_TOTAL constant
      via: 'SLOT_TOTAL[movementSlot]'
      pattern: "SLOT_TOTAL\\[movementSlot\\]"
---

<objective>
Polish the GameBoard scoreboard centre cell and ActionPanel heading — five targeted UI tweaks with zero behaviour changes.

Purpose: Cleaner scoreboard (dot-only connection indicator, larger clock, trimmed phase summary, slot-aware movement helper) and a centred ActionPanel heading.
Output: Three files modified; no new files; all existing tests continue to pass.
</objective>

<execution_context>
@D:/Users/jerem/.claude/gsd-core/workflows/execute-plan.md
@D:/Users/jerem/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/ROADMAP.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: ActionPanel — centre the "Choose action" label</name>
  <files>packages/client/src/components/ActionPanel.module.css</files>
  <action>
    In ActionPanel.module.css, locate the `.phaseLabel` rule (currently has font-size, font-weight,
    color, text-transform, letter-spacing). Add `text-align: center;` to that rule.

    The `.phaseLabel` class is already set to `grid-column: 1 / -1` via the grouped selector
    `.phaseLabel, .gkLabel, .errorText`. Adding `text-align: center` to the `.phaseLabel`
    standalone block centres the "Choose action" text (and all other phaseLabel spans) within
    their full-width column span. This is the correct minimal fix — do not add a new class.

  </action>
  <verify>
    <automated>cd /d/dev/repo/counter-attack-poc && pnpm --filter client build 2>&1 | tail -5</automated>
  </verify>
  <done>TypeScript build succeeds; ActionPanel.module.css .phaseLabel contains text-align: center.</done>
</task>

<task type="auto">
  <name>Task 2: GameBoard — dot+clock row, larger clock, trim phase summary, MOVEMENT helper</name>
  <files>packages/client/src/components/GameBoard.tsx, packages/client/src/components/GameBoard.module.css</files>
  <action>
    Make the following changes exactly, in order:

    ── GameBoard.tsx ──────────────────────────────────────────────────────────

    1. REMOVE the ConnectionStatus import (line 7):
       Delete: `import { ConnectionStatus } from './ConnectionStatus.js';`
       (ConnectionStatus is no longer used anywhere in GameBoard after this change.)

    2. REMOVE the `remaining` computation (currently lines 152-154):
       Delete the three lines that compute `remaining` using SLOT_TOTAL and paceUsedByPieceId.
       Also remove the `paceUsedByPieceId` store selector (currently line 132) since it is only
       used for `remaining`. After removal, `movementSlot` selector stays.

    3. ADD a movement helper text computation after the existing derived values block.
       Insert after the `const phaseLabel = PHASE_LABEL[phase];` line:

         const movementHelperText: { line1: string; line2: string } | null =
           phase === 'MOVEMENT' && movementSlot != null
             ? (() => {
                 const total = SLOT_TOTAL[movementSlot];
                 if (total === 4) return { line1: 'Move up to 4 players', line2: '(2 hexes max)' };
                 if (total === 5) return { line1: 'Move up to 5 players', line2: '(2 hexes max)' };
                 return { line1: 'Move up to 2 players', line2: '(2 hexes max)' };
               })()
             : null;

    4. REPLACE the centre cell JSX block (currently lines 236-255). Replace the entire
       `{/* Centre cell: clock + connection + phase summary */}` block with:

         {/* Centre cell: green dot + clock (row), then phase summary + movement helper */}
         <div className={styles.scoreboardCentreCell}>
           <div className={styles.clockRow}>
             <div
               style={{ width: 8, height: 8, borderRadius: '50%', background: '#27ae60', flexShrink: 0 }}
               title="Connected"
             />
             <span className={styles.clockDisplay}>{clockDisplay}</span>
           </div>
           <div className={styles.phaseSummary}>
             <span className={styles.teamName} style={{ color: teamColor }}>
               {teamName}
             </span>
             {phaseLabel && phase !== 'REPLAY' && (
               <span className={styles.phaseLabel}>&nbsp;&middot;&nbsp;{phaseLabel}</span>
             )}
           </div>
           {movementHelperText && (
             <div className={styles.movementHelper}>
               <span className={styles.movementHelperLine1}>{movementHelperText.line1}</span>
               <span className={styles.movementHelperLine2}>{movementHelperText.line2}</span>
             </div>
           )}
         </div>

    ── GameBoard.module.css ───────────────────────────────────────────────────

    5. CHANGE `.clockDisplay` font-size from `20px` to `26px`.

    6. REMOVE `.connectionLine` rule (it is no longer used after removing the ConnectionStatus div).

    7. REMOVE `.movesRemaining` rule (it is no longer used after removing the fragment).

    8. ADD two new rules after `.clockDisplay`:

         /* Flex row: green dot + clock, centred */
         .clockRow {
           display: flex;
           align-items: center;
           gap: 6px;
         }

    9. ADD movement helper text rules after the `.phaseSummary` block:

         /* Two-line movement helper shown only in MOVEMENT phase */
         .movementHelper {
           display: flex;
           flex-direction: column;
           align-items: center;
           gap: 0;
         }

         .movementHelperLine1 {
           font-size: 10px;
           font-weight: 700;
           color: #e0e0e0;
           letter-spacing: 0.03em;
         }

         .movementHelperLine2 {
           font-size: 9px;
           font-weight: 400;
           color: #a0a0a0;
         }

    ── Verification ──────────────────────────────────────────────────────────

    After all edits, confirm:
    - No import of ConnectionStatus remains in GameBoard.tsx
    - `.clockRow` exists in GameBoard.module.css with display:flex
    - `.clockDisplay` has font-size: 26px
    - `.movementHelper`, `.movementHelperLine1`, `.movementHelperLine2` exist in GameBoard.module.css
    - `.connectionLine` and `.movesRemaining` rules are absent from GameBoard.module.css

  </action>
  <verify>
    <automated>cd /d/dev/repo/counter-attack-poc && pnpm test --reporter=verbose 2>&1 | tail -20</automated>
  </verify>
  <done>
    All automated tests pass (71+). TypeScript build clean. GameBoard.tsx has no ConnectionStatus
    import, no remaining computation, no movesRemaining JSX, and renders the clockRow div with
    green dot + 26px clock. movementHelperText appears only when phase === 'MOVEMENT'.
  </done>
</task>

</tasks>

<threat_model>

## Trust Boundaries

| Boundary       | Description                                                             |
| -------------- | ----------------------------------------------------------------------- |
| GameState → UI | Read-only display; no user input crosses this boundary in these changes |

## STRIDE Threat Register

| Threat ID | Category               | Component                            | Disposition | Mitigation Plan                                                                                             |
| --------- | ---------------------- | ------------------------------------ | ----------- | ----------------------------------------------------------------------------------------------------------- |
| T-lme-01  | Information Disclosure | Green dot (always shows "Connected") | accept      | Dot is purely decorative/cosmetic; actual disconnect is handled by DisconnectBanner which remains unchanged |

</threat_model>

<verification>
1. `pnpm test` passes — all 71+ existing tests green.
2. `pnpm --filter client build` exits 0 with no TypeScript errors.
3. No `ConnectionStatus` import remains in GameBoard.tsx (grep check).
4. `movesRemaining` class absent from GameBoard.module.css.
5. `clockDisplay` font-size is 26px in GameBoard.module.css.
6. `text-align: center` present in `.phaseLabel` rule in ActionPanel.module.css.
</verification>

<success_criteria>

- ActionPanel "Choose action" label is horizontally centred.
- Scoreboard centre cell: green 8×8px dot sits to the left of the clock; no ConnectionStatus text or wrapper div.
- Clock renders at 26px.
- Phase summary shows "TEAM NAME · PHASE LABEL" only — no slot name or moves-remaining count.
- In MOVEMENT phase: a two-line helper appears under the phase summary ("Move up to N players" / "(2 hexes max)") derived from SLOT_TOTAL[movementSlot] at runtime.
- All existing automated tests continue to pass.
  </success_criteria>

<output>
Create `.planning/quick/260612-lme-scoreboard-action-panel-polish/260612-lme-SUMMARY.md` when done.
</output>
