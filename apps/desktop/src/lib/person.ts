import { useCallback } from 'react';
import type { PersonAsset } from '@veyra/shared';
import { getPipeline } from '../engine/pipeline';
import { useStudio } from '../store/useStudio';
import { useApp } from '../store/useApp';
import { useEntitlement } from './entitlement';

const MAX_PHOTO_DIM = 1024;
const MAX_THUMB_DIM = 360;

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not load the image.'));
    img.src = url;
  });
}

function drawScaled(source: HTMLImageElement | HTMLVideoElement, maxDim: number, mime: string, quality: number): string {
  const isVideo = source instanceof HTMLVideoElement;
  const w = isVideo ? source.videoWidth : source.naturalWidth;
  const h = isVideo ? source.videoHeight : source.naturalHeight;
  const scale = Math.min(1, maxDim / Math.max(1, Math.max(w, h)));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(w * scale));
  canvas.height = Math.max(1, Math.round(h * scale));
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL(mime, quality);
}

function fileExtOk(name: string, re: RegExp): boolean {
  return re.test(name.toLowerCase());
}

function secondsFromFile(file: File): Promise<number> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const v = document.createElement('video');
    v.preload = 'metadata';
    v.muted = true;
    v.onloadedmetadata = () => {
      resolve(Number.isFinite(v.duration) ? v.duration : 0);
      URL.revokeObjectURL(url);
    };
    v.onerror = () => {
      resolve(0);
      URL.revokeObjectURL(url);
    };
    v.src = url;
  });
}

function videoThumbnail(file: File, url: string): Promise<string | undefined> {
  return new Promise((resolve) => {
    const v = document.createElement('video');
    v.preload = 'metadata';
    v.muted = true;
    v.playsInline = true;
    v.onloadeddata = () => {
      try {
        resolve(drawScaled(v, MAX_THUMB_DIM, 'image/jpeg', 0.8));
      } catch {
        resolve(undefined);
      }
    };
    v.onerror = () => resolve(undefined);
    v.src = url;
  });
}

/**
 * Convert an uploaded file into a PersonAsset.
 * Photos are downscaled to a persistent data URL; videos are session-scoped
 * object URLs (too large to persist) with a thumbnail + duration.
 */
export async function buildPersonAssetFromFile(file: File): Promise<PersonAsset> {
  const name = file.name.replace(/\.[^.]+$/, '');
  const isImage = fileExtOk(file.name, /\.(jpe?g|png|webp)$/);
  const isVideo = fileExtOk(file.name, /\.(mp4|webm)$/);

  if (isImage) {
    const url = URL.createObjectURL(file);
    try {
      const img = await loadImage(url);
      const src = drawScaled(img, MAX_PHOTO_DIM, 'image/jpeg', 0.85);
      return {
        id: `person-${Date.now()}`,
        name,
        kind: 'photo',
        src,
        thumbnail: drawScaled(img, MAX_THUMB_DIM, 'image/jpeg', 0.8),
        premium: false,
        source: 'uploaded',
        transformAvailable: true,
        transformReason: 'Photo-driven face swap using your uploaded, authorized photo.',
      };
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  if (isVideo) {
    const url = URL.createObjectURL(file);
    const [durationSec, thumbnail] = await Promise.all([secondsFromFile(file), videoThumbnail(file, url)]);
    return {
      id: `person-${Date.now()}`,
      name,
      kind: 'video',
      src: url,
      thumbnail,
      durationSec,
      premium: false,
      source: 'uploaded',
      transformAvailable: false,
      transformReason:
        'Video-driven face transformation is not wired to the AI model in this build yet. The pipeline is ready — the model will connect here without a UI change.',
    };
  }

  throw new Error('Unsupported file. Use JPG, PNG, WEBP, MP4 or WEBM.');
}

/**
 * Real wiring: computes face landmarks on an uploaded photo and registers them
 * with the engine pipeline so the Face Swap effect actually drives from the asset.
 * Returns ok:false (with a reason) when the AI model cannot be used.
 */
export async function prepareFaceReplaceAssets(person: PersonAsset): Promise<{ ok: boolean; reason?: string }> {
  if (person.kind !== 'photo') return { ok: false, reason: person.transformReason ?? 'Only photos are supported by the current AI build.' };
  try {
    const img = await loadImage(person.src);
    const pipeline = getPipeline();
    // The tracker is created on demand so photo face-swap works even before
    // the live camera preview has been started.
    pipeline.ensureFaceTracker();

    const deadline = Date.now() + 20000;
    while (Date.now() < deadline) {
      const t = getPipeline().faceTracker;
      if (t?.ready) break;
      if (t?.statusValue === 'error') {
        return { ok: false, reason: `The face-tracking model failed to load.${t.errorMessage ? ` ${t.errorMessage}` : ''}` };
      }
      await new Promise((r) => setTimeout(r, 250));
    }
    const readyTracker = getPipeline().faceTracker;
    if (!readyTracker || !readyTracker.ready) {
      const status = readyTracker?.statusValue;
      if (status === 'error') {
        return { ok: false, reason: `The face-tracking model failed to load.${readyTracker?.errorMessage ? ` ${readyTracker.errorMessage}` : ''}` };
      }
      return { ok: false, reason: 'The face-tracking model is still loading. Try again in a few seconds.' };
    }

    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    canvas.getContext('2d')!.drawImage(img, 0, 0);
    const pose = readyTracker.detectImage(canvas);
    if (!pose) return { ok: false, reason: 'No face detected in the uploaded photo.' };

    getPipeline().setFaceReplaceAssets({
      sourceImage: img,
      sourceLandmarks: pose.landmarks.map((l) => ({ x: l.x, y: l.y })),
    });
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: (err as Error).message };
  }
}

/** Component-facing orchestration for selecting a person / character. */
export function usePersonActions() {
  const setPerson = useStudio((s) => s.setPerson);
  const effectId = useStudio((s) => s.effectId);
  const setEffect = useStudio((s) => s.setEffect);
  const toast = useApp((s) => s.toast);
  const { activate } = useEntitlement();

  const clearPerson = useCallback(() => {
    setPerson(null);
    if (effectId === 'avatar' || effectId === 'face-replace') setEffect('none');
  }, [setPerson, setEffect, effectId]);

  const selectPerson = useCallback(
    async (person: PersonAsset): Promise<boolean> => {
      if (person.kind === 'video') {
        setPerson(person);
        toast('info', `"${person.name}" selected as your person. ${person.transformReason}`);
        return false;
      }
      if (person.kind === 'character') {
        const ok = await activate('avatar');
        if (ok) {
          setPerson(person);
          toast('success', `"${person.name}" is live.`);
        }
        return ok;
      }
      // photo — real face-swap path
      const prep = await prepareFaceReplaceAssets(person);
      if (!prep.ok) {
        toast('warn', prep.reason ?? 'Could not prepare this person for transformation.');
        return false;
      }
      const ok = await activate('face-replace');
      if (ok) {
        setPerson(person);
        toast('success', `"${person.name}" is your face source.`);
      }
      return ok;
    },
    [setPerson, activate, toast],
  );

  return { selectPerson, clearPerson };
}
