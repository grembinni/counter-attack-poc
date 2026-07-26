# Phase 34: Visual Theme Restyle - Pattern Map

**Mapped:** 2026-07-26
**Files analyzed:** 8
**Analogs found:** 8 / 8

## File Classification

| New/Modified File                                              | Role                   | Data Flow                                                    | Closest Analog                                                                       | Match Quality                                                                               |
| -------------------------------------------------------------- | ---------------------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------- |
| `packages/client/src/styles/tokens.css`                        | config (design tokens) | transform (value swap, no structural change)                 | itself (existing file, Phase 33 version)                                             | exact — edit in place                                                                       |
| `packages/client/src/hooks/useTeamColors.ts`                   | utility/hook           | transform (pure color derivation)                            | itself — extend existing `teamAccentColor`/`useTeamAccentColor` in same file         | exact — additive extension                                                                  |
| `packages/client/src/hooks/useTeamColors.test.ts`              | test                   | request-response (pure fn assertions)                        | itself — existing `describe/it` blocks for `teamAccentColor`/`useTeamAccentColor`    | exact — append new `describe` blocks                                                        |
| `packages/client/scripts/check-contrast.ts`                    | utility (CI script)    | batch (iterate all teams, exit non-zero on failure)          | `packages/shared/scripts/seed-rosters.ts`                                            | role-match (only CLI/tsx script precedent in repo)                                          |
| `stylelint.config.js`                                          | config                 | —                                                            | `eslint.config.js` (root-level ESM config precedent)                                 | role-match (only root-level lint-config precedent; different tool but same repo convention) |
| `.github/workflows/ci.yml`                                     | config (CI pipeline)   | batch (sequential step list)                                 | itself — existing `pnpm knip` step (line 22)                                         | exact — add sibling steps                                                                   |
| `knip.json`                                                    | config                 | —                                                            | itself — existing `packages/shared` block (`entry`/`project` with `scripts/**/*.ts`) | exact — mirror block shape for `packages/client`                                            |
| `packages/client/src/components/GameBoard.tsx` (lines 178-228) | component              | request-response (derives CSS custom props from store state) | itself — existing `useTeamAccentColor` call sites                                    | exact — swap hook call, no structural change                                                |

## Pattern Assignments

### `packages/client/src/styles/tokens.css`

**Analog:** itself (current file, read in full above)

**Core pattern** — flat `:root` block of CSS custom properties, grouped by comment-headed sections (Backgrounds / Borders / Text / Team accent / Accents / CTA states / Destructive / Extended chrome tokens). Preserve this exact grouping and comment style; only change values inside the groups called out in RESEARCH.md's Token Inventory (D-02 3-tier backgrounds, `--color-border`, `--color-text-tertiary`, `--team-accent` static fallback, review `--color-text-primary`). Leave D-05-locked tokens (CTA/danger/success) and all "Extended chrome tokens" blocks byte-for-byte unchanged.

```css
:root {
  /* Backgrounds */
  --color-bg-page: #1a1a2e;
  --color-bg-surface: #16213e;
  --color-bg-surface-alt: #0f3460;

  /* Borders */
  --color-border: #0f3460;   /* NOTE (tokens.css line 21, comment at ~line 67 in RESEARCH):
                                 reuses --color-bg-surface-alt's value verbatim — preserve
                                 that reuse pattern with new value, don't diverge */
  ...
}
```

Update the file-header comment (lines 1-12) to record that Phase 34 is the phase that performs the value swap (mirrors how the current header records Phase 33's freeze rationale) — follow the same multi-line `/* ... */` comment convention already used at the top of the file.

---

### `packages/client/src/hooks/useTeamColors.ts` (utility/hook, transform)

**Analog:** itself — existing file (26 lines, read in full above)

**Full existing file for reference** (imports + both existing exports):

```typescript
import { TEAM_CONFIGS } from '@counter-attack/shared';
import type { TeamId } from '@counter-attack/shared';

/**
 * Pure — no Zustand/React dependency. ... Returns the fallback gray (`#888888`)
 * when teamId is falsy or absent from TEAM_CONFIGS.
 */
export function teamAccentColor(teamId: TeamId | undefined): string {
  if (!teamId) return '#888888';
  return TEAM_CONFIGS[teamId]?.palette.uiColor ?? '#888888';
}

/**
 * Thin hook wrapper — exists for call-site naming consistency ...
 * Functionally identical to calling teamAccentColor() directly: no store
 * subscription, since TEAM_CONFIGS is a static import, not reactive state.
 */
export function useTeamAccentColor(teamId: TeamId | undefined): string {
  return teamAccentColor(teamId);
}
```

**Additive extension pattern** — RESEARCH.md's Pattern 1 gives the exact shape to append, following the same doc-comment style (block comment above each export, referencing the driving decision ID):

```typescript
import { hex as contrastHex } from 'wcag-contrast';

const AA_MIN_RATIO = 4.5; // WCAG 2.x SC 1.4.3, normal text

/** D-04: AA-safety derivation layer. TEAM_CONFIGS.uiColor itself is never mutated;
 *  this returns an adjusted color ONLY for CSS-custom-property theme-accent usage. */
export function deriveAaAccentColor(uiColor: string, bgHex: string, fgHex: string): string {
  if (contrastHex(uiColor, bgHex) >= AA_MIN_RATIO && contrastHex(uiColor, fgHex) >= AA_MIN_RATIO) {
    return uiColor;
  }
  return searchAaSafeLightness(uiColor, bgHex, fgHex); // new private helper
}

export function useTeamAccentColorAA(teamId: TeamId | undefined): string {
  const raw = teamAccentColor(teamId);
  return deriveAaAccentColor(raw, '#<bgPageValue>', '#<textInverseValue>');
}
```

Do **not** modify `teamAccentColor`/`useTeamAccentColor` signatures or behavior — `ActionLog.tsx` depends on the current raw passthrough (D-04 carve-out).

---

### `packages/client/src/hooks/useTeamColors.test.ts` (test)

**Analog:** itself — existing file (28 lines, read in full above)

**Existing pattern to mirror** — `describe` block per exported function, `VALID_TEAM_ID` derived from `Object.keys(TEAM_CONFIGS)[0]`, explicit fallback-value assertions:

```typescript
import { describe, it, expect } from 'vitest';
import { TEAM_CONFIGS } from '@counter-attack/shared';
import type { TeamId } from '@counter-attack/shared';
import { teamAccentColor, useTeamAccentColor } from './useTeamColors.js';

const VALID_TEAM_ID = Object.keys(TEAM_CONFIGS)[0] as TeamId;

describe('teamAccentColor', () => {
  it('returns TEAM_CONFIGS[teamId].palette.uiColor for a valid teamId', () => {
    expect(teamAccentColor(VALID_TEAM_ID)).toBe(TEAM_CONFIGS[VALID_TEAM_ID].palette.uiColor);
  });
  ...
});
```

New `describe('deriveAaAccentColor', ...)` and `describe('useTeamAccentColorAA', ...)` blocks should follow the same style: import the new named exports alongside the existing ones (single import line, `.js` extension per repo's ESM convention), assert pass-through for already-AA-safe colors and adjustment for a known-failing color (e.g. a light gold like `#FEE500` from RESEARCH.md's contrast findings), and assert both directions (`bgHex`, `fgHex`) are satisfied post-adjustment.

---

### `packages/client/scripts/check-contrast.ts` (utility, CI script/batch)

**Analog:** `packages/shared/scripts/seed-rosters.ts`

**Imports/header-comment pattern** (lines 1-39):

```typescript
/**
 * Phase 16 D-01/D-02: One-time CSV -> teams.ts generator.
 * ...
 * Usage: pnpm run seed:rosters
 */
import { createReadStream, writeFileSync } from 'fs';
import { createInterface } from 'readline';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DATA_DIR = join(__dirname, '..', 'src', 'data');
const OUTPUT_PATH = join(__dirname, '..', 'src', 'teams.ts');
```

Follow this ESM `import.meta.url` + `fileURLToPath`/`dirname`/`join` idiom for locating `tokens.css` relative to the script (`packages/client/scripts/check-contrast.ts` → `../src/styles/tokens.css`), matching the header-comment convention (phase/decision ID + one-line `Usage:` note).

**Core pattern** — RESEARCH.md's Code Examples section gives the concrete token-extraction + contrast-check body to use (do not hand-roll — this is the exact code to place in the script):

```typescript
import { readFileSync } from 'fs';
import { hex } from 'wcag-contrast';
import { TEAM_CONFIGS } from '@counter-attack/shared';
import { deriveAaAccentColor } from '../src/hooks/useTeamColors.js'; // SAME fn as runtime, per Don't Hand-Roll

function extractToken(cssText: string, name: string): string {
  const match = cssText.match(new RegExp(`${name}:\\s*(#[0-9a-fA-F]{3,8})`));
  if (!match) throw new Error(`Token ${name} not found in tokens.css`);
  return match[1];
}

const tokensCss = readFileSync('src/styles/tokens.css', 'utf-8');
const bgPage = extractToken(tokensCss, '--color-bg-page');
const textInverse = extractToken(tokensCss, '--color-text-inverse');

let failed = false;
for (const teamId of Object.keys(TEAM_CONFIGS)) {
  const raw = TEAM_CONFIGS[teamId].palette.uiColor;
  const adjusted = deriveAaAccentColor(raw, bgPage, textInverse);
  if (hex(adjusted, bgPage) < 4.5 || hex(adjusted, textInverse) < 4.5) {
    console.error(`FAIL: ${teamId} (${adjusted}) does not clear AA`);
    failed = true;
  }
}
if (failed) process.exit(1);
```

**package.json script wiring** — mirror `seed-rosters.ts`'s `"seed:rosters": "tsx scripts/seed-rosters.ts"` entry pattern in `packages/shared/package.json`; add an equivalent `"check-contrast": "tsx scripts/check-contrast.ts"` in `packages/client/package.json`, and a root-level `pnpm --filter @counter-attack/client check-contrast` wiring if the root `package.json` exposes a flattened script alias for `knip` (check root `package.json` scripts block during planning for the exact aliasing convention).

---

### `stylelint.config.js` (config, root-level)

**Analog:** `eslint.config.js` (root-level ESM config precedent — read in full above)

**Pattern to follow** — root-level, ESM `export default`, ignoring `dist`/`node_modules`:

```javascript
// eslint.config.js precedent
import tseslint from 'typescript-eslint';
...
export default tseslint.config(
  ...
  {
    ignores: ['**/dist/**', '**/node_modules/**', '**/*.config.js', '**/*.config.ts', '.husky/**'],
  },
);
```

**Concrete content** — RESEARCH.md Pattern 2 gives the exact config to write (verified against upstream plugin README + the repo's confirmed-zero-existing-violations state):

```javascript
// stylelint.config.js
export default {
  extends: ['stylelint-config-standard'],
  plugins: ['stylelint-declaration-strict-value'],
  rules: {
    'scale-unlimited/declaration-strict-value': [
      ['/color$/', 'background', 'background-color', 'border-color', 'border', 'fill', 'stroke'],
      { ignoreValues: ['transparent', 'inherit', 'currentColor', 'none'] },
    ],
    'function-disallowed-list': ['rgb', 'rgba', 'hsl', 'hsla'],
  },
};
```

Scope note: no separate `files`/glob key needed inside the config itself — the CI invocation (`pnpm stylelint "packages/client/src/**/*.module.css"`) controls scope, matching how `eslint.config.js` uses a single flat config object rather than a files-array per rule-set (except its one `files: [...]` block for the client-only react-hooks rules, which is not needed here since this is a single ruleset for one glob).

---

### `.github/workflows/ci.yml` (config, CI pipeline)

**Analog:** itself — existing `pnpm knip` step (line 22)

**Exact existing step list to extend** (lines 20-25):

```yaml
- run: pnpm install --frozen-lockfile
- run: pnpm --filter @counter-attack/shared build
- run: pnpm knip
- run: pnpm -r typecheck
- run: pnpm -r test
- run: pnpm -r build
```

Add `- run: pnpm stylelint` and `- run: pnpm check-contrast` as new sibling `- run:` lines, following the exact same flat single-line-per-step convention (no `name:` keys used anywhere in this file — don't introduce them). Per RESEARCH.md's Sampling Rate / Pitfall 4, place `pnpm knip` after the new script file exists (order: install → shared build → knip → typecheck → test → build → stylelint → check-contrast, or interleave per planner's judgment — knip must succeed once `knip.json` is updated, since knip runs before the two new commands are even relevant).

---

### `knip.json` (config)

**Analog:** itself — existing `packages/shared` block (read in full above)

**Exact block to mirror** (lines 5-8):

```json
"packages/shared": {
  "entry": ["src/index.ts", "scripts/seed-rosters.ts"],
  "project": ["src/**/*.ts", "scripts/**/*.ts"]
}
```

**Current `packages/client` block to extend** (lines 13-16):

```json
"packages/client": {
  "entry": ["src/main.tsx", "index.html"],
  "project": ["src/**/*.{ts,tsx}"]
}
```

Add `"scripts/check-contrast.ts"` to `entry` and `"scripts/**/*.ts"` to `project`, following the shared-package block's exact key ordering and array-append style — do not restructure the JSON, only add array entries.

---

### `packages/client/src/components/GameBoard.tsx` (lines 178-228)

**Analog:** itself — existing `useTeamAccentColor` call sites (read in full above)

**Exact call sites to swap** (lines 180-181, 185):

```typescript
  // Canonical accent-color resolution (CLEANUP-02, D-04) — hook called in component body only,
  // never inside .map()/conditionals. homeColor/awayColor cover every home/away score/badge site.
  const homeColor = useTeamAccentColor(selectedTeams['home']);
  const awayColor = useTeamAccentColor(selectedTeams['away']);
  ...
  const teamColor = useTeamAccentColor(selectedTeams[activeTeam]);
```

And the CSS-var injection point (lines 217-228):

```typescript
  // THEME-03 (D-06): runtime per-view accent variables, injected once at the root.
  const rootStyle = {
    '--team-accent': teamColor,
    '--home-accent': homeColor,
    '--away-accent': awayColor,
  } as CSSProperties;

  return (
    <div className={styles.gameBoard} style={rootStyle}>
```

Change only the three call sites from `useTeamAccentColor` to `useTeamAccentColorAA`, and update the import line at the top of the file accordingly. Preserve the surrounding comment blocks' factual content, updating decision-ID references (D-04/THEME-03 language) to reflect this phase's THEME-04 change where accurate — do not touch `resultText`/`resultColor`/`rootStyle` structure otherwise. Do **not** apply this swap to `ActionLog.tsx`'s `teamAccentColor()` calls (raw, unadjusted — explicitly out of THEME-04 scope per D-04).

---

## Shared Patterns

### Root-level ESM config file convention

**Source:** `eslint.config.js`
**Apply to:** `stylelint.config.js`
Both are root-level, `export default`, ESM (repo's root `package.json` has `"type": "module"`), and both are excluded from the default TS project via `eslint.config.js`'s own `allowDefaultProject` entry (`'packages/*/scripts/*.ts'`) — the new `check-contrast.ts` script needs the same TS-project inclusion treatment (verify during planning whether `check-contrast.ts` needs an equivalent `allowDefaultProject` glob entry, since `packages/client/scripts/*.ts` is not currently covered by that array — only `packages/*/scripts/*.ts` which technically already matches `packages/client/scripts/*.ts` via the wildcard).

### CI step addition convention

**Source:** `.github/workflows/ci.yml` (existing `pnpm knip` line)
**Apply to:** new `pnpm stylelint` and `pnpm check-contrast` steps
Flat `- run: <command>` lines, no `name:` keys, appended in the existing sequential list — mirrors how `pnpm knip` itself was added as a single-line step alongside `pnpm -r typecheck`/`pnpm -r test`/`pnpm -r build`.

### knip entry/project registration convention

**Source:** `knip.json`'s `packages/shared` block (`scripts/seed-rosters.ts` + `scripts/**/*.ts`)
**Apply to:** `packages/client` block, for the new `scripts/check-contrast.ts`
Exact same two-array-key pattern (`entry` gets the specific file, `project` gets the glob) — this is a proven, already-working precedent in this exact repo for exactly this "new CI-only script" scenario (RESEARCH.md Pitfall 4).

### Single-derivation-function-two-call-sites convention

**Source:** `packages/client/src/hooks/useTeamColors.ts`'s existing `teamAccentColor`/`useTeamAccentColor` pure-fn + hook-wrapper pairing
**Apply to:** new `deriveAaAccentColor`/`useTeamAccentColorAA` pairing
The existing file already establishes the "pure function + thin hook wrapper with identical behavior, hook only for call-site naming consistency" idiom — the new functions should follow this exact structural pairing rather than inventing a new shape (e.g. no `useMemo`, no store subscription — `TEAM_CONFIGS` and the token file are both static).

## No Analog Found

None. All 8 files identified from CONTEXT.md/RESEARCH.md have a strong same-repo analog (5 are direct edits to the same file, 3 are new files with a clear structural precedent already in the codebase).

## Metadata

**Analog search scope:** `packages/client/src/hooks/`, `packages/client/src/styles/`, `packages/client/src/components/GameBoard.tsx`, `packages/shared/scripts/`, `.github/workflows/`, root-level config files (`eslint.config.js`, `knip.json`)
**Files scanned:** 8 target files + 5 analog source files (`useTeamColors.ts`, `useTeamColors.test.ts`, `tokens.css`, `seed-rosters.ts`, `eslint.config.js`, `ci.yml`, `knip.json`, `GameBoard.tsx` excerpt)
**Pattern extraction date:** 2026-07-26
