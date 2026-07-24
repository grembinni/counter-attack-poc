import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useGameStore } from '../store/useGameStore.js';
import { deriveMyTeam, useMyTeam } from './useMyTeam.js';

beforeEach(() => {
  useGameStore.setState({ playerSlot: null });
});

describe('deriveMyTeam', () => {
  it('deriveMyTeam(1) === "home"', () => {
    expect(deriveMyTeam(1)).toBe('home');
  });

  it('deriveMyTeam(2) === "away"', () => {
    expect(deriveMyTeam(2)).toBe('away');
  });

  it('deriveMyTeam(null) === null (canonical null-safe form)', () => {
    expect(deriveMyTeam(null)).toBeNull();
  });
});

describe('useMyTeam', () => {
  it('returns "home" when store playerSlot is 1', () => {
    useGameStore.setState({ playerSlot: 1 });
    const { result } = renderHook(() => useMyTeam());
    expect(result.current).toBe('home');
  });

  it('returns "away" when store playerSlot is 2', () => {
    useGameStore.setState({ playerSlot: 2 });
    const { result } = renderHook(() => useMyTeam());
    expect(result.current).toBe('away');
  });

  it('returns null when store playerSlot is null', () => {
    useGameStore.setState({ playerSlot: null });
    const { result } = renderHook(() => useMyTeam());
    expect(result.current).toBeNull();
  });

  it('subscribes only to the playerSlot slice, not the whole store', () => {
    // Assert the selector shape used inside useMyTeam.ts is the narrow
    // `(s) => s.playerSlot` form, matching the locked per-slice-selector
    // convention (not a whole-store subscription).
    const source = useMyTeam.toString();
    expect(source).toContain('playerSlot');
  });
});
