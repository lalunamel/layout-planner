import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { Point } from '../../model/types';
import type { CalibrationAction, CalibrationSession } from '../../model/calibration';
import { lengthFromFeetInches, measureUnderlay, type Rect } from '../../model/underlay';
import styles from './Calibration.module.css';

const POPOVER_MARGIN = 8;

interface CalibrationHudProps {
  session: CalibrationSession;
  dispatch: (action: CalibrationAction) => void;
  worldToScreen: (p: Point) => { left: number; top: number };
  bounds: { width: number; height: number };
  onDone: () => void;
  onCancel: () => void;
}

export function CalibrationHud({ session, dispatch, worldToScreen, bounds, onDone, onCancel }: CalibrationHudProps) {
  let instruction = 'Drag to line the plan up with the grid';
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
          bounds={bounds}
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
  bounds,
  dispatch,
}: {
  session: CalibrationSession;
  box: Rect;
  position: { left: number; top: number };
  bounds: { width: number; height: number };
  dispatch: (action: CalibrationAction) => void;
}) {
  const [width, setWidth] = useState<FeetInches>({ feet: '', inches: '' });
  const [height, setHeight] = useState<FeetInches>({ feet: '', inches: '' });
  const [error, setError] = useState<string | null>(null);
  const [invalid, setInvalid] = useState<{ width: boolean; height: boolean }>({ width: false, height: false });
  const widthRef = useRef<HTMLInputElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const [popoverSize, setPopoverSize] = useState({ width: 0, height: 0 });

  // The error line changes the popover's height, so re-measure when it does.
  useLayoutEffect(() => {
    const el = popoverRef.current;
    if (el) setPopoverSize({ width: el.offsetWidth, height: el.offsetHeight });
  }, [error]);

  useEffect(() => {
    widthRef.current?.focus();
  }, []);

  function apply() {
    const w = lengthFromFeetInches(width.feet, width.inches);
    const h = lengthFromFeetInches(height.feet, height.inches);
    const bad = { width: w === 'invalid', height: h === 'invalid' };
    setInvalid(bad);
    if (w === 'invalid' || h === 'invalid') {
      const inchesTooBig = [width, height].some((v) => Number(v.inches || 0) >= 12);
      setError(inchesTooBig ? 'Inches go from 0 to 11' : 'A size can’t be 0');
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
      ref={popoverRef}
      className={styles.popover}
      style={{
        // Sit just below-right of the box, but stay inside the canvas.
        left: Math.max(POPOVER_MARGIN, Math.min(position.left + POPOVER_MARGIN, bounds.width - popoverSize.width - POPOVER_MARGIN)),
        top: Math.max(POPOVER_MARGIN, Math.min(position.top + POPOVER_MARGIN, bounds.height - popoverSize.height - POPOVER_MARGIN)),
      }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div className={styles.fields}>
        <FeetInchesRow
          label="Width"
          value={width}
          invalid={invalid.width}
          onChange={setWidth}
          onKeyDown={onKeyDown}
          feetRef={widthRef}
        />
        <FeetInchesRow label="Height" value={height} invalid={invalid.height} onChange={setHeight} onKeyDown={onKeyDown} />
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

interface FeetInches {
  feet: string;
  inches: string;
}

const digitsOnly = (text: string) => text.replace(/\D/g, '');

function FeetInchesRow({
  label,
  value,
  invalid,
  onChange,
  onKeyDown,
  feetRef,
}: {
  label: string;
  value: FeetInches;
  invalid: boolean;
  onChange: (value: FeetInches) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  feetRef?: React.Ref<HTMLInputElement>;
}) {
  const inputClass = invalid ? `${styles.unitInput} ${styles.invalid}` : styles.unitInput;
  return (
    <div className={styles.row} role="group" aria-label={label}>
      <span className={styles.rowLabel}>{label}</span>
      <input
        ref={feetRef}
        className={inputClass}
        inputMode="numeric"
        maxLength={3}
        aria-label={`${label} feet`}
        value={value.feet}
        onChange={(e) => onChange({ ...value, feet: digitsOnly(e.target.value) })}
        onKeyDown={onKeyDown}
      />
      <span className={styles.unit}>ft</span>
      <input
        className={inputClass}
        inputMode="numeric"
        maxLength={2}
        aria-label={`${label} inches`}
        value={value.inches}
        onChange={(e) => onChange({ ...value, inches: digitsOnly(e.target.value) })}
        onKeyDown={onKeyDown}
      />
      <span className={styles.unit}>in</span>
    </div>
  );
}
