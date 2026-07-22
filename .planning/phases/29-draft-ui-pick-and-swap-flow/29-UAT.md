---
status: testing
phase: 29-draft-ui-pick-and-swap-flow
source: [29-VERIFICATION.md]
started: 2026-07-22T00:23:58.042Z
updated: 2026-07-22T00:23:58.042Z
---

## Current Test

number: 1
name: Live two-browser lineup-slot <-> lineup-slot swap confirmation
expected: |
The dragged card takes the destination slot; the previously-occupying card takes the dragged
card's now-vacated slot. Repeat for both an outfield<->outfield swap and an attempted
GK<->outfield swap (the latter should be rejected with an error, not silently applied).
awaiting: user response

## Tests

### 1. Live two-browser lineup-slot <-> lineup-slot swap confirmation

expected: The dragged card takes the destination slot; the previously-occupying card takes the dragged card's now-vacated slot. Repeat for both an outfield<->outfield swap and an attempted GK<->outfield swap (the latter should be rejected with an error, not silently applied).
result: [pending]

## Summary

total: 1
passed: 0
issues: 0
pending: 1
skipped: 0
blocked: 0

## Gaps
