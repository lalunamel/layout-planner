import { describe, expect, it } from 'vitest';
import {
  fitUnderlayToView,
  fitWithin,
  imageRectToWorld,
  measureUnderlay,
  normalizeRect,
  parseFeetInches,
  pointInRect,
  resizeFromCorner,
  underlayHeightFt,
  underlayRect,
  worldRectToImage,
} from './underlay';

const natural = { width: 1000, height: 500 };
const base = { x: 0, y: 0, widthFt: 100 }; // 0.1 ft per image px

describe('parseFeetInches', () => {
  it.each([
    ["8'6\"", 8.5],
    ["8' 6\"", 8.5],
    ["8'-6\"", 8.5],
    ["8'", 8],
    ['6"', 0.5],
    ['8.5', 8.5],
    ['8', 8],
    ['8ft 6in', 8.5],
    ['8 ft 6 in', 8.5],
    ['8 ft', 8],
    ['12 feet 4 inches', 12 + 4 / 12],
    ['8’ 6”', 8.5],
    ['8′6″', 8.5],
    ['  9\'  ', 9],
    ['30in', 2.5],
  ])('parses %j as %d ft', (input, expected) => {
    expect(parseFeetInches(input)).toBeCloseTo(expected, 6);
  });

  it.each(['', '   ', 'abc', '8 6', "8'6", '-3', '0', "0'", '8..5', "6\" 8'", '8ft6ft'])(
    'rejects %j',
    (input) => {
      expect(parseFeetInches(input)).toBeNull();
    },
  );
});

describe('fitWithin', () => {
  it('leaves small images alone', () => {
    expect(fitWithin({ width: 800, height: 600 }, 2000)).toEqual({ width: 800, height: 600 });
    expect(fitWithin({ width: 2000, height: 1000 }, 2000)).toEqual({ width: 2000, height: 1000 });
  });
  it('scales landscape images by the longest side', () => {
    expect(fitWithin({ width: 4000, height: 3000 }, 2000)).toEqual({ width: 2000, height: 1500 });
  });
  it('scales portrait images by the longest side, rounding', () => {
    expect(fitWithin({ width: 1200, height: 3600 }, 2000)).toEqual({ width: 667, height: 2000 });
  });
});

describe('underlay rects', () => {
  it('derives height from the aspect ratio', () => {
    expect(underlayHeightFt(base, natural)).toBe(50);
    expect(underlayRect({ x: 2, y: 3, widthFt: 10 }, natural)).toEqual({ x: 2, y: 3, width: 10, height: 5 });
  });
  it('normalizes a rect dragged in any direction', () => {
    expect(normalizeRect({ x: 5, y: 1 }, { x: 2, y: 4 })).toEqual({ x: 2, y: 1, width: 3, height: 3 });
  });
  it('hit-tests inclusive of edges', () => {
    const r = { x: 0, y: 0, width: 10, height: 5 };
    expect(pointInRect({ x: 10, y: 5 }, r)).toBe(true);
    expect(pointInRect({ x: 10.01, y: 2 }, r)).toBe(false);
  });
  it('round-trips world <-> image pixel rects', () => {
    const u = { x: 4, y: -2, widthFt: 50 }; // 0.05 ft/px
    const world = { x: 9, y: 3, width: 5, height: 2.5 };
    const px = worldRectToImage(u, natural, world);
    expect(px.x).toBeCloseTo(100);
    expect(px.y).toBeCloseTo(100);
    expect(px.width).toBeCloseTo(100);
    expect(px.height).toBeCloseTo(50);
    const back = imageRectToWorld(u, natural, px);
    expect(back.x).toBeCloseTo(9);
    expect(back.y).toBeCloseTo(3);
    expect(back.width).toBeCloseTo(5);
    expect(back.height).toBeCloseTo(2.5);
  });
});

describe('fitUnderlayToView', () => {
  it('fits within 80% of the view, centered', () => {
    expect(fitUnderlayToView({ x: 0, y: 0, width: 40, height: 30 }, natural)).toEqual({ x: 4, y: 7, widthFt: 32 });
  });
  it('is limited by height for tall images', () => {
    const u = fitUnderlayToView({ x: 10, y: 10, width: 40, height: 30 }, { width: 500, height: 1000 });
    expect(u.widthFt).toBeCloseTo(12); // 80% of 30 = 24 tall → 12 wide
    expect(u.x).toBeCloseTo(10 + (40 - 12) / 2);
    expect(u.y).toBeCloseTo(10 + (30 - 24) / 2);
  });
});

describe('measureUnderlay', () => {
  it('scales from one dimension, anchoring the box on a grid line', () => {
    const box = { x: 10, y: 5, width: 10, height: 5 }; // 100 x 50 image px
    const u = measureUnderlay(base, natural, box, { width: 20, height: null })!;
    expect(u.widthFt).toBeCloseTo(200); // 0.2 ft/px
    expect(u.x).toBeCloseTo(-10); // box px x=100 → 10 - 100*0.2
    expect(u.y).toBeCloseTo(-5);
  });
  it('averages the two per-axis scales when both are given', () => {
    const box = { x: 10, y: 5, width: 10, height: 5 };
    const u = measureUnderlay(base, natural, box, { width: 20, height: 12 })!; // 0.2 and 0.24
    expect(u.widthFt).toBeCloseTo(220);
  });
  it('snaps the measured box top-left to the nearest 1 ft grid line', () => {
    const box = { x: 10.4, y: 5.6, width: 10, height: 5 }; // px x=104, y=56
    const u = measureUnderlay(base, natural, box, { width: 20, height: null })!;
    const measured = imageRectToWorld(u, natural, worldRectToImage(base, natural, box));
    expect(measured.x).toBeCloseTo(10);
    expect(measured.y).toBeCloseTo(6);
    expect(measured.width).toBeCloseTo(20);
  });
  it('measures a single horizontal line using only the width', () => {
    const line = { x: 10, y: 5, width: 3, height: 0 };
    const u = measureUnderlay(base, natural, line, { width: 3, height: null })!;
    expect(u.widthFt).toBeCloseTo(100);
  });
  it('rejects a dimension for a side the box does not have', () => {
    const line = { x: 10, y: 5, width: 3, height: 0 };
    expect(measureUnderlay(base, natural, line, { width: null, height: 4 })).toBeNull();
  });
  it('rejects when no dimension is given', () => {
    expect(measureUnderlay(base, natural, { x: 0, y: 0, width: 1, height: 1 }, { width: null, height: null })).toBeNull();
  });
});

describe('resizeFromCorner', () => {
  const u = { x: 0, y: 0, widthFt: 10 }; // 10 x 5
  it('resizes from the south-east corner, anchored at north-west', () => {
    expect(resizeFromCorner(u, natural, 'se', { x: 20, y: 6 })).toEqual({ x: 0, y: 0, widthFt: 20 });
  });
  it('uses whichever axis implies the larger size', () => {
    expect(resizeFromCorner(u, natural, 'se', { x: 4, y: 10 })).toEqual({ x: 0, y: 0, widthFt: 20 });
  });
  it('resizes from the north-west corner, anchored at south-east', () => {
    expect(resizeFromCorner(u, natural, 'nw', { x: -10, y: 0 })).toEqual({ x: -10, y: -5, widthFt: 20 });
  });
  it('resizes from the north-east and south-west corners', () => {
    expect(resizeFromCorner(u, natural, 'ne', { x: 20, y: 0 })).toEqual({ x: 0, y: -5, widthFt: 20 });
    expect(resizeFromCorner(u, natural, 'sw', { x: -10, y: 5 })).toEqual({ x: -10, y: 0, widthFt: 20 });
  });
  it('never shrinks below the minimum width', () => {
    expect(resizeFromCorner(u, natural, 'se', { x: 0.1, y: 0.1 }).widthFt).toBe(1);
  });
});
