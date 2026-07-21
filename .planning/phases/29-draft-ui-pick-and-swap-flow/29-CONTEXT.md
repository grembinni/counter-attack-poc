# Phase 29: Draft UI + Pick-and-Swap Flow - Context

**Gathered:** 2026-07-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Build the real-time draft UI: a 7-card draft-pack carousel rendered directly above (or over) the lineup+bench grid, combined with the 4-cycle pick-and-swap protocol from DRAFT-07, keeper safety (DRAFT-08), a dynamic bench (DRAFT-09), and post-draft auto-numbering (DRAFT-10). Formation, team (colors/name only), and jersey selection all happen _before_ this screen — this phase starts from an already-chosen empty formation shell and ends with a fully drafted, manually-arranged lineup+bench ready for the existing lineup-confirm flow. Covers requirements DRAFT-06 through DRAFT-10.

**Key departure from a literal reading of DRAFT-06:** the roadmap/requirements text describes a carousel "above the lineup grid" as a separate display — in practice this phase merges drafting and lineup placement into one interaction: dragging a card off the draft-pack carousel directly onto a lineup slot or the bench both drafts _and_ places that card in one motion. There is no separate "pick screen" followed by "lineup screen" — see D-05.

</domain>

<decisions>
## Implementation Decisions

### Pack-Swap Protocol (DRAFT-07)

- **D-01:** Each cycle follows: pick 1 card (6 remain) → swap remainder packs with partner → pick 2 cards (4 remain) → swap remainder packs back → pick 1 more card (3 remain, discarded) → each player then opens a brand-new pack from the pre-generated 8-pack batch for the next cycle. 1+2+1 = 4 cards/cycle × 4 cycles = 16 cards/player. Confirmed by the user — this exactly matches Phase 28's `PACKS_PER_MATCH = 8` (2 players × 4 cycles × 1 new pack each = 8).
- **D-02:** The 3 cards left over in a pack after the third pick are discarded — they never enter play. No shared pool, no carryover.
- **D-03:** No manual "ready" button. Making a pick (dragging a card off the current pack) is itself the readiness signal for that sub-step, whether the sub-step ends in a pack-swap or a new-pack-open. The game waits for both players' picks before advancing to the next sub-step/cycle (mutual-wait gate), same pattern as `LINEUP_CONFIRM`'s home/away flags — but the "ready" trigger is implicit in the pick action, not an additional explicit confirm.
- **D-04:** The 8 packs are pre-generated once (already happens in Phase 28's `generateDraftPacks`/`draftPacks.ts` at settings-confirm time) and packs are then **randomly assigned to players** — not a fixed `packs[0-3]→home, packs[4-7]→away` convention. Within a player's own 4 assigned packs, they open in a fixed/sequential order across the 4 cycles.

### Combined Draft + Lineup + Bench Interaction (DRAFT-06, DRAFT-09)

- **D-05 (major departure from a literal separate-screen reading):** The draft-pack carousel renders directly over/above the lineup screen (same screen as `LineupAssignmentScreen`, not a separate step). Dragging a card from the draft-pack carousel onto a lineup slot **or** onto the bench is the pick action — it simultaneously drafts the card and places it. There is no intermediate "drafted but unplaced" state.
- **D-06:** Cards can only move **out of** the draft-pack row (row → lineup, row → bench). Cards can never be dragged back into the draft-pack row once picked.
- **D-07:** Dragging a card onto an already-occupied lineup slot replaces the occupant, and the replaced player moves to the bench (not discarded, not lost).
- **D-08:** Once drafted, cards move freely between lineup and bench (both directions) for the rest of the draft process — same drag-and-drop swap pattern `LineupAssignmentScreen` already has for Standard mode (`handleDragStart`/`handleDragOver`/`handleDrop`/`handleDragEnd`).
- **D-09:** Slot-role restriction: only a GK card can be dropped on the GK slot (and only the GK slot accepts a GK card). Every other slot accepts any drafted player regardless of role — no DEF/MID/FWD role matching.
- **D-10:** Pack-swap cycle gating (D-01/D-03) is fully independent of lineup/bench rearrangement. Only dragging a card _off the draft-pack row_ counts as "the pick" and advances cycle state; freely rearranging already-drafted cards between lineup and bench afterward has no effect on cycle progression.
- **D-11:** Formation (e.g. 4-4-2), team (colors/name — teams are cosmetic only in draft mode since players are pooled, not team-specific), and jersey style are all selected in the screens _before_ this one (existing Phase 22/23 flow). This phase starts with an already-visible empty formation shell (role-labeled empty slots) to drag cards onto.
- **D-12:** While waiting on the opponent's pick, the player who already picked sees a "waiting for opponent" indicator and their draft-pack row is disabled/non-interactive until the opponent also picks. Lineup/bench rearrangement of already-drafted cards is presumably still allowed while waiting (not explicitly restricted — Claude's discretion, see below).
- **D-13:** Mid-draft disconnect/reconnect within the existing 90s grace window resumes exactly where the draft left off (current pack contents, already-drafted lineup/bench state re-sent) — same reconnect behavior as an in-progress match.
- **D-14:** New draft socket events follow the existing `LINEUP_SWAP`/`LINEUP_ASSIGNMENT_UPDATED` convention: a client-emitted pick event, and a per-socket (unicast, not broadcast) private state update in response — keeps each player's current pack contents private from the opponent, same as lineup privacy today.

### Post-Draft Behavior (DRAFT-10)

- **D-15 (overrides a literal "auto-position" reading):** After the last pick (including 4th-cycle keeper-safety resolution), there is **no automatic repositioning** — whatever the player manually arranged during the draft (lineup slots + bench) stands as-is. Only jersey **numbering** is automatic: starters get their role-appropriate numbers (existing Standard-mode numbering convention), bench players get a **random unused number in the 15-99 range** (not sequential).
- **D-16 (⚠ REQUIREMENTS.md conflict, confirmed intentional):** REQUIREMENTS.md's DRAFT-10 text says bench overflow gets "sequential numbers." The user explicitly confirmed random 15-99 is correct and this overrides that text. **REQUIREMENTS.md needs a wording update** to match (either during this phase's planning or as a follow-up doc task) — flagging per project convention (see Phase 27's similar stale-text flag).

### Keeper Safety (DRAFT-08)

- No new decisions beyond what's already fully specified in REQUIREMENTS.md/ROADMAP.md: on cycle 4, if a player hasn't drafted a keeper by their first pick of that cycle, a keeper is auto-selected as their second pick (pack passed has one fewer card; next pick phase for that player is 1 card instead of 2). Auto-selected keeper still goes through the same drag-to-place interaction, or is auto-placed on the GK slot directly — **Claude's discretion** (not explicitly asked; reasonable default is auto-placing it directly into the empty GK slot if unfilled, otherwise onto the bench).

### Card Visual Design

- **D-17:** Tier→color mapping (from Phase 28's forward-pointer, now confirmed): Chase = gold, Rare = silver, Uncommon = bronze, Common = blue, Keeper = green.
- **D-18:** Card content is unchanged from the existing card display (`LineupStatCard`'s existing fields) — the only new element is a rarity indicator.
- **D-19:** The rarity indicator is a **colored border/frame** around the whole card (using D-17's color), not a corner badge or icon.
- **D-20:** The draft-pack row is a **standard left-right navigable carousel** (not all-cards-at-once) — rarest cards populate/sort to the left, and the view starts scrolled to the left on each new pack. Must be built to flexibly handle variable pack sizes (e.g. a 6-card pack on the keeper-safety pick in cycle 4), not hardcoded to 7.
- **D-21:** The bench uses the identical carousel card style as the draft-pack row, positioned below the main lineup grid.
- **D-22:** Empty (unfilled) lineup slots during the draft reuse the existing `LineupAssignmentScreen` empty-slot placeholder style — no new empty-state component.
- **D-23:** The draft-pack carousel row disappears entirely once the draft completes (all 16 picks resolved) — leaving just the finalized lineup + bench, which then proceeds into the existing lineup-confirm flow.

### Claude's Discretion

- Whether lineup/bench rearrangement is allowed while waiting on the opponent's pick (D-12) — not explicitly restricted by the user; reasonable to leave enabled since it doesn't touch cycle state (per D-10).
- Whether the 4th-cycle auto-selected keeper (DRAFT-08) is auto-placed directly into the GK slot or dropped onto the bench for the player to place manually — pick whichever is simpler given the existing drag-and-drop data flow; auto-placing into the empty GK slot (if unfilled) is the more polished default.
- Exact module/component layout for the new draft-pack carousel component (new file vs. extending `LineupAssignmentScreen.tsx`) — follow existing component conventions in `packages/client/src/components`.
- Exact new Socket.io event names (e.g. `DRAFT_PICK`, `DRAFT_STATE_UPDATED`) — follow `packages/shared/src/events.ts`'s existing naming conventions (verb-noun, past-tense for server→client).

</decisions>

<canonical_refs>

## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements

- `.planning/REQUIREMENTS.md` §Draft Mode (DRAFT) — DRAFT-06 through DRAFT-10 definitions (lines 42-50). **Note:** DRAFT-10's "sequential numbers" phrase is superseded by D-15/D-16 above (random 15-99) — needs a text update.

### Roadmap

- `.planning/ROADMAP.md` §Phase 29 (lines 187-201) — Goal statement and 5 success criteria (Draft UI + Pick-and-Swap Flow)

### Prior Phase Context

- `.planning/phases/28-draft-data-model/28-CONTEXT.md` — Phase 28's data-model decisions (tier classification D-05/D-06/D-07, pack composition D-11, `PACKS_PER_MATCH=8` D-10, tier-color forward-pointer in `<specifics>`) — this phase consumes that engine's output directly.
- `.planning/phases/27-game-creation-settings/27-CONTEXT.md` — Settings pre-step (D-01 through D-09) that determines `teamType`/`draftPools` before this phase's screen is ever reached.

### Draft Engine (Phase 28, existing — to consume, not modify)

- `packages/shared/src/draftEngine.ts` — `assignTiers`, `generateDraftPacks(selectedPools, rng): { pool: TieredPoolPlayer[]; packs: DraftPack[] }` (packs array of 8, 7 cards each), `TieredPoolPlayer` (extends `PoolPlayer` with `tier`/`totalStat`), `DraftPack` (`{ packNumber, cards }`)
- `packages/server/src/draftPacks.ts` — server wrapper binding `crypto.randomInt` to `generateDraftPacks`
- `packages/shared/src/types.ts` (lines 446-501) — `TeamType`, `DraftPoolId`, `SELECTABLE_DRAFT_POOLS`, `DraftTier`, `TIER_PERCENTILE_BOUNDS`, `PACKS_PER_MATCH = 8`, `PACK_COMPOSITION`

### NOT yet wired (Phase 29 must add)

- `packages/server/src/roomHandlers.ts` — `ROOM_SETTINGS_CONFIRM` handler currently only stores `teamType`/`draftPools` on `Room`; it does **not** call `generateDraftPacks`/`dealDraftPacks` yet. Phase 29 must wire pack generation into this flow (or a later trigger point) and add the random pack→player assignment (D-04).

</canonical_refs>

<code_context>

## Existing Code Insights

### Reusable Assets

- `packages/client/src/components/LineupAssignmentScreen.tsx` — existing drag-and-drop swap pattern (`handleDragStart`/`handleDragOver`/`handleDrop`/`handleDragEnd`, ~lines 202-232), GK-slot-locked logic, `LineupStatCard` inline card component (lines 65-146, `.statCard`/`.cardBody`/`.cardHeader` classes) — direct base for both the lineup grid and the new draft-pack/bench carousel cards (D-05, D-18, D-21, D-22).
- `packages/server/src/gameEngine.ts` `scoreForRole`/`pickBest`/`computeAutoAssignment` (Standard-mode auto-assignment, ~lines 117-230) — **not reused** for Draft mode per D-15 (no repositioning), but the existing role/slot model these functions operate on is still the shape of the empty formation shell D-11 relies on.
- `packages/shared/src/events.ts` `LINEUP_SWAP`/`LINEUP_CONFIRM`/`LINEUP_ASSIGNMENT_READY`/`LINEUP_ASSIGNMENT_UPDATED` (lines ~102-120, 209-220) — naming and unicast-privacy pattern to mirror for new draft events (D-14).
- `packages/server/src/roomStore.ts` `Room` type (line 51+) — `teamType`, `draftPools`, `settingsConfirmed` fields already present (Phase 27); extend with draft session state (current cycle, per-player pack contents, drafted lineup/bench state).

### Established Patterns

- Server-authoritative, full-state broadcast/unicast after every action — no client-side optimistic mutation beyond drag visuals (`LineupAssignmentScreen`'s swap re-renders from server response, not local state).
- No async/turn-timer mode anywhere in this codebase — all two-sided gating (lineup confirm, uniform confirm) uses mutual-wait flags, never a clock. D-03's implicit-ready-on-pick follows this same convention.
- `crypto.randomInt` server-side only for anything gameplay-affecting (dice, and per Phase 28, pack shuffling/backfill) — D-04's random pack-to-player assignment must follow this convention too, not `Math.random()`.
- No carousel or standalone `PlayerCard` component exists anywhere in the client yet (confirmed via codebase scout) — D-20's left-right carousel is new, built from `LineupStatCard`'s visual base.

### Integration Points

- `LineupAssignmentScreen.tsx` is very likely the file this phase extends/wraps (per D-05) rather than a separate new screen component — draft-pack carousel renders as an additional row on top of the existing lineup+bench layout.
- `roomHandlers.ts` `ROOM_SETTINGS_CONFIRM` — pack generation + random player assignment (D-04) needs to be wired in here or at the next appropriate trigger point (e.g., when both players have completed formation/team/jersey selection, right before this draft screen would render).
- Bench was previously **structural-only** (`LineupAssignmentScreen.tsx` ~lines 283-284, "D-17: bench section — structural only in v1.3", empty placeholder slots, no data binding) — Phase 29 is what actually wires real data into it (D-09/D-21).

</code_context>

<specifics>
## Specific Ideas

- The pack-swap math derivation (D-01) was explicitly verified against `PACKS_PER_MATCH = 8` before the user confirmed it — worth re-verifying against the actual `draftEngine.ts` implementation during planning/research in case the constant or pack count has drifted.
- Carousel must "easily support any changes in pack size" (D-20) — build the carousel component generically (renders however many cards are in the current pack array), not hardcoded to 7, since the keeper-safety cycle hands out a 6-card pack.
- Card content reuses "the current card" as-is (D-18) — no new stat display work needed, only the border/frame overlay (D-19).

</specifics>

<deferred>
## Deferred Ideas

- Full auto-position-by-stat-weight for Draft mode (the literal DRAFT-10 reading) — explicitly not wanted; manual draft-time placement stands (D-15). Not deferred to a future phase, just decided against.
- REQUIREMENTS.md DRAFT-10 wording update (sequential → random 15-99) — should happen alongside or shortly after this phase ships (D-16); not a blocking dependency for planning/execution, but shouldn't be forgotten.

### Reviewed Todos (not folded)

- None — the 4 pending todos (`.planning/todos/pending/`) all scored low relevance to this phase (GK_KICK replay visibility, KICK_OFF_SETUP shading, header-winner eligibility, CSV consolidation — all unrelated to draft UI).

</deferred>

---

_Phase: 29-Draft-UI-Pick-and-Swap-Flow_
_Context gathered: 2026-07-21_
