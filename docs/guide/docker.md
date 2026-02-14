# Docker Deployment

The image serves the client (nginx) and the API (Bun). Avatar models (VRM) and animations (VRMA) are **not** embedded: they are read from a mountable directory and the avatar list is defined in a config file you can override.

## Volume mounts

### Avatar assets (models + animations)

Place your `.vrm` and `.vrma` files so nginx can serve them at `/models/` and `/animations/`.

Mount a directory that contains two subfolders: `models/` and `animations/`.

Example layout on the host:

```
./assets/
├── models/
│   ├── Pyra.vrm
│   └── Mythra.vrm
└── animations/
    ├── standard.vrma
    ├── appearing.vrma
    └── ...
```

Run with:

```bash
docker run -p 80:80 -v /path/to/assets:/data your-image
```

URLs in your config must match: `modelPath` like `/models/Pyra.vrm`, animation `url` like `/animations/standard.vrma`.

### Config file

The app reads avatars and animations from `config.jsonc` (path set by `CONFIG_PATH`, default `./config.jsonc` in the container, i.e. `/app/config.jsonc`).

To use your own config:

```bash
docker run -p 80:80 \
  -v /path/to/assets:/data \
  -v /path/to/config.jsonc:/app/config.jsonc \
  your-image
```

Copy `server/config.example.jsonc` as a starting point and add your `avatars` and `animations` entries.

## Environment variables

| Variable | Description |
|----------|-------------|
| `CONFIG_PATH` | Path to `config.jsonc` inside the container (default: `./config.jsonc` → `/app/config.jsonc`) |
| `VITE_SERVER_URL` | Injected into the client at runtime (default: `/api`). Set if the API is behind a different path or origin |

LLM and TTS are configured in `config.jsonc` (root keys `llm` and `tts`), not via env vars. API keys for OpenAI, Anthropic, and ElevenLabs can alternatively be set via `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, and `ELEVENLABS_API_KEY` env vars.

## Volume summary

| Mount (host → container) | Purpose |
|--------------------------|---------|
| `./assets` → `/data` | VRM models in `assets/models/`, VRMA in `assets/animations/` |
| `./config.jsonc` → `/app/config.jsonc` | Full config: llm, tts, expressions, avatars, animations |

Without these mounts, the app starts with an empty avatar list. Add your assets and config via volumes to serve your own avatars.
