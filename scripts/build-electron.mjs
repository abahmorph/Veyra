// Builds the Electron main + preload processes with esbuild (fast, no tsc).
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const desktop = path.join(root, 'apps/desktop');

const common = {
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node20',
  sourcemap: true,
  external: ['electron'],
  outdir: path.join(desktop, 'dist-electron'),
  outExtension: { '.js': '.cjs' },
  logLevel: 'info',
};

const main = await build({
  ...common,
  entryPoints: [path.join(desktop, 'electron/main.ts')],
  metafile: true,
});

await build({
  ...common,
  entryPoints: [path.join(desktop, 'electron/preload.ts')],
});

const files = Object.keys(main.metafile.outputs);
console.log(`[electron] built main (${files.length} outputs) -> dist-electron`);
