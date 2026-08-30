# Architecture Research — v1.8 Integration

**Domain:** Integration architecture for 5 features landing on a mature, server-authoritative hex-grid football game (Counter Attack POC)
**Researched:** 2026-08-30
**Confidence:** HIGH (every finding below is grounded in direct reads of the current codebase — file/line references included; no invented APIs)

This is a subsequent-milestone research doc. There is no "standard architecture for this domain" question to answer — the existing architecture (pnpm monorepo, server-authoritative `gameEngine.ts` FSM, Socket.io typed events, Zustand client store) is fixed and already well-documented in `CLAUDE.md`/`PROJECT.md`. The only useful output here is: **where exactly do these 5 features hook into the existing code, what's new vs. modified, and in what order should they be built.**

## System Overview (as it exists today, relevant slice only)

```
┌───────────────────────────────────────────────────────────────────────────┐
│ CLIENT (packages/client)                                                   │
│  GameBoard.tsx ─┬─ topBandRight: phase-switched panel                      │
│                 │    (ActionPanel | FoulChoicePanel | GkBoxEntryPromptPanel│
│                 │     | ...11 other phase panels)                          │
│                 ├─ pitchContainer: HexGrid.tsx + EventBanner.tsx (fixed)    │
│                 └─ {subOpen && <LineupAssignmentScreen mode="midmatch">}   │
│  useGameStore.ts (Zustand) — setGameState() replaces state wholesale        │
│                    on every 'game:state' socket event                      │
└───────────────────────────────────────────────────────────────────────────┘
                              │ Socket.io typed events
┌───────────────────────────────────────────────────────────────────────────┐
│ SERVER (packages/server)                                                   │
│  gameHandlers.ts — one socket.on(...) per ClientEvent, each: validate →    │
│    call a pure gameEngine.ts function → mutate room.gameState →            │
│    broadcastState(io, room)                                                │
│  roomStore.ts — broadcastState() is the SINGLE ARCH-04 broadcast choke     │
│    point; also the single hook site for the box-entry/dive-at-feet         │
│    "offer" phase substitutions (edge-triggered on ball-position deltas)    │
│  gameEngine.ts (10,849 lines) — pure functions, one GamePhase FSM,         │
│    no io/socket dependency                                                 │
└───────────────────────────────────────────────────────────────────────────┘
                              │ imports
┌───────────────────────────────────────────────────────────────────────────┐
│ SHARED (packages/shared) — pitch.ts (isInRegion/regions), types.ts,        │
│  formations.ts (per-slot jerseyNumber), fouls.ts, offside.ts, etc.         │
└───────────────────────────────────────────────────────────────────────────┘
```

---

## Feature 1 — Select-based roster swap/substitution (replaces drag-and-drop)

### Where it lives today

`packages/client/src/components/LineupAssignmentScreen.tsx` is a single 1,424-line component with **three structurally separate render branches**, gated by props (`mode`/`draftMode`): the pregame Standard-mode branch (~line 1372-1424), the draft-mode branch (~line 1241-1354), and the mid-match branch (`mode === 'midmatch'`, ~line 1012-1239). **Only the mid-match branch is in scope for this milestone** — the pregame and draft-mode drag-and-drop branches are untouched (they use a different, simpler index-based swap that isn't part of this milestone's requirements).

Inside the mid-match branch, positioning and substitution are **already two separate sub-modes sharing one piece of state and one component tree**, guarded by a `subMode: 'reposition' | 'substitute'` toggle button (line 517, 1150-1182):

| Concern | Positioning mode (`reposition`) | Substitution mode (`substitute`) |
|---|---|---|
| Drag state | `midmatchDrag: { source: 'pitch'; pieceId }` | `midmatchDrag: { source: 'bench'; playerId }` |
| Drop handler | `handleMidmatchRepositionDrop` (line 543) — fires **synchronously**, no confirm | `handleMidmatchSubstituteDrop` (line 562) — **stages** into `pendingSub` state, requires a confirm popup (line 1200-1234) |
| Server call | `onReposition?.(pieceIdA, pieceIdB)` → `GAME_ROSTER_REPOSITION` (`gameHandlers.ts:1872`) → `applyRosterReposition` (`gameEngine.ts:3830`) | `onSubstitute?.(outPieceId, inPlayerId)` → `GAME_SUBSTITUTION` (`gameHandlers.ts:1786`) → `applySubstitution` (`gameEngine.ts:3604`) |
| Eligibility already computed client-side | `midmatchDraggable` (line 702-709): not GK, not slot-index-0, `isActivePiece`, no pending sub, `subMode==='reposition'` | **None** — any bench card can be dragged onto any on-pitch card; GK-role-parity (`GK_SLOT_REQUIRES_GK`/`NON_GK_SLOT_REJECTS_GK`) is only checked **server-side** and surfaces as a rejection message after the fact (lines 390-423) |
| Deliberate code-doc constraint | Comment at line 133-138 calls this **"Pitfall 5 HARD CONSTRAINT"**: the two drop handlers must "share no guard body" | same |

There is also a **third, structurally duplicated drag/drop wiring block** for the "SENT OFF" placeholder cards (lines 637-687) that reimplements both modes' `onDragOver`/`onDrop` logic a second time because a red-carded piece's slot is a legal reposition target but never rendered as a normal `LineupStatCard`.

`LineupStatCard` (the shared card component, line 224-350) branches its `isDraggable`/`onDragStart` wiring on `mode === 'midmatch'` (`isMidmatch`, line 246) vs. pregame/draft — this branch point is exactly where the new click-select interaction needs to be inserted, without touching the pregame/draft branches of the same component.

### What changes

**Modified (not replaced):**
- `LineupAssignmentScreen.tsx`'s `mode === 'midmatch'` branch only (~800 lines: state at 510-528, handlers at 530-597, `renderMidmatchColumn` at 599-771, the return JSX at 1012-1239). Pregame branch (1372-1424) and draft-mode branch (1241-1354) are untouched.
- `LineupStatCard`'s `isMidmatch` branch of `isDraggable`/`onDragStart`/`onDragOver`/`onDrop` (lines 246-266, 298-307) — swap for `onClick` + a `selected`/`eligible` CSS state. The pregame/draft branch of the same ternaries stays as-is.

**New:**
- A unified selection state, e.g. `selectedSource: { kind: 'pitch'; pieceId: string } | { kind: 'bench'; playerId: string } | null`, replacing `midmatchDrag`/`midmatchDropTargetPieceId`.
- A pure "compute eligible targets" function per selection kind:
  - Pitch-selected → eligible = other on-pitch pieces excluding GK (role or slot-index-0), excluding the ball carrier, excluding self. This is a direct client mirror of `applyRosterReposition`'s guards 4/5 (`gameEngine.ts:3861-3887`) — currently only enforced by disabling `draggable`, never surfaced as a "why is this greyed out" concept for a click model.
  - Bench-selected → eligible = active (non-red-carded) on-pitch pieces whose role parity matches the bench player's role (mirrors `applySubstitution` guards 4/9, `gameEngine.ts:3636`, `3672-3677`). **This eligibility check does not exist client-side today** — it must be added new, since drag-and-drop never needed to pre-filter valid drop targets (it just rejected on drop with a message).
- Click-to-deselect (clicking the already-selected card again) — new; drag-and-drop has no equivalent gesture.

**Unchanged (reuse as-is):**
- `applyRosterReposition` and `applySubstitution` (server) — the interaction model change is purely client-side; the server-side guard chains are already the ground truth and don't need to know how the client gathered the two IDs.
- The staged-confirm popup for substitution (`pendingSub`/`PendingSubstitution` type, lines 141-155, 1196-1234) — this popup UX is orthogonal to drag vs. click; only what populates `pendingSub` changes (second click instead of a drop event).
- The mode-toggle button's *underlying distinction* (repositioning is free/instant/uncapped; substitution is capped/staged/confirmed) — still real and still needs two different result paths after the second click. What's genuinely open is whether the **explicit `subMode` toggle button** (line 1150-1182) is still needed once the selection *source* (pitch vs. bench) already disambiguates intent unambiguously — recommend dropping the toggle in favor of source-implied mode, but this is a UX call for the planning phase, not something to resolve in research.

### Build-order implication (the shared-risk question)

Positioning and substitution are **not separable into independent phases** — they already live in one `mode === 'midmatch'` branch, share one drag-state shape, and share the container-level `onDragEnd` cleanup (line 1076-1079) and the sent-off-slot duplicate wiring (637-687). Splitting them into two unrelated PRs would force a confusing intermediate state where one sub-mode is click-based and the other is still drag-based inside the same screen.

**Recommended sequencing within one phase/plan group:**
1. Build the new selection state + eligible-target computation for **positioning first** (it's the simpler of the two: free, uncapped, synchronous result, mirrors `handleMidmatchRepositionDrop`'s directness with no popup). Ship it as the default interaction, fully removing drag wiring for that path.
2. Extend the **same** selection state to substitution (bench-source selection), adding the new GK-role-parity + red-card eligibility computation, and reuse the existing `pendingSub` confirm-popup mechanism unchanged.
3. Only after both paths are unified under one selection model, delete the now-dead drag-and-drop scaffolding: `midmatchDrag`, `midmatchDropTargetPieceId`, `handleMidmatchDragStart`, `handleMidmatchRepositionDrop`, `handleMidmatchSubstituteDrop`, the sent-off-slot's duplicate onDragOver/onDrop block, and the container `onDragEnd`.

Doing it in this order means step 2 extends an already-proven state shape rather than two features being designed in parallel and reconciled at the end — directly avoiding the shared-file collision risk the milestone context flagged.

---

## Feature 2 — GK box-entry offer must fire BEFORE the shot-blocking dive

### Where it lives today

The box-entry offer chain (`computeBoxEntryOffer`/`applyBoxEntryResponse`/`applyBoxEntryMove`, `gameEngine.ts:2854-3010`) is **only** invoked from one place: `broadcastState()` in `packages/server/src/roomStore.ts:451-582`. It is edge-triggered off `state.ball.position` deltas (`prevBallPosition` vs. current), and only fires when `state.phase` is in a hard-coded whitelist:

```ts
// roomStore.ts:419-423
const GK_BOX_ENTRY_PHASES: ReadonlySet<GamePhase> = new Set<GamePhase>([
  'MOVE', 'PASS', 'LOOSE_BALL',
]);
```

`'GK_DIVE'` (the shot-blocking phase — code calls it `GK_DIVE`, not `GK_DIVING`) is **deliberately excluded** from this whitelist per the code's own comment (roomStore.ts:392-417): entering `GK_DIVE` is treated as "already the correct, dedicated GK-interaction mechanic for a shot" and must not be double-interrupted by a second, unrelated offer.

A shot is declared via `applyDeclareShot` (`gameEngine.ts:9406-9483`), which transitions `PASS → GK_DIVE` **directly and synchronously** inside one handler call (`enterGkDiveOrSkip`, line 9472), with `shooter.position` unchanged (the shooter doesn't move when declaring a shot — only `shotTargetHex`/`lastShotPath` are recorded). Because:
1. `broadcastState`'s box-entry check runs on `state.ball.position`, which hasn't moved during a shot declaration, and
2. `GK_DIVE` is never in `GK_BOX_ENTRY_PHASES`,

the box-entry offer **cannot fire at shot-declaration time under the current wiring at all** — it only ever fires later, edge-triggered off an actual ball-position change once the shot has already fully resolved and the ball has landed back in a whitelisted phase (e.g., a rebound settling into `LOOSE_BALL`). That is the "fires after, pointless" bug described in the milestone context.

### What needs to change

This is **not** a `broadcastState` whitelist-widening fix (adding `'GK_DIVE'` to `GK_BOX_ENTRY_PHASES` would not work — `state.ball.position` genuinely hasn't moved yet at shot-declaration time, so `computeBoxEntryOffer`'s `isInRegion(pos, ...)` check would never trigger on the shooter's own position). The fix has to hook **inside `applyDeclareShot` itself**, using the shot's *target* (which is always inside the box — a goal-line hex satisfies `isInRegion(goalHex, penaltyArea)` by construction) rather than the ball's *current* position:

- `applyDeclareShot` already computes everything needed: `shooter.position` (line 9462), `defendingTeam` (line 9419), `goalHex` (validated as a goal-line hex, lines 9412-9417). Add a check: is `shooter.position` **outside** the defending team's penalty area (`!isInRegion(shooter.position, opponentPenaltyArea)`, same pattern already used elsewhere at `gameEngine.ts:5191-5193`), and has this team's box-entry cap (`state.gkBoxEntryUsedByTeam?.[defendingTeam]`) not been used this movement cycle?
- If so, instead of calling `enterGkDiveOrSkip` immediately (line 9472), transition to `'GK_BOX_ENTRY_PROMPT'` first, with `gkBoxEntryResume` capturing enough to **resume directly into the already-computed `GK_DIVE` state** (not the pre-shot `MOVE`/`PASS` phase the existing `broadcastState` hook resumes to) — i.e., the resume target must carry `gkDivePosition`/`shotTargetHex`/`lastShotPath`, not just `{phase, activeTeam, movementSlot}` as `gkBoxEntryResume` does today (`gameEngine.ts:2854-2885`, `roomStore.ts:501-505`). This is a genuine widening of the resume-snapshot shape, not just a new call site.
- `applyBoxEntryResponse`'s decline branch (`gameEngine.ts:2925-2942`) already does a generic `phase: resume?.phase ?? state.phase` restore — it should work unchanged **once** the resume snapshot correctly carries the GK_DIVE-entered state, but this needs verification once the new resume shape lands.

### New vs. modified

- **Modified:** `applyDeclareShot` (`gameEngine.ts:9406-9483`) — add the pre-dive box-entry check/branch.
- **Modified (widened):** the `gkBoxEntryResume` field's shape/type (currently `{phase, activeTeam, movementSlot}`) and every place that reads it (`applyBoxEntryResponse`'s decline branch, `applyBoxEntryMove`'s resume-restore).
- **Unchanged:** `computeBoxEntryOffer`/`applyBoxEntryResponse`/`applyBoxEntryMove` themselves, `broadcastState`'s existing MOVE/PASS/LOOSE_BALL whitelist path (still needed for the "carrier just walked/passed/scattered into the box on ordinary open play" cases — this is a genuinely separate trigger from "a shot declared from outside the box").
- **New:** the "shooter outside the box, goal-line target inside it" eligibility check inside `applyDeclareShot` — there is no existing helper for this exact condition; it's a new 3-4 line guard using the already-imported `isInRegion`.

### Pitfall this surfaces

`enterGkDiveOrSkip` (`gameEngine.ts:2797-2830`) is documented as the **shared cap helper for all five `GK_DIVE` transition sites** (the comment explicitly warns about a header goal-line route bypassing it entirely in the past). Any change to `applyDeclareShot`'s entry into `GK_DIVE` must be audited against the other four sites (header-to-goal-line route, snapshot routes, etc.) to confirm they don't need the same box-entry-before-dive treatment, or a decision must be made that this resequencing applies to **regular declared shots only** (not headers/snapshots) — the milestone context specifically scopes it to "an outside-the-box shot on goal," which matches `applyDeclareShot` only, not the header/snapshot GK_DIVE entries at lines 5645-5667 and 9159.

---

## Feature 3 — Permanent jersey numbers

### Where numbers are assigned today (the core tension)

Numbers are **slot-bound, not player-bound**, by explicit, documented design (`gameEngine.ts:3795-3813`, the `applyRosterReposition` doc comment): *"id, position and number stay bound to the slot; everything else... travels with the person."* Three sites embody this:

1. **`buildSquadPieces`** (`gameEngine.ts:277-360`, called by `buildKickOffPieces` and the initial-state builder) — assigns `number: homeSlots[i]!.jerseyNumber` / `awaySlots[i]!.jerseyNumber` (line 300, 308), i.e. purely from the **formation slot** (`packages/shared/src/formations.ts` — each formation hardcodes e.g. GK=1, RB=2, RCB=4... per slot, not per player). This runs at kickoff **and at every goal/half-time reset** (call sites: `gameEngine.ts:5129, 5226, 8400, 10335, 10591`).
2. **`applyRosterReposition`** (`gameEngine.ts:3830-3965`, the drag-swap behind Feature 1's positioning mode) — explicitly keeps `number: pieceA.number` / `number: pieceB.number` bound to the **slot** on both sides of the swap (lines 3924-3935): the person's identity moves, the number stays put.
3. **`applySubstitution`** (`gameEngine.ts:3604-3774`) — the incoming sub inherits the outgoing player's `number` via the `...outPiece` spread (line 3687-3708, `number` not overridden) — again slot/outgoing-player-bound, not the incoming sub's own number.

Critically, **`applyRosterContinuity`** (`gameEngine.ts:3982-3991`, the overlay used at every goal/half-time reset) already takes `number` from `currentPieces` (the live roster) and only overlays `resetPieces.position` on top — so numbers **already survive goal/half-time resets unchanged** today. This overlay does **not** need to change for permanent numbers; the reset call sites are not the danger zone.

Each pool player already **has its own canonical number**: `PoolPlayer.number` (`packages/shared/src/types.ts:38`), populated by the CSV-seeded roster data (v1.2). `BenchEntry.jerseyNumber` (`types.ts:108-115`) is separately documented as *"Draft rooms: `DraftSession.*BenchNumbers`; standard rooms: the pool player's own `number`"* — i.e. bench entries in Standard mode already carry the player's real permanent number; only **on-pitch pieces** ignore it in favor of the slot number.

### What needs to change for a permanent-number model

1. **`buildSquadPieces`** — use each player's own `PoolPlayer.number` instead of `homeSlots[i]!.jerseyNumber` at initial assignment (LINEUP_CONFIRM time / first kickoff only, since resets already preserve live numbers via `applyRosterContinuity`).
2. **`applyRosterReposition`** — flip the swap so `number` **travels with the person**, not the slot: `newA.number` should come from `pieceB.number` (already implied by the `...pieceB` spread if the explicit `number: pieceA.number` override is simply removed) and vice versa for `newB`.
3. **`applySubstitution`** — the incoming sub must keep **their own** number (from `inPoolPlayer`/the bench entry's `jerseyNumber`), not inherit `outPiece.number`. `BenchEntry.jerseyNumber` already carries this value for Standard rooms — draft rooms use `DraftSession.*BenchNumbers` (`draftSession.ts:137-197`) and would need the same treatment there.

### Landmine already found: the kickoff-striker anchor

`buildSquadPieces` locates the kick-off-position striker **by jersey number**, not role:

```ts
// gameEngine.ts:325
const kickingStriker = pieces.find((p) => p.teamId === attackingTeam && p.number === 9);
```

If numbers become player-permanent, there is no guarantee any given player wears #9 — this lookup **will silently break** (logs an error and proceeds with formation-default positions per the existing `WR-02` diagnostic at line 328) the moment a team's striker doesn't happen to have jersey #9. This must be changed to a **role-based** lookup (e.g. the formation slot whose `slotRole` is the central-forward slot) as part of this feature, not discovered later as a regression. This is exactly the kind of "existing reset/continuity logic that could accidentally overwrite/break it" the milestone context asked about.

### New vs. modified

- **Modified:** `buildSquadPieces` (number source + striker-anchor lookup), `applyRosterReposition` (number no longer follows slot), `applySubstitution` (number no longer inherited from outgoing piece).
- **Unchanged:** `applyRosterContinuity` (already correct), `BenchEntry.jerseyNumber` semantics for Standard rooms (already player-bound).
- **New/needs decision:** draft-mode bench numbers (`assignBenchNumbers`, `draftSession.ts:394`) currently randomly assigns numbers to drafted bench players who have no natural CSV number — this randomly-assigned number would need to become the draft player's *permanent* number for the rest of that match once drafted, which is a new "assign once, freeze" semantic that doesn't exist today (today it's just a bench-display number, not tied to on-pitch identity persistence).

---

## Feature 4 — Foul→injury→booking banner-sequencing bug (still open)

### What was already tried and eliminated

Full history lives in `.planning/debug/foul-banner-sequence-not-pausing.md` (status: `investigating`, paused). Key facts already established, so as not to re-investigate them:

- **Commit `0664573`** added `activeRef` (a ref mirroring React state `active`, updated synchronously) to `EventBanner.tsx` (current code: `packages/client/src/components/EventBanner.tsx:191-236`) to fix a real same-commit race between the eventLog-driven queue effect and the `RESTART_BANNERS` phase-entry effect. **This fix is real, shipped, and safe — but the user retested live and confirmed the reported symptom is unchanged** ("shows foul and disappears with nothing else").
- The fixed race is **structurally unreachable from any current foul path anyway**: every foul call site (`resolveFoulChain`, `gameEngine.ts` ~761-894, called from STEAL_ATTEMPT/TACKLE_ATTEMPT/GK_DIVE_AT_FEET paths) transitions to `phase: 'FOUL_CHOICE'`, which is **not** in `RESTART_BANNERS` (`EventBanner.tsx:27-33`), so the phase-entry effect is a no-op during a foul chain regardless.
- Server-side, all 3 events (`FOUL_CALLED`, `INJURY_CHECK`, `BOOKING_CHECK`) are confirmed appended to one `eventLog` in one `resolveFoulChain` call, delivered in exactly one `broadcastState` — confirmed both by unit test and a real socket.io round-trip integration test. Not a server-side or transport-split issue.
- A synthetic reproduction using the **real** `useGameStore.getState().setGameState(...)` action (not the test suite's raw Zustand `setState` bypass) with a realistic 3-event + `FOUL_CHOICE` phase-transition broadcast **passed cleanly** — all 3 banners displayed in order with correct timing.
- `EventBanner` never unmounts during `FOUL_CHOICE` (it's unconditionally rendered inside `pitchContainer`, confirmed via `GameBoard.tsx` render-tree audit — `packages/client/src/components/GameBoard.tsx:531-539`).

### The one live-observed lead not yet followed up

The user's most specific reported observation: **"the FoulChoicePanel (continue/restart buttons) visibly appears at the EXACT moment the Foul banner disappears."** This was flagged as the strongest untested lead when the investigation was paused. Two things I confirmed during this research pass that narrow it further:

- `FoulChoicePanel` renders in `GameBoard.tsx`'s `topBandRight` slot (line 500-501), a **structurally different DOM region** from `EventBanner`, which renders inside `pitchContainer` (line 536-539) with `position: fixed; z-index: 20` (`EventBanner.module.css:19,23`).
- `FoulChoicePanel.module.css` has **no `position` or `z-index` rules at all** — it's a normal in-flow block in the top band.

This makes a simple CSS-stacking/overlap explanation (one element visually covering the other while React state is still non-null) **less likely than it looked at pause time** — `position: fixed` on `EventBanner` means its screen position is independent of `pitchContainer`'s layout, and `FoulChoicePanel` has no competing fixed/absolute positioning to fight it for the same screen coordinates. This doesn't rule out overlap (need the banner's actual computed `top`/`left` vs. the top band's height to know for certain), but it does mean the next investigation step should prioritize the **not-yet-tried actions the debug doc itself specified**, in order:
1. Live devtools check: at the exact moment "nothing else appears," is `EventBanner`'s `active` React state `null` (genuine state loss — a new bug) or non-null (a rendering/visibility issue, possibly the CSS-overlap angle above, now somewhat de-weighted but not eliminated)?
2. If state is null: the trigger is something the two independent synthetic repros (this session's and the original session's) both failed to reproduce — worth trying a repro that goes through the **actual GAME_MOVE → resolveFoulChain → broadcastState** server path end-to-end with a live two-browser session (no Playwright is installed in this repo per the debug doc; this would need either installing e2e tooling or a manual live session).
3. Not yet investigated at all: whether `FoulChoicePanel`'s own mount triggers a **parent re-render that remounts `pitchContainer` or a sibling** for a non-`key`-related reason (e.g. a conditional wrapper div appearing/disappearing around the pitch row when the top-band panel changes width/height) — the render-tree audit ruled out an explicit `key` prop but did not check for CSS Grid/Flex reflow-driven remount patterns specific to `FoulChoicePanel`'s entry.
4. A previously-flagged, deliberately-unfixed **secondary issue**: the user's stated expected order is "Foul → booking/card → injury," but the current code produces "Foul → injury → booking" (both in `resolveFoulChain`'s append order and in `getBannerMessage`'s straight iteration). This alone doesn't explain "nothing else ever shows," but should be fixed alongside whatever the root cause turns out to be, since it's an already-confirmed, separate, real defect.

### New vs. modified

No new component is implied yet — this is continued investigation inside `EventBanner.tsx` and possibly `FoulChoicePanel.tsx`/`GameBoard.tsx`'s layout, using the live-session/devtools step the paused investigation was blocked on (no e2e tooling installed). Budget this as a **debug/investigation task first**, not a "build a fix" task — the root cause is still unconfirmed, and the debug doc's own resolution notes are explicit that the shipped fix is likely not what the user is actually seeing.

---

## Feature 5 — Final-third confirm/warning: only the GK unmoved

### Where it lives today

`packages/client/src/components/ActionPanel.tsx`, MOVE-phase branch (`969-1039`). The relevant computation:

```ts
// ActionPanel.tsx:989-999
const slotTotal =
  movementSlot != null ? { ATTACKER_4: 4, DEFENDER_5: 5, ATTACKER_2: 2 }[movementSlot] : null;
const startedCount = Object.keys(paceUsedByPieceId).length;
const remaining = slotTotal != null ? Math.max(slotTotal - startedCount, 0) : null;
```

`remaining` is a **raw count**, not a set of identified pieces — it's `slotTotal` (a fixed 4/5/2 expected-mover count for the current movement slot) minus `startedCount` (how many distinct piece IDs have any entry in `paceUsedByPieceId`, i.e. have started moving this slot). This count feeds two things directly downstream in the same branch:
- `ctaClass(remaining ?? 0)` (line 1034) — the Confirm button's color (grey/green via `ctaColorClass`, imported from a shared color helper).
- `withEndTurnConfirm(remaining ?? 0, emitEndTurn)` (line 1036) — whether clicking Confirm shows the "N players left to move, are you sure?" dialog (`confirmDialog`, lines 186-209) or fires immediately.

Because `remaining` is a bare count with **no piece identity**, the code has no way today to ask "is the one remaining piece the GK?" — that information (which specific pieces are unmoved) is discarded the moment `slotTotal - startedCount` is computed.

### What needs to change

Inside the same MOVE-phase branch, before computing `remaining`, derive the **actual set of unmoved pieces** for the active team's current movement slot (using `pieces`, `activeTeam`, and `paceUsedByPieceId`, all already in scope at this point in the component), then filter out any unmoved piece whose `role === 'GK'` before taking the count. Only the filtered count should drive `ctaClass`/`withEndTurnConfirm`. Concretely: `remaining` should become "count of unmoved **non-GK** pieces," not "count of unmoved pieces."

This is a **client-only, ActionPanel.tsx-local fix** — there is no server-side equivalent computation to keep in sync (unlike the Undo-boundary mirror pattern flagged repeatedly elsewhere in this codebase, e.g. `ActionPanel.tsx:259-294`'s explicit warning about `canUndo` needing to stay term-for-term with `applyUndo`). `EndTurn` itself has no server-side "all players moved" gate today — this is purely a client warning/confirm-dialog affordance, so there's no risk of client/server drift to audit here, just a straightforward derivation change in one file.

### New vs. modified

- **Modified only:** `ActionPanel.tsx`'s MOVE-phase branch (lines 989-1039). No new files, no server changes, no shared-package changes.
- Watch for the **other four sibling `withEndTurnConfirm` call sites** in the same file (`hpmEligibleRemaining` line 411, `ftpmEligibleRemaining` line 451, `sdEligibleRemaining` line 507, `headerEligibleRemaining` line 578, `gkmEligibleRemaining` line 714) — these are **different phases** (HIGH_PASS_MOVE, FIRST_TIME_PASS_MOVE, SNAPSHOT_DEFLECT, HEADER, GK_KICK_MOVE) with their own `eligibleRemaining` derivations; the milestone requirement is scoped to "the MOVE/end-turn confirm flow" specifically, so these should almost certainly stay untouched — confirm this scope boundary during planning rather than assuming the GK-exemption should propagate to every phase's confirm dialog.

---

## Cross-Feature Build-Order Recommendation

Given the shared-risk concern (Feature 1's two sub-parts share one file/state) and the relative independence of the other four:

1. **Feature 1 (select-based roster interaction)** — build first as its own phase, sequenced internally as: positioning-mode click-select → substitution-mode click-select (extends the same state) → delete dead drag code. Highest line-count, highest regression risk (mirrors Phase 42's own note that the equivalent drag-and-drop build was "the largest and highest-regression-risk phase" of v1.7), and touches the same file/component tree as nothing else in this milestone, so isolating it first avoids merge/rebase contention with the other 4 features.
2. **Feature 3 (permanent jersey numbers)** — build second, and explicitly *after* Feature 1, not in parallel: `applyRosterReposition` (Feature 3's #2 change) is invoked by the exact interaction Feature 1 is rebuilding, so testing Feature 3's number-follows-person swap logic is far more reliable once Feature 1's new selection UI (rather than the soon-to-be-deleted drag UI) is the thing driving it end-to-end in manual/UAT testing.
3. **Feature 2 (GK box-entry resequencing)** and **Feature 5 (final-third GK exemption)** — independent of each other and of 1/3; either order is fine, both are small and isolated (`applyDeclareShot`/`gkBoxEntryResume` for #2; `ActionPanel.tsx` MOVE branch for #5). Good candidates to parallelize with each other or slot in wherever convenient.
4. **Feature 4 (banner-sequencing bug)** — treat as a standalone debug/investigation task, not schedule-dependent on the other four (no shared files with 1/2/3/5). Budget investigation time before implementation time, since root cause is still unconfirmed after a full paused investigation session; do not assume a quick fix.
5. **Rulebook-vs-implementation gap analysis** (the audit deliverable) has no code dependency on any of the above and can run at any point, though running it *after* Features 1-5 land means it naturally excludes ground already covered this milestone.

## Sources

All findings in this document are derived directly from reading the current repository source — no external documentation was needed for this integration-focused research. Files read in full or in relevant part:

- `.planning/PROJECT.md`
- `packages/server/src/gameEngine.ts` (10,849 lines — targeted reads of `buildSquadPieces`, `computeBoxEntryOffer`/`applyBoxEntryResponse`/`applyBoxEntryMove`, `applyDeclareShot`, `applySubstitution`, `applyRosterReposition`, `applyRosterContinuity`)
- `packages/server/src/roomStore.ts` (`broadcastState`, `GK_BOX_ENTRY_PHASES`)
- `packages/server/src/gameHandlers.ts` (socket event registrations for `GAME_SUBSTITUTION`, `GAME_ROSTER_REPOSITION`, `GAME_SHOT`)
- `packages/client/src/components/LineupAssignmentScreen.tsx` (full file, 1,424 lines)
- `packages/client/src/components/EventBanner.tsx` (full file)
- `packages/client/src/components/ActionPanel.tsx` (targeted: MOVE-phase branch, `withEndTurnConfirm`, `canUndo` mirror)
- `packages/client/src/components/GameBoard.tsx` (render tree around `EventBanner`/`FoulChoicePanel`)
- `packages/shared/src/types.ts`, `packages/shared/src/formations.ts`, `packages/shared/src/pitch.ts` (`isInRegion`)
- `packages/server/src/draftSession.ts` (`assignBenchNumbers`)
- `.planning/debug/foul-banner-sequence-not-pausing.md` (full investigation history)

---
*Architecture research for: v1.8 Roster Interaction Overhaul & Rules Audit*
*Researched: 2026-08-30*
