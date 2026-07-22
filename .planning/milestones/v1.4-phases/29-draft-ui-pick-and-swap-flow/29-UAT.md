---
status: complete
phase: 29-draft-ui-pick-and-swap-flow
source: [29-VERIFICATION.md]
started: 2026-07-22T00:23:58.042Z
updated: 2026-07-21T00:00:00.000Z
---

## Current Test

[testing complete]

## Tests

### 1. Live two-browser lineup-slot <-> lineup-slot swap confirmation

expected: The dragged card takes the destination slot; the previously-occupying card takes the dragged card's now-vacated slot. Repeat for both an outfield<->outfield swap and an attempted GK<->outfield swap (the latter should be rejected with an error, not silently applied).
result: pass

## Summary

total: 1
passed: 1
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps
