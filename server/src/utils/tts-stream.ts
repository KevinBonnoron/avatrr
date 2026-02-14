import type { StreamChunk } from '@avatrr/shared';
import { logger } from '../lib/logger';
import { SentenceBuffer } from './sentence-splitter';

export type SynthesizeFn = (text: string) => Promise<ArrayBuffer>;

interface PendingAudio {
  readonly index: number;
  readonly promise: Promise<ArrayBuffer | null>;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i] ?? 0);
  }
  return btoa(binary);
}

function makeTtsAudioChunk(audio: string, index: number): StreamChunk {
  return { type: 'TTS_AUDIO', audio, index, timestamp: Date.now() };
}

/**
 * Wrap a chat stream to inject TTS audio events. Text tokens pass through
 * immediately; completed sentences are synthesized in parallel and emitted
 * as TTS_AUDIO events in order.
 */
export async function* withTtsEvents(chatStream: AsyncIterable<StreamChunk>, synthesize: SynthesizeFn): AsyncIterable<StreamChunk> {
  const sentenceBuffer = new SentenceBuffer();
  const pending: PendingAudio[] = [];
  let nextIndex = 0;
  let nextEmitIndex = 0;
  const resolved = new Map<number, string | null>();

  // Resolves when any new synthesis completes, allowing eager draining
  // between chat chunks.
  let notifyReady: (() => void) | null = null;

  function enqueueSentence(text: string): void {
    const idx = nextIndex++;
    const promise = synthesize(text)
      .then((buf) => {
        const b64 = arrayBufferToBase64(buf);
        resolved.set(idx, b64);
        notifyReady?.();
        return buf;
      })
      .catch((err) => {
        logger.error(`[tts-stream] synthesis failed for sentence ${idx}: ${err}`);
        resolved.set(idx, null);
        notifyReady?.();
        return null;
      });
    pending.push({ index: idx, promise });
  }

  function* drainResolved(): Generator<StreamChunk> {
    while (resolved.has(nextEmitIndex)) {
      const audio = resolved.get(nextEmitIndex) ?? null;
      resolved.delete(nextEmitIndex);
      if (audio) {
        yield makeTtsAudioChunk(audio, nextEmitIndex);
      }
      nextEmitIndex++;
    }
  }

  let pendingStreamEnd: StreamChunk | null = null;

  for await (const chunk of chatStream) {
    // Defer STREAM_END until all TTS for this response has been sent
    if (chunk.type === 'STREAM_END') {
      pendingStreamEnd = chunk;
      const remaining = sentenceBuffer.flush();
      if (remaining) {
        enqueueSentence(remaining);
      }
      // Do not yield chunk here; yield it after TTS drain below
    } else {
      yield chunk;
    }

    if (chunk.type === 'TEXT') {
      const delta = chunk.delta ?? '';
      const sentences = sentenceBuffer.append(delta);
      for (const sentence of sentences) {
        enqueueSentence(sentence);
      }
    }

    // Emit any TTS audio that is ready (in order)
    yield* drainResolved();
  }

  // Wait for remaining TTS jobs, draining as each one completes
  while (nextEmitIndex < nextIndex) {
    // Wait for the next synthesis to resolve
    await new Promise<void>((resolve) => {
      if (resolved.has(nextEmitIndex)) {
        resolve();
      } else {
        notifyReady = () => {
          notifyReady = null;
          resolve();
        };
      }
    });
    yield* drainResolved();
  }

  // Now that all TTS has been sent, emit STREAM_END
  if (pendingStreamEnd) {
    yield pendingStreamEnd;
  }
}
