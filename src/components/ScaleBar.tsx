import { pickScaleBar } from '../model/view';
import styles from './ScaleBar.module.css';

const BAR_HEIGHT = 6;

/** Map-style scale legend: a bar of alternating segments showing how long a
 * round number of feet is at the current zoom. */
export function ScaleBar({ scale }: { scale: number }) {
  const { totalFt, segmentFt } = pickScaleBar(scale);
  const segmentPx = segmentFt * scale;
  const widthPx = totalFt * scale;
  const segments = Math.round(totalFt / segmentFt);

  return (
    <div className={styles.scaleBar} aria-label={`Scale: ${totalFt} ft`}>
      <div className={styles.labels} style={{ width: widthPx }}>
        <span>0</span>
        <span>{totalFt} ft</span>
      </div>
      <svg width={widthPx + 2} height={BAR_HEIGHT + 2} aria-hidden="true">
        {Array.from({ length: segments }, (_, i) => (
          <rect
            key={i}
            x={1 + i * segmentPx}
            y={1}
            width={segmentPx}
            height={BAR_HEIGHT}
            fill={i % 2 === 0 ? 'var(--ink)' : '#fff'}
          />
        ))}
        <rect x={1} y={1} width={widthPx} height={BAR_HEIGHT} fill="none" stroke="var(--ink)" strokeWidth={1} />
      </svg>
    </div>
  );
}
