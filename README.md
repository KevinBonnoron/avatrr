# avatrr

Real-time AI avatar chat: a 3D avatar in the browser reacts to conversation with facial expressions. Users send messages to a Hono backend, which streams replies from an LLM (e.g. Ollama) and optional TTS. Emotion tags in the LLM output drive the avatar’s expressions.

## Stack

- **Monorepo**: Bun workspaces + Turbo
- **client/** — React 19, Vite, TanStack Router, Three.js (@react-three/fiber), Tailwind v4, shadcn/ui
- **server/** — Hono on Bun, proxies chat to Ollama, optional Piper/F5-TTS
- **shared/** — TypeScript types (no build step)

## Docker (one command)

```bash
curl -fsSL https://raw.githubusercontent.com/KevinBonnoron/avatrr/main/install.sh | bash
```

Or clone the repo and run:

```bash
./install.sh
```

Then start and configure everything from the browser:

```bash
docker compose up -d
```

Open http://localhost and configure avatars, animations, LLM and TTS from the admin panel. Change the port with `AVATRR_PORT=8080 docker compose up -d`.

## Quick start (development)

```bash
bun install
bun run dev
```

Client: http://localhost:5173 — Server: http://localhost:3000

## Configuration

Almost everything is driven by **`config.jsonc`** (no LLM/TTS env vars). Copy `server/config.example.jsonc` to `config.jsonc` (or set `CONFIG_PATH`) and edit.

### Config file location

- **`CONFIG_PATH`** (env) — Path to the config file (default: `./config.jsonc`). Only env var used for app config.
- The file is watched: changes are picked up without restarting the server.

### Config structure (root-level)

| Key | Description |
|-----|-------------|
| **llm** | Array of named LLM configs. Each entry: `name`, `type` (`ollama`, `openai`, or `local`), provider-specific fields, `options` (model, maxTokens). `ollama`/`openai` use Vercel AI SDK; `local` runs a GGUF model directly via node-llama-cpp (auto-downloads from HuggingFace). Avatars reference one by `avatar.llm.name`. |
| **tts** | Array of named TTS configs. Each entry: `name`, `type` (`piper` or `f5-tts`), `options` (url, voice for piper; url, nfeStep for f5-tts). Avatars reference one by `avatar.tts.name`. |
| **expressions** | Optional: `valid` (array of expression IDs), `emotionMapping` (custom emotion name → expression ID) for parsing LLM emotion tags. |
| **animations** | Array of `{ id, url, label }` (VRMA files). |
| **avatars** | Array of avatars: `id`, `name`, `modelPath`, optional `camera`, `animationIds`, `animationMapping`, `defaultAnimationId`, `appearingAnimationId`, per-avatar `llm` (name + options override), `tts` (name + options), `speechRecognition`, `memory`. |
| **memory** | Optional long-term memory: `dbPath`, `embeddingModel` (e.g. nomic-embed-text), `topK`. When set, relevant past exchanges are injected into the LLM context; per-avatar `memory: false` disables it. |

Example (see `server/config.example.jsonc` for full sample):

```json
{
  "$schema": "./config.schema.json",
  "llm": [
    {
      "name": "ollama",
      "type": "ollama",
      "url": "http://localhost:11434",
      "options": { "model": "llama3.1", "maxTokens": 512 }
    }
  ],
  "tts": [
    { "name": "piper", "type": "piper", "options": { "url": "http://localhost:8080" } }
  ],
  "animations": [
    { "id": "standard", "url": "/animations/standard.vrma", "label": "Standard" }
  ],
  "avatars": []
}
```

Per-avatar: `llm` references a root LLM by name (optional `options.systemPrompt`, `options.model`); `tts` references a root TTS by name (optional `options.voice` for piper; for f5-tts, `options.referenceAudioPath` and `options.referenceText` are required per avatar). The JSON schema is in `server/config.schema.json` (IDE validation when you set `"$schema": "./config.schema.json"` in your config).

### Client

- **`VITE_SERVER_URL`** — API base URL for the client (default: `http://localhost:3000/api`). Set in build env or `.env`.

## Commands

| Command | Description |
|---------|-------------|
| `bun install` | Install dependencies |
| `bun run dev` | Client + server (Turbo) |
| `bun run build` | Build all workspaces |
| `bun run lint` | Biome linter |
| `bun run format` | Biome formatter |
| `bun run type-check` | `tsc --noEmit` |
| `bun run test` | Tests (Turbo) |

## API

- `GET /api/avatars` — List of avatars (public config)
- `GET /api/animations` — List of animations
- `POST /api/chat` — Chat stream (SSE), body: `{ messages, avatarId? }`
- `GET /api/health` — Health check

## Docker

See `docker/README.md` for image build, volume mounts (assets + config), and the single env var `CONFIG_PATH` (and optional `VITE_SERVER_URL` for the client).
