# Phase 47: Select-Based Roster Interaction - Context

**Gathered:** 2026-08-30
**Status:** Ready for planning

<domain>
## Phase Boundary

Replace all native HTML5 drag-and-drop interaction in `LineupAssignmentScreen.tsx` with the app's existing click-to-select model (click = select green, eligible targets = blue, click again = deselect, click a blue target = complete the action). This covers every surface the component renders:

1. **Mid-match positioning mode** (default roster screen) — swap two on-pitch players.
2. **Mid-match substitution mode** — bring a bench player on for an on-pitch player.
3. **Standard pregame lineup swap** — pre-confirm lineup slot-swap (auto-assigned lineup, player can rearrange before confirming).
4. **Draft-mode pack/bench/lineup carousel** — picking a pack card into a slot/bench, and rearranging drafted cards (slot↔slot, slot↔bench).

**Scope was expanded during this discussion** (see Implementation Decisions → Scope Expansion below) from the original "mid-match only" framing to all four surfaces. `ROADMAP.md` and `REQUIREMENTS.md` have been updated accordingly (ROSTER-07, ROSTER-08 added; the "Pregame/draft-mode drag-and-drop" Out-of-Scope line removed).

**Out of scope:** Fixing any GK/final-third/banner/jersey-number bugs (Phases 48–50); the rules-fidelity audit (Phase 51).

</domain>

<decisions>
## Implementation Decisions

### Scope Expansion
- **D-01:** Drag-and-drop is retired everywhere in `LineupAssignmentScreen.tsx`, not just the mid-match roster screen. This was a live scope change during discussion (user: "draft should be select mode too, drag and drop should be retired for all phases"), confirmed explicitly when flagged as exceeding REQUIREMENTS.md's original Out-of-Scope line. `REQUIREMENTS.md` now has ROSTER-07 (Standard pregame swap) and ROSTER-08 (draft-mode pack/bench/lineup), and `ROADMAP.md` Phase 47's Goal/Success Criteria were widened to match.
- **D-02:** This expansion also resolves a pre-existing inconsistency: `ROADMAP.md`'s original Phase 47 success criterion 5 already read "no drag-and-drop state, handlers, or types remain in `LineupAssignmentScreen.tsx`" (file-wide), which contradicted the Goal text's "mid-match only" framing and REQUIREMENTS.md's Out-of-Scope line. The file-wide reading wins.

### Card Selection Visuals
- **D-03:** Selected card and eligible-target highlighting reuse the pitch's existing `HIGHLIGHT_STYLES`/`RING_STYLES` tokens from `docs/HIGHLIGHT-REFERENCE.md` (green = selected, blue = eligible target) — one color vocabulary for "selected"/"eligible" across pitch and roster, not a new roster-local color pair and not a repurposing of the existing drag-state CSS classes (`statCardDragging`/`statCardDropTarget`).
- **D-04:** Clicking an ineligible card while something is selected is a no-op — the current green selection and blue targets stay exactly as they are. Matches the pitch's click-to-move convention exactly.
- **D-05:** The SENT OFF placeholder slot (a dismissed/red-carded player's frozen slot) gets the blue eligible-target highlight **only** in positioning/reposition mode, matching today's drag behavior where it's a legal reposition drop zone. It is never a valid or highlighted target in substitution mode (there's no active player there to sub out).

### Substitution Selection Order
- **D-06:** Substitution mode stays bench-first only — the user must click a bench card first (it turns green), which highlights eligible on-pitch cards blue; clicking an on-pitch card first does nothing. Mirrors today's drag-always-originates-from-bench behavior exactly.
- **D-07:** While a bench card is selected, clicking a *different eligible* bench card switches the selection to it (previous green clears, new card turns green, blue on-pitch targets stay the same set) — lets the user change their mind about who to bring on before committing, without an explicit deselect step.
- **D-08:** This "switches selection" behavior is bench-substitution-specific, NOT symmetric with positioning mode. In positioning mode, a selected on-pitch card must be explicitly deselected (click it again) before a different card can be selected — positioning mode keeps strict pitch-style behavior. (Ineligible-target no-op, D-04, still applies identically in both modes — the distinction is specifically about clicking a *different eligible source-type* card.)

### GK Selectability
- **D-09:** The GK stays permanently unselectable in positioning mode — same rule, same reason as today (server-side `GK_SLOT_LOCKED` guard already rejects any GK move). The GK card never turns green/clickable there. Making GK selectable was explicitly considered and rejected as an out-of-scope new capability.

### Component Structure
- **D-10:** Keep one shared click-select `LineupStatCard` / column-rendering path across all four surfaces (mid-match, Standard pregame, draft) rather than splitting into per-surface components — now that every surface uses the identical green-selected/blue-target click model, there's no structural reason to branch by interaction type. Eligibility/guard logic still stays in separate functions per surface (ROSTER-05's "not merged into one handler" requirement extends to all surfaces, not just the two mid-match modes).
- **D-11:** Draft-mode click-select generalizes exactly from the mid-match vocabulary already locked in D-06/D-07/D-08:
  - **Pack card selection** mirrors mid-match substitution's bench-first pattern: select a pack card (green) → eligible empty/fillable slots and bench highlight blue → click completes the pick.
  - **Filled slot or bench card selection** mirrors mid-match positioning's swap pattern: select (green) → eligible other slots/bench highlight blue → click swaps/rearranges.
  - All existing GK-slot-only-accepts-GK-card rules and swap-vs-move semantics (slot↔slot is a two-way swap via `onDraftRearrange`; slot→bench and bench→slot are moves) carry over unchanged — only the input mechanism changes, not the underlying rules.
- **D-12:** Standard pregame lineup swap (non-draft) also converts to the same positioning-mode-style swap pattern (select a card, click an eligible slot, swap completes) — same as D-11's "filled slot" case, applied to the pregame surface's simpler single-swap-only flow.

### Claude's Discretion
- Exact CSS class naming/structure for the new shared selection-visual treatment (as long as it draws from `HIGHLIGHT_STYLES`/`RING_STYLES` tokens per D-03).
- Whether the underlying selection state is one `useState` shape shared across all four surfaces or per-surface state, as long as the observable behavior in D-04 through D-12 holds and eligibility functions stay structurally separate (ROSTER-05).
- Keyboard/accessibility affordances beyond click (not raised in discussion — use judgment, consistent with how the existing pitch selection handles it).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Highlight/selection color system
- `docs/HIGHLIGHT-REFERENCE.md` — single source-of-truth hex-highlight/ring color table (`HIGHLIGHT_STYLES`/`RING_STYLES` in `packages/client/src/components/HexCell.tsx`); the green-selected/blue-eligible-target tokens this phase reuses on cards (D-03).

### Requirements and roadmap (updated during this discussion)
- `.planning/REQUIREMENTS.md` — Roster Interaction section, now ROSTER-01..08 (ROSTER-07/08 added during this discussion); Out-of-Scope table updated (pregame/draft drag-and-drop line removed).
- `.planning/ROADMAP.md` §Phase 47 — Goal and Success Criteria widened to cover all four surfaces (see criteria 6–7, added during this discussion).

### Existing implementation (the file this phase rewrites)
- `packages/client/src/components/LineupAssignmentScreen.tsx` — the single component serving all four surfaces via `mode`/`draftMode` props; contains the current drag-and-drop implementation for positioning (`handleMidmatchDragStart`/`handleMidmatchRepositionDrop`), substitution (`handleMidmatchSubstituteDrop`), Standard pregame (`handleDragStart`/`handleDrop`), and draft (`handleDraftSlotDragStart`/`handleDraftSlotDrop`/`handleDropToBench`).
- `packages/client/src/components/BenchCarousel.tsx` — bench card rendering; currently exposes `onCardDragStart`/`onDropToBench`, will need click-equivalent props.
- `packages/client/src/components/DraftPackCarousel.tsx` — pack row rendering for draft mode.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `HIGHLIGHT_STYLES`/`RING_STYLES` (`HexCell.tsx`) — the color tokens to reuse for card selection state (D-03), not a new roster-local palette.
- `isActivePiece` (shared) — already used throughout `LineupAssignmentScreen.tsx` mid-match rendering to exclude red-carded/subbed-out pieces; unaffected by this phase's interaction-model change.
- Existing `statCardDragging`/`statCardDropTarget`/`statCardSubTarget`/`statCardSubBlocked` CSS classes in `LineupAssignmentScreen.module.css` — these get repurposed/renamed for click-selection state, not reused as-is (D-03 explicitly rejected "repurpose existing drag-state classes" in favor of the pitch's own tokens, but the class *structure* — one class per card conditionally applied — is a reasonable pattern to keep).

### Established Patterns
- `DragState`/`MidmatchDragState` union types (module scope in `LineupAssignmentScreen.tsx`) — the existing pattern of "one parent-owned state variable resolves every drop, children never read anything at drop time" should carry over directly to a `SelectionState` equivalent for click-select.
- Positioning-mode and substitution-mode drop handlers are deliberately structurally separate functions sharing no guard body (Pitfall 5, `research/PITFALLS.md`) — ROSTER-05 requires this to continue under click-select, and D-10/D-11/D-12 extend the same separation to Standard-pregame and draft-mode eligibility.
- `GameBoard.tsx` / `HexCell.tsx` already implement the exact green-selected/blue-eligible-target click-to-move pattern this phase is porting to cards — read that implementation as the reference pattern for selection state shape and highlight application.

### Integration Points
- Server-side handlers (`GAME_ROSTER_REPOSITION`, `GAME_SUBSTITUTION`, `LINEUP_SWAP`, `LINEUP_CONFIRM`, `DRAFT_PICK`, `DRAFT_REARRANGE`) are unaffected — this phase only changes the client-side input mechanism that triggers the same existing emits (`onSwap`, `onReposition`, `onSubstitute`, `onDraftPick`, `onDraftRearrange`). No new server validation needed (confirmed for GK-lock specifically in D-09).

</code_context>

<specifics>
## Specific Ideas

- "Draft top row should behave like the bench for subbing" — the draft pack carousel's selection UX should feel identical to selecting a bench card in mid-match substitution mode (D-11).

</specifics>

<deferred>
## Deferred Ideas

None — the one scope-expansion idea raised (retiring drag-and-drop everywhere) was folded into this phase's scope rather than deferred, per explicit user confirmation (D-01).

### Reviewed Todos (not folded)
None — `gsd_run query todo.match-phase 47` returned zero matches.

</deferred>

---

*Phase: 47-select-based-roster-interaction*
*Context gathered: 2026-08-30*
