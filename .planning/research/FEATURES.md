# Feature Research

**Domain:** Sports-game UI/UX — soccer video-game and broadcast conventions for referee settings, card/injury iconography, settings disclosure, substitutions, defensive-duel prompts, and stats summaries
**Researched:** 2026-08-21
**Confidence:** MEDIUM (established genre/UX conventions, cross-checked against public web sources; no official design-system doc exists for this exact combination of mechanics — this is a niche dice-driven tabletop-style sim, not a AAA sports title, so direct precedent is partial for two of the six items)

## Context Grounding (from codebase, not external research)

Before recommending patterns, the current v1.6 implementation already establishes several conventions this milestone must extend rather than invent:

- **Card/injury iconography already exists in three different visual languages that disagree with each other:** `PieceOverlay.tsx` (on-pitch hex token) renders a small SVG rect badge (red/yellow fill) plus a white plus-sign cross for injury — a true iconographic treatment. `PlayerStatsPanel.tsx` (scoreboard player card) and `LineupStatCard` in `LineupAssignmentScreen.tsx` (roster/bench card) both render **text chips** instead — `"YELLOW"`/`"RED"` and `"INJ"`/`"INJ ×2"` — explicitly commented as "identical classes/copy" to each other but visually nothing like the pitch token's badge. Unifying iconography (v1.7 target) means picking ONE visual language and back-porting it to whichever component doesn't already have it — most likely converting the text chips to compact icon+abbreviation glyphs matching the pitch token's shape language (rect=card, cross=injury), since text chips ("YELLOW"/"RED") don't scale down to small sizes as legibly as a colored glyph.
- **Referee Leniency is already a per-referee attribute rolled 1–6** (`FOUL-01..05`/`CARD-01..04`, Phase 39) — the v1.7 toggle is a manual override of an existing random-roll code path, not new game logic.
- **Settings screen (`GameSettingsScreen.tsx`) currently has zero disclosure/grouping** — Match Speed, Team Type, Match Rules (Fouls/Booking/Injury/Out-of-Bounds), and Draft Pool are all flat vertical sections with no collapsing. The "Advanced" dropdown requirement is a new UI shell around existing toggles plus 1-2 new ones (Referee Leniency, Tackle/Steal Decline), not new settings logic.
- **Substitution today is bench→pitch drag-only, no pitch↔pitch repositioning, no confirmation step.** `renderMidmatchColumn` in `LineupAssignmentScreen.tsx` explicitly sets on-pitch cards to `isDragSource={false}` — on-field player-positioning swap does not exist yet in midmatch mode (it exists only in pre-match lineup assignment). Dropping a bench card directly onto a pitch card fires `onSubstitute` immediately server-side — no "are you sure, X off / Y on" confirmation dialog exists. This means the v1.7 substitution UX overhaul is **two new capabilities bolted onto one existing screen**: (1) porting the pre-match swap-drag mechanic into midmatch "positioning mode", and (2) adding an explicit mode-switch + confirmation step around the existing instant-substitute mechanic.
- **Red-carded players already appear on the bench** (`BenchEntryStatus = 'available' | 'subbedOut' | 'redCarded'`, `redCardedPlayerIds` passed to `BenchCarousel`) — the v1.7 ask to show them with a marker rather than remove them is already the data model; the "bug fix ensuring red-carded players are fully removed from play in every phase, not just visually hidden" is the harder half of this feature (an engine-correctness audit, not a UI task).
- **`STOPPAGE_PHASES` (`packages/shared/src/stoppagePhases.ts`) is the substitution-eligibility gate** — any new positioning-mode/action-button UX must key off this same allow-list, not a parallel one, to avoid the exact "second copy of a phase list drifts from the first" bug class this project has explicitly guarded against before (`validUndoPhases` idiom).
- **Tackle/steal duels currently resolve immediately on a die roll** — there is no existing "decline" branch in the engine. The v1.7 decline-and-retry toggle is genuinely new game logic, not a UI-only change.

## Feature Landscape

### Table Stakes (Users Expect These)

| Feature                                                                                    | Why Expected                                                                                                                                                                                                                                                                                                          | Complexity | Notes                                                                                                                                                                                                                |
| ------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Consistent card (yellow/red) + injury icon across every surface that shows a player        | Every soccer product (FIFA/eFootball career mode, Football Manager squad screens, broadcast lower-thirds) uses one instantly-recognizable glyph set for these two states everywhere a player name appears — a mismatched look between the pitch and the bench reads as a bug, not a style choice                      | LOW–MEDIUM | Codebase already has both a shape-based (pitch) and a text-chip (roster/stats) treatment; converging on one is mostly a styling/consolidation pass, not new state                                                    |
| Icon positioned consistently relative to name/flag/number                                  | Users scan left-to-right; status glyphs are expected in a fixed slot (typically right after the name or right after the jersey number) so eyes don't have to hunt                                                                                                                                                     | LOW        | v1.7 explicitly specifies "between name and flag, or after flag" — either is acceptable as long as it's the SAME slot on every card type                                                                             |
| Explicit "who's coming off, who's coming on" confirmation before a substitution commits    | Every soccer sim (FIFA, FM, even simple fantasy-football apps) requires a confirm step naming both players — an accidental drag-drop substitution with no undo is a real complaint pattern in FM's own bug tracker (confirm-button flows exist specifically because instant subs are error-prone and often permanent) | LOW–MEDIUM | This project's subs are already irreversible (3-per-match cap, no reset) — a confirm step is arguably MORE necessary here than in FIFA since there's no "undo the sub" safety net once committed                     |
| Red-carded / unavailable bench players visibly distinguished but not removed from the list | Standard broadcast/FM convention: an unavailable squad member stays visible with a status badge (injured, suspended, cup-tied) rather than vanishing, so the roster always reads as complete                                                                                                                          | LOW        | Data model already supports this (`BenchEntryStatus`); v1.7 mainly needs a repositionable "cannot be substituted" bench slot rendering plus the underlying engine fix                                                |
| A settings screen that doesn't overwhelm with every toggle visible at once                 | Progressive disclosure is the standard pattern for any settings/config surface with more than ~5-6 options — pushes rarely-changed options behind a clearly-labeled "Advanced" affordance while keeping common ones visible                                                                                           | LOW        | GameSettingsScreen is about to cross ~7 toggles/sections; an Advanced drawer is the conventional fix, not a novel invention                                                                                          |
| Basic match stats on demand (possession, shots, cards)                                     | Every soccer broadcast and every soccer video game surfaces at least possession/shots/cards somewhere accessible mid-match; a 2-player competitive game with dice-driven "who's actually playing better" ambiguity benefits especially from this                                                                      | LOW–MEDIUM | Half-time/full-time screens already exist; the new work is an on-demand popup + the underlying stat-tracking (possession%, tackle/steal success%, xG-per-shot) which appears to be entirely new server-side tracking |

### Differentiators (Competitive Advantage)

| Feature                                                                   | Value Proposition                                                                                                                                                                                                                                                                                                                                                                                                         | Complexity | Notes                                                                                                                                                                                                   |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Referee Leniency manual override (2-5 dial)                               | Lets the host tune match physicality/card frequency per-game (like FIFA's "foul frequency" or difficulty sliders) without touching randomness elsewhere — a small but real customization knob that increases replayability for a 2-player POC where both players want repeatable/predictable conditions sometimes                                                                                                         | LOW        | This is a UI-only change on top of an already-implemented `Leniency` attribute/roll; no new engine branch beyond "read override value instead of rolling"                                               |
| Tackle/Steal decline-and-retry (persistent "still live" ring)             | No mainstream soccer video game has this exact mechanic (FIFA/eFootball tackling is a single stick input, not a discrete "attempt now or later" choice) — this is closer to a tabletop wargame "hold your action" pattern (e.g., Blood Bowl's block-dice reroll windows, or XCOM's overwatch metaphor: a persistent highlighted state means "this opportunity is still open") than anything in a soccer game specifically | MEDIUM     | **Novel — flag for implementation-time design, not just research.** No direct precedent; nearest analogues are turn-based tactics games' "reserved action" indicators, not sports sims                  |
| On-demand (i)-icon match summary popup, separate from half-time/full-time | Real broadcasts don't have this exact affordance (their stats graphics are director-triggered cutaways, not user-pulled), but many stats-heavy web apps (fantasy sports live trackers, esports overlays) use a persistent small icon for "peek at live stats without leaving the match view" — this is closer to a live-dashboard pattern than a broadcast one                                                            | LOW–MEDIUM | Should be a lightweight/reduced version of the existing half-time/full-time stats (subset of categories, no full-screen takeover) — differentiator is availability at any time, not new stat categories |
| Formation-aware bench red-card marker (repositionable, unsubstitutable)   | Most soccer games simply grey out or hide a suspended player; showing them as a still-repositionable-but-frozen bench card that visually communicates "still part of the roster, permanently can't play" is a small polish touch beyond baseline expectation                                                                                                                                                              | LOW        | Builds directly on existing `redCarded` bench status; mostly a rendering + drag-guard change                                                                                                            |

### Anti-Features (Commonly Requested, Often Problematic)

| Feature                                                                                                                      | Why Requested                                                                             | Why Problematic                                                                                                                                                                                                                                                                              | Alternative                                                                                                                                                           |
| ---------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Full broadcast-style half-time graphics package (heat maps, pass network diagrams, player ratings, formation shape overlays) | "Real broadcasts have this, why don't we"                                                 | Massive scope for a 2-player POC — heat maps and pass networks require positional-history aggregation and a charting library the project doesn't have; the project's Out of Scope list already excludes animations and heavy visual investment                                               | Keep the on-demand popup to the named stat list in PROJECT.md (possession%, passes, tackles/steals + success%, shots, xG, fouls/cards) — text/number panel, no charts |
| A numeric Leniency stepper that allows the full 1-6 range including the "random" endpoints                                   | Symmetry with the existing 1-6 roll range feels natural                                   | The requirement explicitly restricts the override to 2-5 (the roll's meaningful middle range, since 1 and 6 are the auto-strict/auto-lenient extremes that make the toggle pointless if selectable) — over-engineering the range works against the design intent already specified           | Stepper strictly bounded 2-5, matching PROJECT.md's stated range; disable stepper past-bounds rather than clamping silently                                           |
| Undo/redo for a confirmed substitution                                                                                       | Feels consistent with the game's existing Undo system for other actions                   | Subs are capped at 3/match with no reset and directly change roster availability (SUB-04/06); allowing undo re-opens a slot integrity problem the substitution system was explicitly built to avoid (`applyRosterContinuity` exists specifically to prevent resurrecting subbed-out players) | Confirmation-before-commit (this milestone's ask) is the safety net; no post-commit undo                                                                              |
| A full "tactical instructions" or AI-suggested-substitution system                                                           | Common in Football Manager and adds "depth"                                               | Out of scope entirely — this project has no AI/single-player mode (explicitly listed Out of Scope in PROJECT.md) and a 2-player real-time game doesn't need computer-suggested subs                                                                                                          | None needed — leave substitution decisions 100% manual, as today                                                                                                      |
| Persistent/toggleable stat overlay that auto-updates live on the pitch view (always-visible HUD strip)                       | Sports games sometimes show a live mini-stat ticker                                       | Adds permanent screen real estate to an already dense scoreboard/action-panel layout, competes with the existing top-band scoreboard (LAYOUT-01) for space, and duplicates the explicitly-requested on-demand (i)-icon pattern                                                               | On-demand popup only, as specified — no persistent HUD                                                                                                                |
| Letting the tackle/steal "decline" option apply per-die-face configurability (e.g., decline thresholds tunable by the host)  | Feels like it fits alongside the other new toggles (Leniency range, Fouls/Booking/Injury) | The requirement is a simple on/off toggle for whether decline is offered at all — adding a tunable threshold is speculative scope invented from a pattern-matching impulse, not requested                                                                                                    | Binary toggle only: decline offered (on) vs. duel resolves immediately with no decline option (off), matching PROJECT.md's stated default                             |

## Per-Feature Detail

### 1. Referee Leniency Manual Override

**Sensible UI pattern:** A toggle (checkbox/switch) that reveals a bounded numeric stepper only when enabled — this is the standard "conditional reveal" pattern already used elsewhere in this codebase (Booking/Injury rows disable-not-hide when Fouls is off; the same "grey out until parent enabled" idiom applies here, inverted to "reveal a stepper only when the override toggle is on"). Recommended shape:

- Off (default): existing random 1-6 roll behavior, unchanged, no stepper visible.
- On: a `−`/value/`+` stepper (or a 4-position segmented control, since the range is only 2-5 — small enough that discrete buttons may read even more clearly than a generic stepper) clamped to 2-5, defaulting to a mid value (3 or 4) when first enabled.
- This mirrors FIFA/EA Sports FC's own "match settings" difficulty-slider pattern (bounded numeric dial, off = default AI behavior) and Football Manager's discrete-value dropdowns for tunable match engine parameters.

**Table stakes:** the toggle + bounded stepper, default off, override applies to every foul→booking check for the rest of the match.
**Nice-to-have:** inline explanation text ("Higher = stricter ref, more cards") — cheap, high clarity value, recommended given this is a fairly opaque game-balance knob for a new player.
**Anti-feature:** allowing 1 or 6 in the override (see Anti-Features table above).

### 2. Unified Card/Injury Iconography

**Standard minimal iconography (cross-checked against FIFA/eFootball squad screens and broadcast lower-thirds):** a small solid-color rectangle/card-shape for yellow/red, and a plain cross ("+") glyph for injury — exactly the shape language already implemented in `PieceOverlay.tsx`. This is genuinely the industry-standard minimal set; there isn't a third option worth considering (no game uses e.g. a bandage icon or a heart-with-crack for injury — the medical cross is universal).

**At small sizes:** a colored rectangle beats a text abbreviation for the card ("Y"/"R" single-letter is legible smaller than "YELLOW"/"RED" — most broadcasts and games use the literal card SHAPE, not a letter, because shape+color recognition is faster than reading). For injury, a plain white cross on transparent/dark background reads at very small sizes (broadcast graphics use exactly this — a red cross badge next to a player's name in the "confirmed lineups" graphic).

**Table stakes:** one glyph set, one fixed position, used identically on pitch token / scoreboard player card / roster card / bench card.
**Nice-to-have:** a stacked/combined badge when both card and injury apply simultaneously (already partially solved in `PieceOverlay.tsx` — card renders first, injury layers on top).
**Anti-feature:** inventing a novel icon set instead of reusing what's already built and tested in `PieceOverlay.tsx` — the pragmatic path is extending the pitch token's SVG badge visual language (or a CSS/SVG equivalent) to the two text-chip components, not designing something new from scratch.

### 3. Advanced/Collapsible Settings Drawer

**Standard pattern:** progressive disclosure via a labeled, collapsed-by-default section — most commonly a `<details>/<summary>`-equivalent header row ("Advanced ▾") that expands a panel, OR a simple boolean-toggled section (identical mechanism, custom-styled). For a settings screen with grouped toggles, a two-column layout inside the expanded panel (label left, control right, or two side-by-side toggle groups) is standard once you have more than ~4 items to avoid a long single-column scroll — this directly matches the v1.7 ask ("laid out left/right rather than purely vertical").

**Table stakes:** collapsed-by-default, clear affordance (chevron/label) indicating expandability, remembers nothing between sessions (a fresh game-creation flow each time — no need for localStorage persistence for a POC).
**Nice-to-have:** grouping related toggles under sub-headers within Advanced (e.g., "Match Rules" vs. "Referee" vs. "Gameplay") rather than one flat list.
**Anti-feature:** multi-level nested accordions, animated transitions, or a wizard/stepper flow — over-engineered for what is fundamentally 6-8 checkboxes; a single collapse/expand is sufficient.

### 4. Substitution UX Overhaul

**Standard flow (FIFA / Football Manager / fantasy-football web apps), consistently across all three references found:**

1. Default view = roster/formation view (not an editing mode) — in FM this is the tactics screen; in FIFA it's the pause-menu squad view.
2. An explicit action ("Sub Out" tap in FIFA, "Make Substitution" in FM) is required to ENTER substitution mode — subs are never accidental drag-drops in shipping products, which validates v1.7's move away from the current instant-drag-to-substitute behavior.
3. Select the outgoing player, then the incoming player (bench).
4. A confirmation step names both players explicitly before the change commits (FM's "Confirm Changes" button; FIFA's "Confirm" after both shirts are selected) — this is the most consistent element across every reference checked, including community bug reports specifically about that confirm step failing, which underscores how load-bearing it is in real products.
5. Unavailable/suspended players remain visible on the bench with a status badge, never removed from the list.

**Mapped onto this project's v1.7 spec:** the requirement's shape (default positioning mode → explicit action button → substitution mode → 1-selection cap → confirm popup → green Resume) matches this standard flow closely, with one addition that's genuinely this project's own invention: a **default drag-and-drop on-field positioning mode** (swapping on-pitch players' formation slots without using a sub) — mainstream soccer games don't typically offer free-form on-field repositioning mid-match outside of formation/tactics screens between matches, so this half of the feature has no exact precedent and should be treated as a UI decision specific to this project (disabled whenever an action is selected, bench players excluded from swap targets, as specified).

**Table stakes:** explicit action button to enter sub mode; 1-sub-per-action limit; off/on confirmation naming both players; red-carded players shown with a marker, not removed; cap enforcement (button disabled at 3/3).
**Nice-to-have:** the green Resume button + banner-background-turns-green editable-state signal (matches this project's existing green=actionable convention already used elsewhere per `HIGHLIGHT-REFERENCE.md`/ActionPanel CTA coloring — consistent with, not a new pattern).
**Anti-feature:** allowing multiple simultaneous sub selections queued before one combined confirm (some fantasy-football apps do "batch subs") — v1.7 explicitly caps at 1 per action, and batching would add real state-machine complexity (interacting with the existing per-stoppage/per-action `STOPPAGE_PHASES` gate) for no clear value in a 2-player live game where each sub is already a discrete server round-trip.

**Dependency:** this entire feature builds on Phase 40's `STOPPAGE_PHASES` allow-list and `BenchEntry`/`BenchEntryStatus` model — the roadmap should treat this as an extension of that existing subsystem, not a rewrite. The "fully removed from play in every phase, not just visually hidden" bug fix is a correctness audit across every phase handler that reads `state.pieces`, independent of the UI work, and should likely be scoped/estimated separately since its complexity is unbounded until the audit is done.

### 5. Tackle/Steal Decline-and-Retry Mechanic

**No direct precedent in soccer video games** — FIFA/eFootball tackling is a real-time stick/button input with no discrete "decline" choice, and this genre generally resolves defensive duels instantly. The closer analogues are turn-based tactics/wargames: a "reserved action" or "overwatch" pattern (XCOM), or a dice-based hold/reroll window (Blood Bowl-style tabletop sims) — both use a **persistent visual state** (a glowing outline, a distinct icon, or a highlighted tile) to communicate "this option is still live and can be triggered later," versus a normal one-shot prompt that disappears once dismissed.

**Recommended UX, consistent with this project's own existing conventions:** this project already has a documented, single-source-of-truth hex ring/highlight system (`docs/HIGHLIGHT-REFERENCE.md`, `HIGHLIGHT_STYLES`/`RING_STYLES`) distinguishing "selectable," "active," and "already-acted" states via ring color. A declined tackle/steal opportunity should reuse this existing ring vocabulary rather than invent a new visual state — e.g., keep the existing "risk" ring active/persistent on the relevant hex (rather than clearing it, as presumably happens today when a duel resolves) to signal "still live," and only clear it once the ball-carrier moves out of range or the movement phase ends (i.e., the opportunity genuinely expires). This keeps the new mechanic visually consistent with the app's established ring system instead of adding a competing visual language.

**Table stakes:** default-on toggle; declining doesn't consume the defender's move/turn; the ring/highlight persists until the opportunity is genuinely no longer available (not just until the prompt is dismissed).
**Nice-to-have:** a distinct micro-affordance (e.g., a small "still available" label or subtly different ring animation) differentiating "declined-but-still-live" from "not yet offered" — optional polish, not required for correctness.
**Anti-feature (flagged above):** configurable decline thresholds — out of scope, binary toggle only.

**Genuinely novel — flag for implementation-time design:** the state machine for "prompt appears at move step N, defender declines, opportunity must be re-offerable at move step N+1 without re-triggering side effects (e.g., without re-rolling anything until actually accepted)" has no existing code path in this engine to extend from (today, duels resolve immediately on the die roll being triggered) and no close analogue elsewhere in the ruleset to copy. This is squarely a phase where deeper phase-specific research/design (state-machine sketch, not more market research) will be needed — flagging per the downstream consumer's PITFALLS-adjacent concern.

### 6. Match Summary / Half-Time Stats Popup

**Standard broadcast half-time stat categories, confirmed across multiple sources:** possession %, shots, shots on target, passes (often passing accuracy %), corners, fouls, cards, and increasingly xG as a standard inclusion on modern broadcasts (often split by half). This matches PROJECT.md's stated category list almost exactly (possession %, passes, successful tackles + steals, tackle/steal success %, shots, xG per shot, fouls/yellows/reds) — tackle/steal success% is this project's own addition (not a standard broadcast stat, since tackling isn't tracked as a discrete dice event in real soccer) and is appropriately treated as a game-specific stat, not something to source externally.

**Minimal on-demand presentation vs. the existing full half-time/full-time screen:** the on-demand (i)-icon popup should be a lighter-weight variant — a compact panel/modal (not a full-screen takeover like half-time/full-time already are), reachable without pausing/blocking gameplay, showing the same stat categories as numbers/percentages in a simple two-column (home vs. away) layout — this is exactly how most "peek at live stats" affordances work in fantasy-sports live trackers and stats-app widgets (a lightweight overlay, not a re-skin of the full-screen recap). The existing half-time/full-time screens remain the "full" experience (presumably richer, e.g. including the settings/toggle recap this milestone also adds); the (i)-icon popup should NOT duplicate every element of that screen, just the live numeric stats plus (per the requirement) the settings/toggle recap including Leniency.

**Table stakes:** two-column home/away stat comparison, the exact category list PROJECT.md specifies, reachable at any time via the scoreboard (i) icon, non-blocking/dismissable without pausing gameplay.
**Nice-to-have:** visual possession bar (a simple horizontal split bar is a very cheap, very standard broadcast convention — low effort, high recognizability).
**Anti-feature:** heat maps, shot maps, pass network diagrams, per-player rating breakdowns (see Anti-Features table) — none of these are implied by "soccer-style stats" at this project's scope and would require substantial new positional-history tracking infrastructure.

**Locked input, not a research question (per task instructions):** the xG-per-shot formula is user-specified elsewhere and must be treated as given — this research does not attempt to derive or validate it.

## Feature Dependencies

```
Substitution UX overhaul (positioning mode + action button + confirm)
    └──requires──> existing STOPPAGE_PHASES gate (packages/shared/src/stoppagePhases.ts)
    └──requires──> existing BenchEntry/BenchEntryStatus model (packages/shared/src/types.ts)
    └──extends───> existing pre-match onSwap drag mechanic (LineupAssignmentScreen.tsx) into midmatch mode

Red-card "fully removed from play" bug fix
    └──independent-of──> Substitution UX overhaul's UI changes (separate correctness audit,
                          can be scoped/estimated on its own even though delivered in the same phase)

Unified card/injury iconography
    └──requires──> existing PieceOverlay.tsx SVG badge pattern (source of truth to extend outward)
    └──touches───> PlayerStatsPanel.tsx, LineupStatCard (LineupAssignmentScreen.tsx), and (new) bench card

Advanced settings drawer
    └──requires──> existing GameSettingsScreen.tsx toggle set (Fouls/Booking/Injury/Out-of-Bounds)
    └──houses────> Referee Leniency override toggle (new)
    └──houses────> Tackle/Steal decline toggle (new)

Referee Leniency manual override
    └──overrides──> existing random 1-6 Leniency roll (Phase 39 FOUL/CARD engine) — UI + one read-path change only

Tackle/Steal decline-and-retry
    └──reuses────> existing HIGHLIGHT_STYLES/RING_STYLES ring vocabulary (docs/HIGHLIGHT-REFERENCE.md)
    └──requires──> new engine state machine (no existing "declined but still live" concept) — NOVEL, flag for design

Game Summary popup
    └──requires──> new server-side stat tracking (possession%, tackle/steal success%, xG accumulation) — NEW
    └──reuses────> settings/toggle recap data already captured at game creation (GameSettingsScreen confirm payload)
    └──complements (not replaces)──> existing half-time/full-time full-screen stats display
```

### Dependency Notes

- **Substitution UX overhaul requires STOPPAGE_PHASES and BenchEntry:** both already exist from Phase 40; this milestone extends rather than replaces them, which should keep this feature's complexity closer to MEDIUM than HIGH provided the roadmap phase explicitly scopes it as "extend existing subsystem."
- **Red-card removal bug fix is independent of the UI overhaul:** it's tempting to bundle it into the same phase as the substitution UX work since both touch the bench, but its complexity is driven by an unknown-until-audited set of phase handlers reading `state.pieces` without checking `redCarded` — recommend the roadmap treat it as a distinct task/plan within the phase, not assume it's "free" alongside the UI work.
- **Iconography unification touches three components that currently disagree** (see Context Grounding) — the roadmap should account for PlayerStatsPanel.tsx AND LineupStatCard needing conversion from text-chip to icon-based rendering, not just "add icons where missing."
- **Tackle/Steal decline is genuinely new engine state, not a UI toggle over existing logic** — unlike Referee Leniency (a thin override of existing logic), this needs its own design pass; the roadmap should flag this phase for deeper research/design time similar to how Corner Kick (Phase 38) needed multiple gap-closure rounds for a genuinely novel state machine.
- **Game Summary popup requires new stat tracking infrastructure** — possession%, tackle/steal success%, and xG accumulation are not currently tracked anywhere in `GameState` (based on the existing `PlayerStatsPanel`/`ActionLog` reviewed, which show per-player attributes and event log text, not aggregated match stats). This is the single largest net-new server-side surface among the six features and should be scoped accordingly — likely the most complex of the six from an implementation-cost standpoint even though its UX pattern (a stats popup) is the most conventional/well-precedented.

## MVP Definition

### Launch With (v1.7)

All six features are already scoped as this milestone's target list in PROJECT.md — none should be cut for a "true MVP" subset, since the milestone is explicitly a polish/consistency pass rather than a new core-loop feature. Within each feature, the "table stakes" rows above are the MVP; the "nice-to-have" rows are safe to defer within-phase if time-constrained without re-scoping the milestone.

- [ ] Referee Leniency override — table-stakes toggle+stepper only; defer inline explanatory copy if needed
- [ ] Unified card/injury iconography — convert all four card surfaces to one glyph set; the stacked-badge nice-to-have already partially exists, no need to defer
- [ ] Advanced settings drawer — collapsed-by-default section + two-column layout; defer sub-grouping within Advanced if needed
- [ ] Substitution UX overhaul — positioning mode, action button, 1-sub cap, confirm popup, bench red-card marker, and the correctness bug fix are all explicitly required, not optional
- [ ] Tackle/Steal decline toggle — binary on/off only; this is the one feature where the underlying mechanic needs real design time despite being "just a toggle" on the settings screen
- [ ] Game Summary popup — full stat category list from PROJECT.md; defer the possession-bar visual nice-to-have if time-constrained

### Add After Validation (v1.x)

- [ ] Inline explanatory copy for Leniency dial ("Higher = stricter ref") — cheap addition once the core toggle ships and reads correctly in UAT
- [ ] Sub-grouped Advanced settings (separate headers for Match Rules vs. Referee vs. Gameplay) if the flat Advanced list feels cluttered once Leniency + Decline toggles are added to it

### Future Consideration (v2+)

- [ ] Any visual stats beyond simple numbers/percentages (possession bar is the one cheap exception worth doing now; heat maps/shot maps/pass networks are true v2+ material requiring new positional-history infrastructure)
- [ ] Configurable/tunable tackle-steal decline behavior beyond binary on/off — defer indefinitely per Anti-Features

## Feature Prioritization Matrix

| Feature                                           | User Value | Implementation Cost               | Priority |
| ------------------------------------------------- | ---------- | --------------------------------- | -------- |
| Substitution UX overhaul (incl. red-card bug fix) | HIGH       | HIGH                              | P1       |
| Unified card/injury iconography                   | MEDIUM     | LOW-MEDIUM                        | P1       |
| Advanced settings drawer                          | MEDIUM     | LOW                               | P1       |
| Referee Leniency override                         | LOW-MEDIUM | LOW                               | P1       |
| Tackle/Steal decline-and-retry                    | MEDIUM     | MEDIUM-HIGH (novel state machine) | P1       |
| Game Summary popup                                | HIGH       | HIGH (new stat-tracking infra)    | P1       |

**Priority key:** all six are P1 for this milestone per PROJECT.md's explicit v1.7 scope — this matrix is included to inform phase ORDERING (highest-cost/most-novel items — Tackle/Steal decline and Game Summary's stat tracking — likely deserve earlier phase placement or dedicated research-flagged phases, since they carry the most implementation risk and least existing precedent to build from) rather than to suggest cutting anything.

## Competitor Feature Analysis

| Feature                                  | FIFA / EA Sports FC                                                                 | Football Manager                                                     | Our Approach                                                                                                                                 |
| ---------------------------------------- | ----------------------------------------------------------------------------------- | -------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Referee strictness control               | Foul-frequency/difficulty sliders in match settings, off by default                 | Not a common toggle (ref personality is simulated, not player-set)   | Simple bounded 2-5 override, off by default — closer to FIFA's slider pattern                                                                |
| Card/injury iconography                  | Small card-shape + medical-cross glyphs on lineup/scoreboard                        | Same glyph conventions on squad/tactics screens                      | Adopt the same shape language, unify across all 4 existing card surfaces                                                                     |
| Substitution flow                        | Sub Out → Sub In → Confirm, 2-tap flow                                              | Selection + "Confirm Changes" button, same 2-step-then-confirm shape | Match this flow closely; add a project-specific default positioning mode with no direct precedent                                            |
| Suspended/unavailable bench player       | Greyed-out card, status badge, stays in list                                        | Same — greyed with a status icon                                     | Reuse existing `redCarded` bench status, just needs a marker + drag-guard                                                                    |
| Decline a defensive duel and retry later | No equivalent — defense is real-time input, not discrete/turn-based                 | No equivalent — match engine, not player-facing duels                | No direct precedent anywhere in genre; nearest analogue is turn-based tactics games' persistent "reserved action" indicator                  |
| Live/on-demand stats popup               | Full-screen stats overlay, pause-triggered, not a lightweight always-available icon | In-match "Stats" tab, always accessible, similar to what's proposed  | Lightweight two-column popup reachable via scoreboard (i) icon at any time, distinct from the existing full-screen half-time/full-time recap |

## Sources

- [FIFA: How To Substitute Players During A Match](https://programme.whentheadultschange.com/whentheadultschange-news/fifa-how-to-substitute-players-during-a-match-1767646520)
- [How to make substitutions in FIFA Club World Cup Fantasy](https://www.fantasyfootballscout.co.uk/2025/06/15/how-to-make-substitutions-in-fifa-club-world-cup-fantasy) — confirms the "select outgoing → select incoming → Confirm" flow
- [Sports Interactive Community — Football Manager 26 substitution confirm-button bug reports](https://community.sports-interactive.com/bugtracker/1644_football-manager-26-bugs-tracker/user-interface/2171_matchday-experience-ui-issues/) — confirms confirm-step is load-bearing/expected in shipping products
- [Sportmonks — What are in-game Football Statistics?](https://www.sportmonks.com/glossary/in-game-stats/) — standard stat category taxonomy (attacking/defending/possession/discipline/goalkeeping/set pieces)
- [Using Advanced Football Statistics in 2025 — xG, Possession, and Conversion Insights](https://www.crifosports.com/using-advanced-football-statistics-in-2025-xg-possession-and-conversion-insights/) — confirms xG's now-standard presence on broadcast graphics, often split by half
- [Progressive Disclosure in UX design: Types and use cases (LogRocket)](https://blog.logrocket.com/ux-design/progressive-disclosure-ux-types-use-cases/) — standard collapsible/advanced-section pattern
- [What Is Progressive Disclosure in UX? (UXPin)](https://www.uxpin.com/studio/blog/what-is-progressive-disclosure/) — tiered basic/advanced controls pattern, collapsed-by-default header row
- Internal codebase review (this project): `packages/client/src/components/PieceOverlay.tsx`, `PlayerStatsPanel.tsx`, `LineupAssignmentScreen.tsx`, `GameSettingsScreen.tsx`, `packages/shared/src/stoppagePhases.ts`, `packages/shared/src/types.ts` — grounds every "already exists" and "genuinely novel" claim above in the actual current implementation, not assumption

---

_Feature research for: 2-player real-time hex-grid soccer sim — v1.7 UI consistency, substitution rework, and match summary milestone_
_Researched: 2026-08-21_
