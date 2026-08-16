---
status: resolved
trigger: 'bug - remove player with 1 red card from the field and put on bench. make note to force one open spot on roster when subbing for each player removed this way. i.e. a team with 1 red card can only have 10 players on the field - even after subbing'
created: 2026-08-16T00:19:29Z
updated: 2026-08-16T01:20:00Z
---

## Current Focus

status: PART 1 IMPLEMENTED AND SELF-VERIFIED (2026-08-16). Both authorized items landed:
(a) a redCarded piece now gets `onPitch: false` (new optional PlayerPiece field) at the moment
it is booked, and HexGrid.tsx's piece-render map skips rendering any piece with
`onPitch === false` — `position` itself is left untouched, per the CARD-02/CARD-04 comment at
applyMove's redCarded rejection. (b) computeGoalKickEligibleIds, computeCornerKickEligibleIds,
and applyFreeMoveZoneCheck's free-move eligible-list computation now all filter out
`redCarded` pieces, mirroring computePenaltyKickEligibleIds's existing pattern. Part (2)
(SUB-06 permanent 10-player-cap-survives-subs) was NOT touched — still blocked on Phase 40.
Awaiting human confirmation in a live two-browser session before archiving.

hypothesis: CONFIRMED. See Resolution.root_cause below (unchanged from diagnosis — this session
went straight from an already-approved root cause to implementation, no re-investigation).
test: full server + client vitest suites (1340 server tests, 957 client tests) plus targeted new
tests for the redCarded exclusion in all three eligibility functions and the onPitch render-skip
in HexGrid — all green. `pnpm -r typecheck` clean across shared/server/client. Lint and prettier
clean on all touched files.
expecting: n/a — hypothesis confirmed, fix applied and self-verified.
next_action: AWAITING HUMAN VERIFICATION. User should red-card a player in a live two-browser
match (second yellow or straight red from a Professional Foul) and confirm: (1) the dismissed
piece disappears from the pitch entirely (not just flagged) while every other piece keeps
rendering normally; (2) the dismissed piece cannot be offered/selected during goal-kick,
corner-kick, or free-move (ball-zone-crossing) reposition windows. Once confirmed, run
archive_session (move file to resolved/, commit, append knowledge-base entry).
reasoning_checkpoint:
hypothesis: "A redCarded PlayerPiece stays visually on the pitch (only a `redCarded: true` flag is set, position is never relocated/hidden) because no off-pitch/non-rendered board-state representation exists, AND three eligibility-computation functions (computeGoalKickEligibleIds, computeCornerKickEligibleIds, applyFreeMoveZoneCheck's free-move list) never learned the `redCarded !== true` exclusion pattern that computePenaltyKickEligibleIds and isProfessionalFoul already use — so a sent-off piece can still be offered for goal-kick/corner-kick/free-move repositioning."
confirming_evidence: - "grep of every redCarded check-site in gameEngine.ts + fouls.ts (Evidence entry 2026-08-16T00:30:00Z) showed movement, penalty-taker-select, and professional-foul-coverage all correctly exclude redCarded, but nothing removes the piece from state.pieces or hides it from rendering." - "Direct read of computeGoalKickEligibleIds (gameEngine.ts:5965-5976 pre-fix), computeCornerKickEligibleIds (gameEngine.ts:5387-5397 pre-fix), and applyFreeMoveZoneCheck (gameEngine.ts:2798-2852 pre-fix) confirmed none of the three filtered on `p.redCarded`, while computePenaltyKickEligibleIds (gameEngine.ts:6597-6605) does via `p.redCarded !== true`." - "grep for 'bench' across packages/ (Evidence entry 2026-08-16T00:34:00Z) confirmed no in-match roster/bench UI or GameState field exists — BenchCarousel.tsx/LineupAssignmentScreen.tsx are pre-match-only — so a new lightweight board-state flag was the only viable Part-1 fix, not a UI reuse."
falsification_test: "If a redCarded piece were found to already be excluded from goal-kick/corner-kick/free-move eligible lists (i.e. the grep evidence was wrong), OR if PlayerPiece.position were already nulled/relocated somewhere on dismissal, the hypothesis would be false. Neither was observed anywhere in gameEngine.ts."
fix_rationale: "Adding a minimal `onPitch?: boolean` field (default true/undefined) plus a client-side render-skip guard addresses the root cause directly (piece stays rendered because nothing ever told the renderer to stop) without touching `position` (which applyMove's CARD-02/CARD-04 comment says must stay a real HexCoord because the piece is deliberately kept in `state.pieces` and rejected by id, not by absent position) and without building any Substitution/roster data model. Adding the missing `redCarded !== true` filter to the three eligibility functions closes the actual rules gap (a sent-off piece could still be selected/repositioned during those three restart windows) by copying the exact pattern already proven correct at computePenaltyKickEligibleIds and isProfessionalFoul."
blind_spots: "Did not verify behavior in a live two-browser session (only automated unit/integration tests + typecheck). Did not check whether a redCarded GK specifically (as opposed to an outfielder) hitting onPitch:false interacts oddly with GK_DIVE's displayPiece override in HexGrid.tsx (a redCarded GK is an edge case Phase 39 may not have fully covered; the render-skip guard runs before the GK_DIVE override so it should short-circuit cleanly, but this exact scenario has no dedicated test). Did not touch PlayerStatsPanel or any other UI surface that lists pieces outside the pitch — only the HexGrid pitch-rendering path was changed, per the authorized fix_scope."
tdd_checkpoint: null

## Symptoms

expected (per user): (1) A player who receives a red card is removed from the pitch and placed on the bench (not left standing on the board with just a flag). (2) Structurally, this vacated on-field slot should be permanently unfillable by a substitute — i.e. a team that has taken 1 red card is capped at 10 on-field players for the rest of the match, even after using its substitution allowance for other (injured/other) players.
actual: A red-carded piece keeps `position` on the pitch and is only marked `redCarded: true`; it is excluded from certain eligibility checks (movement-cycle/duel participation confirmed elsewhere in Phase 39's own gap-closure work, e.g. Professional Foul teammate-coverage exclusion) but is not removed from the board, and no roster/bench/substitution-slot mechanic exists at all yet to express "permanently capped at 10."
errors: none — this is a missing-feature / design-scope question, not a crash
reproduction: Get a player red-carded (second yellow, or a straight red from a Professional Foul) in a live match; observe the piece remains visibly on the pitch at its position rather than moving to a bench/roster area.
started: Reported in live two-browser testing session immediately after Phase 39 gap-closure plans 39-18 through 39-24 landed (2026-08-15/16). The underlying `redCarded` flag mechanic itself is original Phase 39 scope (CARD-02); the bench/roster/substitution-slot-capping half was never in Phase 39's requirement list (SUB-01..07 belong to Phase 40, "Not started" per ROADMAP/STATE as of this session).

## Eliminated

- hypothesis: "Both halves of the user's request are already fully blocked/out of scope for now (nothing actionable without Phase 40)."
  evidence: The visual/positional half (piece stays rendered at its pitch position after being sent off) has no dependency on the Substitution system at all — it is a pure board-state/rendering change to how a `redCarded` piece is displayed and positioned, independent of CARD-02's "no substitute replacement" rule. This part is actionable now as Phase 39 polish scope.
  timestamp: 2026-08-16T00:35:00Z

## Evidence

- timestamp: 2026-08-16T00:25:00Z
  checked: .planning/phases/39-fouls-cards-injuries-penalty-kicks/39-CONTEXT.md (D-06) and .planning/REQUIREMENTS.md CARD-02/SUB-01..07 sections + traceability table
  found: CARD-02 text is "A player's second yellow card (tracked per-player) becomes a red card for that player — immediate dismissal, no substitute replacement" — no explicit requirement to physically relocate the piece to a bench. D-06 explicitly confirms "Phase 39 always takes the 'no substitute available' branch" for INJURY-03 and that "Phase 40 later adds the actual forced-substitution trigger." SUB-06 ("A red-carded (sent-off) player cannot be replaced by a substitute") is the exact requirement matching the user's "force one open spot... even after subbing" ask. Traceability table shows SUB-01..07 all rows = "Phase 40 | Pending".
  implication: The user's second ask (permanent 10-player cap surviving substitutions) maps 1:1 onto an already-locked, not-yet-built requirement (SUB-06) — not a new idea to design, just a not-yet-implemented one.

- timestamp: 2026-08-16T00:27:00Z
  checked: .planning/ROADMAP.md (Phase 40 section, line 136 status table + line 416-418 goal) and .planning/STATE.md (Phase Status table, line 84, "Current focus" line 31)
  found: Phase 40 "Substitutions" status = "Not started" in both ROADMAP.md and STATE.md. ROADMAP.md's Phase 40 goal text explicitly names "restrictions on red-carded or previously-substituted players" as in-scope for that phase.
  implication: Confirms Phase 40 is genuinely un-started — the substitution-slot-capping half cannot be implemented now without building Phase 40 first.

- timestamp: 2026-08-16T00:30:00Z
  checked: grepped every `redCarded` check-site in packages/server/src/gameEngine.ts and packages/shared/src/fouls.ts
  found: A redCarded piece IS currently blocked from: (1) normal MOVEMENT-phase movement (`applyMove` line 980, explicit `MOVE_INVALID`/`RED_CARDED` rejection, added specifically because the piece is deliberately kept in `state.pieces` rather than spliced out — see comment at line 977-979); (2) being selected as a penalty-kick taker (`applyPenaltyKickTaker` line 7029, `TAKER_INVALID`); (3) counting as a "covering teammate" for Professional-Foul detection (`fouls.ts` `isProfessionalFoul` line 220, `candidate.redCarded !== true`); (4) being the GK for dive-at-feet/box-entry-response offers (lines 1710, 2206 — GK's own redCarded status returns `null`, no offer). `computePenaltyKickEligibleIds` (line 6590) also filters redCarded out of penalty-kick reposition-window eligibility.
  implication: Confirms the debug file's Current Focus premise — a redCarded piece IS already excluded from its own direct participation in movement, penalty-taking, and professional-foul coverage. This supports treating "remove from pitch visually" as cosmetic/board-state only for THESE specific mechanics.

- timestamp: 2026-08-16T00:32:00Z
  checked: computeGoalKickEligibleIds (gameEngine.ts:5953), computeCornerKickEligibleIds (gameEngine.ts:5375), and applyFreeMoveZoneCheck's free-move eligible-list computation (gameEngine.ts:2811-2815) plus the apply functions that consume those lists (applyGoalKickReposition, applyCornerKickReposition, applyFreeMove) for any independent redCarded guard
  found: NONE of these three eligibility computations filter out `redCarded` pieces (contrast with computePenaltyKickEligibleIds, which does). computeGoalKickEligibleIds filters only by region (homeThird/awayThird); computeCornerKickEligibleIds filters only by `role !== 'GK'` and not-the-taker; the free-move zone-check filters only by region. The three consuming apply-functions (applyGoalKickReposition, applyCornerKickReposition, applyFreeMove) have no additional `piece.redCarded` guard of their own — they trust the precomputed eligible-list. A red-carded piece can therefore still be selected and repositioned during goal-kick, corner-kick, and free-move (ball-zone-crossing) reposition windows today.
  implication: The "is a redCarded piece already excluded from all game logic" premise is only PARTIALLY true — this is a genuine, pre-existing correctness gap (inconsistent with the penalty-kick/professional-foul sites that DO exclude redCarded), not merely a cosmetic non-issue. It strengthens the case that "remove the piece from the pitch" is not purely a rendering nicety: as long as the piece keeps a valid on-pitch `position`, it can still participate in these three reposition mechanics, which is an actual rules violation of CARD-02's "immediate dismissal." Actually relocating/flagging the piece as off-pitch (or, short of that, adding `redCarded` exclusion to these three eligible-list functions) would close this gap.

- timestamp: 2026-08-16T00:34:00Z
  checked: grepped "bench" (case-insensitive) across packages/ to determine whether in-match roster/bench UI infrastructure already exists
  found: The only "bench" concept in the codebase is `BenchCarousel.tsx` / `LineupAssignmentScreen.tsx`, used exclusively in the PRE-match lineup-assignment/draft screen (choosing starting 11 vs. bench from the drafted pool). There is no in-match "Roster screen" component, no in-match bench data structure on `GameState`, and no drag-and-drop substitution UI — this is exactly what SUB-02 ("Substitutions are made via the Roster screen using drag-and-drop...") specifies as new Phase 40 work.
  implication: "Move the sent-off piece to the bench" cannot reuse existing in-match UI (none exists) and is not a trivial one-line fix — it requires either (a) a genuinely new lightweight "dismissed players" board-state representation scoped to Phase 39 (position becomes null/off-board, piece stops rendering on the pitch, no roster/substitution semantics attached), or (b) waiting for Phase 40's real Roster screen. Option (a) is achievable without touching Substitutions; option (b) folds this into Phase 40 instead.

## Resolution

root_cause: |
The user's single bug report actually bundles two independently-scoped issues that must be split:

(1) "Remove the red-carded player from the field and put on bench" — CARD-02 ("immediate dismissal,
no substitute replacement") is functionally implemented as a `redCarded: true` flag that already
blocks the piece from normal movement, penalty-taking, and Professional-Foul teammate-coverage — but
the piece is deliberately kept in `state.pieces` at its live pitch position (comment at
gameEngine.ts:977-979) rather than removed/relocated, so it stays rendered on the board. Additionally,
investigation found the exclusion is INCONSISTENT: three other eligibility computations
(computeGoalKickEligibleIds, computeCornerKickEligibleIds, and applyFreeMoveZoneCheck's free-move
eligible list) do NOT filter out redCarded pieces, unlike computePenaltyKickEligibleIds and
isProfessionalFoul which do. This means a sent-off piece can still be selected/repositioned during
goal-kick, corner-kick, and free-move reposition windows — a real (if narrow) rules gap, not just a
cosmetic one. This half is in-scope for a Phase 39 follow-up fix: no in-match "Roster/bench" UI exists
yet (the only BenchCarousel is pre-match lineup drafting), so the fix is a board-state change — give
the redCarded piece an off-pitch/no-longer-rendered representation and close the three missed
eligible-list exclusion sites — WITHOUT touching CARD-02's "no substitute replacement" rule or
building any Substitution mechanics.

(2) "Force one open spot on roster when subbing... team with 1 red card can only have 10 players even
after subbing" — this maps exactly onto the already-locked SUB-06 requirement ("A red-carded
(sent-off) player cannot be replaced by a substitute"), which is explicitly Phase 40 (Substitutions)
scope. REQUIREMENTS.md's traceability table lists all of SUB-01..07 as "Phase 40 | Pending", and both
ROADMAP.md and STATE.md confirm Phase 40 is "Not started." 39-CONTEXT.md D-06 explicitly documents
that Phase 39 defers all substitution mechanics to Phase 40 by design. No substitution/roster/bench
data model exists in GameState today to express "permanently unfillable slot." This half cannot be
implemented without building Phase 40 first, and doing so ad hoc now risks conflicting with Phase 40's
eventual SUB-01..07 design (e.g., how the 3-substitution cap, jersey/position inheritance, and
added-time interact with a red-card-vacated slot).
fix: |
Part (1) of the root cause implemented, per explicit user approval (2026-08-16). Part (2)
(SUB-06 permanent-cap-survives-subs) deliberately NOT implemented — remains blocked on Phase 40.

(a) Off-pitch / non-rendered representation for a dismissed piece:

- Added a new optional `onPitch?: boolean` field to `PlayerPiece`
  (packages/shared/src/types.ts). Semantics: true/undefined = renders normally at `position`
  (the default for every existing piece — fully additive, no migration needed). `false` = the
  client stops rendering the piece on the pitch. `position` is DELIBERATELY left untouched —
  the field doc comment cross-references the CARD-02/CARD-04 comment at applyMove's redCarded
  rejection (gameEngine.ts) explaining why `position` must stay a real on-pitch HexCoord (the
  piece is kept in `state.pieces` and rejected by id, not by absent position).
- gameEngine.ts's booking-resolution red-card branch (the sole `redCarded: true` assignment
  site, inside the STEAL_ATTEMPT/foul-resolution flow) now also sets `onPitch: false` in the
  same object-spread update.
- packages/client/src/components/HexGrid.tsx: added an early `if (piece.onPitch === false)
return null;` guard at the very top of the `pieces.map(...)` callback that renders
  `<PieceOverlay>` — this runs before any of the ~150 lines of derived
  selection-state/click-handler logic in that callback, so a dismissed piece is fully skipped
  rather than rendered inert. `PieceOverlay.tsx` itself was left untouched (still a pure
  renderer with no onPitch awareness) so its existing direct-render tests (card badge
  rendering for a redCarded piece) keep passing unmodified — the skip decision lives entirely
  in the parent's render-map, not the leaf component.

(b) Closed the 3 missed `redCarded` eligible-list exclusion gaps in gameEngine.ts, all mirroring
computePenaltyKickEligibleIds's existing `p.redCarded !== true` pattern:

- `computeGoalKickEligibleIds` (~line 5965): eligible-pieces filter now requires
  `p.redCarded !== true` in addition to the existing homeThird/awayThird region check.
- `computeCornerKickEligibleIds` (~line 5387): eligible-pieces filter now also requires
  `p.redCarded !== true` alongside the existing `role !== 'GK'` and not-the-taker checks.
- `applyFreeMoveZoneCheck` (~line 2798), the free-move eligible-list computation: the
  `eligiblePieces` filter now also requires `p.redCarded !== true` alongside the existing
  opposite-final-third region check.
  Doc comments on all three functions were updated to note the new exclusion and its rationale.
  verification: |
  Self-verified (no live two-browser session run in this agent turn — flagged as the
  awaiting_human_verify checkpoint):
- `pnpm -r typecheck` — clean across packages/shared, packages/server, packages/client (had to
  rebuild packages/shared's dist once via `pnpm --filter @counter-attack/shared build` first, so
  the client's workspace-linked type import picked up the new `onPitch` field).
- Full server vitest suite: 53 test files, 1340 passed, 1 skipped, 1 todo — zero failures,
  including all pre-existing goal-kick/corner-kick/free-move/booking/penalty-kick suites.
- Full client vitest suite: 34 test files, 957 passed — zero failures, including
  HexGrid.test.tsx's pre-existing PENALTY_KICK_TAKER_SELECT redCarded-teammate test (still
  passes unchanged, since that test never sets onPitch and this fix's guard only fires on an
  explicit `onPitch === false`) and PieceOverlay.test.tsx's direct-render card-badge tests
  (untouched, PieceOverlay itself was not modified).
- New tests added and passing (6 total): 1 in gameEngine.outOfBounds.test.ts
  (computeGoalKickEligibleIds excludes redCarded despite in-region position), 1 in
  gameEngine.cornerKick.test.ts (computeCornerKickEligibleIds excludes redCarded), 1 in
  gameEngine.phase17.test.ts (applyFreeMoveZoneCheck excludes redCarded from the eligible
  list), 1 in gameEngine.booking.test.ts (booking a second-yellow red card sets
  `onPitch: false` while leaving `position` unchanged), 3 in HexGrid.test.tsx (a piece with
  onPitch:false renders no base circle; a redCarded piece with onPitch left undefined still
  renders — confirms the default-on-pitch behavior; all other pieces keep rendering normally
  when one piece is hidden).
- Lint (`eslint`) and `prettier --check` clean on all 8 touched files (whole-repo `pnpm lint`
  hit a Node OOM in this environment unrelated to these changes — ran eslint directly scoped to
  the touched files instead).
- Confirmed by the user in a live two-browser session (2026-08-16) — "red card removal accepted".
  files_changed:
- packages/shared/src/types.ts (added PlayerPiece.onPitch?: boolean)
- packages/server/src/gameEngine.ts (booking red-card branch sets onPitch: false;
  computeGoalKickEligibleIds/computeCornerKickEligibleIds/applyFreeMoveZoneCheck now exclude
  redCarded pieces)
- packages/client/src/components/HexGrid.tsx (piece-render map skips onPitch === false)
- packages/server/src/**tests**/gameEngine.outOfBounds.test.ts (new test)
- packages/server/src/**tests**/gameEngine.cornerKick.test.ts (new test)
- packages/server/src/**tests**/gameEngine.phase17.test.ts (new test)
- packages/server/src/**tests**/gameEngine.booking.test.ts (new assertions on existing test)
- packages/client/src/components/HexGrid.test.tsx (3 new tests)
