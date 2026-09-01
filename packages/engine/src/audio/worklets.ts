/**
 * AudioWorklet processor source code, embedded as strings and registered via
 * Blob URLs so Vite/Electron bundlers don't need worklet plugins.
 */

export interface WorkletDef {
  name: string;
  code: string;
}

const PITCH_SHIFT = `
class PitchShifter extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [{ name: 'shift', defaultValue: 1, minValue: 0.25, maxValue: 4 }];
  }
  constructor() {
    super();
    this.grainLength = 4096;
    this.bufferSize = 16384;
    this.buffers = [new Float32Array(this.bufferSize), new Float32Array(this.bufferSize)];
    this.readPos = 0;
  }
  hann(x) { return 0.5 - 0.5 * Math.cos(2 * Math.PI * x); }
  read(buf, pos) {
    const p = pos % this.bufferSize;
    const i0 = Math.floor(p);
    const frac = p - i0;
    const a = buf[i0 % this.bufferSize];
    const b = buf[(i0 + 1) % this.bufferSize];
    return a + (b - a) * frac;
  }
  process(inputs, outputs, parameters) {
    const input = inputs[0];
    const output = outputs[0];
    const shift = parameters.shift[0];
    if (!input || !output) return true;
    const frameCount = output[0].length;
    const channels = Math.min(input.length, output.length);
    for (let ch = 0; ch < channels; ch++) {
      const inData = input[ch];
      const outData = output[ch];
      const buf = this.buffers[ch];
      const writePos = this.readPos;
      // copy this block into the ring buffer at writePos
      for (let i = 0; i < frameCount; i++) {
        buf[(writePos + i) % this.bufferSize] = inData ? inData[i] : 0;
      }
      const readSpeed = 1 / shift;
      const half = this.grainLength / 2;
      let r = this.readPos;
      for (let i = 0; i < frameCount; i++) {
        const grainPos = r % this.grainLength;
        const winA = this.hann(grainPos / this.grainLength);
        const rB = r - half;
        const grainPosB = ((rB % this.grainLength) + this.grainLength) % this.grainLength;
        const winB = this.hann(grainPosB / this.grainLength);
        const a = this.read(buf, r);
        const b = this.read(buf, rB);
        outData[i] = (a * winA + b * winB) * 1.0;
        r += readSpeed;
      }
      this.readPos = (this.readPos + frameCount) % this.bufferSize;
    }
    return true;
  }
}
registerProcessor('veyra-pitch', PitchShifter);
`;

const ROBOT = `
class RobotVoice extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [{ name: 'intensity', defaultValue: 1, minValue: 0, maxValue: 1 }];
  }
  constructor() {
    super();
    this.t = 0;
  }
  process(inputs, outputs, parameters) {
    const input = inputs[0];
    const output = outputs[0];
    const intensity = parameters.intensity[0] || 1;
    const frameCount = output[0] ? output[0].length : 0;
    if (!input || frameCount === 0) return true;
    const sampleRate = sampleRate; // eslint-disable-line no-self-assign
    const f0 = 88;
    const channels = Math.min(input.length, output.length);
    for (let ch = 0; ch < channels; ch++) {
      const inData = input[ch];
      const outData = output[ch];
      for (let i = 0; i < frameCount; i++) {
        const x = inData ? inData[i] : 0;
        const carrier = Math.sin(2 * Math.PI * f0 * this.t / sampleRate);
        // ring modulation + mild octave ripple
        const mixed = x * (0.55 + 0.45 * carrier);
        // amplitude quantization for metallic grit
        const q = Math.floor(mixed * 48) / 48;
        // pre-emphasis to make it "synthetic"
        const y = q * (0.6 + 0.4 * carrier) * (0.4 + 0.6 * intensity);
        outData[i] = Math.max(-1, Math.min(1, y));
        this.t++;
      }
    }
    return true;
  }
}
registerProcessor('veyra-robot', RobotVoice);
`;

const NOISE_GATE = `
class NoiseGate extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [{ name: 'threshold', defaultValue: 0.01, minValue: 0, maxValue: 0.5 }];
  }
  constructor() {
    super();
    this.env = 0;
  }
  process(inputs, outputs, parameters) {
    const input = inputs[0];
    const output = outputs[0];
    const threshold = parameters.threshold[0];
    const frameCount = output[0] ? output[0].length : 0;
    if (!input || frameCount === 0) return true;
    const channels = Math.min(input.length, output.length);
    const attack = 0.02, release = 0.002;
    for (let ch = 0; ch < channels; ch++) {
      const inData = input[ch];
      const outData = output[ch];
      for (let i = 0; i < frameCount; i++) {
        const x = inData ? inData[i] : 0;
        const level = Math.abs(x);
        const target = level > threshold ? 1 : 0;
        const coef = target > this.env ? attack : release;
        this.env += (target - this.env) * coef;
        outData[i] = x * this.env;
      }
    }
    return true;
  }
}
registerProcessor('veyra-noise-gate', NoiseGate);
`;

export const WORKLETS: WorkletDef[] = [
  { name: 'veyra-pitch', code: PITCH_SHIFT },
  { name: 'veyra-robot', code: ROBOT },
  { name: 'veyra-noise-gate', code: NOISE_GATE },
];
