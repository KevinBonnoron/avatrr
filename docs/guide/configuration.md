# Configuration

Almost everything is driven by **`config.jsonc`**. Copy `server/config.example.jsonc` to `config.jsonc` (or set `CONFIG_PATH`) and edit.

## Config file location

- **`CONFIG_PATH`** (env) — Path to the config file (default: `./config.jsonc`). Only env var used for app config.
- The file is watched: changes are picked up without restarting the server.

## Config structure

| Key | Description |
|-----|-------------|
| **llm** | Array of named LLM configs. Each entry: `name`, `type` (`ollama`, `openai`, `anthropic`, or `local`), `options` (model, maxTokens, apiKey, url). All providers use the Vercel AI SDK; `local` runs ONNX models via Transformers.js. Avatars reference one by `avatar.llm.ref`. |
| **tts** | Array of named TTS configs. Each entry: `name`, `type` (`openai`, `elevenlabs`, or `local`), `options` (apiKey, model, voice, speed). Avatars reference one by `avatar.tts.ref`. |
| **expressions** | Optional: `valid` (array of expression IDs), `emotionMapping` (custom emotion name → expression ID) for parsing LLM emotion tags. |
| **animations** | Array of `{ id, url, label }` (VRMA files). |
| **avatars** | Array of avatars: `id`, `name`, `outfits` (VRM models), optional `scene`, `animations`, per-avatar `llm` (`ref` + `overrides`), `tts` (`ref` + `overrides`), `speechRecognition`. |
| **memory** | Optional long-term memory: `dbPath`, `embeddingModel` (e.g. nomic-embed-text), `topK`. When set, relevant past exchanges are injected into the LLM context; per-avatar `memory: false` disables it. |
| **conversations** | Optional persistent conversations: `dbPath`. When set, conversations survive server restarts. |

## Example

```jsonc
{
  "$schema": "./config.schema.json",
  "llm": [
    {
      "name": "ollama",
      "type": "ollama",
      "options": { "url": "http://localhost:11434", "model": "llama3.1", "maxTokens": 512 }
    }
    // { "name": "openai", "type": "openai", "options": { "apiKey": "sk-...", "model": "gpt-4o-mini" } }
    // { "name": "anthropic", "type": "anthropic", "options": { "apiKey": "sk-ant-...", "model": "claude-sonnet-4-6" } }
    // { "name": "local", "type": "local", "options": { "model": "onnx-community/Llama-3.2-1B-Instruct" } }
  ],
  "tts": [
    // { "name": "openai-tts", "type": "openai", "options": { "apiKey": "sk-...", "voice": "alloy" } }
    // { "name": "elevenlabs", "type": "elevenlabs", "options": { "apiKey": "xi-...", "voice": "Rachel" } }
    // { "name": "local-tts", "type": "local", "options": { "model": "Xenova/speecht5_tts" } }
  ],
  "animations": [
    { "id": "standard", "url": "/data/animations/standard.vrma", "label": "Standard" }
  ],
  "avatars": [
    {
      "id": "example",
      "name": "Example Avatar",
      "outfits": [
        { "id": "default", "label": "Default", "modelPath": "/models/example.vrm", "default": true }
      ],
      "llm": { "ref": "ollama" },
      "tts": { "ref": "openai-tts", "overrides": { "voice": "alloy" } }
    }
  ]
}
```

## Per-avatar overrides

Each avatar can reference a root LLM/TTS by `ref` and override settings via `overrides`:

- **`llm`**: `ref` (references a root LLM entry), optional `overrides.systemPrompt`, `overrides.model`, optional `memory` (set `false` to disable memory for this avatar)
- **`tts`**: `ref` (references a root TTS entry), optional `overrides.voice`, `overrides.speed`

The JSON schema is in `server/config.schema.json` — set `"$schema": "./config.schema.json"` in your config for IDE validation.

## Client

- **`VITE_SERVER_URL`** — API base URL for the client (default: `http://localhost:3000/api`). Set in build env or `.env`.
