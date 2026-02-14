import type { ConfigTtsEntry } from '@avatrr/shared';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ttsClient } from '@/clients/tts.client';
import type { AvatarEntry } from './avatar-edit-dialog';
import { FormField } from '@/components/atoms/form-field';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { SuggestOption } from '@/components/ui/suggest-input';
import { SuggestInput } from '@/components/ui/suggest-input';

interface Props {
  editing: AvatarEntry;
  onChange: (entry: AvatarEntry) => void;
  ttsNames: string[];
  ttsConfigs: Record<string, ConfigTtsEntry>;
}

export function TtsTab({ editing, onChange, ttsNames, ttsConfigs }: Props) {
  const { t } = useTranslation();
  const parentConfig = editing.tts?.ref ? ttsConfigs[editing.tts.ref] : undefined;
  const parentVoice = parentConfig?.options?.voice;
  const parentType = parentConfig?.type;
  const [voiceSuggestions, setVoiceSuggestions] = useState<(string | SuggestOption)[]>([]);

  const voicePlaceholder = parentVoice
    ?? (parentType === 'openai' ? `alloy (${t('admin.tts.default')})` : undefined);

  // Fetch dynamic voices based on parent TTS config
  useEffect(() => {
    if (!parentConfig) {
      setVoiceSuggestions([]);
      return;
    }
    const opts: { baseUrl?: string; apiKey?: string } = {};
    if (parentConfig.type === 'sirene' && parentConfig.options?.baseUrl) {
      opts.baseUrl = parentConfig.options.baseUrl;
    } else if (parentConfig.type === 'elevenlabs' && parentConfig.options?.apiKey) {
      opts.apiKey = parentConfig.options.apiKey;
    } else {
      setVoiceSuggestions([]);
      return;
    }
    let cancelled = false;
    ttsClient.getVoices(parentConfig.type, opts)
      .then((voices) => {
        if (!cancelled) {
          setVoiceSuggestions(voices);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setVoiceSuggestions([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [parentConfig]);

  return (
    <div className="space-y-3">
      <FormField label={t('admin.avatars.ttsName')}>
        <Select value={editing.tts?.ref ?? '__none__'} onValueChange={(v) => onChange({ ...editing, tts: v !== '__none__' ? { ref: v, overrides: editing.tts?.overrides } : undefined })}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">— {t('admin.avatars.noOverride')} —</SelectItem>
            {ttsNames.map((n) => (
              <SelectItem key={n} value={n}>
                {n}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FormField>
      {editing.tts &&
        (() => {
          const tts = editing.tts;
          return (
            <>
              {parentType !== 'local' && (
                <FormField label={t('admin.tts.voice')}>
                  <SuggestInput
                    value={tts.overrides?.voice ?? ''}
                    onChange={(v) => onChange({ ...editing, tts: { ...tts, overrides: { ...tts.overrides, voice: v || undefined } } })}
                    suggestions={voiceSuggestions}
                    placeholder={voicePlaceholder}
                  />
                </FormField>
              )}
              <FormField label={t('admin.tts.speed')}>
                <Input type="number" step="0.1" value={tts.overrides?.speed ?? ''} onChange={(e) => onChange({ ...editing, tts: { ...tts, overrides: { ...tts.overrides, speed: e.target.value ? Number(e.target.value) : undefined } } })} placeholder="1.0" />
              </FormField>
            </>
          );
        })()}
    </div>
  );
}
