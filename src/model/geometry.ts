import type { Point } from './types';

export const MAJOR_GRID_FT = 1;
export const MINOR_GRID_FT = 0.5;

/** Round a value in feet to the nearest multiple of `resolution` feet. */
export function snap(value: number, resolution: number): number {
  return Math.round(value / resolution) * resolution;
}

export function snapPoint(p: Point, resolution: number): Point {
  return { x: snap(p.x, resolution), y: snap(p.y, resolution) };
}

export function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function snapAngle(degrees: number, step: number): number {
  const snapped = Math.round(degrees / step) * step;
  return ((snapped % 360) + 360) % 360;
}

export function makeId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Axis-aligned bounding box of a polygon, in local space. */
export function boundingBox(points: Point[]): { width: number; height: number } {
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  return {
    width: Math.max(...xs) - Math.min(...xs),
    height: Math.max(...ys) - Math.min(...ys),
  };
}
