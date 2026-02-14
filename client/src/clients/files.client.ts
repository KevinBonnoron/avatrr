import type { FileEntry, UploadResult } from '@avatrr/shared';
import { universalClient, withFetchDelegate, withMethods } from 'universal-client';
import { config } from '@/lib/config';

const baseURL = config.server.url;

async function uploadFile(path: string, file: File): Promise<UploadResult> {
  const form = new FormData();
  form.append('file', file);
  const res = await fetch(`${baseURL}${path}`, { method: 'POST', body: form });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((body as { error?: string }).error ?? res.statusText);
  }
  return res.json() as Promise<UploadResult>;
}

export const filesClient = universalClient(
  withFetchDelegate({ baseURL }),
  withMethods(({ delegate }) => ({
    uploadModel: (file: File) => uploadFile('/files/upload/models', file),
    uploadAnimation: (file: File) => uploadFile('/files/upload/animations', file),
    uploadScene: (file: File) => uploadFile('/files/upload/scenes', file),
    listModels: () => delegate.get<FileEntry[]>('/files/models'),
    listAnimations: () => delegate.get<FileEntry[]>('/files/animations'),
    listScenes: () => delegate.get<FileEntry[]>('/files/scenes'),
  })),
);
