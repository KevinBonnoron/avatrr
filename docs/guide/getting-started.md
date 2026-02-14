# Getting Started

avatrr lets you chat with a 3D avatar that reacts in real time — facial expressions, animations, and optional voice — all powered by the LLM of your choice.

## Installation

Run this single command to install and start avatrr with Docker:

```bash
curl -fsSL https://raw.githubusercontent.com/KevinBonnoron/avatrr/main/install.sh | bash
```

Then open [http://localhost](http://localhost) in your browser. From the admin panel you can add avatars, choose your LLM, and configure text-to-speech.

::: tip
To use a different port: `AVATRR_PORT=8080 docker compose up -d`
:::

## What you'll need

- **An LLM** — [Ollama](https://ollama.com) running locally, OpenAI, Anthropic, or a local Transformers.js model
- **Avatar models** — `.vrm` files (you can find free ones on [VRoid Hub](https://hub.vroid.com))
- **TTS (optional)** — OpenAI TTS, ElevenLabs, or a local Transformers.js model for voice output

## Development setup

If you want to contribute or run from source:

```bash
bun install
bun run dev
```

- Client: `http://localhost:5173`
- Server: `http://localhost:3000`

### Commands

| Command | Description |
|---------|-------------|
| `bun run dev` | Start client + server |
| `bun run build` | Build all workspaces |
| `bun run lint` | Run linter |
| `bun run format` | Format code |
| `bun run type-check` | Type check |
| `bun run test` | Run tests |
