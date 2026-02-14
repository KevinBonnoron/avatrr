import type { SpeechModelV3, SpeechModelV3CallOptions } from '@ai-sdk/provider';

interface SireneVoice {
  id: string;
  name: string;
}

let cachedVoices: { baseUrl: string; voices: SireneVoice[]; expiresAt: number } | undefined;
const CACHE_TTL = 5 * 60_000; // 5 minutes

async function fetchVoices(baseUrl: string): Promise<SireneVoice[]> {
  if (cachedVoices && cachedVoices.baseUrl === baseUrl && Date.now() < cachedVoices.expiresAt) {
    return cachedVoices.voices;
  }
  const res = await fetch(`${baseUrl}/api/voices`, { signal: AbortSignal.timeout(5000) });
  if (!res.ok) {
    throw new Error(`Sirene voices request failed (${res.status})`);
  }
  const voices = (await res.json()) as SireneVoice[];
  cachedVoices = { baseUrl, voices, expiresAt: Date.now() + CACHE_TTL };
  return voices;
}

/** Fetch available voices as {value, label} pairs from a Sirene instance. */
export async function listSireneVoices(baseUrl: string): Promise<{ value: string; label: string }[]> {
  const voices = await fetchVoices(baseUrl);
  return voices.map((v) => ({ value: v.id, label: v.name }));
}

/** Create a SpeechModelV3 backed by a remote Sirene instance. */
export function createSireneSpeechModel(baseUrl: string): SpeechModelV3 {
  return {
    specificationVersion: 'v3',
    provider: 'sirene',
    modelId: baseUrl,

    async doGenerate(options: SpeechModelV3CallOptions) {
      const res = await fetch(`${baseUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          voice: options.voice,
          input: options.text,
          ...(options.speed != null && { speed: options.speed }),
        }),
      });

      if (!res.ok) {
        const message = await res.text().catch(() => res.statusText);
        throw new Error(`Sirene TTS failed (${res.status}): ${message}`);
      }

      const audio = new Uint8Array(await res.arrayBuffer());
      return {
        audio,
        warnings: [],
        response: {
          timestamp: new Date(),
          modelId: baseUrl,
        },
      };
    },
  };
}
