/** Uniform style system for Counter Attack.
 * Defines the 18 uniform style identifiers (9 families × up to 5 variants) and display metadata.
 * No React/JSX imports — shared package must not reference the JSX runtime.
 * Renderer functions live in packages/client/src/styles/uniformStyles.tsx.
 */

/** 18-member string union of all available uniform style identifiers.
 * Families: pinstripes (3), bar (5), split (3), quarter (2), shape-oval/circle/diamond (3), sunburst (1), checkers (1). */
export type UniformStyleId =
  | 'pinstripes-horizontal'
  | 'pinstripes-vertical'
  | 'pinstripes-diagonal'
  | 'bar-horizontal'
  | 'bar-vertical'
  | 'bar-diagonal'
  | 'bar-x'
  | 'bar-plus'
  | 'split-horizontal'
  | 'split-vertical'
  | 'split-diagonal'
  | 'quarter-horizontal'
  | 'quarter-diagonal'
  | 'shape-oval'
  | 'shape-circle'
  | 'shape-diamond'
  | 'sunburst'
  | 'checkers';

/** Display metadata for a single uniform style. Used in selection UI and tooltips. */
export interface UniformStyleMeta {
  id: UniformStyleId;
  name: string;
  description: string;
}

/** Full metadata registry for all 18 uniform styles.
 * Typed as Record<UniformStyleId, UniformStyleMeta> so TypeScript enforces all 18 keys. */
export const UNIFORM_STYLE_META: Record<UniformStyleId, UniformStyleMeta> = {
  'pinstripes-horizontal': {
    id: 'pinstripes-horizontal',
    name: 'Pinstripes (H)',
    description: 'Narrow horizontal stripes with a solid centre circle',
  },
  'pinstripes-vertical': {
    id: 'pinstripes-vertical',
    name: 'Pinstripes (V)',
    description: 'Narrow vertical stripes with a solid centre circle',
  },
  'pinstripes-diagonal': {
    id: 'pinstripes-diagonal',
    name: 'Pinstripes (D)',
    description: 'Narrow diagonal stripes with a solid centre circle',
  },
  'bar-horizontal': {
    id: 'bar-horizontal',
    name: 'Bar (H)',
    description: 'Bold horizontal band across the centre',
  },
  'bar-vertical': {
    id: 'bar-vertical',
    name: 'Bar (V)',
    description: 'Bold vertical band through the centre',
  },
  'bar-diagonal': {
    id: 'bar-diagonal',
    name: 'Bar (Diag)',
    description: 'Bold diagonal stripe across the piece',
  },
  'bar-x': {
    id: 'bar-x',
    name: 'Bar (X)',
    description: 'Two diagonal bars crossing in an X pattern',
  },
  'bar-plus': {
    id: 'bar-plus',
    name: 'Bar (+)',
    description: 'Horizontal and vertical bars forming a plus sign',
  },
  'split-horizontal': {
    id: 'split-horizontal',
    name: 'Split (H)',
    description: 'Top/bottom 50-50 split between primary and secondary colours',
  },
  'split-vertical': {
    id: 'split-vertical',
    name: 'Split (V)',
    description: 'Left/right 50-50 split between primary and secondary colours',
  },
  'split-diagonal': {
    id: 'split-diagonal',
    name: 'Split (D)',
    description: 'Diagonal 50-50 split between primary and secondary colours',
  },
  'quarter-horizontal': {
    id: 'quarter-horizontal',
    name: 'Quarter (H)',
    description: 'Four horizontal quarter bands alternating colours',
  },
  'quarter-diagonal': {
    id: 'quarter-diagonal',
    name: 'Quarter (D)',
    description: 'Four-quadrant colour split with diagonal emphasis',
  },
  'shape-oval': {
    id: 'shape-oval',
    name: 'Oval',
    description: 'Horizontal oval spanning the full width of the piece',
  },
  'shape-circle': {
    id: 'shape-circle',
    name: 'Circle',
    description: 'Secondary colour circle on a primary base',
  },
  'shape-diamond': {
    id: 'shape-diamond',
    name: 'Diamond',
    description: 'Secondary colour diamond on a primary base',
  },
  sunburst: {
    id: 'sunburst',
    name: 'Sunburst',
    description: 'Radiating wedges from a solid central circle',
  },
  checkers: {
    id: 'checkers',
    name: 'Checkers',
    description: 'Alternating checker squares with a solid centre circle (GK default)',
  },
};
