---
phase: 41-card-injury-iconography
fixed_at: 2026-08-21T22:14:43Z
review_path: .planning/phases/41-card-injury-iconography/41-REVIEW.md
iteration: 1
findings_in_scope: 2
fixed: 2
skipped: 0
status: all_fixed
---

# Phase 41: Code Review Fix Report

**Fixed at:** 2026-08-21T22:14:43Z
**Source review:** .planning/phases/41-card-injury-iconography/41-REVIEW.md
**Iteration:** 1

**Summary:**

- Findings in scope: 2 (fix_scope: critical_warning — 0 critical, 2 warning; IN-01 excluded by scope)
- Fixed: 2
- Skipped: 0

## Fixed Issues

### WR-01: Nested `role="img"` elements produce duplicate/conflicting screen-reader announcements

**Files modified:** `packages/client/src/components/CardInjuryBadge.tsx`, `packages/client/src/components/PieceOverlay.tsx`
**Commit:** 236b486
**Applied fix:** Removed `role="img"`/`aria-label` from `CardInjuryBadgeGroup`'s inner `<rect>` (card badge) and `<g>` (injury badge) primitives unconditionally — `CardInjuryBadgeGroup` is now a pure geometry-only primitive with no accessible-name opinion of its own, documented as such in its header comment. Each of its two call sites now owns exactly one combined accessible name: `CardInjuryBadge`'s outer `<svg role="img" aria-label={label}>` already provided this and is unchanged; `PieceOverlay` (which was the one unwrapped, direct consumer producing two separate uncombined labels) now derives `cardColorFor(piece)` / `piece.injuryCount ?? 0` once, computes the combined `cardInjuryLabel(...)` string, and wraps its `CardInjuryBadgeGroup` call in a `<g pointerEvents="none">` that conditionally carries `role="img"`/`aria-label` only when there is something to announce (label non-empty) — mirroring `CardInjuryBadge`'s null-return-when-nothing-to-show behavior instead of emitting an empty-labeled `img` role every time. Result: every consumer (pitch token, scoreboard card, roster card, bench card) now produces exactly one `role="img"` element with the full combined label, never nested/duplicate ones.
**Verification:** Tier 1 (re-read modified sections, confirmed intact) + Tier 3 fallback — no `tsc`/syntax checker was available in the isolated fix worktree (no `node_modules` installed there; installing was intentionally avoided per this project's known Windows node_modules-junction risk). Cross-checked against `CardInjuryBadge.test.tsx`, `PieceOverlay.test.tsx`, and `CardInjuryBadge.crossSurface.test.tsx` — none of those specs assert on the removed inner `role`/`aria-label` attributes, so no test contract was broken by this change. **Recommend running the full test suite (`pnpm test` in `packages/client`) before merging** to confirm no other consumer relies on the removed inner-element ARIA attributes.

### WR-02: Self-referential audit test validates its "exactly once" guard against doc-comment prose, not real code

**Files modified:** `packages/client/src/components/CardInjuryBadge.audit.test.ts`
**Commit:** 51ace8d
**Applied fix:** Added a new `readSourceOnly()` helper (strips both `/* */` block comments and `//` line comments before whitespace-normalizing, unlike the existing `read()`/`readCss()` helpers which intentionally keep comments for other assertions in this file that check doc-comment prose itself). The "CardInjuryBadge.tsx contains the derivation exactly once" self-check now uses `readSourceOnly()` together with a new `implementationRegex` matching the ACTUAL current `cardColorFor` shape (`if (piece.redCarded === true) return 'red';`) instead of the ternary-shaped `derivationRegex` (which only ever matched the module's own doc-comment prose, never real code, since the real implementation is an `if`-statement, not a ternary). The cross-file `derivationRegex` check (verifying no _other_ source file re-introduces the banned ternary) is untouched — that assertion's purpose and behavior were already correct. Independently verified via a standalone Node script (outside the test runner) that the new regex matches the real implementation in `CardInjuryBadge.tsx` exactly once on comment-stripped source, confirming the self-check now exercises real code instead of incidental doc-comment text.
**Verification:** Tier 1 (re-read modified sections, confirmed intact) + a manual regex-simulation script run against the actual (comment-stripped) file content, confirming exactly 1 match — standing in for Tier 2 since no `vitest`/`tsc` binary was available in the isolated fix worktree. **Recommend running `pnpm test -- CardInjuryBadge.audit` in `packages/client`** to confirm the full audit suite (all describe blocks, not just the two touched by this fix) still passes end-to-end before merging.

## Skipped Issues

None — all in-scope findings (WR-01, WR-02) were fixed. IN-01 was out of scope for this run (`fix_scope: critical_warning` excludes Info-tier findings) and was left untouched in the source tree for a future `--fix-scope all` pass or manual follow-up.

## Process Note

While setting up the isolated fix worktree, an early `gsd-tools commit` invocation was accidentally run from the main repository's working directory instead of the worktree (a Bash-tool cwd-reset issue, not a worktree bug), which briefly committed an unrelated recovery-sentinel file to `main` under the message "test" (commit `6c550f0`). This was caught immediately and corrected with a non-destructive `git revert` (commit `ec85e6d`) before any further work proceeded — `main`'s tracked content is unaffected (net diff is empty), though the two extra no-op commits remain in `main`'s local history. The isolated fix worktree was then rebased onto the corrected `main` tip so the two real fix commits (`236b486`, `51ace8d`) apply cleanly on top. All fix commits after this point were made correctly inside the worktree, verified via `git branch --show-current` immediately after each commit.

---

_Fixed: 2026-08-21T22:14:43Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
