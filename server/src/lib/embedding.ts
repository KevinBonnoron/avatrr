import { createOpenAI } from '@ai-sdk/openai';
import type { EmbeddingModel } from 'ai';
import { embed as aiEmbed } from 'ai';
import { getLlmConfig } from '../services';
import type { LlmConfig } from '../types';

let cachedDimension: number | null = null;

function createEmbeddingModel(config: LlmConfig, modelName: string): EmbeddingModel {
  switch (config.type) {
    case 'ollama': {
      const provider = createOpenAI({
        baseURL: `${config.options.url.replace(/\/+$/, '')}/v1`,
        apiKey: 'ollama',
      });
      return provider.embedding(modelName);
    }
    case 'openai': {
      const provider = createOpenAI({
        ...(config.options.url && { baseURL: config.options.url }),
        apiKey: config.options.apiKey ?? process.env.OPENAI_API_KEY ?? '',
      });
      return provider.embedding(modelName);
    }
    default:
      throw new Error(`Embedding not supported for LLM type '${config.type}'. Use an Ollama or OpenAI config.`);
  }
}

export interface EmbeddingOptions {
  model?: string;
  llmName?: string;
}

/**
 * Get embedding vector for text via Vercel AI SDK.
 * Uses the provider from the referenced (or default) LLM config.
 */
export async function embed(text: string, options: EmbeddingOptions = {}): Promise<number[]> {
  const llmConfig = getLlmConfig(options.llmName);
  const modelName = options.model ?? 'nomic-embed-text';
  const embeddingModel = createEmbeddingModel(llmConfig, modelName);

  const result = await aiEmbed({ model: embeddingModel, value: text });
  const vec = result.embedding;

  if (cachedDimension === null) {
    cachedDimension = vec.length;
  }

  return vec;
}

export function getEmbeddingDimension(): number {
  return cachedDimension ?? 768;
}
