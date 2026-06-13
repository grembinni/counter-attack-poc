---
status: complete
phase: 15-team-identity
source: [15-VERIFICATION.md]
started: 2026-06-13T14:30:00Z
updated: 2026-06-13T15:00:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Badge PNG visual content

expected: Each badge image (cosmos/xolos/city/crew) depicts its design brief — Cosmos = galaxy, Xolos = coyote, City = STL arch, Crew = Columbus-style.
result: pass

### 2. Cosmos stripe visual width

expected: The white horizontal stripe on the Cosmos outfield jersey token is visually ~3× wider than the old stripe at game scale (~12px tokens).
result: pass

### 3. Crew shoulder restriction

expected: Diagonal stripes on Crew tokens are visibly restricted to the top ~30% of the token at 12px game scale (not extending across the full token).
result: pass

### 4. Scoreboard badge rendering in browser

expected: During a live session, Vite content-hashed PNG URLs resolve correctly and team badge images appear in the scoreboard top band (not broken image icons).
result: pass

## Summary

total: 4
passed: 4
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps
