import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Switch } from '@/components/ui/switch';
import { TabBar } from '@/components/ui/tab-bar';
import { UI_LANG_STORAGE_KEY } from '@/i18n';
import { cn } from '@/lib/utils';

const speechLanguageOptions = [
  { value: 'fr-FR', labelKey: 'settings.speechLangFr' },
  { value: 'en-US', labelKey: 'settings.speechLangEn' },
  { value: 'de-DE', labelKey: 'settings.speechLangDe' },
  { value: 'es-ES', labelKey: 'settings.speechLangEs' },
  { value: 'it-IT', labelKey: 'settings.speechLangIt' },
  { value: 'ja-JP', labelKey: 'settings.speechLangJa' },
] as const;

const uiLanguageOptions = ['fr', 'en'] as const;

const menuItemClasses = (active: boolean) => cn('flex items-center gap-2 w-full rounded-lg px-3 py-2 text-left text-sm transition-colors', active ? 'bg-primary/20 ring-1 ring-primary/50' : 'hover:bg-zinc-800');

function formatTimeOfDay(hours: number): string {
  const h = Math.floor(hours) % 24;
  const m = Math.round((hours % 1) * 60) % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

interface Props {
  showResponseText: boolean;
  setShowResponseText: (show: boolean) => void;
  timeOfDay: number;
  setTimeOfDay: (hours: number) => void;
  useSystemTime: boolean;
  setUseSystemTime: (use: boolean) => void;
  speechLang: string;
  setSpeechLang: (lang: string) => void;
}

export function SettingsSheetContent({ showResponseText, setShowResponseText, timeOfDay, setTimeOfDay, useSystemTime, setUseSystemTime, speechLang, setSpeechLang }: Props) {
  const { t, i18n } = useTranslation();
  const [activeTab, setActiveTab] = useState<'language' | 'display' | 'speech'>('language');

  const tabs = [
    { id: 'language', label: t('settings.tabLanguage') },
    { id: 'display', label: t('settings.tabDisplay') },
    { id: 'speech', label: t('settings.tabSpeech') },
  ];

  function setUiLang(lng: string) {
    i18n.changeLanguage(lng);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(UI_LANG_STORAGE_KEY, lng);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <TabBar tabs={tabs} activeId={activeTab} onTabChange={(id) => setActiveTab(id as 'language' | 'display' | 'speech')} />

      {activeTab === 'language' && (
        <div className="grid gap-1">
          {uiLanguageOptions.map((lng) => (
            <button key={lng} type="button" onClick={() => setUiLang(lng)} className={menuItemClasses(i18n.language === lng)} role="menuitem">
              {t(`languages.${lng}`)}
            </button>
          ))}
        </div>
      )}

      {activeTab === 'display' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-4 rounded-lg px-3 py-2.5 text-sm">
            <span className="text-zinc-100">{t('settings.responseText')}</span>
            <Switch checked={showResponseText} onCheckedChange={setShowResponseText} aria-label={t('settings.responseText')} />
          </div>
          <div className="flex items-center justify-between gap-4 rounded-lg px-3 py-2.5 text-sm">
            <span className="text-zinc-100">{t('settings.syncSystemTime')}</span>
            <Switch checked={useSystemTime} onCheckedChange={setUseSystemTime} aria-label={t('settings.syncSystemTime')} />
          </div>
          {!useSystemTime && (
            <div className="rounded-lg px-3 py-2.5 text-sm">
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="text-zinc-100">{t('settings.timeOfDay')}</span>
                <span className="text-zinc-400 tabular-nums">{formatTimeOfDay(timeOfDay)}</span>
              </div>
              <input type="range" min={0} max={24} step={0.5} value={timeOfDay} onChange={(e) => setTimeOfDay(Number(e.target.value))} className="w-full h-2 rounded-full appearance-none bg-zinc-700 accent-primary" aria-label={t('settings.timeOfDay')} />
            </div>
          )}
        </div>
      )}

      {activeTab === 'speech' && (
        <div className="grid gap-1">
          {speechLanguageOptions.map((opt) => (
            <button key={opt.value} type="button" onClick={() => setSpeechLang(opt.value)} className={menuItemClasses(speechLang === opt.value)} role="menuitem">
              {t(opt.labelKey)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
