import { TEAM_CONFIGS } from '@counter-attack/shared';
import type { TeamId } from '@counter-attack/shared';
import { hex as contrastHex } from 'wcag-contrast';

/**
 * Pure — no Zustand/React dependency. Safe to call from anywhere, including
 * loops and non-component helper functions (e.g. ActionLog.tsx's
 * pieceColorOf/slotTeamColor, called from consolidateEvents/formatEvent's
 * per-event loops, where a hook call would violate Rules of Hooks).
 * Returns the fallback gray (`#888888`) when teamId is falsy or absent from
 * TEAM_CONFIGS.
 */
export function teamAccentColor(teamId: TeamId | undefined): string {
  if (!teamId) return '#888888';
  return TEAM_CONFIGS[teamId]?.palette.uiColor ?? '#888888';
}

/**
 * Thin hook wrapper — exists for call-site naming consistency with D-03 in
 * component bodies (e.g. GameBoard.tsx). Functionally identical to calling
 * teamAccentColor() directly: no store subscription, since TEAM_CONFIGS is a
 * static import, not reactive state.
 */
export function useTeamAccentColor(teamId: TeamId | undefined): string {
  return teamAccentColor(teamId);
}

/**
 * D-04/THEME-04: WCAG AA thresholds for the two real, opposed usages of a
 * team accent color in the current CSS (see 34-02-PLAN.md "Contrast policy
 * correction" for the full derivation):
 *  - Accent-as-text on the charcoal page background (`--color-bg-page`,
 *    `#121212`) — normal body text, WCAG SC 1.4.3 — 4.5:1.
 *  - White text (`--color-text-inverse`, `#ffffff`) on an accent-colored
 *    hover/CTA background — UI-component surface, WCAG SC 1.4.11 — 3:1.
 * Single source of truth shared with the 34-03 CI contrast-check script.
 */
export const AA_TEXT_MIN_RATIO = 4.5;
export const AA_UI_MIN_RATIO = 3.0;

/** Number of candidate lightness steps to scan per search pass (0..1 inclusive, ~2% increments). */
const LIGHTNESS_STEP = 0.02;
/** Amount to reduce saturation by per fallback pass, if lightness alone cannot converge. */
const SATURATION_STEP = 0.1;
/** Safety cap on fallback saturation-reduction passes. */
const MAX_SEARCH_PASSES = 20;

function hexToRgb(colorHex: string): [number, number, number] {
  const clean = colorHex.replace('#', '');
  const r = parseInt(clean.substring(0, 2), 16);
  const g = parseInt(clean.substring(2, 4), 16);
  const b = parseInt(clean.substring(4, 6), 16);
  return [r, g, b];
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];

  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  switch (max) {
    case rn:
      h = (gn - bn) / d + (gn < bn ? 6 : 0);
      break;
    case gn:
      h = (bn - rn) / d + 2;
      break;
    default:
      h = (rn - gn) / d + 4;
      break;
  }
  return [h * 60, s, l];
}

function hueToRgbChannel(p: number, q: number, t: number): number {
  let tt = t;
  if (tt < 0) tt += 1;
  if (tt > 1) tt -= 1;
  if (tt < 1 / 6) return p + (q - p) * 6 * tt;
  if (tt < 1 / 2) return q;
  if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
  return p;
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  if (s === 0) {
    const v = Math.round(l * 255);
    return [v, v, v];
  }
  const hn = h / 360;
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const r = hueToRgbChannel(p, q, hn + 1 / 3);
  const g = hueToRgbChannel(p, q, hn);
  const b = hueToRgbChannel(p, q, hn - 1 / 3);
  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

function rgbToHex(r: number, g: number, b: number): string {
  return (
    '#' +
    [r, g, b]
      .map((channel) => Math.max(0, Math.min(255, channel)).toString(16).padStart(2, '0'))
      .join('')
  );
}

function clearsBothThresholds(candidateHex: string, bgHex: string, fgHex: string): boolean {
  return (
    contrastHex(candidateHex, bgHex) >= AA_TEXT_MIN_RATIO &&
    contrastHex(candidateHex, fgHex) >= AA_UI_MIN_RATIO
  );
}

/**
 * D-04: Private lightness-search helper. Preserves hue, steps HSL lightness
 * in fixed increments searching for the value nearest the source lightness
 * that clears both AA thresholds against bgHex/fgHex. Falls back to reducing
 * saturation (hue still fixed) if lightness alone cannot converge for a given
 * hue — not expected for the current TEAM_CONFIGS palette (verified in
 * planning) but kept as a defensive fallback for future team additions.
 */
function searchAaSafeLightness(
  hue: number,
  saturation: number,
  originalLightness: number,
  bgHex: string,
  fgHex: string,
): string {
  let currentSaturation = saturation;

  for (let pass = 0; pass < MAX_SEARCH_PASSES; pass++) {
    let best: string | null = null;
    let bestDistance = Infinity;

    for (let l = 0; l <= 1.0001; l += LIGHTNESS_STEP) {
      const clampedL = Math.min(l, 1);
      const [r, g, b] = hslToRgb(hue, currentSaturation, clampedL);
      const candidateHex = rgbToHex(r, g, b);
      if (clearsBothThresholds(candidateHex, bgHex, fgHex)) {
        const distance = Math.abs(clampedL - originalLightness);
        if (distance < bestDistance) {
          bestDistance = distance;
          best = candidateHex;
        }
      }
    }

    if (best) return best;

    currentSaturation = Math.max(0, currentSaturation - SATURATION_STEP);
    if (currentSaturation <= 0 && pass > 0) break;
  }

  // Should not be reached for the current palette (whole-palette invariant
  // verified in planning for all TEAM_CONFIGS teams). Grayscale mid-lightness
  // is the safest last resort if a future team's hue truly cannot converge.
  const [r, g, b] = hslToRgb(hue, 0, 0.5);
  return rgbToHex(r, g, b);
}

/**
 * D-04/THEME-04: Adjusts a team's raw brand color into an AA-safe value —
 * only when it fails contrast (only failing colors adjust, per D-03).
 * Preserves the source hue; the result still reads as the same team color.
 * Uses `wcag-contrast`'s `hex()` for all contrast checks (never a
 * hand-rolled luminance formula, per 34-RESEARCH.md Pattern 1).
 */
export function deriveAaAccentColor(uiColor: string, bgHex: string, fgHex: string): string {
  if (clearsBothThresholds(uiColor, bgHex, fgHex)) return uiColor;

  const [r, g, b] = hexToRgb(uiColor);
  const [hue, saturation, lightness] = rgbToHsl(r, g, b);
  return searchAaSafeLightness(hue, saturation, lightness, bgHex, fgHex);
}

/**
 * D-04/THEME-04: Hook wrapper — returns the AA-safe derived accent for the
 * given team, fed into GameBoard.tsx's --team-accent/--home-accent/--away-accent
 * CSS custom properties. `#121212` is `--color-bg-page` and `#ffffff` is
 * `--color-text-inverse` (both set/confirmed by plan 34-04).
 */
export function useTeamAccentColorAA(teamId: TeamId | undefined): string {
  const raw = teamAccentColor(teamId);
  return deriveAaAccentColor(raw, '#121212', '#ffffff');
}
