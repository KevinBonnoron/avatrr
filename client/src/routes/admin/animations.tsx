import { createFileRoute } from '@tanstack/react-router';
import { Pencil, Plus, Trash2, Upload } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AnimationEditDialog, type AnimationEntry } from '@/components/animations/animation-edit-dialog';
import { ConfirmDeleteDialog } from '@/components/dialogs/confirm-delete-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useConfig, useUpdateConfig } from '@/hooks/useConfig';
import { useAnimationFiles, useUploadAnimation } from '@/hooks/useFiles';

export const Route = createFileRoute('/admin/animations')({
  component: AnimationsPage,
});

function AnimationsPage() {
  const { t } = useTranslation();
  const { data: config, isLoading } = useConfig();
  const updateConfig = useUpdateConfig();
  const { data: files = [] } = useAnimationFiles();
  const uploadAnimation = useUploadAnimation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadTriggerRef = useRef<HTMLButtonElement>(null);
  const [uploadEntry, setUploadEntry] = useState<AnimationEntry | null>(null);

  useEffect(() => {
    if (uploadEntry) {
      uploadTriggerRef.current?.click();
    }
  }, [uploadEntry]);

  if (isLoading || !config) {
    return <div className="text-zinc-400">{t('admin.loading')}</div>;
  }

  const animationList = config.animations ?? [];

  function save(entries: AnimationEntry[]) {
    updateConfig.mutate({ ...config, animations: entries });
  }

  function handleSave(entry: AnimationEntry, index?: number) {
    const next = [...animationList];
    if (index != null) {
      next[index] = entry;
    } else {
      next.push(entry);
    }
    save(next);
  }

  function handleDelete(index: number) {
    save(animationList.filter((_, i) => i !== index));
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) {
      return;
    }
    const result = await uploadAnimation.mutateAsync(file);
    const id = file.name.replace(/\.vrma$/, '').replace(/[^a-zA-Z0-9_-]/g, '_');
    setUploadEntry({ id, label: id, url: result.url });
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-white">{t('admin.animations.title')}</h2>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" asChild>
            <label className="cursor-pointer">
              <Upload className="size-4" />
              {t('admin.animations.upload')}
              <input ref={fileInputRef} type="file" accept=".vrma" className="hidden" onChange={handleUpload} />
            </label>
          </Button>
          <AnimationEditDialog onSave={(entry) => handleSave(entry)} isPending={updateConfig.isPending}>
            <Button size="sm">
              <Plus className="size-4" />
              {t('admin.add')}
            </Button>
          </AnimationEditDialog>
        </div>
      </div>

      {uploadAnimation.isPending && <p className="text-sm text-zinc-400">{t('admin.uploading')}</p>}

      {animationList.length === 0 && <p className="text-sm text-zinc-500">{t('admin.animations.empty')}</p>}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {animationList.map((entry, i) => (
          <Card key={entry.id} className="py-4">
            <CardHeader>
              <CardTitle>{entry.label}</CardTitle>
              <CardAction className="flex gap-1">
                <AnimationEditDialog entry={entry} onSave={(updated) => handleSave(updated, i)} isPending={updateConfig.isPending}>
                  <Button variant="ghost" size="icon-sm">
                    <Pencil className="size-4" />
                  </Button>
                </AnimationEditDialog>
                <ConfirmDeleteDialog description={t('admin.animations.deleteWarning', { name: entry.label })} onConfirm={() => handleDelete(i)}>
                  <Button variant="ghost" size="icon-sm" className="hover:text-red-400">
                    <Trash2 className="size-4" />
                  </Button>
                </ConfirmDeleteDialog>
              </CardAction>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-400">
                <span>ID: {entry.id}</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Uploaded files */}
      {files.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-medium text-zinc-300">{t('admin.animations.uploadedFiles')}</h3>
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
      <AnimationEditDialog
        entry={uploadEntry ?? undefined}
        onSave={(entry) => {
          handleSave(entry);
          setUploadEntry(null);
        }}
        isPending={updateConfig.isPending}
      >
        <button type="button" ref={uploadTriggerRef} className="hidden" aria-hidden />
      </AnimationEditDialog>
    </div>
  );
}
