import type { FacePose } from '../face/FaceTracker.js';
import { FACE } from '../face/FaceTracker.js';

export type CanvasEffectKind = 'robot' | 'avatar' | 'privacy-blur' | 'face-replace';

/**
 * Canvas-based effects that anchor geometry to facial landmarks.
 * `ctx` is the composited display context; `canvas` is the display canvas itself.
 */

export interface FaceReplaceAssets {
  sourceImage: HTMLImageElement;
  sourceLandmarks: { x: number; y: number }[];
  /** Normalized [0..1] within the source image. */
}

export function drawRobotMask(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  pose: FacePose,
  _t: number,
): void {
  const W = canvas.width;
  const H = canvas.height;
  const bbox = pose.boundingBox;
  if (!bbox) return;

  const cx = bbox.x * W + (bbox.w * W) / 2;
  const cy = bbox.y * H + (bbox.h * H) / 2;
  const w = bbox.w * W * 1.25;
  const h = bbox.h * H * 1.3;

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(pose.headTilt);

  const grad = ctx.createLinearGradient(0, -h / 2, 0, h / 2);
  grad.addColorStop(0, '#d8dbe0');
  grad.addColorStop(0.5, '#8b93a1');
  grad.addColorStop(1, '#3c4350');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.roundRect(-w / 2, -h / 2, w, h, [w * 0.24, w * 0.24, w * 0.14, w * 0.14]);
  ctx.fill();

  // glow eye visor
  const eyeY = (pose.landmarks[FACE.rightEyeOuter]!.y + pose.landmarks[FACE.leftEyeOuter]!.y) / 2 * H - cy;
  ctx.save();
  ctx.shadowColor = '#00e5ff';
  ctx.shadowBlur = 18;
  ctx.fillStyle = '#02222e';
  ctx.beginPath();
  ctx.roundRect(-w * 0.42, eyeY - h * 0.05, w * 0.84, h * 0.1, 8);
  ctx.fill();
  ctx.fillStyle = '#18e0ff';
  ctx.beginPath();
  ctx.roundRect(-w * 0.3, eyeY - h * 0.032, w * 0.22, h * 0.065, 4);
  ctx.fill();
  ctx.beginPath();
  ctx.roundRect(w * 0.08, eyeY - h * 0.032, w * 0.22, h * 0.065, 4);
  ctx.fill();
  ctx.restore();

  // grid overlay
  ctx.strokeStyle = 'rgba(120, 200, 255, 0.25)';
  ctx.lineWidth = 1;
  for (let i = -3; i <= 3; i++) {
    ctx.beginPath();
    ctx.moveTo((i / 3) * (w / 2), -h / 2);
    ctx.lineTo((i / 3) * (w / 2), h / 2);
    ctx.stroke();
  }
  for (let i = -3; i <= 3; i++) {
    ctx.beginPath();
    ctx.moveTo(-w / 2, (i / 3) * (h / 2));
    ctx.lineTo(w / 2, (i / 3) * (h / 2));
    ctx.stroke();
  }

  // mouth guard
  const mouthY = (pose.landmarks[FACE.mouthTop]!.y + pose.landmarks[FACE.mouthBottom]!.y) / 2 * H - cy;
  ctx.fillStyle = '#232a35';
  ctx.beginPath();
  ctx.roundRect(-w * 0.18, mouthY - h * 0.02, w * 0.36, h * 0.05, 3);
  ctx.fill();

  ctx.restore();
}

export function drawAvatar(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  pose: FacePose,
  t: number,
): void {
  const W = canvas.width;
  const H = canvas.height;
  const bbox = pose.boundingBox;
  if (!bbox) return;

  const headW = bbox.w * W * 2.2;
  const headH = bbox.h * H * 1.9;
  const cx = bbox.x * W + (bbox.w * W) / 2;
  const cy = (bbox.y * H + (bbox.h * H) / 2) * 0.95;

  const p = (i: number) => ({ x: pose.landmarks[i]!.x * W - cx, y: pose.landmarks[i]!.y * H - cy });

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(pose.headTilt * 0.8);

  // antenna
  ctx.strokeStyle = '#14f195';
  ctx.lineWidth = Math.max(2, headW * 0.015);
  ctx.beginPath();
  ctx.moveTo(0, -headH / 2);
  ctx.lineTo(headW * 0.18, -headH / 2 - headW * 0.28);
  ctx.stroke();
  ctx.fillStyle = '#ff3d81';
  const pulse = 0.7 + 0.3 * Math.sin(t * 0.004);
  ctx.globalAlpha = pulse;
  ctx.beginPath();
  ctx.arc(headW * 0.18, -headH / 2 - headW * 0.28, headW * 0.05, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  // ears
  ctx.fillStyle = '#12232a';
  ctx.beginPath();
  ctx.arc(-headW / 2 - headW * 0.06, 0, headW * 0.14, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(headW / 2 + headW * 0.06, 0, headW * 0.14, 0, Math.PI * 2);
  ctx.fill();

  // head
  const g = ctx.createLinearGradient(0, -headH / 2, 0, headH / 2);
  g.addColorStop(0, '#1de9b6');
  g.addColorStop(1, '#0d4a3e');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, headW / 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.18)';
  ctx.lineWidth = Math.max(2, headW * 0.012);
  ctx.stroke();

  // eyes — track real eyes
  const eyeL = p(FACE.leftEyeOuter);
  const eyeR = p(FACE.rightEyeOuter);
  const eyeLInner = p(FACE.leftEyeInner);
  const eyeRInner = p(FACE.rightEyeInner);
  const eyeH = Math.max(2, Math.abs(eyeL.y - eyeR.y) * 0.6 + headH * 0.06);
  const nose = p(FACE.noseTip);
  const lookX = Math.max(-1, Math.min(1, (nose.x / Math.max(1, headW * 0.3)))) * headW * 0.03;
  const lookY = Math.max(-1, Math.min(1, nose.y / Math.max(1, headH * 0.2))) * headH * 0.03;

  ctx.fillStyle = '#f4fbfa';
  for (const e of [eyeL, eyeR]) {
    ctx.beginPath();
    ctx.ellipse(e.x, e.y, headW * 0.075, eyeH, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = '#08111a';
  for (const e of [eyeL, eyeR]) {
    ctx.beginPath();
    ctx.arc(e.x + lookX, e.y + lookY, headW * 0.032, 0, Math.PI * 2);
    ctx.fill();
  }
  // keep eyes symmetrical about the face center for stability
  void eyeLInner;
  void eyeRInner;

  // mouth — opens with real mouth openness
  const mouthTop = p(FACE.mouthTop);
  const mouthBot = p(FACE.mouthBottom);
  const openness = Math.abs(mouthBot.y - mouthTop.y);
  const mouthW = headW * 0.28;
  ctx.strokeStyle = '#05251e';
  ctx.lineWidth = Math.max(2, headW * 0.014);
  ctx.beginPath();
  ctx.moveTo(-mouthW / 2, mouthTop.y);
  ctx.quadraticCurveTo(0, mouthTop.y + openness * 4 + headH * 0.03, mouthW / 2, mouthTop.y);
  ctx.stroke();

  // neck + shoulders
  const chin = p(FACE.chin);
  ctx.fillStyle = '#0d4a3e';
  ctx.beginPath();
  ctx.roundRect(-headW * 0.42, chin.y, headW * 0.84, headH * 0.5, headW * 0.2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(0, chin.y + headH * 0.34, headW * 0.62, headH * 0.22, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#0a352d';
  ctx.fill();

  ctx.restore();
}

export function drawPrivacyBlur(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  pose: FacePose,
): void {
  const bbox = pose.boundingBox;
  if (!bbox) return;
  const W = canvas.width;
  const H = canvas.height;
  const cx = (bbox.x + bbox.w / 2) * W;
  const cy = (bbox.y + bbox.h / 2) * H;
  const rx = bbox.w * W * 0.62;
  const ry = bbox.h * H * 0.78;
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.clip();
  ctx.filter = `blur(${Math.max(14, ry * 0.22)}px)`;
  ctx.drawImage(canvas, 0, 0);
  ctx.restore();
}

function estimateSimilarity(
  src: { x: number; y: number }[],
  dst: { x: number; y: number }[],
): { scale: number; rotate: number; tx: number; ty: number } {
  // Use the nose tip and the eye-midpoints as two anchor vectors.
  const s0 = src[0]!;
  const d0 = dst[0]!;
  const sVec = { x: src[1]!.x - s0.x, y: src[1]!.y - s0.y };
  const dVec = { x: dst[1]!.x - d0.x, y: dst[1]!.y - d0.y };
  const sLen = Math.hypot(sVec.x, sVec.y) || 1;
  const dLen = Math.hypot(dVec.x, dVec.y);
  const scale = dLen / sLen;
  const rotate = Math.atan2(dVec.y, dVec.x) - Math.atan2(sVec.y, sVec.x);
  return { scale, rotate, tx: d0.x - s0.x, ty: d0.y - s0.y };
}

export function drawFaceReplace(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  pose: FacePose,
  assets: FaceReplaceAssets,
): void {
  const bbox = pose.boundingBox;
  if (!bbox || assets.sourceLandmarks.length < 5) return;
  const W = canvas.width;
  const H = canvas.height;
  const targetIdx = [
    FACE.noseTip,
    Math.round((FACE.leftEyeInner + FACE.rightEyeInner) / 2),
    FACE.chin,
    FACE.foreheadRight,
  ];
  const src = [
    assets.sourceLandmarks[FACE.noseTip]!,
    {
      x: (assets.sourceLandmarks[FACE.leftEyeInner]!.x + assets.sourceLandmarks[FACE.rightEyeInner]!.x) / 2,
      y: (assets.sourceLandmarks[FACE.leftEyeInner]!.y + assets.sourceLandmarks[FACE.rightEyeInner]!.y) / 2,
    },
    assets.sourceLandmarks[FACE.chin]!,
    assets.sourceLandmarks[FACE.foreheadRight]!,
  ];
  const dst = targetIdx.map((i) => ({ x: pose.landmarks[i]!.x * W, y: pose.landmarks[i]!.y * H }));

  const { scale, rotate } = estimateSimilarity(src, dst);

  const sImg = assets.sourceImage;
  const sw = sImg.naturalWidth || sImg.width;
  const sh = sImg.naturalHeight || sImg.height;
  const sCx = assets.sourceLandmarks[FACE.noseTip]!.x * sw;
  const sCy = assets.sourceLandmarks[FACE.noseTip]!.y * sh;

  ctx.save();
  ctx.translate(dst[0]!.x, dst[0]!.y);
  ctx.rotate(rotate);
  ctx.scale(scale, scale);
  ctx.translate(-sCx, -sCy);

  // feathered edge mask for soft blending
  const mask = ctx.createRadialGradient(
    sCx, sCy, sw * 0.08,
    sCx, sCy, sw * 0.34,
  );
  mask.addColorStop(0, 'rgba(255,255,255,1)');
  mask.addColorStop(0.75, 'rgba(255,255,255,0.85)');
  mask.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.globalCompositeOperation = 'destination-over';
  ctx.fillStyle = mask;
  ctx.beginPath();
  ctx.arc(sCx, sCy, sw * 0.34, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalCompositeOperation = 'source-over';

  ctx.drawImage(sImg, 0, 0, sw, sh);
  ctx.restore();
}

/** Map effect ids (from the catalog) to canvas-drawn effect kinds. */
export function canvasEffectKindFor(effectId: string | null): CanvasEffectKind | null {
  switch (effectId) {
    case 'robot':
      return 'robot';
    case 'avatar':
      return 'avatar';
    case 'privacy-blur':
      return 'privacy-blur';
    case 'face-replace':
      return 'face-replace';
    default:
      return null;
  }
}

export function drawCanvasEffect(
  kind: CanvasEffectKind | null,
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  pose: FacePose | null,
  t: number,
  faceReplaceAssets?: FaceReplaceAssets,
): boolean {
  if (!pose || !kind) return false;
  switch (kind) {
    case 'robot':
      drawRobotMask(ctx, canvas, pose, t);
      return true;
    case 'avatar':
      drawAvatar(ctx, canvas, pose, t);
      return true;
    case 'privacy-blur':
      drawPrivacyBlur(ctx, canvas, pose);
      return true;
    case 'face-replace':
      if (faceReplaceAssets) {
        drawFaceReplace(ctx, canvas, pose, faceReplaceAssets);
        return true;
      }
      return false;
  }
}
