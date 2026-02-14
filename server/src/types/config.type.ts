import type { AvatarSpeechRecognitionConfig, AvatarConfig as BaseAvatarConfig, Expression, SceneConfig } from '@avatrr/shared';

/** TTS reference on an avatar: ref + optional overrides. */
interface AvatarTtsRef {
  readonly ref: string;
  readonly overrides?: {
    readonly voice?: string;
    readonly model?: string;
    readonly speed?: number;
  };
}

/** Avatar LLM reference: ref to a global LLM entry + optional overrides. */
interface AvatarLlmRef {
  readonly ref: string;
  readonly overrides?: {
    readonly systemPrompt?: string;
    readonly model?: string;
  };
  readonly memory?: boolean;
}

export type AvatarLlm = AvatarLlmRef;

// ─── Resolved LLM configs ───────────────────────────────────────────────────

export interface LlmOllamaConfig {
  readonly type: 'ollama';
  readonly options: {
    readonly url: string;
    readonly model: string;
    readonly maxTokens?: number;
  };
}

export interface LlmOpenAIConfig {
  readonly type: 'openai';
  readonly options: {
    readonly url?: string;
    readonly apiKey?: string;
    readonly model: string;
    readonly maxTokens?: number;
  };
}

export interface LlmAnthropicConfig {
  readonly type: 'anthropic';
  readonly options: {
    readonly apiKey?: string;
    readonly model: string;
    readonly maxTokens?: number;
  };
}

export interface LlmLocalConfig {
  readonly type: 'local';
  readonly options: {
    /** HuggingFace model ID for Transformers.js (e.g. "onnx-community/Llama-3.2-1B-Instruct"). */
    readonly model: string;
    readonly maxTokens?: number;
  };
}

export type LlmConfig = LlmOllamaConfig | LlmOpenAIConfig | LlmAnthropicConfig | LlmLocalConfig;

// ─── Resolved TTS configs ────────────────────────────────────────────────────

export interface TtsOpenAIConfig {
  readonly type: 'openai';
  readonly options: {
    readonly apiKey?: string;
    readonly model: string;
    readonly voice?: string;
    readonly speed?: number;
  };
}

export interface TtsElevenLabsConfig {
  readonly type: 'elevenlabs';
  readonly options: {
    readonly apiKey?: string;
    readonly model: string;
    readonly voice?: string;
  };
}

export interface TtsLocalConfig {
  readonly type: 'local';
  readonly options: {
    /** HuggingFace model ID for Transformers.js TTS (e.g. "Xenova/speecht5_tts"). */
    readonly model: string;
    readonly voice?: string;
    readonly speed?: number;
  };
}

export interface TtsSireneConfig {
  readonly type: 'sirene';
  readonly options: {
    /** Sirene server base URL (e.g. "http://localhost:3000"). */
    readonly baseUrl: string;
    /** Voice ID configured in Sirene. */
    readonly voice: string;
    readonly speed?: number;
  };
}

export type TtsConfig = TtsOpenAIConfig | TtsElevenLabsConfig | TtsLocalConfig | TtsSireneConfig;

// ─── Expression config ───────────────────────────────────────────────────────

export interface ExpressionConfig {
  readonly valid: readonly Expression[];
  readonly emotionMapping: Readonly<Record<string, Expression>>;
}

// ─── Avatar config (extends shared base) ─────────────────────────────────────

export type AvatarConfig = BaseAvatarConfig & {
  readonly llm?: AvatarLlm;
  readonly tts?: AvatarTtsRef;
  readonly speechRecognition?: AvatarSpeechRecognitionConfig;
  readonly scene?: string;
};

// ─── Config file entries ─────────────────────────────────────────────────────

interface ConfigLlmEntryBase {
  readonly name: string;
}

export type ConfigLlmEntryOllama = ConfigLlmEntryBase & {
  readonly type: 'ollama';
  readonly options: {
    readonly url?: string;
    readonly model?: string;
    readonly maxTokens?: number;
  };
};

export type ConfigLlmEntryOpenAI = ConfigLlmEntryBase & {
  readonly type: 'openai';
  readonly options: {
    readonly url?: string;
    readonly apiKey?: string;
    readonly model?: string;
    readonly maxTokens?: number;
  };
};

export type ConfigLlmEntryAnthropic = ConfigLlmEntryBase & {
  readonly type: 'anthropic';
  readonly options: {
    readonly apiKey?: string;
    readonly model?: string;
    readonly maxTokens?: number;
  };
};

export type ConfigLlmEntryLocal = ConfigLlmEntryBase & {
  readonly type: 'local';
  readonly options: {
    readonly model?: string;
    readonly maxTokens?: number;
  };
};

export type ConfigLlmEntry = ConfigLlmEntryOllama | ConfigLlmEntryOpenAI | ConfigLlmEntryAnthropic | ConfigLlmEntryLocal;

export type ConfigTtsEntryOpenAI = {
  readonly name: string;
  readonly type: 'openai';
  readonly options?: {
    readonly apiKey?: string;
    readonly model?: string;
    readonly voice?: string;
    readonly speed?: number;
  };
};

export type ConfigTtsEntryElevenLabs = {
  readonly name: string;
  readonly type: 'elevenlabs';
  readonly options?: {
    readonly apiKey?: string;
    readonly model?: string;
    readonly voice?: string;
  };
};

export type ConfigTtsEntryLocal = {
  readonly name: string;
  readonly type: 'local';
  readonly options?: {
    readonly model?: string;
    readonly voice?: string;
    readonly speed?: number;
  };
};

export type ConfigTtsEntrySirene = {
  readonly name: string;
  readonly type: 'sirene';
  readonly options?: {
    readonly baseUrl?: string;
    readonly voice?: string;
    readonly speed?: number;
  };
};

export type ConfigTtsEntry = ConfigTtsEntryOpenAI | ConfigTtsEntryElevenLabs | ConfigTtsEntryLocal | ConfigTtsEntrySirene;

/** Optional memory config (SQLite + sqlite-vec). */
export interface MemoryConfig {
  readonly dbPath: string;
  readonly embeddingModel: string;
  /** Name of the LLM config to use for embeddings. Defaults to the first LLM config. */
  readonly llmName?: string;
  readonly topK: number;
}

/** Animation entry in config file; url is optional and defaults to /animations/{id} when loading. */
export interface ConfigAnimationEntry {
  readonly id: string;
  readonly url?: string;
  readonly label: string;
}

export interface ConfigConversationsEntry {
  readonly dbPath?: string;
}

export interface ConfigFile {
  readonly animations?: readonly ConfigAnimationEntry[];
  readonly avatars: readonly AvatarConfig[];
  readonly llm?: readonly ConfigLlmEntry[];
  readonly tts?: readonly ConfigTtsEntry[];
  readonly scenes?: readonly SceneConfig[];
  readonly expressions?: {
    readonly valid?: readonly string[];
    readonly emotionMapping?: Readonly<Record<string, string>>;
  };
  readonly memory?: MemoryConfig;
  readonly conversations?: ConfigConversationsEntry;
}
