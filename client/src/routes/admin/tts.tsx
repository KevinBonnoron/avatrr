import type { ConfigTtsEntry } from '@avatrr/shared';
import { createFileRoute } from '@tanstack/react-router';
import { CircleCheck, CircleX, Loader2, Pencil, PlugZap, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ttsClient } from '@/clients/tts.client';
import { ConfirmDeleteDialog } from '@/components/dialogs/confirm-delete-dialog';
import { TtsEditDialog } from '@/components/tts/tts-edit-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useConfig, useUpdateConfig } from '@/hooks/useConfig';
import { ttsTypeColors } from '@/lib/colors';

export const Route = createFileRoute('/admin/tts')({
  component: TtsPage,
});

type TestResult = { ok: boolean; message?: string } | null;

function TtsPage() {
  const { t } = useTranslation();
  const { data: config, isLoading } = useConfig();
  const updateConfig = useUpdateConfig();
  const [testResults, setTestResults] = useState<Record<string, TestResult>>({});
  const [testing, setTesting] = useState<Record<string, boolean>>({});

  if (isLoading || !config) {
    return <div className="text-zinc-400">{t('admin.loading')}</div>;
  }

  const ttsList = config.tts ?? [];

  function save(entries: ConfigTtsEntry[]) {
    updateConfig.mutate({ ...config, tts: entries });
  }

  function handleSave(entry: ConfigTtsEntry, index?: number) {
    const next = [...ttsList];
    if (index != null) {
      next[index] = entry;
    } else {
      next.push(entry);
    }
    save(next);
  }

  function handleDelete(index: number) {
    save(ttsList.filter((_, i) => i !== index));
  }

  async function handleTest(entry: ConfigTtsEntry) {
    setTesting((prev) => ({ ...prev, [entry.name]: true }));
    setTestResults((prev) => ({ ...prev, [entry.name]: null }));
    try {
      const result = await ttsClient.testTts(entry as unknown as Record<string, unknown>);
      setTestResults((prev) => ({ ...prev, [entry.name]: result }));
    } catch (err) {
      setTestResults((prev) => ({ ...prev, [entry.name]: { ok: false, message: err instanceof Error ? err.message : String(err) } }));
    } finally {
      setTesting((prev) => ({ ...prev, [entry.name]: false }));
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-white">{t('admin.tts.title')}</h2>
        <TtsEditDialog onSave={(entry) => handleSave(entry)} isPending={updateConfig.isPending}>
          <Button size="sm">
            <Plus className="size-4" />
            {t('admin.add')}
          </Button>
        </TtsEditDialog>
      </div>

      {ttsList.length === 0 && <p className="text-sm text-zinc-500">{t('admin.tts.empty')}</p>}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {ttsList.map((entry, i) => {
          const result = testResults[entry.name];
          const isTesting = testing[entry.name];
          const entryModel = (entry.options as { model?: string } | undefined)?.model;
          return (
            <Card key={entry.name} className="py-4">
              <CardHeader>
                <CardTitle>{entry.name}</CardTitle>
                <CardDescription className="flex flex-wrap gap-1.5">
                  <Badge className={ttsTypeColors[entry.type]}>{entry.type}</Badge>
                </CardDescription>
                <CardAction className="flex gap-1">
                  <Button variant="ghost" size="icon-sm" onClick={() => handleTest(entry)} disabled={isTesting}>
                    {isTesting ? <Loader2 className="size-4 animate-spin" /> : <PlugZap className="size-4" />}
                  </Button>
                  <TtsEditDialog entry={entry} onSave={(updated) => handleSave(updated, i)} isPending={updateConfig.isPending}>
                    <Button variant="ghost" size="icon-sm">
                      <Pencil className="size-4" />
                    </Button>
                  </TtsEditDialog>
                  <ConfirmDeleteDialog description={t('admin.tts.deleteWarning', { name: entry.name })} onConfirm={() => handleDelete(i)}>
                    <Button variant="ghost" size="icon-sm" className="hover:text-red-400">
                      <Trash2 className="size-4" />
                    </Button>
                  </ConfirmDeleteDialog>
                </CardAction>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-zinc-400">
                  {entryModel && <span>Model: {entryModel}</span>}
                  {entry.options?.voice && <span>Voice: {entry.options.voice}</span>}
                </div>
                {result && (
                  <div className={`mt-2 flex items-center gap-1.5 text-xs ${result.ok ? 'text-emerald-400' : 'text-red-400'}`}>
                    {result.ok ? <CircleCheck className="size-3.5" /> : <CircleX className="size-3.5" />}
                    <span>{result.message}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
