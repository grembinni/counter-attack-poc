---
slug: player-card-flat-layout
title: Reformat PlayerStatsPanel to flat card layout
status: in-progress
---

## Goal

Reformat PlayerStatsPanel to a flat horizontal card matching the reference design:

- Large team badge on the far left
- Right side: player name + nation flag + position on one header line
- Stats in 2 rows (5+4) using abbreviated labels (PAC/SHO/TAC etc.) with tooltip titles
- Color-coded stat value badges (green ≥7 / orange 4-6 / red ≤3)
- Nation flag icons for all 47 unique nationalities in PLAYER_POOL

## Tasks

- [x] Download SVG flag icons from flagcdn.com → public/flags/{code}.svg (45 unique files)
- [ ] Create NationFlag.tsx component (nationality string → ISO code → /flags/{code}.svg)
- [ ] Rewrite PlayerStatsPanel.tsx (flat layout, stat chips, TeamBadge large left)
- [ ] Rewrite PlayerStatsPanel.module.css
- [ ] Update PlayerStatsPanel.test.tsx (abbrev labels checked via title attr)

## Layout sketch

```
┌─────────────────────────────────────────────────────┐
│ [TeamBadge] │ Kieran O'Donnell  [🇮🇪] [CDM]        │
│    56px     │ [PAC:●5][SHO:●2][TAC:●6][DRI:●3][AER:●6] │
│             │ [SAV:●3][HND:●4][RES:●6][PAS:●5]     │
└─────────────────────────────────────────────────────┘
```

## ISO code map (deduplication: US=United States, Korea=South Korea)

Unique flag files needed: 45
Abbreviations: PAC SHO TAC DRI SAV HND RES AER PAS
