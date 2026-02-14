import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAI } from '@ai-sdk/openai';
import type { LanguageModel } from 'ai';
import type { LlmConfig } from '../types';
import { createTransformersLanguageModel } from '../adapters/transformers-llm.adapter';

/** Create a Vercel AI SDK LanguageModel from a resolved LLM config. */
export function createLanguageModel(config: LlmConfig): LanguageModel {
  switch (config.type) {
    case 'ollama': {
      // Ollama exposes an OpenAI-compatible API at /v1
      const provider = createOpenAI({
        baseURL: `${config.options.url.replace(/\/+$/, '')}/v1`,
        apiKey: 'ollama',
      });
      return provider(config.options.model);
    }
    case 'openai': {
      const provider = createOpenAI({
        ...(config.options.url && { baseURL: config.options.url }),
        apiKey: config.options.apiKey ?? process.env.OPENAI_API_KEY ?? '',
      });
      return provider(config.options.model);
    }
    case 'anthropic': {
      const provider = createAnthropic({
        apiKey: config.options.apiKey ?? process.env.ANTHROPIC_API_KEY ?? '',
      });
      return provider(config.options.model);
    }
    case 'local': {
      return createTransformersLanguageModel(config.options.model);
    }
  }
}
