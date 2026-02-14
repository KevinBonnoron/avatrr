import { useTranslation } from 'react-i18next';
import type { HistoryMessage } from '@/lib/message';
import { getMessageText } from '@/lib/message';

interface Props {
  messages: HistoryMessage[];
}

export function HistorySheetContent({ messages }: Props) {
  const { t } = useTranslation();
  const displayMessages = messages.filter((m) => m.role === 'user' || m.role === 'assistant');

  if (displayMessages.length === 0) {
    return <p className="text-sm text-zinc-500 italic">{t('chat.historyEmpty')}</p>;
  }

  return (
    <div className="space-y-3">
      {displayMessages.map((msg, index) => {
        const text = getMessageText(msg);
        if (!text.trim()) {
          return null;
        }
        const isUser = msg.role === 'user';
        return (
          <div key={`${msg.role}-${index}-${text.slice(0, 40)}`} className={`rounded-lg px-3 py-2 ${isUser ? 'bg-primary/20 border border-primary/30' : 'bg-zinc-800 border border-zinc-700'}`}>
            <p className="text-xs font-medium text-zinc-400 mb-1">{isUser ? t('chat.historyYou') : t('chat.historyAssistant')}</p>
            <p className="text-sm text-zinc-100 whitespace-pre-wrap break-words">{text}</p>
          </div>
        );
      })}
    </div>
  );
}
