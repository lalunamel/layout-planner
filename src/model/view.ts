export interface View {
  x: number; // world x (feet) at the left edge of the viewport
  y: number; // world y (feet) at the top edge of the viewport
  scale: number; // pixels per foot
}

export const MIN_SCALE = 8;
export const MAX_SCALE = 90;
export const DEFAULT_SCALE = 24;
export const MINOR_GRID_VISIBLE_SCALE = 30;

export function clampScale(scale: number): number {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale));
}

export const SCALE_BAR_MAX_PX = 160;

/** Round lengths the map-style scale bar can show, each split into
 * alternating segments small enough to read a single foot when zoomed in. */
const SCALE_BAR_STEPS = [
  { totalFt: 1, segmentFt: 0.5 },
  { totalFt: 2, segmentFt: 1 },
  { totalFt: 5, segmentFt: 1 },
  { totalFt: 10, segmentFt: 2 },
  { totalFt: 20, segmentFt: 5 },
];

/** The longest scale-bar length that fits in SCALE_BAR_MAX_PX at `scale` px/ft. */
export function pickScaleBar(scale: number): { totalFt: number; segmentFt: number } {
  let best = SCALE_BAR_STEPS[0];
  for (const step of SCALE_BAR_STEPS) {
    if (step.totalFt * scale <= SCALE_BAR_MAX_PX) best = step;
  }
  return best;
}
