import { useEffect, useRef, useState } from 'react';
import type { FurnitureTemplate, Point, Tool, Wall } from '../model/types';
import type { PlanAction, PlanState } from '../store/planReducer';
import {
  MAJOR_GRID_FT,
  MINOR_GRID_FT,
  distance,
  makeId,
  pointsEqual,
  polygonPath,
  snapAngle,
  snapPoint,
  templateCenter,
  uniqueVertices,
} from '../model/geometry';
import { clampScale, DEFAULT_SCALE, MINOR_GRID_VISIBLE_SCALE, type View } from '../model/view';
import styles from './Canvas.module.css';

interface CanvasProps {
  tool: Tool;
  state: PlanState;
  dispatch: (action: PlanAction) => void;
  library: FurnitureTemplate[];
}

type DragCtx =
  | { kind: 'move-furniture'; id: string; offsetX: number; offsetY: number }
  | { kind: 'rotate-furniture'; id: string; center: Point }
  | { kind: 'move-vertex'; from: Point }
  | null;

const VERTEX_HIT_PX = 9;
const WALL_HIT_PX = 10;

export function Canvas({ tool, state, dispatch, library }: CanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [view, setView] = useState<View>({ x: -2, y: -2, scale: DEFAULT_SCALE });
  const [drawingPoints, setDrawingPoints] = useState<Point[] | null>(null);
  const panRef = useRef<{ x0: number; y0: number; startX: number; startY: number } | null>(null);

  const [selectedFurnitureId, setSelectedFurnitureId] = useState<string | null>(null);
  const [selectedWallId, setSelectedWallId] = useState<string | null>(null);
  const [dragCtx, setDragCtx] = useState<DragCtx>(null);
  const [liveFurniturePos, setLiveFurniturePos] = useState<{ id: string; x: number; y: number } | null>(null);
  const [liveRotation, setLiveRotation] = useState<{ id: string; rotation: number } | null>(null);
  const [liveVertex, setLiveVertex] = useState<{ from: Point; to: Point } | null>(null);

  useEffect(() => {
    const el = containerRef.current;
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
    const el = containerRef.current;
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

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setDrawingPoints(null);
        setSelectedFurnitureId(null);
        setSelectedWallId(null);
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        const target = e.target as HTMLElement | null;
        if (target && ['INPUT', 'TEXTAREA'].includes(target.tagName)) return;
        if (selectedFurnitureId) {
          dispatch({ type: 'DELETE_FURNITURE', id: selectedFurnitureId });
          setSelectedFurnitureId(null);
        } else if (selectedWallId) {
          dispatch({ type: 'DELETE_WALL', wallId: selectedWallId });
          setSelectedWallId(null);
        }
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selectedFurnitureId, selectedWallId, dispatch]);

  useEffect(() => {
    setDrawingPoints(null);
    setSelectedFurnitureId(null);
    setSelectedWallId(null);
  }, [tool]);

  function snapResolution(): number {
    return view.scale >= MINOR_GRID_VISIBLE_SCALE ? MINOR_GRID_FT : MAJOR_GRID_FT;
  }

  function toWorld(clientX: number, clientY: number): Point {
    const rect = containerRef.current!.getBoundingClientRect();
    return {
      x: view.x + (clientX - rect.left) / view.scale,
      y: view.y + (clientY - rect.top) / view.scale,
    };
  }

  function segmentsFromPoints(points: Point[], close: boolean): Wall[] {
    const walls: Wall[] = [];
    for (let i = 0; i < points.length - 1; i++) {
      walls.push({ id: makeId('wall'), a: points[i], b: points[i + 1] });
    }
    if (close) {
      walls.push({ id: makeId('wall'), a: points[points.length - 1], b: points[0] });
    }
    return walls;
  }

  // ---------- wall drawing (tool === 'wall') ----------
  function handleSvgClick(e: React.MouseEvent<SVGSVGElement>) {
    if (tool !== 'wall') return;
    const raw = toWorld(e.clientX, e.clientY);
    const pt = snapPoint(raw, snapResolution());

    if (!drawingPoints) {
      setDrawingPoints([pt]);
      return;
    }
    const start = drawingPoints[0];
    const closeThreshold = 10 / view.scale;
    if (drawingPoints.length >= 2 && distance(pt, start) < closeThreshold) {
      dispatch({ type: 'ADD_WALLS', walls: segmentsFromPoints(drawingPoints, true) });
      setDrawingPoints(null);
    } else {
      setDrawingPoints([...drawingPoints, pt]);
    }
  }

  function handleSvgDoubleClick() {
    if (tool !== 'wall' || !drawingPoints) return;
    let points = drawingPoints;
    if (points.length >= 2) {
      const last = points[points.length - 1];
      const prev = points[points.length - 2];
      if (distance(last, prev) < 1e-6) points = points.slice(0, -1);
    }
    if (points.length >= 2) {
      dispatch({ type: 'ADD_WALLS', walls: segmentsFromPoints(points, false) });
    }
    setDrawingPoints(null);
  }

  // ---------- panning (middle-mouse drag, any tool) ----------
  function handlePanMove(e: MouseEvent) {
    const p = panRef.current;
    if (!p) return;
    setView((v) => ({
      x: p.startX - (e.clientX - p.x0) / v.scale,
      y: p.startY - (e.clientY - p.y0) / v.scale,
      scale: v.scale,
    }));
  }
  function handlePanUp() {
    panRef.current = null;
    window.removeEventListener('mousemove', handlePanMove);
    window.removeEventListener('mouseup', handlePanUp);
  }

  function handleSvgMouseDown(e: React.MouseEvent<SVGSVGElement>) {
    if (e.button === 1) {
      e.preventDefault();
      panRef.current = { x0: e.clientX, y0: e.clientY, startX: view.x, startY: view.y };
      window.addEventListener('mousemove', handlePanMove);
      window.addEventListener('mouseup', handlePanUp);
      return;
    }
    if (tool === 'select' && e.target === e.currentTarget) {
      setSelectedFurnitureId(null);
      setSelectedWallId(null);
    }
  }

  // ---------- drag furniture in from the library panel ----------
  function handleSvgDragOver(e: React.DragEvent<SVGSVGElement>) {
    if (e.dataTransfer.types.includes('application/x-furniture-template')) {
      e.preventDefault();
    }
  }

  function handleSvgDrop(e: React.DragEvent<SVGSVGElement>) {
    const templateId = e.dataTransfer.getData('application/x-furniture-template');
    if (!templateId) return;
    e.preventDefault();
    const template = library.find((t) => t.id === templateId);
    if (!template) return;
    const world = toWorld(e.clientX, e.clientY);
    const center = templateCenter(template.points);
    const snapped = snapPoint({ x: world.x - center.x, y: world.y - center.y }, snapResolution());
    const inst = { id: makeId('placed'), templateId: template.id, x: snapped.x, y: snapped.y, rotation: 0 };
    dispatch({ type: 'ADD_FURNITURE', item: inst });
    setSelectedFurnitureId(inst.id);
  }

  // ---------- select tool: drag furniture ----------
  function handleFurnitureMouseDown(e: React.MouseEvent, instId: string, instX: number, instY: number) {
    if (tool !== 'select') return;
    e.stopPropagation();
    const world = toWorld(e.clientX, e.clientY);
    setSelectedFurnitureId(instId);
    setSelectedWallId(null);
    setDragCtx({ kind: 'move-furniture', id: instId, offsetX: instX - world.x, offsetY: instY - world.y });
  }

  function handleRotateMouseDown(e: React.MouseEvent, instId: string, center: Point) {
    if (tool !== 'select') return;
    e.stopPropagation();
    setDragCtx({ kind: 'rotate-furniture', id: instId, center });
  }

  function handleVertexMouseDown(e: React.MouseEvent, vertex: Point) {
    if (tool !== 'select') return;
    e.stopPropagation();
    setSelectedFurnitureId(null);
    setSelectedWallId(null);
    setDragCtx({ kind: 'move-vertex', from: vertex });
  }

  function handleWallMouseDown(e: React.MouseEvent, wallId: string) {
    if (tool !== 'select') return;
    e.stopPropagation();
    setSelectedWallId(wallId);
    setSelectedFurnitureId(null);
  }

  // Refs mirror the live* state so `onUp` always reads the latest drag
  // position rather than the value captured when this effect was set up.
  const liveFurniturePosRef = useRef<{ id: string; x: number; y: number } | null>(null);
  const liveRotationRef = useRef<{ id: string; rotation: number } | null>(null);
  const liveVertexRef = useRef<{ from: Point; to: Point } | null>(null);

  useEffect(() => {
    if (!dragCtx) return;

    function onMove(e: MouseEvent) {
      const world = toWorld(e.clientX, e.clientY);
      if (dragCtx!.kind === 'move-furniture') {
        const snapped = snapPoint(
          { x: world.x + dragCtx!.offsetX, y: world.y + dragCtx!.offsetY },
          snapResolution(),
        );
        const next = { id: dragCtx!.id, x: snapped.x, y: snapped.y };
        liveFurniturePosRef.current = next;
        setLiveFurniturePos(next);
      } else if (dragCtx!.kind === 'rotate-furniture') {
        const angle = (Math.atan2(world.y - dragCtx!.center.y, world.x - dragCtx!.center.x) * 180) / Math.PI + 90;
        const next = { id: dragCtx!.id, rotation: snapAngle(angle, 45) };
        liveRotationRef.current = next;
        setLiveRotation(next);
      } else if (dragCtx!.kind === 'move-vertex') {
        const snapped = snapPoint(world, snapResolution());
        const next = { from: dragCtx!.from, to: snapped };
        liveVertexRef.current = next;
        setLiveVertex(next);
      }
    }

    function onUp() {
      if (dragCtx!.kind === 'move-furniture' && liveFurniturePosRef.current) {
        const { id, x, y } = liveFurniturePosRef.current;
        dispatch({ type: 'MOVE_FURNITURE', id, x, y });
      } else if (dragCtx!.kind === 'rotate-furniture' && liveRotationRef.current) {
        const { id, rotation } = liveRotationRef.current;
        dispatch({ type: 'ROTATE_FURNITURE', id, rotation });
      } else if (dragCtx!.kind === 'move-vertex' && liveVertexRef.current) {
        const { from, to } = liveVertexRef.current;
        dispatch({ type: 'MOVE_VERTEX', from, to });
      }
      liveFurniturePosRef.current = null;
      liveRotationRef.current = null;
      liveVertexRef.current = null;
      setDragCtx(null);
      setLiveFurniturePos(null);
      setLiveRotation(null);
      setLiveVertex(null);
    }

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dragCtx]);

  const resolution = snapResolution();
  const vw = size.width > 0 ? size.width / view.scale : 0;
  const vh = size.height > 0 ? size.height / view.scale : 0;
  const vertices = tool === 'select' ? uniqueVertices(state.walls) : [];

  function wallEndpoint(p: Point): Point {
    return liveVertex && pointsEqual(p, liveVertex.from) ? liveVertex.to : p;
  }

  let svgClass = styles.svg;
  if (tool === 'wall') svgClass = styles.svgWallTool;

  return (
    <div className={styles.wrap} ref={containerRef}>
      {size.width > 0 && (
        <svg
          className={svgClass}
          width={size.width}
          height={size.height}
          viewBox={`${view.x} ${view.y} ${vw} ${vh}`}
          onClick={handleSvgClick}
          onDoubleClick={handleSvgDoubleClick}
          onMouseDown={handleSvgMouseDown}
          onDragOver={handleSvgDragOver}
          onDrop={handleSvgDrop}
        >
          <defs>
            <pattern id="gridMinor" width={MINOR_GRID_FT} height={MINOR_GRID_FT} patternUnits="userSpaceOnUse">
              <path
                d={`M ${MINOR_GRID_FT} 0 L 0 0 0 ${MINOR_GRID_FT}`}
                fill="none"
                stroke="var(--paper-grid-minor)"
                strokeWidth={0.02}
              />
            </pattern>
            <pattern id="gridMajor" width={MAJOR_GRID_FT} height={MAJOR_GRID_FT} patternUnits="userSpaceOnUse">
              <rect
                width={MAJOR_GRID_FT}
                height={MAJOR_GRID_FT}
                fill={resolution <= MINOR_GRID_FT ? 'url(#gridMinor)' : 'transparent'}
              />
              <path
                d={`M ${MAJOR_GRID_FT} 0 L 0 0 0 ${MAJOR_GRID_FT}`}
                fill="none"
                stroke="var(--paper-grid-major)"
                strokeWidth={0.03}
              />
            </pattern>
          </defs>

          <rect x={view.x} y={view.y} width={vw} height={vh} fill="url(#gridMajor)" />

          <g>
            {state.walls.map((w) => {
              const a = wallEndpoint(w.a);
              const b = wallEndpoint(w.b);
              const selected = selectedWallId === w.id;
              return (
                <g key={w.id}>
                  <line
                    x1={a.x}
                    y1={a.y}
                    x2={b.x}
                    y2={b.y}
                    stroke={selected ? 'var(--blue-600)' : 'var(--wall)'}
                    strokeWidth={4}
                    strokeLinecap="square"
                    vectorEffect="non-scaling-stroke"
                  />
                  {tool === 'select' && (
                    <line
                      x1={a.x}
                      y1={a.y}
                      x2={b.x}
                      y2={b.y}
                      stroke="transparent"
                      strokeWidth={WALL_HIT_PX}
                      vectorEffect="non-scaling-stroke"
                      style={{ cursor: 'pointer' }}
                      onMouseDown={(e) => handleWallMouseDown(e, w.id)}
                    />
                  )}
                </g>
              );
            })}

            {tool === 'select' &&
              vertices.map((v, i) => (
                <circle
                  key={i}
                  cx={v.x}
                  cy={v.y}
                  r={VERTEX_HIT_PX / view.scale}
                  fill="transparent"
                  style={{ cursor: 'grab' }}
                  onMouseDown={(e) => handleVertexMouseDown(e, v)}
                />
              ))}

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
                    strokeWidth={3}
                    strokeDasharray="6 5"
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
          </g>

          <g>
            {state.placed.map((inst) => {
              const template = library.find((t) => t.id === inst.templateId);
              if (!template) return null;
              const center = templateCenter(template.points);
              const pos = liveFurniturePos && liveFurniturePos.id === inst.id ? liveFurniturePos : inst;
              const rotation = liveRotation && liveRotation.id === inst.id ? liveRotation.rotation : inst.rotation;
              const selected = selectedFurnitureId === inst.id;
              const worldCenter = { x: pos.x + center.x, y: pos.y + center.y };
              return (
                <g key={inst.id}>
                  <g
                    transform={`translate(${pos.x} ${pos.y}) rotate(${rotation}, ${center.x}, ${center.y})`}
                    style={{ cursor: tool === 'select' ? 'grab' : 'default' }}
                    onMouseDown={(e) => handleFurnitureMouseDown(e, inst.id, inst.x, inst.y)}
                  >
                    <path
                      d={polygonPath(template.points)}
                      fill={selected ? 'var(--blue-100)' : '#fbfdff'}
                      stroke={selected ? 'var(--blue-600)' : 'var(--ink-soft)'}
                      strokeWidth={selected ? 2.5 : 1.5}
                      vectorEffect="non-scaling-stroke"
                    />
                  </g>
                  {tool === 'select' && selected && (
                    <RotateHandle
                      center={worldCenter}
                      rotation={rotation}
                      radiusPx={30}
                      scale={view.scale}
                      onMouseDown={(e) => handleRotateMouseDown(e, inst.id, worldCenter)}
                    />
                  )}
                </g>
              );
            })}
          </g>
        </svg>
      )}
    </div>
  );
}

function RotateHandle({
  center,
  rotation,
  radiusPx,
  scale,
  onMouseDown,
}: {
  center: Point;
  rotation: number;
  radiusPx: number;
  scale: number;
  onMouseDown: (e: React.MouseEvent) => void;
}) {
  const r = radiusPx / scale;
  const rad = ((rotation - 90) * Math.PI) / 180;
  const hx = center.x + r * Math.cos(rad);
  const hy = center.y + r * Math.sin(rad);
  return (
    <g>
      <line
        x1={center.x}
        y1={center.y}
        x2={hx}
        y2={hy}
        stroke="var(--blue-500)"
        strokeWidth={1.5}
        strokeDasharray="3 3"
        vectorEffect="non-scaling-stroke"
      />
      <circle
        cx={hx}
        cy={hy}
        r={7 / scale}
        fill="#fff"
        stroke="var(--blue-600)"
        strokeWidth={2}
        vectorEffect="non-scaling-stroke"
        style={{ cursor: 'grab' }}
        onMouseDown={onMouseDown}
      />
    </g>
  );
}
