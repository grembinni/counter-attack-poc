/**
 * D-06: Single shared color-state logic for every confirm-and-advance CTA
 * button in the ActionPanel render slot, replacing two divergent
 * implementations — `ActionPanel.tsx`'s private `ctaButtonClass` and
 * `FreeKickSetupPanel.tsx`'s private `endTurnColorClass`.
 *
 * Pure — no React/Zustand dependency, no CSS-module import (each caller owns
 * its own CSS module and passes its own class-name strings in). This mirrors
 * `useTeamColors.ts`'s "pure function primary export, no React/Zustand
 * dependency" extraction pattern (35-PATTERNS.md "Shared Patterns").
 *
 * The `?? ''` fallbacks exist because CSS-module typings surface class names
 * as `string | undefined` (a module may not define the class at all).
 *
 * `enabled = false` deliberately yields no class (`''`) — this reproduces
 * `FreeKickSetupPanel.tsx`'s prior `constraintsMet ? … : ''` branch, whose
 * purpose is that a constraint-blocked (disabled) button shows neither
 * ready-green nor pending-orange.
 */
export function ctaColorClass(
  eligibleRemaining: number,
  classes: { ready: string | undefined; pending: string | undefined },
  enabled = true,
): string {
  if (!enabled) return '';
  return eligibleRemaining <= 0 ? (classes.ready ?? '') : (classes.pending ?? '');
}
