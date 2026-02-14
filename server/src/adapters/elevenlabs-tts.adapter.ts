interface ElevenLabsVoice {
  voice_id: string;
  name: string;
}

let cachedVoices: { apiKey: string; voices: ElevenLabsVoice[]; expiresAt: number } | undefined;
const CACHE_TTL = 5 * 60_000; // 5 minutes

async function fetchVoices(apiKey: string): Promise<ElevenLabsVoice[]> {
  if (cachedVoices && cachedVoices.apiKey === apiKey && Date.now() < cachedVoices.expiresAt) {
    return cachedVoices.voices;
  }
  const res = await fetch('https://api.elevenlabs.io/v1/voices', {
    headers: { 'xi-api-key': apiKey },
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) {
    throw new Error(`ElevenLabs voices request failed (${res.status})`);
  }
  const data = (await res.json()) as { voices: ElevenLabsVoice[] };
  cachedVoices = { apiKey, voices: data.voices, expiresAt: Date.now() + CACHE_TTL };
  return data.voices;
}

/** Fetch available voices as {value, label} pairs from the ElevenLabs API. */
export async function listElevenLabsVoices(apiKey: string): Promise<{ value: string; label: string }[]> {
  const voices = await fetchVoices(apiKey);
  return voices.map((v) => ({ value: v.voice_id, label: v.name }));
}
