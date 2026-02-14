import type { PropsWithChildren } from 'react';
import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  className?: string;
}

export function BottomSheet({ open, onOpenChange, title, className, children }: PropsWithChildren<Props>) {
  useEffect(() => {
    if (!open) {
      return;
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onOpenChange(false);
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, onOpenChange]);

  return createPortal(
    <>
      {/* Backdrop */}
      <div className={cn('fixed inset-0 z-40 bg-black/40 backdrop-blur-sm transition-opacity duration-200', open ? 'opacity-100' : 'opacity-0 pointer-events-none')} onClick={() => onOpenChange(false)} />

      {/* Sheet */}
      <div className={cn('fixed inset-x-0 bottom-0 z-50 flex flex-col rounded-t-2xl border-t border-zinc-700 bg-zinc-900/95 backdrop-blur shadow-xl transition-transform duration-300 ease-out max-h-[70vh]', open ? 'translate-y-0' : 'translate-y-full', className)}>
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="h-1 w-10 rounded-full bg-zinc-600" />
        </div>

        {title && <h2 className="px-4 pb-2 text-sm font-medium text-zinc-300">{title}</h2>}

        <div className="flex-1 overflow-y-auto px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          {children}
        </div>
      </div>
    </>,
    document.body,
  );
}
