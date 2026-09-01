export interface CameraConstraints {
  deviceId?: string;
  audioDeviceId?: string;
  videoResolution?: { width: number; height: number };
  frameRate?: number;
  mirror?: boolean;
  echoCancellation?: boolean;
  noiseSuppression?: boolean;
  autoGainControl?: boolean;
}

export type CameraEvent = 'started' | 'stopped' | 'device-change' | 'error';

export interface CameraDevice {
  deviceId: string;
  label: string;
  kind: 'videoinput' | 'audioinput' | 'audiooutput';
}

export class CameraSource {
  private _stream: MediaStream | null = null;
  private video: HTMLVideoElement;
  private onError: (message: string, hint?: string) => void;

  constructor(video: HTMLVideoElement, onError?: (message: string, hint?: string) => void) {
    this.video = video;
    this.onError =
      onError ??
      ((m) => {
        console.error('[CameraSource]', m);
      });
  }

  get active(): boolean {
    return this._stream !== null && this._stream.active;
  }

  get stream(): MediaStream | null {
    return this._stream;
  }

  get videoElement(): HTMLVideoElement {
    return this.video;
  }

  get videoTrack(): MediaStreamTrack | null {
    return this._stream?.getVideoTracks()[0] ?? null;
  }

  get audioTrack(): MediaStreamTrack | null {
    return this._stream?.getAudioTracks()[0] ?? null;
  }

  static async enumerate(includeAudio = true): Promise<CameraDevice[]> {
    try {
      // Request a throwaway stream so devices have labels on some browsers.
      const probe = await navigator.mediaDevices?.getUserMedia?.({ audio: false, video: true }).catch(() => null);
      const devices = await navigator.mediaDevices.enumerateDevices();
      probe?.getTracks().forEach((t) => t.stop());
      return devices
        .filter((d) => (includeAudio ? d.kind !== 'audiooutput' : d.kind === 'videoinput'))
        .map((d) => ({ deviceId: d.deviceId, label: d.label || d.kind, kind: d.kind as CameraDevice['kind'] }));
    } catch (err) {
      console.error('enumerateDevices failed', err);
      return [];
    }
  }

  async start(constraints: CameraConstraints): Promise<void> {
    this.stopTracks();
    const videoConstraints: MediaTrackConstraints = {
      width: { ideal: constraints.videoResolution?.width ?? 1280 },
      height: { ideal: constraints.videoResolution?.height ?? 720 },
      frameRate: { ideal: constraints.frameRate ?? 30 },
    };
    if (constraints.deviceId) videoConstraints.deviceId = { exact: constraints.deviceId };

    const audioConstraints: MediaTrackConstraints = {};
    if (constraints.audioDeviceId) audioConstraints.deviceId = { exact: constraints.audioDeviceId };
    audioConstraints.echoCancellation = constraints.echoCancellation ?? false;
    audioConstraints.noiseSuppression = constraints.noiseSuppression ?? false;
    audioConstraints.autoGainControl = constraints.autoGainControl ?? true;

    try {
      this._stream = await navigator.mediaDevices.getUserMedia({
        video: videoConstraints,
        audio: constraints.audioDeviceId !== undefined ? audioConstraints : false,
      });
    } catch (err) {
      const name = (err as DOMException)?.name;
      if (name === 'NotAllowedError') {
        this.onError(
          'Camera permission was denied. Grant camera access in your system settings, then try again.',
          'permission',
        );
      } else if (name === 'NotFoundError') {
        this.onError('No camera device was found on this system.', 'no-device');
      } else if (name === 'NotReadableError' || name === 'TrackStartError') {
        this.onError(
          'The camera is already in use by another application. Close it and try again.',
          'in-use',
        );
      } else if (name === 'OverconstrainedError') {
        this.onError('The selected resolution is not supported by this camera. Try a lower resolution.', 'unsupported');
      } else {
        this.onError(`Could not start the camera: ${name ?? 'unknown error'}.`, 'unknown');
      }
      throw err;
    }

    const track = this.videoTrack;
    if (track) {
      if (constraints.frameRate) {
        try {
          await track.applyConstraints({ frameRate: { ideal: constraints.frameRate } });
        } catch {
          /* non-fatal */
        }
      }
    }

    this.video.srcObject = this._stream;
    this.video.muted = true;
    this.video.setAttribute('playsinline', 'true');
    await new Promise<void>((resolve, reject) => {
      const onReady = () => {
        this.video.removeEventListener('loadedmetadata', onReady);
        resolve();
      };
      this.video.addEventListener('loadedmetadata', onReady, { once: true });
      setTimeout(() => {
        if (!this.video.currentSrc && !this.video.srcObject) reject(new Error('video load timed out'));
        else resolve();
      }, 3000);
    });
    try {
      await this.video.play();
    } catch (err) {
      console.warn('video.play() rejected (autoplay policy)', err);
    }
  }

  private stopTracks(): void {
    if (this._stream) {
      this._stream.getTracks().forEach((t) => t.stop());
      this._stream = null;
    }
    this.video.srcObject = null;
  }

  stop(): void {
    this.stopTracks();
  }

  async switchVideoDevice(deviceId: string, current: CameraConstraints): Promise<void> {
    if (!this.active) {
      await this.start({ ...current, deviceId });
      return;
    }
    const track = this.videoTrack;
    if (track) {
      try {
        await track.applyConstraints({ deviceId: { exact: deviceId } });
        return;
      } catch {
        // fall through to full restart
      }
    }
    await this.start({ ...current, deviceId });
  }

  async switchAudioDevice(deviceId: string, current: CameraConstraints): Promise<void> {
    if (!this.active) {
      await this.start({ ...current, audioDeviceId: deviceId });
      return;
    }
    const track = this.audioTrack;
    if (track) {
      try {
        await track.applyConstraints({ deviceId: { exact: deviceId } });
        return;
      } catch {
        // fall through
      }
    }
    await this.start({ ...current, audioDeviceId: deviceId });
  }
}
