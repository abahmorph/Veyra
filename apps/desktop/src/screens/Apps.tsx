import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { AppWindow, Check, CircleHelp, RefreshCcw, X } from 'lucide-react';
import { ipc } from '../lib/bridge';
import { useStudio } from '../store/useStudio';
import { appStatus } from '../lib/apps';
import { Badge, Button, Card, SectionTitle, cx } from '../components/ui';
import GlassCard from '../components/GlassCard';

export function Apps() {
  const { apps, setApps, vcam, vmic, selectedApp, setSelectedApp } = useStudio();

  useEffect(() => {
    void ipc.apps.detect().then(setApps);
  }, [setApps]);

  const refresh = () => {
    void ipc.apps.detect().then(setApps);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="h-full overflow-y-auto"
    >
      <div className="mb-5 flex items-end justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink">Applications</h1>
          <p className="mt-1 text-sm text-ink-dim">
            Veyra exposes standard <code className="text-ink">Veyra Camera</code> and{' '}
            <code className="text-ink">Veyra Microphone</code> devices. Any app that supports camera devices can use them — no injection or hacks.
          </p>
        </div>
        <Button variant="outline" onClick={refresh}>
          <RefreshCcw size={14} /> Refresh
        </Button>
      </div>

      {/* Device availability */}
      <div className="mb-6 grid grid-cols-2 gap-3">
        <Card>
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-ink">Veyra Camera</span>
            <Badge tone={vcam?.status === 'available' ? 'green' : 'amber'}>
              {vcam?.status === 'available' ? 'Available' : vcam?.status === 'module-missing' ? 'Needs setup' : 'Unavailable'}
            </Badge>
          </div>
          {vcam?.status === 'module-missing' ? (
            <p className="mt-2 text-[11px] text-ink-dim">Run <code className="text-veyra">npm run setup:virtual-camera</code> to load the Linux virtual camera module.</p>
          ) : null}
        </Card>
        <Card>
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-ink">Veyra Microphone</span>
            <Badge tone={vmic?.status === 'available' ? 'green' : 'amber'}>{vmic?.status === 'available' ? 'Available' : 'Not created'}</Badge>
          </div>
          {vmic?.status !== 'available' ? (
            <p className="mt-2 text-[11px] text-ink-dim">Create it in the Voice studio.</p>
          ) : null}
        </Card>
      </div>

      <SectionTitle hint="Detection is best-effort and reads only running process names — Veyra never interacts with other applications.">
        Compatible apps
      </SectionTitle>
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {apps.length === 0 ? (
          <Card>
            <div className="flex items-center gap-2 text-sm text-ink-dim">
              <CircleHelp size={16} /> Running in a browser or detection unavailable. Install the Veyra desktop app for app detection.
            </div>
          </Card>
        ) : null}
        {apps.map((app, index) => {
          const active = selectedApp === app.name;
          const status = appStatus(app.running, vcam?.status);
          return (
            <motion.div
              key={app.name}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.08 }}
            >
              <GlassCard className={cx('p-4 transition-all', active && 'border-veyra/50')}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-panel2 to-[#1a1a2e] border border-edge">
                      <AppWindow size={18} className="text-ink-dim" />
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-ink">{app.name}</span>
                        <Badge tone={status.tone}>{status.label}</Badge>
                        {active ? <Check size={14} className="text-veyra" /> : null}
                      </div>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        <CompatTag ok={app.cameraCompatible} label="Camera" />
                        <CompatTag ok={app.micCompatible} label="Mic" />
                      </div>
                      <p className="mt-2 text-[11px] leading-relaxed text-ink-dim">{app.notes}</p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant={active ? 'primary' : 'outline'}
                    onClick={() => setSelectedApp(active ? null : app.name)}
                  >
                    {active ? 'Selected' : 'Use this app'}
                  </Button>
                </div>
                {active ? (
                  <div className="mt-3 rounded-xl border border-edge bg-panel2/50 p-3 text-xs leading-relaxed text-ink-dim">
                    <div className="mb-1 font-semibold text-ink">Connect {app.name}</div>
                    <ol className="list-inside list-decimal space-y-1">
                      <li>Open {app.name}.</li>
                      <li>Open its video settings.</li>
                      <li>Select <code className="text-veyra">Veyra Camera</code> as your camera.</li>
                      <li>Optionally select <code className="text-veyra">Veyra Microphone</code> for your processed voice.</li>
                    </ol>
                  </div>
                ) : null}
              </GlassCard>
            </motion.div>
          );
        })}
      </div>

      <div className="mt-6 rounded-2xl border border-edge bg-panel/60 p-4 text-xs leading-relaxed text-ink-dim">
        <p className="font-semibold text-ink">How it works</p>
        <p className="mt-1">
          Camera → Veyra AI processing → <code className="text-veyra">Veyra Camera</code> virtual device → your call app.
          Your app simply picks the virtual device from its settings. Nothing is injected, patched or faked.
        </p>
      </div>
    </motion.div>
  );
}

function CompatTag({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px]',
        ok ? 'border-veyra/30 bg-veyra/10 text-veyra' : 'border-edge2 bg-panel2 text-ink-faint',
      )}
    >
      {ok ? <Check size={10} /> : <X size={10} />} {label} compatible
    </span>
  );
}
