# Phase 35: ActionPanel & Log Standardization - Pattern Map

**Mapped:** 2026-07-27
**Files analyzed:** 12 (all modified, none new)
**Analogs found:** 12 / 12 (all changes are internal — each file is its own primary pattern source; one new shared helper needed for D-06, modeled on an existing hook file)

No new files are created in this phase (per CONTEXT.md scope). Instead of "new file -> external analog," this map is "modified file -> the sibling file(s) that already have the target end-state pattern," plus one genuinely new file (the D-06 shared color-state helper) mapped to its closest existing analog.

## File Classification

| File                                                                                                                                    | Role                          | Data Flow                                       | Pattern Source                                                                                                                                                 | Match Quality                      |
| --------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- | ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| `packages/client/src/components/ActionPanel.tsx`                                                                                        | component (phase-gated panel) | request-response (emits socket events on click) | itself (MOVE phase block, lines 932-965) is the target pattern for D-02; `FreeKickSetupPanel.tsx`/`KickOffSetupPanel.tsx`/`ReplayPanel.tsx` for D-07/D-08/D-09 | exact (self-referential + sibling) |
| `packages/client/src/components/ActionPanel.module.css`                                                                                 | component styles              | n/a                                             | `KickOffSetupPanel.module.css`/`FreeKickSetupPanel.module.css` `.panel` (no border, already compliant)                                                         | exact                              |
| `packages/client/src/components/ActionPanel.test.tsx`                                                                                   | test                          | n/a                                             | `FreeKickSetupPanel.test.tsx` (existing coverage of button-color/heading assertions to mirror)                                                                 | role-match                         |
| `packages/client/src/components/ActionLog.tsx`                                                                                          | component (log renderer)      | transform (event log -> formatted lines)        | itself; `formatEvent` cases with existing `→`/sentence-case/`✓`/`✗` conventions (MOVE/STANDARD_PASS cases) are the target pattern for the non-compliant cases  | exact (self-referential)           |
| `packages/client/src/components/ActionLog.module.css`                                                                                   | component styles              | n/a                                             | `FreeKickSetupPanel.module.css`/`KickOffSetupPanel.module.css` `.panel` (no border)                                                                            | exact                              |
| `packages/client/src/components/ActionLog.test.tsx`                                                                                     | test                          | n/a                                             | existing test file itself — extend in place                                                                                                                    | exact                              |
| `packages/client/src/components/GameBoard.tsx` (`SideLog()`)                                                                            | component (wrapper)           | n/a                                             | itself — remove duplicate label downstream in `ActionLog.tsx`                                                                                                  | exact                              |
| `packages/client/src/components/GameBoard.module.css`                                                                                   | component styles              | n/a                                             | `KickOffSetupPanel.module.css`/`FreeKickSetupPanel.module.css` `.panel` (no border)                                                                            | exact                              |
| `packages/client/src/components/KickOffSetupPanel.tsx`/`.module.css`                                                                    | component                     | request-response                                | `FreeKickSetupPanel.tsx` (waiting-text style, `panelHeading` pattern) for D-09; itself for D-08 (Ready -> Confirm)                                             | role-match                         |
| `packages/client/src/components/FreeKickSetupPanel.tsx`/`.module.css`/`.test.tsx`                                                       | component                     | request-response                                | `ActionPanel.tsx`'s MOVE-phase `ctaButtonClass(remaining)` call for D-06; itself for D-01/D-08                                                                 | exact                              |
| `packages/client/src/components/ReplayPanel.tsx`/`.module.css`                                                                          | component                     | request-response                                | `KickOffSetupPanel.module.css`/`FreeKickSetupPanel.module.css` `.panel` (no-border target state)                                                               | role-match                         |
| **NEW:** `packages/client/src/hooks/useCtaColorClass.ts` (or similar — D-06 shared helper; exact filename/shape is Claude's discretion) | hook/util                     | pure transform                                  | `packages/client/src/hooks/useTeamColors.ts` (pure-function + thin-hook-wrapper pattern)                                                                       | exact                              |

## Pattern Assignments

### D-06: Shared color-state helper (new file)

**Analog:** `packages/client/src/hooks/useTeamColors.ts`

This file establishes the exact pattern to follow for extracting `ctaButtonClass`: a **pure, non-hook function** (safe to call from anywhere, no Zustand/React dependency) is the primary export, with a thin hook-style wrapper only where call-site naming consistency matters. Follow this shape:

```typescript
// packages/client/src/hooks/useTeamColors.ts lines 1-16
import { TEAM_CONFIGS } from '@counter-attack/shared';
import type { TeamId } from '@counter-attack/shared';
import { hex as contrastHex } from 'wcag-contrast';

/**
 * Pure — no Zustand/React dependency. Safe to call from anywhere, including
 * loops and non-component helper functions...
 */
export function teamAccentColor(teamId: TeamId | undefined): string {
  if (!teamId) return '#888888';
  return TEAM_CONFIGS[teamId]?.palette.uiColor ?? '#888888';
}
```

**Current logic to relocate** — `ActionPanel.tsx` lines 42-49:

```typescript
/**
 * UX-08: CTA button color-state selector (mirrors GameBoard's statBubbleClass pattern).
 * Returns .ctaButtonReady (green) when all eligible pieces have moved/placed,
 * .ctaButtonPending (orange) while any eligible piece remains unmoved.
 */
function ctaButtonClass(eligibleRemaining: number): string {
  return eligibleRemaining <= 0 ? (styles.ctaButtonReady ?? '') : (styles.ctaButtonPending ?? '');
}
```

**IMPORTANT caveat found during pattern mapping:** `FreeKickSetupPanel.tsx`'s existing `endTurnColorClass` (lines 169-174) is **not** a drop-in equivalent of `ctaButtonClass(remaining)` — it additionally gates on `constraintsMet` (returns `''`, i.e. no color class at all, when constraints aren't met):

```typescript
// FreeKickSetupPanel.tsx lines 169-174
const endTurnColorClass = constraintsMet
  ? placedCount >= stage.max
    ? (styles.ctaButtonReady ?? '')
    : (styles.ctaButtonPending ?? '')
  : '';
```

The shared helper's signature must accommodate this — either accept an optional `disabled`/`constraintsMet` boolean, or the caller composes `constraintsMet ? sharedHelper(remaining) : ''` at each call site. Planner should decide the exact signature; both `ActionPanel.tsx` and `FreeKickSetupPanel.tsx` must end up calling the same single implementation (per D-06/Claude's Discretion).

Since `ctaButtonClass` references `styles.ctaButtonReady`/`styles.ctaButtonPending` (component-local CSS module import), and the helper must work for two different components each with their own CSS module, the extracted function should take the class-name strings as parameters (or both modules should export identically-named classes, which they already do — `ctaButtonReady`/`ctaButtonPending` exist in both `ActionPanel.module.css` and `FreeKickSetupPanel.module.css` per the confirm-dialog code at `FreeKickSetupPanel.tsx` line 145: `styles.ctaButtonReady`). Simplest approach: helper takes `(eligibleRemaining: number, readyClass: string, pendingClass: string, constraintsMet = true)`.

---

### D-02: Propagate `ctaButtonClass` to hardcoded phases (ActionPanel.tsx)

**Analog (target pattern):** `ActionPanel.tsx` MOVE phase, lines 958-963 (already correct):

```typescript
<button
  className={`${styles.ctaButton} ${ctaButtonClass(remaining ?? 0)}`}
  title={ACTION_SUMMARY['End Turn']}
  onClick={withEndTurnConfirm(remaining ?? 0, emitEndTurn)}
>
  End Turn
</button>
```

**Edit sites (currently hardcoded `styles.ctaButtonReady`, replace with `ctaButtonClass(<phase's own remaining local>)`):**

- HIGH_PASS_MOVE — line 297, `hpmEligibleRemaining` computed at line 280
- FIRST_TIME_PASS_MOVE — line 337, `ftpmEligibleRemaining` computed at line 320
- SNAPSHOT_DEFLECT — line 392, `sdEligibleRemaining` computed at line 382
- GK_KICK_MOVE — line 597, `gkmEligibleRemaining` computed at line 587
- FREE_MOVE_ATTACK/FREE_MOVE_DEFENSE (shared block) — line 635, uses a `remaining` local (verify exact name at that block during implementation; not yet read line-by-line beyond the grep hit)

Pattern for each: replace `${styles.ctaButtonReady ?? ''}` with `${ctaButtonClass(xxxEligibleRemaining)}` (or the post-D-06 shared-helper call), mirroring line 959 exactly.

---

### D-06 dead-code deletion (ActionPanel.tsx FREE_KICK_SETUP block)

**Confirmed dead code** — `ActionPanel.tsx` lines 648-718 (`if (phase === 'FREE_KICK_SETUP') { ... }`). `GameBoard.tsx`'s `topBandRight` selects `FreeKickSetupPanel` for this phase instead (see Integration Points below) — this whole block, including its own hardcoded `ctaButtonReady` at line 708, is confirmed unreachable in production and should be deleted entirely per D-06, not fixed.

---

### D-01: Border removal (container/frame elements only)

**Target end-state already present** — `KickOffSetupPanel.module.css` and `FreeKickSetupPanel.module.css` `.panel` selectors have **no** `border` declaration (only `border-radius: 4px`). Use these as the reference "already compliant" pattern.

**Edit sites (remove the `border: 1px solid var(--color-border...)` declaration, keep `border-radius`):**

- `ActionLog.module.css` line 3 — `.panel { border: 1px solid var(--color-border); border-radius: 4px; }`
- `ActionPanel.module.css` line 128 — `.confirmCard { border: 1px solid var(--color-border); border-radius: 4px; }` (lines 26/58 `.ctaButton`/`.backButton` borders are explicitly kept — buttons are interactive controls, exempt per D-01)
- `ReplayPanel.module.css` line 82 — `.panel { border: 1px solid var(--color-border); border-radius: 4px; }`
- `FreeKickSetupPanel.module.css` line 82 (confirm — verify exact selector at that line; `.confirmCard`, near-identical clone of ActionPanel's) — same border pattern
- `GameBoard.module.css` line 330 — `.sideLogExpanded { ...; border-right: 1px solid var(--color-border); ... }` (note: line 319 `.sideLogCollapsed` also has an identical `border-right` — CONTEXT.md only names `.sideLogExpanded`; confirm at implementation whether the collapsed strip's border is in scope too, since both currently create the same visual line)

**Note on `FreeKickSetupPanel.module.css`/`KickOffSetupPanel.module.css` `.panel`:** already border-free (line 6/3 in each respectively is `border-radius: 4px` alone) — confirms the target end-state, no change needed there.

---

### D-07: Panel heading consistency

**Analog:** `KickOffSetupPanel.tsx` line 91 / `ReplayPanel.tsx` line 32 / `FreeKickSetupPanel.tsx` lines 75/178 — all use a `<span className={styles.panelHeading}>` (or `styles.heading` in ReplayPanel — naming is inconsistent between siblings, worth normalizing to one CSS class name in the shared pattern if in scope, otherwise reuse each file's existing class name):

```typescript
// KickOffSetupPanel.tsx line 91
<span className={styles.panelHeading}>Kick-Off Setup</span>
```

```typescript
// FreeKickSetupPanel.tsx line 178 (also line 75 in the waiting-panel early return)
<span className={styles.panelHeading}>Offside — Free Kick</span>
```

```typescript
// ReplayPanel.tsx line 32
<span className={styles.heading}>Replay</span>
```

**Edit site:** `ActionPanel.tsx` currently has no heading span in any phase block. Add a `styles.panelHeading` (or add the class to `ActionPanel.module.css` if it doesn't exist yet — verify) span at the top of each phase-gated return block, and to `waitingPanel` (lines 120-127) and the `helperBlock` pattern generally. Heading text is Claude's discretion (D-07) — a static "Actions" label or phase-derived label, applied uniformly.

---

### D-08: Confirm button verb unification

**Target text:** `"Confirm"` everywhere.

**Edit sites:**

- `KickOffSetupPanel.tsx` line 127 — `Ready` → `Confirm` (button at lines 121-128)
- `FreeKickSetupPanel.tsx` line 215 — `End Turn` → `Confirm` (button at lines 208-217; note `FreeKickSetupPanel.tsx`'s confirm-dialog _already_ uses `"Confirm"` for its dialog's own confirm button at line 151 — that's a different button, the dialog's own confirm action, not the main End Turn CTA — do not conflate)
- `ActionPanel.tsx` — every `End Turn` button text across all phase blocks (search `>End Turn<` — appears in HIGH_PASS_MOVE ~line 300ish, FIRST_TIME_PASS_MOVE, SNAPSHOT_DEFLECT, HEADER, GK_KICK_MOVE, FREE_MOVE_ATTACK/DEFENSE, MOVE at line 963) → `Confirm`

---

### D-09: Waiting-state phrasing

**Analog (target pattern):** `FreeKickSetupPanel.tsx` lines 76-78:

```typescript
<span className={styles.constraintRow}>
  {isKicking ? 'Attacking' : 'Defending'} team is repositioning&hellip;
</span>
```

**Edit sites:**

- `ActionPanel.tsx` `waitingPanel` (lines 120-127) — currently generic:
  ```typescript
  const waitingPanel = (
    <div className={styles.panel}>
      <div className={styles.helperBlock}>
        <span className={styles.helperLine1}>Opponent&apos;s Turn</span>
        <span className={styles.helperLine2}>Waiting for opponent...</span>
      </div>
    </div>
  );
  ```
  Since `waitingPanel` is a single shared constant used by every phase's `!isActivePlayer` guard, making it context-specific requires either turning it into a function of the active team/phase, or accepting the generic fallback per D-09's own carve-out ("fall back to the generic phrasing only where no more-specific text is derivable" — `waitingPanel` doesn't know which team/action without being parameterized). Planner should evaluate whether to parameterize `waitingPanel` (e.g. `waitingPanel(actionLabel)`) mirroring the `{team} is repositioning…` shape.
- `KickOffSetupPanel.tsx` lines 116-119 — currently `Waiting for opponent&hellip;` on a disabled button (not the same `helperLine2` shape as ActionPanel's, this is inline on the CTA button itself):
  ```typescript
  {localReady ? (
    <button className={styles.ctaButton} disabled>
      Waiting for opponent&hellip;
    </button>
  ) : ( ... )}
  ```
  KickOffSetupPanel doesn't have the same attacking/defending framing (both teams are placing simultaneously, not one waiting on the other in the same sense) — exact wording is Claude's discretion per CONTEXT.md.

---

### D-10: Match log label de-duplication

**Keep:** `GameBoard.tsx` line 127 (`SideLog()`'s `sideLogHeader`):

```typescript
<div className={styles.sideLogHeader}>
  <span>MATCH LOG</span>
  ...
</div>
```

**Remove:** `ActionLog.tsx` line 837:

```typescript
<div className={styles.panelHeader}>ACTION LOG</div>
```

Delete this line (and, if `panelHeader` CSS class becomes unused elsewhere, consider removing it from `ActionLog.module.css` too — verify no other usage first).

---

### D-03: "Keeper" terminology standardization

**Edit sites:**

- `ActionPanel.tsx` line 512: `<span className={styles.helperLine1}>Goalie Restart!</span>` → `Keeper Restart!`
- `ActionPanel.tsx` `ACTION_SUMMARY` (lines 34-35):
  ```typescript
  'Punt (High Pass)': 'Goalkeeper clears with a long kick.',
  'Quick Throw': 'Goalkeeper throws the ball back into play.',
  ```
  → reword using "Keeper" (e.g. `'Keeper clears with a long kick.'`, `'Keeper throws the ball back into play.'`)
- `ActionLog.tsx` line 734: `<P pieceId={event.gkId} prefix="GK" />` → change `prefix="GK"` to a short "Keeper" form (e.g. `"K"`) — exact abbreviation Claude's discretion, must not be "GK" or "Goalie"
- No change needed: `[KEEPER KICK TARGET ✓/✗]` (line 729) — already aligned

---

### D-04/D-11/D-12: `formatEvent` audit (ActionLog.tsx, lines ~296-800)

**Confirmed glyph-bearing cases (already correct, reference pattern):** `STEAL_ATTEMPT` (line 364/380: `[INTERCEPT ✓]`/`[INTERCEPT ✗]`), `TACKLE_ATTEMPT` (line 405: `[TACKLE ✓]`/`[TACKLE ✗]`), `HEADER` (line 601: `[HEADER ~]`/`[HEADER ✓]`/`[HEADER ✗]`), `HP_ACCURACY` (line 685: `[HIGH ✓]`/`[HIGH ✗]`), `GK_KICK` (line 729: `[KEEPER KICK TARGET ✓]`/`✗`) — no glyph changes needed to these prefixes themselves.

**D-11 casing edits found:**

- `GOAL` case, line 425: `<PNamed pieceId={event.scorerId} /> SCORED!` → sentence case, e.g. `Scored!`
- `HEADER` case, lines 602-606:
  ```typescript
  const winLabel = isTie ? 'TIE → LOOSE BALL' : isAttackerWin ? 'ATTACKER WINS' : 'DEFENDER WINS';
  ```
  → `'Tie → loose ball'` / `'Attacker wins'` / `'Defender wins'` (verify no other ALL-CAPS usage of `winLabel` breaks downstream string interpolation)
- `HP_ACCURACY` case, line 687: `event.accurate ? ' ACCURATE -> CONTESTING HEADER' : ' Inaccurate — loose ball'` → `' Accurate → contesting header'` (also fixes the D-12 arrow in the same line)
- `GK_KICK` case, line 736: `{accurate ? ' ACCURATE' : ' inaccurate — loose ball'}` → `' Accurate'` (align casing with the inaccurate branch which is already lowercase)
- `STEAL_ATTEMPT`/`TACKLE_ATTEMPT`/`SHOT_ATTEMPT`: raw `{event.result}` interpolation (`SUCCESS`/`FAILURE` enum values render in caps) — lines 369, 385, 410, and the `SHOT_ATTEMPT` case (~532, ~560, use `outcomeLabel` not raw `event.result` — verify whether `outcomeLabel` is already sentence-cased or needs the same fix; not yet read in full, flag for planner to inspect lines 470-565 directly)

**D-12 arrow-glyph edits found** (`-> ` → `→`):

- `STEAL_ATTEMPT` lines 369, 385: `{event.result} {'-> '}`
- `TACKLE_ATTEMPT` line 410: `{event.result} {'-> '}`
- `SHOT_ATTEMPT` lines 532, 560: `{outcomeLabel} {'-> '}` (verify exact text — read from grep hit only, not full context)
- Reference pattern already using `→` correctly: `GK_KICK` line 734 (`→ {event.targetHex.q},{event.targetHex.r}`), `LOOSE_BALL_LAND` (`${event.from.q},${event.from.r} → ${event.to.q},${event.to.r}`)

**No change (D-13, explicitly confirmed):** raw axial hex coordinate pairs (e.g. `23,3 → 22,4`) stay as-is.

**Planner note:** `SHOT_ATTEMPT` case body (lines 470-565) was only grep-sampled, not fully read — planner/implementer should read that full case during plan-writing or implementation to confirm exact casing/arrow edit sites, since it's structurally the largest case (handles multiple sub-outcomes: block, save, goal, miss).

---

## Shared Patterns

### Pure-function + hook-wrapper extraction (D-06)

**Source:** `packages/client/src/hooks/useTeamColors.ts` (lines 1-26, `teamAccentColor`/`useTeamAccentColor` pair)
**Apply to:** the new shared color-state helper consumed by `ActionPanel.tsx` and `FreeKickSetupPanel.tsx`
Follow the existing project convention: export a plain, hook-free function as the primary implementation (safe to call from render bodies without violating Rules of Hooks), optionally with a thin `use`-prefixed wrapper only if call-site naming consistency is desired — not required here since `ctaButtonClass` has no store dependency at all.

### Panel border removal (D-01)

**Source:** `KickOffSetupPanel.module.css`/`FreeKickSetupPanel.module.css` `.panel` selectors (border-free already)
**Apply to:** `.panel`/`.confirmCard` selectors in `ActionLog.module.css`, `ActionPanel.module.css`, `ReplayPanel.module.css`, `FreeKickSetupPanel.module.css`, and `GameBoard.module.css`'s `.sideLogExpanded`

### `waitingPanel` context-specificity (D-09)

**Source:** `FreeKickSetupPanel.tsx` lines 72-80 (`{isKicking ? 'Attacking' : 'Defending'} team is repositioning…`)
**Apply to:** `ActionPanel.tsx`'s `waitingPanel` constant, `KickOffSetupPanel.tsx`'s waiting button text

### `panelHeading` structural element (D-07)

**Source:** `KickOffSetupPanel.tsx` line 91 / `FreeKickSetupPanel.tsx` lines 75/178 (note `ReplayPanel.tsx` uses a differently-named CSS class, `styles.heading`, for the same structural role — line 32)
**Apply to:** `ActionPanel.tsx` (add heading span to every phase block)

## No Analog Found

None — this phase touches only existing components, and every target end-state pattern (no-border panels, `panelHeading` span, `Confirm` verb via at least one dialog usage, unicode arrows, `ctaButtonClass` color logic) already exists in at least one sibling file within the same `packages/client/src/components/` directory.

## Metadata

**Analog search scope:** `packages/client/src/components/` (ActionPanel, ActionLog, GameBoard, KickOffSetupPanel, FreeKickSetupPanel, ReplayPanel + their `.module.css`/`.test.tsx`), `packages/client/src/hooks/` (useTeamColors.ts, useMyTeam.ts)
**Files scanned:** 12 target files + 2 hook-pattern reference files
**Pattern extraction date:** 2026-07-27
