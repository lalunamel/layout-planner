import { useEffect, useState } from 'react';
import { loadImageSize } from '../model/imageImport';
import type { Size } from '../model/underlay';

/** Natural pixel size of an image source, or null while loading / on error. */
export function useImageSize(src: string | null): Size | null {
  const [loaded, setLoaded] = useState<{ src: string; size: Size } | null>(null);

  useEffect(() => {
    if (!src) return;
    let cancelled = false;
    loadImageSize(src)
      .then((size) => {
        if (!cancelled) setLoaded({ src, size });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [src]);

  return loaded && loaded.src === src ? loaded.size : null;
}
