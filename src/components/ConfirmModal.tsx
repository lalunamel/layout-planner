import { useEffect, useRef } from 'react';
import styles from './ConfirmModal.module.css';

export interface ConfirmRequest {
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
}

/** In-app replacement for window.confirm, used before destructive actions. */
export function ConfirmModal({ request, onClose }: { request: ConfirmRequest; onClose: () => void }) {
  const cancelRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    // Default focus on Cancel, so a stray Enter doesn't delete anything.
    cancelRef.current?.focus();
  }, []);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <div className={styles.scrim} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={styles.panel} role="alertdialog" aria-labelledby="confirm-title" aria-describedby="confirm-message">
        <h2 id="confirm-title" className={styles.title}>
          Are you sure?
        </h2>
        <p id="confirm-message" className={styles.message}>
          {request.message}
        </p>
        <div className={styles.actions}>
          <button ref={cancelRef} className={styles.btnGhost} onClick={onClose}>
            Cancel
          </button>
          <button
            className={styles.btnDanger}
            onClick={() => {
              request.onConfirm();
              onClose();
            }}
          >
            {request.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

/** In-app replacement for window.alert: a message with a single OK button. */
export function NoticeModal({ title, message, onClose }: { title: string; message: string; onClose: () => void }) {
  const okRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    okRef.current?.focus();
  }, []);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <div className={styles.scrim} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={styles.panel} role="alertdialog" aria-labelledby="notice-title" aria-describedby="notice-message">
        <h2 id="notice-title" className={styles.title}>
          {title}
        </h2>
        <p id="notice-message" className={styles.message}>
          {message}
        </p>
        <div className={styles.actions}>
          <button ref={okRef} className={styles.btnPrimary} onClick={onClose}>
            OK
          </button>
        </div>
      </div>
    </div>
  );
}
