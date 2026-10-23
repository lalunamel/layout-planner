import type { FurnitureTemplate } from '../model/types';
import styles from './FurniturePanel.module.css';

interface FurnitureCardProps {
  template: FurnitureTemplate;
  /** Already placed on the plan being viewed — shown muted. */
  placed: boolean;
  dragging: boolean;
  dropMarker: 'before' | 'after' | null;
  onDelete: () => void;
  onStartDrag: (e: React.MouseEvent) => void;
  onMouseMove: (e: React.MouseEvent<HTMLDivElement>) => void;
}

export function FurnitureCard({
  template,
  placed,
  dragging,
  dropMarker,
  onDelete,
  onStartDrag,
  onMouseMove,
}: FurnitureCardProps) {
  const classes = [styles.card];
  if (placed) classes.push(styles.placed);
  if (dragging) classes.push(styles.dragging);
  if (dropMarker === 'before') classes.push(styles.dropBefore);
  if (dropMarker === 'after') classes.push(styles.dropAfter);

  return (
    <div
      className={classes.join(' ')}
      onMouseDown={onStartDrag}
      onMouseMove={onMouseMove}
      title={placed ? `${template.name} (on this plan)` : template.name}
    >
      <span className={styles.name}>{template.name}</span>
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
    </div>
  );
}
