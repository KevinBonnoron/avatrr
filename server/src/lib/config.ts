import { existsSync, readFileSync, watch } from 'node:fs';
import { resolve } from 'node:path';
import type { Expression } from '@avatrr/shared';
import Ajv from 'ajv';
import stripJsonComments from 'strip-json-comments';
import { DEFAULT_STORE, replaceConfigStore } from '../stores/config.store';
import type { AvatarConfig, ConfigFile, ExpressionConfig, LlmConfig, MemoryConfig, TtsConfig } from '../types';
import { initConversationDb, isConversationDbInitialized } from './conversation-db';
import { logger } from './logger';
import { closeMemory, initMemory, isMemoryInitialized } from './memory';

export const configPath = resolve(process.env.CONFIG_PATH || './config.jsonc');
const DEBOUNCE_MS = 200;

let debounceTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleReload(): void {
  if (debounceTimer !== null) {
    clearTimeout(debounceTimer);
  }

  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    reloadConfig();
  }, DEBOUNCE_MS);
}

export function startConfigWatcher(): void {
  try {
    watch(configPath, { persistent: false }, (_eventType, filename) => {
      if (filename) {
        scheduleReload();
      }
    });
    logger.debug(`[config] Watching ${configPath} for changes`);
  } catch (err) {
    logger.warn(`[config] Could not watch ${configPath}: ${err}`);
  }
}

// ─── Schema validation ──────────────────────────────────────────────────────

const schemaPath = resolve(import.meta.dir, '../../config.schema.json');
const ajv = new Ajv({ strict: false });
export const validateConfig = ajv.compile(JSON.parse(readFileSync(schemaPath, 'utf-8')) as object);

// ─── Expression defaults merge ──────────────────────────────────────────────

function mergeExpressionConfig(raw: ConfigFile['expressions']): ExpressionConfig {
  const defaults = DEFAULT_STORE.expressionConfig;
  return {
    valid: raw?.valid?.length ? (raw.valid as Expression[]) : defaults.valid,
    emotionMapping: raw?.emotionMapping ? ({ ...defaults.emotionMapping, ...raw.emotionMapping } as Record<string, Expression>) : defaults.emotionMapping,
  };
}

// ─── Load ───────────────────────────────────────────────────────────────────

function loadConfig(): void {
  if (!existsSync(configPath)) {
    logger.warn(`[config] Config file not found at ${configPath} – no avatars loaded`);
    replaceConfigStore({ ...DEFAULT_STORE });
    return;
  }

  try {
    const raw = readFileSync(configPath, 'utf-8');
    const file = JSON.parse(stripJsonComments(raw)) as ConfigFile;

    if (!validateConfig(file)) {
      const errors = validateConfig.errors ?? [];
      logger.error(`[config] Config validation failed at ${configPath}:`, ajv.errorsText(errors));
      return;
    }

    // ── Animations ────────────────────────────────────────────────────────
    const animations = (file.animations ?? []).map((a) => ({
      id: a.id,
      url: a.url ?? `/data/animations/${a.id}.vrma`,
      label: a.label,
    }));

    // ── Scenes ────────────────────────────────────────────────────────────
    const scenes = file.scenes ?? [];

    // ── LLM ───────────────────────────────────────────────────────────────
    const llmConfigs = new Map<string, LlmConfig>();
    for (const e of file.llm ?? []) {
      const name = e.name || 'default';
      switch (e.type) {
        case 'ollama':
          llmConfigs.set(name, {
            type: 'ollama',
            options: {
              url: e.options?.url ?? 'http://localhost:11434',
              model: e.options?.model ?? 'llama3.1',
              maxTokens: e.options?.maxTokens ?? 512,
            },
          });
          break;
        case 'openai':
          llmConfigs.set(name, {
            type: 'openai',
            options: {
              ...(e.options?.url && { url: e.options.url }),
              ...(e.options?.apiKey && { apiKey: e.options.apiKey }),
              model: e.options?.model ?? 'gpt-4o-mini',
              maxTokens: e.options?.maxTokens ?? 512,
            },
          });
          break;
        case 'anthropic':
          llmConfigs.set(name, {
            type: 'anthropic',
            options: {
              ...(e.options?.apiKey && { apiKey: e.options.apiKey }),
              model: e.options?.model ?? 'claude-sonnet-4-6',
              maxTokens: e.options?.maxTokens ?? 512,
            },
          });
          break;
        case 'local':
          llmConfigs.set(name, {
            type: 'local',
            options: {
              model: e.options?.model ?? 'onnx-community/Llama-3.2-1B-Instruct',
              maxTokens: e.options?.maxTokens ?? 512,
            },
          });
          break;
      }
    }
    const llmNames = new Set(llmConfigs.keys());
    const invalidAvatars = file.avatars.filter((a) => a.llm != null && 'ref' in a.llm && !llmNames.has(a.llm.ref));
    if (invalidAvatars.length > 0) {
      const details = invalidAvatars.map((a) => `"${a.id}" -> llm.ref "${a.llm && 'ref' in a.llm ? a.llm.ref : '?'}"`).join(', ');
      logger.error(`[config] Config validation failed at ${configPath}: avatar(s) reference unknown llm ref. ${details}. Known llm names: ${[...llmNames].sort().join(', ')}.`);
      return;
    }

    // ── TTS ───────────────────────────────────────────────────────────────
    const ttsConfigs = new Map<string, TtsConfig>();
    for (const e of file.tts ?? []) {
      const name = e.name || 'default';
      switch (e.type) {
        case 'openai':
          ttsConfigs.set(name, {
            type: 'openai',
            options: {
              ...(e.options?.apiKey && { apiKey: e.options.apiKey }),
              model: e.options?.model ?? 'tts-1',
              ...(e.options?.voice != null && { voice: e.options.voice }),
              ...(e.options?.speed != null && { speed: e.options.speed }),
            },
          });
          break;
        case 'elevenlabs':
          ttsConfigs.set(name, {
            type: 'elevenlabs',
            options: {
              ...(e.options?.apiKey && { apiKey: e.options.apiKey }),
              model: e.options?.model ?? 'eleven_multilingual_v2',
              ...(e.options?.voice != null && { voice: e.options.voice }),
            },
          });
          break;
        case 'local':
          ttsConfigs.set(name, {
            type: 'local',
            options: {
              model: e.options?.model ?? 'Xenova/speecht5_tts',
              ...(e.options?.voice != null && { voice: e.options.voice }),
              ...(e.options?.speed != null && { speed: e.options.speed }),
            },
          });
          break;
        case 'sirene':
          ttsConfigs.set(name, {
            type: 'sirene',
            options: {
              baseUrl: e.options?.baseUrl ?? 'http://localhost:3000',
              voice: e.options?.voice ?? '',
              ...(e.options?.speed != null && { speed: e.options.speed }),
            },
          });
          break;
      }
    }
    const ttsNames = new Set(ttsConfigs.keys());
    const invalidTtsAvatars = file.avatars.filter((a) => a.tts?.ref != null && !ttsNames.has(a.tts.ref));
    if (invalidTtsAvatars.length > 0) {
      const details = invalidTtsAvatars.map((a) => `"${a.id}" -> tts.ref "${a.tts?.ref}"`).join(', ');
      logger.error(`[config] Config validation failed at ${configPath}: avatar(s) reference unknown tts ref. ${details}. Known tts names: ${[...ttsNames].sort().join(', ') || '(none)'}.`);
      return;
    }

    // ── Avatars ───────────────────────────────────────────────────────────
    const avatars = file.avatars as AvatarConfig[];

    // ── Memory ────────────────────────────────────────────────────────────
    let memoryConfig: MemoryConfig | null = null;
    if (file.memory != null && typeof file.memory === 'object') {
      memoryConfig = {
        dbPath: file.memory.dbPath ?? './data/memory.sqlite',
        embeddingModel: file.memory.embeddingModel ?? 'nomic-embed-text',
        ...(file.memory.llmName && { llmName: file.memory.llmName }),
        topK: typeof file.memory.topK === 'number' && file.memory.topK > 0 ? file.memory.topK : 5,
      };
    }

    // ── Atomic store update ───────────────────────────────────────────────
    replaceConfigStore({
      avatars,
      animations,
      scenes,
      llmConfigs,
      defaultLlmName: file.llm?.[0]?.name ?? 'default',
      ttsConfigs,
      expressionConfig: mergeExpressionConfig(file.expressions),
      memoryConfig,
    });

    // ── Memory lifecycle ─────────────────────────────────────────────────
    if (!memoryConfig && isMemoryInitialized()) {
      closeMemory();
      logger.debug('[config] Memory disabled – DB closed');
    } else if (memoryConfig && !isMemoryInitialized()) {
      try {
        initMemory(memoryConfig.dbPath);
        logger.debug('[config] Memory enabled – DB initialized');
      } catch (err) {
        logger.warn(`[config] Failed to initialize memory: ${err}`);
      }
    }

    // ── Conversation DB lifecycle ─────────────────────────────────────
    const convDbPath = file.conversations?.dbPath ?? './data/conversations.sqlite';
    if (!isConversationDbInitialized()) {
      try {
        initConversationDb(convDbPath);
        logger.debug('[config] Conversation DB initialized');
      } catch (err) {
        logger.warn(`[config] Failed to initialize conversation DB: ${err}`);
      }
    }

    logger.debug(`[config] Loaded from file: ${configPath}`);
    logger.debug(`- ${llmConfigs.size} llm(s)`);
    logger.debug(`- ${ttsConfigs.size} tts(s)`);
    logger.debug(`- ${avatars.length} avatar(s)`);
    logger.debug(`- ${animations.length} animation(s)`);
    if (memoryConfig) {
      logger.debug('[config] Memory on');
    }
  } catch (err) {
    logger.error(`[config] Failed to parse ${configPath}: ${err}`);
  }
}

loadConfig();

export function reloadConfig(): void {
  loadConfig();
}
