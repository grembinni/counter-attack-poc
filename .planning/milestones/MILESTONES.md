# Milestones — Counter Attack Web

## v1.0 MVP — Complete (2026-06-11)

**Tagline:** Two friends can open a browser, share a room code, and play a complete match of Counter Attack against each other in real time.

**Scope:** 13 phases, 51 plans, 330 files changed, 77k+ lines added. 2026-05-27 → 2026-06-11 (15 days).

**Requirements:** 65/66 v1 requirements satisfied. Known deferred: MOVE-06 (free 6-hex move — scaffolded in `gameEngine.ts:517`, handler not implemented; deferred to v1.1).

**Known deferred items at close:** 1 (see STATE.md Deferred Items — `undo-kickoff-ball-bugs` quick task with no formal artifact directory; work captured in git log only).

### Key Accomplishments

1. **Complete playable Counter Attack match** — All core rules implemented end-to-end: 4-5-2 movement sequence, four pass types, heading duels, shot/save duels with GK_DIVING (3-hex dive), SNAP_DEFLECT path-deflection, GK restart (kick/throw/move), Loose Ball, Zone of Influence. Two halves of 45 actions + added time. 10/10 human UAT tests passed.

2. **Deployed to Render** — Single web service serving built React SPA + Socket.io from the same Express process and port. `render.yaml` Blueprint IaC; GitHub Actions CI gate (typecheck → test → build on push). Same-origin WebSocket; no polling fallback.

3. **Full shot resolution pipeline** — Shot declared with two-step Shoot UI (click Shoot → click goal hex); GK_DIVING phase with piece reposition; automatic 1 handling die; SNAP_DEFLECT path-deflection for snapshots; header-at-goal auto-resolved through contestant duel then shot duel.

4. **Server-authoritative pnpm monorepo** — Three packages (`shared`, `server`, `client`) with shared TypeScript types. All dice via `crypto.randomInt`; full state snapshot broadcast after every action; `isProcessing` mutex preventing race conditions. 222+ server integration tests.

5. **SVG hex-grid renderer** — 37×26 flat-top axial grid rendered in React SVG; pitch markings, goal nets, ZoI highlighting, possession dot, valid-move highlights (green/amber). Per-slice Zustand selectors; honeycomb-grid 4.x for hex math.

6. **Post-game replay** — After full time, server streams event log at 1 frame/second; both clients render each state in sequence automatically.

### Archives

- [Roadmap archive](v1.0-ROADMAP.md) — full phase details and plan checklists
- [Requirements archive](v1.0-REQUIREMENTS.md) — all 66 requirements with final status and deferred notes

---

---

## v1.1 UX Tuning & Bug Cleanup — Complete (2026-06-12)

**Tagline:** Visual overhaul with persistent top-band layout, stripe token design, unified hex highlight system, MM:00 clock, kick off enforcement, and 5 rule-correctness bug fixes.

**Scope:** 4 phases, 14 plans, 108 files changed, +16,372 / -995 lines. 2026-06-11 → 2026-06-12 (2 days).

**Requirements:** 13/18 v1.1 requirements fully validated. 3 wired (admin gap — MATCH-07, REPLAY-04, REPLAY-05). 1 spec conflict (MATCH-06 — symmetric formation correct, req text ambiguous). 1 deferred (REPLAY-06 — live-session ball tracking bugs; severity: minor).

**Known deferred items at close:** 6 (see STATE.md Deferred Items — Phase 13 browser UAT (3 items), 5 quick tasks with missing/unknown status; all work committed).

### Key Accomplishments

1. **Rule correctness (Phase 11)** — Fixed 5 gameplay sequencing bugs: header accuracy gate (RULE-01), duel-target ordering (RULE-02), snapshot path cleanup (RULE-03), deflection pace suppression (RULE-04), post-deflect both-teams Movement Phase entry (RULE-05). 35 new server + client tests.

2. **Team token visual redesign (Phase 12)** — Home tokens: vertical black stripe; away tokens: two horizontal dark stripes — distinguishable without labels. Stripe renders identically across on-pitch overlays, stats panel, and replay. Unified hex highlight system: 5 distinct tint types (risk/goal/safe/kickoff/shot-path) with priority resolution. 22 new tests.

3. **Persistent top-band layout + MM:00 clock (Phase 13)** — 80px CSS-Grid top band (scoreboard + player card + action section + log) always visible in all game phases. MM:00 event-driven clock; no PLAY_PHASES gating. HALF_TIME/FULL_TIME as position:absolute pitch overlays; routing simplified; 6 dead component files deleted. 15 new tests (Wave 0 scaffold pattern).

4. **Kick off enforcement + replay overhaul (Phase 14)** — Server-authoritative symmetric DEF/MID formation; KICKOFF_STANDARD_PASS_ONLY guard rejects non-standard passes from kick off hex. Universal `ballAfter` field on 13 ActionEvent union members (TypeScript-enforced). 500ms replay cadence (was 1000ms). Simultaneous K step-frames for movement replay. 5 new tests.

### Archives

- [Roadmap archive](v1.1-ROADMAP.md) — full phase details and plan checklists
- [Requirements archive](v1.1-REQUIREMENTS.md) — all 18 requirements with final status
- [Milestone audit](v1.1-MILESTONE-AUDIT.md) — cross-phase integration check, gap analysis

---

_Next milestone: not yet defined. Run `/gsd-new-milestone` to start v1.2._
