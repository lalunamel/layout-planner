import { useEffect, useRef, useState } from 'react';
import { importImageFile, NOT_AN_IMAGE, UNREADABLE_FILE_TITLE, type ImportedImage } from '../model/imageImport';
import type { Rect } from '../model/underlay';
import { CalibrationPanel } from './calibration/CalibrationPanel';
import calibrationStyles from './calibration/Calibration.module.css';
import styles from './NewPlanModal.module.css';

export const DEFAULT_PLAN_NAME = 'Untitled Floor Plan';

interface NewPlanModalProps {
  onCreateManual: (name: string) => void;
  /** Returns an error message to show, or null once the plan is created. */
  onCreateFromImage: (name: string, image: ImportedImage, boxPx: Rect, ftPerPx: number) => string | null;
  /** Omitted for the empty state: with no plans there's nothing to go back to. */
  onCancel?: () => void;
}

export function NewPlanModal({ onCreateManual, onCreateFromImage, onCancel }: NewPlanModalProps) {
  const [title, setTitle] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [dropActive, setDropActive] = useState(false);
  const [busy, setBusy] = useState(false);
  // Set once an image is read: the modal moves on to calibrating it.
  const [image, setImage] = useState<ImportedImage | null>(null);
  const imageRef = useRef(image);
  imageRef.current = image;
  const titleRef = useRef<HTMLInputElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const name = title.trim() || DEFAULT_PLAN_NAME;
  // While an image is being read, the modal is about to move on to
  // calibration, so closing it or creating a manual plan waits until it settles.
  const busyRef = useRef(false);

  async function upload(file: File) {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError(null);
    try {
      setImage(await importImageFile(file));
    } catch {
      setError(`${UNREADABLE_FILE_TITLE}. ${NOT_AN_IMAGE}`);
    }
    busyRef.current = false;
    setBusy(false);
  }

  function close() {
    if (!busyRef.current) onCancel?.();
  }

  function createManual() {
    if (!busyRef.current) onCreateManual(name);
  }

  const closeRef = useRef(close);
  closeRef.current = close;

  // Keep the latest upload() reachable from the window-level listeners.
  const uploadRef = useRef(upload);
  uploadRef.current = upload;

  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  useEffect(() => {
    // While calibrating, the calibration panel owns Esc and paste is moot.
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && !imageRef.current) closeRef.current();
    }
    function onPaste(e: ClipboardEvent) {
      if (imageRef.current) return;
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
  }, []);

  if (image) {
    return (
      <div className={calibrationStyles.scrim}>
        <CalibrationPanel
          src={image.dataUrl}
          natural={image.size}
          cancelLabel="Back"
          onCancel={() => setImage(null)}
          onSave={(boxPx, ftPerPx) => onCreateFromImage(name, image, boxPx, ftPerPx)}
        />
      </div>
    );
  }

  return (
    <div className={styles.scrim} onMouseDown={(e) => e.target === e.currentTarget && close()}>
      <div className={styles.panel} role="dialog" aria-label="New floor plan">
        {onCancel && (
          <button className={styles.close} onClick={close} aria-label="Close" title="Close">
            ×
          </button>
        )}
        <input
          ref={titleRef}
          className={styles.title}
          placeholder={DEFAULT_PLAN_NAME}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && createManual()}
        />
        <div className={styles.choices}>
          <button className={styles.card} disabled={busy} onClick={createManual}>
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
