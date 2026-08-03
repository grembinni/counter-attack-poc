# Pitfalls Research

**Domain:** Adding fouls/cards/injuries/substitutions/new-restart-types/out-of-bounds detection to an existing server-authoritative dice-duel FSM (Counter Attack POC, v1.6 milestone)
**Researched:** 2026-08-03
**Confidence:** HIGH — grounded in direct reading of this codebase's actual implementation (`gameEngine.ts`, `gameHandlers.ts`, `roomStore.ts`, `actionSequence.ts`, `types.ts`, `useGameStore.ts`, `ActionPanel.tsx`, `EventBanner.tsx`), not generic domain research. All file:line citations below are current as of the v1.5 codebase this milestone starts from.

> Supersedes the prior v1.5-era PITFALLS.md (theme/design-token/cleanup risks) for the purposes of the v1.6 "Fouls, Cards & Restarts" milestone. Those v1.5 concerns are already resolved in the shipped codebase and are not re-litigated here; this file is scoped to the specific risks of layering stoppage mechanics onto the existing dice-duel FSM.

## Critical Pitfalls

### Pitfall 1: New dice-roll event types are invisible to Undo unless registered in the boundary scan AND the client mirror — twice

**What goes wrong:**
`applyUndo` (`packages/server/src/gameEngine.ts:1401-1421`) decides the Undo floor by scanning `state.eventLog` for a fixed, explicitly-enumerated set of boundary event types (`SLOT_ADVANCE`, `KICK_OFF`, `TACKLE_ATTEMPT`, `STEAL_ATTEMPT`, plus phase-gated `HP_REPOSITION`/`FTP_REPOSITION`/`FK_KICKER_CHOSEN`/`FK_STAGE_ADVANCE`). A brand-new event type — `INJURY_ROLL`, `BOOKING_ROLL`, `GK_DIVE_AT_FEET`, or a new dice-roll type for goal-kick/corner/throw-in accuracy — is **not** a boundary by default. It will silently be treated as an ordinary undoable step, meaning a player could Undo past a resolved injury or booking roll and re-roll it — the exact defect class BUG-37 (v1.5, Phase 36) fixed for tackle/steal (`D-13` in the same file, lines 1393-1400).

The fix must be made in **two physically separate places that have no shared abstraction**: the server's `isBoundary` disjunction in `gameEngine.ts`, and the client's hand-mirrored copy in `packages/client/src/components/ActionPanel.tsx:268-277` (`canUndo`'s own `isBoundary` reduce). The client comment at `ActionPanel.tsx:250-253` states outright that this mirror is "UX mirror only, the server's applyUndo is the sole enforcement layer" — so a missed client update doesn't break correctness, but it does break UX: the Undo button will appear enabled when the server will reject it (or vice versa), producing a confusing silent-no-op click.

**Why it happens:**
There is no single source of truth for "what counts as an Undo boundary" — it's duplicated by hand, term-for-term, across a server pure function and a client component. This was already flagged as the fix pattern for BUG-37; nothing prevents the next contributor from forgetting to touch both sites, since neither file imports from the other (they're in different packages, and `actionSequence.ts`-style cross-package sharing wasn't used for this table).

**How to avoid:**

- Treat every new dice-roll ActionEvent introduced this milestone (foul roll, injury roll, booking roll, GK-dive-at-feet duel roll, and each new restart type's accuracy rolls) as a candidate Undo boundary by default, and require an explicit design decision (documented in the phase's CONTEXT.md) for each one, mirroring the BUG-37 precedent: "clamp, don't lock" — Undo should still work for steps _after_ a resolved dice roll.
- Add both updates (`gameEngine.ts` `isBoundary` and `ActionPanel.tsx` `canUndo`'s `isBoundary`) in the **same commit/plan task**, and add a regression test pair mirroring `gameEngine.phase26-undo.test.ts` (server) plus an equivalent client test, the way BUG-37 did.
- Consider (as a follow-up idea, not required this milestone) extracting the boundary-type list into a single exported `const` in `packages/shared` that both `applyUndo` and `ActionPanel.tsx` import, eliminating the duplication permanently — flag this as a candidate for the "Code Cleanup" backlog if not done now.

**Warning signs:**

- A Nyquist/UAT test undoes past a foul/injury/booking/substitution roll and the dice result changes on re-roll (rules-breaking) — or the reverse: Undo is unexpectedly blocked for ordinary moves earlier in the same slot when it shouldn't be.
- Client "Undo" button state disagrees with server's actual `GAME_UNDO` accept/reject behavior in a two-browser UAT session.

**Phase to address:**
Whichever phase implements Fouls/Booking/Injury dice rolls, and again for GK-dive-at-feet and each new restart type's dice rolls — this is a per-event-type checklist item, not a one-time fix.

---

### Pitfall 2: "Always-fires" dice rolls collide with the _other_, separate Undo lockout mechanism

**What goes wrong:**
`applyUndo` has **two different** dice-roll-related mechanisms, and it is easy to conflate them:

1. The boundary/clamp mechanism (Pitfall 1) — lets Undo continue working for later steps.
2. A full-slot **lockout**: `if (currentSlotEvents.some((e) => e.type === 'SLOT_ADVANCE' || e.type === 'DICE_ROLL')) return { ok: false, reason: 'UNDO_LOCKED' }` (`gameEngine.ts:1426-1428`) — this disables Undo for the **entire rest of the slot**, not just steps before the roll.

The generic literal type `'DICE_ROLL'` is checked here defensively but is essentially vestigial in production code — a repo-wide search shows it is never actually constructed by `gameEngine.ts` today (only referenced in one old Phase-8 test file). If a new implementation reuses `type: 'DICE_ROLL'` as a convenient generic tag for injury/booking rolls (rather than giving them proper typed events like `TACKLE_ATTEMPT`/`STEAL_ATTEMPT` have), it will **accidentally reactivate this dormant full lockout** — Undo becomes completely unavailable for the rest of the movement slot the instant an injury or booking roll fires, even though the milestone's whole point is that these rolls fire _without_ stopping play. This directly contradicts the "continue play" UX the feature is supposed to support.

**Why it happens:**
The type name `DICE_ROLL` is generic and inviting to reuse for "yet another kind of dice roll," but its behavioral meaning in `applyUndo` (full lockout, not clamp) is opposite to what BUG-37 established as the correct pattern (clamp) for the closest analogous case (tackle/steal).

**How to avoid:**
Give every new dice-roll event its own specific `ActionEventType` (e.g. `'INJURY_ROLL'`, `'BOOKING_ROLL'`, `'FOUL_CHECK'`) exactly as `TACKLE_ATTEMPT`/`STEAL_ATTEMPT`/`DEFLECT_ATTEMPT`/`HP_ACCURACY` already do — never reuse the literal `'DICE_ROLL'` type. Then explicitly decide, per Pitfall 1, whether each new type is a boundary (clamp) in `isBoundary`.

**Warning signs:**
Undo becomes unusable for the rest of a movement slot immediately after any foul/injury/booking roll, even for ordinary moves that happened afterward — a regression test asserting "Undo still works for a MOVE made after a continue-play foul roll" would catch this.

**Phase to address:**
Fouls/Booking/Injury dice-roll phase — should be an explicit task: "define new ActionEventType names, do not reuse `'DICE_ROLL'`."

---

### Pitfall 3: Same-phase broadcasts silently go stale on the client — this bug class has already happened once (Phase 32-05, `SELECTOR-REVIEW.md`)

**What goes wrong:**
`broadcastState` (`packages/server/src/roomStore.ts:337-341`) is the single, universal state-update mechanism: it emits a **full GameState snapshot** on every call, regardless of whether `phase` changed. The milestone explicitly requires injury and booking rolls to "always fire... without necessarily transitioning GamePhase" — meaning many of the new broadcasts this milestone introduces will be same-phase broadcasts (state mutates, `phase` string stays identical).

This project already hit this exact bug class: Phase 32-05's selector review (cited inline at `useGameStore.ts:286-291`, `useGameStore.ts:322-326`, and test file `useGameStore.test.ts:708-766`) found that `KICK_OFF_SETUP`/`FREE_KICK_SETUP` highlight/selection derived state was **only recomputed on phase transition**, so a same-phase broadcast (e.g., the opponent repositioning a piece) silently collapsed valid-move highlights to `[]` — a real shipped regression, fixed by making those selectors re-derive on every broadcast rather than gating on phase change.

Any new client derived-state introduced for foul/booking/injury/substitution/restart UI (e.g., "is a card currently displayed," "which player is newly injured," "is a substitution window open") that is computed with a `useEffect`/`useMemo` dependency on `phase` instead of on the full `gameState` (or `eventLog`) risks the identical staleness bug — and because these rolls are specifically designed to _not_ change phase, this milestone will exercise the same-phase-broadcast path far more than any prior milestone did.

**Why it happens:**
It's natural to key UI state off "what phase are we in," since most of the existing 30 `GamePhase` values map 1:1 to a distinct panel. This milestone breaks that assumption for the first time in a structural way (dice rolls that must fire but leave phase untouched), and the codebase has no enforced convention preventing a new selector from making the same phase-keyed mistake again.

**How to avoid:**

- Any new client state that reacts to foul/booking/injury results must key off `eventLog` (length/tail, per the `EventBanner.tsx` pattern) or off the full relevant `GameState` fields — never off `phase` alone.
- Add a same-phase-broadcast regression test for each new piece of derived state, mirroring the existing `useGameStore.test.ts` tests at lines 296, 495, 733, and the `SELECTOR-REVIEW.md`-referenced fixes.

**Warning signs:**
A card/injury notification or state update only appears when it happens to coincide with a phase change (e.g., right before End Turn), but silently fails to appear when the same roll fires mid-movement-phase during a "continue play" choice.

**Phase to address:**
Fouls/Booking/Injury dice-roll phase (client integration task), and again whenever a new restart type introduces its own repositioning sub-phases with same-phase inter-team broadcasts (mirrors the original `FREE_KICK_SETUP` bug).

---

### Pitfall 4: Batched multi-event broadcasts break UI surfaces that only look at the last new event

**What goes wrong:**
`EventBanner.tsx` (lines 58-84) implements a "diff-and-trigger" pattern: it tracks `eventLog.length` via a ref and, on growth, inspects **only `eventLog[eventLog.length - 1]`** — the single most recent event — to decide what banner to show. This works today because, historically, one player action has produced at most one "headline" event per broadcast in the cases EventBanner cares about (a steal, a tackle, a loose ball landing, a pass-accuracy result).

This milestone breaks that assumption on purpose: "injury + booking are always rolled regardless of [continue-play] choice" means a _single_ mutex-guarded handler call (one `isProcessing` cycle, one `broadcastState`) can append **multiple** new narrative events in one shot — e.g. `TACKLE_ATTEMPT` (foul-triggering roll of 1) → `INJURY_ROLL` → `BOOKING_ROLL`, all in the same `eventLog` splice. `EventBanner` will only ever surface the _last_ of those three. The server state is fully correct (attribute -1 applied, card issued, both events present in `eventLog` for the log/replay), but the player only sees one transient banner — a "looks broken on screen, correct in the log" defect that is easy to miss in casual testing and only surfaces during a careful UAT pass.

This is not unique to `EventBanner` — any other client consumer that assumes "one broadcast = one new noteworthy thing" (e.g. a future toast queue, or `ActionLog`'s newest-entry highlight, if one exists) is equally exposed.

**Why it happens:**
Every prior phase's action handlers were designed around "one player action → at most one duel/roll → one state change worth narrating." This milestone is the first to require _chained, unconditional_ dice rolls within a single action.

**How to avoid:**

- Change `EventBanner`'s diff logic to process **all newly-appended events** since `lastProcessedLengthRef.current` (queue them, or show them in sequence), not just the tail element — this is a required change, not optional, once foul/injury/booking rolls can co-occur.
- Add a regression test that appends 2-3 events in a single `eventLog` splice (mirroring a foul+injury+booking sequence) and asserts all qualifying banners are shown (or intentionally queued), not just the last.
- Audit any other "look at the newest event only" client code before this milestone ships.

**Warning signs:**
UAT session shows a booking (yellow card) was issued per the server log / scoreboard state, but no banner or notification ever appeared on screen because an injury roll happened to be logged immediately after it in the same broadcast.

**Phase to address:**
Fouls/Booking/Injury dice-roll phase — should include an `EventBanner` multi-event audit/fix task explicitly, not be discovered late in UAT.

---

### Pitfall 5: New `ActionEventType`s must be registered in at least four disconnected lists, or they silently vanish from replay/undo while gameplay looks fine live

**What goes wrong:**
Adding a new `ActionEvent` variant to the discriminated union in `packages/shared/src/types.ts` is necessary but **not sufficient**. To be fully wired, a new event type must _also_ be added to:

1. `REPLAY_ELIGIBLE_TYPES` in `gameEngine.ts:4532-4545` (`buildReplayFrames`) — otherwise the event is silently omitted from post-game replay, exactly the defect class BUG-30/BUG-31/the `HALF_TIME_KICKOFF_RESET` fix (`D-02` comment at `types.ts:168-177`) already had to patch twice for unrelated events ("no ActionEvent to hang replay reconstruction on").
2. `applyUndo`'s boundary/lockout logic (Pitfalls 1-2).
3. `ActionPanel.tsx`'s client-side `canUndo` mirror (Pitfall 1).
4. Possibly `ELIGIBLE_NEXT_ACTIONS`/`NextActionType` in `packages/shared/src/actionSequence.ts` if the new event represents a chooseable next ball-action (it likely does **not** for injury/booking/foul-check rolls, since those aren't ball actions — but it likely **does** for the new GK-dive-at-feet duel and the three new restart types' post-resolution actions).

None of these four lists share an enum, a lint rule, or a compile-time exhaustiveness check tying them together (the `Record<LastActionType, ...>` exhaustiveness in `actionSequence.ts` only guards _that_ table, not the other three). A new event type can be fully functional in live gameplay (state mutates correctly, `isProcessing` mutex works, `broadcastState` sends it) while being completely invisible in post-game replay and silently wrong in Undo — and none of the existing automated tests will catch a _missing_ registration, only a present-but-wrong one.

**Why it happens:**
This is the direct consequence of full-snapshot, event-sourced replay/undo being built as several independently-maintained lookup tables rather than one declarative registry, which was an acceptable tradeoff when new event types were added rarely (roughly one every couple of phases). This milestone adds far more new event types in one pass (foul/injury/booking rolls, GK-dive-at-feet duel, 3 new restart types × their own move/accuracy/stage events) than any prior milestone.

**How to avoid:**

- Maintain a single checklist (in the phase's plan or CONTEXT.md) enumerating every new `ActionEventType` introduced this milestone, and tick off all four registration points for each one before marking the task done.
- Add one regression test per new event type asserting it appears in `buildReplayFrames` output — mirroring the existing replay-integration test pattern (`replay.integration.test.ts`).
- Treat "silently missing from replay" as a Nyquist-testable condition: after any UAT play-through that triggers a foul/injury/booking/substitution/new-restart, replay the match and verify every such event is visibly reconstructed.

**Warning signs:**
A UAT session plays correctly live, but post-game replay skips or fails to show a foul/card/injury/substitution/new-restart event that clearly happened during the match.

**Phase to address:**
Every phase that introduces a new `ActionEventType` this milestone (Fouls/Booking/Injury, GK-dive-at-feet, Substitutions, and each of Goal Kick/Corner Kick/Throw-in) — this is a recurring per-phase checklist item, not a single fix.

---

### Pitfall 6: "A dice roll of 1 calls a foul" is ambiguous against the existing combined-score tackle/steal resolution — get the wrong die and fouls fire on the wrong side or at the wrong rate

**What goes wrong:**
Tackle and steal SUCCESS/FAIL today is decided by **combined score**, not the raw die face: `computeCombinedScore(defender.tackling, die, [])` vs `computeCombinedScore(carrier.dribbling, carDie, [])`, with `defCombined >= carCombined` on ties going to the defender (`gameEngine.ts:822-824` for steal, `:858-861` for tackle). There is no existing code path where "the die is 1" has any special meaning by itself — a combined score can still be high even with a raw die of 1 if the attribute is large, and vice versa.

The milestone's "a tackle/nutmeg/steal dice roll of 1 calls a foul" requirement is an **orthogonal check layered on top of** this existing SUCCESS/FAIL computation, and the requirement text alone does not specify _which_ die must show 1: the defender's `tackleDie`/`stealDie` (a mistimed/reckless tackle), the attacker's `carrierDie` (an unlikely rule but worth ruling out explicitly), or either. Implementing this incorrectly is a silent rules-fidelity bug — it will not throw an error, not fail a type check, and not be caught by any existing test, because no such test exists yet. It will only surface as "fouls happen at the wrong frequency" or "fouls happen on the wrong team's tackle," which is very hard to notice by eye during a normal 2-player playtest (a roll of 1 is only ~1/6 of rolls) and easy to get backwards.

**Why it happens:**
The feature is being layered onto dice-duel code that was never designed with a "raw die value has independent rules meaning beyond the combined score" concept — every other dice mechanic in the codebase (steal, tackle, header, shot, save, handling, pass accuracy) uses either a pure combined-score threshold or a fixed-threshold-vs-attribute comparison, never "raw die equals exactly 1" as a side-channel trigger.

**How to avoid:**

- Resolve the ambiguity explicitly in the phase's CONTEXT.md/plan **before** writing code: confirm against the rulebook (Counter Attack Rules Reference v1.4.1, referenced in `PROJECT.md`) exactly which die value must equal 1 (most likely the **defender's** tackle/steal die, per standard "reckless tackle" framing, but this must be verified against the actual rulebook text, not assumed).
- Write a dedicated unit test that fixes the combined-score inputs (so SUCCESS/FAIL is deterministic) and varies only the candidate die value 1..6, asserting foul-triggers only at the documented value(s) and only for the documented side.
- Do not conflate "tackle FAILED" with "foul called" — the milestone context implies these are independent outcomes (a failed tackle attempt with no foul should remain a plain FAIL, same as today).

**Warning signs:**
UAT feedback that fouls "feel" too frequent, too rare, or consistently favor one team; a probability/statistics regression test is the only reliable detector here since manual play won't reliably surface a 1-in-6 mis-wiring.

**Phase to address:**
Fouls & Booking phase (the phase implementing the foul-trigger check on tackle/nutmeg/steal).

---

### Pitfall 7: Substitution doesn't fit the `ELIGIBLE_NEXT_ACTIONS`/`LastActionType` sequence-guard model — it needs its own out-of-band eligibility check, like `GAME_UNDO` already has

**What goes wrong:**
`ELIGIBLE_NEXT_ACTIONS` (`packages/shared/src/actionSequence.ts`) is an exhaustive `Record<LastActionType, ReadonlySet<NextActionType>>` that encodes _legal ball-action sequencing_ — what can happen next given what just happened with the ball. It is checked at exactly three call sites in `gameHandlers.ts` (lines 354, 1304, 1412), all guarding ball-action handlers. Substitution is not a ball action, has no relationship to `LastActionType`, and per the milestone spec can happen "at any stoppage" — i.e., from many different `GamePhase` values (likely `HALF_TIME`, `FULL_TIME`, `GK_RESTART`, mid-`FREE_KICK_SETUP`, and the new restart-setup phases), not from a single point in the sequence.

The tempting-but-wrong implementation is to add a `'SUBSTITUTION'` member to `NextActionType` and thread it into `ELIGIBLE_NEXT_ACTIONS`'s rows — this couples substitution eligibility to the ball-action sequencing model it doesn't belong to, and worse, `ELIGIBLE_NEXT_ACTIONS` is a `Record` keyed by `LastActionType`, which has no entry that means "we are at a stoppage phase" (stoppages are represented by `GamePhase`, a completely different type). This mismatch would force awkward workarounds or silently fail to gate substitution correctly from phases that have no natural `LastActionType`.

The codebase already has the correct precedent for this: `GAME_UNDO` is **not** gated by `ELIGIBLE_NEXT_ACTIONS` at all — it has its own bespoke eligibility function (`applyUndo`'s own phase/eventLog scan) that the handler calls directly. Substitution should follow the same pattern: a standalone `isSubstitutionEligible(phase, ...)`-style check enumerating exactly which `GamePhase` values count as "a stoppage," independent of the ball-action sequence table.

**Why it happens:**
`ELIGIBLE_NEXT_ACTIONS` is the most visible, well-documented sequencing mechanism in the codebase (it has the most extensive doc comments of any single file), so it's the natural first place a contributor looks to "add a new allowed action" — even when the new action isn't actually part of that sequence at all.

**How to avoid:**

- Design substitution eligibility as a phase-keyed allow-list (which `GamePhase` values count as a stoppage), separate from `ELIGIBLE_NEXT_ACTIONS`, following the `applyUndo`/`GAME_UNDO` precedent.
- Explicitly enumerate every stoppage phase in the design doc up front — don't infer it ad hoc per-handler, since "at any stoppage" spans many current and newly-added phases and it's easy to forget one (e.g. `HALF_TIME`/`FULL_TIME` are easy to remember; a mid-stage `FREE_KICK_SETUP` or the new goal-kick/corner/throw-in setup phases are easy to forget).
- Add a parametrized test enumerating all `GamePhase` values and asserting substitution is allowed/rejected exactly as designed for each one — this turns "did we forget a phase" into a compile-time-adjacent, exhaustively-tested question instead of a runtime surprise.

**Warning signs:**
A UAT session finds substitution works at half-time but is silently rejected (or, worse, silently accepted when it shouldn't be) during a free-kick setup or a goal-kick setup sequence.

**Phase to address:**
Substitutions phase.

---

### Pitfall 8: Out-of-bounds detection is not centralized — the codebase's current model is "clamp to stay in bounds" scattered across every ball-movement code path, not "detect and classify"

**What goes wrong:**
The ball has never been allowed to leave the pitch before. Today, every code path that can move the ball independently clamps it to `isPitchHex` (`packages/shared/src/pitch.ts:195-197`) rather than detecting an exit:

- The loose-ball scatter walk explicitly says so in its own comment: `gameEngine.ts:2776` — _"pending out-of-bounds rules — ball stopped at board edge for now"_ — then clamps at `gameEngine.ts:2781` (`if (isPitchHex(next)) clampedPos = next; else break;`).
- Move validation rejects off-pitch destinations outright (`OFF_PITCH` at `gameEngine.ts:2986`).
- Pass/shot targeting rejects off-pitch targets (`gameEngine.ts:3060`, `:3823`).
- `FREE_KICK_SETUP` hex enumeration filters to on-pitch hexes only (`gameEngine.ts:4027`, `:4053`).

Converting "clamp to stay in bounds" into "detect the exit, classify it as sideline (throw-in) / attacking byline (corner) / defending byline (goal kick), and trigger the matching restart" is not a one-line change to `isPitchHex` — it requires **each of these independent call sites to be individually re-examined**, and it is very easy to correctly convert one path (say, shots) while leaving another (say, the loose-ball scatter, or a deflection) still silently clamping at the edge as before. That produces an inconsistent, hard-to-notice bug: the ball goes out of bounds correctly from a pass but is silently kept in bounds from a loose-ball bounce, with no error and no obviously wrong-looking state.

**Why it happens:**
There is no single "did the ball leave the pitch" check today — clamping is done ad hoc, locally, at each site that computes a new ball position, because until now "stay in bounds" was the _only_ required behavior everywhere. This milestone changes the required behavior in a way that cuts across many independent call sites at once.

**How to avoid:**

- Follow the existing precedent for "a check that must run after every action regardless of which action produced the new state": `applyFreeMoveZoneCheck` is invoked **centrally** from `broadcastState` (`roomStore.ts:339`), not duplicated at each ball-moving call site. Model out-of-bounds detection the same way — a single centralized post-action check against the resolved `ball.position`, run once per broadcast, rather than patching `isPitchHex` clamp logic at each of the 5+ existing call sites individually.
- If full centralization isn't feasible for v1.6 (some contexts need immediate feedback, e.g. rejecting an intentionally-off-pitch shot target at validation time rather than after resolution), explicitly enumerate every current `isPitchHex` clamp site as a checklist and verify each one's new behavior, rather than converting them opportunistically as they're noticed.
- Add a regression test matrix: for each ball-movement source (standard/high/long pass, shot, loose-ball scatter, deflection, GK kick, throw-in), assert the correct restart type triggers when the ball is sent past each of the three boundary types (both sidelines, both bylines).

**Warning signs:**
A UAT session finds throw-ins trigger correctly from a pass gone wide but the ball still gets clamped at the edge (no restart triggered) from a loose-ball bounce or a blocked-shot deflection.

**Phase to address:**
Out-of-Bounds Detection phase — should explicitly include an audit-and-convert task against every existing `isPitchHex` clamp call site, not just "add the new detection logic."

---

### Pitfall 9: No settings-toggle infrastructure exists yet — three independent game-creation toggles need the existing allow-list validation pattern, not a client-only checkbox

**What goes wrong:**
There is currently no `gameSettings`/feature-toggle concept anywhere server-side (no `foulsEnabled`, `bookingEnabled`, `restartsEnabled`, or equivalent — confirmed by an empty grep for any such term across `packages/server/src`). The milestone requires three **independent** game-creation toggles (Fouls, Booking, Out-of-Bounds/Restarts) in any combination. If these are implemented only as client-side UI gating (e.g., hiding the "take restart" button, or the client simply not sending certain actions when a toggle is off), a modified/malicious client could still trigger foul/booking/out-of-bounds behavior in a room where the host explicitly disabled it, since — per this project's own server-authoritative architecture (`ARCH-01`/`ARCH-04`) — the server never re-validates a purely-client-side gate.

The project has already built, and documented, the correct pattern for this exact class of problem: `SELECTABLE_DRAFT_POOLS` (`packages/shared/src/types.ts:488-494`) is the single source of truth for **both** the client's checkbox disabled-state **and** the server-side `ROOM_SETTINGS_CONFIRM` allow-list validation, with an explicit security-rationale comment: _"a modified client cannot select any pool outside this list"_ (mirroring the identical rationale already stated for `ELIGIBLE_NEXT_ACTIONS` at `actionSequence.ts:17-19`, `T-08-01`). The new Fouls/Booking/Out-of-Bounds toggles need the same treatment: stored in `GameState` itself (mirroring `gameSpeed`/`selectedFormation`, which already ride along in every snapshot), and re-checked server-side at every relevant handler entry point (tackle/steal resolution, the ball-exit-classification check from Pitfall 8, etc.) — not just validated once at room-creation time and then trusted implicitly thereafter.

**Why it happens:**
It's the fastest way to get a demo-able toggle working: add a checkbox, don't render the affected UI, ship it. The project has repeatedly had to retrofit server-side allow-list validation after the fact for similar toggle-like settings (draft pools, uniform styles) — this pitfall is flagging the chance to do it right the first time instead.

**How to avoid:**

- Add the three toggles to `GameState` (or the room's settings object embedded in every snapshot) at design time, not as an afterthought.
- Gate every new handler this milestone introduces (foul/injury/booking roll trigger, substitution accept, new-restart-type entry) on the server-side toggle value, in addition to any client-side UI hiding.
- Add a security-style test per toggle: attempt the gated action via a direct socket emit (bypassing the client UI) with the toggle disabled, and assert the server rejects it — mirroring the existing allow-list tests for draft pools.

**Warning signs:**
A toggle "works" in normal play (because the client UI correctly hides the disabled feature) but a two-browser UAT session that intentionally sends a raw socket event for a disabled feature succeeds anyway.

**Phase to address:**
Whichever phase adds the game-creation settings toggles (likely bundled with the Fouls/Booking/Out-of-Bounds phases themselves, or a shared "Settings" phase if the roadmap centralizes it) — flag this explicitly so it isn't silently dropped the way RESP-01..09 was when a phase got renamed (see Pitfall 10).

---

### Pitfall 10: This is a large multi-subsystem milestone — phase renaming/renumbering has silently dropped requirements twice before in this exact project

**What goes wrong:**
`PROJECT.md`'s own history records this happening twice already: v1.4's roadmap had a Phase 27 titled "Response Activation Model" that was replaced by "Game Creation Settings" during planning, and RESP-01..09 were never picked up by any later phase — undetected until the v1.4 milestone audit. v1.5 deferred the same backlog item again. Separately, a recorded project-memory note (`feedback_roadmap_requirement_drift.md`) generalizes this exact failure mode: _"a renumbered/redefined roadmap phase can silently drop its original requirements; cross-check traceability against each phase's actual ROADMAP.md scope during audits."_

v1.6 is structurally exposed to the same risk more than most milestones: it bundles at least six distinct, only-loosely-related subsystems (fouls, cards/bookings, injuries, substitutions, three new restart types, out-of-bounds detection) behind three independent toggles, all as one milestone. If phase planning splits, merges, or renames any of these mid-milestone (which is exactly what happened to RESP-01..09), a whole requirement category (e.g. "Substitutions" or "Out-of-Bounds Detection") could be silently dropped the same way, and — per the same project history — nobody would necessarily notice until the next milestone's audit, several weeks of work later.

**Why it happens:**
Phase planning legitimately does discover better groupings mid-milestone (the v1.4/Phase 30 draft recalibration is cited in `PROJECT.md` as an example of _good_, intentional, documented re-scoping — "superseded design," not silently dropped). The failure mode isn't re-scoping itself, it's re-scoping **without** updating the requirement traceability, so a renamed/merged phase's original requirement IDs quietly stop being tracked anywhere.

**How to avoid:**

- Assign stable requirement IDs up front for each subsystem this milestone (e.g. `FOUL-xx`, `BOOK-xx`, `INJ-xx`, `SUB-xx`, `RESTART-xx`, `OOB-xx`) before phase planning begins, and require any phase rename/merge/split during execution to explicitly re-map every affected requirement ID in `ROADMAP.md`/`STATE.md`, not just rename the phase title.
- At each `/gsd-transition`, explicitly diff "requirements this phase was supposed to satisfy per the original roadmap" against "requirements this phase's plans actually implemented" — this is the check that was missing both times before.
- At milestone close, audit every one of the six subsystems above individually against `v1.6-REQUIREMENTS.md`, the same way the v1.4 audit eventually caught the RESP-01..09 gap (just earlier this time).

**Warning signs:**
A phase's title or scope changes mid-milestone without an explicit "requirement X is now covered by phase Y instead" note in `STATE.md`/`ROADMAP.md`; a milestone audit finds a target-feature bullet from `PROJECT.md`'s "Target features" list with no corresponding validated requirement anywhere.

**Phase to address:**
Roadmap-creation and every subsequent phase-transition for this milestone — this is a process pitfall, not a code pitfall, and should be enforced by the `/gsd-transition` and `/gsd-complete-milestone` workflows rather than by any single phase.

---

## Technical Debt Patterns

| Shortcut                                                                                                                                                                  | Immediate Benefit                                                                     | Long-term Cost                                                                                                                                                                                                                                       | When Acceptable                                                                                                                              |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Reuse the generic `'DICE_ROLL'` `ActionEventType` for new injury/booking rolls instead of giving each a specific type                                                     | Saves defining new types/branches                                                     | Reactivates the dormant full-slot Undo lockout (Pitfall 2) — a correctness bug, not just style                                                                                                                                                       | Never                                                                                                                                        |
| Add `'SUBSTITUTION'` as a `NextActionType` row in `ELIGIBLE_NEXT_ACTIONS` instead of a standalone phase-keyed eligibility check                                           | Reuses an existing, well-tested mechanism                                             | Couples substitution to ball-action sequencing it doesn't belong to; awkward for "any stoppage" phases with no `LastActionType` (Pitfall 7)                                                                                                          | Never                                                                                                                                        |
| Patch `isPitchHex` clamp sites opportunistically as out-of-bounds bugs are noticed in UAT, rather than auditing all sites up front                                        | Faster to start showing progress                                                      | Inconsistent OOB behavior across ball-movement sources (loose ball vs. pass vs. shot) that's hard to notice by eye (Pitfall 8)                                                                                                                       | Only for the very first prototype/spike, never for the shipped phase                                                                         |
| Gate new toggles (Fouls/Booking/Out-of-Bounds) client-side only for an initial demo                                                                                       | Fast to build, looks complete in normal play                                          | Server-authoritative architecture is violated; a modified client can force disabled features (Pitfall 9)                                                                                                                                             | Only behind an explicit, tracked TODO if truly time-boxed — must be closed before milestone ships, same standard as `SELECTABLE_DRAFT_POOLS` |
| Route the injury/booking rolls through a brand-new `GamePhase` (e.g. `FOUL_CHECK`) instead of resolving them inline within the existing action without a phase transition | Simpler mental model, reuses the phase-driven panel-rendering pattern everywhere else | Directly contradicts the milestone requirement that these rolls "must ALWAYS fire... even when the player chooses NOT to stop play" — forcing a phase transition for a roll that shouldn't interrupt play is a requirements violation, not just debt | Never for the "continue play" path; a dedicated phase may be appropriate for the "stop play" (take the restart) path only                    |

## Integration Gotchas

Common mistakes when connecting new-feature code to this codebase's existing internal systems (there are no external services in this project — "integration" here means integrating with the FSM/broadcast/undo/replay layers).

| Internal System                     | Common Mistake                                                                                                                                                                                                     | Correct Approach                                                                                                                                                                                                                                                                                                         |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `isProcessing` mutex                | Emitting a separate client event for "continue play" vs. the always-fires injury/booking rolls, requiring two round-trips (and two `isProcessing` windows) that a network hiccup or double-click could desync      | Resolve the always-fires rolls (foul check, injury, booking) **within the same mutex-guarded handler call** that resolves the triggering tackle/steal — exactly like today's single `applyMove` call already resolves both `STEAL_ATTEMPT`/`TACKLE_ATTEMPT` and any half-end check in one pass (`gameEngine.ts:808-899`) |
| `broadcastState` full snapshot      | Assuming a same-phase broadcast means "nothing important changed" on the client                                                                                                                                    | See Pitfall 3 — key derived state off `eventLog`, not `phase`                                                                                                                                                                                                                                                            |
| `eventLog` / replay                 | Adding a new `ActionEvent` variant without threading it through `REPLAY_ELIGIBLE_TYPES`, `applyUndo`, and the client `canUndo` mirror                                                                              | See Pitfall 5 — maintain an explicit per-event-type registration checklist                                                                                                                                                                                                                                               |
| `ELIGIBLE_NEXT_ACTIONS`             | Adding non-ball-actions (substitution) as fake `NextActionType` rows to reuse existing sequencing plumbing                                                                                                         | See Pitfall 7 — use a standalone phase-keyed eligibility check instead, mirroring `GAME_UNDO`'s own bespoke gating                                                                                                                                                                                                       |
| `moveValidator.ts` effect detection | Adding a third effect branch (`GK_DIVE_AT_FEET`) to code that currently only distinguishes `STEAL_ATTEMPT` vs `TACKLE_ATTEMPT` via separate `if` blocks (not an exhaustive `switch`) in `gameEngine.ts:811`/`:846` | Add the new effect type to the `ApplyMoveEffect` union in `moveValidator.ts` **and** an explicit new `if ('effect' in result && result.effect.type === 'GK_DIVE_AT_FEET')` branch in `gameEngine.ts` — do not assume the existing two `if` blocks will "fall through" correctly for a third case                         |

## Performance Traps

| Trap                                                                                                                                                                                                   | Symptoms                                                                                                                                                                                      | Prevention                                                                                                                                                                                                         | When It Breaks                                                                                                                                      |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GameState`'s optional-field sprawl (already 100+ fields in `types.ts`) grows further with per-restart-type stage/slot/pace tracking fields (mirroring the `freeKick*`/`gkKick*`/`highPass*` patterns) | Type file becomes harder to review; full-snapshot broadcast payload grows slightly every phase                                                                                                | Reuse shared field-naming/shape conventions across the 3 new restart types where the mechanics genuinely match `FREE_KICK_SETUP`'s stage model, rather than inventing parallel one-off field sets per restart type | Not a runtime performance problem at 2-player scale — this is a maintainability/review-burden trap, not a scale trap                                |
| `eventLog` is unbounded and re-sent in full on every `broadcastState` call                                                                                                                             | A long match with many fouls/bookings/injuries/substitutions/restarts appends many more events per half than before v1.6, growing every subsequent snapshot payload for the rest of the match | Acceptable at this project's declared scale (2 concurrent players, single match); revisit only if a future milestone adds spectators or long tournament sessions                                                   | Not expected to break at this project's stated scale; flagged only because this milestone is the largest single addition to event-type count so far |

## Security Mistakes

Domain-specific issues beyond general web security, specific to this project's server-authoritative model.

| Mistake                                                                                                                            | Risk                                                                                                                                                                                               | Prevention                                                                                                                                                                                                                    |
| ---------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Client-only gating of the Fouls/Booking/Out-of-Bounds toggles                                                                      | A modified client forces foul/card/restart behavior into a room where the host disabled it (Pitfall 9)                                                                                             | Server-side allow-list/toggle check at every gated handler, mirroring `SELECTABLE_DRAFT_POOLS`                                                                                                                                |
| Client-supplied "continue play" vs. "take the restart" choice trusted without re-validating it's the attacker's own choice to make | Wrong player could force a restart, or suppress one, via a forged socket event                                                                                                                     | Validate the choosing player's socket against `socket.data.playerSlot`/team ownership, exactly as existing handlers already do for `WRONG_TEAM` rejection (per the file-header anti-pattern notes in `gameHandlers.ts:16-20`) |
| Injury/booking/foul-check dice generated anywhere other than server-side `crypto.randomInt` (`diceUtils.ts`)                       | Reintroduces a client-trust bug class this project has explicitly avoided everywhere else (per project constraints: "dice are generated server-side only via crypto.randomInt, never client-side") | Route every new dice roll through the existing `rollDice`/`diceUtils.ts` mechanism — no exceptions for the new roll types                                                                                                     |

## UX Pitfalls

| Pitfall                                                                                                                                                                                                              | User Impact                                                                                         | Better Approach                                                                                                                                                                                                                                                               |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Injury/booking outcome only surfaces via `ActionLog` text, not a transient banner, because it doesn't own a `GamePhase` transition to hang a "new panel" off of                                                      | Player misses a card/injury unless they happen to scroll/read the log                               | Extend `EventBanner` (after fixing Pitfall 4's batching issue) to cover the new event types explicitly — this project already has the "transient notification independent of phase" pattern (UX-14/`EventBanner`), it just needs the multi-event fix and new message mappings |
| "Continue play" choice UI still visible/clickable while the always-fire injury/booking rolls are resolving (a same-phase broadcast mid-resolution)                                                                   | Double-submission risk, or player confusion about whether their non-stop choice already "locked in" | Disable/hide the choice UI the instant the triggering roll of 1 occurs, using the same `isProcessing`-aware submit-guard pattern the client already uses elsewhere for dice-roll buttons                                                                                      |
| New restart-type (goal kick/corner/throw-in) repositioning stages copy `FREE_KICK_SETUP`'s UX exactly, including its still-open known gap ("FREE_KICK_SETUP Undo not implemented" per `PROJECT.md`'s tech-debt list) | Players hit the same missing-Undo frustration in three more contexts                                | Decide explicitly whether Undo support is in scope for the new restart types before copying the `FREE_KICK_SETUP` pattern wholesale — don't silently inherit a known, already-flagged gap into three new features                                                             |

## "Looks Done But Isn't" Checklist

- [ ] **Foul/injury/booking dice rolls:** Server state (attribute -1, card issued) is correct — but verify the corresponding `EventBanner`/log entry is actually visible when multiple rolls batch into one broadcast (Pitfall 4).
- [ ] **Undo after a foul/injury/booking roll:** Verify Undo clamps exactly at the resolved roll (steps after remain undoable) and does not either (a) allow re-rolling the committed outcome or (b) lock Undo for the entire rest of the slot (Pitfalls 1-2).
- [ ] **Substitution "at any stoppage":** Verify the phase-eligibility check actually enumerates every stoppage `GamePhase` this milestone touches, including mid-stage `FREE_KICK_SETUP` and each new restart type's setup phases — not just the obvious `HALF_TIME`/`FULL_TIME` cases (Pitfall 7).
- [ ] **Out-of-bounds classification:** Verify sideline/attacking-byline/defending-byline classification is correct for **both** teams' perspectives (attacking byline flips depending on which team last touched the ball / which team is attacking), and that it fires consistently from every ball-movement source (pass, shot, loose-ball scatter, deflection, GK kick) — not just the one source that was tested first (Pitfall 8).
- [ ] **New restart types (goal kick/corner/throw-in):** Verify each independently registers its new move/stage events in `REPLAY_ELIGIBLE_TYPES` and `applyUndo`, the same way `FREE_KICK_SETUP` had to (Pitfall 5) — don't assume copying the `FREE_KICK_SETUP` _move logic_ also copied its replay/undo registration.
- [ ] **Settings toggles (Fouls/Booking/Out-of-Bounds):** Verify a disabled toggle is enforced server-side by attempting the gated action via a raw socket emit, not just by confirming the client UI hides it (Pitfall 9).
- [ ] **GK-dive-at-feet duel:** Verify it actually fires (a distinct `if` branch executes) rather than silently falling through as an ordinary uncontested `MOVE` when the effect-detection logic in `moveValidator.ts` doesn't recognize the new effect type (Integration Gotchas table).
- [ ] **Requirement traceability:** At milestone close, verify every "Target feature" bullet in `PROJECT.md`'s v1.6 Current Milestone section maps to a validated requirement ID somewhere in `v1.6-REQUIREMENTS.md` — cross-check against the actual phase scope in `ROADMAP.md`, not just phase titles (Pitfall 10).

## Recovery Strategies

| Pitfall                                                                                   | Recovery Cost | Recovery Steps                                                                                                                                                                                                                                      |
| ----------------------------------------------------------------------------------------- | ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Missing Undo boundary for a new dice-roll type (Pitfall 1)                                | LOW           | Add the event type to both `isBoundary` disjunctions (server + client); add a regression test pair; no data migration needed since `eventLog` shape doesn't change                                                                                  |
| `'DICE_ROLL'` type reused, reactivating the full-slot lockout (Pitfall 2)                 | LOW-MEDIUM    | Rename the event type to a specific one; re-verify no other code (tests, replay) depended on the generic `'DICE_ROLL'` literal being used                                                                                                           |
| Same-phase staleness in a new selector (Pitfall 3)                                        | LOW           | Change the `useEffect`/`useMemo` dependency from `phase` to `eventLog`/full `gameState`, mirroring the Phase 32-05 fix; add the regression test that would have caught it                                                                           |
| `EventBanner` drops a batched event (Pitfall 4)                                           | LOW-MEDIUM    | Change the diff-and-trigger loop to process all newly-appended events, not just the tail; requires a small UX decision (show sequentially vs. combined message)                                                                                     |
| New `ActionEventType` missing from `REPLAY_ELIGIBLE_TYPES`/`applyUndo` (Pitfall 5)        | LOW           | Add to the missing list(s); no state-shape change; existing matches/replays already in progress are unaffected since this is a build-time registration, not stored data                                                                             |
| Foul-on-1 wired to the wrong die (Pitfall 6)                                              | MEDIUM        | Requires a rules-verification pass against the actual rulebook, a code fix, and re-running/rewriting the probability regression test — may require a live UAT re-check since the original bug is hard to notice by eye                              |
| Substitution wired into `ELIGIBLE_NEXT_ACTIONS` instead of a standalone check (Pitfall 7) | MEDIUM        | Requires refactoring the gating logic out of the sequence table into its own eligibility function — a design-level fix, not a one-line patch, best caught before merge via code review rather than after                                            |
| Out-of-bounds detection inconsistent across ball-movement sources (Pitfall 8)             | MEDIUM-HIGH   | Requires the full audit of all `isPitchHex` clamp sites that should have been done up front; each site needs its own targeted fix and test                                                                                                          |
| Settings toggle bypassable via raw socket emit (Pitfall 9)                                | LOW-MEDIUM    | Add server-side validation at the gated handler(s); low cost if caught before ship, reputational/trust cost if caught after (this is exactly the class of bug the project's own `ASVS`-referenced security comments elsewhere are meant to prevent) |
| Requirement silently dropped during phase renaming (Pitfall 10)                           | HIGH          | Requires a dedicated remediation phase (as v1.4→v1.5's RESP-01..09 carry-forward already demonstrates) — the recovery cost of _not_ catching this early is an entire extra milestone cycle                                                          |

## Pitfall-to-Phase Mapping

| Pitfall                                                   | Prevention Phase                                                                                            | Verification                                                                                                                                 |
| --------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Undo boundary blind spot for new dice-roll events (P1)    | Fouls/Booking/Injury phase; GK-dive-at-feet phase; each new restart-type phase                              | Server + client regression test pair per new event type, mirroring `gameEngine.phase26-undo.test.ts`                                         |
| `'DICE_ROLL'` reuse reactivating full lockout (P2)        | Fouls/Booking/Injury phase                                                                                  | Test: Undo remains available for a MOVE made after a continue-play foul/injury/booking roll                                                  |
| Same-phase broadcast staleness (P3)                       | Fouls/Booking/Injury phase (client integration); each new restart-type phase                                | Test: derived state recomputes correctly across a same-phase broadcast, mirroring `useGameStore.test.ts` SELECTOR-REVIEW.md regression tests |
| `EventBanner` batched-event drop (P4)                     | Fouls/Booking/Injury phase                                                                                  | Test: multiple events appended in one `eventLog` splice all surface (sequentially or combined)                                               |
| New event types missing from replay/undo registries (P5)  | Every phase introducing a new `ActionEventType`                                                             | Test: each new event type appears correctly in `buildReplayFrames` output                                                                    |
| Foul-on-1 wired to wrong die (P6)                         | Fouls & Booking phase                                                                                       | Deterministic probability regression test varying only the die value; rulebook cross-check documented in phase CONTEXT.md                    |
| Substitution shoehorned into `ELIGIBLE_NEXT_ACTIONS` (P7) | Substitutions phase                                                                                         | Parametrized test enumerating all `GamePhase` values against substitution eligibility                                                        |
| Out-of-bounds detection inconsistent across sources (P8)  | Out-of-Bounds Detection phase                                                                               | Regression matrix: every ball-movement source × every boundary type (2 sidelines, 2 bylines)                                                 |
| Settings toggles client-only (P9)                         | Settings-toggle implementation (bundled with Fouls/Booking/Out-of-Bounds phases or a shared Settings phase) | Raw-socket-emit test per toggle with the toggle disabled                                                                                     |
| Requirement drift during phase renaming (P10)             | Roadmap creation; every `/gsd-transition`; milestone close                                                  | Requirement-ID traceability diff at every phase transition and at milestone audit                                                            |

## Sources

- Direct source reading of this codebase (all citations above are file:line references, current as of the v1.5-complete state this milestone starts from): `packages/server/src/gameEngine.ts`, `packages/server/src/gameHandlers.ts`, `packages/server/src/roomStore.ts`, `packages/shared/src/actionSequence.ts`, `packages/shared/src/types.ts`, `packages/shared/src/pitch.ts`, `packages/shared/src/moveValidator.ts`, `packages/client/src/store/useGameStore.ts`, `packages/client/src/components/ActionPanel.tsx`, `packages/client/src/components/EventBanner.tsx`.
- Project history / prior incidents cited: BUG-37 undo-boundary-at-resolved-dice-roll fix (v1.5, Phase 36); Phase 32-05 `SELECTOR-REVIEW.md` same-phase-broadcast staleness fix; BUG-30/BUG-31 replay-reconstruction gaps; v1.4 RESP-01..09 requirement-drop during Phase 27 rename.
- `.planning/PROJECT.md` (Current State, Current Milestone, Key Decisions, Known tech debt sections).
- User memory: `feedback_roadmap_requirement_drift.md`, `feedback_worktree_junction_risk.md` (Windows-specific, not applicable to this research but reviewed).

---

_Pitfalls research for: Counter Attack POC v1.6 (Fouls, Cards & Restarts)_
_Researched: 2026-08-03_
