import type { FurnitureTemplate } from '../model/types';
import { boundingBox, polygonPath } from '../model/geometry';
import styles from './FurniturePanel.module.css';

interface FurnitureCardProps {
  template: FurnitureTemplate;
  onDelete: () => void;
  onStartDrag: (e: React.MouseEvent) => void;
}

export function FurnitureCard({ template, onDelete, onStartDrag }: FurnitureCardProps) {
  const { width, height } = boundingBox(template.points);
  const xs = template.points.map((p) => p.x);
  const ys = template.points.map((p) => p.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const pad = Math.max(width, height) * 0.15 || 0.5;

  return (
    <div className={styles.card} onMouseDown={onStartDrag}>
      <button
        className={styles.deleteButton}
        aria-label={`Delete ${template.name}`}
        title="Delete"
        // Keep the card's drag-to-place from starting.
        onMouseDown={(e) => e.stopPropagation()}
        onClick={onDelete}
      >
        <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      <div className={styles.swatch}>
        <svg
          width={70}
          height={44}
          viewBox={`${minX - pad} ${minY - pad} ${width + pad * 2} ${height + pad * 2}`}
          preserveAspectRatio="xMidYMid meet"
        >
          <path d={polygonPath(template.points)} fill="var(--blue-100)" stroke="var(--blue-500)" strokeWidth={0.06} />
        </svg>
      </div>
      <div className={styles.name}>{template.name}</div>
    </div>
  );
}
