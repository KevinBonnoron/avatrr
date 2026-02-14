export const llmTypeColors: Record<string, string> = {
  ollama: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  openai: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  anthropic: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  local: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
};

export const ttsTypeColors: Record<string, string> = {
  openai: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  elevenlabs: 'bg-pink-500/20 text-pink-400 border-pink-500/30',
  local: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  sirene: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
};

export const chipColors = [
  { selected: 'bg-blue-500/30 text-blue-300', idle: 'bg-blue-500/10 text-blue-400 hover:bg-blue-500/20' },
  { selected: 'bg-emerald-500/30 text-emerald-300', idle: 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20' },
  { selected: 'bg-purple-500/30 text-purple-300', idle: 'bg-purple-500/10 text-purple-400 hover:bg-purple-500/20' },
  { selected: 'bg-amber-500/30 text-amber-300', idle: 'bg-amber-500/10 text-amber-400 hover:bg-amber-500/20' },
  { selected: 'bg-cyan-500/30 text-cyan-300', idle: 'bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20' },
  { selected: 'bg-pink-500/30 text-pink-300', idle: 'bg-pink-500/10 text-pink-400 hover:bg-pink-500/20' },
  { selected: 'bg-indigo-500/30 text-indigo-300', idle: 'bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20' },
  { selected: 'bg-rose-500/30 text-rose-300', idle: 'bg-rose-500/10 text-rose-400 hover:bg-rose-500/20' },
];

export function hashString(str: string) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash);
}
