import { existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const DATA_DIR = resolve(process.env.DATA_DIR || './data');

const SUBDIRS = ['models', 'animations', 'scenes', 'voices'] as const;

export type FileSubdir = (typeof SUBDIRS)[number];

export function ensureDataDirs(): void {
  for (const sub of SUBDIRS) {
    const dir = resolve(DATA_DIR, sub);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
  }
}

export async function saveFile(subdir: FileSubdir, file: File, ext: string | string[]): Promise<{ filename: string; url: string }> {
  const exts = Array.isArray(ext) ? ext : [ext];
  if (!exts.some((e) => file.name.toLowerCase().endsWith(e))) {
    throw new Error(`Only ${exts.join(', ')} files are allowed`);
  }

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const dest = resolve(DATA_DIR, subdir, safeName);
  const buffer = await file.arrayBuffer();
  writeFileSync(dest, Buffer.from(buffer));

  return { filename: safeName, url: `/data/${subdir}/${safeName}` };
}

export function listFiles(subdir: FileSubdir, ext: string | string[]): { name: string; url: string; size: number }[] {
  const exts = Array.isArray(ext) ? ext : [ext];
  const dir = resolve(DATA_DIR, subdir);
  if (!existsSync(dir)) {
    return [];
  }
  const results: { name: string; url: string; size: number }[] = [];
  function walk(current: string, prefix: string) {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        walk(resolve(current, entry.name), rel);
      } else if (exts.some((e) => entry.name.toLowerCase().endsWith(e))) {
        const stat = statSync(resolve(current, entry.name));
        results.push({ name: rel, url: `/data/${subdir}/${rel}`, size: stat.size });
      }
    }
  }
  walk(dir, '');
  return results;
}
