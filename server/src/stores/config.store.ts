import type { AnimationConfig, SceneConfig } from '@avatrr/shared';
import type { AvatarConfig, ExpressionConfig, LlmConfig, MemoryConfig, TtsConfig } from '../types';

export interface ConfigStore {
  readonly avatars: readonly AvatarConfig[];
  readonly animations: readonly AnimationConfig[];
  readonly scenes: readonly SceneConfig[];
  readonly llmConfigs: ReadonlyMap<string, LlmConfig>;
  readonly defaultLlmName: string;
  readonly ttsConfigs: ReadonlyMap<string, TtsConfig>;
  readonly expressionConfig: ExpressionConfig;
  readonly memoryConfig: MemoryConfig | null;
}

const DEFAULT_STORE: ConfigStore = {
  avatars: [],
  animations: [],
  scenes: [],
  llmConfigs: new Map(),
  defaultLlmName: 'default',
  ttsConfigs: new Map(),
  expressionConfig: {
    valid: ['happy', 'sad', 'angry', 'surprised', 'thinking', 'neutral'],
    emotionMapping: {
      smile: 'happy',
      gentle: 'happy',
      happy: 'happy',
      soft_laugh: 'happy',
      relieved: 'happy',
      blush: 'happy',
      sad: 'sad',
      worried: 'sad',
      surprised: 'surprised',
      confused: 'thinking',
      serious: 'thinking',
      embarrassed: 'thinking',
      shy: 'thinking',
      determined: 'neutral',
      protective: 'neutral',
    },
  },
  memoryConfig: null,
};

let store: ConfigStore = DEFAULT_STORE;

export function getConfigStore(): ConfigStore {
  return store;
}

export function replaceConfigStore(next: ConfigStore): void {
  store = next;
}

export { DEFAULT_STORE };
