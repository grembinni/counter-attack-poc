import { describe, it, expect } from 'vitest';
import { restartErrorMessage, RESTART_ERROR_MESSAGES } from './restartErrorMessage.js';

describe('restartErrorMessage', () => {
  it('OFF_PITCH names the pitch and never contains the raw code', () => {
    const msg = restartErrorMessage('OFF_PITCH');
    expect(msg).not.toBeNull();
    expect(msg).not.toContain('OFF_PITCH');
    expect(msg?.toLowerCase()).toContain('pitch');
  });

  it('MOVE_INVALID describes an illegal move for this window', () => {
    const msg = restartErrorMessage('MOVE_INVALID');
    expect(msg).not.toBeNull();
    expect(msg).not.toContain('MOVE_INVALID');
    expect(msg?.toLowerCase()).toContain('move');
  });

  it("WRONG_TEAM and NOT_YOUR_PIECE both describe the piece not being the player's to move", () => {
    const wrongTeam = restartErrorMessage('WRONG_TEAM');
    const notYourPiece = restartErrorMessage('NOT_YOUR_PIECE');
    expect(wrongTeam?.toLowerCase()).toContain('piece');
    expect(notYourPiece?.toLowerCase()).toContain('piece');
  });

  it("WRONG_PHASE, WRONG_SLOT and INVALID_SEQUENCE all describe it not being that action's turn", () => {
    for (const code of ['WRONG_PHASE', 'WRONG_SLOT', 'INVALID_SEQUENCE']) {
      const msg = restartErrorMessage(code);
      expect(msg).not.toBeNull();
      expect(msg).not.toContain(code);
    }
  });

  it('OCCUPIED, INVALID_TARGET, MISSING_TARGET, PIECE_NOT_FOUND, WRONG_PIECE, INVALID_CHOICE and MISSING_PASS_TYPE each return a distinct, specific sentence', () => {
    const codes = [
      'OCCUPIED',
      'INVALID_TARGET',
      'MISSING_TARGET',
      'PIECE_NOT_FOUND',
      'WRONG_PIECE',
      'INVALID_CHOICE',
      'MISSING_PASS_TYPE',
    ];
    const messages = codes.map((c) => restartErrorMessage(c));
    for (const msg of messages) {
      expect(msg).not.toBeNull();
    }
    // All must be distinct from one another.
    expect(new Set(messages).size).toBe(codes.length);
  });

  it('an unrecognised code falls back to the generic message, never the raw token, and is non-empty', () => {
    const msg = restartErrorMessage('SOME_FUTURE_CODE');
    expect(msg).not.toBeNull();
    expect(msg).not.toContain('SOME_FUTURE_CODE');
    expect(msg?.length).toBeGreaterThan(0);
  });

  it('empty string and null both return null so the caller renders nothing', () => {
    expect(restartErrorMessage('')).toBeNull();
    expect(restartErrorMessage(null)).toBeNull();
  });

  it('the generic fallback sentence itself satisfies the shared formatting invariants', () => {
    const msg = restartErrorMessage('SOME_FUTURE_CODE');
    expect(msg).toMatch(/^[A-Z]/);
    expect(msg?.endsWith('.')).toBe(true);
    expect(msg).not.toContain('_');
    expect(msg).not.toMatch(/[A-Z]{4,}/);
  });

  // Table-driven: iterate the real exported map (not a copy) so a future copy addition
  // cannot leak a wire code by accident.
  it.each(Object.entries(RESTART_ERROR_MESSAGES))(
    'mapped sentence for %s satisfies formatting invariants',
    (_code, sentence) => {
      expect(sentence).toMatch(/^[A-Z]/);
      expect(sentence.endsWith('.')).toBe(true);
      expect(sentence).not.toContain('_');
      expect(sentence).not.toMatch(/[A-Z]{4,}/);
    },
  );
});
