import { createFileRoute } from '@tanstack/react-router';
import { Bot, ChevronDown, Pencil, Trash2, User } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ConfirmDeleteDialog } from '@/components/dialogs/confirm-delete-dialog';
import { MemoryEditDialog } from '@/components/memories/memory-edit-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardHeader } from '@/components/ui/card';
import { useConfig, useUpdateConfig } from '@/hooks/useConfig';
import { useAllMemories, useDeleteAllMemories, useDeleteMemory, useMemoryStatus, useUpdateMemory } from '@/hooks/useMemories';
import { chipColors, hashString } from '@/lib/colors';

export const Route = createFileRoute('/admin/memory')({
  component: MemoryPage,
});

function MemoryPage() {
  const { t } = useTranslation();
  const { data: memoryStatus, isLoading: statusLoading } = useMemoryStatus();
  const { data: config, isLoading: configLoading } = useConfig();
  const updateConfig = useUpdateConfig();
  const [filterAvatarId, setFilterAvatarId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const { data: allMemories = [], isLoading: memoriesLoading } = useAllMemories();
  const deleteMemory = useDeleteMemory();
  const deleteAllMemories = useDeleteAllMemories();
  const updateMemory = useUpdateMemory();
  const avatars = config?.avatars ?? [];
  const avatarNames = useMemo(() => Object.fromEntries(avatars.map((a) => [a.id, a.name])), [avatars]);

  if (statusLoading || configLoading || !config) {
    return <div className="text-zinc-400">{t('admin.loading')}</div>;
  }

  const memoryEnabled = memoryStatus?.enabled ?? false;

  function handleEnableMemory() {
    if (!config) {
      return;
    }
    updateConfig.mutate({ ...config, memory: config.memory ?? {} });
  }

  function handleDisableMemory() {
    if (!config) {
      return;
    }
    const { memory: _, ...rest } = config;
    updateConfig.mutate(rest);
  }

  const memories = filterAvatarId ? allMemories.filter((m) => m.avatarId === filterAvatarId) : allMemories;

  function parseMemory(text: string): { user: string; assistant: string } | null {
    const match = text.match(/^User:\s*([\s\S]*?)\nAssistant:\s*([\s\S]*)$/);
    if (!match) {
      return null;
    }

    return { user: match[1].trim(), assistant: match[2].trim() };
  }

  function formatDate(ts: number) {
    return new Date(ts * 1000).toLocaleString();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-white">{t('admin.memory.title')}</h2>
        {!memoryEnabled ? (
          <Button size="sm" onClick={handleEnableMemory} disabled={updateConfig.isPending}>
            {t('admin.memory.enable')}
          </Button>
        ) : (
          <Button variant="outline" size="sm" onClick={handleDisableMemory} disabled={updateConfig.isPending}>
            {t('admin.memory.disable')}
          </Button>
        )}
      </div>

      {!memoryEnabled && <p className="text-sm text-zinc-500">{t('admin.memory.disabled')}</p>}

      {memoryEnabled && (
        <>
          {avatars.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {avatars.map((a) => {
                const color = chipColors[hashString(a.id) % chipColors.length];
                return (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => setFilterAvatarId(filterAvatarId === a.id ? null : a.id)}
                    className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${filterAvatarId === a.id ? color.selected : color.idle}`}
                  >
                    {a.name}
                  </button>
                );
              })}
            </div>
          )}

          {memoriesLoading && <div className="text-zinc-400">{t('admin.loading')}</div>}
          {!memoriesLoading && memories.length === 0 && <p className="text-sm text-zinc-500">{t('admin.memory.empty')}</p>}
          {!memoriesLoading && memories.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm text-zinc-400">
                  {memories.length} {t('admin.memory.count')}
                </p>
                {filterAvatarId && (
                  <ConfirmDeleteDialog description={t('admin.memory.deleteAllWarning')} onConfirm={() => deleteAllMemories.mutate(filterAvatarId)}>
                    <Button variant="destructive" size="sm">
                      <Trash2 className="size-4" />
                      {t('admin.memory.deleteAll')}
                    </Button>
                  </ConfirmDeleteDialog>
                )}
              </div>
              <div className="grid gap-2">
                {memories.map((mem) => {
                  const parsed = parseMemory(mem.text);
                  const avatarName = avatarNames[mem.avatarId];
                  const expanded = expandedId === mem.id;
                  const preview = parsed ? parsed.user : mem.text;
                  return (
                    <Card key={mem.id} className={`transition-colors ${expanded ? 'border-zinc-600' : 'hover:border-zinc-600'}`}>
                      <CardHeader className="cursor-pointer" onClick={() => setExpandedId(expanded ? null : mem.id)}>
                        <div className="flex items-center gap-2 min-w-0">
                          <Badge>{formatDate(mem.createdAt)}</Badge>
                          {avatarName && !filterAvatarId && (
                            <Badge className={chipColors[hashString(mem.avatarId) % chipColors.length].selected}>{avatarName}</Badge>
                          )}
                          {!expanded && (
                            <span className="text-sm text-zinc-500 truncate">{preview}</span>
                          )}
                        </div>
                        <CardAction className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                          <MemoryEditDialog text={mem.text} onSave={(text) => updateMemory.mutate({ id: mem.id, text })} isPending={updateMemory.isPending}>
                            <Button variant="ghost" size="icon-sm">
                              <Pencil className="size-4" />
                            </Button>
                          </MemoryEditDialog>
                          <ConfirmDeleteDialog description={t('admin.memory.deleteWarning')} onConfirm={() => deleteMemory.mutate(mem.id)}>
                            <Button variant="ghost" size="icon-sm" className="hover:text-red-400">
                              <Trash2 className="size-4" />
                            </Button>
                          </ConfirmDeleteDialog>
                          <button type="button" onClick={() => setExpandedId(expanded ? null : mem.id)}>
                            <ChevronDown className={`size-4 text-zinc-400 transition-transform ${expanded ? 'rotate-180' : ''}`} />
                          </button>
                        </CardAction>
                      </CardHeader>
                      {expanded && (
                        <CardContent>
                          {parsed ? (
                            <div className="space-y-2">
                              <div className="flex gap-2">
                                <User className="size-4 text-blue-400 shrink-0 mt-0.5" />
                                <p className="text-sm text-zinc-300 whitespace-pre-wrap break-words">{parsed.user}</p>
                              </div>
                              <div className="flex gap-2">
                                <Bot className="size-4 text-emerald-400 shrink-0 mt-0.5" />
                                <p className="text-sm text-zinc-400 whitespace-pre-wrap break-words">{parsed.assistant}</p>
                              </div>
                            </div>
                          ) : (
                            <p className="text-sm text-zinc-300 whitespace-pre-wrap break-words">{mem.text}</p>
                          )}
                        </CardContent>
                      )}
                    </Card>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
