---
phase: 23-formation-system
plan: 03
status: complete
completed: 2026-07-05
---

# Plan 23-03 Summary — Formation Selection UI

## What was built

**Task 1 — UniformSelectionScreen.tsx**

- Added `FORMATION_OPTIONS` constant: 4 entries with `id`, `asset` (Vite PNG import), `label`
- Imported `FORMATIONS` (for `.description`), `FormationId` type, and 4 PNG assets from `../assets/formations/`
- Extended `Props`: added `homeConfirmedFormation: FormationId | null` (for Phase 24 use), changed `onConfirm` to 3-arg `(teamId, uniformStyle, formationId)`
- Added `selectedFormation` state (default `'4-4-2'`, D-07 pre-selection)
- Inserted formation grid JSX between team grid and style grid (D-05 layout order)
- Updated Confirm `onClick` to pass `selectedFormation` as 3rd arg

**Task 1 — UniformSelectionScreen.module.css**

- `.formationGrid`: 4-col grid, 10px gap, max-width 560px; 2-col at ≤640px (responsive)
- `.formationCard` / `.formationCardSelected`: column flex, `#1a1a2e` bg, border + box-shadow glow for selected state
- `.formationCard:hover:not(:disabled)`: white glow hover
- `.formationImage`: height 100px, object-fit contain (named exception in UI-SPEC D-06)
- `.formationLabel`: 14px/700, `#e0e0e0`
- `.formationDescription`: 12px/400, `#a0a0a0`, centered, 1.4 line-height

**Task 1 — UniformSelectionScreen.test.tsx**

- Added `homeConfirmedFormation: null as FormationId | null` to `DEFAULT_PROPS`
- Updated 2 `onConfirm` assertions to include `'4-4-2'` as 3rd arg

**Task 2 — App.tsx**

- Imported `FormationId` type
- Added `homeConfirmedFormation` state (`FormationId | null`, init `null`)
- Added `formationsLocked` state (bool, init `false`)
- `onUniformHomeConfirmed`: extended to 3-arg; calls `setHomeConfirmedFormation(formationId)`
- `onBothFormationsConfirmed`: new handler, calls `setFormationsLocked(true)`
- Registered/deregistered `BOTH_FORMATIONS_CONFIRMED` socket event
- `handleUniformConfirm`: extended to 3-arg; emits 3-arg `UNIFORM_CONFIRM`
- JSX: formations-locked holding screen before UniformSelectionScreen render
- Passed `homeConfirmedFormation` prop to `UniformSelectionScreen`

## Verification

- `pnpm --filter @counter-attack/client exec tsc --noEmit` — exits 0
- `pnpm --filter @counter-attack/client test` — 302/302 pass

## Commits

- `459f2d8` feat(23-03): formation selection UI — card grid, CSS, App.tsx wiring
