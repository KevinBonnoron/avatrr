import { createFileRoute } from '@tanstack/react-router';
import { Bot, ChevronDown, MessageSquare, Pencil, Trash2, User } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MessageEditDialog } from '@/components/conversations/message-edit-dialog';
import { ConfirmDeleteDialog } from '@/components/dialogs/confirm-delete-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useConfig } from '@/hooks/useConfig';
import { useConversation, useConversations, useDeleteAllConversationsMutation, useDeleteConversationMutation, useUpdateMessageMutation } from '@/hooks/useConversations';
import { chipColors, hashString } from '@/lib/colors';

export const Route = createFileRoute('/admin/conversations')({
  component: ConversationsPage,
});

function ConversationsPage() {
  const { t } = useTranslation();
  const { data: conversations = [], isLoading } = useConversations();
  const { data: config } = useConfig();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filterAvatarId, setFilterAvatarId] = useState<string | null>(null);
  const deleteConversation = useDeleteConversationMutation();
  const deleteAllConversations = useDeleteAllConversationsMutation();

  const avatars = config?.avatars ?? [];
  const avatarNames = useMemo(() => Object.fromEntries(avatars.map((a) => [a.id, a.name])), [avatars]);

  const filtered = filterAvatarId ? conversations.filter((c) => c.avatarId === filterAvatarId) : conversations;

  function formatTime(ts: number) {
    return new Date(ts).toLocaleString();
  }

  if (isLoading) {
    return <div className="text-zinc-400">{t('admin.loading')}</div>;
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold text-white">{t('admin.conversations.title')}</h2>

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

      {filtered.length === 0 && <p className="text-sm text-zinc-500">{t('admin.conversations.empty')}</p>}

      {filtered.length > 0 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-zinc-400">
            {filtered.length} {t('admin.conversations.messages')}
          </p>
          {filterAvatarId && (
            <ConfirmDeleteDialog description={t('admin.conversations.deleteAllWarning')} onConfirm={() => deleteAllConversations.mutate()}>
              <Button variant="destructive" size="sm">
                <Trash2 className="size-4" />
                {t('admin.conversations.deleteAll')}
              </Button>
            </ConfirmDeleteDialog>
          )}
        </div>
      )}

      <div className="grid gap-2">
        {filtered.map((conv) => (
          <ConversationCard
            key={conv.id}
            conv={conv}
            expanded={expandedId === conv.id}
            onToggle={() => setExpandedId(expandedId === conv.id ? null : conv.id)}
            onDelete={() => {
              deleteConversation.mutate(conv.id);
              if (expandedId === conv.id) {
                setExpandedId(null);
              }
            }}
            avatarName={conv.avatarId ? avatarNames[conv.avatarId] : undefined}
            formatTime={formatTime}
            t={t}
          />
        ))}
      </div>
    </div>
  );
}

function ConversationCard({
  conv,
  expanded,
  onToggle,
  onDelete,
  avatarName,
  formatTime,
  t,
}: {
  conv: { id: string; avatarId: string | null; messageCount: number; lastUsed: number };
  expanded: boolean;
  onToggle: () => void;
  onDelete: () => void;
  avatarName?: string;
  formatTime: (ts: number) => string;
  t: (key: string) => string;
}) {
  const { data: messages } = useConversation(expanded ? conv.id : null);
  const updateMessage = useUpdateMessageMutation();

  return (
    <Card className={`transition-colors ${expanded ? 'border-zinc-600' : 'hover:border-zinc-600'}`}>
      <CardHeader className="cursor-pointer" onClick={onToggle}>
        <div className="flex items-center gap-2">
          <MessageSquare className="size-4 text-zinc-400" />
          <CardTitle className="font-mono text-xs">{conv.id.slice(0, 8)}...</CardTitle>
          <Badge>{conv.messageCount} msgs</Badge>
          {conv.avatarId && avatarName && (
            <Badge className={chipColors[hashString(conv.avatarId) % chipColors.length].selected}>{avatarName}</Badge>
          )}
          <span className="text-xs text-zinc-500">{formatTime(conv.lastUsed)}</span>
        </div>
        <CardAction className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <ConfirmDeleteDialog description={t('admin.conversations.deleteWarning')} onConfirm={onDelete}>
            <Button variant="ghost" size="icon-sm" className="hover:text-red-400">
              <Trash2 className="size-4" />
            </Button>
          </ConfirmDeleteDialog>
          <button type="button" onClick={onToggle}>
            <ChevronDown className={`size-4 text-zinc-400 transition-transform ${expanded ? 'rotate-180' : ''}`} />
          </button>
        </CardAction>
      </CardHeader>
      {expanded && (
        <CardContent>
          {!messages ? (
            <div className="text-sm text-zinc-400">{t('admin.loading')}</div>
          ) : (
            <div className="space-y-2">
              {messages.map((msg, i) => {
                const text = msg.content ?? msg.parts?.map((p) => p.type === 'text' ? p.content : '').join('') ?? '';
                return (
                  <div key={`${i}-${msg.role}`} className={`group flex gap-3 rounded-lg p-3 ${msg.role === 'user' ? 'bg-zinc-800/60' : msg.role === 'assistant' ? 'bg-zinc-800/30' : 'bg-zinc-900/50'}`}>
                    <div className="mt-0.5 shrink-0">{msg.role === 'user' ? <User className="size-4 text-blue-400" /> : msg.role === 'assistant' ? <Bot className="size-4 text-emerald-400" /> : <Badge variant="warning">{msg.role}</Badge>}</div>
                    <div className="min-w-0 flex-1">
                      <span className="text-xs font-medium text-zinc-400">{msg.role}</span>
                      <p className="mt-0.5 text-sm text-zinc-200 whitespace-pre-wrap break-words">{text}</p>
                    </div>
                    <MessageEditDialog text={text} onSave={(newText) => updateMessage.mutate({ messageId: msg.id, text: newText })} isPending={updateMessage.isPending}>
                      <Button variant="ghost" size="icon-sm" className="self-start shrink-0 opacity-0 transition-opacity group-hover:opacity-100">
                        <Pencil className="size-3.5" />
                      </Button>
                    </MessageEditDialog>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}
