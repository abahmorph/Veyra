# Veyra architecture

## High-level flow

1. The **engine** (`packages/engine`) opens the physical camera with `CameraSource`
   (WebRTC `getUserMedia`) and drives a `requestAnimationFrame` loop.
2. Each frame is processed in order:
   - **Face tracking** (`face/FaceTracker.ts`, MediaPipe `FaceLandmarker`, 478 landmarks,
     throttled ~66 ms) produces a `FacePose`.
   - **Background compositing** (`background/BackgroundProcessor.ts`, `ImageSegmenter`)
     writes the subject over the chosen background onto an intermediate canvas.
   - **Effect** is applied via the WebGL2 **shader path** (`ShaderRenderer` +
     `shaders.ts`) or the **canvas path** (`effects/canvasEffects.ts`) for landmark-anchored
     effects (robot/avatar/privacy-blur/face-replace).
3. The result is drawn to the **display canvas** (Studio preview) and, when the virtual
   camera is on, sampled to JPEG and pushed through the renderer→main IPC bridge
   (`vcam:frame`) to the Electron main process, which streams it to ffmpeg → v4l2loopback.
4. **Audio** runs in parallel: the mic is processed through Web Audio worklets
   (pitch/robot/radio/echo/alien + noise gate) and played to the `veyra_mic` sink
   (`audio/AudioEngine.ts`, `audio/worklets.ts`).

The engine is fully UI-agnostic. The desktop app owns a pipeline **singleton**
(`apps/desktop/src/engine/pipeline.ts`) — `getPipeline()` returns it and
`bindDisplayCanvas(canvas)` re-points it at a mounted preview canvas. `PipelineSync`
mounts once in `App.tsx` and pushes any studio-state change into the engine regardless
of the active screen.

## Quality adaptation

On weak hardware (e.g. Intel HD 520), the pipeline adapts: detection/segmentation runs
are throttled per frame, mask resolution defaults to 192×192, GPU delegate is tried
first then falls back to CPU, and quality scale can be lowered (`MetricsCollector`,
`Pipeline.adaptQuality`). `PerformanceStats` drive the Studio HUD.

## Model assets

| Model | Purpose | Location |
|---|---|---|
| `face_landmarker.task` | 478-point face tracking | `apps/desktop/public/models/` |
| `selfie_multiclass_256x256.tflite` | person/background segmentation | `apps/desktop/public/models/` |
| tasks-vision WASM | MediaPipe runtime | bundled by Vite into `/mediapipe/wasm` |

Fetch models with `node scripts/fetch-models.mjs`. If the local WASM path fails,
`FilesetResolver.forVisionTasks()` falls back to the MediaPipe CDN.

## Electron main process

- **Virtual camera** (`electron/virtualCamera/platform.ts`): a `V4L2Adapter` spawns
  ffmpeg writing MJPEG to `/dev/video10` (`exclusive_caps=1`, label "Veyra Camera").
  Windows/macOS/unsupported return honest `unavailable` statuses with guidance.
- **Virtual mic** (`electron/virtualMic/index.ts`): `pactl load-module module-null-sink`
  named `veyra_mic` ("Veyra Microphone").
- **App detection** (`electron/appsDetector.ts`): detects running call apps by process name
  so the UI can say "join the call now".
- IPC contract lives in `packages/shared/src/types.ts` (`VeyraIpc`) and is implemented
  by `electron/preload.ts` (contextBridge, sandboxed renderer) with a browser fallback in
  `apps/desktop/src/lib/bridge.ts`.

## Server (`server/`)

Express 5 API. Database is `node:sqlite` by default (`server/data/veyra.sqlite`),
Postgres via `DB_DRIVER=postgres` + `DATABASE_URL` (schema in `server/migrations/001_init.sql`).
Drivers implement one async `Db` interface (`server/src/db/connection.ts`).

| Route | Purpose |
|---|---|
| `POST /api/auth/signup` · `/login` · `/logout` | sessions (bcrypt + opaque tokens, hashed at rest) |
| `POST /api/auth/password/reset*` | password reset (dev logs the token) |
| `DELETE /api/auth/sessions/:id` | device management |
| `GET /api/user/me` · `PATCH /api/user/me` · `GET /api/user/me/sessions` | profile/sessions |
| `GET /api/pricing` | server-owned pricing (source of truth) |
| `GET /api/subscription/status` | current tier/plan |
| `POST /api/subscription/checkout` | creates a payment record + checkout URL (mock by default) |
| `POST /api/subscription/webhook` | payment provider success hook |
| `POST /api/subscription/demo/complete` | dev helper to complete a mock checkout |
| `GET/POST /api/entitlement/status` · `consume-premium-effect` | free-trial credit enforcement |

### Entitlement model

- Server decrements `entitlements.premium_effect_credits_remaining` on
  `consume-premium-effect` (402 once exhausted) unless the user has an active
  premium subscription.
- Offline, the desktop uses `localStorage['veyra.guest-premium-credit']` as a
  clearly-labelled fallback so the free trial works without a backend.
- UI enforcement lives in `apps/desktop/src/lib/entitlement.tsx` (`useEntitlement`).

### Pricing

Pricing is configured in `server/src/config/pricing.ts` (env-overridable) and mirrored
in `packages/shared/src/pricing.ts` for display only — the server always enforces.

## Security notes

- Renderer is sandboxed, `contextIsolation: true`, no node integration.
- Sessions are opaque tokens stored hashed; passwords bcrypt(12).
- Rate limiting on auth/API routes; Zod validation on every body.
- Open external links only for `http(s)://` via `shell.openExternal`.
