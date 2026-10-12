import { describe, expect, it } from 'vitest';
import {
  fitWithin,
  imageRectToWorld,
  normalizeRect,
  lengthFromFeetInches,
  underlayHeightFt,
  underlayRect,
  scaleFromMeasurement,
  underlayFromScale,
} from './underlay';

const natural = { width: 1000, height: 500 };
const base = { x: 0, y: 0, widthFt: 100 }; // 0.1 ft per image px

describe('lengthFromFeetInches', () => {
  it.each([
    ['8', '6', 8.5],
    ['8', '', 8],
    ['8', '0', 8],
    ['', '6', 0.5],
    ['12', '4', 12 + 4 / 12],
    [' 9 ', ' 3 ', 9.25],
    ['0', '11', 11 / 12],
  ])('reads %j ft %j in as %d ft', (feet, inches, expected) => {
    expect(lengthFromFeetInches(feet, inches)).toBeCloseTo(expected as number, 6);
  });

  it('treats two empty fields as no value', () => {
    expect(lengthFromFeetInches('', '')).toBeNull();
    expect(lengthFromFeetInches('  ', ' ')).toBeNull();
  });

  it.each([
    ['8', '12'],
    ['8.5', ''],
    ['', '6.5'],
    ['-1', ''],
    ['abc', ''],
    ['0', '0'],
    ['0', ''],
  ])('rejects %j ft %j in', (feet, inches) => {
    expect(lengthFromFeetInches(feet, inches)).toBe('invalid');
  });
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
  it('maps an image pixel rect into world feet', () => {
    const u = { x: 4, y: -2, widthFt: 50 }; // 0.05 ft/px
    expect(imageRectToWorld(u, natural, { x: 100, y: 100, width: 100, height: 50 })).toEqual({
      x: 9,
      y: 3,
      width: 5,
      height: 2.5,
    });
  });
});

describe('scaleFromMeasurement', () => {
  const box = { x: 100, y: 50, width: 100, height: 50 };
  it('derives feet per image pixel from one side', () => {
    expect(scaleFromMeasurement(box, { width: 20, height: null })).toBeCloseTo(0.2);
    expect(scaleFromMeasurement(box, { width: null, height: 10 })).toBeCloseTo(0.2);
  });
  it('averages the two per-axis scales when both are given', () => {
    expect(scaleFromMeasurement(box, { width: 20, height: 12 })).toBeCloseTo(0.22); // 0.2 and 0.24
  });
  it('measures a single horizontal line using only the width', () => {
    expect(scaleFromMeasurement({ x: 0, y: 0, width: 30, height: 0 }, { width: 3, height: null })).toBeCloseTo(0.1);
  });
  it('rejects a dimension for a side the box does not have', () => {
    expect(scaleFromMeasurement({ x: 0, y: 0, width: 30, height: 0 }, { width: null, height: 4 })).toBeNull();
  });
  it('rejects when no dimension is given', () => {
    expect(scaleFromMeasurement(box, { width: null, height: null })).toBeNull();
  });
});

describe('underlayFromScale', () => {
  it('sizes the image and lands the measured box on the grid line nearest the anchor', () => {
    const box = { x: 100, y: 50, width: 100, height: 50 };
    const u = underlayFromScale(natural, box, 0.2, { x: 10.4, y: 5.6 });
    expect(u.widthFt).toBeCloseTo(200);
    expect(u.x).toBeCloseTo(-10); // box left 100px * 0.2 = 20 ft right of the image edge, at x=10
    expect(u.y).toBeCloseTo(-4); // box top 50px * 0.2 = 10 ft below the image edge, at y=6
    const measured = imageRectToWorld(u, natural, box);
    expect(measured.x).toBeCloseTo(10);
    expect(measured.y).toBeCloseTo(6);
    expect(measured.width).toBeCloseTo(20);
  });
});
