# Roadmap — Counter Attack Web

## Milestones

- ✅ **v1.0 MVP** — Phases 1–10 (shipped 2026-06-11)
- ✅ **v1.1 UX Tuning & Bug Cleanup** — Phases 11–14 (shipped 2026-06-12)
- ✅ **v1.2 Team Identity & Core Fixes** — Phases 15–18 (shipped 2026-07-03)
- ✅ **v1.3 Team Customization & Formation System** — Phases 19–25 (shipped 2026-07-11)
- ✅ **v1.4 Response Polish + Draft Mode** — Phases 26–30 (shipped 2026-07-22, with 1 known gap — RESP-01..09 deferred; see [audit](milestones/v1.4-MILESTONE-AUDIT.md))
- ✅ **v1.5 UX Refresh & Code Cleanup** — Phases 31–36 (shipped 2026-08-03; see [audit](milestones/v1.5-MILESTONE-AUDIT.md))
- ✅ **v1.6 Fouls, Cards & Restarts** — Phases 37–40 (shipped 2026-08-17; see [audit](milestones/v1.6-MILESTONE-AUDIT.md))
- ✅ **v1.7 UI Consistency, Substitution Rework & Match Summary** — Phases 41–46 (shipped 2026-08-30)
- 🚧 **v1.8 Roster Interaction Overhaul & Rules Audit** — Phases 47–51 (in progress)

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
| ----- | ----------------------------------- | ----- | ---------- |
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
| ----- | -------------------------------- | ----- | ---------- |
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

<details>
<summary>✅ v1.5 UX Refresh & Code Cleanup (Phases 31–36) — SHIPPED 2026-08-03</summary>

| Phase | Name                                      | Plans | Completed  |
| ----- | ------------------------------------------ | ----- | ---------- |
| 31    | Bug Fixes                                 | 6/6   | 2026-07-24 |
| 32    | Code Cleanup                              | 6/6   | 2026-07-25 |
| 33    | Design Tokens & Highlight Standardization | 7/7   | 2026-07-26 |
| 34    | Visual Theme Restyle                      | 5/5   | 2026-07-27 |
| 35    | ActionPanel & Log Standardization         | 6/6   | 2026-07-27 |
| 36    | Bug Fixes                                 | 5/5   | 2026-08-02 |

Full archive: [milestones/v1.5-ROADMAP.md](milestones/v1.5-ROADMAP.md) · [Requirements](milestones/v1.5-REQUIREMENTS.md) · [Audit](milestones/v1.5-MILESTONE-AUDIT.md)

</details>

<details>
<summary>✅ v1.6 Fouls, Cards & Restarts (Phases 37–40) — SHIPPED 2026-08-17</summary>

| Phase | Name                                          | Plans | Completed  |
| ----- | ---------------------------------------------- | ----- | ---------- |
| 37    | Out-of-Bounds Detection, Throw-In & Goal Kick | 19/19 | 2026-08-07 |
| 38    | Corner Kick                                   | 33/33 | 2026-08-09 |
| 39    | Fouls, Cards, Injuries & Penalty Kicks        | 24/24 | 2026-08-15 |
| 40    | Substitutions                                 | 7/7   | 2026-08-17 |

Full archive: [milestones/v1.6-ROADMAP.md](milestones/v1.6-ROADMAP.md) · [Requirements](milestones/v1.6-REQUIREMENTS.md) · [Audit](milestones/v1.6-MILESTONE-AUDIT.md)

</details>

<details>
<summary>✅ v1.7 UI Consistency, Substitution Rework & Match Summary (Phases 41–46) — SHIPPED 2026-08-30</summary>

| Phase | Name                                        | Plans | Completed  |
| ----- | -------------------------------------------- | ----- | ---------- |
| 41    | Card & Injury Iconography                    | 6/6   | 2026-08-21 |
| 42    | Substitution UX Overhaul                     | 17/17 | 2026-08-23 |
| 43    | Tackle/Steal Prompt & Decline                | 6/6   | 2026-08-23 |
| 44    | Referee Leniency & Advanced Settings Drawer  | 5/5   | 2026-08-28 |
| 45    | Game Summary Popup                           | 6/6   | 2026-08-29 |
| 46    | Final Cleanup                                | 7/7   | 2026-08-30 |

Full archive: [milestones/v1.7-ROADMAP.md](milestones/v1.7-ROADMAP.md) · [Requirements](milestones/v1.7-REQUIREMENTS.md)

</details>

---

### 🚧 v1.8 Roster Interaction Overhaul & Rules Audit (Phases 47–51) — IN PROGRESS

**Milestone Goal:** Replace drag-and-drop with a select-based swap flow for roster positioning and substitutions, fix known GK/final-third/banner-sequencing bugs, lock jersey numbers permanently at kickoff, and run a rulebook-vs-implementation gap analysis to scope the next cleanup milestone.

**Phase Order Rationale:** Select-Based Roster Interaction ships first: it is the milestone's highest regression-risk item (the drag-and-drop it replaces sits on the same roster-screen component tree Phase 42's retrospective called the largest, highest-regression-risk phase of v1.7) and it touches no file any other v1.8 phase touches, so stabilizing it first avoids merge contention with everything downstream. Permanent Jersey Numbers follows immediately because its number-follows-person logic is exercised through the exact `applyRosterReposition` call path Phase 47 rebuilds — testing it against the new click-to-select UI, not the soon-to-be-deleted drag UI, is the more reliable order. GK Box-Entry Sequencing & Final-Third Confirm Fixes is independent of both and bundles two small, non-file-overlapping shot/turn-flow correctness fixes into one phase rather than shipping a second thin single-purpose phase (standard granularity favors 4–6 phases, and a standalone 2-requirement final-third fix would be a thin outlier); it can be planned and executed in parallel with or adjacent to Phase 47/48. Foul→Injury→Booking Banner Sequencing is a standalone investigation-first debug task with no shared files with any other phase — budgeted independently given two prior fix attempts (one already shipped) failed to resolve the live symptom. Rules-Fidelity Gap Analysis runs last: it has no code dependency on any other phase, is a documentation-only audit deliverable, and sequencing it after the other four means it naturally excludes ground this milestone already closed.

| Phase | Name                                                 | Plans | Status      |
| ----- | ----------------------------------------------------- | ----- | ----------- |
| 47    | Select-Based Roster Interaction                       | TBD   | Not started |
| 48    | Permanent Jersey Numbers                              | TBD   | Not started |
| 49    | GK Box-Entry Sequencing & Final-Third Confirm Fixes   | TBD   | Not started |
| 50    | Foul→Injury→Booking Banner Sequencing                 | TBD   | Not started |
| 51    | Rules-Fidelity Gap Analysis                           | TBD   | Not started |

### Phase 47: Select-Based Roster Interaction

**Goal**: Every roster/lineup surface in `LineupAssignmentScreen.tsx` — mid-match positioning, mid-match substitution, Standard pregame lineup swap, and the draft-mode pack/bench/lineup carousel — uses click-to-select (green selected / blue eligible targets) instead of drag-and-drop, matching the click-to-select interaction the rest of the game already uses everywhere else. (Widened from "mid-match only" during `/gsd-discuss-phase 47` — see `47-CONTEXT.md`.)
**Depends on**: Phase 46 (last phase of v1.7) — first phase of v1.8; touches no other v1.8 phase's files, so it is sequenced first to avoid merge contention
**Requirements**: ROSTER-01, ROSTER-02, ROSTER-03, ROSTER-04, ROSTER-05, ROSTER-06, ROSTER-07, ROSTER-08
**Success Criteria** (what must be TRUE):

1. Clicking a player card on the mid-match roster screen selects it, shown with a green outline.
2. Selecting a player highlights every eligible swap/substitution target in blue.
3. Clicking the selected player again deselects it and clears the blue eligible-target highlights.
4. Clicking an eligible blue target completes the swap in positioning mode, or stages the substitution in substitution mode, exactly matching today's existing confirm flow.
5. Positioning-mode and substitution-mode eligibility/guard logic remain two structurally separate functions, and no drag-and-drop state, handlers, or types remain in `LineupAssignmentScreen.tsx` — confirmed by a clean `knip` run.
6. The Standard pregame lineup screen's slot-swap uses the same click-to-select model (select a card, click an eligible slot to swap) — no drag-and-drop remains there either.
7. The draft-mode pack carousel and bench/slot rearrange use the same click-to-select model: selecting a pack card highlights eligible slots/bench in blue (mirrors mid-match substitution's bench-first pattern); selecting a filled slot or bench card highlights eligible slots/bench in blue (mirrors mid-match positioning's swap pattern). GK-slot and swap-vs-move semantics are unchanged from today.

**Plans**: TBD
**UI hint**: yes

### Phase 48: Permanent Jersey Numbers

**Goal**: Every player is assigned one jersey number at squad-build time that never changes for the rest of the match, regardless of position changes, substitutions, or resets.
**Depends on**: Phase 47 — `applyRosterReposition`, one of this phase's required update sites, is exercised end-to-end by the click-to-select interaction Phase 47 builds; testing number-follows-person logic against the new UI (not the soon-to-be-deleted drag UI) is more reliable
**Requirements**: NUMBER-01, NUMBER-02, NUMBER-03, NUMBER-04, NUMBER-05
**Success Criteria** (what must be TRUE):

1. Each player is assigned a jersey number once at squad-build time, independent of formation/lineup slot.
2. A player's jersey number is unchanged after repositioning, after a substitution, after a goal (by shot or penalty), and after half-time.
3. The kickoff striker is selected by role, not by checking for jersey number 9 — kickoff still starts with the correct player regardless of what number they're wearing.
4. No reset path (goal-via-shot, goal-via-penalty, half-time, or any other `applyRosterContinuity` call site) ever reassigns a player's permanent number to someone else.
5. Draft-mode bench players also receive a permanent number assigned once, not re-rolled on a later view or redraw.

**Plans**: TBD

### Phase 49: GK Box-Entry Sequencing & Final-Third Confirm Fixes

**Goal**: Two independent goalkeeper/turn-flow correctness fixes land together — the box-entry reposition offer fires while it can still matter, and the end-turn confirm control stops treating "only the GK is left" as an incomplete turn.
**Depends on**: Nothing beyond Phase 46 — independent of Phases 47-48, no shared files with either; small and self-contained enough to slot in wherever convenient
**Requirements**: GKSEQ-01, GKSEQ-02, GKSEQ-03, FINALTHIRD-01, FINALTHIRD-02
**Success Criteria** (what must be TRUE):

1. On an outside-the-box shot on goal, the defending manager is offered the goalkeeper box-entry reposition before the shot-blocking dive resolves, not after.
2. The box-entry offer appears at most once per shot.
3. Every existing shot, header, corner-kick, penalty-kick, and GK-catch scenario plays out exactly as it did before this phase — zero behavior change to those paths.
4. The end-turn confirm button shows green (not the warning color) when the only player who hasn't moved is the goalkeeper.
5. No "not all players moved" warning appears when the only unmoved player is the goalkeeper.

**Plans**: TBD

### Phase 50: Foul→Injury→Booking Banner Sequencing

**Goal**: The foul → injury → booking banner sequence reliably displays every banner, in order, with no skipped or overlapping banners — closing the bug that has been open and paused since v1.6.
**Depends on**: Nothing beyond Phase 46 — standalone investigation with no shared files with Phases 47-49
**Requirements**: BANNER-01, BANNER-02
**Success Criteria** (what must be TRUE):

1. In a live two-browser session, a foul that produces card and/or injury events shows each banner in the confirmed correct order, with no banner skipped or overlapping another.
2. The confirmed-correct display order is captured as a regression test, so the sequencing cannot silently regress again.

**Plans**: TBD

### Phase 51: Rules-Fidelity Gap Analysis

**Goal**: A findings document exists that cross-references the physical rulebook against the current implementation, ready to scope a future rules-fidelity cleanup milestone.
**Depends on**: Phases 47-50 — sequenced last (not a code dependency) so the audit naturally excludes ground this milestone already covered
**Requirements**: AUDIT-01, AUDIT-02, AUDIT-03
**Success Criteria** (what must be TRUE):

1. A findings document cross-references rulebook v1.4.1 clauses against the current implementation, classifying each finding as gap / intentional-simplification / false-positive, in the established `vX-MILESTONE-AUDIT.md` format.
2. Every finding was checked against PROJECT.md's Deferred/Out-of-Scope/Key-Decisions tables first, and no already-known deferral (e.g. FTP_MOVE_ENABLED, NUTMEG-01+, RESP-01..09) is logged as a new gap.
3. The milestone's commits for this phase show zero source-file diffs outside `.planning/`.

**Plans**: TBD

---

## Progress

| Phase                                     | Milestone | Plans Complete | Status      | Completed  |
| ------------------------------------------ | --------- | -------------- | ----------- | ---------- |
| 1. Monorepo Scaffold                     | v1.0      | 3/3            | Complete    | 2026-05-28 |
| 2. Move Validator                        | v1.0      | 4/4            | Complete    | 2026-05-29 |
| 3. Server Room Manager                   | v1.0      | 3/3            | Complete    | 2026-05-29 |
| 4. Game Engine + FSM                     | v1.0      | 3/3            | Complete    | 2026-05-30 |
| 5. Dice Resolver                         | v1.0      | 4/4            | Complete    | 2026-05-30 |
| 6. React Hex Grid                        | v1.0      | 3/3            | Complete    | 2026-05-31 |
| 7. Client-Server Integration             | v1.0      | 4/4            | Complete    | 2026-06-03 |
| 7.1. UI Cleanup                          | v1.0      | 3/3            | Complete    | 2026-06-04 |
| 8. Match Lifecycle                       | v1.0      | 8/8            | Complete    | 2026-06-05 |
| 8.1. Cleanup                             | v1.0      | 3/3            | Complete    | 2026-06-05 |
| 8.2. Passing Cleanup                     | v1.0      | 6/6            | Complete    | 2026-06-07 |
| 9. Render Deployment                     | v1.0      | 2/2            | Complete    | 2026-06-08 |
| 10. Remaining Flows                      | v1.0      | 5/5            | Complete    | 2026-06-11 |
| 11. Rule Correctness                     | v1.1      | 4/4            | Complete    | 2026-06-12 |
| 12. Visual Token & Hex Layer             | v1.1      | 4/4            | Complete    | 2026-06-12 |
| 13. Layout & Clock                       | v1.1      | 3/3            | Complete    | 2026-06-12 |
| 14. Kick Off Rules & Replay              | v1.1      | 3/3            | Complete    | 2026-06-12 |
| 15. Team Identity                        | v1.2      | 3/3            | Complete    | 2026-06-13 |
| 16. Player Roster & Selection            | v1.2      | 4/4            | Complete    | 2026-06-14 |
| 17. Rule Bugs                            | v1.2      | 6/6            | Complete    | 2026-06-21 |
| 17.1. Action Flow Cleanup                | v1.2      | 16/16          | Complete    | 2026-06-20 |
| 18. Messaging & Logging Cons.            | v1.2      | 3/3            | Complete    | 2026-07-02 |
| 18.1. Replay Review                      | v1.2      | 2/2            | Complete    | 2026-06-21 |
| 18.2. Code Cleanup & Dup-Bugs            | v1.2      | 6/6            | Complete    | 2026-06-22 |
| 18.3. Bug-Bash (Rule Correct.)           | v1.2      | 5/5            | Complete    | 2026-07-02 |
| 18.4. UX Enhancements                    | v1.2      | 7/7            | Complete    | 2026-07-02 |
| 19. Data Model & Team Palette            | v1.3      | 3/3            | Complete    | 2026-07-03 |
| 20. Uniform Style System                 | v1.3      | 3/3            | Complete    | 2026-07-04 |
| 21. New Teams (MLS + Intl)               | v1.3      | 2/2            | Complete    | 2026-07-04 |
| 22. Uniform Selection Screen             | v1.3      | 3/3            | Complete    | 2026-07-05 |
| 23. Formation System                     | v1.3      | 3/3            | Complete    | 2026-07-05 |
| 24. Auto-Assignment & Lineup             | v1.3      | 4/4            | Complete    | 2026-07-10 |
| 25. Bug & UAT Closure                    | v1.3      | 9/9            | Complete    | 2026-07-11 |
| 26. Bug Fixes                            | v1.4      | 3/3            | Complete    | 2026-07-12 |
| 27. Game Creation Settings               | v1.4      | 5/5            | Complete    | 2026-07-21 |
| 28. Draft Data Model                     | v1.4      | 4/4            | Complete    | 2026-07-21 |
| 29. Draft UI + Pick-and-Swap             | v1.4      | 12/12          | Complete    | 2026-07-22 |
| 30. Recalibrate Draft                    | v1.4      | 6/6            | Complete    | 2026-07-22 |
| 31. Bug Fixes                            | v1.5      | 6/6            | Complete    | 2026-07-24 |
| 32. Code Cleanup                         | v1.5      | 6/6            | Complete    | 2026-07-25 |
| 33. Design Tokens & Highlight            | v1.5      | 7/7            | Complete    | 2026-07-26 |
| 34. Visual Theme Restyle                 | v1.5      | 5/5            | Complete    | 2026-07-27 |
| 35. ActionPanel & Log Standard.          | v1.5      | 6/6            | Complete    | 2026-07-27 |
| 36. Bug Fixes                            | v1.5      | 5/5            | Complete    | 2026-08-02 |
| 37. OOB Detection, Throw-In & Goal Kick  | v1.6      | 19/19          | Complete    | 2026-08-07 |
| 38. Corner Kick                          | v1.6      | 33/33          | Complete    | 2026-08-09 |
| 39. Fouls, Cards & Penalty Kicks         | v1.6      | 24/24          | Complete    | 2026-08-15 |
| 40. Substitutions                        | v1.6      | 7/7            | Complete    | 2026-08-17 |
| 41. Card & Injury Iconography            | v1.7      | 6/6            | Complete    | 2026-08-21 |
| 42. Substitution UX Overhaul             | v1.7      | 17/17          | Complete    | 2026-08-23 |
| 43. Tackle/Steal Prompt & Decline        | v1.7      | 6/6            | Complete    | 2026-08-23 |
| 44. Referee Leniency & Advanced Settings | v1.7      | 5/5            | Complete    | 2026-08-28 |
| 45. Game Summary Popup                   | v1.7      | 6/6            | Complete    | 2026-08-29 |
| 46. Final Cleanup                        | v1.7      | 7/7            | Complete    | 2026-08-30 |
| 47. Select-Based Roster Interaction      | v1.8      | 0/TBD          | Not started | -          |
| 48. Permanent Jersey Numbers             | v1.8      | 0/TBD          | Not started | -          |
| 49. GK Sequencing & Final-Third Fixes    | v1.8      | 0/TBD          | Not started | -          |
| 50. Foul→Injury→Booking Banner Seq.      | v1.8      | 0/TBD          | Not started | -          |
| 51. Rules-Fidelity Gap Analysis          | v1.8      | 0/TBD          | Not started | -          |

## Backlog

### Phase 999.1: Shot-from-out-of-box does not trigger expected goalie response move (BACKLOG)

**Goal:** [Captured for future planning]
**Requirements:** TBD
**Plans:** 7/7 plans complete

Plans:

- [ ] TBD (promote with /gsd-review-backlog when ready)
