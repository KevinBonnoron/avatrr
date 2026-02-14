#!/usr/bin/env bash
set -euo pipefail

# ── Constants ────────────────────────────────────────────────────────────────
REPO="KevinBonnoron/avatrr"
BRANCH="main"
RAW_BASE="https://raw.githubusercontent.com/${REPO}/${BRANCH}"
DEFAULT_DIR="./avatrr"

# ── Output helpers ───────────────────────────────────────────────────────────
if [ -t 1 ]; then
  BOLD='\033[1m' GREEN='\033[0;32m' YELLOW='\033[0;33m' RED='\033[0;31m' RESET='\033[0m'
else
  BOLD='' GREEN='' YELLOW='' RED='' RESET=''
fi

info()  { printf "${GREEN}[INFO]${RESET}  %s\n" "$*"; }
warn()  { printf "${YELLOW}[WARN]${RESET}  %s\n" "$*"; }
error() { printf "${RED}[ERROR]${RESET} %s\n" "$*" >&2; }
die()   { error "$*"; exit 1; }

# ── Preconditions ────────────────────────────────────────────────────────────
command -v docker >/dev/null 2>&1 \
  || die "Docker is not installed. See https://docs.docker.com/get-docker/"

docker compose version >/dev/null 2>&1 \
  || die "Docker Compose (v2) is required. Update Docker or install the compose plugin."

docker info >/dev/null 2>&1 \
  || die "Docker daemon is not running. Start it with: sudo systemctl start docker"

# ── Detect context ───────────────────────────────────────────────────────────
IN_REPO=false
if [ -f "docker/Dockerfile" ] && [ -f "config.minimal.jsonc" ] && [ -f "docker-compose.yml" ]; then
  IN_REPO=true
fi

if [ "$IN_REPO" = true ]; then
  DIR="."
  info "Detected avatrr repository — installing in place."
else
  DIR="${AVATRR_DIR:-$DEFAULT_DIR}"
  info "Installing avatrr to ${DIR}"
  mkdir -p "$DIR"
fi

# ── Directory structure ──────────────────────────────────────────────────────
mkdir -p "$DIR/data/models" "$DIR/data/animations"
info "Directory structure ready."

# ── Download files (remote mode only) ────────────────────────────────────────
if [ "$IN_REPO" = false ]; then
  info "Downloading docker-compose.yml..."
  curl -fsSL "${RAW_BASE}/docker-compose.yml" -o "$DIR/docker-compose.yml"

  info "Downloading config template..."
  curl -fsSL "${RAW_BASE}/config.minimal.jsonc" -o "$DIR/config.minimal.jsonc"
fi

# ── Config (never overwrite) ─────────────────────────────────────────────────
if [ -f "$DIR/config.jsonc" ]; then
  warn "config.jsonc already exists — skipping. Delete it to regenerate defaults."
else
  mv "$DIR/config.minimal.jsonc" "$DIR/config.jsonc"
  info "Created config.jsonc with local LLM defaults."
fi

# ── Summary ──────────────────────────────────────────────────────────────────
printf "\n"
info "avatrr is ready!"
printf "\n"
printf "  Directory: %s\n" "$(cd "$DIR" && pwd)"
printf "  ├── docker-compose.yml\n"
printf "  ├── config.jsonc\n"
printf "  └── data/\n"
printf "      ├── models/      (place .vrm files here)\n"
printf "      └── animations/  (place .vrma files here)\n"
printf "\n"
printf "  ${BOLD}Next steps:${RESET}\n"
printf "  1. Start avatrr:\n"
printf "       cd %s && docker compose up -d\n" "$DIR"
printf "  2. Open http://localhost in your browser\n"
printf "  3. Configure avatars, animations, LLM and TTS from the admin panel\n"
printf "\n"
