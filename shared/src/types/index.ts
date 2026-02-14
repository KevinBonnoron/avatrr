export type Expression = 'neutral' | 'happy' | 'sad' | 'angry' | 'surprised' | 'thinking';

export interface AnimationConfig {
  readonly id: string;
  readonly url: string;
  readonly label: string;
}

export interface OutfitConfig {
  readonly id: string;
  readonly label: string;
  readonly modelPath: string;
  /** When true, this outfit is selected by default. */
  readonly default?: boolean;
}

export interface AvatarSpeechRecognitionConfig {
  /** Optional speech recognition config: hint words improve recognition for this avatar (e.g. character names). */
  readonly hintWords?: readonly string[];
  /** When set (ms), recognition restarts after the browser ends a phrase, so the mic stays on longer. E.g. 1200. */
  readonly restartOnEndDelayMs?: number;
}

export interface AvatarAnimationsConfig {
  /** IDs of animations available for this avatar. When omitted, all global animations are available. */
  readonly available?: readonly string[];
  /** Animation ID to play as idle/rest loop (e.g. "standard"). */
  readonly idle?: string;
  /** Animation ID to play as intro when the avatar appears (e.g. "appearing"). */
  readonly appearing?: string;
  /** Mapping from expression/emotion name to animation ID. */
  readonly expressionMapping?: Readonly<Record<string, string>>;
  /** Animation IDs for random idle behaviors (e.g. look around, yawn). */
  readonly idlePool?: readonly string[];
  /** Minimum seconds between idle behaviors. Default 8. */
  readonly idleMinInterval?: number;
  /** Maximum seconds between idle behaviors. Default 20. */
  readonly idleMaxInterval?: number;
}

export interface AvatarConfig {
  readonly id: string;
  readonly name: string;
  /** Per-avatar animation settings (available IDs, idle, appearing, expression mapping). */
  readonly animations?: AvatarAnimationsConfig;
  /** Optional speech recognition hints (model-specific words/phrases for better recognition). */
  readonly speechRecognition?: AvatarSpeechRecognitionConfig;
  /** When false, this avatar has no TTS; response text should stay visible after the LLM finishes. */
  readonly hasTts?: boolean;
  /** ID of the scene/background to use for this avatar. */
  readonly scene?: string;
  /** Outfit variants. Each has its own VRM modelPath. One entry should have default: true. */
  readonly outfits: readonly OutfitConfig[];
}

// ─── Config file types (raw config.jsonc shape) ─────────────────────────────

interface ConfigLlmEntryBase {
  name: string;
}

export interface ConfigLlmEntryOllama extends ConfigLlmEntryBase {
  type: 'ollama';
  options?: {
    url?: string;
    model?: string;
    maxTokens?: number;
  };
}

export interface ConfigLlmEntryOpenAI extends ConfigLlmEntryBase {
  type: 'openai';
  options?: {
    url?: string;
    apiKey?: string;
    model?: string;
    maxTokens?: number;
  };
}

export interface ConfigLlmEntryAnthropic extends ConfigLlmEntryBase {
  type: 'anthropic';
  options?: {
    apiKey?: string;
    model?: string;
    maxTokens?: number;
  };
}

export interface ConfigLlmEntryLocal extends ConfigLlmEntryBase {
  type: 'local';
  options?: {
    model?: string;
    maxTokens?: number;
  };
}

export type ConfigLlmEntry = ConfigLlmEntryOllama | ConfigLlmEntryOpenAI | ConfigLlmEntryAnthropic | ConfigLlmEntryLocal;

interface ConfigTtsEntryBase {
  name: string;
}

export interface ConfigTtsEntryOpenAI extends ConfigTtsEntryBase {
  name: string;
  type: 'openai';
  options?: {
    apiKey?: string;
    model?: string;
    voice?: string;
    speed?: number;
  };
}

export interface ConfigTtsEntryElevenLabs extends ConfigTtsEntryBase {
  name: string;
  type: 'elevenlabs';
  options?: {
    apiKey?: string;
    model?: string;
    voice?: string;
  };
}

export interface ConfigTtsEntryLocal extends ConfigTtsEntryBase {
  name: string;
  type: 'local';
  options?: {
    model?: string;
    voice?: string;
    speed?: number;
  };
}

export interface ConfigTtsEntrySirene extends ConfigTtsEntryBase {
  name: string;
  type: 'sirene';
  options?: {
    baseUrl?: string;
    voice?: string;
    speed?: number;
  };
}

export type ConfigTtsEntry = ConfigTtsEntryOpenAI | ConfigTtsEntryElevenLabs | ConfigTtsEntryLocal | ConfigTtsEntrySirene;

export interface ConfigAnimationEntry {
  id: string;
  url?: string;
  label: string;
}

export interface ConfigAvatarEntry {
  id: string;
  name: string;
  outfits: { id: string; label: string; modelPath: string; default?: boolean }[];
  animations?: {
    available?: string[];
    idle?: string;
    appearing?: string;
    expressionMapping?: Record<string, string>;
    idlePool?: string[];
    idleMinInterval?: number;
    idleMaxInterval?: number;
  };
  llm?: { ref: string; overrides?: { systemPrompt?: string; model?: string }; memory?: boolean };
  tts?: { ref: string; overrides?: { voice?: string; model?: string; speed?: number } };
  speechRecognition?: { hintWords?: string[]; restartOnEndDelayMs?: number };
  /** ID of the scene/background to use for this avatar. References scenes[].id. */
  scene?: string;
}

export interface SceneConfig {
  id: string;
  name: string;
  type: '2d' | 'hdri';
  /** Path to the scene file (image for 2D, .hdr/.exr for HDRI). */
  path: string;
}

export interface ConfigMemoryEntry {
  dbPath?: string;
  embeddingModel?: string;
  llmName?: string;
  topK?: number;
}

export interface ConfigConversationsEntry {
  /** Path to the SQLite database file for persistent conversations. */
  dbPath?: string;
}

export interface ConfigFile {
  avatars?: ConfigAvatarEntry[];
  llm?: ConfigLlmEntry[];
  tts?: ConfigTtsEntry[];
  animations?: ConfigAnimationEntry[];
  scenes?: SceneConfig[];
  expressions?: {
    valid?: string[];
    emotionMapping?: Record<string, string>;
  };
  memory?: ConfigMemoryEntry;
  conversations?: ConfigConversationsEntry;
}

// ─── Chat stream (SSE) – used by server and client ─────────────────────────

/** Base for all stream events (optional timestamp for ordering/debug). */
export interface StreamEventBase {
  readonly timestamp?: number;
}

/** Emitted when the server is connecting to the LLM. */
export interface StreamConnecting extends StreamEventBase {
  readonly type: 'CONNECTING';
}

/** New expression for the avatar (from parsed [EMOTION=...] or similar). */
export interface StreamExpression extends StreamEventBase {
  readonly type: 'EXPRESSION';
  readonly expression: Expression;
}

/** TTS audio chunk (base64), in order by index. */
export interface StreamTtsAudio extends StreamEventBase {
  readonly type: 'TTS_AUDIO';
  readonly audio: string;
  readonly index: number;
}

/** Text delta for the current assistant message. */
export interface StreamText extends StreamEventBase {
  readonly type: 'TEXT';
  readonly messageId: string;
  readonly delta: string;
}

/** Start of a new response stream. */
export interface StreamStart extends StreamEventBase {
  readonly type: 'STREAM_START';
  readonly runId: string;
  readonly messageId: string;
  /** Set when server created a new conversation (client should use this id for subsequent messages). */
  readonly conversationId?: string;
}

/** End of the response stream (success). */
export interface StreamEnd extends StreamEventBase {
  readonly type: 'STREAM_END';
  readonly runId: string;
  readonly messageId: string;
}

/** Stream error. */
export interface StreamError extends StreamEventBase {
  readonly type: 'STREAM_ERROR';
  readonly runId?: string;
  readonly error: { readonly message: string; readonly code: string };
}

/** Request to play an animation once (e.g. gesture). Id matches config animations[].id. */
export interface StreamAnimation extends StreamEventBase {
  readonly type: 'ANIMATION';
  readonly animationId: string;
}

/** Persistent mood update (emotional baseline that evolves over a conversation). */
export interface StreamMood extends StreamEventBase {
  readonly type: 'MOOD';
  readonly mood: Expression;
  readonly intensity: number;
}

export type StreamChunk = StreamConnecting | StreamExpression | StreamTtsAudio | StreamAnimation | StreamMood | StreamText | StreamStart | StreamEnd | StreamError;

// ─── Admin API types ─────────────────────────────────────────────────────────

/** Summary of an in-memory conversation. */
export interface ConversationSummary {
  readonly id: string;
  readonly avatarId: string | null;
  readonly messageCount: number;
  readonly lastUsed: number;
}

/** Result of a file upload. */
export interface UploadResult {
  readonly filename: string;
  readonly url: string;
}

/** Entry in a file listing (models or animations on disk). */
export interface FileEntry {
  readonly name: string;
  readonly url: string;
  readonly size: number;
}

/** A stored long-term memory entry for an avatar. */
export interface MemoryEntry {
  readonly id: number;
  readonly avatarId: string;
  readonly text: string;
  readonly createdAt: number;
}

/** Text message part. */
export interface ChatMessageTextPart {
  type: 'text';
  content: string;
}

/** Image message part (base64-encoded). */
export interface ChatMessageImagePart {
  type: 'image';
  /** Base64-encoded image data (raw base64, no data URL prefix). */
  data: string;
  /** MIME type (e.g. "image/jpeg", "image/png"). */
  mimeType?: string;
}

/** Message part (text or image). */
export type ChatMessagePart = ChatMessageTextPart | ChatMessageImagePart;

/** Message in the chat API request/response. */
export interface ChatRequestMessage {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content?: string;
  parts?: ChatMessagePart[];
}

/** Message with database ID, returned by the conversation detail endpoint. */
export interface ConversationMessage extends ChatRequestMessage {
  readonly id: number;
}
