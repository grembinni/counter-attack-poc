# Features Research — Counter Attack Web

**Domain:** Real-time 2-player multiplayer web board game
**Researched:** 2026-05-27
**Confidence:** MEDIUM — Sources: training knowledge of Socket.io patterns, Lichess/BoardGameArena/Chess.com UX conventions, general multiplayer game design literature. No live web lookups were available in this research session; claims reflect well-established patterns rather than freshly scraped docs. Flag anything domain-specific for validation.

---

## Table Stakes

Features users expect as baseline for a functional real-time 2-player web game. Absence makes the product feel broken or untrustworthy.

### 1. Room Code Lobby Flow

| Sub-feature | Detail | Priority |
|-------------|--------|----------|
| Create room → get 4–6 character code | Short alphanumeric codes (e.g. "XKCD7") are the industry standard. Avoid codes with ambiguous chars: 0/O, 1/I/l. | Must |
| One-click copy of room code | Copy-to-clipboard button on the waiting screen. Players share over Discord/WhatsApp — friction here kills sessions. | Must |
| Join by code input | Simple text input, case-insensitive, instant feedback if code is invalid or room is full. | Must |
| "Waiting for opponent" state | Spinner/message while host waits. Show the room code again so host can re-share. | Must |
| Room full / game in progress guard | If a 3rd party tries to join an active room, return a clear error, not a silent failure. | Must |

**Minimum viable flow:** Landing page → [Create Game] or [Join Game with code] → Waiting room → Game starts automatically when 2nd player joins. No account, no auth, no matchmaking queue.

**Why table stakes:** This IS the product entry point. A confusing lobby means the game never starts. The room code pattern is universally understood from Among Us, Jackbox, Skribbl.io.

---

### 2. Reconnection / Disconnect Handling

**What goes wrong without it:** Player refreshes tab by accident, mobile network hiccups (even on desktop Wi-Fi), ISP blip. Without reconnection, the game is dead and both players lose their session.

| Sub-feature | Detail | Priority |
|-------------|--------|----------|
| Grace period for reconnection | Server holds game state for 60–120 seconds after a socket disconnect before treating it as abandonment. Socket.io's built-in reconnection logic handles the transport layer; the server must hold the room. | Must |
| Rejoin via same room code | On reconnect, client sends room code + player identity (session token stored in sessionStorage). Server restores full game state to the reconnecting client. | Must |
| Opponent notified of disconnect | Remaining player sees "Opponent disconnected — waiting for reconnect (Xs remaining)" rather than a frozen board. | Must |
| Abandonment after grace period | After timeout: show "Opponent abandoned the match" with option to return to lobby. Do NOT auto-declare a winner — just surface the state clearly. | Must |
| Session token scoped to tab | Use `sessionStorage` (not `localStorage`) so two tabs from same browser don't collide. A 16-character random token generated on Create/Join is sufficient. | Must |

**Why table stakes:** Real-time multiplayer without reconnection means any network hiccup kills the session. Players will blame the game, not their router. Socket.io handles transport reconnection automatically but the server-side room persistence and state replay must be explicitly built.

---

### 3. Whose-Turn Indicator

Clear, persistent, unambiguous display of:
- Which player's turn it is (with their team name/color)
- What phase they are in (Movement / Pass / Shot / Save / etc.)
- How many actions remain in the current phase (e.g. "Attacker moves: 2 of 4 used")

**Why table stakes:** Without this, players constantly misread the board. In async games you can email; in real-time games the UI must carry the full cognitive load of turn state. Lichess, Chess.com, and BoardGameArena all make this the largest persistent UI element after the board itself.

---

### 4. Valid Move Highlighting

When a player selects a piece, the set of legal destination hexes must be visually highlighted before they click. In chess-like UIs this is non-negotiable — it communicates both the rules and the current selection state simultaneously.

- Unselected hex: default color
- Selected piece: highlight (e.g. yellow ring)
- Valid destination hex: highlight (e.g. green tint)
- Invalid / ZOI-blocked hex: no highlight (or subtle red if hovered)

**Why table stakes:** Without it, players have no way to discover rules interactively. The game becomes a memory test for the rulebook rather than a playable experience.

---

### 5. Last Action Feedback

After every game event (move, pass, dice roll, shot outcome), surface a brief plain-English summary:

- "Red #7 moved to C4"
- "Blue rolled 5 — pass successful"
- "GOAL! Red scores. 1–0"

A persistent action log (last 3–5 entries visible) serves both players, not just the active one. The passive player needs to understand what just happened without interpreting board state alone.

**Why table stakes:** Real-time 2-player games have an asymmetric information problem — one player acts, the other watches. Without narration, the watching player is passive and confused. Every successful web board game (Lichess move notation, BGA action log) includes this.

---

### 6. Game Over Screen

When the match ends (90 actions elapsed, second half complete):
- Final score displayed prominently
- Winner declared (or draw)
- Two clear options: [Play Again] and [Back to Lobby]

**Why table stakes:** Without an explicit end state, players don't know if the game crashed or finished. Closing the loop is part of the core gameplay contract.

---

### 7. Dice Roll Visual Feedback

The project already calls for player-triggered dice rolls (click to roll). The visual feedback pattern required:
- Pending state: "Click to roll" prompt, clearly scoped to the active player only
- Rolling state: brief indication that the roll is processing (even 200ms fake delay improves perceived fairness)
- Result state: the number(s) shown clearly, outcome explained ("You rolled 4 — shot saved" vs "You rolled 4 — GOAL!")

**Why table stakes:** Dice rolls are the moment of maximum tension. If the result appears without ceremony, it feels like the game is malfunctioning. The click-to-roll model the project already specifies is correct — never auto-roll.

---

## Differentiators

Features that improve the experience meaningfully but whose absence does not make the product feel broken.

### 1. Rematch Flow

After the Game Over screen, both players can click [Rematch]. A simple handshake:
- First to click: "Waiting for opponent to accept rematch..."
- Second to click: same room, sides swapped (home/away alternate), game restarts

**Value:** Reduces friction for a second game. Without it, players must exchange a new room code.
**Scope:** Low — reuse existing room state, reset game state on server, signal both clients.
**Verdict:** Build it. It's a 1-session feature that substantially changes the "two friends playing" experience.

---

### 2. Move Log / Action History Table

A scrollable table of all actions taken this match:

| # | Player | Action | Result |
|---|--------|--------|--------|
| 1 | Red | Moved #7 → C4 | — |
| 2 | Red | Pass #7 → #9 | Success (rolled 4) |
| 3 | Blue | Shot | Saved |

**Value:** Lets players review what happened, understand momentum, dispute misclicks.
**Scope:** Medium — requires event sourcing on server (which you should have anyway for reconnect state replay). If you build reconnect replay (table stakes), the log is essentially free.
**Verdict:** Build it, because the reconnect state replay architecture already produces the raw events. Render them in a side panel. This is nearly free if event sourcing is in place.

---

### 3. Turn Timer (Optional, Configurable)

A visible countdown (e.g. 60 seconds per action phase) with auto-forfeit or auto-pass if exceeded.

**Value:** Prevents stalled games when one player goes idle without disconnecting.
**Scope:** Medium — requires server-side timer, forfeit logic, and UI clock.
**Verdict:** Defer to v2. The project specifies "real-time only, requires active WebSocket connection." If a player goes idle, the disconnect grace period (table stakes) handles it indirectly. A formal timer adds implementation complexity that the v1 scope doesn't need. Can be added when user feedback reveals stalling is a real problem.

---

### 4. In-Game Chat

A simple text input at the bottom of the game panel. Messages scoped to the room.

**Value:** Friends playing together expect to be able to trash-talk or coordinate.
**Scope:** Low (Socket.io room broadcast, append to chat log).
**Verdict:** Nice-to-have but explicitly skip for v1. The target audience (two friends) will have their own voice/text channel open (Discord). Building chat adds a moderation surface and scope creep. Revisit when there are strangers playing (which requires matchmaking, also out of scope).

---

### 5. Spectator Mode

Allow additional connections to a room as read-only observers.

**Value:** Useful for streaming, coaching, or a friend watching.
**Scope:** Medium — requires a third role type, UI for spectator state, and ensuring spectators cannot interact.
**Verdict:** Defer. The two-player constraint is fundamental to v1. Spectator support requires the server to distinguish socket roles and broadcast appropriately without exposing player identities incorrectly. This is a v2 social feature.

---

### 6. Sound Cues

Distinct audio events for:
- Your turn starting (soft chime)
- Opponent's move landing (click)
- Goal scored (cheer / whistle)
- Dice result (roll sound)

**Value:** Audio feedback significantly increases engagement in turn-based and real-time board games. Reduces cognitive load on the active player (they don't have to watch the screen every second).
**Scope:** Low — HTML5 Audio API, small sound files, a toggle in the UI.
**Verdict:** Nice-to-have. Implement only if a dedicated pass is made for polish. No animations are in scope, so sound would be the only motion feedback — this elevates the experience cheaply.

---

## Anti-Features for v1

Features that add scope, complexity, or attack surface without delivering core value in a two-friend, real-time context.

### 1. User Accounts / Authentication

No logins, no profiles, no passwords. Room codes are the access token. Authentication adds a registration funnel that most players will abandon before they play a single match.

**Avoid because:** The core value proposition ("share a room code and play") is destroyed by a signup wall. Validated user accounts belong to a social/ranked product, not a proof-of-concept.

### 2. Matchmaking / Public Lobbies

Random opponent matching, ELO ratings, leaderboards, ranked queues.

**Avoid because:** The project explicitly targets two known players. Public matchmaking requires anti-abuse, rating systems, and significantly more server infrastructure. Distraction from gameplay fidelity.

### 3. Animations

The PROJECT.md already marks this as out of scope. Reinforce: CSS transitions and canvas animations for piece movement add significant frontend complexity, accessibility concerns, and performance work for no rules benefit.

**Avoid because:** Animation is polish. The MVP must validate that the rules implementation is correct and fun before investing in presentation.

### 4. Chat

Listed above under Differentiators with "Defer" verdict — reinforced here. Chat is an anti-feature for v1 specifically because the target users already have a communication channel, and building chat creates a moderation burden with zero additional players to moderate.

### 5. Persistent Game History / Replay

Storing full match replays in a database for later review.

**Avoid because:** The move log (Differentiator #2) covers the in-session case. Full replay persistence requires a database schema, storage costs, and a replay viewer. None of these exist yet. The session event log lives only in memory; that is sufficient for v1.

### 6. Mobile Layout

Already out of scope per PROJECT.md. The hex grid at the required resolution cannot be meaningfully rendered on a phone screen without a dedicated responsive design pass.

### 7. Team Selection / Card Editor

Teams are hardcoded. Exposing team selection adds a lobby step, attribute balancing concerns, and requires more teams to be authored. Hardcoded teams validate that the attribute system works before building a roster management UI.

### 8. Forfeit / Resign Button

**Borderline.** Players might want to concede when losing 5-0 with 10 actions left. However:
- The game is short (90 actions total), so conceding is less critical than in chess
- Without accounts, a forfeit has no stakes (no rating loss)
- Misclick risk on a forfeit button is high

**Verdict:** Defer. If it surfaces in playtest feedback, add in a v1.1 patch. The disconnect grace period already handles "I want to stop" implicitly (close tab → opponent sees abandon notice).

---

## UX Patterns

Specific conventions used by successful web board games (Lichess, Chess.com, BoardGameArena, Skribbl.io, Jackbox) that should be followed rather than reinvented.

### Lobby / Room Code

- **Code format:** 6 characters, uppercase alphanumeric, no ambiguous chars. Display in a large monospace font.
- **Copy button:** Clipboard icon next to the code. Show "Copied!" for 1.5 seconds then revert. No browser `alert()`.
- **Waiting state:** Full-screen "Waiting for opponent..." with the code displayed again. Do not navigate away from this page on game start — update it in place (SPA state transition).
- **Name/color assignment:** Assign home/away automatically. Display it on the waiting screen ("You are playing as Red — Home") so players know before the game loads.

### Turn Structure

- **Header bar or sidebar pill:** Always-visible indicator: "[Team Name]'s Turn — Movement Phase — Actions: 2/4 remaining"
- **Disabled controls:** The opponent's click events must be blocked, not just visually suppressed. Server enforces this; client also grays out interactive elements to provide immediate feedback.
- **Phase transition announcement:** A brief center-screen toast or banner when the phase changes ("Blue's Movement Phase begins") that auto-dismisses after 2 seconds.

### Hex Grid Interaction

- **Single-click select, second-click confirm:** Click a piece to select (highlights valid moves). Click a valid hex to confirm the move. Click elsewhere to deselect. This is the chess.com pattern and is intuitive.
- **No drag-and-drop:** Drag is unreliable on hex grids and adds touch-handling complexity. Click-to-move only.
- **Hover state on valid hexes:** On mouseover, show a faint preview of the piece in the target hex. Reduces misclicks.
- **Confirmation for irreversible actions:** Before a shot or dice roll that cannot be taken back, a brief confirm step ("Roll dice for shot? [Roll] [Cancel]") prevents fat-finger errors.

### Dice Roll

- **Mandatory player trigger:** Click-to-roll as specified. Never auto-roll. The click is the moment of agency.
- **Display the number:** Show the rolled value(s) in large type for 2–3 seconds. State the outcome in plain English beneath it.
- **Passive player sees the same result:** Both players see the same roll result simultaneously (server broadcasts). Do not show one player before the other.

### Network / Connection State

- **Connection indicator:** A small dot in the corner (green = connected, yellow = reconnecting, red = disconnected). Lichess uses this pattern. Players should never wonder if their connection is live.
- **Reconnect banner:** If the socket drops, show a non-blocking banner: "Connection lost — reconnecting..." that resolves automatically. Do not interrupt gameplay state.
- **Opponent disconnect notice:** A modal or prominent banner: "Opponent disconnected. Waiting for them to reconnect (45s)." with a countdown. Show [Leave Game] but no auto-action.

### Action Log

- **Right-side panel or bottom strip:** A narrow persistent log showing the last 5–8 actions. Auto-scrolls to bottom. Timestamps optional but not required.
- **Plain English entries:** "Red: Moved #9 to E6", "Blue: Rolled 3 — Pass failed (Loose Ball)"
- **Both players see the same log:** Server-authoritative log state, broadcast to room.

### Game Over

- **Full-screen overlay** on top of the final board state. Score prominent. Winner in large text.
- **Two buttons only:** [Rematch] and [Back to Lobby]. No social share (v1 has no accounts to share from).
- **Board remains visible** underneath the overlay for post-game review.

---

## Dependency Map

Which features must be built before others can work.

```
Socket.io Room Management
    └─> Room Code Generation & Sharing          (lobby entry point)
    └─> Player Identity (session token)         (required for reconnect)
            └─> Reconnect / State Replay         (requires identity + room persistence)
                    └─> Opponent Disconnect Notice    (requires reconnect infrastructure)

Server-Authoritative Game State (event log)
    └─> Game State Broadcast to both clients    (required for turn indicator, move log)
    └─> Valid Move Calculation (server-side)     (required for hex highlighting)
    └─> Action Log (in-memory event list)        (required for move log panel)
            └─> Reconnect State Replay           (replay = re-broadcast event log to rejoining client)
            └─> Move Log UI Panel                (nearly free once event log exists)

Turn State Machine
    └─> Whose-Turn Indicator                    (reads turn state)
    └─> Input Blocking (opponent's controls)    (reads turn state)
    └─> Phase Transition Toast                  (fires on turn state change)

Game Over State
    └─> Score Tracking                          (prerequisite from core game rules)
    └─> Game Over Screen                        (reads final score + winner)
            └─> Rematch Flow                    (resets game state on server, reuses room)
```

**Critical path for v1:**
1. Room management + session tokens
2. Server game state + event log
3. Turn state machine + broadcast
4. Valid move highlighting
5. Dice roll flow
6. Game over screen

Rematch and move log panel are fast followers once the above are solid.

---

## Feature Classification Summary

| Feature | Classification | Build in v1? |
|---------|---------------|--------------|
| Room code create/join | Table Stakes | Yes |
| Copy-to-clipboard code | Table Stakes | Yes |
| Waiting for opponent screen | Table Stakes | Yes |
| Reconnect grace period | Table Stakes | Yes |
| Session token (sessionStorage) | Table Stakes | Yes |
| Opponent disconnect notice | Table Stakes | Yes |
| Whose-turn indicator | Table Stakes | Yes |
| Valid move highlighting | Table Stakes | Yes |
| Last action feedback (log) | Table Stakes | Yes |
| Dice roll click-to-roll + result display | Table Stakes | Yes |
| Game over screen | Table Stakes | Yes |
| Connection status indicator | Table Stakes | Yes |
| Rematch flow | Differentiator | Yes — low effort, high value |
| Move log panel | Differentiator | Yes — nearly free with event log |
| Sound cues | Differentiator | Defer — polish pass only |
| Turn timer | Differentiator | Defer to v2 |
| In-game chat | Differentiator / Anti-feature | Skip for v1 |
| Spectator mode | Differentiator | Defer to v2 |
| User accounts | Anti-feature | Never in v1 |
| Matchmaking | Anti-feature | Never in v1 |
| Animations | Anti-feature | Never in v1 |
| Persistent replay storage | Anti-feature | Never in v1 |
| Mobile layout | Anti-feature | Never in v1 |
| Team selection UI | Anti-feature | Never in v1 |
| Forfeit/resign button | Anti-feature | Defer — monitor playtest feedback |

---

## Confidence Notes

- **HIGH confidence:** Lobby/room code flow, reconnection patterns, whose-turn indicator, valid move highlighting — these are universal across Lichess, Chess.com, BGA, Jackbox. Well-established conventions.
- **HIGH confidence:** Session token via sessionStorage for reconnect identity — standard Socket.io pattern.
- **MEDIUM confidence:** Specific grace period duration (60–120s recommendation) — based on common practice, but should be tuned by playtesting. Start at 90 seconds.
- **MEDIUM confidence:** Rematch flow complexity estimate — Socket.io room reuse is straightforward; the game state reset on server is domain-specific to Counter Attack's state machine.
- **LOW confidence:** Whether a forfeit button is missed in playtesting — cannot know until real users play a 90-action game. Monitor first playtest sessions closely.
