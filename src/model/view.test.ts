import { describe, expect, it } from 'vitest';
import { clampScale, fitView, MAX_SCALE, MIN_SCALE, pickScaleBar, SCALE_BAR_MAX_PX } from './view';

describe('pickScaleBar', () => {
  it('picks the longest round length that fits', () => {
    expect(pickScaleBar(24)).toBe(5); // 120px
    expect(pickScaleBar(40)).toBe(2); // 80px; 5ft would be 200px
    expect(pickScaleBar(16)).toBe(10); // 160px
  });

  it('shows a single foot when zoomed far in', () => {
    expect(pickScaleBar(MAX_SCALE)).toBe(1);
  });

  it('shows 20 ft when zoomed far out', () => {
    expect(pickScaleBar(MIN_SCALE)).toBe(20);
  });

  it('never exceeds the max bar width across the zoom range', () => {
    for (let scale = MIN_SCALE; scale <= MAX_SCALE; scale += 0.5) {
      expect(pickScaleBar(scale) * scale).toBeLessThanOrEqual(SCALE_BAR_MAX_PX);
    }
  });
});

describe('fitView', () => {
  const rect = { x: 0, y: 0, width: 100, height: 50 };
  it('centers the rect, filling 90% of the tighter axis', () => {
    const v = fitView(rect, { width: 800, height: 600 });
    expect(v.scale).toBeCloseTo(7.2); // min(800/100, 600/50) * 0.9
    expect(v.x).toBeCloseTo(50 - 400 / 7.2);
    expect(v.y).toBeCloseTo(25 - 300 / 7.2);
  });
  it('keeps the rect centered when the scale is clamped', () => {
    const v = fitView({ x: 0, y: 0, width: 1, height: 1 }, { width: 800, height: 600 }, clampScale);
    expect(v.scale).toBe(MAX_SCALE);
    expect(v.x).toBeCloseTo(0.5 - 400 / MAX_SCALE);
    expect(v.y).toBeCloseTo(0.5 - 300 / MAX_SCALE);
  });
});
