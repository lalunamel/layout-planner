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
