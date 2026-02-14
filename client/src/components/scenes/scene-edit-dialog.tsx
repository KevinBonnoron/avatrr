import type { SceneConfig } from '@avatrr/shared';
import { Save, X } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FormField } from '@/components/atoms/form-field';
import { Button } from '@/components/ui/button';
import { Dialog, DialogClose, DialogContent, DialogFooter, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}

const EMPTY_SCENE: SceneConfig = { id: '', name: '', type: '2d', path: '' };

interface Props {
  entry?: SceneConfig;
  onSave: (entry: SceneConfig) => void;
  isPending?: boolean;
  children: React.ReactNode;
}

export function SceneEditDialog({ entry, onSave, isPending, children }: Props) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<SceneConfig>({ ...EMPTY_SCENE });
  const isEdit = entry != null;

  function handleOpenChange(isOpen: boolean) {
    setOpen(isOpen);
    if (isOpen) {
      setEditing(entry ? { ...entry } : { ...EMPTY_SCENE });
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
        <DialogTitle>{isEdit ? t('admin.scenes.edit') : t('admin.scenes.create')}</DialogTitle>
        <div className="space-y-3">
          <FormField label={t('admin.scenes.name')}>
            <Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value, id: slugify(e.target.value) })} placeholder="Forest" />
          </FormField>
          <FormField label={t('admin.scenes.type')}>
            <select
              value={editing.type}
              onChange={(e) => setEditing({ ...editing, type: e.target.value as '2d' | 'hdri' })}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="2d">{t('admin.scenes.type2d')}</option>
              <option value="hdri">{t('admin.scenes.typeHdri')}</option>
            </select>
          </FormField>
          <FormField label={t('admin.scenes.path')}>
            <Input value={editing.path} onChange={(e) => setEditing({ ...editing, path: e.target.value })} placeholder="/data/scenes/forest.jpg" />
          </FormField>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="ghost" size="sm">
              <X className="size-4" />
              {t('admin.cancel')}
            </Button>
          </DialogClose>
          <Button size="sm" onClick={handleSave} disabled={!editing.name || !editing.path || isPending}>
            <Save className="size-4" />
            {t('admin.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
