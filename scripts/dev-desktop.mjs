// Runs the Veyra desktop app in development:
//   1. esbuild-bundles the Electron main + preload (watch mode)
//   2. starts the Vite dev server for the renderer
//   3. launches Electron pointed at the Vite server
import { context } from 'esbuild';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { existsSync, mkdirSync } from 'node:fs';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const desktop = path.join(root, 'apps/desktop');
const requireFromDesktop = createRequire(path.join(desktop, 'package.json'));
const { createServer } = requireFromDesktop('vite');
const outdir = path.join(desktop, 'dist-electron');
mkdirSync(outdir, { recursive: true });

const electron = process.platform === 'win32' ? 'electron.cmd' : 'electron';
const localBin = path.join(desktop, 'node_modules', '.bin', electron);
const electronBin = existsSync(localBin) ? localBin : path.join(root, 'node_modules', '.bin', electron);

// 1) Bundle main + preload (watch mode via esbuild context).
const ctx = await context({
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node20',
  external: ['electron'],
  sourcemap: true,
  outdir,
  entryPoints: [path.join(desktop, 'electron/main.ts'), path.join(desktop, 'electron/preload.ts')],
  outExtension: { '.js': '.cjs' },
  logLevel: 'info',
});
await ctx.watch();
console.log('[electron] watching main + preload -> dist-electron');

// 2) Vite dev server.
const server = await createServer({ root: desktop, configFile: path.join(desktop, 'vite.config.ts'), server: { port: 5173, strictPort: true } });
await server.listen();
const devUrl = 'http://localhost:5173';
console.log(`[veyra] renderer dev server: ${devUrl}`);

// 3) Launch Electron.
const child = spawn(electronBin, [desktop], {
  env: { ...process.env, VEYRA_DEV_SERVER_URL: devUrl },
  stdio: 'inherit',
});

child.on('exit', () => {
  void server.close();
  process.exit(0);
});
