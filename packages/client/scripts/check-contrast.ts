/**
 * Phase 34 D-04/THEME-04: CI contrast-check gate.
 *
 * Verifies every TEAM_CONFIGS team's UI accent color clears the WCAG AA
 * thresholds once run through the SAME `deriveAaAccentColor()` derivation
 * (and the same threshold constants) the browser runtime uses at render
 * time (packages/client/src/hooks/useTeamColors.ts). No re-implementation
 * of the contrast math lives here — single source of truth stays in
 * useTeamColors.ts (34-02).
 *
 * The charcoal/white reference values are read out of tokens.css at
 * runtime (not hardcoded) so this gate stays correct after the 34-04
 * value tuning pass.
 *
 * Usage: pnpm check-contrast (from packages/client), or `pnpm check-contrast`
 * from repo root (delegates via the root package.json alias added in 34-01).
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { hex } from 'wcag-contrast';
import { TEAM_CONFIGS } from '@counter-attack/shared';
import {
  deriveAaAccentColor,
  AA_TEXT_MIN_RATIO,
  AA_UI_MIN_RATIO,
} from '../src/hooks/useTeamColors.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const TOKENS_CSS_PATH = join(__dirname, '..', 'src', 'styles', 'tokens.css');

/** Regex-extract a `--token-name: #hex;` custom-property value from raw CSS text. */
function extractToken(cssText: string, name: string): string {
  const match = cssText.match(new RegExp(`${name}:\\s*(#[0-9a-fA-F]{3,8})`));
  const value = match?.[1];
  if (!value) throw new Error(`Token ${name} not found in tokens.css`);
  return value;
}

function main(): void {
  const tokensCss = readFileSync(TOKENS_CSS_PATH, 'utf-8');
  const bgPage = extractToken(tokensCss, '--color-bg-page');
  const textInverse = extractToken(tokensCss, '--color-text-inverse');

  let failed = false;

  for (const teamId of Object.keys(TEAM_CONFIGS) as (keyof typeof TEAM_CONFIGS)[]) {
    const raw = TEAM_CONFIGS[teamId].palette.uiColor;
    const adjusted = deriveAaAccentColor(raw, bgPage, textInverse);

    const textRatio = hex(adjusted, bgPage);
    const uiRatio = hex(adjusted, textInverse);

    if (textRatio < AA_TEXT_MIN_RATIO || uiRatio < AA_UI_MIN_RATIO) {
      console.error(`FAIL: ${teamId} (${raw} -> ${adjusted})`);
      failed = true;
    }
  }

  if (failed) {
    process.exit(1);
  }

  console.log(
    `check-contrast: all ${Object.keys(TEAM_CONFIGS).length} teams clear AA thresholds (text >= ${AA_TEXT_MIN_RATIO}, ui >= ${AA_UI_MIN_RATIO}).`,
  );
}

main();
