import { createElevenLabs } from '@ai-sdk/elevenlabs';
import { createOpenAI } from '@ai-sdk/openai';
import { experimental_generateSpeech as generateSpeech } from 'ai';
import type { SpeechModelV3 } from '@ai-sdk/provider';
import { createSireneSpeechModel } from '../adapters/sirene-tts.adapter';
import { createTransformersSpeechModel } from '../adapters/transformers-tts.adapter';
import type { TtsConfig } from '../types';

function resolveSpeechModel(config: TtsConfig): { model: SpeechModelV3; voice?: string; speed?: number } {
  switch (config.type) {
    case 'openai': {
      const provider = createOpenAI({
        apiKey: config.options.apiKey ?? process.env.OPENAI_API_KEY ?? '',
      });
      return {
        model: provider.speech(config.options.model || 'tts-1'),
        voice: config.options.voice,
        speed: config.options.speed,
      };
    }
    case 'elevenlabs': {
      const provider = createElevenLabs({
        apiKey: config.options.apiKey ?? process.env.ELEVENLABS_API_KEY ?? '',
      });
      return {
        model: provider.speech(config.options.model || 'eleven_multilingual_v2'),
        voice: config.options.voice,
      };
    }
    case 'local': {
      return {
        model: createTransformersSpeechModel(config.options.model),
        voice: config.options.voice,
        speed: config.options.speed,
      };
    }
    case 'sirene': {
      return {
        model: createSireneSpeechModel(config.options.baseUrl),
        voice: config.options.voice,
        speed: config.options.speed,
      };
    }
  }
}

/** Build a synthesis function that calls generateSpeech via the Vercel AI SDK. */
export function buildSynthesizeFn(config: TtsConfig): (text: string) => Promise<ArrayBuffer> {
  return async (text: string) => {
    const { model, voice, speed } = resolveSpeechModel(config);
    const result = await generateSpeech({
      model,
      text,
      ...(voice && { voice }),
      ...(speed != null && { speed }),
    });
    return result.audio.uint8Array.buffer as ArrayBuffer;
  };
}

/** Check whether a TTS config is present (all new types are valid if defined). */
export function isTtsConfigured(config?: TtsConfig): config is TtsConfig {
  return config != null;
}
