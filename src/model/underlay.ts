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

export type Corner = 'nw' | 'ne' | 'sw' | 'se';

export const MAX_IMAGE_SIDE_PX = 2000;
export const MIN_UNDERLAY_WIDTH_FT = 1;
const FIT_FRACTION = 0.8;

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

export function pointInRect(p: Point, r: Rect): boolean {
  return p.x >= r.x && p.x <= r.x + r.width && p.y >= r.y && p.y <= r.y + r.height;
}

function feetPerPixel(u: Underlay, natural: Size): number {
  return u.widthFt / natural.width;
}

export function worldRectToImage(u: Underlay, natural: Size, r: Rect): Rect {
  const k = feetPerPixel(u, natural);
  return { x: (r.x - u.x) / k, y: (r.y - u.y) / k, width: r.width / k, height: r.height / k };
}

export function imageRectToWorld(u: Underlay, natural: Size, r: Rect): Rect {
  const k = feetPerPixel(u, natural);
  return { x: u.x + r.x * k, y: u.y + r.y * k, width: r.width * k, height: r.height * k };
}

/** Initial placement for a freshly imported image: as large as fits in 80%
 * of the visible area, centered. */
export function fitUnderlayToView(view: Rect, natural: Size): Underlay {
  const aspect = natural.height / natural.width;
  const widthFt = Math.min(view.width * FIT_FRACTION, (view.height * FIT_FRACTION) / aspect);
  const heightFt = widthFt * aspect;
  return {
    x: view.x + (view.width - widthFt) / 2,
    y: view.y + (view.height - heightFt) / 2,
    widthFt,
  };
}

/** Rescale the image so `box` (world feet, drawn over the current
 * placement) becomes `real` feet, then shift it so the box's top-left lands
 * on the nearest grid intersection. With both sides given, the two
 * per-axis scales are averaged. Returns null when no usable side exists. */
export function measureUnderlay(u: Underlay, natural: Size, box: Rect, real: RealSize): Underlay | null {
  const px = worldRectToImage(u, natural, box);
  const scales: number[] = [];
  if (real.width !== null && px.width > 0) scales.push(real.width / px.width);
  if (real.height !== null && px.height > 0) scales.push(real.height / px.height);
  if (scales.length === 0) return null;
  const k = scales.reduce((sum, s) => sum + s, 0) / scales.length;
  const anchorX = snap(box.x, MAJOR_GRID_FT);
  const anchorY = snap(box.y, MAJOR_GRID_FT);
  return { x: anchorX - px.x * k, y: anchorY - px.y * k, widthFt: natural.width * k };
}

/** Aspect-locked resize by dragging `corner` to `pointer`, keeping the
 * opposite corner fixed. The axis implying the larger size wins. */
export function resizeFromCorner(u: Underlay, natural: Size, corner: Corner, pointer: Point): Underlay {
  const aspect = natural.height / natural.width;
  const w = u.widthFt;
  const h = w * aspect;
  const west = corner === 'nw' || corner === 'sw';
  const north = corner === 'nw' || corner === 'ne';
  const anchorX = west ? u.x + w : u.x;
  const anchorY = north ? u.y + h : u.y;
  const widthFt = Math.max(
    Math.abs(pointer.x - anchorX),
    Math.abs(pointer.y - anchorY) / aspect,
    MIN_UNDERLAY_WIDTH_FT,
  );
  return {
    x: west ? anchorX - widthFt : anchorX,
    y: north ? anchorY - widthFt * aspect : anchorY,
    widthFt,
  };
}
