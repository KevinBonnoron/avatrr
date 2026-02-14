import { Save, X } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Dialog, DialogClose, DialogContent, DialogFooter, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';

interface Props {
  text: string;
  onSave: (text: string) => void;
  isPending?: boolean;
  children: React.ReactNode;
}

export function MessageEditDialog({ text, onSave, isPending, children }: Props) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState('');

  function handleOpenChange(isOpen: boolean) {
    setOpen(isOpen);
    if (isOpen) {
      setValue(text);
    }
  }

  function handleSave() {
    onSave(value.trim());
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent showCloseButton={false}>
        <DialogTitle>{t('admin.conversations.editMessage')}</DialogTitle>
        <Textarea value={value} onChange={(e) => setValue(e.target.value)} rows={5} />
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="ghost" size="sm">
              <X className="size-4" />
              {t('admin.cancel')}
            </Button>
          </DialogClose>
          <Button size="sm" onClick={handleSave} disabled={!value.trim() || isPending}>
            <Save className="size-4" />
            {t('admin.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
