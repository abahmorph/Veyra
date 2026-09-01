import { FACE } from './FaceTracker.js';

export interface ImageFaceResult {
  landmarks: { x: number; y: number }[];
  found: boolean;
}

/**
 * Analyze a still image with a one-shot IMAGE-mode FaceLandmarker.
 * Used by the consent-based face-replace flow to register an authorized face.
 */
export async function analyzeFaceImage(
  modelPath: string,
  wasmPath: string,
  image: HTMLImageElement | HTMLCanvasElement,
): Promise<ImageFaceResult> {
  const vision = await import('@mediapipe/tasks-vision');
  const { FilesetResolver, FaceLandmarker } = vision;

  let wasmBase: Awaited<ReturnType<typeof FilesetResolver.forVisionTasks>>;
  try {
    wasmBase = await FilesetResolver.forVisionTasks(wasmPath);
  } catch {
    wasmBase = await FilesetResolver.forVisionTasks();
  }

  const create = (delegate: 'GPU' | 'CPU') =>
    FaceLandmarker.createFromOptions(wasmBase, {
      baseOptions: { modelAssetPath: modelPath, delegate },
      runningMode: 'IMAGE',
      numFaces: 1,
      outputFaceBlendshapes: false,
    });

  let landmarker: Awaited<ReturnType<typeof create>> | null = null;
  try {
    landmarker = await create('GPU');
  } catch {
    landmarker = await create('CPU');
  }

  try {
    const result = landmarker.detect(image);
    const face = result.faceLandmarks?.[0];
    if (!face || face.length < FACE.foreheadRight + 1) {
      return { landmarks: [], found: false };
    }
    return {
      landmarks: face.map((l) => ({ x: l.x, y: l.y })),
      found: true,
    };
  } finally {
    landmarker.close();
  }
}
