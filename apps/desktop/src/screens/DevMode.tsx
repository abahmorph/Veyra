import { useEffect, useState } from 'react';
import { Download, RefreshCcw, ShieldCheck, ShieldX } from 'lucide-react';
import { useStudio } from '../store/useStudio';
import { useApp } from '../store/useApp';
import { getPipeline, describeGpuInfo } from '../engine/pipeline';
import { ipc } from '../lib/bridge';
import { api } from '../lib/api';
import { Badge, Button, Card, SectionTitle, Stat, cx } from '../components/ui';

interface LogEntry {
  t: string;
  level: string;
  msg: string;
}

const logs: LogEntry[] = [];
const MAX_LOGS = 500;

export function captureLog(level: string, args: unknown[]): void {
  logs.push({ t: new Date().toISOString(), level, msg: args.map(String).join(' ') });
  if (logs.length > MAX_LOGS) logs.splice(0, logs.length - MAX_LOGS);
}

export function DevMode() {
  const { stats, vcam, running, faceModelReady, segmentModelReady, videoDevices, audioDevices, selectedCamera } = useStudio();
  const { session, backendReachable, checkBackend } = useApp();
  const [gpu, setGpu] = useState<string>('checking…');
  const [gpuInfo, setGpuInfo] = useState(() => describeGpuInfo());
  const [audioOk, setAudioOk] = useState(false);
  const [logList, setLogList] = useState<LogEntry[]>([]);
  const [subscriptionStatus, setSubscriptionStatus] = useState<'unverified' | 'premium' | 'free'>('unverified');

  useEffect(() => {
    void checkBackend();
    if (window.veyraAPI) {
      void ipc.app.getGpu?.().then(setGpu).catch(() => setGpu('unknown'));
    }
  }, [checkBackend]);

  useEffect(() => {
    const iv = setInterval(() => {
      const p = getPipeline();
      setAudioOk(!!p.cameraSource.audioTrack);
      setLogList([...logs]);
      setGpuInfo(describeGpuInfo());
    }, 1000);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    if (!backendReachable) {
      setSubscriptionStatus('unverified');
      return;
    }
    if (session?.user.subscription.tier === 'premium') setSubscriptionStatus('premium');
    else setSubscriptionStatus('free');
  }, [backendReachable, session]);

  const verifySubscription = async () => {
    try {
      const { user } = await api.user.me();
      const s = useApp.getState().session;
      if (s) useApp.setState({ session: { ...s, user } });
      setSubscriptionStatus(user.subscription.tier === 'premium' ? 'premium' : 'free');
    } catch {
      setSubscriptionStatus('unverified');
    }
  };

  const exportLogs = () => {
    const text = logs.map((l) => `[${l.t}] ${l.level}: ${l.msg}`).join('\n');
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `veyra-diagnostics-${Date.now()}.log`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="mx-auto max-w-4xl animate-fade-in">
      <div className="mb-5 flex items-end justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink">Developer Diagnostics</h1>
          <p className="mt-1 text-sm text-ink-dim">Internal status for debugging. Export logs for support.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={exportLogs}><Download size={13} /> Export logs</Button>
          <Button variant="ghost" size="sm" onClick={() => setLogList([...logs])}><RefreshCcw size={13} /> Refresh</Button>
        </div>
      </div>

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Pipeline" value={running ? 'Running' : 'Stopped'} accent={running} />
        <Stat label="FPS" value={stats ? stats.fps.toFixed(1) : '—'} accent />
        <Stat label="Latency" value={stats ? `${stats.pipelineMs.toFixed(1)} ms` : '—'} />
        <Stat label="Quality scale" value={stats ? `${Math.round(stats.qualityScale * 100)}%` : '—'} />
      </div>

      <div className="mb-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <SectionTitle>Camera stream</SectionTitle>
          <div className="space-y-1.5 text-xs">
            <Row label="Selected camera" value={videoDevices.find((d) => d.deviceId === selectedCamera)?.label ?? 'none'} />
            <Row label="Video devices" value={String(videoDevices.length)} />
            <Row label="Audio devices" value={String(audioDevices.length)} />
            <Row label="Audio track" value={audioOk ? 'present' : 'absent'} />
            <Row label="Virtual camera" value={vcam?.status ?? 'unknown'} tone={vcam?.status === 'available' ? 'ok' : 'bad'} />
          </div>
        </Card>

        <Card>
          <SectionTitle>GPU</SectionTitle>
          <div className="space-y-1.5 text-xs">
            <Row label="Backend" value={gpuInfo.backend} />
            <Row label="Renderer" value={gpuInfo.renderer} />
            <Row label="Vendor" value={gpuInfo.vendor} />
            <Row label="lspci" value={gpu} />
            <Row label="WebGL2" value={gpuInfo.backend === 'webgl2' ? 'available' : 'fallback'} tone={gpuInfo.backend === 'webgl2' ? 'ok' : 'warn'} />
          </div>
        </Card>

        <Card>
          <SectionTitle>AI models</SectionTitle>
          <div className="space-y-1.5 text-xs">
            <Row label="Face landmarker" value={faceModelReady ? 'ready' : 'loading/error'} tone={faceModelReady ? 'ok' : 'warn'} />
            <Row label="Segmenter" value={segmentModelReady ? 'ready' : 'loading/error'} tone={segmentModelReady ? 'ok' : 'warn'} />
            <Row label="Audio engine" value={running ? 'running' : 'idle'} />
          </div>
        </Card>

        <Card>
          <SectionTitle>Backend & entitlements</SectionTitle>
          <div className="space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-ink-dim">Connection</span>
              <Badge tone={backendReachable ? 'green' : 'red'}>{backendReachable ? 'connected' : 'offline'}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-ink-dim">Subscription</span>
              <div className="flex items-center gap-2">
                <Badge tone={subscriptionStatus === 'premium' ? 'purple' : 'neutral'}>{subscriptionStatus}</Badge>
                <button onClick={verifySubscription} className="text-[10px] text-cyan hover:underline cursor-pointer">verify</button>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-ink-dim">Session</span>
              {session ? (
                <Badge tone="green">signed in</Badge>
              ) : (
                <Badge tone="neutral"><span className="flex items-center gap-1"><ShieldX size={11} /> guest</span></Badge>
              )}
            </div>
            {backendReachable ? <Row label="Auth mode" value="server-verified" tone="ok" /> : <Row label="Auth mode" value="offline fallback" tone="warn" />}
          </div>
        </Card>
      </div>

      <Card>
        <SectionTitle><span className="flex items-center gap-2"><ShieldCheck size={14} /> Live log</span></SectionTitle>
        <pre className="max-h-64 overflow-auto rounded-xl bg-black/40 p-3 text-[10px] leading-relaxed text-ink-dim">
          {logList.length === 0
            ? 'No captured events yet.'
            : logList.slice(-80).map((l, i) => (
                <div key={i} className={cx(l.level === 'error' ? 'text-danger' : '')}>
                  [{l.t}] {l.level}: {l.msg}
                </div>
              ))}
        </pre>
      </Card>
    </div>
  );
}

function Row({ label, value, tone }: { label: string; value: string; tone?: 'ok' | 'warn' | 'bad' }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-edge/50 pb-1.5">
      <span className="text-ink-faint">{label}</span>
      <span className={cx('truncate', tone === 'ok' ? 'text-veyra' : tone === 'bad' ? 'text-danger' : tone === 'warn' ? 'text-warn' : 'text-ink')}>
        {value}
      </span>
    </div>
  );
}
