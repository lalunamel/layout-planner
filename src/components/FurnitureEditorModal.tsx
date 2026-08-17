import { useEffect, useRef, useState } from 'react';
import type { FurnitureTemplate, Point } from '../model/types';
import { distance, polygonPath, snapPoint } from '../model/geometry';
import { GhostPoint, RubberBandPreview } from './DrawingAids';
import styles from './FurnitureEditorModal.module.css';

const SNAP_FT = 0.5;
const DEFAULT_SCALE = 48; // px per foot — furniture is small (most under ~8ft), so start zoomed in
const MIN_SCALE = 20;
const MAX_SCALE = 160;

function clampScale(scale: number): number {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale));
}

interface FurnitureEditorModalProps {
  editing: FurnitureTemplate | null;
  onSave: (name: string, points: Point[]) => void;
  onCancel: () => void;
}

export function FurnitureEditorModal({ editing, onSave, onCancel }: FurnitureEditorModalProps) {
  const [name, setName] = useState(editing?.name ?? '');
  const [points, setPoints] = useState<Point[]>(editing?.points ?? []);
  const [drawingPoints, setDrawingPoints] = useState<Point[] | null>(null);
  const [hoverPoint, setHoverPoint] = useState<Point | null>(null);
  const [view, setView] = useState({ x: -1, y: -1, scale: DEFAULT_SCALE });
  const svgRef = useRef<SVGSVGElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const nameRef = useRef<HTMLInputElement | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    nameRef.current?.focus();
    nameRef.current?.select();
  }, []);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      setSize({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onCancel();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    function onWheel(e: WheelEvent) {
      e.preventDefault();
      const rect = el!.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      setView((v) => {
        const worldXAtMouse = v.x + mouseX / v.scale;
        const worldYAtMouse = v.y + mouseY / v.scale;
        const zoomFactor = Math.exp(-e.deltaY * 0.0015);
        const newScale = clampScale(v.scale * zoomFactor);
        return {
          x: worldXAtMouse - mouseX / newScale,
          y: worldYAtMouse - mouseY / newScale,
          scale: newScale,
        };
      });
    }
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  function toLocal(clientX: number, clientY: number): Point {
    const rect = svgRef.current!.getBoundingClientRect();
    return { x: view.x + (clientX - rect.left) / view.scale, y: view.y + (clientY - rect.top) / view.scale };
  }

  function handleMouseMove(e: React.MouseEvent<SVGSVGElement>) {
    setHoverPoint(snapPoint(toLocal(e.clientX, e.clientY), SNAP_FT));
  }

  function handleMouseLeave() {
    setHoverPoint(null);
  }

  function handleClick(e: React.MouseEvent<SVGSVGElement>) {
    const raw = toLocal(e.clientX, e.clientY);
    const pt = snapPoint(raw, SNAP_FT);

    if (!drawingPoints) {
      setPoints([]);
      setDrawingPoints([pt]);
      return;
    }
    const start = drawingPoints[0];
    if (drawingPoints.length >= 2 && distance(pt, start) < 10 / view.scale) {
      setPoints(drawingPoints);
      setDrawingPoints(null);
    } else {
      setDrawingPoints([...drawingPoints, pt]);
    }
  }

  const canSave = name.trim().length > 0 && points.length >= 3;
  const vw = size.width > 0 ? size.width / view.scale : 0;
  const vh = size.height > 0 ? size.height / view.scale : 0;

  return (
    <div className={styles.scrim} onMouseDown={(e) => e.target === e.currentTarget && onCancel()}>
      <div className={styles.panel}>
        <div className={styles.top}>
          <input
            ref={nameRef}
            className={styles.nameInput}
            placeholder="Couch"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div className={styles.body}>
          <div className={styles.canvasWrap} ref={wrapRef}>
            {size.width > 0 && (
              <svg
                ref={svgRef}
                width={size.width}
                height={size.height}
                viewBox={`${view.x} ${view.y} ${vw} ${vh}`}
                onClick={handleClick}
                onMouseMove={handleMouseMove}
                onMouseLeave={handleMouseLeave}
                style={{ cursor: 'crosshair' }}
              >
                <defs>
                  <pattern id="editorGrid" width={SNAP_FT} height={SNAP_FT} patternUnits="userSpaceOnUse">
                    <path
                      d={`M ${SNAP_FT} 0 L 0 0 0 ${SNAP_FT}`}
                      fill="none"
                      stroke="var(--paper-grid-minor)"
                      strokeWidth={0.03}
                    />
                  </pattern>
                </defs>
                <rect x={view.x} y={view.y} width={vw} height={vh} fill="url(#editorGrid)" />

                {points.length >= 3 && (
                  <path
                    d={polygonPath(points)}
                    fill="var(--blue-100)"
                    stroke="var(--blue-600)"
                    strokeWidth={2}
                    vectorEffect="non-scaling-stroke"
                  />
                )}

                {drawingPoints && (
                  <>
                    {drawingPoints.slice(0, -1).map((p, i) => (
                      <line
                        key={i}
                        x1={p.x}
                        y1={p.y}
                        x2={drawingPoints[i + 1].x}
                        y2={drawingPoints[i + 1].y}
                        stroke="var(--blue-500)"
                        strokeWidth={2}
                        vectorEffect="non-scaling-stroke"
                      />
                    ))}
                    {drawingPoints.map((p, i) => (
                      <circle
                        key={i}
                        cx={p.x}
                        cy={p.y}
                        r={(i === 0 ? 6 : 4) / view.scale}
                        fill={i === 0 ? 'var(--blue-600)' : 'var(--blue-500)'}
                      />
                    ))}
                  </>
                )}

                {drawingPoints && hoverPoint && (
                  <RubberBandPreview from={drawingPoints[drawingPoints.length - 1]} to={hoverPoint} scale={view.scale} />
                )}

                {hoverPoint && <GhostPoint point={hoverPoint} scale={view.scale} />}
              </svg>
            )}
          </div>
        </div>
        <div className={styles.bottom}>
          <button className={styles.btnGhost} onClick={onCancel}>
            Cancel
          </button>
          <button className={styles.btnPrimary} disabled={!canSave} onClick={() => canSave && onSave(name.trim(), points)}>
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
