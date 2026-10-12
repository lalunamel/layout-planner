import type { Point, Underlay } from './types';
import { MAJOR_GRID_FT, snap } from './geometry';

const WHOLE_NUMBER = /^\d+$/;

/** Combine a feet field and an inches field into feet. Either may be blank
 * (counted as 0). Returns null when both are blank, and 'invalid' for
 * anything but whole numbers, inches of 12 or more, or a zero length. */
export function lengthFromFeetInches(feet: string, inches: string): number | null | 'invalid' {
  const ft = feet.trim();
  const inch = inches.trim();
  if (!ft && !inch) return null;
  if ((ft && !WHOLE_NUMBER.test(ft)) || (inch && !WHOLE_NUMBER.test(inch))) return 'invalid';
  const inchValue = Number(inch || 0);
  if (inchValue >= 12) return 'invalid';
  const total = Number(ft || 0) + inchValue / 12;
  return total > 0 ? total : 'invalid';
}

export interface Size {
  width: number;
  height: number;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Real-world size the user typed for a measured box; either side may be omitted. */
export interface RealSize {
  width: number | null;
  height: number | null;
}

export const MAX_IMAGE_SIDE_PX = 2000;

export function fitWithin(size: Size, maxSide: number): Size {
  const longest = Math.max(size.width, size.height);
  if (longest <= maxSide) return size;
  const k = maxSide / longest;
  return { width: Math.round(size.width * k), height: Math.round(size.height * k) };
}

export function underlayHeightFt(u: Underlay, natural: Size): number {
  return (u.widthFt * natural.height) / natural.width;
}

export function underlayRect(u: Underlay, natural: Size): Rect {
  return { x: u.x, y: u.y, width: u.widthFt, height: underlayHeightFt(u, natural) };
}

export function normalizeRect(a: Point, b: Point): Rect {
  return {
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    width: Math.abs(a.x - b.x),
    height: Math.abs(a.y - b.y),
  };
}

function feetPerPixel(u: Underlay, natural: Size): number {
  return u.widthFt / natural.width;
}

export function imageRectToWorld(u: Underlay, natural: Size, r: Rect): Rect {
  const k = feetPerPixel(u, natural);
  return { x: u.x + r.x * k, y: u.y + r.y * k, width: r.width * k, height: r.height * k };
}

/** Feet per image pixel implied by a box (image px) whose real size is
 * `real`. With both sides given, the two per-axis scales are averaged.
 * Returns null when no given side has length in the box. */
export function scaleFromMeasurement(boxPx: Rect, real: RealSize): number | null {
  const scales: number[] = [];
  if (real.width !== null && boxPx.width > 0) scales.push(real.width / boxPx.width);
  if (real.height !== null && boxPx.height > 0) scales.push(real.height / boxPx.height);
  if (scales.length === 0) return null;
  return scales.reduce((sum, s) => sum + s, 0) / scales.length;
}

/** Place an image at `ftPerPx` so the measured box's top-left lands on the
 * grid intersection nearest `anchor` (world feet). */
export function underlayFromScale(natural: Size, boxPx: Rect, ftPerPx: number, anchor: Point): Underlay {
  return {
    x: snap(anchor.x, MAJOR_GRID_FT) - boxPx.x * ftPerPx,
    y: snap(anchor.y, MAJOR_GRID_FT) - boxPx.y * ftPerPx,
    widthFt: natural.width * ftPerPx,
  };
}
