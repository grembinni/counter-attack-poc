---
status: diagnosed
trigger: 'team-roster-confirm-button-outline-mismatch: On the Team Selection screen and the Roster/Lineup Assignment screen, the Confirm button (not-ready/pending gray state and ready/green state) does not follow the button outline styling pattern that Phase 34 (visual-theme-restyle) established for CTA buttons elsewhere in the app.'
created: 2026-07-26T00:00:00Z
updated: 2026-07-26T00:16:00Z
---

## Current Focus

hypothesis: CONFIRMED (see Resolution). TeamSelectionScreen is dead code (superseded by UniformSelectionScreen since Phase 22); UniformSelectionScreen and LineupAssignmentScreen use bespoke Confirm-button classes whose background-color tokens (--color-confirm-pending-bg, --color-success) never matched the shared .ctaButton/.ctaButtonPending/.ctaButtonReady family (--color-bg-surface-alt, --color-cta-pending-bg, --color-cta-ready-bg). Two after-the-fact commits (1a9d2b9, f827e95) already patched only the `border` property on these bespoke classes post-UAT — the color-token mismatch remains.
test: n/a — investigation complete, goal is find_root_cause_only.
expecting: n/a
next_action: Return ROOT CAUSE FOUND to caller.

## Symptoms

expected: The not-ready 'Confirm' button on Team Select and Roster screens should show the same white/light outline (and text-on-grey-background pattern) that other action buttons across the app now have. The ready/green 'Confirm' button should match the styling pattern of other green "ready" buttons elsewhere in the app.
actual: User reports (verbatim, from two separate UAT test failures):

1. "not ready 'confirm' on team select and roster should follow the white outline pattern for other buttons. Green ready 'confirm' should match the other green ready button patterns."
2. "not ready 'confirm' on team select and roster should follow the white outline/text w/grey background pattern for other buttons. Green ready 'confirm' should match the other green ready button patterns."
   errors: None reported (purely visual/styling)
   reproduction: Open the Team Selection screen and the Roster (Lineup Assignment) screen in the client app; observe the Confirm button in both its not-ready and ready states.
   started: Discovered during /gsd-verify-work UAT for Phase 34 (visual-theme-restyle), tests 3 and 8.

## Eliminated

- hypothesis: "TeamSelectionScreen.module.css is the file the user is looking at when they say 'team select'."
  evidence: TeamSelectionScreen.tsx has no Confirm button at all (grep for Confirm/confirm returns zero matches). App.tsx:106-110 `onTeamSelectionStart` always calls `setScreen('UNIFORM_SELECTION')` — the `TEAM_SELECTION` screen state is never set by any socket handler; it's only reachable by directly calling `useGameStore.setState({ screen: 'TEAM_SELECTION' })` in tests (App.test.tsx:115). UniformSelectionScreen.tsx's own doc comment (line 3) states "Replaces TeamSelectionScreen in the pre-game flow" (Phase 22). TeamSelectionScreen is dead/unreachable code in the current app.
  timestamp: 2026-07-26T00:05:00Z

- hypothesis: "The border/outline is still entirely missing on these two Confirm buttons (i.e., the Phase 34 fix pass simply never touched them, full stop)."
  evidence: Current HEAD already has `border: 1px solid var(--color-border-muted)` on UniformSelectionScreen.module.css:228 (.confirmButtonYellow) and :249 (.confirmButtonGreen), and on LineupAssignmentScreen.module.css:65 (.confirmButtonGreen). `git log` shows two dedicated patch commits already applied this: 1a9d2b9 "fix: add outline to uniform-selection Confirm button for CTA consistency" and f827e95 "fix(34): WR-01 add border-legibility fix to Confirm Lineup CTA button". Both commits post-date the UAT run that captured this bug (UAT timestamp 2026-07-26T00:10Z vs commit times 11:25 and 18:14 same day) — meaning they were follow-up attempts to close this exact gap, and they DID add the border. The remaining mismatch is therefore not "no border" but "wrong background-color token/pattern" (see Resolution).
  timestamp: 2026-07-26T00:15:00Z

## Evidence

- timestamp: 2026-07-26T00:05:00Z
  checked: packages/client/src/components/TeamSelectionScreen.tsx, App.tsx:105-133, App.test.tsx:115-120
  found: TeamSelectionScreen has no Confirm button; `TEAM_SELECTION` screen state is set only in tests, never by production socket handlers (onTeamSelectionStart always routes to UNIFORM_SELECTION since Phase 22).
  implication: The user's "Team Selection screen" report refers to UniformSelectionScreen.tsx in practice, not TeamSelectionScreen.tsx.

- timestamp: 2026-07-26T00:08:00Z
  checked: packages/client/src/components/UniformSelectionScreen.module.css:222-266, UniformSelectionScreen.tsx:355
  found: Confirm button toggles between `.confirmButtonYellow` (not-ready, no team picked) and `.confirmButtonGreen` (ready). `.confirmButtonYellow` background = var(--color-confirm-pending-bg) (#eab308). `.confirmButtonGreen` background = var(--color-success) (#22c55e). Both already have `border: 1px solid var(--color-border-muted)`.
  implication: Border already present; background colors are bespoke tokens not shared with the rest of the app's CTA pattern.

- timestamp: 2026-07-26T00:10:00Z
  checked: packages/client/src/components/LineupAssignmentScreen.module.css:60-77, LineupAssignmentScreen.tsx:640-714
  found: Only one Confirm class exists — `.confirmButtonGreen` (background: var(--color-success), border already 1px solid var(--color-border-muted)). Draft mode hides the button entirely until `isLineupComplete` (no visible not-ready state); Standard mode renders it unconditionally as green (assignment is server-pre-filled, so it's never actually "not ready"). No `.confirmButtonYellow`/gray/pending variant exists in this file.
  implication: LineupAssignmentScreen has no true "not-ready" button state in code at all — the reported "not ready roster confirm" issue is either about the same background-color mismatch generalized across both screens, or about perceiving the always-green Standard-mode button as visually distinct from the rest of the app's ready-state green.

- timestamp: 2026-07-26T00:12:00Z
  checked: packages/client/src/components/ActionPanel.module.css:20-42,158-177; packages/client/src/components/KickOffSetupPanel.module.css:35-54
  found: Canonical shared pattern — base `.ctaButton` = background var(--color-bg-surface-alt) #262626, color var(--color-text-inverse) #ffffff, border 1px solid var(--color-border-muted) #a0a0a0 ("white outline/text w/grey background" the user describes). Two-state variant on top of it: `.ctaButtonPending` = background var(--color-cta-pending-bg) #f39c12 (orange); `.ctaButtonReady` = background var(--color-cta-ready-bg) #27ae60 (green).
  implication: This is the established CTA pattern other screens follow. Team Select (UniformSelectionScreen) and Roster (LineupAssignmentScreen) use neither the base grey pattern for not-ready, nor --color-cta-ready-bg for ready — they use unrelated bespoke tokens (--color-confirm-pending-bg #eab308 yellow/gold, --color-success #22c55e) that predate the Phase 33/34 token consolidation.

- timestamp: 2026-07-26T00:14:00Z
  checked: packages/client/src/styles/tokens.css:50-91
  found: Two parallel, never-reconciled green tokens (--color-success #22c55e vs --color-cta-ready-bg #27ae60) and two parallel "pending" tokens with different hues (--color-cta-pending-bg #f39c12 orange vs --color-confirm-pending-bg #eab308 yellow/gold), plus the plain grey --color-bg-surface-alt #262626 used as the "not yet actionable" look elsewhere.
  implication: The token layer itself never unified these two Confirm buttons under the shared CTA-state tokens — confirms this is a scoping/architecture gap dating to Phase 22/24 authoring, not a one-off CSS oversight introduced by Phase 34.

## Resolution

root_cause: |
TeamSelectionScreen.tsx/.module.css is dead code — unreachable since Phase 22 (App.tsx's `onTeamSelectionStart` always calls `setScreen('UNIFORM_SELECTION')`; `TEAM_SELECTION` is only ever set in unit tests). The screen users actually experience as "Team Selection" is UniformSelectionScreen.tsx, which (like LineupAssignmentScreen.tsx) defines its own bespoke Confirm-button CSS classes (.confirmButtonYellow/.confirmButtonGreen) instead of reusing the shared .ctaButton/.ctaButtonPending/.ctaButtonReady class family used by ActionPanel, FreeKickSetupPanel, KickOffSetupPanel, GameSettingsScreen, LobbyScreen, ReplayPanel, and GameBoard's .overlayCtaButton.

Two follow-up commits — 1a9d2b9 (UniformSelectionScreen) and f827e95 (LineupAssignmentScreen) — already added `border: 1px solid var(--color-border-muted)` to these bespoke classes' base rules, and both post-date this UAT run, meaning they were made specifically to try to close this gap. Both are confirmed present in current HEAD. However, neither commit touched the background-color tokens, so the buttons still diverge from the established CTA pattern: - Not-ready state (UniformSelectionScreen only — LineupAssignmentScreen has no not-ready variant at all): `.confirmButtonYellow` uses `--color-confirm-pending-bg` (#eab308, bright yellow/gold) instead of the plain grey `--color-bg-surface-alt` (#262626)/white-text/white-border look ("white outline/text w/grey background") that the rest of the app's default CTA buttons show, or the orange `--color-cta-pending-bg` (#f39c12) used by the app's other two-state "pending" CTA buttons. - Ready state (both screens): `.confirmButtonGreen` uses `--color-success` (#22c55e) instead of `--color-cta-ready-bg` (#27ae60) used by the app's established "ready" CTA state (.ctaButtonReady in ActionPanel/FreeKickSetupPanel).

Root cause classification: architectural/scoping gap. These Confirm buttons were authored in Phase 22/24, before the Phase 33/34 CTA design-token consolidation, using their own dedicated tokens. The Phase 34 border-legibility pass (7 files) plus the two later patch commits treated only the symptom (missing border) on top of these pre-existing bespoke classes, without migrating them onto the shared CTA class family or reconciling their background-color tokens with --color-cta-pending-bg/--color-cta-ready-bg. That's why the buttons now have the correct border but still visually diverge in fill color from the rest of the app's CTA buttons, and why LineupAssignmentScreen still has no genuine not-ready visual state.
fix: (not applied — find_root_cause_only mode)
verification: (not applicable — diagnosis only)
files_changed: []
