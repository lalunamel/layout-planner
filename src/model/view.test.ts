import { describe, expect, it } from 'vitest';
import { MAX_SCALE, MIN_SCALE, pickScaleBar, SCALE_BAR_MAX_PX } from './view';

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
