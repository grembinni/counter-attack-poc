# Phase 32: Code Cleanup - Research

**Researched:** 2026-07-24
**Domain:** JS/TS monorepo tooling (dead-code detection, ESLint flat config, Zustand selector design) + React Hooks correctness
**Confidence:** HIGH

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions

**CLEANUP-01 — Dead-code detection tool**

- D-01: Use **knip**, not ts-prune — modern, actively maintained, pnpm-workspace-aware (understands `packages/shared`/`server`/`client` as one project), catches unused exports/files/dependencies in one pass. Add as a permanent devDependency with a `knip.json`/`knip.ts` config at repo root, not a one-off audit script.
- D-02: Wire knip in as a **permanent gate**, not a one-time pass. Add a `pnpm knip` script and a step in `.github/workflows/ci.yml` (currently: install → shared build → typecheck → test → build, no lint/dead-code step at all today). Note: knip does whole-project analysis, so it does NOT fit the existing per-file `lint-staged` pre-commit pattern (`eslint --fix` on staged `*.{ts,tsx}`) — it needs its own CI step, separate from that hook.
- Confirmed already-dead via scout: `shootTargetHex` in `packages/client/src/store/useGameStore.ts` (declared line 69, only ever assigned `null` at lines 274/722/930, never read anywhere in the client) — this is the concrete example cited in ROADMAP.md's success criteria; knip must flag it and the fix removes it entirely.

**CLEANUP-02 — Shared helper consolidation**

- D-03: New shared logic lives as **React hooks** in `packages/client/src/hooks/` (e.g. `useTeamAccentColor(teamId)`, `useMyTeam()`) — idiomatic given these call sites already compose with Zustand selectors, not plain utility functions.
- D-04: Consolidate **all** duplicated call sites now, not just the worst offenders — matches CLEANUP-02's wording ("consolidated into one shared helper/hook used everywhere they were previously inlined"). Confirmed duplication via scout:
  - `TEAM_CONFIGS[...].palette.uiColor` inlined in 3 files: `ActionLog.tsx`, `GameBoard.tsx`, `PieceOverlay.tsx`.
  - `myTeam`/team-slot resolution duplicated across 8 files: `HexGrid.tsx`, `HexGrid.test.tsx`, `ActionPanel.tsx`, `useGameStore.ts`, `GameBoard.tsx`, `FreeKickSetupPanel.tsx`, `useGameStore.rule11.test.ts`, `KickOffSetupPanel.tsx`.

**CLEANUP-03 — Zustand selector review**

- D-05: Deliverable is a **standalone markdown doc** (e.g. `.planning/phases/32-code-cleanup/SELECTOR-REVIEW.md`) cataloging each selector in `useGameStore.ts` (952 lines), what it derives, and whether it's stale/redundant — not inline comments in the already-large store file.
- D-06: Any real problems the review finds (stale dependency arrays, redundant derived-state recomputation) must be **fixed in this phase**, not just logged for later — CLEANUP-03's success criteria ("confirmed by a documented selector review") reads as a fixed end-state, not a findings list.

**CLEANUP-04 — React Hook lint rollout**

- D-07: No `eslint-plugin-react-hooks` exists anywhere today (confirmed: absent from root `eslint.config.js` and every `package.json`) and there are zero existing `eslint-disable` suppressions for hook rules to inherit. Enable the rule at **`error`** (not `warn`) scoped to the client package, and **fix every violation it surfaces** — matches CLEANUP-04's explicit "zero exhaustive-deps violations" bar.
- D-08: A genuine one-time-only effect with a deliberately incomplete dependency array MAY use a scoped `eslint-disable-next-line react-hooks/exhaustive-deps` with an explanatory comment — suppressions are not banned outright. However, **every suppression's justification must be specifically reviewed as part of this phase's post-implementation UAT/verification step** (not just accepted at face value during implementation) — the planner/verifier should treat "does each disable comment hold up under scrutiny" as an explicit checklist item, not an afterthought.

### Claude's Discretion

- Exact `knip.json` config shape (workspace entry points, ignore patterns) — pick based on what integrates cleanly with the existing pnpm workspace + `eslint.config.js allowDefaultProject` exclusions during planning.
- Whether `useTeamAccentColor`/`useMyTeam` are one hook file or split — judge by actual call-site shape once touching each of the 8 files.

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.

Reviewed-but-not-folded todos (informational only, no phase-32 action required): `2026-06-21-bug-gk-kick-ball-delivery-invisible-during-replay.md` (stale, already resolved), `2026-07-02-bug-kickoff-setup-persistent-light-shading-on-shot-path-hexes.md` (deferred to Phase 33/34), `csv-consolidation-player-pool.md` (unrelated data-pipeline idea).
</user_constraints>

<phase_requirements>

## Phase Requirements

| ID         | Description                                                                                                                                             | Research Support                                                                                                                                                                                                                                                                                                                              |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CLEANUP-01 | Dead code (unused fields, functions, exports) is identified and removed across shared/server/client, verified via an automated dead-code-detection tool | knip 6.29.0 config for pnpm workspaces (§ Standard Stack, § Architecture Patterns); confirmed `shootTargetHex` is the only read/write site pattern to model the fix on (§ Code Examples)                                                                                                                                                      |
| CLEANUP-02 | Duplicated logic (repeated `TEAM_CONFIGS` color lookups, repeated team-slot derivation) is consolidated into shared helper functions/hooks              | Pure-function-plus-thin-hook-wrapper pattern (§ Architecture Patterns, Pattern 1/2) resolves two hard blockers found in the actual call sites: rules-of-hooks violation risk in `ActionLog.tsx`'s module-level formatter functions, and hook-in-non-React-context violation in `useGameStore.ts`'s own action bodies (§ Common Pitfalls 1, 2) |
| CLEANUP-03 | Zustand store selectors are reviewed for staleness and inefficiency                                                                                     | Concrete review scope identified from the actual file: the `setGameState` hand-rolled dependency-gate block (lines 670-727) and the `computeMovementValidHexes`/`computeResponseMoveValidHexes` recompute-and-store pattern are the store's real "selector" surface (§ Common Pitfalls 5, § Architecture Patterns Pattern 3)                  |
| CLEANUP-04 | React Hook dependency correctness is enforced via lint tooling across the client package                                                                | eslint-plugin-react-hooks 7.1.1 flat-config scoping pattern (§ Standard Stack, § Code Examples); concrete violation-scope audit — 14 `useEffect` call sites across 11 files, with `App.tsx`'s mount-once socket-registration effect as the highest-risk case (§ Common Pitfalls 3, 4)                                                         |

</phase_requirements>

## Summary

This phase is pure internal tooling/refactor work with no new runtime surface: add **knip 6.29.0** as a permanent dead-code gate, extract two new React hooks (`useTeamAccentColor`, `useMyTeam`) to de-duplicate color and team-slot logic, produce a written Zustand selector audit with fixes applied, and enable **eslint-plugin-react-hooks 7.1.1** at `error` severity scoped to the client package. All four sub-requirements are tightly coupled by one underlying architectural fact this research surfaces: **the codebase's duplicated logic is consumed from three different execution contexts (React component bodies, plain non-component helper functions called during render, and Zustand store action bodies outside React entirely)**, and only component bodies can safely call a React hook. Naively converting every `TEAM_CONFIGS[...].palette.uiColor` and `myTeam` call site into a hook call will break rules-of-hooks in `ActionLog.tsx` (which computes colors inside plain functions called from `.map()`/loop contexts, not directly in a component) and will not compile at all inside `useGameStore.ts`'s action bodies (which run via `get()`/`set()`, never inside a render). The fix is a **pure-function-core + thin-hook-wrapper** pattern: export the actual computation as a plain function callable from anywhere, and a one-line hook wrapper for component call sites, satisfying D-03's "lives as hooks" framing without violating React's rules.

For CLEANUP-01, knip needs no code changes to detect `shootTargetHex` — it is genuinely dead (only ever assigned `null`, never read) and will be flagged immediately once knip's workspace config points at each package's real entry points. The trickiest part of CLEANUP-01 is CI ordering and cross-package resolution: because `@counter-attack/shared`'s `package.json` `main`/`exports` point at `dist/`, and `dist/` is gitignored, knip must run **after** `pnpm --filter @counter-attack/shared build` (already CI's step 2) or it will report every shared re-export as unresolvable.

For CLEANUP-04, `eslint-plugin-react-hooks` has never existed in this repo, so `error`-level `exhaustive-deps` will surface real violations, concentrated in `App.tsx`'s single 146-line mount-once socket-registration `useEffect` (14 store setters closed over, empty deps array `[]`). The correct fix in nearly every case is **not** `eslint-disable` — Zustand's `useGameStore((s) => s.setX)` returns a referentially-stable function for the store's lifetime, so simply adding it to the dependency array satisfies the rule with zero behavior change. `eslint-disable` should be reserved for the rare case where a value is _not_ stable and is deliberately, correctly omitted.

**Primary recommendation:** Land knip and the react-hooks lint rule as CI-enforced gates first (mechanical, low-risk, produces the violation inventory), then do the hook extraction and selector review as a second wave informed by what the tools actually flag — this ordering lets the automated tools do the discovery work instead of manual grep.

## Architectural Responsibility Map

| Capability                                      | Primary Tier                               | Secondary Tier | Rationale                                                                                                                                                        |
| ----------------------------------------------- | ------------------------------------------ | -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Dead-code detection (CLEANUP-01)                | Build/CI tooling (repo-level, not runtime) | —              | Static analysis over the whole workspace; runs in CI, not in any request path                                                                                    |
| Team-color/team-slot consolidation (CLEANUP-02) | Browser/Client                             | —              | Pure client-side UI derivation (`TEAM_CONFIGS` is a client-bundled static import; `playerSlot`/`selectedTeams` are Zustand client state) — no server involvement |
| Zustand selector review (CLEANUP-03)            | Browser/Client                             | —              | `useGameStore.ts` is exclusively a client-side state module; findings and fixes are scoped to `packages/client`                                                  |
| React Hook lint enforcement (CLEANUP-04)        | Build/CI tooling (repo-level, not runtime) | Browser/Client | Enforced via ESLint (build-time gate) but the violations being fixed live in client React components                                                             |

**Note:** This phase has no server-side or API-tier work — `packages/server` and `packages/shared` participate in CLEANUP-01 (dead-code scan) only. CLEANUP-02/03/04 are entirely `packages/client`.

## Project Constraints (from CLAUDE.md)

- TypeScript everywhere (`ts` 5.x) — new hook files must be `.ts`/`.tsx` matching existing conventions.
- pnpm workspaces (`packages/shared`, `packages/server`, `packages/client`) — knip config must be workspace-aware, not per-package.
- React 18.3.1 + Zustand 4.5.7 **pinned** — do not bump either as part of this phase; `eslint-plugin-react-hooks` 7.1.1 targets React's hooks API surface (unchanged since React 16.8) and has no React-version coupling that would conflict with the pin.
- "Zustand per-slice selectors in HexGrid (Pitfall 6) — prevents whole-component re-renders" is a **locked prior-phase decision** (STATE.md) — new hooks (`useMyTeam`, `useTeamAccentColor`) must subscribe to the narrowest slice needed (e.g. `useGameStore((s) => s.playerSlot)`), not the whole store.
- GSD workflow enforcement: this research was produced via `/gsd-plan-phase`; do not make direct edits outside a GSD workflow.

## Standard Stack

### Core

| Library                   | Version                         | Purpose                                                                                 | Why Standard                                                                                                                                                                                                               |
| ------------------------- | ------------------------------- | --------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| knip                      | 6.29.0 [VERIFIED: npm registry] | Whole-project dead-code/unused-export/unused-dependency detection, pnpm-workspace-aware | Actively maintained (weekly-ish minor releases; 6.22.0→6.29.0 in the last ~2 months), 11.6M weekly downloads, purpose-built for monorepo workspace analysis unlike ts-prune (single-package only, unmaintained since 2023) |
| eslint-plugin-react-hooks | 7.1.1 [VERIFIED: npm registry]  | Enforces Rules of Hooks + exhaustive dependency arrays                                  | Official React org package (`facebook/react` monorepo), 91.3M weekly downloads, the only credible option for this rule set — no viable alternative exists                                                                  |

### Supporting

| Library    | Version | Purpose | When to Use                                                                                                                         |
| ---------- | ------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| (none new) | —       | —       | CLEANUP-02/03 require no new runtime dependencies — pure refactor of existing code using already-installed React/Zustand/TypeScript |

### Alternatives Considered

| Instead of                                     | Could Use              | Tradeoff                                                                                                                                                                                                                                                                                                                       |
| ---------------------------------------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| knip                                           | ts-prune               | Rejected per D-01 — single-package tool, doesn't understand pnpm workspaces natively, effectively unmaintained (last meaningful release predates the current TS/ESM tooling landscape)                                                                                                                                         |
| knip                                           | depcheck / unimported  | Both are dependency-only or file-only checkers; neither does knip's combined unused-exports + unused-files + unused-dependencies + unused-devDependencies analysis in one pass                                                                                                                                                 |
| eslint-plugin-react-hooks `recommended-latest` | `recommended` (stable) | `recommended-latest` bundles newer/experimental React-Compiler-readiness rules (e.g. purity/immutability checks) beyond `rules-of-hooks`/`exhaustive-deps`. CLEANUP-04's stated bar is "zero exhaustive-deps violations" — scope creep into Compiler rules is out of scope for this phase; use `recommended` (stable rule set) |

**Installation:**

```bash
pnpm add -Dw knip eslint-plugin-react-hooks
```

(`-w` / workspace-root flag: both are repo-level devDependencies — knip analyzes all three packages from one root config; eslint-plugin-react-hooks is consumed by the root `eslint.config.js`, not a per-package `package.json`.)

**Version verification:** Confirmed via `npm view knip version` → `6.29.0` (published 2026-07-22) and `npm view eslint-plugin-react-hooks version` → `7.1.1` (published 2026-04-17, dist-tag `latest`). `npm view eslint-plugin-react-hooks peerDependencies` confirms `eslint: "^3.0.0 || ... || ^9.0.0 || ^10.0.0"` — compatible with the repo's pinned `eslint@9.39.4`. `npm view knip engines` confirms `node: "^20.19.0 || >=22.12.0"` — compatible with the repo's `node: ">=22"` engine constraint.

## Package Legitimacy Audit

| Package                   | Registry | Age                                                                              | Downloads | Source Repo               | Verdict | Disposition                                                         |
| ------------------------- | -------- | -------------------------------------------------------------------------------- | --------- | ------------------------- | ------- | ------------------------------------------------------------------- |
| knip                      | npm      | 6+ yrs (steady biweekly-ish minor releases, 6.22.0→6.29.0 across recent history) | 11.6M/wk  | github.com/webpro-nl/knip | SUS     | Flagged — planner must add `checkpoint:human-verify` before install |
| eslint-plugin-react-hooks | npm      | Long-standing (part of `facebook/react` monorepo)                                | 91.3M/wk  | github.com/facebook/react | OK      | Approved                                                            |

**Packages removed due to [SLOP] verdict:** none

**Packages flagged as suspicious [SUS]:** `knip` — the `package-legitimacy check` seam verdict is driven **solely** by the `too-new` signal on the _latest version's_ publish timestamp (6.29.0 published 2026-07-22, 2 days before this research). This is a heuristic false-positive, not a legitimacy concern: knip has an established multi-year history, a consistent release cadence (`npm view knip versions` shows 6.22.0 through 6.29.0 as sequential recent minors — normal active-maintenance cadence, not a suspicious version jump), 11.6M weekly downloads, and a well-known, long-standing GitHub repository (`webpro-nl/knip`, formerly the author's `webpro/knip`). Per protocol, still flag with `checkpoint:human-verify` before the install task — the planner should include this checkpoint, and the human-verify note should state the reason above so the reviewer isn't alarmed by the SUS label. **Alternative if the team wants to avoid the "just published" signal entirely:** pin to `6.28.0` (previous minor, still current) instead of `6.29.0` — functionally equivalent for this phase's needs.

_No packages in this phase were sourced from WebSearch/training-data-only; both were confirmed directly against the npm registry via `npm view`._

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│  CI Pipeline (.github/workflows/ci.yml)                          │
│                                                                    │
│  install → shared build → [NEW: knip] → typecheck → test → build │
│                  │              │                                │
│                  │              └─ needs dist/ built for         │
│                  │                 cross-package import           │
│                  │                 resolution (shared's           │
│                  │                 package.json exports → dist/) │
│                  └─ produces packages/shared/dist/*.js + *.d.ts  │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  packages/client/src/hooks/  (NEW — CLEANUP-02)                  │
│                                                                    │
│  useTeamColors.ts                                                │
│    ├─ teamAccentColor(teamId): string   ← PURE, no hook rules    │
│    │     (TEAM_CONFIGS[teamId]?.palette.uiColor ?? fallback)     │
│    └─ useTeamAccentColor(teamId): string ← thin wrapper,         │
│          calls teamAccentColor() directly, safe in component     │
│          bodies (GameBoard.tsx, PieceOverlay.tsx call sites)     │
│                                                                    │
│  useMyTeam.ts                                                    │
│    ├─ deriveMyTeam(playerSlot): 'home'|'away'|null ← PURE        │
│    │     (callable from useGameStore.ts action bodies via get()) │
│    └─ useMyTeam(): 'home'|'away'|null ← thin wrapper,            │
│          const playerSlot = useGameStore(s => s.playerSlot);     │
│          return deriveMyTeam(playerSlot);                        │
│          (safe in HexGrid.tsx/ActionPanel.tsx/GameBoard.tsx)     │
└─────────────────────────────────────────────────────────────────┘
        │                                    │
        ▼                                    ▼
┌───────────────────────┐         ┌──────────────────────────────┐
│ Component bodies       │         │ Non-component contexts        │
│ (call the HOOK)        │         │ (call the PURE function only) │
│ - GameBoard.tsx         │         │ - useGameStore.ts action      │
│ - PieceOverlay.tsx      │         │   bodies (get()/set() closures│
│   (verify applicability │         │   — not React render)         │
│   first, see Pitfall 6) │         │ - ActionLog.tsx's              │
│ - HexGrid.tsx            │         │   pieceColorOf/slotTeamColor  │
│ - ActionPanel.tsx        │         │   module-level helpers        │
│ - FreeKickSetupPanel.tsx │         │   (called from .map() loops   │
│ - KickOffSetupPanel.tsx  │         │   during render — hooks       │
│                          │         │   CANNOT be called here)      │
└───────────────────────┘         └──────────────────────────────┘
```

### Recommended Project Structure

```
packages/client/src/
├── hooks/                     # NEW directory (D-03)
│   ├── useTeamColors.ts       # teamAccentColor() pure fn + useTeamAccentColor() hook wrapper
│   └── useMyTeam.ts           # deriveMyTeam() pure fn + useMyTeam() hook wrapper
├── store/
│   └── useGameStore.ts        # imports deriveMyTeam (NOT useMyTeam) — action bodies aren't React render
├── components/
│   ├── ActionLog.tsx          # imports teamAccentColor (NOT useTeamAccentColor) in its module-level helpers
│   ├── GameBoard.tsx          # imports useTeamAccentColor + useMyTeam (called in component body)
│   ├── PieceOverlay.tsx       # see Pitfall 6 before applying — may not need the hook at all
│   ├── HexGrid.tsx            # imports useMyTeam
│   ├── ActionPanel.tsx        # imports useMyTeam
│   ├── FreeKickSetupPanel.tsx # imports useMyTeam (replaces non-null-safe inline form, see Pitfall 4)
│   └── KickOffSetupPanel.tsx  # imports useMyTeam (replaces non-null-safe inline form, see Pitfall 4)
```

knip.json goes at repo root (`.`), alongside `eslint.config.js`:

```
counter-attack-poc/
├── knip.json                  # NEW — workspaces config covering shared/server/client
├── eslint.config.js           # extended with react-hooks plugin scoped to packages/client
├── .github/workflows/ci.yml   # extended with `pnpm knip` step
└── package.json                # extended with root "knip": "knip" script
```

### Pattern 1: Pure-function-core + thin-hook-wrapper

**What:** Export the actual computation as a plain, non-hook function; export a one-line hook that just calls it. Both live in the same file under `hooks/` (satisfies D-03's "hooks" framing for the module) but only the hook half is subject to Rules of Hooks.

**When to use:** Any time the "shared logic" needs to be called from a context where React hooks are illegal — non-component helper functions called inside `.map()`/loops during render (`ActionLog.tsx`), or from outside React entirely (Zustand store action bodies in `useGameStore.ts`).

**Example:**

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

/** Thin hook wrapper — exists for call-site naming consistency with D-03 in
 *  component bodies (GameBoard.tsx). Functionally identical to calling
 *  teamAccentColor() directly (no store subscription — TEAM_CONFIGS is a
 *  static import, not reactive state). */
export function useTeamAccentColor(teamId: TeamId | undefined): string {
  return teamAccentColor(teamId);
}
```

```typescript
// packages/client/src/hooks/useMyTeam.ts
import { useGameStore } from '../store/useGameStore.js';

/** Pure — callable from useGameStore.ts's own action bodies via get(), which
 *  run outside React render and CANNOT call hooks. Canonical null-safe
 *  semantics (matches HexGrid.tsx/ActionPanel.tsx/GameBoard.tsx's existing form). */
export function deriveMyTeam(playerSlot: 1 | 2 | null): 'home' | 'away' | null {
  return playerSlot === 1 ? 'home' : playerSlot === 2 ? 'away' : null;
}

/** Hook wrapper for component bodies — subscribes to the narrowest slice
 *  (Pitfall 6 / locked per-slice-selector convention). */
export function useMyTeam(): 'home' | 'away' | null {
  const playerSlot = useGameStore((s) => s.playerSlot);
  return deriveMyTeam(playerSlot);
}
```

### Pattern 2: knip workspaces config for this pnpm monorepo

**What:** A single root `knip.json` describing all three workspaces, letting knip auto-detect the Vite/Vitest entry points per package rather than hand-enumerating every test/bootstrap file.

**When to use:** CLEANUP-01's config task.

**Example:**

```jsonc
// knip.json (repo root) — Source: https://knip.dev/features/monorepos-and-workspaces, https://knip.dev/reference/configuration
{
  "$schema": "https://unpkg.com/knip@6/schema.json",
  "workspaces": {
    "packages/shared": {
      "entry": ["src/index.ts", "scripts/seed-rosters.ts"],
      "project": ["src/**/*.ts", "scripts/**/*.ts"],
    },
    "packages/server": {
      "entry": ["src/main.ts", "src/index.ts"],
      "project": ["src/**/*.ts"],
    },
    "packages/client": {
      "entry": ["src/main.tsx", "index.html"],
      "project": ["src/**/*.{ts,tsx}"],
    },
  },
}
```

Notes grounded in this codebase:

- `packages/shared/src/index.ts` is the barrel export (`export * from './types.js'` etc.) — this IS the real public entry surface consumed by both client and server; everything reachable from it is "used," everything not is a genuine dead-code candidate.
- `packages/shared/scripts/seed-rosters.ts` is a standalone dev script invoked only via `pnpm seed:rosters` (never imported) — must be listed as its own entry, mirroring the existing `eslint.config.js allowDefaultProject: ['packages/*/scripts/*.ts']` exception for the same reason.
- `packages/server/src/index.ts` exports `buildServer`/`Room`/`PlayerRecord`/`JoinResult` — confirmed via grep that all `__tests__/*.test.ts` files import from it, so it is genuinely used, not dead; it must still be listed as an entry (or the vitest plugin's auto-detected test entries will cover it as a transitive import — verify with `knip --debug` per pitfall below).
- `packages/client`'s real entry is Vite's `index.html` → `src/main.tsx` chain; knip's Vite plugin auto-detects this from `vite.config.ts`, but listing both explicitly avoids relying on plugin auto-detection succeeding silently.
- Each package already has its own `vitest.config.ts` with `test.include: ['src/**/*.test.{ts,tsx}']` (client) — knip's Vitest plugin auto-detects these and treats matching test files as additional entry points automatically, so `**/*.test.ts` does **not** need to be hand-added to `entry` (only to `project`, which the globs above already cover via `src/**/*.ts`).

### Pattern 3: `setGameState`'s hand-rolled dependency gate is the real CLEANUP-03 review target

**What:** `useGameStore.ts`'s `setGameState` action (lines 658-844) contains a multi-boolean gate — `responseMoveStateChanged`, `responseMovePaceExhausted`, `phaseChanged`, `pieceStillExists`, `activationComplete` — that functions exactly like a hand-implemented dependency array (React's `useEffect`/`useMemo` deps, reimplemented manually in Zustand) deciding whether to clear or retain UI selection state. This, plus the derived-and-stored (rather than derived-on-read) fields `validMoveHexes`/`tackleRiskHexes`/`validPassTargetHexes`/`interceptionRiskHexes`, computed via `computeMovementValidHexes`/`computeResponseMoveValidHexes` and manually re-invoked at 6+ separate mutation sites, is the concrete surface CLEANUP-03's "stale dependency arrays" and "redundant derived-state recomputation" language is describing.

**When to use:** This is the primary content for `SELECTOR-REVIEW.md` (D-05). A quick grep across `packages/client/src` for `useGameStore((s) => ({` / whole-store subscriptions found **zero** matches — the codebase already follows the locked per-slice-selector convention at component call sites cleanly. The review's real yield is therefore expected to be in the store's own internal derived-state bookkeeping, not in component-level selector anti-patterns.

**Example (what to catalog per selector/derived field in SELECTOR-REVIEW.md):**

```markdown
| Field/Selector | Derives                                     | Recomputed at                                              | Stale-risk?                                                                                                | Verdict                                                                  |
| -------------- | ------------------------------------------- | ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| validMoveHexes | Valid destination hexes for selectedPieceId | selectPiece (7 phase branches) + setGameState (5 branches) | Yes — 12 manual call sites; a 13th mutation path that forgets to recompute silently shows stale highlights | Consolidate further OR document why remaining duplication is irreducible |
| shootTargetHex | (dead — see CLEANUP-01)                     | n/a                                                        | n/a                                                                                                        | Remove entirely                                                          |
```

### Anti-Patterns to Avoid

- **Calling `useTeamAccentColor`/`useMyTeam` inside `.map()` callbacks or module-level helper functions:** Violates Rules of Hooks (conditional/variable call count across renders). `ActionLog.tsx`'s `pieceColorOf`/`slotTeamColor`/`P`/`PNamed` pattern calls its color helper from inside array-building loops during `consolidateEvents`/`formatEvent` — these must use the pure `teamAccentColor()` function, not the hook.
- **Calling any hook inside `useGameStore.ts`'s `create<GameStore>()((set, get) => ({ ... }))` body:** This factory function runs once at module init and its action closures run in event-handler context, never inside React's render — hooks are illegal there. Use `deriveMyTeam(playerSlot)` (pure), not `useMyTeam()`.
- **Reflexively reaching for `eslint-disable-next-line react-hooks/exhaustive-deps` on every flagged effect:** Per D-08 this is allowed only for genuine one-time effects with a deliberately-omitted, legitimately-changing value. Since Zustand action references are stable for the store's lifetime, the correct fix for the vast majority of flagged violations in this codebase is to **add the missing (stable) dependency**, not suppress the rule (see Pitfall 3).

## Don't Hand-Roll

| Problem                                                   | Don't Build                         | Use Instead                                                             | Why                                                                                                                                                                                                                    |
| --------------------------------------------------------- | ----------------------------------- | ----------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Dead-code/unused-export detection across a pnpm workspace | A custom grep/ts-morph audit script | knip's built-in `workspaces` config + Vite/Vitest plugin auto-detection | knip already resolves cross-package `workspace:*` imports, package.json `exports` fields, and test-runner entry points — reimplementing this is exactly the kind of "deceptively complex" problem knip exists to solve |
| React Hook dependency-correctness checking                | Manual code review checklist        | `eslint-plugin-react-hooks` static analysis rule                        | Dependency-array bugs are subtle (stale closures) and easy to miss in review; this is literally what the official React team ships the plugin for                                                                      |

**Key insight:** Both CLEANUP-01 and CLEANUP-04's tools already exist, are officially maintained, and are already the two most-downloaded tools in their respective niches — there is no scenario in this phase where hand-rolling either analysis is justified.

## Common Pitfalls

### Pitfall 1: Converting `ActionLog.tsx`'s color helpers into hook calls breaks Rules of Hooks

**What goes wrong:** `pieceColorOf(pieceId)` and `slotTeamColor(slot)` in `ActionLog.tsx` are plain module-level functions, deliberately NOT using `useGameStore` selector subscription today (the existing comment says "not a subscription — safe in module-level helpers," using `useGameStore.getState()` instead). They are called from inside `consolidateEvents`'s per-event loop and from the `P`/`PNamed` sub-components. If CLEANUP-02 naively rewrites these to call a `useTeamAccentColor()` hook, the loop-invoked calls (inside `consolidateEvents`, a plain function, not a component) will violate Rules of Hooks — hooks cannot be called inside loops or non-component functions.
**Why it happens:** D-03 frames the new shared logic as "hooks," which reads as "always use the hook," but the actual call-site shapes in this codebase are heterogeneous (component bodies vs. loop-invoked helpers).
**How to avoid:** Use the pure-function-core pattern (§ Architecture Patterns Pattern 1). `ActionLog.tsx`'s `pieceColorOf`/`slotTeamColor` should call the exported pure `teamAccentColor(teamId)` function directly (not the hook); only genuine component bodies (`P`, `PNamed`, or a parent that resolves color once and passes it down) may use the hook form if desired — though since it's a plain function, using the pure form everywhere in this file is simplest and avoids the distinction entirely.
**Warning signs:** ESLint's `react-hooks/rules-of-hooks` rule (bundled in the same plugin being added for CLEANUP-04) will catch this immediately at `error` severity — treat any such error surfacing during CLEANUP-02 work as a signal to switch that call site to the pure function.

### Pitfall 2: `useMyTeam()` cannot be called inside `useGameStore.ts`'s own action bodies

**What goes wrong:** `useGameStore.ts` derives `myTeam` inline at 7 separate locations (`playerSlot === 1 ? 'home' : 'away'`), all inside the store's own action functions (`selectPiece`'s phase branches). These run via `get()`/`set()` closures defined inside `create<GameStore>()((set, get) => ({...}))` — this factory executes once at module load, and the returned action functions execute later in response to socket events / user clicks, never inside a React component's render pass. Calling `useMyTeam()` (which itself calls `useGameStore((s) => s.playerSlot)`) here is not just a lint violation — it is not callable at all in this context (no active render to attach the hook to).
**Why it happens:** Same root cause as Pitfall 1 — D-03's hook framing doesn't distinguish between React and non-React call sites, and `useGameStore.ts` itself is one of the 8 files CONTEXT.md D-04 explicitly lists as a `myTeam`-duplication site.
**How to avoid:** `useGameStore.ts`'s 7 call sites should use the pure `deriveMyTeam(playerSlot)` function, called as `deriveMyTeam(get().playerSlot)` (or destructure `playerSlot` from the existing `const { gameState, selectedPieceId, playerSlot } = get();` calls already present in `selectPiece`).
**Warning signs:** TypeScript will actually catch this at compile time (calling a hook outside a component context doesn't type-error, but `eslint-plugin-react-hooks`'s `rules-of-hooks` rule WILL flag it — the rule detects hook calls by naming convention (`use*`) regardless of surrounding context, including inside plain functions like Zustand store creators).

### Pitfall 3: Zustand action references are stable — prefer adding them to deps over `eslint-disable`

**What goes wrong:** `App.tsx`'s single `useEffect` (lines 60-206) registers ~14 Socket.io listeners and closes over ~14+ Zustand setter functions (`setGameState`, `setDisconnectWarning`, `setScreen`, `setRoomCode`, `setPlayerSlot`, `setRoomError`, `setGameError`, plus several `useState` setters) with an **empty dependency array** `[]`. Enabling `react-hooks/exhaustive-deps` at `error` will flag every one of these as a missing dependency. The instinct will be to add `// eslint-disable-next-line react-hooks/exhaustive-deps` with a "runs once on mount" comment — but per D-08 this requires individual justification review, and doing it for every effect in the codebase defeats the purpose of enabling the rule.
**Why it happens:** ESLint's `exhaustive-deps` rule cannot know that a Zustand-store-returned action function is referentially stable across renders (same function identity for the store's lifetime) — it treats it the same as any other external reference and asks for it to be listed.
**How to avoid:** For nearly all flagged cases in this codebase, the correct and behavior-preserving fix is to **add the missing (stable) references to the dependency array**, not to disable the rule. Since Zustand action references never change, this satisfies the linter with zero risk of introducing extra effect re-runs — the effect still only fires once because none of its now-listed dependencies ever actually change value. Reserve `eslint-disable-next-line react-hooks/exhaustive-deps` (D-08's escape hatch) for the rarer case of a value that legitimately DOES change across renders but is deliberately, correctly excluded (the codebase already has an established pattern for this — see e.g. the `useGameStore.getState()` snapshot-inside-closure idiom used to intentionally avoid stale closures without needing the value as a dependency, noted in STATE.md as "startReplayStream re-fetches liveRoom inside setTimeout to eliminate stale closure").
**Warning signs:** If a `SELECTOR-REVIEW.md`/verification pass finds more than a small handful of `eslint-disable-next-line react-hooks/exhaustive-deps` comments after CLEANUP-04 is "complete," that is a signal the team reached for suppression instead of the stable-dependency fix — this is exactly what D-08's "every suppression's justification must be reviewed" verification step exists to catch.

### Pitfall 4: Two incompatible `myTeam` derivation semantics exist today — consolidating them can silently change behavior

**What goes wrong:** Grep confirms two different inline forms coexist:

- **Null-safe** (`HexGrid.tsx`, `ActionPanel.tsx`, `GameBoard.tsx`): `playerSlot === 1 ? 'home' : playerSlot === 2 ? 'away' : null` → type `'home' | 'away' | null`.
- **Non-null-safe** (`useGameStore.ts` ×7, `FreeKickSetupPanel.tsx`, `KickOffSetupPanel.tsx`): `playerSlot === 1 ? 'home' : 'away'` → type `'home' | 'away'` (silently treats `null`/unset `playerSlot` as `'away'`).

If the canonical `deriveMyTeam`/`useMyTeam` adopts the null-safe form (recommended — it's the more common pattern, used in 3 of 5 component files, and is the semantically correct one), the 3 non-null-safe call sites gain a `null` case they previously didn't have to handle, requiring either a narrowing check or confirmation that `playerSlot` is guaranteed non-null at that point in the flow (plausible for `FreeKickSetupPanel.tsx`/`KickOffSetupPanel.tsx` since they only render mid-game after room join, but must be verified, not assumed).
**Why it happens:** The two forms evolved independently across different phases (11 phases of prior work touched this codebase, per STATE.md) without a single canonical helper.
**How to avoid:** Adopt the null-safe form as canonical (§ Architecture Patterns Pattern 1). At the 3 non-null-safe call sites, either (a) confirm via the phase-guard already present (`if (phase !== 'X') return null;`) that `playerSlot` cannot be `null` at that point and add an explicit non-null assertion/guard, or (b) thread the `null` case through with the same fallback behavior (`'away'`) via a small local wrapper, documenting why. Do not let TypeScript's stricter `'home' | 'away' | null` type silently `?? 'away'`-coerce without a decision recorded.
**Warning signs:** TypeScript compile errors at the 3 non-null-safe sites once the shared type changes — treat every one as a decision point requiring explicit resolution, not a type-error to silence.

### Pitfall 5: `PieceOverlay.tsx`'s `palette.uiColor` occurrence is a type-shape pass-through, not a duplicated derivation

**What goes wrong:** CONTEXT.md's D-04 scout cites `PieceOverlay.tsx` as one of 3 files with inlined `TEAM_CONFIGS[...].palette.uiColor`. On inspection, `PieceOverlay.tsx` line 107 is `uiColor: palette.uiColor` — a field-copy inside an object-literal reconstruction (`effectivePalette: TeamPalette = useAwayScheme ? { ...swapped fields..., uiColor: palette.uiColor } : palette`) required to satisfy the `TeamPalette` type shape when building the away/GK color-swap variant. It is **not** an independent `TEAM_CONFIGS[teamId]` lookup — `palette` here is already a fully-resolved prop passed down from `HexGrid.tsx` (which does the real `TEAM_CONFIGS[resolvedTeamId]` lookup at line 677). `PieceOverlay.tsx` does not receive a `TeamId` prop suitable for calling `useTeamAccentColor(teamId)` — it only has `piece.teamId` (`'home'`/`'away'` positional, not a roster `TeamId` like `'arsenal'`).
**Why it happens:** The scout's search matched the literal substring `palette.uiColor` without distinguishing "computes a color from `TEAM_CONFIGS`" from "copies a field through an object literal."
**How to avoid:** Do not force `PieceOverlay.tsx` into the same `useTeamAccentColor(teamId)` call pattern as `ActionLog.tsx`/`GameBoard.tsx`. This file's consolidation opportunity (if any) is different in kind — verify at planning/implementation time whether `effectivePalette`'s reconstruction can be simplified at all, but preserve the existing pass-through behavior; forcing a hook call here would require threading a `TeamId` prop through `HexGrid.tsx`→`PieceOverlay.tsx` that doesn't currently exist and isn't otherwise needed.
**Warning signs:** If the plan calls for "add `useTeamAccentColor` import to `PieceOverlay.tsx`," re-verify against this file's actual prop shape before implementing — it may be a no-op or a different, smaller fix than the other two files.

### Pitfall 6: knip needs `packages/shared`'s `dist/` built before it can resolve cross-package imports

**What goes wrong:** `packages/shared/package.json` declares `"main": "./dist/index.js"` and `"exports": { ".": { "import": "./dist/index.js", "types": "./dist/index.d.ts" } }`. `dist/` is gitignored. `packages/server` imports `@counter-attack/shared` via normal Node module resolution (through the `exports` field), while `packages/client`'s Vite config aliases `@counter-attack/shared` directly to `../shared/src/index.ts` for HMR — but knip's own static analysis does not use Vite's runtime alias config by default; it resolves through standard package.json-based module resolution unless its Vite plugin is confirmed to read `resolve.alias`. If `knip` runs before `pnpm --filter @counter-attack/shared build`, cross-package imports will fail to resolve and produce a flood of false "unresolved import"/"unused export" noise across the shared package's entire public API.
**Why it happens:** The existing CI pipeline already handles this correctly for `typecheck`/`test`/`build` (shared build is step 2, before everything else) — a new `knip` step must be inserted with the same ordering constraint in mind, not just appended at the end.
**How to avoid:** Place the `pnpm knip` CI step immediately after the existing `pnpm --filter @counter-attack/shared build` step (i.e., as the new step 3, before `typecheck`) — this is also the cheapest place for it (fail fast on dead code before spending CI minutes on the slower typecheck/test/build steps). Locally, developers running `pnpm knip` ad hoc must remember to build shared first, or the root `knip` script should depend on it (e.g. `"knip": "pnpm --filter @counter-attack/shared build && knip"`).
**Warning signs:** A first `knip` run reporting dozens of unresolved-import errors specifically for `@counter-attack/shared`'s exports (not genuine dead-code findings) is the signature of this ordering bug — run `knip --debug` to confirm resolved workspace/entry configuration before trusting the report.

## Code Examples

### knip package.json script + CI step

```jsonc
// package.json (root) — add alongside existing scripts
{
  "scripts": {
    "knip": "pnpm --filter @counter-attack/shared build && knip",
  },
}
```

```yaml
# .github/workflows/ci.yml — insert as new step 3, before typecheck
- run: pnpm install --frozen-lockfile
- run: pnpm --filter @counter-attack/shared build
- run: pnpm knip # NEW — fails fast on dead code before typecheck/test/build
- run: pnpm -r typecheck
- run: pnpm -r test
- run: pnpm -r build
```

### eslint-plugin-react-hooks flat config scoped to client only

```javascript
// eslint.config.js — Source: https://github.com/facebook/react/blob/main/packages/eslint-plugin-react-hooks/README.md
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';
import reactHooks from 'eslint-plugin-react-hooks';

export default tseslint.config(
  ...tseslint.configs.recommendedTypeChecked,
  prettier,
  // ...existing config blocks unchanged...
  {
    // Scoped to packages/client only — packages/shared and packages/server are
    // non-React (D-07 requirement). Use the STABLE `recommended` rule set
    // (rules-of-hooks + exhaustive-deps), not `recommended-latest`
    // (bundles newer React-Compiler-readiness rules out of CLEANUP-04's scope).
    files: ['packages/client/src/**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      // D-07: explicit `error`, not whatever the preset ships as default severity.
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'error',
    },
  },
);
```

### Fixing an exhaustive-deps violation via stable-dependency addition (preferred over disable)

```typescript
// Before (App.tsx-style pattern) — flags 14 missing deps at `error`
useEffect(() => {
  function onGameState(state: GameState) {
    setGameState(state); /* ... */
  }
  socket.on(ServerEvents.GAME_STATE, onGameState);
  return () => socket.off(ServerEvents.GAME_STATE, onGameState);
}, []); // eslint: react-hooks/exhaustive-deps — missing setGameState, setScreen, ...

// After — add the stable Zustand action refs; behavior is IDENTICAL
// (these functions never change identity for the store's lifetime, so the
// effect still only re-runs on true mount, same as the empty-array version).
useEffect(() => {
  function onGameState(state: GameState) {
    setGameState(state); /* ... */
  }
  socket.on(ServerEvents.GAME_STATE, onGameState);
  return () => socket.off(ServerEvents.GAME_STATE, onGameState);
}, [
  setGameState,
  setScreen,
  setDisconnectWarning,
  setRoomCode,
  setPlayerSlot,
  setRoomError,
  setGameError /* ...all closed-over stable setters */,
]);
```

## State of the Art

| Old Approach                                                         | Current Approach                                                                                                                | When Changed                                                                                                                 | Impact                                                                                                                      |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `eslint-plugin-react-hooks` legacy `.eslintrc` extends string config | Flat config via `reactHooks.configs.flat.recommended` (or manual `plugins`/`rules` object as used here for per-package scoping) | ESLint 9's flat config became default; the plugin's v5+ releases ship a `configs.flat` export                                | This repo is already on ESLint 9.39.4 flat config (`eslint.config.js`) — no migration needed, just the addition shown above |
| ts-prune for dead-code detection                                     | knip                                                                                                                            | knip has been the community-recommended successor for several years; ts-prune's GitHub activity has been effectively dormant | Already reflected in D-01's locked decision — no action needed beyond following it                                          |

**Deprecated/outdated:** None directly relevant beyond the above — this is a small, current-tooling phase.

## Assumptions Log

| #   | Claim                                                                                                                                                                                       | Section                          | Risk if Wrong                                                                                                                                                                                                                                                                                                                                                               |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A1  | CI placement of `pnpm knip` immediately after the shared-build step (before typecheck) is the best-practice ordering                                                                        | Common Pitfalls 6, Code Examples | Low — knip is independent of typecheck/test/build results; if wrong, the only cost is CI running knip slightly later than optimal, not a correctness issue                                                                                                                                                                                                                  |
| A2  | knip's Vite/Vitest plugins will auto-detect `index.html`→`src/main.tsx` and each package's `vitest.config.ts` `test.include` glob as entry points without additional config                 | Architecture Patterns Pattern 2  | Medium — if auto-detection doesn't fire as expected (e.g. due to the client's non-default Vite alias setup pointing `@counter-attack/shared` at source instead of dist), knip may report false positives on test-only or Vite-bootstrap exports; mitigate by running `knip --debug` early during implementation to inspect resolved entries before trusting the full report |
| A3  | `FreeKickSetupPanel.tsx`/`KickOffSetupPanel.tsx`'s non-null-safe `myTeam` derivation never actually encounters `playerSlot === null` at runtime (both only render mid-game after room join) | Common Pitfalls 4                | Medium — if wrong, adopting the null-safe canonical form without a guard could introduce a new `null`-branch code path that behaves differently than the current `?? 'away'`-equivalent fallback; must be verified by tracing when these components render, not assumed                                                                                                     |

## Open Questions

1. **Does knip need explicit awareness of Vite's `resolve.alias` for `@counter-attack/shared` to avoid false positives in the client package?**
   - What we know: knip has a Vite plugin that reads `vite.config.ts`; the client's `resolve.alias` points `@counter-attack/shared` at `../shared/src/index.ts` (source, not `dist/`), which differs from how `packages/server` resolves the same package (via `node_modules` symlink → `dist/`).
   - What's unclear: Whether knip's Vite plugin picks up this alias automatically or whether the client-side analysis of `@counter-attack/shared` imports needs to be handled purely through the workspace's normal `dependencies` entry (`"@counter-attack/shared": "workspace:*"`) regardless of the Vite alias.
   - Recommendation: Run `knip --debug` as the very first implementation step (before writing any fix code) and inspect the resolved workspace/entry/plugin list; treat any anomalies here as a config task, not a false-positive to `ignore`-list away (per knip's own documentation guidance: "Avoid `ignore` patterns... a surprising result is usually a real finding or a configuration gap").

2. **Exact count and location of `react-hooks/exhaustive-deps` violations that will surface once the rule is enabled at `error`.**
   - What we know: 14 `useEffect` call sites exist across 11 files; `App.tsx`'s single mount-once socket-registration effect is confirmed to have an empty `[]` array closing over ~14+ external references (highest-risk single site).
   - What's unclear: The exact violation count in the other 13 `useEffect` sites (`ActionPanel.tsx` ×2, `BenchCarousel.tsx`, `ConnectionStatus.tsx`, `DraftPackCarousel.tsx`, `EventBanner.tsx` ×2, `HexGrid.tsx`, `LineupAssignmentScreen.tsx` ×2, `LobbyScreen.tsx`, `TeamSelectionScreen.tsx`, `UniformSelectionScreen.tsx`) was not individually audited in this research pass — only confirmed to exist.
   - Recommendation: Treat "enable the rule and read its own output" as the discovery mechanism for the plan's task breakdown, rather than trying to pre-enumerate every violation in research — this is exactly the kind of mechanical, tool-driven inventory that should happen in Wave 0/1 of implementation, not in planning.

## Environment Availability

Skipped — this phase's only new dependencies (`knip`, `eslint-plugin-react-hooks`) are npm packages installed via the existing `pnpm add -Dw` workflow already used throughout the project; there are no external services, runtimes, or CLI tools to probe. Node 24.15.0 (installed on this machine) and pnpm are already confirmed available and in active use (`pnpm-workspace.yaml`, `package.json` `packageManager: "pnpm@9.15.9"` present and functioning).

## Validation Architecture

### Test Framework

| Property           | Value                                                                                                                     |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| Framework          | Vitest 2.1.9 (each package has its own `vitest.config.ts`; client uses `environment: 'jsdom'` + `@testing-library/react`) |
| Config file        | `packages/{shared,server,client}/vitest.config.ts` (3 separate configs, no shared root config)                            |
| Quick run command  | `pnpm --filter @counter-attack/client test` (or `--filter` the specific package touched)                                  |
| Full suite command | `pnpm -r test`                                                                                                            |

### Phase Requirements → Test Map

| Req ID     | Behavior                                                                                   | Test Type        | Automated Command                                                                                                                        | File Exists?                                                                                                                                                         |
| ---------- | ------------------------------------------------------------------------------------------ | ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CLEANUP-01 | `pnpm knip` reports zero flagged issues after fixes                                        | tooling/CI       | `pnpm knip`                                                                                                                              | New script — Wave 0                                                                                                                                                  |
| CLEANUP-01 | `shootTargetHex` removal does not break existing store tests                               | unit             | `pnpm --filter @counter-attack/client test -- useGameStore`                                                                              | ✅ existing (`useGameStore.test.ts`, `useGameStore.rule11.test.ts`)                                                                                                  |
| CLEANUP-02 | `useTeamAccentColor`/`useMyTeam` produce identical output to the inline logic they replace | unit             | New hook tests, e.g. `pnpm --filter @counter-attack/client test -- useMyTeam`                                                            | ❌ Wave 0 — no existing hook test file (no `hooks/` dir exists yet)                                                                                                  |
| CLEANUP-02 | Existing component tests still pass after call-site migration                              | unit/integration | `pnpm --filter @counter-attack/client test -- ActionLog GameBoard PieceOverlay HexGrid ActionPanel FreeKickSetupPanel KickOffSetupPanel` | ✅ existing (all 7 files have `*.test.tsx` siblings except `PieceOverlay.tsx`, `FreeKickSetupPanel.tsx`, `KickOffSetupPanel.tsx` — confirm coverage during planning) |
| CLEANUP-03 | Selector fixes don't regress existing store behavior tests                                 | unit             | `pnpm --filter @counter-attack/client test -- useGameStore`                                                                              | ✅ existing                                                                                                                                                          |
| CLEANUP-04 | `pnpm lint` (client scope) reports zero `react-hooks/*` violations                         | lint             | `pnpm lint` (root `eslint .` already covers all packages; verify client-scoped rules fire)                                               | ✅ existing script, new rule set                                                                                                                                     |

### Sampling Rate

- **Per task commit:** package-scoped `pnpm --filter <pkg> test` for whichever package the task touched, plus `pnpm lint` when touching client files
- **Per wave merge:** `pnpm -r test` + `pnpm knip` + `pnpm lint`
- **Phase gate:** Full suite green (`pnpm -r typecheck && pnpm -r test && pnpm knip && pnpm lint && pnpm -r build`) before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `knip.json` (repo root) — does not exist yet; required before `pnpm knip` can run at all
- [ ] `packages/client/src/hooks/` directory + `useTeamColors.ts`/`useMyTeam.ts` — does not exist yet
- [ ] Unit test files for the two new hooks (`useTeamColors.test.ts`, `useMyTeam.test.ts` or co-located) — no existing coverage since the hooks don't exist yet
- [ ] `eslint-plugin-react-hooks` block in `eslint.config.js` — does not exist yet
- [ ] `.planning/phases/32-code-cleanup/SELECTOR-REVIEW.md` — the CLEANUP-03 deliverable itself (D-05)

## Security Domain

### Applicable ASVS Categories

| ASVS Category         | Applies | Standard Control                                                                     |
| --------------------- | ------- | ------------------------------------------------------------------------------------ |
| V2 Authentication     | No      | No auth mechanism touched — this phase is client-side UI refactor + dev tooling only |
| V3 Session Management | No      | No session-token/reconnect logic touched                                             |
| V4 Access Control     | No      | No authorization logic touched                                                       |
| V5 Input Validation   | No      | No new user input surfaces introduced — pure internal refactor                       |
| V6 Cryptography       | No      | Not touched                                                                          |

### Known Threat Patterns for this stack

None applicable — this phase introduces no new attack surface. The only new "external" additions (`knip`, `eslint-plugin-react-hooks`) are **devDependencies only**, never shipped in the client/server production bundles, so they carry no runtime security exposure. Supply-chain risk for these two packages is addressed via the Package Legitimacy Audit above (§ Package Legitimacy Audit) rather than ASVS categories.

## Sources

### Primary (HIGH confidence)

- `npm view knip version` / `npm view knip time.modified` / `npm view knip engines` / `npm view knip versions --json` — direct registry queries, confirmed 6.29.0, published 2026-07-22, `node: "^20.19.0 || >=22.12.0"`, steady 6.22.0→6.29.0 recent release history
- `npm view eslint-plugin-react-hooks version` / `dist-tags` / `peerDependencies` — direct registry queries, confirmed 7.1.1 latest, `eslint: "^3.0.0 || ... || ^9.0.0 || ^10.0.0"`
- `gsd-tools query package-legitimacy check --ecosystem npm knip eslint-plugin-react-hooks` — seam verdicts (SUS for knip on "too-new" heuristic, OK for eslint-plugin-react-hooks)
- Direct codebase inspection: `eslint.config.js`, `package.json` (root/client/server/shared), `.github/workflows/ci.yml`, `pnpm-workspace.yaml`, `packages/client/src/store/useGameStore.ts` (full 953 lines read), `packages/client/src/components/{ActionLog,GameBoard,PieceOverlay,HexGrid,ActionPanel,FreeKickSetupPanel,KickOffSetupPanel}.tsx`, `packages/client/src/App.tsx`, `packages/*/vitest.config.ts`, `packages/client/vite.config.ts`, `packages/shared/src/index.ts`, `packages/server/src/{index.ts,gameHandlers.ts}`

### Secondary (MEDIUM confidence)

- [Monorepos & Workspaces | Knip](https://knip.dev/features/monorepos-and-workspaces) — workspaces config shape, pnpm auto-detection
- [Configuration | Knip](https://knip.dev/reference/configuration) — `entry`/`project`/`ignore` semantics, "avoid ignore patterns" guidance
- [eslint-plugin-react-hooks README (facebook/react)](https://github.com/facebook/react/blob/main/packages/eslint-plugin-react-hooks/README.md) — flat config `configs.flat.recommended` vs `recommended-latest` distinction, manual `files`-scoping requirement

### Tertiary (LOW confidence)

- General WebSearch results on knip false-positive GitHub issues (#719, #1466, #690, #890) — none specific to Zustand/Socket.io patterns; used only to confirm no documented framework-specific false-positive class exists for this stack, informing Open Question 1 rather than a direct claim

## Metadata

**Confidence breakdown:**

- Standard stack (knip, eslint-plugin-react-hooks versions): HIGH — both verified directly against npm registry with publish dates and peer-dependency compatibility confirmed
- Architecture (pure-function + hook-wrapper pattern, knip workspace config, CI ordering): HIGH — grounded in direct inspection of the actual call sites (not assumed), including the specific rules-of-hooks/non-React-context violations that would occur without this pattern
- Pitfalls: HIGH — all 6 pitfalls are traced to specific line numbers/files read during this research, not inferred generically
- Selector review scope (CLEANUP-03): MEDIUM — the `setGameState` hand-rolled dependency-gate pattern and derived-state duplication are clearly identified, but the full enumeration of every selector belongs in the SELECTOR-REVIEW.md deliverable itself, not this research doc
- Exact exhaustive-deps violation count (CLEANUP-04): LOW/Open Question — only the highest-risk site (`App.tsx`) was fully audited; the other 13 `useEffect` sites were confirmed to exist but not individually read line-by-line

**Research date:** 2026-07-24
**Valid until:** 2026-08-23 (30 days — stable tooling domain, but knip's active biweekly release cadence means re-verifying the pinned version before implementation if this research is consumed more than a few weeks later is prudent)
