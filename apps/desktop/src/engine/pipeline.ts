import { Pipeline, ShaderRenderer, resetBackgroundMediaCache } from '@veyra/engine';
import { ipc } from '../lib/bridge';
import { useApp } from '../store/useApp';
import { useStudio } from '../store/useStudio';

export const MODEL_PATHS = {
  faceModel: '/models/face_landmarker.task',
  segmentModel: '/models/selfie_multiclass_256x256.tflite',
  wasmPath: '/mediapipe/wasm',
};

let pipeline: Pipeline | null = null;

/** Explicitly point the pipeline's preview at a (mounted) canvas. */
export function bindDisplayCanvas(canvas: HTMLCanvasElement): Pipeline {
  const p = getPipeline();
  p.setDisplayCanvas(canvas);
  return p;
}

export function getPipeline(): Pipeline {
  if (pipeline) return pipeline;

  const canvas = document.createElement('canvas');
  pipeline = new Pipeline({
    displayCanvas: canvas,
    modelPaths: MODEL_PATHS,
    onStats: (stats) => useStudio.getState().setStats(stats),
    onStatusChange: (status) => {
      const s = useStudio.getState();
      s.setStatus(status === 'running' ? 'running' : status === 'error' ? 'error' : status === 'starting' ? 'starting' : 'stopped');
      s.setRunning(status === 'running');
    },
    onError: (message, hint) => {
      useStudio.getState().setErrorMessage(message);
      useApp.getState().toast('error', message);
      void hint;
    },
    virtualCamera: {
      start: async (opts) => {
        await ipc.virtualCamera.start(opts);
      },
      pushFrame: (blob) => {
        void blob.arrayBuffer().then((buf) => ipc.virtualCamera.pushFrame(buf, 0));
      },
      stop: async () => {
        await ipc.virtualCamera.stop();
      },
    },
  });

  subscribeModelStatus(pipeline);
  return pipeline;
}

function subscribeModelStatus(p: Pipeline): void {
  // Poll model readiness. Trackers are created lazily (on first pipeline start
  // or on-demand for photo face-swap), so keep watching until each resolves.
  const iv = setInterval(() => {
    const ft = p.faceTracker;
    const bg = p.backgroundProcessor;
    if (ft) useStudio.getState().setFaceModelReady(ft.ready);
    if (bg) useStudio.getState().setSegmentModelReady(bg.ready);
    const done = (ft && bg && ft.ready && bg.ready) || (ft?.statusValue === 'error' && bg?.statusValue === 'error');
    if (done) clearInterval(iv);
  }, 500);
}

export function destroyPipeline(): void {
  pipeline?.dispose();
  resetBackgroundMediaCache();
  pipeline = null;
}

export function describeGpuInfo(): { backend: string; renderer: string; vendor: string } {
  return ShaderRenderer.describe();
}

export { Pipeline };
