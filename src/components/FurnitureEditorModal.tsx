import { useEffect, useRef, useState } from 'react';
import type { FurnitureTemplate, Point } from '../model/types';
import { distance, polygonPath, snapPoint } from '../model/geometry';
import styles from './FurnitureEditorModal.module.css';

const SCALE = 28; // px per foot, fixed — furniture is small, no zoom needed
const SNAP_FT = 0.5;
const VIEW_X = -1;
const VIEW_Y = -1;

interface FurnitureEditorModalProps {
  editing: FurnitureTemplate | null;
  onSave: (name: string, points: Point[]) => void;
  onCancel: () => void;
}

export function FurnitureEditorModal({ editing, onSave, onCancel }: FurnitureEditorModalProps) {
  const [name, setName] = useState(editing?.name ?? '');
  const [points, setPoints] = useState<Point[]>(editing?.points ?? []);
  const [drawingPoints, setDrawingPoints] = useState<Point[] | null>(null);
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

  function toLocal(clientX: number, clientY: number): Point {
    const rect = svgRef.current!.getBoundingClientRect();
    return { x: VIEW_X + (clientX - rect.left) / SCALE, y: VIEW_Y + (clientY - rect.top) / SCALE };
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
    if (drawingPoints.length >= 2 && distance(pt, start) < 10 / SCALE) {
      setPoints(drawingPoints);
      setDrawingPoints(null);
    } else {
      setDrawingPoints([...drawingPoints, pt]);
    }
  }

  const canSave = name.trim().length > 0 && points.length >= 3;

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
          <div className={styles.tools}>
            <div className={styles.toolBtn} title="Draw shape">
              <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d="M3 21 21 3M14 3h7v7" />
              </svg>
            </div>
          </div>
          <div className={styles.canvasWrap} ref={wrapRef}>
            {size.width > 0 && (
            <svg
              ref={svgRef}
              width={size.width}
              height={size.height}
              viewBox={`${VIEW_X} ${VIEW_Y} ${size.width / SCALE} ${size.height / SCALE}`}
              onClick={handleClick}
              style={{ cursor: 'crosshair' }}
            >
              <defs>
                <pattern id="editorGrid" width={SNAP_FT} height={SNAP_FT} patternUnits="userSpaceOnUse">
                  <path
                    d={`M ${SNAP_FT} 0 L 0 0 0 ${SNAP_FT}`}
                    fill="none"
                    stroke="var(--paper-grid-minor)"
                    strokeWidth={0.015}
                  />
                </pattern>
              </defs>
              <rect x={-20} y={-20} width={80} height={80} fill="url(#editorGrid)" />

              {points.length >= 3 && (
                <path d={polygonPath(points)} fill="var(--blue-100)" stroke="var(--blue-600)" strokeWidth={2} vectorEffect="non-scaling-stroke" />
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
                      r={(i === 0 ? 6 : 4) / SCALE}
                      fill={i === 0 ? 'var(--blue-600)' : 'var(--blue-500)'}
                    />
                  ))}
                </>
              )}
            </svg>
            )}
            <div className={styles.hint}>
              {points.length >= 3 ? 'Click to redraw' : 'Click to place corners · click near the start to close'}
            </div>
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
