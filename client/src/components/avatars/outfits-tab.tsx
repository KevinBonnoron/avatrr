import { Plus, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { AvatarEntry } from './avatar-edit-dialog';
import { FormField } from '@/components/atoms/form-field';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Combobox } from '@/components/ui/combobox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}

interface Props {
  editing: AvatarEntry;
  onChange: (entry: AvatarEntry) => void;
  modelOptions: { label: string; value: string }[];
}

export function OutfitsTab({ editing, onChange, modelOptions }: Props) {
  const { t } = useTranslation();

  return (
    <div className="space-y-3">
      {editing.outfits.map((outfit, oi) => (
        <div key={`${outfit.id}-${oi}`} className="rounded-lg border border-zinc-700 bg-zinc-800/50 p-3 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Label className="text-xs font-medium text-zinc-300">#{oi + 1}</Label>
              {outfit.default && <Badge variant="success">{t('admin.avatars.outfitDefault')}</Badge>}
            </div>
            <div className="flex items-center gap-1">
              {!outfit.default && (
                <Button
                  variant="ghost"
                  size="xs"
                  onClick={() => {
                    const next = editing.outfits.map((o, j) => ({ ...o, default: j === oi ? true : undefined }));
                    onChange({ ...editing, outfits: next });
                  }}
                >
                  {t('admin.avatars.setDefault')}
                </Button>
              )}
              {editing.outfits.length > 1 && (
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => {
                    const next = editing.outfits.filter((_, j) => j !== oi);
                    if (outfit.default && next.length > 0) {
                      next[0] = { ...next[0], default: true };
                    }
                    onChange({ ...editing, outfits: next });
                  }}
                  className="hover:text-red-400"
                >
                  <Trash2 className="size-3.5" />
                </Button>
              )}
            </div>
          </div>
          <FormField label={t('admin.avatars.outfitLabel')} labelClassName="text-xs">
            <Input
              value={outfit.label}
              onChange={(e) => {
                const next = [...editing.outfits];
                next[oi] = { ...next[oi], label: e.target.value, id: slugify(e.target.value) || `outfit_${oi + 1}` };
                onChange({ ...editing, outfits: next });
              }}
              placeholder="Default"
            />
          </FormField>
          <FormField label={t('admin.avatars.outfitModelPath')} labelClassName="text-xs">
            <Combobox
              value={outfit.modelPath}
              onChange={(v) => {
                const next = [...editing.outfits];
                next[oi] = { ...next[oi], modelPath: v };
                onChange({ ...editing, outfits: next });
              }}
              options={modelOptions}
              placeholder="/data/models/avatar.vrm"
              searchPlaceholder={t('admin.avatars.searchModel')}
              emptyText={t('admin.avatars.noModels')}
            />
          </FormField>
        </div>
      ))}
      <button
        type="button"
        onClick={() => {
          const idx = editing.outfits.length + 1;
          onChange({ ...editing, outfits: [...editing.outfits, { id: `outfit_${idx}`, label: '', modelPath: '' }] });
        }}
        className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-zinc-600 py-2 text-sm text-zinc-400 hover:border-zinc-500 hover:text-white transition-colors"
      >
        <Plus className="size-4" />
        {t('admin.avatars.addOutfit')}
      </button>
    </div>
  );
}
