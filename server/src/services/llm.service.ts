import { getAvailableAnimationsForAvatar } from '@avatrr/shared';
import { getConfigStore } from '../stores/config.store';
import type { AvatarConfig, LlmConfig } from '../types';

export function getLlmConfig(name?: string): LlmConfig {
  const { llmConfigs, defaultLlmName } = getConfigStore();
  const found = llmConfigs.get(name ?? defaultLlmName);
  if (found) {
    return found;
  }

  const first = llmConfigs.values().next().value;
  if (first) {
    return first;
  }

  throw new Error('No LLM config loaded. Add "llm" to your config file (required).');
}

export function getResolvedLlmConfigForAvatar(avatar: AvatarConfig): LlmConfig {
  const llmRef = avatar.llm as { ref: string; overrides?: { model?: string } } | undefined;
  const base = getLlmConfig(llmRef?.ref);
  const modelOverride = llmRef?.overrides?.model;
  if (!modelOverride) {
    return base;
  }

  return { ...base, options: { ...base.options, model: modelOverride } } as LlmConfig;
}

// ─── System prompt building ─────────────────────────────────────────────────

const DEFAULT_SYSTEM_PROMPT_1 = `EMOTION SYSTEM (MANDATORY)

Every response MUST begin with an emotion tag in brackets.

Format:
[EMOTION=emotion_name]

Example:
[EMOTION=happy] Hello!

Then the response begins on the next line. Use only the emotions listed in your character instructions. Never invent other tags. Always include one. Only one tag per response.
`;

const DEFAULT_SYSTEM_PROMPT_2 = `IMPORTANT RULES
- Never use emojis. No smileys, no symbols (e.g. no 😊 👍 ❤️ etc.). Use words only.
- Never say you are an AI.
- Never mention "prompt" or "system".
- Never break character.
- Never mention out-of-universe elements.

Always respond in English regardless of the user's language.`;

function buildAnimationPromptSection(avatar: AvatarConfig): string {
  const { animations } = getConfigStore();
  const available = getAvailableAnimationsForAvatar(animations, avatar);
  if (available.length === 0) {
    return '';
  }
  const ids = available.map((a) => a.id).join(', ');
  return `ANIMATION (OPTIONAL)

You may trigger a one-shot animation by adding a tag in brackets. Use only these animation IDs (no other): ${ids}. At most one per response, right after the emotion tag.

Format:
[ANIMATION=animation_id]

Example:
[ANIMATION=wave]
Hello!`;
}

export function getEffectiveLlmOptions(avatar: AvatarConfig): { systemPrompt: string; model: string } {
  const animationSection = buildAnimationPromptSection(avatar);
  const basePrompt = [DEFAULT_SYSTEM_PROMPT_1, animationSection, DEFAULT_SYSTEM_PROMPT_2].filter(Boolean).join('\n\n');
  const avatarPrompt = avatar.llm?.overrides?.systemPrompt ?? '';
  const systemPrompt = [basePrompt, avatarPrompt].filter(Boolean).join('\n\n');
  const resolved = getResolvedLlmConfigForAvatar(avatar);
  const model = resolved.options.model;
  return { systemPrompt, model };
}
