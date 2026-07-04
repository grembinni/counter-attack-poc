/** Uniform style system for Counter Attack — Phase 20.
 * Defines the 12 uniform style identifiers and their display metadata.
 * No React/JSX imports — shared package must not reference the JSX runtime.
 * Renderer functions live in packages/client/src/styles/uniformStyles.tsx (Plan 20-02).
 */

/** Phase 20 UNIFORM-01: 12-member string union of all available uniform style identifiers.
 * Order matches the CONTEXT.md decisions D-01 through D-12 and UNIFORM_STYLE_META below. */
export type UniformStyleId =
  | 'pinstripe'
  | 'diagonal'
  | 'checker'
  | 'cosmos'
  | 'plus'
  | 'v-stripe'
  | 'quarters'
  | 'polka-dots'
  | 'fade'
  | 'tree-rings'
  | 'corners'
  | 'solid';

/** Display metadata for a single uniform style.
 * Used in Phase 22 selection UI and any tooltip/label rendering. */
export interface UniformStyleMeta {
  /** The style identifier — matches its key in UNIFORM_STYLE_META. */
  id: UniformStyleId;
  /** Human-readable display name (e.g. 'V-Stripe', 'Polka Dots'). */
  name: string;
  /** One-line visual description for the Phase 22 selection screen. */
  description: string;
}

/** Phase 20 UNIFORM-05: Full metadata registry for all 12 uniform styles.
 * Typed as Record<UniformStyleId, UniformStyleMeta> so TypeScript enforces all 12 keys.
 * This const is metadata only — no renderer functions or JSX lives here. */
export const UNIFORM_STYLE_META: Record<UniformStyleId, UniformStyleMeta> = {
  pinstripe: {
    id: 'pinstripe',
    name: 'Pinstripe',
    description: 'Vertical pinstripes',
  },
  diagonal: {
    id: 'diagonal',
    name: 'Diagonal',
    description: 'Diagonal stripe across the jersey',
  },
  checker: {
    id: 'checker',
    name: 'Checker',
    description: 'Alternating checker squares',
  },
  cosmos: {
    id: 'cosmos',
    name: 'Cosmos',
    description: 'Horizontal band across the chest',
  },
  plus: {
    id: 'plus',
    name: 'Plus',
    description: 'Bold plus cross shape on a contrasting background',
  },
  'v-stripe': {
    id: 'v-stripe',
    name: 'V-Stripe',
    description: 'V-shape chevron stripes',
  },
  quarters: {
    id: 'quarters',
    name: 'Quarters',
    description: 'Four-quadrant colour split',
  },
  'polka-dots': {
    id: 'polka-dots',
    name: 'Polka Dots',
    description: 'Dot pattern on a solid base colour',
  },
  fade: {
    id: 'fade',
    name: 'Fade',
    description: 'Gradient fade from primary to secondary colour',
  },
  'tree-rings': {
    id: 'tree-rings',
    name: 'Tree Rings',
    description: 'Concentric ring overlay',
  },
  corners: {
    id: 'corners',
    name: 'Corners',
    description: 'Primary colour triangles at the four corners',
  },
  solid: {
    id: 'solid',
    name: 'Solid',
    description: 'Solid single colour — no pattern',
  },
};
