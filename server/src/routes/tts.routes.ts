import { Hono } from 'hono';
import { listElevenLabsVoices } from '../adapters/elevenlabs-tts.adapter';
import { listSireneVoices } from '../adapters/sirene-tts.adapter';
import { buildSynthesizeFn } from '../lib/tts';
import type { ConfigTtsEntry, TtsConfig } from '../types';

/** Map a ConfigTtsEntry (from the client) to a resolved TtsConfig. */
function entryToConfig(entry: ConfigTtsEntry): TtsConfig {
  switch (entry.type) {
    case 'openai':
      return {
        type: 'openai',
        options: {
          ...(entry.options?.apiKey && { apiKey: entry.options.apiKey }),
          model: entry.options?.model ?? 'tts-1',
          voice: entry.options?.voice,
          speed: entry.options?.speed,
        },
      };
    case 'elevenlabs':
      return {
        type: 'elevenlabs',
        options: {
          ...(entry.options?.apiKey && { apiKey: entry.options.apiKey }),
          model: entry.options?.model ?? 'eleven_multilingual_v2',
          voice: entry.options?.voice,
        },
      };
    case 'local':
      return {
        type: 'local',
        options: {
          model: entry.options?.model ?? 'Xenova/speecht5_tts',
          voice: entry.options?.voice,
          speed: entry.options?.speed,
        },
      };
    case 'sirene':
      return {
        type: 'sirene',
        options: {
          baseUrl: entry.options?.baseUrl ?? 'http://localhost:3000',
          voice: entry.options?.voice ?? '',
          speed: entry.options?.speed,
        },
      };
  }
}

const TTS_SUGGESTIONS: Record<string, { models: string[]; voices: string[] }> = {
  openai: {
    models: ['tts-1', 'tts-1-hd'],
    voices: ['alloy', 'ash', 'coral', 'echo', 'fable', 'onyx', 'nova', 'sage', 'shimmer'],
  },
  elevenlabs: {
    models: ['eleven_multilingual_v2', 'eleven_turbo_v2', 'eleven_monolingual_v1'],
    voices: [],
  },
  local: {
    models: ['Xenova/speecht5_tts'],
    voices: [],
  },
  sirene: {
    models: [],
    voices: [],
  },
};

export const ttsRoutes = new Hono()

  .get('/suggestions', (c) => {
    const type = c.req.query('type');
    if (!type || !(type in TTS_SUGGESTIONS)) {
      return c.json({ models: [], voices: [] });
    }
    return c.json(TTS_SUGGESTIONS[type]);
  })

  .get('/voices', async (c) => {
    const type = c.req.query('type');
    try {
      if (type === 'sirene') {
        const baseUrl = c.req.query('baseUrl');
        if (baseUrl) {
          return c.json(await listSireneVoices(baseUrl));
        }
      }
      if (type === 'elevenlabs') {
        const apiKey = c.req.query('apiKey');
        if (apiKey) {
          return c.json(await listElevenLabsVoices(apiKey));
        }
      }
    } catch {
      // fall through
    }
    return c.json([]);
  })

  .post('/test', async (c) => {
    const entry = await c.req.json<ConfigTtsEntry>();
    try {
      const config = entryToConfig(entry);
      const synthesize = buildSynthesizeFn(config);
      const audio = await synthesize('Test.');
      if (audio.byteLength > 0) {
        return c.json({ ok: true, message: 'Audio generated successfully' });
      }
      return c.json({ ok: false, message: 'Empty audio response' });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return c.json({ ok: false, message });
    }
  });
