import { describe, expect, it } from 'vitest';
import { MAX_SCALE, MIN_SCALE, pickScaleBar, SCALE_BAR_MAX_PX } from './view';

describe('pickScaleBar', () => {
  it('picks the longest round length that fits', () => {
    expect(pickScaleBar(24)).toEqual({ totalFt: 5, segmentFt: 1 }); // 120px
    expect(pickScaleBar(40)).toEqual({ totalFt: 2, segmentFt: 1 }); // 80px; 5ft would be 200px
    expect(pickScaleBar(16)).toEqual({ totalFt: 10, segmentFt: 2 }); // 160px
  });

  it('shows a single foot in 6-inch halves when zoomed far in', () => {
    expect(pickScaleBar(MAX_SCALE)).toEqual({ totalFt: 1, segmentFt: 0.5 });
  });

  it('shows 20 ft in 5 ft segments when zoomed far out', () => {
    expect(pickScaleBar(MIN_SCALE)).toEqual({ totalFt: 20, segmentFt: 5 });
  });

  it('never exceeds the max bar width across the zoom range', () => {
    for (let scale = MIN_SCALE; scale <= MAX_SCALE; scale += 0.5) {
      expect(pickScaleBar(scale).totalFt * scale).toBeLessThanOrEqual(SCALE_BAR_MAX_PX);
    }
  });
});
