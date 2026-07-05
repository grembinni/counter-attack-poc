# Phase 23: Formation System — Research

**Researched:** 2026-07-05
**Domain:** TypeScript data modelling, React UI extension, Socket.io event extension, game engine rewrite
**Confidence:** HIGH

---

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions

**Formation Hex Coordinates**

- GK always at `{ q: 2, r: 13 }` across all formations
- Backline at `q = 6`, midline at `q = 10`, frontline at `q = 14`
- r-values by count: 2 players=[9,17]; 3=[6,13,19]; 4=[5,10,16,21]; 5=[5,9,13,17,21] with outer two (r=5,r=21) shifted q+2
- D-01 through D-04: exact slot positions per formation locked (see CONTEXT.md)

**Formation Screen Layout**

- D-05: Formation is NOT a separate screen — section inserted into existing `UniformSelectionScreen.tsx` between team grid and style grid
- D-06: Four formation cards using pre-existing PNG assets; same selection border-glow as team/style cards
- D-07: Default pre-selected formation is `'4-4-2'`
- D-08: Tactical descriptions locked (exact strings in CONTEXT.md)

**Event and State Model**

- D-09: `UNIFORM_CONFIRM` payload extended to `(teamId, uniformStyle, formationId)`
- D-10: Room state gains `homePickedFormation: FormationId | null` and `awayPickedFormation: FormationId | null`
- D-11: `GameState.selectedFormation: { home: FormationId; away: FormationId }` added
- D-12: Confirmation flow unchanged from Phase 22 (home-first sequential); `buildInitialGameState` NOT called in Phase 23

**FORMATIONS Table and Engine Wiring**

- D-13: New file `packages/shared/src/formations.ts` — exports `FormationId`, `SlotRole`, `FormationSlot`, `FORMATIONS`
- D-14: Slot jersey number assignment follows convention specified in `<specifics>`
- D-15: `buildSquadPieces` rewritten to accept `formationId: FormationId`, look up positions from `FORMATIONS`
- D-16: Kick-off +4 shift implemented in `buildSquadPieces` for kicking team outfield pieces

### Claude's Discretion

- Exact CSS class names and module structure for formation section
- Whether formation cards use fixed height/width or match style tile dimensions (recommend 160×130px — UI-SPEC overrides to 100px image height)
- Whether `UNIFORM_HOME_CONFIRMED` payload is extended (recommended) or separate event
- Exact SlotId naming convention (standard football abbreviations)
- Jersey number assignments where priority rules create ties or gaps

### Deferred Ideas (OUT OF SCOPE)

- Phase 24 auto-assignment scoring formulas (ASSIGN-01..05)
- GK_KICK ball delivery replay (REPLAY-07)
- KICK_OFF_SETUP shot-path shading (BUG-23)
- CSV consolidation of player pool
  </user_constraints>

---

<phase_requirements>

## Phase Requirements

| ID      | Description                                                                                                          | Research Support                                                                                                                   |
| ------- | -------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| FORM-01 | Formation selection screen appears after uniform selection; each player independently chooses one of four formations | Formation section inserted into `UniformSelectionScreen.tsx`; local state `selectedFormation` with default `'4-4-2'`               |
| FORM-02 | Each option displays mini pitch diagram and one-line tactical description                                            | PNG assets already in `packages/client/src/assets/formations/`; UI-SPEC defines exact card anatomy                                 |
| FORM-03 | Both players confirm before advancing; each sees "waiting for opponent" after confirming                             | Home-first sequential confirmation (D-12) mirrors Phase 22 pattern; `hasConfirmed` state gates UI; UNIFORM_HOME_CONFIRMED extended |
| FORM-04 | Piece starting positions placed from `FORMATIONS` lookup keyed by `FormationId`; away positions mirrored via q=36−q  | `buildSquadPieces` rewrite uses `FORMATIONS[formationId].slots[i].position`; away mirror formula already established               |

</phase_requirements>

---

## Summary

Phase 23 extends the Phase 22 combined selection screen with a formation grid, creates a new `formations.ts` shared data module, extends the Socket.io event wire to carry `formationId`, and rewrites `buildSquadPieces` in the game engine. There are no new external libraries, no new screens, and no new socket event names beyond what Phase 22 established — this is a pure extension of existing code.

The phase is bounded by four integration points, each with a clear extension pattern to follow:

1. **`packages/shared/src/formations.ts`** — new file exporting `FormationId`, `SlotRole`, `FormationSlot`, and `FORMATIONS` record; also re-exports through `index.ts`
2. **`packages/shared/src/events.ts` and `types.ts`** — `UNIFORM_CONFIRM` payload extended; `UNIFORM_HOME_CONFIRMED` payload extended; `GameState.selectedFormation` added
3. **`packages/server/src/roomStore.ts` and `roomHandlers.ts`** — Room type gains formation fields; `UNIFORM_CONFIRM` handler extended to carry `formationId`; `buildInitialGameState` call deferred to Phase 24
4. **`packages/client/src/components/UniformSelectionScreen.tsx`** — formation grid section added; `onConfirm` signature extended to include `formationId`; `App.tsx` `handleUniformConfirm` updated

The engine change is localized: only `buildSquadPieces` changes. `buildInitialGameState`'s signature gains a `selectedFormation` parameter but the function itself is not called in Phase 23 — Phase 24 calls it after auto-assignment.

**Primary recommendation:** Work in dependency order — shared types first, then server, then client. `formations.ts` is the foundational dependency; all other changes follow from it.

---

## Architectural Responsibility Map

| Capability                          | Primary Tier     | Secondary Tier  | Rationale                                                                                     |
| ----------------------------------- | ---------------- | --------------- | --------------------------------------------------------------------------------------------- |
| FORMATIONS data table               | Shared library   | —               | Used by both server (placement) and client (Phase 24 display); must live in `packages/shared` |
| Formation selection UI              | Frontend (React) | —               | Pure client-side selection state; no server involvement until Confirm                         |
| Formation confirmation sequencing   | API / Server     | Frontend        | Server enforces home-first order and validates `formationId`; client gates UI on response     |
| Piece placement from formation data | API / Server     | —               | `buildSquadPieces` is server-only; client reads resulting `GameState.pieces`                  |
| Kick-off +4 shift                   | API / Server     | —               | Pure engine logic; client never directly computes piece positions                             |
| Away position mirroring             | API / Server     | —               | Mirror formula `q_away = 36 - q_home` applied in `buildSquadPieces` (established pattern)     |
| `GameState.selectedFormation`       | Shared types     | Server (writes) | Type in shared; server sets it; client reads from broadcast GameState                         |

---

## Standard Stack

### Core (all already installed — no new packages)

| Library         | Version | Purpose                         | Why Standard                                       |
| --------------- | ------- | ------------------------------- | -------------------------------------------------- |
| TypeScript      | 5.x     | Shared type definitions         | Project-wide; `FormationId` union type is trivial  |
| React           | 18.3.1  | Formation grid UI component     | Established project choice                         |
| Socket.io       | 4.x     | Extended event payload delivery | Established project choice                         |
| pnpm workspaces | 9.x     | Cross-package type sharing      | `formations.ts` imported by both server and client |

### Supporting

No additional packages needed. Formation PNG assets already exist in the asset directory [VERIFIED: direct filesystem read].

### Alternatives Considered

None — this phase is constrained to extending the existing stack. No new libraries are warranted.

**Installation:** No new `npm install` commands needed for this phase.

---

## Package Legitimacy Audit

> No external packages are installed in this phase. All changes are to existing project files and the pre-existing asset directory.

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

---

## Architecture Patterns

### System Architecture Diagram

```
Client (UniformSelectionScreen)
  │  local state: selectedFormation (FormationId)
  │  pre-selected: '4-4-2' on mount
  │
  │  onClick(Confirm) ──────────────────────────────────────►  Server (roomHandlers.ts)
  │  emit UNIFORM_CONFIRM(teamId, uniformStyle, formationId)     validate formationId in VALID_FORMATION_IDS
  │                                                              if home: store homePickedFormation
  │                                                                       broadcast UNIFORM_HOME_CONFIRMED(teamId, uniformStyle, formationId)
  │  ◄── UNIFORM_HOME_CONFIRMED(teamId, uniformStyle, formationId) ──
  │  (away player sees home confirmed; away now unlocked)
  │
  │  onClick(Confirm) [away] ───────────────────────────────►  Server
  │  emit UNIFORM_CONFIRM(teamId, uniformStyle, formationId)     store awayPickedFormation
  │                                                              Phase 24 will call buildInitialGameState
  │                                                              (Phase 23 does NOT build game state)
  │
  ▼
packages/shared/src/formations.ts
  FORMATIONS record ──► buildSquadPieces (server/gameEngine.ts)
                         accepts formationId
                         looks up FORMATIONS[formationId].slots[i].position
                         applies kick-off +4 shift for kicking team
                         applies q=36-q mirror for away pieces
```

### Recommended Project Structure

```
packages/shared/src/
├── formations.ts        ← NEW: FormationId, SlotRole, FormationSlot, FORMATIONS
├── index.ts             ← extend barrel export with formations.ts
├── types.ts             ← add selectedFormation to GameState; no other changes
└── events.ts            ← extend UNIFORM_CONFIRM / UNIFORM_HOME_CONFIRMED payloads

packages/server/src/
├── roomStore.ts         ← add homePickedFormation / awayPickedFormation to Room type
└── roomHandlers.ts      ← extend UNIFORM_CONFIRM handler; defer buildInitialGameState to Phase 24
    └── gameEngine.ts    ← rewrite buildSquadPieces; extend buildInitialGameState signature

packages/client/src/
├── assets/formations/   ← already exists with 442.png, 532.png, 433.png, 343.png
└── components/
    ├── UniformSelectionScreen.tsx        ← add formation grid section; extend onConfirm
    └── UniformSelectionScreen.module.css ← add formation CSS classes
```

### Pattern 1: FORMATIONS Data Table Shape

**What:** Typed registry keyed by `FormationId` — mirrors `UNIFORM_STYLE_META` / `TEAM_CONFIGS` pattern.
**When to use:** Any data-driven registry that must be accessible in both server and client.
**Example:**

```typescript
// Source: CONTEXT.md D-13 + established registry pattern in packages/shared/src/teamConfig.ts
export type FormationId = '4-4-2' | '5-3-2' | '4-3-3' | '3-4-3';

export type SlotRole =
  | 'GK'
  | 'DEF-center'
  | 'DEF-back'
  | 'MID-central'
  | 'MID-wing'
  | 'FWD-central'
  | 'FWD-wing';

export interface FormationSlot {
  slotId: string; // e.g. 'GK', 'RB', 'RCB', 'LCB', 'LB', 'RM', ...
  slotRole: SlotRole;
  position: HexCoord; // home-side position; away is mirrored at runtime
  jerseyNumber: number; // 1–11 per D-14
}

export const FORMATIONS: Record<
  FormationId,
  { slots: readonly FormationSlot[]; description: string }
> = {
  '4-4-2': {
    description: 'Balanced. Compact midfield with two mobile strikers.',
    slots: [
      { slotId: 'GK', slotRole: 'GK', position: { q: 2, r: 13 }, jerseyNumber: 1 },
      { slotId: 'RB', slotRole: 'DEF-back', position: { q: 6, r: 5 }, jerseyNumber: 2 },
      { slotId: 'RCB', slotRole: 'DEF-center', position: { q: 6, r: 10 }, jerseyNumber: 4 },
      { slotId: 'LCB', slotRole: 'DEF-center', position: { q: 6, r: 16 }, jerseyNumber: 5 },
      { slotId: 'LB', slotRole: 'DEF-back', position: { q: 6, r: 21 }, jerseyNumber: 3 },
      { slotId: 'RM', slotRole: 'MID-wing', position: { q: 10, r: 5 }, jerseyNumber: 7 },
      { slotId: 'RCM', slotRole: 'MID-central', position: { q: 10, r: 10 }, jerseyNumber: 6 },
      { slotId: 'LCM', slotRole: 'MID-central', position: { q: 10, r: 16 }, jerseyNumber: 8 },
      { slotId: 'LM', slotRole: 'MID-wing', position: { q: 10, r: 21 }, jerseyNumber: 11 },
      { slotId: 'RF', slotRole: 'FWD-wing', position: { q: 14, r: 9 }, jerseyNumber: 10 },
      { slotId: 'ST', slotRole: 'FWD-central', position: { q: 14, r: 17 }, jerseyNumber: 9 },
    ],
  },
  // ... 5-3-2, 4-3-3, 3-4-3 follow same shape
};
```

### Pattern 2: Extending the UNIFORM_CONFIRM Handler (home-first guard)

**What:** The existing `UNIFORM_CONFIRM` handler in `roomHandlers.ts` stores home's pick when `homePickedUniformStyle === undefined` and builds game state on away's confirm. Phase 23 defers game-state build to Phase 24.
**When to use:** Extending an existing Socket.io event handler with additional payload fields.
**Example (server extension):**

```typescript
// Source: packages/server/src/roomHandlers.ts lines 286–356 (Phase 22 UNIFORM_CONFIRM handler)
// Phase 23 change: add formationId param; defer buildInitialGameState to Phase 24

socket.on(
  ClientEvents.UNIFORM_CONFIRM,
  (teamId: TeamId, uniformStyle: UniformStyleId, formationId: FormationId) => {
    // ... existing guards unchanged ...
    if (room.homePickedUniformStyle === undefined) {
      // Home branch: store formation alongside style
      room.homePickedFormation = formationId;
      room.homePickedUniformStyle = uniformStyle;
      room.homePickedTeam = teamId;
      io.to(roomCode).emit(ServerEvents.UNIFORM_HOME_CONFIRMED, teamId, uniformStyle, formationId);
    } else {
      // Away branch: store formation; DO NOT call buildInitialGameState (Phase 24 does this)
      room.awayPickedFormation = formationId;
      // Phase 23: advance to formation-confirmed state; Phase 24 handler calls buildInitialGameState
      // ... broadcast state or emit next-phase signal ...
    }
  },
);
```

### Pattern 3: buildSquadPieces Rewrite (formation lookup + kick-off shift)

**What:** Replace per-player `p.position` lookup with `FORMATIONS[formationId].slots[i].position`; apply kick-off +4 shift after formation positions are set.
**Key insight:** The +4 shift is applied to the _outfield_ pieces of the _kicking_ team _after_ formation positions are set. GK is never shifted. The striker (#9) is then repositioned to the kick-off hex overriding the shifted position.

```typescript
// Source: packages/server/src/gameEngine.ts lines 113–148 (current buildSquadPieces)
function buildSquadPieces(
  attackingTeam: 'home' | 'away',
  selectedTeams: { home: TeamId; away: TeamId },
  selectedFormation: { home: FormationId; away: FormationId },
): PlayerPiece[] {
  const homeSlots = FORMATIONS[selectedFormation.home].slots;
  const awaySlots = FORMATIONS[selectedFormation.away].slots;

  const homeSquad = getSquadPlayers(selectedTeams.home).map((p, i) => ({
    ...p,
    teamId: 'home' as const,
    id: `home-${i}`,
    position: homeSlots[i].position, // formation lookup replaces p.position
    number: homeSlots[i].jerseyNumber, // formation jersey number replaces squad number
  }));

  const awaySquad = getSquadPlayers(selectedTeams.away).map((p, i) => ({
    ...p,
    teamId: 'away' as const,
    id: `away-${i}`,
    position: { q: 36 - awaySlots[i].position.q, r: awaySlots[i].position.r }, // mirror
    number: awaySlots[i].jerseyNumber,
  }));

  const pieces = [...homeSquad, ...awaySquad];

  // Kick-off +4 shift: kicking team outfield pieces shift toward centre
  const kickingTeam = attackingTeam; // kicking team = attacking team at kick-off
  for (const piece of pieces) {
    if (piece.teamId !== kickingTeam) continue;
    if (piece.role === 'GK') continue;
    piece.position =
      kickingTeam === 'home'
        ? { q: piece.position.q + 4, r: piece.position.r }
        : { q: piece.position.q - 4, r: piece.position.r };
  }

  // Striker to kick-off hex (overrides +4 shift result)
  const kickingStriker = pieces.find((p) => p.teamId === kickingTeam && p.number === 9);
  if (kickingStriker) {
    kickingStriker.position = { ...PITCH_REGIONS.kickOffHex }; // { q:18, r:13 }
  }

  return pieces;
}
```

**Note on `number` field:** After the Phase 23 rewrite, `PlayerPiece.number` comes from the formation slot's `jerseyNumber`, not the PoolPlayer's squad number. This is a breaking change to the existing `number` field source — but the field type (`number`) is unchanged, so all existing consumers (ActionLog, PieceOverlay) continue to work without modification.

### Pattern 4: Formation Grid in UniformSelectionScreen

**What:** Four-card grid inserted between Team and Style sections; follows existing card selection pattern exactly.
**When to use:** Adding a new selection section to the combined screen.

```tsx
// Source: 23-UI-SPEC.md + UniformSelectionScreen.tsx line 218–251 (team grid reference)
// Formation section — inserted after team grid, before style grid

{/* Formation section */}
<p className={styles.sectionLabel}>Formation</p>
<div className={styles.formationGrid}>
  {FORMATION_OPTIONS.map(({ id, asset, label, description }) => (
    <button
      key={id}
      disabled={hasConfirmed || awayLocked}
      aria-pressed={id === selectedFormation}
      aria-label={`${label} formation`}
      className={id === selectedFormation ? styles.formationCardSelected : styles.formationCard}
      onClick={() => { if (!hasConfirmed && !awayLocked) setSelectedFormation(id); }}
    >
      <img
        src={asset}
        alt={`${label} formation diagram`}
        className={styles.formationImage}
      />
      <p className={styles.formationLabel}>{label}</p>
      <p className={styles.formationDescription}>{description}</p>
    </button>
  ))}
</div>
```

### Anti-Patterns to Avoid

- **Using `p.position` from PoolPlayer after Phase 23:** After the `buildSquadPieces` rewrite, PoolPlayer.position is no longer used for placement. Using it would bypass the FORMATIONS lookup and produce wrong positions.
- **Calling `buildInitialGameState` in Phase 23's UNIFORM_CONFIRM away branch:** Phase 23 does NOT build game state — Phase 24 does. The away branch should only store `awayPickedFormation` and signal Phase 24 readiness.
- **Applying the +4 shift to the GK or to the non-kicking team:** Only outfield pieces of the kicking team shift. GK is explicitly excluded.
- **Using `p.role === 'ST'` to find the kick-off striker:** After the Phase 23 rewrite, the kicking striker is identified by `jerseyNumber === 9` (slot-assigned) not by `role === 'ST'`. The current code uses `role === 'ST'`; the rewrite must change this to `number === 9`.
- **Forgetting to extend `UNIFORM_HOME_CONFIRMED` server→client payload:** The `onUniformHomeConfirmed` handler in `App.tsx` must receive `formationId` so away can (if needed) display home's confirmed formation. The typed event signature in `events.ts` must be updated to match.
- **Mutating formation slot `position` objects:** The `pieces.find(...)` pattern in `buildSquadPieces` mutates piece positions in-place. Since `FORMATIONS` slots are `readonly`, positions must be spread (`{ ...slot.position }`) when assigning, not referenced directly.

---

## Don't Hand-Roll

| Problem                           | Don't Build              | Use Instead                                       | Why                                                               |
| --------------------------------- | ------------------------ | ------------------------------------------------- | ----------------------------------------------------------------- |
| Formation hex coordinates         | Algorithmic generation   | `FORMATIONS` data table (D-13)                    | 4 formations × 11 slots = 44 hand-authored positions; no formula  |
| Away mirror                       | Custom mirror function   | `q_away = 36 - q_home` (established in Phase 16)  | One-liner formula; already applied in existing `buildSquadPieces` |
| Formation card UI                 | Custom component         | `<button>` + CSS module (established pattern)     | Matches Phase 22 team/style card pattern exactly                  |
| FormationId validation allow-list | Manual string comparison | `VALID_FORMATION_IDS` const array + `.includes()` | Mirrors `VALID_UNIFORM_STYLE_IDS` pattern in `roomHandlers.ts`    |

**Key insight:** All four formations and their 44 slot positions are authored data, not computed geometry. The `FORMATIONS` table is the single source of truth for position data — Phase 24 auto-assignment scoring formulas also consume it.

---

## Jersey Number Resolution

[VERIFIED: CONTEXT.md `<specifics>` section]

Based on the rules in `<specifics>`, the complete jersey number assignments per formation:

### 4-4-2 (GK + 4 DEF + 4 MID + 2 FWD)

| Slot | Position   | r-value | Jersey | Rule Applied                                                                         |
| ---- | ---------- | ------- | ------ | ------------------------------------------------------------------------------------ |
| GK   | q=2, r=13  | 13      | #1     | Always #1                                                                            |
| RB   | q=6, r=5   | 5       | #2     | 4 DEF: right back                                                                    |
| RCB  | q=6, r=10  | 10      | #4     | 4 DEF: right center back                                                             |
| LCB  | q=6, r=16  | 16      | #5     | 4 DEF: left center back                                                              |
| LB   | q=6, r=21  | 21      | #3     | 4 DEF: left back                                                                     |
| RM   | q=10, r=5  | 5       | #7     | Right wing: always #7                                                                |
| RCM  | q=10, r=10 | 10      | #6     | Central MID priority #5,#6,#8; skip backline used (#4,#5 used); first available = #6 |
| LCM  | q=10, r=16 | 16      | #8     | Central MID priority #5,#6,#8; #6 used; next = #8                                    |
| LM   | q=10, r=21 | 21      | #11    | Left wing: always #11                                                                |
| RF   | q=14, r=9  | 9       | #10    | 2 FWD: lower r = right forward = #10                                                 |
| ST   | q=14, r=17 | 17      | #9     | 2 FWD: other = striker = #9                                                          |

**Note on 4-4-2 central MID numbering:** Backline uses #2, #3, #4, #5. Central MID priority is #5, #6, #8. #5 is used by backline → skip. First available = #6 (RCM, most central within 4-mid is ambiguous; by convention right-central = RCM gets priority). #8 goes to LCM.

### 5-3-2 (GK + 5 DEF + 3 MID + 2 FWD)

| Slot | Position   | r-value | Jersey | Rule Applied                                                                           |
| ---- | ---------- | ------- | ------ | -------------------------------------------------------------------------------------- |
| GK   | q=2, r=13  | 13      | #1     | Always #1                                                                              |
| RB   | q=8, r=5   | 5       | #2     | 5 DEF outer-right (q+2 shift) = right back                                             |
| RCB  | q=6, r=9   | 9       | #4     | 5 DEF: right center back                                                               |
| CB   | q=6, r=13  | 13      | #6     | 5 DEF: center back                                                                     |
| LCB  | q=6, r=17  | 17      | #5     | 5 DEF: left center back                                                                |
| LB   | q=8, r=21  | 21      | #3     | 5 DEF outer-left (q+2 shift) = left back                                               |
| RCM  | q=10, r=6  | 6       | #8     | 3 MID, no wings; central priority #5,#6,#8; #5 and #6 used by backline → #8 (right)    |
| CM   | q=10, r=13 | 13      | #10    | 3 MID central: #5,#6,#8 all used; next unused = #10 (most central gets highest unused) |
| LCM  | q=10, r=19 | 19      | #11    | 3 MID, no wings; next unused = #11                                                     |
| RF   | q=14, r=9  | 9       | #10    | 2 FWD: right = #10... **CONFLICT** with CM #10                                         |

**Conflict in 5-3-2:** If CM takes #10, then RF also needs #10. Resolution: apply the "wings first, then central" rule. Right wing forward takes #10 (highest remaining for wings), then central positions fill remaining numbers.

**Revised 5-3-2 MID + FWD numbering:** Since #5 and #6 are used by backline, and there are no wing midfielders in 5-3-2, the three central mids use the remaining numbers in order: #8 (most central priority; actually right-of-center at r=6), #7 would normally be right-wing... but 5-3-2 has no wing mids. Re-reading the rule: "Central midfielders use #5, #6, #8 in priority order — skip numbers used in backline. If numbers not yet assigned at a position: use highest remaining for wings first, then central positions." In 5-3-2 there are no wing MIDs so #7 and #11 are not consumed by MID. FWDs take #9 and #10. The three central MIDs have #5, #6, #8 available minus backline (#2,#3,#4,#5,#6) = only #8. Remaining numbers for 3 MID slots after #8: highest remaining = #11, #10 — but #10 goes to right forward and #9 to striker. So MID slots get #8, #7, #11 (assigning wing numbers to mid slots since no wing mids exist). Simplified assignment that avoids conflicts:

| Slot | Position   | Jersey | Rationale                                                      |
| ---- | ---------- | ------ | -------------------------------------------------------------- |
| GK   | q=2, r=13  | #1     | Always #1                                                      |
| RB   | q=8, r=5   | #2     | right back                                                     |
| RCB  | q=6, r=9   | #4     | right center back                                              |
| CB   | q=6, r=13  | #6     | center back                                                    |
| LCB  | q=6, r=17  | #5     | left center back                                               |
| LB   | q=8, r=21  | #3     | left back                                                      |
| RCM  | q=10, r=6  | #8     | right-central mid; #5/#6 used by backline                      |
| CM   | q=10, r=13 | #7     | central mid; using #7 (right-wing number, no right winger)     |
| LCM  | q=10, r=19 | #11    | left-central mid; using #11 (left-wing number, no left winger) |
| RF   | q=14, r=9  | #10    | right forward (#10)                                            |
| ST   | q=14, r=17 | #9     | striker (#9)                                                   |

### 4-3-3 (GK + 4 DEF + 3 MID + 3 FWD)

| Slot | Position   | Jersey | Rationale                                                                                                   |
| ---- | ---------- | ------ | ----------------------------------------------------------------------------------------------------------- |
| GK   | q=2, r=13  | #1     | Always #1                                                                                                   |
| RB   | q=6, r=5   | #2     | right back                                                                                                  |
| RCB  | q=6, r=10  | #4     | right center back                                                                                           |
| LCB  | q=6, r=16  | #5     | left center back                                                                                            |
| LB   | q=6, r=21  | #3     | left back                                                                                                   |
| RCM  | q=10, r=6  | #8     | right-central mid; #5 used by backline; #6 available but #8 used as right-central priority (see 4-4-2 note) |
| CM   | q=10, r=13 | #6     | central mid; most central slot; #5 used by backline                                                         |
| LCM  | q=10, r=19 | #7     | left-central mid; using #7 (no right winger uses it)                                                        |
| RF   | q=14, r=6  | #10    | right forward                                                                                               |
| ST   | q=14, r=13 | #9     | striker (center forward)                                                                                    |
| LF   | q=14, r=19 | #11    | left forward                                                                                                |

**Note:** 4-3-3 has no dedicated wings in midfield so #7 and #11 are available for mid slots; #11 goes to LF (3 forwards), #7 to LCM.

### 3-4-3 (GK + 3 DEF + 4 MID + 3 FWD)

| Slot | Position   | Jersey | Rationale                                                                                                                                                                                                  |
| ---- | ---------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GK   | q=2, r=13  | #1     | Always #1                                                                                                                                                                                                  |
| RB   | q=6, r=6   | #2     | right back                                                                                                                                                                                                 |
| CB   | q=6, r=13  | #4     | center back (most central)                                                                                                                                                                                 |
| LB   | q=6, r=19  | #3     | left back                                                                                                                                                                                                  |
| RM   | q=10, r=5  | #7     | right wing mid                                                                                                                                                                                             |
| RCM  | q=10, r=10 | #6     | right-central mid; #4 used by backline; #5 not used → use #5? 3-DEF uses #2,#3,#4 → #5 available. Priority: most central first → CM slot at r=10 or r=16. Use #6 for right-central (matches 4-4-2 pattern) |
| LCM  | q=10, r=16 | #8     | left-central mid                                                                                                                                                                                           |
| LM   | q=10, r=21 | #11    | left wing mid                                                                                                                                                                                              |
| RF   | q=14, r=6  | #10    | right forward                                                                                                                                                                                              |
| ST   | q=14, r=13 | #9     | striker                                                                                                                                                                                                    |
| LF   | q=14, r=19 | #11    | left forward... **CONFLICT** with LM #11                                                                                                                                                                   |

**Conflict in 3-4-3:** LM and LF both want #11. Resolution: LM (wing mid) takes #11 per "right wing: #7; left wing: #11" rule. LF gets the next unused number. Used so far: #1,#2,#3,#4,#6,#7,#8,#9,#10,#11. Remaining: #5. LF → #5.

**Revised 3-4-3 with conflict resolved:**

| Slot | Position   | Jersey | Rationale                              |
| ---- | ---------- | ------ | -------------------------------------- |
| GK   | q=2, r=13  | #1     | Always #1                              |
| RB   | q=6, r=6   | #2     | right back                             |
| CB   | q=6, r=13  | #4     | center back                            |
| LB   | q=6, r=19  | #3     | left back                              |
| RM   | q=10, r=5  | #7     | right wing mid                         |
| RCM  | q=10, r=10 | #6     | right-central mid                      |
| LCM  | q=10, r=16 | #8     | left-central mid                       |
| LM   | q=10, r=21 | #11    | left wing mid                          |
| RF   | q=14, r=6  | #10    | right forward                          |
| ST   | q=14, r=13 | #9     | striker                                |
| LF   | q=14, r=19 | #5     | left forward (remaining unused number) |

**Implementation note for the executor:** These jersey number assignments are Claude's discretion per D-14. The rules create some edge cases (especially in 5-3-2 and 3-4-3) where the standard numbering conflicts. The resolved numbers above are the recommended implementation. If the user has strong opinions, they should be confirmed before execution.

---

## Common Pitfalls

### Pitfall 1: Mutating FORMATIONS slot positions

**What goes wrong:** If `buildSquadPieces` assigns `piece.position = slot.position` (reference, not copy), and later mutates the piece position (e.g., kick-off shift), it also mutates the `FORMATIONS` table entry — corrupting all subsequent `buildSquadPieces` calls in the same process (including after goals).
**Why it happens:** `readonly` on the `FormationSlot.position` field prevents TypeScript from catching runtime mutation of the referenced object.
**How to avoid:** Always spread: `position: { ...slot.position }` or `position: { q: slot.position.q, r: slot.position.r }` when assigning to a piece.
**Warning signs:** Position values for `FORMATIONS['4-4-2'].slots[0]` differ between the first and second call to `buildSquadPieces` within the same test run.

### Pitfall 2: Using role='ST' to find the kick-off striker

**What goes wrong:** Current `buildSquadPieces` uses `p.role === 'ST'` to find the striker for kick-off positioning. After the Phase 23 rewrite, players are placed by formation slot and their `number` comes from `jerseyNumber` in the slot. There is no longer a guaranteed `role === 'ST'` player in every formation (e.g., 4-4-2 FWD slots have `role='FWD'` or similar from the squad data).
**Why it happens:** The rewrite must change the striker lookup from `role === 'ST'` to `number === 9` (the jersey number assigned to the striker slot across all formations).
**How to avoid:** After the rewrite, the kick-off striker is identified by `piece.number === 9 && piece.teamId === kickingTeam`.
**Warning signs:** `buildSquadPieces` logs "missing ST" diagnostic or the kick-off hex is not occupied.

### Pitfall 3: Forgetting `buildKickOffPieces` also calls `buildSquadPieces`

**What goes wrong:** `buildKickOffPieces` (used after each goal to reset positions) also calls `buildSquadPieces`. If `buildSquadPieces` gains a `selectedFormation` parameter, `buildKickOffPieces` must also receive and pass `selectedFormation`.
**Why it happens:** Post-goal resets must use the same formation as the initial placement.
**How to avoid:** Update `buildKickOffPieces` signature to accept `selectedFormation: { home: FormationId; away: FormationId }` and pass it through. All callers of `buildKickOffPieces` (in game event handlers) must also pass `selectedFormation` from `room.gameState.selectedFormation`.
**Warning signs:** After a goal, pieces reset to wrong positions or TypeScript compile error at `buildKickOffPieces` call sites.

### Pitfall 4: Phase 24 dependency — not calling buildInitialGameState in Phase 23

**What goes wrong:** The Phase 22 `UNIFORM_CONFIRM` away branch currently calls `buildInitialGameState` and broadcasts a `GAME_STATE`. Phase 23 must NOT do this — Phase 24 calls it. If Phase 23 accidentally calls it, the game state will be built without a formation (or with a default) and Phase 24's assignment step will be unreachable.
**Why it happens:** The natural instinct when both players have confirmed is to build game state immediately.
**How to avoid:** Phase 23's away confirm branch stores `awayPickedFormation` and emits a signal (TBD by planner — likely just broadcasts both formations to both clients), but does NOT call `buildInitialGameState`. The planner must define what Phase 23 broadcasts after away confirms — the current Phase 22 code broadcasts the full GameState; Phase 23 must replace this with something Phase-24-compatible.
**Warning signs:** `room.gameState` is non-null after UNIFORM_CONFIRM but before Phase 24's auto-assignment step.

### Pitfall 5: TypeScript `as const` on FORMATIONS slots array

**What goes wrong:** Without `as const` or `readonly`, the `slots` array in FORMATIONS may be typed as mutable, allowing accidental mutation.
**How to avoid:** Use `readonly FormationSlot[]` in the type definition and ensure the FORMATIONS object uses `as const` or `satisfies` pattern:

```typescript
export const FORMATIONS = {
  '4-4-2': {
    description: '...',
    slots: [...] as const,
  },
  // ...
} satisfies Record<FormationId, { slots: readonly FormationSlot[]; description: string }>;
```

### Pitfall 6: Slot count must match squad count (11)

**What goes wrong:** `buildSquadPieces` maps `getSquadPlayers(teamId)` by index to formation slots (`slots[i]`). If the squad returns 11 players but FORMATIONS has fewer than 11 slots (or vice versa), index `i` will be `undefined` for some players, causing runtime errors.
**How to avoid:** Each formation in FORMATIONS must have exactly 11 slots. Add an assertion in development:

```typescript
// In formations.ts or a test
Object.entries(FORMATIONS).forEach(([id, f]) => {
  if (f.slots.length !== 11)
    throw new Error(`Formation ${id} has ${f.slots.length} slots, expected 11`);
});
```

**Warning signs:** TypeScript errors on `slots[i].position` (possible undefined), or pieces array with `undefined` positions after build.

---

## Runtime State Inventory

Phase 23 is not a rename/refactor phase. However, one runtime state concern exists:

| Category        | Items Found                                                              | Action Required                                            |
| --------------- | ------------------------------------------------------------------------ | ---------------------------------------------------------- |
| Stored data     | `room.gameState.selectedFormation` — new field on GameState              | New field; no migration needed (field didn't exist before) |
| Live service    | In-flight rooms during Phase 23 deploy                                   | No migration; rooms complete before deploy or restart      |
| OS state        | None                                                                     | None — verified by process model (no OS registration)      |
| Secrets/env     | None                                                                     | None                                                       |
| Build artifacts | `packages/shared/dist/` — stale if not rebuilt after formations.ts added | `pnpm run build` in shared after adding formations.ts      |

---

## Code Examples

### Complete FORMATIONS table (reference for executor)

```typescript
// Source: CONTEXT.md D-01 through D-04 (hex positions locked)
// packages/shared/src/formations.ts

import type { HexCoord } from './types.js';

export type FormationId = '4-4-2' | '5-3-2' | '4-3-3' | '3-4-3';

export type SlotRole =
  | 'GK'
  | 'DEF-center'
  | 'DEF-back'
  | 'MID-central'
  | 'MID-wing'
  | 'FWD-central'
  | 'FWD-wing';

export interface FormationSlot {
  slotId: string;
  slotRole: SlotRole;
  position: HexCoord;
  jerseyNumber: number;
}

export const FORMATIONS: Record<
  FormationId,
  { slots: readonly FormationSlot[]; description: string }
> = {
  '4-4-2': {
    description: 'Balanced. Compact midfield with two mobile strikers.',
    slots: [
      { slotId: 'GK', slotRole: 'GK', position: { q: 2, r: 13 }, jerseyNumber: 1 },
      { slotId: 'RB', slotRole: 'DEF-back', position: { q: 6, r: 5 }, jerseyNumber: 2 },
      { slotId: 'RCB', slotRole: 'DEF-center', position: { q: 6, r: 10 }, jerseyNumber: 4 },
      { slotId: 'LCB', slotRole: 'DEF-center', position: { q: 6, r: 16 }, jerseyNumber: 5 },
      { slotId: 'LB', slotRole: 'DEF-back', position: { q: 6, r: 21 }, jerseyNumber: 3 },
      { slotId: 'RM', slotRole: 'MID-wing', position: { q: 10, r: 5 }, jerseyNumber: 7 },
      { slotId: 'RCM', slotRole: 'MID-central', position: { q: 10, r: 10 }, jerseyNumber: 6 },
      { slotId: 'LCM', slotRole: 'MID-central', position: { q: 10, r: 16 }, jerseyNumber: 8 },
      { slotId: 'LM', slotRole: 'MID-wing', position: { q: 10, r: 21 }, jerseyNumber: 11 },
      { slotId: 'RF', slotRole: 'FWD-wing', position: { q: 14, r: 9 }, jerseyNumber: 10 },
      { slotId: 'ST', slotRole: 'FWD-central', position: { q: 14, r: 17 }, jerseyNumber: 9 },
    ],
  },
  '5-3-2': {
    description: 'Defensive. Five-man backline with narrow midfield.',
    slots: [
      { slotId: 'GK', slotRole: 'GK', position: { q: 2, r: 13 }, jerseyNumber: 1 },
      { slotId: 'RB', slotRole: 'DEF-back', position: { q: 8, r: 5 }, jerseyNumber: 2 },
      { slotId: 'RCB', slotRole: 'DEF-center', position: { q: 6, r: 9 }, jerseyNumber: 4 },
      { slotId: 'CB', slotRole: 'DEF-center', position: { q: 6, r: 13 }, jerseyNumber: 6 },
      { slotId: 'LCB', slotRole: 'DEF-center', position: { q: 6, r: 17 }, jerseyNumber: 5 },
      { slotId: 'LB', slotRole: 'DEF-back', position: { q: 8, r: 21 }, jerseyNumber: 3 },
      { slotId: 'RCM', slotRole: 'MID-central', position: { q: 10, r: 6 }, jerseyNumber: 8 },
      { slotId: 'CM', slotRole: 'MID-central', position: { q: 10, r: 13 }, jerseyNumber: 7 },
      { slotId: 'LCM', slotRole: 'MID-central', position: { q: 10, r: 19 }, jerseyNumber: 11 },
      { slotId: 'RF', slotRole: 'FWD-wing', position: { q: 14, r: 9 }, jerseyNumber: 10 },
      { slotId: 'ST', slotRole: 'FWD-central', position: { q: 14, r: 17 }, jerseyNumber: 9 },
    ],
  },
  '4-3-3': {
    description: 'Attacking. Three forwards press high and stretch the defence.',
    slots: [
      { slotId: 'GK', slotRole: 'GK', position: { q: 2, r: 13 }, jerseyNumber: 1 },
      { slotId: 'RB', slotRole: 'DEF-back', position: { q: 6, r: 5 }, jerseyNumber: 2 },
      { slotId: 'RCB', slotRole: 'DEF-center', position: { q: 6, r: 10 }, jerseyNumber: 4 },
      { slotId: 'LCB', slotRole: 'DEF-center', position: { q: 6, r: 16 }, jerseyNumber: 5 },
      { slotId: 'LB', slotRole: 'DEF-back', position: { q: 6, r: 21 }, jerseyNumber: 3 },
      { slotId: 'RCM', slotRole: 'MID-central', position: { q: 10, r: 6 }, jerseyNumber: 8 },
      { slotId: 'CM', slotRole: 'MID-central', position: { q: 10, r: 13 }, jerseyNumber: 6 },
      { slotId: 'LCM', slotRole: 'MID-central', position: { q: 10, r: 19 }, jerseyNumber: 7 },
      { slotId: 'RF', slotRole: 'FWD-wing', position: { q: 14, r: 6 }, jerseyNumber: 10 },
      { slotId: 'ST', slotRole: 'FWD-central', position: { q: 14, r: 13 }, jerseyNumber: 9 },
      { slotId: 'LF', slotRole: 'FWD-wing', position: { q: 14, r: 19 }, jerseyNumber: 11 },
    ],
  },
  '3-4-3': {
    description: 'High press. Midfield dominance with a three-man attack.',
    slots: [
      { slotId: 'GK', slotRole: 'GK', position: { q: 2, r: 13 }, jerseyNumber: 1 },
      { slotId: 'RB', slotRole: 'DEF-back', position: { q: 6, r: 6 }, jerseyNumber: 2 },
      { slotId: 'CB', slotRole: 'DEF-center', position: { q: 6, r: 13 }, jerseyNumber: 4 },
      { slotId: 'LB', slotRole: 'DEF-back', position: { q: 6, r: 19 }, jerseyNumber: 3 },
      { slotId: 'RM', slotRole: 'MID-wing', position: { q: 10, r: 5 }, jerseyNumber: 7 },
      { slotId: 'RCM', slotRole: 'MID-central', position: { q: 10, r: 10 }, jerseyNumber: 6 },
      { slotId: 'LCM', slotRole: 'MID-central', position: { q: 10, r: 16 }, jerseyNumber: 8 },
      { slotId: 'LM', slotRole: 'MID-wing', position: { q: 10, r: 21 }, jerseyNumber: 11 },
      { slotId: 'RF', slotRole: 'FWD-wing', position: { q: 14, r: 6 }, jerseyNumber: 10 },
      { slotId: 'ST', slotRole: 'FWD-central', position: { q: 14, r: 13 }, jerseyNumber: 9 },
      { slotId: 'LF', slotRole: 'FWD-wing', position: { q: 14, r: 19 }, jerseyNumber: 5 },
    ],
  },
};
```

### Kick-off +4 shift — detailed worked example

```
Formation 4-4-2, home team kicks off:

Before shift (home positions from FORMATIONS):
  GK:  q=2, r=13   → unchanged (GK exempt)
  RB:  q=6, r=5    → q=10, r=5
  RCB: q=6, r=10   → q=10, r=10
  LCB: q=6, r=16   → q=10, r=16
  LB:  q=6, r=21   → q=10, r=21
  RM:  q=10, r=5   → q=14, r=5
  RCM: q=10, r=10  → q=14, r=10
  LCM: q=10, r=16  → q=14, r=16
  LM:  q=10, r=21  → q=14, r=21
  RF:  q=14, r=9   → q=18, r=9
  ST:  q=14, r=17  → override → { q:18, r:13 } (kick-off hex)

Away positions: FORMATIONS['4-4-2'] mirrored (q=36−q), no shift:
  GK:  q=34, r=13
  RB:  q=30, r=5   (36−6=30)
  etc.
```

---

## State of the Art

| Old Approach                                         | Current Approach (Phase 23)                      | When Changed | Impact                                               |
| ---------------------------------------------------- | ------------------------------------------------ | ------------ | ---------------------------------------------------- |
| `buildSquadPieces` uses `p.position` from PoolPlayer | Uses `FORMATIONS[formationId].slots[i].position` | Phase 23     | Piece placement driven by formation, not squad data  |
| `piece.number` from PoolPlayer squad number          | `jerseyNumber` from formation slot               | Phase 23     | Jersey numbers reflect tactical formation assignment |
| No formation selection in pre-game flow              | Formation grid on combined selection screen      | Phase 23     | Players choose tactical setup before match           |
| ST identified by `role === 'ST'` in kick-off logic   | ST identified by `number === 9` (jersey)         | Phase 23     | Formation-agnostic kick-off striker lookup           |

---

## Assumptions Log

| #   | Claim                                                                                                        | Section                  | Risk if Wrong                                                                                                                         |
| --- | ------------------------------------------------------------------------------------------------------------ | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| A1  | Jersey numbers for 5-3-2 central MIDs (#8, #7, #11) resolve conflicts by assigning wing numbers to mid slots | Jersey Number Resolution | Planner should confirm with user if different numbering preferred                                                                     |
| A2  | Jersey #5 assigned to LF in 3-4-3 (remaining unused after LM takes #11)                                      | Jersey Number Resolution | Planner should confirm with user if #5 on a forward is acceptable                                                                     |
| A3  | Phase 24 determines what signal Phase 23 broadcasts after away confirms (currently: no GAME_STATE broadcast) | Pitfall 4                | If Phase 24's planner doesn't define the inter-phase signal, the client will be stuck on UNIFORM_SELECTION screen after away confirms |

---

## Open Questions

1. **What does Phase 23 broadcast after away confirms (to signal Phase 24 readiness)?**
   - What we know: Phase 23 must NOT call `buildInitialGameState`; Phase 24 does
   - What's unclear: Does Phase 23 emit a new event (e.g., `FORMATION_CONFIRMED`)? Does it emit a partial GameState? Does it just store the formation and wait for Phase 24's first event?
   - Recommendation: The planner should define a `FORMATION_CONFIRMED` ServerEvent emitted to both players after both formations confirmed, carrying both `FormationId` values. The client would then show a "Formation confirmed — waiting for lineup assignment" state (or just remain on UNIFORM_SELECTION). Phase 24 will implement the auto-assignment screen.

2. **Does `UNIFORM_HOME_CONFIRMED` need `formationId` in its payload?**
   - What we know: D-09 says to extend `UNIFORM_CONFIRM` with `formationId`; D-12 says formation flow is unchanged (home confirms, broadcasts, away confirms)
   - What's unclear: Does away player need to know home's formation before confirming their own? The CONTEXT.md says "No" — formations are independent
   - Recommendation: Extend `UNIFORM_HOME_CONFIRMED` to include `formationId` anyway (as CONTEXT.md Claude's Discretion recommends "extend is simpler"). This gives the client the full home confirmed state and enables Phase 24 to display it.

3. **Should `buildKickOffPieces` also be updated in Phase 23?**
   - What we know: `buildKickOffPieces` calls `buildSquadPieces`; it's used after every goal reset
   - What's unclear: Can Phase 23 update `buildKickOffPieces` signature without breaking Phase 24's callers, or should it be deferred?
   - Recommendation: Update `buildKickOffPieces` in Phase 23 (same task as rewriting `buildSquadPieces`) since it calls through. Phase 24 will need `selectedFormation` available in `room.gameState` anyway (D-11) to pass it to any post-goal reset.

---

## Environment Availability

Phase 23 is a code/config-only change with no new external tool dependencies. Step 2.6: SKIPPED (no new external dependencies identified).

| Dependency           | Required By      | Available | Version                         | Fallback |
| -------------------- | ---------------- | --------- | ------------------------------- | -------- |
| Node.js              | Build/run        | ✓         | 22 LTS                          | —        |
| pnpm                 | Workspace builds | ✓         | 9.x                             | —        |
| TypeScript           | Type checking    | ✓         | 5.x                             | —        |
| Vite                 | Client build     | ✓         | 5.x                             | —        |
| Formation PNG assets | Client UI        | ✓         | Already in `assets/formations/` | —        |

---

## Validation Architecture

### Test Framework

| Property           | Value                                              |
| ------------------ | -------------------------------------------------- |
| Framework          | Vitest (server + shared); no client test infra yet |
| Config file        | `packages/server/vitest.config.ts`                 |
| Quick run command  | `pnpm --filter @counter-attack/server test`        |
| Full suite command | `pnpm --filter @counter-attack/server test`        |

### Phase Requirements → Test Map

| Req ID  | Behavior                                                | Test Type   | Automated Command                                                 | File Exists?  |
| ------- | ------------------------------------------------------- | ----------- | ----------------------------------------------------------------- | ------------- |
| FORM-01 | Formation selection section on UniformSelectionScreen   | manual-only | n/a — no client test infra; browser UAT required                  | ❌ Wave 0 N/A |
| FORM-02 | Mini pitch diagram + description displayed per card     | manual-only | n/a — visual test; browser UAT required                           | ❌ Wave 0 N/A |
| FORM-03 | Both players confirm; waiting state shown after confirm | integration | `pnpm --filter @counter-attack/server test room.integration`      | ✅ exists     |
| FORM-04 | Pieces placed from FORMATIONS table; away mirrored      | unit        | `pnpm --filter @counter-attack/server test gameEngine.teamselect` | ✅ exists     |

### Sampling Rate

- **Per task commit:** `pnpm --filter @counter-attack/server test`
- **Per wave merge:** `pnpm --filter @counter-attack/server test`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `packages/server/src/__tests__/gameEngine.phase23.test.ts` — unit tests for:
  - REQ FORM-04: `buildSquadPieces` uses FORMATIONS positions (not PoolPlayer.position)
  - REQ FORM-04: away pieces are mirrored correctly via q=36−q
  - REQ FORM-04: kick-off +4 shift applied to kicking team outfield only
  - REQ FORM-04: GK position unchanged by shift
  - REQ FORM-04: jersey #9 piece repositioned to kick-off hex
  - REQ FORM-04: non-kicking team positions unchanged

- [ ] `packages/server/src/__tests__/formations.test.ts` — data integrity tests for `formations.ts`:
  - Each formation has exactly 11 slots
  - All jersey numbers 1–11 present exactly once per formation
  - GK slot is always index 0 with `{ q: 2, r: 13 }` and `jerseyNumber: 1`

---

## Security Domain

`security_enforcement` is not explicitly disabled in `.planning/config.json` — treated as enabled.

### Applicable ASVS Categories

| ASVS Category         | Applies | Standard Control                                                                                     |
| --------------------- | ------- | ---------------------------------------------------------------------------------------------------- |
| V2 Authentication     | no      | No new auth surfaces introduced                                                                      |
| V3 Session Management | no      | No session changes                                                                                   |
| V4 Access Control     | yes     | `formationId` must be validated server-side against allow-list                                       |
| V5 Input Validation   | yes     | `formationId` in `UNIFORM_CONFIRM` payload must be allow-list validated (ASVS V5, T-22-03 extension) |
| V6 Cryptography       | no      | No cryptographic operations                                                                          |

### Known Threat Patterns for this Stack

| Pattern                                               | STRIDE    | Standard Mitigation                                                                                                           |
| ----------------------------------------------------- | --------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Forged `formationId`                                  | Tampering | `VALID_FORMATION_IDS` const allow-list + `.includes()` check in `roomHandlers.ts`, matching `VALID_UNIFORM_STYLE_IDS` pattern |
| Formation replay attack (home sends away's formation) | Spoofing  | Home-first guard (playerSlot check) already present; formation stored per slot                                                |

**Required new allow-list (server-side):**

```typescript
// packages/server/src/roomHandlers.ts — add alongside VALID_UNIFORM_STYLE_IDS
import type { FormationId } from '@counter-attack/shared';
const VALID_FORMATION_IDS: readonly FormationId[] = ['4-4-2', '5-3-2', '4-3-3', '3-4-3'] as const;
```

---

## Sources

### Primary (HIGH confidence)

- `23-CONTEXT.md` — All locked decisions (D-01 through D-16), formation hex coordinates, jersey number rules — read directly in this session
- `23-UI-SPEC.md` — UI design contract for formation section (CSS classes, dimensions, colors, layout order) — read directly in this session
- `packages/shared/src/events.ts` — Current UNIFORM_CONFIRM / UNIFORM_HOME_CONFIRMED signatures — read directly
- `packages/shared/src/types.ts` — Current GameState shape — read directly
- `packages/server/src/roomHandlers.ts` — Current UNIFORM_CONFIRM handler implementation — read directly
- `packages/server/src/roomStore.ts` — Current Room type — read directly
- `packages/server/src/gameEngine.ts` — Current `buildSquadPieces` implementation — read directly
- `packages/client/src/components/UniformSelectionScreen.tsx` — Current component structure — read directly
- `packages/client/src/App.tsx` — Socket handler wiring pattern — read directly
- `packages/client/src/assets/formations/` — Confirmed PNG assets exist — verified via filesystem glob

### Secondary (MEDIUM confidence)

- `.planning/REQUIREMENTS.md` — FORM-01 through FORM-04 requirements
- `.planning/STATE.md` — Project architectural decisions

### Tertiary (LOW confidence)

- None

---

## Metadata

**Confidence breakdown:**

- Formation data (FORMATIONS table): HIGH — positions locked in CONTEXT.md, read directly
- Jersey number assignments: MEDIUM — rules provided in CONTEXT.md but resolution of conflicts is Claude's discretion
- Engine rewrite pattern: HIGH — read existing `buildSquadPieces` code directly
- Event extension pattern: HIGH — read existing handlers directly
- UI extension pattern: HIGH — read existing component and UI-SPEC directly
- Pitfalls: HIGH — derived from direct code inspection of mutation patterns and existing logic

**Research date:** 2026-07-05
**Valid until:** 2026-08-05 (stable domain — no external dependencies)
