import { useEffect } from 'react';
import { EFFECTS } from '@veyra/shared';
import { useStudio } from '../store/useStudio';
import { getPipeline } from '../engine/pipeline';

/**
 * Mounted once in the app shell. Watches the studio store and pushes changes
 * into the engine pipeline so settings apply regardless of the active screen.
 */
export function PipelineSync() {
  const running = useStudio((s) => s.running);
  const resolution = useStudio((s) => s.resolution);
  const fps = useStudio((s) => s.fps);
  const mirror = useStudio((s) => s.mirror);
  const effectId = useStudio((s) => s.effectId);
  const background = useStudio((s) => s.background);
  const selectedCamera = useStudio((s) => s.selectedCamera);
  const selectedMic = useStudio((s) => s.selectedMic);

  useEffect(() => {
    const p = getPipeline();
    void p;
  }, []);

  useEffect(() => {
    if (!running) return;
    const p = getPipeline();
    p.setResolution(resolution);
  }, [running, resolution]);

  useEffect(() => {
    if (!running) return;
    const p = getPipeline();
    p.setFps(fps);
  }, [running, fps]);

  useEffect(() => {
    if (!running) return;
    const p = getPipeline();
    p.setMirror(mirror);
  }, [running, mirror]);

  useEffect(() => {
    if (!running) return;
    const p = getPipeline();
    const effect = EFFECTS.find((e) => e.id === effectId) ?? null;
    p.setEffect(effect);
  }, [running, effectId]);

  useEffect(() => {
    if (!running) return;
    const p = getPipeline();
    p.setBackground(background);
  }, [running, background]);

  useEffect(() => {
    if (!running) return;
    const p = getPipeline();
    const s = useStudio.getState();
    p.applyAudio({
      effect: s.voiceEffectId,
      intensity: s.voiceIntensity,
      inputVolume: s.inputVolume,
      outputVolume: s.outputVolume,
      noiseSuppression: s.noiseSuppression,
      echoCancellation: s.echoCancellation,
      monitor: s.monitor,
    });
  }, [running]);

  // Camera / mic switching
  useEffect(() => {
    if (!running) return;
    const p = getPipeline();
    void p.cameraSource.switchVideoDevice(selectedCamera, {
      deviceId: selectedCamera,
      audioDeviceId: selectedMic,
    }).catch(() => undefined);
  }, [running, selectedCamera]);

  useEffect(() => {
    if (!running) return;
    const p = getPipeline();
    void p.cameraSource.switchAudioDevice(selectedMic, {
      deviceId: selectedCamera,
      audioDeviceId: selectedMic,
    }).catch(() => undefined);
  }, [running, selectedMic]);

  return null;
}
