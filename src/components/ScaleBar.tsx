import { formatFeetInches } from '../model/geometry';
import { pickScaleBar } from '../model/view';
import styles from './ScaleBar.module.css';

const CAP_HEIGHT = 10;

/** Scale legend drawn as a dimension line (|—— 5' ——|), in the same
 * notation the canvas uses for wall lengths, sized to the current zoom. */
export function ScaleBar({ scale }: { scale: number }) {
  const lengthFt = pickScaleBar(scale);
  const widthPx = lengthFt * scale;
  const label = formatFeetInches(lengthFt);

  return (
    <div className={styles.scaleBar} aria-label={`Scale: ${label}`}>
      <span className={styles.label}>{label}</span>
      <svg width={widthPx + 2} height={CAP_HEIGHT} aria-hidden="true">
        <g stroke="var(--ink)" strokeWidth={1.5} strokeLinecap="round">
          <line x1={1} y1={1} x2={1} y2={CAP_HEIGHT - 1} />
          <line x1={1} y1={CAP_HEIGHT / 2} x2={widthPx + 1} y2={CAP_HEIGHT / 2} />
          <line x1={widthPx + 1} y1={1} x2={widthPx + 1} y2={CAP_HEIGHT - 1} />
        </g>
      </svg>
    </div>
  );
}
