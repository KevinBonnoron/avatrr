import type { ConfigTtsEntry } from '@avatrr/shared';
import { Save, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ttsClient } from '@/clients/tts.client';
import { FormField } from '@/components/atoms/form-field';
import { Button } from '@/components/ui/button';
import { Dialog, DialogClose, DialogContent, DialogFooter, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SuggestInput } from '@/components/ui/suggest-input';
import type { SuggestOption } from '@/components/ui/suggest-input';

const EMPTY_TTS: ConfigTtsEntry = { name: '', type: 'local' };

interface Props {
  entry?: ConfigTtsEntry;
  onSave: (entry: ConfigTtsEntry) => void;
  isPending?: boolean;
  children: React.ReactNode;
}

export function TtsEditDialog({ entry, onSave, isPending, children }: Props) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ConfigTtsEntry>({ ...EMPTY_TTS });
  const [modelSuggestions, setModelSuggestions] = useState<string[]>([]);
  const [voiceSuggestions, setVoiceSuggestions] = useState<(string | SuggestOption)[]>([]);
  const isEdit = entry != null;

  const needsApiKey = editing.type === 'openai' || editing.type === 'elevenlabs';
  const needsBaseUrl = editing.type === 'sirene';
  const needsSpeed = editing.type === 'openai' || editing.type === 'local' || editing.type === 'sirene';

  // Fetch model/voice suggestions when type changes
  const fetchType = editing.type;
  useEffect(() => {
    if (!open) {
      return;
    }
    let cancelled = false;
    ttsClient.getSuggestions(fetchType)
      .then((data) => {
        if (!cancelled) {
          setModelSuggestions(data.models);
          setVoiceSuggestions(data.voices);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setModelSuggestions([]);
          setVoiceSuggestions([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [open, fetchType]);

  // Fetch dynamic voices for providers that expose them (Sirene, ElevenLabs)
  const fetchBaseUrl = editing.type === 'sirene' ? editing.options?.baseUrl : undefined;
  const fetchApiKey = editing.type === 'elevenlabs' ? editing.options?.apiKey : undefined;
  useEffect(() => {
    if (!open) {
      return;
    }
    const opts: { baseUrl?: string; apiKey?: string } = {};
    if (fetchType === 'sirene' && fetchBaseUrl) {
      opts.baseUrl = fetchBaseUrl;
    } else if (fetchType === 'elevenlabs' && fetchApiKey) {
      opts.apiKey = fetchApiKey;
    } else {
      return;
    }
    let cancelled = false;
    ttsClient.getVoices(fetchType, opts)
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
  }, [open, fetchType, fetchBaseUrl, fetchApiKey]);

  function handleOpenChange(isOpen: boolean) {
    setOpen(isOpen);
    if (isOpen) {
      setEditing(entry ? { ...entry, options: { ...entry.options } } : { ...EMPTY_TTS, options: { ...EMPTY_TTS.options } });
    }
  }

  function handleSave() {
    onSave(editing);
    setOpen(false);
  }

  const needsModel = editing.type === 'local';
  const needsVoice = editing.type === 'openai' || editing.type === 'elevenlabs' || editing.type === 'sirene';

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent showCloseButton={false}>
        <DialogTitle>{isEdit ? t('admin.tts.edit') : t('admin.tts.create')}</DialogTitle>
        <div className="space-y-3">
          <FormField label={t('admin.tts.name')}>
            <Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} placeholder="default" />
          </FormField>
          <FormField label={t('admin.tts.type')}>
            <Select
              value={editing.type}
              onValueChange={(value) => {
                const type = value as ConfigTtsEntry['type'];
                const prevOpts: Record<string, unknown> = { ...editing.options };
                setEditing({
                  name: editing.name,
                  type,
                  options: {
                    ...prevOpts,
                    apiKey: (type === 'openai' || type === 'elevenlabs') ? prevOpts.apiKey : undefined,
                    baseUrl: type === 'sirene' ? prevOpts.baseUrl : undefined,
                  },
                } as ConfigTtsEntry);
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="local">Local (Transformers.js)</SelectItem>
                <SelectItem value="openai">OpenAI</SelectItem>
                <SelectItem value="elevenlabs">ElevenLabs</SelectItem>
                <SelectItem value="sirene">Sirene</SelectItem>
              </SelectContent>
            </Select>
          </FormField>
          {needsApiKey && (
            <FormField label="API Key">
              <Input type="password" value={editing.options?.apiKey ?? ''} onChange={(e) => setEditing({ ...editing, options: { ...editing.options, apiKey: e.target.value || undefined } })} placeholder={editing.type === 'elevenlabs' ? 'xi-...' : 'sk-...'} />
            </FormField>
          )}
          {needsBaseUrl && (
            <FormField label={t('admin.tts.baseUrl')}>
              <Input value={editing.options?.baseUrl ?? ''} onChange={(e) => setEditing({ ...editing, options: { ...editing.options, baseUrl: e.target.value || undefined } })} placeholder="http://localhost:3000" />
            </FormField>
          )}
          {needsModel && (
            <FormField label={t('admin.tts.model')}>
              <SuggestInput
                value={editing.options?.model ?? ''}
                onChange={(v) => setEditing({ ...editing, options: { ...editing.options, model: v || undefined } })}
                suggestions={modelSuggestions}
                placeholder="Xenova/speecht5_tts"
              />
            </FormField>
          )}
          {needsVoice && (
            <FormField label={t('admin.tts.voice')}>
              <SuggestInput
                value={editing.options?.voice ?? ''}
                onChange={(v) => setEditing({ ...editing, options: { ...editing.options, voice: v || undefined } })}
                suggestions={voiceSuggestions}
                placeholder={
                  editing.type === 'openai' ? `alloy (${t('admin.tts.default')})` : undefined
                }
              />
            </FormField>
          )}
          {needsSpeed && (
            <FormField label={t('admin.tts.speed')}>
              <Input type="number" step="0.1" value={editing.options?.speed ?? ''} onChange={(e) => setEditing({ ...editing, options: { ...editing.options, speed: e.target.value ? Number(e.target.value) : undefined } })} placeholder="1.0" />
            </FormField>
          )}
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="ghost" size="sm">
              <X className="size-4" />
              {t('admin.cancel')}
            </Button>
          </DialogClose>
          <Button size="sm" onClick={handleSave} disabled={!editing.name || isPending}>
            <Save className="size-4" />
            {t('admin.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
