import type { FurnitureTemplate } from '../model/types';
import { FurnitureCard } from './FurnitureCard';
import styles from './FurniturePanel.module.css';

interface FurniturePanelProps {
  library: FurnitureTemplate[];
  onNew: () => void;
  onDelete: (id: string) => void;
  onStartDrag: (template: FurnitureTemplate, e: React.MouseEvent) => void;
}

export function FurniturePanel({ library, onNew, onDelete, onStartDrag }: FurniturePanelProps) {
  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <h3>Furniture</h3>
      </div>
      <div className={styles.list}>
        <button className={styles.newCard} onClick={onNew} aria-label="New furniture" title="New furniture">
          <div className={styles.newCardIcon}>
            <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
              <path d="M12 5v14M5 12h14" strokeLinecap="round" />
            </svg>
          </div>
          <div className={styles.newCardLabel}>New</div>
        </button>
        {library.map((template) => (
          <FurnitureCard
            key={template.id}
            template={template}
            onDelete={() => {
              if (window.confirm(`Delete "${template.name}"? It will also disappear from any floor plan that uses it.`)) {
                onDelete(template.id);
              }
            }}
            onStartDrag={(e) => onStartDrag(template, e)}
          />
        ))}
      </div>
    </div>
  );
}
