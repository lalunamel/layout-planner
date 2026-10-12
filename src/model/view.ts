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

/** Round lengths, in feet, the scale legend can show. */
const SCALE_BAR_LENGTHS_FT = [1, 2, 5, 10, 20];

/** The longest round length that fits in SCALE_BAR_MAX_PX at `scale` px/ft. */
export function pickScaleBar(scale: number): number {
  let best = SCALE_BAR_LENGTHS_FT[0];
  for (const ft of SCALE_BAR_LENGTHS_FT) {
    if (ft * scale <= SCALE_BAR_MAX_PX) best = ft;
  }
  return best;
}
