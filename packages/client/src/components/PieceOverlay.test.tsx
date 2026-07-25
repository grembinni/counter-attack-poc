import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import type { PlayerPiece } from '@counter-attack/shared';
import { COLOR_SCHEME_REGISTRY } from '@counter-attack/shared';
import {
  PieceOverlay,
  ACTIVE_RING_STROKE,
  SPENT_RING_STROKE,
  SPENT_OVERLAY_FILL,
} from './PieceOverlay.js';
import type { SelectionState } from './PieceOverlay.js';

vi.mock('../socket.js', () => ({
  socket: { emit: vi.fn(), on: vi.fn(), off: vi.fn() },
}));

afterEach(() => cleanup());

// Minimal piece literals to avoid mock import complexity
const homeOutfield: PlayerPiece = {
  id: 'home-5',
  teamId: 'home',
  firstName: 'Home',
  lastName: 'MID',
  number: 6,
  nationality: 'Brazil',
  role: 'MID',
  position: { q: 9, r: 8 },
  pace: 5,
  shooting: 5,
  tackling: 5,
  dribbling: 5,
  saving: 5,
  handling: 5,
  resilience: 5,
  aerialAbility: 5,
  highPass: 5,
};

const awayOutfield: PlayerPiece = {
  id: 'away-5',
  teamId: 'away',
  firstName: 'Away',
  lastName: 'MID',
  number: 6,
  nationality: 'Mexico',
  role: 'MID',
  position: { q: 27, r: 8 },
  pace: 5,
  shooting: 5,
  tackling: 5,
  dribbling: 5,
  saving: 5,
  handling: 5,
  resilience: 5,
  aerialAbility: 5,
  highPass: 5,
};

const homeGK: PlayerPiece = {
  id: 'home-0',
  teamId: 'home',
  firstName: 'Home',
  lastName: 'GK',
  number: 1,
  nationality: 'Brazil',
  role: 'GK',
  position: { q: 1, r: 13 },
  pace: 3,
  shooting: 2,
  tackling: 3,
  dribbling: 3,
  saving: 8,
  handling: 8,
  resilience: 5,
  aerialAbility: 7,
  highPass: 4,
};

const awayGK: PlayerPiece = {
  id: 'away-0',
  teamId: 'away',
  firstName: 'Away',
  lastName: 'GK',
  number: 1,
  nationality: 'Mexico',
  role: 'GK',
  position: { q: 35, r: 13 },
  pace: 3,
  shooting: 2,
  tackling: 3,
  dribbling: 3,
  saving: 8,
  handling: 8,
  resilience: 5,
  aerialAbility: 7,
  highPass: 4,
};

/** Helper — renders PieceOverlay inside an <svg> wrapper (required for SVG fragment components).
 * Phase 20 D-15: uniformStyle and palette are resolved per-piece by the caller (mirrors HexGrid).
 * Home pieces default to city/pinstripe; away pieces default to crew/diagonal. */
function renderPiece(piece: PlayerPiece, selectionState: SelectionState, isOffside = false) {
  // Resolve uniform style and palette based on team — mirrors what HexGrid does via TEAM_CONFIGS.
  // GK pieces use 'checkers' so D-13 palette-swap tests can assert swapped checker colors.
  const isHome = piece.teamId === 'home';
  const isGK = piece.role === 'GK';
  const uniformStyle = isGK
    ? ('checkers' as const)
    : isHome
      ? ('pinstripes-vertical' as const)
      : ('bar-diagonal' as const);
  const palette = isHome ? COLOR_SCHEME_REGISTRY.city.palette : COLOR_SCHEME_REGISTRY.crew.palette;

  return render(
    <svg>
      <PieceOverlay
        piece={piece}
        uniformStyle={uniformStyle}
        palette={palette}
        selectionState={selectionState}
        onClick={() => undefined}
        onInspect={() => undefined}
        carrierId={null}
        attackingTeam="home"
        isOffside={isOffside}
      />
    </svg>,
  );
}

describe('PieceOverlay — TEAM-02..05: per-team jersey pattern fills (D-08, Phase 20 D-15)', () => {
  it('home outfield piece (city/pinstripes-vertical) fill references url(#ps-v-home-5)', () => {
    const { container } = renderPiece(homeOutfield, 'none');
    const baseCircle = Array.from(container.querySelectorAll('circle'))[0]!;
    expect(baseCircle.getAttribute('fill')).toContain('url(#ps-v-');
    expect(baseCircle.getAttribute('fill')).toContain('home-5');
  });

  it('away outfield piece (crew/bar-diagonal) uses solid awayAlt fill (away scheme background — no pattern URL)', () => {
    const { container } = renderPiece(awayOutfield, 'none');
    // bar-diagonal has a clipPath in defs (with a circle inside); find the base piece circle.
    const allCircles = Array.from(container.querySelectorAll('circle'));
    const baseCircle = allCircles.find((c) => c.closest('clipPath') === null)!;
    expect(baseCircle).not.toBeUndefined();
    // Away outfield uses away color scheme: effectivePalette.homeAlt = crew.awayAlt (background)
    expect(baseCircle.getAttribute('fill')).toBe(COLOR_SCHEME_REGISTRY.crew.palette.awayAlt);
  });

  it('ps-v- pattern def is present in defs when home outfield renders', () => {
    const { container } = renderPiece(homeOutfield, 'none');
    const patterns = Array.from(container.querySelectorAll('pattern'));
    const pinstripePattern = patterns.find((p) => p.id.startsWith('ps-v-'));
    expect(pinstripePattern).toBeTruthy();
  });

  it('bar-diagonal clipPath def is present in defs when away outfield renders (no pattern)', () => {
    const { container } = renderPiece(awayOutfield, 'none');
    const clipPaths = container.querySelectorAll('clipPath');
    expect(clipPaths.length).toBeGreaterThan(0);
    // bar-diagonal has no pattern element — solid fill
    const patterns = container.querySelectorAll('pattern');
    expect(patterns.length).toBe(0);
  });

  it('PieceOverlay source has no #1a56b0 team-identity literal (D-06 color refactor)', () => {
    // This is validated via acceptance criteria (grep) rather than runtime test.
    // We test via rendered output: outfield pieces must not have fill="#1a56b0"
    const { container } = renderPiece(homeOutfield, 'none');
    const circles = Array.from(container.querySelectorAll('circle'));
    const hardcodedBlue = circles.filter((c) => c.getAttribute('fill') === '#1a56b0');
    expect(hardcodedBlue.length).toBe(0);
  });

  it('PieceOverlay source has no #c0392b team-identity literal (D-06 color refactor)', () => {
    const { container } = renderPiece(awayOutfield, 'none');
    const circles = Array.from(container.querySelectorAll('circle'));
    const hardcodedRed = circles.filter((c) => c.getAttribute('fill') === '#c0392b');
    expect(hardcodedRed.length).toBe(0);
  });

  it('City jersey (pinstripes-vertical) pattern uses City palette.homePrime as base fill for home outfield (D-09)', () => {
    const { container } = renderPiece(homeOutfield, 'none');
    const patterns = Array.from(container.querySelectorAll('pattern'));
    const pinstripePattern = patterns.find((p) => p.id.startsWith('ps-v-'));
    expect(pinstripePattern).toBeTruthy();
    const rects = pinstripePattern ? Array.from(pinstripePattern.querySelectorAll('rect')) : [];
    const fills = rects.map((r) => r.getAttribute('fill'));
    expect(fills).toContain(COLOR_SCHEME_REGISTRY.city.palette.homePrime);
  });
});

describe('PieceOverlay — D-10 / D-13: GK jersey patterns with palette swap', () => {
  it('home GK fill references url(#checkers-home-0) not solid #9b59b6', () => {
    const { container } = renderPiece(homeGK, 'none');
    const baseCircle = Array.from(container.querySelectorAll('circle'))[0]!;
    expect(baseCircle.getAttribute('fill')).toContain('url(#checkers-');
    expect(baseCircle.getAttribute('fill')).not.toBe('#9b59b6');
  });

  it('home GK (city) checkers pattern uses City away scheme: awayPrime base + awayAlt squares', () => {
    const { container } = renderPiece(homeGK, 'none');
    const patterns = Array.from(container.querySelectorAll('pattern'));
    const gkPattern = patterns.find((p) => p.id.startsWith('checkers-'));
    expect(gkPattern).toBeTruthy();
    const rects = gkPattern ? Array.from(gkPattern.querySelectorAll('rect')) : [];
    const fills = rects.map((r) => r.getAttribute('fill'));
    // home GK uses away scheme: effectivePalette.homePrime = City.awayPrime; effectivePalette.homeAlt = City.awayAlt
    expect(fills).toContain(COLOR_SCHEME_REGISTRY.city.palette.awayPrime);
    expect(fills).toContain(COLOR_SCHEME_REGISTRY.city.palette.awayAlt);
  });

  it('away GK fill references url(#checkers-...) not solid #db2777', () => {
    const { container } = renderPiece(awayGK, 'none');
    const baseCircle = Array.from(container.querySelectorAll('circle'))[0]!;
    expect(baseCircle.getAttribute('fill')).toContain('url(#checkers-');
    expect(baseCircle.getAttribute('fill')).not.toBe('#db2777');
  });

  it('away GK (crew) checkers pattern uses Crew home scheme: homePrime base + homeAlt squares', () => {
    const { container } = renderPiece(awayGK, 'none');
    const patterns = Array.from(container.querySelectorAll('pattern'));
    const gkPattern = patterns.find((p) => p.id.startsWith('checkers-'));
    expect(gkPattern).toBeTruthy();
    const rects = gkPattern ? Array.from(gkPattern.querySelectorAll('rect')) : [];
    const fills = rects.map((r) => r.getAttribute('fill'));
    // away GK uses home scheme: effectivePalette.homePrime = Crew.homePrime; effectivePalette.homeAlt = Crew.homeAlt
    expect(fills).toContain(COLOR_SCHEME_REGISTRY.crew.palette.homePrime);
    expect(fills).toContain(COLOR_SCHEME_REGISTRY.crew.palette.homeAlt);
  });
});

describe('PieceOverlay — UX-05: selection ring states', () => {
  it("selectionState='selectable' renders exactly one ring circle with stroke #60a5fa", () => {
    const { container } = renderPiece(homeOutfield, 'selectable');
    // Find circles with fill="none" (ring circles, not the base circle)
    const allCircles = Array.from(container.querySelectorAll('circle'));
    const ringCircles = allCircles.filter((c) => c.getAttribute('fill') === 'none');
    expect(ringCircles.length).toBe(1);
    expect(ringCircles[0]!.getAttribute('stroke')).toBe('#60a5fa');
  });

  it("selectionState='active' renders exactly one ring circle with stroke ACTIVE_RING_STROKE", () => {
    const { container } = renderPiece(homeOutfield, 'active');
    const allCircles = Array.from(container.querySelectorAll('circle'));
    const ringCircles = allCircles.filter((c) => c.getAttribute('fill') === 'none');
    expect(ringCircles.length).toBe(1);
    expect(ringCircles[0]!.getAttribute('stroke')).toBe(ACTIVE_RING_STROKE);
  });

  it("selectionState='activated' renders the unified grey ring (SPENT_RING_STROKE) + grey overlay (SPENT_OVERLAY_FILL) — the orange ring + X treatment was retired per Plan 33-07 Task 3 human-verify feedback", () => {
    const { container } = renderPiece(homeOutfield, 'activated');
    const allCircles = Array.from(container.querySelectorAll('circle'));

    const greyRings = allCircles.filter((c) => c.getAttribute('stroke') === SPENT_RING_STROKE);
    expect(greyRings.length).toBe(1);
    expect(greyRings[0]!.getAttribute('fill')).toBe('none');
    expect(greyRings[0]!.getAttribute('stroke-width')).toBe('2.5');
    expect(greyRings[0]!.getAttribute('r')).toBe('20'); // PIECE_RADIUS(12) + 8

    const greyOverlays = allCircles.filter((c) => c.getAttribute('fill') === SPENT_OVERLAY_FILL);
    expect(greyOverlays.length).toBe(1);
    expect(greyOverlays[0]!.getAttribute('fill-opacity')).toBe('0.35');
    expect(greyOverlays[0]!.getAttribute('r')).toBe('12'); // PIECE_RADIUS

    // No path element at all — the X mark is gone.
    expect(container.querySelectorAll('path').length).toBe(0);
  });

  it("selectionState='none' renders no selection ring (no blue/green/grey stroke circles) and no path", () => {
    const { container } = renderPiece(homeOutfield, 'none');
    const allCircles = Array.from(container.querySelectorAll('circle'));
    const ringCircles = allCircles.filter((c) => c.getAttribute('fill') === 'none');
    expect(ringCircles.length).toBe(0);
    const greyOverlays = allCircles.filter((c) => c.getAttribute('fill') === SPENT_OVERLAY_FILL);
    expect(greyOverlays.length).toBe(0);
    expect(container.querySelectorAll('path').length).toBe(0);
  });
});

describe('PieceOverlay — OFFSIDE-01 (D-25, ring width corrected by D-42): red ring at a distinct radius', () => {
  it('isOffside=true renders exactly one circle with stroke #dc2626 and strokeWidth 2.5', () => {
    const { container } = renderPiece(homeOutfield, 'none', true);
    const allCircles = Array.from(container.querySelectorAll('circle'));
    const offsideRings = allCircles.filter((c) => c.getAttribute('stroke') === '#dc2626');
    expect(offsideRings.length).toBe(1);
    expect(offsideRings[0]!.getAttribute('fill')).toBe('none');
    expect(offsideRings[0]!.getAttribute('stroke-width')).toBe('2.5');
  });

  it('isOffside=true together with selectionState=active renders BOTH the green active ring AND the red offside ring', () => {
    const { container } = renderPiece(homeOutfield, 'active', true);
    const allCircles = Array.from(container.querySelectorAll('circle'));
    const greenRing = allCircles.filter((c) => c.getAttribute('stroke') === '#22c55e');
    const redRing = allCircles.filter((c) => c.getAttribute('stroke') === '#dc2626');
    expect(greenRing.length).toBe(1);
    expect(redRing.length).toBe(1);
  });

  it('isOffside=false (default) renders no red ring', () => {
    const { container } = renderPiece(homeOutfield, 'none');
    const allCircles = Array.from(container.querySelectorAll('circle'));
    const redRing = allCircles.filter((c) => c.getAttribute('stroke') === '#dc2626');
    expect(redRing.length).toBe(0);
  });
});

describe('PieceOverlay — Plan 33-07 Task 3 human-verify fix: unified grey "activated" visual replaces the retired orange+X treatment, and the retired free-kick-only additive grey layer is now fully subsumed by selectionState="activated"', () => {
  it('selectionState="activated" renders distinctly from selectionState="active" (green) and "selectable" (blue) — the grey ring stroke differs from both', () => {
    expect(ACTIVE_RING_STROKE).not.toBe(SPENT_RING_STROKE);

    const { container: activatedContainer } = renderPiece(homeOutfield, 'activated');
    const activatedGreyRing = Array.from(activatedContainer.querySelectorAll('circle')).filter(
      (c) => c.getAttribute('stroke') === SPENT_RING_STROKE,
    );
    expect(activatedGreyRing.length).toBe(1);

    const { container: activeContainer } = renderPiece(homeOutfield, 'active');
    const activeGreenRing = Array.from(activeContainer.querySelectorAll('circle')).filter(
      (c) => c.getAttribute('stroke') === ACTIVE_RING_STROKE,
    );
    expect(activeGreenRing.length).toBe(1);
    // The green active ring never uses the grey stroke, and vice versa.
    const activeGreyRing = Array.from(activeContainer.querySelectorAll('circle')).filter(
      (c) => c.getAttribute('stroke') === SPENT_RING_STROKE,
    );
    expect(activeGreyRing.length).toBe(0);

    const { container: selectableContainer } = renderPiece(homeOutfield, 'selectable');
    const selectableBlueRing = Array.from(selectableContainer.querySelectorAll('circle')).filter(
      (c) => c.getAttribute('stroke') === '#60a5fa',
    );
    expect(selectableBlueRing.length).toBe(1);
    const selectableGreyRing = Array.from(selectableContainer.querySelectorAll('circle')).filter(
      (c) => c.getAttribute('stroke') === SPENT_RING_STROKE,
    );
    expect(selectableGreyRing.length).toBe(0);
  });

  it('selectionState="activated" together with isOffside=true renders BOTH the grey activated ring AND the red offside ring simultaneously', () => {
    const { container } = renderPiece(homeOutfield, 'activated', true);
    const allCircles = Array.from(container.querySelectorAll('circle'));
    const greyRing = allCircles.filter((c) => c.getAttribute('stroke') === SPENT_RING_STROKE);
    const redRing = allCircles.filter((c) => c.getAttribute('stroke') === '#dc2626');
    expect(greyRing.length).toBe(1);
    expect(redRing.length).toBe(1);
  });

  it('a piece that was formerly only covered by the retired free-kick-only additive grey layer (e.g. a piece in freeKickPlacedPieceIds) now gets the identical grey ring+overlay purely via selectionState="activated" — no separate prop needed', () => {
    // HexGrid.tsx's isSpentNow folds freeKickPlacedPieceIds membership into
    // selectionState==='activated' directly (see HexGrid.tsx FREE_KICK_SETUP branch),
    // so asserting the 'activated' render here covers that case with no extra prop.
    const { container } = renderPiece(homeOutfield, 'activated');
    const allCircles = Array.from(container.querySelectorAll('circle'));
    expect(allCircles.some((c) => c.getAttribute('stroke') === SPENT_RING_STROKE)).toBe(true);
    expect(allCircles.some((c) => c.getAttribute('fill') === SPENT_OVERLAY_FILL)).toBe(true);
  });
});
