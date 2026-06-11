# Roadmap — Counter Attack Web

## ✅ v1.0 MVP — Complete (2026-06-11)

Two players can open a browser, share a room code, and play a complete match of Counter Attack in real time. All 13 phases shipped across 51 plans (330 files, 77k+ lines), 2026-05-27 → 2026-06-11.

Full archive: [.planning/milestones/v1.0-ROADMAP.md](milestones/v1.0-ROADMAP.md) · [Requirements](milestones/v1.0-REQUIREMENTS.md) · [Milestones](milestones/MILESTONES.md)

<details>
<summary>v1.0 phases (13 phases, 51 plans)</summary>

| Phase | Name                                                  | Plans | Completed  |
| ----- | ----------------------------------------------------- | ----- | ---------- |
| 1     | Monorepo Scaffold + Shared Types                      | 3/3   | 2026-05-28 |
| 2     | Move Validator + Unit Tests                           | 4/4   | 2026-05-29 |
| 3     | Server Room Manager + Socket.io Scaffold              | 3/3   | 2026-05-29 |
| 4     | Game Engine + Phase FSM                               | 3/3   | 2026-05-30 |
| 5     | Dice Resolver + All Resolution Branches               | 4/4   | 2026-05-30 |
| 6     | React Hex Grid Renderer                               | 3/3   | 2026-05-31 |
| 7     | Client-Server Integration                             | 4/4   | 2026-06-03 |
| 7.1   | UI Cleanup (INSERTED)                                 | 3/3   | 2026-06-04 |
| 8     | Match Lifecycle + Post-Game Replay                    | 8/8   | 2026-06-05 |
| 8.1   | Cleanup — Player Stats, Movement, Tackling (INSERTED) | 3/3   | 2026-06-05 |
| 8.2   | Passing Cleanup (INSERTED)                            | 6/6   | 2026-06-07 |
| 9     | Render Deployment                                     | 2/2   | 2026-06-08 |
| 10    | Remaining Action Flows + Tech Debt                    | 5/5   | 2026-06-11 |

</details>

---

## Next Milestone

_Not yet defined. Run `/gsd-new-milestone` to define v1.1 goals, requirements, and roadmap._

Known v1.1 candidates:

- **MOVE-06** — free 6-hex move after action in final third (scaffolded in engine, handler missing)
- **PASS-02** — mid-pass player movement during First-time Pass flight (TODO at `gameEngine.ts:1087`)
- Fouls, bookings, corner kicks, throw-ins — v2 rulebook items deferred at v1.0 close
