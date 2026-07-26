import { describe, it, expect } from 'vitest';
import { hex } from 'wcag-contrast';
import { TEAM_CONFIGS } from '@counter-attack/shared';
import type { TeamId } from '@counter-attack/shared';
import {
  teamAccentColor,
  useTeamAccentColor,
  deriveAaAccentColor,
  useTeamAccentColorAA,
  AA_TEXT_MIN_RATIO,
  AA_UI_MIN_RATIO,
} from './useTeamColors.js';

// Pick a concrete valid team id by reading an actual key of TEAM_CONFIGS.
const VALID_TEAM_ID = Object.keys(TEAM_CONFIGS)[0] as TeamId;

// CR-01: reference background is --color-bg-surface-alt (#262626) — the lightest real
// background the accent renders as text on (GameBoard scoreboard/overlay, ReplayPanel) —
// not --color-bg-page, which would let borderline colors pass here while still failing
// against those lighter surfaces. Inverse text white (--color-text-inverse) unchanged.
const CHARCOAL_BG = '#262626';
const WHITE_FG = '#ffffff';

describe('teamAccentColor', () => {
  it('returns TEAM_CONFIGS[teamId].palette.uiColor for a valid teamId', () => {
    expect(teamAccentColor(VALID_TEAM_ID)).toBe(TEAM_CONFIGS[VALID_TEAM_ID].palette.uiColor);
  });

  it("returns '#888888' for undefined", () => {
    expect(teamAccentColor(undefined)).toBe('#888888');
  });

  it("returns '#888888' for an unknown teamId (TEAM_CONFIGS miss fallback)", () => {
    expect(teamAccentColor('not-a-real-team' as TeamId)).toBe('#888888');
  });
});

describe('useTeamAccentColor', () => {
  it('returns the identical value to teamAccentColor for the same input (pass-through, no store subscription)', () => {
    expect(useTeamAccentColor(VALID_TEAM_ID)).toBe(teamAccentColor(VALID_TEAM_ID));
    expect(useTeamAccentColor(undefined)).toBe(teamAccentColor(undefined));
  });
});

// Minimal hex -> HSL hue helper for the hue-preservation assertion (Test E).
// Duplicated intentionally from the (private) implementation helper: the test
// must verify the *observable* hue of the output color, not call into an
// unexported implementation detail.
function hexToHue(colorHex: string): number {
  const h = colorHex.replace('#', '');
  const r = parseInt(h.substring(0, 2), 16) / 255;
  const g = parseInt(h.substring(2, 4), 16) / 255;
  const b = parseInt(h.substring(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max === min) return 0;
  const d = max - min;
  let hue: number;
  switch (max) {
    case r:
      hue = (g - b) / d + (g < b ? 6 : 0);
      break;
    case g:
      hue = (b - r) / d + 2;
      break;
    default:
      hue = (r - g) / d + 4;
      break;
  }
  return hue * 60;
}

describe('deriveAaAccentColor', () => {
  it('D-03: returns a color unchanged when it already clears both thresholds', () => {
    // xolos ColorSchemeId orange — already passes 4.5:1 vs #262626 (4.74) and
    // 3:1 vs #ffffff (3.19) (CR-01: reference bg corrected from #121212).
    const passthroughColor = '#F75E25';
    expect(hex(passthroughColor, CHARCOAL_BG)).toBeGreaterThanOrEqual(AA_TEXT_MIN_RATIO);
    expect(hex(passthroughColor, WHITE_FG)).toBeGreaterThanOrEqual(AA_UI_MIN_RATIO);

    const result = deriveAaAccentColor(passthroughColor, CHARCOAL_BG, WHITE_FG);

    expect(result).toBe(passthroughColor);
  });

  it('adjusts a light color (Crew yellow) that fails the charcoal-text direction', () => {
    const result = deriveAaAccentColor('#FEE500', CHARCOAL_BG, WHITE_FG);

    expect(result).not.toBe('#FEE500');
    expect(hex(result, CHARCOAL_BG)).toBeGreaterThanOrEqual(AA_TEXT_MIN_RATIO);
    expect(hex(result, WHITE_FG)).toBeGreaterThanOrEqual(AA_UI_MIN_RATIO);
  });

  it('adjusts a dark color (USA navy) that fails the charcoal-text direction', () => {
    const darkNavy = '#1A2849';
    expect(hex(darkNavy, CHARCOAL_BG)).toBeLessThan(AA_TEXT_MIN_RATIO);

    const result = deriveAaAccentColor(darkNavy, CHARCOAL_BG, WHITE_FG);

    expect(result).not.toBe(darkNavy);
    expect(hex(result, CHARCOAL_BG)).toBeGreaterThanOrEqual(AA_TEXT_MIN_RATIO);
    expect(hex(result, WHITE_FG)).toBeGreaterThanOrEqual(AA_UI_MIN_RATIO);
  });

  it('clears both AA thresholds for every team in TEAM_CONFIGS (whole-palette invariant)', () => {
    for (const teamId of Object.keys(TEAM_CONFIGS) as TeamId[]) {
      const uiColor = TEAM_CONFIGS[teamId].palette.uiColor;
      const result = deriveAaAccentColor(uiColor, CHARCOAL_BG, WHITE_FG);

      expect(hex(result, CHARCOAL_BG)).toBeGreaterThanOrEqual(AA_TEXT_MIN_RATIO);
      expect(hex(result, WHITE_FG)).toBeGreaterThanOrEqual(AA_UI_MIN_RATIO);
    }
  });

  it('preserves the source hue on an adjusted color (still reads as the same team color)', () => {
    const source = '#FEE500';
    const result = deriveAaAccentColor(source, CHARCOAL_BG, WHITE_FG);

    const sourceHue = hexToHue(source);
    const resultHue = hexToHue(result);
    const delta = Math.min(Math.abs(sourceHue - resultHue), 360 - Math.abs(sourceHue - resultHue));

    expect(delta).toBeLessThanOrEqual(8);
  });

  it('exports the AA threshold constants', () => {
    expect(AA_TEXT_MIN_RATIO).toBe(4.5);
    expect(AA_UI_MIN_RATIO).toBe(3.0);
  });
});

describe('useTeamAccentColorAA', () => {
  it('wraps deriveAaAccentColor around the raw teamAccentColor value', () => {
    expect(useTeamAccentColorAA(VALID_TEAM_ID)).toBe(
      deriveAaAccentColor(teamAccentColor(VALID_TEAM_ID), CHARCOAL_BG, WHITE_FG),
    );
  });

  it('handles the #888888 fallback without throwing', () => {
    expect(() => useTeamAccentColorAA(undefined)).not.toThrow();
    expect(useTeamAccentColorAA(undefined)).toBe(
      deriveAaAccentColor('#888888', CHARCOAL_BG, WHITE_FG),
    );
  });
});
