export const config = {
  server: {
    url: import.meta.env.VITE_SERVER_URL || 'http://localhost:3000/api',
  },
};

/** Base URL of the server (without /api suffix). */
const serverBase = config.server.url.replace(/\/api\/?$/, '');

/**
 * Resolve an asset path against the server origin.
 * Absolute URLs (http/https) are returned as-is.
 * Relative paths like `/data/models/Foo.vrm` become `http://localhost:3000/data/models/Foo.vrm`.
 */
export function assetUrl(path: string): string {
  if (!path || path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }
  return `${serverBase}${path}`;
}
