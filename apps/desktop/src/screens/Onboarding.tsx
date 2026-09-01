import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AudioLines,
  Camera,
  Check,
  Eye,
  Image as ImageIcon,
  Lock,
  MonitorUp,
  Sparkles,
  Video,
  Wand2,
} from 'lucide-react';
import { useApp } from '../store/useApp';
import { useStudio } from '../store/useStudio';
import { bindDisplayCanvas } from '../engine/pipeline';
import { EFFECTS, VOICE_EFFECTS } from '@veyra/shared';
import { Button, Toggle, cx } from '../components/ui';

const STEPS = [
  { id: 'welcome', label: 'Welcome', icon: <Sparkles size={16} /> },
  { id: 'permissions', label: 'Permissions', icon: <Camera size={16} /> },
  { id: 'preview', label: 'Preview', icon: <Video size={16} /> },
  { id: 'effect', label: 'Effect', icon: <Wand2 size={16} /> },
  { id: 'background', label: 'Background', icon: <ImageIcon size={16} /> },
  { id: 'voice', label: 'Voice', icon: <AudioLines size={16} /> },
  { id: 'vcam', label: 'Camera', icon: <MonitorUp size={16} /> },
  { id: 'entitlement', label: 'Free trial', icon: <Lock size={16} /> },
  { id: 'account', label: 'Account', icon: <Eye size={16} /> },
];

export function Onboarding() {
  const { setOnboarded, toast } = useApp();
  const [step, setStep] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [permissions, setPermissions] = useState<{ video: boolean; audio: boolean }>({ video: false, audio: false });
  const [started, setStarted] = useState(false);

  const { running, setEffect, setBackground, setVoiceEffect } = useStudio();

  useEffect(() => {
    if (canvasRef.current) bindDisplayCanvas(canvasRef.current);
  }, []);

  const grantPermissions = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      stream.getTracks().forEach((t) => t.stop());
      setPermissions({ video: true, audio: true });
    } catch {
      setPermissions({ video: true, audio: false });
      toast('warn', 'Microphone permission was declined. You can enable it later in Settings.');
    }
  };

  const startPreview = useCallback(async () => {
    if (started) return;
    setStarted(true);
    try {
      const { getPipeline } = await import('../engine/pipeline');
      await getPipeline().start();
    } catch {
      /* handled by pipeline errors */
    }
  }, [started]);

  const finish = () => setOnboarded(true);

  const goNext = () => {
    if (step === STEPS.length - 1) {
      finish();
      return;
    }
    setStep((s) => s + 1);
  };

  const effectPicks = EFFECTS.filter((e) => ['beauty', 'cyberpunk', 'avatar', 'privacy-blur'].includes(e.id));
  const bgPicks = ['Clean Blur', 'Neon Gradient', 'Green Screen'];
  const voicePicks = VOICE_EFFECTS.filter((v) => ['deep', 'echo', 'robot'].includes(v.id));

  return (
    <div className="flex h-full items-center justify-center bg-void">
      <div className="w-full max-w-2xl">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-veyra to-cyan font-display text-sm font-bold text-[#05241a]">V</div>
            <span className="font-display text-sm font-semibold text-ink">Veyra — quick setup</span>
          </div>
          <button onClick={finish} className="text-xs text-ink-faint hover:text-ink cursor-pointer">Skip for now</button>
        </div>

        <div className="mb-6 flex gap-1.5">
          {STEPS.map((s, i) => (
            <button
              key={s.id}
              onClick={() => i < step && setStep(i)}
              title={s.label}
              className={cx(
                'h-1.5 flex-1 rounded-full transition-all',
                i <= step ? 'bg-veyra' : 'bg-edge2',
              )}
            />
          ))}
        </div>

        <div className="glass-strong rounded-3xl p-8 animate-rise">
          {step === 0 ? (
            <Centered
              icon={<Sparkles size={30} className="text-veyra" />}
              title="Welcome to Veyra"
              desc="A real-time AI video studio that transforms your webcam before it reaches your video calls. Everything runs locally — your footage never leaves your device."
            />
          ) : step === 1 ? (
            <Centered
              icon={<Camera size={30} className="text-veyra" />}
              title="Camera & microphone access"
              desc="Veyra needs access to your camera and microphone. You can change or revoke this anytime."
              action={
                <Button onClick={grantPermissions} size="lg">
                  {permissions.video && permissions.audio ? <Check size={16} /> : null}
                  {permissions.video && permissions.audio ? 'Granted' : 'Grant access'}
                </Button>
              }
              meta={
                <div className="mt-2 flex justify-center gap-2 text-xs">
                  <Pill ok={permissions.video} label="Camera" />
                  <Pill ok={permissions.audio} label="Microphone" />
                </div>
              }
            />
          ) : step === 2 ? (
            <>
              <div className="mb-4 text-center">
                <div className="text-2xl font-bold text-ink">Preview</div>
                <p className="mt-1 text-sm text-ink-dim">Here's your camera feed.</p>
              </div>
              <div className="relative mb-4 aspect-video overflow-hidden rounded-2xl border border-edge bg-black">
                <canvas ref={canvasRef} className="h-full w-full object-contain" />
                {!running && !started ? (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Button onClick={startPreview} size="lg"><Video size={16} /> Start preview</Button>
                  </div>
                ) : null}
              </div>
              <div className="flex items-center justify-center gap-2 text-xs text-ink-dim">
                <Toggle checked={true} onChange={() => undefined} label="Mirror" />
                <span>· processing: <span className="text-veyra">on-device</span></span>
              </div>
            </>
          ) : step === 3 ? (
            <Centered
              icon={<Wand2 size={30} className="text-veyra" />}
              title="Pick your first effect"
              desc="Tap one to try it live. Premium effects unlock below."
              action={
                <div className="flex flex-wrap justify-center gap-2">
                  {effectPicks.map((e) => (
                    <button
                      key={e.id}
                      onClick={() => {
                        setEffect(e.id);
                        void startPreview();
                      }}
                      className={cx(
                        'rounded-full border px-4 py-2 text-sm cursor-pointer transition-colors',
                        e.premium ? 'border-accent/40 bg-accent/10 text-[#b9a7ff]' : 'border-edge2 text-ink hover:border-veyra',
                      )}
                    >
                      {e.name}
                      {e.premium ? ' ✦' : ''}
                    </button>
                  ))}
                </div>
              }
            />
          ) : step === 4 ? (
            <Centered
              icon={<ImageIcon size={30} className="text-veyra" />}
              title="Test a background"
              desc="Remove, blur or replace your background in real time."
              action={
                <div className="flex flex-wrap justify-center gap-2">
                  {bgPicks.map((b) => (
                    <button
                      key={b}
                      onClick={() => {
                        const def =
                          b === 'Clean Blur'
                            ? { id: 'bg-clean', name: 'Clean Blur', mode: 'blur' as const, premium: false, kind: 'builtin' as const, blurStrength: 0.55 }
                            : b === 'Neon Gradient'
                              ? { id: 'bg-neon-gradient', name: 'Neon Gradient', mode: 'gradient' as const, premium: false, kind: 'builtin' as const, gradient: [{ offset: 0, color: '#0f0524' }, { offset: 1, color: '#0ff0c0' }] }
                              : { id: 'bg-green', name: 'Green Screen', mode: 'green' as const, premium: false, kind: 'builtin' as const };
                        setBackground(def);
                        void startPreview();
                      }}
                      className="rounded-full border border-edge2 px-4 py-2 text-sm text-ink hover:border-veyra cursor-pointer"
                    >
                      {b}
                    </button>
                  ))}
                </div>
              }
            />
          ) : step === 5 ? (
            <Centered
              icon={<AudioLines size={30} className="text-veyra" />}
              title="Try a voice effect"
              desc="Deep, echo and more — hear yourself in real time."
              action={
                <div className="flex flex-wrap justify-center gap-2">
                  {voicePicks.map((v) => (
                    <button
                      key={v.id}
                      onClick={() => setVoiceEffect(v.id)}
                      className="rounded-full border border-edge2 px-4 py-2 text-sm text-ink hover:border-veyra cursor-pointer"
                    >
                      {v.name}
                    </button>
                  ))}
                </div>
              }
            />
          ) : step === 6 ? (
            <Centered
              icon={<MonitorUp size={30} className="text-veyra" />}
              title="Meet the Veyra Camera"
              desc="Veyra exposes a standard virtual camera device. Any video-call app can select it as its webcam — no hacks, no injection. On Linux this uses the v4l2loopback kernel module."
              action={<Button onClick={() => setStep(7)}>Got it</Button>}
            />
          ) : step === 7 ? (
            <Centered
              icon={<Lock size={30} className="text-veyra" />}
              title="Your free trial"
              desc="Every new account gets 1 free premium effect experience. After that, premium effects stay visible but lock until you subscribe. Sign in on the next step to claim yours."
            />
          ) : (
            <Centered
              icon={<Eye size={30} className="text-veyra" />}
              title="Almost done"
              desc="Sign in to sync your subscription and entitlement, or continue as a guest. You can always sign in later from Settings."
              action={
                <div className="flex items-center justify-center gap-3">
                  <Button variant="outline" onClick={finish}>Continue as guest</Button>
                  <Button variant="premium" onClick={finish}>Sign in</Button>
                </div>
              }
            />
          )}

          <div className="mt-6 flex items-center justify-between">
            <Button variant="ghost" size="sm" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>
              Back
            </Button>
            {step < STEPS.length - 1 ? (
              <Button size="sm" onClick={goNext}>Next</Button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function Centered({
  icon,
  title,
  desc,
  action,
  meta,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  action?: React.ReactNode;
  meta?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center py-6 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-veyra/15 to-accent/15 border border-veyra/25">
        {icon}
      </div>
      <h2 className="text-2xl font-bold text-ink">{title}</h2>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-ink-dim">{desc}</p>
      <div className="mt-6">{action}</div>
      {meta}
    </div>
  );
}

function Pill({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className={cx('rounded-full border px-2.5 py-1', ok ? 'border-veyra/40 text-veyra' : 'border-edge2 text-ink-faint')}>
      {ok ? '✓ ' : ''}{label}
    </span>
  );
}
