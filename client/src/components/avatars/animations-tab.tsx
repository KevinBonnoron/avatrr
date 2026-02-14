import { useTranslation } from 'react-i18next';
import type { AvatarEntry } from './avatar-edit-dialog';
import { FormField } from '@/components/atoms/form-field';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface Props {
  editing: AvatarEntry;
  onChange: (entry: AvatarEntry) => void;
  animationList: { id: string; label: string }[];
}

export function AnimationsTab({ editing, onChange, animationList }: Props) {
  const { t } = useTranslation();

  return (
    <div className="space-y-3">
      <FormField label={t('admin.avatars.availableAnimations')}>
        <div className="flex flex-wrap gap-1.5">
          {animationList.map((anim) => {
            const selected = editing.animations?.available?.includes(anim.id) ?? false;
            return (
              <button
                key={anim.id}
                type="button"
                onClick={() => {
                  const ids = editing.animations?.available ? [...editing.animations.available] : [];
                  const anims = editing.animations ?? {};
                  if (selected) {
                    onChange({ ...editing, animations: { ...anims, available: ids.filter((id) => id !== anim.id) } });
                  } else {
                    ids.push(anim.id);
                    onChange({ ...editing, animations: { ...anims, available: ids } });
                  }
                }}
                className={`rounded-full border px-2.5 py-0.5 text-xs transition-colors ${selected ? 'border-primary bg-primary/20 text-primary' : 'border-zinc-600 text-zinc-400 hover:text-white'}`}
              >
                {anim.label}
              </button>
            );
          })}
        </div>
      </FormField>
      <div className="grid grid-cols-2 gap-3">
        <FormField label={t('admin.avatars.defaultAnimation')}>
          <Select value={editing.animations?.idle ?? '__none__'} onValueChange={(v) => onChange({ ...editing, animations: { ...editing.animations, idle: v !== '__none__' ? v : undefined } })}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">—</SelectItem>
              {animationList.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>
        <FormField label={t('admin.avatars.appearingAnimation')}>
          <Select value={editing.animations?.appearing ?? '__none__'} onValueChange={(v) => onChange({ ...editing, animations: { ...editing.animations, appearing: v !== '__none__' ? v : undefined } })}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">—</SelectItem>
              {animationList.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>
      </div>
    </div>
  );
}
