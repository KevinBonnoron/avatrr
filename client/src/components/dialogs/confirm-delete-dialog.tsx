import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Dialog, DialogClose, DialogContent, DialogFooter, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

interface Props {
  title?: string;
  description: string;
  onConfirm: () => void;
  children: React.ReactNode;
}

export function ConfirmDeleteDialog({ title, description, onConfirm, children }: Props) {
  const { t } = useTranslation();

  return (
    <Dialog>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent showCloseButton={false} onCloseAutoFocus={(e) => e.preventDefault()}>
        <DialogTitle>{title ?? t('admin.confirmDelete')}</DialogTitle>
        <p className="text-sm text-zinc-400">{description}</p>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="ghost" size="sm">
              {t('admin.cancel')}
            </Button>
          </DialogClose>
          <DialogClose asChild>
            <Button variant="destructive" size="sm" onClick={onConfirm}>
              {t('admin.delete')}
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
