import type { ConfigLlmEntry } from '@avatrr/shared';
import { Save, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { llmClient } from '@/clients/llm.client';
import { FormField } from '@/components/atoms/form-field';
import { Button } from '@/components/ui/button';
import { Dialog, DialogClose, DialogContent, DialogFooter, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SuggestInput } from '@/components/ui/suggest-input';

const EMPTY_LLM: ConfigLlmEntry = { name: '', type: 'ollama' };

interface Props {
  entry?: ConfigLlmEntry;
  onSave: (entry: ConfigLlmEntry) => void;
  isPending?: boolean;
  children: React.ReactNode;
}

export function LlmEditDialog({ entry, onSave, isPending, children }: Props) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ConfigLlmEntry>({ ...EMPTY_LLM });
  const [modelSuggestions, setModelSuggestions] = useState<string[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const isEdit = entry != null;

  const needsUrl = editing.type === 'ollama' || editing.type === 'openai';
  const needsApiKey = editing.type === 'openai' || editing.type === 'anthropic';

  // Fetch model suggestions when type/url/apiKey change
  const fetchType = editing.type;
  const fetchUrl = (editing.options as { url?: string } | undefined)?.url;
  const fetchApiKey = (editing.options as { apiKey?: string } | undefined)?.apiKey;
  useEffect(() => {
    if (!open) {
      return;
    }
    let cancelled = false;
    const entry = { name: '', type: fetchType, options: { url: fetchUrl, apiKey: fetchApiKey } };
    setLoadingModels(true);
    llmClient.fetchModels(entry as unknown as Record<string, unknown>)
      .then((models) => {
        if (!cancelled) {
          setModelSuggestions(models);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setModelSuggestions([]);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingModels(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [open, fetchType, fetchUrl, fetchApiKey]);

  function handleOpenChange(isOpen: boolean) {
    setOpen(isOpen);
    if (isOpen) {
      setEditing(entry ? { ...entry, options: { ...entry.options } } : { ...EMPTY_LLM, options: { ...EMPTY_LLM.options } });
    }
  }

  function handleSave() {
    onSave(editing);
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent showCloseButton={false}>
        <DialogTitle>{isEdit ? t('admin.llm.edit') : t('admin.llm.create')}</DialogTitle>
        <div className="space-y-3">
          <FormField label={t('admin.llm.name')}>
            <Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} placeholder="default" />
          </FormField>
          <FormField label={t('admin.llm.type')}>
            <Select
              value={editing.type}
              onValueChange={(value) => {
                const type = value as ConfigLlmEntry['type'];
                const prevOpts: Record<string, unknown> = { ...editing.options };
                setEditing({
                  name: editing.name,
                  type,
                  options: {
                    ...prevOpts,
                    url: (type === 'ollama' || type === 'openai') ? prevOpts.url : undefined,
                    apiKey: (type === 'openai' || type === 'anthropic') ? prevOpts.apiKey : undefined,
                  },
                } as ConfigLlmEntry);
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ollama">Ollama</SelectItem>
                <SelectItem value="openai">OpenAI</SelectItem>
                <SelectItem value="anthropic">Anthropic</SelectItem>
                <SelectItem value="local">Local (Transformers.js)</SelectItem>
              </SelectContent>
            </Select>
          </FormField>
          {needsUrl && (
            <FormField label="URL">
              <Input value={editing.options?.url ?? ''} onChange={(e) => setEditing({ ...editing, options: { ...editing.options, url: e.target.value || undefined } })} placeholder={editing.type === 'ollama' ? 'http://localhost:11434' : 'https://api.openai.com/v1'} />
            </FormField>
          )}
          {needsApiKey && (
            <FormField label="API Key">
              <Input type="password" value={editing.options?.apiKey ?? ''} onChange={(e) => setEditing({ ...editing, options: { ...editing.options, apiKey: e.target.value || undefined } })} placeholder={editing.type === 'anthropic' ? 'sk-ant-...' : 'sk-...'} />
            </FormField>
          )}
          <FormField label={t('admin.llm.model')}>
            <SuggestInput
              value={editing.options?.model ?? ''}
              onChange={(v) => setEditing({ ...editing, options: { ...editing.options, model: v || undefined } })}
              suggestions={modelSuggestions}
              loading={loadingModels}
              placeholder={editing.type === 'local' ? 'onnx-community/Llama-3.2-1B-Instruct' : undefined}
            />
          </FormField>
          <FormField label={t('admin.llm.maxTokens')}>
            <Input type="number" value={editing.options?.maxTokens ?? 512} onChange={(e) => setEditing({ ...editing, options: { ...editing.options, maxTokens: Number(e.target.value) } })} />
          </FormField>
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
