# Veyra

Real-time AI video transformation with a virtual camera. Veyra turns your physical camera into an AI-powered "Veyra Camera" that any video-call app (Zoom, Meet, Discord, Teams…) can use as a webcam — with live face effects, background replacement, and voice effects.

```
 physical camera ──► Veyra engine ──► Veyra Camera (v4l2loopback) ──► your call app
       │  (WebGL2 + MediaPipe WASM)          ▲
       └──► on-screen Studio preview ────────┘
```

## Features

- **Studio**: live preview with quality stats, camera/mic switching, mirror, resolution & FPS control
- **AI effects**: 13 effects across GPU shaders (beauty, cartoon, anime, cyberpunk, glitch…) and face-anchored canvas effects (robot, avatar, privacy blur, face-replace)
- **Backgrounds**: blur, remove, gradient, image/video, green screen — MediaPipe segmentation
- **Voice effects**: pitch, robot, radio, echo, alien — Web Audio worklets + virtual microphone (PipeWire null sink)
- **Presets**: save/duplicate named scenes
- **Entitlements**: free tier includes one premium effect trial; premium via subscription
- **Privacy-first**: consent-based face registration, transparent disclosure UI

## Repository layout

```
packages/shared     shared contracts: types, effects catalog, presets, pricing, IPC
packages/engine     platform-agnostic engine: Pipeline, shaders, face tracking,
                    background compositing, canvas effects, audio DSP
apps/desktop        Electron app (React 19 + Vite + Tailwind v4) + main-process
                    virtual camera/mic adapters
server              Express API: auth, entitlements, subscriptions, pricing
scripts             model fetcher, virtual camera/mic setup, dev orchestration
```

## Prerequisites

- Node.js ≥ 20 (developed on Node 26), npm
- Linux with `v4l2loopback` (virtual camera) — see [PLATFORM.md](docs/PLATFORM.md)
- PipeWire/PulseAudio (virtual microphone)

## Getting started

```bash
npm install

# Download the MediaPipe models (~20 MB) into apps/desktop/public/models
node scripts/fetch-models.mjs

# One-time OS setup (Linux). Requires sudo for the camera module.
sudo bash scripts/setup-virtual-camera.sh   # loads v4l2loopback as /dev/video10
bash scripts/setup-virtual-mic.sh           # creates the "Veyra Microphone" sink
```

### Run everything

```bash
# Terminal 1 — backend API (auth, subscriptions) on http://localhost:8787
npm run dev:server

# Terminal 2 — desktop app (Vite + Electron, hot reload)
npm run dev:desktop
```

To work in a plain browser tab instead (no Electron, no virtual camera): `npm run dev:web`.

## Build & test

```bash
npm run build       # shared → engine → desktop → server
npm run typecheck   # all workspaces
npm run lint        # all workspaces
npm test            # server test suite (13 tests)
npm run test:server
```

## Pricing & entitlements

The server is the **single source of truth** for pricing and entitlements
(`server/src/config/pricing.ts`, overridable via env). New accounts get
`FREE_TIER.initialPremiumEffectCredits = 1` free premium effect use. Subscriptions
are monthly/yearly (₦6,000 / ₦60,000 defaults) with mock checkout in dev —
see [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the flow.

## Docs

- [Architecture](docs/ARCHITECTURE.md)
- [Testing](docs/TESTING.md)
- [Platform notes](docs/PLATFORM.md)

## Disclaimer

AI-transforming effects (face effects, face-replace, voice effects) are synthetic.
Use only media you own or have permission to use. Veyra does not support
impersonation use cases.
