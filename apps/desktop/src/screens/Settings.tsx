import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { CameraOff, LogOut, Shield, Trash2, User, Wrench } from 'lucide-react';
import { useApp } from '../store/useApp';
import { api } from '../lib/api';
import { useStudio } from '../store/useStudio';
import { Badge, Button, SectionTitle, Select, Toggle, cx } from '../components/ui';
import { useNav } from '../store/useNav';
import GlassCard from '../components/GlassCard';

export function Settings() {
  const { session, logout, qualityMode, setQualityMode, devMode, setDevMode, toast, checkBackend, backendReachable } = useApp();
  const { setScreen } = useNav();
  const { faceModelReady, segmentModelReady } = useStudio();
  const [name, setName] = useState(session?.user.name ?? '');

  useEffect(() => {
    void checkBackend();
    // refresh subscription state on mount
    if (session) void useApp.getState().refreshUser();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const saveName = async () => {
    if (!session) return;
    try {
      await api.user.updateProfile({ name: name.trim() || session.user.name });
      toast('success', 'Profile updated.');
      await useApp.getState().refreshUser();
    } catch (err) {
      toast('error', (err as Error).message);
    }
  };

  const deleteAssets = () => {
    try {
      localStorage.clear();
      toast('success', 'Local settings, presets and cached media deleted.');
    } catch {
      toast('warn', 'Could not clear local storage.');
    }
  };

  const deleteAccount = async () => {
    if (!session) return;
    if (!window.confirm('Delete your Veyra account permanently? This cannot be undone.')) return;
    try {
      await api.user.deleteAccount();
      await logout();
      toast('info', 'Account deleted.');
    } catch (err) {
      toast('error', (err as Error).message);
    }
  };

  const isPremium = session?.user.subscription.tier === 'premium';

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="mx-auto max-w-3xl h-full overflow-y-auto px-4 pt-4 pb-2"
    >
      <h1 className="mb-6 font-display text-2xl font-bold text-ink">Settings</h1>

      {/* Account */}
      <GlassCard className="mb-5 p-5">
        <SectionTitle>Account</SectionTitle>
        {session ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-[10px] uppercase tracking-wider text-ink-faint">Display name</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-xl border border-edge bg-panel2 px-3 py-2 text-sm text-ink outline-none focus:border-veyra"
                />
              </div>
              <div>
                <label className="mb-1 block text-[10px] uppercase tracking-wider text-ink-faint">Email</label>
                <input value={session.user.email} disabled className="w-full rounded-xl border border-edge bg-panel2 px-3 py-2 text-sm text-ink-dim" />
              </div>
            </div>
            <div className="flex items-center justify-between">
              <Button variant="outline" size="sm" onClick={saveName}>Save profile</Button>
              <div className="flex items-center gap-2">
                <Badge tone={isPremium ? 'purple' : 'neutral'}>{isPremium ? 'Premium' : 'Free tier'}</Badge>
                {isPremium ? (
                  <Badge tone="green">{session.user.subscription.plan} · expires {session.user.subscription.expiresAt?.slice(0, 10)}</Badge>
                ) : null}
                <Button variant="ghost" size="sm" onClick={() => void logout()}>
                  <LogOut size={13} /> Sign out
                </Button>
              </div>
            </div>
            {!isPremium ? (
              <button onClick={() => setScreen('premium')} className="text-xs text-accent hover:underline cursor-pointer">
                Upgrade to Premium →
              </button>
            ) : null}
          </div>
        ) : (
          <div className="flex flex-col items-start gap-3">
            <p className="text-sm text-ink-dim">You're using Veyra without an account.</p>
            <div className="flex items-center gap-3">
              <Badge tone={backendReachable ? 'green' : 'red'}>Backend {backendReachable ? 'connected' : 'offline'}</Badge>
              {!backendReachable ? (
                <p className="text-[11px] text-ink-faint">Start the server with <code className="text-ink">npm run dev:server</code> for accounts & subscriptions.</p>
              ) : null}
            </div>
            <Button variant="primary" size="sm" onClick={() => setScreen('studio')}>Continue as guest</Button>
          </div>
        )}
      </GlassCard>

      {/* Privacy */}
      <GlassCard className="mb-5 p-5">
        <SectionTitle hint="Veyra processes your camera and microphone locally. Raw footage is never uploaded or stored by default.">
          <span className="flex items-center gap-2"><Shield size={15} /> Privacy</span>
        </SectionTitle>
        <div className="space-y-3 text-sm text-ink-dim">
          <div className="flex items-center justify-between rounded-xl border border-edge bg-panel2/60 px-3 py-2.5">
            <span>Camera access</span>
            <Button variant="ghost" size="sm" onClick={() => void navigator.mediaDevices.getUserMedia({ video: true }).then((s) => { s.getTracks().forEach((t) => t.stop()); toast('success', 'Camera permission confirmed.'); })}>
              <CameraOff size={13} /> Verify
            </Button>
          </div>
          <div className="rounded-xl border border-edge bg-panel2/60 px-3 py-2.5">
            <span className="block font-medium text-ink">How your data is handled</span>
            <p className="mt-1 text-xs leading-relaxed">
              Face tracking and background segmentation run on-device. Uploaded backgrounds and face assets are stored only on your machine
              and are deleted when you delete local assets.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={deleteAssets}>
            <Trash2 size={13} /> Delete local assets & data
          </Button>
        </div>
      </GlassCard>

      {/* Subscription */}
      <GlassCard className="mb-5 p-5">
        <SectionTitle>Subscription</SectionTitle>
        <div className="flex items-center justify-between">
          <span className="text-sm text-ink-dim">Server-verified entitlement status:</span>
          <Badge tone={isPremium ? 'green' : 'neutral'}>{isPremium ? 'Premium active' : 'Free (1 trial premium use included)'}</Badge>
        </div>
        <button onClick={() => setScreen('premium')} className="mt-3 text-xs text-accent hover:underline cursor-pointer">
          Manage plan →
        </button>
      </GlassCard>

      {/* Advanced */}
      <GlassCard className="mb-5 p-5">
        <SectionTitle><span className="flex items-center gap-2"><Wrench size={15} /> Advanced</span></SectionTitle>
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-[10px] uppercase tracking-wider text-ink-faint">Processing quality</label>
            <Select className="w-full sm:w-56" value={qualityMode} onChange={(e) => setQualityMode(e.target.value as typeof qualityMode)}>
              <option value="auto">Auto (adaptive)</option>
              <option value="high">High</option>
              <option value="balanced">Balanced</option>
              <option value="performance">Performance</option>
            </Select>
            <p className="mt-1 text-[11px] text-ink-faint">Auto degrades resolution to protect frame rate on weak hardware.</p>
          </div>
          <Toggle checked={devMode} onChange={setDevMode} label="Developer mode (diagnostics screen)" />
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-edge bg-panel2/60 p-3 text-xs">
              <div className="text-ink-faint">Face model</div>
              <div className={cx('font-medium', faceModelReady ? 'text-veyra' : 'text-ink-dim')}>{faceModelReady ? 'Loaded' : 'Loading…'}</div>
            </div>
            <div className="rounded-xl border border-edge bg-panel2/60 p-3 text-xs">
              <div className="text-ink-faint">Segment model</div>
              <div className={cx('font-medium', segmentModelReady ? 'text-veyra' : 'text-ink-dim')}>{segmentModelReady ? 'Loaded' : 'Loading…'}</div>
            </div>
          </div>
        </div>
      </GlassCard>

      {/* Danger zone */}
      <GlassCard className="border-danger/30 p-5">
        <SectionTitle><span className="flex items-center gap-2"><User size={15} /> Danger zone</span></SectionTitle>
        <div className="flex items-center justify-between">
          <span className="text-sm text-ink-dim">Permanently delete your account and all server-side data.</span>
          <Button variant="danger" size="sm" onClick={deleteAccount} disabled={!session}>Delete account</Button>
        </div>
      </GlassCard>
    </motion.div>
  );
}
