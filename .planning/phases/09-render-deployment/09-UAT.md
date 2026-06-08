---
status: complete
phase: 09-render-deployment
source: [09-01-SUMMARY.md, 09-02-SUMMARY.md]
started: 2026-06-08T00:00:00Z
updated: 2026-06-08T00:00:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Render Build Succeeds (Cold Start)

expected: Render builds latest commit without error; dashboard shows green "Deploy successful" and service status is Live.
result: pass

### 2. Health Check (Live)

expected: |
curl https://<service>.onrender.com/healthz returns the plain text 'ok' with HTTP 200.
(Or opening that URL in a browser shows just the word "ok".)
result: pass

### 3. SPA Loads Over HTTPS

expected: |
Opening the Render service URL in a browser loads the Counter Attack lobby screen
over HTTPS. No mixed-content warnings in the browser console. No 404 or blank page.
result: pass

### 4. No Localhost in Client Bundle

expected: |
Running: strings packages/client/dist/assets/\*.js | grep localhost
(or checking browser Network tab for any requests to localhost)
returns nothing — no hardcoded localhost URLs in the production bundle.
result: pass

### 5. Two-Player Room Session

expected: |
Open the Render URL in two separate browser tabs (or two different browsers/devices).
Tab 1: click Create Room — receives a 4-6 char room code.
Tab 2: enter that code and click Join — both tabs show the game board simultaneously,
connected to the live Render service (not localhost).
result: pass

### 6. In-Match Smoke Test

expected: |
From the two-player session above: complete kick-off setup → kick-off pass from centre hex
→ one Movement Phase (move 1 attacker piece) → one pass → one shot attempt.
Both boards update in sync after each action. No server errors appear in the Render logs.
result: pass

### 7. GitHub Actions CI Green

expected: |
On GitHub, the commits pushed today show a green CI check (Actions tab → CI workflow).
All steps pass: install → typecheck → test → build.
(The 2 pre-existing undo test failures in game.integration.test.ts are known and acceptable.)
result: pass

## Summary

total: 7
passed: 7
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps
