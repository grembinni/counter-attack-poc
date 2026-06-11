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

_Next milestone: not yet defined. Run `/gsd-new-milestone` to start v1.1._
