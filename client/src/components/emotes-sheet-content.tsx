import { EXPRESSION_MENU_OPTIONS, type Expression } from '@avatrr/shared';
import { Ban } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { TabBar } from '@/components/ui/tab-bar';
import { useAvatar } from '@/contexts/avatar-context';

const EXPRESSION_EMOJI: Record<Expression, string> = {
  neutral: '\u{1F610}',
  happy: '\u{1F604}',
  sad: '\u{1F622}',
  angry: '\u{1F621}',
  surprised: '\u{1F632}',
  thinking: '\u{1F914}',
};

interface Props {
  onClose: () => void;
}

export function EmotesSheetContent({ onClose }: Props) {
  const { t } = useTranslation();
  const { expression, setExpression, availableAnimations, playingAnimationUrl, setAnimationUrl } = useAvatar();
  const hasAnimations = availableAnimations.length > 0;
  const [activeTab, setActiveTab] = useState<'expression' | 'animation'>('expression');

  const tabs = [{ id: 'expression', label: t('expression.title') }, ...(hasAnimations ? [{ id: 'animation', label: t('animation.title') }] : [])];

  function handleSelectExpression(exp: Expression) {
    setExpression(exp);
    onClose();
  }

  function handleSelectAnimation(url: string | null) {
    setAnimationUrl(url);
    onClose();
  }

  return (
    <div className="flex flex-col gap-3">
      {hasAnimations && <TabBar tabs={tabs} activeId={activeTab} onTabChange={(id) => setActiveTab(id as 'expression' | 'animation')} />}

      {activeTab === 'expression' && (
        <div className="grid grid-cols-3 gap-2">
          {EXPRESSION_MENU_OPTIONS.map((opt) => {
            const active = expression === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => handleSelectExpression(opt.value)}
                className={`flex flex-col items-center gap-1.5 rounded-xl px-2 py-3 text-xs font-medium transition-colors ${active ? 'bg-primary/20 ring-1 ring-primary/50 text-white' : 'bg-zinc-800/60 text-zinc-300 hover:bg-zinc-700/80'}`}
              >
                <span className="text-2xl leading-none">{EXPRESSION_EMOJI[opt.value]}</span>
                <span>{t(opt.key)}</span>
              </button>
            );
          })}
        </div>
      )}

      {activeTab === 'animation' && hasAnimations && (
        <div className="grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={() => handleSelectAnimation(null)}
            className={`flex flex-col items-center gap-1.5 rounded-xl px-2 py-3 text-xs font-medium transition-colors ${playingAnimationUrl === null ? 'bg-primary/20 ring-1 ring-primary/50 text-white' : 'bg-zinc-800/60 text-zinc-300 hover:bg-zinc-700/80'}`}
          >
            <Ban className="size-6 opacity-50" />
            <span>{t('animation.none')}</span>
          </button>
          {availableAnimations.map(({ id, url, label }) => {
            const active = playingAnimationUrl === url;
            return (
              <button key={id} type="button" onClick={() => handleSelectAnimation(url)} className={`flex flex-col items-center gap-1.5 rounded-xl px-2 py-3 text-xs font-medium transition-colors ${active ? 'bg-primary/20 ring-1 ring-primary/50 text-white' : 'bg-zinc-800/60 text-zinc-300 hover:bg-zinc-700/80'}`}>
                <span className="text-2xl leading-none">{'\u{1F3AC}'}</span>
                <span className="truncate max-w-full">{label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
