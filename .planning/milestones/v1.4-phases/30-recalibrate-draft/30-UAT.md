---
status: complete
phase: 30-recalibrate-draft
source:
  [
    30-01-SUMMARY.md,
    30-02-SUMMARY.md,
    30-03-SUMMARY.md,
    30-04-SUMMARY.md,
    30-05-SUMMARY.md,
    30-06-SUMMARY.md,
  ]
started: 2026-07-22T13:29:02Z
updated: 2026-07-22T13:33:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Legends/Icons Pool Selection in Game Settings

expected: In Game Settings, the Legends and Icons pool checkboxes are enabled and clickable (no "(coming soon)" label). Checking them includes those pools in the draft when the game is confirmed/started.
result: pass

### 2. Round 1 — GK-Only Round

expected: The draft's first round deals packs of 4 goalkeeper-only cards. The progress label reads "GK Round · Pick 1 of 2". The round completes after 2 picks (draft, opponent draft/swap, draft).
result: pass

### 3. Rounds 2–6 — Tiered Rounds

expected: Rounds 2 through 6 deal 4-card packs with no goalkeeper cards. The progress label reads "Round N of 6 · Pick X of 3". Each of these rounds takes 3 picks per side before advancing.
result: pass

### 4. Tier-Colored Card Borders

expected: Drafted cards show a colored border by tier — chase = purple, rare = red, uncommon = green, common = white. These colors are visible on the draft pack carousel, the bench carousel, and the starting-11 lineup slots once a card is placed there. There is no 5th "keeper" tier color.
result: pass

### 5. No Keeper-Safety Banner / No Forced Keeper Pick

expected: At no point during or after the draft does a "keeper safety" banner appear, and no card is auto-selected/forced onto a side. Goalkeeper selection only happens naturally during round 1.
result: pass

### 6. Full Draft Completion — 17 Cards, Match Start

expected: After all 6 rounds finish, each side has drafted 17 total cards. The lineup assignment screen opens, a starting 11 can be assigned, and the match starts successfully with the drafted roster.
result: pass

### 7. Pre-Formation Draft Click Doesn't Crash

expected: If a draft-pick action is attempted before a formation/uniform has been confirmed, the app does not crash — it either blocks the action or shows a normal in-game message, and the server/game session stays usable.
result: pass

## Summary

total: 7
passed: 7
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

[none yet]
