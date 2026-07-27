import { describe, it, expect } from 'vitest';
import { ctaColorClass } from './ctaColorClass.js';

const CLASSES = { ready: 'READY', pending: 'PENDING' };

describe('ctaColorClass', () => {
  it('returns PENDING when eligibleRemaining is 3', () => {
    expect(ctaColorClass(3, CLASSES)).toBe('PENDING');
  });

  it('returns READY when eligibleRemaining is 0', () => {
    expect(ctaColorClass(0, CLASSES)).toBe('READY');
  });

  it('returns READY when eligibleRemaining is negative (the <= 0 boundary)', () => {
    expect(ctaColorClass(-1, CLASSES)).toBe('READY');
  });

  it("returns '' when enabled is false, even when eligibleRemaining is 0", () => {
    expect(ctaColorClass(0, CLASSES, false)).toBe('');
  });

  it("returns '' when enabled is false and eligibleRemaining is 3", () => {
    expect(ctaColorClass(3, CLASSES, false)).toBe('');
  });

  it("falls back to '' for undefined ready/pending classes at eligibleRemaining 0", () => {
    expect(ctaColorClass(0, { ready: undefined, pending: undefined })).toBe('');
  });

  it("falls back to '' for undefined ready/pending classes at eligibleRemaining 3", () => {
    expect(ctaColorClass(3, { ready: undefined, pending: undefined })).toBe('');
  });
});
