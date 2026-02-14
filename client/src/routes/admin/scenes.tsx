import type { SceneConfig } from '@avatrr/shared';
import { createFileRoute } from '@tanstack/react-router';
import { Pencil, Plus, Trash2, Upload } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ConfirmDeleteDialog } from '@/components/dialogs/confirm-delete-dialog';
import { SceneEditDialog } from '@/components/scenes/scene-edit-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useConfig, useUpdateConfig } from '@/hooks/useConfig';
import { useSceneFiles, useUploadScene } from '@/hooks/useFiles';

export const Route = createFileRoute('/admin/scenes')({
  component: ScenesPage,
});

function ScenesPage() {
  const { t } = useTranslation();
  const { data: config, isLoading } = useConfig();
  const updateConfig = useUpdateConfig();
  const { data: files = [] } = useSceneFiles();
  const uploadScene = useUploadScene();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadTriggerRef = useRef<HTMLButtonElement>(null);
  const [uploadEntry, setUploadEntry] = useState<SceneConfig | null>(null);

  useEffect(() => {
    if (uploadEntry) {
      uploadTriggerRef.current?.click();
    }
  }, [uploadEntry]);

  if (isLoading || !config) {
    return <div className="text-zinc-400">{t('admin.loading')}</div>;
  }

  const sceneList = config.scenes ?? [];

  function save(entries: SceneConfig[]) {
    updateConfig.mutate({ ...config, scenes: entries });
  }

  function handleSave(entry: SceneConfig, index?: number) {
    const next = [...sceneList];
    if (index != null) {
      next[index] = entry;
    } else {
      next.push(entry);
    }
    save(next);
  }

  function handleDelete(index: number) {
    save(sceneList.filter((_, i) => i !== index));
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) {
      return;
    }
    const result = await uploadScene.mutateAsync(file);
    const name = file.name.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9_-]/g, '_');
    const isHdri = /\.(hdr|exr)$/i.test(file.name);
    setUploadEntry({ id: name, name, type: isHdri ? 'hdri' : '2d', path: result.url });
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-white">{t('admin.scenes.title')}</h2>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" asChild>
            <label className="cursor-pointer">
              <Upload className="size-4" />
              {t('admin.scenes.upload')}
              <input ref={fileInputRef} type="file" accept=".jpg,.jpeg,.png,.webp,.hdr,.exr" className="hidden" onChange={handleUpload} />
            </label>
          </Button>
          <SceneEditDialog onSave={(entry) => handleSave(entry)} isPending={updateConfig.isPending}>
            <Button size="sm">
              <Plus className="size-4" />
              {t('admin.add')}
            </Button>
          </SceneEditDialog>
        </div>
      </div>

      {uploadScene.isPending && <p className="text-sm text-zinc-400">{t('admin.uploading')}</p>}

      {sceneList.length === 0 && <p className="text-sm text-zinc-500">{t('admin.scenes.empty')}</p>}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {sceneList.map((entry, i) => (
          <Card key={entry.id} className="py-4">
            <CardHeader>
              <CardTitle>{entry.name}</CardTitle>
              <CardAction className="flex gap-1">
                <SceneEditDialog entry={entry} onSave={(updated) => handleSave(updated, i)} isPending={updateConfig.isPending}>
                  <Button variant="ghost" size="icon-sm">
                    <Pencil className="size-4" />
                  </Button>
                </SceneEditDialog>
                <ConfirmDeleteDialog description={t('admin.scenes.deleteWarning', { name: entry.name })} onConfirm={() => handleDelete(i)}>
                  <Button variant="ghost" size="icon-sm" className="hover:text-red-400">
                    <Trash2 className="size-4" />
                  </Button>
                </ConfirmDeleteDialog>
              </CardAction>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-400">
                <span>{entry.type === 'hdri' ? 'HDRI' : '2D'} — {entry.path}</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Uploaded files */}
      {files.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-medium text-zinc-300">{t('admin.scenes.uploadedFiles')}</h3>
          <div className="grid gap-1">
            {files.map((f) => (
              <div key={f.name} className="flex items-center justify-between rounded-md bg-zinc-800/40 px-3 py-1.5 text-xs text-zinc-400">
                <span>{f.name}</span>
                <span>{(f.size / 1024).toFixed(0)} KB</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Hidden trigger for upload-initiated create dialog */}
      <SceneEditDialog
        entry={uploadEntry ?? undefined}
        onSave={(entry) => {
          handleSave(entry);
          setUploadEntry(null);
        }}
        isPending={updateConfig.isPending}
      >
        <button type="button" ref={uploadTriggerRef} className="hidden" aria-hidden />
      </SceneEditDialog>
    </div>
  );
}
