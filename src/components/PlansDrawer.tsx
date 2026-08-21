import { useEffect, useRef, useState } from 'react';
import type { FloorPlan } from '../model/types';
import styles from './PlansDrawer.module.css';

interface PlansDrawerProps {
  open: boolean;
  onClose: () => void;
  plans: FloorPlan[];
  activePlanId: string | null;
  onOpenPlan: (id: string) => void;
  onNewPlan: () => void;
  onRenamePlan: (id: string, name: string) => void;
  onDeletePlan: (id: string) => void;
}

export function PlansDrawer({
  open,
  onClose,
  plans,
  activePlanId,
  onOpenPlan,
  onNewPlan,
  onRenamePlan,
  onDeletePlan,
}: PlansDrawerProps) {
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const renameInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) {
      setOpenMenuId(null);
      setRenamingId(null);
    }
  }, [open]);

  useEffect(() => {
    function onDocMouseDown(e: MouseEvent) {
      const target = e.target as HTMLElement | null;
      if (!target?.closest('[data-kebab]')) setOpenMenuId(null);
    }
    window.addEventListener('mousedown', onDocMouseDown);
    return () => window.removeEventListener('mousedown', onDocMouseDown);
  }, []);

  useEffect(() => {
    if (renamingId) {
      renameInputRef.current?.focus();
      renameInputRef.current?.select();
    }
  }, [renamingId]);

  function commitRename() {
    if (renamingId && renameValue.trim()) {
      onRenamePlan(renamingId, renameValue.trim());
    }
    setRenamingId(null);
  }

  return (
    <>
      <div className={`${styles.scrim} ${open ? styles.scrimOpen : ''}`} onClick={onClose} />
      <div className={`${styles.drawer} ${open ? styles.drawerOpen : ''}`}>
        <div className={styles.header}>
          <button className={styles.hamburger} onClick={onClose} aria-label="Close floor plans" title="Close floor plans">
            <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" />
            </svg>
          </button>
          <h2>Floor Plans</h2>
        </div>
        <div className={styles.list}>
          <button className={styles.newItem} onClick={onNewPlan}>
            <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
              <path d="M12 5v14M5 12h14" strokeLinecap="round" />
            </svg>
            New
          </button>
          {plans.map((plan) => (
            <div
              key={plan.id}
              className={`${styles.item} ${plan.id === activePlanId ? styles.itemActive : ''}`}
              onClick={() => {
                if (renamingId !== plan.id) {
                  onOpenPlan(plan.id);
                  onClose();
                }
              }}
            >
              {renamingId === plan.id ? (
                <input
                  ref={renameInputRef}
                  className={styles.renameInput}
                  value={renameValue}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitRename();
                    if (e.key === 'Escape') setRenamingId(null);
                  }}
                  onBlur={commitRename}
                />
              ) : (
                <span className={styles.itemName}>{plan.name}</span>
              )}
              <div className={styles.kebabWrap} data-kebab>
                <button
                  className={styles.kebab}
                  onClick={(e) => {
                    e.stopPropagation();
                    setOpenMenuId((cur) => (cur === plan.id ? null : plan.id));
                  }}
                  aria-label="Floor plan options"
                >
                  &#8942;
                </button>
                {openMenuId === plan.id && (
                  <div className={styles.menu} data-kebab>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpenMenuId(null);
                        setRenameValue(plan.name);
                        setRenamingId(plan.id);
                      }}
                    >
                      Rename
                    </button>
                    <button
                      className={styles.danger}
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpenMenuId(null);
                        onDeletePlan(plan.id);
                      }}
                    >
                      Delete
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
