import type { ReactNode } from 'react';
import { PulseRing } from '@/components/ui/pulse-ring';
import { cn } from '@/lib/utils';

type OrbState = 'idle' | 'listening' | 'vad' | 'busy';

interface Props {
  state: OrbState;
  onClick: () => void;
  icon: ReactNode;
  'aria-label': string;
  className?: string;
}

const stateClasses: Record<OrbState, string> = {
  idle: 'bg-zinc-600 shadow-zinc-500/20',
  listening: 'bg-red-600 shadow-red-500/30',
  vad: 'bg-red-600 shadow-red-500/30',
  busy: 'bg-zinc-700 shadow-zinc-600/20',
};

export function OrbButton({ state, onClick, icon, 'aria-label': ariaLabel, className }: Props) {
  const showInvite = state === 'idle';
  const showActive = state === 'listening';
  const showVad = state === 'vad';

  return (
    <button type="button" onClick={onClick} className={cn('relative flex size-20 items-center justify-center rounded-full', className)} aria-label={ariaLabel}>
      {showInvite && <PulseRing variant="invite" />}
      {showActive && <PulseRing variant="active" />}
      {showVad && <PulseRing variant="vad" />}
      <span className={cn('relative flex size-14 items-center justify-center rounded-full transition-colors shadow-lg', stateClasses[state])}>
        {icon}
      </span>
    </button>
  );
}
