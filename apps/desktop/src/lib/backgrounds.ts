import type { BackgroundDefinition } from '@veyra/shared';

const MAX_BG_DIM = 1920;

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not load the image.'));
    img.src = url;
  });
}

function drawScaled(source: HTMLImageElement, maxDim: number): string {
  const w = source.naturalWidth;
  const h = source.naturalHeight;
  const scale = Math.min(1, maxDim / Math.max(1, Math.max(w, h)));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(w * scale));
  canvas.height = Math.max(1, Math.round(h * scale));
  canvas.getContext('2d')!.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', 0.85);
}

function fileExtOk(name: string, re: RegExp): boolean {
  return re.test(name.toLowerCase());
}

/**
 * Convert an uploaded file into a BackgroundDefinition.
 * Images are downscaled to a persistent data URL; videos are session-scoped
 * object URLs (too large to persist) and lose their src after a reload.
 */
export async function buildBackgroundAssetFromFile(file: File): Promise<BackgroundDefinition> {
  const name = file.name.replace(/\.[^.]+$/, '');
  const isImage = fileExtOk(file.name, /\.(jpe?g|png|webp)$/);
  const isVideo = fileExtOk(file.name, /\.(mp4|webm)$/);

  if (isImage) {
    const url = URL.createObjectURL(file);
    try {
      const img = await loadImage(url);
      return {
        id: `bg-custom-${Date.now()}`,
        name,
        mode: 'image',
        premium: false,
        kind: 'uploaded',
        src: drawScaled(img, MAX_BG_DIM),
      };
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  if (isVideo) {
    return {
      id: `bg-custom-${Date.now()}`,
      name,
      mode: 'video',
      premium: false,
      kind: 'uploaded',
      src: URL.createObjectURL(file),
    };
  }

  throw new Error('Unsupported file. Use JPG, PNG, WEBP, MP4 or WEBM.');
}
