import { useEffect, useRef, useState } from 'react';
import type { Point } from '../../model/types';
import type { CalibrationAction, CalibrationSession } from '../../model/calibration';
import { measureUnderlay, parseFeetInches, type Rect } from '../../model/underlay';
import styles from './Calibration.module.css';

interface CalibrationHudProps {
  session: CalibrationSession;
  dispatch: (action: CalibrationAction) => void;
  worldToScreen: (p: Point) => { left: number; top: number };
  onDone: () => void;
  onCancel: () => void;
}

export function CalibrationHud({ session, dispatch, worldToScreen, onDone, onCancel }: CalibrationHudProps) {
  let instruction = 'Drag to move · drag corners to resize';
  if (session.step === 'measure') {
    instruction = session.pendingBox ? "Enter the box's real size" : 'Drag a box over a room whose size you know';
  }
  return (
    <>
      <div className={styles.bar}>
        <span className={styles.instruction}>{instruction}</span>
        {session.step === 'adjust' && (
          <button className={styles.btnGhost} onClick={() => dispatch({ type: 'MEASURE_AGAIN' })}>
            Measure again
          </button>
        )}
        <button className={styles.btnGhost} onClick={onCancel}>
          Cancel
        </button>
        <button className={styles.btnPrimary} onClick={onDone}>
          Done
        </button>
      </div>
      {session.pendingBox && (
        <MeasurePopover
          key={`${session.pendingBox.x},${session.pendingBox.y},${session.pendingBox.width},${session.pendingBox.height}`}
          session={session}
          box={session.pendingBox}
          position={worldToScreen({
            x: session.pendingBox.x + session.pendingBox.width,
            y: session.pendingBox.y + session.pendingBox.height,
          })}
          dispatch={dispatch}
        />
      )}
    </>
  );
}

function MeasurePopover({
  session,
  box,
  position,
  dispatch,
}: {
  session: CalibrationSession;
  box: Rect;
  position: { left: number; top: number };
  dispatch: (action: CalibrationAction) => void;
}) {
  const [width, setWidth] = useState('');
  const [height, setHeight] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [invalid, setInvalid] = useState<{ width: boolean; height: boolean }>({ width: false, height: false });
  const widthRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    widthRef.current?.focus();
  }, []);

  function apply() {
    const w = width.trim() ? parseFeetInches(width) : null;
    const h = height.trim() ? parseFeetInches(height) : null;
    const bad = { width: !!width.trim() && w === null, height: !!height.trim() && h === null };
    setInvalid(bad);
    if (bad.width || bad.height) {
      setError('Use a size like 8\'6", 8.5 or 8ft 6in');
      return;
    }
    if (w === null && h === null) {
      setError('Enter a width, a height, or both');
      return;
    }
    if (!session.draft || !measureUnderlay(session.draft, session.natural, box, { width: w, height: h })) {
      setError('That side of the box has no length — draw a bigger box');
      return;
    }
    dispatch({ type: 'APPLY_MEASURE', real: { width: w, height: h } });
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') apply();
    if (e.key === 'Escape') {
      e.stopPropagation();
      dispatch({ type: 'SET_PENDING_BOX', box: null });
    }
  }

  return (
    <div
      className={styles.popover}
      style={{ left: position.left + 8, top: position.top + 8 }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div className={styles.fields}>
        <div className={styles.field}>
          <label htmlFor="measure-width">Width</label>
          <input
            id="measure-width"
            ref={widthRef}
            className={invalid.width ? styles.invalid : undefined}
            placeholder={`8'6"`}
            value={width}
            onChange={(e) => setWidth(e.target.value)}
            onKeyDown={onKeyDown}
          />
        </div>
        <span className={styles.times}>×</span>
        <div className={styles.field}>
          <label htmlFor="measure-height">Height</label>
          <input
            id="measure-height"
            className={invalid.height ? styles.invalid : undefined}
            placeholder={`12'4"`}
            value={height}
            onChange={(e) => setHeight(e.target.value)}
            onKeyDown={onKeyDown}
          />
        </div>
      </div>
      {error && <div className={styles.error}>{error}</div>}
      <div className={styles.actions}>
        <button className={styles.btnGhost} onClick={() => dispatch({ type: 'SET_PENDING_BOX', box: null })}>
          Cancel
        </button>
        <button className={styles.btnPrimary} onClick={apply}>
          Apply
        </button>
      </div>
    </div>
  );
}
