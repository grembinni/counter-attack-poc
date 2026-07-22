# Roadmap — Counter Attack Web

## Milestones

- ✅ **v1.0 MVP** — Phases 1–10 (shipped 2026-06-11)
- ✅ **v1.1 UX Tuning & Bug Cleanup** — Phases 11–14 (shipped 2026-06-12)
- ✅ **v1.2 Team Identity & Core Fixes** — Phases 15–18 (shipped 2026-07-03)
- ✅ **v1.3 Team Customization & Formation System** — Phases 19–25 (shipped 2026-07-11)
- ✅ **v1.4 Response Polish + Draft Mode** — Phases 26–30 (shipped 2026-07-22, with 1 known gap — RESP-01..09 deferred; see [audit](milestones/v1.4-MILESTONE-AUDIT.md))
- 🚧 **v1.5 UX Refresh & Code Cleanup** — Phases 31–35 (in progress)

## Phases

<details>
<summary>✅ v1.0 MVP (Phases 1–10) — SHIPPED 2026-06-11</summary>

| Phase | Name                                                  | Plans | Completed  |
| ----- | ----------------------------------------------------- | ----- | ---------- |
| 1     | Monorepo Scaffold + Shared Types                      | 3/3   | 2026-05-28 |
| 2     | Move Validator + Unit Tests                           | 4/4   | 2026-05-29 |
| 3     | Server Room Manager + Socket.io Scaffold              | 3/3   | 2026-05-29 |
| 4     | Game Engine + Phase FSM                               | 3/3   | 2026-05-30 |
| 5     | Dice Resolver + All Resolution Branches               | 4/4   | 2026-05-30 |
| 6     | React Hex Grid Renderer                               | 3/3   | 2026-05-31 |
| 7     | Client-Server Integration                             | 4/4   | 2026-06-03 |
| 7.1   | UI Cleanup (INSERTED)                                 | 3/3   | 2026-06-04 |
| 8     | Match Lifecycle + Post-Game Replay                    | 8/8   | 2026-06-05 |
| 8.1   | Cleanup — Player Stats, Movement, Tackling (INSERTED) | 3/3   | 2026-06-05 |
| 8.2   | Passing Cleanup (INSERTED)                            | 6/6   | 2026-06-07 |
| 9     | Render Deployment                                     | 2/2   | 2026-06-08 |
| 10    | Remaining Action Flows + Tech Debt                    | 5/5   | 2026-06-11 |

Full archive: [milestones/v1.0-ROADMAP.md](milestones/v1.0-ROADMAP.md) · [Requirements](milestones/v1.0-REQUIREMENTS.md)

</details>

<details>
<summary>✅ v1.1 UX Tuning & Bug Cleanup (Phases 11–14) — SHIPPED 2026-06-12</summary>

| Phase | Name                     | Plans | Completed  |
| ----- | ------------------------ | ----- | ---------- |
| 11    | Rule Correctness         | 4/4   | 2026-06-12 |
| 12    | Visual Token & Hex Layer | 4/4   | 2026-06-12 |
| 13    | Layout & Clock           | 3/3   | 2026-06-12 |
| 14    | Kick Off Rules & Replay  | 3/3   | 2026-06-12 |

Full archive: [milestones/v1.1-ROADMAP.md](milestones/v1.1-ROADMAP.md) · [Requirements](milestones/v1.1-REQUIREMENTS.md) · [Audit](milestones/v1.1-MILESTONE-AUDIT.md)

</details>

<details>
<summary>✅ v1.2 Team Identity & Core Fixes (Phases 15–18.4) — SHIPPED 2026-07-03</summary>

| Phase | Name                               | Plans | Completed  |
| ----- | ---------------------------------- | ----- | ---------- |
| 15    | Team Identity                      | 3/3   | 2026-06-13 |
| 16    | Player Roster & Team Selection     | 4/4   | 2026-06-14 |
| 17    | Rule Bugs                          | 6/6   | 2026-06-21 |
| 17.1  | Action Flow Cleanup (INSERTED)     | 16/16 | 2026-06-20 |
| 18    | Messaging & Logging Consistency    | 3/3   | 2026-07-02 |
| 18.1  | Replay Review (INSERTED)           | 2/2   | 2026-06-21 |
| 18.2  | Code Cleanup & Dup-Bugs (INSERTED) | 6/6   | 2026-06-22 |
| 18.3  | Bug-Bash: Rule Correctness         | 5/5   | 2026-07-02 |
| 18.4  | UX Enhancements (INSERTED)         | 7/7   | 2026-07-02 |

Full archive: [milestones/v1.2-ROADMAP.md](milestones/v1.2-ROADMAP.md) · [Requirements](milestones/v1.2-REQUIREMENTS.md)

</details>

<details>
<summary>✅ v1.3 Team Customization & Formation System (Phases 19–25) — SHIPPED 2026-07-11</summary>

| Phase | Name                            | Plans | Completed  |
| ----- | ------------------------------- | ----- | ---------- |
| 19    | Data Model & Team Palette       | 3/3   | 2026-07-03 |
| 20    | Uniform Style System            | 3/3   | 2026-07-04 |
| 21    | New Teams (MLS + International) | 2/2   | 2026-07-04 |
| 22    | Uniform Selection Screen        | 3/3   | 2026-07-05 |
| 23    | Formation System                | 3/3   | 2026-07-05 |
| 24    | Auto-Assignment & Lineup        | 4/4   | 2026-07-10 |
| 25    | Bug & UAT Closure               | 9/9   | 2026-07-11 |

Full archive: [milestones/v1.3-ROADMAP.md](milestones/v1.3-ROADMAP.md) · [Requirements](milestones/v1.3-REQUIREMENTS.md) · [Audit](milestones/v1.3-MILESTONE-AUDIT.md)

</details>

---

<details>
<summary>✅ v1.4 Response Polish + Draft Mode (Phases 26–30) — SHIPPED 2026-07-22 (1 known gap)</summary>

| Phase | Name                          | Plans | Completed  |
| ----- | ----------------------------- | ----- | ---------- |
| 26    | Bug Fixes                     | 3/3   | 2026-07-12 |
| 27    | Game Creation Settings        | 5/5   | 2026-07-21 |
| 28    | Draft Data Model              | 4/4   | 2026-07-21 |
| 29    | Draft UI + Pick-and-Swap Flow | 12/12 | 2026-07-22 |
| 30    | Recalibrate Draft             | 6/6   | 2026-07-22 |

**Known gap:** RESP-01..09 (response-move single-selection activation model — half of this milestone's goal) was never implemented in any phase. Deferred to a future milestone.

Full archive: [milestones/v1.4-ROADMAP.md](milestones/v1.4-ROADMAP.md) · [Requirements](milestones/v1.4-REQUIREMENTS.md) · [Audit](milestones/v1.4-MILESTONE-AUDIT.md)

</details>

---

### 🚧 v1.5 UX Refresh & Code Cleanup (Phases 31–35) — IN PROGRESS

**Milestone Goal:** Overhaul the visual system to a professional broadcast-sports look, standardize hex-highlight colors and the ActionPanel, pay down accumulated code debt, and close 3 known bugs.

**Phase Order Rationale:** Bug fixes and non-visual code cleanup land first (lowest risk, independent of the color system). The design-token layer and full highlight/ring standardization must exist before any component restyling — otherwise restyling reintroduces the exact hardcoded-literal cruft it's meant to remove, and the 60 existing color-literal test assertions must migrate to token-identity before any palette value changes. Component restyling is mechanical once tokens exist. ActionPanel/ActionLog standardization comes last so its button/text work is built on the already-restyled chrome.

| Phase | Name                                      | Plans | Status      |
| ----- | ----------------------------------------- | ----- | ----------- |
| 31    | Bug Fixes                                 | 4     | Not started |
| 32    | Code Cleanup                              | TBD   | Not started |
| 33    | Design Tokens & Highlight Standardization | TBD   | Not started |
| 34    | Visual Theme Restyle                      | TBD   | Not started |
| 35    | ActionPanel & Log Standardization         | TBD   | Not started |

### Phase 31: Bug Fixes

**Goal**: Three known gameplay/replay defects — goal-reset replay reconstruction, End Turn/eligibility-message timing, and goalkeeper deflection eligibility — are fixed and verified.
**Depends on**: Nothing (first phase of v1.5)
**Requirements**: BUG-30, BUG-31, BUG-32
**Success Criteria** (what must be TRUE):

1. After a goal is scored and the match resets to kickoff, replaying that goal shows every player reconstructed at their correct kickoff position (not just some).
2. The eligible-players-remaining message and End Turn button color update the moment a player starts a move (not only once the move is fully completed), and both correctly reflect state again after an Undo.
3. The goalkeeper can never be selected as an eligible deflection responder.

**Plans**: 4 plans (Wave 1: 31-01, 31-02, 31-03 run in parallel; Wave 2: 31-04)
**Wave 1**

- [ ] 31-01-PLAN.md — BUG-30 goal-reset replay reconstruction (`piecesAfter` on GOAL) + folded GK_KICK/LOOSE_BALL_LAND replay verify [Wave 1]
- [ ] 31-02-PLAN.md — BUG-31 move-started eligibility timing + Undo (ActionPanel `remaining`) [Wave 1]
- [ ] 31-03-PLAN.md — BUG-32 GK deflection eligibility (client gate + server rejection, defense-in-depth) [Wave 1]

**Wave 2** _(blocked on Wave 1 completion)_

- [ ] 31-04-PLAN.md — Folded header-winner eligibility todo (`movedPieceIds` on non-goal header routes) [Wave 2, depends 31-01]

### Phase 32: Code Cleanup

**Goal**: Dead code, duplicated color/team-slot lookups, and Zustand/hook inefficiencies are eliminated across the shared/server/client packages, verified by automated tooling.
**Depends on**: Phase 31
**Requirements**: CLEANUP-01, CLEANUP-02, CLEANUP-03, CLEANUP-04
**Success Criteria** (what must be TRUE):

1. An automated dead-code-detection tool run across shared/server/client reports zero flagged unused fields/functions/exports (e.g. the confirmed-dead `shootTargetHex` field is gone).
2. Repeated `TEAM_CONFIGS[...].palette.uiColor` lookups and other duplicated derivation logic (e.g. team-slot/`myTeam` resolution) are each consolidated into one shared helper/hook used everywhere they were previously inlined.
3. Zustand store selectors have no stale dependency arrays or redundant derived-state recomputation, confirmed by a documented selector review.
4. React Hook dependency lint rules are enabled for the client package, and the package lints clean with zero exhaustive-deps violations.
   **Plans**: TBD

### Phase 33: Design Tokens & Highlight Standardization

**Goal**: A single design-token layer and a complete, single-source-of-truth highlight/ring color table replace all ad-hoc chrome and highlight color literals, with existing color-literal tests migrated to token/semantic identity ahead of any palette value changes.
**Depends on**: Phase 32
**Requirements**: THEME-03, HILITE-01, HILITE-02, HILITE-03, HILITE-04, HILITE-05
**Success Criteria** (what must be TRUE):

1. A single CSS custom-property token file defines all chrome colors, and one runtime `--team-accent` variable — derived from the active team's `TEAM_CONFIGS.palette.uiColor` — is the sole source for the per-view accent color (no per-component lookups).
2. `HIGHLIGHT_STYLES` (or its successor) formally covers every real highlight case (~13-14, including GK-kick-target, pass-target, tackle-risk, and ball-position), with no ad-hoc inline highlight-color literals remaining in `HexGrid.tsx`, and the full mapping is written up as a single reference document.
3. Red renders for exactly one meaning app-wide (rule violation/offside); the goal-line shot-target highlight is a distinct, non-red color.
4. The "selected" piece ring and the "already-moved-this-stage" piece ring are visually distinct colors (no longer both identical green).
5. A dedicated, always-on-top ball-location marker highlights the hex containing the ball during response phases (headers, kicks), and all pre-existing color-literal test assertions now assert token/semantic identity instead of literal color strings.
   **Plans**: TBD
   **UI hint**: yes

### Phase 34: Visual Theme Restyle

**Goal**: The deep-blue theme is replaced app-wide with the broadcast-sports charcoal/graphite palette, built entirely on the Phase 33 token layer and contrast-verified.
**Depends on**: Phase 33
**Requirements**: THEME-01, THEME-02, THEME-04
**Success Criteria** (what must be TRUE):

1. The lobby, settings, team/draft-selection, and in-game board all render the dark charcoal/graphite base with crisp white text and a single team-color accent — no remaining deep-blue theme surfaces anywhere.
2. Every chrome-related CSS Module sources its colors exclusively via `var(--token)`; an automated lint (stylelint) confirms zero hardcoded hex/rgba literals remain, and any CSS classes made unreferenced by the sweep are removed.
3. All team accent colors pass WCAG AA contrast against the new charcoal/white base, confirmed by an automated contrast-check script.
4. The full client test suite, typecheck, and build remain green after the palette swap.
   **Plans**: TBD
   **UI hint**: yes

### Phase 35: ActionPanel & Log Standardization

**Goal**: ActionPanel and ActionLog present one consistent visual and language system — format, borders, buttons, and terminology — across every game phase.
**Depends on**: Phase 34
**Requirements**: PANEL-01, PANEL-02, PANEL-03, PANEL-04
**Success Criteria** (what must be TRUE):

1. ActionPanel help text follows one consistent format and tone across every game phase, with no per-phase style drift.
2. No component in the ActionPanel/ActionLog area is framed with a border.
3. Every ActionPanel button shares consistent sizing, color-state logic (ready/pending/disabled), and interaction behavior across every phase.
4. Terminology and phrasing (action names, log verbs, etc.) are consistent across every ActionPanel/ActionLog state.
   **Plans**: TBD
   **UI hint**: yes

---

## Progress

| Phase                           | Milestone | Plans Complete | Status      | Completed  |
| ------------------------------- | --------- | -------------- | ----------- | ---------- |
| 1. Monorepo Scaffold            | v1.0      | 3/3            | Complete    | 2026-05-28 |
| 2. Move Validator               | v1.0      | 4/4            | Complete    | 2026-05-29 |
| 3. Server Room Manager          | v1.0      | 3/3            | Complete    | 2026-05-29 |
| 4. Game Engine + FSM            | v1.0      | 3/3            | Complete    | 2026-05-30 |
| 5. Dice Resolver                | v1.0      | 4/4            | Complete    | 2026-05-30 |
| 6. React Hex Grid               | v1.0      | 3/3            | Complete    | 2026-05-31 |
| 7. Client-Server Integration    | v1.0      | 4/4            | Complete    | 2026-06-03 |
| 7.1. UI Cleanup                 | v1.0      | 3/3            | Complete    | 2026-06-04 |
| 8. Match Lifecycle              | v1.0      | 8/8            | Complete    | 2026-06-05 |
| 8.1. Cleanup                    | v1.0      | 3/3            | Complete    | 2026-06-05 |
| 8.2. Passing Cleanup            | v1.0      | 6/6            | Complete    | 2026-06-07 |
| 9. Render Deployment            | v1.0      | 2/2            | Complete    | 2026-06-08 |
| 10. Remaining Flows             | v1.0      | 5/5            | Complete    | 2026-06-11 |
| 11. Rule Correctness            | v1.1      | 4/4            | Complete    | 2026-06-12 |
| 12. Visual Token & Hex Layer    | v1.1      | 4/4            | Complete    | 2026-06-12 |
| 13. Layout & Clock              | v1.1      | 3/3            | Complete    | 2026-06-12 |
| 14. Kick Off Rules & Replay     | v1.1      | 3/3            | Complete    | 2026-06-12 |
| 15. Team Identity               | v1.2      | 3/3            | Complete    | 2026-06-13 |
| 16. Player Roster & Selection   | v1.2      | 4/4            | Complete    | 2026-06-14 |
| 17. Rule Bugs                   | v1.2      | 6/6            | Complete    | 2026-06-21 |
| 17.1. Action Flow Cleanup       | v1.2      | 16/16          | Complete    | 2026-06-20 |
| 18. Messaging & Logging Cons.   | v1.2      | 3/3            | Complete    | 2026-07-02 |
| 18.1. Replay Review             | v1.2      | 2/2            | Complete    | 2026-06-21 |
| 18.2. Code Cleanup & Dup-Bugs   | v1.2      | 6/6            | Complete    | 2026-06-22 |
| 18.3. Bug-Bash (Rule Correct.)  | v1.2      | 5/5            | Complete    | 2026-07-02 |
| 18.4. UX Enhancements           | v1.2      | 7/7            | Complete    | 2026-07-02 |
| 19. Data Model & Team Palette   | v1.3      | 3/3            | Complete    | 2026-07-03 |
| 20. Uniform Style System        | v1.3      | 3/3            | Complete    | 2026-07-04 |
| 21. New Teams (MLS + Intl)      | v1.3      | 2/2            | Complete    | 2026-07-04 |
| 22. Uniform Selection Screen    | v1.3      | 3/3            | Complete    | 2026-07-05 |
| 23. Formation System            | v1.3      | 3/3            | Complete    | 2026-07-05 |
| 24. Auto-Assignment & Lineup    | v1.3      | 4/4            | Complete    | 2026-07-10 |
| 25. Bug & UAT Closure           | v1.3      | 9/9            | Complete    | 2026-07-11 |
| 26. Bug Fixes                   | v1.4      | 3/3            | Complete    | 2026-07-12 |
| 27. Game Creation Settings      | v1.4      | 5/5            | Complete    | 2026-07-21 |
| 28. Draft Data Model            | v1.4      | 4/4            | Complete    | 2026-07-21 |
| 29. Draft UI + Pick-and-Swap    | v1.4      | 12/12          | Complete    | 2026-07-22 |
| 30. Recalibrate Draft           | v1.4      | 6/6            | Complete    | 2026-07-22 |
| 31. Bug Fixes                   | v1.5      | 0/4            | Not started | -          |
| 32. Code Cleanup                | v1.5      | 0/TBD          | Not started | -          |
| 33. Design Tokens & Highlight   | v1.5      | 0/TBD          | Not started | -          |
| 34. Visual Theme Restyle        | v1.5      | 0/TBD          | Not started | -          |
| 35. ActionPanel & Log Standard. | v1.5      | 0/TBD          | Not started | -          |
