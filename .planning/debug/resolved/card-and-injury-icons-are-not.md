---
status: resolved
trigger: 'card and injury icons are not showing up on the player card in the top left corner'
created: 2026-08-21T22:15:00Z
updated: 2026-08-21T23:15:00Z
---

## Current Focus

reasoning_checkpoint:
hypothesis: "GameBoard.tsx renders its OWN inline duplicate of the top-left player card (`.playerCardFlat` block, lines ~338-380) instead of the shared `<PlayerStatsPanel />` component. Phase 41 plan 41-03 migrated `PlayerStatsPanel.tsx` (adding `<CardInjuryBadge>`), but `PlayerStatsPanel` is never actually rendered in the live app — it is imported only in test files. GameBoard.tsx's inline card only reuses `STAT_LABELS` from that file, reimplements the header/meta row itself, and never imported/rendered `CardInjuryBadge`/`cardColorFor` at all — pre- or post-Phase-41. This explains why name/stats render correctly (GameBoard's own duplicate does that fine) but no badge ever appears for any player, with no console error (the code path to draw it simply does not exist)."
confirming_evidence:

- "grep for `<PlayerStatsPanel` across packages/client/src shows matches ONLY in PlayerStatsPanel.test.tsx and CardInjuryBadge.crossSurface.test.tsx — zero matches in App.tsx or GameBoard.tsx."
- "GameBoard.tsx:27 imports only `{ STAT_LABELS }` from PlayerStatsPanel.js, not the component itself."
- "GameBoard.tsx:332-380 contains a full separate JSX implementation of the player card (TeamBadge, playerCardHeader, playerCardMeta with NationFlag/role/jersey num, playerCardStatGrid) with matching CSS classes in GameBoard.module.css (.playerCardFlat etc, comment: 'flat layout matching PlayerStatsPanel design') — a hand-duplicated sibling, not a re-export."
- "grep for CardInjuryBadge/cardColorFor/yellowCards/redCarded/injuryCount in GameBoard.tsx returns zero matches."
- "Verified dev server (localhost:5173) is serving current disk source for PlayerStatsPanel.tsx via curl fetch of the Vite transform — rules out stale-bundle explanation."
- "All Phase 41 unit/integration tests (57 tests across CardInjuryBadge.test/.audit/.crossSurface + PlayerStatsPanel.test) pass live — proves the shared component and its migration are individually correct; the gap is that the component is orphaned, not that its logic is wrong."
  falsification_test: "If `<PlayerStatsPanel />` were rendered anywhere in App.tsx/GameBoard.tsx's live render tree, this hypothesis would be false. Confirmed via full-codebase grep: no such usage exists outside tests."
  fix_rationale: "Add the same CardInjuryBadge glyph (via cardColorFor(displayPiece) + displayPiece.injuryCount ?? 0) to GameBoard.tsx's own inline .playerCardMeta row, immediately after the jersey number — mirroring the exact pattern already proven correct in PlayerStatsPanel.tsx/PieceOverlay.tsx/LineupAssignmentScreen.tsx/DraftPackCarousel.tsx. This fixes the actual rendered surface without touching the (separately correct, if orphaned) PlayerStatsPanel.tsx component."
  blind_spots: "Have not visually confirmed in a live browser (no headless browser tool available in this environment) — verification will rely on a targeted component test plus static/manual reasoning. Have not investigated why GameBoard.tsx grew a duplicate instead of using PlayerStatsPanel (likely the 2026-07-10 quick task '20260710-player-card-flat-layout' redesigned PlayerStatsPanel.tsx in isolation while GameBoard.tsx's own card evolved separately) — out of scope for this fix, which only restores the missing badge on the live surface."

test: Add CardInjuryBadge to GameBoard.tsx's inline .playerCardMeta row; add/extend a GameBoard test asserting the badge renders for a displayPiece with yellowCards/injuryCount set.
expecting: GameBoard's rendered player card shows the shared card/injury glyph immediately after the jersey number, matching PieceOverlay/PlayerStatsPanel/roster/bench.
next_action: none — resolved and human-verified live in browser.
tdd_checkpoint:
test_file: "packages/client/src/components/GameBoard.test.tsx"
test_name: "GameBoard — top-left player card renders the shared card/injury badge (3 new tests)"
status: "green"
red_confirmation: "Verified red by git-stashing GameBoard.tsx only (keeping the new tests) and re-running — 1 of 66 tests failed with 'Unable to find an element by [data-testid=\"card-injury-badge\"]', confirming the tests genuinely reproduce the bug. Stash popped to restore the fix; all 66 GameBoard tests + full client suite (1051/1051) pass green afterward."

## Symptoms

expected: When a player on the field/pitch is selected and their PlayerStatsPanel card appears top-left, a player who has a yellow card, red card, or injury should show the shared card/injury badge glyph (from CardInjuryBadge.tsx, migrated onto PlayerStatsPanel in Phase 41 plan 41-03) alongside their name/stats.
actual: The player card (name, stats) renders normally, but the card/injury badge glyph does not appear — confirmed specifically with a player known to have a yellow/red card or injury (not just a clean player where no badge is expected).
errors: None visible in the browser console (checked via F12).
reproduction: Start a local match, get a player carded or injured (via the foul/tackle/steal resolution flow), then select that player on the pitch. The PlayerStatsPanel opens top-left but shows no card/injury badge.
started: Discovered live 2026-08-21 immediately after Phase 41 (Card & Injury Iconography) was executed and merged to main — this is the first live browser test of Phase 41's PlayerStatsPanel migration (plan 41-03). Dev server was restarted right before this was found (an old stale server process on :3001 was killed and replaced), so the currently-running server/client are on the latest Phase 41 code.

## Eliminated

- hypothesis: "Stale Vite dev server / browser bundle showing pre-Phase-41 code (only the backend on :3001 was confirmed restarted, not necessarily the Vite client dev server)."
  evidence: "curl fetch of http://localhost:5173/src/components/PlayerStatsPanel.tsx returns the Vite-transformed CURRENT source (CardInjuryBadge import, cardColorFor(piece) call at the correct line) matching disk exactly. Both dev processes (3001 backend, 5173 Vite client) confirmed listening via netstat."
  timestamp: 2026-08-21T22:40:00Z
- hypothesis: "CardInjuryBadge.tsx or PlayerStatsPanel.tsx has a rendering/CSS-variable logic bug (e.g. missing tokens.css variables, geometry bug, wrong prop) causing the glyph to be invisible."
  evidence: "tokens.css is globally imported in main.tsx (defines --color-card-red/--color-card-yellow/--color-text-inverse/--color-card-badge-border). All 57 Phase 41 tests (CardInjuryBadge.test/.audit/.crossSurface + PlayerStatsPanel.test) pass live, including a cross-surface test that renders PlayerStatsPanel and asserts the glyph appears after a live Zustand state update with yellowCards/injuryCount set."
  timestamp: 2026-08-21T22:40:00Z
- hypothesis: "Server-side booking/injury assignment (resolveFoulChain/resolveBooking/applyInjuryDegradation) fails to set yellowCards/redCarded/injuryCount on the piece, or the fields get dropped before broadcast."
  evidence: "gameEngine.ts:919-967 correctly maps updated fields back into `pieces` for both TACKLE_ATTEMPT (line 1343) and STEAL_ATTEMPT (line 1270) call sites; App.tsx's onGameState handler passes the raw broadcast state directly into setGameState with no stripping/transform. This is pre-existing, heavily-tested Phase 39/40 logic, unrelated to Phase 41's scope."
  timestamp: 2026-08-21T22:40:00Z

## Evidence

- timestamp: 2026-08-21T22:45:00Z
  checked: "grep for `<PlayerStatsPanel` usage across packages/client/src"
  found: "Matches ONLY in PlayerStatsPanel.test.tsx and CardInjuryBadge.crossSurface.test.tsx. Zero matches in App.tsx, GameBoard.tsx, or any other production file."
  implication: "PlayerStatsPanel.tsx (the component Phase 41 plan 41-03 migrated to use CardInjuryBadge) is never rendered by the live application — it is effectively dead/orphaned production code, exercised only by its own test suite."

- timestamp: 2026-08-21T22:45:00Z
  checked: "GameBoard.tsx lines 27, 240-381 (imports + 'Track 1 — Left zone: player card' JSX block) and GameBoard.module.css lines 119-210 (.playerCardFlat/.playerCardHeader/.playerCardMeta/.playerCardStatGrid rules)"
  found: "GameBoard.tsx renders its own hand-written inline player card ('.playerCardFlat', comment: 'flat layout matching PlayerStatsPanel design') — TeamBadge, name, NationFlag, role chip, jersey number, and a STAT_LABELS-driven stat grid — built by importing only `STAT_LABELS` from PlayerStatsPanel.js, not the PlayerStatsPanel component. There is no CardInjuryBadge/cardColorFor import or usage anywhere in GameBoard.tsx."
  implication: "This inline block is the ACTUAL 'player card in the top left corner' the user sees. It was never given card/injury glyph treatment — not before Phase 41 (no old YELLOW/RED/INJ chips existed here either) and not after (Phase 41 plan 41-03 only touched the orphaned PlayerStatsPanel.tsx). Root cause confirmed: the migration targeted the wrong (unused) implementation."

## Resolution

root_cause: "GameBoard.tsx renders its own hand-duplicated inline player card ('.playerCardFlat' block) instead of the shared PlayerStatsPanel.tsx component — PlayerStatsPanel is only ever rendered in tests, never in the live app (App.tsx/GameBoard.tsx). Phase 41 plan 41-03 added the shared CardInjuryBadge glyph to PlayerStatsPanel.tsx, but that component is orphaned in production, so the migration never reached the surface players actually see."
fix: "Imported CardInjuryBadge + cardColorFor into GameBoard.tsx and rendered <CardInjuryBadge cardColor={cardColorFor(displayPiece)} injuryCount={displayPiece.injuryCount ?? 0} size={18} /> inside the existing .playerCardMeta row, immediately after the jersey number — matching the established pattern from PieceOverlay/PlayerStatsPanel/LineupAssignmentScreen/DraftPackCarousel."
verification: "Self-verified: (1) added 3 new GameBoard.test.tsx tests asserting no badge for a clean piece, yellow+injury badge for a booked/injured piece, and sticky-persistence of the badge after selectedPieceId clears; (2) confirmed RED by git-stashing only the GameBoard.tsx fix and re-running — the new test failed with 'Unable to find [data-testid=card-injury-badge]', proving the tests genuinely reproduce the reported bug; (3) restored the fix (stash pop) and confirmed GREEN — all 66 GameBoard tests and the full client suite (1051/1051 tests, 37 files) pass; (4) `pnpm -r typecheck` exits 0 for shared/server/client; (5) fetched the fix through the live running Vite dev server (localhost:5173) and confirmed it serves the updated CardInjuryBadge-rendering code. HUMAN VERIFIED LIVE (2026-08-21T23:15:00Z): user hard-refreshed the browser at localhost:5173, got a player carded/injured via the live foul/tackle/steal resolution flow, selected that player on the pitch, and confirmed the card/injury badge glyph now renders correctly on the top-left player card ('it looks correct now'). Session closed."
files_changed:

- packages/client/src/components/GameBoard.tsx
- packages/client/src/components/GameBoard.test.tsx
