# Pitfalls Research

**Domain:** Large-scale visual/theme refactor + code cleanup on an already-shipped, test-covered, real-time multiplayer web game (React 18 + Vite + Zustand client; Node/Express + Socket.io server; pnpm monorepo)
**Researched:** 2026-07-22
**Confidence:** HIGH (all findings grounded in direct inspection of this repository's source and tests — see file/line citations in each pitfall)

> Supersedes the v1.0-era generic multiplayer/AWS pitfalls previously in this file (Socket.io listener leaks, ALB timeouts, hex-coordinate choice, etc.) for the purposes of the v1.5 "visual refresh + cleanup" milestone. Those v1.0 concerns are already resolved in the shipped codebase (server-authoritative FSM, pure `gameEngine.ts`, cube-coordinate hex math) and are not re-litigated here; this file is scoped to the specific risks of a theme/highlight/cleanup pass on top of that already-shipped system.

## Critical Pitfalls

### Pitfall 1: Literal-color test assertions break en masse when a design-token layer is introduced

**What goes wrong:**
The client test suite asserts directly on literal color strings (hex codes and `rgba(...)`), not on semantic identifiers. `HexCell.test.tsx` alone has 17 assertions like `expect(fills).toContain('rgba(220,50,50,1)')`. Across `HexCell.test.tsx`, `HexGrid.test.tsx`, `PieceOverlay.test.tsx`, and `PlayerStatsPanel.test.tsx` there are **60 literal-color assertions total**. If the theme work replaces raw values in `HIGHLIGHT_STYLES` (in `packages/client/src/components/HexCell.tsx`) or in `PieceOverlay.tsx`'s ring colors (`#60a5fa`, `#22c55e`, `#f97316`, `#dc2626`) with token references, all 60 assertions fail simultaneously in one commit — a "big bang" test rewrite that makes it hard to tell a real regression from an expected value-string change.

**Why it happens:**
The tests were written to verify a value (`HIGHLIGHT_STYLES.goal.fill === 'rgba(220,50,50,1)'`) rather than a semantic contract (`HIGHLIGHT_STYLES.goal` renders as the "goal" role, whatever color that role currently maps to). This is because `HIGHLIGHT_STYLES` today is itself the terminal source of truth — there is no indirection layer between "highlight type" and "literal color" for the tests to assert against instead.

**How to avoid:**
Before touching any color value, refactor the _lookup_, not the values: introduce a design-token module (e.g., `packages/client/src/theme/colors.ts` or a shared `THEME_TOKENS` table) and have `HIGHLIGHT_STYLES`, `PieceOverlay`'s ring colors, and CSS modules reference token names. Update the existing tests in the _same_ commit to assert against the token's exported value (`HIGHLIGHT_STYLES.goal.fill === THEME_TOKENS.dangerRed` or similar) instead of a literal string, so the test still encodes "goal renders as the red/danger role" without being tied to the literal RGB. This converts the tests from a liability into the exact regression guard needed once the palette actually changes — do this refactor-the-assertion step _before_ changing any visual value, as its own reviewable commit, so the "tests broke because we changed how they assert" commit is separated from and precedes "tests broke because the palette changed."

**Warning signs:**

- Grep for `rgba(` and `#[0-9a-fA-F]{3,6}` in `*.test.tsx` returns non-trivial matches before starting (already confirmed: 4 files, 60 occurrences).
- A palette-value commit's diff touches test files only to update expected strings, with no change to test _intent_ — a sign the tests were re-baselined rather than re-architected.

**Phase to address:**
Design-token / theme-foundation phase, as the first plan (before any component restyling plan). Treat "tests assert on token identity, not literal value" as an explicit exit criterion for that plan.

---

### Pitfall 2: The "goal-line shot target" vs. "offside" red collision is two colors in two different DOM layers, not one shared constant — fixing it naively risks widening the collision or breaking the game's own visual language

**What goes wrong:**
The described red/red collision is real but is **not a single duplicated value** — it is two independently-defined reds in two different rendering layers:

- `HIGHLIGHT_STYLES.goal.fill = 'rgba(220,50,50,1)'` — a hex-tint polygon overlay (`HexCell.tsx`), used for goal-line shot targets (positive: "you may shoot here").
- `isOffside` ring `stroke="#dc2626"` — a piece-level SVG ring (`PieceOverlay.tsx`), used for an illegal-position warning (negative: "this piece is offside").

Because they live in different components with different rendering roles (hex-fill vs. piece-ring), a search for "the red color" only finds one instance unless both files are checked. A naive fix (e.g., "just make offside orange") changes only the piece-ring red without auditing whether red is _also_ used elsewhere with the same "danger/stop" semantic that the physical board's rulebook and player intuition already associate with red (offside flag, danger zone). Conversely, recoloring the _goal_ highlight instead breaks an established "red = you can act here (shoot)" cue that has shipped since Phase 12 (v1.1) per the retrospective ("unified 5-type hex highlight system risk/goal/safe/kickoff/shot-path").

**Why it happens:**
Color meaning was assigned locally, component-by-component, with no central semantic registry mapping "role" (danger, warning, actionable-target, safe, neutral-info) to color. Two developers (or two phases) independently reached for red for two different roles because nothing recorded that red was already spoken for.

**How to avoid:**
Before recoloring anything, build a one-page semantic-role table enumerating every existing use of every color by _meaning_, not by hex value — e.g.: red = {goal-target (positive/actionable), offside (negative/illegal), risk/steal-danger (uses orange today, not red — confirm no drift)}, gold/`#f5c518` = {brand/room-code, kickoff centre-hex marker, header ball-position marker, confirmed-pass-target ring — already 4 unrelated meanings sharing one hex value, per the explicit comment in `GameSettingsScreen.module.css`: _"gold (#f5c518) reserved for brand/room-code, NOT used here"_}. Resolve the offside/goal collision by giving offside a **new, currently-unused hue** (do not reuse orange — it already means "risk/tackle-danger" via `HIGHLIGHT_STYLES.risk` and `.hexTackleRisk`) rather than recoloring the goal highlight, since goal-target red is the older, more load-bearing convention (shipped in v1.1) and offside is the newer addition (v1.3). Validate the choice against the physical rulebook's own color conventions if the rulebook uses a marker color for offside, to avoid contradicting players' physical-board intuition.

**Warning signs:**

- Any color token named generically (`red`, `danger`) rather than by role (`goalTargetRed`, `offsideWarningRed`) — a sign meanings are being merged that shouldn't be.
- A new token that collapses two previously-distinguishable colors (e.g., risk-orange and offside-red both mapped to a single "warning" token) — check that hue, not just token name, stays distinct per role.

**Phase to address:**
Highlight-system standardization phase, specifically before implementing the new "ball location" highlight (which needs its own unused color/marker style, not a rehash of existing gold).

---

### Pitfall 3: "10 highlight types" undercounts the real surface — several highlight colors are raw inline JSX polygons that never go through `HIGHLIGHT_STYLES`, so a token sweep of the lookup table alone will miss them

**What goes wrong:**
`HexCell.tsx`'s `HIGHLIGHT_STYLES` table only declares **7** types (`safe`, `risk`, `goal`, `kickoff`, `shot-path`, `shot-path-action`, `header-target`). But `HexGrid.tsx` independently renders several more highlight colors as raw `<polygon fill="rgba(...)".../>` elements that bypass `HIGHLIGHT_STYLES` entirely:

- GK_KICK_TARGET sky-blue `rgba(56,189,248,0.30)` (~line 601-610)
- QUICK_THROW green `rgba(34,197,94,0.35)` (~line 611-621)
- Safe pass-target green `rgba(34,197,94,0.4)` (~line 622-631)
- Interception-risk amber via CSS module class `styles.hexTackleRisk` → `rgba(255,140,0,0.55)` defined separately in `HexGrid.module.css` (a _third_, independent definition of "risk orange" alongside `HIGHLIGHT_STYLES.risk`'s `rgba(255,140,0,1)` fill)
- Confirmed-pass-target gold ring `#f5c518` (no fill, stroke only)
- Centre-hex gold fill + ring `#f5c518` (KICK_OFF_SETUP)
- HEADER-phase ball-position gold overlay `#f5c518`

If "standardize the highlight system" is scoped as "edit `HIGHLIGHT_STYLES`," these 6-7 ad-hoc cases are silently left un-migrated, producing a codebase where _some_ highlights use the new token system and others still hardcode the old palette — the opposite of the goal.

**Why it happens:**
`HIGHLIGHT_STYLES` was introduced (per its own code comment, "D-10") to replace free-form props for the _original_ 5-7 highlight types, but later phases (GK_KICK_TARGET, QUICK_THROW, pass-target flows, kickoff centre-hex) added new highlight needs directly inline rather than extending the table — likely because those were added phase-by-phase under time pressure without a mandate to route through the shared lookup.

**How to avoid:**
Before writing any token, grep `HexGrid.tsx` and `HexGrid.module.css` for every `fill="rgba(` / `fill="#` / `stroke="#` / CSS-module-based fill and enumerate all of them (this research already surfaced ~7 beyond the 7 formal `HexHighlightType`s — treat 13-14 as the real starting count, matching the "10+" figure in scope). Extend `HexHighlightType`/`HIGHLIGHT_STYLES` to cover every one of them (including the new "ball location" highlight) so there is exactly one lookup table and zero raw inline color literals left in `HexGrid.tsx`'s hex-rendering branch. Add a lint-style check (even a simple test that scans the rendered HexGrid output, or a code comment convention) asserting new highlight needs must add a `HexHighlightType` member rather than an inline `fill=`.

**Warning signs:**

- Any `fill=` or `stroke=` attribute value in `HexGrid.tsx` that is a literal string rather than `HIGHLIGHT_STYLES[x].fill` — after the phase, this pattern should not exist.
- Two independent-looking definitions producing the same visual hue (e.g., `HIGHLIGHT_STYLES.risk` and `.hexTackleRisk` both being "the orange risk color" but defined in two files) — a sign the token sweep missed a spot.

**Phase to address:**
Highlight-system standardization phase — should be scoped explicitly against "all hex-tint rendering paths in `HexGrid.tsx`/`HexGrid.module.css`," not just the `HIGHLIGHT_STYLES` object, with the "ball location" highlight designed alongside this full inventory (not bolted onto the pre-existing 7-entry table in isolation).

---

### Pitfall 4: Dynamic CSS-module class lookup (`styles[colorClass]`) is invisible to naive dead-code search and will not survive a careless cleanup pass

**What goes wrong:**
`GameSettingsScreen.tsx`, `TeamSelectionScreen.tsx`, and `UniformSelectionScreen.tsx` compute CSS-module class names at runtime via bracket notation: `` `${styles.speedOptionActive} ${styles[colorClass]}` ``, where `colorClass` is a string (`'speedColorSlow'`/`'speedColorStandard'`/`'speedColorFast'`) sourced from `packages/client/src/constants/speedOptions.ts`. There is **no static text `styles.speedColorSlow` anywhere in the `.tsx` files** — only the string literal in the constants table and the CSS class definitions in each component's `.module.css`. A grep-based "is this class used?" check (or a human doing manual dead-code review) will find zero static references to `.speedColorSlow`/`.speedColorFast` in the component code and may conclude they're dead and delete them, silently breaking the speed-picker color coding at runtime with no compile-time or type error (CSS Modules' generated types, if any, don't validate bracket-accessed keys).

**Why it happens:**
CSS Modules import as a plain object; TypeScript does not (by default) type-check that `colorClass` is a valid key of `styles`, so bracket access compiles cleanly even if the class doesn't exist, and removing the class doesn't produce a build error — only a silent visual regression (missing color, default cursor/border) that a snapshot-less test suite (no `toHaveClass`/CSS-based test assertions currently exist in this repo) won't catch either.

**How to avoid:**
Before removing _any_ CSS-module class during cleanup, grep specifically for the class name as a **string literal** across the whole `packages/client/src` tree (not just as a `styles.X` dot-reference) — e.g. `grep -rn "speedColorSlow"` — to catch bracket-notation and data-table references. Treat any class referenced from a shared constants file (`speedOptions.ts` and similarly-shaped tables) as a "referenced-by-data" class, not dead code, even with zero static `styles.foo` hits. Since `TeamSelectionScreen.module.css`, `UniformSelectionScreen.module.css`, and `GameSettingsScreen.module.css` each maintain their own independent copies of `.speedColorSlow/.speedColorStandard/.speedColorFast` (duplicated per the project's own "no shared CSS partial" convention — see Pitfall 6), removing or renaming one copy without the other two produces inconsistent speed-picker coloring across screens, not a build failure. Consider this dynamic-class-lookup pattern the highest-risk deletion target in the whole cleanup effort and audit it explicitly as a named checklist item, rather than relying on IDE "find usages."

**Warning signs:**

- Any `styles[someVariable]` or ``styles[`prefix${x}`]`` pattern in a `.tsx` file — every one of these needs its class-name _source_ (the variable's possible values) traced back to a constants file/table before any related CSS class is touched.
- A CSS class with zero IDE "find usages" hits that nonetheless has a semantically meaningful name matching a value in a nearby `constants/*.ts` file.

**Phase to address:**
Code-cleanup phase, but **only after** the design-token/highlight phases have finished touching CSS modules — see Pitfall 7 (sequencing) for why cleanup of CSS classes specifically should be the _last_ step, not the first, of the visual work.

---

### Pitfall 5: Theme "chrome" colors and `TEAM_CONFIGS`/`uniformStyles` gameplay-branding colors are easy to conflate — the charcoal refresh must not touch team palette data

**What goes wrong:**
`TEAM_CONFIGS[teamId].palette.uiColor` drives per-team-branded text color in `ActionLog.tsx` (2 call sites), `GameBoard.tsx` (7 call sites — scoreboard, half-time banners, action-log team labels), and is threaded through `PieceOverlay.tsx`. These are **gameplay-semantic** (which team said/did this) not **decorative theme chrome** (page background, panel border, button color). A broad "replace deep-blue with charcoal" sweep done by string-matching hex values or by regex-replacing `.module.css` files risks touching `teamConfig.ts`'s `TeamPalette`/`COLOR_SCHEME_REGISTRY` entries if the sweep isn't scoped carefully, corrupting per-team jersey/branding colors that have nothing to do with app chrome.

**Why it happens:**
Both "the app is dark blue" and "team X's uiColor happens to be a similar-looking blue" can be true simultaneously (e.g., a team's `uiColor` might legitimately be a navy blue close to the chrome's `#0f3460`), making a value-based search-and-replace dangerous — it cannot distinguish "this blue is decorative chrome" from "this blue is Team X's brand color" by value alone.

**How to avoid:**
Scope the theme refactor strictly to files that render UI chrome (`*.module.css` for lobby/settings/team-selection/action-panel _layout_ elements, `index.css`, `App.module.css`) and explicitly exclude `packages/shared/src/teamConfig.ts` and any file whose colors are read from `TEAM_CONFIGS`/`palette`/`uiColor`/`UNIFORM_STYLES`. When introducing design tokens, keep "app theme tokens" (background/border/text-chrome) and "team palette data" (`TeamPalette`) as two separate, non-overlapping systems — do not attempt to route team colors through the new theme-token module, and do not let the theme-token module's color choices be influenced by what a specific team's palette looks like.

**Warning signs:**

- Any theme-token PR diff that touches `packages/shared/src/teamConfig.ts`, `COLOR_SCHEME_REGISTRY`, or `UNIFORM_STYLES` — should not happen in the theme-refresh phase at all.
- A visual regression where a specific team's jersey/branding color looks different only for that team (vs. the docs' "one dark charcoal palette app-wide") — signals team-palette and chrome-theme data got entangled.

**Phase to address:**
Design-token / theme-foundation phase — state the file-scope boundary explicitly as a phase constraint (chrome CSS only, no `packages/shared` team/uniform files) before work begins.

---

### Pitfall 6: There is no shared CSS partial — colors are duplicated verbatim per-component by explicit project convention, so "change the theme" means "edit N files identically," and missing one produces a silent visual inconsistency, not a build error

**What goes wrong:**
`GameSettingsScreen.module.css`'s own header comment states the convention plainly: _"Duplicates relevant tokens from LobbyScreen.module.css (.page/.card/.ctaButton) and TeamSelectionScreen.module.css (.tab/.tabActive/.speedOption_) per project convention (no shared CSS partial)."* The "deep blue" literal values (`#1a1a2e` page bg, `#16213e` card bg, `#0f3460` border/CTA, `#1a56b0` CTA hover, `#e0e0e0`/`#a0a0a0` text) recur across at least `LobbyScreen.module.css`, `TeamSelectionScreen.module.css`, `GameSettingsScreen.module.css`, `UniformSelectionScreen.module.css`, `ActionPanel.module.css`, and `ActionLog.module.css` (18 `.module.css` files total in the client) as independent literal copies, not a single imported source. A full-repo find/replace on the literal hex strings works *only if every occurrence is caught\* — there is no compiler or test that will flag a missed file, since each `.module.css` is scoped and independent. A missed file simply renders the old blue next to the new charcoal, and nothing fails.

**Why it happens:**
The project intentionally chose "duplicate per component" over a shared CSS partial (likely to keep each CSS Module self-contained and avoid cross-file CSS specificity/ordering issues) — a reasonable choice for incremental feature delivery, but one that turns any _global_ theme change into a manual, non-enforced, whole-repo sweep.

**How to avoid:**
This is the strongest argument for introducing actual shared design tokens (CSS custom properties in a single root file, e.g. `:root { --color-bg-page: ...; --color-bg-card: ...; }`, imported/used by every `.module.css`) as the _mechanism_ of the refresh, not just a naming convention. Once tokens exist, changing the palette becomes "edit N token values in one place" instead of "edit the same literal in 18 files." Before writing new tokens, grep every `.module.css` for the known "deep blue" literals (`#1a1a2e`, `#16213e`, `#0f3460`, `#1a56b0`, `#e0e0e0`, `#a0a0a0`, `#f5c518`) and build a literal exhaustive list of every file+line to touch — do not rely on visual QA alone to catch stragglers, since a missed file is not a functional bug and easy to miss in a two-tab human playtest that doesn't visit every screen.

**Warning signs:**

- Any new `.module.css` file added mid-refactor that still hardcodes a literal color instead of a CSS variable/token — signals the "no shared partial" convention is quietly reasserting itself even after tokens are introduced.
- A post-refactor grep for the _old_ literal values (`#1a1a2e` etc.) returning any hits at all outside of the token-definition file itself.

**Phase to address:**
Design-token / theme-foundation phase should introduce the CSS-custom-property (or equivalent) token mechanism as its primary deliverable — not merely a document of hex values — specifically because this codebase's "no shared partial" convention makes literal-value duplication the default failure mode.

---

### Pitfall 7: Sequencing cleanup before vs. after theme work — the two workstreams contend for the same files, and this project's own retrospective history shows combined/broad phases lose scope silently

**What goes wrong:**
The highlight-standardization and theme work both need to modify `HexGrid.tsx`, `HexGrid.module.css`, `HexCell.tsx`, `PieceOverlay.tsx`, and most `.module.css` files under `packages/client/src/components/`. General code cleanup (dead-code removal, duplicated-logic consolidation, Zustand review) _also_ wants to touch these same files. If both workstreams run as one undifferentiated phase, cleanup's dynamic-class deletions (Pitfall 4) and the theme work's palette renames can land in the same file in an order that makes each change harder to review and revert independently. This project's own `RETROSPECTIVE.md` records two directly relevant precedents: (1) v1.4's Phase 27 was silently redefined mid-milestone and its original scope (RESP-01..09) was never reassigned or flagged, surviving as "Pending" for an entire milestone before being caught at close; (2) v1.3's BUG-23 was fixed with "speculative fixes... applied... without confirming the root cause first," later shown not to have worked. Both are examples of broad, loosely-bounded phases in _this exact codebase_ losing track of scope or shipping unverified fixes — the same risk pattern applies to a combined "cleanup + reskin" phase.

**Why it happens:**
It is tempting to do cleanup and reskinning together "since you're already in the file," but the two have different verification needs: cleanup needs behavioral regression tests (does the game still work), while theme work needs visual/token-identity regression tests (does the right semantic role render, per Pitfall 1). Merging them means a single PR's test failures could be either kind, slowing triage, and a revert of "the redesign" would also revert unrelated dead-code removal.

**How to avoid:**
Split into an explicit sequence, not a single phase:

1. **Non-visual cleanup first** (Zustand selector review, duplicated JS/TS logic consolidation, genuinely dead exports/handlers with no CSS/color involvement) — this can proceed immediately since it's independent of the color system and gives the subsequent token work a cleaner base.
2. **Design-token/semantic-color-map phase** — build the full color-role inventory (Pitfall 2), extend `HIGHLIGHT_STYLES` to cover every ad-hoc highlight (Pitfall 3), introduce the CSS-variable token mechanism (Pitfall 6), and refactor test assertions to use tokens (Pitfall 1) — but do **not** delete any CSS class yet.
3. **Component restyling phase** — apply the charcoal palette and standardize `ActionPanel`/`ActionLog` borders/help-text/button behavior against the new tokens.
4. **CSS dead-code removal last** — only once the token migration is complete can a class safely be identified as truly unreferenced (Pitfall 4's dynamic-lookup risk is resolved once every `styles[x]` site has been traced during step 2/3's token work), so this specific cleanup sub-task belongs at the _end_ of the visual work, not the beginning.

Each of these four steps should be its own phase or sub-phase with its own test-passing gate, mirroring this project's own successful pattern (per the retrospective) of "phase splitting at planning time" and "Wave 0 data-integrity tests before behavioral code" — apply the same discipline here: a Wave 0 that inventories every color usage (a grep-and-list exercise, written down before any edit) is the direct analogue of the `formations.test.ts` data-integrity-first pattern that worked well in Phase 23.

**Warning signs:**

- A single phase/PR whose diff touches both a `HIGHLIGHT_STYLES` value and an unrelated Zustand selector deletion — a sign the two workstreams weren't separated.
- "cleanup" commits that also change visual output, or "theme" commits that also delete code paths — either direction of bleed makes bisecting a later regression harder.
- Scope silently narrowing mid-phase without an explicit "descoped, moved to Phase N" note — this project's REQUIREMENTS.md/roadmap has drifted this way twice before (RESP-01..09; REQUIREMENTS checkbox drift in three consecutive milestones per the retrospective) and is a known institutional risk, not a hypothetical one.

**Phase to address:**
Roadmap structure itself — this pitfall should shape _how many phases_ the milestone has, not be "addressed within" a single phase. Recommend 4 sequential phases/sub-phases as listed above (cleanup → token foundation → restyling → CSS pruning), each with its own explicit test-passing gate, rather than 1-2 broad phases.

---

## Technical Debt Patterns

| Shortcut                                                                                                         | Immediate Benefit                            | Long-term Cost                                                                                                                                                  | When Acceptable                                                                                                                            |
| ---------------------------------------------------------------------------------------------------------------- | -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Re-baseline the 60 literal-color test assertions to new literal values instead of refactoring to token identity  | Fast, mechanical, unblocks CI quickly        | Every future palette tweak re-triggers the same 60-assertion "big bang" edit; tests never gain regression value for "is this still the goal-target role"        | Never — this is exactly the failure mode the milestone should eliminate, not repeat                                                        |
| Recolor the offside ring or goal highlight without a full color-role inventory                                   | Quick collision fix, single-file change      | Risk of merging two previously-distinct meanings (e.g., risk-orange and offside) into a new collision, or breaking players' rulebook-trained color associations | Never for the offside/goal pair specifically; acceptable only for genuinely decorative (non-semantic) colors                               |
| Delete a CSS-module class with zero static `styles.foo` references without checking constants-table string usage | Looks like straightforward dead-code removal | Silent runtime visual regression (missing speed-picker color, etc.) with no compiler or test failure                                                            | Never — always grep the literal class-name string across the whole client tree first                                                       |
| Do theme + cleanup in one combined phase "since the files overlap anyway"                                        | Fewer phases, seemingly less overhead        | Harder-to-bisect regressions, scope drift (per this project's own two documented precedents), mixed-purpose diffs                                               | Only for genuinely tiny scope (e.g., a single component's obviously-dead unused import) — not for the highlight-system or theme-wide sweep |

## Integration Gotchas

| Integration                                        | Common Mistake                                                                                                                                                               | Correct Approach                                                                                                                                                                                                                                                                                            |
| -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CSS Modules (`*.module.css` + TS import)           | Assuming bracket-accessed classes (`styles[dynamicKey]`) are statically type-checked or IDE-discoverable                                                                     | Explicitly grep the string literal across the repo (constants tables, not just `.tsx` dot-access) before treating any class as unused                                                                                                                                                                       |
| Vitest + Testing Library color assertions          | Asserting on `getAttribute('fill')`/`getAttribute('stroke')` literal values                                                                                                  | Assert against the exported token/constant identity (`HIGHLIGHT_STYLES.goal.fill === TOKENS.x`) so the test survives a palette value change but still catches a role/mapping regression                                                                                                                     |
| Zustand selector review during cleanup             | Deleting a selector that appears unused because it's only read in one hard-to-grep branch (e.g., a phase-gated conditional deep in `HexGrid.tsx`'s 30+ `phase ===` branches) | Grep the selector name across `packages/client/src` including test files before removal; cross-reference against `ELIGIBLE_NEXT_ACTIONS`/phase-gated branches, since several state slices (e.g., `freeKickPlacedPieceIds`, `headerContestantIds`) are read only inside single, deeply-nested phase branches |
| Team palette (`TEAM_CONFIGS`) vs. app chrome theme | Treating both as "the color system" and refactoring them together                                                                                                            | Keep `packages/shared/src/teamConfig.ts` and `UNIFORM_STYLES` entirely out of scope for the chrome-theme refresh; they are gameplay data, not decorative theme                                                                                                                                              |

## Performance Traps

| Trap                                                                                                 | Symptoms                                                                                                                                                                                                                    | Prevention                                                                                                                                                                                                      | When It Breaks                                                                                                                                                                                          |
| ---------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Introducing CSS custom properties resolved via inline `style` objects in React instead of static CSS | Unnecessary re-renders of `HexGrid`/`PieceOverlay` (already Zustand-slice-optimized per the "Pitfall 6" code comment in `HexGrid.tsx`) if token values are threaded through React props/state instead of pure CSS variables | Keep chrome-theme tokens as CSS custom properties resolved by the browser, not by React state/props; only gameplay-conditional colors (already prop-driven, e.g., `HIGHLIGHT_STYLES` lookups) should stay in JS | Not likely to bite at this project's 2-player scale, but avoid establishing the pattern since `HexGrid` already renders ~962 hex cells per frame and is deliberately optimized with per-slice selectors |

## Security Mistakes

No domain-specific security concerns apply to a client-side visual/theme refactor and code cleanup — this work does not touch authentication, room-code validation, or Socket.io event handling. (If the cleanup phase touches `roomHandlers.ts` — noted in the retrospective's "Draft-mode cosmetic debt" gap — treat that as server-logic work outside this milestone's visual scope, not as part of the theme refresh.)

## UX Pitfalls

| Pitfall                                                                                                                                                                                                                                           | User Impact                                                                                                                                                                                                                                                      | Better Approach                                                                                                                                                                                                              |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Resolving the goal/offside red collision by picking an arbitrary new hue for offside without checking it against the existing risk-orange (`HIGHLIGHT_STYLES.risk`, `.hexTackleRisk`) or kickoff-blue (`HIGHLIGHT_STYLES.kickoff`) already in use | Players re-learn a 4th ambiguous color pairing instead of gaining clarity                                                                                                                                                                                        | Cross-check the new offside color against every existing role in the semantic-role table (Pitfall 2) before finalizing, not just against the one color it's replacing                                                        |
| Introducing a new "ball location" highlight that collides visually with the existing ad-hoc HEADER-phase gold ball-position overlay (`#f5c518`, `HexGrid.tsx` ~line 589-599)                                                                      | Two different code paths could both try to mark the ball's hex during HEADER phase with slightly different styling, or the new generic highlight could get suppressed/overridden by the old one-off HEADER-specific overlay that still exists in the render tree | Explicitly find and replace the existing ad-hoc HEADER gold ball-position overlay with the new formalized "ball location" `HexHighlightType` entry, rather than adding the new highlight type alongside the old one-off code |
| Standardizing ActionPanel/ActionLog help text/button behavior across ~29 `phase ===` conditional branches (`ActionPanel.tsx` is 1000 lines) without a per-phase checklist                                                                         | Easy to standardize the common phases (MOVE, PASS) and miss edge phases (`FREE_KICK_SETUP`, `SNAPSHOT_DEFLECT`, `GK_QUICK_THROW`) that have their own bespoke copy/behavior, leaving an inconsistent subset                                                      | Enumerate every `phase ===` branch in `ActionPanel.tsx` explicitly as a checklist before starting, mirroring the file's own 29 branches, and verify each one against the new standard rather than spot-checking              |

## "Looks Done But Isn't" Checklist

- [ ] **Highlight-color token sweep:** Often misses the ~7 ad-hoc inline-`fill=` highlights in `HexGrid.tsx` that never went through `HIGHLIGHT_STYLES` (GK_KICK_TARGET, QUICK_THROW, pass-target green/amber, centre-hex gold, HEADER ball-position gold) — verify by grepping `HexGrid.tsx` for any remaining literal `fill="rgba(` / `fill="#` after the phase.
- [ ] **Theme literal-value replacement:** Often misses one or more of the 18 `.module.css` files due to the project's "no shared CSS partial" duplication convention — verify with a post-phase grep for every known old literal (`#1a1a2e`, `#16213e`, `#0f3460`, `#1a56b0`, `#e0e0e0`, `#a0a0a0`) returning zero hits outside the token-definition file.
- [ ] **CSS dead-code removal:** Often deletes a class reachable only via `styles[dynamicKey]` bracket notation sourced from a `constants/*.ts` table — verify by grepping the literal class-name string (not just `styles.foo`) across the whole client tree before deleting.
- [ ] **Team-branding isolation:** Often accidentally touches `TEAM_CONFIGS`/`UNIFORM_STYLES` colors while doing a broad "replace blue" sweep — verify the theme-phase diff contains zero changes to `packages/shared/src/teamConfig.ts` or `packages/client/src/styles/uniformStyles.ts`.
- [ ] **Test-assertion migration:** Often re-baselines literal-color test expectations to new literal values instead of migrating to token-identity assertions — verify by grepping `*.test.tsx` for `rgba(`/`#[0-9a-fA-F]` after the phase; a healthy end-state should show these replaced by references to the shared token/constant, not new hardcoded strings.
- [ ] **Requirement/scope tracking:** Given this project's own retrospective history (RESP-01..09 falling through a mid-milestone phase redefinition; REQUIREMENTS.md checkbox drift across 3 consecutive milestones), verify at milestone close that every named sub-feature (theme overhaul, highlight standardization, ActionPanel/ActionLog standardization, cleanup) is explicitly checked off or explicitly marked descoped — not silently absent.

## Recovery Strategies

| Pitfall                                                                                                                      | Recovery Cost | Recovery Steps                                                                                                                                                                                                                                       |
| ---------------------------------------------------------------------------------------------------------------------------- | ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 60 literal-color test assertions re-baselined instead of token-migrated                                                      | LOW           | Revert the test-only diff, reapply the token-identity refactor described in Pitfall 1 as a follow-up commit; no game logic is at risk since these are purely presentational tests                                                                    |
| A CSS class deleted that was reachable only via dynamic bracket lookup                                                       | LOW–MEDIUM    | Restore the class from git history; add the specific class name to the checklist in Pitfall 4 as a permanent "known dynamic-lookup site" comment in the constants file to prevent recurrence                                                         |
| Offside/goal color collision "fixed" by introducing a third collision (e.g., new offside color matches existing risk-orange) | MEDIUM        | Requires re-running the full semantic-role inventory (Pitfall 2) and picking a genuinely unused hue; low code cost but requires a second design pass and a second round of human (two-tab) visual verification                                       |
| Team-branding colors (`TEAM_CONFIGS`) accidentally altered by a broad theme sweep                                            | MEDIUM–HIGH   | Diff `packages/shared/src/teamConfig.ts` against the pre-refactor commit specifically; team palettes are load-bearing for jersey rendering across 12 teams and any accidental change needs a dedicated regression check against `teamConfig.test.ts` |
| Combined cleanup+theme phase produces an unbisectable regression                                                             | HIGH          | Requires manually splitting the combined commit's diff after the fact into "behavioral" vs. "visual" hunks to isolate the regression — the exact cost this milestone's phase-splitting (Pitfall 7) is meant to avoid paying                          |

## Pitfall-to-Phase Mapping

| Pitfall                                                      | Prevention Phase                                                      | Verification                                                                                                                                                                             |
| ------------------------------------------------------------ | --------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Literal-color test assertions break en masse              | Design-token / theme-foundation phase (first plan)                    | Grep `*.test.tsx` for `rgba(`/hex literals shows zero net-new occurrences; existing 60 assertions are migrated to token-identity references in the same commit that introduces tokens    |
| 2. Goal/offside red collision & broader semantic-role drift  | Highlight-system standardization phase (before any recoloring)        | A written color-role table exists and is referenced in the PR description; offside's new color does not match any other role's hue                                                       |
| 3. Ad-hoc inline highlight colors outside `HIGHLIGHT_STYLES` | Highlight-system standardization phase                                | Post-phase grep of `HexGrid.tsx` for literal `fill=`/`stroke=` values returns none inside the hex-rendering map (only `HIGHLIGHT_STYLES[...]` references remain)                         |
| 4. Dynamic `styles[colorClass]` dead-code risk               | Code-cleanup phase, sequenced _last_ (Pitfall 7)                      | Every CSS-module class removal is preceded by a literal-string grep across the client tree, documented in the plan/summary                                                               |
| 5. Team-palette vs. chrome-theme conflation                  | Design-token / theme-foundation phase (scope constraint set up front) | Phase diff contains zero changes to `packages/shared/src/teamConfig.ts` / `uniformStyles.ts`                                                                                             |
| 6. No shared CSS partial — literal duplication               | Design-token / theme-foundation phase                                 | CSS custom properties (or equivalent token mechanism) introduced; post-phase grep for old literal hex values returns zero hits outside the token file                                    |
| 7. Cleanup/theme sequencing risk                             | Roadmap structuring (applies across all phases)                       | Milestone roadmap shows 4 distinct phases/sub-phases in the order: non-visual cleanup → token foundation → component restyling → CSS pruning, each with an independent test-passing gate |

## Sources

- Direct inspection of this repository (primary source for all findings above):
  - `packages/client/src/components/HexCell.tsx` (HIGHLIGHT_STYLES table, 7 declared highlight types)
  - `packages/client/src/components/HexGrid.tsx` (ad-hoc inline highlight colors, phase-gated render branches, offside/goal usage sites)
  - `packages/client/src/components/HexGrid.module.css` (`.hexTackleRisk` independent risk-orange definition)
  - `packages/client/src/components/PieceOverlay.tsx` (selection-ring colors, `isOffside` red ring)
  - `packages/client/src/components/HexCell.test.tsx`, `HexGrid.test.tsx`, `PieceOverlay.test.tsx`, `PlayerStatsPanel.test.tsx` (literal-color assertion count)
  - `packages/client/src/components/GameSettingsScreen.module.css`, `GameSettingsScreen.tsx`, `TeamSelectionScreen.tsx`, `UniformSelectionScreen.tsx`, `packages/client/src/constants/speedOptions.ts` (dynamic `styles[colorClass]` pattern; "no shared CSS partial" convention comment)
  - `packages/client/src/components/LobbyScreen.module.css`, `ActionPanel.module.css`, `ActionLog.module.css` (deep-blue literal duplication)
  - `packages/shared/src/teamConfig.ts`, `packages/client/src/components/ActionLog.tsx`, `GameBoard.tsx` (`TEAM_CONFIGS.palette.uiColor` gameplay-branding usage)
  - `.planning/RETROSPECTIVE.md` (v1.2–v1.4 process history: phase-scope drift, requirement-checkbox drift, speculative-fix inefficiency, pure-module pattern, phase-splitting pattern)
  - `eslint.config.js`, root `package.json` (confirms no `knip`/`ts-prune`/CSS-unused-class tooling is configured — dead-code verification relies on manual grep + the existing 1,568-test suite)

---

_Pitfalls research for: Visual/theme refactor + code cleanup on an existing real-time multiplayer game (Counter Attack Web, v1.5)_
_Researched: 2026-07-22_
