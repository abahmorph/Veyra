import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import {
  Camera as CameraIcon,
  CircleStop,
  Fullscreen,
  Play,
  RefreshCcw,
  Video,
  ArrowRight,
} from 'lucide-react';
import { FPS_OPTIONS, RESOLUTIONS, getEffect, getVoiceEffect } from '@veyra/shared';
import { useStudio } from '../store/useStudio';
import { useApp } from '../store/useApp';
import { getPipeline, bindDisplayCanvas } from '../engine/pipeline';
import { CameraSource } from '@veyra/engine';
import { ipc } from '../lib/bridge';
import { useEntitlement } from '../lib/entitlement';
import { Button, Badge, Select, Stat, Toggle, cx } from '../components/ui';
import { StudioControlBar, StudioPanel, type StudioPanelId } from '../components/StudioPanels';

export function Studio() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rawVideoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { toast } = useApp();
  const { activate } = useEntitlement();
  const [panel, setPanel] = useState<StudioPanelId | null>(null);

  const {
    videoDevices,
    audioDevices,
    selectedCamera,
    selectedMic,
    resolution,
    fps,
    mirror,
    effectId,
    person,
    background,
    voiceEffectId,
    selectedApp,
    running,
    stats,
    vcam,
    compareRaw,
    setDevices,
    setCamera,
    setMic,
    setResolution,
    setFps,
    setMirror,
    setCompareRaw,
    setVcam,
    errorMessage,
    setErrorMessage,
  } = useStudio();

  useEffect(() => {
    if (canvasRef.current) bindDisplayCanvas(canvasRef.current);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const devices = await CameraSource.enumerate(true);
      if (!cancelled) setDevices(devices);
    };
    void load();
    const onDeviceChange = () => void load();
    navigator.mediaDevices?.addEventListener('devicechange', onDeviceChange);
    void ipc.virtualCamera.getStatus().then(setVcam);
    const unsub = ipc.virtualCamera.onStatus(setVcam);
    return () => {
      cancelled = true;
      navigator.mediaDevices?.removeEventListener('devicechange', onDeviceChange);
      unsub();
    };
  }, [setDevices, setVcam]);

  useEffect(() => {
    if (!rawVideoRef.current) return;
    const iv = setInterval(() => {
      const v = getPipeline().cameraSource.videoElement;
      if (v && rawVideoRef.current && rawVideoRef.current.srcObject !== v.srcObject) {
        rawVideoRef.current.srcObject = v.srcObject;
        rawVideoRef.current.muted = true;
        rawVideoRef.current.setAttribute('playsinline', 'true');
        void rawVideoRef.current.play().catch(() => undefined);
        clearInterval(iv);
      }
    }, 500);
    return () => clearInterval(iv);
  }, []);

  const start = useCallback(async () => {
    try {
      setErrorMessage(null);
      await getPipeline().start(selectedCamera || undefined, selectedMic || undefined);
    } catch {
      /* pipeline reports friendly errors via onError */
    }
  }, [selectedCamera, selectedMic, setErrorMessage]);

  const stop = useCallback(async () => {
    try {
      await getPipeline().stop();
    } catch {
      /* ignore */
    }
  }, []);

  const toggleVcam = async () => {
    const isActive = vcam?.status === 'available' || vcam?.status === 'starting';
    if (isActive) {
      await ipc.virtualCamera.stop();
      toast('info', 'Veyra Camera stopped.');
    } else {
      const res = await ipc.virtualCamera.start({ width: resolution.width, height: resolution.height, fps: 30 });
      if (res.status === 'module-missing' || res.status === 'error' || res.status === 'unavailable') {
        toast('warn', res.message ?? 'Virtual camera could not start.');
      } else {
        toast('success', 'Veyra Camera is live. Select it in your video call app.');
      }
    }
  };

  const toggleFullscreen = () => {
    const el = containerRef.current;
    if (!el) return;
    if (document.fullscreenElement) {
      void document.exitFullscreen();
    } else {
      void el.requestFullscreen();
    }
  };

  const handleSelectEffect = async (id: string) => {
    await activate(id);
  };

  const { isLocked } = useEntitlement();

  const camLabel = videoDevices.find((d) => d.deviceId === selectedCamera)?.label ?? 'No camera';
  const vcamStatus = vcam?.status ?? 'checking';
  const vcamReady = vcamStatus === 'available';
  const vcamActive = vcamReady && running;

  return (
    <div className="flex h-full gap-5">
      {/* Preview */}
      <div ref={containerRef} className="relative min-w-0 flex-1 overflow-hidden rounded-2xl border border-edge bg-black glass-panel">
        <canvas ref={canvasRef} className={cx('h-full w-full object-contain', compareRaw && 'opacity-0')} />
        <video
          ref={rawVideoRef}
          className={cx('absolute inset-0 h-full w-full object-contain', !compareRaw && 'pointer-events-none opacity-0')}
        />
        {!running && !compareRaw ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[radial-gradient(ellipse_at_center,rgba(20,241,149,0.08),transparent_60%)]">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-edge2 bg-panel2/70 glass-panel-sm">
              <CameraIcon size={26} className="text-ink-faint" />
            </div>
            <p className="text-sm text-ink-dim">Your camera preview will appear here</p>
            <Button onClick={start} size="lg">
              <Play size={16} /> Start Camera
            </Button>
          </div>
        ) : null}

        {errorMessage ? (
          <div className="absolute inset-x-3 top-3 z-20 rounded-xl border border-danger/40 bg-[#1a0a10]/90 px-4 py-3 text-xs text-[#ffc2cc] glass-panel-sm">
            {errorMessage}
            <button onClick={() => setErrorMessage(null)} className="ml-3 text-danger hover:underline cursor-pointer">Dismiss</button>
          </div>
        ) : null}

        {/* Workflow strip (#1) */}
        <div className="absolute inset-x-3 top-3 z-10">
          <div className="mx-auto flex w-fit max-w-full flex-wrap items-center justify-center gap-1 rounded-full bg-black/50 px-3 py-1.5 backdrop-blur-md border border-white/10">
            {steps.map((s, i) => {
              const label = stepLabel(s, { camLabel, person, effectId, background, voiceEffectId, selectedApp });
              return (
                <span key={s.id} className="flex items-center gap-1">
                  {i > 0 ? <ArrowRight size={11} className="text-ink-faint" /> : null}
                  {s.id === 'camera' ? (
                    <span className="rounded-full px-2 py-0.5 text-[10px]">
                      <span className="text-ink-faint">{s.label}:</span>{' '}
                      <span className={cx('font-medium', s.active(label) ? 'text-veyra' : 'text-ink-dim')}>{label}</span>
                    </span>
                  ) : (
                    <button
                      onClick={() => setPanel(s.panelId)}
                      className="rounded-full px-2 py-0.5 text-[10px] transition-colors hover:bg-white/10 cursor-pointer"
                    >
                      <span className="text-ink-faint">{s.label}:</span>{' '}
                      <span className={cx('font-medium', s.active(label) ? 'text-veyra' : 'text-ink-dim')}>{label}</span>
                    </button>
                  )}
                </span>
              );
            })}
            <span className="flex items-center gap-1">
              <ArrowRight size={11} className="text-ink-faint" />
              <span className="rounded-full bg-veyra/15 px-2 py-0.5 text-[10px] font-medium text-veyra">
                {running ? 'Preview' : 'Start'}
              </span>
            </span>
          </div>
        </div>

        {/* HUD overlays */}
        {running ? (
          <>
            <div className="absolute left-3 bottom-20 z-10 flex items-center gap-2">
              <Badge tone="red">
                <span className="h-1.5 w-1.5 rounded-full bg-red-400 animate-pulse" /> REC
              </Badge>
              <Badge tone="neutral">{resolution.width}×{resolution.height} @ {fps}fps</Badge>
              {vcamActive ? <Badge tone="green">Veyra Camera LIVE</Badge> : null}
              {effectId && effectId !== 'none' ? <Badge tone="purple">{getEffect(effectId)?.name ?? effectId}</Badge> : null}
            </div>
            <div className="absolute right-3 top-16 z-10 flex gap-2">
              <Toggle checked={compareRaw} onChange={setCompareRaw} label="Before/After" />
            </div>
          </>
        ) : null}

        {/* Stats bar */}
        {running && stats ? (
          <div className="absolute inset-x-3 bottom-20 z-10 grid grid-cols-5 gap-2">
            <Stat label="FPS" value={stats.fps.toFixed(0)} accent />
            <Stat label="Latency" value={`${stats.pipelineMs.toFixed(1)} ms`} />
            <Stat label="Capture" value={`${stats.captureFps.toFixed(0)} fps`} />
            <Stat label="Quality" value={`${Math.round(stats.qualityScale * 100)}%`} />
            <Stat label="Dropped" value={stats.droppedFrames} />
          </div>
        ) : null}

        {/* Floating control bar (#7) */}
        <StudioControlBar active={panel} onOpen={setPanel} />
      </div>

      {/* Right controls */}
      <div className="w-80 shrink-0 space-y-4 overflow-y-auto pr-0.5">
        {/* Veyra Camera status panel (#6) */}
        <div className="rounded-2xl border border-edge bg-panel/80 p-4 glass-panel-sm">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-wider text-ink-faint">Veyra Camera</span>
            <CameraStatusBadge status={vcamStatus} running={running} />
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Button onClick={running ? stop : start} variant={running ? 'danger' : 'primary'}>
              {running ? <CircleStop size={15} /> : <Play size={15} />}
              {running ? 'Stop Camera' : 'Start Camera'}
            </Button>
            <Button onClick={toggleVcam} variant={vcamReady ? (vcamActive ? 'primary' : 'outline') : 'outline'}>
              <Video size={15} />
              {vcamActive ? 'Camera On' : vcamStatus === 'starting' ? 'Starting…' : 'Veyra Camera'}
            </Button>
          </div>
          {running && stats ? (
            <div className="mt-3 space-y-1 rounded-xl border border-edge bg-panel2/60 p-3 text-[11px]">
              <ConfigRow k="Resolution" v={`${resolution.width}×${resolution.height}`} />
              <ConfigRow k="FPS" v={`${stats.fps.toFixed(0)}`} />
              <ConfigRow k="Latency" v={`${stats.pipelineMs.toFixed(1)} ms`} />
              <ConfigRow k="Effect" v={getEffect(effectId)?.name ?? 'None'} />
              <ConfigRow k="Background" v={background?.name ?? 'Original'} />
              <ConfigRow k="Voice" v={getVoiceEffect(voiceEffectId)?.name ?? 'None'} />
            </div>
          ) : null}
          {vcamStatus === 'module-missing' ? (
            <p className="mt-2 text-[11px] leading-relaxed text-warn">
              The Linux virtual camera kernel module is not loaded. Run:
              <code className="mt-1 block rounded bg-black/40 px-2 py-1 text-[10px] text-veyra">npm run setup:virtual-camera</code>
            </p>
          ) : null}
          {vcam && vcam.message && !vcamReady && vcamStatus !== 'module-missing' ? (
            <p className="mt-2 text-[11px] text-ink-dim">{vcam.message}</p>
          ) : null}
          {vcam?.status === 'available' ? (
            <p className="mt-2 text-[11px] text-ink-dim">
              Outputting to <code className="text-veyra">{vcam.devicePath}</code> — pick "Veyra Camera" in your call app.
            </p>
          ) : null}
        </div>

        {/* Current Setup quick actions (#8) */}
        <div className="rounded-2xl border border-edge bg-panel/80 p-4 glass-panel-sm">
          <span className="text-[10px] uppercase tracking-wider text-ink-faint">Current setup</span>
          <div className="mt-2 space-y-1">
            <SetupRow label="Person" value={person?.name ?? 'Default Camera'} onClick={() => setPanel('person')} />
            <SetupRow label="Effect" value={getEffect(effectId)?.name ?? 'None'} onClick={() => setPanel('effect')} />
            <SetupRow label="Background" value={background?.name ?? 'Original'} onClick={() => setPanel('background')} />
            <SetupRow label="Voice" value={getVoiceEffect(voiceEffectId)?.name ?? 'Original'} onClick={() => setPanel('voice')} />
            <SetupRow label="Call App" value={selectedApp ?? 'None'} onClick={() => setPanel('app')} />
          </div>
        </div>

        {/* Camera & audio inputs */}
        <div className="space-y-3 rounded-2xl border border-edge bg-panel/80 p-4 glass-panel-sm">
          <div>
            <label className="mb-1 block text-[10px] uppercase tracking-wider text-ink-faint">Camera</label>
            <Select className="w-full" value={selectedCamera} onChange={(e) => setCamera(e.target.value)}>
              {videoDevices.length === 0 ? <option value="">No cameras found</option> : null}
              {videoDevices.map((d) => (
                <option key={d.deviceId} value={d.deviceId}>{d.label}</option>
              ))}
            </Select>
          </div>
          <div>
            <label className="mb-1 block text-[10px] uppercase tracking-wider text-ink-faint">Microphone</label>
            <Select className="w-full" value={selectedMic} onChange={(e) => setMic(e.target.value)}>
              {audioDevices.length === 0 ? <option value="">No microphones found</option> : null}
              {audioDevices.map((d) => (
                <option key={d.deviceId} value={d.deviceId}>{d.label}</option>
              ))}
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="mb-1 block text-[10px] uppercase tracking-wider text-ink-faint">Resolution</label>
              <Select className="w-full" value={`${resolution.width}x${resolution.height}`} onChange={(e) => {
                const r = RESOLUTIONS.find((x) => `${x.width}x${x.height}` === e.target.value);
                if (r) setResolution({ label: r.label, width: r.width, height: r.height });
              }}>
                {RESOLUTIONS.map((r) => (
                  <option key={r.label} value={`${r.width}x${r.height}`}>{r.label}</option>
                ))}
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-[10px] uppercase tracking-wider text-ink-faint">FPS</label>
              <Select className="w-full" value={fps} onChange={(e) => setFps(Number(e.target.value))}>
                {FPS_OPTIONS.map((f) => (
                  <option key={f} value={f}>{f} fps</option>
                ))}
              </Select>
            </div>
          </div>
          <div className="flex items-center justify-between pt-1">
            <Toggle checked={mirror} onChange={setMirror} label="Mirror preview" />
            <button
              onClick={toggleFullscreen}
              className="flex items-center gap-1.5 rounded-lg border border-edge px-2.5 py-1.5 text-xs text-ink-dim hover:text-ink cursor-pointer"
            >
              <Fullscreen size={13} /> Fullscreen
            </button>
          </div>
        </div>

        {/* Quick effect */}
        <div className="space-y-2 rounded-2xl border border-edge bg-panel/80 p-4 glass-panel-sm">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-wider text-ink-faint">Active effect</span>
            {effectId !== 'none' ? (
              <button onClick={() => void activate('none')} className="text-[11px] text-ink-dim hover:text-ink cursor-pointer">
                Clear
              </button>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {['beauty', 'cyberpunk', 'avatar', 'privacy-blur'].map((id) => {
              const active = effectId === id;
              const locked = isLocked(id);
              return (
                <button
                  key={id}
                  onClick={() => void handleSelectEffect(id)}
                  className={cx(
                    'rounded-full border px-3 py-1.5 text-xs capitalize transition-colors cursor-pointer',
                    active ? 'border-veyra bg-veyra/15 text-veyra' : 'border-edge2 text-ink-dim hover:text-ink',
                    locked && 'opacity-60',
                  )}
                >
                  {getEffect(id)?.name ?? id.replace('-', ' ')}
                  {locked ? ' 🔒' : ''}
                </button>
              );
            })}
          </div>
        </div>

        <div className="rounded-2xl border border-edge bg-panel/80 p-4 glass-panel-sm">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-wider text-ink-faint">Devices ({videoDevices.length})</span>
            <button onClick={() => void CameraSource.enumerate(true).then(setDevices)} className="text-ink-faint hover:text-ink cursor-pointer">
              <RefreshCcw size={13} />
            </button>
          </div>
          <p className="mt-2 text-[11px] leading-relaxed text-ink-faint">
            All processing happens locally on this device. Raw footage is never uploaded or stored.
          </p>
        </div>
      </div>

      {/* Slide-in control panel (#14) */}
      <AnimatePresence>
        {panel ? <StudioPanel key={panel} id={panel} onClose={() => setPanel(null)} /> : null}
      </AnimatePresence>
    </div>
  );
}

const steps: { id: string; label: string; panelId: StudioPanelId; active: (v: string) => boolean }[] = [
  { id: 'camera', label: 'Camera', panelId: 'app', active: (v) => v !== 'No camera' },
  { id: 'person', label: 'Person', panelId: 'person', active: (v) => v !== 'Default Camera' },
  { id: 'effect', label: 'Effect', panelId: 'effect', active: (v) => v !== 'None' },
  { id: 'background', label: 'Background', panelId: 'background', active: (v) => v !== 'Original' },
  { id: 'voice', label: 'Voice', panelId: 'voice', active: (v) => v !== 'None' && v !== 'Original' },
  { id: 'app', label: 'App', panelId: 'app', active: (v) => v !== 'None' },
];

function stepLabel(
  s: (typeof steps)[number],
  ctx: { camLabel: string; person: { name?: string } | null; effectId: string; background: { name?: string } | null; voiceEffectId: string; selectedApp: string | null },
): string {
  switch (s.id) {
    case 'camera': return ctx.camLabel;
    case 'person': return ctx.person?.name ?? 'Default Camera';
    case 'effect': return getEffect(ctx.effectId)?.name ?? 'None';
    case 'background': return ctx.background?.name ?? 'Original';
    case 'voice': return getVoiceEffect(ctx.voiceEffectId)?.name ?? 'Original';
    case 'app': return ctx.selectedApp ?? 'None';
    default: return '—';
  }
}

function ConfigRow({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-ink-faint">{k}</span>
      <span className="font-medium text-ink">{v}</span>
    </div>
  );
}

function SetupRow({ label, value, onClick }: { label: string; value: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-xs transition-colors hover:bg-white/5 cursor-pointer"
    >
      <span className="text-ink-dim">{label}</span>
      <span className="font-medium text-ink">{value}</span>
    </button>
  );
}

function CameraStatusBadge({ status, running }: { status: string; running: boolean }) {
  if (status === 'available') {
    return <Badge tone={running ? 'green' : 'neutral'}>{running ? '● Active' : '● Ready'}</Badge>;
  }
  if (status === 'starting') return <Badge tone="amber">Starting…</Badge>;
  if (status === 'module-missing' || status === 'unavailable') return <Badge tone="amber">⚠ Setup Required</Badge>;
  if (status === 'error') return <Badge tone="red">Error</Badge>;
  return <Badge tone="neutral">Checking…</Badge>;
}
