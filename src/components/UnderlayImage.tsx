import type { Underlay } from '../model/types';
import { underlayHeightFt } from '../model/underlay';
import { useImageSize } from '../hooks/useImageSize';

export function UnderlayImage({ src, underlay, opacity }: { src: string; underlay: Underlay; opacity: number }) {
  const natural = useImageSize(src);
  if (!natural) return null;
  return (
    <image
      href={src}
      x={underlay.x}
      y={underlay.y}
      width={underlay.widthFt}
      height={underlayHeightFt(underlay, natural)}
      preserveAspectRatio="none"
      opacity={opacity}
      style={{ pointerEvents: 'none' }}
    />
  );
}
