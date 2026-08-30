# Feature Research

**Domain:** Turn-based/duel-resolution multiplayer sports sim UI — roster interaction, reactive-ability sequencing, player identity, event notification, and rules-fidelity QA for a rulebook-faithful digital board game adaptation
**Researched:** 2026-08-30
**Confidence:** MEDIUM-HIGH (grounded primarily in this project's own existing architecture; general UX/game-design patterns corroborated by web research where the pattern is genuinely external, e.g. click-to-select interaction, priority/stack sequencing, squad-number conventions)

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist, or existing UX debt severe enough that leaving it unfixed makes the product feel broken/half-finished for a mature v1.7+ game.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Select-based swap/substitution (replacing drag-and-drop) | The rest of the game (piece movement, kicker/thrower selection, pass targeting) already uses click-to-select with blue/green highlight states — drag-and-drop on the roster screen is the ONE interaction model in the whole app that doesn't match, and it's known to be worse for accessibility/touch/keyboard than click-select | MEDIUM-HIGH | `LineupAssignmentScreen.tsx` is a single component serving 3 distinct drag flows today: pre-match/draft lineup slotting, mid-match drag-and-drop repositioning (Phase 42), and mid-match stage-and-confirm substitution (Phase 42). All 3 need converting or explicitly scoped — see Dependencies below |
| Permanent jersey numbers | Real football numbering doesn't change when a player switches position mid-match or gets substituted; today's `jerseyNumber` is a property of the **formation slot** (`formations.ts`), not the player, so it visibly changes whenever a lineup is rearranged — a correctness bug players will notice immediately once they look for it | LOW-MEDIUM | Confirmed in code: `gameEngine.ts` reads `homeSlots[i]!.jerseyNumber` at kickoff (`piece.number = ...`) and again on substitution (`jerseyNumber: benchEntry.jerseyNumber` / `outPiece.number`) — numbers are slot-derived, not player-derived, today. Needs a genuine "assign once, carry forever" field independent of `slotId`/formation |
| Final-third confirm fix (GK doesn't block confirm) | A rules edge case: `FREE_MOVE_ATTACK`/`FREE_MOVE_DEFENSE`'s help text ("ALL pieces of both teams (GK included)... each get an independent free 6-hex move," `ActionPanel.tsx`) makes the GK a real eligible mover, but a GK realistically almost never needs to reposition inside their own final third — forcing a warning/red button state for an omission that's usually intentional reads as a bug, not a rule | LOW | Confirmed the current `remaining` calc in `ActionPanel.tsx` (`eligibleTotal - movedCount`) counts the GK like any outfield player. Fix is a narrow UI-eligibility exception (GK-only-remaining ⇒ treat as 0/green), not a rules-engine change — GK must stay in `eligibleIds` for actual movement, only the confirm-gating check changes |
| Foul→injury→booking banner sequencing, closed out (not just re-attempted) | This bug has been open and paused since v1.6 close; a previous attempted fix (`activeRef`, commit `0664573`) is real and shipped but was independently confirmed by the user NOT to fix the live symptom — going into v1.8 without root-causing this a second time repeats a known-failed approach | HIGH | See `.planning/debug/foul-banner-sequence-not-pausing.md` for the full paper trail: the confirmed-live symptom ("Foul! disappears exactly when FoulChoicePanel appears") was never reproduced synthetically; the investigation's own `next_action` recommends live-browser DOM/React-state inspection (not another synthetic unit test) as the highest-leverage next step. There is also an unresolved **order discrepancy** worth flagging to the user before re-closing this: the original bug report says the expected order is **foul → booking/card → injury**, but the current code (and this milestone's own PROJECT.md phrasing) says **foul → injury → booking**. Confirm which order is actually correct against the rulebook before calling this "fixed" |

### Differentiators (Not Required, But Valuable This Milestone)

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| GK box-entry-before-dive resequencing | Gives the defending manager a genuine, rules-faithful decision point (reposition the GK) *before* the shot-blocking duel it's meant to influence, rather than after the outcome is already locked in — this is the kind of fidelity-to-the-physical-board detail that differentiates this project from a generic arcade football game | MEDIUM-HIGH | Grounded in code: `computeBoxEntryOffer`'s current design (39-15) is an **edge-triggered, whitelist-scoped** hook (`GK_BOX_ENTRY_PHASES = {MOVE, PASS, LOOSE_BALL}`) that is *intentionally* excluded from shot-declared phases — the 39-15 comment states shots already have their own GK interaction (`GK_DIVE`) and a second offer on top of it was judged "nonsensical" and would "hijack the existing, correct flow." v1.8's resequencing goal is therefore not a bug fix to existing wiring but a **new decision point**: an outside-the-box shot must now surface the box-entry offer as a distinct step that resolves before `GK_DIVE`, which directly contradicts the standing 39-15 design rationale and needs a fresh design decision (not just a reorder of two existing calls) — flag this to the user as a real scope/architecture conversation, not a 1-line sequencing swap |
| Rules-fidelity gap analysis artifact | Produces a scoped, prioritized backlog for a future "close the gaps" milestone instead of ad-hoc bug discovery during play — turns "we think there might be rulebook drift" into an inspectable, reviewable document | LOW-MEDIUM (as an audit, not an implementation) | This project already has a mature, precedented format for exactly this kind of cross-cutting audit: `.planning/milestones/vX-MILESTONE-AUDIT.md` (see v1.6's, which cross-references requirements against phases/verification/integration and produces a scored `tech_debt` artifact). The rules-fidelity gap analysis should reuse that audit's shape — but keyed on **rulebook clauses**, not delivered requirements — since there is no requirements doc to trace against for rules never yet scoped into any milestone |

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|------------------|-------------|
| Rewriting `LineupAssignmentScreen.tsx`'s draft-mode drag flow (pack carousel → slot) as part of this milestone | "While we're converting drag-and-drop to click-select, do the whole screen at once" | The draft carousel drag flow (`DraftPackCarousel.tsx`/`BenchCarousel.tsx`) is a **different domain** (picking a card from a pack, not repositioning an existing squad) and is explicitly out of this milestone's stated scope (positioning + substitution only) — touching it risks regressing Draft Mode, which has its own hard-won recalibration history (v1.4 Phase 30) | Scope select-based swap strictly to the two flows PROJECT.md names: default mid-match positioning mode and stage-and-confirm substitution mode. Leave pre-match draft-pick drag-and-drop untouched unless the user explicitly asks to widen scope |
| Auto-fixing the foul-banner order to "foul → booking → injury" as part of closing the sequencing bug | The original bug report states that as the expected order | The current code order (foul → injury → booking) was a **deliberate, if unverified, design choice**, and the debug file explicitly left the order question "UNFIXED... flagged as a possible follow-up requirement clarification, not touched to keep this fix minimal." Silently changing display order while fixing the "doesn't advance" defect conflates two different concerns and risks reintroducing regressions the existing 30/31 EventBanner tests were written against | Treat order-correctness and "does-it-advance-at-all" as two separately confirmed decisions; ask the user (or check the physical rulebook, since injury and booking are rolled independently and there's no dice-order dependency) which order is actually correct before changing display order |
| A fully generic "any reactive ability can interrupt any resolution" engine for GK box-entry resequencing | Feels like the "proper" generalized fix once you're touching interrupt ordering | The existing architecture deliberately keeps every interrupt (`GK_DIVE_AT_FEET_PROMPT`, `GK_BOX_ENTRY_PROMPT`, `TACKLE_STEAL_PROMPT`) as its own narrowly-scoped phase substitution inside `broadcastState`, with an explicit ordering priority (box-entry checked before dive-at-feet) and an explicit whitelist of phases it may fire from — building a general priority-stack (à la MTG) would be a large architectural rewrite for a single new case | Add the box-entry-before-shot-dive case as one more narrowly-scoped, explicitly-ordered special case in the same `broadcastState`/phase-substitution style already used for every other interrupt, not a new general mechanism |

## Feature Dependencies

```
[Select-based swap/substitution]
    └──requires──> [Existing selection-state model already in the codebase]
                       (SelectionState enum: none/selectable/active/activated — PROJECT.md Key Decisions,
                        already used by piece movement; the roster screen needs an equivalent for
                        "selected roster card" / "eligible swap target")

[Permanent jersey numbers]
    └──requires──> [A player-identity field independent of formation slotId]
                       (today jerseyNumber lives on the FormationSlot; must move to
                        a per-player/per-piece field assigned once at game start and never
                        re-derived from slot lookups again)
    └──conflicts-with──> [Formation-driven auto-numbering at kickoff]
                       (the current `piece.number = homeSlots[i]!.jerseyNumber` assignment
                        at kickoff, and the substitution-inherits-number pattern from v1.6,
                        both need to become "assign once, never touch again" instead of
                        "derive from slot on every formation/lineup event")

[GK box-entry-before-dive resequencing]
    └──requires──> [A real design decision, not just a reorder]
                       (contradicts the explicit 39-15 "shots already have GK_DIVE, do not
                        double-offer" rationale — this is new scope, not a regression fix)
    └──enhances──> [GK_BOX_ENTRY_PROMPT / GK_DIVE_AT_FEET / GK_DIVE existing interrupt family]

[Foul→injury→booking banner sequencing fix]
    └──requires──> [Live two-browser reproduction with React DevTools]
                       (per the debug file's own next_action — two independent synthetic
                        repro attempts have already failed to reproduce the live symptom;
                        another synthetic-only attempt is unlikely to succeed a third time)
    └──conflicts-with──> [Treating the activeRef fix (already shipped) as "the fix"]
                       (it's real and should stay, but is proven NOT sufficient — confirmed
                        live by the user; do not close this bug on that fix alone)

[Rules-fidelity gap analysis]
    └──enhances──> [Every future milestone's scoping accuracy]
    └──independent-of──> [All 4 implementation items above]
                       (pure audit/documentation deliverable — no code dependency,
                        can run in parallel with the other 4)
```

### Dependency Notes

- **Select-based swap requires the existing `SelectionState` model:** the project already standardized piece-selection visuals (blue = selectable target, green = active selection, orange = already-acted) during v1.1/v1.5 (`HIGHLIGHT_STYLES`/`RING_STYLES`, `docs/HIGHLIGHT-REFERENCE.md`). Reusing that exact color/state vocabulary on the roster screen (rather than inventing a parallel one) keeps the whole app internally consistent — this is a strong "why" for adopting select-based swap here specifically, beyond generic click-vs-drag UX preference.
- **Permanent jersey numbers conflicts with formation-driven auto-numbering:** this is the crux of the complexity. Every place that currently reads `jerseyNumber` off a `FormationSlot` (kickoff assignment, substitution inheritance, bench display) needs to instead read a number that was fixed once, at game start, on the `Piece`/roster-player entity itself. This is a genuine "assign once, immutable through subs/position changes" identity field — the anti-pattern this milestone is explicitly correcting is "recalculated per formation/lineup," which is exactly what the current code does today.
- **GK box-entry resequencing requires a real design decision:** unlike the other 4 items, this is not a regression from a previously-correct state — the current phase-whitelist design (39-15) was written with the explicit intent to exclude shots. Treat this as new scope requiring its own mini-spec (when exactly does the offer fire relative to `applyDeclareShot`/`enterGkDiveOrSkip`, and does declining it still let `GK_DIVE` proceed normally), not a search-and-fix.
- **Rules-fidelity gap analysis is independent:** it's a documentation/audit deliverable with no code dependency on the other 4, so it can be scheduled in parallel (e.g., a separate phase or even done by a different contributor) without blocking or being blocked by the implementation work.

## MVP Definition

### Launch With (v1.8)

Minimum viable scope per PROJECT.md's stated milestone goal — all 6 items are already explicitly in scope, nothing to trim further without violating the stated goal.

- [ ] Select-based swap/substitution replacing drag-and-drop in both existing mid-match modes (default positioning + stage-and-confirm substitution) — core interaction rework, table stakes for UI consistency
- [ ] Final-third confirm fix (GK-only-remaining ⇒ green/no warning) — small, low-risk, high perceived-polish payoff
- [ ] GK box-entry-before-dive resequencing on outside-the-box shots — the one item requiring genuine new design, budget the most review/discussion time here
- [ ] Permanent jersey numbers, assigned once at game start — correctness fix, moderate blast radius (kickoff assignment + substitution inheritance + every display surface)
- [ ] Foul→injury→booking banner-sequencing bug, resumed and closed with live-browser verification (not another synthetic-only attempt) — highest execution risk of the 5 implementation items given 2 prior failed synthetic repro attempts
- [ ] Rulebook-vs-implementation gap analysis (audit deliverable only, no fixes) — scopes the next milestone, does not gate this one's other 5 items

### Add After Validation (v1.9+)

- [ ] Whatever the gap analysis surfaces as highest-priority rulebook deviations (by construction, unknown until the audit runs)
- [ ] RESP-01..09 response-move single-selection activation model — still the top pre-existing backlog item (deferred across 5 consecutive milestones); the gap analysis may reveal it overlaps meaningfully with the click-to-select pattern being introduced for roster interaction in v1.8, which could make v1.9 cheaper if RESP work reuses the same selection-state vocabulary

### Future Consideration (v2+)

- [ ] A general interrupt/priority-stack engine for GK reactive moves (if more reactive-offer types get added later, the current "one more narrowly-scoped special case per interrupt" pattern will eventually need consolidating — not yet, with only 3 interrupt types)
- [ ] `createServer.ts:99-167` reconnect handler-registration bug — pre-existing since Phase 07, flagged repeatedly, unrelated to this milestone's scope but worth linking from the gap-analysis deliverable if it surfaces engine-wide risk

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Select-based swap/substitution | HIGH | HIGH | P1 |
| Permanent jersey numbers | MEDIUM | LOW-MEDIUM | P1 |
| Final-third confirm fix | LOW-MEDIUM | LOW | P1 |
| GK box-entry-before-dive resequencing | MEDIUM | MEDIUM-HIGH | P1 |
| Foul→injury→booking banner fix | HIGH (long-open, user-visible, previously mis-diagnosed) | HIGH (execution risk) | P1 |
| Rules-fidelity gap analysis | MEDIUM (scoping value, not player-facing) | LOW-MEDIUM | P1 |

**Priority key:**
- P1: Must have for this milestone (all 6 items are explicitly named in PROJECT.md's v1.8 target features — none are optional stretch scope)

## Competitor / Reference Pattern Analysis

| Pattern | Reference | Our Approach |
|---------|-----------|--------------|
| Click-to-select-then-click-target ("pick n plop") | Chess-style digital board game UIs; documented as an explicit drag-and-drop alternative for accessibility/keyboard support | Already the dominant interaction model everywhere else in this app (piece movement, kicker selection, pass targeting) — v1.8 brings the one remaining drag-and-drop surface (roster screen) into line, not introducing a new pattern |
| Reactive-ability resolves before the effect it responds to | Magic: The Gathering's stack/priority system — a response (instant/interrupt) always resolves *before* the spell/ability it was cast in response to, which is precisely the "reposition before the shot it's meant to influence" causal shape v1.8 wants for GK box-entry | This project doesn't need (and per the anti-features analysis above, should not build) a general priority stack — it needs one more explicitly-ordered special-case phase substitution in the existing `broadcastState` interrupt-priority chain, mirroring the box-entry-before-dive-at-feet ordering that already exists between those two mechanics |
| Permanent squad numbers, assigned once and independent of formation/position | Real-world football numbering convention; sports-management sims (career-mode style squad management) treat kit number as a property of the player, manually reassignable but never silently recalculated by lineup/formation changes | v1.8 corrects the current anti-pattern (number derived from `FormationSlot`) to match this convention: assign once at game start, immutable through subs/position changes |
| Burst-of-related-events shown one at a time, none dropped | General toast/notification-queue UX best practice: queue and drain sequentially rather than showing all-at-once or silently collapsing | This project already has `EventBanner.tsx`'s `queueRef`-based sequential drain design (built in Phase 39/39-04) — the goal is not a redesign but confirming the *existing* queue design actually holds under the specific live-observed foul→injury→booking case, which two rounds of synthetic testing have so far failed to reproduce |

## Sources

- Internal (HIGH confidence — direct codebase inspection): `packages/server/src/gameEngine.ts` (jerseyNumber assignment, `computeBoxEntryOffer`, `enterGkDiveOrSkip`), `packages/server/src/roomStore.ts` (`broadcastState`, `GK_BOX_ENTRY_PHASES` whitelist and its 39-15 design rationale comment), `packages/client/src/components/LineupAssignmentScreen.tsx` (existing drag-and-drop flows), `packages/client/src/components/ActionPanel.tsx` (`FREE_MOVE_ATTACK`/`FREE_MOVE_DEFENSE` eligibility calc), `packages/shared/src/formations.ts` (slot-derived jerseyNumber source), `.planning/debug/foul-banner-sequence-not-pausing.md` (full prior investigation, root cause status, 2 eliminated hypotheses), `.planning/milestones/v1.6-MILESTONE-AUDIT.md` (precedent audit format for the gap-analysis deliverable)
- [Click and Swap, our alternative to Drag and Drop (Hacker News discussion)](https://news.ycombinator.com/item?id=30034999) — MEDIUM confidence, community discussion not a formal spec, but directly corroborates "pick n plop" as an established drag-and-drop alternative
- [The Stack and Priority in Magic: The Gathering](https://magicthegatheringauthority.com/the-stack-and-priority) / [MTG The Stack Explained](https://www.tabletopmeta.com/blog/mtg-stack-explained) — MEDIUM confidence, well-established and widely-documented game-design mechanic, used here only as an illustrative causal-order reference, not as an architecture recommendation (see Anti-Features)
- [Squad number (association football) — Wikipedia](https://en.wikipedia.org/wiki/Squad_number_(association_football)) — MEDIUM confidence, general reference corroborating real-world permanent-number convention
- General toast/notification-queue UX best-practice sources (SaaS UX pattern round-ups) — LOW-MEDIUM confidence, generic web-app UX advice extrapolated to a game-banner context; used only to corroborate the sequential-drain pattern this project has already independently built

---
*Feature research for: Counter Attack POC v1.8 milestone (select-based roster interaction, GK resequencing, permanent jersey numbers, banner-sequencing fix, rules-fidelity gap analysis)*
*Researched: 2026-08-30*
