/**
 * TTS: lip-sync data callback and AudioChunkQueue for server-streamed
 * audio (SSE tts_audio events). Playback is fully handled server-side.
 */

// ── Lip-sync data ─────────────────────────────────────────────────

export interface LipSyncData {
  /** Overall RMS amplitude (0–1). */
  amplitude: number;
  /** Frequency band energies (0–1 each), used to drive multiple mouth shapes. */
  bands: {
    /** ~60–300 Hz — drives Ou/Oh (rounded mouth). */
    low: number;
    /** ~300–2 000 Hz — drives Aa (open mouth). */
    mid: number;
    /** ~2 000–8 000 Hz — drives Ee/Ih (spread mouth). */
    high: number;
  };
}

export const ZERO_LIP_SYNC: LipSyncData = { amplitude: 0, bands: { low: 0, mid: 0, high: 0 } };

let lipSyncCallback: ((data: LipSyncData) => void) | null = null;

/** Register a callback that receives real-time lip-sync data during TTS playback. */
export function setLipSyncCallback(cb: (data: LipSyncData) => void) {
  lipSyncCallback = cb;
}

/** Remove the lip-sync callback. */
export function removeLipSyncCallback() {
  lipSyncCallback = null;
}

// Backward-compatible aliases
export const setAmplitudeCallback = setLipSyncCallback;
export const removeAmplitudeCallback = removeLipSyncCallback;

// ── Audio chunk queue (for server-streamed TTS) ─────────────────

export interface AudioChunkQueueCallbacks {
  onSpeakingChange?: (speaking: boolean) => void;
  onSpeakingTextChange?: (text: string | null) => void;
}

/**
 * Receives base64-encoded audio chunks (from SSE tts_audio events) and plays
 * them sequentially. Provides stop() to cancel on new user message.
 */
export class AudioChunkQueue {
  private readonly queue: ArrayBuffer[] = [];
  private playing = false;
  private stopped = false;
  /** Generation counter — incremented on stop() so stale drain() loops exit. */
  private generation = 0;
  private currentSource: AudioBufferSourceNode | null = null;
  private currentCtx: AudioContext | null = null;
  private currentRafId = 0;
  public callbacks: AudioChunkQueueCallbacks = {};

  public enqueue(base64Audio: string): void {
    const binary = atob(base64Audio);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    this.queue.push(bytes.buffer as ArrayBuffer);
    if (!this.playing) {
      this.drain();
    }
  }

  public stop(): void {
    this.stopped = true;
    this.generation++;
    this.queue.length = 0;
    if (this.currentSource) {
      try {
        this.currentSource.stop();
      } catch {
        // already stopped
      }
      this.currentSource = null;
    }
    if (this.currentRafId) {
      cancelAnimationFrame(this.currentRafId);
      this.currentRafId = 0;
    }
    if (this.currentCtx) {
      this.currentCtx.close();
      this.currentCtx = null;
    }
    if (this.playing) {
      this.playing = false;
      lipSyncCallback?.(ZERO_LIP_SYNC);
      this.callbacks.onSpeakingChange?.(false);
      this.callbacks.onSpeakingTextChange?.(null);
    }
  }

  /** Reset stopped flag so the queue can be reused for a new response. */
  public reset(): void {
    this.stopped = false;
  }

  private async drain(): Promise<void> {
    const gen = this.generation;
    this.playing = true;
    this.callbacks.onSpeakingChange?.(true);

    while (this.queue.length > 0 && !this.stopped && gen === this.generation) {
      const arrayBuffer = this.queue.shift();
      if (!arrayBuffer || arrayBuffer.byteLength === 0) {
        continue;
      }
      try {
        await this.playBuffer(arrayBuffer);
      } catch {
        // Audio decode/play failed for this chunk — skip and continue with the next.
      }
    }

    // Only update state if this drain is still the active one
    if (gen === this.generation && !this.stopped) {
      this.playing = false;
      lipSyncCallback?.(ZERO_LIP_SYNC);
      this.callbacks.onSpeakingChange?.(false);
      this.callbacks.onSpeakingTextChange?.(null);
    }
  }

  private async playBuffer(arrayBuffer: ArrayBuffer): Promise<void> {
    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    this.currentCtx = ctx;
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }
    const buffer = await ctx.decodeAudioData(arrayBuffer.slice(0));
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    this.currentSource = source;

    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);
    analyser.connect(ctx.destination);

    const timeDomain = new Uint8Array(analyser.fftSize);
    const freqData = new Uint8Array(analyser.frequencyBinCount);
    const sampleRate = ctx.sampleRate;
    const binHz = sampleRate / analyser.fftSize;

    // Pre-compute bin ranges for frequency bands
    const lowEnd = Math.min(Math.ceil(300 / binHz), analyser.frequencyBinCount);
    const midEnd = Math.min(Math.ceil(2000 / binHz), analyser.frequencyBinCount);
    const highEnd = Math.min(Math.ceil(8000 / binHz), analyser.frequencyBinCount);

    const pollLipSync = () => {
      // RMS amplitude from time-domain data
      analyser.getByteTimeDomainData(timeDomain);
      let sum = 0;
      for (let i = 0; i < timeDomain.length; i++) {
        const v = ((timeDomain[i] ?? 128) - 128) / 128;
        sum += v * v;
      }
      const rms = Math.sqrt(sum / timeDomain.length);
      const amplitude = Math.min(rms * 3, 1);

      // Frequency band energies from FFT data
      analyser.getByteFrequencyData(freqData);
      let lowSum = 0;
      let midSum = 0;
      let highSum = 0;
      for (let i = 0; i < lowEnd; i++) {
        lowSum += freqData[i] ?? 0;
      }
      for (let i = lowEnd; i < midEnd; i++) {
        midSum += freqData[i] ?? 0;
      }
      for (let i = midEnd; i < highEnd; i++) {
        highSum += freqData[i] ?? 0;
      }

      const low = lowEnd > 0 ? Math.min((lowSum / lowEnd / 255) * 0.7, 1) : 0;
      const mid = midEnd - lowEnd > 0 ? Math.min((midSum / (midEnd - lowEnd) / 255) * 0.7, 1) : 0;
      const high = highEnd - midEnd > 0 ? Math.min((highSum / (highEnd - midEnd) / 255) * 0.7, 1) : 0;

      lipSyncCallback?.({ amplitude, bands: { low, mid, high } });
      this.currentRafId = requestAnimationFrame(pollLipSync);
    };
    if (lipSyncCallback) {
      this.currentRafId = requestAnimationFrame(pollLipSync);
    }

    source.start(0);
    return new Promise<void>((resolve) => {
      source.onended = () => {
        if (this.currentRafId) {
          cancelAnimationFrame(this.currentRafId);
          this.currentRafId = 0;
        }
        // Only clean up if stop() hasn't already done it
        if (this.currentSource === source) {
          this.currentSource = null;
        }
        if (this.currentCtx === ctx) {
          this.currentCtx = null;
          ctx.close();
        }
        resolve();
      };
    });
  }
}
