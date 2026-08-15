---
status: resolved
phase: 39-fouls-cards-injuries-penalty-kicks
source: [39-07-SUMMARY.md, 39-10-SUMMARY.md, 39-12-SUMMARY.md, 39-13-SUMMARY.md, 39-17-SUMMARY.md]
started: 2026-08-15T13:28:24Z
updated: 2026-08-15T23:16:56.238Z
---

## Current Test

[all 9 gaps closed by gap-closure plans 39-18 through 39-24; verified in 39-VERIFICATION.md]

## Tests

### 1. Continue-or-restart offered after a successful tackle/steal that was also a foul

expected: When the defender's duel succeeds (turnover) AND the same duel triggers a foul (defender die of 1), the fouled manager should never see a "Continue Play" option — there is no play to continue, since the ball just changed possession via the foul. Only a restart (free kick/penalty kick) should be available.
result: resolved
reported: "if the tackle or steal succeeds but there is a foul, do not allow play to continue - proceed with free kick/penalty kick"
severity: major

### 2. Restart location uses the fouler's contact hex instead of the ball's hex

expected: The free kick/penalty restart should be placed where the ball was at the moment of the foul (the carrier/victim's hex), not where the fouling defender ended up.
result: resolved
reported: "kick location is there the ball was, not where the defender was when making the foul"
severity: major

### 3. GK dive-at-feet has no hex-selection step

expected: When the defending manager accepts the dive-at-feet prompt, they should choose which in-range hex (adjacent to the attacker/ball carrier) the goalkeeper dives to, as part of taking the action — not have the destination computed automatically with no input. The goalkeeper's piece must actually move to that chosen hex as part of resolving the dive action (not just use it to compute the duel/displacement while the GK piece stays put).
result: resolved
reported: "when keeper dives they should be choosing a hex in range next to the attacker with the ball as part of the action - to add and gk should move to that hex as part of the action."
severity: major

### 4. Goalkeeper can shot-block dive again in the same movement phase after a dive-at-feet

expected: The once-per-movement-cycle cap shared between the dive-at-feet interrupt and the shot-block GK_DIVE (documented D-09) should prevent a second dive of either kind until the next movement cycle. Observed behavior violates that cap.
result: resolved
reported: "keeper was able to attempt a save after making dive in the same movement phase"
severity: major

### 5. Penalty kick trigger is scoped to GK-dive fouls only, not all in-box fouls

expected: Any foul (tackle-sourced, steal-sourced, or GK-dive-sourced) that occurs inside the penalty box should award a penalty kick, not just fouls whose source is a GK dive-at-feet. On award: the defending goalkeeper automatically moves to the center of their own goal line (away: (36,13), home: (0,13)); every other piece inside the box is displaced outside the box using the existing anti-stacking relocation logic; the attacking team selects a kicker; the kicker and ball are placed at the penalty spot ((32,13) for away kicking / (4,13) for home kicking); standard free-kick movement rules apply except the kicker and the defending goalkeeper cannot be moved and no piece may move into the penalty box; Shoot is the only restart option (no pass options).
result: resolved
reported: "all fouls inside the box should be treated as penalty kicks, not just fouls from goalie dives. For penalty kick keeper automatically moves to the center goalline 36,13 / 0,13. all players in the box are moved outside the box using standard logic to prevent players stacking on each other. attacking team selects a kicker. kicker and ball are moved to 32,13 /4,13. standard free kick movement is allow with the following exceptions kicker and defending keeper cannot be moved and no player can move into the penalty box. Shoot is the only option on restart."
severity: major

### 6. No explicit penalty-kicker selection UX

expected: The attacking manager must explicitly select and confirm a penalty taker, matching the existing select-and-confirm pattern used for corner-kick taker and offside free-kick taker selection. If a different piece is already standing on the kick spot, it is displaced one hex back using the existing anti-stacking relocation logic.
result: resolved
reported: "cannot choose player to take penalty kick. Need to select and confirm kicker like with a corner kick or offsides kick. If different player is at kick spot move them back 1 spot using standard logic to prevent players stacking on each other."
severity: major

### 7. No tackle-from-behind rule

expected: When a tackle targets either of the two hexes directly behind the attacker (relative to attack direction), a foul should be triggered on a defender die of 1 OR 2 (a wider trigger than the standard die-of-1-only rule), and the Action Log should record it distinctly as a tackle from behind when it fires.
result: resolved
reported: "when tackling, if targeting either of the 2 spaces behind the attacker a foul is triggered on a 1 or a 2. Log tackle from behind if foul is called."
severity: major

### 8. Professional foul (DOGSO) detection uses the wrong geometry

expected: A foul counts as a professional foul (DOGSO) only when BOTH hold: (a) no defender other than the goalkeeper is horizontally closer to the goal than the attacker, AND (b) no defender other than the goalkeeper who IS closer to goal has a movement range that could reach the attacker's path toward goal. Worked example given: attacker at (21,15); a defender at (29,12) with move 4 is within range of (29,25) — wait, reachability is evaluated along the attacker's path, not a straight hex-distance to the attacker's current hex — so this defender does NOT establish DOGSO. The attacker's goal-path Y-coordinate is clamped: Y>20 is treated as 20, Y<5 is treated as 5, for these calculations.
result: resolved
reported: "dogso. No defender (besides the goalie) is horizontally closer than the attacker to the goal OR no defender who is closer to the goal (besides the goalie) movement cannot take them to the path of the attacker. i.e. attacker is on (21,15) when foul occurs. Defender at (29,12) with move 4 is within range of (29,25) so no DOGSO. Attackers position (X,Y>20) = (X,20) AND position (X,Y<5) = (X,5) for calculations."
severity: major

### 9. Restart time cost — corner kick, free kick, penalty kick should cost 1 minute

expected: Taking a corner kick, free kick, or penalty kick should each advance the game clock by 1 minute, matching the goal kick's existing +1 cost. Currently these three restarts cost 0 minutes (only the goal kick charges +1; the clock otherwise only advances on movement-cycle completion, a successful tackle/steal, or a non-first-time pass).
result: resolved
reported: "time cost. corner kick, free kick, penalty kick should all cost 1 min."
severity: minor

## Summary

total: 9
passed: 9
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

- truth: "The fouled manager is never offered Continue Play when the triggering duel was itself a success (a turnover), only a restart"
  status: failed
  reason: "User reported: if the tackle or steal succeeds but there is a foul, do not allow play to continue - proceed with free kick/penalty kick"
  severity: major
  test: 1
  root_cause: ""
  artifacts:
  - path: "packages/server/src/gameEngine.ts"
    issue: "applyMove's TACKLE_ATTEMPT success branch (~line 1226-1306) and the analogous STEAL_ATTEMPT success branch (~line 1370-1400) both route a fouled+successful duel to phase FOUL_CHOICE with a foulResume snapshot of the SUCCESSFUL_TACKLE/turnover state; applyFoulChoice (line 1526) still honors choice 'continue' unconditionally, which restores that turnover state instead of forcing a restart."
    missing:
  - "A server-side rule (and matching client UI change in FoulChoicePanel) that suppresses/rejects the 'continue' choice whenever the foul's source duel itself succeeded"
    debug_session: ""

- truth: "The free kick/penalty restart is placed at the ball's position at the moment of the foul, not the fouling defender's contact hex"
  status: failed
  reason: "User reported: kick location is there the ball was, not where the defender was when making the foul"
  severity: major
  test: 2
  root_cause: "resolveFoulChain is called with foulHex: to (the defender's move-target hex) at both TACKLE_ATTEMPT (gameEngine.ts ~line 1213) and STEAL_ATTEMPT (~line 1150) call sites, instead of the carrier/ball's hex. The GK_DIVE_AT_FEET call site (~line 1862) already does this correctly with foulHex: carrier.position — that is the pattern to match."
  artifacts:
  - path: "packages/server/src/gameEngine.ts"
    issue: "foulHex: to at the TACKLE_ATTEMPT and STEAL_ATTEMPT resolveFoulChain call sites should be the carrier's/ball's position instead"
    missing:
  - "Change foulHex to the carrier's position at both call sites; verify triggerFoulFreeKick/triggerPenaltyKick still consume it correctly"
    debug_session: ""

- truth: "Accepting a dive-at-feet prompt requires the defending manager to choose the destination hex (in range, adjacent to the ball carrier) as part of the action, and the goalkeeper's piece moves to that chosen hex as part of resolving the action"
  status: failed
  reason: "User reported: when keeper dives they should be choosing a hex in range next to the attacker with the ball as part of the action - to add and gk should move to that hex as part of the action."
  severity: major
  test: 3
  root_cause: ""
  artifacts:
  - path: "packages/server/src/gameEngine.ts"
    issue: "applyGkDiveAtFeetResponse / computeGkDiveAtFeetOffer / computeGkDiveDisplacement (Plan 39-12) compute the dive outcome and displacement automatically with no manager-chosen target hex, and never relocate the GK's own piece to a dive destination"
  - path: "packages/client/src/components/GkDiveAtFeetPromptPanel.tsx"
    issue: "Dive/Decline two-button panel has no hex-selection step"
    missing:
  - "A hex-selection interaction (likely mirroring the existing goalkeeper reposition-window pattern) before the dive duel resolves"
  - "Server-side: move the goalkeeper's piece position to the manager-chosen hex as part of applying the dive action (not just using the hex to compute duel/displacement outcomes)"
    debug_session: ""

- truth: "The dive-at-feet interrupt and the shot-block GK_DIVE share one once-per-movement-cycle cap, enforced correctly within a single movement phase"
  status: failed
  reason: "User reported: keeper was able to attempt a save after making dive in the same movement phase"
  severity: major
  test: 4
  root_cause: ""
  artifacts:
  - path: "packages/server/src/gameEngine.ts"
    issue: "gkDiveAtFeetUsedByTeam is checked at line 1960 to gate shot-block GK_DIVE (documented D-09), and reset to { home: false, away: false } at 6 sites (lines 421, 524, 2665, 5697, 6968 and one more) described as 'movement-cycle-start'. The cap logic exists but the user observed it not holding within a single movement phase — likely one of those reset sites fires more often than once per full 3-slot movement cycle."
    missing:
  - "Verify each reset site's trigger condition matches 'once per full movement cycle', not 'once per movement phase/slot'"
    debug_session: ""

- truth: "Any foul occurring inside the penalty box awards a penalty kick, with GK auto-repositioning, box clear-out, kicker selection, and shot-only restart"
  status: failed
  reason: "User reported: all fouls inside the box should be treated as penalty kicks, not just fouls from goalie dives. For penalty kick keeper automatically moves to the center goalline 36,13 / 0,13. all players in the box are moved outside the box using standard logic to prevent players stacking on each other. attacking team selects a kicker. kicker and ball are moved to 32,13 /4,13. standard free kick movement is allow with the following exceptions kicker and defending keeper cannot be moved and no player can move into the penalty box. Shoot is the only option on restart."
  severity: major
  test: 5
  root_cause: "applyFoulChoice (gameEngine.ts line 1537-1538) only routes to triggerPenaltyKick when state.foulSource === 'GK_DIVE_AT_FEET'; every other foul source routes to triggerFoulFreeKick regardless of whether foulHex falls inside the penalty box."
  artifacts:
  - path: "packages/server/src/gameEngine.ts"
    issue: "applyFoulChoice's restart routing (line 1537) needs a box-location check, not a foulSource check"
  - path: "packages/shared/src/pitch.ts"
    issue: "homePenaltyArea/awayPenaltyArea (lines 82-83, q<=5|q>=31, r 5..19) already exist and can be reused for the in-box check; PENALTY_SPOT (lines 103-106, home (4,13)/away (32,13)) already matches the user's stated kick-spot coordinates exactly — only the trigger condition and the new box-clearance/kicker-lock/shoot-only mechanics are missing, not the spot itself"
    missing:
  - "In-box foul detection generalized beyond GK_DIVE_AT_FEET source"
  - "GK auto-move-to-goal-line-center on penalty award"
  - "Box occupant clear-out reusing the existing anti-stacking relocation helper (relocateTrappedFreeKickPieces, added in Plan 39-13, or the corner-kick clear-out equivalent)"
  - "Movement-phase lock on kicker and defending GK during the penalty free-kick-style setup"
  - "No-entry constraint on the penalty box during that setup"
  - "Shoot-only restart option (suppress pass options)"
    debug_session: ""

- truth: "The attacking manager explicitly selects and confirms the penalty taker, same interaction pattern as corner-kick/offside-kick taker selection"
  status: failed
  reason: "User reported: cannot choose player to take penalty kick. Need to select and confirm kicker like with a corner kick or offsides kick. If different player is at kick spot move them back 1 spot using standard logic to prevent players stacking on each other."
  severity: major
  test: 6
  root_cause: ""
  artifacts:
  - path: "packages/server/src/gameEngine.ts"
    issue: "applyPenaltyKickTaker (line ~6635) exists but per Plan 39-08/39-11's SUMMARY this used a simplified selection flow copied from GoalKickSetupPanel's reposition-window branch, not the corner-kick/offside-kick select-and-confirm pattern"
    missing:
  - "Select-and-confirm kicker UX matching CornerKickSetupPanel's taker-selection step"
  - "Anti-stacking relocation (existing helper) when a non-selected piece already occupies the kick spot"
    debug_session: ""

- truth: "A tackle targeting either of the two hexes directly behind the attacker triggers a foul on a defender die of 1 or 2, logged distinctly as a tackle from behind"
  status: failed
  reason: "User reported: when tackling, if targeting either of the 2 spaces behind the attacker a foul is triggered on a 1 or a 2. Log tackle from behind if foul is called."
  severity: major
  test: 7
  root_cause: "Entirely new rule — grep for behind/blindSide/attackDirection concepts in gameEngine.ts found nothing related; FOUL_TRIGGER_DIE (packages/shared/src/fouls.ts line 23) is a single fixed value (1) with no directional or positional variant."
  artifacts:
  - path: "packages/shared/src/fouls.ts"
    issue: "FOUL_TRIGGER_DIE is a flat constant; needs a directional variant (die 1 OR 2) when the tackle target is one of the two hexes behind the attacker"
  - path: "packages/server/src/gameEngine.ts"
    issue: "TACKLE_ATTEMPT branch needs to compute 'behind the attacker' (relative to attack direction) and pass a wider trigger threshold into resolveFoulChain for that case"
    missing:
  - "Definition of 'the 2 spaces behind the attacker' in this hex grid's coordinate/direction system"
  - "Distinct Action Log wording for a tackle-from-behind foul"
    debug_session: ""

- truth: "Professional foul (DOGSO) is determined by horizontal proximity-to-goal and goal-path reachability, not omnidirectional teammate-coverage reachability"
  status: failed
  reason: "User reported: dogso. No defender (besides the goalie) is horizontally closer than the attacker to the goal OR no defender who is closer to the goal (besides the goalie) movement cannot take them to the path of the attacker. i.e. attacker is on (21,15) when foul occurs. Defender at (29,12) with move 4 is within range of (29,25) so no DOGSO. Attackers position (X,Y>20) = (X,20) AND position (X,Y<5) = (X,5) for calculations."
  severity: major
  test: 8
  root_cause: "isProfessionalFoul (packages/shared/src/fouls.ts line 129) currently checks whether ANY teammate (any direction, any position) could have straight-line reached foulHex with remaining pace — omnidirectional coverage, not the goal-side/goal-path definition the user wants."
  artifacts:
  - path: "packages/shared/src/fouls.ts"
    issue: "isProfessionalFoul's couldHaveCovered check (lines 133-140) needs to be replaced with the two-part horizontal-proximity + goal-path-reachability test; needs the goalkeeper explicitly excluded (currently there is no role-based exclusion, only the fouler and redCarded pieces are excluded)"
    missing:
  - "Exact hex-geometry translation of 'horizontally closer to goal' and 'the attacker's path toward goal' with the stated Y-clamping (Y>20→20, Y<5→5) — needs clarification/spec pass before implementation, the worked example alone is not fully unambiguous"
    debug_session: ""

- truth: "Corner kick, free kick, and penalty kick each cost 1 minute of game clock, matching the goal kick"
  status: failed
  reason: "User reported: time cost. corner kick, free kick, penalty kick should all cost 1 min."
  severity: minor
  test: 9
  root_cause: "None of the corner-kick, free-kick, or penalty-kick resolution functions mutate state.actionCount (verified by grep across gameEngine.ts); only applyGoalKickMoveEnd does, at actionCount: state.actionCount + 1 (line 6274)."
  artifacts:
  - path: "packages/server/src/gameEngine.ts"
    issue: "applyCornerKickFinalMove, applyFreeKickMove, applyPenaltyKickDuel (or their respective \*End functions) need a +1 actionCount charge added, matching applyGoalKickMoveEnd's pattern"
    missing:
  - "Confirm whether throw-in should also change (user did not mention it — currently 0 min, presumably stays 0)"
    debug_session: ""
