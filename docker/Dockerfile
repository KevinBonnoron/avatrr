# syntax=docker/dockerfile:1

# ── Bun binary (per target platform) ─────────────────────────────────────────

FROM oven/bun:1.2.4 AS bun-bin

# ── Final image ──────────────────────────────────────────────────────────────

FROM nginx:bookworm AS final

COPY --from=bun-bin /usr/local/bin/bun /usr/local/bin/bun

RUN --mount=type=cache,target=/var/cache/apt,sharing=locked \
    --mount=type=cache,target=/var/lib/apt,sharing=locked \
    rm -f /etc/apt/apt.conf.d/docker-clean \
    && apt-get update \
    && apt-get install -y --no-install-recommends supervisor curl \
    && mkdir -p /var/log/supervisor

WORKDIR /app

RUN mkdir -p server \
    && curl -sL "https://github.com/asg017/sqlite-vec/releases/download/v0.1.6/sqlite-vec-0.1.6-loadable-linux-x86_64.tar.gz" \
    | tar -xz -C server

COPY server/dist/index.js ./server/dist/index.js
# Native binaries can't be inlined by bun build — copy them for runtime
COPY node_modules/onnxruntime-node/bin/napi-v3/linux/x64/ ./server/bin/napi-v3/linux/x64/
COPY node_modules/@img/sharp-linux-x64 ./node_modules/@img/sharp-linux-x64
COPY node_modules/@img/sharp-libvips-linux-x64 ./node_modules/@img/sharp-libvips-linux-x64
COPY server/config.example.jsonc ./config.jsonc
COPY server/config.schema.json ./config.schema.json
COPY client/dist /usr/share/nginx/html

COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY docker/supervisord.conf /etc/supervisor/conf.d/supervisord.conf
COPY docker/entrypoint.sh /usr/local/bin/entrypoint.sh

RUN mkdir -p /data/models /data/animations

RUN chmod +x /usr/local/bin/entrypoint.sh

EXPOSE 80

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
CMD ["/usr/bin/supervisord", "-c", "/etc/supervisor/conf.d/supervisord.conf"]
