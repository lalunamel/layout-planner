import type { Point } from '../model/types';
import { formatFeetInches } from '../model/geometry';

/** A small pill showing the distance between two points, positioned at their
 * midpoint and rotated to match the segment (kept upright). Sized in screen
 * pixels regardless of zoom via the inverse `scale` transform. */
export function DimensionLabel({ a, b, scale, color }: { a: Point; b: Point; scale: number; color: string }) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 0.05) return null;
  const midX = (a.x + b.x) / 2;
  const midY = (a.y + b.y) / 2;
  let angleDeg = (Math.atan2(dy, dx) * 180) / Math.PI;
  if (angleDeg > 90 || angleDeg < -90) angleDeg += 180;
  const text = formatFeetInches(dist);
  const paddingX = 6;
  const height = 18;
  const width = text.length * 6.2 + paddingX * 2;
  return (
    <g
      transform={`translate(${midX} ${midY}) rotate(${angleDeg}) scale(${1 / scale})`}
      style={{ pointerEvents: 'none' }}
    >
      <g transform="translate(0 -14)">
        <rect x={-width / 2} y={-height / 2} width={width} height={height} rx={5} fill={color} />
        <text x={0} y={1} textAnchor="middle" dominantBaseline="middle" fontSize={11} fill="#fff">
          {text}
        </text>
      </g>
    </g>
  );
}

/** The small dot that previews where a click will snap to next. */
export function GhostPoint({ point, scale }: { point: Point; scale: number }) {
  return (
    <circle
      cx={point.x}
      cy={point.y}
      r={4 / scale}
      fill="var(--blue-500)"
      opacity={0.45}
      style={{ pointerEvents: 'none' }}
    />
  );
}

/** Dashed rubber-band line from the last placed vertex to the live cursor,
 * plus a live length label — shown while a wall/shape stroke is in progress. */
export function RubberBandPreview({ from, to, scale }: { from: Point; to: Point; scale: number }) {
  return (
    <>
      <line
        x1={from.x}
        y1={from.y}
        x2={to.x}
        y2={to.y}
        stroke="var(--blue-500)"
        strokeWidth={2}
        strokeDasharray="3 4"
        vectorEffect="non-scaling-stroke"
        opacity={0.7}
        style={{ pointerEvents: 'none' }}
      />
      <DimensionLabel a={from} b={to} scale={scale} color="var(--blue-600)" />
    </>
  );
}
