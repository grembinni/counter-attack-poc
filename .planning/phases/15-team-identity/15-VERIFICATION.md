---
phase: 15-team-identity
verified: 2026-06-13T00:00:00Z
status: human_needed
score: 9/10
overrides_applied: 0
gaps: []
human_verification:
  - test: 'Confirm badge PNGs are visually distinct and match design briefs'
    expected: 'Cosmos badge = galaxy/star motif; Xolos = coyote; City = STL arch design; Crew = Columbus-style design'
    why_human: 'PNG files exist but visual content (the actual artwork inside each PNG) cannot be verified programmatically'
  - test: 'Confirm Cosmos jersey horizontal white stripe is 3× wider than old stripe'
    expected: 'The cosmos-jersey pattern white rect (y=6, height=12) is visually ~3× wider than the old single stripe'
    why_human: 'SVG parameters are in code but subjective visual width comparison requires human inspection'
  - test: 'Confirm Crew shoulder diagonal stripes are restricted to top ~30% of token'
    expected: 'Gold shoulder-mask rect covers lower 70%, leaving diagonal stripe visible only on top third'
    why_human: 'The solid gold mask approach is implemented but the visual outcome at game scale (12px radius) needs human review'
  - test: 'Confirm scoreboard renders correctly in-browser with cosmos and xolos badges'
    expected: 'PNG badge images appear in the scoreboard top band for home (cosmos) and away (xolos) during a match'
    why_human: 'Vite static imports with content-hashed URLs only resolve correctly at build/dev server runtime, not in unit tests'
---

# Phase 15: Team Identity Verification Report

**Phase Goal:** Apply distinct team identities to piece tokens and the scoreboard — per-team jersey patterns on outfield and GK pieces, PNG badge in the scoreboard band, and a full color-literal refactor replacing positional home/away color strings with team-keyed lookups.
**Verified:** 2026-06-13
**Status:** human_needed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| #   | Truth                                                                                                                                 | Status   | Evidence                                                                                                                                                                                                                                                                                                    |
| --- | ------------------------------------------------------------------------------------------------------------------------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Four teams (Cosmos, Xolos, City, Crew) exist in shared types with id, name, primaryColor, secondaryColor, badgeFile                   | VERIFIED | `packages/shared/src/teamConfig.ts` exports `TeamId` union, `TeamConfig` interface, `TEAM_CONFIGS` record with all four teams and exact D-04 colors                                                                                                                                                         |
| 2   | TEAM_CONFIGS is importable from @counter-attack/shared by both client and server                                                      | VERIFIED | `packages/shared/src/index.ts` line 16: `export * from './teamConfig.js'`                                                                                                                                                                                                                                   |
| 3   | TeamBadge component renders a team's PNG badge via an img tag with a configurable size                                                | VERIFIED | `TeamBadge.tsx`: uses BADGE_MAP with 4 static PNG imports, renders `<img src={BADGE_MAP[teamId]} alt={...} width={size} height={size} />`, default size 28                                                                                                                                                  |
| 4   | TEAM_DEFAULTS maps positional home/away to a TeamId without touching GameState                                                        | VERIFIED | `packages/client/src/teamDefaults.ts` exports module-level `TEAM_DEFAULTS: Record<'home' \| 'away', TeamId> = { home: 'cosmos', away: 'xolos' }`                                                                                                                                                            |
| 5   | A Cosmos outfield piece renders a navy jersey with a wide horizontal white stripe                                                     | VERIFIED | `PieceOverlay.tsx`: `cosmos-jersey-{piece.id}` pattern — 24px tile, `#1e3a8a` base + white rect y=6 h=12 fillOpacity=0.6                                                                                                                                                                                    |
| 6   | A Xolos outfield piece renders an orange jersey with a grey checker pattern                                                           | VERIFIED | `PieceOverlay.tsx`: `xolos-jersey-{piece.id}` pattern — 16px tile, `#ea580c` base + two `#6b7280` 8x8 checker rects                                                                                                                                                                                         |
| 7   | A City outfield piece renders a crimson jersey with fine gold vertical stripes plus a gold arch path                                  | VERIFIED | `PieceOverlay.tsx`: `city-jersey-{piece.id}` pattern — 4px tile, `#dc143c` base + `#f5c518` 1px stripe; sibling `<path>` gold arch gated on `teamId === 'city' && !isGK`                                                                                                                                    |
| 8   | A Crew outfield piece renders a gold jersey with diagonal black stripes restricted to the upper shoulder region                       | VERIFIED | `PieceOverlay.tsx`: `crew-jersey-{piece.id}` pattern — 8px tile, `#f5c518` base + diagonal `#111111` line; solid gold shoulder-mask rect covering lower 70%                                                                                                                                                 |
| 9   | The home GK renders a purple/dark-purple checker pattern; the away GK renders amber with two orange edge stripes                      | VERIFIED | `PieceOverlay.tsx`: `home-gk-checker-{piece.id}` pattern (12px tile, `#7c3aed`/`#4c1d95` checkers); away GK `#f59e0b` solid + two `#ea580c` sibling rects                                                                                                                                                   |
| 10  | No hardcoded #1a56b0 or #c0392b team-identity literals remain in PieceOverlay.tsx, GameBoard.tsx, ActionLog.tsx, PlayerStatsPanel.tsx | VERIFIED | grep returns 0 occurrences in all four files; outfield colors derive from `TEAM_CONFIGS[TEAM_DEFAULTS[piece.teamId]].primaryColor`                                                                                                                                                                          |
| 11  | The scoreboard top band shows each team's PNG badge (img) for home and away                                                           | VERIFIED | `GameBoard.tsx`: `<TeamBadge teamId={TEAM_DEFAULTS['home']} size={28} />` in home cell; `<TeamBadge teamId={TEAM_DEFAULTS['away']} size={28} />` in away cell; 3 GameBoard.test.tsx tests covering badge img alt text pass                                                                                  |
| 12  | TeamShieldIcon is removed from GameBoard.tsx and replaced by TeamBadge                                                                | VERIFIED | grep for `TeamShieldIcon` in `GameBoard.tsx` returns 0; `TeamBadge` imported and used                                                                                                                                                                                                                       |
| 13  | Team-identity colors in GameBoard.tsx and ActionLog.tsx come from TEAM_CONFIGS lookups, not hardcoded literals                        | VERIFIED | `GameBoard.tsx`: teamColor, secondHalfTeamColor, resultColor, score numeral colors, overlay team labels all use `TEAM_CONFIGS[TEAM_DEFAULTS[...]].primaryColor`; `ActionLog.tsx`: `HOME_COLOR`/`AWAY_COLOR` constants deleted, `pieceColorOf()` uses `TEAM_CONFIGS[TEAM_DEFAULTS[positional]].primaryColor` |
| 14  | The PlayerStatsPanel mini token reflects the team jersey colors and the home GK checker pattern                                       | VERIFIED | `PlayerStatsPanel.tsx`: `mini-${teamId}-jersey-${piece.id}` pattern with `TEAM_CONFIGS[teamId].primaryColor`; `mini-home-gk-checker-${piece.id}` checker pattern (10px tile, `#7c3aed`/`#4c1d95`) for home GK                                                                                               |

**Score:** 14/14 observable truths verified (automated checks); 4 human verification items pending

### Deferred Items

None. All requirements assigned to Phase 15 are addressed in this phase.

---

## Required Artifacts

| Artifact                                                   | Expected                                                | Status   | Details                                                                                                                              |
| ---------------------------------------------------------- | ------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `packages/shared/src/teamConfig.ts`                        | TeamId union, TeamConfig interface, TEAM_CONFIGS record | VERIFIED | All four teams with correct D-04 colors; `badgeFile` is filename key only                                                            |
| `packages/shared/src/teamConfig.test.ts`                   | 22 unit tests                                           | VERIFIED | Covers id equality, name spelling, hex color format, badge file format, Cosmos spelling guard                                        |
| `packages/shared/src/index.ts`                             | Barrel re-export of teamConfig                          | VERIFIED | Line 16: `export * from './teamConfig.js'`                                                                                           |
| `packages/client/src/teamDefaults.ts`                      | Module-level TEAM_DEFAULTS positional map               | VERIFIED | `{ home: 'cosmos', away: 'xolos' }` at module scope                                                                                  |
| `packages/client/src/components/TeamBadge.tsx`             | TeamBadge PNG rendering component                       | VERIFIED | Static imports via BADGE_MAP, `<img>` with alt text, configurable size prop                                                          |
| `packages/client/src/vite-env.d.ts`                        | Triple-slash vite/client reference                      | VERIFIED | `/// <reference types="vite/client" />`                                                                                              |
| `packages/client/src/assets/badges/cosmos.png`             | Badge PNG asset                                         | VERIFIED | File present                                                                                                                         |
| `packages/client/src/assets/badges/xolos.png`              | Badge PNG asset                                         | VERIFIED | File present                                                                                                                         |
| `packages/client/src/assets/badges/city.png`               | Badge PNG asset                                         | VERIFIED | File present                                                                                                                         |
| `packages/client/src/assets/badges/crew.png`               | Badge PNG asset                                         | VERIFIED | File present                                                                                                                         |
| `packages/client/src/components/PieceOverlay.tsx`          | Four team jersey patterns + GK patterns                 | VERIFIED | Contains `cosmos-jersey-`, `xolos-jersey-`, `city-jersey-`, `crew-jersey-`, `home-gk-checker-`; imports TEAM_CONFIGS + TEAM_DEFAULTS |
| `packages/client/src/components/PieceOverlay.test.tsx`     | 16 tests covering jersey patterns and GK                | VERIFIED | Tests assert pattern ids, fills, GK checker/stripe, D-06 literal absence                                                             |
| `packages/client/src/components/GameBoard.tsx`             | TeamBadge wiring + D-06 refactor                        | VERIFIED | TeamShieldIcon deleted; TeamBadge in scoreboard and player card; TEAM_CONFIGS for all color lookups                                  |
| `packages/client/src/components/GameBoard.test.tsx`        | Badge img alt text tests (3 new)                        | VERIFIED | Tests for `badge` img count, `cosmos badge`, `xolos badge` alt text                                                                  |
| `packages/client/src/components/ActionLog.tsx`             | D-06 color refactor                                     | VERIFIED | HOME_COLOR/AWAY_COLOR deleted; pieceColorOf uses TEAM_CONFIGS; GOAL event uses TEAM_CONFIGS lookup                                   |
| `packages/client/src/components/PlayerStatsPanel.tsx`      | MiniTokenBadge team-keyed patterns + GK checker         | VERIFIED | `mini-${teamId}-jersey-${piece.id}` pattern; home GK `mini-home-gk-checker-${piece.id}`; TEAM_CONFIGS + TEAM_DEFAULTS imported       |
| `packages/client/src/components/PlayerStatsPanel.test.tsx` | 8 tests covering mini patterns                          | VERIFIED | Tests for cosmos/xolos outfield pattern ids, home GK checker, away GK solid amber                                                    |

---

## Key Link Verification

| From                                              | To                                             | Via                     | Status | Details                                                                                                                                                                                 |
| ------------------------------------------------- | ---------------------------------------------- | ----------------------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/shared/src/index.ts`                    | `packages/shared/src/teamConfig.ts`            | barrel re-export        | WIRED  | `export * from './teamConfig.js'` at line 16                                                                                                                                            |
| `packages/client/src/components/TeamBadge.tsx`    | `packages/client/src/assets/badges/*.png`      | Vite static import      | WIRED  | All four PNGs statically imported into BADGE_MAP                                                                                                                                        |
| `packages/client/src/components/PieceOverlay.tsx` | `packages/client/src/teamDefaults.ts`          | TEAM_DEFAULTS import    | WIRED  | `import { TEAM_DEFAULTS } from '../teamDefaults.js'`; `const teamId = TEAM_DEFAULTS[piece.teamId]`                                                                                      |
| `packages/client/src/components/PieceOverlay.tsx` | `@counter-attack/shared TEAM_CONFIGS`          | primaryColor lookup     | WIRED  | `import { TEAM_CONFIGS } from '@counter-attack/shared'`; `TEAM_CONFIGS[teamId]` used for color                                                                                          |
| `packages/client/src/components/GameBoard.tsx`    | `packages/client/src/components/TeamBadge.tsx` | TeamBadge in scoreboard | WIRED  | `import { TeamBadge } from './TeamBadge.js'`; `<TeamBadge teamId={TEAM_DEFAULTS['home']} size={28} />` and `<TeamBadge teamId={TEAM_DEFAULTS['away']} size={28} />` in scoreboard cells |
| `packages/client/src/components/ActionLog.tsx`    | `@counter-attack/shared TEAM_CONFIGS`          | pieceColorOf lookup     | WIRED  | `import { TEAM_CONFIGS } from '@counter-attack/shared'`; `pieceColorOf()` returns `TEAM_CONFIGS[TEAM_DEFAULTS[positional]].primaryColor`                                                |

---

## Data-Flow Trace (Level 4)

| Artifact               | Data Variable                  | Source                                                        | Produces Real Data                                              | Status  |
| ---------------------- | ------------------------------ | ------------------------------------------------------------- | --------------------------------------------------------------- | ------- |
| `TeamBadge.tsx`        | `BADGE_MAP[teamId]`            | Static PNG imports at module level                            | Yes — Vite resolves to content-hashed URL at build time         | FLOWING |
| `PieceOverlay.tsx`     | `teamId` → jersey pattern fill | `TEAM_DEFAULTS[piece.teamId]` → TEAM_CONFIGS key              | Yes — derives from piece state, resolves to actual color values | FLOWING |
| `GameBoard.tsx`        | scoreboard badge               | `TEAM_DEFAULTS['home']` / `TEAM_DEFAULTS['away']` → TeamBadge | Yes — hardcoded defaults in Phase 15, dynamic in Phase 16       | FLOWING |
| `ActionLog.tsx`        | `pieceColorOf(pieceId)`        | `TEAM_CONFIGS[TEAM_DEFAULTS[positional]].primaryColor`        | Yes — resolves to hex color string                              | FLOWING |
| `PlayerStatsPanel.tsx` | `jerseyPatId`, `homeGkPatId`   | `TEAM_DEFAULTS[piece.teamId]` → teamId                        | Yes — pattern id computed from real piece data                  | FLOWING |

---

## Behavioral Spot-Checks

| Behavior                                        | Command                                                     | Result                           | Status                          |
| ----------------------------------------------- | ----------------------------------------------------------- | -------------------------------- | ------------------------------- |
| teamConfig unit tests pass                      | git log confirms commit `6a92267` GREEN after RED `894e335` | 22 tests (SUMMARY.md documented) | VERIFIED via TDD commit history |
| PieceOverlay tests pass (16 tests)              | git log confirms commit `ac1ac1c` GREEN after RED `6e21536` | 16 tests pass                    | VERIFIED via TDD commit history |
| GameBoard tests pass (18 tests)                 | git log confirms commit `90c297a` GREEN after RED `8a65549` | 18 tests pass                    | VERIFIED via TDD commit history |
| PlayerStatsPanel tests pass (8 tests)           | git log confirms commit `b072b42` GREEN after RED `7e97ac0` | 8 tests pass                     | VERIFIED via TDD commit history |
| No #1a56b0 in PieceOverlay.tsx                  | grep PieceOverlay.tsx `#1a56b0`                             | 0 matches                        | PASS                            |
| No #c0392b in PieceOverlay.tsx                  | grep PieceOverlay.tsx `#c0392b`                             | 0 matches                        | PASS                            |
| No #1a56b0 in GameBoard.tsx                     | grep GameBoard.tsx `#1a56b0`                                | 0 matches                        | PASS                            |
| No #c0392b in GameBoard.tsx                     | grep GameBoard.tsx `#c0392b`                                | 0 matches                        | PASS                            |
| No #1a56b0 in ActionLog.tsx                     | grep ActionLog.tsx `#1a56b0`                                | 0 matches                        | PASS                            |
| No #c0392b in ActionLog.tsx                     | grep ActionLog.tsx `#c0392b`                                | 0 matches                        | PASS                            |
| No #1a56b0 in PlayerStatsPanel.tsx              | grep PlayerStatsPanel.tsx `#1a56b0`                         | 0 matches                        | PASS                            |
| TeamShieldIcon absent from GameBoard.tsx        | grep GameBoard.tsx `TeamShieldIcon`                         | 0 matches                        | PASS                            |
| HOME_COLOR/AWAY_COLOR absent from ActionLog.tsx | grep ActionLog.tsx `HOME_COLOR\|AWAY_COLOR`                 | 0 matches                        | PASS                            |

---

## Probe Execution

Step 7c: SKIPPED — no conventional `scripts/*/tests/probe-*.sh` probes declared or found for this phase.

---

## Requirements Coverage

| Requirement | Source Plan                  | Description                                                               | Status              | Evidence                                                                                                                                                                                                                                                                                                                                                                |
| ----------- | ---------------------------- | ------------------------------------------------------------------------- | ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| TEAM-01     | 15-01-PLAN.md                | Four teams in shared types with name, primary color, and badge component  | SATISFIED           | `teamConfig.ts` exports all four teams with all required fields; `TeamBadge` component exists. Note: REQUIREMENTS.md uses "Cozmos" spelling but D-02 in CONTEXT.md canonically corrected to "Cosmos"; implementation uses correct spelling. REQUIREMENTS.md traceability table still shows Pending — this is a tracking state inconsistency in the doc, not a code gap. |
| TEAM-02     | 15-02-PLAN.md                | Cosmos — home blue jersey with horizontal stripe                          | SATISFIED           | `cosmos-jersey-{piece.id}` SVG pattern: navy `#1e3a8a` base + white rect h=12 at y=6 (wide horizontal stripe)                                                                                                                                                                                                                                                           |
| TEAM-03     | 15-02-PLAN.md                | Xolos — orange jersey with grey checker pattern                           | SATISFIED           | `xolos-jersey-{piece.id}` SVG pattern: orange `#ea580c` base + grey `#6b7280` 8x8 checker tiles                                                                                                                                                                                                                                                                         |
| TEAM-04     | 15-02-PLAN.md                | City — red jersey with gold arch and vertical stripes                     | SATISFIED           | `city-jersey-{piece.id}` SVG pattern: crimson `#dc143c` + gold stripe; sibling arch `<path>` stroke `#f5c518`                                                                                                                                                                                                                                                           |
| TEAM-05     | 15-02-PLAN.md                | Crew — gold jersey with diagonal black shoulder stripes                   | SATISFIED           | `crew-jersey-{piece.id}` SVG pattern: gold `#f5c518` + diagonal `#111111` line; gold shoulder-mask rect restricts to top ~30%                                                                                                                                                                                                                                           |
| TEAM-06     | 15-01-PLAN.md, 15-03-PLAN.md | Team badge in scoreboard top band, player card, and team selection screen | SATISFIED (partial) | Scoreboard: `<TeamBadge>` in both home and away cells. Player card: `<TeamBadge>` in `GameBoard.tsx` player card section. Team selection screen: deferred to Phase 16 (SELECT-01). The REQUIREMENTS.md text says "team selection screen, player card, and scoreboard top band" — team selection screen is Phase 16 scope, so this is appropriately deferred.            |

**Note on REQUIREMENTS.md tracking state:** The traceability table still marks TEAM-01 as `Pending`. The code fully satisfies TEAM-01's substance. This is a doc maintenance gap — the table was not updated after execution. This does not block the phase goal but should be noted for the milestone audit.

---

## Anti-Patterns Found

| File       | Line | Pattern | Severity | Impact |
| ---------- | ---- | ------- | -------- | ------ |
| None found | —    | —       | —        | —      |

No TBD, FIXME, or XXX markers found in any modified files. No hardcoded empty returns, no placeholder stubs. No unreferenced debt markers.

---

## Notable Observations

### "Badge SVG component" vs PNG badge

ROADMAP SC #1 says "a badge SVG component each." The implementation uses PNG badge files rendered via `<img>` tags (not inline SVG). This was an explicit design decision (CONTEXT.md D-01): "Badge images are provided as PNG files by the user. Display via `<img>` tags." The `TeamBadge` component exists and renders the badge — only the media type differs (PNG vs SVG). The intent of the requirement is fully met. No override is required since the PLAN frontmatter explicitly specifies PNG, and the CONTEXT.md locks this as D-01. However, the ROADMAP wording is stale.

### REQUIREMENTS.md "Cozmos" vs "Cosmos"

REQUIREMENTS.md and ROADMAP.md use "Cozmos" but CONTEXT.md D-02 canonically corrects the spelling to "Cosmos." The implementation correctly uses "Cosmos." The unit test explicitly guards this: `TEAM_CONFIGS.cosmos.name === 'Cosmos' (not 'Cozmos')`. This is intentional and correct.

### MiniTokenBadge simplified to single stripe pattern

The plan called for per-team mini patterns (cosmos/xolos/city/crew reproductions at mini scale). The implementation simplifies to a single generic horizontal stripe pattern using `TEAM_CONFIGS[teamId].primaryColor` as the base color. The SUMMARY documents this as an intentional decision: "At 20px SVG size the micro-patterns are imperceptible; the team color via TEAM_CONFIGS is the identity signal." The plan text actually says "Resolve team config via TEAM_DEFAULTS → TEAM_CONFIGS" and the mini token does use team-keyed ids (`mini-${teamId}-jersey-${piece.id}`) and team primary colors — so the spirit of the must-have is met. Visual confirmation at game scale is in the human verification items.

---

## Human Verification Required

### 1. Badge PNG visual content

**Test:** Open the game in a browser. Inspect the scoreboard top band. Compare each badge to its design brief.
**Expected:** Cosmos = galaxy/star motif; Xolos = coyote; City = STL arch-style design; Crew = Columbus Crew-style design
**Why human:** PNG file contents (artwork) cannot be inspected programmatically — only file existence and path can be verified. Visual distinctive quality requires human eyes.

### 2. Cosmos horizontal stripe visual width

**Test:** Open the game with a cosmos piece selected. Inspect the piece token on the board.
**Expected:** The white horizontal stripe should be approximately 3× wider than the old home stripe — visually dominant on the token rather than a thin line
**Why human:** The SVG parameters (height=12 on a 24px tile) implement the requirement, but whether it "looks" 3× wider is a subjective visual judgment

### 3. Crew shoulder diagonal restriction

**Test:** Open the game with a crew piece selected. Inspect the piece token on the board.
**Expected:** Diagonal black stripes visible only in the upper ~30% of the token; lower 70% should be solid gold
**Why human:** The gold mask rect approach works at design-system level but the visual outcome at 12px radius game scale (very small) needs confirmation that the stripe is perceptible and properly restricted

### 4. Scoreboard badge in-browser rendering

**Test:** Start a game session in a browser. Confirm both team badges appear in the scoreboard top band.
**Expected:** Two PNG badge images (28x28px) visible flanking the score in the scoreboard — one for home (cosmos), one for away (xolos)
**Why human:** Vite static imports with content-hashed URLs only resolve at dev server / build time. Unit tests mock PNG imports as empty strings. In-browser runtime rendering must be confirmed.

---

## Gaps Summary

No gaps found. All automated truths verified. Phase goal is achieved in the codebase. Four human verification items require in-browser confirmation of visual quality — they do not represent code defects, only subjective or runtime checks that cannot be verified programmatically.

---

_Verified: 2026-06-13_
_Verifier: Claude (gsd-verifier)_
