# Feature Research — v1.3

**Domain:** Real-time 2-player web board game — team customization, formation selection, stat-based player assignment
**Researched:** 2026-07-03
**Builds on:** v1.2 research (lobby, reconnection, dice, hex rendering patterns)
**Confidence:** HIGH for UX patterns (well-established across BoardGameArena, Lichess, tabletop digital ports); MEDIUM for algorithm specifics (derived from comparable systems — Football Manager, fantasy sports drafts — adapted to Counter Attack's 1–6 stat range)

---

## Team Library

### Table Stakes

These are the minimum requirements for a team selection screen with 12 teams across 2 leagues to feel complete and navigable.

| Feature                                          | Why Expected                                                                                                                                                                  | Complexity |
| ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| League tabs or category filter                   | 12 teams is too many for a single flat grid; users need visual segmentation to orient. Any app with 2+ categories of the same item uses tabs (App Store, Steam, Google Play). | Low        |
| Active/selected state on tab                     | Without it, users don't know which category they're viewing. One-line CSS toggle.                                                                                             | Low        |
| Disabled/struck-out card for already-picked team | Already in the codebase for 4-team layout. Must scale to 12 teams. Away player sees home's pick struck out before choosing.                                                   | Low        |
| Tab persists while away player waits             | If home player picks from League A, away player's view should default to (or stay on) the same league so they see the struck-out card in context.                             | Low        |
| Team card shows name + badge                     | Already done. Keep for 12 teams. At 12 cards the badge must be smaller (60–80px vs current 110px).                                                                            | Low        |

### Differentiators

| Feature                                                           | Value Proposition                                                                                              | Complexity                       |
| ----------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | -------------------------------- |
| "Stat summary pill" on each card (e.g. "ATK 4.2 DEF 3.8")         | Lets players make an informed pick without opening a full squad view. Requires averaging stats per role group. | Low — computed at data-seed time |
| Hover/focus tooltip showing squad preview (top 3 players + stats) | Richer info without a full extra screen. Common in strategy game unit selectors.                               | Medium                           |
| League badge / crest beside tab label                             | Visual identity. Not required for function.                                                                    | Low                              |

### Expected Flow

This is the correct flow for the updated team library. Deviating from it adds confusion at a moment when players are still orienting.

1. Both players are on the Team Selection screen (triggered after slot-2 joins, same as today).
2. Header: "Home: choose your team" / "Away: choose your team".
3. Two tabs at top: **MLS** | **International** (or equivalent league names). Default tab = MLS.
4. 6 team cards shown in a 2×3 or 3×2 grid per tab. Cards show badge + team name.
5. Home player clicks a card → their pick is recorded; card is struck out in both players' views; tab switches automatically to show away player's turn.
6. Away player's view: home's pick is struck out (wherever it lives across tabs); away browses both tabs freely and picks.
7. Both picks confirmed → transition to Formation Selection (new step, see below).

**Tab vs filter pattern decision:** Use tabs, not a dropdown filter. Tabs are faster (one click, no menu) and the two leagues are a categorical split, not a faceted filter. Dropdowns imply many values; two leagues = two tabs.

**Cross-tab struck-out behavior:** The struck-out card must be visible even on the tab the away player isn't currently on. Two options:

- Option A (recommended): When home picks from MLS, automatically open away player's view on MLS tab so they see the struck-out card. Away can then switch tabs freely.
- Option B: Show a small "taken" badge on the tab label itself ("MLS (1 taken)") to signal something was picked there. Add only if Option A feels confusing in testing.

### Dependencies

- `TeamId` type must be expanded to include 12 values.
- `TEAM_CONFIGS` must gain a `league: 'mls' | 'international'` field per team.
- `TEAM_SQUADS` in `teams.ts` must have 12 entries (vs current 4). Seed script already exists (`seed-rosters.ts`).
- Existing 4 teams (cosmos, xolos, city, crew) must be reclassified into leagues or retired — this is a data migration, not a code architecture change.
- Color scheme decoupling (see Color Scheme section) is NOT a blocker for the team library; teams can still carry `primaryColor`/`secondaryColor` inline for v1.3.

---

## Formation Selection

### Table Stakes

| Feature                                                                 | Why Expected                                                                                                                                                             | Complexity |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------- |
| Formation picker shown once per player, after team pick, before kickoff | Without it, formation is hardcoded and players have no agency over tactical setup — the feature simply doesn't exist.                                                    | Low-Medium |
| Visual formation diagram                                                | Players must see what "4-4-2" means spatially before confirming. Text label alone is insufficient. A simplified 2D pitch with dots for positions takes ~30 lines of SVG. | Low        |
| Confirmation button                                                     | Required to gate auto-assignment. Formation must be locked before position slots are defined.                                                                            | Low        |
| Both players must confirm before kickoff proceeds                       | Same "both ready" pattern as KICK_OFF_SETUP. Server holds the transition.                                                                                                | Low        |
| Formation persists through the match                                    | The chosen formation defines starting positions. The game already has KICK_OFF_SETUP for fine repositioning, so the formation just sets initial hex assignments.         | Low        |

### Differentiators

| Feature                                                       | Value Proposition                                                                                                                           | Complexity |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| Highlight the "difference" between formations                 | When user hovers 4-3-3, dim the 4-4-2 dots and show the 4-3-3 dots instead in a different color. Helps players visualize tactical tradeoff. | Medium     |
| Formation description text ("4-3-3: High press, wide attack") | Guides tactical intent for players unfamiliar with football formations.                                                                     | Low        |
| Opponent's formation revealed after both confirm              | Adds a pre-match tension moment. Mirrors how tabletop Counter Attack works (you don't see opponent's formation until kickoff).              | Low        |

### Expected Flow

Formation selection follows team selection in the pre-match lobby sequence.

1. Both teams picked → screen transitions to "Choose Formation".
2. Each player sees 4 formation options: **4-4-2**, **5-3-2**, **4-3-3**, **3-4-3** (displayed as labelled cards with a mini pitch diagram).
3. Player clicks a formation card → it highlights (selected state). Player clicks "Confirm Formation".
4. After confirming: player sees "Waiting for opponent to choose formation…".
5. Once both players have confirmed → **auto-assignment runs server-side** (see Auto-Assignment section). Server emits `game:state` with KICK_OFF_SETUP phase; pieces are positioned per formation + auto-assignment result.
6. KICK_OFF_SETUP works as today: players may swap pieces before clicking Ready.

**When shown:** Formation selection is a new discrete phase between team selection and KICK_OFF_SETUP. It is NOT shown mid-match or at half-time. It is shown once per match per player.

**Server-side enforcement:** The server must receive the formation choice before running auto-assignment. A new socket event (`game:formation_pick` or similar) carries `{ teamId, formation: '4-4-2' | '5-3-2' | '4-3-3' | '3-4-3' }`. Server holds game start until both formations are received.

**FSM impact:** A new game phase (e.g. `FORMATION_SELECT`) must be added between team-selection acknowledgment and KICK_OFF_SETUP. Both existing phases are unaffected.

### Formation → Hex Position Mapping

Each formation defines a set of named position slots. The server maps each slot to a starting hex using a lookup table keyed by `(formation, side: 'home'|'away', slotName)`. The KICK_OFF_SETUP hex grid already has named regions (PITCH_REGIONS); formation starting positions extend that.

**4-4-2 (existing, hardcoded):**

- GK: q=2, r=13
- DEF (4): q=6, r={6, 10, 16, 20}
- MID (4): q=10, r={4, 9, 17, 22}
- FWD (2): q=15, r={9, 17}
- ST (1): q=18, r=13

The other three formations shift the midfield and forward line counts. The exact hex coordinates for new formations are a data decision (not a code architecture decision) — they should be authored during the implementation phase with reference to the physical board.

### Dependencies

- Formation selection must complete before auto-assignment can run (strict sequential dependency).
- Auto-assignment depends on the formation because position slots are derived from the formation.
- KICK_OFF_SETUP already handles post-assignment repositioning — no changes needed there beyond receiving pre-positioned pieces.

---

## Auto-Assignment with Override

### Table Stakes

| Feature                                                          | Why Expected                                                                                                                                                                          | Complexity         |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------ |
| System assigns players to positions automatically                | Without it, players must manually drag 11 pieces to positions before every kickoff — unusable friction. Every digital tabletop game that has formation+roster selection auto-assigns. | Medium (algorithm) |
| Visual display of the assignment result before confirmation      | Players must see who is where before accepting. A list of "Position → Player Name" rows is sufficient; a mini-pitch with name labels is better.                                       | Low-Medium         |
| Swap mechanism: player can exchange two pieces before confirming | One-level override is table stakes. Players will immediately see a mis-assignment (e.g. their best striker placed at wing) and expect to fix it.                                      | Medium             |
| Confirm button to lock assignment                                | Required to gate the KICK_OFF_SETUP transition.                                                                                                                                       | Low                |
| GK is always locked to the GK slot                               | GK is a distinct role. Auto-assignment must never place an outfielder in goal. This is a hard constraint, not a preference.                                                           | Low                |

### Differentiators

| Feature                                          | Value Proposition                                                                                                                                                           | Complexity |
| ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| Highlight "best fit" vs "compromise" assignments | Color-code slots where the assigned player's primary stat is well below the position's ideal (e.g. red tint if shooting < 3 for a CF slot). Helps players prioritize swaps. | Low        |
| Show stat comparison when selecting a swap       | When player clicks two pieces to swap, show a side-by-side stat comparison so they can confirm the swap is beneficial.                                                      | Medium     |
| "Re-auto-assign" button                          | Lets players redo the auto-assignment if they've made swaps they regret.                                                                                                    | Low        |

### Algorithm Notes

The algorithm runs server-side (authoritative). Client shows the result; player overrides are sent as swap events. This prevents either player from having a computational advantage.

**Position roles in Counter Attack (from codebase):**

- GK (1): saving + handling + aerialAbility
- DEF (varies by formation — 3, 4, or 5): tackling + resilience + aerialAbility
- MID (varies — 3 or 4): highPass + dribbling + tackling (balance stat)
- FWD/winger (varies): pace + dribbling + shooting
- ST/CF (1–2): shooting + heading (aerialAbility) + pace

**Recommended algorithm: weighted score → greedy assignment**

This is the simplest correct approach. More sophisticated (Hungarian algorithm / optimal assignment) is not justified for 11 players and 4 formation types.

```
type PositionSlot = { slotId: string; role: 'GK'|'CB'|'FB'|'CM'|'CAM'|'W'|'CF'; weights: Record<StatKey, number> }

function scorePlayerForSlot(player: PlayerPiece, slot: PositionSlot): number {
  return sum over stat in weights: player[stat] * slot.weights[stat]
}

function autoAssign(squad: PlayerPiece[], slots: PositionSlot[]): Map<slotId, playerId> {
  1. Lock GK first: assign the squad's single GK-role player to the GK slot. Remove both from candidate pool.
  2. For each remaining slot (sorted by specificity — CF before CM before FB):
     a. Score all unassigned outfield players against this slot.
     b. Assign the highest-scoring unassigned player to this slot.
     c. Remove that player from the pool.
  3. Return the complete assignment map.
}
```

**Stat weights per role (recommended starting values — tune during playtest):**

| Role         | Primary Stats                             | Secondary Stats |
| ------------ | ----------------------------------------- | --------------- |
| GK           | saving×3, handling×3, aerialAbility×2     | pace×0.5        |
| CB (anchor)  | tackling×3, resilience×2, aerialAbility×2 | highPass×1      |
| FB (flex)    | tackling×2, pace×2, resilience×1          | dribbling×1     |
| CM (anchor)  | highPass×2, tackling×2, dribbling×2       | resilience×1    |
| CAM/flex-mid | dribbling×3, shooting×2, highPass×1       | pace×1          |
| W/winger     | pace×3, dribbling×2, shooting×1           | —               |
| CF (anchor)  | shooting×3, aerialAbility×2, pace×1       | dribbling×1     |

**Anchor vs flex distinction:** The milestone context calls out "anchor roles (CB/CM/CF) vs flex roles (FB/winger/flex-mid)". Anchors are filled first in the greedy pass (step 2 above, sorted by specificity). This prevents the best all-rounder from being consumed by a flex role before the critical anchor slots are evaluated.

**Tie-breaking:** When two players score identically for a slot, break ties by:

1. Higher combined stat total (more versatile player goes to the more demanding slot)
2. If still tied, lower jersey number (deterministic, avoids random outcomes)

Ties are rare on 1–6 integer stats with weighted sums, but the tiebreaker must exist to prevent non-determinism.

**Swap/override UX flow:**

1. Auto-assignment result is displayed (list or mini-pitch).
2. Player clicks piece A (highlights it). Player clicks piece B → the two pieces swap slots. Server receives `game:formation_swap { pieceIdA, pieceIdB }`.
3. Server validates swap (both pieces in same team's squad, neither is GK being moved out of GK slot). Emits updated assignment state.
4. Player can make multiple swaps.
5. Player clicks "Confirm" → assignment is locked. Server moves pieces to their formation hex positions.
6. KICK_OFF_SETUP phase begins for fine repositioning.

**GK lock rule:** The GK slot may only receive a player whose `role === 'GK'` in the squad data. The swap validator on the server enforces this. A player may not "promote" an outfielder to GK via the swap UI.

**Server-side execution:** Auto-assignment runs once, after both players have confirmed their formations. The server runs `autoAssign(squad, slotsForFormation)` and stores the result in game state. Both clients receive the assignment simultaneously via `game:state`.

### Dependencies

- Requires formation to be confirmed before it can run (formation defines the slot list).
- Position hex coordinates for non-4-4-2 formations must be authored before auto-assignment can place pieces.
- The `PlayerPiece.role` field (`GK|DEF|MID|FWD|ST`) in the current codebase is a coarse role, not a formation slot. Auto-assignment maps the fine-grained slot (CB, FB, CM, etc.) from the formation spec; the coarse role is used only as a GK gate.
- Swap validation is server-side. Client sends swap intents; server applies them to the assignment map.

---

## Color Scheme / Visual Identity

### Table Stakes (for v1.3 and v1.4 prep)

For v1.3 (the team library milestone), color scheme is still inline on `TeamConfig` — no architectural change needed. The decoupling is a v1.4 concern.

| Feature                                                                 | Why Expected                                                                                             | Complexity                           |
| ----------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| Each team has a distinct primary color used on pieces and cards         | Already in codebase. Must continue to work as teams are added.                                           | None — existing                      |
| Badge image per team                                                    | Already in codebase. Must be authored for 8 new teams.                                                   | Art/asset cost, not code cost        |
| Colors don't clash when two teams with similar palettes face each other | With 12 teams, color collision probability rises. Need a check at match start (or design-time curation). | Low — enforce at data-authoring time |

### Notes for v1.4 Prep

The architectural goal stated in the milestone context is: **visual identity (badge, colors, jersey) becomes a separate entity from team roster.**

This means a future `ColorScheme` type that can be referenced by team config but also selected independently (e.g. custom team "use Manchester blue scheme with Sydney FC crest"). The separation enables:

- Custom team creation (v1.5+): player defines roster, then picks a color scheme separately
- Reuse of schemes across teams without duplicating color data
- Scheme selection UI (color picker or preset palette selector)

**Recommended v1.4 data model (do not build now, design now):**

```typescript
export type ColorSchemeId = string; // e.g. 'blue-gold', 'red-black', 'custom-abc123'

export interface ColorScheme {
  id: ColorSchemeId;
  primaryColor: string; // hex
  secondaryColor: string; // hex
  tertiaryColor?: string; // optional trim color
  badgeFile?: string; // optional crest override
}

export interface TeamConfig {
  id: TeamId;
  name: string;
  colorSchemeId: ColorSchemeId; // reference, not inline
  leagueId: 'mls' | 'international';
}
```

**v1.3 migration path (zero-breaking-change):** Keep `primaryColor`/`secondaryColor` inline on `TeamConfig` for all 12 v1.3 teams. In v1.4, extract them into a `COLOR_SCHEMES` registry and replace inline fields with `colorSchemeId`. Client components that read `TEAM_CONFIGS[id].primaryColor` will need a one-line lookup change: `COLOR_SCHEMES[TEAM_CONFIGS[id].colorSchemeId].primaryColor`.

**Color scheme selection UX (v1.4 design guidance):**

- Do NOT build a full color picker for v1.4. Offer 10–12 preset palettes as clickable swatches, same pattern as GitHub profile customization and Notion page icon selection.
- Custom hex input is a v1.5+ feature.
- Scheme selection happens in a "Customize team" modal accessible from the team library, not inline on the team card.

---

## Feature Dependency Map (v1.3 milestone)

```
Team Library (12 teams, 2 leagues)
    └─> League tabs UI                   (new client component)
    └─> Expanded TeamId union            (shared types change)
    └─> 8 new team data entries          (teams.ts + seed script)
    └─> league field on TeamConfig       (shared types change)

Formation Selection
    └─> Requires team selection complete  (existing flow gated)
    └─> New FORMATION_SELECT game phase   (FSM addition)
    └─> Formation→slot mapping table      (new shared data)
    └─> Both-players-confirm pattern      (same as KICK_OFF_SETUP ready flow)
            └─> Auto-Assignment runs      (server-side, triggered on both confirms)

Auto-Assignment
    └─> Requires formation confirmed      (slot list must be known)
    └─> Requires squad data (12 teams)    (team library dependency)
    └─> Swap UI                           (client component, server-validated)
            └─> Confirm locks assignment  (gates KICK_OFF_SETUP transition)

KICK_OFF_SETUP (existing)
    └─> Receives pre-positioned pieces    (from auto-assignment)
    └─> No changes needed to constraint logic
```

**Critical path for v1.3:**

1. Expand `TeamId`, `TEAM_CONFIGS`, `TEAM_SQUADS` with 8 new teams + league field
2. Formation data model (slot definitions per formation + hex positions)
3. `FORMATION_SELECT` FSM phase + socket events
4. Auto-assignment algorithm (server-side `autoAssign` function)
5. Formation picker UI (client)
6. Assignment review + swap UI (client)
7. League tabs on team selection screen (client)

Steps 1–4 are backend/shared; steps 5–7 are client. Steps 1–2 are blocking for all others. Steps 3–4 can develop in parallel with steps 5–7 once the data model is settled.

---

## Confidence Notes

- **HIGH:** Tab vs filter pattern for 2-league team library — this is a universal, well-established UX pattern. No ambiguity.
- **HIGH:** Both-players-confirm gate for formation — already proven in KICK_OFF_SETUP; the same pattern transfers directly.
- **HIGH:** GK-lock constraint in auto-assignment — the codebase already distinguishes GK by role; enforcing the lock is trivial.
- **HIGH:** Greedy weighted-score algorithm for auto-assignment — justified for small N (11 players). Hungarian algorithm is unnecessary complexity. Fantasy sports and Football Manager both use weighted scoring for initial auto-picks.
- **MEDIUM:** Stat weight values — the weights in the algorithm section are starting points. They require playtest validation. Wrong weights will produce assignments that feel wrong to football-knowledgeable players (e.g. assigning a low-shooting player to CF).
- **MEDIUM:** Formation hex coordinates for non-4-4-2 formations — positions must be visually correct on the actual hex grid. This depends on the board photo/measurements (already flagged as a blocking dependency in PROJECT.md). Coordinates in this document are illustrative, not final.
- **LOW:** Whether formation reveal (opponent's choice shown after both confirm) improves the experience — this is a preference call. Recommend building it but treating it as a toggle.
