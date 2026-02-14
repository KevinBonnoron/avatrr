import type { LanguageModelV3, LanguageModelV3CallOptions, LanguageModelV3GenerateResult, LanguageModelV3StreamPart, LanguageModelV3StreamResult } from '@ai-sdk/provider';
import { pipeline } from '@huggingface/transformers';
import { logger } from '../lib/logger';

type TextGenerationPipeline = Awaited<ReturnType<typeof pipeline<'text-generation'>>>;

/** Cached pipelines by model ID to avoid reloading. */
const pipelineCache = new Map<string, TextGenerationPipeline>();

async function getPipeline(modelId: string): Promise<TextGenerationPipeline> {
  const cached = pipelineCache.get(modelId);
  if (cached) {
    return cached;
  }

  logger.debug(`[transformers-llm] Loading LLM model: ${modelId}`);
  const pipe = await pipeline('text-generation', modelId);
  pipelineCache.set(modelId, pipe);
  logger.debug(`[transformers-llm] Model loaded: ${modelId}`);
  return pipe;
}

/** Convert AI SDK prompt messages to a single text prompt for the pipeline. */
function promptToText(prompt: LanguageModelV3CallOptions['prompt']): string {
  const parts: string[] = [];
  for (const msg of prompt) {
    if (msg.role === 'system') {
      parts.push(`System: ${msg.content}`);
    } else if (msg.role === 'user') {
      const text = msg.content
        .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
        .map((p) => p.text)
        .join('');
      parts.push(`User: ${text}`);
    } else if (msg.role === 'assistant') {
      const text = msg.content
        .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
        .map((p) => p.text)
        .join('');
      parts.push(`Assistant: ${text}`);
    }
  }
  parts.push('Assistant:');
  return parts.join('\n');
}

/** Create a LanguageModelV3 backed by @huggingface/transformers. */
export function createTransformersLanguageModel(modelId: string): LanguageModelV3 {
  return {
    specificationVersion: 'v3',
    provider: 'transformers',
    modelId,
    supportedUrls: {},

    async doGenerate(options: LanguageModelV3CallOptions): Promise<LanguageModelV3GenerateResult> {
      const pipe = await getPipeline(modelId);
      const text = promptToText(options.prompt);

      const result = await pipe(text, {
        max_new_tokens: options.maxOutputTokens ?? 512,
        temperature: options.temperature ?? 0.7,
        top_p: options.topP,
        do_sample: true,
      });

      const generated = Array.isArray(result) ? ((result[0] as { generated_text?: string })?.generated_text ?? '') : '';
      // Remove the prompt from the generated text
      const output = generated.startsWith(text) ? generated.slice(text.length) : generated;

      return {
        content: [{ type: 'text', text: output }],
        finishReason: { unified: 'stop', raw: 'stop' },
        usage: {
          inputTokens: { total: undefined, noCache: undefined, cacheRead: undefined, cacheWrite: undefined },
          outputTokens: { total: undefined, text: undefined, reasoning: undefined },
        },
        response: {
          timestamp: new Date(),
          modelId,
        },
        warnings: [],
      };
    },

    async doStream(options: LanguageModelV3CallOptions): Promise<LanguageModelV3StreamResult> {
      const pipe = await getPipeline(modelId);
      const text = promptToText(options.prompt);
      const textId = crypto.randomUUID();

      const stream = new ReadableStream<LanguageModelV3StreamPart>({
        async start(controller) {
          try {
            controller.enqueue({ type: 'text-start', id: textId });

            const streamer = {
              put(tokens: bigint[]) {
                // Decode token by token - the pipeline's tokenizer handles this
                const decoded = (pipe as unknown as { tokenizer: { decode: (t: bigint[], opts: { skip_special_tokens: boolean }) => string } }).tokenizer.decode(tokens, { skip_special_tokens: true });
                if (decoded) {
                  controller.enqueue({ type: 'text-delta', id: textId, delta: decoded });
                }
              },
              end() {
                // Stream ended
              },
            };

            await pipe(text, {
              max_new_tokens: options.maxOutputTokens ?? 512,
              temperature: options.temperature ?? 0.7,
              top_p: options.topP,
              do_sample: true,
              // @ts-expect-error - streamer is supported by transformers.js but not in all type defs
              streamer,
            });

            controller.enqueue({ type: 'text-end', id: textId });
            controller.enqueue({
              type: 'finish',
              finishReason: { unified: 'stop', raw: 'stop' },
              usage: {
                inputTokens: { total: undefined, noCache: undefined, cacheRead: undefined, cacheWrite: undefined },
                outputTokens: { total: undefined, text: undefined, reasoning: undefined },
              },
            });
            controller.close();
          } catch (err) {
            logger.error(`[transformers-llm] Stream error: ${err}`);
            controller.enqueue({
              type: 'error',
              error: err instanceof Error ? err : new Error(String(err)),
            });
            controller.close();
          }
        },
      });

      return { stream };
    },
  };
}
