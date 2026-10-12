import { useEffect, useRef, useState } from 'react';
import type { Point } from '../../model/types';
import { lengthFromFeetInches, normalizeRect, scaleFromMeasurement, type Rect, type Size } from '../../model/underlay';
import { fitView, type View } from '../../model/view';
import styles from './Calibration.module.css';

export const CALIBRATION_INSTRUCTION = 'Outline an area with a labeled length and width on the uploaded floor plan';

// Zoom here is screen px per image px, not px per foot — the scale in feet
// is what this panel is working out.
const MIN_ZOOM = 0.05;
const MAX_ZOOM = 8;
const MIN_BOX_PX = 6;
// Below this on-screen spacing the 1 ft preview grid is just noise.
const MIN_GRID_SPACING_PX = 4;

const clampZoom = (zoom: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));

type Drag =
  | { kind: 'outline'; start: Point; current: Point }
  | { kind: 'pan'; x0: number; y0: number; start: View }
  | null;

const EMPTY: FeetInches = { feet: '', inches: '' };

export interface CalibrationPanelProps {
  src: string;
  natural: Size;
  /** Returns an error message to show, or null once saved. */
  onSave: (boxPx: Rect, ftPerPx: number) => string | null;
  onCancel: () => void;
  cancelLabel?: string;
}

/** Calibration step: the user outlines a room whose size is printed on the
 * image and types that size; a 1 ft grid previews the resulting scale. */
export function CalibrationPanel({ src, natural, onSave, onCancel, cancelLabel = 'Cancel' }: CalibrationPanelProps) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const widthFeetRef = useRef<HTMLInputElement | null>(null);
  const onCancelRef = useRef(onCancel);
  onCancelRef.current = onCancel;
  const [size, setSize] = useState<Size>({ width: 0, height: 0 });
  const [view, setView] = useState<View | null>(null);
  const [drag, setDrag] = useState<Drag>(null);
  const [box, setBox] = useState<Rect | null>(null);
  const [width, setWidth] = useState<FeetInches>(EMPTY);
  const [height, setHeight] = useState<FeetInches>(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [spaceHeld, setSpaceHeld] = useState(false);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) setSize({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Show the whole image once the panel has a size.
  useEffect(() => {
    if (!view && size.width > 0) {
      setView(fitView({ x: 0, y: 0, width: natural.width, height: natural.height }, size, clampZoom));
    }
  }, [view, size, natural]);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    function onWheel(e: WheelEvent) {
      e.preventDefault();
      const rect = el!.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      setView((v) => {
        if (!v) return v;
        const scale = clampZoom(v.scale * Math.exp(-e.deltaY * 0.0015));
        return {
          x: v.x + mouseX / v.scale - mouseX / scale,
          y: v.y + mouseY / v.scale - mouseY / scale,
          scale,
        };
      });
    }
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  useEffect(() => {
    function isTyping(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      return !!target && ['INPUT', 'TEXTAREA'].includes(target.tagName);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onCancelRef.current();
      if (e.code === 'Space' && !isTyping(e)) {
        e.preventDefault();
        setSpaceHeld(true);
      }
    }
    function onKeyUp(e: KeyboardEvent) {
      if (e.code === 'Space') setSpaceHeld(false);
    }
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, []);

  function toImage(clientX: number, clientY: number): Point {
    const rect = wrapRef.current!.getBoundingClientRect();
    const x = view!.x + (clientX - rect.left) / view!.scale;
    const y = view!.y + (clientY - rect.top) / view!.scale;
    return {
      x: Math.min(natural.width, Math.max(0, x)),
      y: Math.min(natural.height, Math.max(0, y)),
    };
  }

  useEffect(() => {
    if (!drag) return;
    function onMove(e: MouseEvent) {
      if (drag!.kind === 'pan') {
        const { x0, y0, start } = drag!;
        setView({ ...start, x: start.x - (e.clientX - x0) / start.scale, y: start.y - (e.clientY - y0) / start.scale });
      } else {
        setDrag({ ...drag!, current: toImage(e.clientX, e.clientY) });
      }
    }
    function onUp() {
      if (drag!.kind === 'outline' && view) {
        const outlined = normalizeRect(drag!.start, drag!.current);
        if (outlined.width * view.scale >= MIN_BOX_PX || outlined.height * view.scale >= MIN_BOX_PX) {
          setBox(outlined);
          setError(null);
          widthFeetRef.current?.focus();
        }
      }
      setDrag(null);
    }
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drag]);

  function handleMouseDown(e: React.MouseEvent) {
    if (!view) return;
    if (e.button === 1 || (e.button === 0 && spaceHeld)) {
      e.preventDefault();
      setDrag({ kind: 'pan', x0: e.clientX, y0: e.clientY, start: view });
    } else if (e.button === 0) {
      const p = toImage(e.clientX, e.clientY);
      setDrag({ kind: 'outline', start: p, current: p });
    }
  }

  const w = lengthFromFeetInches(width.feet, width.inches);
  const h = lengthFromFeetInches(height.feet, height.inches);
  const real = { width: typeof w === 'number' ? w : null, height: typeof h === 'number' ? h : null };
  const ftPerPx = box ? scaleFromMeasurement(box, real) : null;
  const nothingEntered = w === null && h === null;

  function save() {
    if (!box) return;
    if (w === 'invalid' || h === 'invalid') {
      const inchesTooBig = [width, height].some((v) => Number(v.inches || 0) >= 12);
      setError(inchesTooBig ? 'Inches go from 0 to 11' : 'A size can’t be 0');
      return;
    }
    if (nothingEntered) {
      setError('Enter the width, the height, or both');
      return;
    }
    if (ftPerPx === null) {
      setError('That side of the outline has no length — outline a bigger area');
      return;
    }
    setError(onSave(box, ftPerPx));
  }

  function onFieldKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') save();
  }

  const liveBox = drag?.kind === 'outline' ? normalizeRect(drag.start, drag.current) : box;
  const gridSpacing = ftPerPx ? 1 / ftPerPx : null; // image px per foot
  const showGrid = !!(view && box && gridSpacing && gridSpacing * view.scale >= MIN_GRID_SPACING_PX);
  let status = 'No area outlined yet';
  if (box && nothingEntered) status = 'Enter the size labeled on the plan for that area';
  else if (showGrid) status = 'The grid shows 1 ft squares at this scale';
  const cursor = drag?.kind === 'pan' ? 'grabbing' : spaceHeld ? 'grab' : 'crosshair';

  return (
    <div className={styles.panel} role="dialog" aria-label="Calibrate floor plan image">
      <div className={styles.header}>
        <p className={styles.instruction}>{CALIBRATION_INSTRUCTION}</p>
        <p className={styles.hint}>Drag to outline · scroll to zoom · hold Space and drag to pan</p>
        <p className={styles.note}>
          Floor plans from listings are likely not to scale, so the grid may not line up exactly with every room.
        </p>
      </div>
      <div className={styles.canvasWrap} ref={wrapRef}>
        {view && size.width > 0 && (
          <svg
            width={size.width}
            height={size.height}
            viewBox={`${view.x} ${view.y} ${size.width / view.scale} ${size.height / view.scale}`}
            style={{ cursor }}
            onMouseDown={handleMouseDown}
          >
            {showGrid && (
              <defs>
                <pattern
                  id="calibrationGrid"
                  patternUnits="userSpaceOnUse"
                  x={box!.x}
                  y={box!.y}
                  width={gridSpacing!}
                  height={gridSpacing!}
                >
                  <path
                    d={`M ${gridSpacing} 0 L 0 0 0 ${gridSpacing}`}
                    fill="none"
                    stroke="var(--blue-500)"
                    strokeOpacity={0.5}
                    strokeWidth={1 / view.scale}
                  />
                </pattern>
              </defs>
            )}
            <image href={src} x={0} y={0} width={natural.width} height={natural.height} />
            {showGrid && (
              <rect
                x={0}
                y={0}
                width={natural.width}
                height={natural.height}
                fill="url(#calibrationGrid)"
                style={{ pointerEvents: 'none' }}
              />
            )}
            {liveBox && (
              <rect
                x={liveBox.x}
                y={liveBox.y}
                width={liveBox.width}
                height={liveBox.height}
                fill="rgba(79, 134, 214, 0.15)"
                stroke="var(--blue-600)"
                strokeWidth={2}
                vectorEffect="non-scaling-stroke"
                style={{ pointerEvents: 'none' }}
              />
            )}
          </svg>
        )}
      </div>
      <div className={styles.footer}>
        <div className={styles.fields}>
          <FeetInchesRow
            label="Width ↔"
            value={width}
            invalid={w === 'invalid'}
            onChange={setWidth}
            onKeyDown={onFieldKeyDown}
            feetRef={widthFeetRef}
          />
          <FeetInchesRow
            label="Height ↕"
            value={height}
            invalid={h === 'invalid'}
            onChange={setHeight}
            onKeyDown={onFieldKeyDown}
          />
        </div>
        <div className={error ? `${styles.status} ${styles.error}` : styles.status}>{error ?? status}</div>
        <div className={styles.actions}>
          <button className={styles.btnGhost} onClick={onCancel}>
            {cancelLabel}
          </button>
          <button className={styles.btnPrimary} disabled={!box || nothingEntered} onClick={save}>
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

/** The calibration panel on its own, for images added to an existing plan. */
export function CalibrationModal(props: CalibrationPanelProps) {
  return (
    <div className={styles.scrim}>
      <CalibrationPanel {...props} />
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
