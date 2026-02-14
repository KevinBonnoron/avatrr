import { Bot, Save, User, X } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Dialog, DialogClose, DialogContent, DialogFooter, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { FormField } from '@/components/atoms/form-field';
import { Textarea } from '@/components/ui/textarea';

type EditingState = { user: string; assistant: string } | { raw: string };

interface Props {
  text: string;
  onSave: (text: string) => void;
  isPending?: boolean;
  children: React.ReactNode;
}

function parseMemory(text: string): { user: string; assistant: string } | null {
  const match = text.match(/^User:\s*([\s\S]*?)\nAssistant:\s*([\s\S]*)$/);
  if (!match) {
    return null;
  }
  return { user: match[1].trim(), assistant: match[2].trim() };
}

export function MemoryEditDialog({ text, onSave, isPending, children }: Props) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<EditingState>({ raw: '' });

  function handleOpenChange(isOpen: boolean) {
    setOpen(isOpen);
    if (isOpen) {
      const parsed = parseMemory(text);
      if (parsed) {
        setEditing({ user: parsed.user, assistant: parsed.assistant });
      } else {
        setEditing({ raw: text });
      }
    }
  }

  function isValid(): boolean {
    if ('raw' in editing) {
      return editing.raw.trim().length > 0;
    }
    return editing.user.trim().length > 0 || editing.assistant.trim().length > 0;
  }

  function handleSave() {
    const result = 'raw' in editing ? editing.raw : `User: ${editing.user}\nAssistant: ${editing.assistant}`;
    onSave(result);
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent showCloseButton={false}>
        <DialogTitle>{t('admin.memory.edit')}</DialogTitle>
        {'raw' in editing ? (
          <div>
            <Textarea value={editing.raw} onChange={(e) => setEditing({ raw: e.target.value })} rows={4} placeholder={t('admin.memory.editPlaceholder')} />
          </div>
        ) : (
          <div className="space-y-3">
            <FormField label={<><User className="size-3.5 text-blue-400" />{t('admin.memory.userLabel')}</>}>
              <Textarea value={editing.user} onChange={(e) => setEditing({ ...editing, user: e.target.value })} rows={2} />
            </FormField>
            <FormField label={<><Bot className="size-3.5 text-emerald-400" />{t('admin.memory.assistantLabel')}</>}>
              <Textarea value={editing.assistant} onChange={(e) => setEditing({ ...editing, assistant: e.target.value })} rows={3} />
            </FormField>
          </div>
        )}
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="ghost" size="sm">
              <X className="size-4" />
              {t('admin.cancel')}
            </Button>
          </DialogClose>
          <Button size="sm" onClick={handleSave} disabled={!isValid() || isPending}>
            <Save className="size-4" />
            {t('admin.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
