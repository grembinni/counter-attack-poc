---
phase: quick-260612-kvw
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - packages/client/src/components/GameBoard.tsx
  - packages/client/src/components/GameBoard.module.css
  - packages/client/src/components/ActionPanel.tsx
  - packages/client/src/components/ActionPanel.module.css
  - packages/client/src/components/KickOffSetupPanel.tsx
  - packages/client/src/components/KickOffSetupPanel.module.css
autonomous: true
requirements: [UX-POLISH-01]

must_haves:
  truths:
    - 'Top band has exactly 4 grid tracks: player card | centre+scores | action | (no log track)'
    - 'Centre section shows [home shield | home score | clock | away score | away shield] in a single row'
    - 'Separate scoreboard div and its CSS class are gone from GameBoard.tsx'
    - 'All ActionPanel buttons fit within 80px with zero overflow (22-26px button height, 11px font)'
    - "ActionPanel 'First-time Pass' button label reads 'One-Touch'"
    - 'KickOffSetupPanel has no instruction paragraph — heading + constraints + button only'
    - 'logExpanded useState and the top-band log JSX block are removed from GameBoard.tsx'
    - 'A pitchRow wrapper contains SideLog + pitchContainer in a flex row below the top band'
    - 'SideLog collapsed: 28px wide strip with a › chevron; expanded: 220px wide with MATCH LOG heading + ActionLog'
    - 'pitchContainer still has position:relative (overlay anchor preserved)'
  artifacts:
    - path: packages/client/src/components/GameBoard.tsx
      provides: 'Integrated scores in centre, pitchRow+SideLog layout, no top-band log'
    - path: packages/client/src/components/GameBoard.module.css
      provides: '4-track topBand, scoreRow, pitchRow, sideLog, sideLogExpanded CSS'
    - path: packages/client/src/components/ActionPanel.tsx
      provides: 'One-Touch label, compact button sizing'
    - path: packages/client/src/components/ActionPanel.module.css
      provides: 'Compact ctaButton (22-26px height, 11px font, 4px padding)'
    - path: packages/client/src/components/KickOffSetupPanel.tsx
      provides: 'No instruction paragraph'
    - path: packages/client/src/components/KickOffSetupPanel.module.css
      provides: 'Compact panel with reduced font/padding if needed'
  key_links:
    - from: GameBoard.tsx pitchRow
      to: pitchContainer
      via: 'flex row wrapping, pitchContainer flex:1'
    - from: SideLog (inline component)
      to: ActionLog
      via: 'renders <ActionLog /> when expanded'
---

<objective>
Four UI polish changes to GameBoard, ActionPanel, and KickOffSetupPanel:

1. Scores flank the clock — merge scoreboard into the centre section as [home shield | home score | clock | away score | away shield]. Remove the separate scoreboard grid track. Top band shrinks from 5 to 4 grid tracks.
2. ActionPanel compression — rename "First-time Pass" → "One-Touch"; reduce button height to 22-26px, font to 11px, gap to 4px so ALL buttons fit in 80px with zero scroll.
3. KickOffSetupPanel compression — remove the verbose `<p className={styles.instruction}>` paragraph; keep heading + constraint rows + button.
4. Side-panel log — remove logExpanded state and the top-band log JSX entirely. Add a pitchRow flex wrapper below the top band containing an inline SideLog component (collapsed: 28px wide; expanded: 220px wide, CSS width transition) and the existing pitchContainer.

Purpose: Clean up the top band so it never overflows vertically, move the log to a side panel that doesn't affect header height.
Output: 6 modified files — GameBoard.tsx, GameBoard.module.css, ActionPanel.tsx, ActionPanel.module.css, KickOffSetupPanel.tsx, KickOffSetupPanel.module.css.
</objective>

<execution_context>
@D:/dev/repo/counter-attack-poc/.planning/quick/260612-kvw-gameboard-ui-polish-scores-flanking-cloc/260612-kvw-PLAN.md
</execution_context>

<context>
@D:/dev/repo/counter-attack-poc/.planning/STATE.md
@D:/dev/repo/counter-attack-poc/packages/client/src/components/GameBoard.tsx
@D:/dev/repo/counter-attack-poc/packages/client/src/components/GameBoard.module.css
@D:/dev/repo/counter-attack-poc/packages/client/src/components/ActionPanel.tsx
@D:/dev/repo/counter-attack-poc/packages/client/src/components/ActionPanel.module.css
@D:/dev/repo/counter-attack-poc/packages/client/src/components/KickOffSetupPanel.tsx
@D:/dev/repo/counter-attack-poc/packages/client/src/components/KickOffSetupPanel.module.css
@D:/dev/repo/counter-attack-poc/packages/client/src/components/ActionLog.tsx
</context>

<tasks>

<task type="auto">
  <name>Task 1: Merge scoreboard into centre + add side-log panel (GameBoard.tsx + GameBoard.module.css)</name>
  <files>
    packages/client/src/components/GameBoard.tsx
    packages/client/src/components/GameBoard.module.css
  </files>
  <action>
    GAMEBOARD.TSX — make all four changes that touch GameBoard.tsx:

    **A. Remove `logExpanded` state and scoreboard track from JSX.**
    - Delete: `const [logExpanded, setLogExpanded] = useState(false);`
    - Delete the entire Track 3 scoreboard `<div className={styles.scoreboard}>` block (including its five children: scoreIcon home, scoreNumeral home, scoreDash, scoreNumeral away, scoreIcon away).
    - Delete the entire Track 5 log toggle block: both the `logExpanded` branch (`<div className={styles.logExpanded}>…</div>`) and the `logCollapsed` branch (`<div className={styles.logCollapsed}>…</div>`).

    **B. Rewrite the centre section (Track 2) to embed scores.**
    Replace the existing `<div className={styles.topBandSection}>` centre block (the one containing `clockDisplay`, `connectionLine`, `phaseSummary`) with a new layout. The new centre section uses `className={styles.centreSection}` and renders two rows:
    - Row 1 (`className={styles.scoreRow}`): home shield icon + home score numeral + clock + away score numeral + away shield icon. Specifically:
      `<TeamShieldIcon color="#1a56b0" />` — `<span className={styles.scoreNumeral} style={{ color: '#1a56b0' }}>{score.home}</span>` — `<span className={styles.clockDisplay}>{clockDisplay}</span>` — `<span className={styles.scoreNumeral} style={{ color: '#c0392b' }}>{score.away}</span>` — `<TeamShieldIcon color="#c0392b" />`
    - Row 2 (`className={styles.connectionLine}`): `<ConnectionStatus />`
    - Row 3 (`className={styles.phaseSummary}`): unchanged — team name, phase label, moves remaining (exactly as before)

    **C. Add `SideLog` inline component above the `GameBoard` function.**
    Define a function component `SideLog` in the same file:
    - It has one piece of local state: `const [open, setOpen] = useState(false);`
    - When `open === false` (collapsed): render `<div className={styles.sideLogCollapsed}><button className={styles.sideLogChevron} onClick={() => setOpen(true)} aria-label="Open log">&#8250;</button></div>`
    - When `open === true` (expanded): render `<div className={styles.sideLogExpanded}><div className={styles.sideLogHeader}><span>MATCH LOG</span><button className={styles.sideLogChevron} onClick={() => setOpen(false)} aria-label="Close log">&#8249;</button></div><ActionLog /></div>`
    - The component uses a CSS width transition, so both states use the same transition class on their root element. Use two separate class names (`sideLogCollapsed` / `sideLogExpanded`) rather than a shared class with conditional modifier — the CSS handles the transition via `transition: width 0.2s ease`.

    **D. Wrap pitch area in `pitchRow`.**
    The `<DisconnectBanner />` stays between topBand and pitchRow (it is not inside pitchRow).
    Replace the bare `<div className={styles.pitchContainer}>` with:
    ```
    <div className={styles.pitchRow}>
      <SideLog />
      <div className={styles.pitchContainer}>
        {/* HexGrid + overlay blocks unchanged */}
      </div>
    </div>
    ```
    pitchRow must have `flex: 1; overflow: hidden` so pitchContainer still fills available space.

    GAMEBOARD.MODULE.CSS:

    **Grid change:** Update `.topBand` `grid-template-columns` from `auto 1fr auto 1fr auto` to `auto 1fr 1fr auto`. Four tracks: player card (auto) | centre+scores (1fr) | action (1fr) | (nothing, log removed). No `auto` scoreboard track.

    **New class `.centreSection`:** Same base as `.topBandSection` — `background: #16213e; border-right: 1px solid #0f3460; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 0 8px; overflow: hidden;` — but its child scoreRow is a row rather than column.

    **New class `.scoreRow`:** `display: flex; align-items: center; justify-content: center; gap: 6px;` — renders the [shield | score | clock | score | shield] row inside centreSection.

    **`.scoreNumeral`** stays as-is (font-size: 24px, font-weight: 700, Courier) — reused inside scoreRow. The `scoreIcon`, `scoreDash`, and `.scoreboard` classes are no longer referenced and may be removed or left as dead CSS. Remove them to keep the file clean.

    **pitchRow:** `.pitchRow { display: flex; flex-direction: row; flex: 1; overflow: hidden; }`. The pitchContainer inside must still be `flex: 1` so it fills the remaining width after SideLog.

    **SideLog CSS:**
    - `.sideLogCollapsed { width: 28px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; background: #16213e; border-right: 1px solid #0f3460; transition: width 0.2s ease; }`
    - `.sideLogExpanded { width: 220px; flex-shrink: 0; display: flex; flex-direction: column; background: #16213e; border-right: 1px solid #0f3460; overflow: hidden; transition: width 0.2s ease; }`
    - `.sideLogHeader { display: flex; align-items: center; justify-content: space-between; padding: 6px 8px; font-size: 11px; font-weight: 700; color: #a0a0a0; text-transform: uppercase; border-bottom: 1px solid #0f3460; flex-shrink: 0; }`
    - `.sideLogChevron { font-size: 14px; font-weight: 700; color: #a0a0a0; background: none; border: none; cursor: pointer; padding: 4px; line-height: 1; }` plus hover: `color: #e0e0e0`

    Remove the now-unused CSS classes: `.scoreboard`, `.scoreIcon`, `.scoreDash`, `.logCollapsed`, `.logExpanded`, `.logChevron`, `.logHeader`.

    Keep `.scoreNumeral` because it is reused inside `.scoreRow`.

  </action>
  <verify>
    <automated>cd D:/dev/repo/counter-attack-poc && pnpm --filter client build 2>&1 | tail -20</automated>
  </verify>
  <done>
    Build passes with zero TypeScript errors. GameBoard.tsx has no `logExpanded` reference, no `.scoreboard` class reference, no Track 5 log JSX. The centre section renders score+clock+score in a single row. pitchRow wraps SideLog + pitchContainer.
  </done>
</task>

<task type="auto">
  <name>Task 2: Compress ActionPanel + rename One-Touch; compress KickOffSetupPanel</name>
  <files>
    packages/client/src/components/ActionPanel.tsx
    packages/client/src/components/ActionPanel.module.css
    packages/client/src/components/KickOffSetupPanel.tsx
    packages/client/src/components/KickOffSetupPanel.module.css
  </files>
  <action>
    ACTIONPANEL.TSX:
    - In `PASS_TYPE_LABELS`, change `FIRST_TIME_PASS: 'First-time Pass'` to `FIRST_TIME_PASS: 'One-Touch'`.
    - Find every JSX button that has literal text `First-time Pass` or `First-Time Pass` (case-insensitive search) and change the text to `One-Touch`. In this file the button in the PASS/KICK_OFF three-step chooser block reads `First-time Pass` — change it to `One-Touch`.
    - No other ActionPanel.tsx changes needed.

    ACTIONPANEL.MODULE.CSS:
    The goal is ALL buttons fit in 80px with zero scroll. The action section (`.actionSection` in GameBoard.module.css) has `max-height: 76px; overflow-y: auto`. The tallest panel (MOVEMENT: Snapshot + Undo + End Turn + optional error) renders up to 4 items. To fit 4 compact items in ~72px usable height: button height 22px, gap 4px, panel padding 4px top+bottom = 4 + 4*(22) + 3*(4) + 4 = 100px — too tall for 4 items. So use 3px gap and 3px padding: 3 + 4*22 + 3*3 + 3 = 97px — still tight. Realistically, Snapshot only appears when ball carrier is in penalty area, so typical max is 3 buttons. For 3 buttons: 3 + 3*22 + 2*3 + 3 = 75px — fits.

    Set `.panel` to `padding: 4px 6px; gap: 3px;` (down from `16px; 8px`).
    Set `.ctaButton` to `padding: 3px 8px; font-size: 11px; font-weight: 700;`. The browser default line-height for 11px font inside a border-radius button renders at ~22-24px total height. Keep `border-radius: 4px` and `transition: background 0.15s` unchanged.
    Set `.backButton` to `padding: 2px 6px; font-size: 11px;`.
    Set `.phaseLabel` to `font-size: 11px;` (down from 12px).
    Set `.gkLabel` to `font-size: 11px;` (down from 13px).
    Set `.errorText` to `font-size: 11px;` (down from 13px).

    Also update `.actionSection` in GameBoard.module.css: change `padding: 8px` to `padding: 4px` and keep `overflow-y: auto; max-height: 76px` — this is the wrapper in GameBoard.module.css (Task 1 file already being modified, so add this change there; if Task 1 is already complete you must Edit GameBoard.module.css here to add the padding reduction). Note: since Task 1 and Task 2 run sequentially in the same agent session, add this `.actionSection` padding change as part of Task 2 edits to GameBoard.module.css.

    KICKOFFSETUPPANEL.TSX:
    - Remove the `<p className={styles.instruction}>…</p>` paragraph entirely. The panel should render: heading → constraint rows → error → Ready/Waiting button. No prose instruction paragraph.
    - No other logic changes.

    KICKOFFSETUPPANEL.MODULE.CSS:
    - Remove the `.instruction` rule entirely (no longer referenced).
    - Change `.panel` to `padding: 6px 8px; gap: 4px;` (down from 16px / 8px).
    - Change `.panelHeading` to `font-size: 12px;`.
    - Change `.constraintRow` to `font-size: 11px;`.
    - Change `.ctaButton` to `padding: 4px 10px; font-size: 11px;`.
    - Change `.errorText` to `font-size: 11px;`.
    These reductions give the panel: 6 + 12(heading line-height) + 2*(11*1.5=16.5)(constraints) + 22(button) + 6 = ~79px — fits within 80px.

  </action>
  <verify>
    <automated>cd D:/dev/repo/counter-attack-poc && pnpm --filter client build 2>&1 | tail -20</automated>
  </verify>
  <done>
    Build passes. ActionPanel.module.css ctaButton has font-size: 11px and padding: 3px 8px. PASS_TYPE_LABELS FIRST_TIME_PASS reads 'One-Touch'. KickOffSetupPanel.tsx has no instruction paragraph. KickOffSetupPanel.module.css has no .instruction rule.
  </done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <what-built>
    All four UI changes applied:
    1. Top band centre section now shows [home shield | home score | clock | away score | away shield].
    2. Separate scoreboard track removed — top band is now 4 tracks.
    3. ActionPanel all buttons compact (11px font, ~22px height), "One-Touch" label visible.
    4. KickOffSetupPanel has no instruction paragraph — constraint rows + button only.
    5. Side-panel log (SideLog) appears to the left of the pitch. Collapsed: 28px strip with ›. Expanded: 220px with MATCH LOG heading and action log entries.
    6. Top band has no log toggle button or log panel.
  </what-built>
  <how-to-verify>
    1. Run `pnpm --filter client dev` in the repo root and open http://localhost:5173.
    2. Create or join a room so the GameBoard renders.
    3. TOP BAND: Confirm the centre section shows two shield icons flanking the score numerals and clock (e.g. [blue-shield] 0 [00:00] 0 [red-shield]). Confirm there is no separate scoreboard column to the right of the clock.
    4. TOP BAND HEIGHT: The top band must be exactly 80px with no vertical clipping or scrollbar on any section.
    5. ACTIONPANEL: In MOVEMENT or PASS phase, confirm all buttons (Move/Standard Pass/One-Touch/High Pass/Long Ball/Shoot/Undo/End Turn) are fully visible without scrolling. Confirm the "One-Touch" label appears where "First-time Pass" used to be.
    6. SIDE LOG: Confirm a narrow (28px) dark strip is visible to the left of the pitch with a › button. Click it — confirm panel expands to 220px showing "MATCH LOG" and `<ActionLog />` entries. Click the ‹ button — confirm it collapses back to 28px.
    7. KICK-OFF SETUP: Put the game into KICK_OFF_SETUP phase. Confirm the panel shows heading + constraint rows + Ready button, with no instruction paragraph, and fits within 80px without scrolling.
  </how-to-verify>
  <resume-signal>Type "approved" if all checks pass, or describe any issues found.</resume-signal>
</task>

</tasks>

<verification>
- `pnpm --filter client build` passes with zero TypeScript errors after each task.
- No `logExpanded` reference remains in GameBoard.tsx.
- No `styles.scoreboard` reference remains in GameBoard.tsx.
- `FIRST_TIME_PASS` label in ActionPanel is `'One-Touch'`.
- KickOffSetupPanel.tsx has no `styles.instruction` usage.
- Human UAT confirms 80px header with no scroll in any panel and the side-log expands/collapses correctly.
</verification>

<success_criteria>

- Top band centre section: [home shield | home score | clock | away score | away shield] in a single row, no separate scoreboard grid track.
- All ActionPanel buttons visible within 80px, no scroll, "One-Touch" label present.
- KickOffSetupPanel fits 80px with no instruction paragraph and no scroll.
- SideLog panel left of pitch: 28px collapsed, 220px expanded with ActionLog, 0.2s CSS width transition.
- Build clean (zero TypeScript errors).
  </success_criteria>

<output>
No SUMMARY.md required for quick tasks. Return the plan path to the orchestrator.
</output>
