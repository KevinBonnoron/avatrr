import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import JSZip from 'jszip';
import stripJsonComments from 'strip-json-comments';
import { configPath, reloadConfig, validateConfig } from '../lib/config';
import { logger } from '../lib/logger';
import { getConfigStore } from '../stores/config.store';
import { saveFile } from './files.service';

const DATA_DIR = resolve(process.env.DATA_DIR || './data');

interface Manifest {
  version: 1;
  avatar: Record<string, unknown>;
  /** Animation configs referenced by this avatar (so the target server can register them). */
  animations?: Array<{ id: string; label: string }>;
}

/** Resolve a /data/… path, an absolute path, or a bare filename to a disk path. */
function resolveDataPath(urlOrPath: string, subdir: string): string {
  if (urlOrPath.startsWith('/data/')) {
    return resolve(DATA_DIR, urlOrPath.replace('/data/', ''));
  }
  if (urlOrPath.startsWith('/')) {
    return urlOrPath;
  }
  return resolve(DATA_DIR, subdir, basename(urlOrPath));
}

/** Add a file from disk into the ZIP and return the zip-relative path, or undefined. */
function addFileToZip(zip: JSZip, diskPath: string, zipDir: string): string | undefined {
  if (!existsSync(diskPath)) {
    logger.warn(`[avatar-archive] File not found, skipping: ${diskPath}`);
    return undefined;
  }
  const name = basename(diskPath);
  const zipPath = `${zipDir}/${name}`;
  zip.file(zipPath, readFileSync(diskPath));
  return zipPath;
}

/**
 * Collect all animation IDs referenced by an avatar config.
 * Checks: available[], idle, appearing, idlePool[], expressionMapping values.
 */
function collectAnimationIds(animConfig: Record<string, unknown>): string[] {
  const ids = new Set<string>();

  const available = animConfig.available as string[] | undefined;
  if (available) {
    for (const id of available) {
      ids.add(id);
    }
  }

  const idle = animConfig.idle as string | undefined;
  if (idle) {
    ids.add(idle);
  }

  const appearing = animConfig.appearing as string | undefined;
  if (appearing) {
    ids.add(appearing);
  }

  const idlePool = animConfig.idlePool as string[] | undefined;
  if (idlePool) {
    for (const id of idlePool) {
      ids.add(id);
    }
  }

  const expressionMapping = animConfig.expressionMapping as Record<string, string> | undefined;
  if (expressionMapping) {
    for (const id of Object.values(expressionMapping)) {
      ids.add(id);
    }
  }

  return [...ids];
}

/**
 * Export an avatar and its referenced assets to a ZIP archive.
 * Paths in the manifest are rewritten to be zip-relative (e.g. "models/foo.vrm").
 */
export async function exportAvatar(avatarId: string): Promise<ArrayBuffer> {
  const store = getConfigStore();
  const avatar = store.avatars.find((a) => a.id === avatarId);
  if (!avatar) {
    throw new Error(`Avatar "${avatarId}" not found`);
  }

  const zip = new JSZip();

  // Deep-clone config so we can safely mutate paths
  const avatarConfig = JSON.parse(JSON.stringify(avatar)) as Record<string, unknown>;

  // ── Models (VRM outfits) ──────────────────────────────────────────────
  const outfits = avatarConfig.outfits as Array<Record<string, unknown>> | undefined;
  if (outfits) {
    for (const outfit of outfits) {
      const modelPath = outfit.modelPath as string | undefined;
      if (!modelPath) {
        continue;
      }
      const diskPath = resolveDataPath(modelPath, 'models');
      const zipPath = addFileToZip(zip, diskPath, 'models');
      if (zipPath) {
        outfit.modelPath = zipPath;
      }
    }
  }

  // ── Animations (VRMA) ─────────────────────────────────────────────────
  const animConfigs: Array<{ id: string; label: string }> = [];
  const animSettings = avatarConfig.animations as Record<string, unknown> | undefined;
  if (animSettings) {
    const animIds = collectAnimationIds(animSettings);
    for (const animId of animIds) {
      const animConfig = store.animations.find((a) => a.id === animId);
      if (!animConfig) {
        continue;
      }
      const diskPath = resolveDataPath(animConfig.url, 'animations');
      addFileToZip(zip, diskPath, 'animations');
      animConfigs.push({ id: animConfig.id, label: animConfig.label });
    }
  }

  // ── Reference audio (TTS) ────────────────────────────────────────────
  const ttsRef = avatarConfig.tts as Record<string, unknown> | undefined;
  const ttsOpts = ttsRef?.options as Record<string, unknown> | undefined;
  const refAudioPath = ttsOpts?.referenceAudioPath as string | undefined;
  if (refAudioPath) {
    const diskPath = resolveDataPath(refAudioPath, 'voices');
    const zipPath = addFileToZip(zip, diskPath, 'voices');
    if (zipPath && ttsOpts) {
      ttsOpts.referenceAudioPath = zipPath;
    }
  }

  // Write manifest with zip-relative paths
  const manifest: Manifest = { version: 1, avatar: avatarConfig };
  if (animConfigs.length > 0) {
    manifest.animations = animConfigs;
  }
  zip.file('manifest.json', JSON.stringify(manifest, null, 2));

  return zip.generateAsync({ type: 'arraybuffer' });
}

/**
 * Import an avatar from a ZIP archive.
 * Extracts assets to /data, rewrites manifest paths to server paths, merges into config.
 */
export async function importAvatar(zipBuffer: ArrayBuffer): Promise<{ avatarId: string; conflicts: string[] }> {
  const zip = await JSZip.loadAsync(zipBuffer);

  const manifestFile = zip.file('manifest.json');
  if (!manifestFile) {
    throw new Error('Invalid archive: missing manifest.json');
  }
  const manifest = JSON.parse(await manifestFile.async('string')) as Manifest;
  if (manifest.version !== 1) {
    throw new Error(`Unsupported manifest version: ${manifest.version}`);
  }

  const avatarConfig = manifest.avatar as Record<string, unknown>;
  const originalId = avatarConfig.id as string;
  const conflicts: string[] = [];

  // Check for ID conflict
  const store = getConfigStore();
  let avatarId = originalId;
  if (store.avatars.some((a) => a.id === avatarId)) {
    avatarId = `${originalId}_imported_${Date.now()}`;
    conflicts.push(`Avatar ID "${originalId}" already exists, renamed to "${avatarId}"`);
    avatarConfig.id = avatarId;
  }

  // ── Extract models & rewrite outfit paths ──────────────────────────────
  const outfits = avatarConfig.outfits as Array<Record<string, unknown>> | undefined;
  if (outfits) {
    for (const outfit of outfits) {
      const zipPath = outfit.modelPath as string | undefined;
      if (!zipPath) {
        continue;
      }
      const zipEntry = zip.file(zipPath);
      if (zipEntry) {
        const data = await zipEntry.async('arraybuffer');
        const fileName = basename(zipPath);
        const blob = new File([data], fileName, { type: 'model/gltf-binary' });
        const result = await saveFile('models', blob, ['.vrm']);
        outfit.modelPath = result.url;
      }
    }
  }

  // ── Extract animations ────────────────────────────────────────────────
  const animFolder = zip.folder('animations');
  if (animFolder) {
    const entries: Array<{ name: string; file: JSZip.JSZipObject }> = [];
    animFolder.forEach((relativePath, file) => {
      if (!file.dir) {
        entries.push({ name: relativePath, file });
      }
    });
    for (const { name, file } of entries) {
      const data = await file.async('arraybuffer');
      const blob = new File([data], basename(name), { type: 'application/octet-stream' });
      await saveFile('animations', blob, ['.vrma']);
    }
  }

  // ── Extract voices & rewrite referenceAudioPath ────────────────────────
  const ttsRef = avatarConfig.tts as Record<string, unknown> | undefined;
  const ttsOpts = ttsRef?.options as Record<string, unknown> | undefined;
  const refAudioZipPath = ttsOpts?.referenceAudioPath as string | undefined;
  if (refAudioZipPath) {
    const zipEntry = zip.file(refAudioZipPath);
    if (zipEntry && ttsOpts) {
      const data = await zipEntry.async('arraybuffer');
      const fileName = basename(refAudioZipPath);
      const blob = new File([data], fileName, { type: 'audio/wav' });
      const result = await saveFile('voices', blob, ['.wav', '.mp3', '.ogg', '.flac']);
      ttsOpts.referenceAudioPath = result.url;
    }
  }

  // ── Merge into config ─────────────────────────────────────────────────
  try {
    const raw = readFileSync(configPath, 'utf-8');
    const config = JSON.parse(stripJsonComments(raw));

    // Merge animation configs (skip duplicates)
    if (manifest.animations && manifest.animations.length > 0) {
      const existing = config.animations ?? [];
      const existingIds = new Set(existing.map((a: { id: string }) => a.id));
      for (const anim of manifest.animations) {
        if (!existingIds.has(anim.id)) {
          existing.push(anim);
        }
      }
      config.animations = existing;
    }

    // Add the avatar
    const avatars = config.avatars ?? [];
    avatars.push(avatarConfig);
    config.avatars = avatars;

    if (!validateConfig(config)) {
      logger.warn('[avatar-archive] Imported avatar config fails validation, adding anyway');
    }

    writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
    reloadConfig();
  } catch (err) {
    throw new Error(`Failed to merge avatar into config: ${err}`);
  }

  return { avatarId, conflicts };
}
