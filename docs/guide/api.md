# API Reference

The server exposes a REST API on port `3000` (development) or behind nginx (Docker).

## Endpoints

### `GET /api/avatars`

Returns the list of configured avatars (public config).

### `GET /api/animations`

Returns the list of available animations.

### `POST /api/chat`

Sends a chat message and streams the response via Server-Sent Events (SSE).

**Request body:**

```json
{
  "messages": [
    { "role": "user", "content": "Hello!" }
  ],
  "avatarId": "optional-avatar-id"
}
```

**Response:** SSE stream with LLM-generated text, including emotion tags that drive the avatar's facial expressions.

### `GET /api/health`

Health check endpoint. Returns `200 OK` when the server is running.
