# Phase 23: Formation System - Context

**Gathered:** 2026-07-05
**Status:** Ready for planning

<domain>
## Phase Boundary

This phase delivers:

1. **FORMATIONS data table** — new `packages/shared/src/formations.ts` with 4 formations (4-4-2, 5-3-2, 4-3-3, 3-4-3), each defining 11 slots with hex positions, slot roles, and jersey numbers; used by both Phase 23 (piece placement) and Phase 24 (auto-assignment)
2. **Formation section on the combined selection screen** — the existing `UniformSelectionScreen.tsx` is extended with a formation grid (4 formation cards using PNG assets) placed between the team grid and style grid; the same single Confirm button covers team + formation + uniform together
3. **Extended confirm payload** — `UNIFORM_CONFIRM` event payload gains `formationId: FormationId`; server stores formation alongside team and uniform; `GameState.selectedFormation` added to shared types
4. **buildSquadPieces rewrite** — uses FORMATIONS lookup by FormationId instead of per-player `position` field from PoolPlayer; kick-off +4 shift implemented for the kicking team (all outfield positions shift q+4 toward centre; player with jersey #9 moves to kick-off hex)

Phase 24 (Auto-Assignment & Lineup) depends on the FORMATIONS table created here.
No separate `FormationSelectionScreen` component — formation lives on the Phase 22 combined screen.

</domain>

<decisions>
## Implementation Decisions

### Formation Hex Coordinates

Formation positions follow these rules (home-side; away mirrors via `q_away = 36 - q_home`):

- **GK** always at `{ q: 2, r: 13 }` — unchanged across all formations
- **Backline** at `q = 6`, **midline** at `q = 10`, **frontline** at `q = 14`
- **r-values by player count per row** (symmetric around r=13):
  - 2 players: `r = [9, 17]`
  - 3 players: `r = [6, 13, 19]`
  - 4 players: `r = [5, 10, 16, 21]` (symmetric around r=13; NOT r=22)
  - 5 players: `r = [5, 9, 13, 17, 21]`, with outer two players (r=5 and r=21) shifted q+2 toward centre (q=8 for backline row)

**D-01: 4-4-2** (GK + 4 DEF + 4 MID + 2 FWD):

- GK: `{ q:2, r:13 }`
- DEF (4, q=6): `r = [5, 10, 16, 21]` → positions: `{q:6,r:5}`, `{q:6,r:10}`, `{q:6,r:16}`, `{q:6,r:21}`
- MID (4, q=10): `r = [5, 10, 16, 21]` → positions: `{q:10,r:5}`, `{q:10,r:10}`, `{q:10,r:16}`, `{q:10,r:21}`
- FWD (2, q=14): `r = [9, 17]` → positions: `{q:14,r:9}`, `{q:14,r:17}`

**D-02: 5-3-2** (GK + 5 DEF + 3 MID + 2 FWD):

- GK: `{ q:2, r:13 }`
- DEF (5, q=6 with outer two at q=8): `{q:8,r:5}`, `{q:6,r:9}`, `{q:6,r:13}`, `{q:6,r:17}`, `{q:8,r:21}`
- MID (3, q=10): `r = [6, 13, 19]` → positions: `{q:10,r:6}`, `{q:10,r:13}`, `{q:10,r:19}`
- FWD (2, q=14): `{q:14,r:9}`, `{q:14,r:17}`

**D-03: 4-3-3** (GK + 4 DEF + 3 MID + 3 FWD):

- GK: `{ q:2, r:13 }`
- DEF (4, q=6): `{q:6,r:5}`, `{q:6,r:10}`, `{q:6,r:16}`, `{q:6,r:21}`
- MID (3, q=10): `{q:10,r:6}`, `{q:10,r:13}`, `{q:10,r:19}`
- FWD (3, q=14): `{q:14,r:6}`, `{q:14,r:13}`, `{q:14,r:19}`

**D-04: 3-4-3** (GK + 3 DEF + 4 MID + 3 FWD):

- GK: `{ q:2, r:13 }`
- DEF (3, q=6): `{q:6,r:6}`, `{q:6,r:13}`, `{q:6,r:19}`
- MID (4, q=10): `{q:10,r:5}`, `{q:10,r:10}`, `{q:10,r:16}`, `{q:10,r:21}`
- FWD (3, q=14): `{q:14,r:6}`, `{q:14,r:13}`, `{q:14,r:19}`

### Formation Screen Layout

- **D-05:** Formation is NOT a separate screen. The existing `UniformSelectionScreen.tsx` (Phase 22) gains a "Formation" section inserted between the team grid and the uniform style grid. The single Confirm button continues to lock all three choices simultaneously.
- **D-06:** Formation cards: 4 cards using pre-existing PNG assets (`packages/client/src/assets/formations/{442,532,433,343}.png`) + formation label (e.g., "4-4-2") + one-line tactical description. Image displayed inside the card; same selection border-glow pattern as team and style cards.
- **D-07:** Default pre-selected formation: **4-4-2** (simplest/most neutral). No `defaultFormation` field on TeamConfig is required for v1.3 — all teams start with 4-4-2 pre-selected.
- **D-08:** Tactical descriptions (one line each):
  - 4-4-2: "Balanced. Compact midfield with two mobile strikers."
  - 5-3-2: "Defensive. Five-man backline with narrow midfield."
  - 4-3-3: "Attacking. Three forwards press high and stretch the defence."
  - 3-4-3: "High press. Midfield dominance with a three-man attack."

### Event and State Model

- **D-09:** `UNIFORM_CONFIRM` client event payload extended from `{ teamId: TeamId; uniformStyle: UniformStyleId }` to `{ teamId: TeamId; uniformStyle: UniformStyleId; formationId: FormationId }`. Server handler updated accordingly. `ClientToServerEvents` and `ServerToClientEvents` types updated in `events.ts`.
- **D-10:** Server-side room state gains `homePickedFormation: FormationId | null` and `awayPickedFormation: FormationId | null` fields alongside existing `homePickedUniformStyle`.
- **D-11:** `GameState.selectedFormation: { home: FormationId; away: FormationId }` added to `GameState` in `packages/shared/src/types.ts`, parallel to `selectedTeams` and `selectedUniformStyles`.
- **D-12:** Confirmation flow is **unchanged from Phase 22** — home-first sequential. Home confirms first (team + formation + uniform). Server broadcasts `UNIFORM_HOME_CONFIRMED` (payload extended to include `formationId`). Away sees home's confirmed selections, then confirms their own. After both confirm, game flow advances to Phase 24 (auto-assignment). `buildInitialGameState` is NOT called in Phase 23 — Phase 24 calls it after auto-assignment confirmation.

### FORMATIONS Table and Engine Wiring

- **D-13:** New file: `packages/shared/src/formations.ts`. Exports:
  - `FormationId` union: `'4-4-2' | '5-3-2' | '4-3-3' | '3-4-3'`
  - `SlotRole` union: `'GK' | 'DEF-center' | 'DEF-back' | 'MID-central' | 'MID-wing' | 'FWD-central' | 'FWD-wing'`
  - `FormationSlot`: `{ slotId: string; slotRole: SlotRole; position: HexCoord; jerseyNumber: number }`
  - `FORMATIONS`: `Record<FormationId, { slots: readonly FormationSlot[]; description: string }>`
  - Slot role guidance (for Phase 24): DEF-center = highest tackling weight, DEF-back = pace weight, MID-central = dribbling/tackling/pace/shooting weight, MID-wing = dribbling/highPass weight, FWD-central = shooting/aerial weight, FWD-wing = dribbling/highPass weight
- **D-14:** Slot jersey number assignment per formation follows the convention: GK=#1; backs from #2 (right) to #6 (center, if 5 backs); central mids use #6, #8 (right-to-left priority, skipping numbers used in backline); wing mids use #7 (right) and #11 (left); forwards use #9 (striker), #10 (right), #11 (left). Claude resolves exact number assignments per formation slot during implementation using the rules in `<specifics>`.
- **D-15:** `buildSquadPieces` in `packages/server/src/gameEngine.ts` is rewritten to accept `formationId: FormationId` and use `FORMATIONS[formationId].slots[i].position` for each outfield player, rather than `player.position` from PoolPlayer. The GK slot always maps to index 0 in the formation slots array. PoolPlayer.position remains in teams.ts data but is no longer used for placement.
- **D-16:** **Kick-off +4 shift** — implemented in Phase 23's `buildSquadPieces`. After formation positions are applied: for the kicking team, all outfield pieces (not GK) shift `q += 4` (home kicking) or `q -= 4` (away kicking) toward centre. Then, the player assigned to jersey #9 in the kicking team's lineup is repositioned to the kick-off hex `{ q: 18, r: 13 }`. The non-kicking team's positions remain as defined by their formation. GK position is never shifted.

### Claude's Discretion

- Exact CSS class names and module structure for the formation section within UniformSelectionScreen
- Whether formation cards use a fixed height/width or match the style tile dimensions (recommend 160×130px for image legibility)
- Whether `UNIFORM_HOME_CONFIRMED` payload is extended (recommended) or a new `FORMATION_HOME_CONFIRMED` event is emitted separately — extend is simpler
- Exact SlotId naming convention (`'GK'`, `'RB'`, `'LB'`, `'RCB'`, `'LCB'`, `'RM'`, `'RCM'`, `'LCM'`, `'LM'`, `'ST'`, `'RF'`, `'LF'`, etc.) — follow standard football abbreviations
- Jersey number assignments for slots where the priority rules create ties or gaps (see `<specifics>` for the user's full rules)

</decisions>

<canonical_refs>

## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Combined Selection Screen (primary change target)

- `packages/client/src/components/UniformSelectionScreen.tsx` — Phase 22 component being extended; add formation section between team grid and style grid; extend Confirm payload
- `packages/client/src/components/UniformSelectionScreen.module.css` — CSS module to extend for formation section styles

### Socket Events (extension point)

- `packages/shared/src/events.ts` — `UNIFORM_CONFIRM` ClientToServerEvents signature update (add `formationId`); `UNIFORM_HOME_CONFIRMED` ServerToClientEvents signature update

### Shared Types (extension point)

- `packages/shared/src/types.ts` — add `selectedFormation: { home: FormationId; away: FormationId }` to `GameState`; follow existing field ordering and JSDoc style
- `packages/shared/src/formations.ts` — **NEW FILE** — `FormationId`, `SlotRole`, `FormationSlot`, `FORMATIONS` (read D-13 carefully before designing this file's structure)

### Server Room Handling (extension point)

- `packages/server/src/roomHandlers.ts` — `UNIFORM_CONFIRM` handler: extend payload destructuring, add `homePickedFormation`/`awayPickedFormation` to room state, verify both present before advancing; remove direct `buildInitialGameState` call (now Phase 24's responsibility)
- `packages/server/src/roomStore.ts` — Room type: add `homePickedFormation: FormationId | null` and `awayPickedFormation: FormationId | null`

### Game Engine (rewrite target)

- `packages/server/src/gameEngine.ts` lines ~94–148 — `buildSquadPieces` function: rewrite to accept `formationId`, lookup positions from `FORMATIONS[formationId]`, implement kick-off +4 shift (D-16); `buildInitialGameState` signature gains `selectedFormation` parameter
- `packages/shared/src/teams.ts` — `getSquadPlayers` is still used for squad selection; `PoolPlayer.position` field remains in data but is no longer used for placement after Phase 23

### Formation Assets (new imports)

- `packages/client/src/assets/formations/442.png`
- `packages/client/src/assets/formations/532.png`
- `packages/client/src/assets/formations/433.png`
- `packages/client/src/assets/formations/343.png`

### Prior Phase Context (locked decisions)

- `.planning/phases/22-uniform-selection-screen/22-CONTEXT.md` — D-01 to D-18 (combined screen architecture, home-first confirmation, UNIFORM_CONFIRM event shape, UNIFORM_HOME_CONFIRMED broadcast, deferred-build pattern); Phase 23 extends these decisions
- `.planning/phases/20-uniform-style-system/20-CONTEXT.md` — D-15/D-16 (PieceOverlay prop shape — unchanged by Phase 23)

### Requirements

- `.planning/REQUIREMENTS.md` — FORM-01, FORM-02, FORM-03, FORM-04

</canonical_refs>

<code_context>

## Existing Code Insights

### Reusable Assets

- **PNG formation images** (`packages/client/src/assets/formations/`) — 4 clean pitch diagrams already exist; import pattern follows existing badge imports in TeamSelectionScreen / UniformSelectionScreen
- **Card selection pattern** (`UniformSelectionScreen.tsx`) — `.card`, `.cardActive`, `.cardStruckOut` CSS classes already established; formation cards follow same visual language
- **`UNIFORM_STYLES` + `UNIFORM_STYLE_META`** — pattern for a typed registry of displayable options (formation uses a simpler flat array — 4 entries, no renderer function needed)

### Established Patterns

- **Home-first confirmation** (`roomHandlers.ts` UNIFORM_CONFIRM handler) — enforces `playerSlot === 1` first; exact same guard applies to formation pick embedded in the same confirm event
- **`isProcessing` mutex** (`roomHandlers.ts`) — already applied to UNIFORM_CONFIRM; same mutex guards the extended handler
- **App.tsx socket handler pattern** — `socket.on/off` in a single `useEffect`; `UNIFORM_HOME_CONFIRMED` handler is the reference for the extended payload
- **Screen transition via `setScreen`** — no new screen state needed (formation is on UNIFORM_SELECTION screen, same as Phase 22)
- **`buildSquadPieces` extraction** (Phase 22 D-17) — dedicated function at `gameEngine.ts:113` that can be rewritten cleanly without touching the rest of `buildInitialGameState`

### Integration Points

- `packages/shared/src/index.ts` — add `formations.ts` barrel export (`FormationId`, `FORMATIONS`, `FormationSlot`, `SlotRole`)
- `packages/shared/src/types.ts` — `GameState.selectedFormation` field addition
- `packages/server/src/gameEngine.ts` — `buildSquadPieces` rewrite (D-15/D-16); `buildInitialGameState` signature extension
- `packages/client/src/components/UniformSelectionScreen.tsx` — add formation grid section; extend Confirm `emit` call
- `packages/shared/src/events.ts` — extend `UNIFORM_CONFIRM` / `UNIFORM_HOME_CONFIRMED` payload types

</code_context>

<specifics>
## Specific Ideas

### Jersey Number Assignment Rules (from user — implement in FORMATIONS slot definitions)

**Frontline:**

- 2 forwards: #9 (striker), #10 (right forward)
- 3 forwards: #9 (striker, center), #10 (right forward), #11 (left forward)

**Backline:**

- 3 defenders: #2 (right back), #3 (left back), #4 (center back)
- 4 defenders: #2 (right back), #3 (left back), #4 (right center back), #5 (left center back)
- 5 defenders: #2 (right back), #3 (left back), #4 (right center back), #5 (left center back), #6 (center back)

**Midfield:**

- Central midfielders use #5, #6, #8 in priority order (most central first, then right-central, then left-central) — skip numbers already used in backline
- Right wing: #7; Left wing: #11
- If numbers are not yet assigned at a position: use highest remaining number for wings first, then central positions

**General rule:** Most skillful player for a position type goes to the most central slot; fastest player goes to wing slots (Phase 24 auto-assignment applies this).

### Vertical Ordering (r-values)

The r-axis: smaller r = "top" of pitch image, larger r = "bottom". In football convention for a horizontal pitch: top = "right side" when attacking left-to-right.

Convention for slot naming: lower r → right-side slot (#2 RB, #7 RM, #10 RF); higher r → left-side slot (#3 LB, #11 LM, #11 LF).

### Kick-off +4 Shift Details (D-16)

Applies only to `buildSquadPieces` — not to the FORMATIONS table itself (positions in FORMATIONS are neutral, non-kicking positions).

Example: home team kicks off (attackingTeam = 'home'):

- home outfield positions: q += 4 (e.g., RB at q=6 → q=10; MID at q=10 → q=14; FWD at q=14 → q=18)
- home player #9 (striker): q=18, r=13 (kick-off hex, overrides +4 shift result)
- away positions: unchanged from FORMATIONS lookup (with q-mirror applied)

GK is never shifted (position remains q=2 home / q=34 away).

</specifics>

<deferred>
## Deferred Ideas

### Phase 24 Auto-Assignment Context (captured here for Phase 24 planner)

The following rules were provided by the user and belong in Phase 24 (ASSIGN-01..05). They are captured here to avoid loss:

**Scoring formulas for auto-assignment (Phase 24 ASSIGN-01):**

- Forward (ST/FWD slot): `shooting + aerialAbility + 2 if role=FWD + 4 if role=ST`
- Center back (DEF-center slot): `tackling + aerialAbility + 2 if role=DEF`
- Center mid (MID-central slot): `dribbling + tackling + pace + shooting + 3 if role=MID`
- Wing mid (MID-wing slot): `dribbling + highPass + 3 if role=FWD + 2 if role=MID`
- Left/right back (DEF-back slot): `tackling + pace + 2 if role=DEF`
- Forward wing (FWD-wing slot): `dribbling + highPass + 3 if role=FWD + 2 if role=MID`

**Assignment principle:** Most skilled player for a position type → most central slot; fastest player → wing slots.

**Jersey numbering at assignment time (Phase 24):** Players receive their in-game jersey number from their assigned formation slot's `jerseyNumber` field — not their source squad number. Display the assigned jersey number on the piece during the match.

**Player numbering on selection screen (Phase 24):** After auto-assignment, display each player in their slot with their assigned number.

### Reviewed Todos (not folded)

- `2026-06-21-bug-gk-kick-ball-delivery-invisible-during-replay.md` — Phase 25 (REPLAY-07), not Phase 23 scope
- `2026-07-02-bug-kickoff-setup-persistent-light-shading-on-shot-path-hexes.md` — Phase 25 (BUG-23), not Phase 23 scope
- `csv-consolidation-player-pool.md` — Phase 24+, not Phase 23 scope

</deferred>

---

_Phase: 23-formation-system_
_Context gathered: 2026-07-05_
