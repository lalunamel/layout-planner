import { useEffect, useRef, useState } from 'react';
import styles from './UnderlayButton.module.css';

interface UnderlayButtonProps {
  hasImage: boolean;
  disabled: boolean;
  onAddFile: (file: File) => void;
  onRecalibrate: () => void;
  onReplaceFile: (file: File) => void;
  onRemove: () => void;
}

export function UnderlayButton({ hasImage, disabled, onAddFile, onRecalibrate, onReplaceFile, onRemove }: UnderlayButtonProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const purposeRef = useRef<'add' | 'replace'>('add');

  useEffect(() => {
    if (!menuOpen) return;
    function onDocMouseDown(e: MouseEvent) {
      if (!(e.target as HTMLElement | null)?.closest('[data-underlay-menu]')) setMenuOpen(false);
    }
    window.addEventListener('mousedown', onDocMouseDown);
    return () => window.removeEventListener('mousedown', onDocMouseDown);
  }, [menuOpen]);

  function pick(purpose: 'add' | 'replace') {
    purposeRef.current = purpose;
    setMenuOpen(false);
    fileRef.current?.click();
  }

  const label = hasImage ? 'Floor plan image' : 'Add floor plan image';

  return (
    <div className={styles.wrap} data-underlay-menu>
      <button
        className={menuOpen ? 'iconButton active' : 'iconButton'}
        disabled={disabled}
        aria-label={label}
        title={label}
        onClick={() => (hasImage ? setMenuOpen((o) => !o) : pick('add'))}
      >
        <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <rect x="3" y="4" width="18" height="16" rx="2" />
          <circle cx="9" cy="10" r="1.6" />
          <path d="M21 16l-5-5-8 8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {menuOpen && (
        <div className={styles.menu}>
          <button
            onClick={() => {
              setMenuOpen(false);
              onRecalibrate();
            }}
          >
            Recalibrate
          </button>
          <button onClick={() => pick('replace')}>Replace image</button>
          <button
            className={styles.danger}
            onClick={() => {
              setMenuOpen(false);
              onRemove();
            }}
          >
            Remove image
          </button>
        </div>
      )}
      <input
        ref={fileRef}
        className={styles.fileInput}
        type="file"
        accept="image/*"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (!file) return;
          if (purposeRef.current === 'replace') onReplaceFile(file);
          else onAddFile(file);
        }}
      />
    </div>
  );
}
