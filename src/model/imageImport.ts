import { fitWithin, MAX_IMAGE_SIDE_PX, type Size } from './underlay';

export const UNREADABLE_FILE_TITLE = 'Unable to read file';
export const NOT_AN_IMAGE = 'Please upload an image file instead';

export interface ImportedImage {
  dataUrl: string;
  size: Size;
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('not-image'));
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => (img.naturalWidth > 0 && img.naturalHeight > 0 ? resolve(img) : reject(new Error('not-image')));
    img.onerror = () => reject(new Error('not-image'));
    img.src = src;
  });
}

export async function loadImageSize(src: string): Promise<Size> {
  const img = await loadImage(src);
  return { width: img.naturalWidth, height: img.naturalHeight };
}

/** Read an image file into a data URL, downscaling (to PNG, which keeps
 * line drawings crisp) when its longest side exceeds MAX_IMAGE_SIDE_PX. */
export async function importImageFile(file: File): Promise<ImportedImage> {
  if (!file.type.startsWith('image/')) throw new Error('not-image');
  const original = await readAsDataUrl(file);
  const img = await loadImage(original);
  const natural = { width: img.naturalWidth, height: img.naturalHeight };
  const target = fitWithin(natural, MAX_IMAGE_SIDE_PX);
  if (target === natural) return { dataUrl: original, size: natural };

  const canvas = document.createElement('canvas');
  canvas.width = target.width;
  canvas.height = target.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('not-image');
  ctx.drawImage(img, 0, 0, target.width, target.height);
  return { dataUrl: canvas.toDataURL('image/png'), size: target };
}
