#!/bin/sh

set -e

echo "=== Client - Configuring runtime environment ==="

# Set default values if not provided
export VITE_SERVER_URL=${VITE_SERVER_URL:-/api}

echo "Replacing environment variables in built files..."
echo "  - VITE_SERVER_URL: ${VITE_SERVER_URL}"

# Replace placeholders in all JS and HTML files
find /usr/share/nginx/html -type f \( -name "*.js" -o -name "*.html" \) -exec sed -i \
  -e "s|__VITE_SERVER_URL_PLACEHOLDER__|${VITE_SERVER_URL}|g" \
  {} \;

echo "=== Client ready ==="

# Execute CMD
exec "$@"
