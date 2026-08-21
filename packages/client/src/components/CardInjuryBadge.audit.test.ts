/**
 * CardInjuryBadge.audit.test.ts — Phase 41 plan 41-06, Task 1.
 *
 * This spec is the executable form of the `41-UI-SPEC.md` "Post-implementation
 * verification" gate for ICON-01: "A grep for `redCarded === true ?` across
 * `packages/client/src/components/*.tsx` (excluding `CardInjuryBadge.tsx` itself)
 * MUST return zero matches once this phase is complete." It is intentionally a
 * source scan rather than a behavioural test because the property being protected
 * is "nothing else implements this", which no render-based test can express.
 * Phase 42 (which consumes `CardInjuryBadge` for its bench red-card marker) MUST
 * extend rather than delete this spec when it adds new components under this
 * directory.
 *
 * Deliberately a `.ts` file, not `.tsx`: every scan below globs `.tsx` siblings,
 * so this audit file excludes itself by construction and its own needle literals
 * (including this very doc comment) can never satisfy or break their own
 * assertions.
 */
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const COMPONENTS_DIR = dirname(fileURLToPath(import.meta.url));

const ALL_TSX = readdirSync(COMPONENTS_DIR).filter((f) => f.endsWith('.tsx'));
const SOURCE_TSX = ALL_TSX.filter((f) => !f.endsWith('.test.tsx'));

/** Reads a sibling file, normalizing whitespace so a Prettier line-wrap of a
 * ternary can never dodge (or falsely satisfy) a substring/regex assertion. */
function read(file: string): string {
  return readFileSync(join(COMPONENTS_DIR, file), 'utf8').replace(/\s+/g, ' ');
}

/** Like `read`, but also strips block comments BEFORE matching, so prose
 * mentioning a deleted class name can never fail (or falsely satisfy) a
 * selector assertion against a stylesheet. */
function readCss(file: string): string {
  return readFileSync(join(COMPONENTS_DIR, file), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\s+/g, ' ');
}

/** Like `readCss`, but for TS/TSX source: strips BOTH block comments and line
 * comments BEFORE matching (WR-02 fix). Used only by the "derivation exists
 * exactly once" self-check below — every other assertion in this file
 * deliberately keeps reading comments-and-all via `read()`/`readCss()`,
 * because those checks are validating doc-comment prose itself (e.g. the
 * allowlist test below expects CardInjuryBadge.tsx's module header comment to
 * be the source of its one allowed `redCarded === true ?` occurrence). The
 * self-check needs the opposite: it must exercise the real `cardColorFor`
 * code path, not incidental prose describing it. */
function readSourceOnly(file: string): string {
  return readFileSync(join(COMPONENTS_DIR, file), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '')
    .replace(/\s+/g, ' ');
}

const SURFACES = [
  'PieceOverlay.tsx',
  'PlayerStatsPanel.tsx',
  'LineupAssignmentScreen.tsx',
  'DraftPackCarousel.tsx',
];

/**
 * Explicit, documented allowlist for the bare substring `redCarded === true ?`.
 * ONLY two files may contain it:
 *   - `CardInjuryBadge.tsx` — the one legitimate glyph-colour derivation (as a
 *     ternary appears in this file's own header doc comment, describing the
 *     pattern that must never be re-introduced elsewhere).
 *   - `DraftPackCarousel.tsx` — a PRE-EXISTING `redCarded === true ? ('RED CARD'
 *     text) : ('OUT' text)` AVAILABILITY ternary (Phase 40 SUB-07/D-13). This
 *     selects which text badge to show a bench card, not a glyph colour — a
 *     different question, deliberately untouched by Phase 41.
 * Do NOT silently widen this list — any new match names a real ICON-01
 * regression.
 */
const REDCARDED_TERNARY_ALLOWLIST = ['CardInjuryBadge.tsx', 'DraftPackCarousel.tsx'];

describe('ICON-01: the card-colour derivation exists in exactly one place', () => {
  const derivationRegex = /redCarded\s*===\s*true\s*\?\s*['"]red['"]/;

  it('no source file other than CardInjuryBadge.tsx contains the red-colour derivation ternary', () => {
    const offenders: string[] = [];
    for (const file of SOURCE_TSX) {
      if (file === 'CardInjuryBadge.tsx') continue;
      if (derivationRegex.test(read(file))) offenders.push(file);
    }
    expect(
      offenders,
      `Files containing a duplicate red-colour derivation: ${offenders.join(', ')}`,
    ).toEqual([]);
  });

  it('CardInjuryBadge.tsx contains the derivation exactly once (guards against a second copy sprouting inside it)', () => {
    // WR-02 fix: `cardColorFor`'s real implementation is an `if`-statement
    // (`if (piece.redCarded === true) return 'red';`), not the ternary
    // `derivationRegex` above is written to detect — that ternary shape only
    // ever matched this file's own doc-comment prose describing the pattern
    // consumers must not re-introduce. Matching the actual implementation
    // shape, on comment-stripped source, exercises the real code path
    // instead of incidental prose.
    const implementationRegex = /if\s*\(\s*piece\.redCarded\s*===\s*true\s*\)\s*return\s*['"]red['"]/;
    const content = readSourceOnly('CardInjuryBadge.tsx');
    const matches = content.match(new RegExp(implementationRegex.source, 'g')) ?? [];
    expect(matches.length).toBe(1);
  });

  it('the bare substring "redCarded === true ?" appears only in the documented allowlist', () => {
    const offenders: string[] = [];
    for (const file of SOURCE_TSX) {
      const occurrences = read(file).split('redCarded === true ?').length - 1;
      if (occurrences > 0 && !REDCARDED_TERNARY_ALLOWLIST.includes(file)) {
        offenders.push(file);
      }
    }
    expect(
      offenders,
      `Files containing "redCarded === true ?" outside the allowlist: ${offenders.join(', ')}`,
    ).toEqual([]);
  });
});

describe('ICON-01: the glyph markup exists in exactly one place', () => {
  it('exactly one source file contains data-testid="piece-card-badge", and it is CardInjuryBadge.tsx', () => {
    const owners = SOURCE_TSX.filter((file) =>
      read(file).includes('data-testid="piece-card-badge"'),
    );
    expect(owners).toEqual(['CardInjuryBadge.tsx']);
  });

  it('exactly one source file contains data-testid="piece-injury-badge", and it is CardInjuryBadge.tsx', () => {
    const owners = SOURCE_TSX.filter((file) =>
      read(file).includes('data-testid="piece-injury-badge"'),
    );
    expect(owners).toEqual(['CardInjuryBadge.tsx']);
  });
});

describe('ICON-01/ICON-02: all four surfaces consume the shared module', () => {
  it('every surface imports from ./CardInjuryBadge.js', () => {
    const offenders: string[] = [];
    for (const file of SURFACES) {
      if (!read(file).includes("from './CardInjuryBadge.js'")) offenders.push(file);
    }
    expect(offenders, `Surfaces missing the shared import: ${offenders.join(', ')}`).toEqual([]);
  });

  it('no source file other than CardInjuryBadge.tsx declares cardColorFor or cardColorForBenchEntry', () => {
    const offenders: string[] = [];
    for (const file of SOURCE_TSX) {
      if (file === 'CardInjuryBadge.tsx') continue;
      const content = read(file);
      if (
        /function cardColorFor\b/.test(content) ||
        /function cardColorForBenchEntry\b/.test(content)
      ) {
        offenders.push(file);
      }
    }
    expect(
      offenders,
      `Files re-declaring the derivation function: ${offenders.join(', ')}`,
    ).toEqual([]);
  });
});

describe('D-01: the removed text-chip treatment leaves no residue', () => {
  const RESIDUE_NEEDLES = [
    'stats-card-chip',
    'stats-injury-chip',
    'cardColor.toUpperCase()',
    "'INJ'",
    'INJ ×2',
    'INJ x2',
  ];

  it('no .tsx file (source or test) contains any removed text-chip residue literal', () => {
    const offenders: string[] = [];
    for (const file of ALL_TSX) {
      const content = read(file);
      for (const needle of RESIDUE_NEEDLES) {
        if (content.includes(needle)) {
          offenders.push(`${file} (${needle})`);
        }
      }
    }
    expect(offenders, `Chip residue found: ${offenders.join(', ')}`).toEqual([]);
  });

  it('PlayerStatsPanel.module.css and LineupAssignmentScreen.module.css contain no .cardChip or .injuryChip rules', () => {
    const offenders: string[] = [];
    for (const file of ['PlayerStatsPanel.module.css', 'LineupAssignmentScreen.module.css']) {
      const content = readCss(file);
      if (content.includes('.cardChip') || content.includes('.injuryChip')) offenders.push(file);
    }
    expect(offenders, `Stylesheets still containing chip rules: ${offenders.join(', ')}`).toEqual(
      [],
    );
  });
});
