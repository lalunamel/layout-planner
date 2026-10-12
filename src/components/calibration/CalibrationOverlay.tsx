import { useEffect, useState } from 'react';
import type { Point, Underlay } from '../../model/types';
import type { CalibrationAction, CalibrationSession } from '../../model/calibration';
import {
  fitUnderlayToView,
  imageRectToWorld,
  normalizeRect,
  pointInRect,
  resizeFromCorner,
  underlayRect,
  type Corner,
  type Rect,
} from '../../model/underlay';
import { DimensionLabel } from '../DrawingAids';
import type { CanvasMode } from '../Canvas';

const MIN_MEASURE_PX = 6;
const HANDLE_PX = 10;
// A side shorter than this on screen (e.g. the thickness of a measured line) gets no dimension label.
const MIN_LABEL_PX = 12;

type Drag =
  | { kind: 'measure'; start: Point; current: Point }
  | { kind: 'move'; start: Point; original: Underlay }
  | { kind: 'resize'; corner: Corner; original: Underlay }
  | null;

interface CalibrationOverlayProps {
  session: CalibrationSession;
  dispatch: (action: CalibrationAction) => void;
  viewRect: Rect;
  scale: number;
  mode: CanvasMode;
  toWorld: (clientX: number, clientY: number) => Point;
}

export function CalibrationOverlay({ session, dispatch, viewRect, scale, mode, toWorld }: CalibrationOverlayProps) {
  const [drag, setDrag] = useState<Drag>(null);
  const { draft, natural, step } = session;

  // A fresh image has no placement yet: fit it to whatever is on screen.
  useEffect(() => {
    if (!draft && viewRect.width > 0) {
      dispatch({ type: 'SET_DRAFT', draft: fitUnderlayToView(viewRect, natural) });
    }
  }, [draft, viewRect, natural, dispatch]);

  useEffect(() => {
    if (!drag) return;
    function onMove(e: MouseEvent) {
      const world = toWorld(e.clientX, e.clientY);
      if (drag!.kind === 'measure') {
        setDrag({ ...drag!, current: world });
      } else if (drag!.kind === 'move') {
        dispatch({
          type: 'SET_DRAFT',
          draft: {
            ...drag!.original,
            x: drag!.original.x + world.x - drag!.start.x,
            y: drag!.original.y + world.y - drag!.start.y,
          },
        });
      } else {
        dispatch({ type: 'SET_DRAFT', draft: resizeFromCorner(drag!.original, natural, drag!.corner, world) });
      }
    }
    function onUp() {
      if (drag!.kind === 'measure') {
        const box = normalizeRect(drag!.start, drag!.current);
        if (box.width * scale >= MIN_MEASURE_PX || box.height * scale >= MIN_MEASURE_PX) {
          dispatch({ type: 'SET_PENDING_BOX', box });
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
  }, [drag, dispatch, natural, scale, toWorld]);

  if (!draft) return null;
  const imageRect = underlayRect(draft, natural);

  function handleMouseDown(e: React.MouseEvent) {
    if (e.button !== 0 || mode !== 'pointer') return; // middle-drag / pan mode bubble to Canvas
    e.stopPropagation();
    const world = toWorld(e.clientX, e.clientY);
    if (step === 'measure') {
      dispatch({ type: 'SET_PENDING_BOX', box: null });
      setDrag({ kind: 'measure', start: world, current: world });
    } else if (pointInRect(world, imageRect)) {
      setDrag({ kind: 'move', start: world, original: draft! });
    }
  }

  function startResize(e: React.MouseEvent, corner: Corner) {
    if (e.button !== 0 || mode !== 'pointer') return;
    e.stopPropagation();
    setDrag({ kind: 'resize', corner, original: draft! });
  }

  const liveBox = drag?.kind === 'measure' ? normalizeRect(drag.start, drag.current) : session.pendingBox;
  const measuredBox = step === 'adjust' && session.measuredBoxPx ? imageRectToWorld(draft, natural, session.measuredBoxPx) : null;
  const handle = HANDLE_PX / scale;
  const corners: { corner: Corner; x: number; y: number; cursor: string }[] = [
    { corner: 'nw', x: imageRect.x, y: imageRect.y, cursor: 'nwse-resize' },
    { corner: 'ne', x: imageRect.x + imageRect.width, y: imageRect.y, cursor: 'nesw-resize' },
    { corner: 'sw', x: imageRect.x, y: imageRect.y + imageRect.height, cursor: 'nesw-resize' },
    { corner: 'se', x: imageRect.x + imageRect.width, y: imageRect.y + imageRect.height, cursor: 'nwse-resize' },
  ];
  const isMoving = drag?.kind === 'move';

  return (
    <g>
      <rect
        x={viewRect.x}
        y={viewRect.y}
        width={viewRect.width}
        height={viewRect.height}
        fill="transparent"
        style={{ pointerEvents: mode === 'pointer' ? 'all' : 'none', cursor: step === 'measure' ? 'crosshair' : 'default' }}
        onMouseDown={handleMouseDown}
      />
      <rect
        x={imageRect.x}
        y={imageRect.y}
        width={imageRect.width}
        height={imageRect.height}
        fill="transparent"
        stroke="var(--blue-500)"
        strokeWidth={1.5}
        vectorEffect="non-scaling-stroke"
        style={{
          pointerEvents: mode === 'pointer' ? 'all' : 'none',
          cursor: step === 'measure' ? 'crosshair' : isMoving ? 'grabbing' : 'move',
        }}
        onMouseDown={handleMouseDown}
      />
      {liveBox && (
        <rect
          x={liveBox.x}
          y={liveBox.y}
          width={liveBox.width}
          height={liveBox.height}
          fill="rgba(79, 134, 214, 0.12)"
          stroke="var(--blue-600)"
          strokeWidth={2}
          strokeDasharray="6 4"
          vectorEffect="non-scaling-stroke"
          style={{ pointerEvents: 'none' }}
        />
      )}
      {measuredBox && (
        <g style={{ pointerEvents: 'none' }}>
          <rect
            x={measuredBox.x}
            y={measuredBox.y}
            width={measuredBox.width}
            height={measuredBox.height}
            fill="none"
            stroke="var(--blue-600)"
            strokeWidth={2}
            strokeDasharray="6 4"
            vectorEffect="non-scaling-stroke"
          />
          {measuredBox.width * scale >= MIN_LABEL_PX && (
            <DimensionLabel
              a={{ x: measuredBox.x, y: measuredBox.y }}
              b={{ x: measuredBox.x + measuredBox.width, y: measuredBox.y }}
              scale={scale}
              color="var(--blue-600)"
            />
          )}
          {measuredBox.height * scale >= MIN_LABEL_PX && (
            <DimensionLabel
              a={{ x: measuredBox.x, y: measuredBox.y }}
              b={{ x: measuredBox.x, y: measuredBox.y + measuredBox.height }}
              scale={scale}
              color="var(--blue-600)"
            />
          )}
        </g>
      )}
      {step === 'adjust' &&
        corners.map(({ corner, x, y, cursor }) => (
          <rect
            key={corner}
            x={x - handle / 2}
            y={y - handle / 2}
            width={handle}
            height={handle}
            rx={2 / scale}
            fill="#fff"
            stroke="var(--blue-600)"
            strokeWidth={1.5}
            vectorEffect="non-scaling-stroke"
            style={{ pointerEvents: mode === 'pointer' ? 'all' : 'none', cursor }}
            onMouseDown={(e) => startResize(e, corner)}
          />
        ))}
    </g>
  );
}
