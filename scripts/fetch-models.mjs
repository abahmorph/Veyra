// Fetch MediaPipe model assets required by the engine.
// Run: node scripts/fetch-models.mjs
import { mkdirSync, createWriteStream } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import https from 'node:https';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const dest = join(root, 'apps/desktop/public/models');
mkdirSync(dest, { recursive: true });

const MODELS = [
  {
    name: 'face_landmarker.task',
    url: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
  },
  {
    name: 'selfie_multiclass_256x256.tflite',
    url: 'https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_multiclass_256x256/float32/1/selfie_multiclass_256x256.tflite',
  },
];

function download(url, file) {
  return new Promise((resolve2, reject) => {
    const req = https.get(url, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        download(res.headers.location, file).then(resolve2).catch(reject);
        return;
      }
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode} for ${url}`));
        return;
      }
      const ws = createWriteStream(file);
      res.pipe(ws);
      ws.on('finish', () => ws.close(() => resolve2()));
      ws.on('error', reject);
    });
    req.on('error', reject);
  });
}

for (const m of MODELS) {
  const file = join(dest, m.name);
  console.log(`[models] fetching ${m.name} …`);
  await download(m.url, file);
  console.log(`[models] saved ${m.name}`);
}

console.log('[models] done');
