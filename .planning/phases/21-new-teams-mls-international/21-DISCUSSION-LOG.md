# Phase 21: New Teams (MLS + International) - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-04
**Phase:** 21-new-teams-mls-international
**Areas discussed:** Uniform styles per team, Team card ordering within tabs

---

## Uniform Styles Per Team

| Option                                   | Description                                                                                       | Selected |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------- | -------- |
| Claude assigns one unique style per team | Claude picks culturally/visually fitting style from 10 remaining; each team gets a distinct style | ✓        |
| All 10 teams get 'solid'                 | Simplest; revisit individual styles later                                                         |          |
| I'll specify per team                    | User manually specifies each team's style                                                         |          |

**User's choice:** Claude assigns one unique style per team

**Proposed mapping reviewed by user:**

| Team      | Style      | Rationale                                         |
| --------- | ---------- | ------------------------------------------------- |
| Miami     | fade       | Modern coastal aesthetic; pink-to-black gradient  |
| LA (LAFC) | checker    | Black-and-gold checker; bold geometric            |
| Nashville | corners    | Angular corner triangles; geometric aesthetic     |
| Seattle   | v-stripe   | Green/blue V-stripes; Pacific Northwest feel      |
| Canada    | cosmos     | Horizontal band; mirrors Canada's red-stripe kit  |
| England   | solid      | Traditional solid white; unfussy English kit      |
| France    | quarters   | Quadrant split; tricolore division                |
| Mexico    | tree-rings | Concentric circles; rich multi-tone green palette |
| Spain     | plus       | Cross/plus in red and gold; España on-brand       |
| USA       | polka-dots | Stars-as-dots inspiration; red/white/blue         |

**Notes:** User initially said "switch portland and mexico" but Portland is not a Phase 21 team (MLS teams are Miami, LA, Nashville, Seattle plus existing City/Crew). When asked to clarify, user confirmed the original mapping was fine: "nevermind, they all look good as is." Mapping locked as proposed.

---

## Team Card Ordering Within Tabs

| Option                | Description                                                                                                | Selected |
| --------------------- | ---------------------------------------------------------------------------------------------------------- | -------- |
| Yes — looks good      | MLS: City, Crew, LA, Miami, Nashville, Seattle. International: Canada, England, France, Mexico, Spain, USA | ✓        |
| Use a different order | User specifies custom ordering                                                                             |          |

**User's choice:** Accept research-implied order (originals first in MLS tab, alphabetical thereafter; International alphabetical)

**Notes:** No changes requested.

---

## Claude's Discretion

- Exact TypeScript layout of the 10 new TEAM_CONFIGS entries (follow the `city` entry pattern)
- Whether MLS_TEAMS and INTL_TEAMS are module-level constants or inline in JSX
- File order for the 10 new Vite badge imports
- CSS transition timing (UI-SPEC has exact values — follow them)

## Deferred Ideas

- Tab badge indicator ("MLS (1 taken)") for the inactive tab when a team is taken — evaluate after playtesting Phase 21
- CSV consolidation — deferred to Phase 24+; stable IDs make this safe
- Animated uniform patterns — out of scope for v1.3
- Uniform style selection UI for new teams — Phase 22
