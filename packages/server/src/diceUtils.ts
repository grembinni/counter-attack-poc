import { randomInt } from 'crypto';

/**
 * Rolls a single d6. Returns 1–6 inclusive.
 *
 * All dice in the game use this function — no other RNG source permitted (D-08, DICE-01).
 * Wraps Node.js crypto.randomInt for cryptographically secure randomness.
 * min inclusive, max exclusive: randomInt(1, 7) → 1..6.
 */
export function rollDice(): number {
  return randomInt(1, 7);
}
