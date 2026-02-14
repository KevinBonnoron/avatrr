import { createFileRoute } from '@tanstack/react-router';
import { Download, Pencil, Plus, Trash2, Upload } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AvatarEditDialog, type AvatarEntry } from '@/components/avatars/avatar-edit-dialog';
import { ConfirmDeleteDialog } from '@/components/dialogs/confirm-delete-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useConfig, useUpdateConfig } from '@/hooks/useConfig';
import { useModels, useUploadModel } from '@/hooks/useFiles';
import { llmTypeColors, ttsTypeColors } from '@/lib/colors';
import { config as appConfig } from '@/lib/config';

export const Route = createFileRoute('/admin/avatars')({
  component: AvatarsPage,
});

function AvatarsPage() {
  const { t } = useTranslation();
  const { data: config, isLoading } = useConfig();
  const updateConfig = useUpdateConfig();
  const { data: modelFiles = [] } = useModels();
  const uploadModel = useUploadModel();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const importInputRef = useRef<HTMLInputElement>(null);
  const uploadTriggerRef = useRef<HTMLButtonElement>(null);
  const [uploadEntry, setUploadEntry] = useState<AvatarEntry | null>(null);
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    if (uploadEntry) {
      uploadTriggerRef.current?.click();
    }
  }, [uploadEntry]);

  if (isLoading || !config) {
    return <div className="text-zinc-400">{t('admin.loading')}</div>;
  }

  const { avatars: avatarList = [], llm = [], tts = [], animations: animationList = [], scenes = [] } = config;
  const llmNames = llm.map(({ name }) => name);
  const ttsNames = tts.map(({ name }) => name);
  const llmByName = Object.fromEntries(llm.map((l) => [l.name, l]));
  const ttsByName = Object.fromEntries(tts.map((t) => [t.name, t]));
  const sceneByName = Object.fromEntries(scenes.map((s) => [s.id, s]));

  function save(entries: AvatarEntry[]) {
    updateConfig.mutate({ ...config, avatars: entries });
  }

  function handleSave(entry: AvatarEntry, index?: number) {
    const next = [...avatarList];
    if (index != null) {
      next[index] = entry;
    } else {
      next.push(entry);
    }
    save(next);
  }

  function handleDelete(index: number) {
    save(avatarList.filter((_, i) => i !== index));
  }

  function handleExport(avatarId: string) {
    window.open(`${appConfig.server.url}/avatars/export/${encodeURIComponent(avatarId)}`, '_blank');
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) {
      return;
    }
    setImporting(true);
    try {
      const form = new FormData();
      form.append('file', file);
      await fetch(`${appConfig.server.url}/avatars/import`, { method: 'POST', body: form });
      updateConfig.reset();
      // Refetch config to pick up the newly imported avatar
      window.location.reload();
    } finally {
      setImporting(false);
      if (importInputRef.current) {
        importInputRef.current.value = '';
      }
    }
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) {
      return;
    }
    const result = await uploadModel.mutateAsync(file);
    const name = file.name.replace(/\.vrm$/, '');
    const id = name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_|_$/g, '');
    setUploadEntry({ id, name, outfits: [{ id: 'default', label: 'Default', modelPath: result.url, default: true }] });
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-white">{t('admin.avatars.title')}</h2>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" asChild>
            <label className="cursor-pointer">
              <Upload className="size-4" />
              {t('admin.avatars.import')}
              <input ref={importInputRef} type="file" accept=".zip" className="hidden" onChange={handleImport} />
            </label>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <label className="cursor-pointer">
              <Upload className="size-4" />
              {t('admin.avatars.uploadVrm')}
              <input ref={fileInputRef} type="file" accept=".vrm" className="hidden" onChange={handleUpload} />
            </label>
          </Button>
          <AvatarEditDialog onSave={(entry) => handleSave(entry)} isPending={updateConfig.isPending} llmNames={llmNames} ttsNames={ttsNames} ttsConfigs={ttsByName} animationList={animationList} scenes={scenes}>
            <Button size="sm">
              <Plus className="size-4" />
              {t('admin.add')}
            </Button>
          </AvatarEditDialog>
        </div>
      </div>

      {(uploadModel.isPending || importing) && <p className="text-sm text-zinc-400">{t('admin.uploading')}</p>}

      {avatarList.length === 0 && <p className="text-sm text-zinc-500">{t('admin.avatars.empty')}</p>}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {avatarList.map((avatar, i) => (
          <Card key={avatar.id} className="py-4">
            <CardHeader>
              <CardTitle>{avatar.name}</CardTitle>
              <CardDescription className="flex flex-wrap gap-1.5">
                {avatar.llm && ('ref' in avatar.llm ? <Badge className={llmTypeColors[llmByName[avatar.llm.ref]?.type] ?? ''}>{avatar.llm.ref}</Badge> : null)}
                {avatar.tts?.ref && <Badge className={ttsTypeColors[ttsByName[avatar.tts.ref]?.type] ?? ''}>{avatar.tts.ref}</Badge>}
                {avatar.scene && sceneByName[avatar.scene] && <Badge>{sceneByName[avatar.scene].name}</Badge>}
              </CardDescription>
              <CardAction className="flex gap-1">
                <Button variant="ghost" size="icon-sm" onClick={() => handleExport(avatar.id)} title={t('admin.avatars.export')}>
                  <Download className="size-4" />
                </Button>
                <AvatarEditDialog entry={avatar} onSave={(updated) => handleSave(updated, i)} isPending={updateConfig.isPending} llmNames={llmNames} ttsNames={ttsNames} ttsConfigs={ttsByName} animationList={animationList} scenes={scenes}>
                  <Button variant="ghost" size="icon-sm">
                    <Pencil className="size-4" />
                  </Button>
                </AvatarEditDialog>
                <ConfirmDeleteDialog description={t('admin.avatars.deleteWarning', { name: avatar.name })} onConfirm={() => handleDelete(i)}>
                  <Button variant="ghost" size="icon-sm" className="hover:text-red-400">
                    <Trash2 className="size-4" />
                  </Button>
                </ConfirmDeleteDialog>
              </CardAction>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-400">
                <span>ID: {avatar.id}</span>
                <span>
                  {t('admin.avatars.outfits')}: {avatar.outfits?.length ?? 0}
                </span>
                {avatar.animations?.available && <span>Animations: {avatar.animations.available.length}</span>}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Uploaded model files */}
      {modelFiles.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-medium text-zinc-300">{t('admin.avatars.uploadedFiles')}</h3>
          <div className="grid gap-1">
            {modelFiles.map((f) => (
              <div key={f.name} className="flex items-center justify-between rounded-md bg-zinc-800/40 px-3 py-1.5 text-xs text-zinc-400">
                <span>{f.name}</span>
                <span>{(f.size / 1024 / 1024).toFixed(1)} MB</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Hidden trigger for upload-initiated create dialog */}
      <AvatarEditDialog
        entry={uploadEntry ?? undefined}
        onSave={(entry) => {
          handleSave(entry);
          setUploadEntry(null);
        }}
        isPending={updateConfig.isPending}
        llmNames={llmNames}
        ttsNames={ttsNames}
        ttsConfigs={ttsByName}
        animationList={animationList}
        defaultTab="outfits"
      >
        <button type="button" ref={uploadTriggerRef} className="hidden" aria-hidden />
      </AvatarEditDialog>
    </div>
  );
}
