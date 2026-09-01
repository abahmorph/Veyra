import { WORKLETS } from './worklets.js';

export interface AudioEngineState {
  effect: string;
  intensity: number;
  inputVolume: number;
  outputVolume: number;
  noiseSuppression: boolean;
  echoCancellation: boolean;
  monitor: boolean;
}

export const DEFAULT_AUDIO_STATE: AudioEngineState = {
  effect: 'none',
  intensity: 0.5,
  inputVolume: 1,
  outputVolume: 1,
  noiseSuppression: true,
  echoCancellation: false,
  monitor: true,
};

export type AudioEngineStatus = 'idle' | 'running' | 'error';

/**
 * Real-time voice effects via the Web Audio graph.
 * Pipeline: mic -> inputGain -> noiseGate -> effect chain -> outputGain -> destination
 * Pitch/robot effects run in AudioWorklet processors; filters/echo use native nodes.
 */
export class AudioEngine {
  private ctx: AudioContext | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private inputGain: GainNode | null = null;
  private outputGain: GainNode | null = null;
  private noiseGate: AudioWorkletNode | null = null;
  private pitch: AudioWorkletNode | null = null;
  private robot: AudioWorkletNode | null = null;
  private echoDelay: DelayNode | null = null;
  private echoFeedback: GainNode | null = null;
  private echoMix: GainNode | null = null;
  private flangerDelay: DelayNode | null = null;
  private flangerLfo: OscillatorNode | null = null;
  private flangerGain: GainNode | null = null;
  private radioFilter: BiquadFilterNode | null = null;
  private radioShaper: WaveShaperNode | null = null;
  private lowCut: BiquadFilterNode | null = null;
  private analyser: AnalyserNode | null = null;
  private status: AudioEngineStatus = 'idle';
  private workletsLoaded = false;
  private state: AudioEngineState = { ...DEFAULT_AUDIO_STATE };
  private stream: MediaStream | null = null;

  get statusValue(): AudioEngineStatus {
    return this.status;
  }

  async start(stream: MediaStream): Promise<void> {
    if (this.stream === stream && this.status === 'running') return;
    this.stop();

    this.stream = stream;
    const audioTrack = stream.getAudioTracks()[0];
    if (!audioTrack) return;

    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.ctx = new Ctor({ latencyHint: 'interactive' });
    await this.ctx.resume();

    await this.ensureWorklets();
    if (!this.ctx.audioWorklet) {
      this.status = 'error';
      console.error('AudioWorklet is not supported in this browser. Voice effects are unavailable.');
      return;
    }
    this.source = this.ctx.createMediaStreamSource(stream);

    // input stage
    this.inputGain = this.ctx.createGain();
    this.inputGain.gain.value = this.state.inputVolume;
    this.lowCut = this.ctx.createBiquadFilter();
    this.lowCut.type = 'highpass';
    this.lowCut.frequency.value = 90;

    if (this.ctx.audioWorklet) {
      this.noiseGate = new AudioWorkletNode(this.ctx, 'veyra-noise-gate');
      this.noiseGate.parameters.get('threshold')!.value = this.state.noiseSuppression ? 0.008 : 0.0001;
      this.pitch = new AudioWorkletNode(this.ctx, 'veyra-pitch');
      this.robot = new AudioWorkletNode(this.ctx, 'veyra-robot');
    }

    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 256;
    this.analyser.smoothingTimeConstant = 0.6;
    this.noiseGate?.connect(this.analyser);

    // effect sidechain nodes
    this.outputGain = this.ctx.createGain();
    this.outputGain.gain.value = this.state.outputVolume;

    // echo
    this.echoDelay = this.ctx.createDelay(1.5);
    this.echoDelay.delayTime.value = 0.28;
    this.echoFeedback = this.ctx.createGain();
    this.echoFeedback.gain.value = 0.35;
    this.echoMix = this.ctx.createGain();
    this.echoMix.gain.value = 0;

    // radio
    this.radioFilter = this.ctx.createBiquadFilter();
    this.radioFilter.type = 'bandpass';
    this.radioFilter.frequency.value = 1800;
    this.radioFilter.Q.value = 0.8;
    this.radioShaper = this.ctx.createWaveShaper();
    this.radioShaper.curve = this.distortionCurve(18);

    // flanger (alien)
    this.flangerDelay = this.ctx.createDelay(0.02);
    this.flangerDelay.delayTime.value = 0.006;
    this.flangerLfo = this.ctx.createOscillator();
    this.flangerLfo.frequency.value = 0.25;
    this.flangerGain = this.ctx.createGain();
    this.flangerGain.gain.value = 0.003;
    this.flangerLfo.connect(this.flangerGain);
    this.flangerGain.connect(this.flangerDelay.delayTime);
    this.flangerLfo.start();

    // wire graph
    this.source.connect(this.inputGain);
    this.inputGain.connect(this.lowCut);
    this.lowCut.connect(this.noiseGate!);
    this.noiseGate!.connect(this.pitch!);
    this.noiseGate!.connect(this.robot!);

    const dryBus = this.ctx.createGain();
    this.noiseGate!.connect(dryBus);

    // pitch out
    const pitchOut = this.ctx.createGain();
    this.pitch!.connect(pitchOut);
    // robot out
    const robotOut = this.ctx.createGain();
    this.robot!.connect(robotOut);
    // radio takes post-effect mix
    const preRadio = this.ctx.createGain();
    pitchOut.connect(preRadio);
    robotOut.connect(preRadio);
    this.noiseGate!.connect(preRadio);
    preRadio.connect(this.radioFilter!);
    this.radioFilter!.connect(this.radioShaper!);
    const radioOut = this.ctx.createGain();
    this.radioShaper!.connect(radioOut);

    this.status = 'running';
    this.applyEffect(this.state.effect, this.state.intensity);
  }

  private mixBus: GainNode | null = null;
  private dryBus: GainNode | null = null;

  private distortionCurve(amount: number): Float32Array<ArrayBuffer> {
    const n = 1024;
    const curve = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const x = (i * 2) / n - 1;
      curve[i] = Math.tanh(amount * x) / Math.tanh(amount);
    }
    return curve;
  }

  private async ensureWorklets(): Promise<void> {
    if (!this.ctx) return;
    if (this.workletsLoaded) return;
    if (!this.ctx.audioWorklet) return;
    for (const w of WORKLETS) {
      const blob = new Blob([w.code], { type: 'text/javascript' });
      const url = URL.createObjectURL(blob);
      await this.ctx.audioWorklet.addModule(url);
      URL.revokeObjectURL(url);
    }
    this.workletsLoaded = true;
  }

  applyEffect(effectId: string, intensity: number): void {
    this.state.effect = effectId;
    this.state.intensity = intensity;
    if (this.status !== 'running' || !this.ctx) return;

    const set = (param: AudioParam | null, v: number) => {
      if (param) param.setTargetAtTime(v, this.ctx!.currentTime, 0.02);
    };

    // reset all
    set(this.pitch?.parameters.get('shift') ?? null, 1);
    set(this.robot?.parameters.get('intensity') ?? null, 0);
    set(this.echoMix?.gain ?? null, 0);
    set(this.flangerDelay?.delayTime ?? null, 0.006);
    set(this.radioShaper?.curve ? (this.radioFilter?.gain as AudioParam) : null, 1);
    set(this.radioFilter?.frequency ?? null, 1800);
    if (this.radioFilter) this.radioFilter.Q.value = 0.8;
    set(this.dryBus?.gain ?? null, 1);

    switch (effectId) {
      case 'pitch': {
        const i = this.state.intensity;
        const shift = Math.pow(2, i * 0.9); // deep to high
        set(this.pitch?.parameters.get('shift') ?? null, shift);
        break;
      }
      case 'robot':
      case 'modulation': {
        set(this.robot?.parameters.get('intensity') ?? null, this.state.intensity);
        break;
      }
      case 'radio': {
        set(this.radioFilter?.frequency ?? null, 900 + this.state.intensity * 2000);
        break;
      }
      case 'echo': {
        set(this.echoMix?.gain ?? null, 0.3 + this.state.intensity * 0.6);
        set(this.echoFeedback?.gain ?? null, 0.2 + this.state.intensity * 0.4);
        break;
      }
      case 'alien': {
        set(this.pitch?.parameters.get('shift') ?? null, Math.pow(2, 0.35 + this.state.intensity * 0.25));
        set(this.flangerDelay?.delayTime ?? null, 0.004 + this.state.intensity * 0.004);
        set(this.flangerGain?.gain ?? null, 0.002 + this.state.intensity * 0.004);
        set(this.echoMix?.gain ?? null, this.state.intensity * 0.25);
        break;
      }
      case 'none':
      default:
        break;
    }
  }

  setInputVolume(v: number): void {
    this.state.inputVolume = v;
    this.inputGain?.gain.setTargetAtTime(v, this.ctx?.currentTime ?? 0, 0.02);
  }

  setOutputVolume(v: number): void {
    this.state.outputVolume = v;
    this.outputGain?.gain.setTargetAtTime(v, this.ctx?.currentTime ?? 0, 0.02);
  }

  setNoiseSuppression(enabled: boolean): void {
    this.state.noiseSuppression = enabled;
    if (this.noiseGate) {
      this.noiseGate.parameters.get('threshold')!.value = enabled ? 0.008 : 0.0001;
    }
  }

  setEchoCancellation(enabled: boolean): void {
    this.state.echoCancellation = enabled;
  }

  /**
   * Live input level (0..1) sampled after the noise gate, before voice effects.
   * Returns 0 when the audio graph is not running.
   */
  readLevel(): number {
    if (this.status !== 'running' || !this.ctx || !this.analyser) return 0;
    const buf = new Uint8Array(this.analyser.fftSize);
    this.analyser.getByteTimeDomainData(buf);
    let sum = 0;
    for (let i = 0; i < buf.length; i++) {
      const v = (buf[i]! - 128) / 128;
      sum += v * v;
    }
    const rms = Math.sqrt(sum / buf.length);
    return Math.min(1, rms * 2.4);
  }

  setMonitor(enabled: boolean): void {
    this.state.monitor = enabled;
    if (this.outputGain) this.outputGain.gain.setTargetAtTime(enabled ? this.state.outputVolume : 0, this.ctx?.currentTime ?? 0, 0.02);
  }

  stop(): void {
    try {
      this.flangerLfo?.stop();
    } catch {
      /* ignore */
    }
    this.source?.disconnect();
    this.ctx?.close().catch(() => undefined);
    this.ctx = null;
    this.source = null;
    this.inputGain = this.outputGain = this.noiseGate = this.pitch = this.robot = null;
    this.echoDelay = this.echoFeedback = this.echoMix = null;
    this.flangerDelay = this.flangerLfo = this.flangerGain = null;
    this.radioFilter = this.radioShaper = null;
    this.mixBus = this.dryBus = this.lowCut = this.analyser = null;
    this.workletsLoaded = false;
    this.status = 'idle';
  }
}
