# Phase 32: Code Cleanup - Pattern Map

**Mapped:** 2026-07-24
**Files analyzed:** 15 (2 new hooks + 2 hook tests + 8 consolidation call sites + knip.json + eslint.config.js + ci.yml + package.json + SELECTOR-REVIEW.md)
**Analogs found:** 13 / 15

Note: This phase is dominated by RESEARCH.md's own line-numbered, codebase-grounded findings (Architecture Patterns, Common Pitfalls 1-6, Code Examples) — those were produced from direct reads of the exact files below and are treated here as pre-verified pattern extractions, re-confirmed against the live repo in Step 3-4 of this mapping pass.

## File Classification

| New/Modified File                                                          | Role           | Data Flow                          | Closest Analog                                                                                                          | Match Quality                                                          |
| -------------------------------------------------------------------------- | -------------- | ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `packages/client/src/hooks/useTeamColors.ts` (NEW)                         | utility + hook | transform (pure derivation)        | `packages/client/src/components/ActionLog.tsx` lines 8-16 (`pieceColorOf`)                                              | role-match (extracting existing inline pattern into a new file)        |
| `packages/client/src/hooks/useMyTeam.ts` (NEW)                             | hook           | transform (pure derivation)        | `packages/client/src/components/HexGrid.tsx` lines 133-134                                                              | exact (canonical null-safe form already exists, just needs extraction) |
| `packages/client/src/hooks/useTeamColors.test.ts` (NEW)                    | test           | unit                               | `packages/client/src/store/useGameStore.test.ts`                                                                        | role-match (Vitest unit test conventions)                              |
| `packages/client/src/hooks/useMyTeam.test.ts` (NEW)                        | test           | unit                               | `packages/client/src/components/HexGrid.test.tsx` (myTeam-guard tests, lines 123, 317, 956-984)                         | role-match                                                             |
| `knip.json` (NEW, repo root)                                               | config         | batch (static analysis)            | none in-repo (net-new tool config) — use RESEARCH.md Pattern 2 verbatim as the template                                 | no analog (see below)                                                  |
| `eslint.config.js` (MODIFIED)                                              | config         | request-response (build-time gate) | itself — extend existing flat-config array                                                                              | exact                                                                  |
| `.github/workflows/ci.yml` (MODIFIED)                                      | config         | batch (CI pipeline)                | itself — extend existing step list                                                                                      | exact                                                                  |
| `package.json` (MODIFIED, root)                                            | config         | batch                              | itself — extend existing `scripts` block                                                                                | exact                                                                  |
| `.planning/phases/32-code-cleanup/SELECTOR-REVIEW.md` (NEW)                | doc            | n/a                                | none — first selector-review doc in repo                                                                                | no analog                                                              |
| `packages/client/src/components/ActionLog.tsx` (MODIFIED)                  | component      | transform                          | itself (refactor pure helpers to import from hooks/)                                                                    | exact                                                                  |
| `packages/client/src/components/GameBoard.tsx` (MODIFIED)                  | component      | request-response                   | itself (6 `palette.uiColor` + 1 `myTeam` inline sites)                                                                  | exact                                                                  |
| `packages/client/src/components/PieceOverlay.tsx` (MODIFIED — verify-only) | component      | transform                          | itself — Pitfall 5: likely no-op, do not force hook usage                                                               | exact                                                                  |
| `packages/client/src/components/HexGrid.tsx` (MODIFIED)                    | component      | request-response                   | itself (canonical `myTeam` source, ~15 usages)                                                                          | exact                                                                  |
| `packages/client/src/components/ActionPanel.tsx` (MODIFIED)                | component      | request-response                   | `HexGrid.tsx` (same null-safe pattern)                                                                                  | exact                                                                  |
| `packages/client/src/components/FreeKickSetupPanel.tsx` (MODIFIED)         | component      | request-response                   | `HexGrid.tsx` (adapting non-null-safe → null-safe, Pitfall 4)                                                           | role-match                                                             |
| `packages/client/src/components/KickOffSetupPanel.tsx` (MODIFIED)          | component      | request-response                   | `HexGrid.tsx` (adapting non-null-safe → null-safe, Pitfall 4)                                                           | role-match                                                             |
| `packages/client/src/store/useGameStore.ts` (MODIFIED)                     | store          | event-driven                       | itself (`shootTargetHex` removal, 7× inline `myTeam` → `deriveMyTeam`, `setGameState` dependency-gate at lines 658-844) | exact                                                                  |

## Pattern Assignments

### `packages/client/src/hooks/useTeamColors.ts` (NEW — utility + hook, transform)

**Analog:** `packages/client/src/components/ActionLog.tsx` lines 1-16, 36-45 (confirmed live in repo)

**Existing inlined pattern to extract** (`ActionLog.tsx:9-16`):

```typescript
/** Reads selectedTeams from store state (not a subscription — safe in module-level helpers). */
function pieceColorOf(pieceId: string): string {
  const state = useGameStore.getState();
  const selectedTeams = state.gameState?.selectedTeams;
  if (!selectedTeams) return '#888888';
  const positional = pieceId.startsWith('home') ? 'home' : 'away';
  const teamId = selectedTeams[positional];
  return TEAM_CONFIGS[teamId]?.palette.uiColor ?? '#888888';
}
```

**Direct `TEAM_CONFIGS[...].palette.uiColor` call sites confirmed still live and needing migration:**

- `GameBoard.tsx` lines 179, 201, 208, 210, 271, 311, 354, 383, 409, 425 (9 occurrences, more than CONTEXT.md's scout count of 3 files — same 3 files, but GameBoard.tsx alone has 9 individual call sites)
- `ActionLog.tsx` lines 15, 44 (inside `pieceColorOf`/`slotTeamColor`)
- `PieceOverlay.tsx` — verify via Pitfall 5 before migrating; likely a type-shape pass-through, not a real duplication (see RESEARCH.md Pitfall 5 for the exact reasoning — `palette` there is already resolved and passed down from `HexGrid.tsx` line 677, not re-derived from `TEAM_CONFIGS`)

**Target pattern (RESEARCH.md Pattern 1, pre-verified against these exact call sites):**

```typescript
// packages/client/src/hooks/useTeamColors.ts
import { TEAM_CONFIGS } from '@counter-attack/shared';
import type { TeamId } from '@counter-attack/shared';

/** Pure — no Zustand/React dependency. Safe to call from anywhere, including
 *  loops and non-component helper functions (e.g. ActionLog.tsx's pieceColorOf). */
export function teamAccentColor(teamId: TeamId | undefined): string {
  if (!teamId) return '#888888';
  return TEAM_CONFIGS[teamId]?.palette.uiColor ?? '#888888';
}

/** Thin hook wrapper for component-body call sites (GameBoard.tsx). */
export function useTeamAccentColor(teamId: TeamId | undefined): string {
  return teamAccentColor(teamId);
}
```

**Critical constraint (Pitfall 1):** `ActionLog.tsx`'s `pieceColorOf`/`slotTeamColor` are called from inside `.map()`/loop contexts during `consolidateEvents` (a plain function, not a component) — these MUST import and call `teamAccentColor()` directly, never `useTeamAccentColor()`. Only `GameBoard.tsx`'s component-body call sites may use the hook form.

---

### `packages/client/src/hooks/useMyTeam.ts` (NEW — hook, transform)

**Analog:** `packages/client/src/components/HexGrid.tsx` lines 133-134 (confirmed live, canonical null-safe form)

**Existing pattern to extract** (`HexGrid.tsx:133-134`):

```typescript
const myTeam: 'home' | 'away' | null = playerSlot === 1 ? 'home' : playerSlot === 2 ? 'away' : null;
```

Also duplicated identically in `ActionPanel.tsx:117-118` and `GameBoard.tsx:196-197` (null-safe form).

**Non-null-safe variant to reconcile (Pitfall 4)** — `FreeKickSetupPanel.tsx:53`:

```typescript
const myTeam: 'home' | 'away' = playerSlot === 1 ? 'home' : 'away';
```

Same form confirmed in `KickOffSetupPanel.tsx` and 7× inline in `useGameStore.ts`.

**Target pattern (RESEARCH.md Pattern 1):**

```typescript
// packages/client/src/hooks/useMyTeam.ts
import { useGameStore } from '../store/useGameStore.js';

/** Pure — callable from useGameStore.ts's own action bodies via get(), which
 *  run outside React render and CANNOT call hooks. */
export function deriveMyTeam(playerSlot: 1 | 2 | null): 'home' | 'away' | null {
  return playerSlot === 1 ? 'home' : playerSlot === 2 ? 'away' : null;
}

/** Hook wrapper for component bodies — subscribes to the narrowest slice
 *  (locked per-slice-selector convention, per STATE.md Pitfall 6). */
export function useMyTeam(): 'home' | 'away' | null {
  const playerSlot = useGameStore((s) => s.playerSlot);
  return deriveMyTeam(playerSlot);
}
```

**Critical constraint (Pitfall 2):** `useGameStore.ts`'s 7 inline `myTeam` derivations run inside `create<GameStore>()((set, get) => ({...}))` action closures — never inside React render. These MUST use `deriveMyTeam(get().playerSlot)`, never `useMyTeam()` (calling a hook there is not just a lint violation, it is not callable at all in that context).

**Critical constraint (Pitfall 4):** Adopting the null-safe form as canonical changes the type at `useGameStore.ts` (×7), `FreeKickSetupPanel.tsx`, `KickOffSetupPanel.tsx` from `'home' | 'away'` to `'home' | 'away' | null`. Each of these 3 call-site groups needs an explicit decision recorded (guard vs. fallback), not a silent `?? 'away'` coercion — confirmed via direct grep that `FreeKickSetupPanel.tsx:53` and `KickOffSetupPanel.tsx` still use the non-null-safe form live in the repo today.

---

### `packages/client/src/hooks/useTeamColors.test.ts` / `useMyTeam.test.ts` (NEW — test, unit)

**Analog:** `packages/client/src/store/useGameStore.test.ts` and `HexGrid.test.tsx` (myTeam-guard assertions at lines 123, 317, 956-984)

No existing `hooks/` test directory exists — this is a net-new test file. Follow the project's existing Vitest conventions (co-located `*.test.ts` next to the hook file, matching `useGameStore.test.ts`'s structure). `HexGrid.test.tsx:956` (`'clicking a spent OPPONENT piece in MOVE does NOT call inspectPiece via the BUG-10 path (myTeam guard)'`) demonstrates the existing null-safety assertion style to mirror for `deriveMyTeam`'s null-playerSlot case.

---

### `packages/client/src/store/useGameStore.ts` (MODIFIED — store, event-driven)

**Analog:** itself

**Dead code confirmed live at these exact lines (CLEANUP-01):**

```
69:   shootTargetHex: HexCoord | null;
274:  shootTargetHex: null,
722:        shootTargetHex: null,
930:  setShootingMode: (on) => set({ shootingMode: on, shootTargetHex: null }),
```

Fix: remove the field declaration (line 69) and all three write sites (274, 722, 930); no read sites exist anywhere in the client (confirmed via grep — knip will flag this too).

**CLEANUP-03 review target — `setGameState`'s hand-rolled dependency gate** (lines 658-687, confirmed live):

```typescript
setGameState: (newState) => {
  const prev = get();
  const prevState = prev.gameState;
  const prevSelectedId = prev.selectedPieceId ?? prev.lastMovedPieceId;

  const responseMoveStateChanged =
    newState.movementSlot !== prevState.movementSlot ||
    newState.firstTimePassMovementSlot !== prevState.firstTimePassMovementSlot ||
    newState.highPassMovementSlot !== prevState.highPassMovementSlot ||
    newState.gkKickMovementSlot !== prevState.gkKickMovementSlot;
  const responseMovePaceExhausted =
    newState.phase === 'FIRST_TIME_PASS_MOVE'
      ? (newState.firstTimePassPaceUsed ?? 0) >= 1
      : newState.phase === 'HIGH_PASS_MOVE'
        ? (newState.highPassPaceUsed ?? 0) >= 3
        : newState.phase === 'GK_KICK_MOVE'
          ? (newState.gkKickPaceUsed ?? 0) >= 3
          : newState.phase === 'SNAPSHOT_DEFLECT'
            ? (newState.snapDeflectPaceUsed ?? 0) >= 2
            : false;
  // ...continues to line 844 with phaseChanged/pieceStillExists/activationComplete
```

This is the primary content target for `SELECTOR-REVIEW.md` — see RESEARCH.md Architecture Patterns Pattern 3 for the full cataloging table template (Field/Selector | Derives | Recomputed at | Stale-risk? | Verdict).

---

### `knip.json` (NEW, repo root — config, batch)

**No in-repo analog** — first dead-code-detection config in this codebase. Use RESEARCH.md's Pattern 2 template verbatim as starting point, verified against live `packages/shared/src/index.ts` barrel export and `packages/shared/scripts/seed-rosters.ts` (confirmed present, matches `eslint.config.js`'s existing `allowDefaultProject: ['packages/*/scripts/*.ts']` exception at line 15 above).

**Existing sibling config pattern to mirror scoping style from** (`eslint.config.js` lines 10-18, confirmed live):

```javascript
languageOptions: {
  parserOptions: {
    projectService: {
      allowDefaultProject: [
        'packages/shared/src/*.test.ts',
        'packages/*/scripts/*.ts',
      ],
    },
  },
},
```

---

### `eslint.config.js` (MODIFIED — config, request-response/build-time gate)

**Analog:** itself, full file confirmed live (46 lines)

**Current structure to extend** (verified exact contents):

```javascript
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

export default tseslint.config(
  ...tseslint.configs.recommendedTypeChecked,
  prettier,
  { languageOptions: { parserOptions: { projectService: { allowDefaultProject: [...] } } } },
  { rules: { '@typescript-eslint/no-unused-vars': [...] } },
  { files: ['**/*.test.ts', '**/*.test.tsx'], rules: { /* unsafe-* off for tests */ } },
  { ignores: ['**/dist/**', '**/node_modules/**', '**/*.config.js', '**/*.config.ts', '.husky/**'] },
);
```

**New block to add** (RESEARCH.md Code Examples, `files: ['packages/client/src/**/*.{ts,tsx}']` scoping matches this file's existing `files:` array convention used at the test-block above):

```javascript
{
  files: ['packages/client/src/**/*.{ts,tsx}'],
  plugins: { 'react-hooks': reactHooks },
  rules: {
    ...reactHooks.configs.recommended.rules,
    'react-hooks/rules-of-hooks': 'error',
    'react-hooks/exhaustive-deps': 'error',
  },
},
```

Note: must add `import reactHooks from 'eslint-plugin-react-hooks';` to the top import block, matching the existing `import tseslint`/`import prettier` style.

---

### `.github/workflows/ci.yml` (MODIFIED — config, batch/CI pipeline)

**Analog:** itself — current pipeline confirmed as install → shared build → typecheck → test → build per CONTEXT.md/RESEARCH.md; insert `pnpm knip` as new step 3 (after shared build, before typecheck) per RESEARCH.md Pitfall 6's ordering constraint (knip needs `packages/shared/dist/` built to resolve cross-package imports).

---

### `package.json` (MODIFIED, root — config, batch)

**Analog:** itself — confirmed live `scripts` block:

```json
"build": "pnpm -r build",
"test": "pnpm -r test",
"lint": "eslint .",
"typecheck": "pnpm -r typecheck",
```

Add `"knip": "pnpm --filter @counter-attack/shared build && knip"` following this same flat-key convention.

---

## Shared Patterns

### Pure-function-core + thin-hook-wrapper (applies to both new hook files)

**Source:** RESEARCH.md Architecture Patterns Pattern 1, cross-verified against `ActionLog.tsx` (module-level plain-function usage) and `HexGrid.tsx`/`ActionPanel.tsx`/`GameBoard.tsx` (component-body usage) — both call-site shapes confirmed live in the repo.
**Apply to:** `useTeamColors.ts`, `useMyTeam.ts`, and every call site consuming them.
**Rule:** Non-component/loop contexts (`ActionLog.tsx` helpers, `useGameStore.ts` action bodies) call the pure function (`teamAccentColor`, `deriveMyTeam`) directly. Only genuine component-body call sites (`GameBoard.tsx`, `HexGrid.tsx`, `ActionPanel.tsx`) use the hook wrapper (`useTeamAccentColor`, `useMyTeam`).

### Per-slice Zustand selectors (locked prior-phase convention)

**Source:** `HexGrid.tsx` lines 128-131 (confirmed live: `useGameStore((s) => s.gameState.snapDeflectPaceUsed)` etc., one field per selector call, not whole-store destructuring)
**Apply to:** `useMyTeam()`'s internal `useGameStore((s) => s.playerSlot)` call — must select only `playerSlot`, never the whole store.

### Zustand action reference stability (CLEANUP-04 fix pattern)

**Source:** RESEARCH.md Common Pitfalls 3, Code Examples — confirmed pattern for `App.tsx`'s effect.
**Apply to:** All 14 `useEffect` call sites across 11 files once `react-hooks/exhaustive-deps` is enabled at `error`. Default fix: add the missing stable Zustand setter/action references to the dependency array (behavior-preserving, since these references never change identity). Reserve `eslint-disable-next-line` for genuinely non-stable, deliberately-omitted values (D-08), and review each such suppression during verification.

## No Analog Found

| File                                                  | Role   | Data Flow | Reason                                                                                                                               |
| ----------------------------------------------------- | ------ | --------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `knip.json`                                           | config | batch     | First dead-code-detection tool config in this repo — no prior art to copy from; use RESEARCH.md's Pattern 2 template                 |
| `.planning/phases/32-code-cleanup/SELECTOR-REVIEW.md` | doc    | n/a       | First standalone selector-review doc (D-05) — no prior phase produced this artifact type; use RESEARCH.md Pattern 3's table template |

## Metadata

**Analog search scope:** `packages/client/src/components/`, `packages/client/src/store/`, `packages/client/src/hooks/` (does not yet exist), `eslint.config.js`, `.github/workflows/ci.yml`, root `package.json`
**Files scanned:** ActionLog.tsx, GameBoard.tsx, PieceOverlay.tsx, HexGrid.tsx, HexGrid.test.tsx, ActionPanel.tsx, FreeKickSetupPanel.tsx, KickOffSetupPanel.tsx, useGameStore.ts, eslint.config.js, package.json (root) — all confirmed live via direct Read/Grep during this mapping pass (not solely inherited from RESEARCH.md)
**Pattern extraction date:** 2026-07-24
