import { useTranslation } from 'react-i18next';
import type { AvatarEntry } from './avatar-edit-dialog';
import { FormField } from '@/components/atoms/form-field';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { useLlmModels } from '@/hooks/useLlms';
import { useMemoryStatus } from '@/hooks/useMemories';

interface Props {
  editing: AvatarEntry;
  onChange: (entry: AvatarEntry) => void;
  llmNames: string[];
}

export function LlmTab({ editing, onChange, llmNames }: Props) {
  const { t } = useTranslation();
  const llmRefName = editing.llm?.ref;
  const { data: llmModels = [], isLoading: loadingModels } = useLlmModels(llmRefName);
  const { data: memoryStatus } = useMemoryStatus();

  return (
    <div className="space-y-3">
      {memoryStatus?.enabled && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-zinc-300">{t('admin.avatars.memory')}</span>
          <Switch
            checked={editing.llm?.memory !== false}
            onCheckedChange={(checked) => editing.llm && onChange({ ...editing, llm: { ...editing.llm, memory: checked ? undefined : false } })}
          />
        </div>
      )}
      <FormField label={t('admin.avatars.llmName')}>
        <Select
          value={llmRefName ?? '__none__'}
          onValueChange={(v) => {
            if (v === '__none__') {
              onChange({ ...editing, llm: undefined });
            } else {
              onChange({ ...editing, llm: { ref: v, overrides: editing.llm?.overrides as { systemPrompt?: string; model?: string } } });
            }
          }}
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">— {t('admin.avatars.noOverride')} —</SelectItem>
            {llmNames.map((name) => (
              <SelectItem key={name} value={name}>
                {name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FormField>
      {editing.llm &&
        (() => {
          const llm = editing.llm as { ref: string; overrides?: { systemPrompt?: string; model?: string } };
          return (
            <>
              <FormField label={t('admin.llm.model')}>
                <Select value={llm.overrides?.model ?? '__none__'} onValueChange={(v) => onChange({ ...editing, llm: { ...llm, overrides: { ...llm.overrides, model: v !== '__none__' ? v : undefined } } })} disabled={loadingModels}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">— {t('admin.avatars.noOverride')} —</SelectItem>
                    {llmModels.map((m) => (
                      <SelectItem key={m} value={m}>
                        {m}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
              <FormField label={t('admin.avatars.systemPrompt')}>
                <Textarea value={llm.overrides?.systemPrompt ?? ''} onChange={(e) => onChange({ ...editing, llm: { ...llm, overrides: { ...llm.overrides, systemPrompt: e.target.value || undefined } } })} rows={6} />
              </FormField>
            </>
          );
        })()}
    </div>
  );
}
