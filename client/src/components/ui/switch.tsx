import { forwardRef } from 'react';
import { cn } from '@/lib/utils';

export interface SwitchProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
  'aria-label'?: string;
  'aria-labelledby'?: string;
}

/**
 * Toggle switch: pill track with sliding thumb. Clear on/off state (primary when on, zinc when off).
 */
export const Switch = forwardRef<HTMLButtonElement, SwitchProps>(function Switch(
  { checked, onCheckedChange, disabled = false, className, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        'relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900 disabled:cursor-not-allowed disabled:opacity-50',
        checked ? 'border-primary bg-primary' : 'border-zinc-600 bg-zinc-700',
        className,
      )}
      {...props}
    >
      <span
        className={cn(
          'pointer-events-none block size-5 rounded-full shadow-sm ring-0 transition-transform',
          checked ? 'translate-x-[22px] bg-primary-foreground' : 'translate-x-0.5 bg-white',
        )}
      />
    </button>
  );
});
