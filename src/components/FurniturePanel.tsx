import { useEffect, useState } from 'react';
import type { FurnitureTemplate } from '../model/types';
import { FurnitureCard } from './FurnitureCard';
import styles from './FurniturePanel.module.css';

interface FurniturePanelProps {
  library: FurnitureTemplate[];
  onNew: () => void;
  onEdit: (template: FurnitureTemplate) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
}

export function FurniturePanel({ library, onNew, onEdit, onDuplicate, onDelete }: FurniturePanelProps) {
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  useEffect(() => {
    function onDocMouseDown(e: MouseEvent) {
      const target = e.target as HTMLElement | null;
      if (!target?.closest('[data-kebab]')) setOpenMenuId(null);
    }
    window.addEventListener('mousedown', onDocMouseDown);
    return () => window.removeEventListener('mousedown', onDocMouseDown);
  }, []);

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <h3>Furniture</h3>
        <button className={styles.newButton} onClick={onNew} aria-label="New furniture" title="New furniture">
          +
        </button>
      </div>
      <div className={styles.list}>
        {library.length === 0 && <div className={styles.empty}>No furniture yet — add a piece to get started.</div>}
        {library.map((template) => (
          <FurnitureCard
            key={template.id}
            template={template}
            menuOpen={openMenuId === template.id}
            onToggleMenu={() => setOpenMenuId((cur) => (cur === template.id ? null : template.id))}
            onEdit={() => {
              setOpenMenuId(null);
              onEdit(template);
            }}
            onDuplicate={() => {
              setOpenMenuId(null);
              onDuplicate(template.id);
            }}
            onDelete={() => {
              setOpenMenuId(null);
              onDelete(template.id);
            }}
          />
        ))}
      </div>
    </div>
  );
}
