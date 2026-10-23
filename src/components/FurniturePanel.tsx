import { useEffect, useState } from 'react';
import type { FurnitureTemplate } from '../model/types';
import { FurnitureCard } from './FurnitureCard';
import styles from './FurniturePanel.module.css';

interface FurniturePanelProps {
  library: FurnitureTemplate[];
  /** Templates with at least one copy on the plan being viewed. */
  placedTemplateIds: Set<string>;
  /** The template currently being dragged (to the canvas or within this list). */
  draggingId: string | null;
  onNew: () => void;
  onDelete: (template: FurnitureTemplate) => void;
  onStartDrag: (template: FurnitureTemplate, e: React.MouseEvent) => void;
  /** Move a template into `slot` (the gap before item `slot`). */
  onReorder: (id: string, slot: number) => void;
}

export function FurniturePanel({
  library,
  placedTemplateIds,
  draggingId,
  onNew,
  onDelete,
  onStartDrag,
  onReorder,
}: FurniturePanelProps) {
  // The gap a dragged card would drop into, while it's over this list.
  const [dropSlot, setDropSlot] = useState<number | null>(null);

  useEffect(() => {
    if (!draggingId) setDropSlot(null);
  }, [draggingId]);

  const fromIndex = draggingId ? library.findIndex((t) => t.id === draggingId) : -1;
  // Dropping right next to where the card already is wouldn't move it.
  const effectiveSlot =
    dropSlot !== null && fromIndex >= 0 && dropSlot !== fromIndex && dropSlot !== fromIndex + 1 ? dropSlot : null;

  function trackSlot(index: number, e: React.MouseEvent<HTMLDivElement>) {
    if (!draggingId) return;
    const rect = e.currentTarget.getBoundingClientRect();
    setDropSlot(e.clientY < rect.top + rect.height / 2 ? index : index + 1);
  }

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <h3>Furniture</h3>
      </div>
      <div
        className={styles.list}
        onMouseLeave={() => setDropSlot(null)}
        onMouseUp={() => {
          if (draggingId && effectiveSlot !== null) onReorder(draggingId, effectiveSlot);
        }}
      >
        <button className={styles.newCard} onClick={onNew} aria-label="New furniture" title="New furniture">
          <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
            <path d="M12 5v14M5 12h14" strokeLinecap="round" />
          </svg>
          New
        </button>
        {library.map((template, i) => (
          <FurnitureCard
            key={template.id}
            template={template}
            placed={placedTemplateIds.has(template.id)}
            dragging={template.id === draggingId}
            dropMarker={
              effectiveSlot === i ? 'before' : effectiveSlot === library.length && i === library.length - 1 ? 'after' : null
            }
            onDelete={() => onDelete(template)}
            onStartDrag={(e) => onStartDrag(template, e)}
            onMouseMove={(e) => trackSlot(i, e)}
          />
        ))}
      </div>
    </div>
  );
}
