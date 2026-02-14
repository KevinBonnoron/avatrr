import type { SpeechModelV3, SpeechModelV3CallOptions } from '@ai-sdk/provider';
import { pipeline } from '@huggingface/transformers';
import { logger } from '../lib/logger';

type TtsPipeline = Awaited<ReturnType<typeof pipeline<'text-to-speech'>>>;

/** Cached pipelines by model ID to avoid reloading. */
const pipelineCache = new Map<string, TtsPipeline>();

async function getPipeline(modelId: string): Promise<TtsPipeline> {
  const cached = pipelineCache.get(modelId);
  if (cached) {
    return cached;
  }

  logger.debug(`[transformers-tts] Loading TTS model: ${modelId}`);
  const pipe = await pipeline('text-to-speech', modelId);
  pipelineCache.set(modelId, pipe);
  logger.debug(`[transformers-tts] Model loaded: ${modelId}`);
  return pipe;
}

/** Encode raw PCM float32 samples to a WAV ArrayBuffer. */
function encodeWav(samples: Float32Array, sampleRate: number): Uint8Array {
  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
  const blockAlign = numChannels * (bitsPerSample / 8);
  const dataLength = samples.length * (bitsPerSample / 8);
  const buffer = new ArrayBuffer(44 + dataLength);
  const view = new DataView(buffer);

  // WAV header
  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };
  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataLength, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  writeString(36, 'data');
  view.setUint32(40, dataLength, true);

  // Convert float32 to int16
  let offset = 44;
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]!));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    offset += 2;
  }

  return new Uint8Array(buffer);
}

/** Default speaker embedding for SpeechT5 (CMU Arctic xvectors dataset). */
const DEFAULT_SPEAKER_EMBEDDINGS = 'https://huggingface.co/datasets/Xenova/transformers.js-docs/resolve/main/speaker_embeddings.bin';

/** Create a SpeechModelV3 backed by @huggingface/transformers. */
export function createTransformersSpeechModel(modelId: string): SpeechModelV3 {
  return {
    specificationVersion: 'v3',
    provider: 'transformers',
    modelId,

    async doGenerate(options: SpeechModelV3CallOptions) {
      const pipe = await getPipeline(modelId);
      // SpeechT5 requires speaker embeddings. Use voice if it looks like a URL/path,
      // otherwise fall back to default embeddings.
      const voice = options.voice;
      const isEmbeddingRef = voice && (voice.startsWith('http') || voice.startsWith('/') || voice.endsWith('.bin') || voice.endsWith('.npy'));
      const speakerEmbeddings = isEmbeddingRef ? voice : DEFAULT_SPEAKER_EMBEDDINGS;
      const result = await pipe(options.text, { speaker_embeddings: speakerEmbeddings });

      // The pipeline returns { audio: Float32Array, sampling_rate: number }
      const audio = encodeWav(result.audio as Float32Array, result.sampling_rate as number);

      return {
        audio,
        warnings: [],
        response: {
          timestamp: new Date(),
          modelId,
        },
      };
    },
  };
}
