# Phase 25 Discussion Log

**Date:** 2026-07-10
**Participants:** User + Claude Code
**Workflow:** `/gsd-discuss-phase 25`

---

## Gray Areas Presented

All four gray areas were selected for discussion:

1. OFFSIDE UAT scope
2. BUG-23 approach
3. UX-15 scope
4. Phase 25 milestone boundary

---

## OFFSIDE UAT Scope

**Question:** OFFSIDE-01/02 code has been live since Phase 17. What does a passing two-tab test look like — are there specific scenarios to script, and what happens if a bug is found?

**Resolution:** Four scenarios defined as pass criteria: flag on forward-to-offside-player, no flag when level, no flag when offside player is not the recipient, correct free-kick restart after flag. If any bug surfaces during UAT, a gap plan is created within Phase 25 (not deferred). OFFSIDE-01/02 are pure UAT closures — no planned code changes.

---

## BUG-22 Status

**Finding (not a gray area, raised during analysis):** `carrierExclusionKey: 'highPassCarrierId'` is already live in `gameHandlers.ts:405`, implemented in Phase 18.2. The requirement checkbox was never updated.

**Resolution:** Plan 01 closes the checkbox in REQUIREMENTS.md. No code changes.

---

## BUG-23 Approach

**Question:** Root cause unknown despite exhaustive static analysis. Apply speculative belt-and-suspenders guard first, or require confirmed root cause before fixing?

**Resolution:** Apply two speculative client-side fixes first:

1. Wrap entire `isShotPathTint` expression with `phase !== 'KICK_OFF_SETUP'` outer guard
2. Clear `shotTargetHighlight` React state on KICK_OFF_SETUP phase transition (this state is currently never cleared and causes a stale red tint on the prior goal-target hex)

UAT confirms whether the fix resolves it. If not, escalate to Phase 26 with `console.log` instrumentation.

---

## UX-15 Scope

User provided a detailed list of items from v1.3 playtesting. Sorted into Phase 25 vs. deferred:

### Phase 25 — Bug Fixes

- **Uniform selection clearing:** When player 1 confirms, player 2's unconfirmed selections are reset. Investigation-first approach (read App.tsx + UniformSelectionScreen.tsx before fixing).
- **Player number too low:** Jersey number `<text>` element fractionally below center in piece SVG. Fix `dominantBaseline` or `dy` offset.
- **Style 12 wrong pattern:** Style 13 = cross-axis quarters (╬); Style 12 should be diagonal-axis quarters (✕). Fix SVG pattern.

### Phase 25 — UX Changes

- **Eligible counter on move start:** Counter should decrement when move starts (piece selected), not when destination committed. Undo restores count.
- **Pass result as popup:** Replace "Accurate / Loose Ball" push-button with auto-advancing popup notification ("Accurate Pass!" / "Loose Ball!") using the existing turnover popup pattern.

### Deferred to Phase 26

- GK reactive 1-hex move when ball enters penalty box
- GK reactive 1-hex move before save on outside-box shot
- Full response activation cleanup (all response types: single-selection, white range, range-based eligibility, challenge penalties, auto-keeper repositioning, logging)

---

## Phase 25 Milestone Boundary

**Question:** Anything that should be in Phase 25 but isn't? Anything that should slip?

**Resolution:**

- Response activation overhaul is Phase 26. It is too large (multiple response types, range calculations, UI changes) for Phase 25 and does not block v1.3 shipping.
- All items listed above go in Phase 25.
- After Phase 25 ships, v1.3 is complete.

---

## Proposed Plan Structure

| Plan | Content                                                                                  |
| ---- | ---------------------------------------------------------------------------------------- |
| 01   | OFFSIDE-01/02 UAT closure + BUG-22 checkbox close (no code)                              |
| 02   | REPLAY-07/08: add `ballAfter` to GK_KICK + LOOSE_BALL_LAND, add to REPLAY_ELIGIBLE_TYPES |
| 03   | BUG-23: speculative isShotPathTint guard + shotTargetHighlight clear                     |
| 04   | UX-15 bugs: uniform clear, number centering, style 12 pattern                            |
| 05   | UX-15 changes: eligible counter on move start + undo, pass result popup                  |

---

_Discussion complete. CONTEXT.md written. Ready for /gsd-plan-phase 25._
