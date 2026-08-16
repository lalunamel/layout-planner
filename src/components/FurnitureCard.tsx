import type { FurnitureTemplate } from '../model/types';
import { boundingBox, polygonPath } from '../model/geometry';
import styles from './FurniturePanel.module.css';

interface FurnitureCardProps {
  template: FurnitureTemplate;
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  menuOpen: boolean;
  onToggleMenu: () => void;
}

export function FurnitureCard({ template, onEdit, onDuplicate, onDelete, menuOpen, onToggleMenu }: FurnitureCardProps) {
  const { width, height } = boundingBox(template.points);
  const xs = template.points.map((p) => p.x);
  const ys = template.points.map((p) => p.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const pad = Math.max(width, height) * 0.15 || 0.5;

  return (
    <div
      className={styles.card}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('application/x-furniture-template', template.id);
        e.dataTransfer.effectAllowed = 'copy';
      }}
    >
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
      <div className={styles.row}>
        <div>
          <div className={styles.name}>{template.name}</div>
          <div className={styles.dims}>
            {width.toFixed(1)}' × {height.toFixed(1)}'
          </div>
        </div>
        <div className={styles.kebabWrap} data-kebab>
          <button
            className={styles.kebab}
            onClick={(e) => {
              e.stopPropagation();
              onToggleMenu();
            }}
            aria-label="Furniture options"
          >
            &#8942;
          </button>
          {menuOpen && (
            <div className={styles.menu} data-kebab>
              <button onClick={onEdit}>Edit</button>
              <button onClick={onDuplicate}>Duplicate</button>
              <button className={styles.danger} onClick={onDelete}>
                Delete
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
