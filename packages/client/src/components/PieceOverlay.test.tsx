import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import type { PlayerPiece } from '@counter-attack/shared';
import { PieceOverlay } from './PieceOverlay.js';
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

/** Helper — renders PieceOverlay inside an <svg> wrapper (required for SVG fragment components) */
function renderPiece(
  piece: PlayerPiece,
  selectionState: SelectionState,
  isOffside = false,
  isMovedThisStage = false,
) {
  return render(
    <svg>
      <PieceOverlay
        piece={piece}
        selectionState={selectionState}
        onClick={() => undefined}
        onInspect={() => undefined}
        carrierId={null}
        attackingTeam="home"
        isOffside={isOffside}
        isMovedThisStage={isMovedThisStage}
      />
    </svg>,
  );
}

describe('PieceOverlay — TEAM-02..05: per-team jersey pattern fills (D-08)', () => {
  it('home outfield piece (city) fill references url(#city-jersey-home-5)', () => {
    const { container } = renderPiece(homeOutfield, 'none');
    // The base circle should have fill referencing the city-jersey pattern
    // (store initial selectedTeams.home = 'city' after Phase 19 — D-04)
    const baseCircle = Array.from(container.querySelectorAll('circle'))[0]!;
    expect(baseCircle.getAttribute('fill')).toContain('url(#city-jersey');
    expect(baseCircle.getAttribute('fill')).toContain('home-5');
  });

  it('away outfield piece (crew) fill references url(#crew-jersey-away-5)', () => {
    const { container } = renderPiece(awayOutfield, 'none');
    // (store initial selectedTeams.away = 'crew' after Phase 19 — D-04)
    // For crew pieces, the first circle in the DOM is the clipPath anchor circle (no fill attr).
    // We select the first circle that is NOT inside a clipPath to get the base piece circle.
    const allCircles = Array.from(container.querySelectorAll('circle'));
    const baseCircle = allCircles.find((c) => c.closest('clipPath') === null)!;
    expect(baseCircle).not.toBeUndefined();
    expect(baseCircle.getAttribute('fill')).toContain('url(#crew-jersey');
    expect(baseCircle.getAttribute('fill')).toContain('away-5');
  });

  it('city-jersey pattern def is present in defs when home outfield renders', () => {
    const { container } = renderPiece(homeOutfield, 'none');
    const patterns = Array.from(container.querySelectorAll('pattern'));
    const cityPattern = patterns.find((p) => p.id.startsWith('city-jersey-'));
    expect(cityPattern).toBeTruthy();
  });

  it('crew-jersey pattern def is present in defs when away outfield renders', () => {
    const { container } = renderPiece(awayOutfield, 'none');
    const patterns = Array.from(container.querySelectorAll('pattern'));
    const crewPattern = patterns.find((p) => p.id.startsWith('crew-jersey-'));
    expect(crewPattern).toBeTruthy();
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

  it('City jersey pattern uses #dc143c (crimson) base fill for city outfield (D-09)', () => {
    // City jersey pattern is gated on teamId === 'city'. Since homeOutfield is a home piece
    // and store initial selectedTeams.home = 'city', the city jersey pattern WILL appear.
    const { container } = renderPiece(homeOutfield, 'none');
    const patterns = Array.from(container.querySelectorAll('pattern'));
    const cityPattern = patterns.find((p) => p.id.startsWith('city-jersey-'));
    expect(cityPattern).toBeTruthy();
    // City pattern base rect fill is #dc143c (crimson)
    const rects = cityPattern ? Array.from(cityPattern.querySelectorAll('rect')) : [];
    const fills = rects.map((r) => r.getAttribute('fill'));
    expect(fills).toContain('#dc143c');
  });
});

describe('PieceOverlay — D-10: GK jersey patterns', () => {
  it('home GK fill references url(#home-gk-checker-home-0) not solid #9b59b6', () => {
    const { container } = renderPiece(homeGK, 'none');
    const baseCircle = Array.from(container.querySelectorAll('circle'))[0]!;
    expect(baseCircle.getAttribute('fill')).toContain('url(#home-gk-checker');
    expect(baseCircle.getAttribute('fill')).not.toBe('#9b59b6');
  });

  it('home GK renders a pattern with fills #7c3aed and #4c1d95', () => {
    const { container } = renderPiece(homeGK, 'none');
    const patterns = Array.from(container.querySelectorAll('pattern'));
    const gkPattern = patterns.find((p) => p.id.startsWith('home-gk-checker-'));
    expect(gkPattern).toBeTruthy();
    const rects = gkPattern ? Array.from(gkPattern.querySelectorAll('rect')) : [];
    const fills = rects.map((r) => r.getAttribute('fill'));
    expect(fills).toContain('#7c3aed');
    expect(fills).toContain('#4c1d95');
  });

  it('away GK fill references url(#away-gk-checker-...) not solid #db2777', () => {
    const { container } = renderPiece(awayGK, 'none');
    const baseCircle = Array.from(container.querySelectorAll('circle'))[0]!;
    expect(baseCircle.getAttribute('fill')).toContain('url(#away-gk-checker');
    expect(baseCircle.getAttribute('fill')).not.toBe('#db2777');
  });

  it('away GK renders a checker pattern with fills #be185d and #500724', () => {
    const { container } = renderPiece(awayGK, 'none');
    const patterns = Array.from(container.querySelectorAll('pattern'));
    const gkPattern = patterns.find((p) => p.id.startsWith('away-gk-checker-'));
    expect(gkPattern).toBeTruthy();
    const rects = gkPattern ? Array.from(gkPattern.querySelectorAll('rect')) : [];
    const fills = rects.map((r) => r.getAttribute('fill'));
    expect(fills).toContain('#be185d');
    expect(fills).toContain('#500724');
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

  it("selectionState='active' renders exactly one ring circle with stroke #22c55e", () => {
    const { container } = renderPiece(homeOutfield, 'active');
    const allCircles = Array.from(container.querySelectorAll('circle'));
    const ringCircles = allCircles.filter((c) => c.getAttribute('fill') === 'none');
    expect(ringCircles.length).toBe(1);
    expect(ringCircles[0]!.getAttribute('stroke')).toBe('#22c55e');
  });

  it("selectionState='activated' renders an orange ring (#f97316) AND an orange X path (#f97316)", () => {
    const { container } = renderPiece(homeOutfield, 'activated');
    const allCircles = Array.from(container.querySelectorAll('circle'));
    const ringCircles = allCircles.filter((c) => c.getAttribute('fill') === 'none');
    expect(ringCircles.length).toBe(1);
    expect(ringCircles[0]!.getAttribute('stroke')).toBe('#f97316');
    // Orange X path
    const paths = container.querySelectorAll('path');
    const xPaths = Array.from(paths).filter((p) => p.getAttribute('stroke') === '#f97316');
    expect(xPaths.length).toBe(1);
  });

  it("selectionState='none' renders no selection ring (no blue/green/orange stroke circles)", () => {
    const { container } = renderPiece(homeOutfield, 'none');
    const allCircles = Array.from(container.querySelectorAll('circle'));
    const ringCircles = allCircles.filter((c) => c.getAttribute('fill') === 'none');
    expect(ringCircles.length).toBe(0);
    // No X path either
    const paths = container.querySelectorAll('path');
    const xPaths = Array.from(paths).filter((p) => p.getAttribute('stroke') === '#f97316');
    expect(xPaths.length).toBe(0);
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

describe('PieceOverlay — D-55: green "moved this stage" ring at a distinct radius', () => {
  it('isMovedThisStage=true renders a green ring (#22c55e) with strokeWidth 2.5 at radius PIECE_RADIUS+8 (distinct from the selectable/active/activated rings)', () => {
    const { container } = renderPiece(homeOutfield, 'none', false, true);
    const allCircles = Array.from(container.querySelectorAll('circle'));
    const greenRings = allCircles.filter((c) => c.getAttribute('stroke') === '#22c55e');
    expect(greenRings.length).toBe(1);
    expect(greenRings[0]!.getAttribute('fill')).toBe('none');
    expect(greenRings[0]!.getAttribute('stroke-width')).toBe('2.5');
    expect(greenRings[0]!.getAttribute('r')).toBe('20'); // PIECE_RADIUS(12) + 8
  });

  it('isMovedThisStage=false (default) renders no green ring when selectionState is none', () => {
    const { container } = renderPiece(homeOutfield, 'none');
    const allCircles = Array.from(container.querySelectorAll('circle'));
    const greenRings = allCircles.filter((c) => c.getAttribute('stroke') === '#22c55e');
    expect(greenRings.length).toBe(0);
  });

  it('isMovedThisStage=true together with selectionState=active renders BOTH green rings (the active-selection ring AND the moved-this-stage ring) at distinct radii', () => {
    const { container } = renderPiece(homeOutfield, 'active', false, true);
    const allCircles = Array.from(container.querySelectorAll('circle'));
    const greenRings = allCircles.filter((c) => c.getAttribute('stroke') === '#22c55e');
    expect(greenRings.length).toBe(2);
    const radii = greenRings.map((c) => c.getAttribute('r')).sort();
    expect(radii).toEqual(['16', '20']); // active ring (12+4) and moved-this-stage ring (12+8)
  });

  it('isMovedThisStage=true together with isOffside=true renders BOTH the green moved-this-stage ring AND the red offside ring simultaneously', () => {
    const { container } = renderPiece(homeOutfield, 'none', true, true);
    const allCircles = Array.from(container.querySelectorAll('circle'));
    const greenRing = allCircles.filter((c) => c.getAttribute('stroke') === '#22c55e');
    const redRing = allCircles.filter((c) => c.getAttribute('stroke') === '#dc2626');
    expect(greenRing.length).toBe(1);
    expect(redRing.length).toBe(1);
  });

  it('isMovedThisStage=true together with selectionState=activated renders BOTH the orange activated ring/X AND the green moved-this-stage ring', () => {
    const { container } = renderPiece(homeOutfield, 'activated', false, true);
    const allCircles = Array.from(container.querySelectorAll('circle'));
    const orangeRing = allCircles.filter((c) => c.getAttribute('stroke') === '#f97316');
    const greenRing = allCircles.filter((c) => c.getAttribute('stroke') === '#22c55e');
    expect(orangeRing.length).toBe(1);
    expect(greenRing.length).toBe(1);
  });
});
