import { describe, expect, it } from 'vitest';
import { calibrationReducer, type CalibrationSession } from './calibration';

const natural = { width: 1000, height: 500 };
const restore = { src: null, underlay: undefined };

function started(draft: CalibrationSession['draft']): CalibrationSession {
  return calibrationReducer(null, { type: 'START', planId: 'p', src: 'img', natural, draft, restore })!;
}

describe('calibrationReducer', () => {
  it('starts a fresh image in the measure step', () => {
    const s = started(null);
    expect(s.step).toBe('measure');
    expect(s.draft).toBeNull();
    expect(s.pendingBox).toBeNull();
    expect(s.restore).toEqual(restore);
  });

  it('starts a recalibration in the adjust step', () => {
    expect(started({ x: 0, y: 0, widthFt: 10 }).step).toBe('adjust');
  });

  it('applies a measurement: rescales, records the box, moves to adjust', () => {
    let s = calibrationReducer(started(null), { type: 'SET_DRAFT', draft: { x: 0, y: 0, widthFt: 100 } });
    s = calibrationReducer(s, { type: 'SET_PENDING_BOX', box: { x: 10, y: 5, width: 10, height: 5 } });
    s = calibrationReducer(s, { type: 'APPLY_MEASURE', real: { width: 20, height: null } })!;
    expect(s.step).toBe('adjust');
    expect(s.pendingBox).toBeNull();
    expect(s.draft!.widthFt).toBeCloseTo(200);
    expect(s.measuredBoxPx!.x).toBeCloseTo(100);
    expect(s.measuredBoxPx!.width).toBeCloseTo(100);
  });

  it('ignores APPLY_MEASURE that cannot be measured', () => {
    let s = calibrationReducer(started(null), { type: 'SET_DRAFT', draft: { x: 0, y: 0, widthFt: 100 } });
    s = calibrationReducer(s, { type: 'SET_PENDING_BOX', box: { x: 10, y: 5, width: 3, height: 0 } });
    const after = calibrationReducer(s, { type: 'APPLY_MEASURE', real: { width: null, height: 4 } });
    expect(after).toBe(s);
  });

  it('ignores APPLY_MEASURE with no pending box', () => {
    const s = calibrationReducer(started(null), { type: 'SET_DRAFT', draft: { x: 0, y: 0, widthFt: 100 } });
    expect(calibrationReducer(s, { type: 'APPLY_MEASURE', real: { width: 5, height: null } })).toBe(s);
  });

  it('measure again clears the boxes and returns to measure', () => {
    const s = calibrationReducer(
      { ...started({ x: 0, y: 0, widthFt: 10 }), measuredBoxPx: { x: 1, y: 1, width: 1, height: 1 } },
      { type: 'MEASURE_AGAIN' },
    )!;
    expect(s.step).toBe('measure');
    expect(s.measuredBoxPx).toBeNull();
    expect(s.pendingBox).toBeNull();
  });

  it('ends the session', () => {
    expect(calibrationReducer(started(null), { type: 'END' })).toBeNull();
  });

  it('ignores non-START actions when idle', () => {
    expect(calibrationReducer(null, { type: 'MEASURE_AGAIN' })).toBeNull();
  });
});
