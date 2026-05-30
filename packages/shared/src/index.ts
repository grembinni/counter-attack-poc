// Single barrel export for @counter-attack/shared (D-05).
// All consumers import from '@counter-attack/shared' — no sub-path imports.
export * from './types.js';
export * from './hex.js';
export * from './events.js';
export * from './pitch.js';
export * from './teams.js';
// Phase 2 barrel exports — pre-registered in Wave 1 (Plan 02-01) to permit parallel Wave 2 execution. Validator modules themselves are created by plans 02-02, 02-03, 02-04. TypeScript build will fail until those plans complete; this is expected and documented in 02-01-PLAN.md.
export * from './scoreUtils.js';
export * from './moveValidator.js';
export * from './passValidator.js';
export * from './shotValidator.js';
export * from './headingValidator.js';
export * from './snapshotValidator.js';
