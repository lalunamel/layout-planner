import { useEffect, useRef, useState } from 'react';
import styles from './NewPlanModal.module.css';

export const DEFAULT_PLAN_NAME = 'Untitled Floor Plan';

interface NewPlanModalProps {
  onCreateManual: (name: string) => void;
  onUpload: (name: string, file: File) => Promise<string | null>;
  onCancel: () => void;
}

export function NewPlanModal({ onCreateManual, onUpload, onCancel }: NewPlanModalProps) {
  const [title, setTitle] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [dropActive, setDropActive] = useState(false);
  const [busy, setBusy] = useState(false);
  const titleRef = useRef<HTMLInputElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const name = title.trim() || DEFAULT_PLAN_NAME;

  async function upload(file: File) {
    if (busy) return;
    setBusy(true);
    setError(null);
    const message = await onUpload(name, file);
    setBusy(false);
    if (message) setError(message);
  }

  // Keep the latest upload() reachable from the window-level listeners.
  const uploadRef = useRef(upload);
  uploadRef.current = upload;

  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onCancel();
    }
    function onPaste(e: ClipboardEvent) {
      const file = [...(e.clipboardData?.files ?? [])].find((f) => f.type.startsWith('image/'));
      if (!file) return; // plain-text paste into the title field proceeds normally
      e.preventDefault();
      void uploadRef.current(file);
    }
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('paste', onPaste);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('paste', onPaste);
    };
  }, [onCancel]);

  return (
    <div className={styles.scrim} onMouseDown={(e) => e.target === e.currentTarget && onCancel()}>
      <div className={styles.panel} role="dialog" aria-label="New floor plan">
        <button className={styles.close} onClick={onCancel} aria-label="Close" title="Close">
          ×
        </button>
        <input
          ref={titleRef}
          className={styles.title}
          placeholder={DEFAULT_PLAN_NAME}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && onCreateManual(name)}
        />
        <div className={styles.choices}>
          <button className={styles.card} onClick={() => onCreateManual(name)}>
            <svg width={36} height={36} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6}>
              <path d="M4 20V4h9v6h7v10H4z" strokeLinejoin="round" />
              <path d="M13 4l7 6" strokeLinecap="round" />
            </svg>
            Manually create floor plan
          </button>
          <button
            className={`${styles.card} ${dropActive ? styles.dropActive : ''}`}
            disabled={busy}
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDropActive(true);
            }}
            onDragLeave={() => setDropActive(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDropActive(false);
              const file = e.dataTransfer.files[0];
              if (file) void upload(file);
            }}
          >
            <svg width={36} height={36} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6}>
              <rect x="3" y="4" width="18" height="16" rx="2" />
              <circle cx="9" cy="10" r="1.6" />
              <path d="M21 16l-5-5-8 8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Upload floor plan image
            <span className={styles.hint}>Click, drop, or paste</span>
            {error && <span className={styles.error}>{error}</span>}
          </button>
        </div>
        <input
          ref={fileRef}
          className={styles.fileInput}
          type="file"
          accept="image/*"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (file) void upload(file);
          }}
        />
      </div>
    </div>
  );
}
