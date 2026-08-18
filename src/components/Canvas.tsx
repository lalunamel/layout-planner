import { useEffect, useRef, useState } from 'react';
import type { FurnitureTemplate, Point, Wall } from '../model/types';
import type { PlanAction, PlanState } from '../store/planReducer';
import {
  MAJOR_GRID_FT,
  MINOR_GRID_FT,
  boundingBox,
  distance,
  makeId,
  pointsEqual,
  polygonPath,
  snap,
  snapAngle,
  snapPoint,
  templateCenter,
  uniqueVertices,
} from '../model/geometry';
import { clampScale, DEFAULT_SCALE, MINOR_GRID_VISIBLE_SCALE, type View } from '../model/view';
import { loadView, saveView } from '../store/storage';
import { DimensionLabel, GhostPoint, RubberBandPreview } from './DrawingAids';
import styles from './Canvas.module.css';

export type CanvasMode = 'pointer' | 'pan';

interface CanvasProps {
  mode: CanvasMode;
  state: PlanState;
  dispatch: (action: PlanAction) => void;
  library: FurnitureTemplate[];
  draggingTemplate: FurnitureTemplate | null;
  onPlaceDraggingTemplate: () => void;
}

type DragCtx =
  | { kind: 'move-furniture'; id: string; offsetX: number; offsetY: number }
  | { kind: 'rotate-furniture'; id: string; center: Point }
  | { kind: 'move-vertex'; from: Point }
  | { kind: 'move-wall'; wallId: string; startWorld: Point; originalA: Point; originalB: Point }
  | null;

const VERTEX_HIT_PX = 9;
const WALL_HIT_PX = 20;

export function Canvas({ mode, state, dispatch, library, draggingTemplate, onPlaceDraggingTemplate }: CanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const bgRef = useRef<SVGRectElement | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [view, setView] = useState<View>(() => loadView() ?? { x: -2, y: -2, scale: DEFAULT_SCALE });
  const [drawingPoints, setDrawingPoints] = useState<Point[] | null>(null);
  const [hoverPoint, setHoverPoint] = useState<Point | null>(null);
  const [rawHoverPoint, setRawHoverPoint] = useState<Point | null>(null);
  const [hoveredWallId, setHoveredWallId] = useState<string | null>(null);
  const [hoveredFurnitureId, setHoveredFurnitureId] = useState<string | null>(null);
  const panRef = useRef<{ x0: number; y0: number; startX: number; startY: number } | null>(null);
  const [isPanning, setIsPanning] = useState(false);

  const [selectedFurnitureId, setSelectedFurnitureId] = useState<string | null>(null);
  const [selectedWallId, setSelectedWallId] = useState<string | null>(null);
  const [dragCtx, setDragCtx] = useState<DragCtx>(null);
  const [liveFurniturePos, setLiveFurniturePos] = useState<{ id: string; x: number; y: number } | null>(null);
  const [liveRotation, setLiveRotation] = useState<{ id: string; rotation: number } | null>(null);
  const [liveVertex, setLiveVertex] = useState<{ from: Point; to: Point } | null>(null);
  const [liveWallMove, setLiveWallMove] = useState<{
    originalA: Point;
    originalB: Point;
    previewA: Point;
    previewB: Point;
  } | null>(null);

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
    const timeout = setTimeout(() => saveView(view), 200);
    return () => clearTimeout(timeout);
  }, [view]);

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
          e.preventDefault();
          dispatch({ type: 'DELETE_FURNITURE', id: selectedFurnitureId });
          setSelectedFurnitureId(null);
        } else if (selectedWallId) {
          e.preventDefault();
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
  }, [mode]);

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

  function isBackgroundTarget(e: React.SyntheticEvent): boolean {
    return e.target === e.currentTarget || e.target === bgRef.current;
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

  // ---------- wall drawing ----------
  function handleSvgMouseMove(e: React.MouseEvent<SVGSVGElement>) {
    const raw = toWorld(e.clientX, e.clientY);
    setHoverPoint(snapPoint(raw, snapResolution()));
    setRawHoverPoint(raw);
  }

  function handleSvgMouseLeave() {
    setHoverPoint(null);
    setRawHoverPoint(null);
  }

  function handleSvgClick(e: React.MouseEvent<SVGSVGElement>) {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    if (mode !== 'pointer') return;
    if (!isBackgroundTarget(e)) return;
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
    if (!drawingPoints) return;
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

  // ---------- panning (middle-mouse drag always; left-drag in pan mode) ----------
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
    setIsPanning(false);
    window.removeEventListener('mousemove', handlePanMove);
    window.removeEventListener('mouseup', handlePanUp);
  }
  function startPan(e: { clientX: number; clientY: number }) {
    panRef.current = { x0: e.clientX, y0: e.clientY, startX: view.x, startY: view.y };
    setIsPanning(true);
    window.addEventListener('mousemove', handlePanMove);
    window.addEventListener('mouseup', handlePanUp);
  }

  function handleSvgMouseDown(e: React.MouseEvent<SVGSVGElement>) {
    if (e.button === 1) {
      e.preventDefault();
      startPan(e);
      return;
    }
    if (mode === 'pan' && e.button === 0) {
      e.preventDefault();
      startPan(e);
      return;
    }
    if (mode === 'pointer' && isBackgroundTarget(e)) {
      setSelectedFurnitureId(null);
      setSelectedWallId(null);
    }
  }

  // ---------- drag furniture in from the library panel (custom mouse drag) ----------
  function handleSvgMouseUp(e: React.MouseEvent<SVGSVGElement>) {
    if (!draggingTemplate) return;
    const world = toWorld(e.clientX, e.clientY);
    const center = templateCenter(draggingTemplate.points);
    const inst = {
      id: makeId('placed'),
      templateId: draggingTemplate.id,
      x: world.x - center.x,
      y: world.y - center.y,
      rotation: 0,
    };
    dispatch({ type: 'ADD_FURNITURE', item: inst });
    setSelectedFurnitureId(inst.id);
    onPlaceDraggingTemplate();
  }

  // ---------- move/rotate furniture, edit wall vertices, select walls ----------
  function handleFurnitureMouseDown(e: React.MouseEvent, instId: string, instX: number, instY: number) {
    if (mode !== 'pointer') return;
    e.stopPropagation();
    const world = toWorld(e.clientX, e.clientY);
    setSelectedFurnitureId(instId);
    setSelectedWallId(null);
    setDragCtx({ kind: 'move-furniture', id: instId, offsetX: instX - world.x, offsetY: instY - world.y });
  }

  function handleRotateMouseDown(e: React.MouseEvent, instId: string, center: Point) {
    if (mode !== 'pointer') return;
    e.stopPropagation();
    setDragCtx({ kind: 'rotate-furniture', id: instId, center });
  }

  function handleVertexMouseDown(e: React.MouseEvent, vertex: Point) {
    if (mode !== 'pointer') return;
    e.stopPropagation();
    setSelectedFurnitureId(null);
    setSelectedWallId(null);
    setDragCtx({ kind: 'move-vertex', from: vertex });
  }

  function handleWallMouseDown(e: React.MouseEvent, wallId: string) {
    if (mode !== 'pointer') return;
    e.stopPropagation();
    const wall = state.walls.find((w) => w.id === wallId);
    if (!wall) return;
    setSelectedWallId(wallId);
    setSelectedFurnitureId(null);
    const world = toWorld(e.clientX, e.clientY);
    setDragCtx({ kind: 'move-wall', wallId, startWorld: world, originalA: wall.a, originalB: wall.b });
  }

  // Refs mirror the live* state so `onUp` always reads the latest drag
  // position rather than the value captured when this effect was set up.
  const liveFurniturePosRef = useRef<{ id: string; x: number; y: number } | null>(null);
  const liveRotationRef = useRef<{ id: string; rotation: number } | null>(null);
  const liveVertexRef = useRef<{ from: Point; to: Point } | null>(null);
  const liveWallMoveRef = useRef<{ originalA: Point; originalB: Point; previewA: Point; previewB: Point } | null>(
    null,
  );
  // Ending a drag with mouseup over the background still fires a synthetic
  // "click" there (mousedown and mouseup targeted different elements), which
  // handleSvgClick would otherwise read as "place a wall vertex here."
  const suppressClickRef = useRef(false);

  useEffect(() => {
    if (!dragCtx) return;

    function onMove(e: MouseEvent) {
      const world = toWorld(e.clientX, e.clientY);
      if (dragCtx!.kind === 'move-furniture') {
        const next = { id: dragCtx!.id, x: world.x + dragCtx!.offsetX, y: world.y + dragCtx!.offsetY };
        liveFurniturePosRef.current = next;
        setLiveFurniturePos(next);
      } else if (dragCtx!.kind === 'rotate-furniture') {
        const angle = (Math.atan2(world.y - dragCtx!.center.y, world.x - dragCtx!.center.x) * 180) / Math.PI + 90;
        const next = { id: dragCtx!.id, rotation: snapAngle(angle, 15) };
        liveRotationRef.current = next;
        setLiveRotation(next);
      } else if (dragCtx!.kind === 'move-vertex') {
        const snapped = snapPoint(world, snapResolution());
        const next = { from: dragCtx!.from, to: snapped };
        liveVertexRef.current = next;
        setLiveVertex(next);
      } else if (dragCtx!.kind === 'move-wall') {
        const res = snapResolution();
        const dx = snap(world.x - dragCtx!.startWorld.x, res);
        const dy = snap(world.y - dragCtx!.startWorld.y, res);
        const next = {
          originalA: dragCtx!.originalA,
          originalB: dragCtx!.originalB,
          previewA: { x: dragCtx!.originalA.x + dx, y: dragCtx!.originalA.y + dy },
          previewB: { x: dragCtx!.originalB.x + dx, y: dragCtx!.originalB.y + dy },
        };
        liveWallMoveRef.current = next;
        setLiveWallMove(next);
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
      } else if (dragCtx!.kind === 'move-wall' && liveWallMoveRef.current) {
        const { originalA, previewA } = liveWallMoveRef.current;
        dispatch({
          type: 'MOVE_WALL',
          wallId: dragCtx!.wallId,
          dx: previewA.x - originalA.x,
          dy: previewA.y - originalA.y,
        });
      }
      // The stray click (if any) fires synchronously right after this mouseup,
      // in the same task — so clear the flag on a timeout as a safety net in
      // case no click follows (e.g. mouseup lands back on the drag origin),
      // which would otherwise leave it stuck and swallow the user's next
      // legitimate click.
      suppressClickRef.current = true;
      setTimeout(() => {
        suppressClickRef.current = false;
      }, 0);
      liveFurniturePosRef.current = null;
      liveRotationRef.current = null;
      liveVertexRef.current = null;
      liveWallMoveRef.current = null;
      setDragCtx(null);
      setLiveFurniturePos(null);
      setLiveRotation(null);
      setLiveVertex(null);
      setLiveWallMove(null);
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
  const vertices = uniqueVertices(state.walls);

  function wallEndpoint(p: Point): Point {
    if (liveVertex && pointsEqual(p, liveVertex.from)) return liveVertex.to;
    if (liveWallMove) {
      if (pointsEqual(p, liveWallMove.originalA)) return liveWallMove.previewA;
      if (pointsEqual(p, liveWallMove.originalB)) return liveWallMove.previewB;
    }
    return p;
  }

  const drawingLastPoint = drawingPoints ? drawingPoints[drawingPoints.length - 1] : null;
  const showGhost = mode === 'pointer' && !dragCtx && hoverPoint;
  const svgCursor = isPanning ? 'grabbing' : mode === 'pan' ? 'grab' : undefined;

  // Walls to show a live dimension label for: while dragging a wall, that
  // wall plus every wall connected to either of its original endpoints
  // (their lengths change too); otherwise just whichever wall is hovered.
  const wallsToLabel: Wall[] = [];
  if (dragCtx?.kind === 'move-wall') {
    const dragged = state.walls.find((w) => w.id === dragCtx.wallId);
    if (dragged) {
      wallsToLabel.push(dragged);
      for (const w of state.walls) {
        if (w.id === dragCtx.wallId) continue;
        if (
          pointsEqual(w.a, dragCtx.originalA) ||
          pointsEqual(w.b, dragCtx.originalA) ||
          pointsEqual(w.a, dragCtx.originalB) ||
          pointsEqual(w.b, dragCtx.originalB)
        ) {
          wallsToLabel.push(w);
        }
      }
    }
  } else if (hoveredWallId) {
    const hovered = state.walls.find((w) => w.id === hoveredWallId);
    if (hovered) wallsToLabel.push(hovered);
  }

  return (
    <div className={styles.wrap} ref={containerRef}>
      {size.width > 0 && (
        <svg
          className={styles.svg}
          style={svgCursor ? { cursor: svgCursor } : undefined}
          width={size.width}
          height={size.height}
          viewBox={`${view.x} ${view.y} ${vw} ${vh}`}
          onClick={handleSvgClick}
          onDoubleClick={handleSvgDoubleClick}
          onMouseDown={handleSvgMouseDown}
          onMouseMove={handleSvgMouseMove}
          onMouseLeave={handleSvgMouseLeave}
          onMouseUp={handleSvgMouseUp}
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

          <rect ref={bgRef} x={view.x} y={view.y} width={vw} height={vh} fill="url(#gridMajor)" />

          <g>
            {state.walls.map((w) => {
              const a = wallEndpoint(w.a);
              const b = wallEndpoint(w.b);
              const selected = selectedWallId === w.id;
              const hovered = hoveredWallId === w.id;
              let wallStroke = 'var(--wall)';
              if (selected) wallStroke = 'var(--blue-600)';
              else if (hovered) wallStroke = 'var(--blue-400)';
              return (
                <g key={w.id}>
                  <line
                    x1={a.x}
                    y1={a.y}
                    x2={b.x}
                    y2={b.y}
                    stroke={wallStroke}
                    strokeWidth={4}
                    strokeLinecap="square"
                    vectorEffect="non-scaling-stroke"
                  />
                  <line
                    x1={a.x}
                    y1={a.y}
                    x2={b.x}
                    y2={b.y}
                    stroke="transparent"
                    strokeWidth={WALL_HIT_PX}
                    vectorEffect="non-scaling-stroke"
                    style={{ cursor: mode === 'pointer' ? 'grab' : undefined }}
                    onMouseDown={(e) => handleWallMouseDown(e, w.id)}
                    onMouseEnter={() => setHoveredWallId(w.id)}
                    onMouseLeave={() => setHoveredWallId((cur) => (cur === w.id ? null : cur))}
                  />
                </g>
              );
            })}

            {vertices.map((v, i) => (
              <circle
                key={i}
                cx={v.x}
                cy={v.y}
                r={VERTEX_HIT_PX / view.scale}
                fill="transparent"
                style={{ cursor: mode === 'pointer' ? 'grab' : undefined }}
                onMouseDown={(e) => handleVertexMouseDown(e, v)}
              />
            ))}

            {drawingPoints && (
              <g style={{ pointerEvents: 'none' }}>
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
                    r={4 / view.scale}
                    fill={i === 0 ? 'var(--blue-600)' : 'var(--blue-500)'}
                  />
                ))}
              </g>
            )}

            {drawingLastPoint && showGhost && (
              <RubberBandPreview from={drawingLastPoint} to={hoverPoint!} scale={view.scale} />
            )}

            {wallsToLabel.map((w) => (
              <DimensionLabel
                key={w.id}
                a={wallEndpoint(w.a)}
                b={wallEndpoint(w.b)}
                scale={view.scale}
                color="var(--ink)"
              />
            ))}

            {showGhost && !hoveredWallId && <GhostPoint point={hoverPoint!} scale={view.scale} />}
          </g>

          <g>
            {state.placed.map((inst) => {
              const template = library.find((t) => t.id === inst.templateId);
              if (!template) return null;
              const center = templateCenter(template.points);
              const xs = template.points.map((p) => p.x);
              const ys = template.points.map((p) => p.y);
              const corner = { x: Math.max(...xs), y: Math.min(...ys) };
              const pos = liveFurniturePos && liveFurniturePos.id === inst.id ? liveFurniturePos : inst;
              const rotation = liveRotation && liveRotation.id === inst.id ? liveRotation.rotation : inst.rotation;
              const selected = selectedFurnitureId === inst.id;
              const hovered = hoveredFurnitureId === inst.id;
              const isMoving = dragCtx?.kind === 'move-furniture' && dragCtx.id === inst.id;
              const worldCenter = { x: pos.x + center.x, y: pos.y + center.y };
              let fill = '#fbfdff';
              let stroke = 'var(--ink-soft)';
              if (selected) {
                fill = 'var(--blue-100)';
                stroke = 'var(--blue-600)';
              } else if (hovered) {
                fill = 'var(--blue-50)';
                stroke = 'var(--blue-400)';
              }
              return (
                <g key={inst.id}>
                  <g
                    transform={`translate(${pos.x} ${pos.y}) rotate(${rotation}, ${center.x}, ${center.y})`}
                    style={{ cursor: mode === 'pointer' ? 'grab' : undefined }}
                    onMouseDown={(e) => handleFurnitureMouseDown(e, inst.id, inst.x, inst.y)}
                    onMouseEnter={() => setHoveredFurnitureId(inst.id)}
                    onMouseLeave={() => setHoveredFurnitureId((cur) => (cur === inst.id ? null : cur))}
                  >
                    <path
                      d={polygonPath(template.points)}
                      fill={fill}
                      stroke={stroke}
                      strokeWidth={selected ? 2.5 : 1.5}
                      vectorEffect="non-scaling-stroke"
                    />
                    <FurnitureLabel template={template} scale={view.scale} />
                    {selected && !isMoving && mode === 'pointer' && (
                      <RotateHandle
                        corner={corner}
                        scale={view.scale}
                        onMouseDown={(e) => handleRotateMouseDown(e, inst.id, worldCenter)}
                      />
                    )}
                  </g>
                </g>
              );
            })}

            {draggingTemplate && rawHoverPoint && (
              <DragPreview template={draggingTemplate} cursor={rawHoverPoint} />
            )}
          </g>
        </svg>
      )}
    </div>
  );
}

/** True-to-scale preview of a furniture template following the cursor while
 * it's being dragged in from the library panel — same rendering as a real
 * placed instance (un-rotated, since a fresh drop always starts at 0°), just
 * centered under the cursor and semi-transparent to read as "not placed yet". */
const LABEL_FONT_SIZES = [12, 10, 8, 6];
const AVG_CHAR_WIDTH_FACTOR = 0.58; // rough average glyph width for a sans-serif font, as a fraction of font size

/** Name label centered on a placed furniture item. Runs along the shape's
 * longer local axis (so a long table lying vertically on screen gets a
 * vertical label, since this renders inside the same rotated group as the
 * shape). Shrinks through a few font sizes to fit, and hides entirely if
 * even the smallest size would overflow — better than clipped text. */
function FurnitureLabel({ template, scale }: { template: FurnitureTemplate; scale: number }) {
  const { width, height } = boundingBox(template.points);
  const center = templateCenter(template.points);
  const vertical = height > width;
  const longAxisPx = (vertical ? height : width) * scale;
  const shortAxisPx = (vertical ? width : height) * scale;
  const name = template.name;

  let chosenSize: number | null = null;
  for (const size of LABEL_FONT_SIZES) {
    if (size > shortAxisPx * 0.6) continue;
    const estimatedWidth = name.length * size * AVG_CHAR_WIDTH_FACTOR;
    if (estimatedWidth <= longAxisPx * 0.85) {
      chosenSize = size;
      break;
    }
  }
  if (chosenSize === null) return null;

  return (
    <g transform={`translate(${center.x} ${center.y}) rotate(${vertical ? 90 : 0}) scale(${1 / scale})`}>
      <text
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize={chosenSize}
        fontWeight={600}
        fill="var(--ink)"
        style={{ pointerEvents: 'none', userSelect: 'none' }}
      >
        {name}
      </text>
    </g>
  );
}

function DragPreview({ template, cursor }: { template: FurnitureTemplate; cursor: Point }) {
  const center = templateCenter(template.points);
  return (
    <g
      transform={`translate(${cursor.x - center.x} ${cursor.y - center.y})`}
      opacity={0.65}
      style={{ pointerEvents: 'none' }}
    >
      <path
        d={polygonPath(template.points)}
        fill="var(--blue-100)"
        stroke="var(--blue-600)"
        strokeWidth={1.5}
        vectorEffect="non-scaling-stroke"
      />
    </g>
  );
}

function RotateHandle({
  corner,
  scale,
  onMouseDown,
}: {
  corner: Point;
  scale: number;
  onMouseDown: (e: React.MouseEvent) => void;
}) {
  return (
    <g transform={`translate(${corner.x} ${corner.y}) scale(${1 / scale})`}>
      <g transform="translate(10 -10)">
        <circle r={13} fill="#fff" stroke="var(--blue-200)" strokeWidth={1.5} style={{ cursor: 'grab' }} onMouseDown={onMouseDown} />
        <g
          transform="translate(-8 -8) scale(0.67)"
          stroke="var(--blue-600)"
          strokeWidth={2.2}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ pointerEvents: 'none' }}
        >
          <path d="M1 4v6h6" />
          <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
        </g>
      </g>
    </g>
  );
}

