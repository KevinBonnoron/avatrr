import type { ConfigAnimationEntry } from '@avatrr/shared';
import { Save, X } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Dialog, DialogClose, DialogContent, DialogFooter, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { FormField } from '@/components/atoms/form-field';
import { Input } from '@/components/ui/input';

export type AnimationEntry = ConfigAnimationEntry;

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}

const EMPTY_ANIMATION: AnimationEntry = { id: '', label: '' };

interface Props {
  entry?: AnimationEntry;
  onSave: (entry: AnimationEntry) => void;
  isPending?: boolean;
  children: React.ReactNode;
}

export function AnimationEditDialog({ entry, onSave, isPending, children }: Props) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<AnimationEntry>({ ...EMPTY_ANIMATION });
  const isEdit = entry != null;

  function handleOpenChange(isOpen: boolean) {
    setOpen(isOpen);
    if (isOpen) {
      setEditing(entry ? { ...entry } : { ...EMPTY_ANIMATION });
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
        <DialogTitle>{isEdit ? t('admin.animations.edit') : t('admin.animations.create')}</DialogTitle>
        <div className="space-y-3">
          <FormField label={t('admin.animations.label')}>
            <Input value={editing.label} onChange={(e) => setEditing({ ...editing, label: e.target.value, id: slugify(e.target.value) })} placeholder="Idle" />
          </FormField>
          <FormField label={`URL (${t('admin.animations.urlHint')})`}>
            <Input value={editing.url ?? ''} onChange={(e) => setEditing({ ...editing, url: e.target.value || undefined })} placeholder={`/data/animations/${editing.id || 'file'}.vrma`} />
          </FormField>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="ghost" size="sm">
              <X className="size-4" />
              {t('admin.cancel')}
            </Button>
          </DialogClose>
          <Button size="sm" onClick={handleSave} disabled={!editing.label || !slugify(editing.label) || isPending}>
            <Save className="size-4" />
            {t('admin.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
