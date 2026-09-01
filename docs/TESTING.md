# Testing

## Automated

```bash
npm run typecheck     # TypeScript across all workspaces
npm run lint          # oxlint across all workspaces (0 warnings expected)
npm test              # runs every workspace test suite
npm run test:server   # server only (13 tests)
```

Server tests (`server/tests/*.test.ts`) run against an in-memory SQLite DB via
Vitest + Supertest and cover auth, entitlements, pricing, and subscriptions
(checkout → demo complete / webhook → premium).

## Manual test checklist

### Studio

1. `npm run dev:desktop`; camera LED should light; preview shows mirrored feed.
2. Camera/mic dropdowns list real devices; switching persists across restarts.
3. Resolution/FPS dropdowns change capture constraints (Studio HUD reflects it).
4. Start → preview renders; HUD shows fps, processing ms, dropped frames, GPU backend.
5. On low-fps machines, quality should auto-adapt within a few seconds.

### Effects

1. `none` and `beauty` work free; premium effects show a lock for new accounts.
2. Activating a premium effect with no backend: consumes a guest credit (offline toast).
3. With backend running: server credit decrements; second use of the same effect returns 402.
4. Shader effects (cartoon/anime/cyberpunk/glitch…) render and animate.
5. Face-anchored effects (robot, avatar, privacy blur) track head movement.
6. Face-replace: register a source photo (consent flow), then replace; verify alignment.
7. Sign out of a subscribed account → premium locks again; sign back in → unlocks.

### Backgrounds

1. Blur/remove/gradient/green work live; image and video backgrounds cover-fit.
2. Segmentation should degrade gracefully if the camera feed is dark/low-res.

### Voice effects

1. Apply a voice effect; hear the processed output on your speakers.
2. `scripts/setup-virtual-mic.sh` run; call apps see "Veyra Microphone".
3. Noise gate kills silence; pitch/robot/echo/alien are audibly distinct.

### Virtual camera (Linux, requires the v4l2loopback module loaded)

1. `sudo bash scripts/setup-virtual-camera.sh`; `/dev/video10` appears labeled "Veyra Camera".
2. Start virtual camera in Veyra; open the system camera test tool (`obs` / `ffplay /dev/video10`
   — `ffplay -f v4l2 /dev/video10`) and confirm a live processed feed.
3. Start a video call; select "Veyra Camera" as the camera and confirm the processed feed.
4. Stop the virtual camera; call apps revert to the physical camera.

### Virtual microphone (Linux)

1. `bash scripts/setup-virtual-mic.sh`; `pactl list short sources` shows `veyra_mic.monitor`.
2. Route Veyra audio to "Veyra Microphone" and select it as the mic in a call app.

### Auth & subscription

1. Sign up → account appears in `server/data/veyra.sqlite`; `/api/user/me` returns it.
2. Wrong password → 401; duplicate email → 409; weak password → 422.
3. Checkout monthly → `demo/complete` → `/api/subscription/status` shows `premium`.
4. Webhook with `event: charge.success` upgrades a yearly subscription.

### Dev tools

1. Dev Mode shows model readiness, GPU info, session/API health, live logs; export logs works.
2. Log out revokes the session server-side (restarting the app requires sign-in again).

## Known environment notes

- Virtual camera needs root only for `modprobe`; persist via
  `/etc/modules-load.d/veyra.conf` + `/etc/modprobe.d/veyra.conf` (see script header).
- Browser (non-Electron) mode returns `unavailable` for virtual camera/mic.
