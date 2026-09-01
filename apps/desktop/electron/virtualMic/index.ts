import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export const VMIC_SINK = 'veyra_mic';
export const VMIC_LABEL = 'Veyra Microphone';

export interface VirtualMicResult {
  status: 'available' | 'unavailable' | 'error';
  sink: string | null;
  source: string | null;
  message?: string;
}

export function supportsPulseAudio(): boolean {
  return process.platform === 'linux';
}

async function pactl(...args: string[]): Promise<string> {
  const { stdout } = await execFileAsync('pactl', args, { timeout: 8000 });
  return stdout;
}

export async function getVirtualMicStatus(): Promise<VirtualMicResult> {
  if (!supportsPulseAudio()) {
    return {
      status: 'unavailable',
      sink: null,
      source: null,
      message: `Virtual microphone is not yet supported on ${process.platform}. On Linux it uses a PipeWire/PulseAudio null sink.`,
    };
  }
  try {
    const sinks = await pactl('list', 'short', 'sinks').catch(() => '');
    if (sinks.split('\n').some((l) => l.includes(VMIC_SINK))) {
      return { status: 'available', sink: VMIC_SINK, source: `${VMIC_SINK}.monitor` };
    }
    return {
      status: 'unavailable',
      sink: null,
      source: null,
      message: 'The "Veyra Microphone" sink does not exist yet. Run `npm run setup:virtual-mic` or press "Create" below.',
    };
  } catch (err) {
    return {
      status: 'error',
      sink: null,
      source: null,
      message: `PulseAudio/PipeWire tooling unavailable: ${(err as Error).message}. Install ` + 'pipewire-pulse or pulseaudio.',
    };
  }
}

export async function ensureVirtualMic(): Promise<VirtualMicResult> {
  const current = await getVirtualMicStatus();
  if (current.status === 'available') return current;
  try {
    await pactl(
      'load-module',
      'module-null-sink',
      `sink_name=${VMIC_SINK}`,
      `sink_properties=device.description=${VMIC_LABEL}`,
    );
    return { status: 'available', sink: VMIC_SINK, source: `${VMIC_SINK}.monitor` };
  } catch (err) {
    return {
      status: 'error',
      sink: null,
      source: null,
      message: `Could not create the virtual microphone: ${(err as Error).message}`,
    };
  }
}
