# Platform notes

Veyra is built and tested on **Linux (CachyOS / Arch)** with an Intel HD 520 iGPU.
This document covers the platform-specific pieces.

## Virtual camera — Linux

Veyra uses `v4l2loopback` + `ffmpeg`.

```bash
sudo bash scripts/setup-virtual-camera.sh
```

This loads the module with:

- `video_nr=10` → device appears at `/dev/video10`
- `card_label="Veyra Camera"` → recognizable name in apps
- `exclusive_caps=1` → only the writer can open it (like a real camera)

The app spawns `ffmpeg` and streams processed frames as MJPEG over stdin:

```
ffmpeg -f mjpeg -i pipe:0 -f v4l2 -pix_fmt yuyv422 /dev/video10
```

If the device refuses `yuyv422` it retries with MJPEG passthrough. The Electron main
process owns the ffmpeg child and surfaces real error messages to the UI
(`vcam:getStatus` → `module-missing` / `error` / `running`).

To persist across reboots:

```conf
# /etc/modules-load.d/veyra.conf
v4l2loopback
# /etc/modprobe.d/veyra.conf
options v4l2loopback video_nr=10 card_label="Veyra Camera" exclusive_caps=1
```

Troubleshooting:

- `ffmpeg not found` → install with `sudo pacman -S ffmpeg`.
- Module not loading → install `v4l2loopback-dkms` and check kernel headers.
- Camera appears but apps can't open it → some apps need `exclusive_caps=0`.

## Virtual microphone — Linux

`scripts/setup-virtual-mic.sh` creates a PipeWire/PulseAudio null sink:

```
pactl load-module module-null-sink \
  sink_name=veyra_mic \
  sink_properties=device.description=Veyra Microphone
```

- Source to select in call apps: **Veyra Microphone** (`veyra_mic.monitor`).
- Set the Veyra app's audio output to **Veyra Microphone** to route processed voice.

## Performance (weak GPUs)

Target machines may only have Intel HD Graphics 520 (Skylake). Design decisions:

- **WebGL2** shaders instead of WebGPU (works on the iGPU; WebGPU is experimental there).
- MediaPipe **WASM + GPU delegate** for face/segmentation, with CPU fallback.
- Throttled detection/segmentation and a 192×192 segmentation mask.
- Auto quality adaptation every 2.5 s based on measured processing time.

If a feature is janky, prefer 1280×720 @ 30 fps and balanced quality, and disable
virtual camera encoding when not needed.

## Windows / macOS (future)

`electron/virtualCamera/platform.ts` ships stub adapters that return
`status: 'unavailable'` with a message pointing users at supported platforms.

- **Windows**: use a DirectShow virtual device. The v4l2loopback approach doesn't apply;
  the ffmpeg process would write to a `dshow`/`directshow` sink.
- **macOS**: requires a CoreMediaIO virtual camera plugin (historically used by OBS
  virtual camera / Camo), or a companion loopback driver.

The IPC contract (`VeyraIpc`) and the engine are platform-agnostic, so wiring a new
adapter only changes the main process, not the UI or engine.

## Browser (no Electron)

Running `npm run dev:web` in a plain tab works for effects/audio with your local
camera, but the virtual camera and virtual mic report `unavailable`.
