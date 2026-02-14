import { cn } from '@/lib/utils';

interface Props {
  variant: 'invite' | 'active' | 'vad';
  className?: string;
}

export function PulseRing({ variant, className }: Props) {
  if (variant === 'invite') {
    return (
      <>
        <span className={cn('absolute size-14 rounded-full border-2 border-zinc-400/60 animate-orb-ping', className)} />
        <span className={cn('absolute size-14 rounded-full border-2 border-zinc-400/40 animate-orb-pulse', className)} />
      </>
    );
  }

  if (variant === 'vad') {
    return (
      <>
        <span className={cn('absolute size-14 animate-orb-ping rounded-full bg-emerald-500/20', className)} />
        <span className={cn('absolute size-14 animate-orb-pulse rounded-full bg-emerald-500/30', className)} />
      </>
    );
  }

  return (
    <>
      <span className={cn('absolute size-14 animate-orb-ping rounded-full bg-red-500/20', className)} />
      <span className={cn('absolute size-14 animate-orb-pulse rounded-full bg-red-500/30', className)} />
    </>
  );
}
