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
  role: 'MID',
  position: { q: 9, r: 8 },
  name: 'Home MID',
  pace: 5,
  shooting: 5,
  tackling: 5,
  dribbling: 5,
  heading: 5,
  saving: 5,
  handling: 5,
  resilience: 5,
  aerialAbility: 5,
  highPass: 5,
};

const awayOutfield: PlayerPiece = {
  id: 'away-5',
  teamId: 'away',
  role: 'MID',
  position: { q: 27, r: 8 },
  name: 'Away MID',
  pace: 5,
  shooting: 5,
  tackling: 5,
  dribbling: 5,
  heading: 5,
  saving: 5,
  handling: 5,
  resilience: 5,
  aerialAbility: 5,
  highPass: 5,
};

const homeGK: PlayerPiece = {
  id: 'home-0',
  teamId: 'home',
  role: 'GK',
  position: { q: 1, r: 13 },
  name: 'Home GK',
  pace: 3,
  shooting: 2,
  tackling: 3,
  dribbling: 3,
  heading: 4,
  saving: 8,
  handling: 8,
  resilience: 5,
  aerialAbility: 7,
  highPass: 4,
};

const awayGK: PlayerPiece = {
  id: 'away-0',
  teamId: 'away',
  role: 'GK',
  position: { q: 35, r: 13 },
  name: 'Away GK',
  pace: 3,
  shooting: 2,
  tackling: 3,
  dribbling: 3,
  heading: 4,
  saving: 8,
  handling: 8,
  resilience: 5,
  aerialAbility: 7,
  highPass: 4,
};

/** Helper — renders PieceOverlay inside an <svg> wrapper (required for SVG fragment components) */
function renderPiece(piece: PlayerPiece, selectionState: SelectionState) {
  return render(
    <svg>
      <PieceOverlay
        piece={piece}
        selectionState={selectionState}
        onClick={() => undefined}
        onInspect={() => undefined}
        carrierId={null}
        attackingTeam="home"
      />
    </svg>,
  );
}

describe('PieceOverlay — VIS-01: stripe pattern fills', () => {
  it('home outfield piece fill references url(#home-stripe-<id>)', () => {
    const { container } = renderPiece(homeOutfield, 'none');
    // The base circle should have fill referencing the home-stripe pattern
    const baseCircle = Array.from(container.querySelectorAll('circle'))[0]!;
    expect(baseCircle.getAttribute('fill')).toContain('url(#home-stripe');
    expect(baseCircle.getAttribute('fill')).toContain('home-5');
  });

  it('away outfield piece fill references url(#away-stripe-<id>)', () => {
    const { container } = renderPiece(awayOutfield, 'none');
    const baseCircle = Array.from(container.querySelectorAll('circle'))[0]!;
    expect(baseCircle.getAttribute('fill')).toContain('url(#away-stripe');
    expect(baseCircle.getAttribute('fill')).toContain('away-5');
  });

  it('home GK renders with solid fill (#9b59b6) and no url(#...-stripe) fill', () => {
    const { container } = renderPiece(homeGK, 'none');
    const baseCircle = Array.from(container.querySelectorAll('circle'))[0]!;
    expect(baseCircle.getAttribute('fill')).toBe('#9b59b6');
    // No pattern element for GK
    const patterns = container.querySelectorAll('pattern');
    expect(patterns.length).toBe(0);
    // Fill must not reference any stripe url
    expect(baseCircle.getAttribute('fill')).not.toContain('url(#');
  });

  it('away GK renders with solid fill (#f59e0b) and no url(#...-stripe) fill', () => {
    const { container } = renderPiece(awayGK, 'none');
    const baseCircle = Array.from(container.querySelectorAll('circle'))[0]!;
    expect(baseCircle.getAttribute('fill')).toBe('#f59e0b');
    const patterns = container.querySelectorAll('pattern');
    expect(patterns.length).toBe(0);
    expect(baseCircle.getAttribute('fill')).not.toContain('url(#');
  });
});

describe('PieceOverlay — UX-05: selection ring states', () => {
  it("selectionState='selectable' renders exactly one ring circle with stroke #3b82f6", () => {
    const { container } = renderPiece(homeOutfield, 'selectable');
    // Find circles with fill="none" (ring circles, not the base circle)
    const allCircles = Array.from(container.querySelectorAll('circle'));
    const ringCircles = allCircles.filter((c) => c.getAttribute('fill') === 'none');
    expect(ringCircles.length).toBe(1);
    expect(ringCircles[0]!.getAttribute('stroke')).toBe('#3b82f6');
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
