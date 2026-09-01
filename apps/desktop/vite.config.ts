import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { viteStaticCopy } from 'vite-plugin-static-copy';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    viteStaticCopy({
      targets: [
        {
          src: path.resolve(dir, '../../node_modules/@mediapipe/tasks-vision/wasm/*'),
          dest: 'mediapipe/wasm',
        },
      ],
    }),
  ],
  resolve: {
    alias: {
      '@veyra/shared': path.resolve(dir, '../../packages/shared/src/index.ts'),
      '@veyra/engine': path.resolve(dir, '../../packages/engine/src/index.ts'),
    },
  },
  base: './',
  build: {
    outDir: 'dist',
    sourcemap: true,
    chunkSizeWarningLimit: 4000,
  },
  server: {
    port: 5173,
    strictPort: true,
  },
});
