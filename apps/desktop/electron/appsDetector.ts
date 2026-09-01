import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export interface DetectedApp {
  name: string;
  running: boolean;
  cameraCompatible: boolean;
  micCompatible: boolean;
  notes: string;
}

interface AppProfile {
  name: string;
  processNames: string[];
  cameraCompatible: boolean;
  micCompatible: boolean;
  notes: string;
}

const PROFILES: AppProfile[] = [
  { name: 'Zoom', processNames: ['zoom'], cameraCompatible: true, micCompatible: true, notes: 'Select "Veyra Camera" / "Veyra Microphone" in Zoom settings.' },
  { name: 'Discord', processNames: ['discord'], cameraCompatible: true, micCompatible: true, notes: 'Video Settings → Camera → Veyra Camera.' },
  { name: 'Microsoft Teams', processNames: ['teams', 'teams.exe'], cameraCompatible: true, micCompatible: true, notes: 'Devices → Camera → Veyra Camera.' },
  { name: 'OBS Studio', processNames: ['obs', 'obs64'], cameraCompatible: true, micCompatible: false, notes: 'Add a Video Capture Device → Veyra Camera.' },
  { name: 'WhatsApp Desktop', processNames: ['whatsapp', 'whatsapp-for-linux'], cameraCompatible: true, micCompatible: true, notes: 'Settings → Privacy → Camera → Veyra Camera.' },
  { name: 'Slack', processNames: ['slack'], cameraCompatible: true, micCompatible: true, notes: 'Camera previews appear on calls; select Veyra Camera in Settings.' },
  { name: 'Google Meet (browser)', processNames: ['chrome', 'chromium', 'google-chrome', 'brave', 'firefox'], cameraCompatible: true, micCompatible: true, notes: 'Allow the browser camera access, then pick Veyra Camera in Meet.' },
];

export async function detectApps(): Promise<DetectedApp[]> {
  let procs: string[] = [];
  try {
    if (process.platform === 'linux') {
      const { stdout } = await execFileAsync('ps', ['-e', '-o', 'comm=']);
      procs = stdout.split('\n').map((l) => l.trim().toLowerCase()).filter(Boolean);
    } else if (process.platform === 'win32') {
      const { stdout } = await execFileAsync('tasklist', ['/FO', 'CSV', '/NH']);
      procs = stdout.split('\n').map((l) => l.toLowerCase());
    } else {
      const { stdout } = await execFileAsync('ps', ['-A', '-o', 'comm=']);
      procs = stdout.split('\n').map((l) => l.trim().toLowerCase()).filter(Boolean);
    }
  } catch {
    procs = [];
  }

  return PROFILES.map((p) => {
    const running = p.processNames.some((name) =>
      procs.some((proc) => proc.includes(name.toLowerCase()) || proc.includes(name.toLowerCase() + '.exe')),
    );
    return {
      name: p.name,
      running,
      cameraCompatible: p.cameraCompatible,
      micCompatible: p.micCompatible,
      notes: running ? p.notes : `${p.name} is not running. Start it to configure Veyra devices.`,
    };
  });
}
