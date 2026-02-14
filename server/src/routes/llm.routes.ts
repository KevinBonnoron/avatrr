import { Hono } from 'hono';
import stripJsonComments from 'strip-json-comments';
import { configPath } from '../lib/config';
import { logger } from '../lib/logger';
import type { ConfigLlmEntry } from '../types';

async function fetchLlmModels(entry: ConfigLlmEntry): Promise<string[]> {
  const timeout = 8_000;
  switch (entry.type) {
    case 'ollama': {
      const url = entry.options?.url ?? 'http://localhost:11434';
      const res = await fetch(`${url}/api/tags`, { signal: AbortSignal.timeout(timeout) });
      if (!res.ok) {
        return [];
      }
      const data = (await res.json()) as { models?: { name: string }[] };
      return (data.models ?? []).map((m) => m.name);
    }
    case 'openai': {
      const baseUrl = entry.options?.url || 'https://api.openai.com/v1';
      const apiKey = entry.options?.apiKey ?? process.env.OPENAI_API_KEY ?? '';
      const res = await fetch(`${baseUrl}/models`, {
        headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
        signal: AbortSignal.timeout(timeout),
      });
      if (!res.ok) {
        return [];
      }
      const data = (await res.json()) as { data?: { id: string }[] };
      return (data.data ?? []).map((m) => m.id).sort();
    }
    case 'anthropic': {
      // Anthropic doesn't have a list models endpoint; return common models
      return ['claude-sonnet-4-6', 'claude-haiku-4-5-20251001', 'claude-opus-4-6'];
    }
    case 'local':
      return entry.options?.model ? [entry.options.model] : [];
    default:
      return [];
  }
}

async function findLlmEntry(name: string): Promise<ConfigLlmEntry | undefined> {
  const raw = await Bun.file(configPath).text();
  const config = JSON.parse(stripJsonComments(raw)) as { llm?: ConfigLlmEntry[] };
  return config.llm?.find((e) => e.name === name);
}

export const llmRoutes = new Hono()

  .get('/:name/models', async (c) => {
    const name = c.req.param('name');
    const entry = await findLlmEntry(name);
    if (!entry) {
      return c.json({ models: [] });
    }
    try {
      const models = await fetchLlmModels(entry);
      return c.json(models);
    } catch (err) {
      logger.error(`[llm] Failed to list models for "${name}": ${err}`);
      return c.json([]);
    }
  })

  .post('/models', async (c) => {
    const entry = await c.req.json<ConfigLlmEntry>();
    try {
      const models = await fetchLlmModels(entry);
      return c.json(models);
    } catch (err) {
      logger.error(`[llm] Failed to list models: ${err}`);
      return c.json([]);
    }
  })

  .post('/test', async (c) => {
    const entry = await c.req.json<ConfigLlmEntry>();
    const timeout = 8_000;
    try {
      switch (entry.type) {
        case 'ollama': {
          const url = entry.options?.url ?? 'http://localhost:11434';
          const res = await fetch(`${url}/api/tags`, { signal: AbortSignal.timeout(timeout) });
          if (!res.ok) {
            return c.json({ ok: false, message: `Ollama responded with ${res.status}` });
          }
          const data = (await res.json()) as { models?: { name: string }[] };
          const models = data.models ?? [];
          const model = entry.options?.model;
          if (model && models.length > 0) {
            const found = models.some((m) => m.name === model || m.name === `${model}:latest`);
            if (!found) {
              return c.json({ ok: true, message: `Connected, but model "${model}" not found. Available: ${models.map((m) => m.name).join(', ')}` });
            }
          }
          return c.json({ ok: true, message: `Connected (${models.length} models available)` });
        }
        case 'openai': {
          const baseUrl = entry.options?.url || 'https://api.openai.com/v1';
          const apiKey = entry.options?.apiKey ?? process.env.OPENAI_API_KEY ?? '';
          const res = await fetch(`${baseUrl}/models`, {
            headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
            signal: AbortSignal.timeout(timeout),
          });
          if (!res.ok) {
            const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
            const detail = body?.error?.message ?? `HTTP ${res.status}`;
            return c.json({ ok: false, message: detail });
          }
          return c.json({ ok: true, message: 'Connected' });
        }
        case 'anthropic': {
          const apiKey = entry.options?.apiKey ?? process.env.ANTHROPIC_API_KEY ?? '';
          if (!apiKey) {
            return c.json({ ok: false, message: 'No API key configured' });
          }
          return c.json({ ok: true, message: 'API key configured' });
        }
        case 'local': {
          const model = entry.options?.model;
          if (!model) {
            return c.json({ ok: false, message: 'No model configured' });
          }
          return c.json({ ok: true, message: `Transformers.js model: ${model}` });
        }
        default:
          return c.json({ ok: false, message: 'Unknown LLM type' });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return c.json({ ok: false, message });
    }
  });
