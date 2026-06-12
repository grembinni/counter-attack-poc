---
phase: quick-260612-ike
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - packages/client/src/components/GameBoard.tsx
  - packages/client/src/components/GameBoard.module.css
autonomous: true
requirements: []
must_haves:
  truths:
    - 'Top band shows: [player card] | [centre: clock + phase] | [scoreboard: home icon + scores + away icon] | [action] | [log]'
    - "Score section is centered with colored shield icons replacing 'Home'/'Away' text"
    - '56px edge tracks removed'
    - 'Player card has 3 columns: info (name/role/icon) | stats-left (PAC/DRB/HED or AA/SHT or SAV) | stats-right (HPS/RES/TAC and HND for GK)'
    - 'Stat values display green bubble for 5-6, yellow for 3-4, red for 1-2'
    - 'GK role shows AA/SAV/HND; outfield shows HED/SHT, no HND'
  artifacts:
    - path: 'packages/client/src/components/GameBoard.tsx'
      provides: 'Refactored top band layout and player card'
    - path: 'packages/client/src/components/GameBoard.module.css'
      provides: 'New CSS for 5-column top band, player card 3-column layout, stat bubbles'
  key_links:
    - from: 'GameBoard.tsx playerCard section'
      to: 'displayPiece.role'
      via: 'conditional stat selection'
      pattern: "displayPiece\\.role.*GK"
---

<objective>
Refactor the GameBoard top-band layout and player card to match the new design spec.

Purpose: Move scores to center (compact scoreboard with team icons), shift player card left, replace flat stat list with 3-column card layout, and add role-conditional stats with color-coded value bubbles.

Output: Updated GameBoard.tsx and GameBoard.module.css implementing the new 5-track top band and redesigned player card.
</objective>

<execution_context>
@/root/.claude/gsd-core/workflows/execute-plan.md
@/root/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@packages/client/src/components/GameBoard.tsx
@packages/client/src/components/GameBoard.module.css
@packages/shared/src/types.ts
</context>

<tasks>

<task type="auto">
  <name>Task 1: Refactor top-band CSS to 5-track layout and add player card / stat-bubble styles</name>
  <files>packages/client/src/components/GameBoard.module.css</files>
  <action>
Replace the 6-track `topBand` grid with a 5-track layout. Remove the two 56px score edge tracks. The new grid is:

`grid-template-columns: auto 1fr auto 1fr auto`

Track meanings (left to right): player-card | centre (clock+phase) | scoreboard | action | log.

Remove `.scoreColumn`, `.scoreColumnAway`, and `.scoreTeamName` classes entirely — they are replaced by the new scoreboard section below.

Add/replace the following CSS classes:

**.scoreboard** — the centered scoreboard section (track 3):

- `display: flex; align-items: center; justify-content: center; gap: 6px;`
- `background: #16213e; border-left: 1px solid #0f3460; border-right: 1px solid #0f3460; padding: 0 12px;`

**.scoreIcon** — the SVG shield icon container:

- `width: 28px; height: 28px; display: flex; align-items: center; justify-content: center;`

**.scoreNumeral** stays but update: `font-family: 'Courier New', Courier, monospace; font-size: 24px; font-weight: 700;`

**.scoreDash** — separator between numerals: `font-size: 20px; font-weight: 700; color: #a0a0a0; margin: 0 2px;`

**.playerCardSection** — wrapper for track 1 (player card column):

- `display: flex; flex-direction: column; justify-content: center; padding: 4px 8px;`
- `background: #16213e; border-right: 1px solid #0f3460; min-width: 180px; max-width: 240px;`

**.playerCardName** — row 1 of info col: `font-size: 13px; font-weight: 700; color: #e0e0e0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;`

**.playerCardRole** — row 2 of info col: `font-size: 11px; font-weight: 400; color: #a0a0a0; text-transform: uppercase;`

**.playerCard3Col** — 3-column grid inside the card:

- `display: grid; grid-template-columns: auto 1fr 1fr; gap: 2px 6px; align-items: start;`

**.playerCardInfoCol** — column 1 (name/role/icon): `display: flex; flex-direction: column; gap: 2px;`

**.playerCardStatsCol** — columns 2 and 3: `display: flex; flex-direction: column; gap: 2px;`

**.statRow** — one stat label+bubble pair: `display: flex; align-items: center; gap: 4px; font-size: 10px;`

**.statLabel** — the abbreviation: `color: #a0a0a0; width: 22px; text-align: right; flex-shrink: 0;`

**.statBubble** — the colored value circle:

- `width: 18px; height: 18px; border-radius: 50%; display: flex; align-items: center; justify-content: center;`
- `font-size: 10px; font-weight: 700; color: #fff; flex-shrink: 0;`

**.statBubbleGreen** (values 5-6): `background: #27ae60;`
**.statBubbleYellow** (values 3-4): `background: #f39c12;`
**.statBubbleRed** (values 1-2): `background: #e74c3c;`

Remove the old `.playerCard`, `.playerCardHeader`, `.compactStatsGrid`, `.compactStat`, `.compactStatLabel`, `.compactStatValue` classes.

Keep `.playerCardPlaceholder` — no change needed.

Keep `.topBandSection` for the centre and action tracks (tracks 2 and 4). These still use `1fr` so they behave identically to before.

Keep `.logCollapsed` / `.logExpanded` / `.logChevron` / `.logHeader` — no changes.
</action>
<verify>
<automated>cd /d/dev/repo/counter-attack-poc && pnpm --filter client exec tsc --noEmit 2>&1 | tail -20</automated>
</verify>
<done>CSS file compiles without errors; old 56px-track classes removed; new 5-track and stat bubble classes present.</done>
</task>

<task type="auto">
  <name>Task 2: Refactor GameBoard.tsx — new top-band order, compact scoreboard with SVG icons, 3-column player card</name>
  <files>packages/client/src/components/GameBoard.tsx</files>
  <action>
**1. Remove `COMPACT_STATS` array** — the new card does not use a flat stat array. Delete that constant.

**2. Add a `statBubbleClass` helper** at module scope (before the component function):

```
function statBubbleClass(value: number, styles: CSSModuleClasses): string {
  if (value >= 5) return styles.statBubbleGreen;
  if (value >= 3) return styles.statBubbleYellow;
  return styles.statBubbleRed;
}
```

Import the CSS module type as `import type { CSSModuleClasses } from` — actually, because CSS Modules in this project are imported as `styles`, the helper can accept `Record<string, string>` for the second param. Use the simplest form that TypeScript accepts without a cast.

Alternatively, just inline the ternary in JSX directly — whichever avoids a TypeScript error is preferred.

**3. Add `TeamShieldIcon` inline SVG component** (small, module-local, not exported):

```tsx
function TeamShieldIcon({ color }: { color: string }) {
  return (
    <svg width="22" height="26" viewBox="0 0 22 26" fill="none" aria-hidden="true">
      <path
        d="M11 1L2 4.5V12C2 17.5 6 22.5 11 25C16 22.5 20 17.5 20 12V4.5L11 1Z"
        fill={color}
        stroke="rgba(255,255,255,0.2)"
        strokeWidth="1"
      />
    </svg>
  );
}
```

**4. Rewrite the JSX `<div className={styles.topBand}>` children** to match the new 5-track order:

Track 1 — Player card (`.playerCardSection`):

- If no `displayPiece`: render `<span className={styles.playerCardPlaceholder}>Select a piece</span>` inside the section.
- If `displayPiece` exists: render a `<div className={styles.player3Col}>` (use class `.playerCard3Col`) containing:
  - **Col 1 (info)** — `<div className={styles.playerCardInfoCol}>`:
    - Row 1: `<span className={styles.playerCardName}>{displayPiece.name}</span>`
    - Row 2: `<span className={styles.playerCardRole}>{displayPiece.role}</span>`
    - Row 3: `<TeamShieldIcon color={displayPiece.teamId === 'home' ? '#1a56b0' : '#c0392b'} />`
  - **Col 2 (stats left)** — `<div className={styles.playerCardStatsCol}>`:
    - PAC: `displayPiece.pace`
    - DRB: `displayPiece.dribbling`
    - HED (outfield) or AA (GK=`displayPiece.role === 'GK'`): heading vs aerialAbility
    - SHT (outfield) or SAV (GK): shooting vs saving
  - **Col 3 (stats right)** — `<div className={styles.playerCardStatsCol}>`:
    - HPS: `displayPiece.highPass`
    - RES: `displayPiece.resilience`
    - TAC: `displayPiece.tackling`
    - HND (GK only): `displayPiece.handling` — conditionally rendered only when `displayPiece.role === 'GK'`

Each stat renders as:

```tsx
<div className={styles.statRow}>
  <span className={styles.statLabel}>PAC</span>
  <span className={statBubbleClass(displayPiece.pace, styles)}>{displayPiece.pace}</span>
</div>
```

Where `statBubbleClass` returns the correct CSS module class name for the value (green/yellow/red). Because CSS module class names are strings, the helper returns `styles.statBubbleGreen | styles.statBubbleYellow | styles.statBubbleRed`. Compose it with `.statBubble`:

```tsx
className={`${styles.statBubble} ${statBubbleClass(val, styles)}`}
```

Track 2 — Centre section (`.topBandSection`): unchanged from current (clock, connectionLine, phaseSummary).

Track 3 — Scoreboard (`.scoreboard`):

```tsx
<div className={styles.scoreboard}>
  <div className={styles.scoreIcon}>
    <TeamShieldIcon color="#1a56b0" />
  </div>
  <span className={styles.scoreNumeral} style={{ color: '#1a56b0' }}>
    {score.home}
  </span>
  <span className={styles.scoreDash}>–</span>
  <span className={styles.scoreNumeral} style={{ color: '#c0392b' }}>
    {score.away}
  </span>
  <div className={styles.scoreIcon}>
    <TeamShieldIcon color="#c0392b" />
  </div>
</div>
```

Track 4 — Action section (`.topBandSection`): unchanged (KickOffSetupPanel / ReplayPanel / ActionPanel swap).

Track 5 — Log toggle (`.logCollapsed` / `.logExpanded`): unchanged.

**5. Delete the two old score column divs** (`scoreColumn` and `scoreColumnAway`) and their children — these are the `<div className={styles.scoreColumn}>` at the top and `<div className={styles.scoreColumnAway}>` at the bottom of the topBand.

**6. Preserve all overlay JSX** (HALF_TIME, FULL_TIME) — no changes below the topBand.

The `CSSModuleClasses` import is not needed; just use `typeof styles` or inline the ternary directly:

```tsx
function statBubbleClass(value: number): string {
  if (value >= 5) return styles.statBubbleGreen ?? '';
  if (value >= 3) return styles.statBubbleYellow ?? '';
  return styles.statBubbleRed ?? '';
}
```

Because `styles` is in the module scope and `statBubbleClass` is defined inside the module (but outside the component), it can close over `styles`. Verify TypeScript does not flag this — if it does, move the helper inside the component or inline the ternary.
</action>
<verify>
<automated>cd /d/dev/repo/counter-attack-poc && pnpm --filter client exec tsc --noEmit 2>&1 | tail -20 && pnpm --filter client test run 2>&1 | tail -30</automated>
</verify>
<done> - TypeScript compiles without errors. - All existing GameBoard tests pass (or failures are pre-existing, not introduced by this change). - Top band visually shows 5 sections: player card | centre | scoreboard (icons+scores) | action | log. - Player card shows 3 columns with role-conditional stats and colored bubbles.
</done>
</task>

</tasks>

<threat_model>

## Trust Boundaries

| Boundary          | Description                                                                 |
| ----------------- | --------------------------------------------------------------------------- |
| store → component | gameState.pieces / selectedPieceId from Zustand — display-only, no mutation |

## STRIDE Threat Register

| Threat ID | Category               | Component                 | Disposition | Mitigation Plan                                                |
| --------- | ---------------------- | ------------------------- | ----------- | -------------------------------------------------------------- |
| T-ike-01  | Information Disclosure | TeamShieldIcon color prop | accept      | color is hardcoded (#1a56b0, #c0392b) — no user input involved |
| T-ike-SC  | Tampering              | npm/pip/cargo installs    | accept      | no new dependencies introduced in this refactor                |

</threat_model>

<verification>
1. `pnpm --filter client exec tsc --noEmit` — zero errors.
2. `pnpm --filter client test run` — all tests pass (GameBoard test suite included).
3. Visual check: top band has 5 sections in correct order; score section is centered with shield icons; player card is leftmost; stat bubbles show correct colors.
</verification>

<success_criteria>

- Top band grid is `auto 1fr auto 1fr auto` (5 tracks, no 56px edges).
- Shield icons appear beside scores; "Home"/"Away" text removed from score section.
- Player card appears as the leftmost top-band section.
- Player card: 3 columns — info / stats-left / stats-right.
- GK (role === 'GK'): col-2 shows PAC/DRB/AA/SAV; col-3 shows HPS/RES/TAC/HND.
- Outfield: col-2 shows PAC/DRB/HED/SHT; col-3 shows HPS/RES/TAC (no HND).
- Stat bubbles: green (#27ae60) for 5-6, yellow (#f39c12) for 3-4, red (#e74c3c) for 1-2.
- TypeScript clean; existing tests pass.
  </success_criteria>

<output>
Create `.planning/quick/260612-ike-refactor-gameboard-top-band-layout-and-p/260612-ike-SUMMARY.md` when done.
</output>
